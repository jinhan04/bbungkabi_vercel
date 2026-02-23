"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { QRCodeCanvas } from "qrcode.react";
import { playSound } from "@/lib/sound";

type CombinedPlayer = {
  nickname: string;
  isBot?: boolean;
  difficulty?: "easy" | "normal" | "hard";
};

type BotDifficulty = "easy" | "normal" | "hard";

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emojiParam = searchParams.get("emoji") || "🐶";
  const roomCode = searchParams.get("code") || "";
  const nickname = searchParams.get("nickname") || "";

  const [players, setPlayers] = useState<string[]>([]);
  const [combinedPlayers, setCombinedPlayers] = useState<CombinedPlayer[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const [emojiMap, setEmojiMap] = useState<{ [nickname: string]: string }>({});
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("easy");

  // URL에서 받아온 값을 초깃값으로 설정
  const initialDoubleFinal = searchParams.get("doubleFinal") === "true";

  // 방장 설정 상태
  const [doubleFinal, setDoubleFinal] = useState(initialDoubleFinal);
  const [uhbbung, setUhbbung] = useState(false);
  const [turnTime, setTurnTime] = useState(10);
  const [maxRounds, setMaxRounds] = useState(5);

  // 방장 권한 체크
  const isHost = useMemo(() => {
    if (players.length > 0 && players[0] === nickname) return true;
    if (combinedPlayers.length > 0 && combinedPlayers[0].nickname === nickname)
      return true;
    if (players.length === 1) return true;
    return false;
  }, [players, combinedPlayers, nickname]);

  useEffect(() => {
    if (!roomCode || !nickname) return;

    const socket = getSocket();

    const handleConnect = () => {
      if (!hasJoined) {
        socket.emit("join-room", { roomCode, nickname, emoji: emojiParam });
        setHasJoined(true);
        socket.emit("request-player-list", { roomCode });
      }
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.off("connect");
      socket.once("connect", handleConnect);
      socket.connect();
    }

    socket.off("update-players");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("update-players", (payload: any) => {
      if (!payload) return;
      if (Array.isArray(payload)) {
        setPlayers(payload);
      } else if (Array.isArray(payload.players)) {
        setPlayers(payload.players);
        setEmojiMap(payload.emojis || {});
      }
    });

    socket.off("update-emojis");
    socket.on("update-emojis", (map: { [nickname: string]: string }) =>
      setEmojiMap(map || {}),
    );

    socket.off("player-list");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("player-list", (payload: any) => {
      if (!payload) return;
      if (Array.isArray(payload)) {
        setCombinedPlayers(payload);
      } else if (Array.isArray(payload.players)) {
        setCombinedPlayers(payload.players);
      }
    });

    socket.off("player-joined");
    socket.on("player-joined", () =>
      socket.emit("request-player-list", { roomCode }),
    );

    socket.off("player-left");
    socket.on("player-left", () =>
      socket.emit("request-player-list", { roomCode }),
    );

    socket.off("join-error");
    socket.on("join-error", (msg: string) => {
      alert(msg);
      socket.disconnect();
      router.push("/lobby");
    });

    socket.off("game-started");
    socket.on(
      "game-started",
      ({ roomCode: rc }: { roomCode: string; round: number }) => {
        playSound("game-start.mp3");

        // 브라우저에 남아있던 이전 게임의 데이터 청소
        sessionStorage.removeItem("totalScores");
        sessionStorage.removeItem("myHand");
        sessionStorage.removeItem("allPlayerHands");
        sessionStorage.removeItem("round");
        sessionStorage.removeItem("bbungTriggerer");

        router.push(
          `/game?code=${rc}&nickname=${encodeURIComponent(nickname)}&emoji=${encodeURIComponent(emojiParam)}`,
        );
      },
    );

    socket.off("chat-message");
    socket.on("chat-message", ({ nickname: chatNick, message }) => {
      setChatMessages((prev) => [...prev, { nickname: chatNick, message }]);
    });

    // 만약을 대비해 목록 한 번 더 갱신 요청
    socket.emit("request-player-list", { roomCode });

    return () => {
      socket.off("update-players");
      socket.off("update-emojis");
      socket.off("player-list");
      socket.off("player-joined");
      socket.off("player-left");
      socket.off("join-error");
      socket.off("game-started");
      socket.off("chat-message");
      socket.off("connect");
    };
  }, [roomCode, nickname, emojiParam, hasJoined, router]);

  const sendChat = () => {
    if (!canSend || !chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("chat-message", { roomCode, nickname, message: chatInput });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 10_000);
  };

  const startGame = () => {
    const socket = getSocket();
    socket.emit("start-game", {
      roomCode,
      nickname,
      maxPlayers: 6,
      doubleFinal,
      uhbbung,
      turnTime,
      maxRounds,
    });
  };

  const addAI = () => {
    const socket = getSocket();
    socket.emit("add-bot", { roomCode, difficulty: botDifficulty });
  };

  const removeAI = (botName: string) => {
    const socket = getSocket();
    socket.emit("remove-bot", { roomCode, nickname: botName });
  };

  const totalCount = combinedPlayers.length;

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-orange-50 px-4 py-8">
      {/* 헤더 및 방 코드 */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-orange-600 flex items-center gap-2">
          🎪 게임 대기방
        </h1>
        <button
          onClick={() => {
            getSocket().emit("leave-room", { roomCode, nickname }); // 명시적으로 떠남
            getSocket().disconnect();
            router.push("/lobby");
          }}
          className="bg-white px-4 py-2 rounded-full text-sm font-bold text-gray-500 shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          방 나가기
        </button>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-[2rem] p-6 shadow-md border-[3px] border-orange-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-400 mb-1">초대 코드</p>
          <p className="text-4xl font-black text-gray-800 tracking-widest">
            {roomCode}
          </p>
        </div>
        <button
          onClick={() => setShowQR(true)}
          className="bg-orange-100 text-orange-600 hover:bg-orange-200 px-6 py-3 rounded-xl font-bold transition-colors w-full md:w-auto"
        >
          QR 코드로 친구 초대하기
        </button>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 참가자 목록 영역 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-gray-100">
          <h2 className="text-lg font-black text-gray-700 mb-4">
            참가자 ({totalCount}/6)
          </h2>
          <div className="space-y-3">
            {combinedPlayers.map((p) => (
              <div
                key={p.nickname}
                className={`flex items-center justify-between p-3 rounded-2xl border-2 ${
                  p.nickname === nickname
                    ? "bg-orange-50 border-orange-200"
                    : "bg-gray-50 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {emojiMap[p.nickname] || (p.isBot ? "🤖" : "👤")}
                  </span>
                  <span
                    className={`font-bold ${p.nickname === nickname ? "text-orange-600" : "text-gray-700"}`}
                  >
                    {p.nickname} {p.nickname === nickname && "(나)"}
                  </span>
                  {p.isBot && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-md font-black uppercase">
                      AI • {p.difficulty}
                    </span>
                  )}
                </div>
                {isHost && p.isBot && (
                  <button
                    onClick={() => removeAI(p.nickname)}
                    className="text-gray-400 hover:text-red-500 bg-white shadow-sm rounded-full p-2 transition-colors"
                  >
                    ❌
                  </button>
                )}
              </div>
            ))}

            {/* 빈 자리 표시 */}
            {[...Array(Math.max(0, 6 - totalCount))].map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center p-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50"
              >
                <span className="text-gray-300 font-bold ml-2">빈 자리...</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* 1. 게임 룰 & AI 설정 (방장 전용) */}
          {isHost && (
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-orange-100 flex flex-col gap-5">
              <h3 className="text-md font-black text-gray-700 flex items-center gap-2">
                ⚙️ 게임 룰 & AI 설정
              </h3>

              <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-600 w-1/4 text-sm">
                  🤖 AI 추가
                </span>
                <select
                  value={botDifficulty}
                  onChange={(e) =>
                    setBotDifficulty(e.target.value as BotDifficulty)
                  }
                  className="bg-white text-gray-700 font-bold px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none flex-grow text-sm"
                >
                  <option value="easy">쉬움</option>
                  <option value="normal">보통</option>
                  <option value="hard">어려움</option>
                </select>
                <button
                  onClick={addAI}
                  disabled={totalCount >= 6}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap text-sm"
                >
                  추가
                </button>
              </div>

              <div className="space-y-4 text-sm px-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">총 라운드 수:</span>
                  <select
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value))}
                    className="bg-white text-gray-800 border-2 border-gray-200 rounded-lg px-3 py-1.5 font-black outline-none focus:border-orange-400"
                  >
                    <option value={1}>1 라운드</option>
                    <option value={3}>3 라운드</option>
                    <option value={5}>5 라운드</option>
                    <option value={7}>7 라운드</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doubleFinal}
                    onChange={(e) => setDoubleFinal(e.target.checked)}
                    className="w-5 h-5 accent-orange-500"
                  />
                  <span className="font-bold text-gray-700">
                    마지막 라운드 점수 2배
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uhbbung}
                    onChange={(e) => setUhbbung(e.target.checked)}
                    className="w-5 h-5 accent-orange-500"
                  />
                  <span className="font-bold text-gray-700">
                    어벙 적용 (시간초과 시 +10점)
                  </span>
                </label>
                <div className="flex flex-col gap-2 pt-2">
                  <span className="font-bold text-gray-700">
                    턴 제한 시간:{" "}
                    <span className="text-orange-500 text-lg">
                      {turnTime}초
                    </span>
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={turnTime}
                    onChange={(e) => setTurnTime(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. 대기방 채팅 */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-gray-100 flex-grow flex flex-col min-h-[250px]">
            <h3 className="text-md font-black text-gray-700 mb-3">
              💬 대기방 채팅
            </h3>
            <div className="flex-grow bg-gray-50 rounded-xl p-3 mb-3 overflow-y-auto space-y-2 border border-gray-100 flex flex-col">
              {chatMessages.length === 0 && (
                <div className="text-gray-400 text-sm text-center my-auto">
                  인사말을 건네보세요!
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className="text-sm">
                  <span
                    className={`font-bold ${msg.nickname === nickname ? "text-orange-500" : "text-gray-600"}`}
                  >
                    {msg.nickname}:
                  </span>
                  <span className="ml-2 text-gray-700">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-grow bg-gray-50 border-2 border-gray-100 text-gray-800 px-4 py-2 rounded-xl focus:outline-none focus:border-orange-300"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder={canSend ? "메시지 입력..." : "잠시 후 입력..."}
                disabled={!canSend}
              />
              <button
                onClick={sendChat}
                disabled={!canSend}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-bold transition-colors shrink-0"
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 게임 시작 버튼 */}
      {isHost ? (
        <button
          onClick={startGame}
          disabled={totalCount < 1 || totalCount > 6}
          className={`w-full max-w-2xl py-5 rounded-2xl font-black text-xl transition-all shadow-lg ${
            totalCount < 1 || totalCount > 6
              ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
              : "bg-orange-500 text-white shadow-orange-200 hover:bg-orange-600 hover:scale-[1.02]"
          }`}
        >
          게임 시작하기!
        </button>
      ) : (
        <div className="w-full max-w-2xl py-5 rounded-2xl font-black text-xl text-center bg-gray-200 text-gray-500">
          방장이 게임을 시작할 때까지 기다려주세요...
        </div>
      )}

      {/* QR 초대 모달 */}
      {showQR &&
        (() => {
          // 로컬/운영 환경 주소 자동 인식
          const currentDomain =
            typeof window !== "undefined"
              ? window.location.origin
              : "https://bbungkabe.com";
          const inviteUrl = `${currentDomain}/?code=${roomCode}`;

          return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-center max-w-sm w-full border-4 border-orange-100">
                <h2 className="text-2xl font-black mb-2 text-gray-800">
                  친구 초대하기
                </h2>
                <p className="text-gray-500 mb-6 font-bold text-sm">
                  아래 QR 코드를 스캔하세요!
                </p>

                <div className="flex justify-center mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <QRCodeCanvas value={inviteUrl} size={200} />
                </div>

                <p className="text-[11px] font-mono text-gray-400 mb-6 bg-gray-50 py-2 rounded-lg break-all px-2 border border-gray-100">
                  {inviteUrl}
                </p>

                <button
                  className="w-full py-4 bg-orange-100 text-orange-700 font-black rounded-xl hover:bg-orange-200 transition-colors"
                  onClick={() => setShowQR(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-orange-50 font-bold text-orange-500">
          방 정보를 불러오는 중...
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
