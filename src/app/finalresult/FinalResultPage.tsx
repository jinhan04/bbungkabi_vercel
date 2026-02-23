"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

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
          decodeURIComponent(scoresParam),
        );
        // 점수가 낮은 순(오름차순)으로 1등 정렬
        const sorted = [...parsed].sort((a, b) => a.total - b.total);
        setScores(sorted);
      } catch (e) {
        console.error("점수 데이터 파싱 실패:", e);
      }
    }
  }, [scoresParam]);

  const handleBackToLobby = () => {
    router.push("/lobby");
  };

  if (!scores.length) {
    return null; // Wrapper의 Suspense가 처리하도록 둠
  }

  const winner = scores[0];

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-orange-50 text-gray-800 p-4 sm:p-8 pt-12 pb-24">
      {/* 상단 타이틀 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl sm:text-5xl font-black text-orange-500 mb-3 drop-shadow-sm flex items-center justify-center gap-3">
          <span>🏆</span> 최종 결과 <span>🏆</span>
        </h1>
        <p className="text-gray-500 font-bold text-sm sm:text-base">
          치열했던 5라운드의 대장정이 끝났습니다!
        </p>
      </motion.div>

      {/* 우승자 및 전체 순위 영역 */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[2rem] shadow-xl border-[3px] border-orange-100 p-6 sm:p-8 w-full max-w-3xl text-center relative"
      >
        {/* 우승자(1등) 강조 섹션 */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-3xl p-6 mb-10 relative shadow-inner">
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-7xl drop-shadow-xl animate-bounce">
            👑
          </div>
          <h2 className="text-sm font-black text-orange-400 mt-6 mb-1 uppercase tracking-widest">
            최종 우승자
          </h2>
          <p className="text-4xl sm:text-5xl font-black text-orange-600 mb-2 tracking-tight">
            {winner.nickname}
          </p>
          <p className="text-lg font-bold text-gray-600 mb-6">
            최종 합계{" "}
            <span className="text-black text-2xl ml-1">{winner.total}</span> 점
          </p>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
            className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-full font-black text-green-500 shadow-lg border-2 border-green-100 text-lg"
          >
            우승 보상 <span className="text-2xl ml-2">+ 500 🪙</span>
          </motion.div>
        </div>

        {/* 전체 순위 리스트 (표 대신 카드 형태) */}
        <div className="text-left">
          <h3 className="text-sm font-black text-gray-400 mb-4 px-2 uppercase tracking-widest flex items-center gap-2">
            📊 상세 라운드 기록
          </h3>
          <div className="space-y-3">
            {scores.map((player, index) => {
              const isWinner = index === 0;
              return (
                <div
                  key={index}
                  className={`flex flex-col sm:flex-row justify-between items-center p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                    isWinner
                      ? "bg-orange-500 text-white border-orange-600 shadow-md transform scale-[1.02]"
                      : "bg-gray-50 border-gray-100 text-gray-700"
                  }`}
                >
                  {/* 등수 및 닉네임 */}
                  <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                    <span
                      className={`text-sm sm:text-base w-12 text-center rounded-lg py-1 font-black shadow-sm ${
                        isWinner
                          ? "bg-orange-400 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {index + 1}등
                    </span>
                    <span className="text-lg sm:text-xl font-bold truncate max-w-[120px] sm:max-w-[200px]">
                      {player.nickname}
                    </span>
                  </div>

                  {/* 라운드별 점수 */}
                  <div
                    className={`text-xs sm:text-sm font-medium w-full sm:w-auto text-center mb-3 sm:mb-0 flex-grow ${
                      isWinner ? "text-orange-100" : "text-gray-400"
                    }`}
                  >
                    {player.rounds.map((r, i) => (
                      <span key={i} className="inline-block mx-1">
                        {r}
                        {i < player.rounds.length - 1 && (
                          <span className="opacity-50 mx-1">/</span>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* 최종 점수 및 코인 변화 */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                        합계
                      </span>
                      <span className="text-2xl font-black">
                        {player.total}
                      </span>
                    </div>
                    {!isWinner && (
                      <div className="text-xs font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm whitespace-nowrap">
                        - 100 🪙
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* 로비로 돌아가기 버튼 */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={handleBackToLobby}
        className="mt-10 bg-gray-800 hover:bg-gray-700 text-white font-black text-xl py-5 px-16 rounded-2xl shadow-xl transition-transform hover:scale-105"
      >
        로비로 돌아가기
      </motion.button>
    </div>
  );
}
