import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { customerCreateSchema, customerListQuerySchema } from '@/lib/schemas/customer'

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

// GET /api/v1/customers - 顧客一覧取得
export async function GET(request: NextRequest) {
  try {
    await requireSession(request)

    const { searchParams } = new URL(request.url)
    const queryParams = { q: searchParams.get('q') ?? undefined }

    const parsed = customerListQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const customers = await prisma.customer.findMany({
      where: parsed.data.q
        ? {
            OR: [
              { companyName: { contains: parsed.data.q } },
              { contactName: { contains: parsed.data.q } },
            ],
          }
        : undefined,
      orderBy: { companyName: 'asc' },
    })

    return successResponse(customers.map(formatCustomer))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('GET /customers error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// POST /api/v1/customers - 顧客登録
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request)

    // managerのみ登録可能
    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみ顧客を登録できます')
    }

    const body = await request.json()
    const parsed = customerCreateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const customer = await prisma.customer.create({
      data: {
        companyName: parsed.data.company_name,
        contactName: parsed.data.contact_name,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
      },
    })

    return successResponse(formatCustomer(customer), 201)
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /customers error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
