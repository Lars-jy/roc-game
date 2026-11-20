import {WIDTH,HEIGHT,clamp,ease,lerp,sourceTimeAt,sceneOpacityAt,backlightAt,playerGlyphs,particleState,validateEditMap,introParticleTime} from './player-model.js';

const makeSurface=()=>{const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;return c;};
const json=async url=>{const response=await fetch(url);if(!response.ok)throw new Error(`Cannot load ${url}`);return response.json();};
const bitmap=async url=>{const image=new Image();image.decoding='async';image.src=url;await image.decode();return image;};

/** Source bitmap/letter geometry is exported from the approved V6 Python code. */
export class EndingRenderer {
  constructor(canvas,scene,map,images,crowdRegions) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
    this.scene=scene;this.map=map;this.images=images;
    this.people=scene.people.map(person=>({...person,region:crowdRegions[person.id]}));
    this.particles=[];this.glyphCache=new Map();this.textCache=null;
    this.morphSurface=makeSurface();this.morphCtx=this.morphSurface.getContext('2d');
    this.lastFrame=null;this.lastReferenceTime=0;
    this.pages=new Map(scene.pages.map(p=>[p.id,p]));
  }
  static async load(canvas,base='./assets/ending-demo/') {
    const [scene,map,crowdRegions]=await Promise.all([json(base+'scene.json'),json(base+'edit-map.json'),json(base+'crowd-regions.json')]);
    validateEditMap(map);
    const files=new Set([scene.background,scene.final,scene.center.file,scene.atlas,scene.patchAtlas,scene.credit]);
    files.add('crowd-atlas.png');
    for(const page of scene.pages)if(page.fullLayer)files.add(page.fullLayer.file);
    const entries=await Promise.all([...files].filter(Boolean).map(async file=>[file,await bitmap(base+file)]));
    return new EndingRenderer(canvas,scene,map,new Map(entries),crowdRegions);
  }
  prepare(values,visibleLetters=[]) {
    const glyphs=playerGlyphs(values,this.scene.particles.length);
    const origins=new Map();
    for(const letter of visibleLetters) {
      if(!origins.has(letter.char))origins.set(letter.char,[]);
      origins.get(letter.char).push(letter);
    }
    this.particles=this.scene.particles.map((p,i)=>{
      const char=glyphs[i]||'',matches=origins.get(char);
      const origin=matches?.[i%matches.length] || visibleLetters[i%visibleLetters.length];
      if(!origin)return {...p,char};
      const source=[origin.x,origin.y],dx=source[0]-p.source[0],dy=source[1]-p.source[1];
      return {...p,char,source,c1:[p.c1[0]+dx,p.c1[1]+dy]};
    });
    this.glyphCache.clear();this.lastFrame=null;
    return glyphs;
  }
  drawImage(file,x=0,y=0,alpha=1,context=this.ctx) {
    if(alpha<=0)return;
    context.globalAlpha=clamp(alpha);context.drawImage(this.images.get(file),x,y);context.globalAlpha=1;
  }
  stage(light=1,context=this.ctx) {
    this.drawImage(this.scene.background,0,0,light,context);
    const p=this.scene.center;
    this.drawImage(p.file,p.x,p.y,lerp(.34,1,clamp(light)),context);
  }
  drawGlyphs(glyphs,alpha=1,context=this.ctx) {
    const atlas=this.images.get(this.scene.atlas);
    context.globalAlpha=clamp(alpha);
    for(const glyph of glyphs) {
      const s=this.scene.sprites[glyph.spriteKey];
      context.drawImage(atlas,s.x,s.y,s.w,s.h,glyph.x+s.dx,glyph.y+s.dy,s.w,s.h);
    }
    context.globalAlpha=1;
  }
  textLayer(page,count) {
    if(!this.textCache){const canvas=makeSurface();this.textCache={canvas,ctx:canvas.getContext('2d'),count:0,pageId:null};}
    const cache=this.textCache;
    if(cache.pageId!==page.id || count<cache.count) {cache.ctx.clearRect(0,0,WIDTH,HEIGHT);cache.count=0;cache.pageId=page.id;}
    const atlas=this.images.get(this.scene.patchAtlas);
    for(let i=cache.count;i<count;i++) {
      const p=page.patches[i],s=this.scene.patchSprites[p.spriteKey];
      cache.ctx.clearRect(p.x,p.y,s.w,s.h);
      cache.ctx.drawImage(atlas,s.x,s.y,s.w,s.h,p.x,p.y,s.w,s.h);
    }
    cache.count=count;return cache.canvas;
  }
  caption(page,count,alpha) {
    if(alpha<=0 || count<=0)return;
    const c=this.ctx;c.globalAlpha=clamp(alpha);
    if(count>=page.glyphs.length && page.fullLayer) {
      const layer=page.fullLayer;c.drawImage(this.images.get(layer.file),layer.x,layer.y);
    } else c.drawImage(this.textLayer(page,count),0,0);
    c.globalAlpha=1;
  }
  glyph(char,size) {
    const key=`${char}:${size}`;
    if(this.glyphCache.has(key))return this.glyphCache.get(key);
    const canvas=document.createElement('canvas');canvas.width=size+10;canvas.height=size+12;
    const c=canvas.getContext('2d');c.font=`${size}px SimSun,serif`;c.textBaseline='top';
    c.lineWidth=2;c.lineJoin='round';c.strokeStyle='rgba(0,0,0,.90)';c.strokeText(char,5,2);
    c.fillStyle='#f8f7f2';c.fillText(char,5,2);
    this.glyphCache.set(key,canvas);
    if(this.glyphCache.size>18000)this.glyphCache.delete(this.glyphCache.keys().next().value);
    return canvas;
  }
  morph(time) {
    const c=this.ctx,layer=this.morphCtx;
    const particleTime=introParticleTime(time);
    layer.clearRect(0,0,WIDTH,HEIGHT);
    for(const p of this.particles) {
      if(!p.char)continue;
      const s=particleState(p,particleTime);if(!s || s.alpha<=0)continue;
      const glyph=this.glyph(p.char,s.size);
      layer.save();layer.globalAlpha=s.alpha;layer.translate(Math.round(s.x),Math.round(s.y));layer.rotate(-s.tilt*Math.PI/180);
      layer.drawImage(glyph,-glyph.width/2,-glyph.height/2);layer.restore();
    }
    if(time>9) {const p=this.scene.center;this.drawImage(p.file,p.x,p.y,.34*ease((time-9)/1.3),layer);}
    c.drawImage(this.morphSurface,0,0);
  }
  crowd(time) {
    if(time>=20.35){this.drawImage(this.scene.final);return;}
    this.stage();
    const atlas=this.images.get('crowd-atlas.png'),c=this.ctx;
    for(const p of this.people) {
      if(time<p.appear)continue;
      c.globalAlpha=ease((time-p.appear)/p.fade);
      c.drawImage(atlas,p.region[0],p.region[1],p.width,p.height,p.x,p.y,p.width,p.height);
    }
    c.globalAlpha=1;
    this.drawImage(this.scene.final,0,0,ease((time-19.5)/.85));
  }
  renderAt(referenceTime,{force=false}={}) {
    const started=performance.now(),T=this.scene.timeline;
    const sourceTime=sourceTimeAt(this.map,referenceTime);
    const frame=Math.floor(sourceTime*this.scene.fps+1e-7),time=frame/this.scene.fps;
    const opacity=sceneOpacityAt(this.map,referenceTime),light=backlightAt(this.map,referenceTime,time);
    const signature=`${frame}:${Math.round(opacity*10000)}:${Math.round(light*10000)}`;
    if(!force && signature===this.lastFrame)return;
    this.lastFrame=signature;this.lastReferenceTime=referenceTime;
    const c=this.ctx;c.globalAlpha=1;c.clearRect(0,0,WIDTH,HEIGHT);
    if(time>=10.3){c.fillStyle='#000';c.fillRect(0,0,WIDTH,HEIGHT);}
    let phase='';
    if(time<10.3){phase='particles';this.morph(time);}
    else if(time<11.5){phase='alone';this.stage(light);}
    else if(time<12.6){phase='backlight';this.stage(light);}
    else {
      const cue=T.court.find(p=>frame>=p.start && frame<p.end);
      if(cue) {
        phase=cue.id;this.stage(light);
        const count=Math.floor(clamp((frame-cue.typing_start)/Math.max(1,cue.typing_end-cue.typing_start))*cue.text.length);
        const alpha=ease((frame-cue.start)/(this.scene.fps*.35))*(1-ease((frame-cue.hold_end)/Math.max(1,cue.end-cue.hold_end)));
        this.caption(this.pages.get(cue.id),count,alpha);
      } else if(frame<T.crowd_start){phase='alone';this.stage(light);}
      else if(frame<T.crowd_end){phase='crowd';this.crowd((frame-T.crowd_start)/this.scene.fps);}
      else if(frame<T.reality_start){phase='blackout';}
      else if(frame<T.slogan_start) {
        phase='reality';const local=(frame-T.reality_start)/this.scene.fps,fade=1-ease((local-18.6)/.9);
        this.scene.reality.forEach((text,i)=>this.drawGlyphs(text.glyphs,ease((local-[.3,4,12.2][i])/1.05)*fade));
        if(local>4)this.drawImage(this.scene.credit,0,0,ease(local-4)*fade);
      } else {phase='slogan';this.drawGlyphs(this.scene.slogan.glyphs,ease((frame-T.slogan_start)/this.scene.fps/1.1));}
    }
    if(opacity<1){c.globalAlpha=1-opacity;c.fillStyle='#000';c.fillRect(0,0,WIDTH,HEIGHT);c.globalAlpha=1;}
    this.canvas.dataset.phase=opacity<=0?'blackout':phase;
    this.canvas.dataset.referenceTime=referenceTime.toFixed(3);
    this.canvas.dataset.sourceTime=time.toFixed(3);
    this.canvas.dataset.renderMs=(performance.now()-started).toFixed(2);
    return {referenceTime,sourceTime:time,frame,phase,opacity};
  }
}
