/** Player-authored conclusions are recorded for review, never graded. */
export const OPEN_RESPONSE_LIMIT = 50_000;
export const OPEN_RESPONSE_FIELDS = Object.freeze([
  Object.freeze({ id: 'story', label: '从收到邀请到现在，你经历了什么？请根据玩家视角还原整个故事。' }),
  Object.freeze({ id: 'relationships', label: '梳理陆衡、周岚、林乔的人物关系。他们之间、与你之间是什么关系？' }),
  Object.freeze({ id: 'responsibility', label: '你认为谁应当为这件事负责？' }),
  Object.freeze({ id: 'consequence', label: '你认为他应该受到／付出怎样的代价？' }),
]);

const fieldIds = new Set(OPEN_RESPONSE_FIELDS.map(field => field.id));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A draft may be partial; submitting requires a nonblank response in all fields. */
export function validateOpenResponse(value, { submitted = false } = {}) {
  if (!record(value) || Object.keys(value).some(id => !fieldIds.has(id))) return false;
  if (!Object.values(value).every(text => typeof text === 'string' && text.length <= OPEN_RESPONSE_LIMIT)) return false;
  return !submitted || OPEN_RESPONSE_FIELDS.every(field => typeof value[field.id] === 'string' && value[field.id].trim().length > 0);
}

/** Completeness only: choosing a distractor still counts as answering a question. */
export function isQuestionAnswered(question, answer) {
  if (!question) return false;
  if (question.type === 'open') return validateOpenResponse(answer, { submitted: true });
  if (!Array.isArray(answer)) return false;
  const expected = question.multiple ? question.maxSelections || 2 : 1;
  const options = new Set((question.options || []).map(option => option.id));
  return answer.length === expected && new Set(answer).size === answer.length && answer.every(id => options.has(id));
}

export function questionProgress(questions, answers = {}) {
  const pendingIds = questions.filter(question => !isQuestionAnswered(question, answers?.[question.id])).map(question => question.id);
  return { answered: questions.length - pendingIds.length, total: questions.length, complete: pendingIds.length === 0, pendingIds };
}

const dates = ['4月1日', '5月1日', '5月2日', '5月3日'];
const ownMoneyKeys = ['cash', 'principal', 'totalInvested', 'totalInterest', 'totalReturned', 'earnedTile', 'pendingTile'];

/** Export only visible questions, player text and player funds; no author key. */
export function buildAnswerSheet({ questions, answers = {}, finance = {}, readDocs = [], exportedAt = new Date().toISOString() }) {
  const money = Object.fromEntries(ownMoneyKeys.map(key => [key, Number.isSafeInteger(finance[key]) ? finance[key] : 0]));
  return {
    format: 'jinding-player-answer-sheet', version: 1,
    title: 'R.O.C · 我的回答记录', exportedAt,
    progress: questionProgress(questions, answers),
    funds: { unit: '分', date: dates[finance.phase] || '', ...money },
    readDocs: [...readDocs],
    questions: questions.map(question => {
      const entry = {
        id: question.id, number: question.number || question.id.replace(/^Q/, ''),
        title: question.title, prompt: question.prompt || '',
        type: question.type === 'open' ? 'open' : question.multiple ? 'multiple' : 'single',
        submitted: isQuestionAnswered(question, answers[question.id]),
      };
      if (question.type === 'open') {
        entry.fields = OPEN_RESPONSE_FIELDS.map(field => ({ ...field }));
        const answer = record(answers[question.id]) ? answers[question.id] : {};
        entry.answer = Object.fromEntries(OPEN_RESPONSE_FIELDS.map(field => [field.id, typeof answer[field.id] === 'string' ? answer[field.id] : '']));
      } else {
        entry.options = (question.options || []).map(option => ({ id: option.id, text: option.text }));
        entry.answer = Array.isArray(answers[question.id]) ? [...answers[question.id]] : [];
      }
      return entry;
    }),
  };
}

const yuan = cents => (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function answerSheetMarkdown(sheet) {
  const f = sheet.funds;
  const lines = [
    `# ${sheet.title}`, '',
    `导出时间：${sheet.exportedAt}`, `已记录回答：${sheet.progress.answered} / ${sheet.progress.total}`, '',
    '## 我的资金记录', '',
    `记录日期：${f.date}`, `可用现金：${yuan(f.cash)} 元`, `未回本金：${yuan(f.principal)} 元`,
    `累计投入：${yuan(f.totalInvested)} 元`, `收益实际到账：${yuan(f.totalInterest)} 元`,
    `已退本金：${yuan(f.totalReturned)} 元`, `牌局已收工：${yuan(f.earnedTile)} 元`,
    `牌局未收工所得：${yuan(f.pendingTile)} 元`, '',
    '## 我的回答', '',
  ];
  for (const question of sheet.questions) {
    lines.push(`### ${question.number} · ${question.title}`, '', question.prompt, '');
    if (question.type === 'open') {
      for (const field of question.fields) lines.push(`**${field.label}**`, '', question.answer[field.id] || '（尚未填写）', '');
    } else {
      for (const option of question.options) lines.push(`- ${option.id}．${option.text}`);
      lines.push('', `我的选择：${question.answer.length ? question.answer.join('、') : '（尚未作答）'}`, '');
    }
    lines.push(`记录状态：${question.submitted ? '已提交' : '尚未提交'}`, '');
  }
  lines.push('## 已查阅资料', '', sheet.readDocs.length ? sheet.readDocs.join('、') : '尚无查阅记录', '');
  return lines.join('\n');
}
