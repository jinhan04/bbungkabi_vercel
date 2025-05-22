import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms: { [key: string]: string[] } = {};
const decks: { [key: string]: string[] } = {};
const playerHands: { [key: string]: { [nickname: string]: string[] } } = {};
const socketIdToNickname: { [key: string]: string } = {};
const turnIndex: { [key: string]: number } = {};
const readyPlayers: { [key: string]: Set<string> } = {};
const drawFlag: { [key: string]: Set<string> } = {};
const roundCount: { [key: string]: number } = {};
const scores: { [key: string]: { [nickname: string]: number[] } } = {};
const readyForNextRound: { [roomCode: string]: Set<string> } = {};
const bbungEndTriggeredBy: { [roomCode: string]: string | null } = {}; // 유도자 저장
const submittedHistory: {
  [key: string]: { nickname: string; card: string }[];
} = {};

const roundResults: {
  [roomCode: string]: {
    scores: { [nickname: string]: number };
    hands: { [nickname: string]: string[] };
    reason: string;
    stopper?: string;
  };
} = {};

const createDeck = () => {
  const suits = ["♠", "♥", "♣", "♦"];
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  const deck: string[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
};

const shuffle = (array: string[]) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

io.on("connection", (socket) => {
  console.log("새 클라이언트 연결:", socket.id);

  socket.on("join-room", ({ roomCode, nickname }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
      decks[roomCode] = shuffle(createDeck());
      playerHands[roomCode] = {};
      readyPlayers[roomCode] = new Set();
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();
    }

    if (rooms[roomCode].includes(nickname)) {
      socket.emit("join-error", "중복된 닉네임입니다.");
      return;
    }

    rooms[roomCode].push(nickname);
    socketIdToNickname[socket.id] = nickname;
    socket.join(roomCode);

    io.to(roomCode).emit("update-players", rooms[roomCode]);
  });

  socket.on("start-game", ({ roomCode, nickname, maxPlayers }) => {
    const players = rooms[roomCode];
    if (!players || players.length < 1 || players.length > maxPlayers) {
      socket.emit(
        "join-error",
        `게임은 1명 이상 ${maxPlayers}명 이하일 때만 시작할 수 있습니다.`
      );
      return;
    }

    // ✅ 라운드 카운터 초기화
    roundCount[roomCode] = 1;

    // ✅ 점수 배열 초기화
    scores[roomCode] = {};
    for (const nickname of players) {
      scores[roomCode][nickname] = [];
    }

    turnIndex[roomCode] = 0;
    decks[roomCode] = shuffle(createDeck());
    submittedHistory[roomCode] = [];
    drawFlag[roomCode] = new Set();

    for (const nickname of players) {
      playerHands[roomCode][nickname] = decks[roomCode].splice(0, 5);
    }

    // ✅ 남은 카드 수 전송 추가
    io.to(roomCode).emit("deck-update", { remaining: decks[roomCode].length });

    io.to(roomCode).emit("game-started", {
      roomCode,
      round: roundCount[roomCode] || 1, // ✅ 추가
    });

    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    turnIndex[roomCode] = players.indexOf(randomPlayer);

    setTimeout(() => {
      io.to(roomCode).emit("turn-info", { currentPlayer: randomPlayer }); // ✅ 수정
    }, 500);
  });

  socket.on("ready-next-round", ({ roomCode, nickname }) => {
    if (!readyForNextRound[roomCode]) {
      readyForNextRound[roomCode] = new Set();
    }

    readyForNextRound[roomCode].add(nickname);
    console.log(`[DEBUG] ${nickname} is ready for next round in ${roomCode}`);
    console.log(`[DEBUG] Ready count: ${readyForNextRound[roomCode].size}`);
    console.log(`[DEBUG] Total players: ${rooms[roomCode]?.length}`);

    io.to(roomCode).emit(
      "update-ready",
      Array.from(readyForNextRound[roomCode])
    );

    if (
      readyForNextRound[roomCode].size === rooms[roomCode]?.length &&
      roundCount[roomCode] <= 5
    ) {
      console.log("[DEBUG] All players ready. Advancing round.");

      readyForNextRound[roomCode].clear();

      // ✅ 라운드 수 증가
      roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

      // 라운드 준비
      turnIndex[roomCode] = 0;
      decks[roomCode] = shuffle(createDeck());
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();
      const players = rooms[roomCode];

      for (const nickname of rooms[roomCode]) {
        playerHands[roomCode][nickname] = decks[roomCode].splice(0, 5);
      }
      io.to(roomCode).emit("deck-update", {
        remaining: decks[roomCode].length,
      });

      // ✅ 여기에 game-started emit 추가
      io.to(roomCode).emit("game-started", {
        roomCode,
        round: roundCount[roomCode],
      });

      // ✅ 최저 점수 플레이어부터 시작
      const lastRoundScores = scores[roomCode];
      const lastScores = Object.entries(lastRoundScores).map(
        ([nickname, rounds]) => ({
          nickname,
          score: rounds[rounds.length - 1] ?? Infinity, // 없으면 무시되게
        })
      );

      lastScores.sort((a, b) => a.score - b.score); // 오름차순 정렬
      const firstPlayer = lastScores[0].nickname;
      turnIndex[roomCode] = players.indexOf(firstPlayer);

      // 👇 여기에 추가
      io.to(roomCode).emit("next-round", { round: roundCount[roomCode] });

      setTimeout(() => {
        io.to(roomCode).emit("turn-info", { currentPlayer: firstPlayer }); // ✅ 수정
      }, 500);
    }
  });

  socket.on("request-hand", ({ roomCode }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname) return;
    const hand = playerHands[roomCode]?.[nickname] || [];
    socket.emit("deal-cards", { hand });
  });

  socket.on("get-player-list", ({ roomCode }, callback) => {
    const players = rooms[roomCode] || [];
    callback(players);
  });

  socket.on("ready", ({ roomCode, nickname }) => {
    if (!readyPlayers[roomCode]) readyPlayers[roomCode] = new Set();
    readyPlayers[roomCode].add(nickname);

    if (readyPlayers[roomCode].size === rooms[roomCode]?.length) {
      const firstPlayer = rooms[roomCode][0];
      io.to(roomCode).emit("ready-ok");
      io.to(roomCode).emit("turn-info", { currentPlayer: firstPlayer });
    }
  });

  socket.on("stop", ({ roomCode, stopper, hand }) => {
    console.log(
      `[DEBUG] stop 이벤트 수신 | roomCode: ${roomCode}, stopper: ${stopper}`
    );

    if (!playerHands[roomCode]) playerHands[roomCode] = {};
    playerHands[roomCode][stopper] = hand;

    const hands = playerHands[roomCode];
    const scoresThisRound = calculateScores("stop", stopper, hands);

    console.log("[DEBUG] 계산된 점수:", scoresThisRound);

    // 점수 누적
    for (const [nickname, score] of Object.entries(scoresThisRound)) {
      scores[roomCode][nickname].push(score);
    }

    roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

    roundResults[roomCode] = {
      scores: scoresThisRound,
      hands,
      reason: "stop",
      stopper,
    };

    // ✅ 카드 정보는 보내지 않고 최소한의 정보만 emit
    io.to(roomCode).emit("round-ended", {
      reason: "stop",
      stopper,
      allPlayerHands: playerHands[roomCode],
      round: roundCount[roomCode],
    });
  });

  socket.on("get-round-result", ({ roomCode }, callback) => {
    if (!roundResults[roomCode]) return callback({ error: "No result found" });
    callback(roundResults[roomCode]);
  });

  socket.on("get-final-scores", ({ roomCode }, callback) => {
    const raw = scores[roomCode];
    if (!raw) return callback({ error: "No scores found" });

    const final = Object.entries(raw).map(([nickname, rounds]) => ({
      nickname,
      rounds,
      total: rounds.reduce((a, b) => a + b, 0),
    }));

    callback({ scores: final });
  });

  socket.on("start-next-round", ({ roomCode }) => {
    if (!rooms[roomCode] || roundCount[roomCode] > 5) return;

    turnIndex[roomCode] = 0;
    decks[roomCode] = shuffle(createDeck());
    submittedHistory[roomCode] = [];
    drawFlag[roomCode] = new Set();

    const players = rooms[roomCode];
    for (const nickname of players) {
      playerHands[roomCode][nickname] = decks[roomCode].splice(0, 5);
    }

    // ✅ 남은 카드 수 전송
    io.to(roomCode).emit("deck-update", { remaining: decks[roomCode].length });
    io.to(roomCode).emit("game-started", {
      roomCode,
      round: roundCount[roomCode],
    });

    setTimeout(() => {
      const firstPlayer = players[0];
      io.to(roomCode).emit("turn-info", { currentPlayer: firstPlayer });
    }, 500);
  });

  socket.on("draw-card", ({ roomCode }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    const currentPlayer = rooms[roomCode]?.[turnIndex[roomCode]];
    if (nickname !== currentPlayer) return;
    if (drawFlag[roomCode].has(nickname)) return;

    const deck = decks[roomCode];
    if (!deck || deck.length === 0) return;

    const card = deck.shift();
    if (card) {
      playerHands[roomCode][nickname].push(card);
      drawFlag[roomCode].add(nickname);
      socket.emit("drawn-card", { card });
      socket.to(roomCode).emit("player-drawn", { nickname });
    }

    if (deck.length === 0) {
      console.log("[DEBUG] 덱이 비었음 — 이후 조건에 따라 라운드 종료 예정");
    }

    io.to(roomCode).emit("deck-update", { remaining: deck.length });

    if (!deck || deck.length === 0) {
      console.log("[DEBUG] 덱이 비어 있음 — 라운드 종료 처리");

      io.to(roomCode).emit("round-ended", {
        reason: "deck-empty",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
      });

      return;
    }
  });

  socket.on("submit-card", ({ roomCode, card }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    const index = playerHands[roomCode][nickname].indexOf(card);
    if (index === -1) return;

    playerHands[roomCode][nickname].splice(index, 1);
    submittedHistory[roomCode].push({ nickname, card });
    io.to(roomCode).emit("card-submitted", { nickname, card });

    nextTurn(roomCode);
  });

  socket.on("chat-message", ({ roomCode, nickname, message }) => {
    io.to(roomCode).emit("chat-message", { nickname, message });
  });

  // --- 뻥 제출 처리 ---
  socket.on("submit-bbung", ({ roomCode, cards }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    // ✅ 드로우 후 뻥 금지
    if (drawFlag[roomCode]?.has(nickname)) {
      console.log("[BLOCKED] 드로우 후 뻥 시도 차단됨:", nickname);
      return; // ⛔ 반드시 즉시 반환
    }

    if (cards.length !== 2) return;

    const numbers = cards.map((c: string) => c.replace(/[^0-9JQKA]/g, ""));
    if (numbers[0] !== numbers[1]) return;

    const last = submittedHistory[roomCode].at(-1);
    const lastNumber = last?.card?.replace(/[^0-9JQKA]/g, "");
    const bbungNumber = numbers[0];

    if (last?.nickname === nickname && lastNumber === bbungNumber) {
      console.log("[BLOCKED] 자기 카드에 자기 뻥 시도:", nickname);
      return;
    }

    for (const card of cards) {
      const index = playerHands[roomCode][nickname].indexOf(card);
      if (index !== -1) {
        playerHands[roomCode][nickname].splice(index, 1);
        submittedHistory[roomCode].push({ nickname, card });
        io.to(roomCode).emit("card-submitted", { nickname, card });
      }
    }

    if (playerHands[roomCode][nickname].length === 0) {
      // 유도자 기억
      const last = submittedHistory[roomCode].at(-3);
      const bbungNumber = cards[0].replace(/[^0-9JQKA]/g, "");

      if (
        last &&
        last.nickname !== nickname &&
        last.card.replace(/[^0-9JQKA]/g, "") === bbungNumber
      ) {
        bbungEndTriggeredBy[roomCode] = last.nickname;
        console.log("[DEBUG] 뻥 유도자 저장:", last.nickname);
      }

      // ✅ 점수 계산 및 저장 추가
      const hands = playerHands[roomCode];
      const scoresThisRound = calculateScores(
        "bbung-end",
        null,
        hands,
        roomCode
      );
      console.log("[DEBUG] 뻥 종료 (즉시) — 계산된 점수:", scoresThisRound);

      for (const [nickname, score] of Object.entries(scoresThisRound)) {
        scores[roomCode][nickname].push(score);
      }

      roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

      roundResults[roomCode] = {
        scores: scoresThisRound,
        hands,
        reason: "bbung-end",
      };

      io.to(roomCode).emit("round-ended", {
        reason: "bbung-end",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
        triggerer: bbungEndTriggeredBy[roomCode], // ✅ 이 줄 추가!
      });
    }

    // 턴은 아직 넘기지 않음 — 추가 카드 제출까지 기다림
  });

  // --- 뻥 추가 카드 제출 처리 ---
  socket.on("submit-bbung-extra", ({ roomCode, card }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    const index = playerHands[roomCode][nickname].indexOf(card);
    if (index !== -1) {
      playerHands[roomCode][nickname].splice(index, 1);
      submittedHistory[roomCode].push({ nickname, card });
      io.to(roomCode).emit("card-submitted", { nickname, card });
    }

    if (playerHands[roomCode][nickname].length === 0) {
      const last = submittedHistory[roomCode].at(-1);
      if (last) bbungEndTriggeredBy[roomCode] = last.nickname;

      const hands = playerHands[roomCode];
      const scoresThisRound = calculateScores(
        "bbung-end",
        null,
        hands,
        roomCode
      );
      console.log("[DEBUG] 뻥 종료 — 계산된 점수:", scoresThisRound);

      for (const [nickname, score] of Object.entries(scoresThisRound)) {
        scores[roomCode][nickname].push(score);
      }

      roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

      roundResults[roomCode] = {
        scores: scoresThisRound,
        hands,
        reason: "bbung-end",
      };

      io.to(roomCode).emit("round-ended", {
        reason: "bbung-end",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
        triggerer: bbungEndTriggeredBy[roomCode],
      });
    } else {
      const players = rooms[roomCode];
      const bbungIdx = players.indexOf(nickname);
      const nextIdx = (bbungIdx + 1) % players.length;
      turnIndex[roomCode] = nextIdx;
      drawFlag[roomCode].clear();
      const nextPlayer = players[nextIdx];
      io.to(roomCode).emit("turn-info", { currentPlayer: nextPlayer });
    }
  });

  socket.on("hand-empty", ({ roomCode }) => {
    io.to(roomCode).emit("round-ended", {
      reason: "hand-empty",
      allPlayerHands: playerHands[roomCode],
      round: roundCount[roomCode],
    });
  });

  socket.on("declare-bagaji", ({ roomCode, isBagaji }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    io.to(roomCode).emit("bagaji-declared", {
      nickname,
      isBagaji,
    });
  });

  // --- round-ended 핸들러 내부 ---
  socket.on("round-ended", ({ roomCode, reason }) => {
    const hands = playerHands[roomCode];
    const stopper =
      reason === "stop" ? rooms[roomCode]?.[turnIndex[roomCode]] : undefined;

    const roundScore = calculateScores(
      reason,
      stopper || null,
      hands,
      roomCode
    );

    // ✅ 점수 누적
    for (const [nickname, score] of Object.entries(roundScore)) {
      scores[roomCode][nickname].push(score);
    }

    // ✅ 라운드 수 증가
    // roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

    // ✅ 결과 저장
    roundResults[roomCode] = {
      scores: roundScore,
      hands,
      reason,
      stopper,
    };

    io.to(roomCode).emit("round-ended", {
      reason,
      stopper,
      allPlayerHands: playerHands[roomCode],
      round: roundCount[roomCode],
    });
  });

  const nextTurn = (roomCode: string) => {
    const players = rooms[roomCode];
    if (!players) return;

    turnIndex[roomCode] = (turnIndex[roomCode] + 1) % players.length;
    drawFlag[roomCode].clear();
    const nextPlayer = players[turnIndex[roomCode]];

    io.to(roomCode).emit("turn-info", { currentPlayer: nextPlayer });
  };

  socket.on("disconnecting", () => {
    const roomsJoined = Array.from(socket.rooms);
    roomsJoined.forEach((roomCode) => {
      const nickname = socketIdToNickname[socket.id];
      if (!nickname) return;

      rooms[roomCode] = rooms[roomCode]?.filter((name) => name !== nickname);
      readyPlayers[roomCode]?.delete(nickname);

      if (rooms[roomCode]?.length === 0) {
        delete rooms[roomCode];
        delete decks[roomCode];
        delete playerHands[roomCode];
        delete submittedHistory[roomCode];
        delete turnIndex[roomCode];
        delete readyPlayers[roomCode];
        delete drawFlag[roomCode];
      }

      io.to(roomCode).emit("update-players", rooms[roomCode]);
    });

    delete socketIdToNickname[socket.id];
  });

  socket.on("disconnect", () => {
    console.log("클라이언트 연결 해제:", socket.id);
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

// --- 점수 계산 함수 ---
function calculateScores(
  reason: string,
  stopper: string | null,
  hands: { [nickname: string]: string[] },
  roomCode?: string
): { [nickname: string]: number } {
  const scores: { [nickname: string]: number } = {};

  const cardToValue = (card: string): number => {
    const v = card.replace(/[^0-9JQKA]/g, "");
    if (v === "A") return 1;
    if (v === "J") return 11;
    if (v === "Q") return 12;
    if (v === "K") return 13;
    return parseInt(v);
  };

  const sum = (arr: string[] | number[]): number => {
    if (typeof arr[0] === "string") {
      return (arr as string[]).map(cardToValue).reduce((a, b) => a + b, 0);
    } else {
      return (arr as number[]).reduce((a, b) => a + b, 0);
    }
  };

  const isStraight = (values: number[]): boolean => {
    const sorted = [...values].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (
        (sorted[i] - sorted[i - 1] + 13) % 13 !== 1 &&
        sorted[i] - sorted[i - 1] !== 1
      ) {
        return false;
      }
    }
    return true;
  };

  const isPairPairPair = (values: number[]): boolean => {
    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    return Object.values(counts).filter((c) => c === 2).length === 3;
  };

  const isTripleTriple = (values: number[]): boolean => {
    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    return Object.values(counts).filter((c) => c === 3).length === 2;
  };

  const calculate = (hand: string[]): number => {
    if (hand.length === 0) return 0;
    const values = hand.map(cardToValue);
    const total = sum(hand);

    // 족보 (6장짜리 특수 조건)
    if (hand.length === 6) {
      if (isStraight(values)) return -total;
      if (isPairPairPair(values)) return 0;
      if (isTripleTriple(values)) return 0;
      if (total <= 14) return -100;
      if (total >= 65) return -total;
      return total;
    }

    if (
      hand.length === 3 &&
      values.every((v) => v === values[0]) // 모두 같은 숫자
    ) {
      return 0;
    }

    // ✅ 손패가 6장이 아닌 경우에만 적용
    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const tripleValue = Object.keys(counts).find(
      (k) => counts[parseInt(k)] === 3
    );
    if (
      tripleValue &&
      Object.values(counts).filter((c) => c === 3).length === 1
    ) {
      const v = parseInt(tripleValue);
      const rest = values.filter((x) => x !== v);
      return sum(rest);
    }

    return total;
  };

  const allPlayers = Object.keys(hands);

  if (reason === "stop" && stopper) {
    const stopperScore = calculate(hands[stopper]);
    const hasLowerOrEqual = allPlayers.some(
      (p) => p !== stopper && calculate(hands[p]) <= stopperScore
    );

    for (const p of allPlayers) {
      if (p === stopper) {
        scores[p] = stopperScore + (hasLowerOrEqual ? 50 : 0);
      } else {
        const s = calculate(hands[p]);
        scores[p] = hasLowerOrEqual ? 0 : s;
      }
    }
  } else {
    for (const p of allPlayers) {
      scores[p] = calculate(hands[p]);
    }
  }

  // 뻥 유도자 보너스 적용
  if (reason === "bbung-end" && roomCode) {
    const rewardPlayer = bbungEndTriggeredBy[roomCode];
    console.log("[DEBUG] bbung-end 유도자:", rewardPlayer);

    if (rewardPlayer) {
      scores[rewardPlayer] = (scores[rewardPlayer] || 0) + 30;
      console.log(`[DEBUG] ${rewardPlayer} 에게 +30점 보상`);
    } else {
      console.log("[DEBUG] 유도자 없음 — 점수 보상 생략됨");
    }
  }
  // 점수 반환
  return scores;
}
