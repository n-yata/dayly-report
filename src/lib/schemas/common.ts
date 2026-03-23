import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

// 日付スキーマ (YYYY-MM-DD)
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')

// 時刻スキーマ (HH:MM)
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, '時刻はHH:MM形式で入力してください')

// ロールスキーマ
export const roleSchema = z.enum(['sales', 'manager'] as const, {
  error: () => 'ロールはsalesまたはmanagerを指定してください',
})

// レポートステータススキーマ
export const reportStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected'] as const, {
  error: () => 'ステータスはdraft/submitted/approved/rejectedのいずれかを指定してください',
})

// コメント対象種別スキーマ
export const commentTargetSchema = z.enum(['problem', 'plan'] as const, {
  error: () => 'target_typeはproblemまたはplanを指定してください',
})
