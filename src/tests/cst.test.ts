import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { GET as customersGET, POST as customersPOST } from '@/app/api/v1/customers/route'
import { PUT as customerPUT, DELETE as customerDELETE } from '@/app/api/v1/customers/[id]/route'

// CST テスト (CST-001 〜 CST-012)

type TestUser = { id: number; token: string }

async function getTestUsers() {
  const [salesUser, managerUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'tanaka@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'yamada@example.com' } }),
  ])

  const [salesToken, managerToken] = await Promise.all([
    signToken({ userId: salesUser.id, role: 'sales', email: salesUser.email }),
    signToken({ userId: managerUser.id, role: 'manager', email: managerUser.email }),
  ])

  return {
    sales: { id: salesUser.id, token: salesToken } as TestUser,
    manager: { id: managerUser.id, token: managerToken } as TestUser,
  }
}

function makeReq(url: string, method: string, token: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('CST: 顧客マスタ', () => {
  let users: { sales: TestUser; manager: TestUser }
  let createdCustomerIds: number[] = []
  let testCounter = 0

  function uniqueCompanyName() {
    return `テスト株式会社${Date.now()}${testCounter++}`
  }

  beforeEach(async () => {
    users = await getTestUsers()
    createdCustomerIds = []
  })

  afterEach(async () => {
    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } })
    }
  })

  async function createTestCustomer() {
    const customer = await prisma.customer.create({
      data: {
        companyName: uniqueCompanyName(),
        contactName: 'テスト担当者',
        phone: '03-0000-0000',
        email: `test${Date.now()}@test.com`,
        address: '東京都テスト区',
      },
    })
    createdCustomerIds.push(customer.id)
    return customer
  }

  // CST-001: 顧客一覧取得（sales）
  it('CST-001: salesが顧客一覧を取得できる', async () => {
    const req = makeReq('http://localhost/api/v1/customers', 'GET', users.sales.token)
    const res = await customersGET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
  })

  // CST-002: 顧客一覧取得（manager）
  it('CST-002: managerが顧客一覧を取得できる', async () => {
    const req = makeReq('http://localhost/api/v1/customers', 'GET', users.manager.token)
    const res = await customersGET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
  })

  // CST-003: 名前検索
  it('CST-003: 会社名で顧客を検索できる', async () => {
    const customer = await createTestCustomer()

    const req = makeReq(
      `http://localhost/api/v1/customers?q=${encodeURIComponent(customer.companyName)}`,
      'GET',
      users.sales.token
    )
    const res = await customersGET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(
      data.data.some((c: { company_name: string }) => c.company_name === customer.companyName)
    ).toBe(true)
  })

  // CST-004: 正常登録
  it('CST-004: managerが顧客を正常に登録できる', async () => {
    const body = {
      company_name: uniqueCompanyName(),
      contact_name: '担当者テスト',
      phone: '06-1234-5678',
      email: 'new@company.com',
      address: '大阪府テスト市',
    }
    const req = makeReq('http://localhost/api/v1/customers', 'POST', users.manager.token, body)
    const res = await customersPOST(req)
    const data = await res.json()

    if (data.data?.id) createdCustomerIds.push(data.data.id)
    expect(res.status).toBe(201)
    expect(data.data.company_name).toBe(body.company_name)
  })

  // CST-005: salesが顧客登録すると403
  it('CST-005: salesが顧客を登録しようとすると403が返る', async () => {
    const body = { company_name: uniqueCompanyName(), contact_name: '担当者' }
    const req = makeReq('http://localhost/api/v1/customers', 'POST', users.sales.token, body)
    const res = await customersPOST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // CST-006: company_name未入力
  it('CST-006: company_nameを省略すると400が返る', async () => {
    const body = { contact_name: '担当者' }
    const req = makeReq('http://localhost/api/v1/customers', 'POST', users.manager.token, body)
    const res = await customersPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // CST-007: contact_name未入力
  it('CST-007: contact_nameを省略すると400が返る', async () => {
    const body = { company_name: uniqueCompanyName() }
    const req = makeReq('http://localhost/api/v1/customers', 'POST', users.manager.token, body)
    const res = await customersPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // CST-008: 正常更新
  it('CST-008: managerが顧客を正常に更新できる', async () => {
    const customer = await createTestCustomer()

    const req = makeReq(
      `http://localhost/api/v1/customers/${customer.id}`,
      'PUT',
      users.manager.token,
      { phone: '03-9999-9999' }
    )
    const res = await customerPUT(req, { params: Promise.resolve({ id: String(customer.id) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.phone).toBe('03-9999-9999')
  })

  // CST-009: salesが顧客更新すると403
  it('CST-009: salesが顧客を更新しようとすると403が返る', async () => {
    const customer = await createTestCustomer()

    const req = makeReq(
      `http://localhost/api/v1/customers/${customer.id}`,
      'PUT',
      users.sales.token,
      { phone: '03-9999-9999' }
    )
    const res = await customerPUT(req, { params: Promise.resolve({ id: String(customer.id) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // CST-010: 存在しない顧客を更新
  it('CST-010: 存在しない顧客を更新しようとすると404が返る', async () => {
    const req = makeReq('http://localhost/api/v1/customers/999999', 'PUT', users.manager.token, {
      phone: '03-0000-0000',
    })
    const res = await customerPUT(req, { params: Promise.resolve({ id: '999999' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  // CST-011: 正常削除
  it('CST-011: managerが顧客を正常に削除できる（204）', async () => {
    const customer = await createTestCustomer()

    const req = makeReq(
      `http://localhost/api/v1/customers/${customer.id}`,
      'DELETE',
      users.manager.token
    )
    const res = await customerDELETE(req, { params: Promise.resolve({ id: String(customer.id) }) })

    expect(res.status).toBe(204)
    // 削除済みなのでcreatedCustomerIdsから除外
    createdCustomerIds = createdCustomerIds.filter((id) => id !== customer.id)
  })

  // CST-012: salesが顧客削除すると403
  it('CST-012: salesが顧客を削除しようとすると403が返る', async () => {
    const customer = await createTestCustomer()

    const req = makeReq(
      `http://localhost/api/v1/customers/${customer.id}`,
      'DELETE',
      users.sales.token
    )
    const res = await customerDELETE(req, { params: Promise.resolve({ id: String(customer.id) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })
})
