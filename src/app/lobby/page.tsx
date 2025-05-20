"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = searchParams.get("code");
  const nickname = searchParams.get("nickname");

  const [players, setPlayers] = useState<string[]>([]);
  const [hasJoined, setHasJoined] = useState(false);

  // ✅ 채팅 관련 상태
  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  useEffect(() => {
    if (!roomCode || !nickname) return;

    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      console.log("Socket 연결 완료!");
      if (!nickname || !roomCode || hasJoined) return;
      socket.emit("join-room", { roomCode, nickname });
      setHasJoined(true);
    };

    socket.off("connect");
    socket.once("connect", handleConnect);

    socket.off("update-players");
    socket.on("update-players", (playersList: string[]) => {
      setPlayers(playersList);
    });

    socket.off("join-error");
    socket.on("join-error", (errorMessage: string) => {
      alert(errorMessage);
      socket.disconnect();
      router.push("/");
    });

    socket.off("game-started");
    socket.on("game-started", ({ roomCode }) => {
      router.push(
        `/game?code=${roomCode}&nickname=${encodeURIComponent(nickname || "")}`
      );
    });

    // ✅ 채팅 수신 리스너
    socket.off("chat-message");
    socket.on("chat-message", ({ nickname, message }) => {
      setChatMessages((prev) => [...prev, { nickname, message }]);
    });
  }, [roomCode, nickname, hasJoined]);

  const handleLeaveLobby = () => {
    const socket = getSocket();
    if (socket) {
      socket.disconnect();
    }
    router.push("/");
  };

  const handleStartGame = () => {
    const socket = getSocket();
    if (socket && roomCode && nickname) {
      socket.emit("start-game", { roomCode, nickname });
    }
  };

  const isHost = players.length > 0 && players[0] === nickname;

  // ✅ 채팅 전송 함수
  const sendChat = () => {
    if (!canSend || !chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("chat-message", { roomCode, nickname, message: chatInput });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 10000); // 10초 쿨타임
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <h1 className="text-3xl font-bold mb-6 text-black">🂡 뻥카비 대기방 🂡</h1>

      {roomCode && (
        <div className="mb-4 text-xl text-black">
          방 코드: <span className="font-mono">{roomCode}</span>
        </div>
      )}

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-black">
        입장한 플레이어들
      </h2>
      <ul className="list-disc text-black">
        {players.map((player, index) => (
          <li key={index} className="text-lg">
            {index + 1}. {player}
          </li>
        ))}
      </ul>

      {isHost && (
        <button
          onClick={handleStartGame}
          disabled={players.length < 3 || players.length > 6}
          className={`mt-8 px-6 py-2 font-semibold rounded-lg ${
            players.length < 3 || players.length > 6
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          게임 시작하기
        </button>
      )}

      <button
        onClick={handleLeaveLobby}
        className="mt-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg"
      >
        대기방 나가기
      </button>

      <p className="mt-8 text-gray-500">다른 플레이어를 기다리는 중...</p>

      {/* ✅ 대기방 채팅 UI */}
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
                canSend ? "메시지를 입력하세요" : "10초 후 다시 입력 가능"
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
    </div>
  );
}
