// src/lib/auth.ts

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function removeToken() {
  localStorage.removeItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

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
