import type { NextRequest } from 'next/server'
import { verifyToken, type JwtPayload } from './jwt'

/**
 * リクエストのAuthorizationヘッダーからBearerトークンを取り出す
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * リクエストからログインユーザー情報を取得する
 * 認証されていない場合は null を返す
 */
export async function getSession(request: NextRequest): Promise<JwtPayload | null> {
  const token = extractBearerToken(request)
  if (!token) {
    return null
  }
  return await verifyToken(token)
}

/**
 * リクエストからログインユーザー情報を取得する
 * 認証されていない場合は例外を投げる
 */
export async function requireSession(request: NextRequest): Promise<JwtPayload> {
  const session = await getSession(request)
  if (!session) {
    throw new UnauthorizedError()
  }
  return session
}

/**
 * salesロールのユーザーのみ許可する
 */
export async function requireSales(request: NextRequest): Promise<JwtPayload> {
  const session = await requireSession(request)
  if (session.role !== 'sales') {
    throw new ForbiddenError()
  }
  return session
}

/**
 * managerロールのユーザーのみ許可する
 */
export async function requireManager(request: NextRequest): Promise<JwtPayload> {
  const session = await requireSession(request)
  if (session.role !== 'manager') {
    throw new ForbiddenError()
  }
  return session
}

export class UnauthorizedError extends Error {
  constructor() {
    super('認証が必要です')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('権限が不足しています')
    this.name = 'ForbiddenError'
  }
}
