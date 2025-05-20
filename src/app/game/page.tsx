// src/app/game/page.tsx
import { Suspense } from "react";
import GamePage from "./GamePage";

export default function GamePageWrapper() {
  return (
    <Suspense fallback={<div className="text-white">게임 로딩 중...</div>}>
      <GamePage />
    </Suspense>
  );
}
