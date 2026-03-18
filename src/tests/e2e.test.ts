import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { GET as listGET, POST as createReportPOST } from '@/app/api/v1/daily-reports/route'
import { GET as detailGET, PUT as updateReportPUT } from '@/app/api/v1/daily-reports/[id]/route'
import { POST as submitPOST } from '@/app/api/v1/daily-reports/[id]/submit/route'
import { POST as approvePOST } from '@/app/api/v1/daily-reports/[id]/approve/route'
import { POST as rejectPOST } from '@/app/api/v1/daily-reports/[id]/reject/route'
import { POST as addVisitPOST } from '@/app/api/v1/daily-reports/[id]/visit-records/route'
import {
  GET as listCommentGET,
  POST as addCommentPOST,
} from '@/app/api/v1/daily-reports/[id]/comments/route'

// E2E テストシナリオ (E2E-001 〜 E2E-005)

function makeReq(method: string, url: string, token?: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function getTokens() {
  const [sales, manager, sales2] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'tanaka@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'yamada@example.com' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'sato@example.com' } }),
  ])
  const [salesToken, managerToken, sales2Token] = await Promise.all([
    signToken({ userId: sales.id, role: 'sales', email: sales.email }),
    signToken({ userId: manager.id, role: 'manager', email: manager.email }),
    signToken({ userId: sales2.id, role: 'sales', email: sales2.email }),
  ])
  return {
    sales: { id: sales.id, token: salesToken },
    manager: { id: manager.id, token: managerToken },
    sales2: { id: sales2.id, token: sales2Token },
  }
}

describe('E2E テストシナリオ', () => {
  let users: Awaited<ReturnType<typeof getTokens>>
  let customerId: number
  const createdReportIds: number[] = []
  let dateCounter = 2090

  function nextDate() {
    return `${dateCounter++}-06-01`
  }

  beforeEach(async () => {
    users = await getTokens()
    const customer = await prisma.customer.findFirstOrThrow()
    customerId = customer.id
  })

  afterEach(async () => {
    if (createdReportIds.length > 0) {
      await prisma.dailyReport.deleteMany({ where: { id: { in: createdReportIds } } })
      createdReportIds.length = 0
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E-001: 日報の作成から承認までの一連フロー
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E-001: 日報作成→提出→承認の一連フロー', async () => {
    const reportDate = nextDate()

    // 1. 日報を下書き作成
    const createRes = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        problem: '予算承認が通らない',
        plan: '見積書を送付する',
        visit_records: [
          {
            customer_id: customerId,
            visit_time: '10:00',
            purpose: '新製品の提案',
            case_product: '商品X',
          },
        ],
      })
    )
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.data.status).toBe('draft')
    const reportId = created.data.id
    createdReportIds.push(reportId)

    // 2. 一覧でステータス確認（from/toで対象日を含める）
    const listRes = await listGET(
      makeReq(
        'GET',
        `http://localhost/api/v1/daily-reports?status=draft&from=${reportDate}&to=${reportDate}`,
        users.sales.token
      )
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.some((r: { id: number }) => r.id === reportId)).toBe(true)

    // 3. 詳細取得して編集（Problemを更新）
    const updateRes = await updateReportPUT(
      makeReq('PUT', `http://localhost/api/v1/daily-reports/${reportId}`, users.sales.token, {
        problem: '更新後の課題',
      }),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.problem).toBe('更新後の課題')

    // 4. 提出
    const submitRes = await submitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/submit`,
        users.sales.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(submitRes.status).toBe(200)
    const submitted = await submitRes.json()
    expect(submitted.data.status).toBe('submitted')

    // 5. managerがコメント投稿
    const commentRes = await addCommentPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/comments`,
        users.manager.token,
        { target_type: 'problem', content: '来週の営業会議で相談しましょう' }
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(commentRes.status).toBe(201)

    // 6. コメント一覧取得
    const commentsRes = await listCommentGET(
      makeReq(
        'GET',
        `http://localhost/api/v1/daily-reports/${reportId}/comments`,
        users.manager.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(commentsRes.status).toBe(200)
    const comments = await commentsRes.json()
    expect(comments.data.length).toBeGreaterThan(0)

    // 7. 承認
    const approveRes = await approvePOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/approve`,
        users.manager.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(approveRes.status).toBe(200)
    const approved = await approveRes.json()
    expect(approved.data.status).toBe('approved')
    expect(approved.data.approved_by).not.toBeNull()
    expect(approved.data.approved_at).not.toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E-002: 差し戻し→修正→再提出フロー
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E-002: 差し戻し→修正→再提出フロー', async () => {
    const reportDate = nextDate()

    // 日報作成・提出
    const created = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        visit_records: [{ customer_id: customerId, visit_time: '09:00', purpose: '提案' }],
      })
    )
    const reportId = (await created.json()).data.id
    createdReportIds.push(reportId)

    await submitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/submit`,
        users.sales.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )

    // 差し戻し
    const rejectRes = await rejectPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/reject`,
        users.manager.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(rejectRes.status).toBe(200)
    expect((await rejectRes.json()).data.status).toBe('rejected')

    // 修正（rejected状態でも更新可能）
    const updateRes = await updateReportPUT(
      makeReq('PUT', `http://localhost/api/v1/daily-reports/${reportId}`, users.sales.token, {
        plan: '修正後のプラン',
      }),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(updateRes.status).toBe(200)

    // 再提出
    const resubmitRes = await submitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/submit`,
        users.sales.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(resubmitRes.status).toBe(200)
    expect((await resubmitRes.json()).data.status).toBe('submitted')

    // managerが承認
    const approveRes = await approvePOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/approve`,
        users.manager.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(approveRes.status).toBe(200)
    expect((await approveRes.json()).data.status).toBe('approved')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E-003: 訪問記録0件での提出はできない
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E-003: 訪問記録0件での提出はできない', async () => {
    const reportDate = nextDate()

    // 訪問記録なしで作成
    const created = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        visit_records: [],
      })
    )
    const reportId = (await created.json()).data.id
    createdReportIds.push(reportId)

    // 提出しようとするとエラー
    const submitRes = await submitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/submit`,
        users.sales.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(submitRes.status).toBe(400)

    // 訪問記録を追加して再提出
    const addVisitRes = await addVisitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/visit-records`,
        users.sales.token,
        { customer_id: customerId, visit_time: '13:00', purpose: '定例MTG' }
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(addVisitRes.status).toBe(201)

    const submitRes2 = await submitPOST(
      makeReq(
        'POST',
        `http://localhost/api/v1/daily-reports/${reportId}/submit`,
        users.sales.token
      ),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(submitRes2.status).toBe(200)
    expect((await submitRes2.json()).data.status).toBe('submitted')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E-004: 同日の日報は重複作成できない
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E-004: 同日の日報は重複作成できない', async () => {
    const reportDate = nextDate()

    const first = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        visit_records: [],
      })
    )
    expect(first.status).toBe(201)
    createdReportIds.push((await first.json()).data.id)

    // 同じ日付で再作成
    const second = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        visit_records: [],
      })
    )
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('CONFLICT')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E-005: salesは他人の日報を閲覧・操作できない
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E-005: salesは他人の日報を閲覧・操作できない', async () => {
    const reportDate = nextDate()

    // sales（田中）が日報を作成
    const created = await createReportPOST(
      makeReq('POST', 'http://localhost/api/v1/daily-reports', users.sales.token, {
        report_date: reportDate,
        visit_records: [],
      })
    )
    const reportId = (await created.json()).data.id
    createdReportIds.push(reportId)

    // sales2（佐藤）が田中の日報にアクセスしようとすると403
    const detailRes = await detailGET(
      makeReq('GET', `http://localhost/api/v1/daily-reports/${reportId}`, users.sales2.token),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(detailRes.status).toBe(403)

    // sales2が田中の日報を更新しようとすると403
    const updateRes = await updateReportPUT(
      makeReq('PUT', `http://localhost/api/v1/daily-reports/${reportId}`, users.sales2.token, {
        problem: '不正アクセス',
      }),
      { params: Promise.resolve({ id: String(reportId) }) }
    )
    expect(updateRes.status).toBe(403)

    // sales一覧では自分の日報のみ表示
    const listRes = await listGET(
      makeReq('GET', 'http://localhost/api/v1/daily-reports', users.sales2.token)
    )
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    const hasOtherReport = list.data.some((r: { id: number }) => r.id === reportId)
    expect(hasOtherReport).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // E2E: ログインAPIの動作確認
  // ─────────────────────────────────────────────────────────────────────────
  it('E2E: ログインAPIが正しく動作する', async () => {
    const res = await loginPOST(
      makeReq('POST', 'http://localhost/api/v1/auth/login', undefined, {
        email: 'tanaka@example.com',
        password: 'password123',
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.token).toBeTruthy()
    expect(json.data.user.email).toBe('tanaka@example.com')
    expect(json.data.user.role).toBe('sales')
  })
})
