// Local application tests; the viewer plays the real encoded MP4 through WebGL.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { start360Preview } from '../src/node/preview360.js';
const {server,url}=await start360Preview({video:process.argv[2],port:0});
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
const page=await browser.newPage({viewport:{width:1440,height:1150}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const out='out/360-aquarium/player-checks';await mkdir(out,{recursive:true});
try {
  await page.goto(url);await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  assert.equal(await page.locator('#status').textContent(),'');
  const video=await page.locator('#film').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
  assert.equal(video.width,video.height*2);assert.equal(video.duration,20);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#film').currentTime>.2);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Sound on',exact:true}).click();assert.equal(await page.locator('#film').evaluate(v=>v.muted),false);
  await page.getByRole('button',{name:'Mute',exact:true}).click();
  const canvas=page.locator('#view'),original=await canvas.screenshot();
  await page.getByRole('button',{name:'02 The manta',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#direction').textContent.includes('120°'));
  assert.notDeepEqual(await canvas.screenshot(),original,'changing heading changes the decoded view');
  await page.screenshot({path:`${out}/manta.png`,fullPage:true});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  const bounds=await canvas.boundingBox(),x=bounds.x+bounds.width*.6,y=bounds.y+bounds.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-250,y+20,{steps:12});await page.mouse.up();
  assert.doesNotMatch(await page.locator('#direction').textContent(),/ · 0°$/,'drag changes heading');
  const dragged=await canvas.screenshot();await page.mouse.wheel(0,-400);assert.notDeepEqual(await canvas.screenshot(),dragged,'scroll zoom changes the view');
  await canvas.focus();const before=await page.locator('#direction').textContent();await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#direction').textContent(),before);
  await page.getByLabel('Video time',{exact:true}).fill('12');await page.waitForFunction(()=>{const v=document.querySelector('#film');return !v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-12)<.1;});
  await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.screenshot({path:`${out}/whale.png`,fullPage:true});
  await page.getByRole('button',{name:'03 The golden knot',exact:true}).click();await page.screenshot({path:`${out}/knot.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('[data-format="portrait"]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.getByRole('button',{name:'Portrait 9:16',exact:true}).getAttribute('aria-pressed'),'true','mobile defaults to portrait');
  const portrait=await canvas.boundingBox();assert.ok(Math.abs(portrait.width/portrait.height-9/16)<.001,'portrait window has a 9:16 aspect');
  assert.equal(await page.locator('#film').evaluate(v=>v.videoWidth/v.videoHeight),2,'the full spherical source stays 2:1');
  const heldTime=await page.locator('#film').evaluate(v=>v.currentTime);
  await page.getByRole('button',{name:'Wide 16:9',exact:true}).click();
  const wide=await canvas.boundingBox();assert.ok(Math.abs(wide.width/wide.height-16/9)<.001);
  assert.equal(await page.locator('#film').evaluate(v=>v.currentTime),heldTime,'format switches preserve playback time');
  await page.getByRole('button',{name:'Portrait 9:16',exact:true}).click();
  await canvas.scrollIntoViewIfNeeded();const pb=await canvas.boundingBox(),beforePortrait=await page.locator('#direction').textContent();
  await page.mouse.move(pb.x+pb.width*.65,pb.y+pb.height*.4);await page.mouse.down();await page.mouse.move(pb.x+pb.width*.3,pb.y+pb.height*.45,{steps:10});await page.mouse.up();
  assert.notEqual(await page.locator('#direction').textContent(),beforePortrait,'portrait drag changes direction');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
  await page.setViewportSize({width:1440,height:1150});await page.reload();await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  assert.equal(await page.getByRole('button',{name:'Portrait 9:16',exact:true}).getAttribute('aria-pressed'),'true','portrait link survives reload on desktop');
  await page.screenshot({path:`${out}/portrait-desktop.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log('360° player passed: playback, audio, drag, zoom, keyboard, seek, portrait/wide switching and mobile layout.');
  const sourceServer=await createServer({configFile:false,root:resolve('.'),server:{host:'127.0.0.1',port:5292},plugins:[{
    name:'spherical-export-test',configureServer(vite){vite.middlewares.use('/export-check',(_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>360 export check</title>');});},
  }]});
  try {
    await sourceServer.listen();await page.goto(`http://127.0.0.1:${sourceServer.httpServer.address().port}/export-check`);
    const encoded=await page.evaluate(async()=>{
      const api=await import('/src/index.js'),story=api.getStory('fourier-aquarium-360');
      const project=api.setStoryDuration(api.createStoryProject(story,{audio:{enabled:false},export:{width:256,height:128,fps:2,samples:1}}),1);
      const engine=api.createStoryEngine({canvas:document.createElement('canvas'),story,project});
      try {const result=await api.renderStoryVideo({engine});return{projection:result.projection,bytes:Array.from(new Uint8Array(await result.blob.arrayBuffer()))};}
      finally {engine.dispose();}
    });
    assert.equal(encoded.projection,'equirectangular');const path=`${out}/browser-export-360.mp4`;await writeFile(path,new Uint8Array(encoded.bytes));
    const probe=JSON.parse((await promisify(execFile)('ffprobe',['-v','error','-show_streams','-of','json',path],{windowsHide:true})).stdout);
    assert.ok(probe.streams[0].side_data_list.some(s=>s.side_data_type==='Spherical Mapping'&&s.projection==='equirectangular'));
    await promisify(execFile)('ffmpeg',['-v','error','-i',path,'-f','null','-'],{windowsHide:true});
    assert.deepEqual(errors,[]);console.log('Browser export passed: WebCodecs MP4 decodes and includes recognized spherical metadata.');
  } finally {await sourceServer.close();}
} finally {await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
