import { STORY } from './reception/story.js';

const DOCS = new Set(['D01','D02','D03']);
const BRANCHES = new Set(['materials','lu','zhou']);
const uniqueList = (value, legal) => Array.isArray(value) && value.length <= 16
  && new Set(value).size === value.length && value.every(id => typeof id === 'string' && legal.has(id));

export function normalizeChapterStart(value) {
  if (!value || value.type !== 'chapter:start-main' || typeof value.runId !== 'string'
    || !value.runId.length || value.runId.length > 160 || typeof value.startFresh !== 'boolean'
    || !uniqueList(value.readDocs,DOCS) || !uniqueList(value.visitedBranches,BRANCHES)) return null;
  return {runId:value.runId,startFresh:value.startFresh,readDocs:[...value.readDocs],visitedBranches:[...value.visitedBranches]};
}

/** Carry knowledge only. Reception never manufactures a financial transaction. */
export function mergeReceptionMeta(current, payload) {
  const meta=JSON.parse(JSON.stringify(current));
  for (const id of payload.readDocs) {
    if(!meta.available.includes(id))meta.available.push(id);
    if(!meta.read.includes(id))meta.read.push(id);
  }
  for(const branch of payload.visitedBranches){
    const id=`reception:${branch}`;
    if(meta.branches.some(item=>item.id===id))continue;
    const character=branch==='zhou'?'zhou':'lu';
    const lines=STORY[branch];
    meta.branches.push({id,character,prompt:lines.find(line=>line.speaker==='player')?.text||'查看认购资料',
      reply:lines.filter(line=>line.speaker===character).map(line=>line.text),grantDocs:[],actions:[],
      trail:branch==='materials'?'会客室：看过认购资料。':branch==='zhou'?'会客室：周岚说明本金尚未取回。':'会客室：陆衡说明收益与退出安排。'});
    meta.sent.push(id);meta.seen.push(id);
    for(const line of lines)meta.chat[character].push({self:line.speaker==='player',text:line.text});
  }
  meta.chapterRunId=payload.runId;
  return meta;
}

export function createMainChapterBridge({origin,getParent,begin,post}) {
  let activeRun=null;
  return {
    message(event){
      if(event.origin!==origin||event.source!==getParent())return false;
      const payload=normalizeChapterStart(event.data);if(!payload)return false;
      if(activeRun!==null){
        if(activeRun!==payload.runId)return false;
        post({type:'chapter:main-started',runId:activeRun},origin);return true;
      }
      if(begin(payload)===false)return false;
      activeRun=payload.runId;post({type:'chapter:main-started',runId:activeRun},origin);return true;
    },
  };
}
