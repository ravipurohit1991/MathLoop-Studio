import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inspectSpatialAudio} from '../src/export/sphericalMp4.js';
const out='out/nature-tests';await mkdir(out,{recursive:true});
const vite=await createServer({server:{port:0,host:'127.0.0.1'}});await vite.listen();
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const base=`http://127.0.0.1:${vite.httpServer.address().port}`;
 await page.goto(`${base}/nature-render.html`);await page.waitForFunction(()=>window.natureReady);
 const metrics=await page.evaluate(async()=>{
  const r=await createNatureRenderer(document.querySelector('canvas')),results=[];
  const frame=phase=>r.renderFrameToPixels({phase,width:1024,height:512}).slice();
  const difference=(a,b)=>a.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-b[i])),0)/(a.length*.75);
  for(const world of ['seasons','jungle','ocean']){
   r.setWorld(world);const first=frame(0),later=frame(.27),again=frame(0),loop=frame(1);
   // A detailed photograph can have large differences between ordinary adjacent
   // pixels. Compare the wrap with its neighbouring columns at the same scale.
   let seam=0,adjacent=0,brokenSeam=0;
   for(let y=0;y<512;y++)for(let c=0;c<3;c++){
    const at=x=>first[(y*1024+x)*4+c];
    seam+=Math.abs(at(0)-at(1023));
    for(const x of [0,1,2,3,1019,1020,1021,1022])adjacent+=Math.abs(at(x)-at(x+1));
    // Negative control: a maximally contrasting final column must be rejected.
    brokenSeam+=Math.max(at(0),255-at(0));
   }
   results.push({world,motion:difference(first,later),determinism:difference(first,again),loop:difference(first,loop),seam:seam/(512*3),adjacent:adjacent/(512*3*8),brokenSeam:brokenSeam/(512*3)});
  }r.dispose();return results;
 });
 for(const m of metrics){assert.equal(m.determinism,0);assert.equal(m.loop,0);assert.ok(m.motion>.03,`${m.world} must visibly animate`);const seamLimit=Math.max(3,m.adjacent*1.5);assert.ok(m.seam<seamLimit,`${m.world} seam: ${m.seam}, nearby edges: ${m.adjacent}`);assert.ok(m.brokenSeam>seamLimit,`${m.world}: seam check must reject the negative control`);}
 await writeFile(`${out}/visual-metrics.json`,JSON.stringify(metrics,null,2));
 // Exercise four-channel AAC where available, and the explicit error plus
 // silent spherical export on platforms whose native codec is stereo-only.
 const spatialSupported=await page.evaluate(async()=>{
  if(typeof AudioEncoder==='undefined')return false;
  return (await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',numberOfChannels:4,sampleRate:48000,bitrate:384000})).supported;
 });
 if(!spatialSupported){
  await assert.rejects(page.evaluate(()=>renderNatureFilm({world:'seasons',width:1024,duration:1,fps:24})),/four-channel AAC spatial audio/);
  console.log('SKIP: four-channel browser AAC is unavailable; verified the native-workflow error and testing silent spherical export.');
 }
 const download=page.waitForEvent('download');
 download.catch(()=>{}); // Preserve the actual export error if cleanup closes the page.
 await page.evaluate(async audio=>{
  const result=await renderNatureFilm({world:'seasons',width:1024,duration:1,fps:24,audio});
  const a=document.createElement('a');a.href=URL.createObjectURL(result.blob);a.download='seasons-test.mp4';a.click();
 },spatialSupported);
 const path=`${out}/browser-spatial.mp4`;await(await download).saveAs(path);
 if(spatialSupported)assert.deepEqual(inspectSpatialAudio(await readFile(path)),{channelMap:[0,1,2,3]});
 const probe=JSON.parse((await promisify(execFile)('ffprobe',['-v','error','-show_streams','-of','json',path],{windowsHide:true})).stdout);
 const audio=probe.streams.find(s=>s.codec_type==='audio');if(spatialSupported){assert.equal(audio.channels,4);assert.equal(audio.sample_rate,'48000');}else assert.equal(audio,undefined);
 assert.ok(probe.streams[0].side_data_list.some(s=>s.projection==='equirectangular'));
 await page.goto(`${base}/?studio=nature`);await page.waitForFunction(()=>!document.querySelector('.nature-loading'));
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const canvas=page.locator('.nature-player canvas'),front=await canvas.screenshot();
 await page.locator('.nature-regions button').nth(2).click();assert.notDeepEqual(await canvas.screenshot(),front);
 await canvas.focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('slider',{name:'Weather intensity',exact:true}).fill('0');
 await page.getByRole('button',{name:'Listen to this direction',exact:true}).click();
 await page.getByRole('button',{name:'Mute ambience',exact:true}).click();
 await page.getByRole('button',{name:'Open world: Where the water meets the sky',exact:true}).click();
 await page.screenshot({path:`${out}/ocean-studio.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile page must not overflow');
 await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
 assert.deepEqual(errors,[]);
 console.log(`PASS: all three worlds animate, render deterministically, close their loops, and cover the seam. Spherical export verified${spatialSupported?' with four-channel spatial audio':' without audio (codec unavailable)'}. Studio controls and mobile layout work.`);
 console.log(metrics);
}finally{await browser.close();await vite.close();}
