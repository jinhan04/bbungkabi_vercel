import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;

router.post("/signup", async (req, res) => {
  try {
    const { email, nickname, password } = req.body;
    if (!email || !nickname || !password)
      return res.status(400).json({ error: "필수값 누락" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "이미 가입된 이메일" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, nickname, passwordHash },
    });
    const token = jwt.sign({ uid: user.id, email, nickname }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ ok: true, token, user: { id: user.id, email, nickname } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "서버 에러" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ error: "이메일 또는 비밀번호 오류" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: "이메일 또는 비밀번호 오류" });

    const token = jwt.sign(
      { uid: user.id, email: user.email, nickname: user.nickname },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "서버 에러" });
  }
});

export default router;
