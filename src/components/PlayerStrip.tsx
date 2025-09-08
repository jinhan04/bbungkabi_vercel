"use client";

import clsx from "clsx";

export type PlayerInfo = {
  name: string;
  emoji?: string; // "🐶" 같은 이모지
  botLevel?: "easy" | "normal" | "hard";
  score?: number; // 선택: 현재 점수
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
  return (
    <div className={clsx("w-full", className)}>
      {/* 모바일: 가로 스크롤 스트립 */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2 px-2">
          {players.map((p) => {
            const isMe = p.name === me;
            const isTurn = p.name === currentPlayer;
            return (
              <div
                key={p.name}
                className={clsx(
                  "shrink-0 px-3 py-2 rounded-2xl border flex items-center gap-2",
                  "bg-white/10 border-white/20 backdrop-blur-sm",
                  isTurn && "ring-2 ring-pink-400 shadow-lg",
                  isMe && "border-yellow-300"
                )}
                title={`${p.name}${isMe ? " (나)" : ""}`}
              >
                <span className="text-xl leading-none">{p.emoji || "👤"}</span>
                <div className="flex flex-col items-start">
                  <span
                    className={clsx(
                      "text-xs font-semibold",
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
                      <span className="text-[10px] text-white/60">
                        {p.score}점
                      </span>
                    )}
                  </div>
                </div>
                {isTurn && typeof timer === "number" && timer !== null && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/20">
                    {timer}s
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 데스크톱: 세로 리스트 */}
      <div className="hidden md:block">
        <div className="flex flex-col gap-2 p-2">
          {players.map((p) => {
            const isMe = p.name === me;
            const isTurn = p.name === currentPlayer;
            return (
              <div
                key={p.name}
                className={clsx(
                  "px-3 py-2 rounded-xl border flex items-center gap-2",
                  "bg-white/5 border-white/15",
                  isTurn && "ring-2 ring-pink-400 shadow-lg",
                  isMe && "border-yellow-300"
                )}
              >
                <span className="text-2xl">{p.emoji || "👤"}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "text-sm font-semibold",
                        isTurn ? "text-pink-300" : "text-white"
                      )}
                    >
                      {p.name}
                      {isMe && " (나)"}
                    </span>
                    {p.botLevel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/70">
                        {p.botLevel}
                      </span>
                    )}
                  </div>
                  {typeof p.score === "number" && (
                    <div className="text-[11px] text-white/60">{p.score}점</div>
                  )}
                </div>
                {isTurn && typeof timer === "number" && timer !== null && (
                  <span className="text-xs font-bold px-2 py-1 rounded bg-white/10">
                    {timer}s
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
