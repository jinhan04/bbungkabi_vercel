"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { motion } from "framer-motion";

interface FinalScore {
  nickname: string;
  rounds: number[];
  total: number;
}

export default function RoundResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";
  const nickname = decodeURIComponent(searchParams.get("nickname") || "");
  const reason = searchParams.get("reason") || "";
  const stopper = searchParams.get("stopper") || "";

  const [hand, setHand] = useState<string[]>([]);
  const [allHands, setAllHands] = useState<Record<string, string[]>>({});
  const [score, setScore] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [isLastRound, setIsLastRound] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [round, setRound] = useState<number>(1);

  const [showOthers, setShowOthers] = useState(false);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({});
  const [totalScoresMap, setTotalScoresMap] = useState<Record<string, number>>(
    {},
  );

  const computeRoundScores = useCallback(
    (all: Record<string, string[]>) => {
      const scores: Record<string, number> = {};
      if (!all || Object.keys(all).length === 0) return scores;

      if (reason === "stop" && stopper) {
        const stopperScore = calculateScore(all[stopper] || []);
        const hasLowerOrEqual = Object.entries(all).some(([name, h]) => {
          if (Array.isArray(h)) {
            const comp = calculateScore(h);
            return name !== stopper && comp <= stopperScore;
          }
          return false;
        });

        for (const [name, h] of Object.entries(all)) {
          const s = calculateScore(h);
          scores[name] =
            name === stopper
              ? s + (hasLowerOrEqual ? 50 : 0)
              : hasLowerOrEqual
                ? 0
                : s;
        }
      } else {
        const triggerer = sessionStorage.getItem("bbungTriggerer");
        for (const [name, h] of Object.entries(all)) {
          let s = calculateScore(h);
          if (reason === "bbung-end" && triggerer && name === triggerer) {
            s += 30;
          }
          scores[name] = s;
        }
      }
      return scores;
    },
    [reason, stopper],
  );

  const sortedPlayers = useMemo(() => {
    return Object.keys(allHands).sort((a, b) => {
      const ta = totalScoresMap[a] ?? 0;
      const tb = totalScoresMap[b] ?? 0;
      return tb - ta;
    });
  }, [allHands, totalScoresMap]);

  useEffect(() => {
    const savedHand = JSON.parse(sessionStorage.getItem("myHand") || "[]");
    let finalHand = savedHand;
    let parsedAll: Record<string, string[]> = {};

    try {
      const allHandsRaw = sessionStorage.getItem("allPlayerHands");
      if (allHandsRaw) {
        parsedAll = JSON.parse(allHandsRaw);
      }
    } catch (e) {
      console.warn("allPlayerHands 파싱 실패", e);
    }

    if (!savedHand.length && parsedAll[nickname]) {
      finalHand = parsedAll[nickname];
    }

    setHand(finalHand);
    setAllHands(parsedAll);

    const storedRound = sessionStorage.getItem("round");
    if (storedRound) setRound(Number(storedRound));

    if (reason === "stop" && stopper) {
      const stopperScore = calculateScore(parsedAll[stopper] || []);
      const hasLowerOrEqual = Object.entries(parsedAll).some(([name, h]) => {
        if (Array.isArray(h)) {
          const comp = calculateScore(h);
          return name !== stopper && comp <= stopperScore;
        }
        return false;
      });

      if (nickname === stopper) {
        const final = stopperScore + (hasLowerOrEqual ? 50 : 0);
        setScore(final);
      } else {
        const myScore = calculateScore(savedHand);
        setScore(hasLowerOrEqual ? 0 : myScore);
      }
    } else {
      let myScore = calculateScore(savedHand);
      const triggerer = sessionStorage.getItem("bbungTriggerer");
      if (reason === "bbung-end" && triggerer === nickname) {
        myScore += 30;
      }
      setScore(myScore);
    }

    setRoundScores(computeRoundScores(parsedAll));
  }, [reason, stopper, nickname, computeRoundScores]);

  useEffect(() => {
    const socket = getSocket();

    // 👇 파라미터에 maxRounds를 추가로 받아옵니다
    socket.emit(
      "get-final-scores",
      { roomCode },
      (response: { scores?: FinalScore[]; maxRounds?: number }) => {
        if (response.scores) {
          const currentRounds = response.scores[0]?.rounds?.length || 0;
          const maxR = response.maxRounds || 5;

          setIsLastRound(currentRounds >= maxR);

          const me = response.scores.find((s) => s.nickname === nickname);
          if (me) setTotalScore(me.total);

          const scoreMap: Record<string, number> = {};
          response.scores.forEach((entry) => {
            scoreMap[entry.nickname] = entry.total;
          });
          sessionStorage.setItem("totalScores", JSON.stringify(scoreMap));
          setTotalScoresMap(scoreMap);
        }
      },
    );

    socket.on("update-ready", (list: string[]) => {
      setReadyPlayers(list);
    });

    const handleNextRound = () => {
      if (roomCode && nickname) {
        router.push(
          `/game?code=${roomCode}&nickname=${encodeURIComponent(nickname)}`,
        );
      }
    };

    socket.on("next-round", handleNextRound);

    return () => {
      socket.off("update-ready");
      socket.off("next-round", handleNextRound);
    };
  }, [roomCode, nickname, router]);

  const handleReadyNext = () => {
    const socket = getSocket();
    socket.emit("ready-next-round", { roomCode, nickname });
    setIsReady(true);
  };

  const handleViewFinal = () => {
    const socket = getSocket();
    socket.emit(
      "get-final-scores",
      { roomCode },
      (response: { scores?: FinalScore[] }) => {
        if (response.scores) {
          const encoded = encodeURIComponent(JSON.stringify(response.scores));
          router.push(`/finalresult?scores=${encoded}`);
        }
      },
    );
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-orange-50 text-gray-800 p-4 sm:p-6 pt-12 pb-24">
      {/* 💡 헤더 영역 */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl bg-white rounded-[2rem] shadow-sm border-[3px] border-orange-100 p-6 mb-6 text-center"
      >
        <div className="inline-block bg-orange-100 text-orange-600 font-black px-4 py-1.5 rounded-full mb-3 text-sm tracking-widest uppercase">
          라운드 종료
        </div>
        <h1 className="text-3xl font-black text-gray-800 mb-2">
          {round} 라운드 결과
        </h1>
        <p className="text-orange-500 font-bold bg-orange-50 py-2 px-4 rounded-xl inline-block text-sm">
          {generateReasonDescription(reason, nickname, stopper, allHands)}
        </p>
      </motion.div>

      {/* 💡 내 점수 & 손패 요약 카드 */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl border-4 border-orange-200 p-6 sm:p-8 mb-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-yellow-400" />

        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">
              {nickname} 님의 점수
            </h2>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-orange-600">
                {score !== null ? score : "..."}
              </span>
              <span className="text-lg font-bold text-gray-500 mb-1">점</span>
            </div>
          </div>

          <div className="bg-orange-50 px-6 py-4 rounded-2xl border border-orange-100 text-center w-full sm:w-auto">
            <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">
              현재 누적 합계
            </p>
            <p className="text-2xl font-black text-gray-800">
              {totalScore !== null ? totalScore : "..."} 점
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3 text-center sm:text-left">
            남은 내 손패
          </h3>
          {hand.length > 0 ? (
            <div className="grid grid-cols-6 gap-2 mt-2 px-1 sm:flex sm:flex-wrap sm:justify-start">
              {hand.map((card, idx) => (
                <CardChip
                  key={idx}
                  card={card}
                  className="w-full aspect-[2/3] text-xs sm:text-base sm:w-16 sm:h-24 lg:w-20 lg:h-28 shadow-sm"
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-6 text-center text-gray-400 font-bold">
              🙌 손에 남은 카드가 없습니다!
            </div>
          )}
        </div>
      </motion.div>

      {/* 💡 다른 플레이어 보기 섹션 */}
      {Object.keys(allHands).length > 0 && (
        <div className="w-full max-w-2xl mb-8">
          <button
            onClick={() => setShowOthers((v) => !v)}
            className="w-full bg-white hover:bg-gray-50 text-gray-600 font-black py-4 px-6 rounded-2xl border-[3px] border-gray-200 transition-colors shadow-sm flex justify-between items-center"
          >
            <span>👀 다른 플레이어 손패 및 점수 보기</span>
            <span
              className={`transform transition-transform ${showOthers ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>

          {showOthers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-4 space-y-4"
            >
              {sortedPlayers.map((player) => {
                const cards = allHands[player] || [];
                const thisRound = roundScores[player] ?? 0;
                const total = totalScoresMap[player] ?? 0;
                const isMe = player === nickname;

                return (
                  <div
                    key={player}
                    className={`rounded-2xl p-5 border-2 ${
                      isMe
                        ? "bg-orange-50 border-orange-200"
                        : "bg-white border-gray-200"
                    } shadow-sm`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                      <div className="text-lg font-black text-gray-800 flex items-center gap-2">
                        {player}
                        {isMe && (
                          <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-md uppercase">
                            나
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                        <span className="text-gray-500 font-bold">
                          이번 라운드{" "}
                          <span className="text-gray-900 ml-1">
                            {thisRound}점
                          </span>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500 font-bold">
                          누적{" "}
                          <span className="text-gray-900 ml-1">{total}점</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-6 gap-2 px-1 sm:flex sm:flex-wrap sm:justify-start">
                      {cards.length > 0 ? (
                        cards.map((card, idx) => (
                          <CardChip
                            key={idx}
                            card={card}
                            className="w-full aspect-[2/3] text-[10px] sm:text-xs sm:w-12 sm:h-16 shadow-sm"
                          />
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs font-bold bg-gray-100 px-3 py-1 rounded-md">
                          손패 없음
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      )}

      {/* 💡 하단 고정: 다음 라운드 준비 / 최종 결과 버튼 */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50 flex flex-col items-center">
        <div className="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          {!isLastRound ? (
            <>
              <div className="text-xs sm:text-sm font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-xl w-full sm:w-auto text-center border border-gray-100">
                준비된 플레이어:{" "}
                <span className="text-blue-500 ml-1">
                  {readyPlayers.length > 0
                    ? readyPlayers.join(", ")
                    : "아직 없음"}
                </span>
              </div>
              <button
                onClick={handleReadyNext}
                disabled={isReady}
                className={`w-full sm:w-auto py-4 px-10 rounded-2xl font-black text-lg transition-all shadow-md ${
                  isReady
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-[1.02]"
                }`}
              >
                {isReady ? "⏳ 다른 유저 대기 중..." : "▶️ 다음 라운드 준비"}
              </button>
            </>
          ) : (
            <button
              onClick={handleViewFinal}
              className="w-full py-4 px-10 rounded-2xl font-black text-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:scale-[1.02] transition-transform animate-pulse"
            >
              🏆 최종 결과 보러가기 🏆
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** ---------------- UI: 카드 ---------------- */
function CardChip({
  card,
  className = "",
}: {
  card: string;
  className?: string;
}) {
  const isRed = card.includes("♥") || card.includes("♦");
  return (
    <div
      className={`border border-gray-200 rounded-lg flex items-center justify-center font-black shadow-sm bg-white
        ${isRed ? "text-red-500" : "text-gray-800"} ${className}`}
      title={card}
    >
      {card}
    </div>
  );
}

/** -------- scoring helpers (client) ---------- */
function cardToValue(card: string): number {
  const rank = card.replace(/[^0-9JQKA]/g, "");
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank, 10);
}

function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

function isStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (
      (sorted[i] - sorted[i - 1] + 13) % 13 !== 1 &&
      sorted[i] - sorted[i - 1] !== 1
    )
      return false;
  }
  return true;
}

function isPairPairPair(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 2).length === 3;
}

function isTripleTriple(values: number[]): boolean {
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.values(counts).filter((c) => c === 3).length === 2;
}

function calculateScore(hand: string[]): number {
  if (!Array.isArray(hand) || hand.length === 0) return 0;
  const values = hand.map(cardToValue);
  const total = sum(values);

  if (hand.length === 6) {
    if (isStraight(values)) return -total;
    if (isPairPairPair(values)) return 0;
    if (isTripleTriple(values)) return 0;
    if (total <= 14) return -100;
    if (total >= 65) return -total;
    return total;
  }

  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const tripleValue = Object.keys(counts).find(
    (k) => counts[parseInt(k)] === 3,
  );
  if (
    tripleValue &&
    Object.values(counts).filter((c) => c === 3).length === 1
  ) {
    const v = parseInt(tripleValue);
    const rest = values.filter((x) => x !== v);
    return sum(rest);
  }

  return total;
}

function generateReasonDescription(
  reason: string,
  nickname: string,
  stopper: string,
  allHands: { [name: string]: string[] },
): string {
  if (reason === "stop" && allHands && stopper) {
    const scores: { [name: string]: number } = {};
    for (const [name, h] of Object.entries(allHands)) {
      if (Array.isArray(h)) scores[name] = calculateScore(h);
    }
    const stopperScore = scores[stopper];
    const lowerOrEqualPlayers = Object.entries(scores)
      .filter(([name, score]) => name !== stopper && score <= stopperScore)
      .map(([name, score]) => `${name} (${score}점)`);

    if (nickname === stopper) {
      if (lowerOrEqualPlayers.length > 0) {
        return `🚨 내가 "스탑"을 외쳤지만, 나보다 점수가 낮거나 같은 ${lowerOrEqualPlayers.join(", ")}가 있어 페널티 +50점!`;
      } else {
        return `✌️ 완벽한 타이밍! 내가 가장 점수가 낮아 성공적으로 "스탑"했습니다.`;
      }
    } else {
      if (lowerOrEqualPlayers.length > 0) {
        return `💥 ${stopper}님이 "스탑"을 외쳤지만 실패! 페널티를 받습니다.`;
      } else {
        return `🛑 ${stopper}님이 성공적으로 "스탑"을 외쳤습니다.`;
      }
    }
  }

  if (reason === "족보 완성" && allHands) {
    for (const [name, h] of Object.entries(allHands)) {
      if (Array.isArray(h) && h.length === 6) {
        const values = h.map(cardToValue);
        if (isStraight(values)) return `✨ ${name}님이 스트레이트 족보 완성!`;
        if (isPairPairPair(values))
          return `✨ ${name}님이 페어페어페어 족보 완성!`;
        if (isTripleTriple(values))
          return `✨ ${name}님이 트리플트리플 족보 완성!`;
        const total = sum(values);
        if (total <= 14) return `✨ ${name}님이 로우 족보(≤14) 완성!`;
        if (total >= 65) return `✨ ${name}님이 하이 족보(≥65) 완성!`;
      }
    }
    return `✨ ${nickname}님이 족보를 완성했습니다!`;
  }

  if (reason === "three-of-a-kind")
    return "🃏 남은 카드 3장이 전부 같은 숫자라 즉시 종료되었습니다!";
  if (reason === "bbung-end" && allHands) {
    const triggerer = sessionStorage.getItem("bbungTriggerer");
    const bbungFinisher = Object.entries(allHands).find(
      ([, h]) => h.length === 0,
    )?.[0];
    if (triggerer && bbungFinisher)
      return `🤣 ${triggerer}님이 뻥 타이밍을 잡았습니다! (${bbungFinisher} 페널티 +30점)`;
    return `🤣 뻥으로 라운드가 종료되었습니다!`;
  }
  if (reason === "hand-empty")
    return `🙌 누군가 손을 다 털어서 라운드가 종료되었습니다.`;
  if (reason === "deck-empty")
    return `📦 덱이 다 떨어져서 라운드가 강제 종료되었습니다.`;

  return `⚠️ 라운드 종료 (사유: ${reason})`;
}
