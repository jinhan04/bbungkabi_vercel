"use client";
import { useEffect, useState } from "react";
import { isSoundEnabled, toggleSound } from "@/lib/sound";

export default function SoundToggleButton() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(isSoundEnabled()), []);
  return (
    <button
      onClick={() => {
        toggleSound();
        setOn(isSoundEnabled());
      }}
      className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
      title={on ? "사운드 ON" : "사운드 OFF"}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
