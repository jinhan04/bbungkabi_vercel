"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get("code") || "";

  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState("🐶");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { setEmoji: setGlobalEmoji } = useAuth();

  const handleJoin = () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력하세요");
      return;
    }
    setGlobalEmoji(emoji); // ✅ AuthContext에 반영
    router.push(
      `/lobby?code=${roomCode}&nickname=${encodeURIComponent(nickname)}`
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <h1 className="text-2xl font-bold mb-4">닉네임 입력</h1>

      {/* ✅ 이모지 선택 버튼 */}
      <button
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        className="text-4xl mb-2"
        title="이모지 선택"
      >
        {emoji}
      </button>

      {/* ✅ 이모지 선택 팝업 */}
      {showEmojiPicker && (
        <div className="grid grid-cols-5 gap-2 bg-white border p-4 rounded shadow mb-4 text-2xl">
          {["🐶", "🐱", "🐻", "🐸", "🐵", "🐯", "🦊", "🐼", "🦁", "🐷"].map(
            (e) => (
              <button
                key={e}
                onClick={() => {
                  setEmoji(e);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-110 transition-transform"
              >
                {e}
              </button>
            )
          )}
        </div>
      )}

      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="닉네임을 입력하세요"
        className="border px-4 py-2 rounded w-64 text-center mb-4 text-black"
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
