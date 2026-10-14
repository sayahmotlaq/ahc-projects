// ===== ربط شاشات المنصة بدليل الإجراءات والحوكمة =====
// govBar(code, step) يضع شريطاً يُملأ تلقائياً: الإجراء الحاكم، الخطوة الحالية ومن يملكها، والتالي؛ والنقر عليه (أو على أي [data-peek])
// يفتح الإجراء في نافذة جانبية فوق الشاشة الحالية على الخطوة نفسها. govChip(code) شارة مختصرة لرؤوس القوائم.
import { esc } from './ui.js';

let mod = null;
const gov = () => (mod ||= import('./gov.js'));

export const govBar = (map, note = '') => {
  if (!map) return '';
  const [code, step] = map;
  return `<div class="govbar" data-gov="${esc(code)}" data-step="${esc(step ?? '')}" data-note="${esc(note)}"></div>`;
};
export const govChip = (code, label = '') => `<a class="gref gchip" href="#/gov/sop/${esc(code)}" data-peek="${esc(code)}" title="الإجراء الحاكم في دليل الإجراءات">📘 ${esc(code)}${label ? ' · ' + esc(label) : ''}</a>`;

// ---------- أين يقف كل عنصر في دليل إجراءات المشاريع (P-) — [الإجراء, الخطوة | 'done']
export const GOV = {
  project: p => ({ request: ['P-01', 1], study: ['P-01', 3], approval: ['P-01', 6], design: ['P-03', 1], tender: ['P-03', 3], award: ['P-03', 5], execution: ['P-05', 1], handover: ['P-13', 4], warranty: ['P-14', 3], closed: ['P-14', 'done'], onhold: ['P-09', 2] })[p?.stage] || null,
  boq: b => ({ draft: ['P-02', 2], approved: ['P-02', 5], tender: ['P-03', 3], awarded: ['P-03', 5], final: ['P-07', 1] })[b?.status] || ['P-02', 2],
  submittal: s => ({ submitted: ['P-06', 2], reviewed: ['P-06', 3], decided: ['P-06', 5] })[s?.status] || ['P-06', 1],
  payment: x => ({ draft: ['P-07', 2], submitted: ['P-07', 3], review: ['P-07', 3], approved: ['P-07', 4], finance: ['P-07', 5], paid: ['P-07', 'done'], rejected: ['P-07', 2] })[x?.status] || ['P-07', 1],
  change: c => ({ draft: ['P-08', 2], submitted: ['P-08', 3], approved: ['P-08', 6], rejected: ['P-08', 'done'] })[c?.status] || ['P-08', 1],
  challenge: c => c?.status === 'مغلق' ? ['P-09', 'done'] : c?.status === 'مفتوح' ? ['P-09', 2] : ['P-09', 3],
  task: t => !t ? ['P-10', 1] : ['done', 'cancelled'].includes(t.status) ? ['P-10', 'done'] : ['P-10', 2],
  request: r => !r ? ['P-10', 3] : ['new', 'in_review'].includes(r.status) ? ['P-10', 4] : ['P-10', 'done'],
  treport: r => {
    if (!r) return ['P-05', 1];
    if (r.kind === 'meeting') return ({ draft: ['P-12', 1], returned: ['P-12', 1], published: ['P-12', 3], reviewed: ['P-12', 'done'] })[r.status] || ['P-12', 1];
    if (r.kind === 'incident') return r.status === 'reviewed' ? ['P-05', 'done'] : ['P-05', 6];
    if (r.status === 'published') return ['P-05', 4];
    if (r.status === 'reviewed') return ['P-05', 'done'];
    return ['P-05', r.kind === 'monthly' || r.kind === 'status' ? 3 : 1];
  },
  schedule: hasBaseline => hasBaseline ? ['P-05', 2] : ['P-04', 3],
  closeout: p => p?.stage === 'warranty' ? ['P-14', 3] : p?.stage === 'closed' ? ['P-14', 'done'] : ['P-13', 4],
  tender: () => ['P-03', 3],
};

// ---------- ملء الأشرطة عند ظهورها في أي مكان (صفحة أو نافذة)
async function fill(el) {
  el.dataset.ok = '1';
  try {
    const m = await gov(); await m.govData();
    const st = el.dataset.step; el.innerHTML = m.govBarHtml(el.dataset.gov, st === 'done' ? 'done' : st ? Number(st) : null, el.dataset.note || '');
    if (el.innerHTML) el.classList.add('on');
  } catch { el.remove(); }
}
const scan = root => (root.querySelectorAll ? root.querySelectorAll('.govbar:not([data-ok])') : []).forEach(fill);
new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches?.('.govbar:not([data-ok])')) fill(n); else scan(n); } }); }).observe(document.documentElement, { childList: true, subtree: true });

// ---------- النقر على أي إحالة يفتح النافذة الجانبية (من أي صفحة)
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-peek]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault(); e.stopPropagation();
    const st = a.dataset.step; const m = await gov();
    m.openPeek(a.dataset.peek, st === 'done' ? 'done' : st ? Number(st) : null);
    return;
  }
  const b = e.target.closest('[data-pk]'); if (b && mod) { const m = await gov(); m.peekAction(b.dataset.pk); }
}, true);
document.addEventListener('keydown', async e => { if (e.key === 'Escape' && mod) { const m = await gov(); if (m.peekOpen()) { e.stopPropagation(); m.peekAction('x'); } } }, true);
window.addEventListener('hashchange', async () => { if (mod) { const m = await gov(); if (m.peekOpen()) m.peekAction('x'); } });
