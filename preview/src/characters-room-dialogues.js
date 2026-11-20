// Approved interview manuscript: design/CHARACTER_INTERVIEWS_V1.0.md.
// Unlocks and rewards belong to card-flow; this file supplies dialogue only.
export const PEOPLE = {
  lu:{name:'陆衡',greeting:'资料都在这儿，想了解哪一项？'},
  zhou:{name:'周岚',greeting:'你慢慢看，有什么想问我的就问。'},
  lin:{name:'林乔',greeting:'要核对哪笔？日期和流水号告诉我。'},
  'customer-d':{name:'客户丁',greeting:'行，你问吧。'},
};
const lines=(...pairs)=>pairs.map(([speaker,text])=>({speaker,text}));
const exchange=(person,...texts)=>texts.map((text,index)=>({speaker:index%2?person:'player',text}));
const topic=(id,character,title,...texts)=>({id,character,title,lines:exchange(character,...texts)});
export const DIALOGUE_TOPICS = [
  topic('T01','zhou','到账经历',
    '周姐，你前面说的那三笔，都到账了？','到了，一次四千八，三个月一万四千四。',
    '都进你自己的卡了？','嗯，我自己查过，回单也留着呢。',
    '所以你才叫我过来看看？','是啊，我自己拿到了，才跟你提的。'),
  topic('T02','zhou','本金情况',
    '你那六万本金，现在还放在里面？','对，还没取。',
    '那之前拿到的一万四千四呢？','那几笔是给我的收益，本金我一分都没取。'),
  topic('T03','zhou','对项目的了解',
    '他们具体拿钱做什么，你问过吗？','说是有专门的人做，细的我没问。',
    '那做过哪些交易，你看过没有？','没看过。那时候钱都准时到，我也就没多问。'),
  topic('T04','lu','项目靠什么赚钱',
    '一个月8%，你们靠什么赚这么多？','主要是团队在做价差交易。你不用自己盯着盘。',
    '具体做过哪些交易？','业务情况，月报里有介绍。你先看，有不明白的再问我。'),
  topic('T05','lu','月报中的项目',
    '这份月报，是专门给这个项目做的？','JD-01的。一月到三月，你看的就是这三期。',
    '那对应的实际交易，我也想看看。','可以，我让人登记。核验资料到了，你再对着看。'),
  {id:'T06',character:'lu',title:'找谁核对材料',lines:lines(
    ['player','这几份材料，找谁能核得清楚？'],['lu','找我们财务林乔。她负责对接这些资料。'],
    ['player','方便叫她过来吗？'],['lu','你坐会儿，我叫一下。'],
    ['player','你是林乔？'],['lin','嗯，我做财务经办。陆经理说，你想核一下材料。'],
    ['player','我手里这几份，有看不明白的地方。'],['lin','先说哪一份。日期、编号最好一起给我。'])},
  topic('T07','lu','月报和核验对不上',
    '月报说有收益，核验却连成交都没有。','哪一份？……这份我看到了。',
    '项目编号和时间都对过，是同一个项目。','你把这几行标出来。我找人核一下这三期。'),
  topic('T08','lin','不同批次的支付安排',
    '周姐那三个月是按月拿的，丙怎么不一样？','不是同一批。你先看“支付安排”那一栏，跟周岚那行不一样。',
    '还得再对合同？','嗯。看丙签的是哪份、约定哪天付。先别照周岚的日子算。'),
  {id:'T09',character:'lin',title:'历史到期表怎样核对'},
  {id:'T10',character:'zhou',title:'其他客户为何参与',lines:lines(
    ['player','登记表上这个人，你认识吗？'],['zhou','认识，要不我帮你问问？'],
    ['player','好，我想听听他当时怎么决定的。'],['zhou','那你等我一下。'],
    ['zhou','这就是我刚说的朋友。'],['player','你好，方便聊两句吗？'],['customer-d','行，你问吧。'])},
  topic('T11','customer-d','客户丁的判断依据',
    '你当时怎么决定投这里的？','执照我看过，周姐又说钱确实到了。',
    '你更信周姐自己的经历？','嗯，认识的人自己拿到了，我就觉得能试试。',
    '他们实际做过哪些交易，你看过吗？','没有，具体的我没查过。'),
  topic('T12','lin','两个账户的用途',
    '这两个户都挂着公司名，平时怎么用？','收认购和对客付款走C户，M户留存资金。用途写在表上。',
    '陆总能直接动里面的钱？','两户归公司。谁能签、谁能批，这张没列。'),
  topic('T13','lin','内部划转如何核对',
    'C这边转出一笔，M那边正好进了一笔。','把两边的TRF号对上。日期、金额也看看，别只认那个数。',
    '对上了，就能接成同一笔？','嗯。两边都是公司的户，再接着看它后来有没有出去。'),
  topic('T14','lin','合同与流水的范围',
    '这份客户清单，不能直接当那三个月收进来的钱。','对。这是存续合同，不是一到三月新收款的清单。',
    '那更早的钱去了哪儿？','这几页看不到。先把这段能对上的入款追清楚，别往银行期初余额里补一个数。'),
  topic('T15','lin','资产核对的范围',
    '这张资产表，是公司现在还剩下的东西？','看截止日。它跟前面那几份历史账是同一段，只到那天。',
    '那后面发生的交易呢？','得看之后的账，不能往这张旧表里添。'),
  {id:'T16',character:'lin',title:'到账与付款执行'},
  topic('T17','lu','追问实际付款来源',
    '这几笔新认购款进来，接着就付给了旧客户。','你把编号对过了？',
    '都对过。你之前说，这些收益是交易赚的。','这几笔我会给你回复。'),
  {id:'T18',character:'lu',title:'本次延期通知'},
  {id:'T19',character:'lu',title:'单独认购邀请'},
  topic('T20','lu','追加和退出分开决定',
    '我看过条款了，追加也不能保证先退。','对，退出还得单独申请。',
    '折价按申请时看到的那份？','嗯。你能接受，再填金额和理由。批下来才办。'),
  topic('T21','lu','通知没有回答的问题',
    '通知只说系统调整。经营记录、付款来源，一个也没解释。','你问的这几笔，我看到了。',
    '那就按这几笔回，别再拿同一张通知答我。','好。你列的这些，我收到了。'),
];

const dateLabel=month=>`${Number(month)+4}月`;
export function dialogueForTopic(item,context={}) {
  const base=DIALOGUE_TOPICS.find(topic=>topic.id===item.id);
  if(!base)return [];
  const read=new Set(context.read||[]);
  const snapshot=item.snapshot||context.snapshot||{};
  const month=context.month;
  let result=base.lines||[];
  if(item.id==='T09')result=(snapshot.variant?snapshot.variant==='document':read.has('D12A'))?exchange('lin',
    '到期表上列着要付的钱，就算已经付了吗？','这张列的是当时该付什么。真付了没有，还得查对应的执行记录。',
    '那我先拿它核合同？','可以，先对客户和日期。不同到期日的别混在一起。'):
    exchange('lin','丙那一笔，接下来该怎么核？','拿到他那批的到期表，先对客户和计划支付日，再跟合同核。',
      '这样就能确认钱到账了？','还得有对应日期、对应收款人的入账记录。光有计划，确认不了到账。');
  if(item.id==='T15'&&(snapshot.ownLedgerRead??read.has('C02')))result=[...result,{speaker:'lin',text:'你自己的收支，看那份单独登记。'}];
  if(item.id==='T16'){
    if(item.character==='zhou')result=exchange('zhou',
      '这份汇总里，你那三笔共一万四千四，对得上吗？','对，跟我给你那三张回单一样。',
      '当时每笔到账，你都查过自己的卡？','查过，钱确实进来了。',
      '他们拿什么钱付给你，你当时问过吗？','没问，我那会儿只顾着看到账了。');
    else if(snapshot.variant?snapshot.variant==='both':read.has('D10')&&read.has('D11'))result=exchange('lin',
      '指令上的PAY号，可以跟到账记录接起来。','再跟C户的支出对一下。收款人、日期、金额都得是同一笔。',
      '入款那头也要带上？','对，沿着来源流水号往前找。把同一笔钱的前后记录摆在一起。');
    else if(snapshot.variant?snapshot.variant==='instruction':read.has('D10'))result=exchange('lin',
      '这张写着付给谁，就说明已经付了？','这是公司留的付款指令。有没有执行，拿PAY号去银行流水里找。',
      '“来源流水号”这一栏呢？','拿它去C户的完整流水里对。先找到那笔入款，再往后接。');
    else if(snapshot.variant==='receipt'||read.has('D11'))result=exchange('lin',
      '这些款确实到账了。凭这个能追到钱从哪儿来？','这头能看到谁收了钱。往前追，用交易流水号去找付款户的完整流水。',
      '用途上写着“收益”，就算经营赚的？','那一行是付款方填的。具体怎么赚来的，得看项目做过什么业务。');
  }
  if(item.id==='T18'){
    const originalMonth=snapshot.noticeMonth??snapshot.month??item.month;
    const currentVersion=context.history&&snapshot.variant?snapshot.variant==='current':originalMonth===month;
    result=currentVersion?exchange('lu',
      '这次延期，哪些付款要缓？','这个月还没执行的部分收益先缓一缓，之前到账的不动。',
      '欠着的，后面会一起补吗？','先给你记着。什么时候能付，我现在定不了。'):
      exchange('lu',`这份${dateLabel(originalMonth)}的通知，当时停了哪些付款？`,'那次还没执行的部分收益缓了，已经到账的没动。',
        '那次欠下的，后来跟新一期一起补了吗？','之前欠着的还在登记里。新一期有没有到，得看那一期的记录。');
  }
  if(item.id==='T19'){
    const invitation=context.invitation||{};
    const originalMonth=snapshot.month??invitation.month??item.month;
    const status=context.history?(snapshot.statusAtView||'pending'):invitation.status;
    const handled=status&&status!=='pending';
    const readingMonth=context.history?(snapshot.viewedMonth??month):month;
    if(originalMonth!==readingMonth||handled||item.completed&&!context.history)result=exchange('lu',
      `${dateLabel(originalMonth)}那次单独认购，我想再看一下。`,'当时那份记录还在，按上面标的日期看。');
    else result=lines(
      ['lu',snapshot.crisisAtOffer??invitation.crisisAtOffer?
        '现在付款还在调整。这笔单独认购，我可以给你登记，办不办你再想想。':
        '普通认购窗口是关了。不过我这儿能给你单独登记一笔，本月有效。'],
      ['player','这笔什么时候开始结？'],['lu','下个月月初。没满整月的那段，按实际天数算。'],
      ['player','追加了，就能优先退出？'],['lu','这个我答应不了。认购是一笔，退出还得另申请。']);
  }
  return result.map(line=>({...line}));
}
