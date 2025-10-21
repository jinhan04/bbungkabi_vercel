// src\app\signup\page.tsx
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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !nickname || !password) {
      setErr("모든 항목을 입력하세요.");
      return;
    }
    setErr(null);
    setLoading(true);
    const ok = await signup(
      username.trim().toLowerCase(),
      password,
      nickname.trim(),
      emoji
    );
    setLoading(false);
    if (!ok) {
      setErr("회원가입 실패(중복 아이디 등)");
      return;
    }
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
            autoComplete="username"
            minLength={3}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="nickname"
            minLength={1}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <div>
            <div className="text-sm mb-1">이모지(선택)</div>
            <div className="grid grid-cols-8 gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
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

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded"
          >
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <button
          onClick={() => router.push("/login")}
          className="mt-3 text-sm text-blue-600 underline"
          type="button"
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
