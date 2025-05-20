// src/components/Card.tsx

type CardProps = {
  card: string;
  selected: boolean;
  isRecent?: boolean;
  onClick: () => void;
};

export default function Card({ card, selected, isRecent, onClick }: CardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  return (
    <button
      className={`w-16 h-24 border-2 border-black rounded-lg flex items-center justify-center text-xl font-bold shadow 
        ${getCardColor(card)} 
        ${selected ? "bg-yellow-200" : "bg-white"} 
        ${
          isRecent
            ? "ring-4 ring-green-400 scale-105 transition duration-200"
            : ""
        }`}
      onClick={onClick}
    >
      {card}
    </button>
  );
}
