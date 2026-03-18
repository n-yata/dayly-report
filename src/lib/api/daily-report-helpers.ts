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
    reportDate: report.reportDate.toISOString().split('T')[0],
    problem: report.problem,
    plan: report.plan,
    status: report.status,
    approvedBy: report.approver ? { id: report.approver.id, name: report.approver.name } : null,
    approvedAt: report.approvedAt?.toISOString() ?? null,
    user: { id: report.user.id, name: report.user.name },
    visitRecords: report.visitRecords.map((vr) => ({
      id: vr.id,
      customerId: vr.customerId,
      customerName: vr.customer.companyName,
      visitTime: vr.visitTime,
      purpose: vr.purpose,
      caseProduct: vr.caseProduct,
      nextAction: vr.nextAction,
      createdAt: vr.createdAt.toISOString(),
      updatedAt: vr.updatedAt.toISOString(),
    })),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }
}
