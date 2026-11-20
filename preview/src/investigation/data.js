import { DOCUMENT_MAP } from '../materials.js';

// The workbench is an isolated design preview. Historical evidence remains in
// January–March; no transaction here alters the player's April–July finances.
const text = (title, body) => ({ kind:'text', title, body });
const doc = (id, title, blocks, issuer='金鼎财富 · 资料归档', date='4月1日') => ({ id,title,shortTitle:title,issuer,date,number:`JD-CARD-${id}`,type:'letter',blocks });
const numberField = (id, label, expected, unit='元') => ({ id,label,expected,unit });
const question = (taskId, number, prompt, allowedSets, extra={}) => ({
  id:`${taskId}-${number}`,taskId,prompt,type:'link',allowedSets,...extra,
});

export const TASKS = [
  { id:'invitation',title:'邀请函',kind:'event',art:'invitation',subtitle:'这封信把我带到了哪里',questions:[
    question('invitation',1,'谁发出了这封邀请？',[['company']],{result:'邀请由金鼎财富客户服务组发出。',hint:'看邀请函的抬头与落款。'}),
    question('invitation',2,'是谁推荐了我？',[['zhou']],{result:'周岚引荐主角。',hint:'看邀请函中的推荐人。'}),
    question('invitation',3,'谁负责接待我？',[['lu']],{result:'客户经理陆衡负责接待。',hint:'看会面安排中的接待人员。'}),
    question('invitation',4,'邀请我了解什么？',[['project']],{result:'本次会面介绍稳盈计划。',hint:'看邀请函的会面主题。'}),
  ]},
  { id:'zhou',title:'周岚',kind:'person',art:'zhou',subtitle:'朋友 · 认购客户',questions:[
    question('zhou',1,'她为什么向我推荐项目？',[['zhou-income']],{result:'她连续收到钱，因此相信项目。',hint:'回看周岚介绍自己经历时的说法。'}),
    question('zhou',2,'三个月实际收到了多少？',[['D03']],{type:'number',fields:[numberField('period','每期',4800),numberField('total','累计共',14400)],result:'三个月各收到4,800元，累计14,400元。',hint:'按回单日期分期，再核对合计。'}),
    question('zhou',3,'她的六万本金现在在哪？',[['D09','zhou-principal']],{result:'名义认购本金仍在稳盈计划中，尚未结清或退回本人。不能据此断定平台另存有完整六万元现金。',hint:'对照认购登记中的存续本金与她的回答。'}),
    question('zhou',4,'她对项目的了解程度',[['zhou-knowledge']],{result:'她知道自己的到账经历，对具体交易及公司经营情况并不清楚。',hint:'回看她对具体交易的回答。'}),
  ]},
  { id:'lu',title:'陆衡',kind:'person',art:'lu',subtitle:'客户经理',questions:[
    question('lu',1,'他在这次会面中是什么身份？',[['invitation']],{result:'客户经理、项目接待人。',hint:'查阅邀请函的接待安排。'}),
    question('lu',2,'他介绍的月约定收益是多少？',[['D01','D02']],{type:'number',fields:[numberField('rate','每月',8,'%')],result:'月约定收益为8%；这是项目条款中的约定。',hint:'对照产品说明与协议中的收益比例。'}),
    question('lu',3,'他声称项目靠什么赚钱？',[['lu-pitch']],{result:'陆衡称团队通过价差交易产生收益。此处记录他的说法。',hint:'回看他对收益来源的介绍。'}),
  ]},
  { id:'project',title:'稳盈计划',kind:'project',art:'project',subtitle:'JD-01 · 经营核验',questions:[
    question('project',1,'月报声称每期赚了多少？',[['D04']],{type:'number',fields:[numberField('period','每期',8000),numberField('total','三期共',24000)],result:'月报列示每期可分配经营收益8,000元，三期24,000元。',hint:'看1—3月的“可分配经营收益”行。'}),
    question('project',2,'实际核验出的经营利润是多少？',[['D05']],{type:'number',fields:[numberField('profit','三期共',0)],result:'同项目、同期间的业务与账簿核验结果为0元。',hint:'确认核验的项目、期间与经营利润栏目。'}),
    question('project',3,'月报的经营收益与业务核验相符吗？',[['D04','D05']],{type:'boolean',expected:false,result:'同项目、同期间的两份记录不相符。',hint:'两份材料是否在谈同一项目、同一期间和同一种收益？'}),
  ]},
  { id:'lin',title:'林乔',kind:'person',art:'lin',subtitle:'付款资料核对',questions:[
    question('lin',1,'她在公司的职位',[['lin-role']],{result:'财务经办。这个职位本身不证明她拥有最终审批权或知悉全部安排。',hint:'回看林乔的身份记录。'}),
    question('lin',2,'截至3月31日，丙未逐月领到960元，已拖欠吗？',[['D02','D09']],{type:'boolean',expected:false,result:'尚未到4月1日约定支付日，不能据此认定拖欠。',hint:'先核对丙的批次、锁定期限和约定支付日。'}),
    question('lin',3,'丙约定4月1日应结算多少？',[['D02','D12A']],{type:'number',fields:[numberField('principal','本金',12000),numberField('interest','累计收益',2880),numberField('total','本息共',14880)],result:'约定本金12,000元及累计收益2,880元，合计14,880元；应付不等于实际已付。',hint:'区分到期本金、累计收益与计划合计。'}),
  ]},
  { id:'accounts',title:'C户与M户',kind:'account',art:'accounts',subtitle:'历史1—3月 · 截至3月31日',questions:[
    question('accounts',1,'两个账户属于谁？',[['D06']],{result:'C户、M户均属于金鼎财富平台，现有资料没有证明陆衡个人控制账户。',hint:'核对账户名称及控制关系。'}),
    question('accounts',2,'C户转给M户的7,000元，是新增利润吗？',[['D06','D07','D08']],{type:'boolean',expected:false,result:'这是平台内部划转，不产生新增利润或资产。',hint:'先对同一笔TRF执行号，再看两户归属。'}),
    question('accounts',3,'截止日两户合计还有多少钱？',[['D07','D08']],{type:'number',fields:[numberField('c','C户',0),numberField('m','M户',7000),numberField('total','两户共',7000)],result:'C户0元、M户7,000元，两户合计7,000元。',hint:'同一截止日的余额合计，不要再加内部转出记录。'}),
    question('accounts',4,'合同与本期入款的十万元差额，能直接算本期失踪吗？',[['D09','D07']],{type:'boolean',expected:false,result:'存续合同与本期入款的对象、期间不同，不能直接相减认定本期失踪。',hint:'分别核对合同存续金额与流水起止期间。'}),
    question('accounts',5,'同截止日核实到的资金和项目资产共多少？',[['D13']],{type:'number',fields:[numberField('assets','合计',7000)],result:'截至3月31日，已核实资金及项目资产合计7,000元。',hint:'看历史资产核对表的截止日与完整核对范围。'}),
  ]},
  { id:'payouts',title:'旧客户付款',kind:'payment',art:'payouts',subtitle:'从入款追到实际付款',questions:[
    question('payouts',1,'三期新客户认购款进入C户，共多少？',[['D06','D07']],{type:'number',fields:[numberField('total','三期共',31000)],result:'三期新认购款共31,000元进入C户。',hint:'核对IN执行号和相应的认购资金登记。'}),
    question('payouts',2,'三期旧客户实际收到多少收益款？',[['D11']],{type:'number',fields:[numberField('zhou','周岚',14400),numberField('chen','陈岳',9600),numberField('total','合计',24000)],result:'周岚14,400元、陈岳9,600元，旧客户合计24,000元。',hint:'按客户和三期到账金额汇总。'}),
    question('payouts',3,'哪些材料能追出旧客户收益的付款来源？',[['D07','D10'],['D07','D11']],{result:'完整C户流水结合付款指令或实际到账汇总，可追到新认购款被用于支付旧客收益。',hint:'完整来源和付款用途需要两端对应，执行号要能对上。'}),
  ]},
  { id:'crisis',title:'付款延期',kind:'event',art:'crisis',subtitle:'重新审视解释与追加',questions:[
    question('crisis',1,'通知给延期的解释是什么？',[['D12B']],{result:'通知称系统调整。此处只记录通知给出的解释。',hint:'先查看实际送达通知的说明。'}),
    question('crisis',2,'系统调整能消除已经核实的付款来源矛盾吗？',[['D12B','conclusion-business','conclusion-payment']],{type:'boolean',expected:false,result:'系统调整没有回答经营收益与已核实付款来源之间的矛盾。',hint:'把通知解释与先前的经营、付款核对分别比较。'}),
    question('crisis',3,'追加认购能保证本金优先退出吗？',[['private-invitation','P01']],{type:'boolean',expected:false,result:'追加与退出分别办理，没有优先退本保证。',hint:'核对私人邀请和本人条款对追加、退出的分别约定。'}),
  ]},
];

const support = [
  { id:'company',title:'金鼎财富',type:'organization',kind:'organization',art:'company',body:'邀请函发起机构：金鼎财富客户服务组。会面地点为金鼎大厦的金鼎财富会客室，本次交流介绍“稳盈计划”。' },
  { id:'C',title:'C户',type:'account',kind:'account',art:'accounts',body:'金鼎财富的认购收款及对客支付账户。完整历史记录见C户流水。' },
  { id:'M',title:'M户',type:'account',kind:'account',art:'accounts',body:'金鼎财富的留存资金账户。历史TRF内部转入记录应与C户对应。' },
  { id:'zhou-income',title:'周岚的到账经历',type:'note',kind:'note',body:'周岚：“我之前投了六万，三个月下来，一万四千四，实打实到账了。”' },
  { id:'zhou-principal',title:'周岚的本金说明',type:'note',kind:'note',body:'周岚：“没呢，还在里面放着。我现在每个月拿四千八，挺稳定的。”这确认其认购本金尚未退出，不证明平台另存有完整六万元现金。' },
  { id:'zhou-knowledge',title:'周岚的谈话记录',type:'note',kind:'note',body:'问：具体拿钱做什么交易，你知道吗？\n周岚：“这我还真没细看。反正每个月钱都准时到，我也就没多问。”' },
  { id:'lu-pitch',title:'陆衡的收益介绍',type:'note',kind:'note',body:'陆衡：“主要是团队在做价差交易。你要是感兴趣，我这儿还有项目月报。”这是陆衡的项目介绍，需与实际业务记录核对。' },
  { id:'lin-role',title:'林乔的身份记录',type:'note',kind:'note',body:'林乔，财务经办。可提供授权账户副本、银行流水及付款执行记录供核对。职位不等于资金最终控制权。' },
  { id:'private-invitation',title:'私人追加邀请',type:'note',kind:'note',body:'陆衡：“可以单独给你登记一次认购，本月有效。首次约定结算在下个月月初，按实际天数算。追加不保证退出获批，也不保证优先付款。”' },
  { id:'conclusion-zhou',title:'周岚拿到了收益，但是对公司经营情况并不清楚',type:'conclusion',kind:'conclusion',unlockQuestions:['zhou-1','zhou-2','zhou-3','zhou-4'],body:'周岚实际收到钱，但对具体交易及公司经营情况并不清楚；她的名义认购本金尚未退出。' },
  { id:'conclusion-business',title:'月报与实际业务核验不符',type:'conclusion',kind:'conclusion',unlockQuestions:['project-1','project-2','project-3'],body:'同一JD-01项目、同一1—3月期间，月报列有经营收益，完整业务及账簿核验不支持该收益。' },
  { id:'conclusion-transfer',title:'内部转账没有产生新资产',type:'conclusion',kind:'conclusion',unlockQuestions:['accounts-2','accounts-3'],body:'7,000元在平台两户之间划转，不能把转出记录与期末余额重复计入资产，也不能当作新增经营利润。' },
  { id:'conclusion-period',title:'十万元差额不能直接认定为本期失踪',type:'conclusion',kind:'conclusion',unlockQuestions:['accounts-4'],body:'存续合同本金和1—3月的入款不是同一统计对象和期间，差额不足以证明本期失踪；也不能因此排除其他资金问题。' },
  { id:'conclusion-payment',title:'新认购款被用于支付旧客户收益',type:'conclusion',kind:'conclusion',unlockQuestions:['payouts-1','payouts-2','payouts-3'],body:'完整C户流水与付款指令或到账汇总按执行号对应，可核实三期新认购款用于支付旧客户收益。此结论属于历史1—3月资料，不自动套用到玩家后续实际到账。' },
];

const docTitles = {
  D01:'产品说明',D02:'认购协议',D03:'周岚的银行回单',D04:'项目月报',D05:'独立业务核验',D06:'账户关系表',D07:'C户完整流水',D08:'M户流水',D09:'客户认购登记',D10:'付款指令',D11:'旧客户到账汇总',D12A:'历史到期付款表',D12B:'阶段性付款通知',D13:'历史资金与资产核对表',P01:'本人业务条款',
};

export const CARDS = [
  // Keep the opening invitation's institution visible without scrolling past
  // every monthly document. Main-card review order still follows TASKS.
  ...support.filter(card=>card.type==='organization'),
  ...TASKS.map((task,index)=>({ ...task,type:'task',position:{x:100+(index%4)*400,y:120+Math.floor(index/4)*810} })),
  ...Object.entries(docTitles).map(([id,title])=>({id,title,type:'document',kind:'document',document:id,art:({D03:'payouts',D04:'project',D07:'accounts',D08:'accounts',D12B:'crisis'})[id]||'document'})),
  ...support.filter(card=>card.type!=='organization'),
];
export const CARD_MAP = Object.fromEntries(CARDS.map(card=>[card.id,card]));
export const TASK_IDS = TASKS.map(task=>task.id);
export const QUESTIONS = TASKS.flatMap(task=>task.questions);
export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map(item=>[item.id,item]));

const additionalDocuments = {
  invitation:doc('INV','私人投资交流邀请函',[
    text('尊敬的受邀嘉宾','经周岚女士推荐，诚邀您莅临金鼎财富，参加“稳盈计划”专场投资交流。'),
    text('接待安排','本次会面由客户经理陆衡先生接待，为您介绍项目运作、收益分配及认购安排，项目说明及认购资料将于会面时提供。'),
    text('会面地点','金鼎大厦 · 金鼎财富会客室'),text('落款','金鼎财富\n客户服务组'),
  ]),
  D12B:doc('D12B','阶段性付款通知',[
    text('延期说明','因系统调整，发生当月尚未执行的部分收益支付暂缓；已实际入账款项不追回。'),
    text('历史登记','过去应付未付金额单独登记。此后恢复的新到期付款不自动补发历史欠付。实际情况以对应日期登记为准。'),
    text('追加与退出','追加认购不构成优先支付或本金安全保证，退出按独立申请结果办理。'),
  ],'金鼎财富','事件发生日'),
  P01:doc('P01','本人认购与业务条款',[
    text('认购与结算','月约定8%单利，收益不自动复投；按自然月实际天数及实际未结清本金分段计息，首次约定结算为下个月月初。约定结算不等于实际到账。'),
    text('折价退出','上月有认购且仍有未结清本金时，可于月初申请办理。申请金额可在全部未结清本金范围内自选，并填写理由。清算比例见当期确认单；获批后该笔申请本金结清，实际退回与折价损失分别登记，未获批准则本金保留。'),
    text('追加安排','普通认购在月初办理。单独认购邀请本月有效，不保证退出获批或优先付款。'),
  ],'金鼎财富 · 本人业务登记'),
};

export function getCardDocument(id) {
  const card = CARD_MAP[id];
  if (!card) return null;
  if (additionalDocuments[id]) return structuredClone(additionalDocuments[id]);
  if (card.type === 'document' && DOCUMENT_MAP[id]) return structuredClone(DOCUMENT_MAP[id]);
  if (card.body) return doc(id,card.title,[text(card.type==='conclusion'?'核对记录':'记录内容',card.body)],card.type==='note'?'谈话归档':'调查记录');
  if (card.type === 'task') return doc(id,card.title,[text('调查对象',card.subtitle)],'调查工作台');
  return null;
}
