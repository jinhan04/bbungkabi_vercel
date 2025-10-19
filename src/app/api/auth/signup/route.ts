import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signSession, sessionCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { username, password, nickname, emoji } = await req.json();

    if (!username || !password || !nickname) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    const exist = await prisma.user.findUnique({ where: { username } });
    if (exist) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, passwordHash, nickname, emoji },
      select: { id: true, username: true, nickname: true, emoji: true },
    });

    const token = await signSession({
      uid: user.id,
      username: user.username,
      nickname: user.nickname,
      emoji: user.emoji ?? undefined,
    });

    const res = NextResponse.json({ user });
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);
    return res;
  } catch (e) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
