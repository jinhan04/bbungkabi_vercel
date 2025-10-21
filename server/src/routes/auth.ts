// server/src/routes/auth.ts
import { Router, type RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const _secret = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
if (!_secret) throw new Error("JWT_SECRET(or AUTH_SECRET) missing!");
const JWT_SECRET: string = _secret;

const signup: RequestHandler = async (req, res) => {
  const { username, nickname, password } = (req.body ?? {}) as {
    username?: string;
    nickname?: string;
    password?: string;
  };

  if (!username || !nickname || !password) {
    res.status(400).json({ error: "필수값 누락" });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    res.status(409).json({ error: "이미 존재하는 username" });
    return;
  }

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
};

const login: RequestHandler = async (req, res) => {
  const { username, password } = (req.body ?? {}) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "필수값 누락" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "아이디/비번 오류" });
    return;
  }

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
};

router.post("/signup", signup);
router.post("/login", login);

export default router;
