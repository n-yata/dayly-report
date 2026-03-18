import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { loginSchema } from '@/lib/schemas/auth'
import {
  dailyReportCreateSchema,
  dailyReportUpdateSchema,
  dailyReportListQuerySchema,
  visitRecordCreateSchema,
  visitRecordUpdateSchema,
} from '@/lib/schemas/daily-report'
import { commentCreateSchema, commentListQuerySchema } from '@/lib/schemas/comment'
import {
  customerCreateSchema,
  customerUpdateSchema,
  customerListQuerySchema,
} from '@/lib/schemas/customer'
import { userCreateSchema, userUpdateSchema } from '@/lib/schemas/user'
import { roleSchema, reportStatusSchema, commentTargetSchema } from '@/lib/schemas/common'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// ── 共通レスポンス ──────────────────────────────────────────────────────────

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ example: 'エラーメッセージ' }),
  }),
})

// ── 共通スキーマ定義 ────────────────────────────────────────────────────────

const userRefSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: '田中 太郎' }),
})

const visitRecordResponseSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  daily_report_id: z.number().openapi({ example: 1 }),
  customer_id: z.number().openapi({ example: 10 }),
  customer_name: z.string().openapi({ example: '株式会社A' }),
  visit_time: z.string().openapi({ example: '10:00' }),
  purpose: z.string().openapi({ example: '新製品の提案' }),
  case_product: z.string().nullable().openapi({ example: '商品X' }),
  next_action: z.string().nullable().openapi({ example: '来週までに見積送付' }),
  created_at: z.string().datetime().openapi({ example: '2026-03-16T18:00:00Z' }),
  updated_at: z.string().datetime().openapi({ example: '2026-03-16T18:00:00Z' }),
})

const dailyReportDetailSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  report_date: z.string().openapi({ example: '2026-03-16' }),
  problem: z.string().nullable().openapi({ example: '予算承認が通らない' }),
  plan: z.string().nullable().openapi({ example: '見積書を送付する' }),
  status: reportStatusSchema.openapi({ example: 'draft' }),
  approved_by: z.number().nullable().openapi({ example: null }),
  approved_at: z.string().datetime().nullable().openapi({ example: null }),
  user: userRefSchema,
  visit_records: z.array(visitRecordResponseSchema),
  created_at: z.string().datetime().openapi({ example: '2026-03-16T18:00:00Z' }),
  updated_at: z.string().datetime().openapi({ example: '2026-03-16T18:00:00Z' }),
})

const dailyReportListItemSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  report_date: z.string().openapi({ example: '2026-03-16' }),
  status: reportStatusSchema,
  visit_count: z.number().openapi({ example: 3 }),
  user: userRefSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

const commentResponseSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  daily_report_id: z.number().openapi({ example: 1 }),
  target_type: commentTargetSchema,
  content: z.string().openapi({ example: '来週の営業会議で相談しましょう' }),
  user: userRefSchema,
  created_at: z.string().datetime(),
})

const customerResponseSchema = z.object({
  id: z.number().openapi({ example: 10 }),
  company_name: z.string().openapi({ example: '株式会社A' }),
  contact_name: z.string().openapi({ example: '鈴木 一郎' }),
  phone: z.string().nullable().openapi({ example: '03-1234-5678' }),
  email: z.string().nullable().openapi({ example: 'suzuki@company-a.com' }),
  address: z.string().nullable().openapi({ example: '東京都千代田区丸の内1-1-1' }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

const userResponseSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: '田中 太郎' }),
  email: z.string().openapi({ example: 'tanaka@example.com' }),
  role: roleSchema,
  created_at: z.string().datetime(),
})

// ── セキュリティスキーマ登録 ─────────────────────────────────────────────────

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

// ── 認証 ─────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['認証'],
  summary: 'ログイン',
  request: {
    body: {
      content: { 'application/json': { schema: loginSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'ログイン成功',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiJ9...' }),
              user: userResponseSchema,
            }),
          }),
        },
      },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '認証失敗',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['認証'],
  summary: 'ログアウト',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'ログアウト成功',
      content: { 'application/json': { schema: z.object({ data: z.null() }) } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── 日報 ──────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/daily-reports',
  tags: ['日報'],
  summary: '日報一覧取得',
  security: [{ bearerAuth: [] }],
  request: {
    query: dailyReportListQuerySchema,
  },
  responses: {
    200: {
      description: '日報一覧',
      content: {
        'application/json': { schema: z.object({ data: z.array(dailyReportListItemSchema) }) },
      },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports',
  tags: ['日報'],
  summary: '日報作成',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: dailyReportCreateSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: '日報作成成功',
      content: { 'application/json': { schema: z.object({ data: dailyReportDetailSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    409: {
      description: '同日の日報が存在する',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/daily-reports/{id}',
  tags: ['日報'],
  summary: '日報詳細取得',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
  },
  responses: {
    200: {
      description: '日報詳細',
      content: { 'application/json': { schema: z.object({ data: dailyReportDetailSchema }) } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/daily-reports/{id}',
  tags: ['日報'],
  summary: '日報更新',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    body: {
      content: { 'application/json': { schema: dailyReportUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: '日報更新成功',
      content: { 'application/json': { schema: z.object({ data: dailyReportDetailSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports/{id}/submit',
  tags: ['日報'],
  summary: '日報提出',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
  },
  responses: {
    200: {
      description: '提出成功',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.number(),
              status: z.literal('submitted'),
              updated_at: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports/{id}/approve',
  tags: ['日報'],
  summary: '日報承認',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
  },
  responses: {
    200: {
      description: '承認成功',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.number(),
              status: z.literal('approved'),
              approved_by: userRefSchema,
              approved_at: z.string().datetime(),
              updated_at: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports/{id}/reject',
  tags: ['日報'],
  summary: '日報差し戻し',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
  },
  responses: {
    200: {
      description: '差し戻し成功',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.number(),
              status: z.literal('rejected'),
              updated_at: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── 訪問記録 ──────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports/{id}/visit-records',
  tags: ['訪問記録'],
  summary: '訪問記録追加',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    body: {
      content: { 'application/json': { schema: visitRecordCreateSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: '訪問記録追加成功',
      content: { 'application/json': { schema: z.object({ data: visitRecordResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/visit-records/{id}',
  tags: ['訪問記録'],
  summary: '訪問記録更新',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    body: {
      content: { 'application/json': { schema: visitRecordUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: '訪問記録更新成功',
      content: { 'application/json': { schema: z.object({ data: visitRecordResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '訪問記録が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/visit-records/{id}',
  tags: ['訪問記録'],
  summary: '訪問記録削除',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
  },
  responses: {
    204: { description: '訪問記録削除成功' },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '訪問記録が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── コメント ──────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/daily-reports/{id}/comments',
  tags: ['コメント'],
  summary: 'コメント一覧取得',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    query: commentListQuerySchema,
  },
  responses: {
    200: {
      description: 'コメント一覧',
      content: {
        'application/json': { schema: z.object({ data: z.array(commentResponseSchema) }) },
      },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/daily-reports/{id}/comments',
  tags: ['コメント'],
  summary: 'コメント投稿',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    body: {
      content: { 'application/json': { schema: commentCreateSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'コメント投稿成功',
      content: { 'application/json': { schema: z.object({ data: commentResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '日報が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── 顧客マスタ ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/customers',
  tags: ['顧客マスタ'],
  summary: '顧客一覧取得',
  security: [{ bearerAuth: [] }],
  request: {
    query: customerListQuerySchema,
  },
  responses: {
    200: {
      description: '顧客一覧',
      content: {
        'application/json': { schema: z.object({ data: z.array(customerResponseSchema) }) },
      },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/customers',
  tags: ['顧客マスタ'],
  summary: '顧客登録',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: customerCreateSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: '顧客登録成功',
      content: { 'application/json': { schema: z.object({ data: customerResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/customers/{id}',
  tags: ['顧客マスタ'],
  summary: '顧客更新',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '10' }) }),
    body: {
      content: { 'application/json': { schema: customerUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: '顧客更新成功',
      content: { 'application/json': { schema: z.object({ data: customerResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '顧客が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/customers/{id}',
  tags: ['顧客マスタ'],
  summary: '顧客削除',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '10' }) }),
  },
  responses: {
    204: { description: '顧客削除成功' },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: '顧客が存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── ユーザーマスタ ────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/users',
  tags: ['ユーザーマスタ'],
  summary: 'ユーザー一覧取得',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'ユーザー一覧',
      content: { 'application/json': { schema: z.object({ data: z.array(userResponseSchema) }) } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/users',
  tags: ['ユーザーマスタ'],
  summary: 'ユーザー登録',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: userCreateSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'ユーザー登録成功',
      content: { 'application/json': { schema: z.object({ data: userResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    409: {
      description: 'メールアドレスが重複',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/users/{id}',
  tags: ['ユーザーマスタ'],
  summary: 'ユーザー更新',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '1' }) }),
    body: {
      content: { 'application/json': { schema: userUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'ユーザー更新成功',
      content: { 'application/json': { schema: z.object({ data: userResponseSchema }) } },
    },
    400: {
      description: 'バリデーションエラー',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    401: {
      description: '未認証',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    403: {
      description: '権限不足',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    404: {
      description: 'ユーザーが存在しない',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
})

// ── OpenAPI ドキュメント生成 ──────────────────────────────────────────────────

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: '営業日報システム API',
      version: '1.0.0',
      description: '営業担当者の日報管理・承認フローのAPI',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
  })
}
