"use client";

import React from "react";

export interface PlayerInfo {
  name: string;
  emoji: string;
  botLevel?: string;
  score?: number;
}

interface PlayerStripProps {
  players: PlayerInfo[];
  currentPlayer: string;
  me: string;
  timer: number | null;
  className?: string;
}

export default function PlayerStrip({
  players,
  currentPlayer,
  me,
  timer,
  className = "",
}: PlayerStripProps) {
  return (
    <div
      className={`flex gap-3 overflow-x-auto py-2 px-1 scrollbar-hide ${className}`}
    >
      {players.map((p) => {
        const isActive = p.name === currentPlayer;
        const isMe = p.name === me;

        return (
          <div
            key={p.name}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[85px] sm:min-w-[100px] transition-all duration-300 ${
              isActive
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110 border-2 border-orange-400 z-10"
                : isMe
                  ? "bg-orange-50 text-gray-800 border-2 border-orange-200"
                  : "bg-white text-gray-700 border-2 border-gray-200 shadow-sm"
            }`}
          >
            <div className="text-3xl mb-1 relative">
              {p.emoji}
              {p.botLevel && (
                <span className="absolute -bottom-1 -right-2 bg-blue-100 text-blue-600 text-[10px] font-black px-1.5 rounded-md shadow-sm">
                  AI
                </span>
              )}
            </div>

            <div className="text-xs font-bold truncate w-full text-center">
              {p.name}
            </div>

            {/* 타이머 표시 영역 */}
            {isActive && timer !== null ? (
              <div className="mt-2 bg-black/20 px-2 py-0.5 rounded-full text-[11px] font-black text-white animate-pulse">
                ⏳ {timer}초
              </div>
            ) : (
              <div className="mt-2 h-[20px]" /> // 높이 맞춤용 빈 공간
            )}
          </div>
        );
      })}
    </div>
  );
}
