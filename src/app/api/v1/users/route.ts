import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession, UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { userCreateSchema } from '@/lib/schemas/user'
import { hashPassword } from '@/lib/auth/password'

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

// GET /api/v1/users - ユーザー一覧取得（managerのみ）
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)

    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみユーザー一覧を取得できます')
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return successResponse(users.map(formatUser))
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('GET /users error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// POST /api/v1/users - ユーザー登録（managerのみ）
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request)

    if (session.role !== 'manager') {
      return errorResponse('FORBIDDEN', 'マネージャーのみユーザーを登録できます')
    }

    const body = await request.json()
    const parsed = userCreateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    // メールアドレスの重複確認
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    })
    if (existing) {
      return errorResponse('CONFLICT', 'このメールアドレスは既に登録されています')
    }

    const hashedPassword = await hashPassword(parsed.data.password)

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    return successResponse(formatUser(user), 201)
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('POST /users error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
