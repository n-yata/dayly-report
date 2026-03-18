import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { visitRecordUpdateSchema } from '@/lib/schemas/daily-report'

type RouteParams = { params: Promise<{ id: string }> }

// PUT /api/v1/visit-records/:id - 訪問記録更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)
    const { id } = await params
    const visitId = parseInt(id)

    if (isNaN(visitId)) {
      return errorResponse('NOT_FOUND', '訪問記録が見つかりません')
    }

    const visitRecord = await prisma.visitRecord.findUnique({
      where: { id: visitId },
      include: { dailyReport: true },
    })

    if (!visitRecord) {
      return errorResponse('NOT_FOUND', '訪問記録が見つかりません')
    }

    // 作成者のみ更新可能
    if (visitRecord.dailyReport.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この訪問記録を更新する権限がありません')
    }

    // draft or rejected 状態のみ更新可能
    if (
      visitRecord.dailyReport.status !== 'draft' &&
      visitRecord.dailyReport.status !== 'rejected'
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        '下書きまたは差し戻し状態の日報の訪問記録のみ更新できます'
      )
    }

    const body = await request.json()
    const parsed = visitRecordUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const updateData: {
      customerId?: number
      visitTime?: string
      purpose?: string
      caseProduct?: string | null
      nextAction?: string | null
    } = {}

    if (parsed.data.customer_id !== undefined) updateData.customerId = parsed.data.customer_id
    if (parsed.data.visit_time !== undefined) updateData.visitTime = parsed.data.visit_time
    if (parsed.data.purpose !== undefined) updateData.purpose = parsed.data.purpose
    if (parsed.data.case_product !== undefined) updateData.caseProduct = parsed.data.case_product
    if (parsed.data.next_action !== undefined) updateData.nextAction = parsed.data.next_action

    const updated = await prisma.visitRecord.update({
      where: { id: visitId },
      data: updateData,
      include: {
        customer: { select: { companyName: true } },
      },
    })

    return successResponse({
      id: updated.id,
      dailyReportId: updated.dailyReportId,
      customerId: updated.customerId,
      customerName: updated.customer.companyName,
      visitTime: updated.visitTime,
      purpose: updated.purpose,
      caseProduct: updated.caseProduct,
      nextAction: updated.nextAction,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('PUT /visit-records/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// DELETE /api/v1/visit-records/:id - 訪問記録削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)
    const { id } = await params
    const visitId = parseInt(id)

    if (isNaN(visitId)) {
      return errorResponse('NOT_FOUND', '訪問記録が見つかりません')
    }

    const visitRecord = await prisma.visitRecord.findUnique({
      where: { id: visitId },
      include: { dailyReport: true },
    })

    if (!visitRecord) {
      return errorResponse('NOT_FOUND', '訪問記録が見つかりません')
    }

    // 作成者のみ削除可能
    if (visitRecord.dailyReport.userId !== session.userId) {
      return errorResponse('FORBIDDEN', 'この訪問記録を削除する権限がありません')
    }

    // draft or rejected 状態のみ削除可能
    if (
      visitRecord.dailyReport.status !== 'draft' &&
      visitRecord.dailyReport.status !== 'rejected'
    ) {
      return errorResponse(
        'VALIDATION_ERROR',
        '下書きまたは差し戻し状態の日報の訪問記録のみ削除できます'
      )
    }

    await prisma.visitRecord.delete({ where: { id: visitId } })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('DELETE /visit-records/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
