import { pickableMonthlyTiles, KINDS, BOARD_WIDTH, BOARD_HEIGHT } from './body/tiles.js';
import { MONTHS, completion, monthlyBusinessOptions, canResumeInvestigation } from './body/case.js';
import { availableTopics } from './body/card-flow.js';
import { publicFinance } from './body/finance.js';
import { getDoc, DOC_HINTS } from './body/content.js';
import { tileIcon } from './body/tile-art.js';
import { icon } from './icons.js';
import { DOCUMENTS, renderDocument } from './materials.js';
import { playBoardDeal } from './board-deal-motion.js';
import { createBoardPickMotion } from './board-pick-motion.js';
import { createSubscriptionPaper } from './subscription-paper.js';
import { createMonthlyContracts } from './monthly-contracts.js';
import { fundsStatement } from './funds-statement.js';
import { navigateScene, registerSceneLifecycle, markSceneReady, isSceneActive } from './scene-navigation.js';
import { getState, dispatch, subscribe, refresh, getSaveIssue, newChapter, beginChapter } from './chapter-session.js';
import { createMainChapterBridge } from './chapter-main-bridge.js';

const $=selector=>document.querySelector(selector);
const names=new Map(KINDS.map(kind=>[kind.id,kind.label]));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>(value/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const visualBoardWidth=BOARD_WIDTH-1.5,paperAngles=[-2,1.5,-1,2.5,-.5,2];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapterMode=new URLSearchParams(location.search).get('game')==='1' && parent!==window;
let chapterInitialized=!chapterMode,chapterReadyTimer;
const pickMotion=createBoardPickMotion({host:document.body,reducedMotion});
const audio={place:new Audio('./assets/reception/audio/place-paper.m4a'),open:new Audio('./assets/reception/audio/paper-flip.m4a')};
audio.place.volume=.45;audio.open.volume=.5;
let current=getState(),lastBoard=null,lastBoardContext='',lastMonth=current.month,lastSeed=current.seed;
let dealController=null,dealGeneration=0,isDealing=false,pendingDeal=null;
let deliveryRunning=false,deliveryTimer=null,toastTimer=null,feedbackTimer=null;
let deliveryQueue=[],deliveryIDs=new Set(),lastReceiptKey=null;
let lastTalkKey=null;
const tileNodes=new Map();let lastGeometry='';
const subscription=createSubscriptionPaper({getState:()=>current,sound:()=>sound('open'),notify:toast,confirm:({mode,amount,context})=>{
  current=refresh();if(current.seed!==context.seed||current.month!==context.month){toast('认购日期已变化，请重新打开文件。');return {error:'stale'};}
  if(mode==='private')return perform({type:amount?'invitationAccept':'invitationDecline',...(amount?{amount}:{})});
  return perform({type:'monthlyPurchase',amount,id:`paper:${current.seed}:${current.month}`,expectedMonth:context.month,expectedDay:1});
}});
const monthlyContracts=createMonthlyContracts({getState:()=>current,subscription,getOptions:monthlyBusinessOptions,sound:()=>sound('open'),notify:toast,confirmExit:({amount,reason,context})=>{
  current=refresh();
  if(current.seed!==context.seed||current.month!==context.month){toast('业务日期已变化，请重新打开文件。');return {error:'stale'};}
  return perform({type:'monthlyExit',amount,reason,id:`monthly-exit:${current.seed}:${current.month}`,expectedMonth:context.month,expectedDay:1});
}});
const openedWindows=new Set();
const seenKey=()=>`jinding-card-deal:${current.seed}:${current.month}`;
const alreadySeen=()=>{try{return sessionStorage.getItem(seenKey())==='yes';}catch{return false;}};
function finishDeal(){
  pendingDeal=null;
  try{sessionStorage.setItem(seenKey(),'yes');}catch{}
}
function sound(name){if(!isSceneActive())return;const clip=audio[name];clip.currentTime=0;clip.play().catch(()=>{});}
function toast(text){clearTimeout(toastTimer);$('#chapter-toast').textContent=text;$('#chapter-toast').classList.add('visible');toastTimer=setTimeout(()=>$('#chapter-toast').classList.remove('visible'),3800);}
function feedback(text,moneyFx=false){clearTimeout(feedbackTimer);const el=$('#board-feedback');el.textContent=text;el.classList.toggle('money-float',moneyFx);feedbackTimer=setTimeout(()=>{el.textContent='';el.classList.remove('money-float');},moneyFx?1400:1200);}
function perform(action){if(!chapterInitialized)return {state:current,error:'正在接续案件。',events:[]};const result=dispatch(action);if(result.error)toast(result.error);return result;}
function kind(id){return current.board.tiles.find(tile=>tile.id===id)?.kind;}
function renderBoard(){
  const board=current.board,active=current.window==='investigation'&&!current.complete;
  const geometry=`${current.seed}:${current.month}:${current.attempt}`,geometryChanged=geometry!==lastGeometry;
  if(geometryChanged){pickMotion.cancel();$('#tile-field').replaceChildren();tileNodes.clear();lastGeometry=geometry;}
  const fragment=document.createDocumentFragment(), available=pickableMonthlyTiles(board);
  for(const tile of board.tiles){
    let button=tileNodes.get(tile.id);
    if(tile.removed){button?.remove();tileNodes.delete(tile.id);continue;}
    const selectable=available.has(tile.id),enabled=active&&selectable,blind=['left','right'].includes(tile.region)&&!selectable;
    if(!button){button=document.createElement('button');button.type='button';button.dataset.tile=tile.id;button.dataset.region=tile.region;button.style.setProperty('--tile-x',tile.x);button.style.setProperty('--tile-y',tile.y);button.style.zIndex=tile.z+10;tileNodes.set(tile.id,button);fragment.append(button);}
    const className=`playing-tile${enabled?'':' covered'}${blind?' blind':''}`;
    if(button.className!==className)button.className=className;
    if(button.disabled===enabled)button.disabled=!enabled;
    const face=blind?'back':tile.kind;
    if(button.dataset.face!==face){button.dataset.face=face;button.setAttribute('aria-label',blind?'暗牌':names.get(tile.kind));button.innerHTML=blind?'<span class="card-face card-back">鼎</span>':`<span class="card-face">${tileIcon(tile.kind)}<small>${names.get(tile.kind)}</small></span>`;}
  }
  const addedNodes=fragment.childNodes.length>0;if(addedNodes)$('#tile-field').append(fragment);
  $('#tray').innerHTML=Array.from({length:7},(_,i)=>`<div class="rack-slot${board.tray[i]?' filled':''}" role="img" aria-label="第${i+1}格：${board.tray[i]?names.get(kind(board.tray[i])):'空'}">${board.tray[i]?tileIcon(kind(board.tray[i])):''}</div>`).join('');
  $('#tray').classList.toggle('is-full',board.status==='failed');
  $('#reserve').innerHTML=board.reserve.map(id=>`<button class="reserve-card" data-reserve="${id}" aria-label="取回${names.get(kind(id))}" ${active&&board.status==='playing'?'':'disabled'}>${tileIcon(kind(id))}</button>`).join('');
  document.querySelectorAll('[data-tool]').forEach(button=>{const tool=button.dataset.tool;button.querySelector('small').textContent=board.tools[tool];button.disabled=!active||board.status!=='playing'||!board.tools[tool]||(tool==='remove'&&(!board.tray.length||board.reserve.length>0))||(tool==='undo'&&!board.lastPick);});
  $('#restart-round').disabled=!active;$('#resume-investigation').hidden=!canResumeInvestigation(current);$('#resume-investigation').disabled=!active;$('#fast-clear-round').disabled=!active||board.status==='cleared';if(geometryChanged||addedNodes)fitBoard();
}
function fitBoard(){
  const field=$('#tile-field'),space=$('.board-space');
  const unit=Math.max(20,Math.min((space.clientWidth-24)/visualBoardWidth,(space.clientHeight-46)/BOARD_HEIGHT)),size=unit-3;
  $('.board-room').style.setProperty('--tile-unit',size+'px');field.style.width=unit*visualBoardWidth+'px';field.style.height=unit*BOARD_HEIGHT+'px';
  field.querySelectorAll('[data-tile]').forEach(button=>{const shift=button.dataset.region==='left' ? .48 : button.dataset.region==='right' ? -.48 : 0;button.style.left=(Number(button.style.getPropertyValue('--tile-x'))+shift-.73)*unit+'px';button.style.top=Number(button.style.getPropertyValue('--tile-y'))*unit+'px';button.style.width=button.style.height=size+'px';});
  const mainBottom=Math.max(...current.board.tiles.filter(tile=>tile.region==='center').map(tile=>tile.y*unit+size));
  const trayTop=$('#tray').getBoundingClientRect().top-field.getBoundingClientRect().top;
  const bufferTop=Math.max(mainBottom+5,(mainBottom+trayTop-size)/2-size*.1);
  field.querySelectorAll('[data-region="buffer"]').forEach(button=>button.style.top=bufferTop+'px');
}
function setDealControls(dealing){
  // Quick clear is a deliberate shortcut: never put its whole toolbar inside
  // an inert ancestor. The ordinary move controls remain locked during a deal.
  $('.tile-dock').inert=false;
  document.querySelectorAll('.tool,.reserve-bar,#tray,#restart-round,#resume-investigation').forEach(element=>{element.inert=dealing;});
}
function cancelDeal(){dealGeneration++;dealController?.abort();dealController=null;isDealing=false;$('.board-room').classList.remove('is-dealing');setDealControls(false);}
async function deal(mode){
  if(!isSceneActive()||current.window!=='investigation'||current.board.status!=='playing')return;
  pickMotion.cancel();
  cancelDeal();const generation=dealGeneration,controller=new AbortController();dealController=controller;isDealing=true;
  $('.board-room').classList.add('is-dealing');setDealControls(true);
  try{
    const result=await playBoardDeal($('#tile-field'),{mode,signal:controller.signal});
    if(generation===dealGeneration&&(result.completed||result.reason==='resized'))finishDeal();
  }
  finally{if(generation===dealGeneration){dealController=null;isDealing=false;$('.board-room').classList.remove('is-dealing');setDealControls(false);}}
}
function receiptEntries(){
  const entries=[];
  MONTHS.slice(0,current.month+1).forEach(month=>month.docs.forEach(id=>{if(current.available.includes(id))entries.push({id,uid:`doc:${id}`,read:current.read.includes(id),doc:getDoc(current,id)});}));
  for(const crisis of current.crises.history)entries.push({id:'D12B',crisisId:crisis.id,uid:`crisis:${crisis.id}`,read:current.cardFlow.readCrises.includes(crisis.id),doc:getDoc(current,'D12B')});
  return entries;
}
function renderReceipts(){
  const all=receiptEntries();
  const entries=all.filter(item=>!deliveryIDs.has(item.uid)).sort((a,b)=>Number(b.read)-Number(a.read));
  const count=all.filter(item=>!item.read).length;
  const key=JSON.stringify([count,entries.map(item=>[item.uid,item.read])]);
  if(key===lastReceiptKey)return;
  lastReceiptKey=key;
  $('#receipt-stack').replaceChildren(...entries.map((item,index)=>{
    const button=document.createElement('button');button.type='button';button.className='received-paper'+(item.read?' is-read':'');
    button.style.setProperty('--paper-index',index);button.style.setProperty('--paper-angle',paperAngles[index%paperAngles.length]+'deg');button.style.zIndex=30+index;button.dataset.receipt=item.uid;
    button.setAttribute('aria-label',`${item.read?'查阅':'待取'}${item.doc.title}`);
    button.innerHTML=`<span class="paper-masthead">金鼎财富</span><span class="paper-lines"></span><span class="paper-status">${item.read?'已查阅':'待取件'}</span>`;return button;
  }));
  $('#mail-count').textContent=`待取件 ${count}`;
}
function renderTalkCount(){
  const { readCrises, completedTopics, notebook }=current.cardFlow;
  const key=JSON.stringify([current.seed,current.month,current.read,current.invitation.offered,readCrises,completedTopics,notebook.links,notebook.values]);
  if(key===lastTalkKey)return;
  lastTalkKey=key;
  const count=availableTopics(current).filter(topic=>!topic.completed).length;
  const label=$('#talk-count');
  if(label.textContent!==`待谈话 ${count}`)label.textContent=`待谈话 ${count}`;
  label.parentElement.classList.toggle('has-pending',count>0);
}
function enqueueDelivery(id){const uid=`doc:${id}`;if(deliveryIDs.has(uid))return;deliveryIDs.add(uid);deliveryQueue.push(uid);deliverNext();}
function deliverNext(){
  if(deliveryRunning||!deliveryQueue.length||!isSceneActive())return;
  deliveryRunning=true;const uid=deliveryQueue[0],window=$('.receipt-window'),sheet=$('.delivering-sheet'),index=receiptEntries().filter(item=>!deliveryIDs.has(item.uid)).length;
  sheet.style.setProperty('--paper-index',index);sheet.style.setProperty('--paper-angle',paperAngles[index%paperAngles.length]+'deg');
  window.classList.remove('is-delivering');void sheet.offsetWidth;window.classList.add('is-delivering');
  deliveryTimer=setTimeout(()=>{deliveryQueue.shift();deliveryIDs.delete(uid);window.classList.remove('is-delivering');deliveryRunning=false;renderReceipts();sound('place');deliveryTimer=setTimeout(deliverNext,reducedMotion?20:220);},reducedMotion?10:2000);
}
function pauseDelivery(){clearTimeout(deliveryTimer);deliveryRunning=false;$('.receipt-window').classList.remove('is-delivering');Object.values(audio).forEach(clip=>clip.pause());}
function openDocument(id,crisisId){
  if(!current.available.includes(id))return;
  if(perform({type:'read',id,...(crisisId?{crisisId}:{})}).error)return;
  if(id==='D12B')for(const notice of current.crises.history)if(!current.cardFlow.readCrises.includes(notice.id))perform({type:'read',id,crisisId:notice.id});
  const doc=getDoc(current,id);if(!doc)return;
  showPaper(doc,id);
}
function showPaper(doc,id){
  const isFunds=id==='FUNDS';
  $('#reader-title').textContent=doc.title;$('#document-hint-text').hidden=true;$('#document-hint-text').textContent=DOC_HINTS[id]||'';
  $('#document-hint').hidden=isFunds;$('#ledger-reset').hidden=!isFunds;
  const frame=$('#reader-frame'),staticDoc=DOCUMENTS.find(item=>item.id===id),original=Boolean(staticDoc&&/^D/.test(id)&&id!=='D12B');frame.removeAttribute('srcdoc');frame.classList.toggle('is-original-document',original);
  if(original)frame.src=staticDoc.pdfHref+'#toolbar=0&view=FitH';
  else{frame.removeAttribute('src');frame.srcdoc=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="./src/style.css"><style>body{margin:0;padding:20px}.document-paper{width:max(100%,720px);box-sizing:border-box;padding:42px;min-height:100vh;font-family:SimSun,serif}.document-paper>header{display:block;background:none;padding:0 0 24px}.document-table{border-collapse:collapse;width:100%}th,td{border:1px solid #555;padding:8px;font-size:14px}.document-section p{white-space:pre-wrap}h1{font-size:26px}h2{font-size:19px}.document-meta{font-size:13px}.document-meta div{display:flex;gap:12px}dd{margin:0}</style><link rel="stylesheet" href="./src/paper-theme.css"></head><body class="archive-document-view">${renderDocument(doc)}</body></html>`;}
  sound('open');if(!$('#paper-reader').open)$('#paper-reader').showModal();
}
function readReceipt(uid){
  const item=receiptEntries().find(entry=>entry.uid===uid);
  if(item)openDocument(item.id,item.crisisId);
}
function renderFinance(){
  const f=publicFinance(current.finance);
  $('#cash-amount').textContent=`¥ ${money(f.cash)}`;$('#earnings-amount').textContent=`¥ ${money(f.totalInterest+f.earnedTile)}`;
  document.querySelectorAll('.month-timeline span').forEach((el,index)=>{el.classList.toggle('active',index===current.month);if(index===current.month)el.setAttribute('aria-current','date');else el.removeAttribute('aria-current');});
  $('.month-timeline').style.setProperty('--timeline-progress',current.month/3);
  document.querySelectorAll('.month-timeline span').forEach((el,index)=>el.classList.toggle('past',index<current.month));
  $('#month-action').textContent=current.complete?'查看调查记录':current.window==='invest'?'本月合同':current.month===3?'结局':'结束本月';
}
function render(){
  const context=[current.seed,current.month,current.attempt,current.window,current.complete,current.boardMode,canResumeInvestigation(current)].join('|');
  if(current.board!==lastBoard||context!==lastBoardContext){
    // Cross-window refresh can deserialize a second copy of the same active deal.
    const sameDeal=isDealing&&context===lastBoardContext&&JSON.stringify(current.board)===JSON.stringify(lastBoard);
    lastBoard=current.board;lastBoardContext=context;
    if(!sameDeal){cancelDeal();renderBoard();}
  }
  renderFinance();renderReceipts();renderTalkCount();
}
function openSubscription(mode='monthly'){
  current=refresh();
  const eligible=!current.complete&&(mode==='private'
    ? current.invitation.offered&&current.invitation.status==='pending'&&current.invitation.month===current.month
    : current.window==='invest');
  if(!eligible){toast(mode==='private'?'这次私人认购邀请已结束。':'本月认购已结束。');return;}
  $('#paper-reader').close();
  if(mode!=='private')openedWindows.add(current.month);
  if(mode==='private'){monthlyContracts.close();subscription.open(mode);}
  else monthlyContracts.open({preserveDraft:true});
}
function openFundsStatement(){
  current=refresh();monthlyContracts.close();subscription.close();
  showPaper(fundsStatement(current.finance),'FUNDS');
}
function showMonth(){
  if(current.window==='invest'){openSubscription();return;}
  const p=completion(current);
  $('#month-title').textContent=`${MONTHS[current.month].label} · ${MONTHS[current.month].title}`;
  $('#month-content').innerHTML=`<p class="month-note">本月新增连线：${p.connectionCount||0} 条。</p><ul class="month-targets"><li class="${p.monthReady?'done':''}">${p.monthReady?'◆ 本月已有新的调查连线':'◇ 去调查板添加一条新的连线'}</li></ul><div class="chapter-actions"><button data-month-action="questions">去调查板</button>${current.month<3?`<button class="primary" data-month-action="next" ${p.monthReady?'':'disabled'}>进入${MONTHS[current.month+1].label}</button>`:'<button class="primary" data-month-action="summary">填写调查总结</button>'}</div>`;$('#month-dialog').showModal();
}
function handleEvents(events){
  for(const e of events){
    if(e.type==='document-earned')enqueueDelivery(e.id);
    if(['interest-paid','board-reward','exit-approved'].includes(e.type)&&e.amount>0)feedback(`${e.type==='board-reward'?'清盘奖励':e.type==='exit-approved'?'退出到账':'收益到账'} +¥ ${money(e.amount)}`,true);
    if(e.type==='interest-unpaid'&&e.amount>0)toast(`本期收益 ¥ ${money(e.amount)} 暂未支付，已留存记录。`);
    if(e.type==='crisis')toast('收到一份新的付款通知。');
    if(e.type==='invitation')toast('陆衡有一份私人认购邀请。');
    if(e.type==='exit-refused')toast('本月退出申请未获批准，资金登记不变。');
    if(e.type==='board-restarted')pendingDeal='restart';
    if(e.type==='board-failed')feedback('卡槽已满');
    if(e.type==='investigation-started'&&!alreadySeen())pendingDeal='new-month';
  }
}
subscribe(result=>{
  current=result.state;
  if(current.seed!==lastSeed||current.month!==lastMonth){monthlyContracts.close();subscription.close();pauseDelivery();deliveryQueue=[];deliveryIDs.clear();pendingDeal=null;lastSeed=current.seed;lastMonth=current.month;}
  handleEvents(result.events||[]);render();if(isSceneActive()&&pendingDeal)void deal(pendingDeal);
});
function pickWithMotion(button,action,id){
  if(isDealing)return;
  const snapshot=element=>{const r=element.getBoundingClientRect();return{html:element.outerHTML,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};};
  const source=snapshot(button),rack=[...$('#tray').children],target=rack[Math.min(current.board.tray.length,6)],destination=target?snapshot(target).rect:null;
  const selectedKind=kind(id),matched=current.board.tray.map((value,index)=>kind(value)===selectedKind?rack[index]:null).filter(Boolean).map(snapshot);
  const result=perform(action);
  if(!result.error)pickMotion.play({source,destination,matched:matched.length===2?matched:[]});
}
$('#tile-field').addEventListener('click',event=>{const b=event.target.closest('[data-tile]');if(b)pickWithMotion(b,{type:'pick',id:b.dataset.tile},b.dataset.tile);});
$('#reserve').addEventListener('click',event=>{const b=event.target.closest('[data-reserve]');if(b)pickWithMotion(b,{type:'reserve',id:b.dataset.reserve},b.dataset.reserve);});
document.querySelectorAll('[data-tool]').forEach(button=>{button.querySelector('.tool-icon').innerHTML=icon({remove:'folder',undo:'undo',shuffle:'shuffle'}[button.dataset.tool]);button.addEventListener('click',()=>{if(isDealing)return;const result=perform({type:'tool',tool:button.dataset.tool});if(!result.error&&button.dataset.tool==='shuffle')void deal('shuffle');});});
function restart(){if(!isDealing)perform({type:'retry'});}
$('#restart-round').addEventListener('click',restart);
$('#resume-investigation').addEventListener('click',()=>{if(!isDealing)perform({type:'resumeInvestigation'});});
function fastClear(){
  pickMotion.cancel();cancelDeal();pendingDeal=null;
  const result=perform({type:'fastClear'});
  if(!result.error&&result.state.board.status==='cleared'&&!result.events.some(event=>event.type==='board-reward'))feedback(result.state.boardMode==='cash'?'本局清盘奖励已结算':'本月调查清盘奖已领取');
}
$('#fast-clear-round').addEventListener('click',fastClear);
$('#receipt-stack').addEventListener('click',event=>{const b=event.target.closest('[data-receipt]');if(b)readReceipt(b.dataset.receipt);});
$('#close-reader').addEventListener('click',()=>$('#paper-reader').close());$('#document-hint').addEventListener('click',()=>{$('#document-hint-text').hidden=!$('#document-hint-text').hidden;});
$('#open-questions').addEventListener('click',()=>navigateScene('./investigation-cards.html'));$('#open-account').addEventListener('click',openFundsStatement);$('#month-action').addEventListener('click',showMonth);
document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.closeDialog).close()));

const tutorial = $('#tutorial-dialog');
const tutorialPages = [...tutorial.querySelectorAll('.tutorial-page')];
const tutorialPrevious = $('#tutorial-previous'), tutorialNext = $('#tutorial-next');
let tutorialPage = 0;
function showTutorialPage(page) {
  if (page < 0 || page >= tutorialPages.length) return;
  const focused = document.activeElement;
  tutorialPages[tutorialPage].hidden = true;
  tutorialPage = page;
  tutorialPages[page].hidden = false;
  tutorialPrevious.disabled = page === 0;
  tutorialNext.disabled = page === tutorialPages.length - 1;
  $('#tutorial-count').textContent = `${page + 1} / ${tutorialPages.length}`;
  if (focused === tutorialPrevious && tutorialPrevious.disabled) tutorialNext.focus();
  if (focused === tutorialNext && tutorialNext.disabled) tutorialPrevious.focus();
}
$('#open-tutorial').addEventListener('click', () => { showTutorialPage(0); tutorial.showModal(); });
tutorialPrevious.addEventListener('click', () => showTutorialPage(tutorialPage - 1));
tutorialNext.addEventListener('click', () => showTutorialPage(tutorialPage + 1));
tutorial.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  showTutorialPage(tutorialPage + (event.key === 'ArrowLeft' ? -1 : 1));
});

$('#ledger-reset').addEventListener('click',()=>{
  $('#paper-reader').close();$('#month-title').textContent='重新调查';$('#month-content').innerHTML='<p class="month-note">将从4月重新开始。当前记录会保留一份备份。</p><div class="chapter-actions"><button data-month-action="reset">确认重新调查</button></div>';$('#month-dialog').showModal();
});
$('#month-content').addEventListener('click',event=>{
  const action=event.target.closest('[data-month-action]')?.dataset.monthAction;if(!action)return;
  if(action==='reset'){$('#month-dialog').close();openedWindows.clear();const reset=newChapter();if(chapterMode)window.parent.postMessage({type:'chapter:case-reset',caseSeed:reset.seed},location.origin);openSubscription();return;}
  if(action==='next'){if(!perform({type:'nextMonth'}).error){$('#month-dialog').close();openSubscription();}return;}
  $('#month-dialog').close();navigateScene(action==='summary'?'./investigation-cards.html?summary=1':'./investigation-cards.html');
});
new ResizeObserver(fitBoard).observe($('.board-space'));
window.addEventListener('resize',()=>{
  pickMotion.cancel();
  if(isDealing){finishDeal();cancelDeal();}
});
function activateDesk(ctx={}){
    if(!chapterInitialized)return;
    current=refresh();render();deliverNext();
    const privateRequest=new URL(ctx.url||location.href,location.href).searchParams.get('investment')==='private';
    if(privateRequest&&!current.complete&&current.invitation.offered&&current.invitation.status==='pending'&&current.invitation.month===current.month){openSubscription('private');return;}
    if(current.window==='invest'&&!openedWindows.has(current.month))openSubscription();
    else if(current.window==='investigation'&&current.board.status==='playing'&&(pendingDeal||!alreadySeen()))void deal(pendingDeal||'new-month');
    if(getSaveIssue())toast(getSaveIssue());
}
registerSceneLifecycle({
  refresh(){current=refresh();render();},
  activate:activateDesk,
  deactivate(){pickMotion.cancel();cancelDeal();pauseDelivery();monthlyContracts.close();subscription.close();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();},
});
window.addEventListener('pagehide',()=>{clearInterval(chapterReadyTimer);pickMotion.cancel();cancelDeal();pauseDelivery();clearTimeout(toastTimer);clearTimeout(feedbackTimer);});
window.addEventListener('scene:navigation-error',()=>toast('场景未能完整载入，请再试一次。'));
render();markSceneReady();
if(chapterMode){
  const bridge=createMainChapterBridge({origin:location.origin,getParent:()=>parent,
    begin(payload){
      const result=beginChapter({type:'chapter:start-main',...payload});if(result.error){toast(result.error);return false;}
      chapterInitialized=true;current=result.state;render();
      queueMicrotask(()=>{
        activateDesk({url:location.href});
        if(current.complete)navigateScene('./investigation-cards.html?summary=1');
      });
      return true;
    },post:(message,origin)=>{clearInterval(chapterReadyTimer);parent.postMessage(message,origin);}});
  window.addEventListener('message',event=>bridge.message(event));
  const ready=()=>parent.postMessage({type:'chapter:main-ready'},location.origin);
  ready();chapterReadyTimer=setInterval(ready,700);
  window.addEventListener('chapter:scene-ending',event=>{
    const data=event.detail;
    if(!chapterInitialized)return;
    // The desk sleeps while the question scene is active. Read the committed
    // report before relaying its ending, rather than using the hidden desk's cache.
    current=refresh();
    if(current.complete && data?.caseSeed===current.seed)parent.postMessage(data,location.origin);
  });
}
