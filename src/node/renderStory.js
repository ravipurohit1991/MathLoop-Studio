import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rename, rm, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStoryEngine } from '../story/engine.js';
import { createStoryProject, storyProjectToJson } from '../story/project.js';
import { createTimeline } from '../story/timeline.js';
import { renderStoryScore } from '../story/score.js';
import { addSphericalMp4Metadata } from '../export/sphericalMp4.js';

export async function registerStoryFonts(paths = process.platform==='win32'?['C:/Windows/Fonts/arial.ttf','C:/Windows/Fonts/arialbd.ttf']:[]) {
  for(const path of paths){await access(path);if(!GlobalFonts.registerFromPath(path,'Film Sans'))throw new Error(`Could not load font ${path}`);}
}
const aborted=signal=>{if(signal?.aborted)throw new DOMException('Render cancelled.','AbortError');};
function command(program,args) {
  return new Promise((ok,fail)=>{
    const process=spawn(program,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',error='';
    process.stdout.on('data',data=>output+=data);process.stderr.on('data',data=>error=(error+data).slice(-8000));
    process.once('error',fail);process.once('close',code=>code===0?ok(output):fail(new Error(`${program} failed (${code}): ${error}`)));
  });
}
const difference=(a,b)=>{let sum=0;for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)sum+=Math.abs(a[i+c]-b[i+c]);return sum/(a.length/4*3);};

/** Render any registered story or custom definition to a reviewable delivery folder. */
export async function renderStoryProject({story,project,out,preview=false,frameTimes,signal,onProgress=()=>{},fonts,videoName}={}) {
  const resolved=createStoryProject(story,project),timeline=createTimeline(resolved);
  const {width,height,fps,samples,shutter,crf,preset}=resolved.export,duration=timeline.duration;
  const spherical=story.projection==='equirectangular';
  if(spherical&&width!==height*2)throw new Error('360° export requires a 2:1 panorama (for example 3840 × 1920).');
  const frames=Math.round(duration*fps),encodedDuration=frames/fps;
  if(frames<1)throw new Error('The story must contain at least one output frame.');
  aborted(signal);await registerStoryFonts(fonts);
  if(!preview)await command('ffmpeg',['-version']);
  const output=resolve(out??join('out','stories',story.id.replaceAll('/','-')));await mkdir(output,{recursive:true});
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  const engine=createStoryEngine({canvas,story,project:resolved,createCanvas});
  const provider={render:async(time,options)=>{engine.renderAt(time,options);return ctx.getImageData(0,0,width,height).data;},dispose:()=>engine.dispose()};
  const frame=async(time,options={})=>{aborted(signal);return provider.render(time,options);};
  let temporary,ff,finished;
  try {
    const times=frameTimes??timeline.chapters.map(c=>c.start+c.duration*.5);
    if(!times.length||times.some(t=>!Number.isFinite(t)||t<0||t>duration))throw new Error('Preview frame times must be inside the story.');
    const tileHeight=spherical?180:640,rowHeight=tileHeight+44;
    const sheet=createCanvas(1080,rowHeight*Math.ceil(times.length/3)),sc=sheet.getContext('2d');sc.fillStyle=resolved.theme.background;sc.fillRect(0,0,sheet.width,sheet.height);
    for(const [i,time]of times.entries()){
      await frame(time);await writeFile(join(output,`frame-${String(time).replace('.','_')}.png`),await canvas.encode('png'));
      const x=i%3*360,y=Math.floor(i/3)*rowHeight;sc.drawImage(canvas,x,y,360,tileHeight);sc.fillStyle=resolved.theme.ink;sc.font='18px "Film Sans",Arial';sc.fillText(`${time.toFixed(2)} s`,x+18,y+tileHeight+29);
    }
    await writeFile(join(output,'contact-sheet.png'),await sheet.encode('png'));
    const hero=timeline.chapters.find(c=>c.id==='perform')??timeline.chapters.at(-1);
    await frame(hero.start+hero.duration*.4);await writeFile(join(output,'cover.png'),await canvas.encode('png'));
    const start=(await frame(0)).slice(),end=(await frame(duration)).slice(),previous=(await frame(duration-1/fps)).slice(),next=await frame(1/fps);
    const audit={exactBoundaryDelta:difference(start,end),wrapDelta:difference(start,previous),ordinaryDelta:difference(start,next),math:story.audit?.()??null};
    if(resolved.loop&&audit.exactBoundaryDelta!==0)throw new Error('The loop boundary differs.');
    const score=resolved.audio.enabled?renderStoryScore(resolved):null;
    const audioPath=join(output,'original-score.wav');if(score)await writeFile(audioPath,score.bytes);
    await writeFile(join(output,'project.json'),storyProjectToJson(resolved));
    const manifest={story:story.id,title:resolved.title,duration,encodedDuration,frames,width,height,fps,samples,shutter,audit,audio:score?.stats??null,backend:'Skia',encoding:{video:'H.264 High',pixelFormat:'yuv420p',colour:'Rec.709',crf,preset},preview};
    if(spherical)manifest.spherical={projection:'equirectangular',stereo:'mono',horizontalDegrees:360,verticalDegrees:180,metadata:['Spherical Video V2','Spherical Video V1'],youtubePlaybackVerified:false};
    onProgress({stage:'preview',fraction:0,output});
    if(preview){await writeFile(join(output,'production.json'),JSON.stringify(manifest,null,2));return{output,manifest};}
    const filename=videoName??`${story.id.replaceAll('/','-')}-${Number(encodedDuration.toFixed(3))}s.mp4`;
    if(filename!==filename.split(/[\\/]/).at(-1)||!filename.endsWith('.mp4'))throw new Error('Video name must be an MP4 filename.');
    const videoPath=join(output,filename);temporary=join(output,`.render-${randomUUID()}.mp4`);
    const args=['-hide_banner','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0',...(score?['-i',audioPath]:[]),'-map','0:v:0',...(score?['-map','1:a:0']:[]),'-c:v','libx264','-preset',preset,'-crf',String(crf),'-profile:v','high','-pix_fmt','yuv420p','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,noise=c0s=2:c0f=u:c0_seed=73019,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv',...(score?['-c:a','aac','-b:a','320k','-ar','48000','-af','volume=0.5dB']:[]),'-t',String(encodedDuration),'-movflags','+faststart','-metadata',`title=${resolved.title}`,temporary];
    ff=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe'],windowsHide:true});let log='';
    ff.stderr.on('data',d=>log=(log+d.toString()).slice(-6000));ff.stdin.on('error',()=>{});
    finished=new Promise((ok,fail)=>{ff.once('error',fail);ff.once('close',code=>code===0?ok():fail(new Error(`FFmpeg failed (${code}): ${log}`)));});
    // Attach immediately: a missing encoder must never leave an unhandled rejection.
    finished.catch(()=>{});
    const cancel=()=>ff.kill();signal?.addEventListener('abort',cancel,{once:true});
    try {
      for(let i=0;i<frames;i++) {
        const pixels=await frame(i/fps,{samples,shutter,fps});
        if(ff.exitCode!==null)throw new Error(`FFmpeg exited: ${log}`);
        const bytes=Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength);
        await Promise.race([new Promise((ok,fail)=>ff.stdin.write(bytes,error=>error?fail(error):ok())),finished.then(()=>{throw new Error('Encoder stopped before the last frame.');})]);
        if(i%fps===0)onProgress({stage:'render',fraction:i/frames,frame:i,frames,output});
      }
      ff.stdin.end();await finished;aborted(signal);
    }finally{signal?.removeEventListener('abort',cancel);}
    if(spherical){onProgress({stage:'spherical-metadata',fraction:.98,output});await writeFile(temporary,addSphericalMp4Metadata(await readFile(temporary)));aborted(signal);}
    const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',temporary]));
    const video=probe.streams.find(s=>s.codec_type==='video');
    if(video?.width!==width||video?.height!==height||video?.pix_fmt!=='yuv420p'||Math.abs(Number(probe.format.duration)-encodedDuration)>.08)throw new Error('Encoded file failed delivery verification.');
    if(spherical&&!video.side_data_list?.some(s=>s.side_data_type==='Spherical Mapping'&&s.projection==='equirectangular'))throw new Error('Encoded file is missing recognized spherical metadata.');
    await rename(temporary,videoPath);temporary=null;
    manifest.file=filename;manifest.verification=probe;
    await writeFile(join(output,'production.json'),JSON.stringify(manifest,null,2));
    onProgress({stage:'complete',fraction:1,output,videoPath});return{output,videoPath,manifest};
  } finally {
    if(ff&&ff.exitCode===null)ff.kill();
    await finished?.catch(()=>{});
    await provider.dispose();
    if(temporary)await rm(temporary,{force:true});
  }
}
