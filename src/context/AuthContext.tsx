"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type User = { uid: string; username: string; nickname: string; emoji?: string };

type Ctx = {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (
    username: string,
    password: string,
    nickname: string,
    emoji?: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  emoji: string;
  setEmoji: (e: string) => void;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emoji, setEmoji] = useState("🐶");

  // 부팅 시 서버 세션 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data.user) {
          setUser({
            uid: data.user.uid,
            username: data.user.username,
            nickname: data.user.nickname,
            emoji: data.user.emoji,
          });
          if (data.user.emoji) setEmoji(data.user.emoji);
        } else {
          setUser(null);
        }
      } catch {}
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const { user: u } = await res.json();
    setUser({
      uid: u.id,
      username: u.username,
      nickname: u.nickname,
      emoji: u.emoji,
    });
    if (u.emoji) setEmoji(u.emoji);
    return true;
  };

  const signup = async (
    username: string,
    password: string,
    nickname: string,
    e?: string
  ) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, nickname, emoji: e }),
    });
    if (!res.ok) return false;
    const { user: u } = await res.json();
    setUser({
      uid: u.id,
      username: u.username,
      nickname: u.nickname,
      emoji: u.emoji,
    });
    if (u.emoji) setEmoji(u.emoji);
    return true;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setEmoji("🐶");
  };

  return (
    <AuthContext.Provider
      value={{ user, login, signup, logout, emoji, setEmoji }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
