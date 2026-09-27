// Reproducible delivery of the new authored collection, using the shared exporter.
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { getStory, STORY_LIST } from '../src/stories/index.js';
import { createStoryProject, storyProjectToJson } from '../src/story/project.js';
import { renderStoryProject } from '../src/node/renderStory.js';

const {values:a}=parseArgs({options:{preview:{type:'boolean'},width:{type:'string',default:'1080'},fps:{type:'string',default:'30'},samples:{type:'string',default:'2'},out:{type:'string',default:'out/showcase-collection'},story:{type:'string'},help:{type:'boolean'}}});
if(a.help){console.log('npm run collection -- [--preview] [--width 1080] [--fps 30] [--samples 2] [--story fourier-whale-3d] [--out folder]');process.exit(0);}
const ids=a.story?[a.story]:STORY_LIST.filter(story=>story.edition==='showcase').map(story=>story.id);
const output=resolve(a.out),deliveries=[],controller=new AbortController();
process.once('SIGINT',()=>controller.abort());
await mkdir(output,{recursive:true});
for(const id of ids){
  const story=getStory(id),width=Number(a.width);
  const project=createStoryProject(story,{export:{width,height:Math.round(width*16/9/2)*2,fps:Number(a.fps),samples:Number(a.samples)}});
  const projectDirectory=story.edition==='showcase'?'projects/showcase':'projects';
  await mkdir(projectDirectory,{recursive:true});
  // Keep an existing user edit when regenerating the production collection.
  await writeFile(`${projectDirectory}/${id}.story.json`,storyProjectToJson(createStoryProject(story)),{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  const result=await renderStoryProject({story,project,out:join(output,id),preview:a.preview,signal:controller.signal,onProgress:p=>console.log(`${id}: ${p.stage} ${Math.round(p.fraction*100)}%`)});
  deliveries.push({story:id,title:story.title,dimension:story.dimension,output:result.output,video:result.videoPath??null});
  await writeFile(join(output,'collection.json'),JSON.stringify(deliveries,null,2)+'\n');
}
console.log(`Collection ready: ${output}`);
