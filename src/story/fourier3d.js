import { defineStory } from './definition.js';
import { chapterAt } from './fourier.js';
import { drawStoryTypography, text, dot } from './drawing.js';
import { pointOnCurve3D, auditCurves3D, sub3, dot3, cross3, unit3 } from '../math/fourier3d.js';
import { createCamera3D, stroke3D, drawMesh3D, drawEpicycles3D, loftCurves3D } from './spatial.js';
import { clamp01, ease, interpolate } from './timeline.js';
const TAU=Math.PI*2;
const key=(chapter,progress,value,ease='smooth')=>({at:chapterAt(chapter,progress),value,ease});

export function spatialChapters(name) {
  return [
    {id:'seed',duration:3,title:['A circle.', 'A new dimension.'],caption:'What if the drawing could leave the page?'},
    {id:'combine',duration:5,title:['Turn circles', 'through space.'],caption:'Each rotating tip carries the next circle.'},
    {id:'draw',duration:10,title:['Curve by curve,', name+'.'],caption:'One ring becomes many. Each new curve brings the shape to life.'},
    {id:'reveal',duration:4,title:['Give the', 'curves a skin.'],caption:'Join neighbouring contours. Let the light find them.'},
    {id:'perform',duration:8,title:['Made of maths.', 'Full of life.'],caption:'The curves are Fourier. The movement is authored.'},
    {id:'outro',duration:4,title:['A circle.', 'A new dimension.'],caption:'What if the drawing could leave the page?'},
  ];
}
export function spatialTracks(harmonics=40){return{
  terms:[key('seed',0,1),key('combine',0,1),key('combine',1,harmonics),key('outro',0,harmonics),key('outro',1,1)],
  study:[key('seed',0,1),key('reveal',0,1),key('reveal',1,0),key('outro',0,0),key('outro',.65,1)],
  construction:[key('draw',0,0),key('draw',1,1,'linear'),key('outro',0,1),key('outro',.7,0)],
  skin:[key('reveal',0,0),key('reveal',1,1),key('outro',0,1),key('outro',.45,0)],
  life:[key('reveal',0,0),key('reveal',1,1),key('outro',0,1),key('outro',.5,0)],
  orbit:[key('seed',0,0),key('combine',1,.15),key('draw',1,.55),key('perform',1,1),key('outro',1,0)],
};}

function background(ctx,frame){
  const {theme,phase}=frame;
  const gradient=ctx.createRadialGradient(530,970,0,530,970,950);
  gradient.addColorStop(0,theme.glow??'#19394d');gradient.addColorStop(.65,theme.mid??'#0d2030');gradient.addColorStop(1,theme.background);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1920);
  for(let i=0;i<62;i++){
    const a=i*2.39996+phase*TAU,r=210+i*5.1;
    dot(ctx,540+Math.cos(a)*r,1020+Math.sin(a)*r*.92,i%9===0?2:1,`${theme.guide}40`);
  }
  ctx.save();ctx.strokeStyle=`${theme.guide}16`;ctx.lineWidth=1;
  for(const r of [240,355,470]){ctx.beginPath();ctx.ellipse(540,1350,r,r*.22,0,0,TAU);ctx.stroke();}ctx.restore();
}

/** 3D authored films implement the same pure-time Canvas contract as 2D films. */
export function createFourier3DStory({ artwork, chapters, tracks, ...definition }) {
  if(!artwork?.study?.terms || !artwork.parts?.length)throw new Error('3D artwork needs a Fourier study and lofted parts.');
  const ids=new Set();
  for(const part of artwork.parts){
    if(!part.id || !Array.isArray(part.curves) || part.curves.length<2)throw new Error('A 3D part needs an ID and at least two Fourier rings.');
    const count=part.curves[0]?.points?.length;
    for(const curve of part.curves){
      if(!curve.id || ids.has(curve.id) || !curve.terms || !count || curve.points?.length!==count)throw new Error('3D rings need unique IDs and matching trace point counts within a loft.');
      ids.add(curve.id);
    }
  }
  // Study one real cross-section, then grow neighbouring rings out from it.
  // The same curve survives the handoff and becomes part of the final surface.
  const firstPart=artwork.parts[0],studyIndex=Math.floor(firstPart.curves.length/2);
  const study=firstPart.curves[studyIndex];
  artwork={...artwork,study,studyId:study.id};
  const assembly=artwork.parts.flatMap((part,partIndex)=>{
    const rings=part.curves.map((curve,index)=>({curve,part,index}));
    if(partIndex===0)rings.sort((a,b)=>Math.abs(a.index-studyIndex)-Math.abs(b.index-studyIndex));
    return rings;
  });
  const assemblyIndex=new Map(assembly.map(({curve},index)=>[curve.id,index]));
  const ringProgress=(curve,construction)=>{
    if(construction>=1-1e-9)return 1;
    const index=assemblyIndex.get(curve.id);
    if(index===0)return 1;
    const start=.08+.78*(index-1)/Math.max(1,assembly.length-2);
    return clamp01((construction-start)/.14);
  };
  const radius=Math.max(...study.points.map(p=>Math.hypot(...sub3(p,study.centre))));
  const u=unit3(study.terms[0].a),normal=unit3(cross3(u,study.terms[0].b)),w=cross3(normal,u);
  const present=p=>{
    const q=sub3(p,study.centre),x=dot3(q,u)*180/radius,y=dot3(q,w)*180/radius,z=dot3(q,normal)*180/radius;
    return [.94*x+.34*z,.12*x+.94*y-.32*z,-.32*x+.34*y+.88*z];
  };
  const curves=Object.fromEntries(artwork.parts.flatMap(p=>p.curves.map(c=>[c.id,c])));
  const animation={...spatialTracks(artwork.study.terms.length),...tracks};
  const controls={cameraYaw:{label:'Camera orbit (degrees)',min:-180,max:180,step:1},cameraPitch:{label:'Camera tilt (degrees)',min:-75,max:75,step:1},orbitAmount:{label:'Animated orbit (degrees)',min:0,max:180,step:1},zoom:{label:'Camera zoom',min:.4,max:1.7,step:.05}};
  return defineStory({
    ...definition,dimension:'3d',kind:'fourier-3d',artwork,chapters:chapters??spatialChapters(artwork.name),tracks:animation,
    params:{cameraYaw:-24,cameraPitch:-17,orbitAmount:38,zoom:1,guideMode:'circles',wireframe:false,...definition.params},
    parameterControls:controls,
    validateParams(params){
      for(const [key,control]of Object.entries(controls))if(!Number.isFinite(params[key]) || params[key]<control.min || params[key]>control.max)throw new Error(`${control.label} must be between ${control.min} and ${control.max}.`);
      if(!['circles','spheres','none'].includes(params.guideMode))throw new Error('Construction guides must be circles, spheres or none.');
      if(typeof params.wireframe!=='boolean')throw new Error('Surface mesh visibility must be true or false.');
      definition.validateParams?.(params);
    },
    requiredTracks:Object.keys(animation),equations:['r(t) = c + Σ [aₖ cos(2πkt) + bₖ sin(2πkt)]'],
    audit:()=>auditCurves3D({study:artwork.study,...curves}),
    createRenderer(context){
      const overlay=definition.createOverlay?.(context);
      return {draw(ctx,frame){
        background(ctx,frame);
        const v=frame.values,params=frame.params;
        const bounded=(value,lo,hi,fallback)=>Number.isFinite(value)?Math.max(lo,Math.min(hi,value)):fallback;
        const camera=createCamera3D({yaw:(bounded(params.cameraYaw,-180,180,-24)+bounded(params.orbitAmount,0,180,38)*Math.sin(v.orbit*TAU))*Math.PI/180,pitch:bounded(params.cameraPitch,-75,75,-17)*Math.PI/180,zoom:bounded(params.zoom,.4,1.7,1)});
        const pose=(p,id)=>artwork.pose?.(p,id,frame.phase,v.life)??p;
        const building=frame.chapter.id==='draw';
        const settle=building?ease('smooth',frame.chapterProgress/.14):['seed','combine'].includes(frame.chapter.id)?0:frame.chapter.id==='outro'&&!v.showcase?clamp01(v.construction):1;
        const placeStudy=p=>{
          const shown=present(p);
          return pose(shown.map((value,i)=>value+(p[i]-value)*settle),firstPart.id);
        };
        if(v.construction>.001){
          // Even the optional mesh overlay waits for the contours to finish.
          if(!building){
            const meshes=artwork.parts.map(p=>loftCurves3D(p.curves,{colour:p.colour==='eye'?'#101d2c':frame.theme[p.colour]??frame.theme.accent,closed:p.closed,transform:q=>pose(q,p.id)}));
            drawMesh3D(ctx,meshes,camera,{opacity:v.skin,wire:Math.max(params.wireframe?1:0,v.wire??0)});
          }
          for(const [index,{curve:c,part}]of assembly.entries()){
            if(building&&c.id===study.id)continue;
            // Overlapping, slow traces make every ring visibly draw itself,
            // including films with hundreds of rings. Leave room for the handoff.
            const progress=ringProgress(c,v.construction);
            if(progress<=0)continue;
            const points=progress===1?c.points:c.points.slice(0,Math.floor(progress*c.points.length)+1);
            const route=points.map(p=>pose(p,part.id));
            if(progress<1)route.push(pose(pointOnCurve3D(c,progress),part.id));
            stroke3D(ctx,route,camera,{colour:frame.theme.guide,alpha:(1-v.skin*.91)*(.38+.62*progress),width:1.4,close:progress===1});
            if(progress<1)drawEpicycles3D(ctx,c,progress,camera,{mode:params.guideMode,opacity:1-v.skin,colour:frame.theme.guide,transform:p=>pose(p,part.id)});
            else if(v.showcase&&v.guideOpacity>0)drawEpicycles3D(ctx,c,(frame.phase*9+index*.037)%1,camera,{mode:params.guideMode,opacity:v.guideOpacity,colour:frame.theme.guide,transform:p=>pose(p,part.id)});
          }
          // Join only rings that have formed. These quiet longitudinal strokes
          // let thin tubes read as contours without revealing unbuilt anatomy.
          if(building||frame.chapter.id==='reveal')for(const part of artwork.parts){
            const count=part.curves.length,n=part.curves[0].points.length;
            for(let row=0;row<(part.closed?count:count-1);row++){
              const a=part.curves[row],b=part.curves[(row+1)%count];
              const ready=ease('smooth',(Math.min(ringProgress(a,v.construction),ringProgress(b,v.construction))-.8)/.2);
              if(ready<=.001)continue;
              for(const i of [0,Math.floor(n/4),Math.floor(n/2),Math.floor(3*n/4)]){
                stroke3D(ctx,[pose(a.points[i],part.id),pose(b.points[i],part.id)],camera,{colour:frame.theme.guide,alpha:ready*(1-v.skin)*.32,width:1});
              }
            }
          }
          if(!building)for(const detail of artwork.details??[])stroke3D(ctx,detail.points.map(p=>pose(p,'body')),camera,{colour:frame.theme[detail.colour],alpha:v.skin*.6,width:2});
        }
        // Chapter-based visibility also keeps the seed intact in older saved
        // edits whose study track faded at the start of construction.
        const studyOpacity=building||frame.chapter.id==='combine'?1:['reveal','perform'].includes(frame.chapter.id)?0:v.study;
        if(studyOpacity>.001){
          const t=(frame.phase*9+.12)%1;
          const points=Array.from({length:study.points.length},(_,i)=>pointOnCurve3D(study,i/study.points.length,v.terms));
          const colour=interpolate(frame.theme.accent,frame.theme.guide,settle);
          stroke3D(ctx,points.map(placeStudy),camera,{colour,alpha:studyOpacity,width:2.5-1.1*settle,close:true});
          drawEpicycles3D(ctx,study,t,camera,{terms:v.terms,mode:params.guideMode,opacity:studyOpacity*(1-settle),colour:frame.theme.guide,transform:placeStudy});
        }
        const label=building?'ONE RING BECOMES MANY  /  XYZ':studyOpacity>.5?`${Math.ceil(Math.min(v.terms,study.terms.length))} HARMONIC${Math.ceil(v.terms)===1?'':'S'}  /  THREE AXES`:v.skin<.95?'FOURIER CONTOURS  /  XYZ':'FOURIER SCULPTURE  /  IN MOTION';
        overlay?.(ctx,frame,{camera,pose});
        text(ctx,label,540,1480,19,frame.theme.guide,500,'center');
        drawStoryTypography(ctx,frame,{brand:'CIRCLES INTO SPACE',footer:'FOURIER SCULPTURES / 3D',equation:'r(t) = c + Σ [a cos(2πkt) + b sin(2πkt)]'});
      }};
    },
  });
}
