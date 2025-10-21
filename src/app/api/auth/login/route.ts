// src\app\api\auth\login\route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디/비밀번호를 입력하세요" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 틀렸습니다" },
        { status: 401 }
      );
    }

    const token = await signSession({
      uid: user.id,
      username: user.username,
      nickname: user.nickname,
      emoji: user.emoji ?? undefined,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        emoji: user.emoji,
      },
    });
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return res;
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
