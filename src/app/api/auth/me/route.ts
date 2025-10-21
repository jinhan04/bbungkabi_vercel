// src\app\api\auth\me\route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, sessionCookie } from "@/lib/auth";

export async function GET() {
  // ✅ cookies()는 Promise이므로 await 필요
  const store = await cookies();
  const cookie = store.get(sessionCookie.name);
  const token = cookie?.value;

  if (!token) return NextResponse.json({ user: null });

  try {
    const payload = await verifySession(token);
    return NextResponse.json({ user: payload });
  } catch {
    return NextResponse.json({ user: null });
  }
}
