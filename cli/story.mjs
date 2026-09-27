import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getStory, STORY_LIST, SPHERICAL_STORY_LIST, SHORTS_STORY_LIST } from '../src/stories/index.js';
import { createStoryProject, readStoryProject, setStoryDuration, storyProjectToJson } from '../src/story/project.js';
import { renderStoryProject } from '../src/node/renderStory.js';
import { SCORE_CHOICES } from '../src/story/score.js';

export async function runStoryCli(argv=process.argv.slice(2),defaults={}) {
  const {values:a}=parseArgs({args:argv,options:{
    story:{type:'string',default:defaults.story??'fourier-monkey'},project:{type:'string'},module:{type:'string'},out:{type:'string'},
    preview:{type:'boolean'},list:{type:'boolean'},help:{type:'boolean'},init:{type:'string'},duration:{type:'string'},
    width:{type:'string'},height:{type:'string'},fps:{type:'string'},samples:{type:'string'},shutter:{type:'string'},crf:{type:'string'},preset:{type:'string'},
    silent:{type:'boolean'},'frame-times':{type:'string'},font:{type:'string',multiple:true},
    score:{type:'string'},level:{type:'string'},scores:{type:'boolean'},
  }});
  if(a.help){console.log('mathloop story\n  --list\n  --scores\n  --story fourier-monkey | polar-rose\n  --init project.json\n  --project project.json [--preview] [--out folder]\n  --module ./my-story.js (default export: defineStory(...))\n  --duration 30 --width 1080 --fps 60 --samples 2 --silent\n  --score still-water --level 0.8\n  --font regular.ttf --font bold.ttf');return;}
  if(a.list){console.log([...STORY_LIST,...SPHERICAL_STORY_LIST,...SHORTS_STORY_LIST].map(s=>`${s.id.padEnd(28)} ${s.projection?'360°':s.dimension.toUpperCase()}  ${s.title}`).join('\n'));return;}
  if(a.scores){console.log(SCORE_CHOICES.map(s=>`${s.id.padEnd(18)} ${s.mood.toUpperCase().padEnd(8)} ${s.description}`).join('\n'));return;}
  let story=a.module?(await import(pathToFileURL(resolve(a.module)))).default:getStory(a.story);
  let project;
  if(a.project){const loaded=readStoryProject(await readFile(a.project,'utf8'),{resolveStory:(id,raw)=>a.module&&id===story.id?story:getStory(id,raw)});story=loaded.story;project=loaded.project;}
  else project=createStoryProject(story);
  if(a.duration)project=setStoryDuration(project,Number(a.duration));
  const settings={};for(const k of ['width','height','fps','samples','shutter','crf'])if(a[k]!==undefined)settings[k]=Number(a[k]);
  if(a.width&&!a.height)settings.height=Math.round(Number(a.width)*story.size.height/story.size.width/2)*2;
  if(a.preset)settings.preset=a.preset;
  project=createStoryProject(story,{...project,export:{...project.export,...settings},audio:{...project.audio,...(a.score?{score:a.score}:{}),...(a.level!==undefined?{level:Number(a.level)}:{}),...(a.silent?{enabled:false}:{})}});
  if(a.init){const target=resolve(a.init);await mkdir(dirname(target),{recursive:true});await writeFile(target,storyProjectToJson(project));console.log(`Saved ${target}`);return;}
  const controller=new AbortController(),cancel=()=>controller.abort();process.once('SIGINT',cancel);
  try {
    const result=await renderStoryProject({story,project,out:a.out??defaults.out,preview:a.preview,frameTimes:a['frame-times']?.split(',').map(Number),fonts:a.font,signal:controller.signal,onProgress:p=>console.log(`${p.stage}: ${Math.round(p.fraction*100)}%`)});
    console.log(result.videoPath??result.output);
  }finally{process.removeListener('SIGINT',cancel);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runStoryCli().catch(error=>{console.error(error.message);process.exitCode=1;});
