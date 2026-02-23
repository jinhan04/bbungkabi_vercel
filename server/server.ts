import express, { Router } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  conn: (msg: string) => console.log(`\x1b[32m[CONN]\x1b[0m ${msg}`),
  room: (msg: string) => console.log(`\x1b[33m[ROOM]\x1b[0m ${msg}`),
  game: (msg: string) => console.log(`\x1b[35m[GAME]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[31m[WARN]\x1b[0m ${msg}`),
  debug: (msg: string) => console.log(`\x1b[90m[DEBUG]\x1b[0m ${msg}`),
};

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
const bbungEndTriggeredBy: { [roomCode: string]: string | null } = {};
const emojiMap: { [roomCode: string]: { [nickname: string]: string } } = {};
const gameEndProcessed: { [key: string]: boolean } = {};
const turnTimeMap: { [roomCode: string]: number } = {};
const uhbbungMap: { [roomCode: string]: boolean } = {};
const penaltyScores: { [roomCode: string]: { [nickname: string]: number } } =
  {};
const maxRoundMap: { [roomCode: string]: number } = {};
const lastTimeoutMap: { [roomCode: string]: number } = {};

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
type PlayerInfo = { name: string; isBot: boolean };
type RoomOptions = {
  rounds: number;
  doubleFinal: boolean;
  uhbbungEnabled: boolean;
};
type RoundRuntime = {
  tempScores: Record<string, number>;
  lastUhbbungAt: Record<string, number>;
};
type RoomState = {
  players: PlayerInfo[];
  deck: string[];
  hands: Record<string, string[]>;
  turnIndex: number;
  ready: Set<string>;
  drawFlag: Set<string>;
  roundCount: number;
  options: RoomOptions;
  scores: Record<string, number>;
  runtime: RoundRuntime;
  lastRoundResult?: {
    reason: string;
    stopper?: string | null;
    perRound: Record<string, number>;
    totalScores: Record<string, number>;
    round: number;
  };
};

const roomStates: Record<string, RoomState> = {};

const BOT_NAME_POOL = [
  "블러프킹",
  "포커여우",
  "하트여왕",
  "스페이드마법사",
  "뻥요정",
  "카드요정",
  "대충내봇",
  "정직한봇",
  "모찌고래",
  "라떼호랑이",
  "초코칩",
  "수달선생",
  "딜러토끼",
  "고수인척",
  "병장 임진한",
  "상병 임진한",
  "일병 임진한",
  "이병 임진한",
  "말수적은봇",
  "옥교수님",
];

const BOT_ADJ = [
  "용감한",
  "수줍은",
  "재빠른",
  "뻔뻔한",
  "낙관적인",
  "도발적인",
  "진지한",
  "달콤한",
  "시끄러운",
  "느긋한",
];
const BOT_ANIMAL = [
  "여우",
  "늑대",
  "토끼",
  "고양이",
  "곰",
  "판다",
  "수달",
  "참새",
  "돌고래",
  "너구리",
  "두더지",
  "다람쥐",
  "펭귄",
  "부엉이",
];
const BOT_SUFFIX = [
  "장인",
  "고수",
  "선배",
  "주니어",
  "마스터",
  "스페셜",
  "프로",
  "초보",
];

function generateBotNickname(roomCode: string): string {
  const existing = new Set<string>([
    ...(rooms[roomCode] || []),
    ...getBots(roomCode).map((b) => b.nickname),
  ]);

  const available = BOT_NAME_POOL.filter((n) => !existing.has(n));
  if (available.length > 0) return pick(available);

  for (let i = 0; i < 300; i++) {
    const base = `${pick(BOT_ADJ)} ${pick(BOT_ANIMAL)}`;
    const name = chance(0.5) ? `${base} ${pick(BOT_SUFFIX)}` : base;
    if (!existing.has(name)) return name;
  }

  for (let i = 0; i < 300; i++) {
    const name = `${pick(BOT_ADJ)} ${pick(BOT_ANIMAL)} ${pick(BOT_SUFFIX)} ${pick(BOT_SUFFIX)}`;
    if (!existing.has(name)) return name;
  }

  return "이름없는봇";
}

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
    (b) => b.nickname !== nickname,
  );
}

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

function getAllPlayers(roomCode: string): string[] {
  const humans = rooms[roomCode] || [];
  const bots = getBots(roomCode).map((b) => b.nickname);
  return [...humans, ...bots];
}

function serverSubmitSingleCard(
  roomCode: string,
  nickname: string,
  card: string,
) {
  if (!playerHands[roomCode] || !playerHands[roomCode][nickname]) return;
  const idx = playerHands[roomCode][nickname].indexOf(card);
  if (idx === -1) return;
  playerHands[roomCode][nickname].splice(idx, 1);
  submittedHistory[roomCode].push({ nickname, card });
  io.to(roomCode).emit("card-submitted", { nickname, card });

  const bot = getBotInfo(roomCode, nickname);
  if (bot && canChat(roomCode, nickname) && chance(CHAT_CHANCE.submit)) {
    botSay(roomCode, nickname, pick(BOT_CHAT_LINES.submit));
  }

  void maybeBotBbung(roomCode);
  nextTurn(roomCode);
}

function serverStop(roomCode: string, stopper: string) {
  const hands = playerHands[roomCode] || {};
  const scoresThisRound = calculateScores("stop", stopper, hands, roomCode);

  for (const [n, s] of Object.entries(scoresThisRound)) {
    if (!scores[roomCode][n]) scores[roomCode][n] = [];
    scores[roomCode][n].push(s);
  }

  roundResults[roomCode] = {
    scores: scoresThisRound,
    hands,
    reason: "stop",
    stopper,
  };
  roundInProgress[roomCode] = false;

  io.to(roomCode).emit("round-ended", {
    reason: "stop",
    stopper,
    allPlayerHands: playerHands[roomCode],
    round: roundCount[roomCode],
  });
}

// 💡 수정됨: 봇 스탑 규칙 (버그 1, 5 해결)
function shouldBotStop(roomCode: string, bot: BotInfo): boolean {
  // 1. 드로우를 이미 했다면 절대 스탑 불가
  if (drawFlag[roomCode]?.has(bot.nickname)) return false;

  const hand = playerHands[roomCode]?.[bot.nickname] || [];

  // 2. 손패가 정확히 5장 또는 2장일 때만 스탑 가능
  if (hand.length !== 5 && hand.length !== 2) return false;

  const score = _handScoreForDecision(hand);
  const deckLeft = decks[roomCode]?.length ?? 0;

  let threshold = 16;
  if (bot.difficulty === "easy") threshold = 20;
  if (bot.difficulty === "hard") threshold = 12;

  if (deckLeft <= 10) threshold += 2;
  const jitter = Math.floor(Math.random() * 5) - 2;
  threshold += jitter;

  return score <= threshold;
}

function serverDraw(roomCode: string, nickname: string): boolean {
  const deck = decks[roomCode];
  if (!deck || deck.length === 0) return false;

  const card = deck.shift();
  if (card) {
    if (!playerHands[roomCode]) playerHands[roomCode] = {};
    if (!playerHands[roomCode][nickname]) playerHands[roomCode][nickname] = [];
    playerHands[roomCode][nickname].push(card);
    io.to(roomCode).emit("player-drawn", { nickname });
  }

  io.to(roomCode).emit("deck-update", { remaining: deck.length });

  const isBot = getBots(roomCode).some((b) => b.nickname === nickname);
  if (isBot) {
    const hand = playerHands[roomCode]?.[nickname] || [];
    if (_isJokboHand(hand)) {
      console.log(
        `[${new Date().toISOString()}][AI] ${nickname} 족보 완성 → 라운드 즉시 종료`,
      );
      const hands = playerHands[roomCode];
      const scoresThisRound = calculateScores(
        "족보 완성",
        null,
        hands,
        roomCode,
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
      return true;
    }
  }

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

function getLegalSingles(roomCode: string, nickname: string): string[] {
  return [...(playerHands[roomCode]?.[nickname] || [])];
}

function botThinkMs(diff: Difficulty): [number, number] {
  if (diff === "hard") return [800, 1500];
  if (diff === "normal") return [600, 1200];
  return [400, 900];
}
function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function chance(p: number) {
  return Math.random() < p;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function now() {
  return Date.now();
}

const nextBotChatAt: { [room: string]: { [nick: string]: number } } = {};

const BOT_CHAT_LINES = {
  draw: [
    "한 장 믿고 간다.",
    "느낌 왔다.",
    "덱 냄새가… 수상해 😑",
    "제발 좋은 거!",
    "아 덜덜…",
  ],
  submit: [
    "이거나 먹어라.",
    "가볍게 한 장~",
    "정리하고 갑니다.",
    "버리자 버려!",
    "고오급 카드 방출 🫠",
  ],
  bbung: ["뻥!", "BBUNG! 🔥", "같은 숫자 둘~", "이건 못 참지 ㅋㅋ", "빠빠빵~"],
  bbung_extra: ["덤 하나 얹어줄게.", "서비스 한 장 ^^", "보너스~"],
  taunt: [
    "그 숫자 계속 낼 수 있어? 🤭",
    "덱 다 태웠네?",
    "이제부터 시작이지?",
    "내가 유도한 거 알지? ㅎㅎ",
    "집중 좀 해봐~",
    "빨리 좀 해라!!!",
  ],
};

function resetChatCooldown(roomCode: string, nickname: string) {
  const min = 8000,
    max = 14000;
  const next = now() + Math.floor(Math.random() * (max - min + 1)) + min;
  nextBotChatAt[roomCode] ||= {};
  nextBotChatAt[roomCode][nickname] = next;
}
function canChat(roomCode: string, nickname: string) {
  const nextAt = nextBotChatAt[roomCode]?.[nickname] ?? 0;
  return now() >= nextAt;
}

function botSay(roomCode: string, nickname: string, text: string) {
  io.to(roomCode).emit("chat-message", { nickname, message: text });
  resetChatCooldown(roomCode, nickname);
}

const CHAT_CHANCE = {
  draw: 0.05,
  submit: 0.05,
  bbung: 0.3,
  bbung_extra: 0.1,
  taunt: 0.05,
};

function getBotInfo(roomCode: string, nickname: string) {
  return getBots(roomCode).find((b) => b.nickname === nickname);
}

function _numStr(card: string): string {
  return card.replace(/[^0-9JQKA]/g, "");
}
function _pickTwoSameNumber(hand: string[], numStr: string): string[] | null {
  const m = hand.filter((c) => _numStr(c) === numStr);
  return m.length >= 2 ? [m[0], m[1]] : null;
}
function _pickHighestCard(roomCode: string, nickname: string): string | null {
  const hand = playerHands[roomCode]?.[nickname] || [];
  if (!hand.length) return null;
  const val = (c: string) => {
    const v = _numStr(c);
    if (v === "A") return 1;
    if (v === "J") return 11;
    if (v === "Q") return 12;
    if (v === "K") return 13;
    return parseInt(v, 10);
  };
  return hand.reduce(
    (best, cur) => (val(cur) > val(best) ? cur : best),
    hand[0],
  );
}

function serverSubmitBbung(
  roomCode: string,
  nickname: string,
  cards: string[],
) {
  if (!cards || cards.length !== 2) return;
  if (drawFlag[roomCode]?.has(nickname)) return;
  const nums = cards.map(_numStr);
  if (nums[0] !== nums[1]) return;

  const last = submittedHistory[roomCode].at(-1);
  const lastNum = last?.card ? _numStr(last.card) : null;
  if (!lastNum || lastNum !== nums[0]) return;
  if (last?.nickname === nickname) return;

  for (const card of cards) {
    const idx = playerHands[roomCode][nickname].indexOf(card);
    if (idx === -1) return;
    playerHands[roomCode][nickname].splice(idx, 1);
    submittedHistory[roomCode].push({ nickname, card });
    io.to(roomCode).emit("card-submitted", { nickname, card });
  }

  io.to(roomCode).emit("bbung-effect", { nickname });

  if (playerHands[roomCode][nickname].length === 0) {
    const back3 = submittedHistory[roomCode].at(-3);
    const bbungNumber = _numStr(cards[0]);
    if (
      back3 &&
      back3.nickname !== nickname &&
      _numStr(back3.card) === bbungNumber
    ) {
      bbungEndTriggeredBy[roomCode] = back3.nickname;
    }

    const hands = playerHands[roomCode];
    const scoresThisRound = calculateScores("bbung-end", null, hands, roomCode);
    for (const [n, s] of Object.entries(scoresThisRound)) {
      scores[roomCode][n].push(s);
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
  }
}

function serverSubmitBbungExtra(
  roomCode: string,
  nickname: string,
  card: string,
) {
  const idx = playerHands[roomCode][nickname].indexOf(card);
  if (idx !== -1) {
    playerHands[roomCode][nickname].splice(idx, 1);
    submittedHistory[roomCode].push({ nickname, card });
    io.to(roomCode).emit("card-submitted", { nickname, card });
  }

  if (playerHands[roomCode][nickname].length === 0) {
    const last = submittedHistory[roomCode].at(-1);
    if (last) bbungEndTriggeredBy[roomCode] = last.nickname;

    const hands = playerHands[roomCode];
    const scoresThisRound = calculateScores("bbung-end", null, hands, roomCode);
    for (const [n, s] of Object.entries(scoresThisRound)) {
      scores[roomCode][n].push(s);
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
    const players = getAllPlayers(roomCode);
    const i = players.indexOf(nickname);
    const nextIdx = (i + 1) % players.length;
    turnIndex[roomCode] = nextIdx;
    drawFlag[roomCode].clear();
    const nextPlayer = players[nextIdx];
    broadcastTurn(roomCode, nextPlayer);
  }
}

async function maybeBotBbung(roomCode: string) {
  const last = submittedHistory[roomCode].at(-1);
  if (!last) return;

  const lastNum = _numStr(last.card);
  const bots = getBots(roomCode);
  if (!bots.length) return;

  for (const bot of bots) {
    if (bot.nickname === last.nickname) continue;
    if (drawFlag[roomCode]?.has(bot.nickname)) continue;

    const hand = playerHands[roomCode]?.[bot.nickname] || [];
    const pair = _pickTwoSameNumber(hand, lastNum);
    if (!pair) continue;

    const [minMs, maxMs] =
      bot.difficulty === "hard"
        ? [250, 700]
        : bot.difficulty === "normal"
          ? [400, 900]
          : [600, 1200];
    const waitMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await wait(waitMs);

    const still = submittedHistory[roomCode].at(-1);
    if (!still || _numStr(still.card) !== lastNum) continue;
    if (still.nickname === bot.nickname) continue;

    serverSubmitBbung(roomCode, bot.nickname, pair);

    if (canChat(roomCode, bot.nickname) && chance(CHAT_CHANCE.bbung)) {
      botSay(roomCode, bot.nickname, pick(BOT_CHAT_LINES.bbung));
    }

    if (!roundInProgress[roomCode]) return;

    const extraDelay = Math.floor(Math.random() * 500) + 300;
    await wait(extraDelay);

    const extra = _pickHighestCard(roomCode, bot.nickname);
    if (extra) {
      serverSubmitBbungExtra(roomCode, bot.nickname, extra);
    }
    return;
  }
}

function getCurrentPlayerName(roomCode: string): string | undefined {
  const players = getAllPlayers(roomCode);
  if (!players || players.length === 0) return undefined;
  return players[turnIndex[roomCode]];
}

function pickHighestCardFromHand(
  roomCode: string,
  nickname: string,
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

function _handScoreForDecision(hand: string[]): number {
  const cardToValueN = (card: string) => _cardToValueN(card);
  const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);

  const isStraight = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (
        (sorted[i] - sorted[i - 1] + 13) % 13 !== 1 &&
        sorted[i] - sorted[i - 1] !== 1
      )
        return false;
    }
    return true;
  };

  const isPairPairPair = (values: number[]) => {
    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    return Object.values(counts).filter((c) => c === 2).length === 3;
  };

  const isTripleTriple = (values: number[]) => {
    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    return Object.values(counts).filter((c) => c === 3).length === 2;
  };

  if (hand.length === 0) return 0;

  const values = hand.map(cardToValueN);
  const total = sum(values);

  if (hand.length === 6) {
    if (isStraight(values)) return -total;
    if (isPairPairPair(values)) return 0;
    if (isTripleTriple(values)) return 0;
    if (total <= 14) return -100;
    if (total >= 65) return -total;
    return total;
  }

  if (hand.length === 3 && values.every((v) => v === values[0])) return 0;

  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const tripleKey = Object.keys(counts).find((k) => counts[parseInt(k)] === 3);
  if (tripleKey && Object.values(counts).filter((c) => c === 3).length === 1) {
    const v = parseInt(tripleKey);
    const rest = values.filter((x) => x !== v);
    return sum(rest);
  }

  return total;
}

function broadcastTurn(roomCode: string, currentPlayer: string) {
  io.to(roomCode).emit("turn-info", {
    currentPlayer,
    round: roundCount[roomCode],
    turnTime: turnTimeMap[roomCode] || 10,
  });

  const bot = getBots(roomCode).find((b) => b.nickname === currentPlayer);
  if (!bot) return;

  const [minMs, maxMs] = botThinkMs(bot.difficulty);
  const think = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  (async () => {
    await wait(think);

    if (getCurrentPlayerName(roomCode) !== bot.nickname) return;
    if (!roundInProgress[roomCode]) return;

    if (shouldBotStop(roomCode, bot)) {
      serverStop(roomCode, bot.nickname);
      try {
        if (typeof canChat === "function" && canChat(roomCode, bot.nickname)) {
          const line = "스탑! 여기서 승부 보자 😎";
          if (typeof botSay === "function")
            botSay(roomCode, bot.nickname, line);
        }
      } catch {}
      return;
    }

    if (!drawFlag[roomCode]) drawFlag[roomCode] = new Set();

    const deck = decks[roomCode];
    if (deck && deck.length > 0 && !drawFlag[roomCode].has(bot.nickname)) {
      drawFlag[roomCode].add(bot.nickname);

      const ended = serverDraw(roomCode, bot.nickname);
      if (canChat(roomCode, bot.nickname) && chance(CHAT_CHANCE.draw)) {
        botSay(roomCode, bot.nickname, pick(BOT_CHAT_LINES.draw));
      }
      await wait(150);
      if (ended) return;
    }

    const best = pickHighestCardFromHand(roomCode, bot.nickname);
    if (best) {
      const submitDelayMs = Math.floor(Math.random() * (3000 - 500 + 1)) + 1000;
      await wait(submitDelayMs);

      if (getCurrentPlayerName(roomCode) !== bot.nickname) return;
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

const shuffle = (array: string[]) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function _cardToValueN(card: string): number {
  const v = card.replace(/[^0-9JQKA]/g, "");
  if (v === "A") return 1;
  if (v === "J") return 11;
  if (v === "Q") return 12;
  if (v === "K") return 13;
  return parseInt(v, 10);
}

function _isJokboHand(hand: string[]): boolean {
  if (!hand || hand.length !== 6) return false;
  const values = hand.map(_cardToValueN);

  const isStraight = (() => {
    const sorted = [...values].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i] - sorted[i - 1];
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

io.on("connection", (socket) => {
  log.conn(`새 클라이언트 접속: ${socket.id}`);

  socket.on("request-user-info", async ({ nickname }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { kakaoId: nickname },
      });
      if (user) {
        socket.emit("user-info", {
          coin: user.coin,
          tier: user.tier,
          wins: user.wins,
          losses: user.losses,
        });
      }
    } catch (error) {
      log.warn(`[DB 에러] 정보 요청 실패: ${error}`);
    }
  });

  socket.on("join-room", async ({ roomCode, nickname, emoji }) => {
    try {
      let user = await prisma.user.findUnique({ where: { kakaoId: nickname } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            kakaoId: nickname,
            nickname: nickname,
            coin: 1000,
            tier: "Bronze",
            wins: 0,
            losses: 0,
          },
        });
        log.info(`[DB] 신규 유저 생성: ${nickname}`);
      }

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
        if (socketIdToNickname[socket.id] !== nickname) {
          socket.emit("join-error", "중복된 닉네임입니다.");
          return;
        }
      } else {
        rooms[roomCode].push(nickname);
      }

      socketIdToNickname[socket.id] = nickname;
      socket.join(roomCode);

      io.to(roomCode).emit("update-players", {
        players: rooms[roomCode],
        emojis: emojiMap[roomCode],
      });
      broadcastPlayerList(roomCode);

      socket.emit("user-info", {
        coin: user.coin,
        tier: user.tier,
        wins: user.wins,
        losses: user.losses,
      });
    } catch (error) {
      log.warn(`[DB 에러] 유저 처리 중 오류 발생: ${error}`);
      socket.emit("join-error", "데이터베이스 연결에 실패했습니다.");
    }
  });

  socket.on(
    "start-game",
    ({
      roomCode,
      nickname,
      maxPlayers,
      doubleFinal,
      uhbbung,
      turnTime,
      maxRounds,
    }) => {
      log.room(`[${roomCode}] 게임 시작! (라운드: 1)`);
      const humans = rooms[roomCode];
      const bots = getBots(roomCode).map((b) => b.nickname);
      const allPlayers = [...(humans || []), ...bots];

      gameEndProcessed[roomCode] = false;
      doubleFinalRoundMap[roomCode] = !!doubleFinal;

      uhbbungMap[roomCode] = !!uhbbung;
      turnTimeMap[roomCode] = turnTime || 10;
      maxRoundMap[roomCode] = maxRounds || 5;
      penaltyScores[roomCode] = {};
      for (const n of allPlayers) penaltyScores[roomCode][n] = 0;

      drawFlag[roomCode] = new Set();

      if (!allPlayers || allPlayers.length < 1 || allPlayers.length > 6) {
        socket.emit("join-error", `최대 6명 이하일 때만 시작할 수 있습니다.`);
        return;
      }

      roundCount[roomCode] = 1;
      roundInProgress[roomCode] = true;
      scores[roomCode] = {};
      for (const n of allPlayers) {
        scores[roomCode][n] = [];
      }

      turnIndex[roomCode] = 0;
      decks[roomCode] = shuffle(createDeck());
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();

      for (const n of allPlayers) {
        if (!playerHands[roomCode]) playerHands[roomCode] = {};
        playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
      }

      io.to(roomCode).emit("deck-update", {
        remaining: decks[roomCode].length,
      });
      io.to(roomCode).emit("game-started", {
        roomCode,
        round: roundCount[roomCode],
      });

      // 💡 수정됨: 첫 라운드는 완전 랜덤 플레이어 시작
      const randomPlayer =
        allPlayers[Math.floor(Math.random() * allPlayers.length)];
      turnIndex[roomCode] = allPlayers.indexOf(randomPlayer);
      const currentPlayer = allPlayers[turnIndex[roomCode]];

      broadcastTurn(roomCode, currentPlayer);
    },
  );

  socket.on("ready-next-round", ({ roomCode, nickname }) => {
    if (!readyForNextRound[roomCode]) readyForNextRound[roomCode] = new Set();

    readyForNextRound[roomCode].add(nickname);
    drawFlag[roomCode] = new Set();

    io.to(roomCode).emit(
      "update-ready",
      Array.from(readyForNextRound[roomCode]),
    );

    if (
      readyForNextRound[roomCode].size === rooms[roomCode]?.length &&
      roundCount[roomCode] < (maxRoundMap[roomCode] || 5) &&
      !roundInProgress[roomCode]
    ) {
      roundInProgress[roomCode] = true;
      readyForNextRound[roomCode].clear();

      roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;
      decks[roomCode] = shuffle(createDeck());
      submittedHistory[roomCode] = [];
      drawFlag[roomCode] = new Set();

      const humans = rooms[roomCode] || [];
      const bots = getBots(roomCode).map((b) => b.nickname);
      const players = [...humans, ...bots];

      penaltyScores[roomCode] = {};
      for (const n of players) penaltyScores[roomCode][n] = 0;

      for (const n of players) {
        playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
      }
      io.to(roomCode).emit("deck-update", {
        remaining: decks[roomCode].length,
      });

      // 💡 수정됨: 2라운드부터는 이전 라운드 점수가 가장 낮은 사람 찾기 (버그 2 해결)
      let firstPlayer = players[0];

      const lastRoundScores = scores[roomCode];
      // 현재 방에 남아있는 플레이어들의 직전 라운드 점수만 추출
      const validScores = players.map((p) => {
        const rScores = lastRoundScores[p] || [];
        const lastScore = rScores.length > 0 ? rScores[rScores.length - 1] : 0;
        return { nickname: p, score: lastScore };
      });

      // 가장 점수가 낮은 사람(오름차순) 정렬
      validScores.sort((a, b) => a.score - b.score);
      firstPlayer = validScores[0].nickname;
      console.log(
        `[DEBUG] ${roundCount[roomCode]}라운드 최저 점수 시작 플레이어:`,
        firstPlayer,
      );

      turnIndex[roomCode] = players.indexOf(firstPlayer);
      if (turnIndex[roomCode] === -1) {
        turnIndex[roomCode] = 0;
        firstPlayer = players[0];
      }

      io.to(roomCode).emit("next-round", { round: roundCount[roomCode] });
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
    log.game(`[${roomCode}] ✋ ${stopper} STOP 선언!`);

    if (!playerHands[roomCode]) playerHands[roomCode] = {};
    playerHands[roomCode][stopper] = hand;

    const hands = playerHands[roomCode];
    const scoresThisRound = calculateScores("stop", stopper, hands, roomCode);

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

  socket.on("get-final-scores", async ({ roomCode }, callback) => {
    const raw = scores[roomCode];
    if (!raw) return callback({ error: "No scores found" });

    const final = Object.entries(raw).map(([nickname, rounds]) => ({
      nickname,
      rounds,
      total: rounds.reduce((a, b) => a + b, 0),
    }));

    if (!gameEndProcessed[roomCode]) {
      gameEndProcessed[roomCode] = true;

      const sortedByScore = [...final].sort((a, b) => a.total - b.total);
      const winnerNickname = sortedByScore[0]?.nickname;

      for (const player of final) {
        const isBot = getBots(roomCode).some(
          (b) => b.nickname === player.nickname,
        );
        if (isBot) continue;

        const isWinner = player.nickname === winnerNickname;
        const coinReward = isWinner ? 500 : -100;
        const winAdd = isWinner ? 1 : 0;
        const lossAdd = isWinner ? 0 : 1;

        try {
          const user = await prisma.user.findUnique({
            where: { kakaoId: player.nickname },
          });
          if (user) {
            const newCoin = Math.max(0, user.coin + coinReward);
            let newTier = "Bronze";
            if (newCoin >= 5000) newTier = "Gold";
            else if (newCoin >= 2000) newTier = "Silver";

            await prisma.user.update({
              where: { kakaoId: player.nickname },
              data: {
                coin: newCoin,
                tier: newTier,
                wins: user.wins + winAdd,
                losses: user.losses + lossAdd,
              },
            });
            log.info(
              `[DB] 게임 종료! ${player.nickname} ${coinReward > 0 ? "+" : ""}${coinReward} 코인 (현재: ${newCoin} 🪙, 티어: ${newTier})`,
            );
          }
        } catch (error) {
          log.warn(`[DB 에러] 게임 결과 업데이트 실패: ${error}`);
        }
      }
    }

    const maxR = maxRoundMap[roomCode] || 5;
    callback({ scores: final, maxRounds: maxR });
  });

  // 혹시 클라이언트가 잘못 호출할 경우를 대비해 여기도 수정
  socket.on("start-next-round", ({ roomCode }) => {
    if (!rooms[roomCode] || roundCount[roomCode] > 5) return;

    roundCount[roomCode] = (roundCount[roomCode] || 0) + 1;
    decks[roomCode] = shuffle(createDeck());
    submittedHistory[roomCode] = [];
    drawFlag[roomCode] = new Set();

    const humans = rooms[roomCode] || [];
    const bots = getBots(roomCode).map((b) => b.nickname);
    const players = [...humans, ...bots];

    for (const n of players) {
      if (!playerHands[roomCode]) playerHands[roomCode] = {};
      playerHands[roomCode][n] = decks[roomCode].splice(0, 5);
    }

    io.to(roomCode).emit("deck-update", { remaining: decks[roomCode].length });
    io.to(roomCode).emit("game-started", {
      roomCode,
      round: roundCount[roomCode],
    });

    setTimeout(() => {
      let firstPlayer = players[0];
      const lastRoundScores = scores[roomCode];
      const validScores = players.map((p) => {
        const rScores = lastRoundScores[p] || [];
        const lastScore = rScores.length > 0 ? rScores[rScores.length - 1] : 0;
        return { nickname: p, score: lastScore };
      });
      validScores.sort((a, b) => a.score - b.score);
      firstPlayer = validScores[0].nickname;

      turnIndex[roomCode] = players.indexOf(firstPlayer);
      broadcastTurn(roomCode, firstPlayer);
    }, 500);
  });

  socket.on("ready", ({ roomCode, nickname }) => {
    if (!readyPlayers[roomCode]) readyPlayers[roomCode] = new Set();
    readyPlayers[roomCode].add(nickname);

    // 방에 있는 모든 '사람'이 게임 화면에 로딩되었을 때
    if (readyPlayers[roomCode].size === (rooms[roomCode]?.length || 0)) {
      const playersAll = getAllPlayers(roomCode);

      // 💡 핵심: 0으로 강제 초기화하지 않고, start-game이나 ready-next-round에서 계산해둔 turnIndex를 그대로 사용합니다!
      if (turnIndex[roomCode] === undefined) {
        turnIndex[roomCode] = 0;
      }

      // 저장된 turnIndex에 해당하는 진짜 '선' 플레이어 가져오기
      const firstPlayer = playersAll[turnIndex[roomCode]] || nickname;

      io.to(roomCode).emit("ready-ok");
      broadcastTurn(roomCode, firstPlayer);
    }
  });

  socket.on("draw-card", ({ roomCode }) => {
    const nickname = socketIdToNickname[socket.id];
    log.game(`[${roomCode}] ${nickname} -> 카드 드로우`);
    if (!nickname || !roomCode) return;

    const allPlayers = getAllPlayers(roomCode);
    const currentPlayer = allPlayers?.[turnIndex[roomCode]];

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

    io.to(roomCode).emit("deck-update", { remaining: deck.length });

    if (!deck || deck.length === 0) {
      roundInProgress[roomCode] = false;
      io.to(roomCode).emit("round-ended", {
        reason: "deck-empty",
        allPlayerHands: playerHands[roomCode],
        round: roundCount[roomCode],
      });
      return;
    }
  });

  socket.on("time-out", ({ roomCode }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    const currentPlayer = getAllPlayers(roomCode)?.[turnIndex[roomCode]];
    if (nickname !== currentPlayer) return;

    const now = Date.now();
    if (lastTimeoutMap[roomCode] && now - lastTimeoutMap[roomCode] < 2000) {
      return;
    }
    lastTimeoutMap[roomCode] = now;

    if (uhbbungMap[roomCode]) {
      if (!penaltyScores[roomCode]) penaltyScores[roomCode] = {};
      penaltyScores[roomCode][nickname] =
        (penaltyScores[roomCode][nickname] || 0) + 10;

      log.game(`[${roomCode}] ⏰ ${nickname} 타임아웃! (어벙 +10점)`);
      // 💡 penalty 플래그를 담아서 클라이언트에 전송
      io.to(roomCode).emit("uhbbung-alert", { nickname, penalty: true });
    } else {
      log.game(`[${roomCode}] ⏰ ${nickname} 타임아웃! (턴 유지)`);
      io.to(roomCode).emit("uhbbung-alert", { nickname, penalty: false });
    }

    // ❌ 문제의 원인이었던 broadcastTurn이나 nextTurn을 완전히 삭제했습니다!
    // 이제 서버는 가만히 있고, 클라이언트 쪽에서 알아서 타이머만 다시 돕니다.
  });

  socket.on("submit-card", ({ roomCode, card }) => {
    const nickname = socketIdToNickname[socket.id];
    log.game(`[${roomCode}] ${nickname} -> 카드 제출: ${card}`);
    if (!nickname || !roomCode) return;

    const index = playerHands[roomCode][nickname].indexOf(card);
    if (index === -1) return;

    playerHands[roomCode][nickname].splice(index, 1);
    submittedHistory[roomCode].push({ nickname, card });
    io.to(roomCode).emit("card-submitted", { nickname, card });

    void maybeBotBbung(roomCode);
    nextTurn(roomCode);
  });

  socket.on("chat-message", ({ roomCode, nickname, message }) => {
    io.to(roomCode).emit("chat-message", { nickname, message });
  });

  socket.on("submit-bbung", ({ roomCode, cards }) => {
    const nickname = socketIdToNickname[socket.id];
    if (!nickname || !roomCode) return;

    if (drawFlag[roomCode]?.has(nickname)) return;
    if (cards.length !== 2) return;

    const numbers = cards.map((c: string) => c.replace(/[^0-9JQKA]/g, ""));
    if (numbers[0] !== numbers[1]) return;

    const last = submittedHistory[roomCode].at(-1);
    const lastNumber = last?.card?.replace(/[^0-9JQKA]/g, "");
    const bbungNumber = numbers[0];

    if (last?.nickname === nickname && lastNumber === bbungNumber) return;

    for (const card of cards) {
      const index = playerHands[roomCode][nickname].indexOf(card);
      if (index !== -1) {
        playerHands[roomCode][nickname].splice(index, 1);
        submittedHistory[roomCode].push({ nickname, card });
        io.to(roomCode).emit("card-submitted", { nickname, card });
      }
    }

    if (playerHands[roomCode][nickname].length === 0) {
      const last = submittedHistory[roomCode].at(-3);
      const bbungNumber = cards[0].replace(/[^0-9JQKA]/g, "");

      if (
        last &&
        last.nickname !== nickname &&
        last.card.replace(/[^0-9JQKA]/g, "") === bbungNumber
      ) {
        bbungEndTriggeredBy[roomCode] = last.nickname;
      }

      const hands = playerHands[roomCode];
      const scoresThisRound = calculateScores(
        "bbung-end",
        null,
        hands,
        roomCode,
      );

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
    }
    io.to(roomCode).emit("bbung-effect", {
      nickname: socketIdToNickname[socket.id],
    });
  });

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
        roomCode,
      );

      for (const [n, s] of Object.entries(scoresThisRound)) {
        scores[roomCode][n].push(s);
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
      const players = getAllPlayers(roomCode);
      const bbungIdx = players.indexOf(nickname);
      const nextIdx = (bbungIdx + 1) % players.length;
      turnIndex[roomCode] = nextIdx;
      drawFlag[roomCode].clear();
      const nextPlayer = players[nextIdx];
      broadcastTurn(roomCode, nextPlayer);
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
    io.to(roomCode).emit("bagaji-declared", { nickname, isBagaji });
  });

  socket.on("round-ended", ({ roomCode, reason }) => {
    const hands = playerHands[roomCode];
    const stopper =
      reason === "stop" ? rooms[roomCode]?.[turnIndex[roomCode]] : undefined;

    const roundScore = calculateScores(
      reason,
      stopper || null,
      hands,
      roomCode,
    );

    for (const [nickname, score] of Object.entries(roundScore)) {
      scores[roomCode][nickname].push(score);
    }

    roundResults[roomCode] = { scores: roundScore, hands, reason, stopper };
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

  socket.on("request-player-list", ({ roomCode }: { roomCode: string }) => {
    broadcastPlayerList(roomCode);
  });

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
      const totalCount =
        (rooms[roomCode]?.length || 0) + getBots(roomCode).length;
      if (totalCount >= 6) {
        socket.emit("error-message", {
          message: "최대 인원(6명)을 초과할 수 없습니다.",
        });
        return;
      }

      const nickname = generateBotNickname(roomCode);
      addBot(roomCode, { nickname, difficulty: d });
      if (!playerHands[roomCode]) playerHands[roomCode] = {};
      playerHands[roomCode][nickname] = [];

      io.to(roomCode).emit("player-joined", {
        nickname,
        isBot: true,
        difficulty: d,
      });
      broadcastPlayerList(roomCode);

      if (!emojiMap[roomCode]) emojiMap[roomCode] = {};
      if (!emojiMap[roomCode][nickname]) {
        emojiMap[roomCode][nickname] = "🤖";
        io.to(roomCode).emit("update-emojis", emojiMap[roomCode]);
      }
    },
  );

  socket.on(
    "remove-bot",
    ({ roomCode, nickname }: { roomCode: string; nickname: string }) => {
      const found = getBots(roomCode).some((b) => b.nickname === nickname);
      if (!found) return;

      removeBot(roomCode, nickname);
      if (playerHands[roomCode]) delete playerHands[roomCode][nickname];

      io.to(roomCode).emit("player-left", { nickname });
      broadcastPlayerList(roomCode);

      if (emojiMap[roomCode] && emojiMap[roomCode][nickname]) {
        delete emojiMap[roomCode][nickname];
        io.to(roomCode).emit("update-emojis", emojiMap[roomCode]);
      }
    },
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
      broadcastPlayerList(roomCode);
    });

    delete socketIdToNickname[socket.id];
  });

  socket.on("disconnect", () => {
    log.conn(`클라이언트 접속 해제: ${socket.id}`);
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  log.info(`Socket.IO 서버 실행 중 - http://localhost:${PORT}`);
});

function calculateScores(
  reason: string,
  stopper: string | null,
  hands: { [nickname: string]: string[] },
  roomCode: string,
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
      )
        return false;
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

    if (hand.length === 6) {
      if (isStraight(values)) return -total;
      if (isPairPairPair(values)) return 0;
      if (isTripleTriple(values)) return 0;
      if (total <= 14) return -100;
      if (total >= 65) return -total;
      return total;
    }

    if (hand.length === 3 && values.every((v) => v === values[0])) return 0;

    const counts: Record<number, number> = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    const tripleValue = Object.keys(counts).find(
      (k) => counts[parseInt(k)] === 3,
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
      (p) => p !== stopper && calculate(hands[p]) <= stopperScore,
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

  if (reason === "bbung-end" && roomCode) {
    const rewardPlayer = bbungEndTriggeredBy[roomCode];
    if (rewardPlayer) {
      scores[rewardPlayer] = (scores[rewardPlayer] || 0) + 30;
    }
  }

  if (
    roomCode &&
    roundCount[roomCode] === (maxRoundMap[roomCode] || 5) &&
    doubleFinalRoundMap[roomCode]
  ) {
    for (const p of Object.keys(scores)) {
      const original = scores[p];
      const doubled = typeof original === "number" ? original * 2 : 0;
      scores[p] = doubled;
    }
  }

  for (const p of Object.keys(scores)) {
    const penalty = penaltyScores[roomCode]?.[p] || 0;
    scores[p] += penalty;
  }

  return scores;
}
