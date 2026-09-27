import { useEffect, useMemo, useRef, useState } from 'react';
import { getStory, SPHERICAL_STORY_LIST, STAGE_PAIRS, STAGE_REEL_LIST } from '../src/stories/index.js';
import { createStage360World, drawStageViewport, stageExhibit, STAGE_CONTROLS } from '../src/story/stage360.js';
import { createStoryProject, readStoryProject, storyProjectToJson, setStoryDuration } from '../src/story/project.js';
import { createTimeline } from '../src/story/timeline.js';
import { createStoryEngine } from '../src/story/engine.js';
import { createStoryClock } from '../src/story/clock.js';
import { renderStoryVideo } from '../src/story/export.js';
import { download, downloadText } from '../src/export/video.js';
import ScorePicker from './ScorePicker.jsx';
import { createAuditioner } from './scoreAudition.js';

const STORAGE = 'mathloop.stage.project.v1';
const DELIVERY = [2048, 3072, 3840, 4096];
const seconds = n => Number(n.toFixed(2));

function initialProject() {
  try { const saved = localStorage.getItem(STORAGE); if (saved) return readStoryProject(saved, { resolveStory: getStory }).project; }
  catch { /* An invalid saved stage must not prevent the studio opening. */ }
  return createStoryProject(SPHERICAL_STORY_LIST[0]);
}

function StageCard({ story, selected, disabled, onSelect }) {
  const canvas = useRef();
  useEffect(() => {
    const world = createStage360World(story.reels, story.params.exhibits, story.theme);
    drawStageViewport(canvas.current.getContext('2d'), world, { width: 240, height: 120, phase: .3,
      heading: story.params.exhibits[0].heading, pitch: story.params.exhibits[0].elevation, fov: 92, guides: false, backdrop: story.backdrop, mote: story.mote });
  }, [story]);
  return <button className={`stage-card ${selected ? 'selected' : ''}`} aria-label={`Open stage: ${story.title}`} aria-pressed={selected} disabled={disabled} onClick={() => onSelect(story)}>
    <canvas ref={canvas} width="240" height="120" aria-hidden="true"/>
    <strong>{story.title}</strong><small>{story.params.exhibits.length} reels · {seconds(story.duration)}s</small>
  </button>;
}

export default function Studio360() {
  const [project, setProject] = useState(initialProject);
  const [selected, setSelected] = useState(0), [view, setView] = useState('look');
  const [look, setLook] = useState({ heading: 0, pitch: -4, fov: 82 });
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [listen, setListen] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [exporting, setExporting] = useState(''), [progress, setProgress] = useState(0);
  const canvas = useRef(), clock = useRef(), abort = useRef(), file = useRef(), drag = useRef(null);
  const audition = useRef();
  const sound = () => (audition.current ??= createAuditioner());

  const story = useMemo(() => getStory(project.story, project), [project.story]);
  const timeline = useMemo(() => createTimeline(project), [project]);
  const exhibits = project.params.exhibits;
  const exhibit = exhibits[Math.min(selected, exhibits.length - 1)];
  const pair = STAGE_PAIRS.find(entry => entry.sphere.id === project.story);
  // Lofting every reel is the expensive part of a stage, so it happens once per edit.
  const world = useMemo(() => {
    try { return createStage360World(story.reels, exhibits, project.theme); } catch { return null; }
  }, [story, exhibits, project.theme]);

  const stopSound = () => audition.current?.stop();
  function pause() { clock.current?.pause(); stopSound(); setPlaying(false); }
  function commit(next) {
    try { const clean = createStoryProject(getStory(next.story, next), next); pause(); setProject(clean); setError(''); }
    catch (e) { setError(e.message); }
  }
  const patchExhibit = values => commit({ ...project, params: { ...project.params,
    exhibits: exhibits.map((entry, i) => i === selected ? { ...entry, ...values } : entry) } });
  const setExhibits = next => commit({ ...project, params: { ...project.params, exhibits: next } });
  function openStage(next) { commit(createStoryProject(next)); setSelected(0); seek(0); setNotice(`${next.title} opened. Place or move its reels.`); }
  function seek(t) { pause(); clock.current?.seek(t); const at = clock.current?.time ?? t; setTime(at); }

  useEffect(() => {
    clock.current = createStoryClock({ duration: timeline.duration, fps: project.export.fps, loop: project.loop });
    clock.current.seek(Math.min(time, timeline.duration - 1 / project.export.fps));
    setTime(clock.current.time);
    try { localStorage.setItem(STORAGE, storyProjectToJson(project)); } catch { /* A full quota must not block editing. */ }
  }, [timeline, project.export.fps, project.loop]);

  // The flat view renders the real equirectangular frame; the look view is a camera in it.
  useEffect(() => {
    const target = canvas.current;
    if (!target || !world) return;
    if (view === 'look') {
      const ctx = target.getContext('2d');
      target.width = 720; target.height = 405;
      drawStageViewport(ctx, world, { width: 720, height: 405, phase: timeline.at(time, { wrap: false }).phase,
        ...look, guides: project.params.guides, backdrop: story.backdrop, mote: story.mote });
      return;
    }
    const engine = createStoryEngine({ canvas: target, story, project });
    try { engine.renderAt(time, { width: 720, height: 360 }); } catch (e) { setError(e.message); }
    engine.dispose();
  }, [world, view, look, time, story, project, timeline]);

  useEffect(() => {
    let raf, last = -1;
    const animate = now => {
      const c = clock.current;
      if (c?.playing && !abort.current) {
        try { c.tick(now); if (last !== c.frame) { setTime(c.time); last = c.frame; } if (!c.playing) { setPlaying(false); stopSound(); } }
        catch (e) { c.pause(); setPlaying(false); setError(e.message); }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(raf); audition.current?.dispose(); audition.current = null; abort.current?.abort(); };
  }, []);

  async function togglePlay() {
    if (playing) { pause(); return; }
    try {
      if (clock.current.time >= timeline.duration - 1 / project.export.fps && !project.loop) seek(0);
      if (listen && project.audio.enabled) await sound().play(project, project.audio.score, { offset: clock.current.time, level: project.audio.level ?? 1 });
      clock.current.play(); setPlaying(true); setError('');
    } catch (e) { setError(e.message); }
  }

  function pointerDown(event) {
    if (view !== 'look') return;
    drag.current = { x: event.clientX, y: event.clientY, ...look };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const from = drag.current;
    if (!from) return;
    const scale = look.fov / 720;
    setLook(current => ({ ...current,
      heading: ((from.heading - (event.clientX - from.x) * scale + 180) % 360 + 360) % 360 - 180,
      pitch: Math.max(-85, Math.min(85, from.pitch - (event.clientY - from.y) * scale)) }));
  }
  const pointerUp = () => { drag.current = null; };

  async function exportFilm(target) {
    pause(); setError(''); setProgress(0); setExporting(target);
    const controller = new AbortController(); abort.current = controller;
    const sphere = target === 'sphere';
    const exported = sphere ? story : pair.short;
    const settings = sphere ? project.export : { ...pair.short.export, fps: project.export.fps };
    let base;
    try {
      base = sphere ? project : setStoryDuration(createStoryProject(pair.short, {
        params: { ...pair.short.params, exhibits, guides: project.params.guides },
        audio: project.audio, export: settings,
      }), timeline.duration);
    } catch (e) { setError(e.message); setExporting(''); abort.current = null; return; }
    // Export owns its canvas so the preview resolution can never leak into a render.
    const surface = document.createElement('canvas');
    surface.width = settings.width; surface.height = settings.height;
    let engine;
    try {
      engine = createStoryEngine({ canvas: surface, story: exported, project: base });
      const result = await renderStoryVideo({ engine, signal: controller.signal, onProgress: p => { if (p.stage !== 'audio') setProgress(p.fraction ?? 0); } });
      download(result.blob, `${exported.id}-${seconds(timeline.duration)}s.mp4`);
      setNotice(sphere ? 'Your 360° MP4 is ready. Upload it as a regular video and let YouTube finish the spherical version.'
        : 'Your Short is ready. Set its related video to the 360° upload.');
    } catch (e) { if (e.name === 'AbortError') setNotice('Export cancelled.'); else setError(e.message); }
    finally { engine?.dispose(); abort.current = null; setExporting(''); }
  }

  async function loadProject(event) {
    const chosen = event.target.files?.[0]; if (!chosen) return;
    try {
      const loaded = readStoryProject(await chosen.text(), { resolveStory: getStory });
      if (loaded.story.stage !== 'sphere') throw new Error('That is a film project. Open it in Story Studio, or choose a 360° stage.');
      commit(loaded.project); setSelected(0); seek(0); setNotice('Stage loaded.');
    } catch (e) { setError(e.message); } finally { event.target.value = ''; }
  }

  const busy = Boolean(exporting);
  return <main className="story-studio stage-studio">
    <header className="story-header"><div><span className="story-kicker">MATHLOOP / 360 STUDIO</span><h1>Build the room, not the shot.</h1><p>Place finished films around one viewpoint. Every viewer chooses where to look.</p></div>
      <div className="story-actions"><button onClick={() => file.current.click()} disabled={busy}>Open stage</button>
        <button onClick={() => downloadText(storyProjectToJson(project), `${story.id}.stage.json`)}>Save stage</button>
        <button className="story-primary" onClick={() => exportFilm('sphere')} disabled={busy}>{exporting === 'sphere' ? `Exporting ${Math.round(progress * 100)}%` : 'Export 360° MP4'} <span>↗</span></button></div>
    </header>
    <input ref={file} hidden type="file" accept=".json" onChange={loadProject}/>
    {error && <div className="story-message error" role="alert">{error}</div>}
    {notice && <div className="story-message" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
    {busy && <div className="story-message" role="status">Rendering {exporting === 'sphere' ? 'the sphere' : 'the Short'}. <progress max="1" value={progress}/><button onClick={() => abort.current?.abort()}>Cancel export</button></div>}

    <section className="stage-collection" aria-label="Authored 360 stages">
      <div className="film-collection-heading"><div><span className="story-kicker">THE STAGES</span><p>Three authored rooms. Open one and rearrange it.</p></div></div>
      <div className="stage-grid">{SPHERICAL_STORY_LIST.map(entry => <StageCard key={entry.id} story={entry} selected={story.id === entry.id} disabled={busy} onSelect={openStage}/>)}</div>
    </section>

    <div className="story-workspace">
      <aside className="story-panel story-outline"><span className="story-kicker">01 / THE REELS</span>
        <div className="story-outline-heading"><h2>In the sphere</h2><span>{exhibits.length} / 8</span></div>
        <ol className="stage-placed">{exhibits.map((entry, i) => <li key={i}><button className={selected === i ? 'selected' : ''} disabled={busy}
          onClick={() => { setSelected(i); setLook(current => ({ ...current, heading: entry.heading, pitch: entry.elevation })); setView('look'); }}>
          <span className="chapter-number">{String(i + 1).padStart(2, '0')}</span>
          <span><strong>{entry.name}</strong><small>{story.reels[entry.reel].title} · {entry.heading}°</small></span>
        </button>
        <button className="stage-remove" aria-label={`Remove ${entry.name}`} disabled={busy || exhibits.length < 2}
          onClick={() => { setExhibits(exhibits.filter((_, k) => k !== i)); setSelected(Math.max(0, Math.min(selected, exhibits.length - 2))); }}>×</button></li>)}</ol>
        <p className="story-hint">Click a reel to select it, then aim it from the panel on the right. The preview jumps to face whatever you select.</p>
        <div className="story-divider"/><span className="story-kicker">ADD A REEL</span>
        <div className="stage-rack">{STAGE_REEL_LIST.map(reel => <button key={reel.id} className="stage-reel" disabled={busy || exhibits.length > 7} title={reel.description}
          onClick={() => {
            const heading = Math.round(((exhibits.length) * 360 / (exhibits.length + 1) + 180) % 360 - 180);
            setExhibits([...exhibits, stageExhibit(reel.id, { name: reel.label, heading })]);
            setSelected(exhibits.length); setView('look');
          }}>＋ {reel.label}<small>{reel.title}</small></button>)}</div>
      </aside>

      <section className="story-preview"><div className="story-preview-bar"><span>THE SPHERE / {exhibits.length} REELS</span><span>{project.export.width} × {project.export.height} · {project.export.fps} fps</span></div>
        <div className="stage-views" role="group" aria-label="Preview mode">
          {[['look', 'Look around'], ['flat', 'Panorama']].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
          {view === 'look' && <span className="stage-bearing">{Math.round(look.heading)}° · {Math.round(look.pitch)}°</span>}
        </div>
        <div className={`stage-screen ${view}`}>
          <canvas ref={canvas} width="720" height="405" aria-label="360 stage preview"
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
            onWheel={event => view === 'look' && setLook(c => ({ ...c, fov: Math.max(35, Math.min(110, c.fov + Math.sign(event.deltaY) * 4)) }))}/>
        </div>
        <p className="story-hint stage-note">{view === 'look' ? 'Drag to look around. Scroll to zoom. This is what a viewer controls.' : 'The actual exported frame. Its 2:1 shape is what carries the 360° metadata.'}</p>
        <div className="story-transport"><button aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={togglePlay} disabled={busy}>{playing ? 'Ⅱ' : '▶'}</button>
          <button aria-label="Previous frame" onClick={() => seek(time - 1 / project.export.fps)} disabled={busy}>‹</button>
          <button aria-label="Next frame" onClick={() => seek(time + 1 / project.export.fps)} disabled={busy}>›</button>
          <span>{seconds(time).toFixed(2)} <em>/ {seconds(timeline.duration).toFixed(2)} s</em></span>
          <label className="inline"><input type="checkbox" checked={listen} onChange={e => { pause(); setListen(e.target.checked); }}/> Hear score</label></div>
        <input className="story-seek" aria-label="Stage playhead" type="range" min="0" max={Math.max(0, timeline.duration - 1 / project.export.fps)} step={1 / project.export.fps} value={time} disabled={busy} onChange={e => seek(Number(e.target.value))}/>
        <div className="stage-compass" aria-hidden="true">{exhibits.map((entry, i) => <button key={i} className={selected === i ? 'active' : ''} style={{ left: `${(entry.heading + 180) / 360 * 100}%` }} title={entry.name}
          onClick={() => { setSelected(i); setLook(c => ({ ...c, heading: entry.heading, pitch: entry.elevation })); }}>{i + 1}</button>)}</div>
      </section>

      <aside className="story-panel story-inspector"><span className="story-kicker">02 / PLACE THE REEL</span><h2>{exhibit.name.toLowerCase()}</h2>
        <fieldset disabled={busy}>
          <label>Caption<input aria-label="Caption" value={exhibit.name} maxLength="40" onChange={e => e.target.value.trim() && patchExhibit({ name: e.target.value })}/></label>
          <label>Film<select aria-label="Film" value={exhibit.reel} onChange={e => patchExhibit({ reel: e.target.value })}>
            {STAGE_REEL_LIST.map(reel => <option key={reel.id} value={reel.id}>{reel.title}</option>)}</select></label>
          {Object.entries(STAGE_CONTROLS).map(([key, control]) => <label key={key}>{control.label} <small>{control.hint}</small>
            <span className="input-unit"><input aria-label={control.label} type="range" min={control.min} max={control.max} step={control.step} value={exhibit[key]}
              onChange={e => patchExhibit({ [key]: e.target.valueAsNumber })}/><span>{exhibit[key]}{control.unit}</span></span></label>)}
          <label className="inline"><input type="checkbox" checked={exhibit.tint} onChange={e => patchExhibit({ tint: e.target.checked })}/> Match the stage palette</label>

          <div className="story-divider"/><span className="story-kicker">03 / THE ROOM</span>
          <label>Stage title<input value={project.title} onChange={e => e.target.value && commit({ ...project, title: e.target.value })}/></label>
          <div className="story-fields"><label>Total length<input aria-label="Total length" type="number" min="4" max="600" step="1" value={seconds(timeline.duration)}
            onChange={e => { const n = e.target.valueAsNumber; if (n > 0) commit(setStoryDuration(project, n)); }}/></label>
            <label>Frame rate<select aria-label="Frame rate" value={project.export.fps} onChange={e => commit({ ...project, export: { ...project.export, fps: Number(e.target.value) } })}>{[24, 30, 60].map(v => <option key={v}>{v}</option>)}</select></label></div>
          <label>Delivery size <small>A sphere is always twice as wide as it is tall</small>
            <select aria-label="Delivery size" value={project.export.width} onChange={e => { const width = Number(e.target.value); commit({ ...project, export: { ...project.export, width, height: width / 2 } }); }}>
              {DELIVERY.map(v => <option key={v} value={v}>{v} × {v / 2}{v === 3840 ? ' · recommended' : ''}</option>)}</select></label>
          <div className="story-swatches">{['background', 'ink', 'accent', 'guide'].map(k => <label key={k}><input type="color" aria-label={`${k} colour`} value={project.theme[k]} onChange={e => commit({ ...project, theme: { ...project.theme, [k]: e.target.value } })}/><span>{k}</span></label>)}</div>
          <label className="inline"><input type="checkbox" checked={project.params.guides} onChange={e => commit({ ...project, params: { ...project.params, guides: e.target.checked } })}/> Show construction contours</label>
          <div className="story-divider"/><span className="story-kicker">04 / THE COMPANION SHORT</span>
          <p className="story-hint stage-companion">A portrait tour of this exact room, for the Shorts feed. It dwells on each reel in turn and points viewers at the 360° upload.</p>
          <button className="story-import" disabled={busy || !pair} onClick={() => exportFilm('short')}>{exporting === 'short' ? `Exporting ${Math.round(progress * 100)}%` : 'Export the 9:16 Short'}</button>
        </fieldset>
      </aside>
    </div>

    <ScorePicker project={project} auditioner={sound()} time={time} disabled={busy}
      onPatch={values => commit({ ...project, audio: { ...project.audio, ...values } })} onError={setError}/>
    <footer className="story-footer"><span>One room. As many directions as there are viewers.</span><span>Stage autosaves in this browser · Save a stage file to keep an arrangement</span></footer>
  </main>;
}
