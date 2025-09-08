// server\src\sockets\lobbyHandlers.ts
import { Server, Socket } from "socket.io";
import { store } from "../store";
import { createDeck, shuffle } from "../utils/cards";
import { broadcastTurn, getAllPlayers } from "../bot/logic";
import { generateBotNickname } from "../bot/names";

export function registerLobbyHandlers(io: Server, socket: Socket) {
  socket.on("join-room", ({ roomCode, nickname, emoji }) => {
    if (!store.rooms[roomCode]) {
      store.rooms[roomCode] = [];
      store.decks[roomCode] = shuffle(createDeck());
      store.playerHands[roomCode] = {};
      store.readyPlayers[roomCode] = new Set();
      store.submittedHistory[roomCode] = [];
      store.drawFlag[roomCode] = new Set();
    }

    if (!store.emojiMap[roomCode]) store.emojiMap[roomCode] = {};
    store.emojiMap[roomCode][nickname] = emoji || "🐶";
    io.to(roomCode).emit("update-emojis", store.emojiMap[roomCode]);

    if (store.rooms[roomCode].includes(nickname)) {
      socket.emit("join-error", "중복된 닉네임입니다.");
      return;
    }

    store.rooms[roomCode].push(nickname);
    store.socketIdToNickname[socket.id] = nickname;
    socket.join(roomCode);

    io.to(roomCode).emit("update-players", {
      players: store.rooms[roomCode],
      emojis: store.emojiMap[roomCode],
    });

    // 로비 통합 리스트
    io.to(roomCode).emit("player-list", {
      players: [
        ...store.rooms[roomCode].map((n) => ({ nickname: n, isBot: false })),
        ...store.getBots(roomCode).map((b) => ({
          nickname: b.nickname,
          isBot: true,
          difficulty: b.difficulty,
        })),
      ],
    });
  });

  socket.on("request-player-list", ({ roomCode }) => {
    io.to(roomCode).emit("player-list", {
      players: [
        ...(store.rooms[roomCode]?.map((n) => ({
          nickname: n,
          isBot: false,
        })) ?? []),
        ...store.getBots(roomCode).map((b) => ({
          nickname: b.nickname,
          isBot: true,
          difficulty: b.difficulty,
        })),
      ],
    });
  });

  socket.on(
    "add-bot",
    ({
      roomCode,
      difficulty,
    }: {
      roomCode: string;
      difficulty?: "easy" | "normal" | "hard";
    }) => {
      const total =
        (store.rooms[roomCode]?.length || 0) + store.getBots(roomCode).length;
      if (total >= 6) {
        socket.emit("error-message", {
          message: "최대 인원(6명)을 초과할 수 없습니다.",
        });
        return;
      }
      const existing = new Set<string>([
        ...(store.rooms[roomCode] || []),
        ...store.getBots(roomCode).map((b) => b.nickname),
      ]);
      const nick = generateBotNickname(existing);
      store.addBot(roomCode, {
        nickname: nick,
        difficulty: difficulty || "easy",
      });
      if (!store.playerHands[roomCode]) store.playerHands[roomCode] = {};
      store.playerHands[roomCode][nick] = [];
      io.to(roomCode).emit("player-joined", {
        nickname: nick,
        isBot: true,
        difficulty: difficulty || "easy",
      });

      if (!store.emojiMap[roomCode]) store.emojiMap[roomCode] = {};
      if (!store.emojiMap[roomCode][nick])
        store.emojiMap[roomCode][nick] = "🤖";
      io.to(roomCode).emit("update-emojis", store.emojiMap[roomCode]);

      io.to(roomCode).emit("player-list", {
        players: [
          ...store.rooms[roomCode].map((n) => ({ nickname: n, isBot: false })),
          ...store.getBots(roomCode).map((b) => ({
            nickname: b.nickname,
            isBot: true,
            difficulty: b.difficulty,
          })),
        ],
      });
    }
  );

  socket.on(
    "remove-bot",
    ({ roomCode, nickname }: { roomCode: string; nickname: string }) => {
      const found = store
        .getBots(roomCode)
        .some((b) => b.nickname === nickname);
      if (!found) return;
      store.removeBot(roomCode, nickname);
      if (store.playerHands[roomCode])
        delete store.playerHands[roomCode][nickname];
      io.to(roomCode).emit("player-left", { nickname });

      if (store.emojiMap[roomCode] && store.emojiMap[roomCode][nickname]) {
        delete store.emojiMap[roomCode][nickname];
        io.to(roomCode).emit("update-emojis", store.emojiMap[roomCode]);
      }

      io.to(roomCode).emit("player-list", {
        players: [
          ...store.rooms[roomCode].map((n) => ({ nickname: n, isBot: false })),
          ...store.getBots(roomCode).map((b) => ({
            nickname: b.nickname,
            isBot: true,
            difficulty: b.difficulty,
          })),
        ],
      });
    }
  );

  socket.on(
    "start-game",
    ({
      roomCode,
      nickname,
      maxPlayers,
      doubleFinal,
      uhbbungEnabled = false,
      rounds = 5,
    }: {
      roomCode: string;
      nickname: string;
      maxPlayers?: number;
      doubleFinal?: boolean;
      uhbbungEnabled?: boolean;
      rounds?: number;
    }) => {
      store.doubleFinalRoundMap[roomCode] = !!doubleFinal;
      store.uhbbungEnabledMap[roomCode] = !!uhbbungEnabled;
      store.lastBbungHappened[roomCode] = false;
      store.uhbbungTempScores[roomCode] = {};
      store.uhbbungLastTickAt[roomCode] = {};
      store.roundCount[roomCode] = 1;

      const all = getAllPlayers(roomCode);
      store.scores[roomCode] = {};
      for (const n of all) store.scores[roomCode][n] = [];

      store.turnIndex[roomCode] = 0;
      store.decks[roomCode] = shuffle(createDeck());
      store.submittedHistory[roomCode] = [];
      store.drawFlag[roomCode] = new Set();

      for (const n of all) {
        if (!store.playerHands[roomCode]) store.playerHands[roomCode] = {};
        store.playerHands[roomCode][n] = store.decks[roomCode].splice(0, 5);
      }

      io.to(roomCode).emit("deck-update", {
        remaining: store.decks[roomCode].length,
      });
      io.to(roomCode).emit("game-started", {
        roomCode,
        round: store.roundCount[roomCode],
      });

      const randomPlayer = all[Math.floor(Math.random() * all.length)];
      store.turnIndex[roomCode] = all.indexOf(randomPlayer);
      broadcastTurn(io, roomCode, randomPlayer);
    }
  );

  socket.on("ready-next-round", ({ roomCode, nickname }) => {
    if (!store.readyForNextRound[roomCode])
      store.readyForNextRound[roomCode] = new Set();
    store.readyForNextRound[roomCode].add(nickname);
    store.drawFlag[roomCode] = new Set();
    store.lastBbungHappened[roomCode] = false;

    const botsReady = store.getBots(roomCode).map((b) => b.nickname);
    const combinedReady = Array.from(
      new Set([...Array.from(store.readyForNextRound[roomCode]), ...botsReady])
    );
    io.to(roomCode).emit("update-ready", combinedReady);

    if (
      store.readyForNextRound[roomCode].size ===
        (store.rooms[roomCode]?.length || 0) &&
      store.roundCount[roomCode] <= 5 &&
      !store.roundInProgress[roomCode]
    ) {
      store.roundInProgress[roomCode] = true;
      store.readyForNextRound[roomCode].clear();

      store.roundCount[roomCode] = (store.roundCount[roomCode] || 0) + 1;
      store.turnIndex[roomCode] = 0;
      store.decks[roomCode] = shuffle(createDeck());
      store.submittedHistory[roomCode] = [];
      store.drawFlag[roomCode] = new Set();
      store.uhbbungTempScores[roomCode] = {};
      store.uhbbungLastTickAt[roomCode] = {};

      const players = getAllPlayers(roomCode);
      for (const n of players)
        store.playerHands[roomCode][n] = store.decks[roomCode].splice(0, 5);
      io.to(roomCode).emit("deck-update", {
        remaining: store.decks[roomCode].length,
      });

      const firstPlayer = players[0]; // (필요 시 직전 라운드 최저점 로직으로 교체 가능)
      store.turnIndex[roomCode] = players.indexOf(firstPlayer);
      io.to(roomCode).emit("next-round", { round: store.roundCount[roomCode] });
      broadcastTurn(io, roomCode, firstPlayer);
    }
  });

  socket.on("disconnecting", () => {
    const roomsJoined = Array.from(socket.rooms);
    roomsJoined.forEach((roomCode) => {
      const nickname = store.socketIdToNickname[socket.id];
      if (!nickname) return;

      store.rooms[roomCode] = store.rooms[roomCode]?.filter(
        (name) => name !== nickname
      );
      store.readyPlayers[roomCode]?.delete(nickname);

      if (store.rooms[roomCode]?.length === 0) {
        delete store.rooms[roomCode];
        delete store.decks[roomCode];
        delete store.playerHands[roomCode];
        delete store.submittedHistory[roomCode];
        delete store.turnIndex[roomCode];
        delete store.readyPlayers[roomCode];
        delete store.drawFlag[roomCode];
      }

      io.to(roomCode).emit("update-players", {
        players: store.rooms[roomCode],
        emojis: store.emojiMap[roomCode],
      });

      io.to(roomCode).emit("player-list", {
        players: [
          ...(store.rooms[roomCode] || []).map((n) => ({
            nickname: n,
            isBot: false,
          })),
          ...store.getBots(roomCode).map((b) => ({
            nickname: b.nickname,
            isBot: true,
            difficulty: b.difficulty,
          })),
        ],
      });
    });

    delete store.socketIdToNickname[socket.id];
  });
}
