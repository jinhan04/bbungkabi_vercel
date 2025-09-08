// src/components/GameRulesModal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type TabKey = "rules" | "update" | "bugs" | "future";

interface ModalData {
  rules?: React.ReactNode; // 규칙 탭 내용(없으면 기본 텍스트 사용)
  update?: string[];
  bugs?: string[];
  future?: string[];
}

interface GameRulesModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: TabKey;
  title?: string;
  data?: ModalData;
}

// ✅ 기본 규칙(백업용) — page.tsx에서 rules를 안 넘겨줘도 안전하게 노출됨
const DEFAULT_RULES = `📌 기본 정보
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
- 뻥 중 손패가 0장일 때`;

export default function GameRulesModal({
  open,
  onClose,
  initialTab = "rules",
  title = "업데이트 / 공지",
  data = {},
}: GameRulesModalProps) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTab(initialTab), [initialTab]);

  // ESC & 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" ? onClose() : null);
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div
        ref={panelRef}
        className="bg-white text-black rounded-lg w-[92%] max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden"
      >
        {/* Header: 모바일에서 이모지 숨김(sm 이상만 보임) → 잘림 방지 */}
        <div className="flex items-start justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <span
              className="hidden sm:inline text-2xl leading-none"
              aria-hidden
            >
              📌
            </span>
            <h2 className="text-xl font-bold leading-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
          >
            닫기
          </button>
        </div>

        {/* Tabs: 아이콘 위 / 라벨 아래(2줄)로 고정 → 모바일 잘림 방지 */}
        <div className="flex items-stretch gap-2 px-4 pt-3 pb-2 bg-gray-50 border-b">
          <TabButton
            active={tab === "rules"}
            onClick={() => setTab("rules")}
            icon="📖"
            label="규칙"
          />
          <TabButton
            active={tab === "update"}
            onClick={() => setTab("update")}
            icon="📝"
            label="업데이트"
          />
          <TabButton
            active={tab === "bugs"}
            onClick={() => setTab("bugs")}
            icon="🐞"
            label="버그"
          />
          <TabButton
            active={tab === "future"}
            onClick={() => setTab("future")}
            icon="🚀"
            label="앞으로 개선"
          />
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[65vh] text-sm leading-6">
          {tab === "rules" && (
            <div className="whitespace-pre-wrap break-words text-left">
              {data.rules ?? DEFAULT_RULES}
            </div>
          )}

          {tab === "update" && (
            <SectionList title="업데이트 내역" items={data.update} />
          )}
          {tab === "bugs" && (
            <SectionList title="현재 버그" items={data.bugs} />
          )}
          {tab === "future" && (
            <SectionList title="앞으로 개선" items={data.future} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 px-3 py-2 rounded-md text-sm border flex flex-col items-center justify-center
        ${
          active
            ? "bg-black text-white border-black"
            : "bg-white hover:bg-gray-100 border-gray-300"
        }`}
    >
      <span className="text-lg leading-none mb-1" aria-hidden>
        {icon}
      </span>
      <span className="leading-4">{label}</span>
    </button>
  );
}

function SectionList({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items && items.length ? (
        <ul className="list-disc pl-5 space-y-1">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500">내용이 없습니다.</div>
      )}
    </section>
  );
}
