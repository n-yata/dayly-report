import { z } from 'zod'
import { dateSchema, reportStatusSchema, timeSchema } from './common'

// 訪問記録スキーマ
export const visitRecordCreateSchema = z.object({
  customer_id: z.number({ error: '顧客IDを入力してください' }).int().positive(),
  visit_time: timeSchema,
  purpose: z.string().min(1, '訪問目的・内容メモを入力してください'),
  case_product: z.string().optional().nullable(),
  next_action: z.string().optional().nullable(),
})

export const visitRecordUpdateSchema = visitRecordCreateSchema.partial()

// 日報作成スキーマ
export const dailyReportCreateSchema = z.object({
  report_date: dateSchema,
  problem: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
  visit_records: z.array(visitRecordCreateSchema).default([]),
})

// 日報更新スキーマ
export const dailyReportUpdateSchema = z.object({
  problem: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
})

// 日報一覧クエリスキーマ
export const dailyReportListQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  user_id: z.coerce.number().int().positive().optional(),
  status: reportStatusSchema.optional(),
})

export type VisitRecordCreateInput = z.infer<typeof visitRecordCreateSchema>
export type VisitRecordUpdateInput = z.infer<typeof visitRecordUpdateSchema>
export type DailyReportCreateInput = z.infer<typeof dailyReportCreateSchema>
export type DailyReportUpdateInput = z.infer<typeof dailyReportUpdateSchema>
export type DailyReportListQuery = z.infer<typeof dailyReportListQuerySchema>
