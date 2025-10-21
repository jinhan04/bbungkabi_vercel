// src/lib/auth.ts
import jwt from "jsonwebtoken";

// --- 환경변수에서 시크릿 로딩 ---
const _secret = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
if (!_secret) {
  throw new Error("JWT_SECRET(or AUTH_SECRET) missing!");
}
const JWT_SECRET: string = _secret;

// --- 세션 페이로드 타입 (필요하면 확장) ---
export type SessionPayload = {
  uid: string;
  username: string;
  nickname: string;
  emoji?: string;
};

// --- 쿠키 설정 (Next API에서 사용) ---
export const sessionCookie = {
  name: "bbungkabi_session",
  options: {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7d
  },
};

// --- 서명/검증 유틸 ---
export async function signSession(payload: SessionPayload): Promise<string> {
  // 동기 sign을 Promise 래핑 (호출부 일관성)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const decoded = jwt.verify(token, JWT_SECRET);
  // 타입 단언: 우리가 넣은 페이로드 구조에 맞게 반환
  return decoded as SessionPayload;
}
