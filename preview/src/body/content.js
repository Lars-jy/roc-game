import { DOCUMENT_MAP } from '../materials.js';
import { QUESTIONS as PREVIOUS_QUESTIONS, getQuestionBranch } from '../main-demo-content.js';
import { publicFinance } from './finance.js';

export const charInfo = Object.freeze({
  lu: { id: 'lu', name: '陆衡', role: '客户经理', portrait: 'snake' },
  zhou: { id: 'zhou', name: '周岚', role: '你的朋友', portrait: 'sheep' },
  lin: { id: 'lin', name: '林乔', role: '财务经办', portrait: 'rabbit' },
  me: { id: 'me', name: '我', role: '调查者', portrait: null },
});

/** These point to records and headings, never supply a suspicion or its answer. */
export const DOC_HINTS = Object.freeze({
  D01: '可查看“项目介绍”和“收益与支付方式”，再对照认购协议的条款。',
  D02: '可查看批次、锁定期限、收益支付日及退出申请条款。历史客户与本人条款分别登记。',
  D03: '可查看每张回单的入账日期、金额、付款人和用途摘要。',
  D04: '可查看JD-01项目及1—3月“可分配经营收益”，并与同项目同期业务核验对照。',
  D05: '可查看核验范围、项目编号、期间、委托及成交记录、经营收益。',
  D06: '可查看C户与M户的账户名称、控制关系和核验期间。',
  D07: '可查看完整期间、期初期末余额、入款及PAY／TRF执行号；与M户及付款资料对照。',
  D08: '可查看期初期末余额及TRF执行号，与C户对应记录对照。',
  D09: '可查看各客户的认购日期、合同金额、批次、锁定期限和约定支付日。',
  D10: '可查看付款指令中的来源流水、收款客户、用途及PAY执行号。',
  D11: '可查看到账日期、实际金额及交易流水号，与同期间付款资料对照。',
  D12A: '可查看历史到期日、应付本金、累计收益及资料截止日期。',
  D12B: '可查看每次通知的发生日期、说明、影响期间，并与实际付款登记对照。',
  D13: '可查看资产盘点截止日、银行余额、其他资产和资金口径。',
  P01: '可查看本人认购日期、本金、首次约定结算日、日息及折价退出条款。',
  P02: '可查看本人实际入账日期、金额和执行编号。',
  P03: '可对照本人到账回单与本人资金登记的相同执行编号。',
  C01: '可查看每月申请金额、报价、审批结果和实际到账。',
  C02: '可查看本人资金登记的日期、类型、现金变动、本金变动及欠付记录。',
});

const questionMonth = { Q1: 0, Q2: 1, Q3: 1, Q4: 2, Q5: 2, Q6: 3, Q7: 3, Q8: 3 };
const questionHints = {
  Q1: '查看D03的“入账信息”、付款方和用途摘要。',
  Q2: '对照D02的支付条款与D09的认购日期、锁定期限、约定支付日；题目截止日为3月31日。',
  Q3: '对照D04与D05的项目编号、期间及经营收益栏目。',
  Q4: '查看D06账户关系，对照D07与D08同一截止日的余额和TR执行号。',
  Q5: '对照D09的合同登记范围与D07的流水起止期间、入款记录。',
  Q6: '查看D07的来源和PAY执行号，再与D10或D11的相同编号对照。',
  Q7: '回看D12B的发生日期和解释，再对照D05、D06、D07及D10或D11。',
  Q8: '可以回看资料夹、人物消息和本人资金记录；不确定的地方也可以如实写下。',
};

export const QUESTIONS = PREVIOUS_QUESTIONS.map(question => ({
  ...question, phaseMin: questionMonth[question.id], hint: questionHints[question.id],
  ...(question.id === 'Q7' ? {
    title: '此前的解释说得通吗',
    prompt: '此前发生延期时，陆衡以系统调整解释，并表示可以另行申请追加。结合已经核实的经营与付款资料，哪项判断最有依据？',
    options: [
      { id: 'A', text: '延期或随后恢复都只是技术问题，不必再核对资金来源。' },
      { id: 'B', text: '以前付过收益，所以追加能保障本金安全。' },
      { id: 'C', text: '只要发生一次延期，就能断定全部资金都被挪走。' },
      { id: 'D', text: '技术解释不能消除已经核实的付款来源问题，追加也没有独立支付保证。' },
    ],
  } : {}),
}));
export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map(question => [question.id, question]));

const date = (month, day = 1) => `${month + 4}月${day}日`;
const yuan = cents => Number.isSafeInteger(cents) ? cents / 100 : 0;
const money = cents => yuan(cents).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const table = (title, headers, rows, moneyCols = []) => ({ kind: 'table', title, headers, rows, moneyCols });
const text = (title, body) => ({ kind: 'text', title, body });
const base = (state, id, title, type = 'spreadsheet', issuer = '金鼎财富 · 本人业务登记') => ({
  id, title, shortTitle: title, type, issuer, date: date(state.month, state.finance.day),
  number: `JD-${id}-PLAYER`, blocks: [],
});

/** Same structure as materials.renderDocument accepts; no view can move money. */
export function getDoc(state, id) {
  if (!state?.available?.includes(id)) return null;
  if (DOCUMENT_MAP[id] && id !== 'D12B') return DOCUMENT_MAP[id];
  const f = state.finance;
  if (id === 'D12B') {
    const doc = base(state, id, '阶段性付款通知及历史登记', 'contract');
    doc.blocks = [
      table('已送达通知', ['通知编号', '发生日期', '说明', '当前记录'], state.crises.history.map(item => [
        item.id, date(item.month, item.day), '部分收益支付因系统调整暂停处理',
        item.month === state.month ? '发生当期；实际支付以登记为准' : '历史通知；该期欠付另列，后续各期支付以实际登记为准',
      ])),
      text('本期安排', '本通知只登记实际发生的阶段性异常。已经入账的款项不追回；过去应付未付金额继续登记，不因后续恢复自动补发。'),
      text('申请与支付', '追加不构成优先支付或本金安全保证。本人折价退出按独立申请结果登记，不保证审批成功。'),
    ];
    return doc;
  }
  if (id === 'P01') {
    const doc = base(state, id, '本人认购确认与业务条款', 'contract');
    doc.blocks = [
      table('本人认购登记', ['认购编号', '认购日期', '认购本金', '未结清本金', '首次约定结算日'], (f.lots || []).map(lot => [
        lot.id, date(lot.month, lot.day), yuan(lot.amount), yuan(lot.remaining), date(lot.firstDue.month, lot.firstDue.day),
      ]), [2, 3]),
      text('认购状态', f.lots.length ? '仅列已实际确认的认购，收益不自动复投。' : '尚未确认认购。以下为供查阅条款，不是投资或银行付款凭证。'),
      text('日息与结算', '月约定8%单利。按自然月实际天数和每日实际未结清本金分段计息，同月合并汇总到分。认购日计息；折价结清的申请本金当日停止计息。首次约定结算为下个月月初，不足整月按实际持有天数折算。'),
      text('阶段性付款', '约定到期不等于实际到账。阶段性异常影响发生当月尚未执行的收益支付；已付收益不追回，历史欠付单独登记。'),
      text('办理时间', state.flow === 'cards' ? '每月月初办理本月认购；上个月有实际认购且仍有未结清本金时，同时提供退出申请。本人可在确认前查阅、切换合同，最终确认一项后进入本月调查。' : '普通认购在每月月初办理。'),
      text('折价退出', `${state.flow === 'cards' ? '退出申请仅在上述月初办理窗口开放，可从全部未结清本金中自选申请金额，并填写理由。' : '有未结清本金时可自选申请金额并填写理由。'}每月只可有效提交一次。当前退回报价为申请本金的${publicFinance(f).quote}%。批准后按该报价支付并结清所申请的本金，折价差额计为损失，其余未申请本金继续留存；未获批准则不扣钱、不减少本金。实际结果以退出申请与清算确认单为准。`),
      text('阶段截止', '最后一个月（7月）仍可认购，首次约定结算日为8月1日。本阶段不提前兑现未来收益、不自动退本，也不将未结清本金自动计为损失。'),
    ];
    return doc;
  }
  if (id === 'P02') {
    const receipts = f.ledger.filter(item => ['interest-paid', 'exit-approved'].includes(item.type) && item.cashDelta > 0);
    if (!receipts.length) return null;
    const doc = base(state, id, '本人实际到账登记', 'receipts', '本人业务收款登记');
    doc.blocks = [table('实际入账', ['入账日期', '执行编号', '交易摘要', '实际金额'], receipts.map(item => [
      date(item.month, item.day), item.id, item.label, yuan(item.cashDelta),
    ]), [3]), text('范围说明', '只列本人已实际收到的收益与折价退出款，不将应付未付、约定收益或平台历史余额列为本人现金。此表不证明经营利润或完整平台资金来源。')];
    return doc;
  }
  if (id === 'P03') {
    const doc = base(state, id, '本人到账核对附件');
    doc.blocks = [table('到账与登记对照', ['执行编号', '日期', '实际到账', '登记摘要'], f.ledger.filter(item => ['interest-paid', 'exit-approved'].includes(item.type) && item.cashDelta > 0).map(item => [
      item.id, date(item.month, item.day), yuan(item.cashDelta), item.label,
    ]), [2]), text('核对边界', '此附件只核对本人回单与本人业务登记。未取得平台对手方完整流水时，不据此补写认购款来源，也不把本人记录当作历史C户完整流水。')];
    return doc;
  }
  if (id === 'C01') {
    const doc = base(state, id, '本人退出申请与清算确认单');
    doc.blocks = [table('已提交申请', ['日期', '申请编号', '申请本金', '退回报价', '结果', '实际到账', '确认损失'], f.requests.map(item => [
      date(item.month, item.day), item.id, yuan(item.amount), `${item.quote}%`, item.success ? '已批准并执行' : '未批准', yuan(item.received), yuan(item.loss),
    ]), [2, 5, 6]), text('本人资金截止', `可用现金${money(f.cash)}元；未结清本金${money(f.principal)}元；应付未付收益${money(f.unpaidInterest)}元。`), text('执行口径', '申请失败不减本金。成功时申请本金全额结清，实际退回与折价损失分别记账。已付收益保留，未付收益另列，不叠加其他批次执行折扣。')];
    return doc;
  }
  if (id === 'C02') {
    const doc = base(state, id, '本人连续资金登记');
    doc.blocks = [table('本阶段资金变动', ['日期', '执行编号', '摘要', '现金变动', '本金变动', '欠付变动', '损失变动'], f.ledger.map(item => [
      date(item.month, item.day), item.id, item.label, yuan(item.cashDelta), yuan(item.principalDelta), yuan(item.unpaidDelta), yuan(item.lossDelta),
    ]), [3, 4, 5, 6]), text('资料范围', '本表仅为玩家本人资金登记，不是平台银行完整流水；牌局奖金与本人投资收支分别标注。历史1—3月平台资金另查D07、D08、D13。')];
    return doc;
  }
  return null;
}

/** Readable relationships, without assigning liability or filling in Q8. */
export const RELATIONSHIPS = Object.freeze({
  nodes: [
    { id: 'me', label: '我', kind: 'person' }, { id: 'lu', label: '陆衡', kind: 'person' },
    { id: 'zhou', label: '周岚', kind: 'person' }, { id: 'lin', label: '林乔', kind: 'person' },
    { id: 'company', label: '金鼎财富', kind: 'company' }, { id: 'project', label: 'JD-01项目', kind: 'project', document: 'D04' },
    { id: 'C', label: 'C户', kind: 'account', document: 'D06' }, { id: 'M', label: 'M户', kind: 'account', document: 'D06' },
  ],
  edges: [
    { from: 'zhou', to: 'me', label: '朋友／引荐' },
    { from: 'lu', to: 'company', label: '客户经理' },
    { from: 'lin', to: 'company', label: '财务经办' },
    { from: 'zhou', to: 'company', label: '认购客户', document: 'D03' },
    { from: 'company', to: 'project', label: '项目说明', document: 'D04' },
    { from: 'company', to: 'C', label: '账户归属记录', document: 'D06' },
    { from: 'company', to: 'M', label: '账户归属记录', document: 'D06' },
  ],
});

export function questionMessage(id, answer) {
  const key = [...answer].sort().join('');
  const branch = getQuestionBranch(id, answer);
  if (!branch) return null;
  // Preserve the player's different approaches, while never importing old grants
  // or the old current-batch money actions along with the dialogue.
  const revised = {
    'Q1-B': { reply: ['月报里有项目介绍。具体业务你要查，我把项目和期间记下来；对应记录还得以实际拿到的资料为准。'] },
    'Q1-D': { reply: ['约定结算日会在认购前列清楚，实际到账另记。我不能拿前面付过的钱，替下一期作保证。'] },
    'Q2-A': { prompt: '截至3月31日，丙每月该有960元，怎么三个月都没付？', reply: ['看一下第二条。他是三个月锁定，4月1日本息一起结。你说的3月31日，还没到约定那天。'] },
    'Q2-B': { prompt: '历史上丙4月1日到期。本金和2,880元累计收益，怎么安排？', reply: ['安排写在历史到期表里。那是计划，实际有没有付，还得看银行到账，不能只看一张表。'] },
    'Q3-B': { reply: ['这两份说的都是项目。真要看做过什么，还是以那份独立业务核验为准。你查到的记录，我不会用宣传话术代替。'] },
    'Q3-D': { reply: ['到账是付款结果。项目有没有业务，要看同项目、同期间的委托和成交。核验回复里写的就是这件事。'] },
    'Q4-C': { reply: ['可以。账户余额是一件事，之前的钱付给谁是另一件事。你把这些执行号记着，付款指令查到以后再接起来。'] },
    'Q7-A': {
      prompt: '之前那次只是系统升级，恢复后就没事了吗？',
      reply: ['恢复以后新到期的另算，之前欠着的还在登记里。你要看那次到底付没付，得看当时的实际记录。'],
    },
    'Q7-B': {
      prompt: '之前说追加可以申请处理，是保证我的本金先退吗？',
      reply: ['不是保证。追加和退出是两件事。你真要申请退出，先看本月折价报价、写清理由，最后以实际办理结果为准。'],
    },
    'Q7-C': {
      prompt: '之前那次延期，是不是说明全部钱都被挪走了？',
      reply: ['“全部”是哪份记录证明的？具体哪笔、哪段时间，你拿出来，我们逐项说。延期通知本身说不了这么多。'],
    },
    'Q7-D': {
      prompt: '系统调整解释不了新认购款付旧客的安排。我的资金申请，需要单独留下记录。',
      reply: ['资料问题可以另写一份说明。资金申请按本月规则办：你自己定申请本金、填理由，批准后按已显示的折价金额到账。没批准，钱和原来的登记都不变。'],
    },
  }[`${id}-${key}`] || {};
  return {
    id: `${id}-${key}`, character: branch.character,
    prompt: revised.prompt || branch.prompt, reply: [...(revised.reply || branch.reply)],
    trail: branch.trail, sent: false, seen: false, questionId: id,
  };
}
