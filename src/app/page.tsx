// src/app/page.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameRulesModal from "@/components/GameRulesModal";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [maxPlayers] = useState(6);
  const [showMaxInput, setShowMaxInput] = useState(false);

  // 모달 상태
  const [showPatchNote, setShowPatchNote] = useState(true); // 홈 진입 시 공지/업데이트 탭
  const [showRules, setShowRules] = useState(false); // 게임 설명 탭

  const [doubleFinalRound, setDoubleFinalRound] = useState(false);
  const { emoji, setEmoji } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uhbbungEnabled, setUhbbungEnabled] = useState(false);

  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const logoClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoClickCountRef = useRef(0);

  const router = useRouter();
  const handleClosePatch = () => setShowPatchNote(false);

  // ---- 공용 데이터(한 곳에서 관리) ----
  const UPDATE_LIST = [
    "턴 타이머에 진행바 추가",
    "모바일 손패 3열 그리드 + 자동 리사이징",
    "카드 호버/선택 효과 강화",
    "“족보 완성!” 버튼 강조 애니메이션",
  ];
  const BUG_LIST = [
    "5장 바가지에서 노바가지 알림 없음",
    "AI랑 플레이 시 가끔 뻥 안됨",
  ];
  const FUTURE_LIST = [
    "타이머 어벙 추가 로직 개발중...",
    "최종 결과 시 효과음 추가",
    "개인 프로필 생성 및 DB 연동 (승률, 코인 등)",
    "카카오 로그인 연동",
  ];
  const RULES_CONTENT = (
    <>
      {`📌 기본 정보
게임명: 뻥카비

사용 카드: 일반 트럼프 카드 52장 (조커 없음)
플레이어 수: 1~6인
라운드 수: 총 5라운드
목표: 라운드마다 손패 점수가 작을수록 순위가 높고, 총 5라운드 누적 점수로 최종 승자 결정.

🎮 게임 흐름 요약
- 각 라운드 시작 시 5장씩 배분
- 자신의 턴에 카드 1장 뽑기 (draw)
- 필수 제출 또는 '뻥!' 외치며 2장 제출 후 1장 추가 제출
- 손패가 족보일 경우 “족보 완성” 버튼 클릭하여 라운드 종료 가능
- 언제든 스탑 선언 가능
- 덱이 비거나 손패가 0장일 경우 라운드 종료
- 5라운드 후 총점이 가장 낮은 사람이 승자

🔁 턴 진행 방식
- 첫 번째 라운드: 랜덤 플레이어가 시작
- 2라운드부터: 직전 라운드 점수가 가장 낮은 플레이어부터 시작

🎯 주요 규칙 설명

1. 뻥 시스템
[조건]
- 자기 턴 중 제출된 카드의 숫자와 같은 숫자의 2장을 손패에서 선택
- "뻥!"을 외치며 2장 제출 → 이후 1장 추가 제출

[유효 조건]
- 직전 카드의 숫자와 동일해야 하며
- 2장의 숫자가 정확히 같아야 함
- 이후 1장은 자유

[추가 효과]
- 뻥을 유도한 직전 제출자 +30점 (유효한 뻥 성공 시)
- 뻥 중 손패가 0장이 되면 라운드 종료

2. 바가지 시스템
- 드로우한 직후 손패 내 동일한 카드가 2장일 경우
- 자동으로 바가지 판단 서버로 전송 → 메시지 출력 ("바가지!", "노 바가지!")

3. 족보 완성
[조건]
손패가 6장일 때 아래 중 하나에 해당되면 "족보 완성" 버튼 활성화:
- 스트레이트: 연속 숫자 6장
- 트리플트리플: 동일 숫자 3장 + 3장
- 페어페어페어: 동일 숫자 2장 x 3쌍
- 로우 족보: 숫자 총합 ≤ 14 → -100점
- 하이 족보: 숫자 총합 ≥ 65 → -총합 점수

[효과]
- "족보 완성!" 클릭 시 라운드 즉시 종료
- 족보 유형에 따라 감점 또는 0점 처리

4. 스탑
[조건]
- 자신의 턴에 “스탑!” 버튼 클릭 가능

[효과]
- 본인보다 점수가 같거나 낮은 플레이어가 있으면:
  본인 +30점, 그 플레이어들은 0점
  나머지는 손패 기준 점수 유지

5. 점수 계산
[기본]
- 카드 숫자 총합 (A=1, J=11, Q=12, K=13)

[예외]
- 같은 숫자 3장만 있을 경우 → 해당 3장은 0점
- 트리플트리플 → 0점
- 페어페어페어 → 0점
- 스트레이트 → -총합
- 로우 족보 → -100점
- 하이 족보 → -총합
- 스탑 성공 → +50점

[최종 라운드 보너스]
- 5라운드는 점수 2배 적용(설정 가능)

📋 라운드 종료 조건
- 손패가 0장일 때
- 덱이 소진되었을 때
- 족보 완성 버튼 클릭 시
- 스탑 선언 시
- 뻥 중 손패가 0장일 때`}
    </>
  );

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

  const handleLogoClick = () => {
    if (logoClickCountRef.current === 0) {
      logoClickTimeoutRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 3000);
    }
    logoClickCountRef.current += 1;

    if (logoClickCountRef.current >= 10) {
      setShowEasterEgg(true);
      logoClickCountRef.current = 0;
      if (logoClickTimeoutRef.current)
        clearTimeout(logoClickTimeoutRef.current);
      setTimeout(() => setShowEasterEgg(false), 3000);
    }
  };

  const confirmCreateRoom = () => {
    if (nickname.trim() === "임진한") {
      router.push("/dev-easteregg");
      return;
    }
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
      {/* 우상단 버튼 */}
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

      {/* 업데이트/공지 모달 (업데이트 탭으로 시작) */}
      <GameRulesModal
        open={showPatchNote}
        onClose={handleClosePatch}
        initialTab="update"
        title="업데이트 / 공지"
        data={{
          update: UPDATE_LIST,
          bugs: BUG_LIST,
          future: FUTURE_LIST,
          // 규칙 탭에 내용도 함께 넘겨두면 "게임 설명 보기" 안 눌러도 규칙 확인 가능
          rules: RULES_CONTENT,
        }}
      />

      <div className="text-center mb-8">
        <div
          onClick={handleLogoClick}
          className="text-6xl font-extrabold text-black transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500 hover:to-yellow-400 hover:text-transparent hover:bg-clip-text cursor-pointer"
        >
          뻥카비
        </div>
        <p className="text-sm mt-1 text-gray-600 italic">
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-200 border border-yellow-400 text-yellow-900 px-6 py-3 rounded-xl shadow-xl z-50 animate-bounce text-center text-lg font-bold">
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

      {/* 규칙 모달 (규칙 탭으로 시작) */}
      <button
        onClick={() => setShowRules(true)}
        className="mt-6 text-sm underline text-blue-600 hover:text-blue-800"
      >
        게임 설명 보기
      </button>
      <GameRulesModal
        open={showRules}
        onClose={() => setShowRules(false)}
        initialTab="rules"
        data={{
          rules: RULES_CONTENT,
          update: UPDATE_LIST,
          bugs: BUG_LIST,
          future: FUTURE_LIST,
        }}
      />

      <div className="mt-2 text-sm text-gray-500 text-center">
        © 임진한 (국민대 정보보안암호수학과 23) ver.5.6.19
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
