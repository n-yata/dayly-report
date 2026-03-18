import { NextRequest } from 'next/server'
import { signToken } from '@/lib/auth/jwt'

// テスト用ユーザー（シードデータと同期）
export const TEST_USERS = {
  sales: {
    email: 'tanaka@example.com',
    password: 'password123',
    name: '田中 太郎',
    role: 'sales' as const,
  },
  sales2: {
    email: 'sato@example.com',
    password: 'password123',
    name: '佐藤 花子',
    role: 'sales' as const,
  },
  manager: {
    email: 'yamada@example.com',
    password: 'password123',
    name: '山田 部長',
    role: 'manager' as const,
  },
}

/**
 * 認証済みNextRequestを作成するヘルパー
 */
export async function createAuthRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    userId: number
    role: string
    email: string
  }
): Promise<NextRequest> {
  const token = await signToken({
    userId: options.userId,
    role: options.role,
    email: options.email,
  })

  return new NextRequest(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

/**
 * 認証なしNextRequestを作成するヘルパー
 */
export function createUnauthRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
  } = {}
): NextRequest {
  return new NextRequest(url, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

/**
 * 無効なトークンを持つNextRequestを作成するヘルパー
 */
export function createInvalidTokenRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer invalid.token.here',
    },
  })
}
