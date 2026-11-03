/**
 * Música de fundo em loop contínuo.
 * - WebAudio (quando o arquivo pode ser baixado): cada volta começa um pouco antes da anterior terminar,
 *   com fade cruzado, para não ter "pulo" nem silêncio na emenda.
 * - Fallback: <audio loop> (ex.: arquivo aberto direto do disco, onde o download via fetch é bloqueado).
 * Só toca depois de um toque do jogador (regra de autoplay dos navegadores) e pausa quando a aba some.
 */
/** Caminho padrão (Sinuca). Cada jogo passa o seu. */
import { onMountRollback } from './lifecycle';
export const MUSIC_URL = './music/midnight-felt.mp3';
const CROSSFADE = 2.5; // segundos

export class Music {
  private disposed = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;
  private timer = 0;
  private current: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private el: HTMLAudioElement | null = null;
  private wantPlaying = false;
  private _volume = 0.4;
  enabled = true;

  private onVis = () => {
    if (document.hidden) this.suspend();
    else if (this.wantPlaying && this.enabled) this.resume();
  };

  constructor(private url = MUSIC_URL) {
    onMountRollback(() => this.dispose());
    document.addEventListener('visibilitychange', this.onVis);
  }

  /** Para tudo e libera o áudio (ao sair do jogo). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange', this.onVis);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    if (this.el) {
      this.el.src = '';
      this.el = null;
    }
  }

  get volume() {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05);
    if (this.el) this.el.volume = this._volume;
  }

  /** Chamar a partir de um gesto do usuário. Idempotente. */
  start(): void {
    if (this.disposed) return;
    this.wantPlaying = true;
    if (!this.enabled) return;
    if (this.el) {
      void this.el.play().catch(() => undefined);
      return;
    }
    if (this.current) {
      this.resume();
      return;
    }
    if (!this.loading) this.loading = this.load();
    void this.loading.then(() => {
      if (this.wantPlaying && this.enabled && !this.current && this.buffer) this.playFrom(0);
    });
  }

  stop(): void {
    this.wantPlaying = false;
    clearTimeout(this.timer);
    if (this.current) {
      try {
        this.current.src.stop();
      } catch {
        /* já parado */
      }
      this.current = null;
    }
    this.el?.pause();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.start();
    else {
      const keep = this.wantPlaying;
      this.stop();
      this.wantPlaying = keep;
    }
  }

  private suspend() {
    void this.ctx?.suspend().catch(() => undefined);
    this.el?.pause();
  }

  private resume() {
    void this.ctx?.resume().catch(() => undefined);
    if (this.el) void this.el.play().catch(() => undefined);
  }

  private async load(): Promise<void> {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
      const res = await fetch(this.url);
      if (this.disposed) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.arrayBuffer();
      if (this.disposed || !this.ctx) return;
      this.buffer = await this.ctx.decodeAudioData(data);
    } catch {
      if (this.disposed) return;
      // Fallback simples com elemento de áudio.
      void this.ctx?.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
      this.el = new Audio(this.url);
      this.el.loop = true;
      this.el.volume = this._volume;
      if (this.wantPlaying && this.enabled) void this.el.play().catch(() => undefined);
    }
  }

  /** Toca uma volta começando em `when` (tempo do AudioContext) e agenda a próxima com fade cruzado. */
  private playFrom(when: number): void {
    const ctx = this.ctx!;
    const buf = this.buffer!;
    const t0 = Math.max(ctx.currentTime + 0.05, when);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain).connect(this.master!);
    const first = !this.current;
    gain.gain.setValueAtTime(first ? 1 : 0, t0);
    if (!first) gain.gain.linearRampToValueAtTime(1, t0 + CROSSFADE);
    const end = t0 + buf.duration;
    gain.gain.setValueAtTime(1, end - CROSSFADE);
    gain.gain.linearRampToValueAtTime(0, end);
    src.start(t0);
    src.stop(end + 0.05);
    this.current = { src, gain };
    const nextAt = end - CROSSFADE;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(
      () => {
        if (this.wantPlaying && this.enabled && this.ctx) this.playFrom(nextAt);
      },
      Math.max(0, (nextAt - ctx.currentTime - 1) * 1000),
    );
  }
}
