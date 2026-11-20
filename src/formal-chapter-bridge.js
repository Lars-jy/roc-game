import { createCase, reduceCase } from './body/case.js';
import { normalizeChapterStart } from './chapter-main-bridge.js';

/** Carry witnessed documents/dialogue only; never invent an investment or cash. */
export function prepareFormalChapter(current,message) {
  const payload=normalizeChapterStart(message);
  if(!payload)return {state:current,error:'案件接续信息不正确。'};
  const fresh=payload.startFresh && current.seed!==payload.runId;
  if(!fresh && current.seed!==payload.runId)return {state:current,error:'当前调查存档与案件不一致，未改动资金。'};
  let state=fresh?createCase(payload.runId,{flow:'cards',progression:'connections'}):current;
  const actions=[...(payload.readDocs.includes('D03')?[{type:'readInvitation'}]:[]),...payload.readDocs.map(id=>({type:'read',id}))];
  if(payload.readDocs.includes('D03'))actions.push({type:'completeTopic',topicKey:'T01'});
  if(payload.visitedBranches.includes('zhou'))actions.push({type:'completeTopic',topicKey:'T02'},{type:'completeTopic',topicKey:'T03'});
  if(payload.visitedBranches.includes('lu'))actions.push({type:'completeTopic',topicKey:'T04'});
  const events=[];
  for(const action of actions) {
    const result=reduceCase(state,action);
    if(result.error)return {state:current,error:result.error};
    state=result.state;events.push(...result.events);
  }
  return {state,fresh,events,error:null};
}
