// src/components/TopBar.tsx
"use client";
import { useRouter } from "next/navigation";

export default function TopBar({
  title = "뻥카비",
  right,
}: {
  title?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-black/40 border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-xl font-extrabold tracking-tight hover:opacity-90"
        >
          {title}
        </button>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
