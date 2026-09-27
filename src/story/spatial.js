import { add3, sub3, scale3, dot3, cross3, unit3, epicycleChain3D } from '../math/fourier3d.js';
const TAU = Math.PI*2;

/** Perspective projection shared by browser Canvas and native Skia delivery. */
export function createCamera3D({ yaw = -.45, pitch = -.22, distance = 1400, focal = 1250, centre = [540,1030], zoom = 1 } = {}) {
  if (![yaw,pitch,distance,focal,zoom,...centre].every(Number.isFinite) || distance <= 0 || focal <= 0 || zoom <= 0) throw new Error('Invalid 3D camera.');
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  const view = ([x,y,z]) => { const a=cy*x+sy*z,b=-sy*x+cy*z; return [a,cx*y-sx*b,sx*y+cx*b]; };
  const project = p => { const q=view(p),depth=distance-q[2]; return depth<10?null:[centre[0]+q[0]*focal*zoom/depth,centre[1]+q[1]*focal*zoom/depth,q[2]]; };
  return { view, project };
}

export function stroke3D(ctx, points, camera, { colour='#b5e9e1', alpha=1, width=1.5, close=false } = {}) {
  if (alpha <= .001 || points.length < 2) return;
  ctx.save(); ctx.globalAlpha*=alpha; ctx.strokeStyle=colour; ctx.lineWidth=width; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath();
  let connected=false;
  for (const point of points) { const p=camera.project(point); if(!p){connected=false;continue;} if(!connected)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);connected=true; }
  if(close)ctx.closePath();ctx.stroke();ctx.restore();
}

const rgb = hex => /^#[0-9a-f]{6}$/i.test(hex) ? [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) : [140,200,210];
/** Small opaque faces sorted in camera space; no GPU or frame history needed. */
export function drawMesh3D(ctx, meshes, camera, { opacity=1, wire=0 } = {}) {
  if(opacity<=.001&&wire<=.001)return;
  const faces=[];
  for(const mesh of meshes){
    const view=mesh.vertices.map(camera.view),screen=mesh.vertices.map(camera.project),base=rgb(mesh.colour);
    for(const face of mesh.faces){
      const p=face.map(i=>screen[i]);if(p.some(v=>!v))continue;
      const [a,b,c]=face.map(i=>view[i]);
      const normal=unit3(cross3(sub3(b,a),sub3(c,a)));
      const light=.32+.56*Math.abs(dot3(normal,unit3([-.4,-.7,1])))+.12*(1-Math.abs(normal[2]));
      const colour=`rgb(${base.map(v=>Math.min(255,Math.round(v*light+12))).join(',')})`;
      faces.push({p,depth:p.reduce((s,v)=>s+v[2],0)/p.length,colour});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  ctx.save();const inherited=ctx.globalAlpha;ctx.lineJoin='round';
  for(const {p,colour}of faces){
    ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(const v of p.slice(1))ctx.lineTo(v[0],v[1]);ctx.closePath();
    if(opacity>.001){ctx.globalAlpha=inherited*opacity;ctx.fillStyle=colour;ctx.fill();ctx.strokeStyle=colour;ctx.lineWidth=.7;ctx.stroke();}
    if(wire>0){ctx.globalAlpha=inherited;ctx.strokeStyle=`rgba(210,247,242,${wire*.25})`;ctx.lineWidth=.6;ctx.stroke();}
  }
  ctx.restore();
}

export function drawEpicycles3D(ctx, curve, time, camera, { terms=curve.terms.length, mode='circles', opacity=1, colour='#8ee8dc', transform=p=>p } = {}) {
  const chain=epicycleChain3D(curve,time,terms);
  if(mode==='none'||opacity<=.001)return chain.tip;
  for(const [i,c]of chain.circles.entries()){
    if(c.radius<.7)continue;
    const ring=(u,v)=>Array.from({length:65},(_,n)=>transform(add3(c.centre,scale3(add3(scale3(u,Math.cos(TAU*n/64)),scale3(v,Math.sin(TAU*n/64))),c.radius))));
    stroke3D(ctx,ring(c.u,c.v),camera,{colour,alpha:opacity*(i<4?.6:.3),width:1.2});
    if(mode==='spheres')for(const [u,v]of [[c.u,c.normal],[c.v,c.normal]])stroke3D(ctx,ring(u,v),camera,{colour,alpha:opacity*.19,width:.8});
    stroke3D(ctx,[transform(c.centre),transform(c.tip)],camera,{colour:'#ffe4b7',alpha:opacity*.8,width:1.5});
  }
  const tip=camera.project(transform(chain.tip));
  if(tip){ctx.save();ctx.globalAlpha*=opacity;ctx.fillStyle='#fff3d6';ctx.shadowColor=colour;ctx.shadowBlur=16;ctx.beginPath();ctx.arc(tip[0],tip[1],5,0,TAU);ctx.fill();ctx.restore();}
  return chain.tip;
}

/** Lofted surfaces use reconstructed Fourier rings as their actual vertices. */
export function loftCurves3D(curves, { colour='#70b9cf', transform=p=>p, closed=false } = {}) {
  const n=curves[0].points.length,vertices=curves.flatMap(c=>c.points.map(transform)),faces=[];
  for(let row=0;row<(closed?curves.length:curves.length-1);row++)for(let j=0;j<n;j++){
    const next=(row+1)%curves.length,a=row*n+j,b=row*n+(j+1)%n,c=next*n+(j+1)%n,d=next*n+j;
    faces.push([a,b,c],[a,c,d]);
  }
  if(!closed)for(const row of [0,curves.length-1]){
    const cap=vertices.length;vertices.push(scale3(curves[row].points.map(transform).reduce(add3,[0,0,0]),1/n));
    for(let j=0;j<n;j++)faces.push([cap,row*n+j,row*n+(j+1)%n]);
  }
  return {vertices,faces,colour};
}

/** Longitudinal outlines taken directly from the vertices of the final lofts. */
export function sculptureGuides3D(parts) {
  return parts.flatMap(part => {
    const n=part.curves[0].points.length;
    const indices=[0,Math.floor(n/4),Math.floor(n/2),Math.floor(3*n/4)];
    if(part.closed)return indices.map(index=>({partId:part.id,points:part.curves.map(c=>c.points[index])}));
    return indices.slice(0,2).map((index,i)=>({partId:part.id,points:[
      ...part.curves.map(c=>c.points[index]),
      ...part.curves.slice().reverse().map(c=>c.points[indices[i+2]]),
    ]}));
  });
}
