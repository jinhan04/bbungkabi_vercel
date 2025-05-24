"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";

  const [nickname, setNickname] = useState("");

  const handleJoin = () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력하세요");
      return;
    }
    router.push(
      `/lobby?code=${roomCode}&nickname=${encodeURIComponent(nickname)}`
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <h1 className="text-2xl font-bold mb-4">닉네임 입력</h1>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임을 입력하세요"
        className="border px-4 py-2 rounded w-64 text-center mb-4"
      />
      <button
        onClick={handleJoin}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded"
      >
        입장하기
      </button>
    </div>
  );
}
