// 共通APIレスポンス型定義

export type ApiSuccessResponse<T> = {
  data: T
}

export type ApiErrorResponse = {
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ユーザー関連型
export type UserRole = 'sales' | 'manager'

export type UserResponse = {
  id: number
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export type UserSummary = {
  id: number
  name: string
}

// 日報関連型
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type VisitRecordResponse = {
  id: number
  customerId: number
  customerName: string
  visitTime: string
  purpose: string
  caseProduct: string | null
  nextAction: string | null
  createdAt: string
  updatedAt: string
}

export type DailyReportDetailResponse = {
  id: number
  reportDate: string
  problem: string | null
  plan: string | null
  status: ReportStatus
  approvedBy: UserSummary | null
  approvedAt: string | null
  user: UserSummary
  visitRecords: VisitRecordResponse[]
  createdAt: string
  updatedAt: string
}

export type DailyReportListItem = {
  id: number
  reportDate: string
  status: ReportStatus
  visitCount: number
  user: UserSummary
  createdAt: string
  updatedAt: string
}

// コメント関連型
export type CommentTargetType = 'problem' | 'plan'

export type CommentResponse = {
  id: number
  targetType: CommentTargetType
  content: string
  user: UserSummary
  createdAt: string
}

// 顧客関連型
export type CustomerResponse = {
  id: number
  companyName: string
  contactName: string
  phone: string | null
  email: string | null
  address: string | null
}
