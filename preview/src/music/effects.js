/** Preserve each clip's authored mix; a user setting is a multiplier, never a new baseline. */
export function createEffectsMixer({ settings, isMusic = element => Boolean(element.dataset?.rocMusic) } = {}) {
  const entries = new Map();
  function apply(element, entry) {
    const config = settings();
    entry.appliedVolume = Math.max(0, Math.min(1, entry.baseVolume * config.effectsVolume));
    entry.appliedMuted = Boolean(config.masterMuted || entry.baseMuted);
    if (element.volume !== entry.appliedVolume) element.volume = entry.appliedVolume;
    if (element.muted !== entry.appliedMuted) element.muted = entry.appliedMuted;
  }
  function register(element) {
    if (isMusic(element) || element.dataset?.rocVolumeManaged === 'true') return;
    let entry = entries.get(element);
    if (!entry) {
      entry = { baseVolume: element.volume, baseMuted: element.muted };
      entries.set(element, entry);
      element.addEventListener?.('volumechange', () => {
        if (element.volume !== entry.appliedVolume) entry.baseVolume = element.volume;
        if (element.muted !== entry.appliedMuted) entry.baseMuted = element.muted;
        apply(element, entry);
      });
    } else {
      if (element.volume !== entry.appliedVolume) entry.baseVolume = element.volume;
      if (element.muted !== entry.appliedMuted) entry.baseMuted = element.muted;
    }
    apply(element, entry);
  }
  return { register, update() { for (const [element, entry] of entries) apply(element, entry); }, size: () => entries.size };
}
