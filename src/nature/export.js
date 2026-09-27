import { createNatureRenderer } from './renderer.js';
import { renderNatureSound } from './sound.js';
import { renderVideo } from '../export/video.js';
import { addSphericalMp4Metadata } from '../export/sphericalMp4.js';

export async function renderNatureFilm({world='seasons',width=3840,duration=20,fps=24,weather=1,audio=true,onProgress,signal}={}){
  if(![1024,2048,3072,3840,4096].includes(width))throw new Error('Choose a supported panorama width.');
  if(!Number.isFinite(duration)||duration<1||duration>120)throw new Error('Choose a duration from 1 to 120 seconds.');
  if(![24,30].includes(fps))throw new Error('Choose 24 or 30 fps.');
  const canvas=document.createElement('canvas'),renderer=await createNatureRenderer(canvas,{world,weather});
  try{
    let soundtrack=null;
    if(audio){
      const score=renderNatureSound(world,{duration});
      const buffer=new AudioBuffer({numberOfChannels:4,length:score.length,sampleRate:score.sampleRate});
      score.channelData.forEach((data,i)=>buffer.copyToChannel(data,i));
      soundtrack={buffer,ambisonic:true,volume:1,seamless:true,loop:true};
    }
    const result=await renderVideo({engine:renderer,width,height:width/2,duration,fps,samples:1,shutter:0,
      quality:'high',audio:soundtrack,onProgress,signal});
    const bytes=addSphericalMp4Metadata(await result.blob.arrayBuffer(),{ambisonic:audio});
    return {...result,blob:new Blob([bytes],{type:'video/mp4'}),bytes:bytes.length};
  }finally{renderer.dispose();}
}
