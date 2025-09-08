// src/components/BbungFX.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

export default function BbungFX({ show }: { show: boolean }) {
  // 파편(카드 조각) 난수 생성
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 450, // 좌우
        y: (Math.random() - 0.5) * 300, // 상하
        r: Math.random() * 360, // 회전
        s: 0.6 + Math.random() * 0.8, // 크기
      })),
    []
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] pointer-events-none bbungfx-reduce"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 배경 살짝 어둡게 */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* 테이블 중앙 글로우 */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-[220px] h-[140px] -translate-x-1/2 -translate-y-1/2 rounded-3xl blur-2xl bg-white/25"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.2, 1], opacity: [0, 1, 0.4] }}
            transition={{ duration: 0.9, times: [0, 0.4, 1] }}
          />

          {/* 화면 흔들림 */}
          <motion.div
            className="absolute inset-0"
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, -10, 12, -8, 5, 0], y: [0, 6, -4, 3, -2, 0] }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          />

          {/* 중앙 텍스트 */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-6xl sm:text-7xl font-extrabold text-red-500 drop-shadow-[0_4px_20px_rgba(255,0,0,0.7)]"
            initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
            animate={{
              scale: [0.3, 1.15, 1],
              rotate: [-10, 5, 0],
              opacity: [0, 1, 1],
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.6, times: [0, 0.55, 1] }}
          >
            BBUNG!
          </motion.div>

          {/* 쇼크웨이브 */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-10 h-10 rounded-full border-4 border-white/70 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 14, opacity: 0 }}
            transition={{ duration: 0.8, ease: "linear" }}
          />

          {/* 카드 파편 */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute top-1/2 left-1/2 w-6 h-9 bg-white rounded-md shadow"
              style={{ transformOrigin: "center center" }}
              initial={{ x: 0, y: 0, rotate: 0, scale: 0.7, opacity: 1 }}
              animate={{ x: p.x, y: p.y, rotate: p.r, scale: p.s, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
