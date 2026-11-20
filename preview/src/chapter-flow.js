const READABLE = new Set(['D01', 'D02', 'D03']);
const BRANCHES = new Set(['materials', 'lu', 'zhou']);
const copy = value => JSON.parse(JSON.stringify(value));
const runId = value => typeof value === 'string' && value.length > 0 && value.length <= 160;
const list = (value, allowed) => Array.isArray(value) && value.length <= 16
  && value.every(item => typeof item === 'string')
  && new Set(value).size === value.length && value.every(item => allowed.has(item));

/** The chapter journal contains no wallet, position, transaction or payout data. */
export function restoreChapter(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : copy(raw);
    if (!value || value.version !== 1 || !['prologue', 'main', 'complete'].includes(value.stage)
      || !runId(value.runId) || typeof value.pendingNew !== 'boolean'
      || !list(value.readDocs, READABLE) || !list(value.visitedBranches, BRANCHES)) return null;
    return { version: 1, stage: value.stage, runId: value.runId, pendingNew: value.pendingNew,
      readDocs: [...value.readDocs], visitedBranches: [...value.visitedBranches] };
  } catch { return null; }
}

export function hasMainProgress(value) {
  if(value?.flow==='cards') return Boolean(value.complete || value.month>0 || value.window!=='invest'
    || value.finance.totalInvested>0 || value.finance.earnedTile>0 || value.read.length
    || value.investigation.earned>0 || value.board.tray.length || value.board.matches>0);
  return Boolean(value && (value.finance.decided || value.finance.phase > 0
    || value.finance.totalInvested > 0 || value.finance.pendingTile > 0
    || value.finance.earnedTile > 0 || value.board.matches > 0
    || value.meta.read.length > 0 || Object.keys(value.meta.answers).length > 0
    || value.meta.sent.length > 0));
}

function receptionData(data) {
  if (!Array.isArray(data.readDocs) || !Array.isArray(data.visitedBranches)
    || data.readDocs.length > 16 || data.visitedBranches.length > 16
    || !data.readDocs.every(item => typeof item === 'string')
    || !data.visitedBranches.every(item => typeof item === 'string')) return null;
  const readDocs = [...new Set(data.readDocs.filter(id => READABLE.has(id)))];
  const visitedBranches = [...new Set(data.visitedBranches.filter(id => BRANCHES.has(id)))];
  // The existing reception only reaches its final action after the receipt.
  if (!readDocs.includes('D03')) return null;
  return { readDocs, visitedBranches };
}

/** Coordinates actual iframe messages; every side effect is injected for tests. */
export function createChapterFlow({ origin, getFrameSource, readMain, readMainRaw,
  initialChapter = null, newRunId, saveChapter, loadFrame, postToFrame,
  showEntry, showConfirmation, showMissingMain = () => {}, revealFrame, questionsComplete = () => {},
  mainURL = './main-demo.html?game=1', endingComplete = () => {} }) {
  let chapter = restoreChapter(initialChapter);
  let active = 'entry';
  let startSent = false;
  let mainStarted = false;
  let completeNotified = false;

  function save() { saveChapter(copy(chapter)); }
  function load(stage) {
    active = stage; startSent = false; mainStarted = false; completeNotified = false;
    loadFrame(stage === 'prologue' ? './prologue.html?game=1' : mainURL);
  }
  function menu() {
    active = 'entry';
    const main = readMain();
    const canContinue = Boolean(chapter || hasMainProgress(main));
    showEntry({ canContinue, continueLabel: chapter?.pendingNew && chapter.stage === 'prologue' ? '继续赴约' : main?.complete ? '查看调查报告' : '继续调查' });
  }
  function startNew({ confirmed = false } = {}) {
    const main = readMain();
    if (!confirmed && (hasMainProgress(main) || readMainRaw() && !main || chapter)) { showConfirmation(); return false; }
    chapter = { version: 1, stage: 'prologue', runId: newRunId(), pendingNew: true, readDocs: [], visitedBranches: [] };
    save(); load('prologue'); return true;
  }
  function continueCase() {
    if (chapter?.pendingNew) { load(chapter.stage); return true; }
    // A completed intro journal is not a replacement for an actual money save.
    // Never turn Continue into an unconfirmed fresh 10,000-yuan case.
    if (!readMainRaw()) { showMissingMain(); return false; }
    const main = readMain();
    if (!main && !chapter) return false;
    const candidateRun = main?.flow==='cards' ? main.seed : main?.meta?.chapterRunId;
    const existingRun = runId(candidateRun) ? candidateRun : null;
    const sameRun = chapter && existingRun === chapter.runId;
    chapter = { version: 1, stage: 'main', runId: existingRun || chapter?.runId || newRunId(), pendingNew: false,
      readDocs: sameRun ? [...chapter.readDocs] : [], visitedBranches: sameRun ? [...chapter.visitedBranches] : [] };
    save(); load('main'); return true;
  }
  function loaded() { if (active === 'prologue') revealFrame(); }
  function retry() { if (active === 'prologue' || active === 'main') { load(active); return true; } return false; }
  function message(event) {
    if (event.origin !== origin || event.source !== getFrameSource() || !event.data || typeof event.data.type !== 'string') return false;
    const data = event.data;
    if (data.type === 'chapter:prologue-complete' && active === 'prologue') {
      const reception = receptionData(data); if (!reception) return false;
      chapter = { ...chapter, stage: 'main', ...reception };
      save(); load('main'); return true;
    }
    if (data.type === 'chapter:main-ready' && active === 'main' && !mainStarted) {
      startSent = true;
      postToFrame({ type: 'chapter:start-main', runId: chapter.runId, startFresh: chapter.pendingNew,
        readDocs: [...chapter.readDocs], visitedBranches: [...chapter.visitedBranches] }, origin);
      return true;
    }
    if (data.type === 'chapter:main-started' && active === 'main' && startSent && !mainStarted && data.runId === chapter.runId) {
      mainStarted = true; chapter.pendingNew = false; save(); revealFrame(); return true;
    }
    if (data.type === 'chapter:restart-prologue' && active === 'main' && mainStarted) {
      return startNew({ confirmed: true });
    }
    if(data.type==='chapter:case-reset' && active==='main' && mainStarted) {
      const main=readMain();
      if(main?.flow!=='cards' || main.complete || !runId(data.caseSeed) || main.seed!==data.caseSeed) return false;
      chapter={...chapter,stage:'main',runId:main.seed,pendingNew:false,readDocs:[],visitedBranches:[]};
      completeNotified=false;save();return true;
    }
    if(data.type==='chapter:ending-complete' && active==='main' && mainStarted && !completeNotified) {
      const main=readMain();
      if(main?.flow!=='cards' || !main.complete || data.caseSeed!==main.seed || main.seed!==chapter.runId) return false;
      completeNotified=true;chapter={...chapter,stage:'complete'};save();endingComplete();return true;
    }
    if (data.type === 'chapter:questions-complete' && active === 'main' && mainStarted && data.count === 8 && !completeNotified) {
      completeNotified = true; questionsComplete(); return true;
    }
    return false;
  }
  return { menu, startNew, continueCase, loaded, retry, message,
    snapshot: () => ({ active, chapter: chapter ? copy(chapter) : null, startSent, mainStarted }) };
}
