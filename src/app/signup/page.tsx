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

function SignupForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { signup } = useAuth();

  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>("🐶");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !nickname || !password)
      return alert("모든 항목을 입력하세요.");
    const ok = await signup(username, password, nickname, emoji);
    if (!ok) return alert("회원가입 실패(중복 아이디 등)");
    router.replace(sp.get("next") || "/");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-green-900 text-white p-6">
      <div className="bg-white text-black rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h1 className="text-xl font-bold mb-2">회원가입</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div>
            <div className="text-sm mb-1">이모지(선택)</div>
            <div className="grid grid-cols-8 gap-2">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e === emoji ? undefined : e)}
                  className={`border rounded px-2 py-1 ${
                    e === emoji ? "bg-green-200 border-green-500" : "bg-white"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded">
            가입하기
          </button>
        </form>
        <button
          onClick={() => router.push("/login")}
          className="mt-3 text-sm text-blue-600 underline"
        >
          로그인으로 이동
        </button>
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <SignupForm />
    </Suspense>
  );
}
