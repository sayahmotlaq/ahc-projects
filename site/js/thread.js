// ===== سلسلة المتابعة الموحدة: تعليقات/متابعات لأي عنصر (مهمة، طلب، تحدٍ، اعتماد، مستخلص، أمر تغيير، تقرير، إجازة) =====
import { sb, q, session, isAdmin } from './api.js';
import { $, $$, esc, dateAr, toast, err } from './ui.js';
import { uploadAttachment, loadAttachments, attachChip, bindChips, ACCEPT } from './attach.js';

export const THREAD_KINDS = { task: 'المهمة', request: 'الطلب', challenge: 'التحدي', submittal: 'الاعتماد', payment: 'المستخلص', change: 'أمر التغيير', treport: 'التقرير', leave: 'الإجازة', boq: 'جدول الكميات' };
// المتابعات القديمة لها جداولها؛ الباقي في comments
const WRITE = { request: ['request_replies', 'request_id'], challenge: ['challenge_notes', 'challenge_id'], treport: ['report_comments', 'report_id'] };
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role')); return profiles; }
const mentionable = () => profiles.filter(p => p.role && p.role !== 'pending' && p.full_name);
// تمييز @الاسم في النص (الأسماء الأطول أولاً)
const hiMentions = html => { const names = mentionable().map(p => p.full_name.trim()).filter(Boolean).sort((a, b) => b.length - a.length); if (!names.length) return html; const re = new RegExp('@(' + names.map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g'); return html.replace(re, '<b class="mn">@$1</b>'); };
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';
const initials = n => (n || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('');
const when = d => { const m = Math.floor((Date.now() - new Date(d)) / 6e4); const t = new Date(d).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `اليوم ${t}` : m < 2880 ? `أمس ${t}` : `${dateAr(d)} ${t}`; };
const R_ST = { new: 'جديد', in_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', done: 'منفّذ', closed: 'مغلق' };

export const threadBox = (kind, refId, title = 'المتابعة والتعليقات') => `<div class="thread" data-th="${kind}:${refId}"><h3 class="sub-h thh">${esc(title)} <span class="muted thn"></span></h3><div class="thl"><p class="muted small">جارٍ التحميل…</p></div><form class="thf"><label class="btn sm ghost thatt" title="إرفاق ملف (PDF، صورة، Word…)">📎<input type="file" multiple accept="${ACCEPT}" hidden></label><textarea name="body" rows="1" placeholder="اكتب متابعة… (Enter للإرسال، Shift+Enter لسطر جديد)" maxlength="2000"></textarea><button class="btn primary sm">إضافة</button></form><div class="mnbox" hidden></div><div class="thpend"></div><small class="muted thhint">اكتب @ لذكر زميل فيصله إشعار</small></div>`;

export async function mountThread(container, kind, refId, { projectId = null, onPosted = null } = {}) {
  const box = container.matches?.('.thread') ? container : $(`.thread[data-th="${kind}:${refId}"]`, container); if (!box) return;
  await loadProfiles(); const me = session.user.id, admin = isAdmin();
  const list = $('.thl', box), form = $('.thf', box), ta = $('textarea', form), n = $('.thn', box), fin = $('input[type=file]', form), pendBox = $('.thpend', box);
  let pending = [];
  const renderPend = () => { pendBox.innerHTML = pending.length ? pending.map((f, i) => `<span class="achip pend">📎 ${esc(f.name)} <button type="button" data-rm="${i}">✕</button></span>`).join('') : ''; $$('[data-rm]', pendBox).forEach(b => b.onclick = () => { pending.splice(+b.dataset.rm, 1); renderPend(); }); };
  fin.onchange = () => { pending.push(...fin.files); fin.value = ''; renderPend(); if (!ta.value.trim()) ta.placeholder = 'اكتب تعليقاً مع المرفق ثم Enter'; };
  // ---- الإشارة @
  const mnbox = $('.mnbox', box); const chosen = new Map(); let mnItems = [], mnIdx = 0, mnStart = -1;
  const mnClose = () => { mnbox.hidden = true; mnItems = []; mnStart = -1; };
  const mnRender = () => { mnbox.innerHTML = mnItems.map((p, i) => `<button type="button" class="mni ${i === mnIdx ? 'on' : ''}" data-i="${i}"><span class="av">${esc(initials(p.full_name))}</span>${esc(p.full_name)}<small>${esc({ admin: 'مدير النظام', engineer: 'مهندس', clerk: 'إداري', finance: 'مالية', viewer: 'مطّلع' }[p.role] || p.role)}</small></button>`).join(''); mnbox.hidden = !mnItems.length; $$('.mni', mnbox).forEach(b => { b.onmousedown = e => { e.preventDefault(); mnPick(+b.dataset.i); }; }); };
  const mnPick = i => { const p = mnItems[i]; if (!p) return; const v = ta.value, caret = ta.selectionStart; const before = v.slice(0, mnStart), after = v.slice(caret); const ins = '@' + p.full_name.trim() + ' '; ta.value = before + ins + after; const pos = before.length + ins.length; ta.setSelectionRange(pos, pos); chosen.set(p.id, p.full_name.trim()); mnClose(); ta.focus(); };
  const mnCheck = () => { const caret = ta.selectionStart, v = ta.value.slice(0, caret); const at = v.lastIndexOf('@'); if (at < 0) return mnClose(); const typed = v.slice(at + 1); if (typed.length > 24 || /\n/.test(typed)) return mnClose(); const t = typed.trim().toLowerCase(); mnItems = mentionable().filter(p => p.id !== me && (!t || p.full_name.toLowerCase().includes(t))).slice(0, 6); mnStart = at; mnIdx = 0; mnRender(); };
  ta.addEventListener('input', mnCheck); ta.addEventListener('click', mnCheck); ta.addEventListener('blur', () => setTimeout(mnClose, 150));
  const render = async () => {
    const rows = await q(sb.from('v_thread').select('*').eq('kind', kind).eq('ref_id', refId).order('at'));
    const atts = await loadAttachments(rows.map(r => 'thread:' + r.uid)).catch(() => []);
    n.textContent = rows.length ? `(${rows.length})` : '';
    list.innerHTML = rows.length ? rows.map(r => { const ra = atts.filter(a => a.ref === 'thread:' + r.uid); return `<div class="tm ${r.by_user === me ? 'mine' : ''}" data-uid="${r.uid}"><span class="av">${esc(initials(pname(r.by_user)))}</span><div class="tb"><div class="th"><b>${esc(pname(r.by_user))}</b><small>${when(r.at)}</small>${r.status_after ? `<span class="badge skel">${R_ST[r.status_after] || esc(r.status_after)}</span>` : ''}${admin || r.by_user === me ? `<button type="button" class="x" data-del="${r.uid}" title="حذف">✕</button>` : ''}</div>${r.body ? `<div class="tx">${hiMentions(esc(r.body))}</div>` : ''}${ra.length ? `<div class="tatt">${ra.map(attachChip).join('')}</div>` : ''}</div></div>`; }).join('') : '<p class="muted small thempty">لا متابعات بعد — أول متابعة تُسجَّل باسمك وتُحسب نشاطاً على المشروع.</p>';
    bindChips(list, atts);
    list.scrollTop = list.scrollHeight;
    $$('[data-del]', list).forEach(b => b.onclick = async () => { const uid = b.getAttribute('data-del'); const [p, id] = uid.split('-'); const tbl = { c: 'comments', r: 'request_replies', n: 'challenge_notes', t: 'report_comments' }[p]; try { await q(sb.from(tbl).delete().eq('id', +id)); const { deleteAttachment } = await import('./attach.js'); for (const a of await loadAttachments(['thread:' + uid]).catch(() => [])) { try { await deleteAttachment(a); } catch (e) { } } render(); } catch (e) { err(e); } });
  };
  const post = async () => {
    let body = ta.value.trim(); if (!body && !pending.length) return; if (!body) body = pending.length === 1 ? 'مرفق: ' + pending[0].name : `${pending.length} مرفقات`;
    const btn = $('button.primary', form); btn.disabled = true;
    try {
      const w = WRITE[kind]; let ins;
      if (w) { const row = { body, by_user: me }; row[w[1]] = refId; ins = await q(sb.from(w[0]).insert(row).select('id').single()); }
      else ins = await q(sb.from('comments').insert({ kind, ref_id: refId, project_id: projectId, body, by_user: me }).select('id').single());
      const uid = (w ? { request: 'r', challenge: 'n', treport: 't' }[kind] : 'c') + '-' + ins.id;
      const files = pending; pending = []; renderPend();
      for (const f of files) { try { toast(`رفع ${f.name}…`); await uploadAttachment(f, 'thread:' + uid, projectId); } catch (e) { err(e); } }
      const mentioned = [...chosen.entries()].filter(([id, name]) => body.includes('@' + name)); chosen.clear();
      if (mentioned.length) { try { await q(sb.from('mentions').insert(mentioned.map(([id]) => ({ uid, kind, ref_id: String(refId), project_id: projectId, user_id: id, by_user: me, excerpt: body.slice(0, 200) })))); } catch (e) { console.error(e); } }
      ta.value = ''; ta.style.height = ''; await render(); onPosted && onPosted(body); toast('سُجّلت المتابعة');
    } catch (e) { err(e); } finally { btn.disabled = false; }
  };
  form.onsubmit = e => { e.preventDefault(); post(); };
  ta.addEventListener('keydown', e => { if (!mnbox.hidden && mnItems.length) { if (e.key === 'ArrowDown') { e.preventDefault(); mnIdx = (mnIdx + 1) % mnItems.length; return mnRender(); } if (e.key === 'ArrowUp') { e.preventDefault(); mnIdx = (mnIdx - 1 + mnItems.length) % mnItems.length; return mnRender(); } if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return mnPick(mnIdx); } if (e.key === 'Escape') { e.preventDefault(); return mnClose(); } } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
  await render();
}
