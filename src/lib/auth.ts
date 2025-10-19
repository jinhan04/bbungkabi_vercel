// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";

const key = process.env.AUTH_SECRET;
if (!key) {
  // 환경변수 없으면 명확히 실패시켜 원인 보이게
  throw new Error("AUTH_SECRET env var is not set");
}
const secret = new TextEncoder().encode(key);

export type JWTPayload = {
  uid: string;
  username: string;
  nickname: string;
  emoji?: string;
};

export async function signSession(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as JWTPayload;
}

export const sessionCookie = {
  name: "bbungkabi_session",
  options: {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  },
};
