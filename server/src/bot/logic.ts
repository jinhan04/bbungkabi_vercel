// server\src\bot\logic.ts
import { Server } from "socket.io";
import { store, Difficulty } from "../store";
import { cardToValueN } from "../utils/cards";
import { calculateScores } from "../services/scoring";
import { chance } from "./names";

export const BOT_CHAT_LINES = {
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
};

const BBUNG_GRACE_MS = 1500;

const nextBotChatAt: Record<string, Record<string, number>> = {};
const now = () => Date.now();
function canChat(room: string, nick: string) {
  return (nextBotChatAt[room]?.[nick] ?? 0) <= now();
}
function resetChatCooldown(
  room: string,
  nick: string,
  min = 8000,
  max = 14000
) {
  nextBotChatAt[room] ||= {};
  nextBotChatAt[room][nick] =
    now() + Math.floor(Math.random() * (max - min + 1)) + min;
}
function botSay(io: Server, room: string, nick: string, text: string) {
  io.to(room).emit("chat-message", { nickname: nick, message: text });
  resetChatCooldown(room, nick);
}

export function getAllPlayers(room: string): string[] {
  const humans = store.rooms[room] || [];
  const bots = store.getBots(room).map((b) => b.nickname);
  return [...humans, ...bots];
}

export function broadcastTurn(io: Server, room: string, currentPlayer: string) {
  io.to(room).emit("turn-info", {
    currentPlayer,
    round: store.roundCount[room],
  });
  // 봇이면 자동 행동
  const bot = store.getBots(room).find((b) => b.nickname === currentPlayer);
  if (bot)
    runBotTurn(io, room, bot.nickname, bot.difficulty).catch(console.error);
}

export function nextTurn(io: Server, room: string) {
  const players = getAllPlayers(room);
  if (!players.length) return;
  store.turnIndex[room] = (store.turnIndex[room] + 1) % players.length;
  store.drawFlag[room].clear();
  const next = players[store.turnIndex[room]];
  broadcastTurn(io, room, next);
}

function _numStr(card: string) {
  return card.replace(/[^0-9JQKA]/g, "");
}

function pickHighest(room: string, nick: string): string | null {
  const hand = store.playerHands[room]?.[nick] || [];
  if (!hand.length) return null;
  let best = hand[0],
    bestV = cardToValueN(best);
  for (const c of hand) {
    const v = cardToValueN(c);
    if (v > bestV) {
      best = c;
      bestV = v;
    }
  }
  return best;
}

function getLegalSingles(room: string, nick: string) {
  return [...(store.playerHands[room]?.[nick] || [])];
}

function isJokbo6(hand: string[]): boolean {
  if (!hand || hand.length !== 6) return false;
  const values = hand.map(cardToValueN);
  const sorted = [...values].sort((a, b) => a - b);
  let straight = true;
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if ((diff + 13) % 13 !== 1 && diff !== 1) {
      straight = false;
      break;
    }
  }
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const ppp = Object.values(counts).filter((c) => c === 2).length === 3;
  const tt = Object.values(counts).filter((c) => c === 3).length === 2;
  const s = values.reduce((a, b) => a + b, 0);
  return straight || ppp || tt || s <= 14 || s >= 65;
}

function botThinkMs(d: Difficulty): [number, number] {
  if (d === "hard") return [800, 1500];
  if (d === "normal") return [600, 1200];
  return [400, 900];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function serverSubmitSingleCard(
  io: Server,
  room: string,
  nick: string,
  card: string
) {
  const hand = store.playerHands[room]?.[nick];
  if (!hand) return;
  const i = hand.indexOf(card);
  if (i === -1) return;

  hand.splice(i, 1);
  store.submittedHistory[room].push({ nickname: nick, card });
  io.to(room).emit("card-submitted", { nickname: nick, card });

  // 🔽 변경: 봇이면 뻥 창을 열고, 사람은 기존처럼 턴 넘김
  const isBot = store.getBots(room).some((b) => b.nickname === nick);
  if (isBot) {
    // 사람에게 봇 카드에 대한 뻥 기회 제공
    openBbungWindow(io, room, nick, 1500); // 1.5초 예시
    return; // 여기서 종료: 타임아웃 후 openBbungWindow가 nextTurn 호출함
  }

  store.bbungGraceUntil[room] = Date.now() + BBUNG_GRACE_MS;

  nextTurn(io, room);
}

function ensureBbungState(room: string) {
  if (!store.bbungOpen) store.bbungOpen = {};
  if (!store.bbungBy) store.bbungBy = {};
  if (!store.bbungTimer) store.bbungTimer = {};
  if (store.bbungOpen[room] === undefined) store.bbungOpen[room] = false;
  if (store.bbungBy[room] === undefined) store.bbungBy[room] = null;
  if (store.bbungTimer[room] === undefined) store.bbungTimer[room] = null;
}

function openBbungWindow(
  io: Server,
  room: string,
  byNickname: string,
  ms = 1500
) {
  ensureBbungState(room);

  // 기존 타이머 있으면 정리
  if (store.bbungTimer[room]) {
    clearTimeout(store.bbungTimer[room]!);
    store.bbungTimer[room] = null;
  }

  store.bbungOpen[room] = true;
  store.bbungBy[room] = byNickname;

  io.to(room).emit("bbung-open", { byNickname, timeoutMs: ms });

  // ms 뒤 자동 닫고, 그때 턴 넘김
  store.bbungTimer[room] = setTimeout(() => {
    store.bbungOpen[room] = false;
    store.bbungBy[room] = null;
    store.bbungTimer[room] = null;
    io.to(room).emit("bbung-close");
    nextTurn(io, room);
  }, ms);
}

function closeBbungWindow(io: Server, room: string) {
  ensureBbungState(room);
  if (store.bbungTimer[room]) {
    clearTimeout(store.bbungTimer[room]!);
    store.bbungTimer[room] = null;
  }
  if (store.bbungOpen[room]) {
    store.bbungOpen[room] = false;
    store.bbungBy[room] = null;
    io.to(room).emit("bbung-close");
  }
}

export function serverSubmitBbung(
  io: Server,
  room: string,
  nick: string,
  cards: string[]
) {
  // 🔽 선택 가드: 뻥 창이 열려있을 때만 허용 (안전)
  if (store.bbungOpen?.[room] === false) return;

  if (!cards || cards.length !== 2) return;
  if (store.drawFlag[room]?.has(nick)) return; // 드로우 후 뻥 금지
  const nums = cards.map(_numStr);
  if (nums[0] !== nums[1]) return;

  const last = store.submittedHistory[room].at(-1);
  const lastNum = last?.card ? _numStr(last.card) : null;
  if (!lastNum || lastNum !== nums[0]) return;
  if (last?.nickname === nick) return;

  // 🔽 타이머/창 정리: 중복 nextTurn 방지
  closeBbungWindow(io, room);

  for (const c of cards) {
    const idx = store.playerHands[room][nick].indexOf(c);
    if (idx === -1) return;
    store.playerHands[room][nick].splice(idx, 1);
    store.submittedHistory[room].push({ nickname: nick, card: c });
    io.to(room).emit("card-submitted", { nickname: nick, card: c });
  }

  io.to(room).emit("bbung-effect", { nickname: nick });
  store.lastBbungHappened[room] = true;

  // 이하 기존 로직 그대로…
  if (store.playerHands[room][nick].length === 0) {
    const back3 = store.submittedHistory[room].at(-3);
    const bbNum = _numStr(cards[0]);
    if (back3 && back3.nickname !== nick && _numStr(back3.card) === bbNum) {
      store.bbungEndTriggeredBy[room] = back3.nickname;
    }
    const hands = store.playerHands[room];
    const s = calculateScores("bbung-end", null, hands, room);
    for (const [n, v] of Object.entries(s)) {
      if (!store.scores[room][n]) store.scores[room][n] = [];
      store.scores[room][n].push(v);
    }
    store.roundResults[room] = {
      scores: s,
      hands,
      reason: "bbung-end",
      triggerer: store.bbungEndTriggeredBy[room] || undefined,
    };
    store.roundInProgress[room] = false;

    io.to(room).emit("round-ended", {
      reason: "bbung-end",
      allPlayerHands: store.playerHands[room],
      round: store.roundCount[room],
      triggerer: store.bbungEndTriggeredBy[room],
    });
  }
}

export function serverSubmitBbungExtra(
  io: Server,
  room: string,
  nick: string,
  card: string
) {
  const idx = store.playerHands[room][nick].indexOf(card);
  if (idx !== -1) {
    store.playerHands[room][nick].splice(idx, 1);
    store.submittedHistory[room].push({ nickname: nick, card });
    io.to(room).emit("card-submitted", { nickname: nick, card });
  }

  if (store.playerHands[room][nick].length === 0) {
    // (기존 라운드 종료 로직 그대로)
    const last = store.submittedHistory[room].at(-1);
    if (last) store.bbungEndTriggeredBy[room] = last.nickname;

    const hands = store.playerHands[room];
    const s = calculateScores("bbung-end", null, hands, room);
    for (const [n, v] of Object.entries(s)) {
      if (!store.scores[room][n]) store.scores[room][n] = [];
      store.scores[room][n].push(v);
    }
    store.roundResults[room] = {
      scores: s,
      hands,
      reason: "bbung-end",
      triggerer: store.bbungEndTriggeredBy[room] || undefined,
    };
    store.roundInProgress[room] = false;

    io.to(room).emit("round-ended", {
      reason: "bbung-end",
      allPlayerHands: store.playerHands[room],
      round: store.roundCount[room],
      triggerer: store.bbungEndTriggeredBy[room],
    });
  } else {
    // 🔽 안전: 혹시 창이 열려있다면 닫고 진행
    closeBbungWindow(io, room);

    const players = getAllPlayers(room);
    const i = players.indexOf(nick);
    store.turnIndex[room] = (i + 1) % players.length;
    store.drawFlag[room].clear();
    const next = players[store.turnIndex[room]];
    broadcastTurn(io, room, next);
  }
}

export function serverDraw(io: Server, room: string, nick: string): boolean {
  const deck = store.decks[room];
  if (!deck || deck.length === 0) return false;

  const card = deck.shift()!;
  store.playerHands[room][nick].push(card);
  io.to(room).emit("player-drawn", { nickname: nick });
  io.to(room).emit("deck-update", { remaining: deck.length });

  // 봇 족보 즉시 종료
  const isBot = store.getBots(room).some((b) => b.nickname === nick);
  if (isBot) {
    const hand = store.playerHands[room][nick] || [];
    if (isJokbo6(hand)) {
      const hands = store.playerHands[room];
      const s = calculateScores("족보 완성", null, hands, room);
      for (const [n, v] of Object.entries(s)) {
        if (!store.scores[room][n]) store.scores[room][n] = [];
        store.scores[room][n].push(v);
      }
      store.roundResults[room] = { scores: s, hands, reason: "족보 완성" };
      store.roundInProgress[room] = false;

      io.to(room).emit("round-ended", {
        reason: "족보 완성",
        allPlayerHands: store.playerHands[room],
        round: store.roundCount[room],
      });
      return true;
    }
  }

  if (deck.length === 0) {
    store.roundInProgress[room] = false;
    io.to(room).emit("round-ended", {
      reason: "deck-empty",
      allPlayerHands: store.playerHands[room],
      round: store.roundCount[room],
    });
    return true;
  }
  return false;
}

export function serverStop(io: Server, room: string, stopper: string) {
  const hands = store.playerHands[room] || {};
  const s = calculateScores("stop", stopper, hands, room);
  for (const [n, v] of Object.entries(s)) {
    if (!store.scores[room][n]) store.scores[room][n] = [];
    store.scores[room][n].push(v);
  }
  store.roundResults[room] = { scores: s, hands, reason: "stop", stopper };
  store.roundInProgress[room] = false;

  io.to(room).emit("round-ended", {
    reason: "stop",
    stopper,
    allPlayerHands: store.playerHands[room],
    round: store.roundCount[room],
  });
}

async function maybeBotBbung(io: Server, room: string) {
  const last = store.submittedHistory[room].at(-1);
  if (!last) return;
  const lastNum = _numStr(last.card);
  const bots = store.getBots(room);
  for (const bot of bots) {
    if (bot.nickname === last.nickname) continue;
    if (store.drawFlag[room]?.has(bot.nickname)) continue;
    const hand = store.playerHands[room]?.[bot.nickname] || [];
    const pair = hand.filter((c) => _numStr(c) === lastNum).slice(0, 2);
    if (pair.length < 2) continue;

    const [minMs, maxMs] =
      bot.difficulty === "hard"
        ? [250, 700]
        : bot.difficulty === "normal"
        ? [400, 900]
        : [600, 1200];
    const waitMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await sleep(waitMs);

    const still = store.submittedHistory[room].at(-1);
    if (!still || _numStr(still.card) !== lastNum) continue;

    serverSubmitBbung(io, room, bot.nickname, pair);
    if (!store.roundInProgress[room]) return;
    if (canChat(room, bot.nickname) && chance(0.9))
      botSay(io, room, bot.nickname, BOT_CHAT_LINES.bbung[0]);

    await sleep(Math.floor(Math.random() * 500) + 300);
    const extra = pickHighest(room, bot.nickname);
    if (extra) serverSubmitBbungExtra(io, room, bot.nickname, extra);
    return;
  }
}

async function runBotTurn(
  io: Server,
  room: string,
  nick: string,
  difficulty: Difficulty
) {
  // 🔽 추가: 최근 제출로부터 남은 그레이스 타임만큼 대기
  const waitMs = Math.max(0, (store.bbungGraceUntil[room] ?? 0) - Date.now());
  if (waitMs > 0) await sleep(waitMs);

  const [min, max] =
    difficulty === "hard"
      ? [800, 1500]
      : difficulty === "normal"
      ? [600, 1200]
      : [400, 900];
  await sleep(Math.floor(Math.random() * (max - min + 1)) + min);

  // 스탑 판단: 드로우 전(인간 규칙과 동일)
  if (store.drawFlag[room]?.has(nick)) return;
  const hand = store.playerHands[room]?.[nick] || [];
  if (hand.length) {
    const score = hand.reduce((a, c) => a + cardToValueN(c), 0);
    let threshold = difficulty === "hard" ? 6 : difficulty === "easy" ? 14 : 10;
    if (store.lastBbungHappened[room]) threshold -= 4;
    if ((store.decks[room]?.length ?? 0) <= 5) threshold += 2;
    threshold += Math.floor(Math.random() * 5) - 2;
    if (score <= threshold) {
      serverStop(io, room, nick);
      if (canChat(room, nick))
        botSay(io, room, nick, "스탑! 여기서 승부 보자 😎");
      return;
    }
  }

  // 드로우
  if (!store.drawFlag[room]) store.drawFlag[room] = new Set();
  const deck = store.decks[room];
  const ended =
    deck && deck.length > 0 && !store.drawFlag[room].has(nick)
      ? serverDraw(io, room, nick)
      : false;
  if (ended) return;
  if (canChat(room, nick) && chance(0.2))
    botSay(io, room, nick, BOT_CHAT_LINES.draw[0]);
  await sleep(150);

  // 1장 제출
  const best = getLegalSingles(room, nick)[0] || pickHighest(room, nick);
  if (best) {
    await sleep(Math.floor(Math.random() * (3000 - 500 + 1)) + 1000);
    const players = getAllPlayers(room);
    if (players[store.turnIndex[room]] !== nick) return; // 턴 바뀌었으면 취소
    serverSubmitSingleCard(io, room, nick, best);
  }

  // 제출 직후 사람 카드에 대해 ‘봇 뻥’ 반응
  await maybeBotBbung(io, room);
}
