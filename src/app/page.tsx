"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import GameRulesModal from "@/components/GameRulesModal";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [maxPlayers] = useState(6);
  const [showMaxInput, setShowMaxInput] = useState(false);
  const [showPatchNote, setShowPatchNote] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [doubleFinalRound, setDoubleFinalRound] = useState(false);
  const { emoji, setEmoji } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uhbbungEnabled, setUhbbungEnabled] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const logoClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setIsJoiningRoom(false);
  };

  const logoClickCountRef = useRef(0);

  const handleLogoClick = () => {
    if (logoClickCountRef.current === 0) {
      // ⏱ 최초 클릭 시 타이머 시작
      logoClickTimeoutRef.current = setTimeout(() => {
        logoClickCountRef.current = 0; // 3초 안에 10번 못 누르면 초기화
      }, 3000);
    }

    logoClickCountRef.current += 1;

    if (logoClickCountRef.current >= 10) {
      setShowEasterEgg(true);
      logoClickCountRef.current = 0;
      if (logoClickTimeoutRef.current) {
        clearTimeout(logoClickTimeoutRef.current); // 타이머 정리
      }

      // 3초 후 이스터에그 닫기
      setTimeout(() => setShowEasterEgg(false), 3000);
    }
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
      )}&doubleFinal=${doubleFinalRound}&uhbbung=${uhbbungEnabled}&emoji=${encodeURIComponent(
        emoji
      )}`
    );
  };

  const handleStartJoinRoom = () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해 주세요.");
      return;
    }
    setIsJoiningRoom(true);
    setShowMaxInput(false);
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
      {/* 오류 제보 + Buy me a coffee 버튼 */}
      <div className="absolute top-4 right-4 flex flex-col items-end space-y-2 z-50">
        <a
          href="https://open.kakao.com/o/sXveaSxh"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-500 text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-red-600 transition"
        >
          오류 제보
        </a>

        <a
          href="https://www.buymeacoffee.com/jinhan"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            alt="Buy Me A Coffee"
            className="h-10"
          />
        </a>
      </div>

      {showPatchNote && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white text-black p-6 rounded-xl shadow-xl w-[90%] max-w-md max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-2">📌 업데이트 사항 ver 3.4</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>
              <strong>
                뻥카비에 숨겨진 이스터 에그를 찾으면 기프티콘을 드립니다~!
                (현재까지 찾은 사람: 1명)
              </strong>
            </li>
            <li>플레이어 이모지 추가</li>
            <li>타이머 추가</li>
            <li>마지막 라운드 점수 2배 적용 가능</li>
          </ul>
          <h2 className="text-xl font-bold mb-2 mt-4">⚠️ 현재 버그 사항</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>5장 바가지에서 노바가지가 되면 알림 없음</li>
          </ul>
          <h2 className="text-xl font-bold mb-2 mt-4">🚧 앞으로 개선될 기능</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>타이머 어벙 추가 로직 개발중...</li>
            <li>최종 결과 시 효과음 추가</li>
            <li>개인 프로필 생성 및 DB 연동 (승률, 코인 등)</li>
            <li>카카오 로그인 연동</li>
          </ul>
          <button
            onClick={handleClose}
            className="mt-2 px-4 py-1 bg-green-700 text-white rounded hover:bg-green-800"
          >
            닫기
          </button>
        </div>
      )}

      <div className="text-center mb-8">
        <div
          onClick={handleLogoClick}
          className="text-6xl font-extrabold text-black transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500 hover:to-yellow-400 hover:text-transparent hover:bg-clip-text cursor-pointer"
        >
          뻥카비
        </div>

        <p className="text-sm mt-1 text-gray-600 it alic">
          이제 언제 어디든, 뻥카비
        </p>
      </div>

      <button
        onClick={() => setShowEmojiPicker(true)}
        className="text-4xl mb-2"
        title="이모지 선택"
      >
        {emoji}
      </button>

      {showEmojiPicker && (
        <div className="absolute z-50 bg-white text-black p-4 rounded shadow-md max-w-xs w-64">
          <h3 className="font-bold mb-2">이모지를 선택하세요</h3>
          <div className="grid grid-cols-5 gap-2 text-xl">
            {["🐶", "🐱", "🐻", "🐸", "🐵", "🐯", "🦊", "🐼", "🦁", "🐷"].map(
              (e) => (
                <button
                  key={e}
                  onClick={() => {
                    setEmoji(e);
                    setShowEmojiPicker(false);
                  }}
                  className="hover:scale-110"
                >
                  {e}
                </button>
              )
            )}
          </div>
        </div>
      )}
      {showEasterEgg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-200 border border-yellow-400 text-yellow-900 px-6 py-3 rounded-xl shadow-xl z-50 animate-bounce text-center text-lg font-bold">
          🎉 진한이 숨겨둔 이스터에그, 당신이 찾았군..
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;화면 캡쳐해서 보내면 기프티콘 드립니다.
        </div>
      )}

      <input
        type="text"
        placeholder="닉네임을 입력하세요"
        className="mt-2 mb-6 px-4 py-2 rounded-lg border border-gray-400 w-64 text-center text-black"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />

      {!isJoiningRoom && !showMaxInput && (
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
      )}

      {showMaxInput && (
        <div className="flex flex-col items-center space-y-4">
          <label className="flex items-center space-x-2 text-black">
            <input
              type="checkbox"
              checked={doubleFinalRound}
              onChange={(e) => setDoubleFinalRound(e.target.checked)}
            />
            <span>마지막 라운드 점수 2배 적용</span>
          </label>
          <label className="flex items-center space-x-2 text-black">
            <input
              type="checkbox"
              checked={uhbbungEnabled}
              onChange={(e) => setUhbbungEnabled(e.target.checked)}
            />
            <span>어벙(10초 오버 시 +10점) 적용</span>
          </label>
          <button
            onClick={confirmCreateRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          >
            방 생성 확인
          </button>
        </div>
      )}

      {isJoiningRoom && (
        <div className="flex flex-col items-center space-y-4 mt-4">
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

      <button
        onClick={() => setShowRules(true)}
        className="mt-6 text-sm underline text-blue-600 hover:text-blue-800"
      >
        게임 설명 보기
      </button>
      {showRules && <GameRulesModal onClose={() => setShowRules(false)} />}

      <div className="mt-2 text-sm text-gray-500 text-center">
        © 임진한 (국민대 정보보안암호수학과 23) ver.3.1.8
      </div>

      <div className="absolute bottom-0 left-0 w-full flex justify-center bg-white py-2">
        <a
          href="https://link.coupang.com/a/cvkq2m"
          target="_blank"
          referrerPolicy="unsafe-url"
        >
          <img
            src="https://ads-partners.coupang.com/banners/868527?subId=&traceId=V0-301-879dd1202e5c73b2-I868527&w=728&h=90"
            alt="쿠팡 광고 배너"
            className="w-full max-w-[728px] h-auto"
          />
        </a>
      </div>
    </div>
  );
}
