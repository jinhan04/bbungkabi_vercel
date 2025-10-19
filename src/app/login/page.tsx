"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const EMOJIS = [
  "😀",
  "😎",
  "🤖",
  "🦊",
  "🐯",
  "🐼",
  "🐧",
  "🐸",
  "🐤",
  "🐳",
  "🦄",
  "👾",
  "🐶",
  "🐱",
  "🐻",
];

// ✅ useSearchParams()를 사용하는 부분을 분리
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>("🐶");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return alert("닉네임을 입력하세요.");
    login(name, emoji);
    const next = searchParams.get("next") || "/";
    router.replace(next);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-900 text-white p-6">
      <div className="bg-white text-black rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h1 className="text-xl font-bold mb-1">뻥카비 로그인</h1>
        <p className="text-sm text-gray-600 mb-4">닉네임만으로 간단 로그인</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold">닉네임</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예) 지난"
              maxLength={12}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">이모지(선택)</label>
            <div className="mt-2 grid grid-cols-8 gap-2">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e === emoji ? undefined : e)}
                  className={`border rounded-lg px-2 py-1 transition ${
                    e === emoji
                      ? "bg-green-200 border-green-500"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg"
          >
            입장하기
          </button>
        </form>
      </div>
    </div>
  );
}

// ✅ Suspense 경계로 감싸기 (필수)
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">로딩중…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
