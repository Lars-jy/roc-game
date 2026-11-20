// Four-month body demo. Money is always integer cents; interest is rounded only
// after all principal-days in one natural month have been combined.
export const FINANCE_VERSION = 1;
export const INITIAL_CASH = 1_000_000;
export const BOARD_REWARD = 60_000;
export const MONTH_DAYS = Object.freeze([30, 31, 30, 31]);

const clone = value => JSON.parse(JSON.stringify(value));
const money = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000;
const idString = value => typeof value === 'string' && value.length > 0 && value.length <= 160;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const roundRatio = (numerator, denominator) => Math.floor((numerator + denominator / 2) / denominator);
const dueInterest = (units, days) => roundRatio(units * 8, days * 100);
const exitCash = (amount, quote) => roundRatio(amount * quote, 100);

function hash(text) {
  let value = 2166136261;
  for (const character of String(text)) value = Math.imul(value ^ character.codePointAt(0), 16777619) >>> 0;
  // Final mixing avoids correlated adjacent month labels.
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}

function draws(seed) {
  return {
    quotes: Array.from({ length: 4 }, (_, month) => 60 + hash(`${seed}|quote|${month}`) % 31),
    outcomes: Array.from({ length: 4 }, (_, month) => hash(`${seed}|approval|${month}`) % 100 < 40),
  };
}

function nextDate(state) {
  if (state.day === 1) return { month: state.month, day: 2 };
  return state.month < 3 ? { month: state.month + 1, day: 1 } : null;
}

export function createFinance(seed = Date.now()) {
  const savedSeed = String(seed).slice(0, 160);
  const random = draws(savedSeed);
  return {
    version: FINANCE_VERSION, initial: INITIAL_CASH,
    cash: INITIAL_CASH, principal: 0, totalInterest: 0,
    totalInvested: 0, totalReturned: 0, totalLoss: 0,
    unpaidInterest: 0, earnedTile: 0, month: 0, day: 1,
    crisis: false, ledger: [], lots: [], requests: [], settlements: [],
    _seed: savedSeed, _quotes: random.quotes, _outcomes: random.outcomes,
    _boardPaid: [false, false, false, false], _processed: [], _crises: [],
    _accrual: { month: 0, weightedPrincipalDays: 0, throughDay: 0 },
  };
}

function entry(state, value) {
  if (!idString(value.id) || state.ledger.some(row => row.id === value.id)) throw new Error('这条资金记录已存在');
  const row = {
    month: state.month, day: state.day, amount: 0,
    cashDelta: 0, principalDelta: 0, lossDelta: 0, unpaidDelta: 0,
    ...value,
  };
  state.cash += row.cashDelta;
  state.principal += row.principalDelta;
  state.totalLoss += row.lossDelta;
  state.unpaidInterest += row.unpaidDelta;
  state.ledger.push(row);
}

function enterCrisis(state, events) {
  if (state.crisis) return;
  state.crisis = true;
  state._crises.push({ month: state.month, day: state.day });
  entry(state, { id: `sys:crisis:${state.month}`, type: 'crisis', label: '本月阶段性付款延期' });
  events.push({ type: 'crisis', month: state.month, day: state.day });
}

function accrueToMonthEnd(state) {
  const days = MONTH_DAYS[state.month];
  state._accrual.weightedPrincipalDays += state.principal * (days - state._accrual.throughDay);
  state._accrual.throughDay = days;
}

function settleMonth(state, finishedMonth, accrual, events) {
  const amount = dueInterest(accrual.weightedPrincipalDays, MONTH_DAYS[finishedMonth]);
  const paid = !state.crisis;
  state.settlements.push({
    month: finishedMonth, days: MONTH_DAYS[finishedMonth],
    weightedPrincipalDays: accrual.weightedPrincipalDays,
    amount, paid, paymentMonth: state.month, paymentDay: 1,
  });
  entry(state, {
    id: `sys:interest:${finishedMonth}`, type: paid ? 'interest-paid' : 'interest-unpaid',
    label: `${finishedMonth + 4}月应计收益${paid ? '实际到账' : '暂未支付'}`,
    sourceMonth: finishedMonth, amount,
    cashDelta: paid ? amount : 0, unpaidDelta: paid ? 0 : amount,
  });
  if (paid) state.totalInterest += amount;
  events.push({ type: paid ? 'interest-paid' : 'interest-unpaid', amount, sourceMonth: finishedMonth, month: state.month, day: state.day });
}

function extinguishLots(state, requested, quote) {
  let remaining = requested, totalTaken = 0, previousCash = 0;
  for (const lot of state.lots) {
    const taken = Math.min(remaining, lot.remaining);
    totalTaken += taken;
    const allocatedCash = exitCash(totalTaken, quote) - previousCash;
    previousCash += allocatedCash;
    lot.remaining -= taken;
    lot.returned += allocatedCash;
    lot.loss += taken - allocatedCash;
    remaining -= taken;
    if (remaining === 0) break;
  }
  if (remaining !== 0) throw new Error('申请本金超出未结清余额');
}

const transactionTypes = new Set(['invest', 'exit', 'boardReward', 'replayReward']);

export function reduceFinance(current, action) {
  const fail = error => ({ state: current, error, events: [] });
  if (!validateFinance(current)) return fail('当前资金记录无效，请恢复案件进度');
  if (!object(action) || typeof action.type !== 'string') return fail('资金操作无效');
  if (transactionTypes.has(action.type)) {
    if (!idString(action.id) || action.id.startsWith('sys:')) return fail('本次操作缺少有效记录号');
    if (current._processed.includes(action.id)) return { state: current, error: null, events: [], duplicate: true };
  }
  if (action.expectedMonth !== undefined && action.expectedMonth !== current.month || action.expectedDay !== undefined && action.expectedDay !== current.day) return fail('日期已经变化，请重新确认');
  const state = clone(current);
  const events = [];
  try {
    switch (action.type) {
      case 'invest': {
        if (!money(action.amount) || action.amount <= 0) return fail('请输入有效认购金额');
        if (action.amount > state.cash) return fail('实际可用现金不足');
        entry(state, { id: action.id, type: 'invest', label: '认购转出', amount: action.amount, cashDelta: -action.amount, principalDelta: action.amount });
        state.totalInvested += action.amount;
        const firstDue = { month: state.month + 1, day: 1 };
        state.lots.push({ id: action.id, month: state.month, day: state.day, amount: action.amount, remaining: action.amount, returned: 0, loss: 0, firstDue });
        events.push({ type: 'invested', amount: action.amount, month: state.month, day: state.day, firstDue });
        break;
      }
      case 'advanceDate': {
        if (!Number.isInteger(action.month) || ![1, 2].includes(action.day) || action.month < 0 || action.month > 3) return fail('目标日期不属于本阶段');
        if (action.month === state.month && action.day === state.day) return { state: current, error: null, events: [], duplicate: true };
        const target = nextDate(state);
        if (!target || action.month !== target.month || action.day !== target.day) return fail('只能前往下一个开放日期');
        if (action.crisis !== undefined && typeof action.crisis !== 'boolean') return fail('付款状态无效');
        if (target.month === state.month) {
          state._accrual.weightedPrincipalDays += state.principal;
          state._accrual.throughDay = 1;
          state.day = 2;
          if (action.crisis) enterCrisis(state, events);
        } else {
          accrueToMonthEnd(state);
          const oldMonth = state.month, oldAccrual = { ...state._accrual };
          state.month = target.month; state.day = 1; state.crisis = false;
          state._accrual = { month: state.month, weightedPrincipalDays: 0, throughDay: 0 };
          if (action.crisis) enterCrisis(state, events);
          settleMonth(state, oldMonth, oldAccrual, events);
        }
        events.push({ type: 'date-changed', month: state.month, day: state.day });
        break;
      }
      case 'setCrisis':
        if (action.active !== true) return fail('本月延期只能在次月恢复');
        if (state.crisis) return { state: current, error: null, events: [], duplicate: true };
        enterCrisis(state, events);
        break;
      case 'exit': {
        if (!money(action.amount) || action.amount <= 0 || action.amount > state.principal) return fail('申请本金超出未结清余额');
        if (typeof action.reason !== 'string' || !action.reason.trim() || action.reason.length > 2000) return fail('请填写本次退出理由');
        if (state.requests.some(request => request.month === state.month)) return fail('本月已经正式申请过退出');
        const quote = state._quotes[state.month], success = state._outcomes[state.month];
        const received = success ? exitCash(action.amount, quote) : 0;
        const loss = success ? action.amount - received : 0;
        const request = { id: action.id, month: state.month, day: state.day, amount: action.amount, reason: action.reason, quote, success, received, loss };
        state.requests.push(request);
        if (success) {
          extinguishLots(state, action.amount, quote);
          entry(state, { id: action.id, type: 'exit-approved', label: '折价退出实际到账', amount: received, requested: action.amount, quote, cashDelta: received, principalDelta: -action.amount, lossDelta: loss });
          state.totalReturned += received;
        } else entry(state, { id: action.id, type: 'exit-refused', label: '退出申请未获受理', amount: 0, requested: action.amount, quote });
        events.push({ type: success ? 'exit-approved' : 'exit-refused', amount: received, requested: action.amount, quote, loss, reason: action.reason, month: state.month, day: state.day });
        break;
      }
      case 'boardReward':
        if (action.month !== state.month) return fail('这笔清盘奖励不属于当前月份');
        if (state._boardPaid[state.month]) return { state: current, error: null, events: [], duplicate: true };
        state._boardPaid[state.month] = true;
        state.earnedTile += BOARD_REWARD;
        entry(state, { id: action.id, type: 'board-reward', label: '当月首次清盘奖金', amount: BOARD_REWARD, cashDelta: BOARD_REWARD });
        events.push({ type: 'board-reward', amount: BOARD_REWARD, month: state.month });
        break;
      case 'replayReward':
        if (action.month !== state.month || state.day !== 2 || !Number.isSafeInteger(action.attempt) || action.attempt < 1) return fail('这笔重开清盘奖励不属于当前牌局');
        if (state.ledger.some(row => row.type === 'board-replay-reward' && row.month === state.month && row.attempt === action.attempt)) return { state: current, error: null, events: [], duplicate: true };
        state.earnedTile += BOARD_REWARD;
        entry(state, { id: action.id, type: 'board-replay-reward', label: '重开牌局清盘奖金', amount: BOARD_REWARD, cashDelta: BOARD_REWARD, attempt: action.attempt });
        events.push({ type: 'board-reward', amount: BOARD_REWARD, month: state.month, attempt: action.attempt, replay: true });
        break;
      default: return fail('未知资金操作');
    }
    if (transactionTypes.has(action.type)) state._processed.push(action.id);
    if (!validateFinance(state)) return fail('资金记录校验失败，本次操作未执行');
    return { state, error: null, events };
  } catch (error) { return fail(error.message || '资金操作未执行'); }
}

function sameDraws(state) {
  const expected = draws(state._seed);
  return JSON.stringify(state._quotes) === JSON.stringify(expected.quotes)
    && JSON.stringify(state._outcomes) === JSON.stringify(expected.outcomes);
}

export function validateFinance(state) {
  try {
    if (!object(state) || state.version !== FINANCE_VERSION || state.initial !== INITIAL_CASH || typeof state._seed !== 'string' || state._seed.length > 160) return false;
    if (!Number.isInteger(state.month) || state.month < 0 || state.month > 3 || ![1, 2].includes(state.day) || typeof state.crisis !== 'boolean' || !sameDraws(state)) return false;
    const funds = ['cash', 'principal', 'totalInterest', 'totalInvested', 'totalReturned', 'totalLoss', 'unpaidInterest', 'earnedTile'];
    if (!funds.every(key => money(state[key]))) return false;
    if (state.cash !== INITIAL_CASH + state.earnedTile + state.totalInterest + state.totalReturned - state.totalInvested) return false;
    if (state.principal !== state.totalInvested - state.totalReturned - state.totalLoss) return false;
    if (!['ledger', 'lots', 'requests', 'settlements', '_processed', '_crises'].every(key => Array.isArray(state[key]) && state[key].length <= 10_000)) return false;
    if (!Array.isArray(state._boardPaid) || state._boardPaid.length !== 4 || !state._boardPaid.every((paid, month) => typeof paid === 'boolean' && (month <= state.month || !paid))) return false;
    const replays = state.ledger.filter(row => row.type === 'board-replay-reward');
    if (state.earnedTile !== (state._boardPaid.filter(Boolean).length + replays.length) * BOARD_REWARD) return false;
    const replayKeys = new Set();
    for (const row of replays) {
      const key = `${row.month}:${row.attempt}`;
      if (!Number.isSafeInteger(row.attempt) || row.attempt < 1 || row.day !== 2 || replayKeys.has(key)) return false;
      replayKeys.add(key);
    }
    if (new Set(state._processed).size !== state._processed.length || !state._processed.every(idString)) return false;
    const atOrBefore = item => Number.isInteger(item.month) && item.month >= 0 && item.month <= state.month && [1, 2].includes(item.day) && (item.month < state.month || item.day <= state.day);
    const ids = new Set();
    let balance = INITIAL_CASH, principal = 0, loss = 0, unpaid = 0, invested = 0, returned = 0, interest = 0, board = 0, lastDate = 0;
    for (const row of state.ledger) {
      if (!object(row) || !idString(row.id) || ids.has(row.id) || !atOrBefore(row) || !money(row.amount) || typeof row.label !== 'string') return false;
      ids.add(row.id);
      const date = row.month * 2 + row.day - 1;
      if (date < lastDate) return false;
      lastDate = date;
      if (![row.cashDelta, row.principalDelta, row.lossDelta, row.unpaidDelta].every(Number.isSafeInteger)) return false;
      let expected;
      switch (row.type) {
        case 'invest': expected = [-row.amount, row.amount, 0, 0]; invested += row.amount; break;
        case 'board-reward': case 'board-replay-reward': expected = [row.amount, 0, 0, 0]; board += row.amount; if (row.amount !== BOARD_REWARD) return false; break;
        case 'interest-paid': expected = [row.amount, 0, 0, 0]; interest += row.amount; break;
        case 'interest-unpaid': expected = [0, 0, 0, row.amount]; break;
        case 'exit-approved':
          if (!money(row.requested) || !Number.isInteger(row.quote) || row.quote !== state._quotes[row.month] || row.amount !== exitCash(row.requested, row.quote)) return false;
          expected = [row.amount, -row.requested, row.requested - row.amount, 0]; returned += row.amount; break;
        case 'exit-refused':
          if (row.amount !== 0 || !money(row.requested) || row.quote !== state._quotes[row.month]) return false;
          expected = [0, 0, 0, 0]; break;
        case 'crisis': if (row.amount !== 0) return false; expected = [0, 0, 0, 0]; break;
        default: return false;
      }
      if ([row.cashDelta, row.principalDelta, row.lossDelta, row.unpaidDelta].some((value, index) => value !== expected[index])) return false;
      balance += row.cashDelta; principal += row.principalDelta; loss += row.lossDelta; unpaid += row.unpaidDelta;
      if (balance < 0 || principal < 0) return false;
    }
    if (balance !== state.cash || principal !== state.principal || loss !== state.totalLoss || unpaid !== state.unpaidInterest || invested !== state.totalInvested || returned !== state.totalReturned || interest !== state.totalInterest || board !== state.earnedTile) return false;
    const lotIds = new Set();
    for (const lot of state.lots) {
      if (!object(lot) || !idString(lot.id) || lotIds.has(lot.id) || !atOrBefore(lot) || !['amount', 'remaining', 'returned', 'loss'].every(key => money(lot[key]))) return false;
      lotIds.add(lot.id);
      if (lot.amount !== lot.remaining + lot.returned + lot.loss || lot.amount <= 0 || lot.firstDue?.month !== lot.month + 1 || lot.firstDue?.day !== 1) return false;
      const matching = state.ledger.find(row => row.id === lot.id && row.type === 'invest');
      if (!matching || matching.month !== lot.month || matching.day !== lot.day || matching.amount !== lot.amount) return false;
    }
    if (state.lots.length !== state.ledger.filter(row => row.type === 'invest').length || state.lots.reduce((sum, lot) => sum + lot.remaining, 0) !== state.principal || state.lots.reduce((sum, lot) => sum + lot.returned, 0) !== state.totalReturned || state.lots.reduce((sum, lot) => sum + lot.loss, 0) !== state.totalLoss) return false;
    const requestMonths = new Set();
    for (const request of state.requests) {
      if (!object(request) || !idString(request.id) || !atOrBefore(request) || requestMonths.has(request.month) || !money(request.amount) || request.amount <= 0 || typeof request.reason !== 'string' || !request.reason.trim() || request.reason.length > 2000) return false;
      requestMonths.add(request.month);
      if (request.quote !== state._quotes[request.month] || request.success !== state._outcomes[request.month] || request.received !== (request.success ? exitCash(request.amount, request.quote) : 0) || request.loss !== (request.success ? request.amount - request.received : 0)) return false;
      const matching = state.ledger.find(row => row.id === request.id && row.type === (request.success ? 'exit-approved' : 'exit-refused'));
      if (!matching || matching.month !== request.month || matching.day !== request.day || matching.requested !== request.amount || matching.amount !== request.received) return false;
    }
    if (state.requests.length !== state.ledger.filter(row => row.type.startsWith('exit-')).length) return false;
    for (let month = 0; month < 4; month++) if (state.ledger.filter(row => row.type === 'board-reward' && row.month === month).length !== Number(state._boardPaid[month])) return false;
    if (state._processed.length !== state.lots.length + state.requests.length + state._boardPaid.filter(Boolean).length + replays.length || !state._processed.every(id => ids.has(id))) return false;
    const crisisMonths = new Set();
    for (const crisis of state._crises) {
      if (!object(crisis) || !atOrBefore(crisis) || crisisMonths.has(crisis.month)) return false;
      crisisMonths.add(crisis.month);
      if (!state.ledger.some(row => row.type === 'crisis' && row.month === crisis.month && row.day === crisis.day)) return false;
    }
    if (state.crisis !== crisisMonths.has(state.month) || state.ledger.filter(row => row.type === 'crisis').length !== state._crises.length) return false;
    // Rebuild interest principal-days from actual dated transactions. All day-1
    // changes count on day 1; successful exits remove the full requested capital.
    let runningPrincipal = 0;
    if (state.settlements.length !== state.month) return false;
    for (let month = 0; month <= state.month; month++) {
      const endDay = month < state.month ? MONTH_DAYS[month] : state.day - 1;
      let units = 0;
      for (let day = 1; day <= MONTH_DAYS[month]; day++) {
        runningPrincipal += state.ledger.filter(row => row.month === month && row.day === day).reduce((sum, row) => sum + row.principalDelta, 0);
        if (day <= endDay) units += runningPrincipal;
      }
      if (month === state.month) {
        if (!object(state._accrual) || state._accrual.month !== month || state._accrual.throughDay !== endDay || state._accrual.weightedPrincipalDays !== units) return false;
      } else {
        const settlement = state.settlements[month];
        const amount = dueInterest(units, MONTH_DAYS[month]);
        if (!object(settlement) || settlement.month !== month || settlement.days !== MONTH_DAYS[month] || settlement.weightedPrincipalDays !== units || settlement.amount !== amount || typeof settlement.paid !== 'boolean' || settlement.paymentMonth !== month + 1 || settlement.paymentDay !== 1) return false;
        const matching = state.ledger.find(row => row.id === `sys:interest:${month}`);
        if (!matching || matching.month !== month + 1 || matching.day !== 1 || matching.sourceMonth !== month || matching.amount !== amount || matching.type !== (settlement.paid ? 'interest-paid' : 'interest-unpaid')) return false;
        const paymentIndex = state.ledger.indexOf(matching);
        const crisisIndex = state.ledger.findIndex(row => row.type === 'crisis' && row.month === month + 1);
        if (settlement.paid !== !(crisisIndex >= 0 && crisisIndex < paymentIndex)) return false;
      }
    }
    if (state.ledger.filter(row => row.type.startsWith('interest-')).length !== state.settlements.length) return false;
    return true;
  } catch { return false; }
}

/** Player-visible accounting only. No seed, future quote, future result or RNG. */
export function publicFinance(state) {
  return clone({
    initial: state.initial, cash: state.cash, principal: state.principal,
    totalInterest: state.totalInterest, totalInvested: state.totalInvested,
    totalReturned: state.totalReturned, totalLoss: state.totalLoss,
    unpaidInterest: state.unpaidInterest, earnedTile: state.earnedTile,
    month: state.month, day: state.day, crisis: state.crisis,
    ledger: state.ledger, lots: state.lots, requests: state.requests,
    settlements: state.settlements,
    quote: state._quotes[state.month],
    canRequest: state.principal > 0 && !state.requests.some(request => request.month === state.month),
    rewardedThisMonth: state._boardPaid[state.month], nextDate: nextDate(state),
  });
}
