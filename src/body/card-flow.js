import { CARD_MAP, TASKS, QUESTION_MAP } from '../investigation/data.js';
import {
  createState, validateState, connect, disconnect, clearLinks, setValue, setPosition,
  createNotebookEvaluator, evaluateQuestion, isCardAvailable,
} from '../investigation/model.js';
import { validateOpenResponse } from '../open-response.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const unique = value => new Set(value).size === value.length;
const has = (state, id) => state.read.includes(id);
const done = (state, id) => state.cardFlow.completedTopics.includes(id);
const readAny = (state, ids) => ids.some(id => has(state, id));
const readAll = (state, ids) => ids.every(id => has(state, id));
const INITIAL_TASKS = ['invitation', 'zhou', 'lu', 'project'];
const DYNAMIC_DOCS = ['P02', 'P03', 'C01', 'C02'];
const TOPIC_NOTES = { T01: 'zhou-income', T02: 'zhou-principal', T03: 'zhou-knowledge', T04: 'lu-pitch', T06: 'lin-role', T19: 'private-invitation' };
const NOTE_TOPICS = Object.fromEntries(Object.entries(TOPIC_NOTES).map(([topic, note]) => [note, topic]));

export const CARD_MONTH_TARGETS = Object.freeze([
  Object.freeze(['invitation-1', 'invitation-2', 'invitation-3', 'invitation-4', 'zhou-1', 'zhou-2', 'zhou-4', 'lu-1', 'lu-2', 'lu-3', 'project-1']),
  Object.freeze(['zhou-3', 'project-2', 'project-3', 'lin-1', 'lin-2', 'lin-3']),
  Object.freeze(['accounts-1', 'accounts-2', 'accounts-3', 'accounts-4', 'accounts-5']),
  Object.freeze(['payouts-1', 'payouts-2', 'payouts-3', 'crisis-1', 'crisis-2', 'crisis-3']),
]);
const MONTH_DOCS = [['D04'], ['D05', 'D09', 'D12A'], ['D06', 'D07', 'D08', 'D13'], ['D10', 'D11']];

export function createCardFlow({ progression = 'connections' } = {}) {
  if (!['submitted', 'connections'].includes(progression)) throw new TypeError('当前正式卡片规则采用自由连线推进。');
  return {
    version: 2, progression: 'connections', connectionBaseline: [], notebook: createState(), invitationRead: false,
    readCrises: [], completedTopics: [], topicSnapshots: {}, submittedQuestions: {},
    openResponse: { draft: {}, answer: null },
  };
}

export function knownPeople(state) {
  return ['lu', 'zhou', ...(done(state, 'T06') ? ['lin'] : []), ...(done(state, 'T10') ? ['ding'] : [])];
}

function taskVisible(state, id) {
  if (INITIAL_TASKS.includes(id)) return true;
  if (id === 'lin') return done(state, 'T06');
  if (id === 'accounts') return state.month >= 2 && readAny(state, ['D06', 'D07', 'D08', 'D13']);
  if (id === 'payouts') return state.month >= 3 && readAny(state, ['D10', 'D11']);
  if (id === 'crisis') return state.cardFlow.readCrises.length > 0;
  return false;
}

function sourceVisible(state, id) {
  const card = CARD_MAP[id];
  if (DYNAMIC_DOCS.includes(id)) return state.available.includes(id);
  if (!card) return false;
  if (card.type === 'task') return taskVisible(state, id);
  if (card.type === 'document') return state.available.includes(card.document || id);
  if (id === 'company') return true;
  if (id === 'C') return readAny(state, ['D06', 'D07']);
  if (id === 'M') return readAny(state, ['D06', 'D08', 'D13']);
  if (NOTE_TOPICS[id]) return done(state, NOTE_TOPICS[id]);
  return false;
}

/** Owning the main card is the only question gate. Evidence still has to be acquired. */
export function questionUnavailable(state, id) {
  const question = QUESTION_MAP[id];
  if (!state.cardFlow || !question) return '没有这项卡片问题。';
  if (!taskVisible(state, question.taskId)) return '尚未认识或读到对应的调查对象。';
  return '';
}
export function questionAvailable(state, id) { return questionUnavailable(state, id) === ''; }

function conclusionCouldExist(state, card) {
  return card.unlockQuestions?.every(id => questionAvailable(state, id));
}

function eligibleNotebook(state) {
  const { links, values } = state.cardFlow.notebook;
  const notebook = { links: {}, values: {} };
  for (const [id, cards] of Object.entries(links)) {
    if (!questionAvailable(state, id)) continue;
    notebook.links[id] = cards.filter(cardId => CARD_MAP[cardId]?.type === 'conclusion'
      ? conclusionCouldExist(state, CARD_MAP[cardId]) : sourceVisible(state, cardId));
  }
  for (const [id, value] of Object.entries(values)) if (questionAvailable(state, id)) notebook.values[id] = value;
  return notebook;
}

export function cardVisible(state, id) {
  if (!state?.cardFlow) return false;
  const card = CARD_MAP[id];
  if (card?.type === 'conclusion') return conclusionCouldExist(state, card) && isCardAvailable(eligibleNotebook(state), id);
  return sourceVisible(state, id);
}

export function cardQuestionResult(state, id) {
  return evaluateQuestion(eligibleNotebook(state), id);
}
const correct = (state, id) => questionAvailable(state, id) && cardQuestionResult(state, id).correct;
const allCorrect = (state, task) => TASKS.find(item => item.id === task).questions.every(question => correct(state, question.id));

const topicInfo = {
  T01: ['zhou', '到账经历'], T02: ['zhou', '本金情况'], T03: ['zhou', '对项目的了解'], T04: ['lu', '项目做什么交易'], T05: ['lu', '月报中的项目'],
  T06: ['lu', '找财务核对'], T07: ['lu', '月报和核验的差异'], T08: ['lin', '不同批次的支付安排'], T09: ['lin', '历史到期表怎样核对'],
  T10: ['zhou', '其他客户为何参与'], T11: ['ding', '客户丁的判断依据'], T12: ['lin', '两个账户的用途'], T13: ['lin', '内部划转如何核对'],
  T14: ['lin', '合同与流水范围'], T15: ['lin', '资产核对范围'], T16: ['lin', '到账与付款执行'], 'T16:zhou': ['zhou', '核对本人的到账经历'],
  T17: ['lu', '追问实际付款来源'], T18: ['lu', '本次延期通知'], T19: ['lu', '单独认购邀请'], T20: ['lu', '追加与退出的关系'], T21: ['lu', '对延期解释的追问'],
};

function topicConditions(state, key) {
  const lin = done(state, 'T06');
  switch (key) {
    case 'T01': case 'T02': case 'T03': case 'T04': return true;
    case 'T05': return has(state, 'D04') || correct(state, 'project-1');
    case 'T06': return state.month >= 1 && readAny(state, ['D05', 'D09', 'D12A']);
    case 'T07': return correct(state, 'project-3');
    case 'T08': return lin && readAll(state, ['D02', 'D09']);
    case 'T09': return lin && (has(state, 'D12A') || correct(state, 'lin-2'));
    case 'T10': return has(state, 'D09');
    case 'T11': return done(state, 'T10');
    case 'T12': return lin && has(state, 'D06');
    case 'T13': return lin && (readAll(state, ['D07', 'D08']) || correct(state, 'accounts-2'));
    case 'T14': return lin && correct(state, 'accounts-4');
    case 'T15': return lin && (has(state, 'D13') || correct(state, 'accounts-5'));
    case 'T16': return lin && state.month >= 3 && readAny(state, ['D10', 'D11']);
    case 'T16:zhou': return state.month >= 3 && correct(state, 'payouts-2');
    case 'T17': return allCorrect(state, 'project') && allCorrect(state, 'payouts');
    case 'T19': return state.invitation.offered;
    case 'T20': return correct(state, 'crisis-3');
    case 'T21': return correct(state, 'crisis-2');
    default: return false;
  }
}

function topicSnapshot(state, key) {
  if (key === 'T19') return {
    month: state.invitation.month, day: state.invitation.day || 2,
    offeredMonth: state.invitation.month, crisisAtOffer: Boolean(state.invitation.crisisAtOffer),
    statusAtView: state.invitation.status,
    viewedMonth: state.month, viewedDay: state.finance.day,
  };
  if (key.startsWith('T18:')) {
    const notice = state.crises.history.find(item => item.id === key.slice(4));
    return { month: notice.month, day: notice.day, viewedMonth: state.month, viewedDay: state.finance.day, noticeId: notice.id, noticeMonth: notice.month, noticeDay: notice.day, variant: notice.month === state.month ? 'current' : 'historical' };
  }
  return { month: state.month, day: state.finance.day,
    ...(key === 'T09' ? { variant: has(state, 'D12A') ? 'document' : 'method' } : {}),
    ...(key === 'T16' ? { variant: readAll(state, ['D10', 'D11']) ? 'both' : has(state, 'D10') ? 'instruction' : 'receipt' } : {}),
    ...(key === 'T15' ? { ownLedgerRead: has(state, 'C02') } : {}),
  };
}

export function availableTopics(state, owner) {
  if (!state?.cardFlow) return [];
  const keys = Object.keys(topicInfo).filter(key => key !== 'T18');
  keys.push(...state.cardFlow.readCrises.map(id => `T18:${id}`));
  return keys.filter(key => done(state, key) || topicConditions(state, key) || key.startsWith('T18:')).map(key => {
    const id = key.startsWith('T18:') ? 'T18' : key === 'T16:zhou' ? 'T16' : key;
    const [character, title] = topicInfo[key] || topicInfo[id];
    const snapshot = state.cardFlow.topicSnapshots[key] || topicSnapshot(state, key);
    return { id, key, topicKey: key, instanceId: key.startsWith('T18:') ? key.slice(4) : key === 'T16:zhou' ? 'zhou' : null, character, title, completed: done(state, key), month: snapshot.month, snapshot };
  }).filter(topic => !owner || topic.character === owner);
}

function numericComplete(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 1e12;
  return typeof value === 'string' && /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value.trim()) && Number(value.replaceAll(',', '')) <= 1e12;
}
function submittedShape(question, snapshot) {
  if (!object(snapshot) || !Array.isArray(snapshot.links) || !snapshot.links.length || !unique(snapshot.links) || snapshot.links.some(id => !CARD_MAP[id] || id === question.taskId)) return false;
  if (question.type === 'boolean') return typeof snapshot.value === 'boolean';
  if (question.type === 'number') return object(snapshot.value) && question.fields.every(field => numericComplete(snapshot.value[field.id])) && Object.keys(snapshot.value).every(id => question.fields.some(field => field.id === id));
  return true;
}

export function cardQuestionAnswered(state, id) {
  if (!questionAvailable(state, id)) return false;
  const notebook = state.cardFlow.notebook;
  const links = (notebook.links[id] || []).filter(cardId => cardVisible(state, cardId));
  return submittedShape(QUESTION_MAP[id], { links, value: notebook.values[id] });
}

/** Reuse one filtered notebook for all the cards and answers in a single render. */
export function createCardReader(state) {
  const notebook = eligibleNotebook(state);
  const { evaluate, available } = createNotebookEvaluator(notebook);
  function visible(id) {
    const card = CARD_MAP[id];
    return card?.type === 'conclusion' ? conclusionCouldExist(state, card) && available(id) : sourceVisible(state, id);
  }
  function answered(id) {
    return questionAvailable(state, id) && submittedShape(QUESTION_MAP[id], {
      links: (notebook.links[id] || []).filter(visible), value: notebook.values[id],
    });
  }
  return { visible, answered, evaluate };
}

/** Stable edge identities, independent of correctness and card coordinates. */
export function cardConnections(state) {
  return Object.entries(state.cardFlow.notebook.links)
    .flatMap(([questionId, ids]) => ids.map(cardId => `${questionId}|${cardId}`)).sort();
}

export function cardCompletion(state) {
  const reader = createCardReader(state);
  const answered = Object.keys(QUESTION_MAP).filter(reader.answered);
  const missingDocs = MONTH_DOCS[state.month].filter(id => !state.available.includes(id));
  const targets = [...CARD_MONTH_TARGETS[state.month]];
  const missingQuestions = targets.filter(id => !answered.includes(id));
  const baseline = new Set(state.cardFlow.connectionBaseline);
  const newConnections = cardConnections(state).filter(edge => {
    const [questionId, cardId] = edge.split('|');
    return !baseline.has(edge) && questionAvailable(state, questionId) && reader.visible(cardId);
  });
  const monthReady = state.window === 'investigation' && newConnections.length > 0;
  const openSubmitted = validateOpenResponse(state.cardFlow.openResponse.answer, { submitted: true });
  const readyForSummary = state.month === 3 && (answered.length === 28 || openSubmitted);
  return {
    answered: answered.length, submitted: answered.length, total: 28,
    correct: Object.keys(QUESTION_MAP).filter(id => questionAvailable(state, id) && reader.evaluate(id).correct).length,
    targets, missingDocs, missingQuestions, newConnections, connectionCount: newConnections.length, monthReady, readyForSummary, openSubmitted,
    // Editing a response after the summary is recorded must not reopen money-making.
    complete: state.month === 3 && openSubmitted,
  };
}

export function reduceCardFlow(state, action) {
  const original = state.cardFlow;
  const fail = error => ({ cardFlow: original, error, events: [] });
  const flow = clone(original), view = { ...state, cardFlow: flow }, events = [];
  try {
    if (action.type === 'readInvitation') flow.invitationRead = true;
    else if (action.type === 'readNotice') {
      const notice = state.crises.history.find(item => item.id === action.crisisId);
      if (!notice || !has(state, 'D12B')) return fail('尚未实际读到这份延期通知。');
      if (!flow.readCrises.includes(notice.id)) flow.readCrises.push(notice.id);
    } else if (action.type === 'completeTopic') {
      const key = action.topicKey || action.topicId;
      const topic = availableTopics(state).find(item => item.key === key);
      if (!topic) return fail('这项话题尚未开放。');
      if (!flow.completedTopics.includes(key)) {
        flow.completedTopics.push(key); flow.topicSnapshots[key] = clone(topic.snapshot);
        events.push({ type: 'topic-completed', topicKey: key, character: topic.character });
        if (TOPIC_NOTES[key]) events.push({ type: 'card-earned', id: TOPIC_NOTES[key] });
      }
    } else if (action.type === 'notebook') {
      const operation = action.operation, qId = action.questionId;
      if (operation === 'position' || operation === 'arrange') {
        const positions = operation === 'position' ? { [action.cardId]: action.position } : action.positions;
        if (!object(positions)) return fail('卡片坐标不正确。');
        for (const [id, point] of Object.entries(positions)) {
          if (!Object.hasOwn(CARD_MAP, id) || !cardVisible(state, id)) return fail('尚未取得这张卡。');
          const next = setPosition(flow.notebook, id, point);
          if (next === flow.notebook) return fail('卡片坐标不正确。');
          flow.notebook = next;
        }
      } else {
        const missing = questionUnavailable(state, qId);
        if (missing) return fail(missing);
        if (operation === 'connect') {
          if (!CARD_MAP[action.cardId] || action.cardId === QUESTION_MAP[qId].taskId || !cardVisible(state, action.cardId)) return fail('尚未取得可用的证据卡。');
          flow.notebook = connect(flow.notebook, qId, action.cardId);
        } else if (operation === 'disconnect') flow.notebook = disconnect(flow.notebook, qId, action.cardId);
        else if (operation === 'clear') flow.notebook = clearLinks(flow.notebook, qId);
        else if (operation === 'value') {
          const question = QUESTION_MAP[qId], value = action.value;
          if (question.type === 'link' || question.type === 'boolean' && value !== null && typeof value !== 'boolean'
            || question.type === 'number' && (!object(value) || Object.entries(value).some(([field, item]) => !question.fields.some(f => f.id === field) || !['string', 'number'].includes(typeof item) || String(item).length > 40 || typeof item === 'number' && !Number.isFinite(item)))) return fail('输入草稿格式不正确。');
          flow.notebook = setValue(flow.notebook, qId, value);
        }
        else return fail('没有这种笔记操作。');
      }
    } else if (action.type === 'submitCardQuestion') {
      const id = action.questionId, question = QUESTION_MAP[id];
      const missing = questionUnavailable(state, id);
      if (missing) return fail(missing);
      const snapshot = { links: [...(flow.notebook.links[id] || [])], month: state.month, day: state.finance.day };
      if (Object.hasOwn(flow.notebook.values, id)) snapshot.value = clone(flow.notebook.values[id]);
      if (!submittedShape(question, snapshot)) return fail('请填写完整，并至少连接一张证据卡后提交。');
      if (snapshot.links.some(card => !cardVisible(state, card))) return fail('当前回答中仍有不可用的证据连线。');
      flow.submittedQuestions[id] = snapshot;
      events.push({ type: 'card-question-submitted', questionId: id, correct: correct(view, id) });
    } else if (action.type === 'draftConclusion') {
      if (state.month !== 3 || !validateOpenResponse(action.value)) return fail('开放总结草稿格式不正确。');
      flow.openResponse.draft = clone(action.value);
    } else if (action.type === 'submitConclusion') {
      if (!cardCompletion(state).readyForSummary) return fail('先完成全部28项卡片问题，再记录开放总结。');
      if (!validateOpenResponse(action.value, { submitted: true })) return fail('请完成四项开放总结。');
      flow.openResponse = { draft: clone(action.value), answer: clone(action.value) };
      events.push({ type: 'conclusion-submitted' });
    } else return fail('没有这种卡片操作。');
    if (!validateCardFlow(view)) return fail('卡片记录校验失败。');
    return { cardFlow: flow, error: null, events };
  } catch { return fail('卡片操作未完成。'); }
}

export function validateCardFlow(state) {
  try {
    const flow = state.cardFlow;
    if (state.flow !== 'cards' || !object(flow) || flow.version !== 2 || flow.progression !== 'connections' || typeof flow.invitationRead !== 'boolean' || !validateState(flow.notebook)) return false;
    if (Object.keys(flow).some(key => !['version', 'progression', 'connectionBaseline', 'notebook', 'invitationRead', 'readCrises', 'completedTopics', 'topicSnapshots', 'submittedQuestions', 'openResponse'].includes(key))) return false;
    if (!Array.isArray(flow.connectionBaseline) || !unique(flow.connectionBaseline) || flow.connectionBaseline.some(edge => {
      if (typeof edge !== 'string') return true;
      const [questionId, cardId, extra] = edge.split('|');
      return extra !== undefined || !QUESTION_MAP[questionId] || !CARD_MAP[cardId] || QUESTION_MAP[questionId].taskId === cardId;
    })) return false;
    if (!Array.isArray(flow.readCrises) || !unique(flow.readCrises) || flow.readCrises.some(id => !state.crises.history.some(notice => notice.id === id)) || flow.readCrises.length && !has(state, 'D12B')) return false;
    if (state.invitation.offered && (state.invitation.month < 2 || !readAll(state, ['D06', 'D07', 'D08']))) return false;
    if (!Array.isArray(flow.completedTopics) || !unique(flow.completedTopics) || flow.completedTopics.length > 30 || !object(flow.topicSnapshots) || Object.keys(flow.topicSnapshots).length !== flow.completedTopics.length) return false;
    for (const key of flow.completedTopics) {
      if (key === 'T18' || !topicInfo[key] && !(key.startsWith('T18:') && flow.readCrises.includes(key.slice(4)))) return false;
      const snap = flow.topicSnapshots[key];
      if (!object(snap) || !Number.isInteger(snap.month) || snap.month < 0 || snap.month > state.month || ![1, 2].includes(snap.day)) return false;
      if (snap.month === state.month && snap.day > state.finance.day) return false;
      if (key === 'T06' && snap.month < 1 || key === 'T10' && !has(state, 'D09') || key === 'T11' && !done(state, 'T10')) return false;
      if (key.startsWith('T18:')) {
        const notice = state.crises.history.find(item => item.id === key.slice(4));
        if (!notice || snap.noticeId !== notice.id || snap.noticeMonth !== notice.month || snap.noticeDay !== notice.day) return false;
      }
      if (key === 'T19' && (!state.invitation.offered || snap.offeredMonth !== state.invitation.month || snap.month !== state.invitation.month || snap.crisisAtOffer !== state.invitation.crisisAtOffer || !['pending', 'accepted', 'declined', 'expired'].includes(snap.statusAtView))) return false;
    }
    if (!object(flow.submittedQuestions) || !object(flow.openResponse) || Object.keys(flow.openResponse).length !== 2 || !Object.hasOwn(flow.openResponse, 'draft') || !Object.hasOwn(flow.openResponse, 'answer') || !validateOpenResponse(flow.openResponse.draft) || flow.openResponse.answer !== null && !validateOpenResponse(flow.openResponse.answer, { submitted: true })) return false;
    for (const [id, snapshot] of Object.entries(flow.submittedQuestions)) {
      const question = QUESTION_MAP[id];
      if (!question || !submittedShape(question, snapshot) || !Number.isInteger(snapshot.month) || snapshot.month < 0 || snapshot.month > state.month || ![1, 2].includes(snapshot.day)) return false;
      if (snapshot.month === state.month && snapshot.day > state.finance.day || Object.keys(snapshot).some(key => !['links', 'value', 'month', 'day'].includes(key))) return false;
    }
    for (const id of new Set([...Object.keys(flow.notebook.links), ...Object.keys(flow.notebook.values)])) if (!questionAvailable(state, id)) return false;
    for (const cardId of Object.keys(flow.notebook.positions)) {
      const card = CARD_MAP[cardId];
      if (card.type === 'conclusion' ? !conclusionCouldExist(state, card) : !sourceVisible(state, cardId)) return false;
    }
    for (const linked of Object.values(flow.notebook.links)) for (const id of linked) {
      const card = CARD_MAP[id];
      if (card.type === 'conclusion' ? !conclusionCouldExist(state, card) : !sourceVisible(state, id)) return false;
    }
    if (flow.openResponse.answer !== null && state.month !== 3) return false;
    return true;
  } catch { return false; }
}
