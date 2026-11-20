export const MUSIC_TRACKS = Object.freeze({
  'darkest-child': { title: 'Darkest Child', file: 'darkest-child.mp3' },
  intervention: { title: 'Intervention (No Piano Melody)', file: 'intervention.mp3' },
  solitude: { title: 'In Search Of Solitude', file: 'solitude.mp3' },
  signal: { title: 'Signal to Noise (No Piano Melody)', file: 'signal.mp3' },
  anabasis: { title: 'Anabasis I', file: 'anabasis.mp3' },
  katabasis: { title: 'Katabasis I', file: 'katabasis.mp3' },
  'long-dark': { title: 'The Long Dark', file: 'long-dark.mp3' },
});
export const THEME_TRACK = 'darkest-child';
export const INTERVIEW_TRACK = 'intervention';
// Begin just after the original attack at ~2.089 s. The earlier 29 ms
// pre-roll exposed a little preceding noise; keep only the clean note.
export const ENTRY_START_SECONDS = 2.10;
export const MONTH_TRACKS = Object.freeze(['darkest-child', 'darkest-child', 'anabasis', 'katabasis']);
export const MUSIC_DEFAULTS = Object.freeze({ volume: .42, muted: false, effectsVolume: 1, masterMuted: false });
export const MUSIC_SETTINGS_KEY = 'roc-preview:roc-music-settings-v1';
export function normalizeSettings(value, fallback = MUSIC_DEFAULTS) {
  return { volume: Number.isFinite(value?.volume) ? Math.max(0, Math.min(1, value.volume)) : fallback.volume,
    muted: typeof value?.muted === 'boolean' ? value.muted : fallback.muted,
    effectsVolume: Number.isFinite(value?.effectsVolume) ? Math.max(0, Math.min(1, value.effectsVolume)) : fallback.effectsVolume ?? 1,
    masterMuted: typeof value?.masterMuted === 'boolean' ? value.masterMuted : fallback.masterMuted ?? false };
}
export function validMusicCommand(cue, detail = {}) {
  if (['menu', 'entry', 'reception', 'interview-open', 'interview-close', 'report-open', 'report-close', 'ending'].includes(cue)) return true;
  if (cue === 'month') return Number.isInteger(detail.month) && detail.month >= 0 && detail.month < 4;
  if (cue === 'crisis') return typeof detail.id === 'string' && detail.id.length > 0 && detail.id.length < 180;
  return false;
}
