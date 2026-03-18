import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { POST as createReportPOST } from '@/app/api/v1/daily-reports/route'
import { POST as addVisitPOST } from '@/app/api/v1/daily-reports/[id]/visit-records/route'
import {
  PUT as updateVisitPUT,
  DELETE as deleteVisitDELETE,
} from '@/app/api/v1/visit-records/[id]/route'
import { POST as submitPOST } from '@/app/api/v1/daily-reports/[id]/submit/route'

// VST テスト (VST-001 〜 VST-012)

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

describe('VST: 訪問記録', () => {
  let users: { sales: TestUser; sales2: TestUser; manager: TestUser }
  let customerId: number
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let customer2Id: number
  let createdReportIds: number[] = []
  let dateCounter = 1

  function nextDate() {
    return `2098-01-${String(dateCounter++).padStart(2, '0')}`
  }

  beforeEach(async () => {
    users = await getTestUsers()
    const customers = await prisma.customer.findMany({ take: 2 })
    customerId = customers[0].id
    customer2Id = customers[1]?.id ?? customers[0].id
    createdReportIds = []
    dateCounter = 1
  })

  afterEach(async () => {
    if (createdReportIds.length > 0) {
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } })
    }
  })

  async function createDraftReport(token: string, withVisit = false) {
    const body = {
      report_date: nextDate(),
      problem: null,
      plan: null,
      visit_records: withVisit
        ? [{ customer_id: customerId, visit_time: '10:00', purpose: '初期訪問' }]
        : [],
    }
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', token, body)
    const res = await createReportPOST(req)
    const data = await res.json()
    if (data.data?.id) createdReportIds.push(data.data.id)
    return data.data
  }

  // VST-001: 正常追加
  it('VST-001: 訪問記録を正常に追加できる', async () => {
    const report = await createDraftReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: customerId, visit_time: '10:00', purpose: 'テスト訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.purpose).toBe('テスト訪問')
    expect(data.data.customerName).toBeDefined()
  })

  // VST-002: submitted日報に訪問記録追加は400
  it('VST-002: submitted状態の日報に訪問記録を追加すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token, true)

    // 提出
    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(report.id) }) })

    // 追加試行
    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: customerId, visit_time: '14:00', purpose: '追加訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-003: 他人の日報に訪問記録追加は403
  it('VST-003: 他人の日報に訪問記録を追加すると403が返る', async () => {
    const report = await createDraftReport(users.sales2.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: customerId, visit_time: '10:00', purpose: '訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // VST-004: 存在しない顧客IDを指定
  it('VST-004: 存在しない顧客IDを指定すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: 999999, visit_time: '10:00', purpose: '訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-005: customer_id未入力
  it('VST-005: customer_idを省略すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { visit_time: '10:00', purpose: '訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-006: visit_time未入力
  it('VST-006: visit_timeを省略すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: customerId, purpose: '訪問' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-007: purpose未入力
  it('VST-007: purposeを省略すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token)

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/visit-records`,
      'POST',
      users.sales.token,
      { customer_id: customerId, visit_time: '10:00' }
    )
    const res = await addVisitPOST(req, { params: Promise.resolve({ id: String(report.id) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-008: 正常更新
  it('VST-008: 訪問記録を正常に更新できる', async () => {
    const report = await createDraftReport(users.sales.token, true)
    const visitId = report.visitRecords[0].id

    const req = makeReq(
      `http://localhost/api/v1/visit-records/${visitId}`,
      'PUT',
      users.sales.token,
      { purpose: '更新後の目的' }
    )
    const res = await updateVisitPUT(req, { params: Promise.resolve({ id: String(visitId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.purpose).toBe('更新後の目的')
  })

  // VST-009: 他人の訪問記録を更新すると403
  it('VST-009: 他人の訪問記録を更新すると403が返る', async () => {
    const report = await createDraftReport(users.sales2.token, true)
    const visitId = report.visitRecords[0].id

    const req = makeReq(
      `http://localhost/api/v1/visit-records/${visitId}`,
      'PUT',
      users.sales.token,
      { purpose: '更新後' }
    )
    const res = await updateVisitPUT(req, { params: Promise.resolve({ id: String(visitId) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // VST-010: 正常削除
  it('VST-010: 訪問記録を正常に削除できる（204）', async () => {
    const report = await createDraftReport(users.sales.token, true)
    const visitId = report.visitRecords[0].id

    const req = makeReq(
      `http://localhost/api/v1/visit-records/${visitId}`,
      'DELETE',
      users.sales.token
    )
    const res = await deleteVisitDELETE(req, { params: Promise.resolve({ id: String(visitId) }) })

    expect(res.status).toBe(204)
  })

  // VST-011: submitted日報の訪問記録を削除は400
  it('VST-011: submitted状態の日報の訪問記録を削除すると400が返る', async () => {
    const report = await createDraftReport(users.sales.token, true)
    const visitId = report.visitRecords[0].id

    // 提出
    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${report.id}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(report.id) }) })

    // 削除試行
    const req = makeReq(
      `http://localhost/api/v1/visit-records/${visitId}`,
      'DELETE',
      users.sales.token
    )
    const res = await deleteVisitDELETE(req, { params: Promise.resolve({ id: String(visitId) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // VST-012: 他人の訪問記録を削除すると403
  it('VST-012: 他人の訪問記録を削除すると403が返る', async () => {
    const report = await createDraftReport(users.sales2.token, true)
    const visitId = report.visitRecords[0].id

    const req = makeReq(
      `http://localhost/api/v1/visit-records/${visitId}`,
      'DELETE',
      users.sales.token
    )
    const res = await deleteVisitDELETE(req, { params: Promise.resolve({ id: String(visitId) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })
})
