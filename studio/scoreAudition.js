// Playing one score against another, before anything is exported.
//
// Three things make comparing scores feel immediate rather than tedious:
//
//   * auditions render in a worker (see scoreWorker.js), so the studio stays
//     usable while one is being prepared;
//   * they render at a lower sample rate than the export -- the difference
//     tells you nothing about whether a score suits the film, and it is the
//     difference between a two-second wait and a six-second one;
//   * they are cached per score, and the rest of the library is warmed in the
//     background after the first audition, so the second click plays at once.
//
// Volume is a gain node rather than part of the render, so the loudness slider
// takes effect while a score is playing.
import { renderStoryScore } from '../src/story/score.js';

/** Everything a score is made from, except which score it is and how loud it plays. */
const cacheKey = project => JSON.stringify({
  bars: project.audio.bars, seed: project.audio.seed, transpose: project.audio.transpose,
  tempoFeel: project.audio.tempoFeel, transitions: project.audio.transitions, greeting: project.audio.greeting,
  chapters: project.chapters.map(c => [c.id, c.duration]), loop: project.loop, storySeed: project.seed,
});

export function createAuditioner({ sampleRate = 22050 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let worker, workerBroken = false, context, source, gainNode, seq = 0, warming = null;
  // Playback can be stopped from anywhere in the studio -- pressing play on the
  // film, editing a chapter -- so what is sounding is tracked here and the UI
  // follows it, rather than each caller remembering to put the badge back.
  let sounding = '', listener = null;
  const announce = id => { sounding = id; listener?.(id); };

  function ensureWorker() {
    if (worker || workerBroken) return worker;
    try {
      worker = new Worker(new URL('./scoreWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        const waiter = pending.get(data.id);
        if (!waiter) return;
        pending.delete(data.id);
        if (data.error) waiter.reject(new Error(data.error)); else waiter.resolve(data);
      };
      worker.onerror = () => {
        // A worker that dies takes the queued auditions with it; fall back to
        // rendering here rather than leaving the studio with a dead button.
        workerBroken = true; worker = null;
        for (const waiter of pending.values()) waiter.reject(new Error('The score renderer stopped. Try again.'));
        pending.clear();
      };
    } catch { workerBroken = true; worker = null; }
    return worker;
  }

  function render(project, scoreId) {
    const key = `${scoreId}|${cacheKey(project)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const scored = { ...project, audio: { ...project.audio, score: scoreId, level: 1 } };
    const active = ensureWorker();
    const job = active
      ? new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); active.postMessage({ id, project: scored, sampleRate }); })
      : Promise.resolve(renderStoryScore(scored, { sampleRate }));
    // A failed render must not be remembered as this score's sound.
    const tracked = job.catch(error => { cache.delete(key); throw error; });
    cache.set(key, tracked);
    // A minute of stereo audio is megabytes; keep the library plus a little
    // history, and let older edits of the film go.
    for (const stale of [...cache.keys()].slice(0, Math.max(0, cache.size - 10))) cache.delete(stale);
    return tracked;
  }

  function stop() {
    if (source) {
      try { source.onended = null; source.stop(); } catch { /* Already finished. */ }
      source = null;
    }
    if (sounding) announce('');
  }

  return {
    /** True once this score has been rendered and will start without a wait. */
    ready: (project, scoreId) => cache.has(`${scoreId}|${cacheKey(project)}`),
    stop,
    /** Which score is sounding right now, and a subscription to that changing. */
    sounding: () => sounding,
    onChange(fn) { listener = fn; return () => { if (listener === fn) listener = null; }; },
    /** Live volume for whatever is playing right now. */
    setLevel(level) { if (gainNode) gainNode.gain.value = level; },
    async play(project, scoreId, { offset = 0, level = 1 } = {}) {
      const rendered = await render(project, scoreId);
      context ??= new AudioContext();
      await context.resume();
      stop();
      const buffer = context.createBuffer(rendered.numberOfChannels, rendered.length, rendered.sampleRate);
      for (let c = 0; c < rendered.numberOfChannels; c++) buffer.copyToChannel(rendered.channelData[c], c);
      gainNode ??= context.createGain();
      gainNode.gain.value = level;
      gainNode.connect(context.destination);
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = project.loop;
      source.connect(gainNode);
      source.onended = () => { source = null; announce(''); };
      source.start(0, Math.min(Math.max(0, offset), buffer.duration * .999));
      announce(scoreId);
      return rendered.stats;
    },
    /** Quietly prepare the rest of the library so the next comparison is instant. */
    warm(project, scoreIds) {
      warming ??= Promise.resolve();
      for (const id of scoreIds) warming = warming.then(() => render(project, id)).catch(() => {});
      return warming;
    },
    dispose() { stop(); listener = null; worker?.terminate(); worker = null; void context?.close(); context = null; gainNode = null; cache.clear(); },
  };
}
