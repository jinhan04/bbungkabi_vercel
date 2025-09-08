"use client";
import SoundToggleButton from "@/components/SoundToggleButton";
// (2단계에서 사용할 예정) import TurnTimer from "@/components/TurnTimer";

export default function GameTopRight() {
  // roomCode, round 등은 props나 전역/컨텍스트에서 가져오도록 변경 가능
  // 여기서는 일단 예시 하드코드/프롭스로 시작하고 점진적 적용 권장.
  const roomCode =
    typeof window !== "undefined" ? sessionStorage.getItem("roomCode") : null;
  const round =
    typeof window !== "undefined" ? sessionStorage.getItem("round") : null;

  return (
    <div className="flex items-center gap-2">
      {roomCode && (
        <span className="px-2 py-1 text-xs rounded bg-white/10">
          방 {roomCode}
        </span>
      )}
      {round && (
        <span className="px-2 py-1 text-xs rounded bg-white/10">
          라운드 {round}/5
        </span>
      )}
      {/* (다음 단계에서 교체) <TurnTimer seconds={10} remain={timer ?? 10} /> */}
      <SoundToggleButton />
      <button
        className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
        onClick={() =>
          document.dispatchEvent(new CustomEvent("openPatchNotes"))
        }
      >
        패치노트
      </button>
    </div>
  );
}
