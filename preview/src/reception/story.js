/** Approved reception dialogue. Claims belong to the named fictional speakers. */
const line = (speaker, text, scene = 'together') => Object.freeze({ speaker, text, scene });
const group = (...lines) => Object.freeze(lines);

export const SPEAKERS = Object.freeze({
  lu: Object.freeze({ name: '陆衡', role: '客户经理' }),
  zhou: Object.freeze({ name: '周岚', role: '老客户' }),
  player: Object.freeze({ name: '我', role: '' }),
});

export const BRANCHES = Object.freeze([
  Object.freeze({ id: 'materials', label: '先看看认购资料', note: '产品说明与认购协议' }),
  Object.freeze({ id: 'lu', label: '这么高的收益，钱从哪儿来？', note: '收益与退出' }),
  Object.freeze({ id: 'zhou', label: '周姐，那你的本金呢？', note: '她的实际收款经历' }),
  Object.freeze({ id: 'skip', label: '我先自己看看', note: '跳过问询' }),
]);

export const STORY = Object.freeze({
  entrance: group(
    line('zhou', '来了啊！快进来。这位就是我跟你说的陆总，', 'arrival'),
    line('zhou', '我之前赚的那些钱，就是跟着他投的。', 'arrival'),
    line('lu', '邀请函收到了吧。坐，咱们慢慢聊。', 'arrival'),
  ),
  intro: group(
    line('lu', '我们这边有个“稳盈计划”，每个月8%的固定收益。', 'seated'),
    line('lu', '简单来说，你投一万，一个月就是八百。', 'seated'),
    line('zhou', '我之前投了六万，三个月下来，一万四千四，实打实到账了。', 'seated'),
    line('player', '真打你卡里了？', 'seated'),
    line('zhou', '喏，银行回单，你自己看看吧。', 'placing'),
  ),
  materials: group(
    line('player', '有认购资料吗？我想看看。'),
    line('lu', '有，都在这儿。收益怎么算、什么时候结算、怎么退出，'),
    line('lu', '上面写得挺清楚。'),
  ),
  lu: group(
    line('player', '一个月8%，你们靠什么赚这么多！？'),
    line('lu', '主要是团队在做价差交易。你要是感兴趣，我这儿还有项目月报。'),
    line('player', '那我想把钱取出来呢？'),
    line('lu', '你要是想月结体验的话，等到下次结算，'),
    line('lu', '你可以选择继续投，也可以申请退出。'),
  ),
  zhou: group(
    line('player', '周姐，你那六万本金取出来了吗？'),
    line('zhou', '没呢，还在里面放着。我现在每个月拿四千八，挺稳定的。'),
    line('player', '那他们具体拿钱做什么交易，你知道吗？'),
    line('zhou', '这我还真没细看。反正每个月钱都准时到，我也就没多问。'),
  ),
  finish: group(
    line('player', '行，我先自己看看。'),
  ),
  osReceipt: group(
    line('player', 'os: 三个月，一万四千四，倒是跟她说的对得上。'),
    line('player', 'os: 不过，这几笔都是收益……她那六万本金，取出来过吗？'),
  ),
  osReceiptKnown: group(
    line('player', 'os: 收益确实到账了。不过，本金还在里面，是另一回事。'),
  ),
  osProduct: group(
    line('player', 'os: 每个月都能拿钱，本金还安全……听着确实让人心动。'),
    line('player', 'os: 这上面提到的“价差交易”，到底是怎么做的？'),
  ),
  osAgreement: group(
    line('player', 'os: 他说想退出就能申请，合同上写的也是“申请”……'),
    line('player', 'os: 那申请之后，钱什么时候才能回来？'),
  ),
});
