"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type User = { id: string; username: string; nickname: string; emoji?: string };

type ApiUser = {
  id: string;
  username: string;
  nickname: string;
  emoji?: string;
};

type ApiOk<T> = { user: T };
type ApiErr = { error?: string };

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

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emoji, setEmoji] = useState("🐶");

  // 부팅 시 서버 세션 확인
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        });
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await safeJson<ApiOk<ApiUser> | ApiErr>(res);
        const u = (data as ApiOk<ApiUser>)?.user;
        if (u) {
          setUser({
            id: u.id,
            username: u.username,
            nickname: u.nickname,
            emoji: u.emoji,
          });
          if (u.emoji) setEmoji(u.emoji);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error("[/api/auth/me] failed:", e);
        setUser(null);
      }
    })();
    return () => ac.abort();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          // "X-CSRF-Token": csrfToken, // 서버에서 사용 시
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await safeJson<ApiOk<ApiUser> | ApiErr>(res);
      if (!res.ok) {
        console.error("[login] failed:", data);
        return false;
      }
      const u = (data as ApiOk<ApiUser>).user;
      setUser({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        emoji: u.emoji,
      });
      if (u.emoji) setEmoji(u.emoji);
      return true;
    } catch (e) {
      console.error("[login] error:", e);
      return false;
    }
  };

  const signup = async (
    username: string,
    password: string,
    nickname: string,
    e?: string
  ) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          // "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ username, password, nickname, emoji: e }),
      });
      const data = await safeJson<ApiOk<ApiUser> | ApiErr>(res);
      if (!res.ok) {
        const msg = (data as ApiErr)?.error || "회원가입 실패";
        // TODO: replace with toast
        alert(msg);
        return false;
      }
      const u = (data as ApiOk<ApiUser>).user;
      setUser({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        emoji: u.emoji,
      });
      if (u.emoji) setEmoji(u.emoji);
      return true;
    } catch (e) {
      console.error("[signup] error:", e);
      alert("네트워크/서버 오류");
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("[logout] error:", e);
    } finally {
      setUser(null);
      setEmoji("🐶");
    }
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
