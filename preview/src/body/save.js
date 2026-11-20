import { validateCase, completion, MONTHS } from './case.js';
import { cardConnections, CARD_MONTH_TARGETS } from './card-flow.js';
import { upgradeBoard } from './tiles.js';

export const STORAGE_KEY = 'roc-preview:jinding-body-v1';
export const CARD_STORAGE_KEY = 'roc-preview:jinding-body-cards-v1';
const VERSION = 1;
const MAX_BYTES = 2 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const revisionValid = value => Number.isSafeInteger(value) && value >= 0;
const byteLength = value => new TextEncoder().encode(value).byteLength;

/** Preserve v0.5 answers, financial seeds and evidence when upgrading the free-wire rules. */
function upgradeCardCase(state) {
  if (state?.flow !== 'cards' || state.cardFlow?.version !== 1) return state;
  const flow = state.cardFlow;
  const keys = ['version', 'progression', 'notebook', 'invitationRead', 'readCrises', 'completedTopics', 'topicSnapshots', 'submittedQuestions', 'openResponse'];
  if (flow.progression !== 'submitted' || Object.keys(flow).some(key => !keys.includes(key))) return null;
  if (!Number.isInteger(state.month) || state.month < 0 || state.month > 3 || !Array.isArray(state.available)
    || !object(state.investigation) || !Array.isArray(state.boardRecords)) return null;
  const past = MONTHS.slice(0, state.month);
  // In v0.5 every past-month file was mandatory, so only those earned quotas carry.
  if (!object(flow.submittedQuestions) || past.some(month => month.docs.some(id => !state.available.includes(id))
    || CARD_MONTH_TARGETS[month.month].some(id => !Object.hasOwn(flow.submittedQuestions, id)))) return null;
  const priorQuota = past.reduce((sum, month) => sum + month.docs.length, 0);
  if (!['earned', 'spent'].every(key => Number.isSafeInteger(state.investigation[key]) && state.investigation[key] >= 0)) return null;
  state.investigation.earned += priorQuota;
  state.investigation.spent += priorQuota;
  for (let month = 0; month <= state.month; month++) {
    if (!object(state.boardRecords[month]) || !Number.isSafeInteger(state.boardRecords[month].earnedBeforeAttempt)) return null;
    state.boardRecords[month].earnedBeforeAttempt += MONTHS.slice(0, month).reduce((sum, item) => sum + item.docs.length, 0);
  }
  flow.version = 2; flow.progression = 'connections'; flow.connectionBaseline = cardConnections(state);
  state.complete = completion(state).complete;
  return state;
}

/** v0.6 attempts keep their acquired clues; only future manual retries are cash-only. */
function upgradeReplayCase(state) {
  if (state?.flow !== 'cards' || Object.hasOwn(state, 'boardMode')) return state;
  if (!Array.isArray(state.boardRecords) || state.boardRecords.some(record => !object(record) || Object.hasOwn(record, 'cashClears'))) return null;
  state.boardMode = 'investigation';
  for (const record of state.boardRecords) record.cashClears = [];
  return state;
}

/**
 * Internal resume data, including hidden case randomization. This must never be
 * used as the player-facing answer export. Storage I/O belongs to the caller.
 */
export function serializeBody(value) {
  if (!object(value) || !revisionValid(value.revision) || !validateCase(value.state)) {
    throw new TypeError('当前游戏记录无效，未保存。');
  }
  const raw = JSON.stringify({ version: VERSION, revision: value.revision, state: value.state,
    ...(value.state.flow === 'cards' ? { flow: 'cards' } : {}),
  });
  if (byteLength(raw) > MAX_BYTES) throw new RangeError('游戏存档超过大小限制。');
  // Validate the actual JSON representation, not merely the in-memory object.
  if (!restoreBody(raw)) throw new TypeError('游戏记录不能完整保存。');
  return raw;
}

export function restoreBody(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES) return null;
  try {
    if (byteLength(raw) > MAX_BYTES) return null;
    const envelope = JSON.parse(raw);
    const cards = envelope?.state?.flow === 'cards';
    if (!object(envelope) || envelope.version !== VERSION || !revisionValid(envelope.revision)
      || Object.keys(envelope).length !== (cards ? 4 : 3)
      || !['version', 'revision', 'state'].every(key => Object.hasOwn(envelope, key))
      || (cards ? envelope.flow !== 'cards' : Object.hasOwn(envelope, 'flow'))) return null;
    envelope.state = upgradeCardCase(envelope.state);
    envelope.state = upgradeReplayCase(envelope.state);
    if (envelope.state) {
      const previous = envelope.state.board;
      envelope.state.board = upgradeBoard(previous);
      // A formerly full tray can regain space when retired faces form a triple.
      if ([1, 2].includes(previous?.version) && previous.status === 'failed' && envelope.state.board?.status === 'playing') {
        const { investigation, board } = envelope.state;
        if (!object(investigation)) return null;
        const cap = envelope.state.flow === 'cards'
          ? MONTHS.slice(0, envelope.state.month + 1).reduce((sum, month) => sum + month.docs.length, 0)
          : MONTHS[envelope.state.month]?.docs.length;
        investigation.progress = envelope.state.boardMode === 'cash' || investigation.earned === cap
          ? 0 : board.investigationMatches % 3;
      }
    }
    if (!validateCase(envelope.state)) return null;
    return { state: envelope.state, revision: envelope.revision };
  } catch {
    return null;
  }
}
