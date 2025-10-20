// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const key = process.env.AUTH_SECRET;
  if (!key) {
    // 실제 요청 처리 시점에만 에러가 나도록
    throw new Error("AUTH_SECRET env var is not set");
  }
  cachedSecret = new TextEncoder().encode(key);
  return cachedSecret;
}

export type JWTPayload = {
  uid: string;
  username: string;
  nickname: string;
  emoji?: string;
};

export async function signSession(payload: JWTPayload) {
  const secret = getSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as JWTPayload;
}

// 🔸 개발에서는 http 쿠키도 저장되도록 secure 옵션 분기 (중요!)
const isProd = process.env.NODE_ENV === "production";

export const sessionCookie = {
  name: "bbungkabi_session",
  options: {
    httpOnly: true,
    secure: isProd, // prod만 true, 로컬은 false
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  },
};
