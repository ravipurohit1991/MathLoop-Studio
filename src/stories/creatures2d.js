import { createFourierStory, fourierChapters } from '../story/fourier.js';
import { createFourierContour } from '../math/contour.js';
import { bezierPath as curve, ellipsePath as ellipse } from '../math/geometry.js';
import { drawDraftingBackground, gradient, path, dot } from '../story/drawing.js';
const TAU=Math.PI*2;
const contour=(id,points)=>createFourierContour(points,{id,harmonics:48,samples:256,tracePoints:360});

function butterflyArtwork(){
  const upper=curve([12,-35],[[[80,-190],[270,-320],[315,-195]],[[353,-40],[120,35],[12,25]],[[5,5],[5,-15],[12,-35]]]);
  const lower=curve([14,18],[[[110,-5],[282,28],[208,170]],[[130,282],[38,182],[14,45]],[[8,34],[8,26],[14,18]]]);
  const contours={},parts=[];
  for(const side of [-1,1])for(const [name,points]of [['upper',upper],['lower',lower]]){
    const id=`${name}${side}`,base=points.map(([x,y])=>[x*side,y]);
    contours[id]=contour(id,base);parts.push({id,side,colour:'accent'});
    const inner=`inlay${id}`;contours[inner]=contour(inner,base.map(([x,y])=>[x*.77,y*.77]));parts.push({id:inner,side,colour:'guide'});
    const centre=name==='upper'?[side*211,-140]:[side*126,117];
    const eye=`spot${id}`;contours[eye]=contour(eye,ellipse(...centre,name==='upper'?29:24,name==='upper'?40:31));parts.push({id:eye,side,colour:'ink'});
  }
  contours.body=contour('body',ellipse(0,12,17,127));contours.head=contour('head',ellipse(0,-104,23,26));
  for(const side of [-1,1]){const id=`antenna${side}`,line=curve([side*9,-118],[[[side*27,-160],[side*59,-173],[side*65,-155]]]);contours[id]=contour(id,line.concat(line.slice(0,-1).reverse()));}
  return {name:'a butterfly',contours,studyId:'upper1',placement:{x:540,y:1030,scale:1.1},draw(ctx,state,paint){
    const motion=state.life??0,phase=state.frame.phase*TAU*5;
    ctx.save();ctx.translate(540+motion*16*Math.sin(phase*.4),1015+motion*22*Math.sin(phase));ctx.scale(1.13,1.13);ctx.rotate(motion*.06*Math.sin(phase*.6));
    for(const part of parts){ctx.save();ctx.scale(1-motion*(.14+.25*(1-Math.cos(phase))),1);paint(ctx,contours[part.id],part.id.startsWith('inlay')?'#795b77':state.theme[part.colour],state);ctx.restore();}
    // Delicate authored wing markings appear with the colour reveal.
    ctx.save();ctx.scale(1-motion*(.14+.25*(1-Math.cos(phase))),1);ctx.globalAlpha*=state.fill*.6;
    for(const side of [-1,1]){
      ctx.save();path(ctx,contours[`upper${side}`].points);ctx.clip();ctx.strokeStyle=state.theme.ink;ctx.lineWidth=1.2;
      for(const [x,y]of [[138,-187],[211,-223],[274,-210],[305,-157],[274,-71]]){ctx.beginPath();ctx.moveTo(side*20,-10);ctx.quadraticCurveTo(side*x*.55,y*.8,side*x,y);ctx.stroke();}
      for(let i=0;i<8;i++){const a=-1.6+i*.32;dot(ctx,side*(226+65*Math.cos(a)),-145+97*Math.sin(a),3.3,state.theme.ink);}ctx.restore();
      ctx.save();path(ctx,contours[`lower${side}`].points);ctx.clip();ctx.strokeStyle=state.theme.ink;ctx.lineWidth=1;
      for(const [x,y]of [[192,98],[159,171],[100,177]]){ctx.beginPath();ctx.moveTo(side*17,32);ctx.quadraticCurveTo(side*x*.6,y*.5,side*x,y);ctx.stroke();}ctx.restore();
    }ctx.restore();
    for(const id of ['antenna-1','antenna1','body','head'])paint(ctx,contours[id],id==='body'?gradient(ctx,'#f9eac4','#b58958',-120,150):state.theme.ink,state);
    ctx.restore();
  }};
}

function koiArtwork(){
  const contours={};
  const add=(id,p)=>contours[id]=contour(id,p);
  add('body',curve([0,-257],[[[110,-245],[101,-33],[58,83]],[[37,139],[5,190],[0,227]],[[-24,178],[-88,97],[-89,-54]],[[-89,-170],[-71,-252],[0,-257]]]));
  add('tail',curve([0,190],[[[51,237],[139,308],[141,368]],[[71,349],[21,309],[0,284]],[[-34,323],[-95,362],[-139,366]],[[-126,282],[-48,226],[0,190]]]));
  for(const side of [-1,1])add(`fin${side}`,curve([side*65,-105],[[[side*140,-97],[side*213,1],[side*186,62]],[[side*111,33],[side*83,-7],[side*65,-105]]]));
  add('patchA',curve([-41,-232],[[[23,-249],[78,-205],[70,-153]],[[20,-124],[-12,-146],[-37,-174]],[[-61,-183],[-61,-215],[-41,-232]]]));
  add('patchB',curve([-76,-92],[[[-35,-125],[45,-57],[71,-32]],[[69,35],[42,44],[-9,13]],[[-37,-1],[-79,-34],[-76,-92]]]));
  add('patchC',curve([38,64],[[[67,89],[27,156],[4,173]],[[-34,134],[-45,106],[-37,80]],[[-10,104],[17,92],[38,64]]]));
  for(const side of [-1,1]){add(`eye${side}`,ellipse(side*45,-202,8,11));const line=curve([side*26,-249],[[[side*52,-292],[side*92,-275],[side*83,-255]]]);add(`whisker${side}`,line.concat(line.slice(0,-1).reverse()));}
  return {name:'a koi',contours,studyId:'tail',placement:{x:540,y:985,scale:1.13},background(ctx,frame){
    drawDraftingBackground(ctx,frame.phase*45,{theme:frame.theme});
    ctx.save();ctx.strokeStyle=`${frame.theme.guide}20`;ctx.lineWidth=2;
    for(let i=0;i<4;i++){const r=270+i*48+15*Math.sin(frame.phase*TAU);ctx.beginPath();ctx.ellipse(540,1040,r,r*.8,-.3,0,TAU);ctx.stroke();}ctx.restore();
  },draw(ctx,state,paint){
    const life=state.life??0,phase=state.frame.phase*TAU*4;
    ctx.save();ctx.translate(540+life*22*Math.sin(phase*.5),965+life*15*Math.cos(phase));ctx.scale(1.1,1.1);ctx.rotate(-.26+life*.09*Math.sin(phase));
    for(const side of [-1,1]){ctx.save();ctx.translate(side*65,-105);ctx.rotate(side*life*.2*Math.sin(phase));ctx.translate(-side*65,105);paint(ctx,contours[`fin${side}`],state.theme.guide,state);
      ctx.save();path(ctx,contours[`fin${side}`].points);ctx.clip();ctx.globalAlpha*=state.fill*.45;ctx.strokeStyle=state.theme.ink;ctx.lineWidth=1.3;
      for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(side*70,-91);ctx.quadraticCurveTo(side*(103+10*i),-12,side*(105+21*i),60-8*i);ctx.stroke();}ctx.restore();ctx.restore();}
    ctx.save();ctx.translate(0,190);ctx.rotate(life*.25*Math.sin(phase-.6));ctx.translate(0,-190);paint(ctx,contours.tail,gradient(ctx,state.theme.accent,state.theme.ink,200,370),state);
    ctx.save();path(ctx,contours.tail.points);ctx.clip();ctx.globalAlpha*=state.fill*.45;ctx.strokeStyle=state.theme.ink;ctx.lineWidth=1.5;
    for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(0,210);ctx.quadraticCurveTo(i*10,282,i*27,375);ctx.stroke();}ctx.restore();ctx.restore();
    paint(ctx,contours.body,gradient(ctx,'#fff4dd','#c5dace',-250,200),state);
    for(const id of ['patchA','patchB','patchC'])paint(ctx,contours[id],state.theme.accent,state);
    ctx.save();path(ctx,contours.body.points);ctx.clip();ctx.globalAlpha*=state.fill*.2;ctx.strokeStyle='#527b72';ctx.lineWidth=1.3;
    for(let row=0;row<13;row++)for(let col=-3;col<=3;col++){ctx.beginPath();ctx.arc(col*25+(row%2)*12.5,-105+row*22,16,.12,Math.PI-.12);ctx.stroke();}ctx.restore();
    for(const side of [-1,1]){paint(ctx,contours[`eye${side}`],'#172e36',state);paint(ctx,contours[`whisker${side}`],state.theme.ink,state);}
    ctx.save();ctx.globalAlpha*=state.fill;for(const side of [-1,1])dot(ctx,side*45-2,-206,2.3,'#fff8e6');ctx.restore();
    ctx.restore();
  }};
}

export const fourierButterflyStory=createFourierStory({
  id:'fourier-butterfly',title:'The butterfly effect. In circles.',dimension:'2d',
  description:'Copper wings, cream eyespots, and a first flutter. A butterfly emerges from rotating circles.',
  artwork:butterflyArtwork(),theme:{background:'#211925',mid:'#342636',glow:'#57404b',accent:'#e6a36c',guide:'#b6a0c7',ink:'#ffebc4'},
  chapters:fourierChapters('a butterfly').map(c=>c.id==='perform'?{...c,title:['The butterfly', 'effect.'],caption:'A first flutter. Every outline began with circles.'}:c),
  audio:{bars:18,seed:281,transpose:5,score:'aurora-glass',transitions:['contour','draw','reveal','perform']},
});
export const fourierKoiStory=createFourierStory({
  id:'fourier-koi',title:'A koi. A little quiet magic.',dimension:'2d',
  description:'Vermilion and porcelain on a jade pond. Circles draw a koi, colour finds its scales, and the tail begins to sway.',
  artwork:koiArtwork(),theme:{background:'#101f23',mid:'#163434',glow:'#28534b',accent:'#e77e56',guide:'#91beb1',ink:'#fff0d7'},
  chapters:fourierChapters('a koi').map(c=>c.id==='perform'?{...c,title:['A little', 'quiet magic.'],caption:'A flick of the tail. A ripple in the mathematics.'}:c),
  audio:{bars:12,seed:192,transpose:-2,score:'still-water',tempoFeel:'drift',transitions:['draw','reveal','perform']},
});

function dragonflyArtwork(){
  const contours={},add=(id,p)=>contours[id]=contour(id,p);
  for(const side of [-1,1]){
    add(`fore${side}`,curve([side*26,-196],[
      [[side*150,-262],[side*300,-292],[side*376,-268]],
      [[side*396,-256],[side*330,-196],[side*196,-186]],
      [[side*120,-181],[side*54,-186],[side*26,-196]],
    ]));
    add(`hind${side}`,curve([side*24,-152],[
      [[side*140,-206],[side*292,-214],[side*344,-160]],
      [[side*366,-134],[side*292,-84],[side*172,-92]],
      [[side*104,-96],[side*44,-124],[side*24,-152]],
    ]));
    add(`eye${side}`,ellipse(side*31,-262,29,27));
  }
  add('abdomen',curve([0,-124],[
    [[38,-100],[44,60],[32,206]],
    [[27,278],[15,318],[0,334]],
    [[-15,318],[-27,278],[-32,206]],
    [[-44,60],[-38,-100],[0,-124]],
  ]));
  add('thorax',ellipse(0,-176,57,66));
  add('head',ellipse(0,-252,50,41));
  return {name:'a dragonfly',contours,studyId:'fore1',placement:{x:540,y:1010,scale:1.02},draw(ctx,state,paint){
    const life=state.life??0,turn=state.frame.phase*TAU,beat=turn*9;
    ctx.save();ctx.translate(540+life*13*Math.sin(turn*2),1010+life*24*Math.sin(turn*4));
    for(const side of [-1,1])for(const [name,pivot,lag] of [['hind',-152,.7],['fore',-196,0]]){
      ctx.save();
      ctx.translate(side*25,pivot);ctx.rotate(side*life*.31*Math.sin(beat+lag));ctx.scale(1,1-life*.1*(1-Math.cos(beat+lag)));ctx.translate(-side*25,-pivot);
      // Gauzy wings: colour makes them more transparent, not less.
      ctx.globalAlpha*=1-state.fill*.42;
      paint(ctx,contours[`${name}${side}`],state.theme.guide,state);
      ctx.save();path(ctx,contours[`${name}${side}`].points);ctx.clip();
      ctx.globalAlpha*=state.fill*.5;ctx.strokeStyle=state.theme.ink;ctx.lineWidth=1;
      for(let i=1;i<9;i++){const t=i/9;ctx.beginPath();ctx.moveTo(side*30,pivot+4);ctx.quadraticCurveTo(side*(150+180*t),pivot-56+96*t,side*(392*(.4+.6*t)),pivot-58+118*t);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(side*32,pivot-2);ctx.quadraticCurveTo(side*220,pivot-34,side*372,pivot-44);ctx.lineWidth=1.6;ctx.stroke();
      ctx.restore();ctx.restore();
    }
    ctx.save();ctx.rotate(life*.05*Math.sin(turn*4-.8));
    paint(ctx,contours.abdomen,gradient(ctx,'#8fe9cd','#2f6f6a',-120,340),state);
    ctx.save();path(ctx,contours.abdomen.points);ctx.clip();ctx.globalAlpha*=state.fill*.35;ctx.strokeStyle='#0d2b2c';ctx.lineWidth=3;
    for(let i=0;i<10;i++){const y=-70+i*42;ctx.beginPath();ctx.moveTo(-44,y);ctx.lineTo(44,y+4);ctx.stroke();}
    ctx.restore();ctx.restore();
    paint(ctx,contours.thorax,gradient(ctx,'#a5f0d3','#3d8579',-240,-110),state);
    paint(ctx,contours.head,state.theme.accent,state);
    for(const side of [-1,1])paint(ctx,contours[`eye${side}`],'#17403c',state);
    ctx.save();ctx.globalAlpha*=state.fill;for(const side of [-1,1])dot(ctx,side*31-6,-270,4,'#d8fff0');ctx.restore();
    ctx.restore();
  }};
}

function seahorseArtwork(){
  const spine=curve([-286,-176],[
    [[-256,-190],[-224,-208],[-196,-222]],
    [[-158,-244],[-100,-268],[-44,-250]],
    [[6,-233],[44,-188],[54,-120]],
    [[64,-44],[56,54],[32,126]],
    [[12,184],[-28,226],[-74,214]],
    [[-118,202],[-124,146],[-78,126]],
    [[-40,110],[-6,136],[-6,170]],
  ],34);
  const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
  // A thin snout, a deep chest, then a long taper into the curl of the tail.
  const width=t=>9+smooth(.13,.24,t)*39*(1-t)**1.2+9*Math.exp(-(((t-.38)/.16)**2));
  const rib=t=>{
    const i=Math.max(1,Math.min(spine.length-2,Math.round(t*(spine.length-1))));
    const [ax,ay]=spine[i-1],[bx,by]=spine[i+1],length=Math.hypot(bx-ax,by-ay)||1;
    return{p:spine[i],n:[-(by-ay)/length,(bx-ax)/length],w:width(i/(spine.length-1))};
  };
  // One spine, offset both ways: the silhouette can never pinch or self-cross.
  const flank=()=>{
    const left=[],right=[];
    for(let i=0;i<spine.length;i++){
      const {p,n,w}=rib(i/(spine.length-1));
      left.push([p[0]+n[0]*w,p[1]+n[1]*w]);right.push([p[0]-n[0]*w,p[1]-n[1]*w]);
    }
    return left.concat(right.reverse());
  };
  const contours={},add=(id,p)=>contours[id]=contour(id,p);
  add('body',flank());
  const head=rib(.22);
  add('head',ellipse(head.p[0]-head.n[0]*5,head.p[1]-head.n[1]*5,47,43));
  const back=rib(.42),fin=[];
  for(let i=0;i<=24;i++){
    const t=i/24,f=rib(.31+t*.22);
    const reach=f.w+6+25*Math.sin(Math.PI*t)*(1+.3*Math.sin(t*18));
    fin.push([f.p[0]-f.n[0]*reach,f.p[1]-f.n[1]*reach]);
  }
  for(let i=24;i>=0;i--){const f=rib(.31+i/24*.22);fin.push([f.p[0]-f.n[0]*(f.w-2),f.p[1]-f.n[1]*(f.w-2)]);}
  add('fin',fin);
  add('eye',ellipse(head.p[0]-8,head.p[1]-7,15,15));
  for(let i=0;i<5;i++){
    const f=rib(.16+i*.028),reach=f.w+2;
    const base=[f.p[0]-f.n[0]*reach,f.p[1]-f.n[1]*reach],tip=[base[0]-f.n[0]*27,base[1]-f.n[1]*27];
    add(`crown${i}`,curve(base,[[[base[0]-f.n[0]*13-6,base[1]-f.n[1]*13],[tip[0]-5,tip[1]-3],tip],[[tip[0]+4,tip[1]+3],[base[0]-f.n[0]*13+7,base[1]-f.n[1]*13],base]]));
  }
  return {name:'a seahorse',contours,studyId:'body',placement:{x:565,y:1035,scale:1.1},back,background(ctx,frame){
    drawDraftingBackground(ctx,frame.phase*38,{theme:frame.theme});
    ctx.save();ctx.strokeStyle=`${frame.theme.guide}1c`;ctx.lineWidth=2.4;
    // Slow columns of water, so the stillness of the animal reads as a choice.
    for(let i=0;i<7;i++){
      const x=150+i*130,drift=Math.sin(frame.phase*TAU+i)*22;
      ctx.beginPath();ctx.moveTo(x+drift,430);
      for(let y=430;y<1700;y+=40)ctx.lineTo(x+drift+18*Math.sin(y/120+i+frame.phase*TAU),y);
      ctx.stroke();
    }
    ctx.restore();
  },draw(ctx,state,paint){
    const life=state.life??0,sway=state.frame.phase*TAU*2;
    ctx.save();ctx.translate(565+life*9*Math.sin(sway),1035+life*17*Math.sin(sway*.5));ctx.scale(1.1,1.1);ctx.rotate(life*.05*Math.sin(sway-.5));
    ctx.save();ctx.translate(...back.p);ctx.rotate(life*.2*Math.sin(sway*3));ctx.translate(-back.p[0],-back.p[1]);
    paint(ctx,contours.fin,state.theme.guide,state);ctx.restore();
    paint(ctx,contours.body,gradient(ctx,'#ffd9a8','#b8492f',-280,220),state);
    ctx.save();path(ctx,contours.body.points);ctx.clip();ctx.globalAlpha*=state.fill*.45;ctx.strokeStyle='#77291f';ctx.lineWidth=2.4;
    // The bony rings that give a seahorse its armour, set square to the spine.
    for(let i=0;i<19;i++){
      const f=rib(.26+i*.039),reach=f.w+3;
      ctx.beginPath();ctx.moveTo(f.p[0]+f.n[0]*reach,f.p[1]+f.n[1]*reach);
      ctx.quadraticCurveTo(f.p[0],f.p[1],f.p[0]-f.n[0]*reach,f.p[1]-f.n[1]*reach);ctx.stroke();
    }
    ctx.restore();
    paint(ctx,contours.head,gradient(ctx,'#ffe6bd','#d4795a',-300,-190),state);
    for(let i=0;i<5;i++)paint(ctx,contours[`crown${i}`],state.theme.accent,state);
    paint(ctx,contours.eye,'#2a1a1c',state);
    ctx.save();ctx.globalAlpha*=state.fill;dot(ctx,head.p[0]-19,head.p[1]-14,4.4,'#fff2dc');ctx.restore();
    ctx.restore();
  }};
}

export const fourierDragonflyStory=createFourierStory({
  id:'fourier-dragonfly',title:'Four wings. One equation.',dimension:'2d',
  description:'Glass wings over a jade body. Circles draw a dragonfly, the veins fill in, and all four wings begin to beat.',
  artwork:dragonflyArtwork(),theme:{background:'#101d1b',mid:'#182c27',glow:'#2c5148',accent:'#7fd9c0',guide:'#d7e6b0',ink:'#f2ffe8'},
  chapters:fourierChapters('a dragonfly').map(c=>c.id==='perform'?{...c,title:['Four wings.','One equation.'],caption:'Each wing beats on its own phase. Nothing is keyframed.'}:c),
  audio:{bars:16,seed:349,transpose:4,score:'little-clockwork',level:.55,transitions:['contour','draw','reveal','perform']},
});
export const fourierSeahorseStory=createFourierStory({
  id:'fourier-seahorse',title:'A curl of the sea.',dimension:'2d',
  description:'Amber armour and a curled tail. One offset spine becomes a seahorse, ring by bony ring.',
  artwork:seahorseArtwork(),theme:{background:'#0e1f24',mid:'#153035',glow:'#2b544f',accent:'#f0b073',guide:'#8fc4bb',ink:'#fff1dc'},
  chapters:fourierChapters('a seahorse').map(c=>c.id==='perform'?{...c,title:['A curl','of the sea.'],caption:'It barely moves. The mathematics does all the swimming.'}:c),
  audio:{bars:11,seed:726,transpose:-4,score:'still-water',tempoFeel:'drift',level:.5,transitions:['draw','reveal','perform']},
});
