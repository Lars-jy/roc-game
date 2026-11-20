import { createPaperPageMotion } from './paper-page-motion.js';

/** Month-start paperwork. Browsing drafts never changes money or business eligibility. */
export function createMonthlyContracts({ getState, subscription, getOptions, confirmExit, sound = () => {}, notify = () => {} }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'monthly-contracts-dialog';
  dialog.setAttribute('aria-label', '月初业务文件');
  document.body.append(dialog);
  const pageMotion=createPaperPageMotion(dialog);
  let context, page = 'covers', amount = '', reason = '', acknowledged = false, busy = false;
  let exitPrincipal = 0, exitQuote = 0, outcome, subscriptionActive = false, purchaseVisited = false, exitPage = 'application';
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = cents => (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function parseAmount(value) {
    const text = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
    const [whole, fraction = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) ? cents : NaN;
  }
  const options = () => getOptions(getState());
  const sameContext = () => { const state = getState(); return context && state.seed === context.seed && state.month === context.month && state.window === 'invest'; };
  function close() { pageMotion.cancel();dialog.close(); if (subscriptionActive) subscription.close(); subscriptionActive = false; }
  function stale() { close(); notify('这份业务文件已过期，请重新打开。'); }
  function show() { render(); if (!dialog.open) dialog.showModal(); }
  function cover(kind, title, subtitle, number) {
    const month=String(context.month+4).padStart(2,'0');
    const heading=kind==='exit'?'退出申请及清算文件':'投资产品认购文件';
    return `<button type="button" class="monthly-contract-cover" data-monthly="${kind}" aria-label="${title}"><span class="monthly-cover-masthead"><span>金鼎财富</span><span>客户业务文件</span></span><span class="monthly-cover-number">文件编号：JD-WY-2026-${month}${number}</span><span class="monthly-cover-main"><span class="monthly-cover-brand">稳盈计划</span><strong>${heading}</strong><span class="monthly-cover-rule"></span><span class="monthly-cover-subtitle">${subtitle}</span></span><span class="monthly-cover-filing"><span>客户姓名：<span class="monthly-cover-blank">本人</span></span><span>业务月份：2026年${context.month+4}月</span></span><span class="monthly-cover-footer"><span>金鼎财富客户服务组</span><span>二〇二六年${['四','五','六','七'][context.month]}月</span></span><span class="monthly-cover-edition">业务留存文件　｜　游戏虚构材料</span></button>`;
  }
  function render() {
    pageMotion.cancel();
    const state = getState(), month = context.month + 4;
    if (page === 'covers') {
      const available = options();
      dialog.innerHTML = `<button type="button" class="paper-scene-back" data-monthly="close" aria-label="返回"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M17 5 6 16l11 11M7 16h27"/></svg></button><section class="monthly-cover-layout" aria-label="业务文件封面">${cover('subscribe', '产品认购文件', '认购单 · 业务确认书 · 风险揭示书', '01')}${available.canExit ? cover('exit', '退出业务文件', '退出申请 · 清算确认单', '02') : ''}</section>`;
      return;
    }
    const cents = parseAmount(amount), requested = Number.isSafeInteger(cents) ? cents : 0;
    const estimated = Math.round(requested * exitQuote / 100);
    let title, body;
    if (page === 'application') {
      title = '项目退出申请书';
      body = `<p>申请人：<span class="paper-blank">本人</span></p><p>受理方：金鼎财富（虚构）</p><h3>一、申请登记</h3><dl><dt>项目名称</dt><dd>稳盈计划</dd><dt>申请日期</dt><dd>2026年${month}月${state.finance.day}日</dd><dt>未结清本金</dt><dd>人民币 ¥ ${money(exitPrincipal)}</dd></dl><h3>二、本次申请金额</h3><label class="paper-amount">人民币 ¥ <input id="monthly-exit-amount" type="text" inputmode="decimal" autocomplete="off" maxlength="16" aria-label="申请退出金额（元）" placeholder="0.00" value="${esc(amount)}"> 元</label><h3>三、退出理由</h3><textarea id="monthly-exit-reason" maxlength="2000" aria-label="退出理由">${esc(reason)}</textarea><p class="paper-small">本申请可涉及本人全部未结清本金中的部分或全部。最终受理情况及实收款项以清算确认单为准。</p><p class="paper-signature">申请人：本人<span>受理登记：金鼎财富</span></p>`;
    } else if (page === 'preview') {
      title = '项目清算确认单';
      body = `<p class="monthly-paper-status">受理状态：待本人确认 · 待审批</p><h3>一、本次申请</h3><dl><dt>申请退出本金</dt><dd>¥ ${money(requested)}</dd><dt>本次清算比例</dt><dd>${exitQuote}%</dd><dt>按比例折减</dt><dd>¥ ${money(requested - estimated)}</dd><dt>拟结算金额</dt><dd>¥ ${money(estimated)}</dd></dl><h3>二、申请理由</h3><p class="monthly-reason-copy">${esc(reason)}</p><h3>三、清算事项</h3><p>上述金额为本次申请的清算条件，尚未实际到账。申请获准后，按本单比例结算；未获批准时，本次不付款，申请本金仍在项目内登记。</p><p>本单确认后登记本次申请，本月月初业务办理随即结束。</p><label class="paper-ack"><input id="monthly-exit-ack" type="checkbox" ${acknowledged ? 'checked' : ''}>本人已阅读并确认本次申请及清算条件。</label><p class="paper-signature">申请人：本人<span>登记日期：${month}月${state.finance.day}日</span></p>`;
    } else {
      title = '项目清算确认单';
      body = `<p class="monthly-paper-status">受理结果：${outcome.success ? '已批准 · 清算完成' : '未获批准'}</p><h3>一、申请登记</h3><dl><dt>申请退出本金</dt><dd>¥ ${money(outcome.amount)}</dd><dt>本次清算比例</dt><dd>${outcome.quote}%</dd><dt>实际到账</dt><dd><strong>¥ ${money(outcome.received)}</strong></dd><dt>本次折减</dt><dd>¥ ${money(outcome.loss)}</dd></dl><h3>二、清算记录</h3><p>${outcome.success ? '本次申请已按上述清算条件办理，实际到账款项已记入本人资金流水，相关本金同步结清。' : '本次申请未获批准，未产生实际付款，申请本金未予结清。本单所列清算比例未实际执行。'}</p><h3>三、申请理由存档</h3><p class="monthly-reason-copy">${esc(outcome.reason || reason)}</p><p class="paper-signature">申请人：本人<span>业务受理：金鼎财富</span></p>`;
    }
    const isResult = page === 'result', pageNumber = page === 'application' ? 1 : 2;
    dialog.innerHTML = `<button type="button" class="paper-scene-back" data-monthly="${isResult ? 'close' : 'back'}" aria-label="返回"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M17 5 6 16l11 11M7 16h27"/></svg></button><div class="subscription-layout monthly-exit-layout"><article class="subscription-paper monthly-exit-paper" aria-label="${title}"><header><p class="paper-agreement-no">业务编号：TC-2026-${String(month).padStart(2, '0')}01</p><h1>稳盈计划</h1><h2>${title}</h2></header><section class="subscription-body">${body}</section><footer>第 ${pageNumber} 页 / 共 2 页 · 游戏虚构道具</footer></article><aside class="subscription-side">${!isResult ? `<nav aria-label="退出文件翻页"><button type="button" data-monthly="previous" ${page === 'application' ? 'disabled' : ''} aria-label="上一页">‹</button><span>${pageNumber} / 2</span><button type="button" data-monthly="next" ${page === 'preview' ? 'disabled' : ''} aria-label="下一页">›</button></nav>` : ''}${page === 'preview' ? `<button type="button" class="paper-confirm" data-monthly="confirm" ${!acknowledged || busy ? 'disabled' : ''}>确认申请</button>` : ''}</aside></div>`;
  }
  function validateApplication() {
    const available = options(), cents = parseAmount(amount);
    if (!available.canExit) { stale(); return false; }
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > available.principal) { notify('请填写未结清本金范围内的退出金额，最多两位小数。'); return false; }
    if (!reason.trim() || reason.length > 2000) { notify('请填写本次退出理由（不超过2000字）。'); return false; }
    return true;
  }
  dialog.addEventListener('input', event => {
    if (event.target.id === 'monthly-exit-amount') { amount = event.target.value; acknowledged = false; }
    if (event.target.id === 'monthly-exit-reason') { reason = event.target.value; acknowledged = false; }
  });
  dialog.addEventListener('change', event => {
    if (event.target.id !== 'monthly-exit-ack') return;
    acknowledged = event.target.checked;
    const button = dialog.querySelector('[data-monthly="confirm"]');
    if (button) button.disabled = !acknowledged || busy;
  });
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-monthly]')?.dataset.monthly;
    if (!action || busy) return;
    if (action === 'close') { close(); return; }
    if (!sameContext()) { stale(); return; }
    if (action === 'back') { exitPage = page; page = 'covers'; sound(); render(); return; }
    if (action === 'subscribe') {
      if (!options().canSubscribe) { stale(); return; }
      dialog.close(); subscriptionActive = true;
      subscription.open('monthly', { preserveDraft: purchaseVisited, onBack() { subscriptionActive = false; if (!sameContext()) { stale(); return; } page = 'covers'; show(); } });
      purchaseVisited = true; return;
    }
    if (action === 'exit') {
      const available = options(); if (!available.canExit) { stale(); return; }
      if (exitPrincipal !== available.principal || exitQuote !== available.exitQuote) { acknowledged = false; exitPage = 'application'; }
      exitPrincipal = available.principal; exitQuote = available.exitQuote;
      page = exitPage; sound(); render(); return;
    }
    if (action === 'next') {
      if (!validateApplication()) return;
      const available = options(); exitPrincipal = available.principal; exitQuote = available.exitQuote;
      page = exitPage = 'preview'; sound(); pageMotion.turn(render,1); return;
    }
    if (action === 'previous') { page = exitPage = 'application'; sound(); pageMotion.turn(render,-1); return; }
    if (action === 'confirm' && page === 'preview' && acknowledged) {
      if (!validateApplication()) return;
      const available = options();
      if (available.principal !== exitPrincipal || available.exitQuote !== exitQuote) {
        exitPrincipal = available.principal; exitQuote = available.exitQuote; acknowledged = false; page = 'application';
        notify('本金记录已变化，请重新核对申请及清算条件。'); render(); return;
      }
      busy = true; render();
      let result;
      try { result = confirmExit({ amount: parseAmount(amount), reason: reason.trim(), context: { ...context } }); }
      finally { busy = false; }
      if (result?.error) { render(); return; }
      const request = result?.state?.finance?.requests?.at(-1);
      if (!request || request.month !== context.month || request.amount !== parseAmount(amount)) { close(); notify('请在资金流水中核对本次申请受理记录。'); return; }
      outcome = { ...request }; page = 'result'; pageMotion.turn(show,1); sound();
    }
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault();else pageMotion.cancel(); });
  return {
    open({ preserveDraft = false } = {}) {
      const state = getState(), keep = preserveDraft && context?.seed === state.seed && context?.month === state.month;
      close(); context = { seed: state.seed, month: state.month };
      if (!keep) { amount = ''; reason = ''; acknowledged = false; outcome = undefined; purchaseVisited = false; exitPage = 'application'; }
      busy = false; page = 'covers';
      if (!sameContext() || !options().canSubscribe) { stale(); return; }
      show(); sound();
    },
    close,
    get isOpen() { return dialog.open || subscriptionActive && subscription.isOpen; },
  };
}
