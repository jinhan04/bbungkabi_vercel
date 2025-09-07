"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { playSound } from "@/lib/sound";

type CombinedPlayer = {
  nickname: string;
  isBot?: boolean;
  difficulty?: "easy" | "normal" | "hard";
};

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emojiParam = searchParams.get("emoji");
  const { emoji: defaultEmoji } = useAuth();
  const emoji = emojiParam || defaultEmoji || "🐶";

  const roomCode = searchParams.get("code") || "";
  const nickname = searchParams.get("nickname") || "";
  const doubleFinal = searchParams.get("doubleFinal") === "true";

  // 기존(사람 전용) 목록 — 서버의 update-players 이벤트 용
  const [players, setPlayers] = useState<string[]>([]);
  // 통합(사람+봇) 목록 — 서버의 player-list 이벤트 용
  const [combinedPlayers, setCombinedPlayers] = useState<CombinedPlayer[]>([]);

  const [hasJoined, setHasJoined] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const [emojiMap, setEmojiMap] = useState<{ [nickname: string]: string }>({});

  // 방장 여부: 기존 로직(사람 목록의 1번이 본인)
  const isHost = useMemo(() => {
    return players.length > 0 && players[0] === nickname;
  }, [players, nickname]);

  // 로비에서 선택할 봇 난이도
  const [botDifficulty, setBotDifficulty] = useState<
    "easy" | "normal" | "hard"
  >("easy");

  useEffect(() => {
    if (!roomCode || !nickname) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      if (!hasJoined) {
        socket.emit("join-room", { roomCode, nickname, emoji });
        setHasJoined(true);
        // 사람+봇 통합 목록 요청
        socket.emit("request-player-list", { roomCode });
      }
    };

    socket.off("connect");
    socket.once("connect", handleConnect);

    // 1) update-players
    socket.off("update-players");
    socket.on(
      "update-players",
      (payload: { players: string[]; emojis?: Record<string, string> }) => {
        const { players, emojis } = payload;
        if (Array.isArray(players)) {
          setPlayers(players);
          setEmojiMap(emojis || {});
        } else {
          console.warn("🚨 players가 배열이 아님:", players);
          setPlayers([]);
        }
      }
    );

    // 이모지 별도 업데이트도 반영
    socket.off("update-emojis");
    socket.on("update-emojis", (map: { [nickname: string]: string }) => {
      setEmojiMap(map || {});
    });

    // 새 통합 목록 이벤트
    socket.off("player-list");
    socket.on("player-list", ({ players }: { players: CombinedPlayer[] }) => {
      setCombinedPlayers(Array.isArray(players) ? players : []);
    });

    // 누군가 들어오고/나가면 목록 새로고침
    socket.off("player-joined");
    socket.on("player-joined", () => {
      socket.emit("request-player-list", { roomCode });
    });
    socket.off("player-left");
    socket.on("player-left", () => {
      socket.emit("request-player-list", { roomCode });
    });

    socket.off("error-message");
    socket.on("error-message", ({ message }: { message: string }) => {
      alert(message);
    });

    socket.off("join-error");
    socket.on("join-error", (msg: string) => {
      alert(msg);
      socket.disconnect();
      router.push("/");
    });

    // 3) chat-message
    socket.off("chat-message");
    socket.on(
      "chat-message",
      (payload: { nickname: string; message: string }) => {
        setChatMessages((prev) => [
          ...prev,
          { nickname: payload.nickname, message: payload.message },
        ]);
      }
    );

    socket.off("chat-message");
    socket.on("chat-message", ({ nickname, message }) => {
      setChatMessages((prev) => [...prev, { nickname, message }]);
    });

    // 마운트 시 한 번 더 요청(새로고침 대비)
    socket.emit("request-player-list", { roomCode });

    return () => {
      socket.off("update-players");
      socket.off("update-emojis");
      socket.off("player-list");
      socket.off("player-joined");
      socket.off("player-left");
      socket.off("error-message");
      socket.off("join-error");
      socket.off("game-started");
      socket.off("chat-message");
      socket.off("connect");
    };
  }, [roomCode, nickname, hasJoined, router, emoji]);

  const sendChat = () => {
    if (!canSend || !chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("chat-message", { roomCode, nickname, message: chatInput });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 10000);
  };

  const startGame = () => {
    const socket = getSocket();
    socket.emit("start-game", {
      roomCode,
      nickname,
      maxPlayers: 6,
      doubleFinal,
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <h1 className="text-3xl font-bold mb-6 text-black">🂡 뻥카비 대기방 🂡</h1>

      {roomCode && (
        <div className="mb-4 text-xl text-black">
          방 코드: <span className="font-mono">{roomCode}</span>
        </div>
      )}

      {/* 방장 전용: AI 추가/삭제 UI */}
      {isHost && (
        <div className="w-full max-w-xl mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-black mb-3">AI 관리</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">난이도</label>
              <select
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value as any)}
                className="text-black px-2 py-1 border rounded"
              >
                <option value="easy">easy</option>
                <option value="normal">normal</option>
                <option value="hard">hard</option>
              </select>
              <button
                onClick={addAI}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                AI 추가
              </button>
            </div>

            {/* 통합 목록에서 봇만 필터해서 제거 버튼 제공 */}
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">추가된 AI</div>
              <div className="flex flex-wrap gap-2">
                {combinedPlayers.filter((p) => p.isBot).length === 0 && (
                  <span className="text-sm text-gray-500">없음</span>
                )}
                {combinedPlayers
                  .filter((p) => p.isBot)
                  .map((p) => (
                    <span
                      key={p.nickname}
                      className="inline-flex items-center gap-2 bg-gray-100 text-black px-2 py-1 rounded"
                    >
                      🤖 {p.nickname}
                      {p.difficulty && (
                        <span className="text-xs text-gray-600 border border-gray-300 px-1 rounded">
                          {p.difficulty}
                        </span>
                      )}
                      <button
                        onClick={() => removeAI(p.nickname)}
                        className="text-red-600 hover:text-red-700"
                        title="AI 제거"
                      >
                        🗑️
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-semibold mt-2 mb-3 text-black">
        입장한 플레이어들
      </h2>

      {/* 통합(사람+봇) 목록 표시 — 이모지 포함 */}
      <ul className="text-black w-full max-w-xl">
        {combinedPlayers.map((p, index) => (
          <li
            key={p.nickname}
            className="text-lg flex items-center justify-between bg-gray-100 rounded px-3 py-2 mb-2"
          >
            <span>
              {index + 1}. {emojiMap[p.nickname] || (p.isBot ? "🤖" : "👤")}{" "}
              {p.nickname}
              {p.isBot && p.difficulty && (
                <span className="ml-2 text-xs text-gray-600 border border-gray-300 px-1 rounded align-middle">
                  {p.difficulty}
                </span>
              )}
            </span>

            {/* 방장일 때만, 봇 제거 버튼을 항목마다 제공(위에 관리 블록에도 있음 — 사용성 위해 중복 제공) */}
            {isHost && p.isBot && (
              <button
                onClick={() => removeAI(p.nickname)}
                className="text-red-600 hover:text-red-700"
                title="AI 제거"
              >
                🗑️
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <button
          onClick={startGame}
          // 서버는 사람 수로만 시작 허용(최소 1, 최대 6)을 체크하니, 여기선 기존 조건 유지
          disabled={players.length < 1 || players.length > 6}
          className={`mt-6 px-6 py-2 font-semibold rounded-lg ${
            players.length < 1 || players.length > 6
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          게임 시작하기
        </button>
      )}

      <button
        onClick={() => setShowQR(true)}
        className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg"
      >
        QR로 친구 초대
      </button>

      <button
        onClick={() => {
          const socket = getSocket();
          socket.disconnect();
          router.push("/");
        }}
        className="mt-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg"
      >
        대기방 나가기
      </button>

      <div className="mt-8 w-full max-w-xl">
        <div className="bg-white text-black p-4 rounded shadow-md">
          <h2 className="text-lg font-bold mb-2">채팅</h2>
          <div className="h-40 overflow-y-auto mb-2 bg-gray-100 p-2 rounded text-sm">
            {chatMessages.map((msg, i) => (
              <div key={i}>
                <strong>{msg.nickname}:</strong> {msg.message}
              </div>
            ))}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              className="flex-grow px-2 py-1 border rounded"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={
                canSend ? "메시지를 입력하세요" : "10초 후 입력 가능"
              }
              disabled={!canSend}
            />
            <button
              onClick={sendChat}
              disabled={!canSend}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded disabled:bg-gray-400"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-black">
              QR 코드로 초대하기
            </h2>
            <div className="flex justify-center">
              <QRCodeCanvas
                value={`https://bbungkabe.com/join?code=${roomCode}`}
                size={200}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2 break-all">
              https://bbungkabe.com/lobby?code={roomCode}
            </p>
            <button
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => setShowQR(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
