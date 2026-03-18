import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyToken } from './lib/auth/jwt'

// 認証不要なパス
const PUBLIC_PATHS = ['/api/v1/auth/login', '/api/v1/auth/logout']

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // API v1 以外はスキップ
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next()
  }

  // 認証不要なパスはスキップ
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Authorization ヘッダーを確認
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'トークンが無効または期限切れです' } },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/v1/:path*'],
}
