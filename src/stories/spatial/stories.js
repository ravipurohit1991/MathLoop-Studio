import { createFourier3DStory, spatialChapters } from '../../story/fourier3d.js';
import { createWhaleArtwork, createMantaArtwork, createKnotArtwork, createJellyfishArtwork, createNautilusArtwork } from './art.js';
import { whaleCalls, whaleCallState } from '../../story/scores/whaleSong.js';
import { text } from '../../story/drawing.js';

export const fourierWhaleStory=createFourier3DStory({
  id:'fourier-whale-3d',title:'A whale, drawn through space.',
  description:'Tilt the circles into the ocean. A blue whale grows contour by contour, catches the light, and swims.',
  artwork:createWhaleArtwork(),params:{cameraYaw:10,cameraPitch:-15,orbitAmount:23,zoom:1.3},theme:{background:'#071521',mid:'#0b2537',glow:'#204658',accent:'#79bbd5',guide:'#90e2d2',ink:'#edf5ed'},
  audio:{bars:16,seed:831,transpose:-5,score:'whale-song',tempoFeel:'drift',transitions:['combine','draw','reveal','perform']},
  createOverlay({timeline,project}) {
    const calls=whaleCalls(timeline.chapters);
    return (ctx,frame,{camera,pose})=>{
      if(!project.audio.enabled||project.audio.score!=='whale-song'||project.audio.level===0)return;
      const {amplitude,progress}=whaleCallState(calls,frame.time);
      const head=camera.project(pose([-245,-10,0],'body'));
      if(!head||amplitude<.005)return;
      ctx.save();ctx.strokeStyle=frame.theme.guide;ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        const radius=42+i*30+progress*65;
        ctx.globalAlpha=amplitude*(.28-i*.06);
        ctx.beginPath();ctx.ellipse(head[0],head[1],radius,radius*.72,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=amplitude*.8;
      text(ctx,'WHALE SONG',540,1416,18,frame.theme.guide,500,'center');
      ctx.restore();
    };
  },
});
export const fourierMantaStory=createFourier3DStory({
  id:'fourier-manta-3d',title:'Manta Ray: Fourier in 3D',
  description:'A luminous manta unfolds its wings in three dimensions, then glides through a violet ocean.',
  artwork:createMantaArtwork(),params:{cameraYaw:-34,cameraPitch:-38,orbitAmount:30,zoom:1.1},
  theme:{background:'#141126',mid:'#24213c',glow:'#41405e',accent:'#b4a3e9',guide:'#e3bcdb',ink:'#fff0e7'},
  chapters:spatialChapters('a manta ray').map(c=>c.id==='perform'?{...c,title:['Manta Ray.', 'Fourier in 3D.'],caption:'A wave travels outward. The wings follow.'}:c),
  audio:{bars:12,seed:417,transpose:2,score:'aurora-glass',tempoFeel:'drift',transitions:['draw','reveal','perform']},
});
export const fourierTrefoilStory=createFourier3DStory({
  id:'fourier-trefoil-3d',title:'An impossible-looking loop.',
  description:'Three axes, a handful of frequencies, and a continuous golden knot. Watch the camera reveal the crossings.',
  artwork:createKnotArtwork(),params:{cameraYaw:0,cameraPitch:-20,orbitAmount:65,zoom:1.05},
  theme:{background:'#21141a',mid:'#34222a',glow:'#573c36',accent:'#eeba77',guide:'#ddb9a3',ink:'#fff2d8'},
  chapters:spatialChapters('a trefoil').map(c=>c.id==='perform'?{...c,title:['One path.', 'Three crossings.'],caption:'A trefoil in space. The curve never intersects itself.'}:c.id==='reveal'?{...c,title:['Follow the', 'golden thread.'],caption:'A tube follows the reconstructed spatial curve.'}:c),
  audio:{bars:18,seed:905,transpose:7,score:'little-clockwork',transitions:['draw','reveal','perform']},
});
export const fourierJellyfishStory=createFourier3DStory({
  id:'fourier-jellyfish-3d',title:'A bell that breathes.',
  description:'A moon jellyfish pulses through violet water. The bell, the arms and eight trailing tentacles are all reconstructed contours.',
  artwork:createJellyfishArtwork(),params:{cameraYaw:14,cameraPitch:-24,orbitAmount:26,zoom:1.15},
  theme:{background:'#12102a',mid:'#1e1b3e',glow:'#3d3364',accent:'#c9a8e8',guide:'#8fd8d0',ink:'#fdf1ff'},
  chapters:spatialChapters('a jellyfish').map(c=>c.id==='perform'?{...c,title:['A bell','that breathes.'],caption:'The bell leads. The tentacles always arrive late.'}:c),
  audio:{bars:14,seed:553,transpose:3,score:'paper-lanterns',tempoFeel:'drift',level:.55,transitions:['draw','reveal','perform']},
});
export const fourierNautilusStory=createFourier3DStory({
  id:'fourier-nautilus-3d',title:'A shell that keeps its ratio.',
  description:'A nautilus grown along a logarithmic spiral. Nine chamber walls mark the constant ratio the shell never breaks.',
  artwork:createNautilusArtwork(),params:{cameraYaw:-20,cameraPitch:-12,orbitAmount:44,zoom:1},
  theme:{background:'#0d1c1e',mid:'#153033',glow:'#2f5850',accent:'#f0cf9a',guide:'#9ed3c4',ink:'#fff6e4'},
  chapters:spatialChapters('a nautilus').map(c=>c.id==='perform'?{...c,title:['It grows.','It never changes shape.'],caption:'Every chamber is the last one, multiplied.'}:c.id==='reveal'?{...c,title:['Nine walls.','One ratio.'],caption:'The septa divide a spiral that repeats itself forever.'}:c),
  audio:{bars:15,seed:674,transpose:-3,score:'driftwood',level:.55,transitions:['combine','draw','reveal','perform']},
});
