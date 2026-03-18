import { z } from 'zod'
import { roleSchema } from './common'

// ユーザー作成スキーマ
export const userCreateSchema = z.object({
  name: z.string().min(1, '氏名を入力してください').max(100),
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください')
    .max(255),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  role: roleSchema,
})

// ユーザー更新スキーマ
export const userUpdateSchema = z.object({
  name: z.string().min(1, '氏名を入力してください').max(100).optional(),
  email: z.string().email('有効なメールアドレスを入力してください').max(255).optional(),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください').optional(),
  role: roleSchema.optional(),
})

export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
