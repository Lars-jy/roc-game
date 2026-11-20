import { MUSIC_TRACKS, MONTH_TRACKS, THEME_TRACK, INTERVIEW_TRACK, ENTRY_START_SECONDS, normalizeSettings, validMusicCommand } from './catalog.js';

const NEUTRAL_MIX = Object.freeze({ enabled: false, gainFactor: 1, lowpassHz: 22000, highShelfDb: 0, playbackRate: 1, preservesPitch: null });
// The user selected audition 2 for calendar April/May. Dialogue uses its own
// no-melody underscore at original speed. Voice recordings stay untouched.
const DARKEST_SLOW_MIX = Object.freeze({ ...NEUTRAL_MIX, gainFactor: .65, playbackRate: .9, preservesPitch: false });
const INTERVIEW_MIX = Object.freeze({ ...NEUTRAL_MIX, gainFactor: .75 });
function normalizeInterviewMix(value = {}) {
  const number = (name, min, max, fallback) => Number.isFinite(value[name]) ? Math.max(min, Math.min(max, value[name])) : fallback;
  return { enabled: value.enabled === true, gainFactor: number('gainFactor', 0, 1, 1),
    lowpassHz: number('lowpassHz', 300, 22000, 22000), highShelfDb: number('highShelfDb', -18, 6, 0),
    playbackRate: number('playbackRate', .5, 1.5, 1), preservesPitch: typeof value.preservesPitch === 'boolean' ? value.preservesPitch : null };
}

/** A single sounding player, never two overlapping full mixes. Tick uses monotonic milliseconds. */
export function createMusicController({ createPlayer, now = () => performance.now(), settings } = {}) {
  let current = null, transition = null, month = 0, report = false, terminal = false, hidden = false, unlocked = false;
  let config = normalizeSettings(settings), crisis = null, mode = 'idle', interview = false;
  let interviewProfile = { ...INTERVIEW_MIX };
  const positions = new Map(), ducks = new Map(), crises = new Set();
  const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
  const factor = () => ducks.size ? Math.min(...ducks.values()) : 1;
  function stopCurrent() {
    if (!current) return;
    positions.set(current.id, current.player.position());
    current.player.gain(0); current.player.pause(); current = null;
  }
  function target() { return report ? 'long-dark' : interview || mode === 'reception' || mode === 'entry' ? INTERVIEW_TRACK : mode === 'menu' ? THEME_TRACK : MONTH_TRACKS[month]; }
  function switchTo(id, { out = 2000, gap = 500, fade = 3000 } = {}) {
    if (!MUSIC_TRACKS[id] || terminal) return;
    if (transition?.id === id || current?.id === id && !transition) return;
    if (current?.id === id) { transition = { id, phase: 'in', start: now(), duration: 500, from: current.envelope }; return; }
    transition = { id, phase: current ? 'out' : 'gap', start: now(), duration: current ? out : 0,
      from: current?.envelope || 0, outgoingMix: current?.mix, gap, fade };
    tick();
  }
  function begin(id, start, fade) {
    const player = createPlayer(id);
    current = { id, player, envelope: fade > 0 ? 0 : 1 };
    player.gain(0);
    player.seek(mode === 'entry' && id === INTERVIEW_TRACK ? ENTRY_START_SECONDS : positions.get(id) || 0);
    transition = fade > 0 ? { id, phase: 'in', start, duration: fade, from: 0 } : null;
    // An opening attack must enter a fully set gain node; fading up after play
    // would soften the first note even with a correctly preloaded file.
    if (fade <= 0) applyCurrentGain();
    if (unlocked && !hidden && !config.muted && !config.masterMuted) player.play();
  }
  function applyCurrentGain(crisisGain = 1) {
    if (!current) return;
    const mix = transition?.phase === 'out' && transition.outgoingMix ? transition.outgoingMix
      : (interview || mode === 'reception' || mode === 'entry') && current.id === INTERVIEW_TRACK ? interviewProfile
      : mode === 'month' && current.id === THEME_TRACK && month < 2 ? DARKEST_SLOW_MIX : NEUTRAL_MIX;
    current.mix = mix;
    current.player.tone?.(mix);
    current.player.gain(hidden || config.muted || config.masterMuted ? 0 : config.volume * .45 * current.envelope * factor() * crisisGain * mix.gainFactor);
  }
  function tick() {
    const time = now();
    if (transition?.phase === 'out') {
      const p = smooth((time - transition.start) / transition.duration);
      if (current) current.envelope = transition.from * (1 - p);
      if (p >= 1) { stopCurrent(); transition = { ...transition, phase: 'gap', start: time, duration: transition.gap }; }
    }
    if (transition?.phase === 'gap' && time - transition.start >= transition.duration) begin(transition.id, time, transition.fade);
    if (transition?.phase === 'in') {
      const p = smooth((time - transition.start) / transition.duration);
      if (current) current.envelope = transition.from + (1 - transition.from) * p;
      if (p >= 1) transition = null;
    }
    let crisisGain = 1;
    if (crisis) {
      const t = time - crisis.start;
      if (t < 800) crisisGain = 1 - .98 * smooth(t / 800);
      else if (t < 1800) crisisGain = .02;
      else if (t < 4800) crisisGain = .02 + .98 * smooth((t - 1800) / 3000);
      else crisis = null;
    }
    // -7 dB headroom at 100% slider; narration and existing effects remain intelligible.
    // Outgoing tracks keep their established speed/gain until fully quiet.
    applyCurrentGain(crisisGain);
  }
  function cue(name, detail = {}) {
    if (!validMusicCommand(name, detail)) return false;
    if (name === 'ending') {
      terminal = true; mode = name; report = interview = false; transition = crisis = null; ducks.clear(); stopCurrent();
      return true;
    }
    if (name === 'entry') {
      // The shell sends this synchronously in Start's user gesture; create and
      // play the story track now, before the iframe's first typed character.
      // Its later ready message repeats this cue, so preserve the active take.
      if (mode === 'entry' && (transition?.id || current?.id) === INTERVIEW_TRACK) return true;
      terminal = false; mode = 'entry'; month = 0; report = interview = false;
      transition = crisis = null; ducks.clear(); crises.clear(); stopCurrent();
      switchTo(INTERVIEW_TRACK, { gap: 0, fade: 0 });
      tick(); return true;
    }
    if (name === 'menu') {
      terminal = false; mode = 'menu'; report = interview = false; crisis = null; ducks.clear(); crises.clear();
      switchTo(THEME_TRACK, { out: 900, gap: 100, fade: 1800 });
      tick();
      return true;
    }
    if (terminal) return false;
    if (name === 'month') { mode = 'month'; month = detail.month; switchTo(target()); }
    if (name === 'reception') { mode = 'reception'; report = interview = false; month = 0; switchTo(INTERVIEW_TRACK, { gap: 0, fade: 2600 }); }
    if (name === 'interview-open') { mode = 'month'; interview = true; report = false; switchTo(target(), { out: 1400, gap: 200, fade: 2000 }); }
    if (name === 'interview-close') { if (!interview) return true; interview = false; switchTo(target(), { out: 1400, gap: 200, fade: 2000 }); }
    if (name === 'report-open') { report = true; switchTo(target(), { out: 3000, gap: 500, fade: 3000 }); }
    if (name === 'report-close') { if (!report) return true; report = false; switchTo(target(), { out: 1800, gap: 400, fade: 2400 }); }
    if (name === 'crisis' && !crises.has(detail.id)) { crises.add(detail.id); crisis = { start: now() }; }
    tick(); return true;
  }
  return {
    cue, tick,
    duck(key, value) { if (!key) return; if (value === false) ducks.delete(key); else ducks.set(key, value === 'voice' ? .32 : .60); tick(); },
    unlock({ playCurrent = true } = {}) { unlocked = true; if (playCurrent && current && !hidden && !config.muted && !config.masterMuted) current.player.play(); },
    hidden(value) { hidden = Boolean(value); if (hidden) current?.player.pause(); else if (unlocked && !config.muted && !config.masterMuted) current?.player.play(); tick(); },
    settings(value) { const previous = config; config = normalizeSettings(value, config); if (config.muted || config.masterMuted) current?.player.pause(); else if ((previous.muted || previous.masterMuted) && unlocked && !hidden) current?.player.play(); tick(); return { ...config }; },
    interviewMix(value) { interviewProfile = normalizeInterviewMix(value); tick(); return { ...interviewProfile }; },
    snapshot() { return { track: current?.id || null, target: transition?.id || current?.id || null, phase: transition?.phase || 'steady', mode, interview, interviewMix: { ...interviewProfile }, report, month, terminal, settings: { ...config }, positions: Object.fromEntries(positions) }; },
    destroy() { terminal = true; transition = crisis = null; stopCurrent(); },
  };
}
