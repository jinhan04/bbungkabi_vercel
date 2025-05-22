// src/lib/gameUtils.ts

// 카드 값 변환
export function cardToValue(card: string): number {
  const rank = card.replace(/[^0-9JQKA]/g, "");
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank, 10);
}

export function sortHandByValue(cards: string[]): string[] {
  return [...cards].sort((a, b) => cardToValue(a) - cardToValue(b));
}

export function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

export const isStraight = (values: number[]): boolean => {
  const set = new Set(values);

  // A를 14로도 인식 (A=1 이므로 14도 추가해서 10-J-Q-K-A 가능하게)
  if (set.has(1)) set.add(14);

  const nums = [...set].sort((a, b) => a - b);

  // 스트레이트 판단
  for (let i = 0; i <= nums.length - 5; i++) {
    const slice = nums.slice(i, i + 5);
    const isConsecutive = slice.every((v, j) =>
      j === 0 ? true : slice[j] === slice[j - 1] + 1
    );
    if (isConsecutive) return true;
  }

  return false;
};

export function isPairPairPair(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 2).length === 3;
}

export function isTripleTriple(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 3).length === 2;
}
