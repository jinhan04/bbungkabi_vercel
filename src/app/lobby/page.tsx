import { Suspense } from "react";
import LobbyPage from "./LobbyPage";

export default function LobbyPageWrapper() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <LobbyPage />
    </Suspense>
  );
}
