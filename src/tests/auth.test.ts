import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { POST as logoutPOST } from '@/app/api/v1/auth/logout/route'
import { GET as dailyReportsGET } from '@/app/api/v1/daily-reports/route'
import { verifyToken } from '@/lib/auth/jwt'

// AUTH テスト (AUTH-001 〜 AUTH-008)

describe('AUTH: 認証', () => {
  // AUTH-001: 正常ログイン
  it('AUTH-001: 正しいメール・パスワードでログインできる', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tanaka@example.com', password: 'password123' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toHaveProperty('token')
    expect(data.data).toHaveProperty('user')
    expect(data.data.user.email).toBe('tanaka@example.com')
    expect(data.data.user.role).toBe('sales')
    // パスワードは返却しない
    expect(data.data.user).not.toHaveProperty('password')

    // トークンが有効であること
    const payload = await verifyToken(data.data.token)
    expect(payload).not.toBeNull()
    expect(payload?.email).toBe('tanaka@example.com')
  })

  // AUTH-002: パスワード誤り
  it('AUTH-002: 誤ったパスワードでログインすると401が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tanaka@example.com', password: 'wrongpassword' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  // AUTH-003: 存在しないメール
  it('AUTH-003: 未登録のメールでログインすると401が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notexist@example.com', password: 'password123' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  // AUTH-004: メール未入力
  it('AUTH-004: emailを空でリクエストすると400が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: 'password123' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // AUTH-005: パスワード未入力
  it('AUTH-005: passwordを空でリクエストすると400が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tanaka@example.com', password: '' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // AUTH-006: 正常ログアウト
  it('AUTH-006: ログアウトすると200が返る', async () => {
    const res = await logoutPOST()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toBeNull()
  })

  // AUTH-007: トークンなしでAPIアクセス
  it('AUTH-007: Authorizationヘッダーなしでリソース取得すると401が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/daily-reports', {
      method: 'GET',
    })

    const res = await dailyReportsGET(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  // AUTH-008: 無効なトークンでAPIアクセス
  it('AUTH-008: 不正なトークンでリソース取得すると401が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/daily-reports', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid.token.value',
      },
    })

    const res = await dailyReportsGET(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  // AUTH-009: 不正なメール形式でログイン
  it('AUTH-009: メールアドレスの形式が不正なリクエストは400が返る', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    })

    const res = await loginPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})
