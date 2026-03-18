import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { customerUpdateSchema } from '@/lib/schemas/customer'

type RouteParams = { params: Promise<{ id: string }> }

function formatCustomer(customer: {
  id: number
  companyName: string
  contactName: string
  phone: string | null
  email: string | null
  address: string | null
}) {
  return {
    id: customer.id,
    company_name: customer.companyName,
    contact_name: customer.contactName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
  }
}

// PUT /api/v1/customers/:id - 顧客更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)

    // managerのみ更新可能
    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみ顧客を更新できます')
    }

    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return errorResponse('NOT_FOUND', '顧客が見つかりません')
    }

    const existing = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!existing) {
      return errorResponse('NOT_FOUND', '顧客が見つかりません')
    }

    const body = await request.json()
    const parsed = customerUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const updateData: {
      companyName?: string
      contactName?: string
      phone?: string | null
      email?: string | null
      address?: string | null
    } = {}

    if (parsed.data.company_name !== undefined) updateData.companyName = parsed.data.company_name
    if (parsed.data.contact_name !== undefined) updateData.contactName = parsed.data.contact_name
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    })

    return successResponse(formatCustomer(customer))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('PUT /customers/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// DELETE /api/v1/customers/:id - 顧客削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)

    // managerのみ削除可能
    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみ顧客を削除できます')
    }

    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return errorResponse('NOT_FOUND', '顧客が見つかりません')
    }

    const existing = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!existing) {
      return errorResponse('NOT_FOUND', '顧客が見つかりません')
    }

    await prisma.customer.delete({ where: { id: customerId } })

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('DELETE /customers/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
