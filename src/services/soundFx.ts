/**
 * Pure Web Audio API synthesized sound feedback.
 * 100% offline — zero external audio files or network requests.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  tap(): void {
    this.playTone(520, 0.045, 'sine', 0.05);
  }

  backspace(): void {
    this.playTone(340, 0.05, 'triangle', 0.045);
  }

  hint(): void {
    this.playTone(660, 0.1, 'sine', 0.06, 0);
    this.playTone(880, 0.14, 'sine', 0.06, 0.07);
  }

  error(): void {
    this.playTone(210, 0.12, 'sawtooth', 0.035, 0);
    this.playTone(175, 0.14, 'sawtooth', 0.035, 0.08);
  }

  equationMatch(): void {
    this.playTone(587.33, 0.09, 'sine', 0.05, 0);
    this.playTone(783.99, 0.12, 'sine', 0.05, 0.06);
  }

  victory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.playTone(f, 0.22, 'triangle', 0.075, i * 0.075);
    });
  }
}

export const soundFx = new SoundEffects();
