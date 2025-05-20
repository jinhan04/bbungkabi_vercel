// src/components/SubmittedCard.tsx

type SubmittedCardProps = {
  card: string;
};

export default function SubmittedCard({ card }: SubmittedCardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  return (
    <div
      className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow ${getCardColor(
        card
      )} bg-white text-black`}
    >
      {card}
    </div>
  );
}
