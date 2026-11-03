/** Efeitos sonoros sintetizados compartilhados pelos jogos novos (sem arquivos de áudio). */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private budget = 8;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new C();
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  /** Chamar a cada quadro: limita sons simultâneos. */
  frame(): void {
    this.budget = 8;
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private ok(): AudioContext | null {
    if (!this.enabled || !this.ctx || this.budget <= 0) return null;
    this.budget--;
    return this.ctx;
  }

  tone(freq: number, dur: number, gain = 0.2, type: OscillatorType = 'sine', slide = 1, delay = 0): void {
    const ctx = this.ok();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(freq: number, dur: number, gain = 0.2, q = 2): void {
    const ctx = this.ok();
    if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  win(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 0.12, 'triangle', 1, i * 0.11));
  }
  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 0.12, 'triangle', 1, i * 0.14));
  }
}
