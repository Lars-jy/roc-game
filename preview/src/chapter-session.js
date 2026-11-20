import { createCase, reduceCase } from './body/case.js';
import { serializeBody, restoreBody, CARD_STORAGE_KEY } from './body/save.js';
import { broadcastSceneState, isSceneActive } from './scene-navigation.js';
import { prepareFormalChapter } from './formal-chapter-bridge.js';
import { syncChapterMusic } from './music/install.js';

// The card-based chapter has its own save. Earlier body and design-preview
// saves are kept intact and never silently converted into answered card tasks.
export const CHAPTER_STORAGE_KEY=CARD_STORAGE_KEY;
let state,revision=0,lastRaw='',issue='';
const listeners=new Set();
const newSeed=()=>crypto.getRandomValues(new Uint32Array(2)).join('-');
// Sound is a side effect: an unavailable audio API must never block a save or a transaction.
function notifyMusic(events=[]){try{syncChapterMusic(state,events);}catch{}}
function emit(events=[]){notifyMusic(events);for(const listener of listeners)listener({state,events,error:null});}
function persist(){
  try{
    const raw=serializeBody({state,revision:revision+1});
    localStorage.setItem(CHAPTER_STORAGE_KEY,raw);lastRaw=raw;revision++;
    return true;
  }catch{issue='本次记录未能保存，请导出调查记录后再继续。';return false;}
}
function deliverSavedEvidence(){
  if(!(state.investigation?.earned > state.investigation?.spent))return;
  const result=reduceCase(state,{type:'deliverEvidence'});
  if(!result.error&&result.state!==state){state=result.state;persist();}
}
function initialize(){
  try{
    const raw=localStorage.getItem(CHAPTER_STORAGE_KEY);
    if(raw){
      const saved=restoreBody(raw);
      if(saved?.state.flow==='cards'){state=saved.state;revision=saved.revision;lastRaw=raw;deliverSavedEvidence();return;}
      issue='当前记录无法读取，原始存档已保留。';lastRaw=raw;
    }
  }catch{issue='浏览器未能读取游戏存档。';}
  state=createCase(newSeed(),{flow:'cards',progression:'connections'});
  if(!issue)persist();
}
initialize();
if(isSceneActive())notifyMusic();
export function getState(){return state;}
export function getSaveIssue(){return issue;}
export function refresh(){
  try{
    const raw=localStorage.getItem(CHAPTER_STORAGE_KEY);
    if(!raw||raw===lastRaw)return state;
    const saved=restoreBody(raw);
    if(saved?.state.flow!=='cards'){issue='另一窗口的记录无法读取，当前进度仍保留。';return state;}
    state=saved.state;revision=saved.revision;lastRaw=raw;issue='';deliverSavedEvidence();emit();
  }catch{issue='浏览器未能同步游戏存档。';}
  return state;
}
export function dispatch(action){
  refresh();
  if(issue)return {state,error:issue,events:[]};
  const result=reduceCase(state,action,{autoDeliverEvidence:true});
  if(result.error)return result;
  if(result.state!==state){
    state=result.state;persist();emit(result.events);
    broadcastSceneState({kind:'chapter-update',revision});
  }
  return {...result,error:issue||null};
}
export function subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export function beginChapter(payload){
  refresh();
  if(issue && !payload?.startFresh)return {state,error:issue,events:[]};
  const result=prepareFormalChapter(state,payload);
  if(result.error)return result;
  if(result.fresh){
    try{const raw=localStorage.getItem(CHAPTER_STORAGE_KEY);if(raw)localStorage.setItem(CHAPTER_STORAGE_KEY+':previous',raw);}catch{}
    revision=0;
  }
  state=result.state;issue='';
  persist();emit(result.events);broadcastSceneState({kind:'chapter-start',revision});
  return {...result,error:issue||null};
}
export function newChapter(){
  try{const raw=localStorage.getItem(CHAPTER_STORAGE_KEY);if(raw)localStorage.setItem(CHAPTER_STORAGE_KEY+':previous',raw);}catch{}
  state=createCase(newSeed(),{flow:'cards',progression:'connections'});revision=0;issue='';
  persist();emit();broadcastSceneState({kind:'chapter-reset',revision});return state;
}
// Hidden persistent scenes refresh when prepare()/activate() runs. Actions still
// refresh synchronously before reduction, so a click never uses an old save.
window.addEventListener('storage',event=>{if(event.key===CHAPTER_STORAGE_KEY&&isSceneActive())refresh();});
window.addEventListener('scene:state-change',()=>{if(isSceneActive())refresh();});
window.addEventListener('scene:activate',()=>notifyMusic());
