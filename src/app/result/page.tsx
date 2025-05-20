"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface Score {
  nickname: string;
  score: number;
}

export default function ResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const scoresParam = searchParams.get("scores");
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    if (scoresParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(scoresParam));
        setScores(parsed);
      } catch (e) {
        console.error("점수 데이터 파싱 실패:", e);
      }
    }
  }, [scoresParam]);

  const handleBackToHome = () => {
    router.push("/");
  };

  if (!scores.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white">
        <h1 className="text-3xl font-bold mb-6">결과를 불러오는 중...</h1>
      </div>
    );
  }

  const winner = scores[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white p-6">
      <h1 className="text-4xl font-bold mb-6">🏆 게임 결과 🏆</h1>

      <h2 className="text-2xl font-bold text-yellow-300 mb-8 animate-pulse">
        🎉 승자: {winner.nickname} (점수: {winner.score}) 🎉
      </h2>

      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-black">
        <h3 className="text-xl font-bold mb-4">전체 순위</h3>
        <ul className="space-y-2">
          {scores.map((player, index) => (
            <li key={index} className="flex justify-between">
              <span className="font-semibold">
                {index + 1}등: {player.nickname}
              </span>
              <span className="font-mono">{player.score}점</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleBackToHome}
        className="mt-10 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg"
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}
