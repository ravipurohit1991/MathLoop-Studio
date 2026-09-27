import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createFourierCurve3D, pointOnCurve3D, epicycleChain3D, resamplePath3D } from '../src/math/fourier3d.js';
import { createCamera3D } from '../src/story/spatial.js';
import { createShowcaseEdit } from '../src/story/showcase.js';
import { createStoryEngine, auditStory } from '../src/story/engine.js';
import { createStoryProject, readStoryProject, storyProjectToJson, setStoryDuration } from '../src/story/project.js';
import { renderStoryScore } from '../src/story/score.js';
import { getStory, STORY_LIST } from '../src/stories/index.js';
import { createTimeline } from '../src/story/timeline.js';
import { whaleCalls, whaleCallState, whaleVoice } from '../src/story/scores/whaleSong.js';
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('whale calls and visible pulses share chapter timing after retiming and seeking',()=>{
  const original=createStoryProject(getStory('fourier-whale-3d'));
  for(const duration of [60,24]){
    const project=setStoryDuration(original,duration),timeline=createTimeline(project);
    const calls=whaleCalls(timeline.chapters);
    assert.equal(calls.length,5);
    for(const call of calls){
      const chapter=timeline.chapters.find(c=>c.id===call.chapter);
      assert.ok(call.start>=chapter.start&&call.start+call.length<=chapter.end);
      const at=call.start+call.length*.5;
      assert.ok(whaleCallState(calls,at).amplitude>.5);
      assert.ok(whaleVoice(call)(0)===0);
      assert.ok(whaleVoice(call)(call.length)===0);
      whaleCallState(calls,duration-.1);
      assert.ok(Math.abs(whaleCallState(calls,at).progress-.5)<1e-12);
    }
    const construction=timeline.chapters.find(c=>c.id==='draw');
    assert.equal(whaleCallState(calls,construction.start+construction.duration*.5).amplitude,0);
    const audio=renderStoryScore(project,{sampleRate:8000});
    assert.equal(audio.length,duration*8000);
    assert.ok(audio.stats.peakDb<0);
    // The foreground call must be audible above the quiet construction bed.
    const rms=at=>{
      const data=audio.channelData[0].slice(Math.round(at*8000),Math.round((at+.2)*8000));
      return Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);
    };
    const call=calls.find(c=>c.chapter==='perform');
    assert.ok(rms(call.start+call.length*.5)>rms(construction.start+construction.duration*.5)*3);
  }
});

test('3D DFT reconstructs source samples, including depth and the Nyquist bin',()=>{
  const source=Array.from({length:64},(_,i)=>{const t=TAU*i/64;return[13+90*Math.cos(t)+12*Math.sin(3*t),-22+44*Math.sin(2*t),60*Math.sin(t)+13*Math.cos(5*t)];});
  const c=createFourierCurve3D(source,{samples:64,harmonics:32,tracePoints:64});
  c.source.forEach((p,i)=>assert.ok(distance(p,pointOnCurve3D(c,i/64))<1e-8));
  assert.ok(Math.max(...c.points.map(p=>p[2]))-Math.min(...c.points.map(p=>p[2]))>100);
  assert.ok(distance(pointOnCurve3D(c,0),pointOnCurve3D(c,1))<1e-8);
});

test('circle chains reconstruct spatial ellipses, lines and fractional harmonics exactly',()=>{
  for(const [a,b]of [[[80,12,30],[10,53,-20]],[[100,0,0],[0,0,0]],[[0,0,0],[30,50,80]],[[20,40,60],[10,20,30]]]){
    const curve={centre:[9,-3,17],terms:[{a,b,freq:3,energy:10000}]};
    for(const count of [0,.3,1])for(const t of [0,.217,.91,1]){
      const chain=epicycleChain3D(curve,t,count);
      assert.ok(distance(chain.tip,pointOnCurve3D(curve,t,count))<1e-8);
      for(const c of chain.circles)assert.ok(Math.abs(distance(c.centre,c.tip)-c.radius)<1e-8);
    }
  }
});

test('3D path validation and open-path retracing are explicit',()=>{
  assert.throws(()=>resamplePath3D([[0,0,0],[1,NaN,0],[2,0,0]]));
  assert.throws(()=>resamplePath3D([[0,0,0],[0,0,0],[0,0,0]]));
  assert.throws(()=>createFourierCurve3D([[0,0,0],[1,2,3],[2,3,1]],{harmonics:0}));
  const p=resamplePath3D([[0,0,0],[10,0,0],[10,10,5]],64,{closed:false});
  for(let i=1;i<32;i++)assert.ok(distance(p[i],p[64-i])<1e-8);
});

test('perspective responds to real depth and clips points behind the camera',()=>{
  const camera=createCamera3D({yaw:0,pitch:0,distance:1000,focal:1000,centre:[0,0]});
  assert.ok(camera.project([100,0,300])[0]>camera.project([100,0,-300])[0]);
  assert.equal(camera.project([0,0,1001]),null);
  assert.notDeepEqual(camera.project([100,20,60]),createCamera3D({yaw:1}).project([100,20,60]));
});

test('saved spatial controls reject invalid camera ranges and guide modes',()=>{
  const story=getStory('fourier-whale-3d');
  for(const params of [{zoom:0},{cameraYaw:181},{cameraPitch:-90},{orbitAmount:-1},{guideMode:'invalid'},{wireframe:1}])assert.throws(()=>createStoryProject(story,{params}));
});

test('3D openings last five seconds and give their saved time to step 4',()=>{
  for(const story of STORY_LIST.filter(s=>s.dimension==='3d')){
    const previous=createShowcaseEdit(story.constructionStory,undefined,{hookDuration:10});
    assert.equal(story.chapters[0].duration,5);
    assert.equal(story.duration,60);
    for(const chapter of story.chapters.slice(1)){
      const old=previous.chapters.find(c=>c.id===chapter.id);
      assert.ok(Math.abs(chapter.duration-old.duration-(chapter.id==='draw'?5:0))<1e-10,'only assembly receives the five seconds');
    }
  }
  for(const story of STORY_LIST.filter(s=>s.dimension==='2d'&&s.edition==='showcase'))assert.equal(story.chapters[0].duration,10);
});

for(const story of STORY_LIST.filter(s=>s.dimension==='3d'))test(`${story.id}: one element grows into the sculpture without a jump, including retimed saved edits`,()=>{
  for(const definition of [story,story.constructionStory])for(const legacy of [false,true]){
    let project=createStoryProject(definition,{loop:false,params:{guideMode:'none',orbitAmount:0,wireframe:true}});
    if(legacy){
      project.tracks.study=[
        {at:{chapter:'seed'},value:1,ease:'hold'},
        {at:{chapter:'combine',progress:.85},value:1},
        {at:{chapter:'draw',progress:.08},value:0,ease:'smooth'},
        {at:{chapter:'outro'},value:0},
        {at:{chapter:'outro',progress:.65},value:1,ease:'smooth'},
      ];
      if(definition.edition==='showcase')project.tracks.study.unshift({at:{chapter:'hook'},value:0});
      project.chapters=project.chapters.map(c=>c.id==='draw'?{...c,duration:7.3}:c);
      project=setStoryDuration(project,19);
    }
    const canvas=createCanvas(90,160),ctx=canvas.getContext('2d');
    let route=[],closed=false,shapes=[],meshStrokes=0;
    const original=Object.fromEntries(['beginPath','moveTo','lineTo','closePath','stroke'].map(name=>[name,ctx[name].bind(ctx)]));
    ctx.beginPath=()=>{route=[];closed=false;original.beginPath();};
    for(const name of ['moveTo','lineTo'])ctx[name]=(x,y)=>{route.push([x,y]);original[name](x,y);};
    ctx.closePath=()=>{closed=true;original.closePath();};
    ctx.stroke=()=>{
      if(route.length>=3&&ctx.lineWidth>=1.39&&ctx.lineWidth<=2.51)shapes.push({points:route.slice(),closed});
      if(route.length>=3&&ctx.lineWidth<.8)meshStrokes++;
      original.stroke();
    };
    const engine=createStoryEngine({canvas,story:definition,project,createCanvas});
    const sample=(chapter,progress)=>{
      shapes=[];meshStrokes=0;
      const frame=engine.renderAt(engine.timeline.anchor({chapter,progress}));
      return {shapes,meshStrokes,frame};
    };
    try{
      const seed=story.artwork.study;
      assert.ok(story.artwork.parts[0].curves.includes(seed),'the study is an actual ring of the final surface');
      for(const progress of [.1,.5,.999999])assert.equal(sample('combine',progress).shapes.length,1,'step 3 contains only the single study');
      const before=sample('combine',1-1e-8),join=sample('draw',0);
      assert.equal(join.shapes.length,1);
      before.shapes[0].points.forEach((point,i)=>assert.ok(distance(point,join.shapes[0].points[i])<1e-6,'the same ring crosses the chapter boundary at the same size and position'));
      assert.equal(sample('draw',.04).shapes.length,1,'allow time for the seed to settle before adding neighbours');
      const total=story.artwork.parts.reduce((sum,part)=>sum+part.curves.length,0);
      let previous=1;
      for(const progress of [.25,.5,.75,.999]){
        const result=sample('draw',progress);
        assert.ok(result.shapes.length>previous,'more individual rings arrive throughout assembly');
        assert.ok(result.shapes.some(shape=>!shape.closed),'new rings are traced gradually');
        assert.equal(result.meshStrokes,0,'the surface overlay cannot expose the entire shape early');
        previous=result.shapes.length;
      }
      const complete=sample('reveal',0),p=project.params,v=complete.frame.values;
      assert.equal(complete.shapes.length,total,'every ring is present when the surface reveal begins');
      const camera=createCamera3D({yaw:p.cameraYaw*Math.PI/180,pitch:p.cameraPitch*Math.PI/180,zoom:p.zoom});
      const expected=story.artwork.parts.flatMap(part=>part.curves.map(c=>c.points.map(point=>camera.project(story.artwork.pose?.(point,part.id,complete.frame.phase,v.life)??point).slice(0,2))));
      for(const shape of complete.shapes){
        assert.ok(shape.closed,'all rings have finished tracing before reveal');
        assert.ok(expected.some(points=>points.length===shape.points.length&&points.every((p,i)=>distance(p,shape.points[i])<1e-8)),'completed rings use the exact final surface vertices');
      }
      const mid=sample('draw',.5).shapes;
      sample('perform',.4);
      assert.deepEqual(sample('draw',.5).shapes,mid,'assembly also works when seeking backwards');
    }finally{engine.dispose();}
  }
});

for(const story of STORY_LIST.filter(s=>!['fourier-monkey','polar-rose'].includes(s.id)))test(`${story.id}: editable, seek deterministic, animated, and seamless`,()=>{
  const project=createStoryProject(story),loaded=readStoryProject(storyProjectToJson(project),{resolveStory:getStory});
  const engine=createStoryEngine({canvas:createCanvas(180,320),story:loaded.story,project:loaded.project,createCanvas});
  const hero=engine.timeline.chapters.find(c=>c.id==='perform');
  const pixels=t=>{engine.renderAt(t);return Buffer.from(engine.canvas.getContext('2d').getImageData(0,0,180,320).data);};
  const at=hero.start+hero.duration*.4,a=pixels(at);pixels(2);assert.deepEqual(pixels(at),a);
  assert.notDeepEqual(pixels(at+.7),a,'the performance moves');
  const audit=auditStory({engine,width:90,height:160});assert.equal(audit.exactBoundaryDelta,0);assert.ok(audit.wrapDelta<2,'the wrap is visually continuous');
  story.audit();
  if(story.dimension==='3d'){
    engine.setProject({...project,params:{...project.params,cameraYaw:70}});assert.notDeepEqual(pixels(at),a,'camera orbit changes spatial projection');
    const circles=pixels(4);engine.setProject({...project,params:{...project.params,cameraYaw:70,guideMode:'spheres'}});assert.notDeepEqual(pixels(4),circles,'sphere guides render');
    engine.setProject({...project,params:{...project.params,cameraYaw:70,guideMode:'none'}});assert.notDeepEqual(pixels(4),circles,'guides can be hidden');
    const before=pixels(at);engine.setProject({...project,params:{...project.params,cameraYaw:70,guideMode:'none',wireframe:true}});assert.notDeepEqual(pixels(at),before,'mesh overlay renders');
  }
  engine.setProject(setStoryDuration(project,12));assert.ok(Math.abs(engine.duration-12)<1e-10);engine.renderAt(9,{samples:2,shutter:.5,fps:30});
  engine.dispose();
});

test('new scores are distinct, deterministic, and finite',()=>{
  const scores=STORY_LIST.filter(s=>!['fourier-monkey','polar-rose'].includes(s.id)).map(s=>{
    const p=setStoryDuration(createStoryProject(s),2),a=renderStoryScore(p,{sampleRate:8000}),b=renderStoryScore(p,{sampleRate:8000});
    assert.deepEqual(a.bytes,b.bytes);assert.ok(a.channelData.every(c=>c.every(Number.isFinite)));return Buffer.from(a.bytes);
  });
  for(let i=1;i<scores.length;i++)assert.notDeepEqual(scores[0],scores[i]);
  assert.throws(()=>createStoryProject(getStory('fourier-whale-3d'),{audio:{transpose:Infinity}}));
});
