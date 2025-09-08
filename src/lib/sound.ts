// src/lib/sound.ts
let soundEnabled = true;

export function toggleSound() {
  soundEnabled = !soundEnabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function playSound(name: string) {
  if (!soundEnabled) return; // 🔇 설정되었으면 재생 안 함
  const audio = new Audio(`/sounds/${name}`);
  audio.volume = 0.7;
  audio.play().catch((err) => console.warn("사운드 재생 실패:", err));
}

let bgAudio: HTMLAudioElement | null = null;
export function playBackgroundMusic() {
  if (!soundEnabled) return; // 🔇 사운드 OFF일 때 배경음도 재생 안 함
  if (!bgAudio) {
    bgAudio = new Audio("/sounds/background.mp3");
    bgAudio.loop = true;
    bgAudio.volume = 0.3;
    bgAudio.play().catch((err) => console.warn("배경음악 재생 실패:", err));
  }
}

// --- 뻥 레이어드 사운드 (bbung + impact + BGM 덕킹) ---
export function playLayeredBbung() {
  if (!soundEnabled) return;
  try {
    const bb = new Audio("/sounds/bbung.wav");
    bb.volume = 0.75;
    void bb.play();

    // const impact = new Audio("/sounds/impact.wav"); // 100~200ms 저역 '쿵' 파일 준비
    // impact.volume = 0.6;
    // void impact.play();

    // BGM 볼륨 잠깐 낮췄다가 복원
    if (bgAudio) {
      const prev = bgAudio.volume;
      bgAudio.volume = Math.max(0, prev - 0.25);
      setTimeout(() => {
        if (bgAudio) bgAudio.volume = prev;
      }, 1000);
    }
  } catch (e) {
    console.warn("뻥 사운드 레이어 재생 실패:", e);
  }
}

export function stopBackgroundMusic() {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
    bgAudio = null;
  }
}
