import { ENTRY_CUES } from './prologue-cues.js';
import { installGameMusic, musicCue } from './music/install.js';
installGameMusic();
const frame=document.querySelector('#story-frame');
const curtain=document.querySelector('#scene-transition');
const note=document.querySelector('#transition-note');
const retry=document.querySelector('#entry-retry');
const entry=document.querySelector('#entry-audio');
const integratedGame=/(?:^\?|&)game=1(?:&|$)/.test(location.search || '');
let phase='invitation';
let version=0, receptionReady=false, entryEnded=false, revealing=false, revealed=false, resume=false;
let timer=null, revealTimer=null;
let animationId=null, curtainAnimationId=null;
function trusted(event) { return event.origin===location.origin && event.source===frame.contentWindow; }
function post(type) { frame.contentWindow.postMessage({type},location.origin); }
function receptionSummary(data) {
  const readDocs=data?.readDocs, visitedBranches=data?.visitedBranches;
  if(!Array.isArray(readDocs) || readDocs.length>3 || new Set(readDocs).size!==readDocs.length || !readDocs.every(id=>['D01','D02','D03'].includes(id))) return null;
  if(!Array.isArray(visitedBranches) || visitedBranches.length>3 || new Set(visitedBranches).size!==visitedBranches.length || !visitedBranches.every(id=>['materials','lu','zhou'].includes(id))) return null;
  return {readDocs:[...readDocs],visitedBranches:[...visitedBranches]};
}
function black() {
  const run=version;
  curtain.hidden=false; curtain.style.transition=`opacity ${ENTRY_CUES.fadeOutMilliseconds}ms ease`;
  curtain.style.opacity='0';
  curtain.getBoundingClientRect();
  cancelAnimationFrame(curtainAnimationId);
  curtainAnimationId=requestAnimationFrame(()=>{if(run===version && phase==='entry-fade')curtain.style.opacity='1';});
}
function finishEntry() {
  if(document.hidden || phase!=='entry' || !entryEnded || !revealed || !receptionReady) return;
  phase='reception';curtain.hidden=true;retry.hidden=true;note.textContent='';
  musicCue('reception');
  cancelAnimationFrame(animationId);
  post('prologue:start-reception');frame.focus();
}
function revealRoom() {
  if(document.hidden || phase!=='entry' || revealing || !receptionReady || (entry.currentTime<ENTRY_CUES.doorStart && !entryEnded)) return;
  revealing=true;
  curtain.style.transition=`opacity ${ENTRY_CUES.revealDuration}s ease`;
  curtain.style.opacity='0';
  const run=version;
  revealTimer=setTimeout(()=>{if(run!==version)return;revealed=true;finishEntry();},ENTRY_CUES.revealDuration*1000);
}
async function playEntry() {
  if(phase!=='entry') return;
  if(document.hidden){resume=true;return;}
  const run=version;
  resume=false;
  retry.hidden=true;note.textContent='';
  try {
    await entry.play();
    if(run!==version || phase!=='entry' || document.hidden){
      if(run===version && phase==='entry' && document.hidden)resume=true;
      entry.pause();
    }
  }
  catch {if(run===version && phase==='entry'){retry.hidden=false;note.textContent='点击继续，播放脚步与开门声。';}}
}
function enterFromInvitation() {
  if(phase!=='invitation') return;
  phase='entry-fade';
  const run=++version;
  black();
  timer=setTimeout(()=>{
    if(run!==version)return;
    phase='entry';receptionReady=false;entryEnded=false;revealing=false;revealed=false;
    frame.title='序章：金鼎财富会客室';
    if(integratedGame) frame.src='./reception-demo.html?waitForEntry=1&game=1';
    else frame.src='./reception-demo.html?waitForEntry=1';
    entry.currentTime=0;entry.playbackRate=1;entry.defaultPlaybackRate=1;
    animationId=requestAnimationFrame(tick);
    void playEntry();
  },ENTRY_CUES.fadeOutMilliseconds);
}
window.addEventListener('message',event=>{
  if(!trusted(event)) return;
  const type=event.data?.type;
  if(type==='prologue:invitation-ready' && phase==='invitation' && integratedGame) post('prologue:start-invitation');
  else if(type==='prologue:invitation-complete') enterFromInvitation();
  else if(type==='prologue:reception-ready' && phase==='entry') {receptionReady=true;revealRoom();finishEntry();}
  else if(type==='prologue:reception-complete' && phase==='reception' && integratedGame && parent!==window) {
    const summary=receptionSummary(event.data);
    if(!summary) return;
    phase='complete';version++;resume=false;entry.pause();
    clearTimeout(timer);clearTimeout(revealTimer);cancelAnimationFrame(animationId);
    parent.postMessage({type:'chapter:prologue-complete',...summary},location.origin);
  }
});
retry.addEventListener('click',playEntry);
entry.addEventListener('ended',()=>{if(phase==='entry'){entryEnded=true;revealRoom();finishEntry();}});
entry.addEventListener('error',()=>{if(phase==='entry'){retry.hidden=false;note.textContent='进门声音暂未载入，请刷新页面后重试。';}});
function tick(){if(phase!=='entry')return;if(!document.hidden)revealRoom();if(phase==='entry')animationId=requestAnimationFrame(tick);}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){resume=phase==='entry' && !entryEnded && !entry.paused;entry.pause();}
  else {
    if(resume){resume=false;void playEntry();}
    revealRoom();finishEntry();
  }
});
addEventListener('pagehide',()=>{version++;phase='disposed';resume=false;entry.pause();clearTimeout(timer);clearTimeout(revealTimer);cancelAnimationFrame(animationId);cancelAnimationFrame(curtainAnimationId);});
// The parent and child modules may finish in either order on a warm cache.
function startReadyInvitation(){if(integratedGame && phase==='invitation')post('prologue:start-invitation');}
frame.addEventListener('load',startReadyInvitation);
if(frame.contentDocument?.readyState==='complete')startReadyInvitation();
