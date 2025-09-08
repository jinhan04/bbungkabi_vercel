"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import AppShell from "@/components/AppShell";

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

  // ⬇️ 추가: 다른 플레이어 보기 + 점수맵
  const [showOthers, setShowOthers] = useState(false);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({});
  const [totalScoresMap, setTotalScoresMap] = useState<Record<string, number>>(
    {}
  );

  // 이번 라운드 전체 점수 계산 (서버 규칙과 동일)
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
    [reason, stopper]
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

    // 내 점수
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

    // 전체(이번 라운드) 점수
    setRoundScores(computeRoundScores(parsedAll));
  }, [reason, stopper, nickname, computeRoundScores]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit(
      "get-final-scores",
      { roomCode },
      (response: { scores?: FinalScore[] }) => {
        if (response.scores) {
          const currentRounds = response.scores[0]?.rounds?.length || 0;
          setIsLastRound(currentRounds >= 5);

          const me = response.scores.find((s) => s.nickname === nickname);
          if (me) setTotalScore(me.total);

          const scoreMap: Record<string, number> = {};
          response.scores.forEach((entry) => {
            scoreMap[entry.nickname] = entry.total;
          });
          sessionStorage.setItem("totalScores", JSON.stringify(scoreMap));
          setTotalScoresMap(scoreMap);
        }
      }
    );

    socket.on("update-ready", (list: string[]) => {
      setReadyPlayers(list);
    });

    const handleNextRound = () => {
      if (roomCode && nickname) {
        router.push(
          `/game?code=${roomCode}&nickname=${encodeURIComponent(nickname)}`
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
      }
    );
  };

  return (
    <AppShell title="라운드 결과">
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
        <h1 className="text-3xl font-bold mb-4">🎉 라운드 결과 🎉</h1>
        <div className="text-lg mb-2">방 코드: {roomCode}</div>
        <div className="text-lg mb-2">닉네임: {nickname}</div>
        <div className="text-lg mb-2">
          다음 라운드: {round < 5 ? `${round + 1} / 5` : "없음"}
        </div>
        <div className="text-lg mb-6 text-yellow-300 max-w-xl text-center">
          {generateReasonDescription(reason, nickname, stopper, allHands)}
        </div>

        {/* 내 손패 */}
        <div className="mt-4">
          <h2 className="text-2xl font-bold mb-2">내 손패</h2>
          {hand.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {hand.map((card, idx) => (
                <CardChip key={idx} card={card} />
              ))}
            </div>
          ) : (
            <div className="text-gray-400">남은 카드 없음</div>
          )}
        </div>

        {/* 내 점수 */}
        <div className="mt-6">
          <h2 className="text-2xl font-bold">
            {score !== null
              ? `내 점수: ${score}점${
                  totalScore !== null ? ` (누적: ${totalScore}점)` : ""
                }`
              : "점수 계산 중..."}
          </h2>
        </div>

        {/* 다른 플레이어 보기 */}
        {Object.keys(allHands).length > 0 && (
          <div className="mt-8 w-full max-w-3xl">
            <button
              onClick={() => setShowOthers((v) => !v)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded"
            >
              {showOthers ? "닫기" : "다른 플레이어 보기"}
            </button>

            {showOthers && (
              <div className="mt-4 space-y-4">
                {sortedPlayers.map((player) => {
                  const cards = allHands[player] || [];
                  const thisRound = roundScores[player] ?? 0;
                  const total = totalScoresMap[player] ?? 0;

                  return (
                    <div
                      key={player}
                      className={`border border-white/20 rounded-lg p-4 ${
                        player === nickname ? "bg-white/10" : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold">
                          {player}
                          {player === nickname && (
                            <span className="ml-2 text-xs text-yellow-300">
                              (나)
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-200">
                          이번 라운드:{" "}
                          <span className="font-semibold">{thisRound}점</span> ·
                          누적: <span className="font-semibold">{total}점</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {cards.length > 0 ? (
                          cards.map((card, idx) => (
                            <CardChip key={idx} card={card} />
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">
                            손패 정보 없음
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 다음 라운드 / 최종 결과 */}
        {!isLastRound ? (
          <>
            <button
              onClick={handleReadyNext}
              disabled={isReady}
              className="mt-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white font-bold py-2 px-6 rounded"
            >
              {isReady ? "준비 완료" : "다음 라운드 준비"}
            </button>
            <div className="mt-4 text-sm text-gray-300">
              준비한 사람: {readyPlayers.join(", ")}
            </div>
          </>
        ) : (
          <button
            onClick={handleViewFinal}
            className="mt-10 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded"
          >
            최종 결과 보기
          </button>
        )}
      </div>
    </AppShell>
  );
}

function CardChip({ card }: { card: string }) {
  const isRed = card.includes("♥") || card.includes("♦");
  return (
    <div
      className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow bg-white ${
        isRed ? "text-red-500" : "text-black"
      }`}
      title={card}
    >
      {card}
    </div>
  );
}

// -------- scoring helpers (client) ----------
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
    ) {
      return false;
    }
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

  // 3장 같은 숫자 특례
  const counts: Record<number, number> = {};
  values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const tripleValue = Object.keys(counts).find(
    (k) => counts[parseInt(k)] === 3
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
  allHands: { [name: string]: string[] }
): string {
  if (reason === "stop" && allHands && stopper) {
    const scores: { [name: string]: number } = {};
    for (const [name, h] of Object.entries(allHands)) {
      if (Array.isArray(h)) {
        scores[name] = calculateScore(h);
      }
    }
    const stopperScore = scores[stopper];
    const lowerOrEqualPlayers = Object.entries(scores)
      .filter(([name, score]) => name !== stopper && score <= stopperScore)
      .map(([name, score]) => `${name} (${score}점)`);

    if (nickname === stopper) {
      if (lowerOrEqualPlayers.length > 0) {
        return `${stopper}님이 ${stopperScore}점으로 "스탑"을 외쳤습니다! 근데 더 낮거나 같은 점수인 ${lowerOrEqualPlayers.join(
          ", "
        )}가 있어 +50점! 나머지는 0점!`;
      } else {
        return `${stopper}님이 ${stopperScore}점으로 "스탑"을 외쳤습니다! 더 낮은 점수의 플레이어가 없네요.`;
      }
    } else {
      if (lowerOrEqualPlayers.length > 0) {
        return `${stopper}님이 ${stopperScore}점으로 "스탑"! 더 낮거나 같은 점수의 플레이어가 있어 ${stopper} +50점, 나머지는 0점!`;
      } else {
        return `${stopper}님이 ${stopperScore}점으로 "스탑", 더 낮은 점수의 플레이어가 없네요.`;
      }
    }
  }

  if (reason === "족보 완성" && allHands) {
    for (const [name, h] of Object.entries(allHands)) {
      if (Array.isArray(h) && h.length === 6) {
        const values = h.map(cardToValue);
        if (isStraight(values)) return `${name}님이 스트레이트 족보!🎉`;
        if (isPairPairPair(values)) return `${name}님이 페어페어페어 족보!🎉`;
        if (isTripleTriple(values)) return `${name}님이 트리플트리플 족보!🎉`;
        const total = sum(values);
        if (total <= 14) return `${name}님이 로우 족보(≤14) 완성!🎉`;
        if (total >= 65) return `${name}님이 하이 족보(≥65) 완성!🎉`;
      }
    }
    return `${nickname}님이 족보를 완성해서 종료!🎉`;
  }

  if (reason === "three-of-a-kind") {
    return "남은 카드 3장이 전부 같은 숫자! 라운드 즉시 종료!";
  }

  if (reason === "bbung-end" && allHands) {
    const triggerer = sessionStorage.getItem("bbungTriggerer");
    const bbungFinisher = Object.entries(allHands).find(
      ([, h]) => h.length === 0
    )?.[0];
    if (triggerer && bbungFinisher) {
      return `ㅋㅋ ${triggerer} 뻥이쥬~🤣 (${bbungFinisher} +30점)`;
    }
    return `ㅋㅋ 뻥 종료!🤣`;
  }

  if (reason === "hand-empty") {
    return `어떤 플레이어가 모든 카드를 제출하여 손이 비었습니다.`;
  }

  if (reason === "deck-empty") {
    return `덱이 비었습니다. 더 뽑을 카드가 없어요.`;
  }

  return `⚠️ 라운드가 종료되었습니다. (사유: ${reason})`;
}
