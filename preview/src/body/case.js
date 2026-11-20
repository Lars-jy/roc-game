import { createFinance, reduceFinance, validateFinance, publicFinance } from './finance.js';
import { createBoard, pick, returnReserve, useTool, validateBoard, getSolution } from './tiles.js';
import { QUESTIONS, QUESTION_MAP, getDoc, questionMessage } from './content.js';
import { isQuestionAnswered, validateOpenResponse } from '../open-response.js';
import { availableTopics, createCardFlow, reduceCardFlow, validateCardFlow, cardCompletion, cardConnections, questionUnavailable } from './card-flow.js';

export const MONTHS = Object.freeze([
  { month: 0, label: '4月', title: '初步信任', docs: ['D04'], questions: ['Q1'] },
  { month: 1, label: '5月', title: '核对经营与合同', docs: ['D05', 'D09', 'D12A'], questions: ['Q2', 'Q3'] },
  { month: 2, label: '6月', title: '追查账户与资金', docs: ['D06', 'D07', 'D08', 'D13'], questions: ['Q4', 'Q5'] },
  { month: 3, label: '7月', title: '付款链与调查总结', docs: ['D10', 'D11'], questions: ['Q6', 'Q7', 'Q8'] },
].map(item => Object.freeze({ ...item, docs: Object.freeze(item.docs), questions: Object.freeze(item.questions) })));

const INITIAL_DOCS = ['D01', 'D02', 'D03', 'P01'];
const CHECKPOINTS = ['start', 'investigation', 'lastDoc'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => JSON.parse(JSON.stringify(value));
const unique = list => new Set(list).size === list.length;
const add = (list, value) => { if (!list.includes(value)) list.push(value); };

function hash(value) {
  let n = 2166136261;
  for (const char of String(value)) n = Math.imul(n ^ char.codePointAt(0), 16777619) >>> 0;
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return n >>> 0;
}

function shuffled(list, seed) {
  const result = [...list];
  let n = hash(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function planCrises(seed) {
  const count = 1 + hash(`${seed}|crisis-count`) % 2;
  return shuffled([0, 1, 2, 3], `${seed}|crisis-months`).slice(0, count).sort().map((month, index) => ({
    id: `CR-${index + 1}`, month, checkpoint: CHECKPOINTS[hash(`${seed}|crisis-stage|${month}`) % CHECKPOINTS.length],
  }));
}

function boardSeed(state) { return hash(`${state.seed}|board|${state.month}|${state.attempt}`); }
function blindOrder(state) {
  const months = state.flow === 'cards' ? MONTHS.slice(0, state.month + 1) : [MONTHS[state.month]];
  return months.flatMap(month => shuffled(month.docs, `${state.seed}|blind|${month.month}`));
}

/** Card-mode chances are banked. An unopened earlier-month file stays obtainable. */
export function investigationCap(state) {
  return state.flow === 'cards' ? MONTHS.slice(0, state.month + 1).reduce((total, month) => total + month.docs.length, 0) : MONTHS[state.month].docs.length;
}

/** A separate investigation retry keeps cash-only replays from stranding the case. */
export function canResumeInvestigation(state) {
  return state?.flow === 'cards' && !state.complete && state.window === 'investigation'
    && state.investigation.earned < investigationCap(state)
    && (state.boardMode === 'cash' || ['failed', 'cleared'].includes(state.board.status));
}

function copyCase(state) {
  // Tiles and finance reducers are immutable. Keep the board reference until a tile
  // action so the test-only solution witness never needs to enter serialized data.
  return {
    ...state, investigation: { ...state.investigation }, available: [...state.available], read: [...state.read],
    boardRecords: state.boardRecords.map(record => ({ ...record, ...(state.flow === 'cards' ? { cashClears: [...record.cashClears] } : {}) })),
    answers: clone(state.answers), drafts: clone(state.drafts), messages: clone(state.messages),
    invitation: { ...state.invitation }, crises: clone(state.crises),
    ...(state.flow === 'cards' ? { cardFlow: clone(state.cardFlow) } : {}),
    ...(state.monthlyBusinessDecisions ? { monthlyBusinessDecisions: clone(state.monthlyBusinessDecisions) } : {}),
  };
}

function applyFinance(state, action, events) {
  const result = reduceFinance(state.finance, action);
  if (result.error) throw new Error(result.error);
  state.finance = result.state;
  events.push(...result.events);
}

/** The monthly contract may settle any outstanding lot, not just last month's. */
export function monthlyBusinessOptions(state) {
  const previousMonthInvested = state.finance.lots
    .filter(lot => lot.month === state.month - 1)
    .reduce((total, lot) => total + lot.amount, 0);
  const purchasedPreviousMonth = previousMonthInvested > 0;
  const canSubscribe = state.flow === 'cards' && !state.complete && state.window === 'invest' && state.finance.day === 1;
  const principal = state.finance.principal;
  const canExit = canSubscribe && purchasedPreviousMonth && principal > 0
    && !state.finance.requests.some(request => request.month === state.month);
  return { canSubscribe, canExit, purchasedPreviousMonth, previousMonthInvested,
    principal, exitQuote: publicFinance(state.finance).quote,
    options: ['subscribe', ...(canExit ? ['exit'] : [])] };
}

function beginInvestigation(state, events) {
  applyFinance(state, { type: 'advanceDate', month: state.month, day: 2, crisis: state.crises.activeMonth === state.month }, events);
  state.window = 'investigation';
  triggerCrisis(state, 'investigation', events);
  events.push({ type: 'investigation-started', month: state.month });
}

function monthlyAction(state, action) {
  if (state.flow !== 'cards') return null;
  const type = action.type === 'monthlyPurchase' ? 'subscribe'
    : ['monthlyExit', 'exit'].includes(action.type) ? 'exit' : null;
  if (!type) return null;
  return { type, id: action.id ?? `case:monthly-${type}:${state.month}`, amount: action.amount,
    ...(type === 'exit' ? { reason: action.reason } : {}) };
}

function confirmMonthlyBusiness(state, action, decision, events) {
  const options = monthlyBusinessOptions(state);
  if (!options.canSubscribe) throw new Error('本月认购与退出办理已经结束。');
  if (action.expectedMonth !== undefined && action.expectedMonth !== state.month
    || action.expectedDay !== undefined && action.expectedDay !== 1) throw new Error('日期已经变化，请重新确认。');
  if (typeof decision.id !== 'string' || !decision.id.length || decision.id.length > 160 || decision.id.startsWith('sys:')) throw new Error('本次合同缺少有效记录号。');
  if (state.finance._processed.includes(decision.id)) throw new Error('该记录号已用于其他业务。');
  if (!integer(decision.amount) || decision.amount > 1_000_000_000) throw new Error('请输入有效办理金额。');
  if (decision.type === 'exit') {
    if (!options.canExit) throw new Error('本月未开放退出申请。');
    applyFinance(state, { type: 'exit', amount: decision.amount, reason: decision.reason, id: decision.id }, events);
  } else if (decision.amount > 0) {
    applyFinance(state, { type: 'invest', amount: decision.amount, id: decision.id }, events);
  }
  state.monthlyBusinessDecisions = [...(state.monthlyBusinessDecisions || []), { ...decision, month: state.month }];
  beginInvestigation(state, events);
}

function applyCard(state, action, events) {
  if (state.flow !== 'cards') throw new Error('当前不是正式卡片调查。');
  const result = reduceCardFlow(state, action);
  if (result.error) throw new Error(result.error);
  state.cardFlow = result.cardFlow;
  events.push(...result.events);
}

function queueMessage(state, message, events) {
  if (state.messages.some(item => item.id === message.id)) return;
  state.messages.push({ sent: false, seen: false, month: state.month, day: state.finance.day, ...message });
  events.push({ type: 'message', id: message.id, character: message.character });
}

function triggerCrisis(state, checkpoint, events) {
  const plan = state.crises.plans.find(item => item.month === state.month && item.checkpoint === checkpoint);
  if (!plan || state.crises.history.some(item => item.id === plan.id)) return;
  applyFinance(state, { type: 'setCrisis', active: true }, events);
  state.crises.history.push({ ...plan, day: state.finance.day });
  state.crises.activeMonth = state.month;
  add(state.available, 'D12B');
  queueMessage(state, {
    id: `crisis:${plan.id}`, character: 'lu', prompt: `${MONTHS[state.month].label}这份付款通知，是怎么回事？`,
    reply: ['系统在调整，这个月还没执行的收益支付要暂缓。通知先给你，具体到没到账，看实际登记。', '要是考虑追加，仍然由你决定。我不能保证追加以后能优先付款。'],
  }, events);
  events.push({ type: 'crisis', id: plan.id, month: state.month });
}

function awardDocument(state, id, events) {
  state.investigation.spent += 1;
  add(state.available, id);
  events.push({ type: 'document-earned', id });
  if (!state.complete && state.window === 'investigation'
    && MONTHS[state.month].docs.every(docId => state.available.includes(docId))) triggerCrisis(state, 'lastDoc', events);
}

function deliverEarnedDocuments(state, events) {
  if (state.flow !== 'cards' || state.investigation.spent >= state.investigation.earned) return;
  for (const id of blindOrder(state)) {
    if (state.investigation.spent === state.investigation.earned) return;
    if (!state.available.includes(id)) awardDocument(state, id, events);
  }
}

function updateRecords(state, events) {
  const f = state.finance;
  if (f.ledger.length) add(state.available, 'C02');
  if (f.requests.length) add(state.available, 'C01');
  if (f.ledger.some(item => ['interest-paid', 'exit-approved'].includes(item.type) && item.cashDelta > 0)) {
    add(state.available, 'P02');
    if (['D06', 'D07', 'D08'].every(id => state.read.includes(id))) add(state.available, 'P03');
  }
  if (!state.invitation.offered && state.window === 'investigation' && ['D06', 'D07', 'D08'].every(id => state.read.includes(id))) {
    state.invitation = { offered: true, month: state.month, status: 'pending',
      ...(state.flow === 'cards' ? { day: state.finance.day, crisisAtOffer: state.crises.activeMonth === state.month } : {}),
    };
    queueMessage(state, {
      id: 'private-invitation', character: 'lu', prompt: '你说还有一笔单独认购的机会？',
      reply: [
        state.crises.activeMonth === state.month ? '现在有付款调整，你看过通知了。这次单独认购你可以考虑，也可以不办。' : '你这边的资料已经核过了。我可以单独给你登记一次认购，本月有效。',
        '首次约定结算在下个月月初，不足整月按实际天数算。追加不保证退出获批，也不保证优先付款，你想清楚再定。',
      ],
    }, events);
    events.push({ type: 'invitation', month: state.month });
  }
}

export function createCase(seed = Date.now(), options = {}) {
  if (options.flow !== undefined && options.flow !== 'cards') throw new TypeError('未知调查流程。');
  const savedSeed = String(seed).slice(0, 160);
  const state = {
    version: 1, seed: savedSeed, month: 0, window: 'invest', finance: createFinance(savedSeed),
    board: null, attempt: 0, investigation: { earned: 0, spent: 0, progress: 0 },
    // Only completed chances carry across attempts; partial progress never does.
    boardRecords: MONTHS.map(() => ({ earnedBeforeAttempt: 0, cleared: false, ...(options.flow === 'cards' ? { cashClears: [] } : {}) })),
    available: [...INITIAL_DOCS], read: [], answers: {}, drafts: {}, messages: [],
    invitation: { offered: false, month: null, status: 'pending' },
    crises: { plans: planCrises(savedSeed), history: [], activeMonth: null }, complete: false,
    ...(options.flow === 'cards' ? { flow: 'cards', boardMode: 'investigation', cardFlow: createCardFlow({ progression: options.progression || 'connections' }) } : {}),
  };
  state.board = createBoard(boardSeed(state));
  triggerCrisis(state, 'start', []);
  return state;
}

/** Empty string means available for submission; no correctness checks here. */
export function questionMissing(state, qId) {
  if (state.flow === 'cards') return questionUnavailable(state, qId);
  const question = QUESTION_MAP[qId];
  if (!question) return '没有这道问题。';
  if (question.phaseMin > state.month) return `${MONTHS[question.phaseMin].label}开放。`;
  if (question.phaseMin === state.month && state.window !== 'investigation') return '先结束本月认购，再开始本月调查。';
  const missing = question.requiredDocs.filter(id => !state.read.includes(id));
  if (missing.length) return `先查阅：${missing.join('、')}。`;
  if (question.requiredAnyGroups?.length && !question.requiredAnyGroups.some(group => group.every(id => state.read.includes(id)))) {
    return `先查阅：${question.requiredAnyGroups.map(group => group.join('＋')).join('或')}。`;
  }
  if (qId === 'Q7' && !state.crises.history.length) return '尚未收到实际危机通知。';
  return '';
}

export function completion(state) {
  if (state.flow === 'cards') return cardCompletion(state);
  const answered = QUESTIONS.filter(question => isQuestionAnswered(question, state.answers[question.id])).length;
  const current = MONTHS[state.month];
  const missingDocs = current.docs.filter(id => !state.available.includes(id));
  const missingQuestions = current.questions.filter(id => !isQuestionAnswered(QUESTION_MAP[id], state.answers[id]));
  const monthReady = state.window === 'investigation' && missingDocs.length === 0 && missingQuestions.length === 0;
  return { answered, total: QUESTIONS.length, monthReady, complete: state.month === 3 && monthReady && answered === QUESTIONS.length, missingDocs, missingQuestions };
}

function tileAction(state, action, events) {
  if (state.window !== 'investigation') throw new Error('本月调查尚未开始。');
  const before = state.board;
  const board = action.type === 'pick' ? pick(before, action.id)
    : action.type === 'reserve' ? returnReserve(before, action.id) : useTool(before, action.tool);
  if (board === before) throw new Error(before.status === 'failed' ? '本次牌局已结束，请重新开局。' : '当前无法进行这次牌局操作。');
  state.board = board;
  const cap = investigationCap(state);
  if (state.boardMode !== 'cash' && state.investigation.earned < cap) {
    const progress = state.investigation.progress + Math.max(0, board.investigationMatches - before.investigationMatches);
    const amount = Math.min(cap - state.investigation.earned, Math.floor(progress / 3));
    state.investigation.earned += amount;
    state.investigation.progress = state.investigation.earned === cap ? 0 : progress % 3;
    if (amount) events.push({ type: 'investigation-earned', amount, available: state.investigation.earned - state.investigation.spent });
  }
  if (before.status !== 'failed' && board.status === 'failed') {
    state.investigation.progress = 0;
    events.push({ type: 'board-failed' });
  }
  if (before.status !== 'cleared' && board.status === 'cleared') {
    if (state.boardMode === 'cash') {
      applyFinance(state, { type: 'replayReward', month: state.month, attempt: state.attempt, id: `case:replay-reward:${state.month}:${state.attempt}` }, events);
      state.boardRecords[state.month].cashClears.push(state.attempt);
    } else {
      state.boardRecords[state.month].cleared = true;
      applyFinance(state, { type: 'boardReward', month: state.month, id: `case:board-reward:${state.month}` }, events);
    }
    events.push({ type: 'board-cleared', month: state.month, ...(state.flow === 'cards' ? { mode: state.boardMode } : {}) });
  }
}

function advanceMonth(state, events) {
  if (state.flow === 'cards') triggerCrisis(state, 'lastDoc', events);
  if (state.invitation.offered && state.invitation.status === 'pending') state.invitation.status = 'expired';
  if (state.flow === 'cards') state.cardFlow.connectionBaseline = cardConnections(state);
  state.month += 1;
  state.window = 'invest'; state.attempt = 0;
  if (state.flow === 'cards') state.boardMode = 'investigation';
  state.investigation = state.flow === 'cards' ? { ...state.investigation, progress: 0 } : { earned: 0, spent: 0, progress: 0 };
  if (state.flow === 'cards') state.boardRecords[state.month].earnedBeforeAttempt = state.investigation.earned;
  state.crises.activeMonth = null;
  const startCrisis = state.crises.plans.some(item => item.month === state.month && item.checkpoint === 'start');
  applyFinance(state, { type: 'advanceDate', month: state.month, day: 1, crisis: startCrisis }, events);
  state.board = createBoard(boardSeed(state));
  triggerCrisis(state, 'start', events);
  events.push({ type: 'month-started', month: state.month });
}

/** Actions are transactional: an error preserves the exact previous state. */
export function reduceCase(current, action, { autoDeliverEvidence = false } = {}) {
  const fail = message => ({ state: current, error: message, events: [] });
  if (!validateCase(current)) return fail('调查存档校验失败，请使用有效存档。');
  if (!object(action) || typeof action.type !== 'string') return fail('无效操作。');
  const decision = monthlyAction(current, action);
  if (decision) {
    const previous = current.monthlyBusinessDecisions?.find(item => item.id === decision.id);
    if (previous) {
      if (previous.type !== decision.type || previous.amount !== decision.amount
        || previous.reason !== decision.reason) return fail('本次确认内容与已登记合同不一致。');
      return { state: current, error: null, events: [], duplicate: true };
    }
  }
  const reviewActions = ['read', 'draft', 'answer', 'message', 'seeChat', 'notebook', 'submitCardQuestion', 'readInvitation', 'completeTopic', 'draftConclusion', 'submitConclusion', 'deliverEvidence'];
  if (current.complete && !reviewActions.includes(action.type)) return fail(current.flow === 'cards' ? '调查总结已经记录，本阶段资金与牌局已截止。' : '八题已经记录，本阶段资金与牌局已截止。');
  const state = copyCase(current);
  const events = [];
  try {
    switch (action.type) {
      case 'monthlyPurchase': case 'monthlyExit':
        if (!decision) throw new Error('当前不是月初合同流程。');
        confirmMonthlyBusiness(state, action, decision, events);
        break;
      case 'invest':
        if (state.window !== 'invest') throw new Error('普通认购窗口已关闭。');
        if (action.amount === 0) break;
        applyFinance(state, { type: 'invest', amount: action.amount, id: action.id || `case:invest:${state.month}:${state.finance.lots.length}` }, events);
        break;
      case 'closeWindow':
        if (state.window !== 'invest') return { state: current, error: null, events: [] };
        beginInvestigation(state, events);
        break;
      case 'pick': case 'reserve': case 'tool': tileAction(state, action, events); break;
      case 'fastClear': {
        if (state.window !== 'investigation') throw new Error('本月调查尚未开始。');
        if (state.board.status === 'cleared') return { state: current, error: null, events: [] };
        // A partial/shuffled/restored board may have no known legal continuation.
        // Start a guaranteed attempt, preserving banked chances exactly as retry
        // does, and replay legal picks in one transaction (one UI/save update).
        state.boardRecords[state.month].earnedBeforeAttempt = state.investigation.earned;
        state.attempt += 1;
        state.board = createBoard(boardSeed(state));
        state.investigation.progress = 0;
        const path = getSolution(state.board);
        if (path.length !== state.board.tiles.length) throw new Error('速通牌局未能准备完成。');
        for (const id of path) tileAction(state, { type: 'pick', id }, events);
        if (state.board.status !== 'cleared') throw new Error('速通牌局未能完成。');
        break;
      }
      case 'retry':
        if (state.window !== 'investigation') throw new Error('本月调查尚未开始。');
        state.boardRecords[state.month].earnedBeforeAttempt = state.investigation.earned;
        state.attempt += 1;
        state.board = createBoard(boardSeed(state));
        state.investigation.progress = 0;
        if (state.flow === 'cards') state.boardMode = 'cash';
        events.push({ type: 'board-restarted', attempt: state.attempt });
        break;
      case 'resumeInvestigation':
        if (!canResumeInvestigation(state)) throw new Error('当前不需要补充调查，已有机会与资料已保留。');
        state.boardRecords[state.month].earnedBeforeAttempt = state.investigation.earned;
        state.attempt += 1;
        state.board = createBoard(boardSeed(state));
        state.boardMode = 'investigation';
        state.investigation.progress = 0;
        events.push({ type: 'board-restarted', attempt: state.attempt, mode: 'investigation', recovery: true });
        break;
      case 'draw': {
        if (state.window !== 'investigation') throw new Error('本月调查尚未开始。');
        const order = blindOrder(state);
        const id = order.includes(action.id) ? action.id : /^slot-\d+$/.test(String(action.id)) ? order[Number(String(action.id).slice(5))] : null;
        if (!id || !order.includes(id)) throw new Error('这份资料当前无法获取。');
        if (state.available.includes(id)) throw new Error('这份资料已经取得。');
        if (state.investigation.earned <= state.investigation.spent) throw new Error('还没有可用调查机会。');
        awardDocument(state, id, events);
        break;
      }
      case 'deliverEvidence':
        if (state.flow !== 'cards' || state.investigation.spent === state.investigation.earned) return { state: current, error: null, events: [] };
        break;
      case 'read':
        if (!state.available.includes(action.id) || !getDoc(state, action.id)) throw new Error('尚未取得这份资料。');
        add(state.read, action.id);
        if (state.flow === 'cards' && action.id === 'D12B') {
          const crisisId = action.crisisId || state.crises.history.at(-1)?.id;
          applyCard(state, { type: 'readNotice', crisisId }, events);
        }
        break;
      case 'skipToReport': {
        if (state.flow !== 'cards') throw new Error('当前不是正式卡片调查。');
        if (cardCompletion(current).readyForSummary) return { state: current, error: null, events };
        // Settle the elapsed game dates without replaying skipped toasts or audio.
        const skippedEvents = [];
        while (state.month < MONTHS.length - 1) {
          if (state.window === 'invest') beginInvestigation(state, skippedEvents);
          advanceMonth(state, skippedEvents);
        }
        if (state.window === 'invest') beginInvestigation(state, skippedEvents);
        triggerCrisis(state, 'lastDoc', skippedEvents);
        state.cardFlow.reportUnlockedBySkip = true;
        break;
      }
      case 'notebook': case 'submitCardQuestion': case 'readInvitation': case 'completeTopic': case 'draftConclusion': case 'submitConclusion':
        applyCard(state, action, events);
        break;
      case 'draft': {
        if (state.flow === 'cards') throw new Error('请通过卡片问题记录草稿。');
        const question = QUESTION_MAP[action.id];
        if (!question || question.phaseMin > state.month) throw new Error('这道问题尚未开放。');
        if (question.type === 'open' ? !validateOpenResponse(action.value) : !Array.isArray(action.value) || action.value.some(id => !question.options.some(option => option.id === id))) throw new Error('回答草稿格式不正确。');
        state.drafts[action.id] = clone(action.value);
        break;
      }
      case 'answer': {
        if (state.flow === 'cards') throw new Error('当前使用28项卡片问题，不提交旧选择题。');
        const missing = questionMissing(state, action.id);
        if (missing) throw new Error(missing);
        const question = QUESTION_MAP[action.id];
        if (!isQuestionAnswered(question, action.answer)) throw new Error(question.type === 'open' ? '请完成四项开放回答后提交。' : '请选择完整的回答。');
        state.answers[action.id] = clone(action.answer);
        state.drafts[action.id] = clone(action.answer);
        if (question.type !== 'open') queueMessage(state, questionMessage(action.id, action.answer), events);
        events.push({ type: 'question-recorded', id: action.id });
        break;
      }
      case 'message': {
        const message = state.messages.find(item => item.id === action.id);
        if (!message) throw new Error('没有这条可发送的剧情消息。');
        if (message.sent) break;
        message.sent = true; message.seen = true;
        events.push({ type: 'message-sent', id: message.id, character: message.character });
        break;
      }
      case 'seeChat':
        if (!['lu', 'zhou', 'lin'].includes(action.character)) throw new Error('没有这个联系人。');
        for (const item of state.messages) if (item.character === action.character) item.seen = true;
        break;
      case 'invitationAccept':
        if (!state.invitation.offered || state.invitation.status !== 'pending' || state.invitation.month !== state.month) throw new Error('本次私人邀请已结束。');
        applyFinance(state, { type: 'invest', amount: action.amount, id: 'case:private-investment' }, events);
        state.invitation.status = 'accepted';
        break;
      case 'invitationDecline':
        if (!state.invitation.offered || state.invitation.status !== 'pending' || state.invitation.month !== state.month) throw new Error('本次私人邀请已结束。');
        state.invitation.status = 'declined';
        break;
      case 'exit':
        if (decision) confirmMonthlyBusiness(state, action, decision, events);
        else applyFinance(state, { type: 'exit', amount: action.amount, reason: action.reason, id: action.id || `case:exit:${state.month}` }, events);
        break;
      case 'nextMonth': {
        if (!completion(state).monthReady) throw new Error(state.flow === 'cards' ? '本月先在推理桌新增一条连线。' : '先收齐本月资料并提交本月问题。');
        if (state.month === 3) throw new Error(state.flow === 'cards' ? '四个月调查到此截止，不进入下个月。' : '八题记录到此截止，不进入下个月。');
        advanceMonth(state, events);
        break;
      }
      default: throw new Error('没有这种操作。');
    }
    if (autoDeliverEvidence || action.type === 'deliverEvidence') deliverEarnedDocuments(state, events);
    updateRecords(state, events);
    if (state.flow === 'cards' && action.type === 'notebook' && !['position', 'arrange'].includes(action.operation)) {
      const previousTopics = new Set(availableTopics(current).map(topic => topic.key));
      for (const topic of availableTopics(state)) {
        if (!topic.completed && !previousTopics.has(topic.key)) events.push({ type: 'topic-unlocked', key: topic.key, character: topic.character });
      }
    }
    state.complete = completion(state).complete;
    if (state.complete && !current.complete) events.push({ type: 'case-complete' });
    if (!validateCase(state)) throw new Error('调查记录校验失败，本次操作未保存。');
    return { state, error: null, events };
  } catch (error) { return fail(error.message || '操作未完成。'); }
}

export function validateCase(state) {
  try {
    if (!object(state) || state.version !== 1 || typeof state.seed !== 'string' || state.seed.length > 160 || !integer(state.month) || state.month > 3) return false;
    if (state.flow !== undefined && state.flow !== 'cards' || state.flow !== 'cards' && Object.hasOwn(state, 'cardFlow')) return false;
    if (state.flow === 'cards' ? !['investigation', 'cash'].includes(state.boardMode) : Object.hasOwn(state, 'boardMode')) return false;
    if (!['invest', 'investigation'].includes(state.window) || !integer(state.attempt) || !validateFinance(state.finance) || !validateBoard(state.board)) return false;
    if (state.finance._seed !== state.seed || state.board.seed !== boardSeed(state)) return false;
    if (state.finance.month !== state.month || state.finance.day !== (state.window === 'invest' ? 1 : 2)) return false;
    if (Object.hasOwn(state, 'monthlyBusinessDecisions')) {
      const decisions = state.monthlyBusinessDecisions;
      if (state.flow !== 'cards' || !Array.isArray(decisions) || decisions.length > MONTHS.length
        || !unique(decisions.map(item => item?.id)) || !unique(decisions.map(item => item?.month))) return false;
      for (const item of decisions) {
        if (!object(item) || typeof item.id !== 'string' || !item.id.length || item.id.length > 160 || item.id.startsWith('sys:')
          || !['subscribe', 'exit'].includes(item.type) || !integer(item.month) || item.month > state.month
          || item.month === state.month && state.window !== 'investigation' || !integer(item.amount) || item.amount > 1_000_000_000) return false;
        if (item.type === 'subscribe') {
          if (Object.hasOwn(item, 'reason')) return false;
          const lot = state.finance.lots.find(lot => lot.id === item.id);
          if (item.amount > 0 ? !lot || lot.amount !== item.amount || lot.month !== item.month || lot.day !== 1
            : state.finance._processed.includes(item.id)) return false;
        } else {
          const request = state.finance.requests.find(request => request.id === item.id);
          if (!request || request.amount !== item.amount || request.reason !== item.reason || request.month !== item.month || request.day !== 1
            || !state.finance.lots.some(lot => lot.month === item.month - 1 && lot.amount > 0)) return false;
        }
      }
    }
    if (!object(state.investigation) || !['earned', 'spent', 'progress'].every(key => integer(state.investigation[key]))) return false;
    const { earned, spent, progress } = state.investigation;
    if (earned > investigationCap(state) || spent > earned || progress > 2 || (earned === investigationCap(state) && progress !== 0)) return false;
    if (!Array.isArray(state.boardRecords) || state.boardRecords.length !== MONTHS.length) return false;
    for (const [month, record] of state.boardRecords.entries()) {
      const recordCap = state.flow === 'cards' ? MONTHS.slice(0, month + 1).reduce((sum, item) => sum + item.docs.length, 0) : MONTHS[month].docs.length;
      if (!object(record) || !integer(record.earnedBeforeAttempt) || record.earnedBeforeAttempt > recordCap || typeof record.cleared !== 'boolean') return false;
      if (state.flow === 'cards') {
        if (!Array.isArray(record.cashClears) || !unique(record.cashClears) || !record.cashClears.every((attempt, index) => Number.isSafeInteger(attempt) && attempt > 0 && (!index || attempt > record.cashClears[index - 1]))) return false;
        if (month > state.month && record.cashClears.length || month === state.month && record.cashClears.some(attempt => attempt > state.attempt)) return false;
        const paid = state.finance.ledger.filter(row => row.type === 'board-replay-reward' && row.month === month).map(row => row.attempt);
        if (JSON.stringify(paid) !== JSON.stringify(record.cashClears)) return false;
      } else if (Object.hasOwn(record, 'cashClears') || state.finance.ledger.some(row => row.type === 'board-replay-reward')) return false;
      if (month > state.month && (record.earnedBeforeAttempt !== 0 || record.cleared)) return false;
      if (record.cleared !== state.finance._boardPaid[month]) return false;
    }
    const record = state.boardRecords[state.month];
    const cap = investigationCap(state);
    if (state.attempt === 0 && (state.flow !== 'cards' || state.month === 0) && record.earnedBeforeAttempt !== 0) return false;
    const cashOnly = state.boardMode === 'cash';
    if (cashOnly && state.attempt < 1) return false;
    if (earned !== (cashOnly ? record.earnedBeforeAttempt : Math.min(cap, record.earnedBeforeAttempt + Math.floor(state.board.investigationMatches / 3)))) return false;
    const expectedProgress = cashOnly || earned === cap || state.board.status === 'failed' ? 0 : state.board.investigationMatches % 3;
    if (progress !== expectedProgress || (!cashOnly && state.board.status === 'cleared' && !record.cleared)) return false;
    if (cashOnly && record.cashClears.includes(state.attempt) !== (state.board.status === 'cleared')) return false;
    if (!Array.isArray(state.available) || !Array.isArray(state.read) || !unique(state.available) || !unique(state.read) || !state.read.every(id => state.available.includes(id))) return false;
    if (!INITIAL_DOCS.every(id => state.available.includes(id))) return false;
    const allowed = new Set([...INITIAL_DOCS, 'D12B', 'P02', 'P03', 'C01', 'C02', ...MONTHS.slice(0, state.month + 1).flatMap(item => item.docs)]);
    if (!state.available.every(id => typeof id === 'string' && allowed.has(id))) return false;
    const spentDocs = (state.flow === 'cards' ? MONTHS.slice(0, state.month + 1) : [MONTHS[state.month]]).flatMap(month => month.docs);
    if (spentDocs.filter(id => state.available.includes(id)).length !== spent) return false;
    for (const month of state.flow === 'cards' ? [] : MONTHS.slice(0, state.month)) {
      if (!month.docs.every(id => state.available.includes(id))) return false;
      if (!month.questions.every(id => isQuestionAnswered(QUESTION_MAP[id], state.answers?.[id]))) return false;
    }
    if (!object(state.answers) || !object(state.drafts)) return false;
    if (state.flow === 'cards' && (Object.keys(state.answers).length || Object.keys(state.drafts).length)) return false;
    for (const [id, answer] of Object.entries(state.answers)) if (!QUESTION_MAP[id] || QUESTION_MAP[id].phaseMin > state.month || !isQuestionAnswered(QUESTION_MAP[id], answer)) return false;
    for (const [id, value] of Object.entries(state.drafts)) if (!QUESTION_MAP[id] || QUESTION_MAP[id].phaseMin > state.month || (QUESTION_MAP[id].type === 'open' ? !validateOpenResponse(value) : !Array.isArray(value) || value.some(option => !QUESTION_MAP[id].options.some(item => item.id === option)))) return false;
    if (!Array.isArray(state.messages) || !unique(state.messages.map(item => item.id)) || !state.messages.every(item => object(item) && typeof item.id === 'string' && ['lu', 'zhou', 'lin'].includes(item.character) && typeof item.prompt === 'string' && Array.isArray(item.reply) && item.reply.every(line => typeof line === 'string') && typeof item.sent === 'boolean' && typeof item.seen === 'boolean')) return false;
    for (const message of state.messages) if (Object.hasOwn(message, 'month') || Object.hasOwn(message, 'day')) {
      if (!integer(message.month) || message.month > state.month || ![1, 2].includes(message.day)) return false;
    }
    if (!object(state.invitation) || typeof state.invitation.offered !== 'boolean' || !['pending', 'accepted', 'declined', 'expired'].includes(state.invitation.status)) return false;
    if (state.invitation.offered && (!integer(state.invitation.month) || state.invitation.month > state.month)) return false;
    if (state.flow === 'cards' && state.invitation.offered && (![1, 2].includes(state.invitation.day) || typeof state.invitation.crisisAtOffer !== 'boolean')) return false;
    if (!object(state.crises) || JSON.stringify(state.crises.plans) !== JSON.stringify(planCrises(state.seed)) || !Array.isArray(state.crises.history) || !unique(state.crises.history.map(item => item.id))) return false;
    for (const item of state.crises.history) if (!state.crises.plans.some(plan => plan.id === item.id && plan.month === item.month && plan.checkpoint === item.checkpoint) || item.month > state.month || ![1, 2].includes(item.day)) return false;
    const active = state.crises.history.some(item => item.month === state.month);
    if (state.crises.activeMonth !== (active ? state.month : null) || state.finance.crisis !== active || state.available.includes('D12B') !== (state.crises.history.length > 0)) return false;
    if (state.flow === 'cards' && !validateCardFlow(state)) return false;
    if (typeof state.complete !== 'boolean' || state.complete !== completion(state).complete) return false;
    return true;
  } catch { return false; }
}

export function blindCards(state) {
  return blindOrder(state).map((id, index) => ({ id, slot: `slot-${index}`, month: MONTHS.find(month => month.docs.includes(id)).month, obtained: state.available.includes(id), locked: false }));
}

/** Suitable for on-screen/exported records, not for resuming a saved case. */
export function publicCase(state) {
  return {
    version: state.version, month: state.month, window: state.window, finance: publicFinance(state.finance),
    investigation: { ...state.investigation }, available: [...state.available], read: [...state.read],
    answers: clone(state.answers), drafts: clone(state.drafts), messages: clone(state.messages), invitation: { ...state.invitation },
    crises: { history: state.crises.history.map(({ id, month, day }) => ({ id, month, day })), activeMonth: state.crises.activeMonth },
    complete: state.complete, progress: completion(state),
    ...(state.flow === 'cards' ? { flow: 'cards', cardFlow: clone(state.cardFlow) } : {}),
  };
}
