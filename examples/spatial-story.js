// npm run story:preview -- --module ./examples/spatial-story.js --width 540
import { createFourier3DStory, createFourierCurve3D } from '../src/index.js';
const TAU=Math.PI*2;
const sample=(fn,n=128)=>Array.from({length:n},(_,i)=>fn(i/n*TAU));

// A wavy column. Every cross-section is a reconstructed closed XYZ curve.
const curves=Array.from({length:28},(_,i)=>{
  const height=i/27,radius=80+80*Math.sin(Math.PI*height);
  return createFourierCurve3D(sample(t=>[
    radius*Math.cos(t)+65*Math.sin(height*TAU),
    -285+570*height,
    radius*Math.sin(t),
  ]),{id:`section-${i}`,samples:64,harmonics:12,tracePoints:32});
});
const study=createFourierCurve3D(sample(t=>[230*Math.cos(t),180*Math.sin(t),70*Math.sin(3*t)]));

export default createFourier3DStory({
  id:'spatial-lantern',title:'A lantern made of circles.',
  description:'Fourier contours become a twisting lantern in three dimensions.',
  theme:{background:'#171a28',glow:'#413755',accent:'#e0ac86',guide:'#a5c7d4'},
  params:{cameraYaw:-28,cameraPitch:-12,zoom:1.1},
  audio:{bars:16,seed:512,transpose:3},
  artwork:{
    name:'a lantern',study,parts:[{id:'shell',curves,colour:'accent'}],
    // The pose is evaluated from time, including when seeking backwards.
    pose([x,y,z],part,phase,life){
      const twist=life*.3*Math.sin(phase*TAU*2+y/220);
      return[x*Math.cos(twist)-z*Math.sin(twist),y,x*Math.sin(twist)+z*Math.cos(twist)];
    },
  },
});
