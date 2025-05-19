// src/lib/sound.ts
export function playSound(name: string) {
  const audio = new Audio(`/sounds/${name}`);
  audio.volume = 0.7; // 볼륨 조절
  audio.play().catch((err) => console.warn("사운드 재생 실패:", err));
}

let bgAudio: HTMLAudioElement | null = null;
export function playBackgroundMusic() {
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
