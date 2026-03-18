import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

export type JwtPayload = {
  userId: number
  role: string
  email: string
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET)
}

/**
 * JWTトークンを生成する
 */
export async function signToken(payload: JwtPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getSecretKey())
}

/**
 * JWTトークンを検証して、ペイロードを返す
 * 無効・期限切れの場合は null を返す
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return {
      userId: payload.userId as number,
      role: payload.role as string,
      email: payload.email as string,
    }
  } catch {
    return null
  }
}
