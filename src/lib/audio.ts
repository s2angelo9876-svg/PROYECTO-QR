import type { SoundType } from '@/types/attendance';

class SoundManager {
  private sounds: Partial<Record<SoundType, HTMLAudioElement>> = {};
  private muted = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.sounds = {
      success: new Audio('/sounds/success.wav'),
      warning: new Audio('/sounds/warning.wav'),
      error: new Audio('/sounds/error.wav'),
    };
    Object.values(this.sounds).forEach((audio) => {
      if (audio) {
        audio.preload = 'auto';
        audio.volume = 0.6;
      }
    });
  }

  play(type: SoundType): void {
    if (this.muted) return;
    const audio = this.sounds[type];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn(`[Audio] No se pudo reproducir "${type}":`, err.message);
    });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }
}

let instance: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!instance) instance = new SoundManager();
  return instance;
}

export const soundManager = getSoundManager();
