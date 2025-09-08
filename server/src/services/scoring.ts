// server\src\services\scoring.ts
import { store } from "../store";
import { cardToValueN } from "../utils/cards";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function isStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (
      (sorted[i] - sorted[i - 1] + 13) % 13 !== 1 &&
      sorted[i] - sorted[i - 1] !== 1
    )
      return false;
  }
  return true;
}
function isPairPairPair(values: number[]): boolean {
  const c: Record<number, number> = {};
  values.forEach((v) => (c[v] = (c[v] || 0) + 1));
  return Object.values(c).filter((x) => x === 2).length === 3;
}
function isTripleTriple(values: number[]): boolean {
  const c: Record<number, number> = {};
  values.forEach((v) => (c[v] = (c[v] || 0) + 1));
  return Object.values(c).filter((x) => x === 3).length === 2;
}

function calcHandScore(hand: string[]): number {
  if (!hand?.length) return 0;
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

  // 6장이 아닐 때 3장 같은 숫자 → 그 숫자 제외 합
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const tripleKey = Object.keys(counts).find((k) => counts[+k] === 3);
  if (tripleKey && Object.values(counts).filter((c) => c === 3).length === 1) {
    const v = +tripleKey;
    return sum(values.filter((x) => x !== v));
  }

  return total;
}

export function calculateScores(
  reason: string,
  stopper: string | null,
  hands: { [nickname: string]: string[] },
  roomCode: string
): { [nickname: string]: number } {
  const result: Record<string, number> = {};
  const players = Object.keys(hands);

  if (reason === "stop" && stopper) {
    const stopperScore = calcHandScore(hands[stopper]);
    const hasLowerOrEqual = players.some(
      (p) => p !== stopper && calcHandScore(hands[p]) <= stopperScore
    );
    for (const p of players) {
      if (p === stopper) result[p] = stopperScore + (hasLowerOrEqual ? 50 : 0);
      else result[p] = hasLowerOrEqual ? 0 : calcHandScore(hands[p]);
    }
  } else {
    for (const p of players) result[p] = calcHandScore(hands[p]);
  }

  // 뻥 유도자 +30
  if (reason === "bbung-end") {
    const reward = store.bbungEndTriggeredBy[roomCode];
    if (reward) result[reward] = (result[reward] || 0) + 30;
  }

  // 어벙(+10) 라운드 가산 합치기
  const temp = store.uhbbungTempScores[roomCode] || {};
  for (const p of Object.keys(result)) {
    const bonus = temp[p] ?? 0;
    if (bonus) result[p] += bonus;
  }
  store.uhbbungTempScores[roomCode] = {};
  store.uhbbungLastTickAt[roomCode] = {};

  // 마지막 라운드 2배
  if (store.roundCount[roomCode] === 5 && store.doubleFinalRoundMap[roomCode]) {
    for (const p of Object.keys(result)) result[p] *= 2;
  }

  return result;
}
