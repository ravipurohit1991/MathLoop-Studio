import { createSpatialPlayback } from './audio.js';
const canvas = document.querySelector('#view'), video = document.querySelector('#film');
const audioConfig = JSON.parse(document.querySelector('#audio-config').textContent);
const audio = createSpatialPlayback(video, audioConfig);
const audioMode = document.querySelector('#audio-mode'), audioNote = document.querySelector('#audio-note');
audioMode.querySelector('[value="focus"]').disabled = !audioConfig.focus;
audioMode.disabled = !audioConfig.spatial && !audioConfig.focus;
function describeAudio() {
  audioNote.textContent = audio.mode === 'focus'
    ? 'Only sounds you face are heard. This uses separate tracks in this player; the YouTube MP4 does not include this behavior.'
    : audioConfig.spatial
      ? 'The sound follows your view; other sources remain audible. This stereo preview is not YouTube’s binaural renderer. Use headphones.'
      : 'This MP4 has no spatial audio metadata. Its soundtrack stays fixed when you turn.';
}
describeAudio();
audioMode.addEventListener('change', async () => {
  audioMode.disabled = true;
  try { await audio.setMode(audioMode.value); describeAudio(); status.textContent = ''; }
  catch (error) { audioMode.value = audio.mode; failure(error); }
  finally { audioMode.disabled = false; }
});
const play = document.querySelector('#play'), sound = document.querySelector('#sound'), seek = document.querySelector('#seek');
const status = document.querySelector('#status'), direction = document.querySelector('#direction');
const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const seconds = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let yaw = 0, pitch = 0, fov = 80, ready = false, initialized = false, dragging = null, animation;
const cinema = document.querySelector('.cinema'), mobile = matchMedia('(max-width: 680px)');
const initialFormat = new URL(location.href).searchParams.get('view');
let format = 'wide', formatChosen = ['wide','portrait'].includes(initialFormat);
const defaultFov = () => format === 'portrait' ? 100 : 80;
function setFormat(next, remember = true) {
  format = next === 'portrait' ? 'portrait' : 'wide'; fov = defaultFov();
  cinema.classList.toggle('portrait', format === 'portrait');
  document.querySelectorAll('[data-format]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.format === format)));
  document.querySelector('#format-note').textContent = format === 'portrait'
    ? 'Portrait 360° playback · Drag to explore. This is the local player, not the YouTube Shorts feed.'
    : 'Choose your viewing window. Drag to explore in either format.';
  if (remember) { formatChosen = true; const url = new URL(location.href); url.searchParams.set('view', format); history.replaceState(null, '', url); }
}
setFormat(formatChosen ? initialFormat : mobile.matches ? 'portrait' : 'wide', false);
mobile.addEventListener('change', () => { if (!formatChosen) setFormat(mobile.matches ? 'portrait' : 'wide', false); });
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => setFormat(button.dataset.format)));

function failure(error) { status.textContent = error.message; }
function initialize() {
  if (!gl) throw new Error('This browser could not start WebGL. Try a browser with hardware acceleration enabled.');
  function shader(type, source) {
    const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){uv=position;gl_Position=vec4(position,0.,1.);}'));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision highp float;
    varying vec2 uv; uniform sampler2D film; uniform float yaw; uniform float pitch; uniform float scale; uniform float aspect;
    void main(){
      vec3 ray=normalize(vec3(uv.x*aspect*scale,-uv.y*scale,-1.0));
      float cp=cos(pitch),sp=sin(pitch),cy=cos(yaw),sy=sin(yaw);
      ray=vec3(ray.x,cp*ray.y+sp*ray.z,-sp*ray.y+cp*ray.z);
      ray=vec3(cy*ray.x-sy*ray.z,ray.y,sy*ray.x+cy*ray.z);
      vec2 at=vec2(fract(0.5+atan(ray.x,-ray.z)/6.28318530718),clamp(0.5+asin(clamp(ray.y,-1.,1.))/3.14159265359,0.,1.));
      gl_FragColor=texture2D(film,at);
    }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uniforms = Object.fromEntries(['yaw','pitch','scale','aspect'].map(name => [name, gl.getUniformLocation(program, name)]));
  let textureReady = false, uploadedTime = -1;
  function draw() {
    if (ready && video.readyState >= 2 && !video.seeking && (!textureReady || uploadedTime !== video.currentTime)) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      textureReady = true; uploadedTime = video.currentTime;
    }
    // Keep looking around the last decoded frame while paused or buffering.
    if (textureReady) {
      const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.uniform1f(uniforms.yaw, yaw * Math.PI / 180); gl.uniform1f(uniforms.pitch, pitch * Math.PI / 180);
      gl.uniform1f(uniforms.scale, Math.tan(fov * Math.PI / 360)); gl.uniform1f(uniforms.aspect, width / height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    animation = requestAnimationFrame(draw);
  }
  draw();
}
try { initialize(); initialized = true; } catch (error) { failure(error); }
function loaded() {
  if (!initialized) return;
  if (video.videoWidth !== video.videoHeight * 2) { failure(new Error('Choose a full 2:1 equirectangular MP4 for this player.')); return; }
  ready = true; play.disabled = false; sound.disabled = false; seek.disabled = false; seek.max = video.duration;
  status.textContent = ''; updateTime();
}
video.addEventListener('loadeddata', loaded);
if (video.readyState >= 2) loaded();
video.addEventListener('error', () => failure(new Error('The MP4 could not be loaded. Render the film first, then restart the preview command.')));
video.addEventListener('play', () => { play.textContent = 'Pause'; });
video.addEventListener('pause', () => { play.textContent = 'Play'; });
play.addEventListener('click', async () => { if (video.paused) { try { await audio.resume(); await video.play(); } catch(error) { failure(error); } } else video.pause(); });
sound.addEventListener('click', async () => {
  sound.disabled = true;
  try { await audio.setEnabled(!audio.enabled); sound.textContent = audio.enabled ? 'Mute' : 'Sound on'; }
  catch (error) { failure(error); }
  finally { sound.disabled = false; }
});
function updateTime() { seek.value = video.currentTime; document.querySelector('#time').textContent = `${seconds(video.currentTime)} / ${seconds(video.duration || 0)}`; }
video.addEventListener('timeupdate', updateTime);
seek.addEventListener('input', () => { video.currentTime = Number(seek.value); updateTime(); });
// The served film decides what the page is called and what stands in it.
const stage = JSON.parse(document.querySelector('#stage').textContent);
const exhibits = stage.exhibits.length ? stage.exhibits : [[0, 'the film']];
const voiceAt = heading => audioConfig.focus?.stems.find(s => Math.abs(((s.heading - heading + 540) % 360) - 180) < 1)?.voice?.split(' · ')[0];
document.querySelector('.intro h1').textContent = stage.title;
document.querySelector('.intro .eyebrow').textContent = stage.eyebrow;
document.querySelector('#lead').innerHTML = `${stage.lead}<br>Drag the picture to find your way around.`;
document.querySelector('nav[aria-label="Look at an exhibit"]').replaceChildren(...exhibits.map(([heading, name], index) => {
  const button = document.createElement('button');
  button.dataset.heading = heading;
  button.append(String(index + 1).padStart(2, '0') + ' ');
  const label = document.createElement('span');
  label.textContent = name.replace(/^./, c => c.toUpperCase()) + (voiceAt(heading) ? ` · ${voiceAt(heading)}` : '');
  button.append(label);
  return button;
}));
function updateView() {
  yaw = ((yaw + 180) % 360 + 360) % 360 - 180; pitch = clamp(pitch, -85, 85); fov = clamp(fov, 35, 110);
  const nearest = exhibits.reduce((a,b) => Math.abs(((yaw-b[0]+540)%360)-180) < Math.abs(((yaw-a[0]+540)%360)-180) ? b : a);
  direction.textContent = `Facing ${nearest[1]}${voiceAt(nearest[0]) ? ` · ${voiceAt(nearest[0])}` : ''} · ${Math.round(yaw)}°`;
  audio.setView({ yaw, pitch });
}
updateView();
canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragging = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', event => {
  if (dragging?.id !== event.pointerId) return;
  const sensitivity = fov / Math.max(1, canvas.clientHeight);
  yaw -= (event.clientX - dragging.x) * sensitivity; pitch += (event.clientY - dragging.y) * sensitivity;
  dragging.x = event.clientX; dragging.y = event.clientY; updateView();
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event, () => { dragging = null; });
canvas.addEventListener('wheel', event => { event.preventDefault(); fov += event.deltaY * .035; updateView(); }, { passive: false });
canvas.addEventListener('keydown', event => {
  const actions = { ArrowLeft: () => yaw -= 8, ArrowRight: () => yaw += 8, ArrowUp: () => pitch += 6, ArrowDown: () => pitch -= 6, '+': () => fov -= 5, '=': () => fov -= 5, '-': () => fov += 5 };
  if (actions[event.key]) { event.preventDefault(); actions[event.key](); updateView(); }
});
document.querySelector('#reset').addEventListener('click', () => { yaw = 0; pitch = 0; fov = defaultFov(); updateView(); });
document.querySelectorAll('[data-heading]').forEach(button => button.addEventListener('click', () => { yaw = Number(button.dataset.heading); pitch = 0; updateView(); }));
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.cinema').requestFullscreen(); } catch(error) { failure(error); }
});
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(animation); video.pause(); failure(new Error('The graphics context was lost. Reload the page to continue.')); });
