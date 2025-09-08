// server\src\sockets\gameHandlers.ts
import { Server, Socket } from "socket.io";
import { store } from "../store";
import {
  getAllPlayers,
  broadcastTurn,
  nextTurn,
  serverDraw,
  serverSubmitSingleCard,
  serverSubmitBbung,
  serverSubmitBbungExtra,
  serverStop,
} from "../bot/logic";
import { calculateScores } from "../services/scoring";

export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on("request-hand", ({ roomCode }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname) return;
    const hand = store.playerHands[roomCode]?.[nickname] || [];
    socket.emit("deal-cards", { hand });
  });

  socket.on("draw-card", ({ roomCode }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    const all = getAllPlayers(roomCode);
    const current = all?.[store.turnIndex[roomCode]];
    if (nickname !== current) return;
    if (store.drawFlag[roomCode]?.has(nickname)) return;

    const deck = store.decks[roomCode];
    if (!deck?.length) return;

    const ended = serverDraw(io, roomCode, nickname);
    if (ended) return;

    store.drawFlag[roomCode].add(nickname);
    // drawn-card 자체는 클라에서 필요 시 유지
    socket.emit("drawn-card", { card: "(server-hidden)" });
  });

  socket.on("submit-card", ({ roomCode, card }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    serverSubmitSingleCard(io, roomCode, nickname, card);
  });

  socket.on("submit-bbung", ({ roomCode, cards }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    if (store.drawFlag[roomCode]?.has(nickname)) return; // 드로우 후 뻥 금지
    serverSubmitBbung(io, roomCode, nickname, cards);
    io.to(roomCode).emit("bbung-effect", { nickname });
  });

  socket.on("submit-bbung-extra", ({ roomCode, card }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    serverSubmitBbungExtra(io, roomCode, nickname, card);
  });

  socket.on(
    "uhbbung",
    ({ roomCode, nickname }: { roomCode: string; nickname: string }) => {
      if (!store.uhbbungEnabledMap[roomCode]) return;
      const current = getAllPlayers(roomCode)[store.turnIndex[roomCode]];
      if (current !== nickname) return;

      const now = Date.now();
      const last = store.uhbbungLastTickAt[roomCode]?.[nickname] ?? 0;
      if (now - last < 8000) return;

      if (!store.uhbbungLastTickAt[roomCode])
        store.uhbbungLastTickAt[roomCode] = {};
      if (!store.uhbbungTempScores[roomCode])
        store.uhbbungTempScores[roomCode] = {};
      store.uhbbungLastTickAt[roomCode][nickname] = now;
      store.uhbbungTempScores[roomCode][nickname] =
        (store.uhbbungTempScores[roomCode][nickname] ?? 0) + 10;

      io.to(roomCode).emit("score-tick", {
        nickname,
        delta: 10,
        reason: "uhbbung",
      });
      io.to(roomCode).emit("log", `${nickname} 님 어벙 +10`);
    }
  );

  socket.on("stop", ({ roomCode, stopper, hand }) => {
    if (!store.playerHands[roomCode]) store.playerHands[roomCode] = {};
    store.playerHands[roomCode][stopper] = hand;

    const hands = store.playerHands[roomCode];
    const s = calculateScores("stop", stopper, hands, roomCode);
    for (const [n, v] of Object.entries(s)) {
      if (!store.scores[roomCode][n]) store.scores[roomCode][n] = [];
      store.scores[roomCode][n].push(v);
    }

    store.roundResults[roomCode] = {
      scores: s,
      hands,
      reason: "stop",
      stopper,
    };
    store.roundInProgress[roomCode] = false;

    io.to(roomCode).emit("round-ended", {
      reason: "stop",
      stopper,
      allPlayerHands: store.playerHands[roomCode],
      round: store.roundCount[roomCode],
    });
  });

  socket.on("hand-empty", ({ roomCode }) => {
    store.roundInProgress[roomCode] = false;
    io.to(roomCode).emit("round-ended", {
      reason: "hand-empty",
      allPlayerHands: store.playerHands[roomCode],
      round: store.roundCount[roomCode],
    });
  });

  socket.on("declare-bagaji", ({ roomCode, isBagaji }) => {
    const nickname = store.socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;
    io.to(roomCode).emit("bagaji-declared", { nickname, isBagaji });
  });

  // 클라에서 실수로 emit한 경우 방어
  socket.on("round-ended", ({ roomCode, reason }) => {
    const hands = store.playerHands[roomCode];
    const stopper =
      reason === "stop"
        ? getAllPlayers(roomCode)[store.turnIndex[roomCode]]
        : undefined;
    const s = calculateScores(reason, stopper || null, hands, roomCode);
    for (const [n, v] of Object.entries(s)) {
      if (!store.scores[roomCode][n]) store.scores[roomCode][n] = [];
      store.scores[roomCode][n].push(v);
    }
    store.roundResults[roomCode] = { scores: s, hands, reason, stopper };
    store.roundInProgress[roomCode] = false;

    io.to(roomCode).emit("round-ended", {
      reason,
      stopper,
      allPlayerHands: store.playerHands[roomCode],
      round: store.roundCount[roomCode],
    });
  });
}
