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

export function stopBackgroundMusic() {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
    bgAudio = null;
  }
}
