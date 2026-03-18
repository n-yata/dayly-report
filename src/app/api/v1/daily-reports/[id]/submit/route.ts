import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/v1/daily-reports/:id/submit - 日報提出
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
      include: { _count: { select: { visitRecords: true } } },
    })

    if (!report) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    // 作成者のみ提出可能
    if (report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報を提出する権限がありません')
    }

    // draft or rejected のみ提出可能
    if (report.status !== 'draft' && report.status !== 'rejected') {
      return errorResponse(
        'VALIDATION_ERROR',
        'この日報は提出できません（下書きまたは差し戻し状態のみ提出可能）'
      )
    }

    // 訪問記録が1件以上必要
    if (report._count.visitRecords === 0) {
      return errorResponse('VALIDATION_ERROR', '訪問記録が1件以上必要です')
    }

    const updated = await prisma.dailyReport.update({
      where: { id: reportId },
      data: { status: 'submitted' },
    })

    return successResponse({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /daily-reports/:id/submit error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
