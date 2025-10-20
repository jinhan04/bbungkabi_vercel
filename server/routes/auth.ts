// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET!;

router.post("/signup", async (req, res) => {
  const { username, nickname, password } = req.body;
  if (!username || !nickname || !password)
    return res.status(400).json({ error: "필수값 누락" });

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return res.status(409).json({ error: "이미 존재하는 username" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, nickname, passwordHash },
  });

  const token = jwt.sign(
    { uid: user.id, username: user.username, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname },
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "아이디/비번 오류" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "아이디/비번 오류" });

  const token = jwt.sign(
    { uid: user.id, username: user.username, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, nickname: user.nickname },
  });
});

export default router;
