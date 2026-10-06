/**
 * Web Audio API Notification & Chime Synthesizer Service
 * Produces crisp, delay-free melodic bell chimes without relying on external MP3 assets.
 */

export interface AudioSettings {
  soundEnabled: boolean;
  speechEnabled: boolean;
  volume: number; // 0.0 - 1.0
}

const STORAGE_KEY = 'franchise_audio_settings';

class AudioNotificationService {
  private audioCtx: AudioContext | null = null;
  private settings: AudioSettings = {
    soundEnabled: true,
    speechEnabled: false,
    volume: 0.85,
  };

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  public saveSettings(newSettings: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore
    }
    return this.settings;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Phát chuông báo âm thanh chuẩn POS (Ting-Ting)
   * @param type 'standard' (đơn mới thường) | 'urgent' (đơn online gấp) | 'alert' (cảnh báo nguyên liệu)
   */
  public playOrderChime(type: 'standard' | 'urgent' | 'alert' = 'standard'): void {
    if (!this.settings.soundEnabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const masterVol = Math.max(0, Math.min(1, this.settings.volume));
      const now = ctx.currentTime;

      if (type === 'standard') {
        // Hợp âm 2 nốt ngân vang: G5 (784Hz) -> C6 (1046.5Hz)
        this.createTone(ctx, 783.99, now, 0.28, masterVol * 0.7, 'triangle');
        this.createTone(ctx, 1567.98, now, 0.20, masterVol * 0.25, 'sine'); // Hài âm lấp lánh

        this.createTone(ctx, 1046.50, now + 0.16, 0.65, masterVol * 0.9, 'triangle');
        this.createTone(ctx, 2093.00, now + 0.16, 0.45, masterVol * 0.3, 'sine');
      } else if (type === 'urgent') {
        // Chuông 3 nốt dồn dập: D5 (587.3Hz) -> G5 (784Hz) -> D6 (1174.6Hz)
        this.createTone(ctx, 587.33, now, 0.18, masterVol * 0.8, 'sine');
        this.createTone(ctx, 783.99, now + 0.12, 0.20, masterVol * 0.85, 'sine');
        this.createTone(ctx, 1174.66, now + 0.24, 0.70, masterVol * 1.0, 'triangle');
      } else if (type === 'alert') {
        // Cảnh báo 2 nhịp ngắn 440Hz (A4)
        this.createTone(ctx, 440, now, 0.15, masterVol * 0.8, 'sawtooth');
        this.createTone(ctx, 440, now + 0.20, 0.15, masterVol * 0.8, 'sawtooth');
      }
    } catch (err) {
      console.warn('Web Audio playback error:', err);
    }
  }

  private createTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    gainLevel: number,
    type: OscillatorType = 'sine'
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // ADSR Envelope: Fast attack, exponential decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * Đọc giọng nói thông báo Tiếng Việt qua Web Speech API
   */
  public speakAnnouncement(text: string): void {
    if (!this.settings.speechEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Dừng câu đang đọc dở nếu có
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05; // Đọc nhanh hơn 1 chút cho năng động
      utterance.volume = this.settings.volume;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech error
    }
  }

  /**
   * Phát chuông thử nghiệm
   */
  public testSound(): void {
    this.playOrderChime('standard');
    if (this.settings.speechEnabled) {
      setTimeout(() => {
        this.speakAnnouncement('Đơn hàng mới');
      }, 400);
    }
  }
}

export const audioNotifier = new AudioNotificationService();
