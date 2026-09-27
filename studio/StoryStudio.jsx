import { useEffect, useMemo, useRef, useState } from 'react';
import { getStory, STORY_LIST } from '../src/stories/index.js';
import { createStoryProject, readStoryProject, storyProjectToJson, setStoryDuration } from '../src/story/project.js';
import { createTimeline } from '../src/story/timeline.js';
import { createStoryEngine } from '../src/story/engine.js';
import { createStoryClock } from '../src/story/clock.js';
import { renderStoryVideo } from '../src/story/export.js';
import { download, downloadText } from '../src/export/video.js';
import { loadSvgFile } from './fourierSvg.js';
import './story.css';
import FilmCollection from './FilmCollection.jsx';
import ScorePicker from './ScorePicker.jsx';
import { createAuditioner } from './scoreAudition.js';
import { createShowcaseEdit } from '../src/story/showcase.js';

const STORAGE='mathloop.story.project.v1';
function initialProject(){
  try{const saved=localStorage.getItem(STORAGE);if(saved)return readStoryProject(saved,{resolveStory:getStory}).project;}catch{/* An invalid saved edit must not prevent the studio opening. */}
  return createStoryProject(getStory('fourier-monkey'));
}
const seconds=n=>Number(n.toFixed(2));
export default function StoryStudio(){
  const [project,setProject]=useState(initialProject),[selected,setSelected]=useState(()=>project.chapters[0].id),[time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[exporting,setExporting]=useState(false),[progress,setProgress]=useState(0),[listen,setListen]=useState(false);
  const [tracksText,setTracksText]=useState(''),[showTracks,setShowTracks]=useState(false);
  const canvas=useRef(),engine=useRef(),clock=useRef(),abort=useRef(),file=useRef(),svg=useRef();
  const audition=useRef();
  const sound=()=>(audition.current??=createAuditioner());
  const hasHook=project.chapters.some(c=>c.id==='hook');
  const story=useMemo(()=>getStory(project.story,project),[project.story,project.artwork,hasHook]);
  const timeline=useMemo(()=>createTimeline(project),[project]);
  const chapter=project.chapters.find(c=>c.id===selected)??project.chapters[0];
  const active=timeline.at(time,{wrap:false}).chapter;
  const stopSound=()=>audition.current?.stop();
  function pause(){clock.current?.pause();stopSound();setPlaying(false);}
  function commit(next){
    try{const clean=createStoryProject(getStory(next.story,next),next);pause();setProject(clean);setError('');}catch(e){setError(e.message);}
  }
  function patchChapter(values){commit({...project,chapters:project.chapters.map(c=>c.id===chapter.id?{...c,...values}:c)});}
  function selectFilm(s){commit(createStoryProject(s));setSelected(s.chapters[0].id);seek(0);setNotice(`${s.title} Loaded for editing.`);}
  function seek(t){pause();clock.current?.seek(t);const at=clock.current?.time??t;engine.current?.renderAt(at);setTime(at);}
  useEffect(()=>{
    try{
      const e=createStoryEngine({canvas:canvas.current,story,project});engine.current=e;
      clock.current=createStoryClock({duration:e.duration,fps:project.export.fps,loop:project.loop});
      clock.current.seek(Math.min(time,e.duration-1/project.export.fps));e.renderAt(clock.current.time);setTime(clock.current.time);
      localStorage.setItem(STORAGE,storyProjectToJson(project));
      setTracksText(JSON.stringify(project.tracks,null,2));setError('');
      return()=>{e.dispose();engine.current=null;};
    }catch(e){setError(e.message);}
  },[story,project]);
  useEffect(()=>{
    let raf,last=-1;
    const animate=now=>{
      const c=clock.current;
      if(c?.playing&&!abort.current){
        try{c.tick(now);if(last!==c.frame){engine.current?.renderAt(c.time);setTime(c.time);last=c.frame;}if(!c.playing){setPlaying(false);stopSound();}}
        catch(e){c.pause();setPlaying(false);setError(e.message);}
      }
      raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(raf);audition.current?.dispose();audition.current=null;abort.current?.abort();};
  },[]);
  async function togglePlay(){
    if(playing){pause();return;}
    try{
      if(clock.current.time>=timeline.duration-1/project.export.fps&&!project.loop)seek(0);
      // The score is rendered off the main thread and cached, so pressing play a
      // second time starts instantly and the picture never stutters while it waits.
      if(listen&&project.audio.enabled)await sound().play(project,project.audio.score,{offset:clock.current.time,level:project.audio.level??1});
      clock.current.play();setPlaying(true);setError('');
    }catch(e){setError(e.message);}
  }
  async function exportFilm(){
    pause();setError('');setProgress(0);setExporting(true);
    const controller=new AbortController();abort.current=controller;
    // Export has its own engine so preview state and render resolution cannot leak.
    const target=document.createElement('canvas');target.width=project.export.width;target.height=project.export.height;
    let renderEngine;
    try{
      renderEngine=createStoryEngine({canvas:target,story,project});
      const result=await renderStoryVideo({engine:renderEngine,signal:controller.signal,onProgress:p=>{if(p.stage!=='audio')setProgress(p.fraction??0);}});
      download(result.blob,`${story.id.replaceAll('/','-')}-${seconds(timeline.duration)}s.mp4`);setNotice('Your MP4 is ready. The project file lets you reproduce this edit.');
    }catch(e){if(e.name==='AbortError')setNotice('Export cancelled.');else setError(e.message);}
    finally{renderEngine?.dispose();abort.current=null;setExporting(false);}
  }
  async function loadProject(event){
    const chosen=event.target.files?.[0];if(!chosen)return;
    try{const loaded=readStoryProject(await chosen.text(),{resolveStory:getStory});commit(loaded.project);setSelected(loaded.project.chapters[0].id);seek(0);setNotice('Project loaded.');}catch(e){setError(e.message);}finally{event.target.value='';}
  }
  async function importArtwork(event){
    const chosen=event.target.files?.[0];if(!chosen)return;
    try{
      const parsed=await loadSvgFile(chosen),name=chosen.name.replace(/\.svg$/i,'').replace(/[-_]/g,' ');
      const data={story:'custom-fourier',title:`From circles to ${name}`,artwork:{name,paths:parsed.paths,harmonics:64}};
      const custom=getStory(data.story,data);commit(createStoryProject(custom,data));setSelected('seed');seek(0);setNotice(`${parsed.usedGeometryCount} contours imported. Edit the chapters to tell their story.`);
    }catch(e){setError(e.message);}finally{event.target.value='';}
  }
  function addCue(){
    try{
      const data=JSON.parse(tracksText),key='customValue';
      const f=timeline.at(time,{wrap:false});
      data[key]=[...(data[key]??[]),{at:{chapter:f.chapter.id,progress:seconds(f.chapterProgress)},value:1,ease:'smooth'}];
      setTracksText(JSON.stringify(data,null,2));
    }catch(e){setError(e.message);}
  }
  return <main className="story-studio">
    <header className="story-header"><div><span className="story-kicker">MATHLOOP / STORY STUDIO</span><h1>Give your maths a story.</h1><p>Start simply. Build the artwork. Let it come alive.</p></div>
      <div className="story-actions"><button onClick={()=>file.current.click()} disabled={exporting}>Open project</button><button onClick={()=>downloadText(storyProjectToJson(project),`${story.id.replaceAll('/','-')}.story.json`)}>Save project</button><button className="story-primary" onClick={exportFilm} disabled={exporting}>{exporting?`Exporting ${Math.round(progress*100)}%`:'Export MP4'} <span>↗</span></button></div>
    </header>
    <input ref={file} hidden type="file" accept=".json" onChange={loadProject}/><input ref={svg} hidden type="file" accept=".svg" onChange={importArtwork}/>
    {error&&<div className="story-message error" role="alert">{error}</div>}{notice&&<div className="story-message" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notice">×</button></div>}
    {exporting&&<div className="story-message" role="status">Rendering your story. <progress max="1" value={progress}/><button onClick={()=>abort.current?.abort()}>Cancel export</button></div>}
    <FilmCollection selected={story.id} disabled={exporting} onSelect={selectFilm}/>
    <div className="story-workspace">
      <aside className="story-panel story-outline"><span className="story-kicker">01 / THE STORY</span>
        <label>Starting point<select aria-label="Story template" value={project.story} disabled={exporting} onChange={e=>selectFilm(getStory(e.target.value))}>
          {['2d','3d'].map(d=><optgroup key={d} label={`${d.toUpperCase()} authored films`}>{STORY_LIST.filter(s=>s.dimension===d).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>)}
          {project.story==='custom-fourier'&&<option value="custom-fourier">Your SVG artwork</option>}
        </select></label>
        <p className="film-description">{story.description}</p>
        {hasHook&&<p className="story-hint">Finished artwork first · {seconds(timeline.chapters[0].duration)}-second opening · Builds back to the opening pose</p>}
        {!hasHook&&['fourier','fourier-3d'].includes(story.kind)&&<button className="story-import" disabled={exporting} onClick={()=>{try{const edit=createShowcaseEdit(story,project);commit(edit);setSelected('hook');seek(0);setNotice(`Added a ${edit.chapters[0].duration}-second finished-art opening and a matching ending. Your chapter text and colours are preserved.`);}catch(e){setError(e.message);}}}>Use 60-second finished-art opening</button>}
        <button className="story-import" onClick={()=>svg.current.click()} disabled={exporting}>＋ Turn an SVG into a story</button>
        <div className="story-outline-heading"><h2>Chapters</h2><span>{seconds(timeline.duration)} sec</span></div>
        <ol className="story-chapters">{timeline.chapters.map((c,i)=><li key={c.id}><button className={chapter.id===c.id?'selected':''} disabled={exporting} onClick={()=>{setSelected(c.id);seek(c.start+Math.min(.25,c.duration/2));}}><span className="chapter-number">{String(i+1).padStart(2,'0')}</span><span><strong>{c.title.join(' ')||c.id}</strong><small>{seconds(c.start)}–{seconds(c.end)} s</small></span><span className="chapter-dot" data-active={active.id===c.id}/></button></li>)}</ol>
        <p className="story-hint">Each chapter has its own pace and purpose. Its animation cues follow when you change the timing.</p>
      </aside>
      <section className="story-preview"><div className="story-preview-bar"><span>THE FILM / {story.dimension.toUpperCase()}</span><span>{project.export.width} × {project.export.height} · {project.export.fps} fps</span></div>
        <div className="story-screen"><canvas ref={canvas} width="540" height="960" aria-label="Story video preview"/></div>
        <div className="story-transport"><button aria-label={playing?'Pause preview':'Play preview'} onClick={togglePlay} disabled={exporting}>{playing?'Ⅱ':'▶'}</button><button aria-label="Previous frame" onClick={()=>seek(time-1/project.export.fps)} disabled={exporting}>‹</button><button aria-label="Next frame" onClick={()=>seek(time+1/project.export.fps)} disabled={exporting}>›</button><span>{seconds(time).toFixed(2)} <em>/ {seconds(timeline.duration).toFixed(2)} s</em></span><label className="inline"><input type="checkbox" checked={listen} onChange={e=>{pause();setListen(e.target.checked);}}/> Hear score</label></div>
        <input className="story-seek" aria-label="Story playhead" type="range" min="0" max={Math.max(0,timeline.duration-1/project.export.fps)} step={1/project.export.fps} value={time} disabled={exporting} onChange={e=>seek(Number(e.target.value))}/>
        <div className="story-ribbon">{timeline.chapters.map((c,i)=><button key={c.id} title={c.title.join(' ')} style={{flex:c.duration}} className={active.id===c.id?'active':''} onClick={()=>{setSelected(c.id);seek(c.start+Math.min(.25,c.duration/2));}} disabled={exporting}>{i+1}</button>)}</div>
      </section>
      <aside className="story-panel story-inspector"><span className="story-kicker">02 / SHAPE THE MOMENT</span><h2>{chapter.id.replace(/([A-Z])/g,' $1')}</h2>
        <fieldset disabled={exporting}><label>On-screen title <small>One line per row, up to three rows</small><textarea aria-label="Chapter title" rows="3" value={Array.isArray(chapter.title)?chapter.title.join('\n'):chapter.title} onChange={e=>patchChapter({title:e.target.value.split('\n').slice(0,3)})}/></label>
        <label>Caption<textarea aria-label="Chapter caption" rows="2" value={chapter.caption??''} onChange={e=>patchChapter({caption:e.target.value})}/></label>
        <label>Chapter duration <span className="input-unit"><input aria-label="Chapter duration" type="number" min=".1" max="120" step=".25" value={seconds(chapter.duration)} onChange={e=>{const n=e.target.valueAsNumber;if(n>0)patchChapter({duration:n});}}/><span>seconds</span></span></label>
        <div className="story-divider"/><span className="story-kicker">03 / THE FINISH</span>
        <label>Film title<input value={project.title} onChange={e=>{if(e.target.value)commit({...project,title:e.target.value});}}/></label>
        <div className="story-fields"><label>Total length<input aria-label="Total length" type="number" min="1" max="600" step="1" value={seconds(timeline.duration)} onChange={e=>{const n=e.target.valueAsNumber;if(n>0)commit(setStoryDuration(project,n));}}/></label><label>Frame rate<select aria-label="Frame rate" value={project.export.fps} onChange={e=>commit({...project,export:{...project.export,fps:Number(e.target.value)}})}>{[24,30,60].map(v=><option key={v}>{v}</option>)}</select></label></div>
        <label>Delivery size<select aria-label="Delivery size" value={project.export.width} onChange={e=>{const width=Number(e.target.value);commit({...project,export:{...project.export,width,height:width*16/9}});}}>{[360,540,720,1080,2160].map(v=><option key={v} value={v}>{v} × {v*16/9}{v===1080?' · YouTube Shorts':''}</option>)}</select></label>
        <div className="story-swatches">{['background','ink','accent','guide'].map(k=><label key={k}><input type="color" aria-label={`${k} colour`} value={project.theme[k]} onChange={e=>commit({...project,theme:{...project.theme,[k]:e.target.value}})}/><span>{k}</span></label>)}</div>
        <label className="inline"><input type="checkbox" checked={project.loop} onChange={e=>commit({...project,loop:e.target.checked})}/> Return to the beginning</label>
        <p className="story-hint">The score is chosen below, under <strong>The sound</strong>.</p>
        {story.dimension==='3d'&&<><div className="story-divider"/><span className="story-kicker">04 / THROUGH SPACE</span>
          <label>Construction guides<select aria-label="Construction guides" value={project.params.guideMode} onChange={e=>commit({...project,params:{...project.params,guideMode:e.target.value}})}><option value="circles">Rotating circles</option><option value="spheres">Sphere cages</option><option value="none">Hide guides</option></select></label>
          <label className="inline"><input type="checkbox" checked={project.params.wireframe} onChange={e=>commit({...project,params:{...project.params,wireframe:e.target.checked}})}/> Show surface mesh</label>
          <p className="story-hint">Orbit and tilt the camera to see the depth. Camera settings are saved with your film.</p>
        </>}
        {Object.entries(project.params).filter(([,v])=>typeof v==='number').slice(0,6).map(([k,v])=><label key={k}>{story.parameterControls?.[k]?.label??k}<input aria-label={`Parameter ${k}`} type="number" min={story.parameterControls?.[k]?.min} max={story.parameterControls?.[k]?.max} step={story.parameterControls?.[k]?.step??1} value={v} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))commit({...project,params:{...project.params,[k]:e.target.valueAsNumber}});}}/></label>)}
        </fieldset>
      </aside>
    </div>
    <ScorePicker project={project} auditioner={sound()} time={time} disabled={exporting}
      onPatch={values=>commit({...project,audio:{...project.audio,...values}})} onError={setError}/>
    <section className="story-advanced"><button className="story-disclosure" onClick={()=>setShowTracks(!showTracks)}>{showTracks?'−':'＋'} Animation tracks <span>Control how the maths changes through each chapter</span></button>
      {showTracks&&<div className="story-track-editor"><p>Keys use a chapter and a progress from 0 to 1. Easing belongs to the incoming key. Apply validates the entire sequence.</p><textarea aria-label="Animation tracks JSON" spellCheck="false" rows="16" value={tracksText} onChange={e=>setTracksText(e.target.value)} disabled={exporting}/><div><button onClick={addCue} disabled={exporting}>Add cue at playhead</button><button className="story-primary" disabled={exporting} onClick={()=>{try{commit({...project,tracks:JSON.parse(tracksText)});}catch(e){setError(e.message);}}}>Apply tracks</button></div></div>}
    </section>
    <footer className="story-footer"><span>Made from equations. Told in chapters.</span><span>Project autosaves in this browser · Save a project file to keep an edit</span></footer>
  </main>;
}
