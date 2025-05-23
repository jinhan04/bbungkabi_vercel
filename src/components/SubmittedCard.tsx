// src/components/SubmittedCard.tsx
import { motion } from "framer-motion";

type SubmittedCardProps = {
  card: string;
};

export default function SubmittedCard({ card }: SubmittedCardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  return (
    <motion.div
      className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow ${getCardColor(
        card
      )} bg-white text-black`}
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
  );
}
