// src/components/Card.tsx
import { motion } from "framer-motion";

type CardProps = {
  card: string;
  selected: boolean;
  isRecent?: boolean;
  onClick: () => void;
  isNew?: boolean;
};

export default function Card({
  card,
  selected,
  isRecent,
  onClick,
  isNew,
}: CardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  return (
    <motion.button
      className={`w-16 h-24 border-2 border-black rounded-lg flex items-center justify-center text-xl font-bold shadow 
        ${getCardColor(card)} 
        ${selected ? "bg-yellow-200" : "bg-white"} 
        ${isRecent ? "ring-4 ring-green-400" : ""}`}
      onClick={onClick}
      initial={isNew ? { scale: 0, y: -100, opacity: 0 } : { scale: 1 }}
      animate={{
        scale: isRecent ? 1.05 : 1,
        y: 0,
        opacity: 1,
      }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {card}
    </motion.button>
  );
}
