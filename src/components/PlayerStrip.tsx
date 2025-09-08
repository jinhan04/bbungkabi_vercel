"use client";

import clsx from "clsx";

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
  return (
    <div className={clsx("w-full", className)}>
      {/* 모바일 + PC 모두 같은 UI: 가로 스크롤 스트립 */}
      <div>
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
    </div>
  );
}
