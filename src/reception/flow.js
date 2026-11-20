import { STORY } from './story.js';

const ASK_BRANCHES = new Set(['materials', 'lu', 'zhou']);
const unique = (items, value) => items.includes(value) ? items : [...items, value];

export function createFlowState() {
  return {
    mode: 'dialogue',
    group: 'entrance',
    index: 0,
    typingComplete: false,
    scene: 'arrival',
    documentId: null,
    visited: [],
    readDocuments: [],
  };
}

/** Retains the last spoken line while an action or reader is displayed. */
export function currentLine(state) {
  return STORY[state.group]?.[state.index] ?? null;
}

function enterLine(state, group, index = 0) {
  return {
    ...state,
    mode: 'dialogue',
    group,
    index,
    typingComplete: false,
    scene: STORY[group][index].scene,
    documentId: null,
  };
}

export function completeTyping(state) {
  if (state.mode !== 'dialogue' || state.typingComplete) return state;
  return { ...state, typingComplete: true };
}

function nextLine(state) {
  const lines = STORY[state.group];
  if (state.group === 'materials' && state.index === lines.length - 1) {
    return { ...state, mode: 'document', documentId: 'D01' };
  }
  if (state.index < lines.length - 1) return enterLine(state, state.group, state.index + 1);
  if (state.group === 'osProduct') {
    return { ...state, group: 'materials', index: STORY.materials.length - 1,
      mode: 'document', documentId: 'D02', typingComplete: true };
  }
  if (state.group === 'osAgreement') {
    return { ...state, mode: 'menu', visited: unique(state.visited, 'materials'), documentId: null };
  }
  if (state.group === 'osReceipt' || state.group === 'osReceiptKnown') {
    return { ...state, mode: 'menu', documentId: null };
  }
  if (state.group === 'entrance') return { ...state, mode: 'sit' };
  if (state.group === 'intro') return { ...state, mode: 'receipt', scene: 'together' };
  if (state.group === 'finish') return { ...state, mode: 'done' };
  if (ASK_BRANCHES.has(state.group)) {
    return {
      ...state,
      mode: 'menu',
      visited: unique(state.visited, state.group),
      documentId: null,
      scene: 'together',
    };
  }
  return state;
}

/** One activation reveals a typing line; another advances the conversation. */
export function advance(state) {
  if (state.mode !== 'dialogue') return state;
  if (!state.typingComplete) return completeTyping(state);
  return nextLine(state);
}

/** Kept for callers of the old API: every conversation now waits for a click. */
export function autoAdvance(state) {
  return state;
}

export function sitDown(state) {
  return state.mode === 'sit' ? enterLine(state, 'intro') : state;
}

export function openReceipt(state) {
  return state.mode === 'receipt'
    ? { ...state, mode: 'document', documentId: 'D03' }
    : state;
}

export function finishDocument(state, id) {
  if (state.mode !== 'document' || state.documentId !== id) return state;
  const readDocuments = unique(state.readDocuments, id);
  const firstRead = !state.readDocuments.includes(id);
  if (id === 'D03') {
    if (firstRead) return enterLine({ ...state, readDocuments }, state.visited.includes('zhou') ? 'osReceiptKnown' : 'osReceipt');
    return { ...state, mode: 'menu', documentId: null, readDocuments, scene: 'together' };
  }
  if (state.group === 'materials' && id === 'D01') {
    if (firstRead) return enterLine({ ...state, readDocuments }, 'osProduct');
    return { ...state, documentId: 'D02', readDocuments };
  }
  if (state.group === 'materials' && id === 'D02') {
    if (firstRead) return enterLine({ ...state, readDocuments }, 'osAgreement');
    return {
      ...state,
      mode: 'menu',
      documentId: null,
      readDocuments,
      visited: unique(state.visited, 'materials'),
      scene: 'together',
    };
  }
  return state;
}

export function chooseBranch(state, branch) {
  if (state.mode !== 'menu') return state;
  if (branch === 'skip') return enterLine(state, 'finish');
  return ASK_BRANCHES.has(branch) ? enterLine(state, branch) : state;
}

export function reopenMenu(state) {
  return state.mode === 'done' ? { ...state, mode: 'menu', scene: 'together' } : state;
}

export function restart() {
  return createFlowState();
}
