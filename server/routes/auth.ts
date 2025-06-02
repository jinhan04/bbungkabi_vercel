import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
export const authRoutes = router;

interface KakaoUser {
  id: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

router.post("/kakao", async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    res.status(400).json({ error: "Access token missing" });
    return;
  }

  try {
    const kakaoRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await kakaoRes.json()) as KakaoUser;

    const kakaoId = String(data.id);
    const nickname = data.kakao_account?.profile?.nickname || "unknown";
    const profileImage = data.kakao_account?.profile?.profile_image_url || null;

    let user = await prisma.user.findUnique({ where: { kakaoId } });
    if (!user) {
      user = await prisma.user.create({
        data: { kakaoId, nickname, profileImage },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.json({ token }); // <- 여기에서 return 하지 말고 그냥 실행
  } catch (err) {
    console.error("Kakao auth error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      kakaoId: user.kakaoId,
      nickname: user.nickname,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
