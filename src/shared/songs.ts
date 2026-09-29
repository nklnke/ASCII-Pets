// Pet songs: rare spontaneous singing. Pure data + voice config (no I/O).
// Playback lives in renderer/sound.ts (WebAudio); scheduling in renderer.ts.

export type SongWave = "sine" | "square" | "sawtooth" | "triangle";

export interface SkinVoice {
  wave: SongWave;
  /** Frequency multiplier (vocal range per skin). */
  octave: number;
  gain: number;
  /** Breath gap between notes. */
  gapMs: number;
}

const DEFAULT_VOICE: SkinVoice = { wave: "sine", octave: 2, gain: 0.085, gapMs: 40 };

const SKIN_VOICES: Record<string, SkinVoice> = {
  // Warm high hum, legato.
  cat: { wave: "sine", octave: 2, gain: 0.085, gapMs: 40 },
  // Low barks, detached (real pauses between notes).
  dog: { wave: "square", octave: 1, gain: 0.055, gapMs: 90 },
  // Deep croak, dragging envelope.
  frog: { wave: "sawtooth", octave: 0.5, gain: 0.075, gapMs: 60 },
  // Bright chirp, high and quick.
  bird: { wave: "triangle", octave: 4, gain: 0.06, gapMs: 50 },
};

export function voiceFor(skinId: string): SkinVoice {
  return SKIN_VOICES[skinId] ?? DEFAULT_VOICE;
}

/** One note: semitones from A4 + length in beats. */
export type SongNote = [semi: number, beats: number];

export interface Song {
  name: string;
  notes: SongNote[];
}

const FALLBACK_SONG: Song = { name: "Мурлыканье", notes: [[0, 1]] };

const SONGS: Record<string, Song[]> = {
  cat: [
    { name: "Мурлыканье", notes: [[0, 1], [4, 1], [7, 1], [12, 2], [7, 1], [4, 1], [0, 2], [4, 1], [7, 1], [12, 1], [16, 2], [12, 1], [7, 1], [4, 1], [0, 3]] },
    { name: "Колыбельная", notes: [[7, 1], [5, 1], [4, 1], [2, 1], [0, 2], [2, 1], [4, 2], [4, 1], [2, 1], [0, 1], [-2, 2], [0, 2], [2, 1], [0, 3]] },
    { name: "Серенада", notes: [[0, 1], [0, 1], [4, 1], [7, 1], [12, 1], [11, 1], [7, 2], [12, 1], [11, 1], [7, 1], [4, 1], [7, 2], [4, 1], [0, 3]] },
  ],
  dog: [
    { name: "Гав-блюз", notes: [[0, 1], [0, 1], [3, 1], [0, 1], [-2, 2], [0, 2], [3, 1], [0, 1], [-2, 1], [0, 2], [-5, 1], [-2, 2], [0, 3]] },
    { name: "Марш", notes: [[0, 1], [4, 1], [7, 1], [7, 1], [4, 1], [0, 2], [4, 1], [7, 1], [12, 1], [7, 1], [4, 2], [0, 1], [0, 3]] },
    { name: "Частушка", notes: [[7, 1], [7, 1], [9, 1], [7, 1], [4, 1], [2, 1], [0, 2], [9, 1], [7, 1], [4, 1], [2, 1], [0, 1], [2, 2], [0, 3]] },
  ],
  frog: [
    { name: "Болотная ария", notes: [[0, 2], [-5, 1], [-7, 2], [-5, 1], [0, 2], [-5, 2], [-7, 1], [-12, 2], [-7, 1], [-5, 2], [0, 3]] },
    { name: "Ква-канон", notes: [[0, 1], [0, 1], [0, 1], [-2, 1], [0, 2], [-2, 1], [0, 1], [-2, 1], [0, 1], [-5, 2], [-2, 1], [0, 3]] },
    { name: "Ночная серенада", notes: [[-12, 2], [-7, 1], [-5, 1], [-7, 2], [0, 2], [-7, 1], [-5, 1], [-2, 1], [0, 2], [-2, 1], [-5, 2], [-7, 3]] },
  ],
  bird: [
    { name: "Утренняя трель", notes: [[12, 1], [16, 1], [19, 1], [16, 1], [12, 1], [7, 2], [16, 1], [19, 1], [24, 2], [19, 1], [16, 1], [12, 1], [7, 3]] },
    { name: "Чик-чирик", notes: [[12, 1], [12, 1], [17, 1], [12, 1], [19, 2], [17, 1], [19, 1], [24, 1], [19, 2], [17, 1], [12, 2]] },
    { name: "Полёт", notes: [[7, 1], [12, 1], [16, 2], [19, 1], [24, 2], [19, 1], [24, 1], [24, 2], [19, 1], [16, 2], [12, 3]] },
  ],
};

export const SONG_BEAT_MS = 220;

export function songsFor(skinId: string): Song[] {
  const list = SONGS[skinId];
  return list && list.length > 0 ? list : [FALLBACK_SONG];
}

export function songFor(skinId: string, index: number): Song {
  const list = songsFor(skinId);
  const song = list[((index % list.length) + list.length) % list.length];
  return song ?? FALLBACK_SONG;
}

/** Total playback length (scheduling + the singing-until timestamp). */
export function songDurationMs(skinId: string, index: number): number {
  const song = songFor(skinId, index);
  const voice = voiceFor(skinId);
  return song.notes.reduce((t, [, beats]) => t + beats * SONG_BEAT_MS + voice.gapMs, 0);
}
