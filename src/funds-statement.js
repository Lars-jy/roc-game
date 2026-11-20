import { publicFinance } from './body/finance.js';

const money=value=>(value/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(month,day)=>`${month+4}月${day}日`;

/** A read-only, current statement; opening it never creates evidence or a transaction. */
export function fundsStatement(finance){
  const f=publicFinance(finance);
  let balance=f.initial;
  const rows=[['4月1日','期初余额','—','—',money(balance),'—']];
  for(const entry of f.ledger){
    balance+=entry.cashDelta;
    const details=[];
    if(entry.requested)details.push(`申请本金 ${money(entry.requested)} 元`);
    if(entry.quote&&entry.requested)details.push(`清算比例 ${entry.quote}%`);
    if(entry.lossDelta)details.push(`折价损失 ${money(entry.lossDelta)} 元`);
    if(entry.unpaidDelta>0)details.push(`未付 ${money(entry.unpaidDelta)} 元`);
    rows.push([date(entry.month,entry.day),entry.label,
      entry.cashDelta>0?money(entry.cashDelta):'—',
      entry.cashDelta<0?money(-entry.cashDelta):'—',money(balance),details.join('；')||'—']);
  }
  return {id:'FUNDS',title:'资金流水',issuer:'个人资金登记',number:'JD-07-ZJ',date:date(f.month,f.day),blocks:[
    {kind:'table',title:'账户摘要（人民币：元）',headers:['项目','金额','项目','金额'],rows:[
      ['可用现金',money(f.cash),'未结清本金',money(f.principal)],
      ['收益实际到账',money(f.totalInterest),'清盘奖励',money(f.earnedTile)],
      ['退出实际收回',money(f.totalReturned),'累计折价损失',money(f.totalLoss)],
      ['累计认购',money(f.totalInvested),'应付未付收益',money(f.unpaidInterest)],
    ]},
    {kind:'table',title:'现金收支明细（人民币：元）',headers:['日期','业务摘要','收入','支出','现金余额','附记'],rows,numericColumns:[2,3,4]},
    {kind:'text',title:'登记说明',body:'现金余额仅计入实际收付。未结清本金、应付未付收益与折价损失分别登记，不计入可用现金。本表为本人业务记录，非平台银行账户流水。'},
  ]};
}
