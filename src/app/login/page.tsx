"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  useEffect(() => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
    }
  }, []);

  const handleLogin = () => {
    window.Kakao.Auth.login({
      scope: "profile_nickname, profile_image",
      success(auth: any) {
        const accessToken = auth.access_token;

        fetch("https://api.bbungkabe.com/auth/kakao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        })
          .then((res) => res.json())
          .then((data) => {
            localStorage.setItem("token", data.token);

            fetch("https://api.bbungkabe.com/auth/me", {
              headers: { Authorization: `Bearer ${data.token}` },
            })
              .then((res) => res.json())
              .then((userData) => {
                setUser(userData);
                router.push("/"); // ✅ 여기서 홈으로 이동
              });
          });
      },
      fail(err: any) {
        alert("로그인 실패: " + JSON.stringify(err));
      },
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">카카오 로그인</h1>
      <button
        onClick={handleLogin}
        className="bg-yellow-400 px-4 py-2 rounded text-black"
      >
        카카오로 로그인
      </button>
    </div>
  );
}
