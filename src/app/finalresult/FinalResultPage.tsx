// src/app/finalresult/FinalResultPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";

interface PlayerScore {
  nickname: string;
  rounds: number[];
  total: number;
}

export default function FinalResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const scoresParam = searchParams.get("scores");
  const [scores, setScores] = useState<PlayerScore[]>([]);

  useEffect(() => {
    if (scoresParam) {
      try {
        const parsed: PlayerScore[] = JSON.parse(
          decodeURIComponent(scoresParam)
        );
        const sorted = [...parsed].sort((a, b) => a.total - b.total);
        setScores(sorted);
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
        <h1 className="text-3xl font-bold mb-6">최종 결과를 불러오는 중...</h1>
      </div>
    );
  }

  const winner = scores[0];

  return (
    <AppShell title="최종 결과">
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white p-6">
        <h1 className="text-4xl font-bold mb-8">🏆 최종 결과 🏆</h1>

        <h2 className="text-2xl font-bold text-yellow-300 mb-8 animate-pulse">
          🎉 최종 승자: {winner.nickname} (합계 {winner.total}점) 🎉
        </h2>

        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl text-black">
          <h3 className="text-2xl font-bold mb-4 text-center">최종 순위</h3>

          <table className="w-full text-center">
            <thead>
              <tr>
                <th className="border px-2 py-1">등수</th>
                <th className="border px-2 py-1">닉네임</th>
                <th className="border px-2 py-1">라운드 점수</th>
                <th className="border px-2 py-1">합계</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((player, index) => (
                <tr key={index}>
                  <td className="border px-2 py-1">{index + 1}</td>
                  <td className="border px-2 py-1">{player.nickname}</td>
                  <td className="border px-2 py-1">
                    {player.rounds.join(", ")}
                  </td>
                  <td className="border px-2 py-1 font-bold">{player.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={handleBackToHome}
          className="mt-10 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg"
        >
          홈으로 돌아가기
        </button>
      </div>
    </AppShell>
  );
}
