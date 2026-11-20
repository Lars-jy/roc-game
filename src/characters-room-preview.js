import { PEOPLE, dialogueForTopic } from './characters-room-dialogues.js';
import { dialogueTurns } from './characters-dialogue-turns.js';
import { createPortraitHitTest } from './portrait-hit-test.js';
import { availableTopics, knownPeople } from './body/card-flow.js';
import { getState, dispatch, subscribe, refresh } from './chapter-session.js';
import { registerSceneLifecycle, markSceneReady, isSceneActive, navigateScene } from './scene-navigation.js';
const room=document.querySelector('#room'),sceneReturn=document.querySelector('#scene-return');
const entry=new URLSearchParams(location.search).get('from')==='questions'?'questions':'desk';
room.dataset.entry=entry;
sceneReturn.href=entry==='questions'?'./investigation-cards.html':'./board-receipt-preview.html';
sceneReturn.setAttribute('aria-label',entry==='questions'?'返回问答页面':'返回桌面');
const panel=document.querySelector('#conversation'),log=document.querySelector('#dialogue-log');
const current=document.querySelector('#current-line'),currentSpeaker=document.querySelector('#current-speaker');
const reply=document.querySelector('#player-reply'),topicList=document.querySelector('#topic-list');
const cards=[...document.querySelectorAll('.character')],backgroundLit=document.querySelector('.room-background-lit');
const rosterX={lu:18,zhou:40,lin:62,'customer-d':84};
const uiOwner=id=>id==='ding'?'customer-d':id,engineOwner=id=>id==='customer-d'?'ding':id;
const portraitSources=new Map(cards.map(card=>[card.dataset.character,card.querySelector('img').getAttribute('src')]));
const unknownPortrait='./assets/characters-dialogue-v1/unknown-hip-v1.png';
let state=getState(),seed=state.seed;
let selected=null,presented=null,active=null,lineIndex=-1,typingTimer=null,responseTimer=null,typing=false,visibleLine=null,lineFinished=null;
let glyphs=[],revealed=0,generation=0,panelMotion=null,panelMotionGeneration=0;
const portraitMotions=new Map(),partialRecords=new Map(),greeted=new Set(),standaloneRecords=[];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hitPortrait=createPortraitHitTest();
function topics(owner){return availableTopics(state,owner?engineOwner(owner):undefined).map(item=>({...item,character:uiOwner(item.character)}));}
function dialogue(item,{history=false}={}){return dialogueForTopic(item,{read:state.read,month:state.month,invitation:state.invitation,history});}
function personKnown(id){return knownPeople(state).map(uiOwner).includes(id);}
function hasNew(id){return personKnown(id)&&topics(id).some(item=>!item.completed);}
function moveConversationPanel(open,{immediate=false,onFinished}={}){
  const token=++panelMotionGeneration,style=panel.hidden?null:getComputedStyle(panel);
  const from={opacity:style?.opacity||'0',transform:style?.transform||'translateX(70px)'};
  panelMotion?.cancel();panelMotion=null;panel.hidden=false;panel.inert=!open;panel.classList.toggle('is-closing',!open);
  const finish=()=>{if(token!==panelMotionGeneration)return;panel.hidden=!open;panel.inert=!open;panelMotion?.cancel();panelMotion=null;panel.classList.remove('is-moving','is-closing');onFinished?.();};
  if(immediate||reducedMotion||typeof panel.animate!=='function'){finish();return;}
  panel.classList.add('is-moving');panelMotion=panel.animate([from,{opacity:open?'1':'0',transform:open?'translateX(0)':'translateX(70px)'}],{duration:open?560:420,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
  panelMotion.finished.then(finish,()=>{});
}
// FLIP changes layout once, then animates only composited transforms and opacity.
function setPortraitMode(mode,id,{immediate=false}={}){
  const before=new Map(cards.map(card=>[card,{rect:card.getBoundingClientRect(),opacity:getComputedStyle(card).opacity}]));
  for(const [card,motion] of portraitMotions){motion.cancel();card.style.removeProperty('transform-origin');card.classList.remove('is-moving');}
  portraitMotions.clear();room.dataset.mode=mode;
  for(const card of cards){card.classList.toggle('is-selected',mode==='talk'&&card.dataset.character===id);card.inert=mode==='talk'&&card.dataset.character!==id;}
  if(immediate||reducedMotion||typeof cards[0]?.animate!=='function')return;
  for(const card of cards){
    const first=before.get(card),last=card.getBoundingClientRect(),opacity=getComputedStyle(card).opacity,parent=card.offsetParent.getBoundingClientRect();
    const rawLeft=parent.left+card.offsetLeft,rawTop=parent.top+card.offsetTop,width=card.offsetWidth,height=card.offsetHeight;
    if(!width||!height)continue;
    const matrix=rect=>`matrix(${rect.width/width},0,0,${rect.height/height},${rect.left-rawLeft},${rect.top-rawTop})`;
    card.style.transformOrigin='0 0';card.classList.add('is-moving');
    const motion=card.animate([{transform:matrix(first.rect),opacity:first.opacity},{transform:matrix(last),opacity}],{duration:720,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
    portraitMotions.set(card,motion);
    motion.finished.then(()=>{if(portraitMotions.get(card)!==motion)return;portraitMotions.delete(card);motion.cancel();card.style.removeProperty('transform-origin');card.classList.remove('is-moving');},()=>{});
  }
}
function beamAt(x){return `radial-gradient(ellipse 11% 58% at ${x}% 48%,#000b 0%,#0008 35%,#0003 65%,transparent 92%)`;}
function refreshLights(){
  const positions=[];
  for(const card of cards){
    const id=card.dataset.character,known=personKnown(id),newTopic=hasNew(id);
    const introduced=room.dataset.mode==='talk'&&id===presented;
    card.disabled=!known;card.classList.toggle('is-unknown',!known);card.classList.toggle('has-new',newTopic);
    card.querySelector('.character-name').textContent=known||introduced?PEOPLE[id].name:'未知';card.setAttribute('aria-label',known?PEOPLE[id].name+(newTopic?'，有新话题':''):'身份未知');
    const source=known||introduced?portraitSources.get(id):unknownPortrait;
    for(const image of card.querySelectorAll('img')){
      if(image.getAttribute('src')!==source)image.src=source;
      image.alt=image.classList.contains('shadow-portrait')?(known||introduced?PEOPLE[id].name:'身份未知的剪影'):'';
    }
    let question=card.querySelector('.unknown-question');if(!question){question=document.createElement('span');question.className='unknown-question';question.textContent='?';question.setAttribute('aria-hidden','true');card.append(question);}
    question.hidden=known||introduced;const face=card.querySelector('.face-mark');if(face)face.hidden=!(known||introduced);
    if(room.dataset.mode==='roster'&&newTopic)positions.push(rosterX[id]);
  }
  if(room.dataset.mode==='talk'&&selected)positions.push(27);
  room.style.setProperty('--room-light-masks',positions.length?positions.map(beamAt).join(','):'linear-gradient(transparent,transparent)');backgroundLit.style.opacity=positions.length?'.4':'0';
}
function cancelTyping(){generation++;clearTimeout(typingTimer);clearTimeout(responseTimer);typingTimer=responseTimer=null;typing=false;lineFinished=null;}
function showLine(line,{onComplete}={}){
  const nextSpeaker=line.speaker;
  if(PEOPLE[nextSpeaker]&&nextSpeaker!==presented){presented=nextSpeaker;setPortraitMode('talk',presented);refreshLights();}
  cancelTyping();visibleLine=line;revealed=0;current.replaceChildren();currentSpeaker.textContent=line.speaker==='player'?'我':PEOPLE[line.speaker]?.name||'';
  renderHistory();
  current.parentElement.dataset.speaker=line.speaker==='player'?'player':'npc';
  glyphs=Array.from(line.text,char=>{const span=document.createElement('span');span.textContent=char;span.className='line-glyph';current.append(span);return span;});
  const token=generation;
  lineFinished=()=>{if(token!==generation||room.dataset.mode!=='talk'||!isSceneActive())return;typing=false;typingTimer=null;lineFinished=null;onComplete?.();};
  function step(){if(token!==generation||room.dataset.mode!=='talk'||!isSceneActive())return;const span=glyphs[revealed++];if(span)span.classList.add('is-visible');if(revealed<glyphs.length)typingTimer=setTimeout(step,/[，。？！；]/.test(span?.textContent||'')?140:34);else lineFinished?.();}
  if(reducedMotion){glyphs.forEach(el=>el.classList.add('is-visible'));revealed=glyphs.length;queueMicrotask(()=>{if(token===generation)lineFinished?.();});}else{typing=true;step();}
}
function revealLine(){clearTimeout(typingTimer);typingTimer=null;typing=false;glyphs.forEach(el=>el.classList.add('is-visible'));revealed=glyphs.length;lineFinished?.();}
function clearCurrent(){visibleLine=null;current.replaceChildren();currentSpeaker.textContent='';}
function appendPartial(){if(!active||lineIndex<0)return;let record=partialRecords.get(active.key);if(!record){record={owner:selected,lines:active.lines,seen:new Set()};partialRecords.set(active.key,record);}record.seen.add(lineIndex);}
function historyLines(owner){
  const result=[];if(greeted.has(owner))result.push({speaker:owner,text:PEOPLE[owner].greeting});
  const items=new Map(topics().map(item=>[item.key,item])),completedKeys=new Set(state.cardFlow.completedTopics);
  for(const key of completedKeys){const item=items.get(key);if(!item)continue;const all=dialogue(item,{history:true});if(item.character===owner)result.push(...all);else if(item.id==='T06'&&owner==='lin')result.push(...all.slice(4));else if(item.id==='T10'&&owner==='customer-d')result.push(...all.slice(-3));}
  for(const [key,record] of partialRecords){if(record.owner!==owner||completedKeys.has(key))continue;result.push(...[...record.seen].sort((a,b)=>a-b).map(index=>record.lines[index]));}
  for(const record of standaloneRecords)if(record.owner===owner)result.push(record.line);
  return result;
}
function renderHistory(){
  const history=historyLines(selected),last=history.at(-1);if(visibleLine&&last?.speaker===visibleLine.speaker&&last?.text===visibleLine.text)history.pop();
  const speakers=new Set(history.map(line=>line.speaker).filter(speaker=>speaker!=='player'));
  log.classList.toggle('has-multiple-speakers',speakers.size>1);
  const fragment=document.createDocumentFragment();
  for(const line of history){const entry=document.createElement('div');entry.className='dialogue-entry '+(line.speaker==='player'?'is-player':'is-npc');const name=document.createElement('span');name.className='speaker';name.textContent=line.speaker==='player'?'我':PEOPLE[line.speaker]?.name||'';const text=document.createElement('p');text.className='dialogue-text';text.textContent=line.text;entry.append(name,text);fragment.append(entry);}
  log.replaceChildren(fragment);log.scrollTop=log.scrollHeight;
}
function renderTopics(){
  topicList.replaceChildren();for(const item of topics(selected)){const first=dialogue(item)[0];const button=document.createElement('button');button.type='button';button.dataset.topic=item.key;button.textContent=first?.speaker==='player'?first.text:item.title;button.classList.toggle('has-new-topic',!item.completed);button.addEventListener('click',()=>startTopic(item.key));topicList.append(button);}
  if(selected==='lu'&&state.cardFlow.completedTopics.includes('T19'))renderInvitationRecord();
}
function renderInvitationRecord(){
  const invitation=state.invitation;if(!invitation.offered)return;
  const record=document.createElement('section');record.className='invitation-record';const heading=document.createElement('h3');heading.textContent=`${invitation.month+4}月${invitation.day||2}日 · 私人追加邀请`;const status=document.createElement('p');status.textContent={pending:'待决定',accepted:'已认购',declined:'已婉拒',expired:'已过期'}[invitation.status]||'';record.append(heading,status);
  if(invitation.month===state.month&&invitation.status==='pending'){
    const view=document.createElement('button');view.type='button';view.textContent='查看认购';view.addEventListener('click',()=>navigateScene('./board-receipt-preview.html?investment=private'));
    const decline=document.createElement('button');decline.type='button';decline.textContent='这次不追加';decline.addEventListener('click',()=>{const result=dispatch({type:'invitationDecline'});if(result.error){showLine({speaker:'player',text:result.error});return;}startStandaloneLines([{speaker:'player',text:'这次先不追加。'},{speaker:'lu',text:'行，那这笔不登记。'}]);});
    const later=document.createElement('button');later.type='button';later.textContent='稍后再说';later.addEventListener('click',()=>{clearCurrent();record.remove();});record.append(view,decline,later);
  }
  topicList.append(record);
}
function openPerson(id){
  state=refresh();if(!PEOPLE[id]||!personKnown(id)||room.dataset.mode==='talk')return;
  selected=id;presented=id;active=null;lineIndex=-1;reply.hidden=true;topicList.hidden=true;
  setPortraitMode('talk',id);document.querySelector('#speaker-name').textContent=PEOPLE[id].name;
  renderHistory();renderTopics();refreshLights();moveConversationPanel(true);
  showLine({speaker:id,text:PEOPLE[id].greeting},{onComplete(){greeted.add(id);renderHistory();topicList.hidden=false;}});
}
function startTopic(key){
  state=refresh();const item=topics(selected).find(topic=>topic.key===key);if(!item){renderTopics();return;}
  const resolved=dialogue(item);if(!resolved.length)return;
  cancelTyping();clearCurrent();active={...item,lines:resolved,turns:dialogueTurns(resolved),turn:0};
  lineIndex=-1;topicList.hidden=true;reply.hidden=true;sendTurn();
}
function startStandaloneLines(lines){
  cancelTyping();clearCurrent();active={key:null,lines,turns:dialogueTurns(lines),turn:0};
  lineIndex=-1;topicList.hidden=true;reply.hidden=true;sendTurn();
}
function sendTurn(){
  if(!active||room.dataset.mode!=='talk')return;
  const conversation=active,turn=conversation.turns[conversation.turn];if(!turn){finishTopic(conversation);return;}
  reply.hidden=true;clearCurrent();
  if(turn.prompt){lineIndex=turn.prompt.index;if(conversation.key)appendPartial();else standaloneRecords.push({owner:selected,line:turn.prompt.line});}
  renderHistory();playResponse(conversation,turn,0);
}
function playResponse(conversation,turn,index){
  if(active!==conversation||room.dataset.mode!=='talk')return;
  const response=turn.responses[index];
  if(!response){offerNextTurn(conversation);return;}
  lineIndex=response.index;
  showLine(response.line,{onComplete(){
    if(active!==conversation)return;
    if(conversation.key)appendPartial();else standaloneRecords.push({owner:selected,line:response.line});renderHistory();
    if(index+1<turn.responses.length){
      const token=generation;
      responseTimer=setTimeout(()=>{responseTimer=null;if(token===generation)playResponse(conversation,turn,index+1);},reducedMotion?0:480);
    }else offerNextTurn(conversation);
  }});
}
function offerNextTurn(conversation){
  if(active!==conversation)return;
  conversation.turn++;
  const next=conversation.turns[conversation.turn];
  if(!next){finishTopic(conversation);return;}
  if(!next.prompt){sendTurn();return;}
  reply.textContent=next.prompt.line.text;reply.hidden=false;
}
function finishTopic(conversation){
  if(active!==conversation)return;
  if(conversation.key){
    const expectedSeed=seed;state=refresh();if(seed!==expectedSeed||active!==conversation)return;
    const result=dispatch({type:'completeTopic',topicKey:conversation.key});
    if(result.error){active=null;reply.hidden=true;topicList.hidden=false;renderTopics();showLine({speaker:'player',text:result.error});return;}
    state=result.state;partialRecords.delete(conversation.key);
  }
  active=null;lineIndex=-1;reply.hidden=true;topicList.hidden=false;
  renderHistory();renderTopics();refreshLights();
}
function backToRoster({immediate=false,restoreFocus=true}={}){if(room.dataset.mode!=='talk'&&!immediate)return;cancelTyping();const previous=selected;selected=null;presented=null;active=null;lineIndex=-1;visibleLine=null;reply.hidden=true;setPortraitMode('roster',null,{immediate});refreshLights();moveConversationPanel(false,{immediate,onFinished:()=>{topicList.hidden=false;clearCurrent();if(restoreFocus)cards.find(card=>card.dataset.character===previous)?.focus({preventScroll:true});}});}
function syncFormalState(){state=getState();if(seed!==state.seed){seed=state.seed;partialRecords.clear();greeted.clear();standaloneRecords.length=0;backToRoster({immediate:true,restoreFocus:false});}if(selected&&!personKnown(selected))backToRoster({immediate:true,restoreFocus:false});refreshLights();if(selected&&!active){renderHistory();renderTopics();}}
function deactivate(){cancelTyping();backToRoster({immediate:true,restoreFocus:false});}
for(const card of cards)card.addEventListener('click',event=>{
  if(room.dataset.mode!=='roster')return;
  // Opening moves the portrait. Do not test this same press against its new position.
  event.stopPropagation();
  openPerson(card.dataset.character);
});
reply.addEventListener('click',sendTurn);
current.addEventListener('click',()=>{if(typing)revealLine();});
room.addEventListener('click',event=>{
  if(room.dataset.mode!=='talk'||event.target.closest('.talk-panel,.scene-return'))return;
  if(event.clientX>=panel.getBoundingClientRect().left)return;
  const portrait=cards.find(card=>card.classList.contains('is-selected'));
  if(portrait){
    const label=portrait.querySelector('.character-name')?.getBoundingClientRect();
    if(label&&event.clientX>=label.left&&event.clientX<=label.right&&event.clientY>=label.top&&event.clientY<=label.bottom)return;
    const hit=hitPortrait(portrait.querySelector('.shadow-portrait'),{x:event.clientX,y:event.clientY});
    if(hit===true)return;
    // If a mask cannot be read, retain the old safe behavior over the portrait.
    if(hit===null){const bounds=portrait.getBoundingClientRect();if(event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom)return;}
  }
  backToRoster();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')backToRoster();});
window.addEventListener('pagehide',deactivate);window.addEventListener('pageshow',event=>{if(event.persisted){deactivate();refresh();syncFormalState();}});
const portraitPreloads=[...new Set([...portraitSources.values(),unknownPortrait])].map(source=>{const image=new Image();image.src=source;return image;});
const portraitsReady=Promise.all(portraitPreloads.map(image=>image.decode()));
subscribe(syncFormalState);registerSceneLifecycle({ready:portraitsReady,activate(){refresh();syncFormalState();},deactivate,refresh(){refresh();syncFormalState();}});syncFormalState();
