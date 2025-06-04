import { motion } from "framer-motion";

type SubmittedCardProps = {
  card: string;
  nickname?: string;
};

export default function SubmittedCard({ card, nickname }: SubmittedCardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  return (
    <div className="flex flex-col items-center space-y-1">
      {nickname && (
        <div className="px-2 py-1 bg-white text-pink-700 text-xs font-semibold rounded shadow">
          {nickname}
        </div>
      )}
      <motion.div
        className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow ${getCardColor(
          card
        )} bg-white`}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        {card}
      </motion.div>
    </div>
  );
}
