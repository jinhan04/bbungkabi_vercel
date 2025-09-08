import { motion } from "framer-motion";

type SubmittedCardProps = {
  card: string;
  nickname?: string;
  className?: string; // ✅ className을 선택적으로 받을 수 있도록 추가
};

export default function SubmittedCard({
  card,
  nickname,
  className = "",
}: SubmittedCardProps) {
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
        className={`border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow bg-white ${getCardColor(
          card
        )} ${className}`} // ✅ 외부 className 적용
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
