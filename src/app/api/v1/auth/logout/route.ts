import { successResponse } from '@/lib/api/response'

// JWT はステートレスなため、サーバーサイドでのトークン無効化は行わない。
// クライアントはトークンをストレージから削除することでログアウトする。
export async function POST() {
  return successResponse(null)
}
