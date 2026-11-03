/** Efeitos sonoros sintetizados (sem arquivos). */
export class GolfSfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new C();
    } catch {
      this.ctx = null;
    }
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0.5, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  putt(power: number) {
    this.tone(900, 0.06, 0.25 + power * 0.35, 'triangle', 0.4);
  }
  wall(speed: number) {
    const v = Math.min(1, speed / 25);
    if (v > 0.05) this.tone(220, 0.08, 0.15 + 0.3 * v, 'square', 0.6);
  }
  cup() {
    this.tone(160, 0.25, 0.5, 'sine', 0.5);
    [784, 988, 1319].forEach((f, i) => this.tone(f, 0.25, 0.12, 'sine', 1, 0.18 + i * 0.09));
  }
  /** Bola passou pela borda do buraco rápido demais: "tin" metálico curto. */
  lip() {
    this.tone(1760, 0.09, 0.22, 'triangle', 0.7);
    this.tone(2350, 0.07, 0.12, 'sine', 0.8, 0.05);
  }
  splash() {
    this.tone(400, 0.35, 0.25, 'sawtooth', 0.2);
  }
}
