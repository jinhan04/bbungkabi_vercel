// src/components/AppShell.tsx
"use client";
import { ReactNode, PropsWithChildren } from "react";
import TopBar from "./TopBar";

type AppShellBaseProps = {
  title?: string;
  right?: ReactNode;
};

export default function AppShell({
  title,
  right,
  children,
}: PropsWithChildren<AppShellBaseProps>) {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <TopBar title={title} right={right} />
      <main className="max-w-5xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
