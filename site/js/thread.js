// ===== سلسلة المتابعة الموحدة: تعليقات/متابعات لأي عنصر (مهمة، طلب، تحدٍ، اعتماد، مستخلص، أمر تغيير، تقرير، إجازة) =====
import { sb, q, session, isAdmin } from './api.js';
import { $, $$, esc, dateAr, toast, err } from './ui.js';

export const THREAD_KINDS = { task: 'المهمة', request: 'الطلب', challenge: 'التحدي', submittal: 'الاعتماد', payment: 'المستخلص', change: 'أمر التغيير', treport: 'التقرير', leave: 'الإجازة', boq: 'جدول الكميات' };
// المتابعات القديمة لها جداولها؛ الباقي في comments
const WRITE = { request: ['request_replies', 'request_id'], challenge: ['challenge_notes', 'challenge_id'], treport: ['report_comments', 'report_id'] };
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';
const initials = n => (n || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('');
const when = d => { const m = Math.floor((Date.now() - new Date(d)) / 6e4); const t = new Date(d).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `اليوم ${t}` : m < 2880 ? `أمس ${t}` : `${dateAr(d)} ${t}`; };
const R_ST = { new: 'جديد', in_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', done: 'منفّذ', closed: 'مغلق' };

export const threadBox = (kind, refId, title = 'المتابعة والتعليقات') => `<div class="thread" data-th="${kind}:${refId}"><h3 class="sub-h thh">${esc(title)} <span class="muted thn"></span></h3><div class="thl"><p class="muted small">جارٍ التحميل…</p></div><form class="thf"><textarea name="body" rows="1" placeholder="اكتب متابعة… (Enter للإرسال، Shift+Enter لسطر جديد)" maxlength="2000"></textarea><button class="btn primary sm">إضافة</button></form></div>`;

export async function mountThread(container, kind, refId, { projectId = null, onPosted = null } = {}) {
  const box = container.matches?.('.thread') ? container : $(`.thread[data-th="${kind}:${refId}"]`, container); if (!box) return;
  await loadProfiles(); const me = session.user.id, admin = isAdmin();
  const list = $('.thl', box), form = $('.thf', box), ta = $('textarea', form), n = $('.thn', box);
  const render = async () => {
    const rows = await q(sb.from('v_thread').select('*').eq('kind', kind).eq('ref_id', refId).order('at'));
    n.textContent = rows.length ? `(${rows.length})` : '';
    list.innerHTML = rows.length ? rows.map(r => `<div class="tm ${r.by_user === me ? 'mine' : ''}" data-uid="${r.uid}"><span class="av">${esc(initials(pname(r.by_user)))}</span><div class="tb"><div class="th"><b>${esc(pname(r.by_user))}</b><small>${when(r.at)}</small>${r.status_after ? `<span class="badge skel">${R_ST[r.status_after] || esc(r.status_after)}</span>` : ''}${admin || r.by_user === me ? `<button type="button" class="x" data-del="${r.uid}" title="حذف">✕</button>` : ''}</div><div class="tx">${esc(r.body)}</div></div></div>`).join('') : '<p class="muted small thempty">لا متابعات بعد — أول متابعة تُسجَّل باسمك وتُحسب نشاطاً على المشروع.</p>';
    list.scrollTop = list.scrollHeight;
    $$('[data-del]', list).forEach(b => b.onclick = async () => { const uid = b.getAttribute('data-del'); const [p, id] = uid.split('-'); const tbl = { c: 'comments', r: 'request_replies', n: 'challenge_notes', t: 'report_comments' }[p]; try { await q(sb.from(tbl).delete().eq('id', +id)); render(); } catch (e) { err(e); } });
  };
  const post = async () => {
    const body = ta.value.trim(); if (!body) return; const btn = $('button', form); btn.disabled = true;
    try {
      const w = WRITE[kind];
      if (w) { const row = { body, by_user: me }; row[w[1]] = refId; await q(sb.from(w[0]).insert(row)); }
      else await q(sb.from('comments').insert({ kind, ref_id: refId, project_id: projectId, body, by_user: me }));
      ta.value = ''; ta.style.height = ''; await render(); onPosted && onPosted(body); toast('سُجّلت المتابعة');
    } catch (e) { err(e); } finally { btn.disabled = false; }
  };
  form.onsubmit = e => { e.preventDefault(); post(); };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
  await render();
}
