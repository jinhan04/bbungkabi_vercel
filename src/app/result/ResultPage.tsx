"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import Card from "@/components/Card";

type RoundResultPayload = {
  scores: Record<string, number>;
  hands: Record<string, string[]>;
  reason: string;
  stopper?: string;
};

type FinalScoreItem = {
  nickname: string;
  rounds: number[];
  total: number;
};

export default function RoundResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = searchParams.get("code") || "";
  const nicknameRaw = searchParams.get("nickname") || "";
  const nickname = decodeURIComponent(nicknameRaw);
  const reason = searchParams.get("reason") || "";
  const stopper = searchParams.get("stopper") || "";

  const [round, setRound] = useState<number>(1);
  const [result, setResult] = useState<RoundResultPayload | null>(null);
  const [finalScores, setFinalScores] = useState<FinalScoreItem[] | null>(null);

  // 토글: 다른 플레이어 보기
  const [showOthers, setShowOthers] = useState(false);

  // 세션 스토리지 백업 값 (서버 콜백 못 받았을 때 대비)
  const fallbackHands = useMemo(() => {
    try {
      const s = sessionStorage.getItem("allPlayerHands");
      return s ? (JSON.parse(s) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  }, []);
  const myHandFallback = useMemo(() => {
    try {
      const s = sessionStorage.getItem("myHand");
      return s ? (JSON.parse(s) as string[]) : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const sRound = sessionStorage.getItem("round");
    if (sRound) setRound(Number(sRound));
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // 라운드 결과(이번 라운드 점수 + 손패들)
    socket.emit("get-round-result", { roomCode }, (payload: any) => {
      if (!payload || payload.error) {
        // 세션 스토리지 기반 최소 표시
        setResult({
          scores: {},
          hands: fallbackHands,
          reason: reason || "unknown",
          stopper: stopper || undefined,
        });
        return;
      }
      setResult(payload as RoundResultPayload);
    });

    // 누적 점수(총점)
    socket.emit("get-final-scores", { roomCode }, (payload: any) => {
      if (payload && !payload.error) {
        setFinalScores(payload.scores as FinalScoreItem[]);
      }
    });
  }, [roomCode, reason, stopper, fallbackHands]);

  const otherPlayers = useMemo(() => {
    const hands = result?.hands || fallbackHands;
    return Object.keys(hands).filter((p) => p !== nickname);
  }, [result, fallbackHands, nickname]);

  const getRoundScore = (player: string) => result?.scores?.[player] ?? 0;

  const getTotalScore = (player: string) =>
    finalScores?.find((f) => f.nickname === player)?.total ?? undefined;

  const myHand =
    (result?.hands && result.hands[nickname]) || myHandFallback || [];

  return (
    <div className="min-h-screen bg-white text-black px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">라운드 결과</h1>
        <div className="text-sm text-gray-600 mb-4">
          <div>라운드: {round}</div>
          <div>
            종료 사유:{" "}
            <span className="font-semibold">
              {reason}
              {reason === "stop" && stopper ? ` (스탑: ${stopper})` : ""}
            </span>
          </div>
        </div>

        {/* 내 카드 / 내 점수 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">{nickname}님의 카드</h2>
          {myHand.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {myHand.map((c) => (
                <Card
                  key={c}
                  card={c}
                  selected={false}
                  onClick={() => {}}
                  className="w-16 h-24"
                />
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">손패 정보가 없습니다.</div>
          )}
          <div className="mt-3 text-sm">
            이번 라운드 점수:{" "}
            <span className="font-semibold">{getRoundScore(nickname)}</span>
            {getTotalScore(nickname) !== undefined && (
              <>
                {" "}
                / 총점:{" "}
                <span className="font-semibold">{getTotalScore(nickname)}</span>
              </>
            )}
          </div>
        </section>

        {/* =========================
            버튼: 다른 플레이어 보기 토글
           ========================= */}
        <div className="mb-4">
          <button
            onClick={() => setShowOthers((v) => !v)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {showOthers
              ? "다른 플레이어 숨기기"
              : "다른 플레이어 카드/점수 보기"}
          </button>
        </div>

        {/* =========================
            다른 플레이어 카드/점수
           ========================= */}
        {showOthers && (
          <section className="mb-8">
            {otherPlayers.length === 0 ? (
              <div className="text-gray-500 text-sm">
                다른 플레이어 정보가 없습니다.
              </div>
            ) : (
              <div className="space-y-5">
                {otherPlayers.map((p) => {
                  const hand = result?.hands?.[p] ?? fallbackHands[p] ?? [];
                  return (
                    <div
                      key={p}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{p}</div>
                        <div className="text-sm">
                          이번 라운드:{" "}
                          <span className="font-semibold">
                            {getRoundScore(p)}
                          </span>
                          {getTotalScore(p) !== undefined && (
                            <>
                              {" "}
                              / 총점:{" "}
                              <span className="font-semibold">
                                {getTotalScore(p)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {hand.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {hand.map((c) => (
                            <Card
                              key={c}
                              card={c}
                              selected={false}
                              onClick={() => {}}
                              className="w-14 h-20 sm:w-16 sm:h-24"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-xs">
                          손패 정보가 없습니다.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 하단 버튼 영역: 다음 라운드 이동/로비로 등 기존 버튼 유지해서 쓰면 됨 */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => {
              // 결과 페이지 UI만 닫고 로비로
              router.push(
                `/lobby?code=${roomCode}&nickname=${encodeURIComponent(
                  nickname
                )}`
              );
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            로비로
          </button>
          {/* (필요 시) 다음 라운드로 이동하는 버튼이 이미 있다면 그대로 유지 */}
        </div>
      </div>
    </div>
  );
}
