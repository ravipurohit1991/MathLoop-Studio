import { useState } from 'react';
import StoryStudio from './StoryStudio.jsx';
import Studio360 from './Studio360.jsx';
import NatureStudio from './NatureStudio.jsx';
import './story.css';

const STORAGE = 'mathloop.studio.mode.v1';
const STUDIOS = [
  { id: 'story', label: 'Story Studio', hint: 'Author one film, chapter by chapter' },
  { id: 'stage', label: '360 Studio', hint: 'Place finished films around one viewpoint' },
  { id: 'nature', label: 'Nature Worlds', hint: 'Photographic landscapes in every direction' },
];

export default function App() {
  const [mode, setMode] = useState(() => {
    const requested = new URL(location.href).searchParams.get('studio');
    if (STUDIOS.some(s => s.id === requested)) return requested;
    try { return STUDIOS.some(s => s.id === localStorage.getItem(STORAGE)) ? localStorage.getItem(STORAGE) : 'story'; }
    catch { return 'story'; }
  });
  const choose = id => { setMode(id); try { localStorage.setItem(STORAGE, id); } catch { /* Private windows still get to switch. */ } };
  return <>
    <nav className="studio-switch" aria-label="Choose a studio">
      <span className="studio-brand">mathloop</span>
      <div role="tablist">{STUDIOS.map(studio => <button key={studio.id} role="tab" aria-selected={mode === studio.id} title={studio.hint} onClick={() => choose(studio.id)}>{studio.label}</button>)}</div>
      <span className="studio-hint">{STUDIOS.find(s => s.id === mode).hint}</span>
    </nav>
    {mode === 'story' ? <StoryStudio/> : mode === 'nature' ? <NatureStudio/> : <Studio360/>}
  </>;
}
