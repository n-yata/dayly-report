import { NextResponse } from 'next/server'
import type { ErrorCode } from './errors'
import { ErrorStatus } from './errors'

// 成功レスポンス: { "data": ... }
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

// エラーレスポンス: { "error": { "code": "...", "message": "..." } }
export function errorResponse(code: ErrorCode, message: string, status?: number): NextResponse {
  const httpStatus = status ?? ErrorStatus[code]
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status: httpStatus }
  )
}
