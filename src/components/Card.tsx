import { motion } from "framer-motion";

type CardProps = {
  card: string;
  selected: boolean;
  isRecent?: boolean;
  onClick: () => void;
  isNew?: boolean;
  className?: string; // ✅ 추가
};

export default function Card({
  card,
  selected,
  isRecent,
  onClick,
  isNew,
  className = "", // ✅ 기본값
}: CardProps) {
  const getCardColor = (card: string) =>
    card.includes("♥") || card.includes("♦") ? "text-red-500" : "text-black";

  const baseGlow = "shadow-[0_0_12px_rgba(255,255,0,0.6)]"; // 노란 글로우

  return (
    <motion.button
      className={`border-2 border-black rounded-lg flex items-center justify-center text-lg sm:text-xl font-bold shadow
      ${getCardColor(card)}
      ${
        selected
          ? `bg-yellow-200 ring-2 ring-yellow-400 ${baseGlow}`
          : "bg-white"
      }
      ${isRecent ? "ring-4 ring-green-400" : ""}
      ${className}`}
      onClick={onClick}
      initial={isNew ? { scale: 0, y: -100, opacity: 0 } : { scale: 1 }}
      animate={{
        scale: isRecent ? 1.05 : 1,
        rotate: selected ? -2 : 0,
        y: 0,
        opacity: 1,
      }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      whileHover={{ scale: 1.06, rotate: -3 }}
      whileTap={{ scale: 0.95 }}
    >
      {card}
    </motion.button>
  );
}
