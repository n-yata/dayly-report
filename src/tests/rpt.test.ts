import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { GET as listGET, POST as createPOST } from '@/app/api/v1/daily-reports/route'
import { GET as detailGET, PUT as updatePUT } from '@/app/api/v1/daily-reports/[id]/route'
import { POST as submitPOST } from '@/app/api/v1/daily-reports/[id]/submit/route'
import { POST as approvePOST } from '@/app/api/v1/daily-reports/[id]/approve/route'
import { POST as rejectPOST } from '@/app/api/v1/daily-reports/[id]/reject/route'

// RPT テスト (RPT-001 〜 RPT-048)

type TestUser = { id: number; token: string }

async function getTestUsers(): Promise<{ sales: TestUser; manager: TestUser; sales2: TestUser }> {
  const [salesUser, managerUser, sales2User] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'tanaka@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'yamada@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'sato@example.com' } }),
  ])

  const [salesToken, managerToken, sales2Token] = await Promise.all([
    signToken({ userId: salesUser.id, role: 'sales', email: salesUser.email }),
    signToken({ userId: managerUser.id, role: 'manager', email: managerUser.email }),
    signToken({ userId: sales2User.id, role: 'sales', email: sales2User.email }),
  ])

  return {
    sales: { id: salesUser.id, token: salesToken },
    manager: { id: managerUser.id, token: managerToken },
    sales2: { id: sales2User.id, token: sales2Token },
  }
}

function makeReq(url: string, method: string, token: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('RPT: 日報', () => {
  let users: { sales: TestUser; manager: TestUser; sales2: TestUser }
  let customerId: number
  let createdReportIds: number[] = []

  beforeEach(async () => {
    users = await getTestUsers()
    const customer = await prisma.customer.findFirst()
    customerId = customer!.id
    createdReportIds = []
  })

  afterEach(async () => {
    // 作成した日報を削除
    if (createdReportIds.length > 0) {
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } })
    }
  })

  // 一意な日付を生成するヘルパー
  function uniqueDate(): string {
    return `2099-${String(Math.floor(Math.random() * 11) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
  }

  async function createTestReport(
    token: string,
    overrides: {
      report_date?: string
      problem?: string
      plan?: string
      visit_records?: unknown[]
    } = {}
  ) {
    const body = {
      report_date: uniqueDate(),
      problem: 'テスト課題',
      plan: 'テスト計画',
      visit_records: [
        {
          customer_id: customerId,
          visit_time: '10:00',
          purpose: 'テスト訪問',
        },
      ],
      ...overrides,
    }

    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', token, body)
    const res = await createPOST(req)
    const data = await res.json()
    if (data.data?.id) createdReportIds.push(data.data.id)
    return { res, data }
  }

  // RPT-001: salesは自分の日報のみ取得
  it('RPT-001: salesは自分の日報のみ取得できる', async () => {
    // sales2の日報を先に作成
    await createTestReport(users.sales2.token)
    // salesの日報を作成
    await createTestReport(users.sales.token)

    // 2099年全体で絞り込んでsalesの日報のみ取得
    const req = makeReq(
      'http://localhost/api/v1/daily-reports?from=2099-01-01&to=2099-12-31',
      'GET',
      users.sales.token
    )
    const res = await listGET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    const reports = data.data
    // salesの日報のみ返る（sales2の日報は含まれない）
    expect(reports.length).toBeGreaterThanOrEqual(1)
    for (const report of reports) {
      expect(report.user.id).toBe(users.sales.id)
    }
  })

  // RPT-002: managerは全員の日報を取得
  it('RPT-002: managerは全員の日報を取得できる', async () => {
    await createTestReport(users.sales.token)
    await createTestReport(users.sales2.token)

    // from/toを2099年全体にして全日報が取得できるよう設定
    const req = makeReq(
      'http://localhost/api/v1/daily-reports?from=2099-01-01&to=2099-12-31',
      'GET',
      users.manager.token
    )
    const res = await listGET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    // 複数ユーザーの日報が返る（このテスト中に作成した2件以上）
    expect(data.data.length).toBeGreaterThanOrEqual(2)
    const userIds = new Set(data.data.map((r: { user: { id: number } }) => r.user.id))
    expect(userIds.size).toBeGreaterThanOrEqual(2)
  })

  // RPT-005: salesがuser_idフィルターを使用すると403
  it('RPT-005: salesがuser_idフィルターを使用すると403が返る', async () => {
    const req = makeReq(
      `http://localhost/api/v1/daily-reports?user_id=${users.sales2.id}`,
      'GET',
      users.sales.token
    )
    const res = await listGET(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // RPT-010: 正常作成（下書き）
  it('RPT-010: salesが日報を正常に作成できる', async () => {
    const { res, data } = await createTestReport(users.sales.token)

    expect(res.status).toBe(201)
    expect(data.data.status).toBe('draft')
    expect(data.data.user.id).toBe(users.sales.id)
  })

  // RPT-011: 訪問記録なしで作成
  it('RPT-011: 訪問記録なしで日報を作成できる', async () => {
    const body = {
      report_date: uniqueDate(),
      problem: 'テスト',
      visit_records: [],
    }
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', users.sales.token, body)
    const res = await createPOST(req)
    const data = await res.json()

    if (data.data?.id) createdReportIds.push(data.data.id)
    expect(res.status).toBe(201)
    expect(data.data.visit_records).toHaveLength(0)
  })

  // RPT-012: 同日の日報が既に存在する
  it('RPT-012: 同じ報告日の日報が既に存在すると409が返る', async () => {
    const date = uniqueDate()
    await createTestReport(users.sales.token, { report_date: date })

    const body = { report_date: date, visit_records: [] }
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', users.sales.token, body)
    const res = await createPOST(req)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
  })

  // RPT-013: report_date未入力
  it('RPT-013: report_dateを省略すると400が返る', async () => {
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', users.sales.token, {
      visit_records: [],
    })
    const res = await createPOST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // RPT-014: managerが日報作成すると403
  it('RPT-014: managerが日報作成すると403が返る', async () => {
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', users.manager.token, {
      report_date: uniqueDate(),
      visit_records: [],
    })
    const res = await createPOST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // RPT-020: salesが自分の日報を取得
  it('RPT-020: salesが自分の日報詳細を取得できる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}`,
      'GET',
      users.sales.token
    )
    const res = await detailGET(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.id).toBe(reportId)
    expect(data.data.visit_records).toBeDefined()
  })

  // RPT-021: salesが他人の日報を取得すると403
  it('RPT-021: salesが他人の日報詳細を取得すると403が返る', async () => {
    const { data: created } = await createTestReport(users.sales2.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}`,
      'GET',
      users.sales.token
    )
    const res = await detailGET(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // RPT-023: 存在しない日報を取得
  it('RPT-023: 存在しない日報を取得すると404が返る', async () => {
    const req = makeReq('http://localhost/api/v1/daily-reports/999999', 'GET', users.sales.token)
    const res = await detailGET(req, { params: Promise.resolve({ id: '999999' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  // RPT-030: draft状態の日報を更新
  it('RPT-030: draft状態の日報を更新できる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}`,
      'PUT',
      users.sales.token,
      { problem: '更新後の課題' }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.problem).toBe('更新後の課題')
  })

  // RPT-032: submitted状態の日報を更新すると400
  it('RPT-032: submitted状態の日報を更新すると400が返る', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    // 提出
    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(reportId) }) })

    // 更新試行
    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}`,
      'PUT',
      users.sales.token,
      { problem: '更新後の課題' }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  // RPT-034: 他人の日報を更新すると403
  it('RPT-034: 他人の日報を更新すると403が返る', async () => {
    const { data: created } = await createTestReport(users.sales2.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}`,
      'PUT',
      users.sales.token,
      { problem: '更新後の課題' }
    )
    const res = await updatePUT(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // RPT-040: draft→submitted（提出）
  it('RPT-040: draft状態の日報を提出できる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    const res = await submitPOST(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe('submitted')
  })

  // RPT-041: 訪問記録0件での提出は400
  it('RPT-041: 訪問記録0件で提出すると400が返る', async () => {
    const body = { report_date: uniqueDate(), visit_records: [] }
    const req = makeReq('http://localhost/api/v1/daily-reports', 'POST', users.sales.token, body)
    const res = await createPOST(req)
    const data = await res.json()
    const reportId = data.data.id
    if (reportId) createdReportIds.push(reportId)

    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    const submitRes = await submitPOST(submitReq, {
      params: Promise.resolve({ id: String(reportId) }),
    })
    const submitData = await submitRes.json()

    expect(submitRes.status).toBe(400)
    expect(submitData.error.code).toBe('VALIDATION_ERROR')
  })

  // RPT-042: submitted→approved（承認）
  it('RPT-042: managerが提出済み日報を承認できる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    // 提出
    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(reportId) }) })

    // 承認
    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/approve`,
      'POST',
      users.manager.token
    )
    const res = await approvePOST(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe('approved')
    expect(data.data.approved_by).not.toBeNull()
    expect(data.data.approved_at).not.toBeNull()
  })

  // RPT-043: submitted→rejected（差し戻し）
  it('RPT-043: managerが提出済み日報を差し戻しできる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    // 提出
    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(reportId) }) })

    // 差し戻し
    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/reject`,
      'POST',
      users.manager.token
    )
    const res = await rejectPOST(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe('rejected')
  })

  // RPT-044: rejected→submitted（再提出）
  it('RPT-044: rejected状態の日報を再提出できる', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    // 提出→差し戻し→再提出
    const submitReq1 = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq1, { params: Promise.resolve({ id: String(reportId) }) })

    const rejectReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/reject`,
      'POST',
      users.manager.token
    )
    await rejectPOST(rejectReq, { params: Promise.resolve({ id: String(reportId) }) })

    const submitReq2 = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    const res = await submitPOST(submitReq2, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe('submitted')
  })

  // RPT-046: salesが承認操作すると403
  it('RPT-046: salesが承認操作すると403が返る', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    const submitReq = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/submit`,
      'POST',
      users.sales.token
    )
    await submitPOST(submitReq, { params: Promise.resolve({ id: String(reportId) }) })

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/approve`,
      'POST',
      users.sales.token
    )
    const res = await approvePOST(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  // RPT-048: draft日報を承認すると400
  it('RPT-048: draft状態の日報を承認しようとすると400が返る', async () => {
    const { data: created } = await createTestReport(users.sales.token)
    const reportId = created.data.id

    const req = makeReq(
      `http://localhost/api/v1/daily-reports/${reportId}/approve`,
      'POST',
      users.manager.token
    )
    const res = await approvePOST(req, { params: Promise.resolve({ id: String(reportId) }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})
