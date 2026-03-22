import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { userUpdateSchema } from '@/lib/schemas/user'
import { hashPassword } from '@/lib/auth/password'

type RouteParams = { params: Promise<{ id: string }> }

function formatUser(user: {
  id: number
  name: string
  email: string
  role: string
  createdAt: Date
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.createdAt.toISOString(),
  }
}

// PUT /api/v1/users/:id - ユーザー更新（managerのみ）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession(request)

    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみユーザーを更新できます')
    }

    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return errorResponse('NOT_FOUND', 'ユーザーが見つかりません')
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) {
      return errorResponse('NOT_FOUND', 'ユーザーが見つかりません')
    }

    const body = await request.json()
    const parsed = userUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const updateData: {
      name?: string
      email?: string
      password?: string
      role?: 'sales' | 'manager'
    } = {}

    if (parsed.data.email !== undefined) {
      const duplicate = await prisma.user.findFirst({
        where: { email: parsed.data.email, id: { not: userId } },
      })
      if (duplicate) {
        return errorResponse('CONFLICT', 'このメールアドレスは既に登録されています')
      }
    }

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role
    if (parsed.data.password !== undefined) {
      updateData.password = await hashPassword(parsed.data.password)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    return successResponse(formatUser(user))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('PUT /users/:id error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
