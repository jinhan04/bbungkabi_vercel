// src/app/finalresult/page.tsx
import { Suspense } from "react";
import FinalResultPage from "./FinalResultPage";

export default function FinalResultWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black text-orange-500 animate-pulse">
            최종 결과를 집계하는 중... 🧮
          </h1>
        </div>
      }
    >
      <FinalResultPage />
    </Suspense>
  );
}
