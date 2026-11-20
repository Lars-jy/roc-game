/** Independent monthly tile rules. No investment, payout or document state lives here. */
export const BOARD_WIDTH = 12.4;
export const BOARD_HEIGHT = 7.5;

export const KINDS = Object.freeze([
  ['cash', '钞票'], ['coin', '金币'], ['lens', '调查'], ['phone', '电话'],
  ['folder', '档案'], ['ledger', '账本'], ['shield', '风控'], ['letter', '函件'],
  ['stock', '股票'], ['bond', '债券'], ['bank', '银行'],
  ['contract', '合约'], ['abacus', '算盘'], ['stamp', '印章'],
].map(([id, label]) => Object.freeze({ id, label, investigation: ['lens', 'phone', 'folder', 'ledger'].includes(id) })));

const BY_KIND = new Map(KINDS.map(kind => [kind.id, kind]));
const VERSION = 3;
const COPIES = 15;
// Keep the approved layout: retired fund/safe sets now use stock/bank faces.
const copiesFor = id => ['stock', 'bank'].includes(id) ? COPIES * 2 : COPIES;
const PREVIOUS_KINDS = [...KINDS, { id: 'safe', investigation: false }];
const LEGACY_KINDS = [...PREVIOUS_KINDS, { id: 'fund', investigation: false }];
const CAPACITY = 7;
const EPSILON = 1e-8;
// Deliberately not serialized: legal order is for verification and the requested
// quick-play button, never a player-facing hint or save field.
const WITNESSES = new WeakMap();

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function overlaps(lower, upper) {
  return upper.z > lower.z && upper.x < lower.x + 1 - EPSILON
    && upper.x + 1 > lower.x + EPSILON && upper.y < lower.y + 1 - EPSILON
    && upper.y + 1 > lower.y + EPSILON;
}

function geometry() {
  const tiles = [];
  const rows = [
    [6, 6, 6, 6, 6], [6, 6, 6, 6, 6],
    [4, 6, 6, 4, 4], [4, 6, 6, 4, 4], [4, 6, 4, 6, 4],
    [4, 6, 4, 4], [4, 4, 6, 4], [4, 4, 4],
  ];
  rows.forEach((layer, z) => layer.forEach((count, row) => {
    for (let col = 0; col < count; col += 1) {
      tiles.push({ x: 3.05 + (6 - count) / 2 + col + (z % 2 ? 0.4 : 0),
        y: 0.2 + (5 - layer.length) / 2 + row + (z % 3) * 0.1, z, region: 'center' });
    }
  }));
  for (let col = 0; col < 6; col += 1) {
    tiles.push({ x: 3.25 + col, y: 6.2, z: 0, region: 'buffer' });
  }
  for (const region of ['left', 'right']) {
    for (let z = 0; z < 27; z += 1) {
      tiles.push({ x: region === 'left' ? 0.55 + z * 0.018 : 10.8 - z * 0.018,
        y: 1.6 + z * 0.075, z, region });
    }
  }
  return tiles.map((tile, index) => ({ id: `tile-${String(index + 1).padStart(3, '0')}`, ...tile, kind: null, removed: false }));
}

const GEOMETRY = geometry();
const GEOMETRY_BY_ID = new Map(GEOMETRY.map(tile => [tile.id, tile]));
// The approved 240 positions are shared by every deal, including restored saves.
// Record their overlaps once; only which IDs remain changes during play.
const covering = new Map(GEOMETRY.map(tile => [tile.id, []]));
const releases = new Map(GEOMETRY.map(tile => [tile.id, []]));
for (const lower of GEOMETRY) {
  for (const upper of GEOMETRY) {
    if (!overlaps(lower, upper)) continue;
    covering.get(lower.id).push(upper.id);
    releases.get(upper.id).push(lower.id);
  }
}

export function pickableMonthlyTiles(board) {
  if (board.status !== 'playing') return new Set();
  const remaining = new Set(board.tiles.filter(tile => !tile.removed).map(tile => tile.id));
  const available = new Set();
  for (const id of remaining) {
    if (!covering.get(id).some(upper => remaining.has(upper))) available.add(id);
  }
  return available;
}

/** Geometry-only legal order, with no preference for matching faces. */
function removalOrder(random) {
  const blockers = new Map(GEOMETRY.map(tile => [tile.id, covering.get(tile.id).length]));
  const available = GEOMETRY.filter(tile => !blockers.get(tile.id)).map(tile => tile.id);
  const order = [];
  while (available.length) {
    const [id] = available.splice(Math.floor(random() * available.length), 1);
    order.push(id);
    for (const lowerId of releases.get(id)) {
      const count = blockers.get(lowerId) - 1;
      blockers.set(lowerId, count);
      if (!count) available.push(lowerId);
    }
  }
  return order;
}

/**
 * Construct a legal inventory sequence with sustained tray pressure. Five different
 * faces open the witness; its first match needs seven picks. Thereafter choices
 * favor carrying several incomplete groups, rather than consecutive easy triples.
 * This proves existence of a solution, not that arbitrary play or a shuffle is safe.
 */
function pressureSequence(random) {
  const remaining = new Map(KINDS.map(kind => [kind.id, copiesFor(kind.id)]));
  const held = new Map(KINDS.map(kind => [kind.id, 0]));
  const sequence = [];
  let occupied = 0;
  while (sequence.length < GEOMETRY.length) {
    const candidates = [];
    for (const kind of KINDS) {
      if (!remaining.get(kind.id)) continue;
      const current = held.get(kind.id);
      const nextOccupied = current === 2 ? occupied - 2 : occupied + 1;
      if (nextOccupied >= CAPACITY) continue;
      // Six unrelated singles cannot be continued without losing.
      if (nextOccupied === 6 && !KINDS.some(other => (other.id === kind.id ? (current + 1) % 3 : held.get(other.id)) === 2)) continue;
      if (sequence.length < 5 && current !== 0) continue;
      if (sequence.length === 5 && current !== 1) continue;
      if (sequence.length === 6 && current !== 2) continue;
      let weight = current === 0 ? (occupied < 5 ? 8 : 0.5) : current === 1 ? 2.5 : occupied >= 5 ? 12 : 0.6;
      weight *= remaining.get(kind.id);
      const repeatsTriple = sequence.at(-1) === kind.id && sequence.at(-2) === kind.id;
      const forcesTripleNext = current === 1 && nextOccupied === 6 && sequence.at(-1) === kind.id
        && !KINDS.some(other => other.id !== kind.id && held.get(other.id) === 2);
      candidates.push({ id: kind.id, weight, avoid: repeatsTriple || forcesTripleNext });
    }
    if (!candidates.length) throw new Error('Tile inventory cannot form a legal pressure sequence');
    const choices = candidates.some(candidate => !candidate.avoid) ? candidates.filter(candidate => !candidate.avoid) : candidates;
    let draw = random() * choices.reduce((sum, candidate) => sum + candidate.weight, 0);
    const chosen = choices.find(candidate => (draw -= candidate.weight) < 0) || choices.at(-1);
    const previous = held.get(chosen.id);
    occupied += previous === 2 ? -2 : 1;
    held.set(chosen.id, (previous + 1) % 3);
    remaining.set(chosen.id, remaining.get(chosen.id) - 1);
    sequence.push(chosen.id);
  }
  if (occupied !== 0) throw new Error('Tile inventory left an incomplete group');
  return sequence;
}

export function createBoard(seed = 20261103) {
  const normalizedSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 20261103;
  const random = rng(normalizedSeed);
  const order = removalOrder(random);
  const kinds = pressureSequence(random);
  const assignments = new Map(order.map((id, index) => [id, kinds[index]]));
  const board = {
    version: VERSION, seed: normalizedSeed,
    tiles: GEOMETRY.map(tile => ({ ...tile, kind: assignments.get(tile.id) })),
    tray: [], reserve: [], matches: 0, investigationMatches: 0,
    tools: { remove: 1, undo: 1, shuffle: 1 }, status: 'playing', lastPick: null,
  };
  WITNESSES.set(board, order);
  return board;
}

/** Initial-board legal order for verification/quick play; never consumes a prop. */
export function getSolution(board) {
  return [...(WITNESSES.get(board) || [])];
}

export function canPick(board, id) {
  if (board.status !== 'playing') return false;
  const tile = board.tiles.find(candidate => candidate.id === id);
  return Boolean(tile && !tile.removed && !board.tiles.some(upper => !upper.removed && overlaps(tile, upper)));
}

function addToTray(board, id, tiles, reserve, source, reserveIndex = null) {
  const tile = tiles.find(candidate => candidate.id === id);
  const byId = new Map(tiles.map(candidate => [candidate.id, candidate]));
  let tray = [...board.tray, id];
  const matching = tray.filter(trayId => byId.get(trayId).kind === tile.kind);
  const matched = matching.length === 3;
  if (matched) {
    const ids = new Set(matching);
    tray = tray.filter(trayId => !ids.has(trayId));
  }
  const status = tray.length >= CAPACITY ? 'failed'
    : !tray.length && !reserve.length && tiles.every(candidate => candidate.removed) ? 'cleared' : 'playing';
  return { ...board, tiles, tray, reserve, status,
    matches: board.matches + Number(matched),
    investigationMatches: board.investigationMatches + Number(matched && BY_KIND.get(tile.kind).investigation),
    lastPick: matched || status !== 'playing' ? null : { id, source, reserveIndex },
  };
}

export function pick(board, id) {
  if (!canPick(board, id)) return board;
  return addToTray(board, id, board.tiles.map(tile => tile.id === id ? { ...tile, removed: true } : tile), board.reserve, 'board');
}

export function returnReserve(board, id) {
  if (board.status !== 'playing') return board;
  const index = board.reserve.indexOf(id);
  if (index === -1) return board;
  return addToTray(board, id, board.tiles, board.reserve.filter(tileId => tileId !== id), 'reserve', index);
}

export function useTool(board, tool) {
  if (board.status !== 'playing' || !['remove', 'undo', 'shuffle'].includes(tool) || board.tools[tool] !== 1) return board;
  if (tool === 'remove') {
    if (!board.tray.length || board.reserve.length) return board;
    const removed = board.tray.slice(0, 3);
    return { ...board, tray: board.tray.slice(removed.length), reserve: removed,
      tools: { ...board.tools, remove: 0 },
      lastPick: removed.includes(board.lastPick?.id) ? null : board.lastPick };
  }
  if (tool === 'undo') {
    const last = board.lastPick;
    if (!last || board.tray.at(-1) !== last.id) return board;
    const tile = board.tiles.find(candidate => candidate.id === last.id);
    if (!tile?.removed) return board;
    const fromReserve = last.source === 'reserve';
    const reserve = [...board.reserve];
    if (fromReserve) reserve.splice(last.reserveIndex, 0, last.id);
    return { ...board,
      tiles: fromReserve ? board.tiles : board.tiles.map(candidate => candidate.id === last.id ? { ...candidate, removed: false } : candidate),
      tray: board.tray.slice(0, -1), reserve, lastPick: null, tools: { ...board.tools, undo: 0 } };
  }
  const remaining = board.tiles.filter(tile => !tile.removed);
  if (remaining.length < 2 || new Set(remaining.map(tile => tile.kind)).size < 2) return board;
  const kinds = shuffled(remaining.map(tile => tile.kind), rng((board.seed ^ 0xA4F316D7 ^ board.matches * 0x9E3779B1) >>> 0));
  // A random permutation can equal its input. Change that no-op without targeting the tray.
  if (remaining.every((tile, i) => tile.kind === kinds[i])) {
    const different = kinds.findIndex(kind => kind !== kinds[0]);
    [kinds[0], kinds[different]] = [kinds[different], kinds[0]];
  }
  const assignment = new Map(remaining.map((tile, i) => [tile.id, kinds[i]]));
  return { ...board,
    tiles: board.tiles.map(tile => tile.removed ? tile : { ...tile, kind: assignment.get(tile.id) }),
    tools: { ...board.tools, shuffle: 0 } };
}

/** Strict persisted-board validation, including inventory and already-earned matches. */
function validateBoardVersion(board, version, kinds, copies) {
  try {
    if (!board || board.version !== version || !Number.isInteger(board.seed) || board.seed < 0 || board.seed > 0xFFFFFFFF) return false;
    if (!Array.isArray(board.tiles) || board.tiles.length !== GEOMETRY.length || !Array.isArray(board.tray) || !Array.isArray(board.reserve)) return false;
    if (!['playing', 'failed', 'cleared'].includes(board.status) || !Number.isInteger(board.matches) || board.matches < 0
      || !Number.isInteger(board.investigationMatches) || board.investigationMatches < 0) return false;
    if (!board.tools || Object.keys(board.tools).length !== 3 || !['remove', 'undo', 'shuffle'].every(tool => [0, 1].includes(board.tools[tool]))) return false;
    const byId = new Map();
    const inventory = new Map(kinds.map(kind => [kind.id, 0]));
    for (const tile of board.tiles) {
      const original = GEOMETRY_BY_ID.get(tile?.id);
      if (!original || byId.has(tile.id) || !inventory.has(tile.kind) || typeof tile.removed !== 'boolean') return false;
      if (!['x', 'y', 'z', 'region'].every(key => tile[key] === original[key])) return false;
      byId.set(tile.id, tile);
      inventory.set(tile.kind, inventory.get(tile.kind) + 1);
    }
    if ([...inventory].some(([id, count]) => count !== copies(id))) return false;
    if (board.tray.length > CAPACITY || board.reserve.length > 3 || board.reserve.length && board.tools.remove !== 0) return false;
    const live = [...board.tray, ...board.reserve];
    if (new Set(live).size !== live.length || live.some(id => !byId.get(id)?.removed)) return false;
    const liveIds = new Set(live);
    const matched = new Map(kinds.map(kind => [kind.id, 0]));
    const trayCounts = new Map(kinds.map(kind => [kind.id, 0]));
    for (const id of board.tray) trayCounts.set(byId.get(id).kind, trayCounts.get(byId.get(id).kind) + 1);
    if ([...trayCounts.values()].some(count => count > 2)) return false;
    for (const tile of board.tiles) if (tile.removed && !liveIds.has(tile.id)) matched.set(tile.kind, matched.get(tile.kind) + 1);
    if ([...matched.values()].some(count => count % 3)) return false;
    const matches = [...matched.values()].reduce((sum, count) => sum + count / 3, 0);
    const investigation = kinds.filter(kind => kind.investigation).reduce((sum, kind) => sum + matched.get(kind.id) / 3, 0);
    if (board.matches !== matches || board.investigationMatches !== investigation) return false;
    const clear = board.tiles.every(tile => tile.removed) && !live.length;
    if (board.status === 'playing' && (board.tray.length >= CAPACITY || clear)) return false;
    if (board.status === 'failed' && board.tray.length !== CAPACITY) return false;
    if (board.status === 'cleared' && !clear) return false;
    if (board.lastPick !== null) {
      const last = board.lastPick;
      if (!last || board.status !== 'playing' || last.id !== board.tray.at(-1) || !['board', 'reserve'].includes(last.source)) return false;
      if (last.source === 'reserve' && (!Number.isInteger(last.reserveIndex) || last.reserveIndex < 0 || last.reserveIndex > board.reserve.length || board.tools.remove !== 0)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateBoard(board) {
  return validateBoardVersion(board, VERSION, KINDS, copiesFor);
}

/** Replace retired faces without discarding positions, props or live cards. */
export function upgradeBoard(board) {
  if (validateBoard(board)) return board;
  const validPrevious = board?.version === 2
    ? validateBoardVersion(board, 2, PREVIOUS_KINDS, id => id === 'stock' ? COPIES * 2 : COPIES)
    : validateBoardVersion(board, 1, LEGACY_KINDS, () => COPIES);
  if (!validPrevious) return null;
  const replacements = { fund: 'stock', safe: 'bank' };
  const tiles = board.tiles.map(tile => ({ ...tile, kind: replacements[tile.kind] || tile.kind }));
  const byId = new Map(tiles.map(tile => [tile.id, tile]));
  const removed = new Set();
  for (const kind of ['stock', 'bank']) {
    const held = board.tray.filter(id => byId.get(id).kind === kind);
    if (held.length >= 3) held.slice(0, 3).forEach(id => removed.add(id));
  }
  const tray = board.tray.filter(id => !removed.has(id));
  const next = { ...board, version: VERSION, tiles, tray,
    matches: board.matches + removed.size / 3,
    lastPick: removed.size ? null : board.lastPick,
    status: tray.length >= CAPACITY ? 'failed' : board.status === 'cleared' ? 'cleared' : 'playing',
  };
  return validateBoard(next) ? next : null;
}
