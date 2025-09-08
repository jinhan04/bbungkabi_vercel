"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  id: string;
  kakaoId: string;
  nickname: string;
  profileImage: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  emoji: string;
  setEmoji: (emoji: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emoji, setEmoji] = useState("🐶"); // 기본 이모지

  return (
    <AuthContext.Provider value={{ user, setUser, emoji, setEmoji }}>
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
