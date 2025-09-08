import "dotenv/config";

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PORT, CORS_ORIGIN } from "./config";
import { registerHandlers } from "./sockets/registerHandlers";

const app = express();
app.use(express.json());
app.use(cors({ origin: CORS_ORIGIN, methods: ["GET", "POST"] }));

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("새 클라이언트 연결:", socket.id);
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
