import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/v1/daily-reports/:id/approve - 日報承認
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)
    const { id } = await params
    const reportId = parseInt(id)

    // managerのみ承認可能
    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみ承認操作が可能です')
    }

    if (isNaN(reportId)) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      return errorResponse('NOT_FOUND', '日報が見つかりません')
    }

    // submitted のみ承認可能
    if (report.status !== 'submitted') {
      return errorResponse('VALIDATION_ERROR', '提出済み状態の日報のみ承認できます')
    }

    const now = new Date()
    const updated = await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        status: 'approved',
        approvedBy: session.userId,
        approvedAt: now,
      },
      include: {
        approver: { select: { id: true, name: true } },
      },
    })

    return successResponse({
      id: updated.id,
      status: updated.status,
      approvedBy: updated.approver
        ? { id: updated.approver.id, name: updated.approver.name }
        : null,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /daily-reports/:id/approve error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
