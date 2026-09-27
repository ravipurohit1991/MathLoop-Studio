import { useEffect, useRef, useState } from 'react';
import { NATURE_WORLDS, natureWorld } from '../src/nature/worlds.js';
import { createNatureRenderer } from '../src/nature/renderer.js';
import { createNatureAuditioner } from '../src/nature/sound.js';
import { renderNatureFilm } from '../src/nature/export.js';
import { download } from '../src/export/video.js';
import './nature.css';

export default function NatureStudio(){
  const [id,setId]=useState('seasons'),[ready,setReady]=useState(false),[playing,setPlaying]=useState(true);
  const [weather,setWeather]=useState(1),[duration,setDuration]=useState(20),[width,setWidth]=useState(3840);
  const [audio,setAudio]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(null);
  const [look,setLook]=useState({yaw:0,pitch:0,fov:55}),[panorama,setPanorama]=useState(false),[time,setTime]=useState(0);
  const canvas=useRef(),renderer=useRef(),audition=useRef(),drag=useRef(),abort=useRef(),state=useRef();
  const world=natureWorld(id);
  state.current={id,playing,duration,look,panorama,weather,time};
  useEffect(()=>{
    let disposed=false,raf,last=performance.now(),elapsed=0,lastReport=0;
    createNatureRenderer(canvas.current,{world:id}).then(instance=>{
      if(disposed){instance.dispose();return;}
      renderer.current=instance;instance.setWorld(state.current.id);setReady(true);
      const draw=now=>{
        const s=state.current;elapsed=s.playing?(elapsed+(now-last)/1000)%s.duration:s.time;last=now;
        const scale=Math.min(devicePixelRatio,1.5),w=Math.round(canvas.current.clientWidth*scale),h=Math.round(canvas.current.clientHeight*scale);
        instance.setWeather(s.weather);instance.draw({phase:elapsed/s.duration,...s.look,panorama:s.panorama,width:w,height:h});
        if(now-lastReport>100){setTime(elapsed);lastReport=now;}
        raf=requestAnimationFrame(draw);
      };raf=requestAnimationFrame(draw);
    }).catch(e=>setError(e.message));
    return()=>{disposed=true;cancelAnimationFrame(raf);renderer.current?.dispose();renderer.current=null;audition.current?.dispose();};
  },[]);
  useEffect(()=>{renderer.current?.setWorld(id);setLook({yaw:0,pitch:0,fov:55});audition.current?.stop();setAudio(false);},[id]);
  useEffect(()=>{audition.current?.setView(look);},[look]);
  function turn(yaw,pitch=0){setLook(value=>({...value,yaw:((yaw+180)%360+360)%360-180,pitch:Math.max(-85,Math.min(85,pitch))}));}
  async function listen(){
    try{if(audio){audition.current?.stop();setAudio(false);}else{audition.current??=createNatureAuditioner();audition.current.setView(look);await audition.current.play(id,{duration,offset:time});setAudio(true);setPlaying(true);}}
    catch(e){setError(e.message);}
  }
  async function exportFilm(){
    setError('');setProgress(0);setPlaying(false);audition.current?.stop();setAudio(false);abort.current=new AbortController();
    try{const result=await renderNatureFilm({world:id,width,duration,weather,signal:abort.current.signal,onProgress:p=>{if(p.stage==='render')setProgress(p.fraction);}});download(result.blob,`${id}-360-${duration}s.mp4`);}
    catch(e){if(!abort.current.signal.aborted)setError(e.message);}
    finally{setProgress(null);abort.current=null;}
  }
  const busy=progress!==null;
  return <main className="nature-studio">
    <header className="nature-heading"><div><p className="nature-eyebrow">NATURE WORLDS / PHOTOGRAPHIC 360°</p><h1>A little further from everyday.</h1><p>Three living landscapes. Look in any direction.</p></div><span className="nature-badge">360° × 180°<small>EVERY DIRECTION</small></span></header>
    <div className="nature-worlds" aria-label="Choose a nature world">{NATURE_WORLDS.map(item=><button key={item.id} disabled={busy} aria-pressed={id===item.id} aria-label={`Open world: ${item.title}`} onClick={()=>setId(item.id)} style={{backgroundImage:`linear-gradient(0deg,rgba(4,19,15,.92),rgba(4,19,15,.05)),url(${item.image})`}}><span>{item.eyebrow}</span><strong>{item.title}</strong><small>{item.id==='seasons'?'Rain / summer / winter / autumn':item.id==='jungle'?'Rain / canopy / mist':'Swell / reflections / sea spray'}</small></button>)}</div>
    <section className="nature-player" aria-label="Nature world preview"><div className="nature-player-bar"><span>{world.eyebrow}</span><button onClick={()=>setPanorama(!panorama)}>{panorama?'Look around':'See full panorama'}</button></div>
      <canvas ref={canvas} className={panorama?'panorama':''} tabIndex="0" aria-label="Nature panorama. Drag to look around or use arrow keys."
        onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();}}
        onPointerMove={e=>{if(!drag.current)return;turn(look.yaw-(e.clientX-drag.current.x)*.15,look.pitch+(e.clientY-drag.current.y)*.15);drag.current={x:e.clientX,y:e.clientY};}}
        onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}
        onWheel={e=>setLook(value=>({...value,fov:Math.max(40,Math.min(105,value.fov+e.deltaY*.03))}))}
        onKeyDown={e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();turn(look.yaw+(e.key==='ArrowRight'?8:e.key==='ArrowLeft'?-8:0),look.pitch+(e.key==='ArrowUp'?6:e.key==='ArrowDown'?-6:0));}}/>
      {!ready&&<p className="nature-loading">Loading the photographic world…</p>}
      <div className="nature-controls"><button disabled={!ready||busy} onClick={()=>{setPlaying(!playing);if(playing){audition.current?.stop();setAudio(false);}}}>{playing?'Pause':'Play'}</button><button disabled={!ready||busy} onClick={listen}>{audio?'Mute ambience':'Listen to this direction'}</button><span>{time.toFixed(1)} / {duration}s</span><button onClick={()=>turn(0)}>Reset view</button><button onClick={()=>canvas.current.requestFullscreen?.()}>Fullscreen</button></div>
    </section>
    <div className="nature-regions">{world.regions.map((region,i)=><button key={region.heading} onClick={()=>turn(region.heading)}><span>0{i+1} / {region.heading}°</span><strong>{region.name}</strong><small>{region.sound}</small></button>)}</div>
    <div className="nature-bottom"><div><h2>{world.title}</h2><p>{world.description}</p><p className="nature-note">Drag to explore · Scroll to zoom · Arrow keys to turn. Directional listening isolates the ambience you face in this preview.</p><p className="nature-credit">Photographic panoramas: <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">Poly Haven · CC0</a>. Animated weather, ocean and synthesized ambience by mathloop.</p></div>
      <div className="nature-export"><label>Weather intensity <output>{Math.round(weather*100)}%</output><input aria-label="Weather intensity" type="range" min="0" max="2" step=".1" value={weather} onChange={e=>setWeather(Number(e.target.value))} disabled={busy}/></label>
        <div><label>Loop length<select aria-label="Loop length" value={duration} disabled={busy} onChange={e=>{setDuration(Number(e.target.value));audition.current?.stop();setAudio(false);}}>{[10,20,30,60].map(n=><option key={n} value={n}>{n} seconds</option>)}</select></label><label>Panorama size<select aria-label="Panorama size" value={width} disabled={busy} onChange={e=>setWidth(Number(e.target.value))}>{[2048,3072,3840,4096].map(n=><option key={n} value={n}>{n} × {n/2}</option>)}</select></label></div>
        <button className="nature-primary" disabled={!ready||busy} onClick={exportFilm}>{busy?`Rendering ${Math.round(progress*100)}%`:'Export 360° MP4 ↗'}</button>{busy&&<button onClick={()=>abort.current?.abort()}>Cancel export</button>}
        <p>24 fps · Spatial ambience included. YouTube spatial audio keeps other directions audible; it does not isolate tracks like this preview.</p>
      </div></div>
    {error&&<p className="nature-error" role="alert">{error}</p>}
  </main>;
}
