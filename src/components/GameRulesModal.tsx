// src/components/GameRulesModal.tsx
"use client";

import React, { useEffect, useState } from "react";

type TabKey = "rules" | "update" | "bugs" | "future";

type ModalData = {
  rules?: React.ReactNode; // 규칙(리치 텍스트 가능)
  update?: string[]; // 업데이트 목록
  bugs?: string[]; // 버그 목록
  future?: string[]; // 앞으로 개선 목록
};

export default function GameRulesModal({
  open,
  onClose,
  initialTab = "rules",
  data = {},
  title = "🎴 뻥카비 안내",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabKey;
  data?: ModalData;
  title?: string;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white text-black rounded-lg w-[92%] max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
          >
            닫기
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-gray-50 border-b">
          <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
            📖 규칙
          </TabButton>
          <TabButton active={tab === "update"} onClick={() => setTab("update")}>
            📝 업데이트
          </TabButton>
          <TabButton active={tab === "bugs"} onClick={() => setTab("bugs")}>
            🐞 버그
          </TabButton>
          <TabButton active={tab === "future"} onClick={() => setTab("future")}>
            🚀 앞으로 개선
          </TabButton>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[65vh] text-sm leading-6">
          {tab === "rules" && (
            <div className="space-y-2 whitespace-pre-wrap">
              {data.rules ?? "게임 규칙 설명이 여기에 표시됩니다."}
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm border ${
        active
          ? "bg-black text-white border-black"
          : "bg-white hover:bg-gray-100 border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function SectionList({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items && items.length > 0 ? (
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
