/** The editor's reference seconds map to the original V6 code's frame clock. */
export const WIDTH=1920, HEIGHT=1080;
export const clamp=value=>Math.max(0,Math.min(1,value));
export const ease=value=>{const v=clamp(value);return v*v*(3-2*v);};
export const lerp=(a,b,t)=>a+(b-a)*t;

// Begin lifting letters on submission, while retaining the original landing
// and all later scene/audio cues. The old lead-in only held a report image.
export function introParticleTime(time) {
  const t=Math.max(0,time);
  return t<9.15 ? 1.72+t*(9.15-1.72)/9.15 : t;
}
export function reportDissolveProgress(time) { return ease(time/1.15); }

const INTRO_PLAYBACK_RATE = .9;
const ENDING_VOLUME = .6;
const FADE_SECONDS = 3;

/** The soundtrack and canvas keep sharing the original reference clock. */
export function applyEndingPlayback(audio, map, { effectsVolume = 1, masterMuted = false } = {}) {
  const lightCue = map.segments.find(segment => segment.id === 'backlight-a');
  const rate = lightCue && audio.currentTime < lightCue.refStart ? INTRO_PLAYBACK_RATE : 1;
  const fade = ease(audio.currentTime / (FADE_SECONDS * INTRO_PLAYBACK_RATE));
  const volume = ENDING_VOLUME * fade * clamp(effectsVolume);
  if (audio.playbackRate !== rate) audio.playbackRate = rate;
  if (audio.volume !== volume) audio.volume = volume;
  if (audio.muted !== masterMuted) audio.muted = masterMuted;
}

export function validateEditMap(map) {
  if(!map || !Number.isFinite(map.duration) || map.duration<=0 || !Array.isArray(map.segments) || !map.segments.length) throw new Error('Missing reference edit map.');
  let end=0;
  for(const item of map.segments) {
    if(![item.refStart,item.refEnd,item.sourceStart,item.rate].every(Number.isFinite)) throw new Error('Invalid edit timing.');
    if(Math.abs(item.refStart-end)>.002 || item.refEnd<=item.refStart || item.sourceStart<0 || item.rate<0) throw new Error('Non-contiguous edit map.');
    end=item.refEnd;
  }
  if(Math.abs(end-map.duration)>.02) throw new Error('Reference duration mismatch.');
  if(map.backlightFade) {
    const {start,end}=map.backlightFade;
    if(!Number.isFinite(start) || !Number.isFinite(end) || start<0 || end<=start || end>map.duration) throw new Error('Invalid backlight fade timing.');
  }
  return map;
}

export function sourceTimeAt(map,time) {
  const t=Math.max(0,Math.min(time,map.duration));
  const part=map.segments.find(p=>t>=p.refStart && t<p.refEnd) || map.segments.at(-1);
  return Math.max(0,part.sourceStart+(Math.min(t,part.refEnd)-part.refStart)*part.rate);
}

export function sceneOpacityAt(map,time) {
  if(!map.finalFade) return 1;
  const {start,end}=map.finalFade;
  return end>start ? 1-clamp((time-start)/(end-start)) : (time<start?1:0);
}

export function backlightAt(map, referenceTime, sourceTime) {
  const fade = map.backlightFade;
  return fade ? ease((referenceTime - fade.start) / (fade.end - fade.start)) : ease((sourceTime - 11.5) / 1.1);
}

/** Only the player's four answers provide characters; never insert sample copy. */
export function playerGlyphs(values,count=680) {
  const segment=typeof Intl?.Segmenter==='function' ? new Intl.Segmenter('zh-CN',{granularity:'grapheme'}) : null;
  const lists=['story','relationships','responsibility','consequence'].map(key=>{
    const value=String(values?.[key]||'');
    const chars=[];
    for(const item of segment ? segment.segment(value) : value) {
      const char=segment ? item.segment : item;
      if(!/^\s+$/u.test(char))chars.push(char);
      if(chars.length>=count)break;
    }
    return chars;
  }).filter(list=>list.length);
  if(!lists.length) return [];
  return Array.from({length:count},(_,i)=>{
    const list=lists[i%lists.length];
    return list[Math.floor(i/lists.length)%list.length];
  });
}

export function bezier(a,b,c,d,u) {
  const v=1-u;
  return [v*v*v*a[0]+3*v*v*u*b[0]+3*v*u*u*c[0]+u*u*u*d[0],v*v*v*a[1]+3*v*v*u*b[1]+3*v*u*u*c[1]+u*u*u*d[1]];
}

export function freePosition(p,time) {
  const u=clamp((time-p.birth)/(p.gather-p.birth));
  let [x,y]=bezier(p.source,p.c1,p.c2,p.anchor,u);
  const elapsed=Math.max(0,time-p.birth),amount=ease(elapsed/1.2);
  x+=p.sway_x*amount*(Math.sin(elapsed*p.frequency_x+p.phase_x)-Math.sin(p.phase_x));
  y+=p.sway_y*amount*(Math.sin(elapsed*p.frequency_y+p.phase_y)-Math.sin(p.phase_y));
  return [x,y];
}

export function particleState(p,time) {
  if(time<p.birth) return null;
  const enter=ease((time-p.birth)/.75);
  let x,y,u=0;
  if(time<p.gather) [x,y]=freePosition(p,time);
  else {
    const progress=clamp((time-p.gather)/(p.landing-p.gather));
    u=progress+progress*progress-progress*progress*progress;
    const start=freePosition(p,p.gather),before=freePosition(p,p.gather-.02),duration=p.landing-p.gather;
    const c1=[start[0]+(start[0]-before[0])/.02*duration/3,start[1]+(start[1]-before[1])/.02*duration/3];
    [x,y]=bezier(start,c1,[p.target[0]+p.approach[0],p.target[1]+p.approach[1]],p.target,u);
  }
  const size=Math.round(lerp(p.size,7,u));
  const tilt=(p.tilt+p.turn*Math.sin((time-p.birth)*.8+p.phase_x))*(1-u);
  const fade=1-ease((time-9.35)/.95)*.98;
  return {x,y,size,tilt:Math.round(tilt/2)*2,alpha:p.opacity*enter*fade};
}
