import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { commentCreateSchema, commentListQuerySchema } from '@/lib/schemas/comment'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/v1/daily-reports/:id/comments - コメント一覧取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)
    const { id } = await params
    const reportId = parseInt(id)

    if (isNaN(reportId)) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    // salesは自分の日報のコメントのみ取得可能
    if (session.role === 'sales' && report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報のコメントを取得する権限がありません')
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      target_type: searchParams.get('target_type') ?? undefined,
    }

    const parsed = commentListQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const comments = await prisma.comment.findMany({
      where: {
        dailyReportId: reportId,
        ...(parsed.data.target_type ? { targetType: parsed.data.target_type } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return successResponse(
      comments.map((c) => ({
        id: c.id,
        targetType: c.targetType,
        content: c.content,
        user: { id: c.user.id, name: c.user.name },
        createdAt: c.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('GET /daily-reports/:id/comments error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// POST /api/v1/daily-reports/:id/comments - コメント投稿
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)
    const { id } = await params
    const reportId = parseInt(id)

    if (isNaN(reportId)) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    // salesは自分の日報にのみコメント可能
    if (session.role === 'sales' && report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報にコメントする権限がありません')
    }

    const body = await request.json()
    const parsed = commentCreateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const comment = await prisma.comment.create({
      data: {
        dailyReportId: reportId,
        userId: session.userId,
        targetType: parsed.data.target_type,
        content: parsed.data.content,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    return successResponse(
      {
        id: comment.id,
        dailyReportId: comment.dailyReportId,
        targetType: comment.targetType,
        content: comment.content,
        user: { id: comment.user.id, name: comment.user.name },
        createdAt: comment.createdAt.toISOString(),
      },
      201
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /daily-reports/:id/comments error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
