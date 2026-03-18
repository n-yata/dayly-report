import { z } from 'zod'
import { commentTargetSchema } from './common'

// コメント作成スキーマ
export const commentCreateSchema = z.object({
  target_type: commentTargetSchema,
  content: z.string().min(1, 'コメント内容を入力してください'),
})

// コメント一覧クエリスキーマ
export const commentListQuerySchema = z.object({
  target_type: commentTargetSchema.optional(),
})

export type CommentCreateInput = z.infer<typeof commentCreateSchema>
export type CommentListQuery = z.infer<typeof commentListQuerySchema>
