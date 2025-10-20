// src/app/api/auth/signup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    // 1) 메서드/헤더 가드 (App Router는 파일 이름으로 메서드 분리되지만, content-type 확인은 유효)
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return bad("Invalid content-type", 415);
    }

    // 2) 입력 파싱
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return bad("Malformed JSON");
    }

    const {
      username: rawUsername,
      password,
      nickname: rawNickname,
      emoji,
    } = (payload as Record<string, unknown>) ?? {};

    if (
      typeof rawUsername !== "string" ||
      typeof password !== "string" ||
      typeof rawNickname !== "string"
    ) {
      return bad("입력값을 확인해주세요.");
    }

    // 3) 정규화
    const username = rawUsername.trim().toLowerCase(); // citext가 아니더라도 일관성 보장
    const nickname = rawNickname.trim();

    // 4) 밸리데이션 (예시: 영문/숫자/._- 3~24자)
    const usernameOk = /^[\p{L}\p{N}._-]{3,24}$/u.test(username);
    const passwordOk = password.length >= 8; // 최소 8자 권장
    const nicknameOk = nickname.length >= 1 && nickname.length <= 24;
    if (!usernameOk || !passwordOk || !nicknameOk) {
      return bad("입력값을 확인해주세요.");
    }

    // 5) 사전 존재 체크(UX용) — 레이스는 아래 P2002로 최종 방어
    const exist = await prisma.user.findUnique({ where: { username } });
    if (exist) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 409 }
      );
    }

    // 6) 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 12);

    // 7) 유저 생성
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        nickname,
        emoji: typeof emoji === "string" ? emoji : undefined,
        // lastLoginAt: new Date(), // 원하면 초기 로그인 시각 설정
      },
      select: { id: true, username: true, nickname: true, emoji: true },
    });

    // 8) 세션 발급
    const token = await signSession({
      uid: user.id,
      username: user.username,
      nickname: user.nickname,
      emoji: user.emoji ?? undefined,
    });

    const res = NextResponse.json({ user }, { status: 201 }); // 201 Created
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return res;
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "이미 사용 중인 아이디입니다." },
          { status: 409 }
        );
      }
    }

    console.error("[auth/signup] error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
