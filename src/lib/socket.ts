import { io } from "socket.io-client";

// 💡 Vercel 환경변수가 있으면 그걸 쓰고, 없으면 로컬(localhost)을 씁니다.
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const socket = io(SOCKET_URL, {
  transports: ["websocket"], // 웹소켓 전용으로 설정하여 속도 향상
});

export const getSocket = () => socket;
