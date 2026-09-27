import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { createSphericalCamera, createPanoramaViewport, sphericalPathCopies, drawSphericalMeshes } from '../src/story/spherical.js';
import { addSphericalMp4Metadata } from '../src/export/sphericalMp4.js';
import { createStoryEngine, auditStory } from '../src/story/engine.js';
import { createStoryProject, readStoryProject, storyProjectToJson } from '../src/story/project.js';
import { getStory } from '../src/stories/index.js';
import { start360Preview } from '../src/node/preview360.js';
import { aquariumTourHeading } from '../src/stories/spatial/aquariumShort.js';
const command = promisify(execFile), out = 'out/tests-360';

test('spherical projection maps all directions with a fixed viewpoint', () => {
  const camera = createSphericalCamera({ width: 400, height: 200 });
  assert.deepEqual(camera.project([0,0,-10]), [200,100,10]);
  assert.deepEqual(camera.project([10,0,0]), [300,100,10]);
  assert.deepEqual(camera.project([-10,0,0]), [100,100,10]);
  assert.equal(camera.project([0,-10,0])[1], 0);
  assert.equal(camera.project([0,10,0])[1], 200);
  assert.equal(camera.project([0,0,0]), null);
  assert.equal(camera.project([NaN,0,1]), null);
  assert.throws(() => createSphericalCamera({ width: 400, height: 300 }), /2:1/);
});

test('a mesh crossing the back seam paints both edges and leaves the front empty', () => {
  const camera = createSphericalCamera({ width: 400, height: 200 });
  const vertices = [[-2,-2,10],[2,-2,10],[2,2,10],[-2,2,10]];
  const copies = sphericalPathCopies(vertices.map(camera.project), 400);
  assert.equal(copies.length, 2);
  for (const path of copies) assert.ok(Math.max(...path.map(p=>p[0])) - Math.min(...path.map(p=>p[0])) < 30);
  const canvas = createCanvas(400,200), ctx = canvas.getContext('2d');
  drawSphericalMeshes(ctx, [{ vertices, faces:[[0,1,2],[0,2,3]], colour:'#ffffff' }], camera);
  const alpha = x => ctx.getImageData(x,100,1,1).data[3];
  assert.ok(alpha(1)>0); assert.ok(alpha(398)>0); assert.equal(alpha(200),0);
});

test('the aquarium saves, seeks deterministically, animates, and loops', () => {
  const story = getStory('fourier-aquarium-360'), project = createStoryProject(story);
  assert.equal(readStoryProject(storyProjectToJson(project), { resolveStory:getStory }).story.id, story.id);
  assert.throws(() => createStoryProject(story,{export:{width:1920,height:1080}}), /2:1/);
  const engine = createStoryEngine({ canvas:createCanvas(512,256), story, project, createCanvas });
  try {
    const pixels = t => { engine.renderAt(t); return Buffer.from(engine.canvas.getContext('2d').getImageData(0,0,512,256).data); };
    const first = pixels(4); pixels(12); assert.deepEqual(pixels(4),first); assert.notDeepEqual(pixels(5),first);
    const audit = auditStory({ engine,width:256,height:128 });
    assert.equal(audit.exactBoundaryDelta,0); assert.ok(audit.wrapDelta < 2);
  } finally { engine.dispose(); }
});

test('portrait viewport faces each exhibit from the panorama origin', () => {
  for(const heading of [0,120,240]){
    const camera=createPanoramaViewport({heading}),a=heading*Math.PI/180;
    const centre=camera.project([Math.sin(a)*1100,0,-Math.cos(a)*1100]);
    assert.ok(Math.abs(centre[0]-540)<1e-8);assert.equal(centre[1],960);
    assert.equal(camera.project([-Math.sin(a)*1100,0,Math.cos(a)*1100]),null);
  }
  assert.equal(aquariumTourHeading(0),0);assert.equal(aquariumTourHeading(.4),120);assert.equal(aquariumTourHeading(.75),240);assert.equal(aquariumTourHeading(1),360);
  assert.throws(()=>createPanoramaViewport({horizontalFov:180}));
});

test('the regular Shorts edit is portrait, deterministic, animated and seamless', () => {
  const story=getStory('fourier-aquarium-short'),project=createStoryProject(story);
  assert.equal(project.export.width/project.export.height,9/16);assert.equal(story.projection,undefined);
  assert.equal(readStoryProject(storyProjectToJson(project),{resolveStory:getStory}).story.id,story.id);
  const engine=createStoryEngine({canvas:createCanvas(180,320),story,project,createCanvas});
  try{
    const pixels=t=>{engine.renderAt(t);return Buffer.from(engine.canvas.getContext('2d').getImageData(0,0,180,320).data);};
    const whale=pixels(0),manta=pixels(8),knot=pixels(15);
    assert.notDeepEqual(whale,manta);assert.notDeepEqual(manta,knot);assert.deepEqual(pixels(8),manta);
    const audit=auditStory({engine,width:180,height:320});assert.equal(audit.exactBoundaryDelta,0);assert.ok(audit.wrapDelta<2);
  }finally{engine.dispose();}
});

test('spherical metadata preserves decoded video and audio, with moov before or after media', async () => {
  await mkdir(out,{recursive:true});
  for (const fast of [false,true]) {
    const source = `${out}/${fast?'fast':'tail'}.mp4`, target = `${out}/${fast?'fast':'tail'}-360.mp4`;
    await command('ffmpeg',['-v','error','-y','-f','lavfi','-i','testsrc2=size=128x64:rate=4','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',...(fast?['-movflags','+faststart']:[]),source],{windowsHide:true});
    const original = await readFile(source), tagged = addSphericalMp4Metadata(original);
    await writeFile(target,tagged);
    assert.deepEqual(addSphericalMp4Metadata(tagged),tagged,'tagging twice is idempotent');
    const probe = JSON.parse((await command('ffprobe',['-v','error','-show_streams','-of','json',target],{windowsHide:true})).stdout);
    assert.ok(probe.streams[0].side_data_list.some(s=>s.side_data_type==='Spherical Mapping'&&s.projection==='equirectangular'));
    assert.equal(probe.streams.length,2);
    const decoded = async path => (await command('ffmpeg',['-v','error','-i',path,'-map','0:v','-map','0:a','-f','framemd5','-'],{windowsHide:true})).stdout;
    assert.equal(await decoded(target),await decoded(source),'every decoded frame and audio block is intact');
    const text = new TextDecoder().decode(tagged); assert.ok(text.includes('<GSpherical:Spherical>true</GSpherical:Spherical>'));
  }
  assert.throws(()=>addSphericalMp4Metadata(new Uint8Array([1,2,3])),/Truncated/);
});

test('preview serves the chosen film, byte ranges, and no other workspace files', async () => {
  await mkdir(out,{recursive:true}); const video=`${out}/range-fixture.mp4`; await writeFile(video,'0123456789');
  const {server,url}=await start360Preview({video,port:0});
  try {
    assert.match(await (await fetch(url)).text(),/Inside a Fourier aquarium/);
    const part=await fetch(`${url}/video.mp4`,{headers:{Range:'bytes=2-5'}});assert.equal(part.status,206);assert.equal(await part.text(),'2345');
    const tail=await fetch(`${url}/video.mp4`,{headers:{Range:'bytes=-3'}});assert.equal(await tail.text(),'789');
    assert.equal((await fetch(`${url}/video.mp4`,{headers:{Range:'bytes=999-'}})).status,416);
    assert.equal((await fetch(`${url}/package.json`)).status,404);
  } finally {server.closeAllConnections();await new Promise(ok=>server.close(ok));}
});
