"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { QRCodeCanvas } from "qrcode.react";

export default function LobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = searchParams.get("code");
  const nickname = searchParams.get("nickname");
  const maxPlayers = Number(searchParams.get("max")) || 6;
  const doubleFinal = searchParams.get("doubleFinal") === "true";

  const [players, setPlayers] = useState<string[]>([]);
  const [hasJoined, setHasJoined] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [chatMessages, setChatMessages] = useState<
    { nickname: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  useEffect(() => {
    if (!roomCode || !nickname) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      if (!hasJoined) {
        socket.emit("join-room", { roomCode, nickname });
        setHasJoined(true);
      }
    };

    socket.off("connect");
    socket.once("connect", handleConnect);

    socket.off("update-players");
    socket.on("update-players", setPlayers);

    socket.off("join-error");
    socket.on("join-error", (msg: string) => {
      alert(msg);
      socket.disconnect();
      router.push("/");
    });

    socket.off("game-started");
    socket.on("game-started", ({ roomCode }) => {
      router.push(
        `/game?code=${roomCode}&nickname=${encodeURIComponent(nickname)}`
      );
    });

    socket.off("chat-message");
    socket.on("chat-message", ({ nickname, message }) => {
      setChatMessages((prev) => [...prev, { nickname, message }]);
    });
  }, [roomCode, nickname, hasJoined, router]);

  const isHost = players.length > 0 && players[0] === nickname;

  const sendChat = () => {
    if (!canSend || !chatInput.trim()) return;
    const socket = getSocket();
    socket.emit("chat-message", { roomCode, nickname, message: chatInput });
    setChatInput("");
    setCanSend(false);
    setTimeout(() => setCanSend(true), 10000);
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
          onClick={() => {
            const socket = getSocket();
            socket.emit("start-game", {
              roomCode,
              nickname,
              maxPlayers,
              doubleFinal, // ✅ 추가
            });
          }}
          disabled={players.length < maxPlayers}
          className={`mt-8 px-6 py-2 font-semibold rounded-lg ${
            players.length < maxPlayers
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
        📱 QR로 친구 초대
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
            <QRCodeCanvas
              value={`https://bbungkabe.com/lobby?code=${roomCode}&nickname=`}
              size={200}
            />
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
