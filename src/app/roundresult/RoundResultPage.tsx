"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { getSocket } from "@/lib/socket";

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
  const [round, setRound] = useState<number>(1); // ✅ 라운드 상태 추가

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

    const storedRound = sessionStorage.getItem("round"); // ✅ 라운드 불러오기
    if (storedRound) setRound(Number(storedRound));

    if (reason === "stop" && stopper) {
      const stopperScore = calculateScore(parsedAll[stopper] || [], "stop");

      const hasLowerOrEqual = Object.entries(parsedAll).some(([name, h]) => {
        if (Array.isArray(h)) {
          const comp = calculateScore(h, "stop");
          return name !== stopper && comp <= stopperScore;
        }
        return false;
      });

      if (nickname === stopper) {
        const final = stopperScore + (hasLowerOrEqual ? 50 : 0);
        setScore(final);
      } else {
        const myScore = calculateScore(savedHand, "stop");
        setScore(hasLowerOrEqual ? 0 : myScore);
      }
    } else {
      let myScore = calculateScore(savedHand, reason);

      // ✅ bbung 유도자 보너스 반영
      const triggerer = sessionStorage.getItem("bbungTriggerer");
      console.log("triggerer : ", triggerer);
      console.log("nickname : ", nickname);

      if (reason === "bbung-end" && triggerer === nickname) {
        myScore += 30;
      }

      setScore(myScore);
    }
  }, [reason, stopper, nickname]);

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
          if (me) {
            setTotalScore(me.total);
          }
          // ✅ 전체 점수 sessionStorage에 저장
          const scoreMap: { [nickname: string]: number } = {};
          response.scores.forEach((entry) => {
            scoreMap[entry.nickname] = entry.total;
          });
          sessionStorage.setItem("totalScores", JSON.stringify(scoreMap));
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">🎉 라운드 결과 🎉</h1>
      <div className="text-lg mb-2">방 코드: {roomCode}</div>
      <div className="text-lg mb-2">닉네임: {nickname}</div>
      <div className="text-lg mb-2">
        다음 라운드: {round <= 5 ? `${round} / 5` : "없음"}
      </div>{" "}
      {/* ✅ 출력 */}
      <div className="text-lg mb-6 text-yellow-300 max-w-xl text-center">
        {generateReasonDescription(reason, nickname, stopper, allHands)}
      </div>
      <div className="mt-4">
        <h2 className="text-2xl font-bold mb-2">내 손패</h2>
        {hand.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {hand.map((card, idx) => (
              <div
                key={idx}
                className={`w-16 h-24 border-2 border-white rounded-lg flex items-center justify-center text-xl font-bold shadow bg-white ${
                  card.includes("♥") || card.includes("♦")
                    ? "text-red-500"
                    : "text-black"
                }`}
              >
                {card}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400">남은 카드 없음</div>
        )}
      </div>
      <div className="mt-6">
        <h2 className="text-2xl font-bold">
          {score !== null
            ? `내 점수: ${score}점${
                totalScore !== null ? ` (누적: ${totalScore}점)` : ""
              }`
            : "점수 계산 중..."}
        </h2>
      </div>
      {!isLastRound && (
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
      )}
      {isLastRound && (
        <button
          onClick={handleViewFinal}
          className="mt-10 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded"
        >
          최종 결과 보기
        </button>
      )}
    </div>
  );
}

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

function calculateScore(hand: string[], reason: string): number {
  if (hand.length === 0) return 0;
  const values = hand.map(cardToValue);
  const total = sum(values);
  console.debug("reason:", reason);

  if (hand.length === 6) {
    if (isStraight(values)) return -total;
    if (isPairPairPair(values)) return 0;
    if (isTripleTriple(values)) return 0;
    if (total <= 14) return -100;
    if (total >= 65) return -total;
    return total;
  }

  // ✅ 족보가 아닐 때 3장 같은 숫자 0점 처리
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        scores[name] = calculateScore(h, "stop");
      }
    }

    const stopperScore = scores[stopper];
    const lowerOrEqualPlayers = Object.entries(scores)
      .filter(([name, score]) => name !== stopper && score <= stopperScore)
      .map(([name, score]) => `${name} (${score}점)`);

    if (nickname === stopper) {
      if (lowerOrEqualPlayers.length > 0) {
        return `${stopper}님이 ${stopperScore}점으로 스탑을 선언했지만, 더 낮거나 같은 점수의 플레이어: ${lowerOrEqualPlayers.join(
          ", "
        )}가 있어 +50점을 획득했습니다. 나머지 플레이어는 0점 처리되었습니다.`;
      } else {
        return `${stopper}님이 ${stopperScore}점으로 스탑을 선언했으며, 더 낮은 점수의 플레이어가 없어 원래 점수가 유지되었습니다.`;
      }
    } else {
      if (lowerOrEqualPlayers.length > 0) {
        return `${stopper}님이 ${stopperScore}점으로 스탑을 선언했고, 더 낮거나 같은 점수의 플레이어가 있어 ${stopper}님은 +50점, 다른 모든 플레이어는 0점 처리되었습니다.`;
      } else {
        return `${stopper}님이 ${stopperScore}점으로 스탑을 선언했지만, 더 낮은 점수의 플레이어가 없어 모든 플레이어가 원래 점수를 유지했습니다.`;
      }
    }
  }

  if (reason === "족보 완성" && allHands) {
    for (const [name, h] of Object.entries(allHands)) {
      if (Array.isArray(h) && h.length === 6) {
        const values = h.map(cardToValue);
        if (isStraight(values))
          return `${name}님이 스트레이트 족보를 완성하여 라운드가 종료되었습니다.`;
        if (isPairPairPair(values))
          return `${name}님이 페어페어페어 족보를 완성하여 라운드가 종료되었습니다.`;
        if (isTripleTriple(values))
          return `${name}님이 트리플트리플 족보를 완성하여 라운드가 종료되었습니다.`;
        const total = sum(values);
        if (total <= 14)
          return `${name}님이 로우 족보(총합 ≤ 14)를 완성하여 라운드가 종료되었습니다.`;
        if (total >= 65)
          return `${name}님이 하이 족보(총합 ≥ 65)를 완성하여 라운드가 종료되었습니다.`;
      }
    }
    return `${nickname}님이 족보를 완성하여 라운드가 종료되었습니다.`;
  }

  if (reason === "three-of-a-kind") {
    return "카드 3장이 모두 같은 숫자여서 게임이 종료되었습니다.";
  }

  if (reason === "bbung-end" && allHands) {
    const triggerer = sessionStorage.getItem("bbungTriggerer");
    const bbungFinisher = Object.entries(allHands).find(
      ([, h]) => h.length === 0
    )?.[0];

    if (triggerer && bbungFinisher) {
      return `${triggerer}님이 ${bbungFinisher}님을 뻥하게 유도하여 +30점을 획득했습니다.`;
    }

    return `${triggerer}님이 ${bbungFinisher}님을 뻥하게 유도하여 +30점을 획득했습니다.`;
  }

  if (reason === "hand-empty") {
    return `어떤 플레이어가 모든 카드를 제출하여 손패가 0장이 되었기 때문에 라운드가 종료되었습니다.`;
  }

  if (reason === "deck-empty") {
    return `덱에 남은 카드가 없어 라운드가 종료되었습니다.`;
  }

  return `라운드 종료 사유: ${reason}`;
}
