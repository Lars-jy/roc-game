import { createPaperPageMotion } from './paper-page-motion.js';

/** Paper-only presentation. Money and dates are still decided by the case reducer. */
export function createSubscriptionPaper({ getState, confirm, sound, notify }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'subscription-dialog'; dialog.setAttribute('aria-label', '产品认购文件');
  document.body.append(dialog);
  const pageMotion=createPaperPageMotion(dialog);
  let page = 0, amount = '', acknowledged = false, busy = false, mode = 'monthly', openedAt, onBack;
  const drafts = new Map();
  const draftKey = (value, context) => `${value}:${context.seed}:${context.month}`;
  const remember = () => { if (openedAt) drafts.set(draftKey(mode, openedAt), { page, amount, acknowledged }); };
  function returnToCover() { pageMotion.cancel(); remember(); dialog.close(); const callback = onBack; onBack = undefined; callback?.(); }
  const money = cents => (cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function render() {
    pageMotion.cancel();
    const state = getState(), month = state.month + 4, nextMonth = month + 1;
    const number = `WY-2026-${String(month).padStart(2, '0')}${mode === 'private' ? '02' : '01'}`;
    const title = ['投资产品认购单', '认购业务确认书', '风险揭示书'][page];
    const body = page === 0 ? `
      <p>甲方（认购人）：<span class="paper-blank">本人</span></p>
      <p>乙方（项目管理方）：金鼎财富（虚构）</p>
      <h3>第一条　产品基本信息</h3>
      <dl><dt>产品名称</dt><dd>稳盈计划</dd><dt>业务日期</dt><dd>2026年${month}月${state.finance.day}日</dd><dt>业务类别</dt><dd>${mode === 'private' ? '老客户额外认购' : '月初认购'}</dd><dt>宣传收益</dt><dd>每月固定收益8%</dd><dt>约定结算</dt><dd>每月结算，首次为${nextMonth}月1日</dd></dl>
      <h3>第二条　认购金额</h3>
      <label class="paper-amount">人民币 ¥ <input id="subscription-amount" type="text" inputmode="decimal" autocomplete="off" maxlength="16" aria-label="认购金额（元）" placeholder="0.00" value="${esc(amount)}"> 元</label>
      <p class="paper-small">本人可用现金：¥ ${money(state.finance.cash)}。本次不认购可填写0元。</p>
      <p class="paper-signature">认购人：本人<span>业务登记：金鼎财富</span></p>` : page === 1 ? `
      <h3>一、金额登记</h3><p>本次申请认购人民币 <strong>¥ ${money(parseAmount(amount) || 0)}</strong>。经本人确认后，从可用现金中划入项目认购登记。</p>
      <h3>二、收益计算</h3><p>月约定收益率8%，采用单利，不自动复投。以实际未结清本金和持有天数计算；不足整月，按所在自然月实际天数折算。同月各段合并结算到分。</p>
      <h3>三、结算安排</h3><p>本次认购的首次约定结算日为2026年${nextMonth}月1日。约定金额与实际到账分别记录；最终以本人资金流水、到账回单为准。</p>
      <h3>四、本人确认</h3><p>本单仅登记本次业务。阅读项目文件不等于已经认购，未确认前不扣除资金。</p>
      <p class="paper-signature">认购人：本人<span>日期：${month}月${state.finance.day}日</span></p>` : `
      <h3>致认购人</h3><p>请阅读以下事项，并结合您已获得的项目材料，自行决定是否参与本次认购。</p>
      <h3>一、收益与付款风险</h3><p>宣传和约定收益不代表项目实际经营利润，也不等于款项已经支付。实际支付可能延期；已到账与应付未付金额分别登记。</p>
      <h3>二、本金与资金使用风险</h3><p>认购资金划入项目后，不再计入本人可用现金。项目可能出现资金周转困难，存在本金不能按预期收回的风险。</p>
      <h3>三、材料核实</h3><p>历史到账回单、项目月报及他人的经历，各自只反映其记载范围。本人应独立核对材料，不将单份资料视为完整保证。</p>
      <label class="paper-ack"><input id="subscription-ack" type="checkbox" ${acknowledged ? 'checked' : ''}>本人已阅读本次认购文件及风险揭示。</label>
      <p class="paper-final-amount">本次认购金额：<strong>¥ ${money(parseAmount(amount) || 0)}</strong></p>`;
    dialog.innerHTML = `<button type="button" data-paper="back" class="paper-scene-back" aria-label="返回"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M17 5 6 16l11 11M7 16h27"/></svg></button><div class="subscription-layout"><article class="subscription-paper" aria-label="${title}"><header><p class="paper-agreement-no">业务编号：${number}</p><h1>稳盈计划</h1><h2>${title}</h2></header><section class="subscription-body">${body}</section><footer>第 ${page + 1} 页 / 共 3 页 · 游戏虚构道具</footer></article><aside class="subscription-side"><nav aria-label="认购文件翻页"><button type="button" data-paper="previous" ${page === 0 ? 'disabled' : ''} aria-label="上一页">‹</button><span>${page + 1} / 3</span><button type="button" data-paper="next" ${page === 2 ? 'disabled' : ''} aria-label="下一页">›</button></nav>${page === 2 ? `<button type="button" class="paper-confirm" data-paper="confirm" ${!acknowledged || busy ? 'disabled' : ''}>确认</button>` : ''}</aside></div>`;
  }
  function parseAmount(value) {
    const text = String(value).trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
    const [whole, fraction = ''] = text.split('.'); const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) ? cents : NaN;
  }
  dialog.addEventListener('input', event => { if (event.target.id === 'subscription-amount') { amount = event.target.value; acknowledged = false; } });
  dialog.addEventListener('change', event => { if (event.target.id === 'subscription-ack') { acknowledged = event.target.checked; dialog.querySelector('[data-paper="confirm"]').disabled = !acknowledged || busy; } });
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-paper]')?.dataset.paper; if (!action || busy) return;
    if (action === 'close' || action === 'back') { returnToCover(); return; }
    if (action === 'next' && page === 0) {
      const cents = parseAmount(amount || '0');
      if (!Number.isSafeInteger(cents) || cents > getState().finance.cash) { notify('请填写可用现金范围内的金额，最多两位小数。'); return; }
      if (!amount.trim()) amount = '0';
    }
    if (action === 'next' || action === 'previous') { const direction=action==='next'?1:-1;page = Math.max(0, Math.min(2, page + direction)); sound(); pageMotion.turn(render,direction); return; }
    if (action === 'confirm' && acknowledged) {
      const latest=getState();
      if(latest.seed!==openedAt.seed || latest.month!==openedAt.month || (mode==='monthly' ? latest.window!=='invest' : latest.invitation.status!=='pending'||latest.invitation.month!==latest.month)) { dialog.close(); notify('这份认购文件已过期，请重新打开。'); return; }
      const cents = parseAmount(amount || '0');
      if (!Number.isSafeInteger(cents) || cents > getState().finance.cash) { notify('可用现金已变化，请重新核对认购金额。'); page = 0; render(); return; }
      busy = true; render();
      const result = confirm({ mode, amount: cents, context:openedAt }); busy = false;
      if (!result?.error) { pageMotion.cancel();drafts.delete(draftKey(mode, openedAt)); onBack = undefined; dialog.close(); } else render();
    }
  });
  dialog.addEventListener('cancel', event => { if (busy) { event.preventDefault(); return; } if (onBack) { event.preventDefault(); returnToCover(); } });
  return {
    open(value = 'monthly', options = {}) { remember(); mode = value; const state=getState();openedAt={seed:state.seed,month:state.month}; const draft=options.preserveDraft ? drafts.get(draftKey(mode, openedAt)) : undefined; page = draft?.page ?? 0; amount = draft?.amount ?? ''; acknowledged = draft?.acknowledged ?? false; busy = false; onBack=typeof options.onBack==='function' ? options.onBack : undefined; render(); if (!dialog.open) dialog.showModal(); sound(); },
    close() { pageMotion.cancel();remember(); onBack = undefined; dialog.close(); },
    get isOpen() { return dialog.open; },
  };
}
