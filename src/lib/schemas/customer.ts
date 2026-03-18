import { z } from 'zod'

// 顧客作成スキーマ
export const customerCreateSchema = z.object({
  company_name: z.string().min(1, '会社名を入力してください').max(200),
  contact_name: z.string().min(1, '担当者名を入力してください').max(100),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('有効なメールアドレスを入力してください').optional().nullable(),
  address: z.string().optional().nullable(),
})

// 顧客更新スキーマ
export const customerUpdateSchema = customerCreateSchema.partial()

// 顧客一覧クエリスキーマ
export const customerListQuerySchema = z.object({
  q: z.string().optional(),
})

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>
