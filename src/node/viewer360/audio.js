import { foaStereoMatrix, focusGains } from './ambisonic.js';

/** Explicit channel routing prevents the browser's ordinary surround downmix. */
export function createFoaDecoder(context, input, channelMap = [0, 1, 2, 3]) {
  const split = context.createChannelSplitter(4), output = context.createChannelMerger(2);
  input.connect(split);
  const gains = [0, 1].map(ear => [0, 1, 2, 3].map(component => {
    const gain = context.createGain(); gain.gain.value = 0;
    split.connect(gain, channelMap[component]); gain.connect(output, 0, ear);
    return gain;
  }));
  return {
    output,
    setView(view, immediate = false) {
      foaStereoMatrix(view).forEach((row, ear) => row.forEach((value, component) => {
        const param = gains[ear][component].gain;
        if (immediate) param.value = value;
        else param.setTargetAtTime(value, context.currentTime, .015);
      }));
    },
  };
}

export function createSpatialPlayback(video, config) {
  let context, decoder, field, focusBus, buffers, loading, sources = [], stemGains = [];
  let mode = 'spatial', enabled = false, view = { yaw: 0, pitch: 0 }, anchor;
  const managed = Boolean(config.spatial || config.focus);
  const setGain = (node, value) => node.gain.setTargetAtTime(value, context.currentTime, .015);
  function initialize() {
    if (context) return;
    context = new AudioContext();
    field = context.createGain(); field.gain.value = 0; field.connect(context.destination);
    focusBus = context.createGain(); focusBus.gain.value = 0; focusBus.connect(context.destination);
    const media = context.createMediaElementSource(video);
    if (config.spatial) {
      decoder = createFoaDecoder(context, media, config.spatial.channelMap);
      decoder.setView(view, true); decoder.output.connect(field);
    } else media.connect(field);
  }
  function stop() {
    sources.forEach((source, i) => {
      const gain = stemGains[i], now = context.currentTime;
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(0, now + .025);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.stop(now + .03);
    });
    sources = []; stemGains = []; anchor = null;
  }
  function sync() {
    stop();
    if (!buffers || !enabled || mode !== 'focus' || video.paused || video.seeking || video.readyState < 3) return;
    const offset = video.currentTime;
    const gains = focusGains(config.focus.stems, view);
    buffers.forEach((buffer, i) => {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = video.playbackRate;
      gain.gain.value = gains[i];
      source.connect(gain); gain.connect(focusBus);
      // The video owns loop timing. Its wrap/seek event restarts every stem together.
      source.start(0, Math.min(offset, buffer.duration));
      sources.push(source); stemGains.push(gain);
    });
    anchor = { time: context.currentTime, video: offset, rate: video.playbackRate };
  }
  async function loadFocus() {
    if (!config.focus) throw new Error('This film has no separate Focus tracks. Rebuild it with npm run 360:spatial.');
    if (!loading) loading = Promise.all(config.focus.stems.map(async stem => {
      const response = await fetch(stem.url);
      if (!response.ok) throw new Error(`Could not load ${stem.name}. Rebuild the spatial demo.`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (buffer.numberOfChannels !== 1 || Math.abs(buffer.duration - video.duration) > .1) throw new Error('Focus tracks do not match the film duration. Rebuild the spatial demo.');
      return buffer;
    })).then(result => { buffers = result; }).catch(error => { loading = null; throw error; });
    await loading;
  }
  function route() {
    setGain(field, enabled && mode === 'spatial' ? 1 : 0);
    setGain(focusBus, enabled && mode === 'focus' ? 1 : 0);
  }
  for (const event of ['pause', 'seeking', 'waiting', 'ended', 'emptied']) video.addEventListener(event, stop);
  for (const event of ['playing', 'seeked', 'ratechange']) video.addEventListener(event, sync);
  video.addEventListener('timeupdate', () => {
    if (anchor && Math.abs(video.currentTime - (anchor.video + (context.currentTime - anchor.time) * anchor.rate)) > .1) sync();
  });
  return {
    get enabled() { return enabled; },
    get mode() { return mode; },
    async setEnabled(next) {
      if (!managed) { video.muted = !next; enabled = next; return; }
      initialize();
      if (next) { await context.resume(); if (mode === 'focus') await loadFocus(); }
      enabled = next;
      // MediaElementAudioSource has sole ownership of output once initialized.
      video.muted = false;
      route(); sync();
    },
    async setMode(next) {
      initialize(); await context.resume();
      if (next === 'focus') await loadFocus();
      mode = next; route(); sync();
    },
    setView(next) {
      view = next; decoder?.setView(view);
      const weights = focusGains(config.focus?.stems ?? [], view);
      stemGains.forEach((gain, i) => setGain(gain, weights[i]));
    },
    async resume() { if (context && enabled) await context.resume(); },
  };
}
