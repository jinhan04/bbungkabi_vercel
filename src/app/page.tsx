"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GameRulesModal from "@/components/GameRulesModal";

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [showMaxInput, setShowMaxInput] = useState(false);
  const [showPatchNote, setShowPatchNote] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [doubleFinalRound, setDoubleFinalRound] = useState(false);

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

  const confirmCreateRoom = () => {
    if (maxPlayers < 1 || maxPlayers > 6) {
      alert("최대 인원은 1명 이상 6명 이하만 가능합니다.");
      return;
    }

    const newRoomCode = generateRoomCode();
    router.push(
      `/lobby?code=${newRoomCode}&nickname=${encodeURIComponent(
        nickname
      )}&max=${maxPlayers}&doubleFinal=${doubleFinalRound}`
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
      {/* 오류 제보 버튼 */}
      <div className="absolute top-4 right-4">
        <a
          href="https://open.kakao.com/o/sXveaSxh"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-500 text-white font-semibold px-4 py-2 rounded-lg shadow hover:bg-red-600 transition"
        >
          오류 제보
        </a>
      </div>

      {/* 패치노트 팝업 */}
      {showPatchNote && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white text-black p-6 rounded-xl shadow-xl w-[90%] max-w-md max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-2">📌 패치노트 ver 2.4</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>게임 페이지에서 라운드 수가 1/5로 고정되던 오류 수정</li>
            <li>라운드가 2씩 증가하던 버그 수정</li>
            <li>첫 라운드에서 5/5로 보이던 문제 해결</li>
            <li>쿠팡 광고 추가</li>
            <li>카드 제출 사운드 추가</li>
            <li>바가지 / 노바가지 TTS 추가</li>
            <li>음소거/사운드 활성화 버튼 추가</li>
            <li>오류 제보 버튼 및 오픈 채팅방 추가</li>
            <li>바가지 선언 문제 해결 완료</li>
            <li>족보 인식 오류 해결</li>
            <li>모바일 UI 개선</li>
            <li>마지막 라운드 점수 2배 여부 설정 기능 추가</li>
            <li>
              <strong>뻥 애니메이션이 모든 유저에게 공유되도록 개선</strong>
            </li>
          </ul>
          <h2 className="text-xl font-bold mb-2 mt-4">⚠️ 현재 버그 사항</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>1라운드 자체 오류 있음</li>
            <li>1라운드에서 카드 뽑기 안됨 (스킵 요망)</li>
            <li>마지막 라운드로 안 넘어감</li>
            <li>바가지 실패 시 노바가지 알림 없음</li>
            <li>1라운드에 카드 수 UI 반영 오류</li>
            <li>점수 2배 적용 안됨</li>
          </ul>
          <h2 className="text-xl font-bold mb-2 mt-4">🚧 앞으로 개선될 기능</h2>
          <ul className="list-disc list-inside text-sm mb-4">
            <li>탈주 버튼 추가</li>
            <li>라운드 수 설정 기능</li>
            <li>라운드 결과 페이지에 타 플레이어 점수 표시</li>
            <li>게임 시작 사운드 추가</li>
            <li>뻥 제출 애니메이션 추가</li>
            <li>최종 결과 시 효과음 추가</li>
            <li>카드 선택 시 사운드 추가</li>
            <li>라운드 종료 시 사운드 추가</li>
            <li>타이머 + 어벙 처리 로직 추가</li>
            <li>글씨체 변경</li>
            <li>게임 종료 버튼 추가</li>
            <li>개인 프로필 생성 및 DB 연동 (승률, 코인 등)</li>
            <li>QR 코드 방 입장 기능</li>
            <li>카카오 로그인 연동</li>
            <li>debounce 최적화</li>
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
        <div className="flex flex-col items-center space-y-4 mt-4">
          <p className="text-black font-semibold">인원 (1~6)</p>
          <input
            type="number"
            min={1}
            max={6}
            className="px-4 py-2 rounded-lg border border-gray-400 w-64 text-center text-black"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
          <label className="flex items-center space-x-2 text-black">
            <input
              type="checkbox"
              checked={doubleFinalRound}
              onChange={(e) => setDoubleFinalRound(e.target.checked)}
            />
            <span>마지막 라운드 점수 2배 적용</span>
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

      <div className="mt-12 text-sm text-gray-500 text-center">
        © 임진한 (국민대 정보보안암호수학과 23)
      </div>

      <div className="w-full flex justify-center mt-6">
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
