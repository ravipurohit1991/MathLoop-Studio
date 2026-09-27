import { mulberry32, filterLoop } from '../audio/dsp.js';
import { exhibitGains, focusGains } from '../audio/ambisonic.js';
import { natureWorld } from './worlds.js';
const TAU=Math.PI*2;
const rms=signal=>Math.sqrt(signal.reduce((sum,x)=>sum+x*x,0)/signal.length);

/** Original synthesized ambience. The photographic sources supply no recorded audio. */
export function renderNatureSound(worldId,{duration=20,sampleRate=48000,level=.65}={}){
  const world=natureWorld(worldId),n=Math.round(duration*sampleRate);
  if(!Number.isFinite(duration)||duration<=0||duration>120)throw new Error('Nature films run for 1–120 seconds.');
  const channels=Array.from({length:4},()=>new Float32Array(n));
  const stems=world.regions.map((region,index)=>{
    const rng=mulberry32(2941+index*714),mono=new Float32Array(n);let low=0,slow=0;
    for(let i=0;i<n;i++){
      const noise=rng()*2-1,t=i/sampleRate,p=i/n;
      low+=(noise-low)*.035;slow+=(noise-slow)*.002;
      if(index===0||index===3){
        if(worldId==='ocean')mono[i]=(low*.7+noise*.07)*(.3+.7*(.5+.5*Math.sin(p*TAU*4+index))**3);
        else if(index===0)mono[i]=(noise*.13+low*.4)*(.8+.2*Math.sin(p*TAU*2));
        else mono[i]=(noise-low)*.1*(.28+.72*(.5+.5*Math.sin(p*TAU*7))**2);
      }else if(index===2){
        mono[i]=(slow*4+low*.3)*(.4+.6*(.5+.5*Math.sin(p*TAU*3)));
        if(worldId==='jungle')mono[i]+=.03*Math.sin(TAU*3100*t)*(.5+.5*Math.sin(TAU*43*t))*(.4+.6*Math.sin(p*TAU*9)**2);
      }
    }
    if(index===1){
      // Small frequency-modulated calls, with a quiet insect bed in the woodland.
      const calls=Math.round(duration*1.7);
      for(let call=0;call<calls;call++){
        const start=Math.floor(rng()*n),length=Math.floor(sampleRate*(.1+rng()*.19));
        const base=worldId==='ocean'?620+rng()*450:1700+rng()*1800;
        let phase=0;
        for(let j=0;j<length;j++){
          const u=j/length;
          phase+=TAU*(base+(worldId==='ocean'?340:1100)*Math.sin(u*Math.PI))/sampleRate;
          mono[(start+j)%n]+=.25*Math.sin(phase)*Math.sin(Math.PI*u)**2;
        }
      }
    }
    const shaped=filterLoop(mono,{sampleRate,cutoff:index===2?1800:6500,q:.5});
    const gain=.06/Math.max(1e-9,rms(shaped));
    for(let i=0;i<n;i++)shaped[i]=Math.tanh(shaped[i]*gain*2)*.5*level;
    const gains=exhibitGains(region);
    for(let c=0;c<4;c++)for(let i=0;i<n;i++)channels[c][i]+=shaped[i]*gains[c];
    return {...region,elevation:0,voice:region.sound,focusAudio:shaped};
  });
  // A common scalar preserves the four-channel direction ratios.
  for(let i=0;i<n;i++){
    const peak=Math.max(...channels.map(c=>Math.abs(c[i]))),gain=peak>.8?.8/peak:1;
    for(const c of channels)c[i]*=gain;
  }
  return {channelData:channels,stems,sampleRate,length:n,numberOfChannels:4};
}

export function createNatureAuditioner(){
  let context,sources=[],gains=[],score,view={yaw:0,pitch:0},focused=true;
  function stop(){for(const source of sources)source.stop();for(const gain of gains)gain.disconnect();sources=[];gains=[];}
  function setView(next){view=next;const weights=focused?focusGains(score?.stems??[],view):score?.stems.map(()=>.5)??[];gains.forEach((gain,i)=>gain.gain.setTargetAtTime(weights[i],context.currentTime,.025));}
  return {stop,setView,setFocus(value){focused=value;setView(view);},
    async play(world,{duration=20,offset=0}={}){
      stop();context??=new AudioContext();await context.resume();score=renderNatureSound(world,{duration});
      for(const stem of score.stems){
        const source=context.createBufferSource(),gain=context.createGain(),buffer=context.createBuffer(1,score.length,score.sampleRate);
        buffer.copyToChannel(stem.focusAudio,0);source.buffer=buffer;source.loop=true;gain.gain.value=0;
        source.connect(gain);gain.connect(context.destination);source.start(0,offset%duration);sources.push(source);gains.push(gain);
      }setView(view);
    },dispose(){stop();context?.close();},
  };
}
