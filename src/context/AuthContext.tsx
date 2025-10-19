"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// 저장 키
const LS_USER_KEY = "bbungkabi:user";
const COOKIE_NAME = "bbungkabi_auth";

export interface User {
  id: string;
  kakaoId: string; // 추후 카카오 연동 대비 (지금은 "")
  nickname: string;
  profileImage: string | null;
  createdAt: string; // ISO string
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void; // 하위 호환 유지
  emoji: string;
  setEmoji: (emoji: string) => void; // 하위 호환 유지
  login: (nickname: string, emoji?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emoji, setEmoji] = useState("🐶"); // 기본 이모지

  // 부팅 시 세션 복구 (로컬스토리지 → 상태)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_USER_KEY);
      if (raw) {
        const saved: User & { emoji?: string } = JSON.parse(raw);
        setUser(saved);
        if (saved.emoji) setEmoji(saved.emoji);
        // 미들웨어 보호 라우팅용 쿠키 보정
        document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${
          60 * 60 * 24 * 7
        }`;
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }, []);

  const login = (nickname: string, pickedEmoji?: string) => {
    const u: User & { emoji?: string } = {
      id: crypto.randomUUID(),
      kakaoId: "",
      nickname: nickname.trim(),
      profileImage: null,
      createdAt: new Date().toISOString(),
      emoji: pickedEmoji,
    };
    setUser(u);
    if (pickedEmoji) setEmoji(pickedEmoji);

    localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
    // 미들웨어에서 판별할 쿠키(서버 세션 없이 보호 라우팅 가능)
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 7}`;
  };

  const logout = () => {
    setUser(null);
    setEmoji("🐶");
    localStorage.removeItem(LS_USER_KEY);
    // 쿠키 제거
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, emoji, setEmoji, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 내에서만 사용해야 합니다.");
  }
  return context;
}
