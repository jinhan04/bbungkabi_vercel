"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameRulesModal from "@/components/GameRulesModal";

// 선택 가능한 이모지 목록
const EMOJI_LIST = ["🐶", "🐱", "🦊", "🐰", "🐻", "🐼", "🐯", "🦁", "🐸", "🐷"];

const ANNOUNCEMENTS = [
  { date: "2026.02.23", text: "🎉 화사한 보드게임 카페 테마로 새단장 완료!" },
  { date: "2026.02.23", text: "🪙 코인 보상 및 티어 시스템 업데이트" },
  { date: "2026.02.20", text: "🤖 혼자서도 즐길 수 있는 AI 로봇 친구 추가" },
];

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

export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🐶");
  const [showRules, setShowRules] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(true); // 💡 광고 토글 상태
  const router = useRouter();

  // 💡 수정된 자동 로그인 & 자동 입장 로직
  useEffect(() => {
    const storedNickname = localStorage.getItem("nickname");
    const storedEmoji = localStorage.getItem("emoji") || "🐶";

    // URL에 ?code=XXX 가 있는지 확인
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");

    if (storedNickname) {
      if (codeParam) {
        // 초대 코드가 있으면 바로 해당 방으로 직행!
        router.push(
          `/room?code=${codeParam}&nickname=${encodeURIComponent(storedNickname)}&emoji=${encodeURIComponent(storedEmoji)}`,
        );
      } else {
        // 없으면 로비로 이동
        router.push("/lobby");
      }
    }
  }, [router]);

  // 💡 수정된 신규 로그인 & 자동 입장 로직
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("닉네임을 입력해주세요.");

    localStorage.setItem("nickname", nickname.trim());
    localStorage.setItem("emoji", selectedEmoji);

    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");

    if (codeParam) {
      // 로그인 직후 초대 코드가 있으면 해당 방으로 직행!
      router.push(
        `/room?code=${codeParam}&nickname=${encodeURIComponent(nickname.trim())}&emoji=${encodeURIComponent(selectedEmoji)}`,
      );
    } else {
      router.push("/lobby");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-orange-50 px-4 pt-10 pb-32 relative">
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

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border-4 border-orange-100 relative z-10">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-black text-orange-500 mb-3 drop-shadow-sm cursor-pointer">
            🃏 뻥카비
          </h1>
          <p className="text-gray-500 font-bold text-sm">
            가볍게 즐기는 우당탕탕 심리 카드게임!
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="bg-orange-50 p-4 rounded-2xl">
            <label className="block text-sm font-bold text-orange-800 mb-3 text-center">
              어떤 동물로 플레이할까요?
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-3xl w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    selectedEmoji === emoji
                      ? "bg-white shadow-md scale-110 border-2 border-orange-400"
                      : "hover:bg-white/50 opacity-60 hover:opacity-100"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2 text-center">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="멋진 닉네임을 지어주세요"
              className="w-full bg-gray-50 border-2 border-gray-200 text-gray-800 text-center px-5 py-4 rounded-2xl focus:outline-none focus:border-orange-400 focus:bg-white transition-colors text-lg font-bold placeholder-gray-400"
              maxLength={10}
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl font-black text-lg transition-all bg-orange-500 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 hover:scale-[1.02] active:scale-95"
          >
            게임 시작하기
          </button>
        </form>

        <button
          onClick={() => setShowRules(true)}
          className="w-full mt-4 text-sm font-bold text-orange-600 underline hover:text-orange-700 text-center"
        >
          📖 게임 설명 / 업데이트 내역 보기
        </button>
      </div>

      <div className="w-full max-w-md mt-6 bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border-2 border-orange-200 p-6 z-0 mb-8">
        <h2 className="text-lg font-black text-orange-600 mb-4 flex items-center gap-2">
          📢 뻥카비 소식
        </h2>
        <ul className="space-y-3">
          {ANNOUNCEMENTS.map((notice, i) => (
            <li
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm"
            >
              <span className="text-orange-400 font-bold bg-orange-50 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap w-fit border border-orange-100">
                {notice.date}
              </span>
              <span className="text-gray-700 font-bold">{notice.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-col items-center pb-8 z-10">
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
