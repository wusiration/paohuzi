// 简易音效管理器：使用 Web Audio API 合成占位音效
// 后续可替换为真实音频文件

export type SoundType =
  | 'deal'
  | 'draw'
  | 'discard'
  | 'chi'
  | 'peng'
  | 'pao'
  | 'ti'
  | 'wei'
  | 'hu'
  | 'pass'
  | 'win'
  | 'click';

class SoundManager {
  private enabled = true;
  private ctx: AudioContext | null = null;

  isEnabled() {
    return this.enabled;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    return this.ctx;
  }

  play(type: SoundType) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // 用户首次交互前可能处于 suspended 状态
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    switch (type) {
      case 'deal':
        this.playNoise(120, 0.05, 0.08);
        break;
      case 'draw':
        this.playTone(400, 0.08, 'sine', 0.12);
        break;
      case 'discard':
        this.playNoise(200, 0.06, 0.1);
        break;
      case 'chi':
        this.playSequence([523, 659], 0.08, 0.1);
        break;
      case 'peng':
        this.playSequence([392, 523, 659], 0.08, 0.12);
        break;
      case 'pao':
      case 'ti':
        this.playSequence([440, 554, 659, 880], 0.1, 0.15);
        break;
      case 'wei':
        this.playSequence([523, 659, 784], 0.08, 0.12);
        break;
      case 'hu':
      case 'win':
        this.playSequence([523, 659, 784, 1047], 0.12, 0.2);
        break;
      case 'pass':
        this.playTone(300, 0.05, 'triangle', 0.08);
        break;
      case 'click':
        this.playTone(600, 0.03, 'sine', 0.05);
        break;
    }
  }

  private playTone(frequency: number, duration: number, waveform: OscillatorType, volume: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playSequence(frequencies: number[], noteDuration: number, volume: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    frequencies.forEach((freq, index) => {
      const start = ctx.currentTime + index * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration);
    });
  }

  private playNoise(frequency: number, duration: number, volume: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }
}

export const soundManager = new SoundManager();
