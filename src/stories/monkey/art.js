// Authored character geometry and pose. Narrative timing lives in story.js.
import { bezierPath as curve, ellipsePath as ellipse, TAU } from '../../math/geometry.js';
import { createFourierContour } from '../../math/contour.js';
import { gradient, dot, drawDraftingBackground } from '../../story/drawing.js';
const shape = (points, harmonics = 64) => createFourierContour(points, { harmonics });
const body = shape(curve([-41,-48], [
  [[-90,-20],[-97,83],[-82,132]], [[-77,189],[-32,207],[14,190]],
  [[82,203],[99,156],[85,107]], [[84,43],[65,-27],[35,-48]], [[15,-60],[-21,-63],[-41,-48]],
]));
const belly = shape(ellipse(0,93,56,77), 20);
const head = shape(curve([0,-233], [
  [[-39,-245],[-93,-218],[-99,-175]], [[-123,-120],[-95,-62],[-60,-45]],
  [[-24,-26],[30,-26],[64,-49]], [[104,-74],[119,-137],[96,-182]],
  [[87,-220],[39,-244],[0,-233]],
]));
const face = shape(curve([0,-177], [
  [[-25,-210],[-72,-204],[-75,-166]], [[-79,-151],[-72,-138],[-80,-118]],
  [[-96,-74],[-48,-42],[0,-48]], [[48,-42],[96,-74],[80,-118]],
  [[72,-138],[79,-151],[75,-166]], [[72,-204],[25,-210],[0,-177]],
]));
const earL = shape(ellipse(-109,-153,37,44), 12);
const earR = shape(ellipse(109,-153,37,44), 12);
const earInnerL = shape(ellipse(-111,-153,22,28), 12);
const earInnerR = shape(ellipse(111,-153,22,28), 12);
const tail = shape(curve([68,126], [
  [[128,151],[151,218],[204,219]], [[265,221],[279,164],[251,137]],
  [[228,113],[190,129],[195,155]], [[199,172],[219,168],[220,154]],
  [[221,148],[228,148],[231,155]], [[240,183],[205,194],[186,177]],
  [[151,146],[177,100],[215,102]], [[266,100],[299,140],[290,185]],
  [[283,238],[238,258],[198,249]], [[137,239],[115,175],[60,156]],
  [[45,149],[53,127],[68,126]],
]));
// Each arm is a closed ribbon in an endpoint-normalised coordinate system.
const arm = shape(curve([-18,0], [
  [[-37,-65],[-34,-156],[-16,-225]], [[-10,-250],[12,-254],[17,-233]],
  [[11,-158],[1,-77],[19,-8]], [[23,13],[-11,21],[-18,0]],
]));
const leg = shape(curve([-26,0], [
  [[-33,24],[-34,69],[-45,92]], [[-49,101],[-75,102],[-81,115]],
  [[-91,141],[-31,145],[-14,131]], [[5,117],[9,61],[18,25]],
  [[30,-8],[-13,-20],[-26,0]],
]));
const palm = shape(curve([-20,5], [
  [[-27,-5],[-27,-22],[-17,-23]], [[-15,-46],[-4,-45],[-1,-25]],
  [[5,-55],[15,-51],[12,-23]], [[24,-47],[33,-40],[22,-16]],
  [[43,-32],[49,-20],[31,-4]], [[33,19],[2,27],[-12,16]], [[-17,13],[-20,9],[-20,5]],
]), 48);
const grasp = shape(curve([-21,10], [
  [[-25,-1],[-25,-21],[-16,-22]], [[-10,-24],[-9,-18],[-9,-13]],
  [[-12,-31],[3,-31],[4,-17]], [[3,-30],[17,-27],[16,-13]],
  [[18,-24],[29,-18],[26,-7]], [[42,-12],[40,3],[27,9]],
  [[23,29],[-13,30],[-21,10]],
]),48);
for(const [id,g]of Object.entries({body,belly,head,face,earL,earR,earInnerL,earInnerR,tail,grasp,palm}))g.id=id;
function drawArm(ctx,root,grip,state,fill,wave=false,paint){
  ctx.save();ctx.translate(...root);
  const dx=grip[0]-root[0],dy=grip[1]-root[1],len=Math.hypot(dx,dy);
  ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);ctx.scale(1,len/238);
  paint(ctx,arm,fill,state,.21,wave===null?'leftArm':'rightArm');ctx.restore();
  ctx.save();ctx.translate(...grip);ctx.rotate(wave?Math.sin(state.t*TAU/0.9375)*.27:.17);
  paint(ctx,wave===null?grasp:palm,gradient(ctx,'#ebae7b','#b96847',-30,22),state,.5);
  if(state.fill>.2){
    ctx.globalAlpha*=state.fill*.48;ctx.strokeStyle='#9f543e';ctx.lineWidth=1.2;
    for(const x of [-7,3,13]){ctx.beginPath();ctx.moveTo(x,-9);ctx.lineTo(x+2,5);ctx.stroke();}
  }
  ctx.restore();
}

function draw(ctx,state,paint){
  const t=state.t,s=state.swing;
  // A physical pendulum about a fixed grip. The free hand anticipates the body;
  // feet and tail lag it, so the motion travels through the anatomy.
  const angle=.11*Math.sin(s)*state.life,bodyX=34*Math.sin(s)*state.life,bodyY=9*(1-Math.cos(s*2))*state.life;
  ctx.save();ctx.translate(496+bodyX,1080+bodyY);ctx.scale(1.53,1.53);ctx.rotate(angle);
  const fur=gradient(ctx,'#efb783','#bd6949');
  const darkFur=gradient(ctx,'#cb885d','#99523c');
  const light=gradient(ctx,'#ffdfb0','#eeb98c',-210,80);
  // Keep the world-space overhead grip fixed while the body swings beneath it.
  const target=[(338-(496+bodyX))/1.53,(584-(1080+bodyY))/1.53];
  const grip=[target[0]*Math.cos(angle)+target[1]*Math.sin(angle),-target[0]*Math.sin(angle)+target[1]*Math.cos(angle)];
  ctx.save();ctx.translate(69,143);ctx.rotate(.055*Math.sin(s-.7)*state.life);ctx.translate(-69,-143);
  paint(ctx,tail,darkFur,state,.18);ctx.restore();
  ctx.save();ctx.translate(43,171);ctx.rotate(-.22+.13*Math.sin(s-.55)*state.life);ctx.scale(-.9,.91);paint(ctx,leg,darkFur,state,.53,'rightLeg');ctx.restore();
  drawArm(ctx,[-63,-4],grip,state,darkFur,null,paint);
  paint(ctx,body,fur,state);
  paint(ctx,belly,gradient(ctx,'#edb585','#d69568',20,210),{...state,trace:state.trace*.4},.28);
  ctx.save();ctx.translate(-40,174);ctx.rotate(.13+.18*Math.sin(s-.32)*state.life);paint(ctx,leg,fur,state,.68,'leftLeg');ctx.restore();
  const wave=state.wave;
  const hand=[167+12*Math.sin(s+.4)*state.life,-52-wave*125+9*Math.sin(s+.6)*state.life];
  drawArm(ctx,[59,5],hand,state,fur,wave>.5,paint);
  // A counter-rotating head, with a second small delayed nod.
  ctx.save();ctx.translate(0,-35);ctx.rotate(-angle*.67+.025*Math.sin(s-.3)*state.life);ctx.translate(0,35);
  paint(ctx,earL,fur,state,.18);paint(ctx,earR,fur,state,.68);
  paint(ctx,earInnerL,gradient(ctx,'#c67a58','#dc9771',-190,-105),state,.25);
  paint(ctx,earInnerR,gradient(ctx,'#c67a58','#dc9771',-190,-105),state,.75);
  paint(ctx,head,fur,state,.1);
  paint(ctx,face,light,state,.25);
  // The expressive details deliberately remain readable during construction.
  ctx.save();ctx.globalAlpha*=state.faceOpacity*(.6+.4*state.fill);
  const blink=state.blink;
  const lookX=2.5*Math.sin(s*.5)*state.life+2*wave;
  for(const x of [-32,32]){
    ctx.save();ctx.translate(x,-145);ctx.scale(1,Math.max(.035,blink));
    ctx.fillStyle='#fff5da';ctx.beginPath();ctx.ellipse(0,0,18.5,24,0,0,TAU);ctx.fill();
    ctx.fillStyle='#402d26';ctx.beginPath();ctx.ellipse(lookX,2,9.8,15,0,0,TAU);ctx.fill();
    dot(ctx,lookX+2,-4,3.2,'#fff9ed');dot(ctx,lookX-3,7,1.3,'#c9925b');ctx.restore();
  }
  ctx.strokeStyle='#995b42';ctx.lineWidth=3.2;ctx.lineCap='round';
  for(const x of [-32,32]){ctx.beginPath();ctx.moveTo(x-12,-176);ctx.quadraticCurveTo(x,-182-3*wave,x+12,-177);ctx.stroke();}
  ctx.fillStyle='#cf9065';ctx.beginPath();ctx.ellipse(0,-107,21,13,0,0,TAU);ctx.fill();
  dot(ctx,-7,-107,2.5,'#6e4434');dot(ctx,7,-107,2.5,'#6e4434');
  const smile=wave*(.5+.5*Math.sin(s*4));
  ctx.fillStyle='#633b30';ctx.beginPath();ctx.moveTo(-27,-88);ctx.quadraticCurveTo(0,-73,27,-88);ctx.quadraticCurveTo(1,-55-smile*9,-27,-88);ctx.fill();
  ctx.fillStyle='#efb1a0';ctx.beginPath();ctx.ellipse(4,-71-smile*2,11,3.2+smile*2,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#945b40';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-31,-89);ctx.quadraticCurveTo(-34,-84,-33,-82);ctx.stroke();
  ctx.fillStyle='rgba(224,135,106,0.35)';for(const x of [-57,57]){ctx.beginPath();ctx.ellipse(x,-112,12,6,-.1,0,TAU);ctx.fill();}
  ctx.restore();
  ctx.restore();
  ctx.restore();
}


function background(ctx, frame) {
  drawDraftingBackground(ctx, frame.phase * 45, { theme: frame.theme, foliage: true });
  // A single clean bough, shaped to lead the eye to the fixed grip.
  ctx.save();ctx.globalAlpha=frame.values.branch;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(127,603);ctx.bezierCurveTo(338,557,675,597,930,534);
  ctx.strokeStyle='#294b45';ctx.lineWidth=16;ctx.stroke();
  ctx.strokeStyle='#668675';ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(792,563);ctx.quadraticCurveTo(825,522,856,518);ctx.strokeStyle='#668675';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(823,539);ctx.bezierCurveTo(817,500,854,491,871,491);ctx.bezierCurveTo(868,515,851,542,823,539);ctx.fillStyle='#678c74';ctx.fill();
  ctx.restore();
}
export const monkeyArtwork = {
  name: 'a monkey', studyId: 'tail', placement: { x: 496, y: 1080, scale: 1.53 },
  contours: { body, belly, head, face, earL, earR, earInnerL, earInnerR, tail, arm, leg, palm, grasp },
  draw, background,
};
