// server\src\sockets\miscHandlers.ts
import { Server, Socket } from "socket.io";
import { store } from "../store";

export function registerMiscHandlers(io: Server, socket: Socket) {
  socket.on("chat-message", ({ roomCode, nickname, message }) => {
    io.to(roomCode).emit("chat-message", { nickname, message });
  });

  socket.on("get-final-scores", ({ roomCode }, callback) => {
    const raw = store.scores[roomCode];
    if (!raw) return callback({ error: "No scores found" });
    const final = Object.entries(raw).map(([nickname, rounds]) => ({
      nickname,
      rounds,
      total: rounds.reduce((a, b) => a + b, 0),
    }));
    callback({ scores: final });
  });

  socket.on("get-round-result", ({ roomCode }, callback) => {
    if (!store.roundResults[roomCode])
      return callback({ error: "No result found" });
    callback(store.roundResults[roomCode]);
  });

  socket.on("get-player-list", ({ roomCode }, callback) => {
    const players = store.rooms[roomCode] || [];
    callback(players);
  });

  socket.on("get-player-emojis", ({ roomCode }, callback) => {
    const map = store.emojiMap[roomCode] || {};
    callback(map);
  });
}
