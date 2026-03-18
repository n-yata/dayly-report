import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { comparePassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { loginSchema } from '@/lib/schemas/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const { email, password } = parsed.data

    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'メールアドレスまたはパスワードが正しくありません')
    }

    // パスワードを検証
    const isValidPassword = await comparePassword(password, user.password)
    if (!isValidPassword) {
      return errorResponse('UNAUTHORIZED', 'メールアドレスまたはパスワードが正しくありません')
    }

    // JWTトークンを生成
    const token = await signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    })

    return successResponse({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.issues[0]?.message ?? 'バリデーションエラー')
    }
    console.error('Login error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
