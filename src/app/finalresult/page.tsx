// src/app/finalresult/page.tsx
import { Suspense } from "react";
import FinalResultPage from "./FinalResultPage";

export default function FinalResultWrapper() {
  return (
    <Suspense fallback={<div className="text-white">로딩 중...</div>}>
      <FinalResultPage />
    </Suspense>
  );
}
