// src/components/PlayerStrip.tsx
"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

const MAX = 10; // 기본 10초

export type PlayerInfo = {
  name: string;
  emoji?: string;
  botLevel?: "easy" | "normal" | "hard";
  score?: number;
};

export default function PlayerStrip({
  players,
  currentPlayer,
  me,
  timer,
  className,
}: {
  players: PlayerInfo[];
  currentPlayer?: string;
  me?: string;
  timer?: number | null;
  className?: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLDivElement>(null);

  // 내가 보이도록 자동 스크롤 (가운데 근처)
  useEffect(() => {
    if (meRef.current) {
      meRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [players, me]);

  return (
    <div className={clsx("w-full", className)}>
      {/* 좌측 정렬 + 가로 스크롤 */}
      <div>
        <div
          ref={stripRef}
          className="flex justify-start items-center gap-2 overflow-x-auto hide-scrollbar py-2 px-2 snap-x"
        >
          {players.map((p) => {
            const isMe = p.name === me;
            const isTurn = p.name === currentPlayer;
            const percent =
              typeof timer === "number"
                ? Math.max(0, Math.min(100, (timer / MAX) * 100))
                : 0;

            return (
              <div
                key={p.name}
                ref={isMe ? meRef : undefined}
                className={clsx(
                  "relative shrink-0 px-3 py-2 rounded-2xl border snap-start",
                  "flex items-center gap-2 bg-white/10 border-white/20 backdrop-blur-sm",
                  "max-w-full",
                  isTurn && "ring-2 ring-pink-400 shadow-lg",
                  isMe && "border-yellow-300"
                )}
                title={`${p.name}${isMe ? " (나)" : ""}`}
              >
                <span className="text-xl leading-none">{p.emoji || "👤"}</span>

                {/* 이름/점수 */}
                <div className="flex-1 min-w-0">
                  <span
                    className={clsx(
                      "text-xs font-semibold block truncate",
                      isTurn ? "text-pink-300" : "text-white/90"
                    )}
                  >
                    {p.name}
                    {isMe && " (나)"}
                  </span>
                  <div className="flex items-center gap-1">
                    {p.botLevel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/15 text-white/70">
                        {p.botLevel}
                      </span>
                    )}
                    {typeof p.score === "number" && (
                      <span className="text-[10px] text-white/60 whitespace-nowrap">
                        {p.score}점
                      </span>
                    )}
                  </div>
                </div>

                {/* 타이머 텍스트 */}
                {isTurn && typeof timer === "number" && timer !== null && (
                  <span className="ml-1 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20">
                    {timer}s
                  </span>
                )}

                {/* 하단 진행바 */}
                {isTurn && typeof timer === "number" && timer !== null && (
                  <div className="absolute left-1 right-1 bottom-0 h-1 bg-white/15 rounded-b-xl overflow-hidden">
                    <div
                      className="h-full bg-pink-400 transition-all duration-300 ease-linear"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
