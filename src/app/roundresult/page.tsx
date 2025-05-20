import { Suspense } from "react";
import RoundResultPage from "./RoundResultPage";

export default function RoundResultPageWrapper() {
  return (
    <Suspense
      fallback={<div className="text-white">라운드 결과 로딩 중...</div>}
    >
      <RoundResultPage />
    </Suspense>
  );
}
