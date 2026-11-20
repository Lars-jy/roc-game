import { GLASS_OPTICS } from './vendor/glass-optics.js';

/** Transparent optical overlay. Painted edges and thickness belong to the
 * approved image; never repaint them as additional dark strips. */
export function glassBufferSize(width, height, dpr = 1) {
  if (!(width > 0 && height > 0)) return { width: 1, height: 1, ratio: 1 };
  const ratio = Math.min(Math.max(1, Number(dpr) || 1), 2, 3840 / width, 2160 / height);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), ratio };
}
// Main seams measured on the 1672x941 original: x=1029 / 1420 at the top,
// x=793 / 1256 at y=820. The source picture alone supplies the exact bevels.
const p=(x,y)=>[x/1672,y/941];
const FOCUS_RADIUS = 280;
export const GLASS_FACES=Object.freeze([
  {name:'left',normal:[-.326,0,.945],points:[p(657,0),p(1025,0),p(789,820),p(276,820)]},
  {name:'center',normal:[0,0,1],points:[p(1040,0),p(1415,0),p(1250,820),p(804,820)]},
  // The right edge is cropped by the screen, not a vertical glass edge. Its
  // optical coordinate system continues offscreen, parallel to the true seam.
  {name:'right',normal:[.375,0,.927],points:[p(1428,0),p(1672,0),p(1672,820),p(1264,820)],opticalBounds:[1428/1672,1264/1672,408/1672,408/1672]},
]);
// Optical-only strips bridge the real painted ridges. They add light, never a
// border, fracture line or displaced piece of the original illustration.
const RIDGE_LIGHTS=[
 {normal:[0,0,1],points:[p(1015,0),p(1048,0),p(812,820),p(778,820)]},
 {normal:[.18,0,.984],points:[p(1405,0),p(1438,0),p(1274,820),p(1240,820)]},
 {normal:[-.326,0,.945],points:[p(640,0),p(676,0),p(295,820),p(259,820)]},
 {normal:[.375,0,.927],points:[p(1648,0),p(1690,0),p(1690,820),p(1648,820)]},
 {normal:[0,0,1],points:[p(640,0),p(1672,0),p(1672,25),p(628,25)]},
 {normal:[0,0,1],points:[p(280,773),p(1672,798),p(1672,822),p(280,799)]},
];
const vertex=/* glsl */`
attribute vec2 aPosition; attribute vec3 aNormal; attribute vec4 aPane;
varying vec2 vUv; varying vec3 vNormal; varying vec4 vPane;
void main(){vUv=aPosition;vNormal=aNormal;vPane=aPane;
 gl_Position=vec4(aPosition.x*2.0-1.0,1.0-aPosition.y*2.0,0.0,1.0);}
`;
const fragment=/* glsl */`
precision highp float;
uniform vec3 uLight; uniform float uGlass;
varying vec2 vUv; varying vec3 vNormal; varying vec4 vPane;
${GLASS_OPTICS}
// Continuous violet/blue/cyan/green/gold/orange/red shoulders. White stays a
// low-energy illuminating core; it is never normalized into an opaque stripe.
vec3 prismSpectrum(float t){
 t=clamp(t,0.,1.)*6.;
 if(t<1.)return mix(vec3(.64,.27,1.),vec3(.22,.44,1.),t);
 if(t<2.)return mix(vec3(.22,.44,1.),vec3(.12,.85,1.),t-1.);
 if(t<3.)return mix(vec3(.12,.85,1.),vec3(.20,1.,.60),t-2.);
 if(t<4.)return mix(vec3(.20,1.,.60),vec3(1.,.90,.28),t-3.);
 if(t<5.)return mix(vec3(1.,.90,.28),vec3(1.,.53,.12),t-4.);
 return mix(vec3(1.,.53,.12),vec3(1.,.22,.24),t-5.);
}
// Stable polynomial variation avoids dozens of per-pixel trig evaluations.
float fixedHash(float n){float q=fract(n*.75487766+.56984029);return fract(q*(q+19.19)*97.23);}
// An even power must be symmetric on both sides of a ridge. GLSL pow()
// leaves negative bases undefined, even when the exponent is an integer.
float sq(float v){return v*v;}
// Deterministic little triangular/diamond reflections, anchored to the actual
// ridge. Mouse angle modulates their light, not their shape or random seed.
vec3 ridgeFire(float x,float y,float ridgeX,float beamX,float seed){
 if(abs(x-ridgeX)>30.)return vec3(0.);
 vec3 light=vec3(0.);float cell=floor(y/12.);
 for(int k=-1;k<=1;k++){
  float id=cell+float(k),r=fixedHash(id+seed);
  float cy=id*12.+2.+fixedHash(id*2.1+seed)*8.;
  float qy=y-cy;
  float qx=x-ridgeX+(fixedHash(id*3.7+seed)-.5)*17.+qy*(fixedHash(id*4.3+seed)-.5)*.65;
  float h=2.5+fixedHash(id*5.9+seed)*9.;
  float w=1.2+fixedHash(id*7.1+seed)*4.4;
  float diamond=abs(qx)/w+abs(qy)/h;
  float triangle=max(abs(qx)/(w*clamp((h-qy)/(2.*h),.08,1.)),abs(qy)/h);
  float shape=1.-smoothstep(.85,1.12,mix(diamond,triangle,step(.56,r)));
  shape*=smoothstep(.015,.08,r);
  float hue=fract(floor(id/3.)*.173+seed*.071);
  vec3 colour=prismSpectrum(hue);
  float angular=1.-abs(fract(id*.173+uLight.x*.51+uLight.y*.21)*2.-1.);
  float angle=.40+.60*angular*angular*angular;
  float close=.08+.92*exp(-sq((ridgeX-beamX)/180.));
  float white=exp(-sq(qx/max(w*.22,.35)))*shape;
  light+=(colour*shape*.42+vec3(1.,.98,.92)*white*.17)*angle*close;
 }
 return light;
}
// Sparse transparent edge chips: larger than the central glitter, with a nearly
// clear face and a thin dispersive rim. No dark outlines or missing art pixels.
vec3 edgeChipLayer(float x,float y,float ridgeX,float beamX,float seed,float size){
 if(abs(x-ridgeX)>55.+18.*(size-1.))return vec3(0.);
 // Constant-size rows per layer avoid row reversal and chopped neighbours.
 float phase=(size-1.)*25.;
 vec3 light=vec3(0.);float cell=floor((y+phase)/(29.*size));
 for(int k=-1;k<=1;k++){
  float id=cell+float(k),r=fixedHash(id*2.7+seed);
  float cy=(id*29.+4.+fixedHash(id*3.1+seed)*19.)*size-phase;
  float side=mix(-1.,1.,step(.5,fixedHash(id*4.7+seed)));
  float qy=y-cy;
  float qx=x-ridgeX-side*(13.+r*19.)+qy*(fixedHash(id*5.3+seed)-.5)*.38;
  float h=(6.+fixedHash(id*7.9+seed)*17.)*size;
  float w=(3.+fixedHash(id*9.3+seed)*7.)*size;
  float d=max(abs(qx)/(w*clamp((h-qy)/(2.*h),.055,1.)),abs(qy)/h);
  float body=1.-smoothstep(.91,1.04,d);
  float rim=exp(-sq((d-.93)/.075));
  float keep=smoothstep(.025,.11,r);
  float angular=1.-abs(fract(id*.219+seed*.17+uLight.x*.43)*2.-1.);
  float angle=.40+.60*angular*angular;
  float close=.16+.84*exp(-sq((ridgeX-beamX)/220.));
  vec3 colour=prismSpectrum(fract(id*.137+seed*.073));
  light+=(colour*rim*.34+vec3(.91,.96,1.)*body*.040)*keep*angle*close;
 }
 return light;
}
vec3 edgeChips(float x,float y,float ridgeX,float beamX,float seed){
 // Use original image Y even when the lower edge calls this with swapped axes.
 float lower=smoothstep(460.,690.,vUv.y*941.);
 vec3 light=edgeChipLayer(x,y,ridgeX,beamX,seed,1.);
 if(lower>.001)light+=edgeChipLayer(x,y,ridgeX,beamX,seed+307.,5.)*lower*.9;
 return light;
}
vec3 denseGlassEdge(float x,float y,float ridgeX,float beamX,float seed){
 float lower=smoothstep(460.,690.,vUv.y*941.);
 if(abs(x-ridgeX)>(lower>.001?132.:57.))return vec3(0.);
 return ridgeFire(x,y,ridgeX,beamX,seed)
  +ridgeFire(x,y*1.23,ridgeX+10.,beamX,seed+107.)*.72
  +edgeChips(x,y,ridgeX,beamX,seed+61.)*1.1;
}
void main(){
 float x=vUv.x*1672.,y=vUv.y*941.;
 vec2 mouse=vec2((uLight.x+1.)*.5*1672.,(uLight.y+1.)*.5*941.);
 float focus=1.-smoothstep(105.,${FOCUS_RADIUS.toFixed(1)},length(vec2(x,y)-mouse));
 if(focus<.001){gl_FragColor=vec4(0.);return;}
 float mask=1.;
 mask*=1.-smoothstep(.82,.872,vUv.y);
 // Analytically invert each trapezoid instead of interpolating triangle UVs.
 // Constant u is a straight line along that pane, without a diagonal kink.
 float v=clamp(vUv.y/(820./941.),0.,1.);
 float left=mix(vPane.x,vPane.y,v);
 float width=mix(vPane.z,vPane.w,v);
 float u=(vUv.x-left)/width;
 float edge=min(u,1.-u);
 mask*=smoothstep(0.,.006,edge);
 // Thin optical bevels and two shallow facets per original pane. These affect
 // reflected normals only; no borders, seams or underlying pixels are drawn.
 float bevel=1.-smoothstep(.003,.034,edge);
 float facet=step(.43+.19*v,u)-.5;
 vec3 N=normalize(vNormal+vec3(sign(.5-u)*bevel*.18+facet*.045,facet*.018,0.));
 vec3 cameraToFrag=normalize(vec3((vUv.x-.58)*1.45,(.48-vUv.y)*.85,-1.75));
 vec3 reflected=glassReflect(cameraToFrag,N);
 vec3 F=F_Schlick(vec3(.12),1.,max(dot(-cameraToFrag,N),0.));
 vec3 rayR,rayB;gemFastChroma(reflected,.018,rayR,rayB);
 float ridge0=657.-381.*v,ridge1=1029.-236.*v,ridge2=1420.-164.*v,ridge3=1670.;
 // Fixed optical band on the glass. Only the round spotlight follows pointer.
 float beamX=ridge1+180.;
 float responseX=mouse.x;
 float s=x-beamX;
 float spread=63.+abs(rayR.x-rayB.x)*120.;
 float core=exp(-sq(s/17.));
 float halo=exp(-sq(sq(s/51.)));
 float shoulder=exp(-sq((abs(s)-30.)/17.))*(1.-core*.7);
 vec3 colour=prismSpectrum(.5+s/(spread*1.32)+.03*(.5-abs(fract(y*.003+s*.002)*2.-1.)));
 float gloss=.65+min(F.r,.3)*2.;
 float power=uLight.z*uGlass*focus;
 vec3 broad=vec3(.99,.98,.94)*(core*.235+halo*.018)+colour*shoulder*.32;
 vec3 fragments=denseGlassEdge(x,y,ridge1,responseX,13.)+denseGlassEdge(x,y,ridge2,responseX,41.)*.82;
 fragments+=denseGlassEdge(x,y,ridge0,responseX,113.)*.9+denseGlassEdge(x,y,ridge3,responseX,151.)*.9;
 // A few small reflections along the upper and lower glass edges. The existing
 // foreground contour mask still removes the desk and envelope completely.
 float bottom=791.+(x-850.)*.018;
 fragments+=denseGlassEdge(y,x,8.,mouse.y,191.)*.7;
 fragments+=denseGlassEdge(y,x,bottom,mouse.y,211.)*.65;
 vec3 energy=(broad*gloss*.74+fragments*1.45)*power;
 // CSS screen blends raw light energy with the illustration. Do not divide by
 // its peak (the old normalization turned the white centre into solid paint).
 gl_FragColor=vec4(clamp(energy,0.,.52),mask);
}
`;
function mesh(){
 const values=[];
 for(const face of [...GLASS_FACES,...RIDGE_LIGHTS]){
  const [tl,tr,br,bl]=face.points,pane=face.opticalBounds||[tl[0],bl[0],tr[0]-tl[0],br[0]-bl[0]];
  for(const i of [0,1,2,0,2,3])values.push(...face.points[i],...face.normal,...pane);
 }
 return new Float32Array(values);
}
// Limit fragment processing to pixels the spotlight can illuminate. Keep the
// canvas at its native device resolution so the narrow spectral rims stay sharp.
function scissorLight(gl, width, height, x, y) {
  const centreX = (x + 1) * .5 * width;
  const centreY = (1 - y) * .5 * height;
  const rx = FOCUS_RADIUS * width / 1672;
  const ry = FOCUS_RADIUS * height / 941;
  const left = Math.max(0, Math.floor(centreX - rx) - 1);
  const bottom = Math.max(0, Math.floor(centreY - ry) - 1);
  const right = Math.min(width, Math.ceil(centreX + rx) + 1);
  const top = Math.min(height, Math.ceil(centreY + ry) + 1);
  gl.scissor(left, bottom, right - left, top - bottom);
}

function glassPipeline(gl) {
  const program = gl.createProgram();
  const shaders = [];
  let buffer;
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Glass shader link failed.');
    gl.useProgram(program);
    const vertices = mesh();
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    for (const [name, size, offset] of [['aPosition', 2, 0], ['aNormal', 3, 2], ['aPane', 4, 5]]) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset * 4);
    }
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    return {
      program, buffer, count: vertices.length / 9,
      light: gl.getUniformLocation(program, 'uLight'),
      glass: gl.getUniformLocation(program, 'uGlass'),
    };
  } catch {
    if (buffer) gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

export function createTitleGlass(root, view = window) {
  const canvas = root.querySelector?.('.title-glass-canvas');
  const image = root.querySelector?.('.prism-source');
  const artwork = root.querySelector?.('.prism-art') || root;
  const noop = { render() {}, resize() {}, dispose() {} };
  if (!canvas || !image) return noop;
  let gl, pipeline, disposed = false, drawn = false, contextLost = false;
  let last = { x: 0, y: 0, light: 0, glass: 0 };

  function render(value = last) {
    last = value;
    if (disposed || !pipeline) return;
    const active = value.light >= .001 && value.glass >= .001;
    if (!active && !drawn) return;
    // Clear the previous presentation, including when the mouse jumps panes.
    // Unscissored transparent clears use the GPU's fast clear path.
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawn = active;
    if (!active) return;
    gl.uniform3f(pipeline.light, value.x, value.y, value.light);
    gl.uniform1f(pipeline.glass, value.glass);
    gl.enable(gl.SCISSOR_TEST);
    scissorLight(gl, canvas.width, canvas.height, value.x, value.y);
    gl.drawArrays(gl.TRIANGLES, 0, pipeline.count);
    gl.disable(gl.SCISSOR_TEST);
  }

  function resize() {
    if (!pipeline || disposed) return;
    const box = artwork.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) return;
    const size = glassBufferSize(box.width, box.height, view.devicePixelRatio);
    if (canvas.width === size.width && canvas.height === size.height) return;
    canvas.width = size.width;
    canvas.height = size.height;
    gl.viewport(0, 0, size.width, size.height);
    drawn = false;
    render();
  }

  function load() {
    if (disposed || pipeline || contextLost || !image.complete || !image.naturalWidth) return;
    try {
      gl ||= canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false,
        preserveDrawingBuffer: false, powerPreference: 'low-power' });
    } catch { return; }
    if (!gl) return;
    pipeline = glassPipeline(gl);
    if (!pipeline) return;
    resize();
    if (!drawn) render(); // The buffer may already have the right size after a context restore.
    root.setAttribute('data-glass-ready', 'true');
  }

  function lost(event) {
    event.preventDefault();
    contextLost = true;
    pipeline = null; // The context owns the invalidated GPU handles.
    drawn = false;
    root.removeAttribute('data-glass-ready');
  }
  function restored() {
    contextLost = false;
    load();
  }
  image.addEventListener('load', load);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  load();
  return { render, resize, dispose() {
    if (disposed) return;
    disposed = true;
    image.removeEventListener('load', load);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    if (pipeline) {
      gl.deleteBuffer(pipeline.buffer);
      gl.deleteProgram(pipeline.program);
    }
    root.removeAttribute('data-glass-ready');
  } };
}
