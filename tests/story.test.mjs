import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { createTimeline, compileTrack, compileChapters, resolveAnchor } from '../src/story/timeline.js';
import { createStoryClock } from '../src/story/clock.js';
import { createStoryProject, readStoryProject, setStoryDuration, storyProjectToJson } from '../src/story/project.js';
import { defineStory } from '../src/story/definition.js';
import { createStoryEngine, auditStory } from '../src/story/engine.js';
import { createFourierContour, contourWithTerms, pointOnContour } from '../src/math/contour.js';
import { renderStoryScore, SCORE_CHOICES } from '../src/story/score.js';
import { getStory, STORY_LIST } from '../src/stories/index.js';
import { drawMonkeyFilm } from '../src/shorts/fourierMonkeyFilm.js';
import { fourierMonkeyStory as constructionMonkey } from '../src/stories/monkey/story.js';
const chapter=(id,duration)=>({id,duration,title:[id]});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('chapter boundaries, negative seek and non-loop endpoints are explicit',()=>{
  const t=createTimeline({chapters:[chapter('a',2),chapter('b',3)]});
  assert.equal(t.at(2).chapter.id,'b');assert.equal(t.at(5).time,0);assert.equal(t.at(-1).time,4);
  assert.equal(t.at(5,{wrap:false}).chapterProgress,1);assert.equal(t.at(-1,{wrap:false}).time,0);
  assert.throws(()=>t.at(NaN));assert.throws(()=>createTimeline({chapters:[chapter('a',0)]}));
  assert.throws(()=>createTimeline({chapters:[chapter('a',1),chapter('a',2)]}));
});
test('anchors move with chapters while interpolating actual values',()=>{
  const chapters=[chapter('seed',2),chapter('build',4)],tracks={radius:[{at:{chapter:'build'},value:1},{at:{chapter:'build',progress:1},value:9,ease:'smooth'}]};
  const a=createTimeline({chapters,tracks}),b=createTimeline({chapters:[chapter('seed',5),chapter('build',8)],tracks});
  assert.equal(a.at(4).values.radius,5);assert.equal(b.at(9).values.radius,5);
  const c=compileChapters(chapters);assert.equal(resolveAnchor({chapter:'build',progress:.5,offset:.2},c),4.2);
  assert.throws(()=>compileTrack([{at:0,value:1},{at:0,value:2}],c));
  assert.throws(()=>compileTrack([{at:0,value:[1,2]},{at:1,value:[1,2,3]}],c));
  assert.throws(()=>compileTrack([{at:7,value:1}],c));assert.throws(()=>resolveAnchor({chapter:'missing'},c));
  assert.throws(()=>resolveAnchor({chapter:'seed',progress:2},c));
});
test('seeking samples independent scalar, vector, colour and hold tracks',()=>{
  const t=createTimeline({chapters:[chapter('one',10)],tracks:{n:[[0,0],[10,10]],p:[[0,[0,4]],[10,[10,8]]],c:[[0,'#000000'],[10,'#ffffff']],v:[[0,true],[5,false,'hold']]}});
  assert.deepEqual(t.at(5).values,{n:5,p:[5,6],c:'#808080',v:false});assert.equal(t.at(4.99).values.v,true);
  const a=t.at(1);t.at(9);assert.deepEqual(a.values,t.at(1).values);
});
test('clock advances exact frames, seeks backwards, and stops at last non-loop frame',()=>{
  const c=createStoryClock({duration:2,fps:30,loop:false});c.play();c.tick(0);c.tick(100);assert.equal(c.frame,3);
  c.seekFrame(59);c.play();c.tick(100);c.tick(200);assert.equal(c.playing,false);assert.equal(c.frame,59);
  c.seek(-10);assert.equal(c.time,0);c.configure({loop:true});c.step(-1);assert.equal(c.frame,59);
  assert.throws(()=>c.configure({fps:0}));
});
test('projects round-trip, retime absolute and anchored keys, and reject invalid data',()=>{
  const story=constructionMonkey,p=createStoryProject(story);
  const saved=readStoryProject(storyProjectToJson(p),{resolveStory:getStory});assert.deepEqual(saved.project,p);
  const short=setStoryDuration(p,15);assert.equal(createTimeline(short).duration,15);assert.equal(short.audio.bars,8);
  assert.equal(createTimeline(short).anchor({chapter:'reveal'}),11.25);
  const q=setStoryDuration({...p,tracks:{test:[[0,0],[45,1]]}},15);assert.equal(q.tracks.test[1][0],15);
  assert.throws(()=>createStoryProject(story,{export:{width:1079}}));
  assert.throws(()=>createStoryProject(story,{params:{bad:Infinity}}));
  assert.throws(()=>readStoryProject({...p,version:99},{resolveStory:getStory}));
  assert.throws(()=>readStoryProject({...p,story:'absent'},{resolveStory:getStory}));
});
test('every authored film has a serializable narrative project',()=>{
  for(const entry of STORY_LIST){
    const s=getStory(entry.id),p=createStoryProject(s);assert.equal(readStoryProject(storyProjectToJson(p),{resolveStory:getStory}).story.id,s.id);
  }
  assert.equal(STORY_LIST.filter(s=>s.dimension==='2d').length,8);
  assert.equal(STORY_LIST.filter(s=>s.dimension==='3d').length,7);
  assert.throws(()=>getStory('scene/roseNetwork'),/Unknown story/);
});
test('fractional Fourier terms really sum the rotating vectors',()=>{
  const points=Array.from({length:200},(_,i)=>{const t=i/200*Math.PI*2;return[20+100*Math.cos(t)+23*Math.cos(3*t),-10+80*Math.sin(t)];});
  const g=createFourierContour(points,{harmonics:16}),partial=contourWithTerms(g,2.5);
  for(const i of [0,13,100,319]){
    const p=pointOnContour(partial,i/partial.points.length);assert.ok(Math.hypot(p[0]-partial.points[i][0],p[1]-partial.points[i][1])<1e-8);
  }
  assert.ok(Math.hypot(...pointOnContour(g,0).map((v,i)=>v-pointOnContour(g,1)[i]))<1e-8);
});
test('SVG projects carry their own artwork and render after reload',()=>{
  const data={story:'custom-fourier',title:'A leaf',artwork:{name:'a leaf',paths:[{points:[[0,0],[100,0],[80,100],[0,0]],closed:true}],harmonics:16}};
  const story=getStory(data.story,data),project=createStoryProject(story,data);
  const loaded=readStoryProject(storyProjectToJson(project),{resolveStory:getStory});
  const engine=createStoryEngine({canvas:createCanvas(180,320),story:loaded.story,project:loaded.project,createCanvas});
  engine.renderAt(5);engine.renderAt(25);assert.equal(auditStory({engine,width:90,height:160}).exactBoundaryDelta,0);engine.dispose();
});
test('renderer is independent of seek history and disposes replaced resources',()=>{
  let disposed=0;
  const story=defineStory({id:'fixture',chapters:[chapter('one',2)],createRenderer:()=>({draw(ctx,f){ctx.fillStyle=f.time<1?'#ff0000':'#00ff00';ctx.fillRect(0,0,1080,1920);},dispose(){disposed++;}})});
  const e=createStoryEngine({canvas:createCanvas(18,32),story,createCanvas});
  const a=e.renderFrameToPixels({phase:.1});e.renderAt(1.5);assert.deepEqual(e.renderFrameToPixels({phase:.1}),a);
  e.setProject(createStoryProject(story));assert.equal(disposed,1);e.dispose();e.dispose();assert.equal(disposed,2);assert.throws(()=>e.renderAt(0));
});
test('native cancellation cleans temporary output and preserves an existing film',async()=>{
  const {renderStoryProject}=await import('../src/node/renderStory.js');
  const story=defineStory({id:'cancel-story',chapters:[chapter('one',1)],render(ctx){ctx.fillStyle='#ff00ff';ctx.fillRect(0,0,1080,1920);}});
  const out='out/story-refactor/cancel',name='cancel-story-1s.mp4';await mkdir(out,{recursive:true});await writeFile(`${out}/${name}`,'previous complete film');
  const controller=new AbortController();
  await assert.rejects(renderStoryProject({story,project:createStoryProject(story,{audio:{enabled:false},export:{width:36,height:64,fps:10,samples:1,preset:'ultrafast'}}),out,signal:controller.signal,onProgress:p=>{if(p.stage==='render')controller.abort();}}),{name:'AbortError'});
  assert.equal(await readFile(`${out}/${name}`,'utf8'),'previous complete film');
  assert.equal((await readdir(out)).some(name=>name.startsWith('.render-')),false);
});
test('the original construction soundtrack is unchanged; short scores are deterministic and finite',()=>{
  const p=createStoryProject(constructionMonkey,{audio:{score:'construction'}});
  assert.equal(hash(renderStoryScore(p).bytes),'3c39333a4ff614f67681be0ac6a30eb13ba32fa9d8e0bbeb2084c283aaf6d3d5');
  const short={...setStoryDuration(p,3),loop:false},a=renderStoryScore(short,{sampleRate:8000}),b=renderStoryScore(short,{sampleRate:8000});
  assert.equal(hash(a.bytes),hash(b.bytes));assert.equal(a.length,24000);
  assert.equal(a.channelData[0][0],0);assert.equal(a.channelData[0].at(-1),0);assert.ok(a.channelData.every(c=>c.every(Number.isFinite)));
});
test('every score in the library is distinct, deterministic, and levelled for long listening',()=>{
  const base=setStoryDuration(createStoryProject(constructionMonkey),8);
  const seen=new Map();
  for(const choice of SCORE_CHOICES){
    const p=createStoryProject(constructionMonkey,{...base,audio:{...base.audio,score:choice.id}});
    const a=renderStoryScore(p,{sampleRate:8000}),b=renderStoryScore(p,{sampleRate:8000});
    assert.equal(hash(a.bytes),hash(b.bytes),`${choice.id} is deterministic`);
    assert.ok(a.channelData.every(c=>c.every(Number.isFinite)),`${choice.id} is finite`);
    assert.equal(a.stats.score,choice.id);
    assert.ok(a.stats.peakDb<=0,`${choice.id} does not clip`);
    // The seam is what makes a score bearable on repeat. An absolute threshold
    // would only measure how busy a score is, so the loop's joint is compared
    // with the worst joint inside the film: it must be no more abrupt.
    a.channelData.forEach((c,ch)=>{
      let worst=0;for(let i=1;i<c.length;i++){const d=Math.abs(c[i]-c[i-1]);if(d>worst)worst=d;}
      assert.ok(a.stats.seam[ch]<=worst,`${choice.id} loops without a click`);
    });
    for(const [id,bytes] of seen) assert.notEqual(hash(a.bytes),bytes,`${choice.id} differs from ${id}`);
    seen.set(choice.id,hash(a.bytes));
  }
  // The six gentle scores are levelled together, and all of them sit well below
  // the original: this is the whole point of the library.
  const loudness=id=>renderStoryScore(createStoryProject(constructionMonkey,{...base,audio:{...base.audio,score:id}}),{sampleRate:8000}).stats.rmsDb;
  const original=loudness('construction');
  for(const {id} of SCORE_CHOICES.filter(s=>s.id!=='construction')){
    const rms=loudness(id);
    assert.ok(rms<original-3,`${id} is quieter than the original (${rms.toFixed(1)} vs ${original.toFixed(1)} dB)`);
    assert.ok(Math.abs(rms+24)<3,`${id} is levelled with the rest of the library (${rms.toFixed(1)} dB)`);
  }
});
test('a score can be chosen, turned down, or refused',()=>{
  const base=setStoryDuration(createStoryProject(constructionMonkey),6);
  const at=level=>renderStoryScore({...base,audio:{...base.audio,score:'still-water',level}},{sampleRate:8000});
  const full=at(1),half=at(.5),off=at(0);
  assert.ok(Math.abs((half.stats.rmsDb-full.stats.rmsDb)+6.02)<.01,'half level is six decibels down');
  assert.ok(off.channelData.every(c=>c.every(v=>v===0)),'zero level is silence');
  assert.equal(full.stats.level,1);assert.equal(half.stats.level,.5);
  assert.throws(()=>createStoryProject(constructionMonkey,{audio:{score:'no-such-score'}}),/Unknown score/);
  assert.throws(()=>createStoryProject(constructionMonkey,{audio:{level:1.5}}),/Score level/);
  assert.throws(()=>renderStoryScore({...base,audio:{...base.audio,level:-1}}),/Score level/);
  // Every authored film names a score that exists.
  for(const story of STORY_LIST) assert.ok(SCORE_CHOICES.some(s=>s.id===createStoryProject(story).audio.score),`${story.id} names a real score`);
});
test('approved monkey reference frames survive the refactor',async t=>{
  if(process.platform!=='win32'){t.skip('Reference images use Windows Arial.');return;}
  let manifest;try{manifest=JSON.parse(await readFile('out/refactor-baseline/manifest.json','utf8'));}catch{t.skip('Local migration baseline is optional outside this workspace.');return;}
  for(const f of ['arial.ttf','arialbd.ttf'])GlobalFonts.registerFromPath(`C:/Windows/Fonts/${f}`,'Film Sans');
  const e=createStoryEngine({canvas:createCanvas(manifest.width,manifest.height),story:constructionMonkey,createCanvas});
  for(const {t:time,sha256}of manifest.frames){e.renderAt(time);assert.equal(hash(e.canvas.getContext('2d').getImageData(0,0,manifest.width,manifest.height).data),sha256,`Frame ${time}`);}
  const c=createCanvas(540,960);drawMonkeyFilm(c.getContext('2d'),38.5,540,960);e.renderAt(38.5);assert.equal(hash(c.data()),hash(e.canvas.data()));e.dispose();
});
