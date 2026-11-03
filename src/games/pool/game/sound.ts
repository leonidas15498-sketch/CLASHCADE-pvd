/** Sons sintetizados com WebAudio (sem arquivos de áudio externos). */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private budget = 0;

  /** Precisa ser chamado num gesto do usuário (política de autoplay dos navegadores). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  dispose(): void {
    this.enabled = false;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  /** Limita quantidade de sons por quadro. */
  frame(): void {
    this.budget = 6;
  }

  private ok(): AudioContext | null {
    if (!this.enabled || !this.ctx || this.budget <= 0) return null;
    this.budget--;
    return this.ctx;
  }

  private burst(freq: number, q: number, gain: number, dur: number): void {
    const ctx = this.ok();
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(freq: number, gain: number, dur: number): void {
    const ctx = this.ok();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  ball(impulse: number): void {
    const v = Math.min(1, impulse / 3);
    if (v < 0.01) return;
    this.burst(2600, 3, 0.15 + 0.8 * v, 0.05);
  }
  cushion(impulse: number): void {
    const v = Math.min(1, impulse / 3);
    if (v < 0.03) return;
    this.tone(140, 0.25 * v + 0.05, 0.09);
  }
  pocket(): void {
    this.tone(90, 0.5, 0.25);
    this.burst(700, 2, 0.25, 0.18);
  }
  cue(power: number): void {
    this.burst(1500, 1.5, 0.2 + 0.5 * power, 0.06);
  }
  foul(): void {
    this.tone(220, 0.15, 0.3);
  }
  win(): void {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f * 2, 0.12, 0.35), i * 120));
  }
}
