// src/app/game/page.tsx
import { Suspense } from "react";
import GamePage from "./GamePage";

export default function GamePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-orange-50 flex items-center justify-center">
          <div className="text-orange-500 font-black text-2xl animate-pulse">
            🃏 게임 테이블 세팅 중...
          </div>
        </div>
      }
    >
      <GamePage />
    </Suspense>
  );
}
