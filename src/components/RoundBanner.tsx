import { motion, AnimatePresence } from "framer-motion";

type RoundBannerProps = {
  show: boolean;
  round: number;
  maxRound: number;
};

export default function RoundBanner({
  show,
  round,
  maxRound,
}: RoundBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                     bg-black bg-opacity-80 text-white text-4xl font-bold py-6 px-10 
                     rounded-2xl shadow-2xl z-50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.2, 1],
            opacity: 1,
          }}
          exit={{
            scale: 0,
            opacity: 0,
          }}
          transition={{
            duration: 0.5,
            times: [0, 0.6, 1],
          }}
        >
          Round {round} / {maxRound}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
