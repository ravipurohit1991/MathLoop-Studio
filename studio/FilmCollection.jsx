import { useEffect, useRef, useState } from 'react';
import { STORY_LIST } from '../src/stories/index.js';
import { createStoryEngine } from '../src/story/engine.js';

function FilmCard({ story, selected, disabled, onSelect }) {
  const canvas=useRef();
  useEffect(()=>{
    const engine=createStoryEngine({canvas:canvas.current,story});
    const hero=engine.timeline.chapters.find(c=>c.id==='perform');
    engine.renderAt(hero.start+hero.duration*.4);engine.dispose();
  },[story]);
  return <button className={`film-card ${selected?'selected':''}`} aria-label={`Load film: ${story.title}`} aria-pressed={selected} disabled={disabled} onClick={()=>onSelect(story)}>
    <div className="film-art" style={{background:story.theme.background}}><canvas ref={canvas} width="180" height="320" aria-hidden="true"/><span className="film-dimension">{story.dimension.toUpperCase()}</span><span className="film-duration">{Number(story.duration.toFixed(2))}s</span></div>
    <strong>{story.title}</strong><small>{story.dimension==='3d'?'Fourier sculpture':'Authored animation'}</small>
  </button>;
}

export default function FilmCollection({ selected, disabled, onSelect }) {
  const [filter,setFilter]=useState('all');
  return <section className="film-collection" aria-label="Authored film collection">
    <div className="film-collection-heading"><div><span className="story-kicker">THE AUTHORED COLLECTION</span><p>Small beginnings. Extraordinary creatures.</p></div>
      <div className="film-filters" role="group" aria-label="Filter films">{[['all','All films'],['2d','2D authored films'],['3d','3D authored films']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    </div>
    <div className="film-grid">{STORY_LIST.filter(s=>filter==='all'||s.dimension===filter).map(story=><FilmCard key={story.id} story={story} selected={selected===story.id} disabled={disabled} onSelect={onSelect}/>)}</div>
  </section>;
}
