import { CARDS, CARD_MAP, TASKS, QUESTION_MAP } from './data.js';

export const STORAGE_KEY = 'jinding-investigation-cards-v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));
const evidenceRules = new Map(Object.values(QUESTION_MAP).map(question => [
  question.id,
  {
    allowed: new Set(question.allowedSets.flat()),
    maximum: Math.max(...question.allowedSets.map(group => group.length)),
  },
]));

export function createState() { return { version:1,links:{},values:{},positions:{} }; }

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 1e12 ? value : null;
  if (typeof value !== 'string') return null;
  const raw=value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const n=Number(raw.replaceAll(',',''));
  return Number.isFinite(n) && n <= 1e12 ? n : null;
}

export function createNotebookEvaluator(state) {
  const memo=new Map(), visiting=new Set();
  const available = id => {
    const card=CARD_MAP[id];
    return Boolean(card && (!card.unlockQuestions || card.unlockQuestions.every(qId=>evaluate(qId).correct)));
  };
  const evaluate = qId => {
    if (memo.has(qId)) return memo.get(qId);
    const question=QUESTION_MAP[qId],linked=state.links?.[qId]||[];
    if (!question || visiting.has(qId)) return { correct:false,linksCorrect:false,inputCorrect:false,missing:'unavailable',linked:[...linked] };
    visiting.add(qId);
    const { allowed, maximum } = evidenceRules.get(qId);
    const linksCorrect = linked.length > 0 && linked.length <= maximum
      && new Set(linked).size === linked.length
      && linked.every(id => allowed.has(id) && available(id));
    const value=state.values?.[qId];
    const inputCorrect=question.type==='boolean'?typeof value==='boolean' && value===question.expected
      :question.type==='number'?question.fields.every(field=>numeric(value?.[field.id])===field.expected):true;
    const missing=linksCorrect?(inputCorrect?'':'input'):'links';
    const result={correct:linksCorrect&&inputCorrect,linksCorrect,inputCorrect,missing,linked:[...linked]};
    visiting.delete(qId);memo.set(qId,result);return result;
  };
  return { evaluate,available };
}

export function evaluateQuestion(state,qId) { return createNotebookEvaluator(state).evaluate(qId); }
export function isCardAvailable(state,id) { return createNotebookEvaluator(state).available(id); }
export function availableCards(state) { const check=createNotebookEvaluator(state);return CARDS.filter(card=>check.available(card.id)); }
export function evaluateTask(state,taskId) {
  const task=TASKS.find(item=>item.id===taskId);
  if (!task) return {correct:false,completed:0,total:0,questions:[]};
  const check=createNotebookEvaluator(state),questions=task.questions.map(q=>({id:q.id,...check.evaluate(q.id)}));
  const completed=questions.filter(q=>q.correct).length;
  return {correct:completed===questions.length,completed,total:questions.length,questions};
}

export function connect(state,qId,cardId) {
  if (!QUESTION_MAP[qId] || !CARD_MAP[cardId] || cardId===QUESTION_MAP[qId].taskId || !isCardAvailable(state,cardId)) return state;
  const current=state.links[qId]||[];
  if (current.includes(cardId)) return state;
  return {...state,links:{...state.links,[qId]:[...current,cardId]}};
}
export function disconnect(state,qId,cardId) {
  if (!QUESTION_MAP[qId] || !(state.links[qId]||[]).includes(cardId)) return state;
  return {...state,links:{...state.links,[qId]:state.links[qId].filter(id=>id!==cardId)}};
}
export function clearLinks(state,qId) {
  if (!QUESTION_MAP[qId] || !state.links[qId]?.length) return state;
  return {...state,links:{...state.links,[qId]:[]}};
}
export function setValue(state,qId,value) {
  const q=QUESTION_MAP[qId];if (!q || q.type==='link') return state;
  if (q.type==='boolean' && value!==null && typeof value!=='boolean') return state;
  if (q.type==='number' && (!object(value) || Object.entries(value).some(([id,v])=>!q.fields.some(f=>f.id===id)||!['string','number'].includes(typeof v)||String(v).length>40||typeof v==='number'&&!Number.isFinite(v)))) return state;
  const next=q.type==='number'?{...(state.values[qId]||{}),...value}:value;
  if (JSON.stringify(state.values[qId])===JSON.stringify(next)) return state;
  return {...state,values:{...state.values,[qId]:next}};
}
export function setPosition(state,id,position) {
  if (!CARD_MAP[id] || !validPosition(position)) return state;
  return {...state,positions:{...state.positions,[id]:{x:position.x,y:position.y}}};
}
function validPosition(position) { return object(position)&&['x','y'].every(k=>Number.isFinite(position[k])&&Math.abs(position[k])<=1e9); }

export function validateState(state) {
  try {
    if (!object(state)||state.version!==1||!object(state.links)||!object(state.values)||!object(state.positions)) return false;
    if (Object.keys(state).some(key=>!['version','links','values','positions'].includes(key))) return false;
    for (const [id,links] of Object.entries(state.links)) if (!QUESTION_MAP[id]||!Array.isArray(links)||links.length>CARDS.length||new Set(links).size!==links.length||links.some(card=>!CARD_MAP[card]||card===QUESTION_MAP[id].taskId)) return false;
    for (const [id,value] of Object.entries(state.values)) {
      const q=QUESTION_MAP[id];if (!q||q.type==='link') return false;
      if (q.type==='boolean' && value!==null && typeof value!=='boolean') return false;
      if (q.type==='number' && (!object(value)||Object.entries(value).some(([key,v])=>!q.fields.some(f=>f.id===key)||!['string','number'].includes(typeof v)||String(v).length>40||typeof v==='number'&&!Number.isFinite(v)))) return false;
    }
    return Object.entries(state.positions).every(([id,pos])=>CARD_MAP[id]&&validPosition(pos));
  } catch { return false; }
}
export function serializeState(state) {
  if (!validateState(state)) throw new TypeError('卡片记录无效。');
  const raw=JSON.stringify(state);
  if (new TextEncoder().encode(raw).byteLength>1024*1024) throw new RangeError('卡片记录过大。');
  return raw;
}
export function restoreState(raw) {
  if (typeof raw!=='string'||raw.length>1024*1024) return null;
  try { if (new TextEncoder().encode(raw).byteLength>1024*1024) return null; const state=JSON.parse(raw);return validateState(state)?copy(state):null; } catch { return null; }
}
