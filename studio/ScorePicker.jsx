import { useEffect, useRef, useState } from 'react';
import { SCORE_CHOICES } from '../src/story/score.js';

const MOODS = { calm: 'Calm', warm: 'Warm', deep: 'Deep', bright: 'Bright', playful: 'Playful' };

/**
 * Pick the film's score by ear.
 *
 * Clicking a card does both things at once: it plays that score over the film
 * you are editing and makes it the one that will be exported. Nothing here is
 * a preview of something else -- an audition is the same arrangement the MP4
 * will carry, rendered at a lower sample rate so it starts sooner.
 */
export default function ScorePicker({ project, auditioner, time, disabled, onPatch, onError }) {
  const [playing, setPlaying] = useState(() => auditioner.sounding());
  const [preparing, setPreparing] = useState('');
  const [ready, setReady] = useState(() => new Set());
  const warmed = useRef(false);
  const selected = project.audio.score;
  const level = project.audio.level ?? 1;
  const silent = !project.audio.enabled;

  useEffect(() => auditioner.onChange(setPlaying), [auditioner]);
  useEffect(() => { auditioner.setLevel(level); }, [level, auditioner]);
  // Any edit to the film changes what a score is arranged against, so the
  // "plays instantly" marks have to be re-earned.
  useEffect(() => { setReady(new Set(SCORE_CHOICES.filter(s => auditioner.ready(project, s.id)).map(s => s.id))); }, [project, auditioner]);

  const stop = () => auditioner.stop();

  async function choose(id) {
    if (disabled) return;
    if (playing === id) { stop(); return; }
    stop();
    if (id !== selected || silent) onPatch({ score: id, enabled: true });
    const chosen = { ...project, audio: { ...project.audio, score: id, enabled: true } };
    setPreparing(id);
    try {
      await auditioner.play(chosen, id, { offset: time, level });
      setReady(r => new Set(r).add(id));
      if (!warmed.current) {
        warmed.current = true;
        auditioner.warm(chosen, SCORE_CHOICES.map(s => s.id).filter(other => other !== id))
          .then(() => setReady(new Set(SCORE_CHOICES.filter(s => auditioner.ready(chosen, s.id)).map(s => s.id))));
      }
    } catch (error) { onError(error.message); }
    finally { setPreparing(''); }
  }

  return <section className="story-scores">
    <div className="story-scores-head">
      <div><span className="story-kicker">05 / THE SOUND</span><h2>Choose the score</h2>
        <p>{SCORE_CHOICES.length} original scores, each arranged against this film&apos;s own chapters. Click one to hear it from the playhead; the one you leave selected is the one that is exported.</p></div>
      <div className="story-scores-level">
        <label>Volume <span className="input-unit"><input aria-label="Score volume" type="range" min="0" max="1" step=".05" value={level} disabled={disabled}
          onChange={e => { const next = Number(e.target.value); auditioner.setLevel(next); onPatch({ level: next }); }}/><span>{Math.round(level * 100)}%</span></span></label>
        {playing && <button onClick={stop}>■ Stop</button>}
      </div>
    </div>
    <div className="score-grid">
      {SCORE_CHOICES.map(score => <button key={score.id} type="button" disabled={disabled}
        className={`score-card${!silent && selected === score.id ? ' selected' : ''}${playing === score.id ? ' playing' : ''}`}
        aria-pressed={!silent && selected === score.id} onClick={() => choose(score.id)}>
        <span className="score-card-top"><strong>{score.name}</strong><em>{MOODS[score.mood] ?? score.mood}</em></span>
        <small>{score.description}</small>
        <span className="score-card-state">
          {preparing === score.id ? 'Preparing…' : playing === score.id ? '■ Playing' : '▶ Hear it'}
          {ready.has(score.id) && preparing !== score.id && playing !== score.id && <b title="Already rendered; plays instantly">·</b>}
        </span>
      </button>)}
      <button type="button" disabled={disabled} className={`score-card silent${silent ? ' selected' : ''}`} aria-pressed={silent}
        onClick={() => { stop(); onPatch({ enabled: false }); }}>
        <span className="score-card-top"><strong>No score</strong><em>Silent</em></span>
        <small>Export the film without a soundtrack, ready for a voiceover or your own music.</small>
        <span className="score-card-state">{silent ? '■ Selected' : 'Leave it silent'}</span>
      </button>
    </div>
  </section>;
}
