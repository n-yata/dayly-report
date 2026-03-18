import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api/response'
import { requireSession } from '@/lib/auth/session'
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/session'
import { dailyReportCreateSchema, dailyReportListQuerySchema } from '@/lib/schemas/daily-report'
import { formatDailyReport, dailyReportInclude } from '@/lib/api/daily-report-helpers'

// GET /api/v1/daily-reports - 日報一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request)

    const { searchParams } = new URL(request.url)
    const queryParams = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    }

    const parsed = dailyReportListQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const { from, to, user_id, status } = parsed.data

    // salesはuser_idフィルターを使用できない
    if (session.role === 'sales' && user_id !== undefined) {
      return errorResponse('FORBIDDEN', 'salesユーザーはuser_idフィルターを使用できません')
    }

    // デフォルト期間: 当月
    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const fromDate = from ? new Date(from) : defaultFrom
    const toDate = to ? new Date(to) : defaultTo
    // toDateは日の終わり
    toDate.setHours(23, 59, 59, 999)

    const reports = await prisma.dailyReport.findMany({
      where: {
        // salesは自分の日報のみ
        userId: session.role === 'sales' ? session.userId : user_id,
        reportDate: {
          gte: fromDate,
          lte: toDate,
        },
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { visitRecords: true } },
      },
      orderBy: { reportDate: 'desc' },
    })

    const data = reports.map((report) => ({
      id: report.id,
      reportDate: report.reportDate.toISOString().split('T')[0],
      status: report.status,
      visitCount: report._count.visitRecords,
      user: { id: report.user.id, name: report.user.name },
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    }))

    return successResponse(data)
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    console.error('GET /daily-reports error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}

// POST /api/v1/daily-reports - 日報作成
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request)

    // salesのみ作成可能
    if (session.role !== 'sales') {
      return errorResponse('FORBIDDEN', 'salesロールのユーザーのみ日報を作成できます')
    }

    const body = await request.json()
    const parsed = dailyReportCreateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
      return errorResponse('VALIDATION_ERROR', message)
    }

    const { report_date, problem, plan, visit_records } = parsed.data

    // 同日の日報が既に存在するか確認
    const reportDate = new Date(report_date)
    const existing = await prisma.dailyReport.findFirst({
      where: {
        userId: session.userId,
        reportDate,
      },
    })

    if (existing) {
      return errorResponse('CONFLICT', '同じ報告日の日報が既に存在します')
    }

    // 顧客IDの存在確認
    if (visit_records.length > 0) {
      const customerIds = visit_records.map((vr) => vr.customer_id)
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true },
      })
      const foundIds = new Set(customers.map((c) => c.id))
      const missingId = customerIds.find((id) => !foundIds.has(id))
      if (missingId) {
        return errorResponse('VALIDATION_ERROR', `顧客ID ${missingId} が存在しません`)
      }
    }

    // 日報を作成
    const report = await prisma.dailyReport.create({
      data: {
        userId: session.userId,
        reportDate,
        problem: problem ?? null,
        plan: plan ?? null,
        status: 'draft',
        visitRecords: {
          create: visit_records.map((vr) => ({
            customerId: vr.customer_id,
            visitTime: vr.visit_time,
            purpose: vr.purpose,
            caseProduct: vr.case_product ?? null,
            nextAction: vr.next_action ?? null,
          })),
        },
      },
      include: dailyReportInclude,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return successResponse(formatDailyReport(report as any), 201)
  } catch (error) {
    if (error instanceof UnauthorizedError) return errorResponse('UNAUTHORIZED', error.message)
    if (error instanceof ForbiddenError) return errorResponse('FORBIDDEN', error.message)
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.issues[0]?.message ?? 'バリデーションエラー')
    }
    console.error('POST /daily-reports error:', error)
    return errorResponse('INTERNAL_SERVER_ERROR', 'サーバーエラーが発生しました')
  }
}
