import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { comparePassword } from '@/lib/auth/password'
import { GET as listGET, POST as createPOST } from '@/app/api/v1/users/route'
import { PUT as updatePUT } from '@/app/api/v1/users/[id]/route'

// USR テスト (USR-001 〜 USR-011)

type TestUser = { id: number; token: string; email: string }

async function getTestUsers(): Promise<{ sales: TestUser; manager: TestUser }> {
  const [salesUser, managerUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'tanaka@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'yamada@example.com' } }),
  ])
  const [salesToken, managerToken] = await Promise.all([
    signToken({ userId: salesUser.id, role: 'sales', email: salesUser.email }),
    signToken({ userId: managerUser.id, role: 'manager', email: managerUser.email }),
  ])
  return {
    sales: { id: salesUser.id, token: salesToken, email: salesUser.email },
    manager: { id: managerUser.id, token: managerToken, email: managerUser.email },
  }
}

function makeRequest(method: string, url: string, token?: string, body?: unknown): NextRequest {
  const req = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return req
}

describe('USR: ユーザーマスタ', () => {
  let users: { sales: TestUser; manager: TestUser }
  const createdUserEmails: string[] = []

  beforeEach(async () => {
    users = await getTestUsers()
  })

  afterEach(async () => {
    if (createdUserEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdUserEmails } },
      })
      createdUserEmails.length = 0
    }
  })

  // ── 一覧取得 ────────────────────────────────────────────────────────────────

  it('USR-001: managerはユーザー一覧を取得できる', async () => {
    const req = makeRequest('GET', 'http://localhost/api/v1/users', users.manager.token)
    const res = await listGET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    // passwordフィールドが含まれていないことを確認
    expect(json.data[0]).not.toHaveProperty('password')
    expect(json.data[0]).toHaveProperty('id')
    expect(json.data[0]).toHaveProperty('name')
    expect(json.data[0]).toHaveProperty('email')
    expect(json.data[0]).toHaveProperty('role')
  })

  it('USR-002: salesはユーザー一覧を取得できない（403）', async () => {
    const req = makeRequest('GET', 'http://localhost/api/v1/users', users.sales.token)
    const res = await listGET(req)
    expect(res.status).toBe(403)
  })

  // ── 登録 ────────────────────────────────────────────────────────────────────

  it('USR-003: managerが正常にユーザーを登録できる', async () => {
    const email = `test-usr003-${Date.now()}@example.com`
    createdUserEmails.push(email)
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.manager.token, {
      name: 'テスト ユーザー',
      email,
      password: 'password123',
      role: 'sales',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.email).toBe(email)
    expect(json.data.role).toBe('sales')
    expect(json.data).not.toHaveProperty('password')
  })

  it('USR-004: salesはユーザー登録できない（403）', async () => {
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.sales.token, {
      name: 'テスト',
      email: 'test@example.com',
      password: 'password123',
      role: 'sales',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(403)
  })

  it('USR-005: nameを省略すると400が返る', async () => {
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.manager.token, {
      email: 'test@example.com',
      password: 'password123',
      role: 'sales',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('USR-006: emailを省略すると400が返る', async () => {
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.manager.token, {
      name: 'テスト',
      password: 'password123',
      role: 'sales',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('USR-007: 重複メールアドレスで登録すると409が返る', async () => {
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.manager.token, {
      name: '重複テスト',
      email: users.sales.email, // 既存ユーザーのメール
      password: 'password123',
      role: 'sales',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('USR-008: 不正なロール値で登録すると400が返る', async () => {
    const req = makeRequest('POST', 'http://localhost/api/v1/users', users.manager.token, {
      name: 'テスト',
      email: 'test-invalid-role@example.com',
      password: 'password123',
      role: 'admin',
    })
    const res = await createPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  // ── 更新 ────────────────────────────────────────────────────────────────────

  it('USR-009: managerがロールを変更できる', async () => {
    // テスト用ユーザーを作成
    const email = `test-usr009-${Date.now()}@example.com`
    createdUserEmails.push(email)
    const created = await prisma.user.create({
      data: { name: 'ロール変更テスト', email, password: 'hashed', role: 'sales' },
    })

    const req = makeRequest(
      'PUT',
      `http://localhost/api/v1/users/${created.id}`,
      users.manager.token,
      { role: 'manager' }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(created.id) }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.role).toBe('manager')
  })

  it('USR-010: パスワードリセットができる', async () => {
    const email = `test-usr010-${Date.now()}@example.com`
    createdUserEmails.push(email)
    const created = await prisma.user.create({
      data: { name: 'PW変更テスト', email, password: 'oldhash', role: 'sales' },
    })

    const newPassword = 'newPassword456'
    const req = makeRequest(
      'PUT',
      `http://localhost/api/v1/users/${created.id}`,
      users.manager.token,
      { password: newPassword }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(created.id) }) })
    expect(res.status).toBe(200)

    // 新パスワードでログイン可能か検証
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: created.id } })
    const isValid = await comparePassword(newPassword, updated.password)
    expect(isValid).toBe(true)
  })

  it('USR-011: salesはユーザーを更新できない（403）', async () => {
    const req = makeRequest(
      'PUT',
      `http://localhost/api/v1/users/${users.manager.id}`,
      users.sales.token,
      { name: '変更' }
    )
    const res = await updatePUT(req, {
      params: Promise.resolve({ id: String(users.manager.id) }),
    })
    expect(res.status).toBe(403)
  })

  it('USR-012: 他のユーザーと重複するメールアドレスに更新すると409が返る', async () => {
    // テスト用ユーザーを作成
    const email = `test-usr012-${Date.now()}@example.com`
    createdUserEmails.push(email)
    const created = await prisma.user.create({
      data: { name: 'メール重複テスト', email, password: 'hashed', role: 'sales' },
    })

    // 既存ユーザー（sales）のメールアドレスに変更しようとする
    const req = makeRequest(
      'PUT',
      `http://localhost/api/v1/users/${created.id}`,
      users.manager.token,
      { email: users.sales.email }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(created.id) }) })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('USR-013: 自分自身のメールアドレスに更新する場合は409にならない', async () => {
    // テスト用ユーザーを作成
    const email = `test-usr013-${Date.now()}@example.com`
    createdUserEmails.push(email)
    const created = await prisma.user.create({
      data: { name: '自己更新テスト', email, password: 'hashed', role: 'sales' },
    })

    // 同じメールアドレスで更新（自己更新）
    const req = makeRequest(
      'PUT',
      `http://localhost/api/v1/users/${created.id}`,
      users.manager.token,
      { email, name: '自己更新テスト（更新後）' }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(created.id) }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.email).toBe(email)
    expect(json.data.name).toBe('自己更新テスト（更新後）')
  })
})
