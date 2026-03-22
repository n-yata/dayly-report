import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { dailyReportUpdateSchema } from '@/lib/schemas/daily-report'
import { formatDailyReport, dailyReportInclude } from '@/lib/api/daily-report-helpers'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/v1/daily-reports/:id - 日報詳細取得
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
      include: dailyReportInclude,
    })

    if (!report) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    // salesは自分の日報のみアクセス可能
    if (session.role === 'sales' && report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報にアクセスする権限がありません')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return successResponse(formatDailyReport(report as any))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('GET /daily-reports/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// PUT /api/v1/daily-reports/:id - 日報更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // 他ユーザーの日報は更新不可
    if (report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報を更新する権限がありません')
    }

    // draft or rejected のみ更新可能
    if (report.status !== 'draft' && report.status !== 'rejected') {
      return errorResponse(
        'VALIDATION_ERROR',
        'この日報は編集できません（下書きまたは差し戻し状態のみ編集可能）'
      )
    }

    const body = await request.json()
    const parsed = dailyReportUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const updated = await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        ...(parsed.data.problem !== undefined ? { problem: parsed.data.problem } : {}),
        ...(parsed.data.plan !== undefined ? { plan: parsed.data.plan } : {}),
      },
      include: dailyReportInclude,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return successResponse(formatDailyReport(updated as any))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('PUT /daily-reports/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
