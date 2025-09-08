// server\src\bot\names.ts
export const BOT_NAME_POOL = [
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

const ADJ = [
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
const ANM = [
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
const SFX = [
  "장인",
  "고수",
  "선배",
  "주니어",
  "마스터",
  "스페셜",
  "프로",
  "초보",
];

export const pick = <T>(arr: T[]) =>
  arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

export function generateBotNickname(existing: Set<string>): string {
  const available = BOT_NAME_POOL.filter((n) => !existing.has(n));
  if (available.length) return pick(available);

  for (let i = 0; i < 300; i++) {
    const base = `${pick(ADJ)} ${pick(ANM)}`;
    const name = Math.random() < 0.5 ? `${base} ${pick(SFX)}` : base;
    if (!existing.has(name)) return name;
  }
  for (let i = 0; i < 300; i++) {
    const name = `${pick(ADJ)} ${pick(ANM)} ${pick(SFX)} ${pick(SFX)}`;
    if (!existing.has(name)) return name;
  }
  return "이름없는봇";
}
