/** Separate channels prevent stale speech and repeated effects after navigation. */
export function createAudioPlayer({ createAudio = src => { const element = new Audio(src); element.hidden = true; document.body.append(element); return element; }, base = './assets/reception/audio/', voiceVolume = 1 } = {}) {
  const channels = new Map();
  let muted = false;
  let suspended = false;
  function stop(channel) {
    const entry = channels.get(channel);
    if (!entry) return;
    channels.delete(channel);
    entry.audio.pause();
    entry.audio.remove?.();
    entry.audio.onended = entry.audio.onerror = null;
    entry.resolve('cancelled');
  }
  function play(channel, clip) {
    stop(channel);
    if (!clip || muted) return Promise.resolve('silent');
    const audio = createAudio(base + clip.file);
    audio.preload = 'auto';
    // Set the clip baseline before the shared effects mixer registers playback.
    if (channel === 'voice') audio.volume = voiceVolume * (clip.gain ?? 1);
    return new Promise(resolve => {
      const entry = { audio, resolve, attempt: 0 };
      channels.set(channel, entry);
      const finish = result => {
        if (channels.get(channel) !== entry) return;
        channels.delete(channel);
        audio.remove?.();
        audio.onended = audio.onerror = null;
        resolve(result);
      };
      audio.onended = () => finish('ended');
      audio.onerror = () => finish('error');
      entry.start = () => {
        const attempt = ++entry.attempt;
        const failed = error => {
          if (attempt === entry.attempt && !suspended)
            finish(error?.name === 'NotAllowedError' ? 'blocked' : 'error');
        };
        try { Promise.resolve(audio.play()).catch(failed); }
        catch (error) { failed(error); }
      };
      if (!suspended) entry.start();
    });
  }
  return {
    play, stop,
    busy: channel => channels.has(channel),
    stopAll() { for (const key of [...channels.keys()]) stop(key); },
    setMuted(value) { muted = value; if (muted) this.stopAll(); },
    suspend(value) {
      if (suspended === value) return;
      suspended = value;
      for (const entry of channels.values()) {
        if (value) {
          entry.attempt++;
          entry.audio.pause();
        }
        else entry.start();
      }
    },
  };
}
