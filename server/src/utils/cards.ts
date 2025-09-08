export const createDeck = () => {
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
  for (const s of suits) for (const r of ranks) deck.push(`${r}${s}`);
  return deck;
};

export const shuffle = (array: string[]) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function cardToValueN(card: string): number {
  const v = card.replace(/[^0-9JQKA]/g, "");
  if (v === "A") return 1;
  if (v === "J") return 11;
  if (v === "Q") return 12;
  if (v === "K") return 13;
  return parseInt(v, 10);
}
