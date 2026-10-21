import { reactive, watch } from 'vue';

/**
 * Sound effects and background music, synthesized with the Web Audio API so
 * there are no audio files to download or license. Browsers only allow audio
 * after a user gesture, so the context is created/resumed on the first tap or
 * key press.
 */

export type SoundEffect =
  | 'tick'
  | 'countdown'
  | 'go'
  | 'answer'
  | 'correct'
  | 'wrong'
  | 'reveal'
  | 'join'
  | 'whoosh'
  | 'fanfare'
  | 'timeUp';

export type MusicTrack = 'lobby' | 'question';

const SETTINGS_KEY = 'quiz-pro:audio';

function readSettings(): { sfx: boolean; music: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { sfx: true, music: true, ...(JSON.parse(raw) as object) };
  } catch {
    // Use the defaults.
  }
  return { sfx: true, music: true };
}

/** User preferences; persisted across visits. */
export const audioSettings = reactive(readSettings());

watch(audioSettings, (value) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // Ignore.
  }
});

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);
// Handy pitches (semitones from A4).
const C5 = 3;
const E5 = 7;
const G5 = 10;
const C6 = 15;

type Wave = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private track: MusicTrack | null = null;
  private scheduler: ReturnType<typeof setInterval> | undefined;
  private nextBeat = 0;
  private beat = 0;

  constructor() {
    watch(
      () => audioSettings.music,
      (on) => {
        if (!on) this.silenceMusic();
        else if (this.track) this.runMusic();
      },
    );
  }

  /** Must run inside a user gesture at least once. */
  unlock(): void {
    const ctx = this.context();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  play(effect: SoundEffect): void {
    if (!audioSettings.sfx) return;
    const ctx = this.context();
    if (!ctx || !this.sfxBus || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    switch (effect) {
      case 'tick':
        this.tone(1200, t, 0.03, 'square', 0.08);
        break;
      case 'countdown':
        this.tone(660, t, 0.15, 'sine', 0.3);
        break;
      case 'go':
        this.slide(660, 1320, t, 0.22, 'triangle', 0.3);
        break;
      case 'answer':
        this.slide(520, 820, t, 0.08, 'sine', 0.25);
        break;
      case 'join':
        this.slide(600, 950, t, 0.1, 'sine', 0.2);
        break;
      case 'correct':
        [C5, E5, G5].forEach((n, i) => this.tone(NOTE(n), t + i * 0.08, 0.14, 'triangle', 0.3));
        break;
      case 'wrong':
        this.slide(240, 140, t, 0.35, 'sawtooth', 0.15);
        break;
      case 'reveal':
        this.tone(NOTE(C5), t, 0.12, 'triangle', 0.25);
        this.tone(NOTE(G5), t + 0.1, 0.25, 'triangle', 0.25);
        break;
      case 'whoosh':
        this.slide(300, 1200, t, 0.25, 'sine', 0.12);
        break;
      case 'timeUp':
        this.tone(300, t, 0.25, 'square', 0.12);
        break;
      case 'fanfare':
        [C5, E5, G5, C6].forEach((n, i) => this.tone(NOTE(n), t + i * 0.14, i === 3 ? 0.7 : 0.16, 'triangle', 0.3));
        [C5 - 12, G5 - 12].forEach((n) => this.tone(NOTE(n), t + 0.42, 0.7, 'sine', 0.2));
        break;
    }
  }

  /** Starts (or switches to) a looping track. */
  music(track: MusicTrack | null): void {
    if (this.track === track) return;
    this.track = track;
    this.silenceMusic();
    if (track) this.runMusic();
  }

  private runMusic(): void {
    if (!audioSettings.music || !this.track) return;
    const ctx = this.context();
    if (!ctx || !this.musicBus) return;
    this.beat = 0;
    this.nextBeat = ctx.currentTime + 0.1;
    // Look-ahead scheduling: queue notes slightly ahead of time so timing stays tight.
    this.scheduler = setInterval(() => this.scheduleAhead(), 50);
  }

  private silenceMusic(): void {
    clearInterval(this.scheduler);
    this.scheduler = undefined;
  }

  private scheduleAhead(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.track) return;
    const bpm = this.track === 'lobby' ? 104 : 140;
    const step = 60 / bpm / 2; // eighth notes
    // After the context was suspended, skip missed beats instead of playing them all at once.
    if (this.nextBeat < ctx.currentTime - step) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.2) {
      if (this.track === 'lobby') this.lobbyStep(this.beat, this.nextBeat, step);
      else this.questionStep(this.beat, this.nextBeat, step);
      this.nextBeat += step;
      this.beat += 1;
    }
  }

  /** I–vi–IV–V arpeggios with a soft bass. */
  private lobbyStep(beat: number, t: number, step: number): void {
    const chords = [
      [C5 - 12, E5 - 12, G5 - 12, C5],
      [0 - 12, C5 - 12, E5 - 12, 0],
      [-4 - 12, 0 - 12, C5 - 12, -4],
      [-2 - 12, 2 - 12, G5 - 12 - 3, -2],
    ];
    const chord = chords[Math.floor(beat / 8) % chords.length]!;
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    this.tone(NOTE(chord[pattern[beat % 8]!]!), t, step * 0.9, 'triangle', 0.12, this.musicBus);
    if (beat % 4 === 0) this.tone(NOTE(chord[0]! - 12), t, step * 3.5, 'sine', 0.18, this.musicBus);
  }

  /** A driving minor pulse that keeps the tension up while players answer. */
  private questionStep(beat: number, t: number, step: number): void {
    const bass = [-9, -9, -9, -9, -5, -5, -7, -7];
    this.tone(NOTE(bass[Math.floor(beat / 2) % bass.length]! - 12), t, step * 0.6, 'square', 0.06, this.musicBus);
    if (beat % 2 === 1) this.tone(NOTE(3), t, step * 0.3, 'triangle', 0.05, this.musicBus);
    if (beat % 8 === 0) this.tone(90, t, 0.12, 'sine', 0.3, this.musicBus);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.6;
    this.musicBus.connect(master);
    this.ctx = ctx;
    return ctx;
  }

  private tone(freq: number, start: number, duration: number, wave: Wave, volume: number, bus = this.sfxBus): void {
    this.slide(freq, freq, start, duration, wave, volume, bus);
  }

  private slide(
    from: number,
    to: number,
    start: number,
    duration: number,
    wave: Wave,
    volume: number,
    bus = this.sfxBus,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    // Short attack and exponential release avoid clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const sound = new SoundEngine();

/** Call once at startup: unlocks audio on the first user interaction. */
export function installAudioUnlock(): void {
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}
