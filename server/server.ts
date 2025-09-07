import express, { Router } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
// import { authRoutes } from "./routes/auth";

// const typedRoutes: Router = authRoutes;
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
const doubleFinalRoundMap: { [roomCode: string]: boolean } = {};
const scores: { [key: string]: { [nickname: string]: number[] } } = {};
const readyForNextRound: { [roomCode: string]: Set<string> } = {};
const bbungEndTriggeredBy: { [roomCode: string]: string | null } = {}; // 유도자 저장
const emojiMap: { [roomCode: string]: { [nickname: string]: string } } = {};

const submittedHistory: {
  [key: string]: { nickname: string; card: string }[];
} = {};

const roundInProgress: { [roomCode: string]: boolean } = {};

const roundResults: {
  [roomCode: string]: {
    scores: { [nickname: string]: number };
    hands: { [nickname: string]: string[] };
    reason: string;
    stopper?: string;
  };
} = {};

// [AI] === 봇 타입/상태/유틸 추가 시작 ===
type Difficulty = "easy" | "normal" | "hard";

interface BotInfo {
  nickname: string;
  difficulty: Difficulty;
}

const roomBots: { [roomCode: string]: BotInfo[] } = {};

function getBots(roomCode: string): BotInfo[] {
  return roomBots[roomCode] || [];
}
function addBot(roomCode: string, bot: BotInfo) {
  if (!roomBots[roomCode]) roomBots[roomCode] = [];
  roomBots[roomCode].push(bot);
}
function removeBot(roomCode: string, nickname: string) {
  roomBots[roomCode] = (roomBots[roomCode] || []).filter(
    (b) => b.nickname !== nickname
  );
}

// 사람 + 봇을 합친 로비용 목록
function broadcastPlayerList(roomCode: string) {
  const humans = rooms[roomCode] || [];
  const bots = getBots(roomCode);
  io.to(roomCode).emit("player-list", {
    players: [
      ...humans.map((n) => ({ nickname: n, isBot: false })),
      ...bots.map((b) => ({
        nickname: b.nickname,
        isBot: true,
        difficulty: b.difficulty,
      })),
    ],
  });
}
// [AI] === 봇 타입/상태/유틸 추가 끝 ===

// [AI-STEP3] === 공용 액션/봇 로직/턴 브로드캐스트 ===

// 사람+봇 전체 플레이어
function getAllPlayers(roomCode: string): string[] {
  const humans = rooms[roomCode] || [];
  const bots = getBots(roomCode).map((b) => b.nickname);
  return [...humans, ...bots];
}

// 서버 내부에서 "카드 제출" 실행 (사람/봇 공용 경로)
function serverSubmitSingleCard(
  roomCode: string,
  nickname: string,
  card: string
) {
  if (!playerHands[roomCode] || !playerHands[roomCode][nickname]) return;
  const idx = playerHands[roomCode][nickname].indexOf(card);
  if (idx === -1) return;
  playerHands[roomCode][nickname].splice(idx, 1);
  submittedHistory[roomCode].push({ nickname, card });
  io.to(roomCode).emit("card-submitted", { nickname, card });
  nextTurn(roomCode); // 기존 턴 진행 재사용
}

// 서버 내부에서 "드로우" 실행 (사람/봇 공용 경로)
// 서버 내부에서 "드로우" 실행 (사람/봇 공용 경로)
// ⬇️ 반환값: true면 라운드가 이 호출로 종료됨
function serverDraw(roomCode: string, nickname: string): boolean {
  const deck = decks[roomCode];
  if (!deck || deck.length === 0) return false;

  const card = deck.shift();
  if (card) {
    if (!playerHands[roomCode]) playerHands[roomCode] = {};
    if (!playerHands[roomCode][nickname]) playerHands[roomCode][nickname] = [];
    playerHands[roomCode][nickname].push(card);

    // 봇은 개별 socket이 없으니 모두에게 브로드캐스트만
    io.to(roomCode).emit("player-drawn", { nickname });
  }

  io.to(roomCode).emit("deck-update", { remaining: deck.length });

  // ⬇️ 여기서 "봇 족보 자동 종료"를 먼저 검사
  const isBot = getBots(roomCode).some((b) => b.nickname === nickname);
  if (isBot) {
    const hand = playerHands[roomCode]?.[nickname] || [];
    if (_isJokboHand(hand)) {
      console.log(
        `[${new Date().toISOString()}][AI] ${nickname} 족보 완성 → 라운드 즉시 종료`
      );

      const hands = playerHands[roomCode];
      const scoresThisRound = calculateScores(
        "족보 완성",
        null,
        hands,
        roomCode
      );
      for (const [n, score] of Object.entries(scoresThisRound)) {
        scores[roomCode][n].push(score);
      }

      roundResults[roomCode] = {
        scores: scoresThisRound,
        hands,
        reason: "족보 완성",
      };
      roundInProgress[roomCode] = false;

      io.to(roomCode).emit("round-ended", {
        reason: "족보 완성",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
      });

      return true; // ✅ 이 드로우로 라운드가 끝났음을 상위에 알림
    }
  }

  // (그 다음) 덱이 완전히 비었으면 라운드 종료
  if (deck.length === 0) {
    roundInProgress[roomCode] = false;
    io.to(roomCode).emit("round-ended", {
      reason: "deck-empty",
      allPlayerHands: playerHands[roomCode],
      round: roundCount[roomCode],
    });
    return true;
  }

  return false;
}

// 지금 낼 수 있는 "단일 카드" 후보 (최소 구현: 손패 전체)
function getLegalSingles(roomCode: string, nickname: string): string[] {
  return [...(playerHands[roomCode]?.[nickname] || [])];
}

// 난이도별 생각시간
function botThinkMs(diff: Difficulty): [number, number] {
  if (diff === "hard") return [800, 1500];
  if (diff === "normal") return [600, 1200];
  return [400, 900];
}
function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// 현재 턴의 플레이어 닉네임 반환
function getCurrentPlayerName(roomCode: string): string | undefined {
  const players = getAllPlayers(roomCode);
  if (!players || players.length === 0) return undefined;
  return players[turnIndex[roomCode]];
}

// 손패에서 '가장 높은' 카드 하나 고르기
function pickHighestCardFromHand(
  roomCode: string,
  nickname: string
): string | null {
  const hand = playerHands[roomCode]?.[nickname] || [];
  if (hand.length === 0) return null;
  let best = hand[0];
  let bestVal = _cardToValueN(best);
  for (const c of hand) {
    const v = _cardToValueN(c);
    if (v > bestVal) {
      best = c;
      bestVal = v;
    }
  }
  return best;
}

// 턴 브로드캐스트 + (현재 턴이 봇이면) 봇 실행
function broadcastTurn(roomCode: string, currentPlayer: string) {
  io.to(roomCode).emit("turn-info", {
    currentPlayer,
    round: roundCount[roomCode],
  });

  const bot = getBots(roomCode).find((b) => b.nickname === currentPlayer);
  if (!bot) return;

  const [minMs, maxMs] = botThinkMs(bot.difficulty);
  const think = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  (async () => {
    await wait(think);

    if (!drawFlag[roomCode]) drawFlag[roomCode] = new Set();

    // 1) 드로우 먼저
    const deck = decks[roomCode];
    if (deck && deck.length > 0 && !drawFlag[roomCode].has(bot.nickname)) {
      const ended = serverDraw(roomCode, bot.nickname); // ⬅️ 여기서 끝났는지 확인
      await wait(150);
      if (ended) return; // ✅ 족보/덱소진으로 라운드가 끝났으면 더 하지 않음
    }

    // 2) 그 다음 낼 수 있으면 1장 제출 (최고 카드 선택 + 제출 전 1~5초 랜덤 딜레이)
    const best = pickHighestCardFromHand(roomCode, bot.nickname);
    if (best) {
      const submitDelayMs = Math.floor(Math.random() * (5000 - 500 + 1)) + 1000;
      await wait(submitDelayMs);

      // 대기 중 라운드 종료/턴 변경 되었으면 취소
      if (getCurrentPlayerName(roomCode) !== bot.nickname) {
        console.log(
          `[${new Date().toISOString()}][AI] ${
            bot.nickname
          } 제출 대기 중 턴 변경 감지 → 제출 취소`
        );
        return;
      }

      serverSubmitSingleCard(roomCode, bot.nickname, best);
      return;
    }
  })().catch(console.error);
}

function nextTurn(roomCode: string) {
  const players = getAllPlayers(roomCode);
  if (!players || players.length === 0) return;

  turnIndex[roomCode] = (turnIndex[roomCode] + 1) % players.length;
  drawFlag[roomCode].clear();

  const nextPlayer = players[turnIndex[roomCode]];
  broadcastTurn(roomCode, nextPlayer);

  console.log(
    `[${new Date().toISOString()}][DEBUG nextTurn] 현재 서버 기준 턴 플레이어: ${nextPlayer}`
  );
}

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

app.use(express.json());
// app.use("/auth", authRoutes);

const shuffle = (array: string[]) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// === [AI] 족보 판단 유틸 시작 ===
function _cardToValueN(card: string): number {
  const v = card.replace(/[^0-9JQKA]/g, "");
  if (v === "A") return 1;
  if (v === "J") return 11;
  if (v === "Q") return 12;
  if (v === "K") return 13;
  return parseInt(v, 10);
}

function _isJokboHand(hand: string[]): boolean {
  // GamePage의 족보 체크 로직과 동일하게 맞춤:
  // 6장일 때 스트레이트, 2쌍+2쌍+2쌍, 트리플+트리플, 합 ≤14, 합 ≥65
  if (!hand || hand.length !== 6) return false;

  const values = hand.map(_cardToValueN);

  const isStraight = (() => {
    const sorted = [...values].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i] - sorted[i - 1];
      // 원 코드의 '원형' 스트레이트 허용 로직도 반영
      if ((diff + 13) % 13 !== 1 && diff !== 1) return false;
    }
    return true;
  })();

  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;

  const pairPairPair =
    Object.values(counts).filter((c) => c === 2).length === 3;
  const tripleTriple =
    Object.values(counts).filter((c) => c === 3).length === 2;
  const sum = values.reduce((a, b) => a + b, 0);

  return isStraight || pairPairPair || tripleTriple || sum <= 14 || sum >= 65;
}
// === [AI] 족보 판단 유틸 끝 ===

io.on("connection", (socket) => {
  console.log("새 클라이언트 연결:", socket.id);

  socket.on("join-room", ({ roomCode, nickname, emoji }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
      decks[roomCode] = shuffle(createDeck());
      playerHands[roomCode] = {};
      readyPlayers[roomCode] = new Set();
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();
    }

    if (!emojiMap[roomCode]) emojiMap[roomCode] = {};
    emojiMap[roomCode][nickname] = emoji || "🐶";
    io.to(roomCode).emit("update-emojis", emojiMap[roomCode]);

    if (rooms[roomCode].includes(nickname)) {
      socket.emit("join-error", "중복된 닉네임입니다.");
      return;
    }

    rooms[roomCode].push(nickname);
    socketIdToNickname[socket.id] = nickname;
    socket.join(roomCode);

    io.to(roomCode).emit("update-players", {
      players: rooms[roomCode],
      emojis: emojiMap[roomCode],
    });

    // [AI] 사람/봇 통합 목록도 같이 브로드캐스트 (로비용)
    broadcastPlayerList(roomCode);
  });

  socket.on("start-game", ({ roomCode, nickname, maxPlayers, doubleFinal }) => {
    // [AI-STEP3] 사람+봇 전체 기준으로 변경
    const humans = rooms[roomCode];
    const bots = getBots(roomCode).map((b) => b.nickname);
    const allPlayers = [...(humans || []), ...bots];

    doubleFinalRoundMap[roomCode] = !!doubleFinal;
    drawFlag[roomCode] = new Set();

    console.log("doubleFinal 설정:", doubleFinal);
    console.log("doubleFinalRoundMap:", doubleFinalRoundMap[roomCode]);

    if (!allPlayers || allPlayers.length < 1 || allPlayers.length > 6) {
      socket.emit("join-error", `최대 6명 이하일 때만 시작할 수 있습니다.`);
      return;
    }

    // ✅ 라운드 카운터 초기화
    roundCount[roomCode] = 1;
    console.log(
      `[${new Date().toISOString()}][DEBUG] Game starting in room ${roomCode} with round ${
        roundCount[roomCode]
      }`
    );

    // ✅ 점수 배열 초기화 — 사람+봇 모두
    scores[roomCode] = {};
    for (const n of allPlayers) {
      scores[roomCode][n] = [];
    }

    turnIndex[roomCode] = 0;
    decks[roomCode] = shuffle(createDeck());
    submittedHistory[roomCode] = [];
    drawFlag[roomCode] = new Set();

    // 사람+봇 모두 분배
    for (const n of allPlayers) {
      if (!playerHands[roomCode]) playerHands[roomCode] = {};
      playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
    }

    // ✅ 남은 카드 수 전송
    io.to(roomCode).emit("deck-update", { remaining: decks[roomCode].length });

    // ✅ 게임 시작 이벤트 발송
    io.to(roomCode).emit("game-started", {
      roomCode,
      round: roundCount[roomCode],
    });

    const randomPlayer =
      allPlayers[Math.floor(Math.random() * allPlayers.length)];
    turnIndex[roomCode] = allPlayers.indexOf(randomPlayer);
    const currentPlayer = allPlayers[turnIndex[roomCode]];
    console.log(
      `[${new Date().toISOString()}][DEBUG start-game] 현재 서버 기준 턴 플레이어: ${currentPlayer}`
    );

    // [AI-STEP3] 단일화된 브로드캐스트
    broadcastTurn(roomCode, currentPlayer);
  });

  socket.on("ready-next-round", ({ roomCode, nickname }) => {
    if (!readyForNextRound[roomCode]) {
      readyForNextRound[roomCode] = new Set();
    }

    readyForNextRound[roomCode].add(nickname);
    drawFlag[roomCode] = new Set();

    console.log(
      `[${new Date().toISOString()}][DEBUG] ${nickname} is ready for next round in ${roomCode}`
    );
    console.log(
      `[${new Date().toISOString()}][DEBUG] Ready count: ${
        readyForNextRound[roomCode].size
      }`
    );
    console.log(
      `[${new Date().toISOString()}][DEBUG] Total players: ${
        rooms[roomCode]?.length
      }`
    );

    io.to(roomCode).emit(
      "update-ready",
      Array.from(readyForNextRound[roomCode])
    );

    // ✅ 중복 라운드 시작 방지 (사람들 기준)
    if (
      readyForNextRound[roomCode].size === rooms[roomCode]?.length &&
      roundCount[roomCode] <= 5 &&
      !roundInProgress[roomCode]
    ) {
      console.log("[DEBUG] All players ready. Advancing round.");

      roundInProgress[roomCode] = true;
      readyForNextRound[roomCode].clear();

      // ✅ 라운드 수 증가
      roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;

      // 라운드 준비
      turnIndex[roomCode] = 0;
      decks[roomCode] = shuffle(createDeck());
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();

      // [AI-STEP3] 사람+봇 전체 목록
      const humans = rooms[roomCode] || [];
      const bots = getBots(roomCode).map((b) => b.nickname);
      const players = [...humans, ...bots];

      // 분배
      for (const n of players) {
        playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
      }
      io.to(roomCode).emit("deck-update", {
        remaining: decks[roomCode].length,
      });

      // 시작 플레이어 결정
      let firstPlayer = players[0]; // fallback

      if (roundCount[roomCode] === 1) {
        // 🎲 첫 라운드는 무작위
        firstPlayer = players[Math.floor(Math.random() * players.length)];
        console.log("[DEBUG] 1라운드 랜덤 시작 플레이어:", firstPlayer);
      } else {
        // 🧮 2라운드부터는 최저 점수 플레이어
        const lastRoundScores = scores[roomCode];
        const validScores = Object.entries(lastRoundScores)
          .filter(([_, rounds]) => rounds.length > 0)
          .map(([nickname, rounds]) => ({
            nickname,
            score: rounds[rounds.length - 1],
          }));

        if (validScores.length > 0) {
          validScores.sort((a, b) => a.score - b.score);
          firstPlayer = validScores[0].nickname;
          console.log("[DEBUG] 최저 점수 시작 플레이어:", firstPlayer);
        }
      }

      // ✅ turnIndex 지정
      turnIndex[roomCode] = players.indexOf(firstPlayer);
      if (turnIndex[roomCode] === -1) {
        console.warn("[WARN] firstPlayer not found in players. fallback to 0");
        turnIndex[roomCode] = 0;
        firstPlayer = players[0];
      }

      console.log("[DEBUG] next round 시작 플레이어:", firstPlayer);

      io.to(roomCode).emit("next-round", { round: roundCount[roomCode] });

      // [AI-STEP3]
      broadcastTurn(roomCode, firstPlayer);
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

  socket.on("stop", ({ roomCode, stopper, hand }) => {
    console.log(
      `[${new Date().toISOString()}][DEBUG] stop 이벤트 수신 | roomCode: ${roomCode}, stopper: ${stopper}`
    );

    if (!playerHands[roomCode]) playerHands[roomCode] = {};
    playerHands[roomCode][stopper] = hand;

    const hands = playerHands[roomCode];
    const scoresThisRound = calculateScores("stop", stopper, hands, roomCode);

    console.log("[DEBUG] 계산된 점수:", scoresThisRound);

    // 점수 누적
    for (const [nickname, score] of Object.entries(scoresThisRound)) {
      scores[roomCode][nickname].push(score);
    }

    roundResults[roomCode] = {
      scores: scoresThisRound,
      hands,
      reason: "stop",
      stopper,
    };

    roundInProgress[roomCode] = false;

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

    roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;
    turnIndex[roomCode] = 0;
    decks[roomCode] = shuffle(createDeck());
    submittedHistory[roomCode] = [];
    drawFlag[roomCode] = new Set();

    // [AI-STEP3] 사람+봇 전체
    const humans = rooms[roomCode] || [];
    const bots = getBots(roomCode).map((b) => b.nickname);
    const players = [...humans, ...bots];

    for (const n of players) {
      if (!playerHands[roomCode]) playerHands[roomCode] = {};
      playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
    }

    // ✅ 남은 카드 수 전송
    io.to(roomCode).emit("deck-update", { remaining: decks[roomCode].length });
    io.to(roomCode).emit("game-started", {
      roomCode,
      round: roundCount[roomCode],
    });

    setTimeout(() => {
      const firstPlayer = players[0];
      // [AI-STEP3]
      broadcastTurn(roomCode, firstPlayer);
    }, 500);
  });

  socket.on("ready", ({ roomCode, nickname }) => {
    if (!readyPlayers[roomCode]) readyPlayers[roomCode] = new Set();
    readyPlayers[roomCode].add(nickname);

    if (readyPlayers[roomCode].size === (rooms[roomCode]?.length || 0)) {
      // [AI-STEP3] 첫 턴도 전체 리스트 기준
      const playersAll = getAllPlayers(roomCode);
      turnIndex[roomCode] = 0;
      const firstPlayer = playersAll[0] || nickname;
      io.to(roomCode).emit("ready-ok");
      broadcastTurn(roomCode, firstPlayer);
      console.log(
        `[${new Date().toISOString()}][DEBUG ready] 현재 서버 기준 턴 플레이어: ${firstPlayer}`
      );
    }
  });

  socket.on("draw-card", ({ roomCode }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    // [AI-STEP3] 현재 턴 플레이어 계산(사람+봇)
    const allPlayers = getAllPlayers(roomCode);
    const currentPlayer = allPlayers?.[turnIndex[roomCode]];

    console.log(
      `[DEBUG draw-card] 현재 서버 기준 턴 플레이어: ${currentPlayer}`
    );
    console.log(`[DEBUG] 드로우 요청 보낸 플레이어: ${nickname}`);

    if (nickname !== currentPlayer) {
      console.log(
        `[${new Date().toISOString()}][BLOCKED] ${nickname} tried to draw, but it's not their turn.`
      );
      return;
    }

    if (drawFlag[roomCode].has(nickname)) {
      console.log(
        `[${new Date().toISOString()}][BLOCKED] ${nickname} already drew a card.`
      );
      return;
    }

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
      roundInProgress[roomCode] = false;

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

      roundResults[roomCode] = {
        scores: scoresThisRound,
        hands,
        reason: "bbung-end",
      };
      roundInProgress[roomCode] = false;

      io.to(roomCode).emit("round-ended", {
        reason: "bbung-end",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
        triggerer: bbungEndTriggeredBy[roomCode], // ✅ 이 줄 추가!
      });
    }
    io.to(roomCode).emit("bbung-effect", {
      nickname: socketIdToNickname[socket.id],
    });

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

      roundResults[roomCode] = {
        scores: scoresThisRound,
        hands,
        reason: "bbung-end",
      };
      roundInProgress[roomCode] = false;

      io.to(roomCode).emit("round-ended", {
        reason: "bbung-end",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
        triggerer: bbungEndTriggeredBy[roomCode],
      });
    } else {
      // [AI-STEP3] 다음 플레이어 계산도 전체 기준
      const players = getAllPlayers(roomCode);
      const bbungIdx = players.indexOf(nickname);
      const nextIdx = (bbungIdx + 1) % players.length;
      turnIndex[roomCode] = nextIdx;
      drawFlag[roomCode].clear();
      const nextPlayer = players[nextIdx];

      broadcastTurn(roomCode, nextPlayer);
      console.log(
        `[${new Date().toISOString()}][DEBUG submit-bbung-extra] 현재 서버 기준 턴 플레이어: ${nextPlayer}`
      );
    }
  });

  socket.on("hand-empty", ({ roomCode }) => {
    roundInProgress[roomCode] = false;

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

    // ✅ 결과 저장
    roundResults[roomCode] = {
      scores: roundScore,
      hands,
      reason,
      stopper,
    };
    roundInProgress[roomCode] = false;

    io.to(roomCode).emit("round-ended", {
      reason,
      stopper,
      allPlayerHands: playerHands[roomCode],
      round: roundCount[roomCode],
    });
  });

  socket.on("get-player-emojis", ({ roomCode }, callback) => {
    const map = emojiMap[roomCode] || {};
    callback(map);
  });

  // [AI] 현재(사람+봇) 플레이어 목록 요청 → player-list 브로드캐스트
  socket.on("request-player-list", ({ roomCode }: { roomCode: string }) => {
    broadcastPlayerList(roomCode);
  });

  // [AI] 로비에서 AI(봇) 추가
  socket.on(
    "add-bot",
    ({
      roomCode,
      difficulty,
    }: {
      roomCode: string;
      difficulty?: Difficulty;
    }) => {
      const d: Difficulty = difficulty || "easy";

      // 인원 제한(사람+봇 합산) — 최대 6명
      const totalCount =
        (rooms[roomCode]?.length || 0) + getBots(roomCode).length;
      if (totalCount >= 6) {
        socket.emit("error-message", {
          message: "최대 인원(6명)을 초과할 수 없습니다.",
        });
        return;
      }

      // 닉네임 중복 회피: AI-1, AI-2, ...
      const existing = new Set<string>([
        ...(rooms[roomCode] || []),
        ...getBots(roomCode).map((b) => b.nickname),
      ]);
      let idx = 1;
      let nickname = `AI-${idx}`;
      while (existing.has(nickname)) {
        idx += 1;
        nickname = `AI-${idx}`;
      }

      // 방 구조 초기화(손패 등)
      addBot(roomCode, { nickname, difficulty: d });
      if (!playerHands[roomCode]) playerHands[roomCode] = {};
      playerHands[roomCode][nickname] = [];

      // 알림 & 목록 갱신
      io.to(roomCode).emit("player-joined", {
        nickname,
        isBot: true,
        difficulty: d,
      });
      broadcastPlayerList(roomCode);

      // (선택) 이모지도 붙이고 싶다면:
      if (!emojiMap[roomCode]) emojiMap[roomCode] = {};
      if (!emojiMap[roomCode][nickname]) {
        emojiMap[roomCode][nickname] = "🤖"; // 기본 봇 이모지
        io.to(roomCode).emit("update-emojis", emojiMap[roomCode]);
      }
    }
  );

  // [AI] 로비에서 AI(봇) 제거
  socket.on(
    "remove-bot",
    ({ roomCode, nickname }: { roomCode: string; nickname: string }) => {
      const found = getBots(roomCode).some((b) => b.nickname === nickname);
      if (!found) return;

      removeBot(roomCode, nickname);
      if (playerHands[roomCode]) delete playerHands[roomCode][nickname];

      io.to(roomCode).emit("player-left", { nickname });
      broadcastPlayerList(roomCode);

      // (선택) 이모지 정리
      if (emojiMap[roomCode] && emojiMap[roomCode][nickname]) {
        delete emojiMap[roomCode][nickname];
        io.to(roomCode).emit("update-emojis", emojiMap[roomCode]);
      }
    }
  );

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

      io.to(roomCode).emit("update-players", {
        players: rooms[roomCode],
        emojis: emojiMap[roomCode],
      });

      // [AI] 사람/봇 통합 목록 재브로드캐스트
      broadcastPlayerList(roomCode);
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
  roomCode: string
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

    if (hand.length === 3 && values.every((v) => v === values[0])) {
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
      console.log(
        `[${new Date().toISOString()}][DEBUG] ${rewardPlayer} 에게 +30점 보상`
      );
    } else {
      console.log("[DEBUG] 유도자 없음 — 점수 보상 생략됨");
    }
  }

  console.log(
    `[DEBUG] 점수 계산 시작 — reason: ${reason}, roomCode: ${roomCode}`
  );
  console.log(`[DEBUG] 현재 roundCount[${roomCode}] = ${roundCount[roomCode]}`);
  console.log(
    `[DEBUG] doubleFinalRoundMap[${roomCode}] = ${doubleFinalRoundMap[roomCode]}`
  );

  // ✅ 마지막 라운드 점수 2배 처리
  if (roomCode && roundCount[roomCode] === 5 && doubleFinalRoundMap[roomCode]) {
    console.log("[DEBUG] 마지막 라운드 조건 충족 — 점수 2배 적용");
    for (const p of Object.keys(scores)) {
      const original = scores[p];
      const doubled = typeof original === "number" ? original * 2 : 0;
      scores[p] = doubled;
      console.log(`[DEBUG] ${p} 점수 2배 적용: ${original} -> ${doubled}`);
    }
  } else {
    console.log("[DEBUG] 마지막 라운드 조건 불충분 — 점수 2배 적용 안됨");
  }

  // 점수 반환
  return scores;
}
