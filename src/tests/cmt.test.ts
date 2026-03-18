import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { POST as createReportPOST } from '@/app/api/v1/daily-reports/route'
import {
  GET as commentsGET,
  POST as commentsPOST,
} from '@/app/api/v1/daily-reports/[id]/comments/route'

// CMT テスト (CMT-001 〜 CMT-010)

type TestUser = { id: number; token: string }

async function getTestUsers() {
  const [salesUser, sales2User, managerUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'tanaka@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'sato@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'yamada@example.com' } }),
  ])

  const [salesToken, sales2Token, managerToken] = await Promise.all([
    signToken({ userId: salesUser.id, role: 'sales', email: salesUser.email }),
    signToken({ userId: sales2User.id, role: 'sales', email: sales2User.email }),
    signToken({ userId: managerUser.id, role: 'manager', email: managerUser.email }),
  ])

  return {
    sales: { id: salesUser.id, token: salesToken } as TestUser,
    sales2: { id: sales2User.id, token: sales2Token } as TestUser,
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

describe('CMT: コメント', () => {
  let users: { sales: TestUser; sales2: TestUser; manager: TestUser }
  let customerId: number
  let createdReportIds: number[] = []
  let dateCounter = 1

  function nextDate() {
    return `2097-06-${String(dateCounter++).padStart(2, '0')}`
  }

  beforeEach(async () => {
    users = await getTestUsers()
    const customer = await prisma.customer.findFirst()
    customerId = customer!.id
    createdReportIds = []
    dateCounter = 1
  })

  afterEach(async () => {
    if (createdReportIds.length > 0) {
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } })
    }
  })

  async function createReport(token: string) {
    const body = {
      report_date: nextDate(),
      problem: 'テスト課題',
      plan: 'テスト計画',
      visit_records: [{ customer_id: customerId, visit_time: '10:00', purpose: '訪問' }],
    }
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', token, body)
    const res = await createReportPOST(req)
    const data = await res.json()
    if (data.data?.id) createdReportIds.push(data.data.id)
    return data.data
  }

  // CMT-001: salesがproblemにコメント投稿
  it('CMT-001: salesがproblemにコメントを投稿できる', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'problem', content: 'テストコメント' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.targetType).toBe('problem')
    expect(data.data.content).toBe('テストコメント')
    expect(data.data.user.id).toBe(users.sales.id)
  })

  // CMT-002: salesがplanにコメント投稿
  it('CMT-002: salesがplanにコメントを投稿できる', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'plan', content: 'planコメント' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.targetType).toBe('plan')
  })

  // CMT-003: managerがコメント投稿
  it('CMT-003: managerがコメントを投稿できる', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.manager.token,
      { target_type: 'problem', content: 'マネージャーコメント' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.user.id).toBe(users.manager.id)
  })

  // CMT-004: target_type未入力
  it('CMT-004: target_typeを省略すると400が返る', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { content: 'コメント' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // CMT-005: 不正なtarget_type
  it('CMT-005: 不正なtarget_typeを指定すると400が返る', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'invalid', content: 'コメント' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // CMT-006: content未入力
  it('CMT-006: contentを空にすると400が返る', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'problem', content: '' }
    )
    const res = await commentsPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // CMT-007: コメント一覧取得（全件）
  it('CMT-007: コメント一覧を全件取得できる', async () => {
    const report = await createReport(users.sales.token)

    // problemとplanにコメントを投稿
    const req1 = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'problem', content: 'problemコメント' }
    )
    const req2 = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'plan', content: 'planコメント' }
    )
    await commentsPOST(req1, { params: Promise.resolve({ id: String(report.id) }) })
    await commentsPOST(req2, { params: Promise.resolve({ id: String(report.id) }) })

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'GET',
      users.sales.token
    )
    const res = await commentsGET(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.length).toBeGreaterThanOrEqual(2)
  })

  // CMT-008: target_typeフィルター
  it('CMT-008: target_typeフィルターが機能する', async () => {
    const report = await createReport(users.sales.token)

    // problemとplanにコメントを投稿
    const req1 = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'problem', content: 'problemコメント' }
    )
    const req2 = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'POST',
      users.sales.token,
      { target_type: 'plan', content: 'planコメント' }
    )
    await commentsPOST(req1, { params: Promise.resolve({ id: String(report.id) }) })
    await commentsPOST(req2, { params: Promise.resolve({ id: String(report.id) }) })

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments?target_type=problem`,
      'GET',
      users.sales.token
    )
    const res = await commentsGET(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    for (const comment of data.data) {
      expect(comment.targetType).toBe('problem')
    }
  })

  // CMT-009: 他人の日報のコメント取得（sales）は403
  it('CMT-009: salesが他人の日報のコメントを取得しようとすると403が返る', async () => {
    const report = await createReport(users.sales2.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'GET',
      users.sales.token
    )
    const res = await commentsGET(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // CMT-010: 他人の日報のコメント取得（manager）は200
  it('CMT-010: managerは他人の日報のコメントを取得できる', async () => {
    const report = await createReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/comments`,
      'GET',
      users.manager.token
    )
    const res = await commentsGET(req, { params: Promise.resolve({ id: String(report.id) }) })

    expect(res.status).toBe(200)
  })
})
