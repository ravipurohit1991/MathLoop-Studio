import { renderVideo } from '../export/video.js';
import { renderStoryScore } from './score.js';
import { toAudioBuffer } from '../audio/render.js';
import { addSphericalMp4Metadata } from '../export/sphericalMp4.js';

/** Browser export uses the same frame-source and codecs as the loop library. */
export async function renderStoryVideo({ engine, signal, onProgress, ...overrides }) {
  const project=engine.project, settings={...project.export,...overrides};
  const spherical=engine.story?.projection==='equirectangular';
  if(spherical&&settings.width!==settings.height*2)throw new Error('360° export requires a 2:1 panorama.');
  if(signal?.aborted) throw new DOMException('Export cancelled.','AbortError');
  const score=project.audio.enabled?renderStoryScore(project):null;
  const audio=score?{buffer:toAudioBuffer(score),volume:1,loop:project.loop,seamless:true}:null;
  try {
    const result=await renderVideo({engine,...settings,duration:engine.duration,codec:'avc',container:'mp4',quality:'high',audio,signal,onProgress});
    if(!spherical)return result;
    const bytes=addSphericalMp4Metadata(await result.blob.arrayBuffer());
    if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
    return {...result,blob:new Blob([bytes],{type:'video/mp4'}),bytes:bytes.byteLength,projection:'equirectangular'};
  } catch(error) {
    if(signal?.aborted || error.name==='AbortedError') throw new DOMException('Export cancelled.','AbortError');
    throw error;
  }
}
