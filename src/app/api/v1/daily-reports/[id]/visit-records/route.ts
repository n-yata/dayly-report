import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { visitRecordCreateSchema } from '@/lib/schemas/daily-report'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/v1/daily-reports/:id/visit-records - 訪問記録追加
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

    // 作成者のみ追加可能
    if (report.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この日報に訪問記録を追加する権限がありません')
    }

    // draft or rejected 状態のみ追加可能
    if (report.status !== 'draft' && report.status !== 'rejected') {
      return errorResponse(
        'VALIDATION_ERROR',
        '下書きまたは差し戻し状態の日報にのみ訪問記録を追加できます'
      )
    }

    const body = await request.json()
    const parsed = visitRecordCreateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const { customer_id, visit_time, purpose, case_product, next_action } = parsed.data

    // 顧客の存在確認
    const customer = await prisma.customer.findUnique({
      where: { id: customer_id },
    })
    if (!customer) {
      return errorResponse('VALIDATION_ERROR', `顧客ID ${customer_id} が存在しません`)
    }

    const visitRecord = await prisma.visitRecord.create({
      data: {
        dailyReportId: reportId,
        customerId: customer_id,
        visitTime: visit_time,
        purpose,
        caseProduct: case_product ?? null,
        nextAction: next_action ?? null,
      },
      include: {
        customer: { select: { companyName: true } },
      },
    })

    return successResponse(
      {
        id: visitRecord.id,
        dailyReportId: visitRecord.dailyReportId,
        customerId: visitRecord.customerId,
        customerName: visitRecord.customer.companyName,
        visitTime: visitRecord.visitTime,
        purpose: visitRecord.purpose,
        caseProduct: visitRecord.caseProduct,
        nextAction: visitRecord.nextAction,
        createdAt: visitRecord.createdAt.toISOString(),
        updatedAt: visitRecord.updatedAt.toISOString(),
      },
      201
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /daily-reports/:id/visit-records error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
