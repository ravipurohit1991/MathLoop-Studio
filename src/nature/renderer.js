import { NATURE_TEXTURES, natureWorld } from './worlds.js';
import { mulberry32 } from '../audio/dsp.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const vertex = `attribute vec2 position; varying vec2 screen; void main(){screen=position;gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
varying vec2 screen;
uniform sampler2D jungle,summer,winter,autumn,sky,water;
uniform float phase,weather,yaw,pitch,fov,aspect;
uniform int world,panorama;
const float PI=3.14159265359,TAU=6.28318530718;
vec2 pano(vec3 ray){return vec2(fract(.5+atan(ray.x,-ray.z)/TAU),.5-asin(clamp(ray.y,-1.,1.))/PI);}
float wave(vec2 p,float t){
 return .24*sin(dot(p,vec2(.62,.28))+t*2.)+.14*sin(dot(p,vec2(-.35,.9))-t*3.)
  +.052*sin(dot(p,vec2(1.7,1.1))+t*5.)+.026*sin(dot(p,vec2(-3.8,2.7))-t*7.);
}
vec3 skyColour(vec3 ray){return texture2D(sky,pano(ray)).rgb;}
vec3 sea(vec3 ray,float t){
 if(ray.y>=-.002)return skyColour(ray);
 float d=min(3500.,1.65/-ray.y);
 float farDistance=d;
 vec3 horizon=skyColour(normalize(vec3(ray.x,.025,ray.z)))*vec3(.76,.86,.94);
 if(d>220.)return horizon;
 vec2 p=ray.xz*d;
 // Ray/height-field intersection brings the swell into the foreground.
 for(int i=0;i<4;i++){
   float h=wave(p,t)*weather;
   d=clamp((1.65-h)/-ray.y,0.,3500.);p=ray.xz*d;
 }
 float h=wave(p,t),e=.04+d*.006;
 float dx=(wave(p+vec2(e,0.),t)-h)/e;
 float dz=(wave(p+vec2(0.,e),t)-h)/e;
 vec3 n=normalize(vec3(-dx*weather,1.,-dz*weather));
 vec3 reflected=reflect(ray,n);reflected.y=abs(reflected.y);
 float fresnel=.025+.975*pow(1.-max(0.,dot(-ray,n)),5.);
 // A small water-only patch of the photographic cove supplies fine colour detail.
 vec2 detailUV=vec2(.48,.55)+.018*sin(p*.32+vec2(sin(t),cos(t))*.1);
 float detail=dot(texture2D(water,detailUV).rgb,vec3(.299,.587,.114));
 vec3 deep=vec3(.015,.16,.22)*( .8+detail*.8 );
 vec3 colour=mix(deep,skyColour(reflected),fresnel*.86+.14);
 vec3 sun=normalize(vec3(-.5,.55,-.65));
 float sparkle=pow(max(0.,dot(reflect(-sun,n),-ray)),150.);
 colour+=vec3(1.,.91,.68)*sparkle*.65;
 float foam=smoothstep(.22,.38,h)*smoothstep(.05,.20,length(vec2(dx,dz)));
 foam*=.45+.55*sin(p.x*5.+sin(p.y*3.))*.5;
 colour=mix(colour,vec3(.76,.91,.89),foam*weather*.3);
 float haze=1.-exp(-d*.0017);
 colour=mix(colour,horizon,haze*.72);
 return mix(colour,horizon,smoothstep(60.,220.,farDistance));
}
void main(){
 vec3 ray;
 if(panorama==1){float a=screen.x*PI,e=screen.y*PI*.5;ray=vec3(sin(a)*cos(e),sin(e),-cos(a)*cos(e));}
 else {
  ray=normalize(vec3(screen.x*aspect*tan(fov*.5),screen.y*tan(fov*.5),-1.));
  float c=cos(pitch),s=sin(pitch);ray=vec3(ray.x,c*ray.y-s*ray.z,s*ray.y+c*ray.z);
  c=cos(yaw);s=sin(yaw);ray=vec3(c*ray.x-s*ray.z,ray.y,s*ray.x+c*ray.z);
 }
 float t=phase*TAU;vec3 colour;
 if(world==2){colour=sea(ray,t);}
 else {
  vec2 uv=pano(ray);
  float canopy=1.-smoothstep(.48,.72,uv.y);
  vec2 bend=vec2(sin(uv.x*TAU*14.+t)*cos(uv.y*21.+t*2.),sin(uv.x*TAU*9.-t*2.));
  uv+=bend*.0007*canopy*weather;
  vec3 rainy=texture2D(jungle,vec2(fract(uv.x),uv.y)).rgb*vec3(.65,.77,.73);
  float mist=(.5+.5*sin(ray.x*8.+ray.z*5.+sin(t)))*exp(-pow(ray.y*3.,2.));
  rainy=mix(rainy,vec3(.42,.54,.5),mist*.10*weather);
  if(world==1){colour=rainy;}
  else {
   vec3 warm=texture2D(summer,vec2(fract(uv.x-.25),uv.y)).rgb*vec3(1.05,1.01,.91);
   vec3 cold=texture2D(winter,vec2(fract(uv.x-.5),uv.y)).rgb*vec3(.98,1.02,1.07);
   vec3 gold=texture2D(autumn,vec2(fract(uv.x+.25),uv.y)).rgb*vec3(1.05,.96,.88);
   float angle=atan(ray.x,-ray.z);
   vec4 w=smoothstep(vec4(.66913),vec4(.74314),vec4(cos(angle),sin(angle),-cos(angle),-sin(angle)));
   w/=dot(w,vec4(1.));
   colour=rainy*w.x+warm*w.y+cold*w.z+gold*w.w;
   // The pole is one point: blend the four source skies/floors there.
   colour=mix(colour,(rainy+warm+cold+gold)*.25,smoothstep(.985,1.,abs(ray.y)));
  }
 }
 gl_FragColor=vec4(clamp(colour,0.,1.),1.);
}`;
const particleVertex = `
attribute vec2 position; attribute float size; attribute vec4 colour; attribute float kind;
varying vec4 tint; varying float type;
void main(){gl_Position=vec4(position,0.,1.);gl_PointSize=size;tint=colour;type=kind;}`;
const particleFragment = `
precision mediump float;varying vec4 tint;varying float type;
void main(){vec2 q=gl_PointCoord*2.-1.;float alpha;
 if(type<.5){alpha=(1.-smoothstep(.03,.35,abs(q.x+q.y*.12)))*(1.-abs(q.y));}
 else if(type<1.5){alpha=1.-smoothstep(.2,1.,length(q));}
 else if(type<2.5){float leaf=pow(abs(q.x+q.y*.25),.7)+q.y*q.y;alpha=1.-smoothstep(.7,1.,leaf);}
 else {alpha=exp(-dot(q,q)*5.);}
 gl_FragColor=vec4(tint.rgb,tint.a*alpha);}`;

function program(gl, vs, fs) {
  const result = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]) {
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(result,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(result);if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(result));
  return result;
}

/** Photograph-backed spherical worlds with a 3D weather volume and an ocean height field. */
export async function createNatureRenderer(canvas, { world='seasons', weather=1 }={}) {
  natureWorld(world);
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('This world needs WebGL. Enable browser hardware acceleration.');
  const background=program(gl,vertex,fragment),particlesProgram=program(gl,particleVertex,particleFragment);
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const textures=[];
  await Promise.all(Object.entries(NATURE_TEXTURES).map(async ([name,url],unit)=>{
    const img=new Image();img.src=url;await img.decode();
    const texture=gl.createTexture();textures.push(texture);
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.useProgram(background);gl.uniform1i(gl.getUniformLocation(background,name),unit);
  }));
  const uniforms=Object.fromEntries(['phase','weather','yaw','pitch','fov','aspect','world','panorama'].map(key=>[key,gl.getUniformLocation(background,key)]));
  const particleBuffer=gl.createBuffer(),rng=mulberry32(7492);
  const particles=Array.from({length:3200},(_,i)=>({x:(rng()-.5)*32,y:rng()*16,z:(rng()-.5)*32,seed:rng()*TAU,kind:i%4,scale:.6+rng()}));
  const particleData=new Float32Array(particles.length*3*8);
  const locations=Object.fromEntries(['position','size','colour','kind'].map(key=>[key,gl.getAttribLocation(particlesProgram,key)]));
  let pixels,flipped;
  function resizeCanvas(width,height){if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;pixels=null;}}
  function draw({phase=0,yaw=0,pitch=0,fov=75,panorama=false,width=canvas.width,height=canvas.height}={}){
    resizeCanvas(width,height);phase=((phase%1)+1)%1;
    gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.useProgram(background);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    const at=gl.getAttribLocation(background,'position');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
    gl.uniform1f(uniforms.phase,phase);gl.uniform1f(uniforms.weather,weather);
    gl.uniform1f(uniforms.yaw,yaw*DEG);gl.uniform1f(uniforms.pitch,pitch*DEG);gl.uniform1f(uniforms.fov,fov*DEG);
    gl.uniform1f(uniforms.aspect,width/height);gl.uniform1i(uniforms.panorama,panorama?1:0);
    gl.uniform1i(uniforms.world,{seasons:0,jungle:1,ocean:2}[world]);gl.drawArrays(gl.TRIANGLES,0,6);
    if(world==='ocean'||weather===0)return;
    const time=phase*TAU,cy=Math.cos(yaw*DEG),sy=Math.sin(yaw*DEG),cp=Math.cos(pitch*DEG),sp=Math.sin(pitch*DEG);
    const focal=height/(2*Math.tan(fov*DEG/2));let count=0;
    for(const particle of particles){
      const kind=particle.kind;
      const x=particle.x+Math.sin(time+particle.seed)*(kind===0?.25:1.2)*weather;
      const z=particle.z+Math.cos(time+particle.seed)*.6;
      const y=((particle.y-phase*16*(kind===0?9:kind===1?1:kind===2?2:0))%16+16)%16-6;
      const distance=Math.hypot(x,y,z);if(distance<1.3)continue;
      const angle=Math.atan2(x,-z),elevation=Math.asin(y/distance);
      let alpha=1;
      if(world==='seasons'){
        const centre=[0,Math.PI,-Math.PI/2,Math.PI/2][kind];
        alpha=Math.max(0,Math.min(1,(Math.cos(angle-centre)-.68)/.2));
      }else if(kind===1||kind===2)continue;
      alpha*=Math.min(1,(distance-1.3)/1.5)*weather;
      if(alpha<.01)continue;
      let sx,syScreen,size;
      if(panorama){sx=angle/Math.PI;syScreen=elevation/(Math.PI/2);size=height*.013*particle.scale/Math.max(1,distance*.25);}
      else{
        const a=cy*x+sy*z,b=-sy*x+cy*z,v=cp*y+sp*b,depth=sp*y-cp*b;
        if(depth<.5)continue;
        sx=a*focal/depth/(width/2);syScreen=v*focal/depth/(height/2);size=focal*(kind===0?.24:kind===3?.06:.1)*particle.scale/depth;
        if(Math.abs(sx)>1.1||Math.abs(syScreen)>1.1)continue;
      }
      size=Math.max(1.2,Math.min(40,size));
      const colour=kind===0?[.69,.83,.82,.27]:kind===1?[.96,.99,1.,.75]:kind===2?[.78+.12*Math.sin(particle.seed),.33+.14*Math.cos(particle.seed),.065,.8]:[1.,.88,.45,.35];
      for(const shift of panorama?[-2,0,2]:[0]){
        if(Math.abs(sx+shift)>1+size/width)continue;
        particleData.set([sx+shift,syScreen,size,colour[0],colour[1],colour[2],colour[3]*alpha,kind],count*8);count++;
      }
    }
    gl.useProgram(particlesProgram);gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,particleData.subarray(0,count*8),gl.DYNAMIC_DRAW);
    for(const [key,n,offset] of [['position',2,0],['size',1,8],['colour',4,12],['kind',1,28]]){
      gl.enableVertexAttribArray(locations[key]);gl.vertexAttribPointer(locations[key],n,gl.FLOAT,false,32,offset);
    }
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,count);
    for(const key of Object.keys(locations))gl.disableVertexAttribArray(locations[key]);
  }
  return {canvas,draw,resizeCanvas,
    setWorld(id){natureWorld(id);world=id;},setWeather(value){weather=Math.max(0,Math.min(2,value));},
    renderFrameToPixels({phase,width,height}){
      draw({phase,width,height,panorama:true});
      const length=width*height*4;
      if(!pixels||pixels.length!==length){pixels=new Uint8Array(length);flipped=new Uint8Array(length);}
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const stride=width*4;for(let y=0;y<height;y++)flipped.set(pixels.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
      return flipped;
    },
    dispose(){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(quad);gl.deleteBuffer(particleBuffer);gl.deleteProgram(background);gl.deleteProgram(particlesProgram);},
  };
}
