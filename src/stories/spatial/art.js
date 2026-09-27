import { createFourierCurve3D, add3, scale3, sub3, cross3, unit3 } from '../../math/fourier3d.js';
const TAU=Math.PI*2;
const sample=(fn,n=96)=>Array.from({length:n},(_,i)=>fn(i/n*TAU));
const ring=(fn,id)=>createFourierCurve3D(sample(fn),{id,samples:64,harmonics:12,tracePoints:24});
const curve=(fn)=>createFourierCurve3D(sample(fn,256),{samples:256,harmonics:40,tracePoints:240});

function loft(id,sections,point,colour='accent') {
  return {id,colour,curves:Array.from({length:sections},(_,i)=>ring(a=>point(.002+.996*i/(sections-1),a),`${id}-${i}`))};
}
function eye(x,y,z,id){
  return loft(id,6,(u,a)=>{const t=Math.PI*(.015+.97*u);return[x+9*Math.cos(t),y+10*Math.sin(t)*Math.cos(a),z+10*Math.sin(t)*Math.sin(a)];},'eye');
}

export function createWhaleArtwork() {
  const body=loft('body',25,(u,a)=>{
    const x=-305+620*u,profile=Math.sin(Math.PI*(.018+.966*u))**.58*(1-.72*u);
    return[x,-8+28*u+118*profile*Math.cos(a),145*profile*Math.sin(a)];
  });
  const parts=[body];
  for(const side of [-1,1]){
    parts.push(loft(`flipper${side}`,10,(u,a)=>[-100+142*u+38*Math.sin(Math.PI*u)*Math.cos(a),44+86*u+9*Math.sin(Math.PI*u)*Math.sin(a),side*(65+145*u)],'guide'));
    parts.push(loft(`fluke${side}`,12,(u,a)=>[287+54*u+58*Math.sin(Math.PI*u)*Math.cos(a),19+10*Math.sin(Math.PI*u)*Math.sin(a),side*(8+185*u)],'accent'));
    parts.push(eye(-239,-20,side*85,`eye${side}`));
  }
  parts.push(loft('dorsal',8,(u,a)=>[110+47*u+35*(1-u)*Math.cos(a),-57-84*u,12*(1-u)*Math.sin(a)],'guide'));
  const study=curve(t=>[-295*Math.cos(t),95*Math.sin(t)*(1+.22*Math.cos(t)),55*Math.sin(2*t)]);
  return {name:'a whale',parts,study,pose(p,part,phase,life){
    const [x,y,z]=p,wave=phase*TAU*3;
    const tail=Math.max(0,(x-20)/320);
    return [x,y+life*(11*Math.sin(wave)+tail*tail*45*Math.sin(wave-.9)+(/flipper/.test(part)?Math.abs(z)*.16*Math.sin(wave+.7):0)),z];
  },details:[]};
}

export function createMantaArtwork() {
  const parts=[loft('body',18,(u,a)=>[-190+380*u,44*Math.sin(Math.PI*u)**.6*Math.cos(a),85*Math.sin(Math.PI*u)**.65*Math.sin(a)])];
  for(const side of [-1,1]){
    parts.push(loft(`wing${side}`,21,(u,a)=>[-20+135*u+165*(1-u)**.7*Math.cos(a),16+26*u+15*(1-u)*Math.sin(a),side*(28+365*u)],'accent'));
    parts.push(loft(`horn${side}`,9,(u,a)=>[-160-83*u,8+35*u*u+12*(1-u)*Math.cos(a),side*(52+10*Math.sin(Math.PI*u))+16*(1-u)*Math.sin(a)],'guide'));
    parts.push(eye(-126,-30,side*50,`eye${side}`));
  }
  parts.push(loft('tail',20,(u,a)=>[150+280*u,15+18*Math.sin(u*Math.PI)+5*(1-u)*Math.cos(a),12*(1-u)*Math.sin(a)],'guide'));
  const study=curve(t=>[205*Math.cos(t)+48*Math.cos(3*t),44*Math.sin(2*t),295*Math.sin(t)**3]);
  return {name:'a manta ray',parts,study,pose(p,part,phase,life){const[x,y,z]=p;return[x,y+life*(8*Math.sin(phase*TAU*3)+Math.abs(z)**1.4*.022*Math.sin(phase*TAU*3-Math.abs(z)/180)),z];}};
}

export function createKnotArtwork() {
  const position=t=>[108*(2+Math.cos(3*t))*Math.cos(2*t),108*(2+Math.cos(3*t))*Math.sin(2*t),108*Math.sin(3*t)];
  const study=curve(position),curves=[];
  for(let i=0;i<72;i++){
    const t=i/72*TAU,c=position(t),tangent=unit3(sub3(position(t+.001),position(t-.001))),u=unit3(cross3(tangent,[0,0,1])),v=cross3(tangent,u);
    curves.push(ring(a=>add3(c,add3(scale3(u,18*Math.cos(a)),scale3(v,18*Math.sin(a)))),`ribbon-${i}`));
  }
  return {name:'a trefoil',parts:[{id:'ribbon',curves,closed:true,colour:'accent'}],study,pose:p=>p};
}

export function createJellyfishArtwork() {
  const bell=loft('bell',18,(u,a)=>{
    const r=166*Math.sin(Math.PI/2*u)**.95*(1+.06*Math.cos(6*a));
    return[r*Math.cos(a),-172*Math.cos(Math.PI/2*u)**1.4+46*u**3,r*Math.sin(a)];
  });
  const parts=[bell];
  for(let k=0;k<4;k++){
    const th=k/4*TAU+.39;
    parts.push(loft(`arm${k}`,10,(u,a)=>{
      const reach=24+56*u+26*Math.sin(u*4.6+k),rc=25*(1-u)**.8+2.4;
      return[Math.cos(th)*reach+rc*Math.cos(a),16+312*u,Math.sin(th)*reach+rc*Math.sin(a)*.42];
    },'guide'));
  }
  for(let k=0;k<10;k++){
    const th=k/10*TAU;
    parts.push(loft(`tent${k}`,9,(u,a)=>{
      const reach=150+34*u*u*Math.cos(k*1.7)+20*Math.sin(u*5.2+k),rc=5.2*(1-u)**.8+1;
      return[Math.cos(th)*reach+rc*Math.cos(a),4+558*u**1.05,Math.sin(th)*reach+rc*Math.sin(a)];
    },'guide'));
  }
  const study=curve(t=>[172*Math.cos(t),-46*Math.sin(3*t),172*Math.sin(t)]);
  return {name:'a jellyfish',parts,study,pose(p,part,phase,life){
    const[x,y,z]=p,w=phase*TAU*2,bob=life*26*Math.sin(w);
    if(part==='bell'){const pulse=1-life*.13*Math.sin(w);return[x*pulse,y+bob-life*24*Math.sin(w),z*pulse];}
    // Everything below the bell follows it late, so the trail reads as water.
    const trail=life*Math.max(0,y)/300;
    return[x+trail*30*Math.sin(w-y/230),y+bob,z+trail*22*Math.cos(w-y/280)];
  },details:[]};
}

export function createNautilusArtwork() {
  const turns=1.95,start=34,growth=Math.log(8.4)/(turns*TAU),last=turns*TAU;
  const spiral=th=>{const r=start*Math.exp(growth*th);return{r,c:[r*Math.cos(th),r*Math.sin(th),0]};};
  const shell=loft('shell',42,(u,a)=>{
    const th=u*last,{r,c}=spiral(th),tube=r*.38;
    return[c[0]+tube*.88*Math.cos(a)*Math.cos(th),c[1]+tube*.88*Math.cos(a)*Math.sin(th),c[2]+tube*Math.sin(a)];
  });
  // The aperture frame: outward along the spiral, with the rim spanned by u/v.
  const mouth=spiral(last),lip=mouth.r*.38;
  const radial=[Math.cos(last),Math.sin(last),0],axis=[0,0,1];
  const forward=unit3([growth*Math.cos(last)-Math.sin(last),growth*Math.sin(last)+Math.cos(last),0]);
  const parts=[shell];
  for(let k=0;k<12;k++){
    const spread=k/12*TAU,fan=add3(scale3(radial,Math.cos(spread)),scale3(axis,Math.sin(spread)));
    const direction=unit3(add3(forward,scale3(fan,.42)));
    parts.push(loft(`arm${k}`,8,(u,a)=>{
      const rc=11*(1-u)**.5+1.6,base=add3(mouth.c,scale3(fan,lip*.44));
      const along=add3(scale3(direction,lip*1.15*u),scale3(fan,lip*.62*u*u));
      const curl=scale3(radial,-lip*.5*u*u);
      return add3(add3(base,add3(along,curl)),add3(scale3(radial,rc*Math.cos(a)),scale3(axis,rc*Math.sin(a))));
    },'guide'));
  }
  // A hood over the aperture, and one eye on the outer wall beside it.
  parts.push(loft('hood',7,(u,a)=>{
    const t=last-.5+u*.72,{r,c}=spiral(t),tube=r*.4*(1-.42*u*u);
    return[c[0]+tube*Math.cos(a)*Math.cos(t),c[1]+tube*Math.cos(a)*Math.sin(t),c[2]+tube*1.06*Math.sin(a)];
  }));
  parts.push(eye(...add3(mouth.c,scale3(add3(scale3(radial,-.42),scale3(axis,.86)),lip)),'eye0'));
  // Chamber walls: the septa that make the shell a mathematical object.
  const details=Array.from({length:9},(_,i)=>{
    const th=(i+1)/10*last,{r,c}=spiral(th),tube=r*.38;
    return{colour:'guide',points:Array.from({length:41},(_,j)=>{
      const a=j/40*TAU;
      return[c[0]+tube*.9*Math.cos(a)*Math.cos(th),c[1]+tube*.9*Math.cos(a)*Math.sin(th),c[2]+tube*.92*Math.sin(a)];
    })};
  });
  const study=curve(t=>{const r=150*(1+.56*Math.cos(t));return[r*Math.cos(t),r*Math.sin(t)*.92,44*Math.sin(2*t)];});
  return {name:'a nautilus',parts,study,details,pose(p,part,phase,life){
    const[x,y,z]=p,w=phase*TAU*2,rock=life*.07*Math.sin(w),c=Math.cos(rock),s=Math.sin(rock);
    const sway=/^arm/.test(part)?life*19*Math.sin(w-1.1):0;
    return[x*c-y*s,x*s+y*c+life*14*Math.sin(w),z+sway];
  }};
}
