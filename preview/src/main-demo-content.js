import { DOCUMENTS as HISTORICAL_DOCUMENTS } from './materials.js';
import { OPEN_RESPONSE_FIELDS } from './open-response.js';

export const DATES = ['4月1日', '5月1日', '5月2日', '5月3日'];
export const CHARACTERS = {
  lu: { id: 'lu', name: '陆衡', role: '客户经理', portrait: 'snake', greeting: '资料都在这儿，想了解哪一项？' },
  zhou: { id: 'zhou', name: '周岚', role: '你的朋友', portrait: 'sheep', greeting: '你慢慢看，有什么想问我的就问。' },
  lin: { id: 'lin', name: '林乔', role: '财务经办', portrait: 'rabbit', greeting: '要核对哪笔？日期和流水号告诉我。' },
};

const labels = { D01: '产品说明', D02: '认购协议', D03: '周岚回单', D04: '项目月报', D05: '业务核验', D06: '账户核对', D07: 'C户流水', D08: 'M户流水', D09: '客户登记', D10: '付款指令', D11: '到账汇总', D12A: '历史到期表', D12B: '延期通知', D13: '历史资产表' };
export const DOCUMENTS = Object.fromEntries(HISTORICAL_DOCUMENTS.map(doc => [doc.id, { ...doc, shortTitle: labels[doc.id], phaseMin: doc.id === 'D12B' ? 2 : 0 }]));
export const INITIAL_DOCUMENTS = ['D01', 'D02', 'D03'];
export const INVESTIGATION_ROUTES = [
  { id: 'business', title: '查项目', subtitle: '月报中的钱，是哪笔业务赚来的？', character: 'lu', docs: ['D04', 'D05'], shallowDocs: ['D04'], deepDocs: ['D05'], prompt: '项目月报和对应的业务记录，我想一起看看。', reply: ['陆衡：月报给你。交易部分，我让资料组把核验副本也送来。', '林乔：这是同一个项目、同一期间的核验回复，别跟其他批次混在一起。'] },
  { id: 'funds', title: '追资金', subtitle: '钱进了哪个账户，又流向了哪里？', character: 'lin', docs: ['D06', 'D07', 'D08', 'D13'], shallowDocs: ['D06'], deepDocs: ['D07', 'D08', 'D13'], prompt: '我想核对C户和M户的完整流水。', reply: ['林乔：账户关系、两边流水，还有截止日的资产表，都在这里。', '林乔：C转M是内部调拨。追同一笔钱，先对执行号。'] },
  { id: 'payouts', title: '问回款', subtitle: '合同怎么约定，客户实际收到了什么？', character: 'zhou', docs: ['D09', 'D10', 'D11', 'D12A'], shallowDocs: ['D09'], deepDocs: ['D10', 'D11', 'D12A'], prompt: '客户到期时间、付款指令和到账记录，能一起核对吗？', reply: ['周岚：我的回单你有了，其他客户的记录得问财务。', '林乔：登记是登记，到账是到账。这几份按流水号核对。'] },
];

const opts = texts => texts.map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
export const QUESTIONS = [
  { id: 'Q1', number: '01', title: '回单能证明什么', prompt: '周岚连续三个月各收到4,800元，共14,400元。现在能确认什么？', options: opts(['项目已连续三个月产生足够的真实经营利润。', '周岚确实收到了钱，来源和本金能否退出仍需核实。', '她六万元本金已经收回14,400元。', '下一期收益和本金兑付已有保障。']), correct: 'B', requiredDocs: ['D03'], phaseMin: 0, hint: '看清回单证明的是“收到钱”，还是“钱从哪里来”。', rationale: '银行回单能证明入账事实。用途摘要由付款方填写，不能单凭它认定真实利润或本金退出能力。' },
  { id: 'Q2', number: '02', title: '少了的960元', prompt: '截至3月31日，丙没有每月收到960元的回单。他1月1日投12,000元，月8%单利，锁定三个月，4月1日本息同付。该怎样记录？', options: opts(['已经拖欠三个月，应立即质问。', '尚未到期，继续核对到期本金及2,880元累计收益。', '锁定期间不产生收益，到期给多少都可以。', '未逐月付款符合合同，项目已被证明安全。']), correct: 'B', requiredDocs: ['D02', 'D09'], phaseMin: 0, hint: '先找支付日期，再判断“没收到”是否就是“拖欠”。', rationale: '三个月按单利累计2,880元，约定4月1日本息同付。3月31日尚未到期；这只排除该项指控，并不证明项目安全。' },
  { id: 'Q3', number: '03', title: '月报和什么对照', prompt: '核对月报中的“可分配经营收益”是否真的由JD-01业务产生，最直接对照哪两份材料？', options: opts(['项目月报＋周岚回单。', '项目月报＋宣传邀约。', '项目月报＋同项目同期间的独立业务核验。', '认购协议＋客户到账汇总。']), correct: 'C', requiredDocs: ['D04', 'D05'], phaseMin: 0, hint: '两份材料是否在谈同一个项目、同一期间、同一种收益？', rationale: 'D04每期披露8,000元可分配经营收益，D05对完整对应业务和账簿核验为零。到账本身不能证明项目经营。' },
  { id: 'Q4', number: '04', title: '钱还在不在', prompt: '历史期末C户0元；三期共7,000元转至M户，M户期初0、无其他收支、期末7,000元。两户都由平台控制。应怎样记录？', options: opts(['两户合计0元。', '两户合计14,000元。', '两户合计7,000元，不能重复加上内部转出金额。', '两户有7,000元，说明项目赚了7,000元利润。']), correct: 'C', requiredDocs: ['D06', 'D07', 'D08'], phaseMin: 0, hint: '同一笔钱从左口袋进入右口袋，会不会变成两笔？', rationale: '同一时点余额合计7,000元。内部调拨不产生新资产，也不等于项目利润。这是历史平台资金，不是玩家现金。' },
  { id: 'Q5', number: '05', title: '十万元真的失踪了吗', prompt: '合同登记本金131,000元，其中旧客100,000元、新客31,000元；1至3月新认购入款31,000元。仅凭差额，能说“十万元在这三个月失踪”吗？', options: opts(['能，100,000元差额就是本期失踪资金。', '能，先向期初余额补入100,000元再追去向。', '不能，统计对象和期间不同，差额不能直接证明本期失踪。', '不能，所以其他资金疑点也已经排除。']), correct: 'C', requiredDocs: ['D06', 'D07', 'D09'], phaseMin: 0, hint: '合同存续金额是一张“现有合同清单”，本期入款是一段“期间流水”。', rationale: '存续合同登记额不能直接当作该窗口的入款或期初现金。排除这条不充分指控，也不会抹去已经核实的付款来源问题。' },
  { id: 'Q6', number: '06', title: '旧客的收益是谁付的', prompt: '选两份材料，证明同一三期的新认购款进入C户，并被用于支付旧客收益。', options: opts(['C户完整流水。', '付款批次指令。', '旧客实际到账汇总。', '宣传邀约。', '项目月报。']), multiple: true, maxSelections: 2, correct: [['A', 'B'], ['A', 'C']], requiredDocs: ['D06', 'D07'], requiredAnyGroups: [['D10'], ['D11']], phaseMin: 0, hint: '一份锁定完整来源，另一份锁定付款用途或实际收款；执行号要能对上。', rationale: '完整C户流水限定了全部入款与支出，结合付款指令或实际到账汇总可核对新认购款支付旧客收益。只有指令和回单，仍缺完整资金来源边界。' },
  { id: 'Q7', number: '07', title: '只是系统升级吗', prompt: '陆衡将延期解释为系统调整，并说追加可申请优先处理。结合已核实材料，哪项判断最有依据？', options: opts(['只是技术问题，不必再查资金来源。', '以前付过收益，追加就能提高本金安全性。', '延期一次就证明全部资金都被挪走。', '系统升级解释不了新认购款付旧客的安排，追加优先仍缺核实支持。']), correct: 'D', requiredDocs: ['D12B', 'D05', 'D06', 'D07'], requiredAnyGroups: [['D10'], ['D11']], phaseMin: 2, hint: '把这次延期，与之前已经核实的经营和付款事实分别看清。', rationale: '延期本身不足以证明全部资金被挪走；但技术解释也不能消除已核实的资金来源矛盾。追加优先没有独立支付保证。' },
  { id: 'Q8', number: '08', title: '我的调查结论', type: 'open', prompt: '根据你亲自经历、查阅和听到的内容，写下自己的理解。', fields: OPEN_RESPONSE_FIELDS, options: [], requiredDocs: [], phaseMin: 0, hint: '可以回看已读资料、人物消息和自己的资金记录。仍不能确认的地方，可以写“不确定”。' },
];
export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

const selectionKey = selection => (Array.isArray(selection) ? selection : [selection]).filter(Boolean).sort().join('');
export function isSupportedJudgment(questionId, selection) {
  const q = QUESTION_MAP[questionId];
  if (!q) return false;
  if (q.type === 'open') return null;
  const key = selectionKey(selection);
  return Array.isArray(q.correct) ? q.correct.some(pair => selectionKey(pair) === key) : key === q.correct;
}
const branch = (character, prompt, reply, grantDocs = [], actions = [], trail = '') => ({ character, prompt, reply: Array.isArray(reply) ? reply : [reply], grantDocs, actions, trail });
const BRANCHES = {
  Q1: {
    A: branch('lu', '周姐连续收了三个月，是项目一直在赚钱吗？', ['她收到的金额，你都看到了。项目介绍和月报也可以一起看。'], ['D04'], ['invest'], '向陆衡索取项目月报'),
    B: branch('lu', '钱确实到了。项目具体怎么做，我想看月报和业务记录。', ['月报给你。要核验具体业务，我让资料组把对应回复也送来。'], ['D04', 'D05'], [], '回单判断 → 核对项目业务'),
    C: branch('zhou', '这14,400元，算是把本金收回来一部分了吗？', ['不是，这是每个月的收益。我那六万还在里面，没取出来过。'], ['D09'], ['exit'], '追问周岚 → 本金尚未取回'),
    D: branch('lu', '前面都付了，下一期也能照常拿到吗？', ['按计划走。你要办追加，我先把下一批的结算日期给你看。'], ['D02'], ['invest'], '了解后续认购条件'),
  },
  Q2: {
    A: branch('lu', '丙每月该有960元，三个月怎么都没付？', ['看一下第二条。他是三个月锁定，4月1日本息一起结，不是每个月单独拿。'], ['D02', 'D12A'], [], '重新核对锁定与支付日期'),
    B: branch('lin', '丙4月1日到期。本金和2,880元累计收益，怎么安排？', ['到期表给你。它是计划，实际有没有付，还要看银行到账。'], ['D12A'], [], '合同日期 → 核对到期付款计划'),
    C: branch('lin', '锁定期间，收益是不是就不算了？', ['还在累计。12,000乘8%，再乘三个月，是2,880。锁定的是支付时间。'], ['D02', 'D09'], [], '核对单利累计条款'),
    D: branch('lu', '这几笔没逐月付，是按合同来的？', ['对，批次不同。你自己的体验批次单独登记，别和锁定三个月的那组混了。'], [], ['invest'], '了解本人体验批次'),
  },
  Q3: {
    A: branch('zhou', '你的钱到了，能证明月报这8,000元是真的吗？', ['我能确认钱到了，具体交易赚没赚，我也没看过。你还是核一下项目吧。'], ['D05'], [], '到账记录 → 补查业务核验'),
    B: branch('lu', '宣传和月报都说项目赚钱，有交易记录能对上吗？', ['月报是按项目出的。你要具体核对，我让财务把核验副本拿给你。'], ['D05'], [], '宣传主张 → 索取独立记录'),
    C: branch('lu', '月报每月8,000元，核验却没有成交和经营利润。这两份怎么对得上？', ['这份回复我得让财务核一下。你先把对应项目和期间圈出来，我不会拿另一批材料跟你解释。'], ['D06'], [], '项目矛盾 → 转查付款来源'),
    D: branch('lin', '客户到账总额，能直接拿来证明月报利润吗？', ['到账是付款结果。项目有没有业务，要看同项目、同期间的委托和成交，核验回复给你。'], ['D05'], [], '付款结果 → 核对经营记录'),
  },
  Q4: {
    A: branch('lin', 'C户已经空了，那7,000元是不是也没了？', ['看M户。三个内部执行号能对上，钱还留在那边。'], ['D08'], ['exit'], '追查M户 → 避免漏算余额'),
    B: branch('lin', '转出7,000，M户又有7,000，是不是一共14,000？', ['同一笔钱，转出记录和收到后的余额不能加两次。你把执行号对一下。'], ['D07', 'D08'], [], '核对内部调拨 → 排除重复计算'),
    C: branch('lin', '两户合计7,000。内部划转的执行号，能和付款指令一起查吗？', ['可以。账户余额是一件事，之前的钱付给谁是另一件事。这份批次指令你留着。'], ['D10'], [], '账户合计 → 追付款执行号'),
    D: branch('lin', 'M户留下7,000元，就是项目利润吗？', ['这是从C户转来的认购款余额。内部转账，不会自己变成经营收入。'], ['D06', 'D08'], [], '资金余额 → 区分认购与经营收入'),
  },
  Q5: {
    A: branch('lu', '合同有131,000元，流水只有31,000，十万元去哪了？', ['你说的是哪天进来的十万元？这份流水只查1到3月，旧合同不能直接当作这三个月的入款。'], ['D06', 'D09'], ['confront'], '指控差额 → 补查入款时间'),
    B: branch('lin', '我先把旧客十万元补到期初，再追后面的钱？', ['别补。期初余额以银行记录为准，合同金额不能拿来填银行账。'], ['D07'], [], '回看银行期初 → 修正资金口径'),
    C: branch('lin', '十万元差额不能直接算失踪。我想把能对上的新入款逐笔追下去。', ['从IN-101、IN-201、IN-301开始。再看对应的PAY执行号，比先猜差额有用。'], ['D10', 'D11'], [], '排除假线索 → 锁定实际付款链'),
    D: branch('lu', '这十万元不能这样算，那其他资金应该也没问题？', ['这笔差额确实是口径问题。其他资料你想核，还是可以接着看。'], ['D07'], [], '排除一项疑点 → 继续独立核查'),
  },
  Q7: {
    A: branch('lu', '这次只是系统升级，等恢复就可以了吗？', ['目前要等批次执行。能付多少、有没有入账，还是按进度单看。'], ['C01'], ['exit', 'invest'], '延期解释 → 查看执行进度'),
    B: branch('lu', '追加之后，能保证我的本金先退吗？', ['我可以帮你申请，但没有单独的支付保证。新入金也不算进旧本金这批。'], ['D12B', 'C01'], ['invest', 'exit'], '询问追加优先 → 核对条件'),
    C: branch('lu', '你们延期，是不是全部钱都被挪走了？', ['“全部”是哪份记录证明的？具体哪笔、哪一段时间，你拿出来，我们逐项说。'], ['D13', 'C01'], ['confront'], '范围过大的指控 → 补查对应证据'),
    D: branch('lu', '系统升级解释不了新认购款付旧客。我的退出申请，请给我书面进度。', ['申请可以登记。当前按通知安排，实际到账另记。执行进度我让财务给你。'], ['C01'], ['exit', 'confront'], '已核实付款链 → 退出协商／有据对峙'),
  },
};

export function getQuestionBranch(questionId, selection) {
  if (QUESTION_MAP[questionId]?.type === 'open') return null;
  const key = selectionKey(selection);
  let item;
  if (questionId === 'Q6') {
    item = isSupportedJudgment(questionId, selection)
      ? branch('lu', '完整流水和执行记录对得上：新认购款进C户，再支付旧客收益。你怎么解释？', ['你把这几个执行号一起给我。我请财务正式回复。退出可以另办，资金申请和资料核对分开登记。'], [], ['exit', 'confront'], '完整来源＋实际支付 → 有据交涉')
      : branch('lin', `我想用${key.split('').join('、')}这两份来证明旧客付款来源。`, ['先别急着下结论。来源边界看完整C户流水，再拿付款指令或到账回单对执行号。只有“安排付”和“收到钱”，还不够追到钱从哪儿来。'], ['D07', 'D10', 'D11'], [], '补齐完整来源与实际支付依据');
  } else item = BRANCHES[questionId]?.[key];
  return item ? { ...item, id: `${questionId}-${key}`, questionId, selection: key } : null;
}

export const DEFAULT_MESSAGES = {
  lu: [
    { id: 'lu-project', character: 'lu', prompt: '项目资料和月报，我想先看看。', reply: ['没问题。月报和说明都给你，具体条件看协议。'], grantDocs: ['D01', 'D02', 'D04'], actions: [], trail: '索取项目资料' },
    { id: 'lu-exit', character: 'lu', prompt: '我想问一下，退出什么时候办理？', reply: ['体验批次按当前结算窗口申请。金额、到账和未付部分都会单独留记录。你先看清条件，再决定。'], grantDocs: ['P01'], actions: ['exit'], trail: '询问退出条件' },
  ],
  zhou: [
    { id: 'zhou-principal', character: 'zhou', prompt: '周姐，你的本金取出来过吗？', reply: ['没取过。我一直拿每个月的四千八，六万还在里面。', '说实话，具体交易我也没细看。'], grantDocs: ['D03', 'D09'], actions: [], trail: '朋友经历 → 本金尚未取回' },
  ],
  lin: [
    { id: 'lin-records', character: 'lin', prompt: '我想核对完整账户和付款资料。', reply: ['授权副本可以查。你先看账户关系，再按日期和执行号找对应款项。'], grantDocs: ['D06', 'D07', 'D08', 'D10', 'D11'], actions: [], trail: '财务核对 → 完整付款链' },
  ],
};

export const COPY = {
  welcome: { speaker: '陆衡', text: '想先试多少，你自己定。办好以后，这份你留着。', title: '月结体验', body: '4月1日认购，5月1日首次结算；每月约定8%，按单利计算。' },
  firstPayment: { title: '收益已到账', text: '手机轻响了一声。那笔钱，真的进来了。', speaker: '周岚', reply: '看见了吧？我当时第一次收到，也是这个感觉。' },
  noFirstPayment: { title: '到了结算日', text: '周岚把新到账的记录递给你。你这次没有认购，账户没有新增收益。' },
  crisis: { title: '付款安排有变', text: '陆衡发来一份通知。旧本金按50%安排本批处理，实际支付看到账记录。', speaker: '陆衡', reply: '系统在调整。你先把申请交过来，我让财务登记。' },
  close: { title: '5月3日 · 资金记录截止', text: '已经到账的留在账户里，尚未退回的本金单独记着。资料和对话还可以继续查。' },
};

export const DOCUMENT_OS = {
  D03: '三个月的收益都到了。不过，她那六万本金，取出来过吗？',
  D02: '合同写的是“申请退出”。申请以后什么时候到账，还得再问清楚。',
  D04: '三个月的可分配经营收益，居然每次都刚好是8,000元。',
  D05: '同一个项目，同一段时间。这份记录，怎么和月报差这么多？',
  D07: '入款和付款的执行号都有。顺着它们，应该能把钱接起来。',
  D08: '钱从C户转到M户，还在同一家公司手里。不能算两次。',
  D09: '到期时间不一样，不能把所有人的回款放在一起比较。',
  D12B: '“按50%安排”不等于已经收到。所谓优先，似乎也没有保证。',
};

const cents = n => (Number.isSafeInteger(n) ? n / 100 : 0);
const amount = n => cents(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const textBlock = (title, body) => ({ kind: 'text', title, body });
const tableBlock = (title, headers, rows, moneyCols = []) => ({ kind: 'table', title, headers, rows, moneyCols });
const docBase = (id, title, date, issuer = '金鼎财富', type = 'contract') => ({ id, title, shortTitle: title, date, issuer, type, number: `JD-${id}-PLAYER`, blocks: [] });

/** Parameterized records only: opening a document never pays money or changes state. */
export function getDynamicDocument(state, id) {
  if (DOCUMENTS[id]) return DOCUMENTS[id];
  const phase = Math.max(0, Math.min(3, Number(state.phase) || 0));
  const settlement = state.firstSettlement;
  if (id === 'P01') {
    const doc = docBase(id, '月结体验批次认购确认书', DATES[phase]);
    const lots = state.lots || [];
    doc.blocks = [tableBlock('本人认购登记', ['认购编号', '认购日期', '认购金额', '首次结算日'], lots.map((lot, i) => [lot.id || `PLAYER-IN-${i + 1}`, DATES[lot.phase || 0], cents(lot.amount), ['5月1日', '6月1日', '6月2日'][lot.phase || 0] || '下一个完整月']), [2]), textBlock('收益条款', '按完整月计算，月约定比例8%，单利，不自动复投，不按零散日计息。0元表示暂不认购，不生成付款凭证。'), textBlock('退出与批次', '5月1日结算窗口可申请退出。5月2日前的既有本金按当期通知安排；5月2日新入金单独登记，不纳入旧本金本次50%处理批次。'), textBlock('记账事项', '已付收益、退回本金与未付金额分别记录。未付款记录不等于银行实际到账。')];
    if (!lots.length) doc.blocks.unshift(textBlock('认购状态', '尚无已确认认购。以下条款供查阅，不是银行付款凭证。'));
    return doc;
  }
  if (id === 'P02' && settlement?.executed && settlement.interest > 0) {
    const doc = docBase(id, '体验客户收益入账回单', '5月1日', '澄川银行', 'receipts');
    doc.number = 'PAY-P-01';
    doc.blocks = [tableBlock('入账信息', ['字段', '内容'], [['收款客户', '体验客户（本人）'], ['付款方', '金鼎财富C户'], ['付款账号', '3100 **** **** 0101'], ['交易流水号', 'PAY-P-01'], ['入账日期', '模拟年度5月1日'], ['入账金额', `${amount(settlement.interest)}元`], ['用途摘要', '经营收益'], ['记账状态', '已入账']]), textBlock('回单说明', '本回单记录实际入账事实，用途摘要由付款方填列。重复查看不重复记账，资金来源应核对对应账户交易记录。')];
    return doc;
  }
  if (id === 'P03' && phase >= 2 && settlement?.executed && settlement.interest > 0) {
    const doc = docBase(id, '体验批次付款来源核验附件', '5月2日', '澄川银行授权核对资料', 'spreadsheet');
    const remaining = 500000 - settlement.interest;
    doc.blocks = [tableBlock('新认购对应', ['认购客户', '合同编号', '认购金额', '入账流水号'], [['己', 'CN-J-005', 5000, 'IN-P-501']], [2]), tableBlock('完整时间窗口', ['5月1日时间', '流水号', '交易', '收入', '支出', '余额'], [['09:00', '期初', 'C户窗口期初余额', 0, 0, 0], ['09:01', 'IN-P-501', '己认购入款', 5000, 0, 5000], ['09:03', 'PAY-P-01', '支付本人体验收益', 0, cents(settlement.interest), cents(remaining)], ['09:05', '期末', '窗口无其他收支', 0, 0, cents(remaining)]], [3, 4, 5]), textBlock('关联指令', 'CMD-P-01：从IN-P-501认购款支付PAY-P-01体验批次收益。合同、指令及实际入账执行号已对应核对。'), textBlock('范围说明', '仅核验5月1日09:00至09:05完整窗口。之后的认购、退本不属于该窗口。1至3月另查历史流水。')];
    return doc;
  }
  if (id === 'C01' && phase >= 2 && state.crisis) {
    const c = state.crisis;
    const batchRequest = c.executed ? c.frozen.request : c.request;
    const laterRequest = c.executed ? c.request - c.frozen.request : 0;
    const playerArranged = c.executed ? c.arranged : Math.floor((batchRequest + 1) / 2);
    const npcArranged = c.npcArranged ?? Math.floor(((c.npcRequested || 0) + 1) / 2);
    const doc = docBase(id, '当前批次付款执行进度', DATES[phase], '金鼎财富财务经办组', 'spreadsheet');
    doc.blocks = [
      tableBlock('本人申请', ['项目', '金额／状态'], [
        ['5月2日前既有本金', `${amount(c.oldPrincipal)}元`],
        ['本批申请本金', `${amount(batchRequest)}元`],
        ['本批按50%安排金额', `${amount(playerArranged)}元`],
        ['实际退回本人本金', `${amount(c.paid)}元`],
        ['本批申请尚未退回', `${amount(batchRequest - c.paid)}元`],
        ['本批执行后追加排队申请', `${amount(laterRequest)}元`],
        ['本人全部认购尚未收回本金', `${amount(state.principal)}元`],
        ['执行状态', c.executed ? '本批已执行；后续申请另行排队' : '申请登记中，尚未执行'],
        ['执行批号', c.executionId || '尚未冻结'],
      ]),
      tableBlock('当前批次资金', ['项目', '金额'], [
        ['已有现金', cents(c.opening)], ['本批已核实入款', cents(c.inflow)],
        ['在先付款占用', cents(c.priorPayment)], ['本批可支付池', cents(c.pool)],
        ['本人受理安排', cents(playerArranged)], ['其他客户申请本金', cents(c.npcRequested)],
        ['其他客户按50%安排', cents(npcArranged)],
        [c.executed ? '冻结受理安排总额' : '当前拟受理安排总额', cents(c.executed ? c.totalArranged : playerArranged + npcArranged)],
        ['其他客户实际退本', cents(c.npcPaid)], ['本人实际退本', cents(c.paid)],
      ], [1]),
      textBlock('执行口径', '本批按既有本金50%安排。实际执行率以当前可支付池／安排总额计算，上限100%；未执行部分继续登记，不视作已到账。5月2日新增本金不纳入本批资格。执行后新增退出申请另行排队，不改写本批已冻结的申请与到账。'),
      textBlock('截止与历史', '本表仅反映当前体验批次。历史3月31日余额7,000元不等于此时可支付池；历史三期流水不因本表而改变。当前连续收支另见《体验批次平台连续资金明细》。'),
    ];
    return doc;
  }
  if (id === 'C02' && phase >= 1) {
    const doc = docBase(id, '体验批次平台连续资金明细', DATES[phase], '金鼎财富财务经办组', 'spreadsheet');
    let balance = 0;
    const rows = [['4月1日', '窗口期初', '本体验批次登记起点', 0, 0, 0]];
    for (const entry of state.ledger || []) {
      if (!entry.platformDelta) continue;
      balance += entry.platformDelta;
      const date = entry.id === 'first:earlier-payment' ? '4月30日'
        : entry.id === 'first:source' ? '5月1日 09:01'
        : entry.id === 'first:payment' ? '5月1日 09:03'
        : entry.id === 'first:later-inflow' ? '5月1日 09:10'
        : DATES[entry.phase];
      const recordId = entry.id === 'first:source' ? 'IN-P-501'
        : entry.id === 'first:payment' ? 'PAY-P-01'
        : entry.id === 'first:later-inflow' ? 'IN-P-502' : entry.id;
      rows.push([date, recordId, entry.label, cents(Math.max(0, entry.platformDelta)), cents(Math.max(0, -entry.platformDelta)), cents(balance)]);
    }
    doc.blocks = [
      tableBlock('连续收支登记', ['记账日期', '执行编号', '摘要', '收入', '支出', '交易后余额'], rows, [3, 4, 5]),
      textBlock('首期核对窗口', '4月30日在先客户兑付款执行后，C户5月1日09:00窗口期初为0元。09:01客户己认购5,000元，09:03支付本人实际首期收益（如有），09:05窗口无其他收支；09:10后续客户另认购15,000元，不属于09:00至09:05核验窗口。'),
      textBlock('当前兑付批次', '5月2日已核实入款、在先付款及本批实际退本按执行先后列示。当前本批资格与冻结资金池见《当前批次付款执行进度》；5月2日新增本人认购不回填本批冻结池。'),
      textBlock('资料范围', '本明细为体验批次开始后的连续登记，期初从该批登记起点计算。历史1至3月记录另见D07、D08及D13；两组期间不得混用。无平台收支的阅读、答题、聊天及牌局奖金不列为平台入款。'),
    ];
    return doc;
  }
  return null;
}

export function getConfrontation(selection = 'evidence') {
  return selection === 'evidence'
    ? branch('lu', '月报、核验和付款执行号都在这里。项目没做出这些利润，旧客收到的却是新认购款。我需要一份书面说明。', ['你把这些对应材料留下，我让财务出书面回复。你的资金申请可以另行登记，已经付了多少、还没付多少，都按记录来。'], ['C01'], ['exit'], '有据对峙 → 书面核对与资金申请')
    : branch('lu', '合同金额和流水差了十万元，这笔钱是不是被拿走了？', ['哪天进来的，哪一笔转出去的？先把期间和流水号对上。你可以继续查，我也需要具体记录。'], ['D06', 'D07', 'D09'], [], '提出疑问 → 补查期间与实际入款');
}
