import type { prisma } from '@/lib/prisma'

// 日報詳細レスポンス用のinclude設定
export const dailyReportInclude = {
  user: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
  visitRecords: {
    include: {
      customer: { select: { id: true, companyName: true } },
    },
    orderBy: { visitTime: 'asc' as const },
  },
}

// 日報詳細レスポンスの整形
export function formatDailyReport(
  report: Awaited<ReturnType<typeof prisma.dailyReport.findUnique>> & {
    user: { id: number; name: string }
    approver: { id: number; name: string } | null
    visitRecords: Array<{
      id: number
      customerId: number
      customer: { id: number; companyName: string }
      visitTime: string
      purpose: string
      caseProduct: string | null
      nextAction: string | null
      createdAt: Date
      updatedAt: Date
    }>
  }
) {
  if (!report) return null
  return {
    id: report.id,
    report_date: report.reportDate.toISOString().split('T')[0],
    problem: report.problem,
    plan: report.plan,
    status: report.status,
    approved_by: report.approver ? { id: report.approver.id, name: report.approver.name } : null,
    approved_at: report.approvedAt?.toISOString() ?? null,
    user: { id: report.user.id, name: report.user.name },
    visit_records: report.visitRecords.map((vr) => ({
      id: vr.id,
      customer_id: vr.customerId,
      customer_name: vr.customer.companyName,
      visit_time: vr.visitTime,
      purpose: vr.purpose,
      case_product: vr.caseProduct,
      next_action: vr.nextAction,
      created_at: vr.createdAt.toISOString(),
      updated_at: vr.updatedAt.toISOString(),
    })),
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  }
}
