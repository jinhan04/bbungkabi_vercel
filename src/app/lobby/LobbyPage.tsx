"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import GameRulesModal from "@/components/GameRulesModal";

type UserInfo = { coin: number; tier: string; wins: number; losses: number };

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

export default function LobbyMainPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState("🐶");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(true); // 💡 광고 토글 상태

  useEffect(() => {
    const storedNickname = localStorage.getItem("nickname");
    const storedEmoji = localStorage.getItem("emoji") || "🐶";

    if (!storedNickname) {
      router.push("/");
      return;
    }

    setNickname(storedNickname);
    setEmoji(storedEmoji);

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("join-room", {
      roomCode: "LOBBY_MAIN",
      nickname: storedNickname,
      emoji: storedEmoji,
    });

    socket.on("user-info", (data: UserInfo) => setUserInfo(data));

    return () => {
      socket.off("user-info");
    };
  }, [router]);

  const createRoom = () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room?code=${newCode}&nickname=${nickname}&emoji=${emoji}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("nickname");
    localStorage.removeItem("emoji");
    getSocket().disconnect();
    router.push("/");
  };

  const getTierInfo = (tier: string) => {
    if (tier === "Gold")
      return { name: "골드", color: "text-amber-500", bg: "bg-amber-100" };
    if (tier === "Silver")
      return { name: "실버", color: "text-slate-500", bg: "bg-slate-100" };
    return { name: "브론즈", color: "text-orange-700", bg: "bg-orange-100" };
  };

  return (
    <div className="min-h-screen bg-orange-50 p-4 md:p-8 flex flex-col items-center pb-32 relative">
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

      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-orange-500 flex items-center gap-2">
          🃏 뻥카비 로비
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRules(true)}
            className="bg-white px-4 py-2 rounded-full text-sm font-bold text-orange-500 shadow-sm hover:bg-orange-50 transition-colors border border-orange-200"
          >
            📖 규칙
          </button>
          <button
            onClick={handleLogout}
            className="bg-white px-4 py-2 rounded-full text-sm font-bold text-gray-500 shadow-sm hover:bg-gray-50 transition-colors border border-gray-200"
          >
            로그아웃
          </button>
        </div>
      </div>

      {userInfo && (
        <div className="w-full max-w-4xl bg-white border-[3px] border-orange-200 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center shadow-lg mb-8 gap-6 md:gap-0">
          <div className="flex items-center gap-4">
            <div className="text-5xl bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm border border-orange-100">
              {emoji}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 mb-1">
                {nickname} 님의 계정
              </p>
              <div
                className={`inline-block px-3 py-1 rounded-full text-sm font-black ${getTierInfo(userInfo.tier).bg} ${getTierInfo(userInfo.tier).color}`}
              >
                {getTierInfo(userInfo.tier).name} 티어
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center md:border-x-2 border-dashed border-gray-200 md:px-12 w-full md:w-auto">
            <p className="text-sm font-bold text-gray-500 mb-1">내 지갑</p>
            <p className="text-3xl font-black text-gray-800">
              {userInfo.coin.toLocaleString()}{" "}
              <span className="text-xl text-yellow-500">🪙</span>
            </p>
          </div>

          <div className="text-center md:text-right">
            <p className="text-sm font-bold text-gray-500 mb-1">내 전적</p>
            <p className="text-xl font-bold bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <span className="text-blue-500">{userInfo.wins}승</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-red-500">{userInfo.losses}패</span>
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 방 만들기 버튼 */}
        <button
          onClick={createRoom}
          className="w-full h-full min-h-[200px] bg-orange-100 border-4 border-dashed border-orange-300 rounded-3xl flex flex-col items-center justify-center text-orange-600 hover:bg-orange-200 hover:border-orange-400 transition-all group shadow-sm"
        >
          <div className="text-5xl mb-2 group-hover:scale-110 transition-transform bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-sm">
            +
          </div>
          <div className="font-bold text-lg mt-2">새 게임방 만들기</div>
        </button>

        {/* 방 입장하기 토글 영역 */}
        {!isJoining ? (
          <button
            onClick={() => setIsJoining(true)}
            className="w-full h-full min-h-[200px] bg-white border-4 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all group shadow-sm"
          >
            <div className="text-5xl mb-2 group-hover:scale-110 transition-transform bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center shadow-sm">
              🚪
            </div>
            <div className="font-bold text-lg mt-2">초대 코드로 입장하기</div>
          </button>
        ) : (
          <div className="w-full h-full min-h-[200px] bg-white border-4 border-orange-400 rounded-3xl flex flex-col items-center justify-center p-6 shadow-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-black text-gray-800 mb-3">
              초대 코드 입력
            </h3>
            <input
              type="text"
              placeholder="6자리 코드 입력"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full bg-gray-50 border-2 border-gray-200 text-center text-2xl tracking-widest font-black py-4 rounded-2xl mb-4 focus:outline-none focus:border-orange-500 uppercase text-gray-800"
            />
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setIsJoining(false)}
                className="flex-1 bg-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (joinCode.length > 0) {
                    router.push(
                      `/room?code=${joinCode}&nickname=${nickname}&emoji=${emoji}`,
                    );
                  }
                }}
                className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors"
              >
                입장!
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col items-center z-10 pb-8">
        <div className="text-xs text-gray-400 font-bold text-center">
          © 임진한 (국민대 정보보안암호수학과 23) ver.5.6.19
        </div>
      </div>

      {/* 💡 하단 고정 쿠팡 배너 (열기/닫기 토글 기능) */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col items-center z-50">
        <button
          onClick={() => setIsAdOpen(!isAdOpen)}
          className="bg-white px-4 py-1.5 rounded-t-xl text-xs font-bold text-gray-400 border border-gray-200 border-b-0 shadow-sm hover:text-orange-500 transition-colors"
        >
          {isAdOpen ? "광고 닫기 ▼" : "광고 보기 ▲"}
        </button>
        {isAdOpen && (
          <div className="w-full flex justify-center bg-white py-2 border-t border-gray-200 shadow-lg">
            <a
              href="https://link.coupang.com/a/cvkq2m"
              target="_blank"
              referrerPolicy="unsafe-url"
            >
              <img
                src="https://ads-partners.coupang.com/banners/868527?subId=&traceId=V0-301-879dd1202e5c73b2-I868527&w=728&h=90"
                alt="쿠팡 광고 배너"
                className="w-full max-w-[728px] h-auto rounded-md"
              />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
