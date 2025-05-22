"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdBanner from "@/components/AdBanner";

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [showMaxInput, setShowMaxInput] = useState(false);
  const [showPatchNote, setShowPatchNote] = useState(true);

  const router = useRouter();
  const handleClose = () => setShowPatchNote(false);

  function generateRoomCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해 주세요.");
      return;
    }
    setShowMaxInput(true);
  };

  const confirmCreateRoom = () => {
    if (maxPlayers < 1 || maxPlayers > 6) {
      alert("최대 인원은 1명 이상 6명 이하만 가능합니다.");
      return;
    }

    const newRoomCode = generateRoomCode();
    router.push(
      `/lobby?code=${newRoomCode}&nickname=${encodeURIComponent(
        nickname
      )}&max=${maxPlayers}`
    );
  };

  const handleStartJoinRoom = () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해 주세요.");
      return;
    }
    setIsJoiningRoom(true);
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert("방 코드를 입력해 주세요.");
      return;
    }
    router.push(
      `/lobby?code=${roomCode.toUpperCase()}&nickname=${encodeURIComponent(
        nickname
      )}`
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      {/* ✅ 패치 노트 팝업 */}
      {showPatchNote && (
        <div className="absolute top-10 z-50 bg-white text-black p-6 rounded-xl shadow-xl w-[90%] max-w-md">
          <h2 className="text-xl font-bold mb-2">📌 패치노트 ver 2.13</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>패치노트 팝업이 생겼습니다.</li>
            <li>덱의 남은 카드 수가 정확하게 표시됩니다.</li>
            <li>중복 카드 생성 문제가 해결되었습니다.</li>
          </ul>
          <h2 className="text-xl font-bold mb-2 mt-4">⚠️ 남은 문제</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>
              1라운드에서 카드 뽑기가 되지 않는 현상 (조사 중, 1라운드는 스킵
              요망)
            </li>
            <li>바가지 선언 안나오는 오류(수정 중)</li>
            <li>게임 페이지에서 라운드수 1/5 고정(수정 중)</li>
          </ul>
          <button
            onClick={handleClose}
            className="mt-2 px-4 py-1 bg-green-700 text-white rounded hover:bg-green-800"
          >
            닫기
          </button>
        </div>
      )}

      <h1 className="text-4xl font-bold mb-8 text-black">🂡 뻥카비 v.2.2 🂡</h1>

      <input
        type="text"
        placeholder="닉네임을 입력하세요"
        className="mb-4 px-4 py-2 rounded-lg border border-gray-400 w-64 text-center text-black"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />

      {!isJoiningRoom && !showMaxInput ? (
        <div className="flex space-x-4">
          <button
            onClick={handleCreateRoom}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg"
          >
            방 만들기
          </button>
          <button
            onClick={handleStartJoinRoom}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg"
          >
            방 입장하기
          </button>
        </div>
      ) : null}

      {showMaxInput && (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-black font-semibold">최대 인원 (1~6)</p>
          <input
            type="number"
            min={1}
            max={6}
            className="px-4 py-2 rounded-lg border border-gray-400 w-64 text-center text-black"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
          <button
            onClick={confirmCreateRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          >
            방 생성 확인
          </button>
        </div>
      )}

      {isJoiningRoom && !showMaxInput && (
        <div className="flex flex-col items-center space-y-4">
          <input
            type="text"
            placeholder="방 코드를 입력하세요"
            className="px-4 py-2 rounded-lg border border-gray-400 w-64 text-center text-black"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={6}
          />
          <button
            onClick={handleJoinRoom}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg"
          >
            입장하기
          </button>
        </div>
      )}

      <div className="mt-10">
        <AdBanner />
      </div>

      <div className="mt-12 text-sm text-gray-500 text-center">
        © 임진한 (국민대 정보보안암호수학과 23)
      </div>
    </div>
  );
}
