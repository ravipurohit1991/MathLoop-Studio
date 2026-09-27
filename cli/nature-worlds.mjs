#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {NATURE_WORLDS,natureWorld} from '../src/nature/worlds.js';
import {renderNatureSound} from '../src/nature/sound.js';
import {encodeWav} from '../src/audio/wav.js';
import {addSphericalMp4Metadata} from '../src/export/sphericalMp4.js';

const {values:a}=parseArgs({options:{world:{type:'string',default:'all'},out:{type:'string',default:'out/nature-worlds'},width:{type:'string',default:'3840'},duration:{type:'string',default:'20'},fps:{type:'string',default:'24'},preview:{type:'boolean'},help:{type:'boolean'}}});
if(a.help){console.log('Render photographic 360° worlds.\n  npm run nature:render [-- --world seasons|jungle|ocean|all --width 3840 --duration 20 --fps 24]\n  --preview writes panorama and perspective stills without a film.');process.exit(0);}
const worlds=a.world==='all'?NATURE_WORLDS:[natureWorld(a.world)],width=Number(a.width),duration=Number(a.duration),fps=Number(a.fps);
if(![1024,2048,3072,3840,4096].includes(width)||!Number.isFinite(duration)||duration<1||duration>120||![24,30].includes(fps))throw new Error('Invalid delivery size, duration or frame rate.');
const out=resolve(a.out);await mkdir(out,{recursive:true});
const vite=await createServer({server:{port:0,host:'127.0.0.1'}});await vite.listen();
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
const run=(args,input)=>new Promise((ok,fail)=>{
  const child=spawn('ffmpeg',args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let error='';
  child.stderr.on('data',d=>error=(error+d).slice(-5000));child.on('error',fail);
  child.on('close',code=>code===0?ok():fail(new Error(error)));child.stdin.on('error',()=>{});child.stdin.end(input);
});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>console.error(e.message));
 await page.exposeFunction('reportNatureProgress',p=>console.log(p));
 await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/nature-render.html`);
 await page.waitForFunction(()=>window.natureReady);
 for(const world of worlds){
  const folder=join(out,world.id);await mkdir(folder,{recursive:true});
  console.log(`\n${world.title} — ${width} × ${width/2}, ${duration}s`);
  await page.evaluate(async id=>{window.natureRenderer?.dispose();window.natureRenderer=await createNatureRenderer(document.querySelector('canvas'),{world:id});},world.id);
  for(const region of world.regions){
   const data=await page.evaluate(heading=>{natureRenderer.draw({width:1280,height:720,yaw:heading,fov:55,phase:.2});return natureRenderer.canvas.toDataURL('image/png');},region.heading);
   await writeFile(join(folder,`view-${region.heading}.png`),Buffer.from(data.split(',')[1],'base64'));
  }
  const panorama=await page.evaluate(width=>{natureRenderer.draw({width,height:width/2,panorama:true,phase:.2});return natureRenderer.canvas.toDataURL('image/png');},width);
  await writeFile(join(folder,'panorama.png'),Buffer.from(panorama.split(',')[1],'base64'));
  if(a.preview)continue;
  const silent=join(folder,'silent.mp4');
  const download=page.waitForEvent('download',{timeout:0});
  await page.evaluate(async options=>{
    let last=-1;
    const result=await renderNatureFilm({...options,audio:false,onProgress:p=>{const step=Math.floor(p.fraction*10);if(step!==last){last=step;window.reportNatureProgress(`${options.world}: ${step*10}%`);}}});
    const link=document.createElement('a');link.href=URL.createObjectURL(result.blob);link.download='silent.mp4';link.click();
  },{world:world.id,width,duration,fps});
  await(await download).saveAs(silent);
  const score=renderNatureSound(world.id,{duration}),raw=new Float32Array(score.length*4);
  for(let i=0;i<score.length;i++)for(let c=0;c<4;c++)raw[i*4+c]=score.channelData[c][i];
  const muxed=join(folder,'mux.mp4');
  await run(['-v','error','-y','-i',silent,'-f','f32le','-ar','48000','-ac','4','-channel_layout','4.0','-i','pipe:0',
    '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','384k','-ar','48000','-t',String(duration),'-movflags','+faststart',muxed],Buffer.from(raw.buffer));
  const name=`${world.id}-360-${duration}s.mp4`,bytes=addSphericalMp4Metadata(await readFile(muxed),{ambisonic:true});
  await writeFile(join(folder,name),bytes);
  const stems=[];
  for(const [i,stem] of score.stems.entries()){
    const file=`focus-${i}.wav`;await writeFile(join(folder,file),encodeWav({channelData:[stem.focusAudio],sampleRate:48000,dither:false}));
    stems.push({file,name:stem.name,heading:stem.heading,elevation:0,voice:stem.sound});
  }
  await writeFile(join(folder,'spatial-audio.json'),JSON.stringify({video:name,videoSha256:createHash('sha256').update(bytes).digest('hex'),duration,
    stage:world.id,audio:{codec:'AAC-LC',sampleRate:48000,channels:['W','Y','Z','X'],normalization:'SN3D',ordering:'ACN'},preview:{focus:{stems,youtubeCompatible:false}},youtubePlaybackVerified:false},null,2));
  await writeFile(join(folder,'world.json'),JSON.stringify({world:world.id,title:world.title,description:world.description,regions:world.regions,width,height:width/2,fps,duration,
    projection:'monoscopic equirectangular',photography:'Poly Haven CC0 panoramas',depth:'Procedural weather volume and ocean height field; photographic background has no captured depth',audio:'Original synthesized ambience'},null,2));
  console.log(`Wrote ${join(folder,name)}`);
 }
}finally{await browser.close();await vite.close();}
