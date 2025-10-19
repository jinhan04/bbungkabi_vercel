"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await login(username, password);
    if (!ok) return alert("아이디 또는 비밀번호가 틀렸습니다.");
    router.replace(sp.get("next") || "/");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-green-900 text-white p-6">
      <div className="bg-white text-black rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h1 className="text-xl font-bold mb-1">로그인</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded">
            로그인
          </button>
        </form>
        <button
          onClick={() => router.push("/signup")}
          className="mt-3 text-sm text-blue-600 underline"
        >
          회원가입
        </button>
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <LoginForm />
    </Suspense>
  );
}
