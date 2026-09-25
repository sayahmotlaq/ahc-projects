// ===== المستندات الرسمية + المخططات + الاعتمادات =====
import { sb, REF, loadRef, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, norm, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';
import { compress } from './treports.js';

const BUCKET = 'project-files';
export const DOC_CAT = { contract: 'العقد', site_handover: 'محضر تسليم الموقع', initial_handover: 'محضر الاستلام الابتدائي', final_handover: 'محضر الاستلام النهائي', bank_guarantee: 'ضمان بنكي', insurance: 'وثيقة تأمين', letter_in: 'خطاب وارد', letter_out: 'خطاب صادر', change_order: 'أمر تغيير', extension: 'تمديد مدة', minutes: 'وثيقة رسمية أخرى', other: 'أخرى' };
const REQUIRED_EXEC = ['contract', 'site_handover', 'bank_guarantee', 'insurance'];
export const DISC = { arch: 'معماري', struct: 'إنشائي', mech: 'ميكانيكي (تكييف)', elec: 'كهربائي', civil: 'مدني', plumb: 'صحي', fire: 'إطفاء وإنذار', medgas: 'غازات طبية', ict: 'اتصالات وشبكات', landscape: 'تنسيق مواقع', other: 'أخرى' };
export const DWG_ST = { design: 'تصميم', for_approval: 'للاعتماد', approved: 'معتمد', approved_notes: 'معتمد بملاحظات', rejected: 'مرفوض', as_built: 'كما نُفذ', superseded: 'نسخة أقدم' };
export const SUB_KIND = { material: 'عينة / مادة', shop_drawing: 'مخطط تنفيذي', method: 'طريقة تنفيذ', subcontractor: 'مقاول باطن', supplier: 'مورد', other: 'أخرى' };
export const DECISION = { approved: 'معتمد (A)', approved_notes: 'معتمد بملاحظات (B)', resubmit: 'أعد التقديم (C)', rejected: 'مرفوض (D)' };
export const SUB_ST = { submitted: 'مقدَّم — بانتظار المهندس', reviewed: 'راجعه المهندس — بانتظار القرار', decided: 'صدر القرار' };
const dwgBadge = s => `<span class="badge ${['approved', 'as_built'].includes(s) ? 'full' : s === 'approved_notes' ? 'ovr' : s === 'rejected' ? 'bad' : 'skel'}">${DWG_ST[s] || s}</span>`;
export const decBadge = d => d ? `<span class="badge ${d === 'approved' ? 'full' : d === 'approved_notes' ? 'ovr' : 'bad'}">${DECISION[d]}</span>` : '';
export const isOverdue = s => s.status !== 'decided' && s.due_on && s.due_on < today();
const kb = n => n ? (n > 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.round(n / 1024) + ' ك.ب') : '';
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role').order('full_name')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';

// ---------- ملفات: رفع (مع ضغط الصور) وفتح بروابط موقّعة
async function uploadOne(file, prefix) {
  let blob = file, name = file.name;
  if (/^image\//.test(file.type) && file.size > 400 * 1024) { try { blob = await compress(file, 2000, 0.85); name = name.replace(/\.[^.]+$/, '') + '.jpg'; } catch (e) { } }
  const path = `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${name.replace(/[^\w.\-؀-ۿ]/g, '_')}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error(error.message?.includes('exceeded') ? 'حجم الملف يتجاوز الحد المسموح (50 م.ب)' : error.message);
  return { path, file_name: name, file_size: blob.size };
}
export async function openFile(row) {
  if (row.link && !row.path) return window.open(row.link, '_blank');
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(row.path, 3600); if (error) return err(error);
  window.open(data.signedUrl, '_blank');
}
const fileCell = r => r.path ? `<button class="btn sm" data-file="${r.id}">📎 ${esc((r.file_name || 'ملف').slice(0, 28))}${r.file_size ? ` <small class="muted">${kb(r.file_size)}</small>` : ''}</button>` : r.link ? `<a class="btn sm" href="${esc(r.link)}" target="_blank" rel="noopener">🔗 رابط</a>` : '<span class="muted">—</span>';
const fileFields = (r, cls = '') => `<div class="fld ${cls}"><span>الملف (PDF / صورة / أوفيس / DWG — حتى 50 م.ب)</span><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip">${r?.path ? `<small class="muted">الملف الحالي: ${esc(r.file_name || '')} — اختيار ملف جديد يستبدله</small>` : ''}</div>${field('أو رابط خارجي (OneDrive / SharePoint)', inp('link', r?.link || '', 'dir="ltr" placeholder="https://…"'), cls)}`;
async function withFile(form, row, prefix) { const f = form.querySelector('[name=file]'); if (f?.files?.[0]) { toast('جارٍ رفع الملف…'); const u = await uploadOne(f.files[0], prefix); if (row._old) { try { await sb.storage.from(BUCKET).remove([row._old]); } catch (e) { } } Object.assign(row, u); } return row; }
function bindFiles(root, rows) { $$('[data-file]', root).forEach(b => b.onclick = () => openFile(rows.find(x => x.id === +b.getAttribute('data-file')))); }

// ================= 1) المستندات الرسمية
export async function projectDocs(t, p) {
  await loadProfiles();
  const rows = await q(sb.from('documents').select('*').eq('project_id', p.id).order('doc_date', { ascending: false }).order('id', { ascending: false }));
  const missing = ['execution', 'handover', 'warranty'].includes(p.stage) ? REQUIRED_EXEC.filter(c => !rows.some(r => r.category === c)) : [];
  const soon = rows.filter(r => r.expiry_date && r.expiry_date <= addDays(30));
  const groups = Object.keys(DOC_CAT).map(c => [c, rows.filter(r => r.category === c)]).filter(([, a]) => a.length);
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>المستندات الرسمية <span class="muted">(${rows.length})</span></h2><span style="flex:1"></span>${canEdit() ? '<button class="btn primary" id="dNew">＋ مستند</button>' : ''}</div>
    ${missing.length ? `<div class="alert bad">⚠ مستندات أساسية ناقصة لمشروع تحت التنفيذ: ${missing.map(c => DOC_CAT[c]).join('، ')}</div>` : ''}
    ${soon.length ? `<div class="alert warn">⏰ تنتهي خلال 30 يوماً أو منتهية: ${soon.map(r => `<b>${esc(DOC_CAT[r.category])}</b> (${dateAr(r.expiry_date)})`).join('، ')}</div>` : ''}
    ${rows.length ? groups.map(([c, a]) => `<h3 class="sub-h">${DOC_CAT[c]} <small class="muted">(${a.length})</small></h3><table class="lst"><thead><tr><th>العنوان</th><th>الرقم</th><th>التاريخ</th><th>الجهة</th><th>${c === 'bank_guarantee' || c === 'insurance' ? 'الانتهاء' : c === 'change_order' || c === 'contract' ? 'المبلغ' : c === 'extension' ? 'الأيام' : c.startsWith('letter') ? 'الرد' : 'ملاحظة'}</th><th>الملف</th><th></th></tr></thead><tbody>${a.map(r => `<tr><td><b>${esc(r.title)}</b></td><td class="ltr">${esc(r.doc_no || '')}</td><td>${dateAr(r.doc_date)}</td><td>${esc(r.party || '')}</td><td class="${r.expiry_date && r.expiry_date < today() ? 'bad' : ''}">${c === 'bank_guarantee' || c === 'insurance' ? dateAr(r.expiry_date) : c === 'change_order' || c === 'contract' ? money(r.amount) : c === 'extension' ? (r.days || 0) + ' يوم' : c.startsWith('letter') ? (r.replied_on ? 'رُدّ ' + dateAr(r.replied_on) : r.reply_due ? `<span class="${r.reply_due < today() ? 'bad' : ''}">مطلوب قبل ${dateAr(r.reply_due)}</span>` : '—') : esc((r.notes || '').slice(0, 40))}</td><td>${fileCell(r)}</td><td>${canEdit() ? `<button class="btn sm" data-d="${r.id}">تعديل</button>` : ''}</td></tr>`).join('')}</tbody></table>`).join('') : '<p class="muted">لا توجد مستندات مسجلة بعد.</p>'}</div>`;
  bindFiles(t, rows);
  if (canEdit()) { $('#dNew').onclick = () => docForm(null, p, () => projectDocs(t, p)); $$('[data-d]', t).forEach(b => b.onclick = () => docForm(rows.find(x => x.id === +b.getAttribute('data-d')), p, () => projectDocs(t, p))); }
}
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
async function docForm(d, p, done) {
  const v = d || { category: 'contract', doc_date: today() };
  await modal(`<form id="f" class="pgrid">
    ${field('نوع المستند *', sel('category', Object.entries(DOC_CAT), v.category, 'id="cat"'))}
    ${field('العنوان *', inp('title', v.title || '', 'required'), 'wide')}
    ${field('رقم المستند / المرجع', inp('doc_no', v.doc_no || '', 'dir="ltr"'))}
    ${field('التاريخ', inp('doc_date', v.doc_date || '', 'type="date"'))}
    ${field('الجهة (من / إلى)', inp('party', v.party || ''))}
    <div class="fx" data-for="bank_guarantee insurance">${field('تاريخ الانتهاء', inp('expiry_date', v.expiry_date || '', 'type="date"'))}</div>
    <div class="fx" data-for="contract bank_guarantee change_order">${field('المبلغ (ر.س)', inp('amount', v.amount ?? '', 'type="number" step="0.01"'))}</div>
    <div class="fx" data-for="extension">${field('عدد الأيام', inp('days', v.days ?? '', 'type="number"'))}</div>
    <div class="fx" data-for="letter_in letter_out">${field('الرد مطلوب قبل', inp('reply_due', v.reply_due || '', 'type="date"'))}</div>
    <div class="fx" data-for="letter_in letter_out">${field('تاريخ الرد', inp('replied_on', v.replied_on || '', 'type="date"'))}</div>
    ${field('ملاحظات', `<textarea name="notes" rows="2">${esc(v.notes || '')}</textarea>`, 'wide')}
    ${fileFields(d, 'wide')}
    <div class="btnrow end wide">${d ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: d ? 'تعديل مستند' : 'مستند جديد', wide: true, onOpen: (w, close) => {
      const tog = () => { const c = $('#cat', w).value; $$('.fx', w).forEach(e => e.style.display = e.getAttribute('data-for').split(' ').includes(c) ? '' : 'none'); }; $('#cat', w).onchange = tog; tog();
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { const row = { project_id: p.id, category: f.category, title: f.title.trim(), doc_no: f.doc_no.trim(), doc_date: f.doc_date || null, party: f.party.trim(), expiry_date: f.expiry_date || null, amount: f.amount !== '' ? Number(f.amount) : null, days: f.days !== '' ? Number(f.days) : null, reply_due: f.reply_due || null, replied_on: f.replied_on || null, notes: f.notes.trim(), link: f.link.trim() || null, _old: d?.path };
          await withFile(e.target, row, `${p.id}/docs`); delete row._old;
          if (d) await q(sb.from('documents').update(row).eq('id', d.id)); else await q(sb.from('documents').insert({ ...row, created_by: session.user.id }));
          toast('تم الحفظ'); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
      const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف المستند وملفه؟', 'حذف', true)) return; if (d.path) { try { await sb.storage.from(BUCKET).remove([d.path]); } catch (e) { } } await q(sb.from('documents').delete().eq('id', d.id)); close(); done(); };
    } });
}

// ================= 2) المخططات
export async function projectDrawings(t, p) {
  await loadProfiles();
  const dwgs = await q(sb.from('drawings').select('*').eq('project_id', p.id).order('discipline').order('dwg_no'));
  const revs = dwgs.length ? await q(sb.from('drawing_revisions').select('*').in('drawing_id', dwgs.map(d => d.id)).order('id', { ascending: false })) : [];
  const revsOf = id => revs.filter(r => r.drawing_id === id);
  const groups = Object.keys(DISC).map(k => [k, dwgs.filter(d => d.discipline === k)]).filter(([, a]) => a.length);
  const cnt = s => revs.filter(r => r.status === s && dwgs.some(d => d.id === r.drawing_id && revsOf(d.id)[0]?.id === r.id)).length;
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>المخططات <span class="muted">(${dwgs.length} مخطط · ${cnt('approved') + cnt('as_built')} معتمد · ${cnt('for_approval')} للاعتماد)</span></h2><span style="flex:1"></span>${canEdit() ? '<button class="btn primary" id="gNew">＋ مخطط</button>' : ''}</div>
    ${dwgs.length ? groups.map(([k, a]) => `<h3 class="sub-h">${DISC[k]} <small class="muted">(${a.length})</small></h3><table class="lst"><thead><tr><th>رقم المخطط</th><th>العنوان</th><th>آخر مراجعة</th><th>الحالة</th><th>التاريخ</th><th>الملف</th><th></th></tr></thead><tbody>${a.map(d => { const rs = revsOf(d.id); const cur = rs[0]; return `<tr><td class="ltr"><b>${esc(d.dwg_no || '—')}</b></td><td>${esc(d.title)}${rs.length > 1 ? ` <button class="btn sm" data-hist="${d.id}">السجل (${rs.length})</button>` : ''}</td><td class="ltr">${cur ? esc(cur.rev) : '—'}</td><td>${cur ? dwgBadge(cur.status) : '<span class="muted">بلا ملف</span>'}</td><td>${dateAr(cur?.issued_on)}</td><td>${cur ? fileCell(cur) : '—'}</td><td>${canEdit() ? `<button class="btn sm" data-rev="${d.id}">＋ مراجعة</button> <button class="btn sm" data-g="${d.id}">تعديل</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`).join('') : '<p class="muted">لا توجد مخططات مسجلة بعد.</p>'}</div>`;
  bindFiles(t, revs);
  $$('[data-hist]', t).forEach(b => b.onclick = () => { const d = dwgs.find(x => x.id === +b.getAttribute('data-hist')); const rs = revsOf(d.id); modal(`<table class="lst"><thead><tr><th>المراجعة</th><th>الحالة</th><th>التاريخ</th><th>ملاحظة</th><th>الملف</th><th>بواسطة</th></tr></thead><tbody>${rs.map(r => `<tr><td class="ltr"><b>${esc(r.rev)}</b></td><td>${dwgBadge(r.status)}</td><td>${dateAr(r.issued_on)}</td><td>${esc(r.note || '')}</td><td>${fileCell(r)}</td><td>${esc(pname(r.created_by))}</td></tr>`).join('')}</tbody></table>`, { title: `سجل مراجعات ${d.dwg_no} — ${d.title}`, wide: true, onOpen: w => bindFiles(w, rs) }); });
  if (canEdit()) {
    $('#gNew').onclick = () => dwgForm(null, p, () => projectDrawings(t, p));
    $$('[data-g]', t).forEach(b => b.onclick = () => dwgForm(dwgs.find(x => x.id === +b.getAttribute('data-g')), p, () => projectDrawings(t, p)));
    $$('[data-rev]', t).forEach(b => b.onclick = () => { const d = dwgs.find(x => x.id === +b.getAttribute('data-rev')); revForm(d, revsOf(d.id), p, () => projectDrawings(t, p)); });
  }
}
async function dwgForm(d, p, done) {
  const v = d || { discipline: 'arch' };
  await modal(`<form id="f" class="pgrid">${field('التخصص *', sel('discipline', Object.entries(DISC), v.discipline))}${field('رقم المخطط', inp('dwg_no', v.dwg_no || '', 'dir="ltr" placeholder="A-101"'))}${field('العنوان *', inp('title', v.title || '', 'required'), 'wide')}
    ${d ? '' : `<div class="wide"><h3 class="sub-h">المراجعة الأولى</h3></div>${field('رقم المراجعة', inp('rev', 'A', 'dir="ltr"'))}${field('الحالة', sel('status', Object.entries(DWG_ST).filter(([k]) => k !== 'superseded'), 'for_approval'))}${field('تاريخ الإصدار', inp('issued_on', today(), 'type="date"'))}${fileFields(null, 'wide')}`}
    <div class="btnrow end wide">${d ? '<button type="button" class="btn danger" data-del>حذف المخطط وكل مراجعاته</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: d ? 'تعديل بيانات المخطط' : 'مخطط جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { const row = { project_id: p.id, discipline: f.discipline, dwg_no: f.dwg_no.trim(), title: f.title.trim() };
          if (d) await q(sb.from('drawings').update(row).eq('id', d.id));
          else { const ins = await q(sb.from('drawings').insert({ ...row, created_by: session.user.id }).select('id').single()); const rv = { drawing_id: ins.id, rev: f.rev.trim() || 'A', status: f.status, issued_on: f.issued_on || null, link: f.link.trim() || null, created_by: session.user.id }; await withFile(e.target, rv, `${p.id}/dwg/${ins.id}`); await q(sb.from('drawing_revisions').insert(rv)); }
          toast('تم الحفظ'); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
      const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف المخطط وجميع مراجعاته وملفاته؟', 'حذف', true)) return; const rs = await q(sb.from('drawing_revisions').select('path').eq('drawing_id', d.id)); const paths = rs.map(r => r.path).filter(Boolean); if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch (e) { } } await q(sb.from('drawings').delete().eq('id', d.id)); close(); done(); };
    } });
}
async function revForm(d, rs, p, done) {
  const last = rs[0]; const nextRev = last ? (/^[A-Z]$/i.test(last.rev) ? String.fromCharCode(last.rev.toUpperCase().charCodeAt(0) + 1) : /^\d+$/.test(last.rev) ? String(+last.rev + 1) : last.rev + '-1') : 'A';
  await modal(`<form id="f" class="pgrid"><p class="wide muted">${esc(d.dwg_no)} — ${esc(d.title)}${last ? ` · آخر مراجعة: <b class="ltr">${esc(last.rev)}</b> ${DWG_ST[last.status]}` : ''}</p>
    ${field('رقم المراجعة *', inp('rev', nextRev, 'dir="ltr" required'))}${field('الحالة', sel('status', Object.entries(DWG_ST).filter(([k]) => k !== 'superseded'), 'for_approval'))}${field('تاريخ الإصدار', inp('issued_on', today(), 'type="date"'))}${field('ملاحظة', inp('note', ''), 'wide')}${fileFields(null, 'wide')}
    ${last && !['superseded', 'as_built'].includes(last.status) ? '<label class="chk wide"><input type="checkbox" name="sup" checked> اعتبار المراجعة السابقة نسخة أقدم (ملغاة)</label>' : ''}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إضافة المراجعة</button></div></form>`, { title: 'مراجعة جديدة للمخطط', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { const rv = { drawing_id: d.id, rev: f.rev.trim(), status: f.status, issued_on: f.issued_on || null, note: f.note.trim(), link: f.link.trim() || null, created_by: session.user.id }; await withFile(e.target, rv, `${p.id}/dwg/${d.id}`); await q(sb.from('drawing_revisions').insert(rv)); if (f.sup && last) await q(sb.from('drawing_revisions').update({ status: 'superseded' }).eq('id', last.id)); toast('أُضيفت المراجعة'); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
    } });
}

// ================= 3) الاعتمادات (Submittals)
let SLA = 7;
async function loadSla() { try { const s = await q(sb.from('settings').select('value').eq('key', 'submittal_sla_days').maybeSingle()); if (s?.value) SLA = Number(s.value) || 7; } catch (e) { } }
function subRows(rows, opts = {}) {
  return `<table class="lst"><thead><tr>${opts.project ? '<th>المشروع</th>' : ''}<th class="c">رقم</th><th>النوع</th><th>العنوان</th><th>مقدّمه</th><th>تاريخ التقديم</th><th>موعد الرد</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(s => `<tr class="${s.status === 'decided' ? 'off' : ''}">${opts.project ? `<td><a href="#/project/${s.project_id}/submittals">${esc(s.projects?.name || '')}</a></td>` : ''}<td class="c ltr"><b>SUB-${String(s.no).padStart(3, '0')}${s.rev ? '-R' + s.rev : ''}</b></td><td>${SUB_KIND[s.kind]}</td><td><b>${esc(s.title)}</b>${s.spec_ref ? `<br><small class="muted"><span class="cd">${esc(s.spec_ref)}</span> ${esc(s.spec_title || '')}</small>` : ''}</td><td>${esc(s.submitted_by || '')}</td><td>${dateAr(s.submitted_on)}</td><td class="${isOverdue(s) ? 'bad' : ''}">${dateAr(s.due_on)}${isOverdue(s) ? ' ⚠' : ''}</td><td>${s.status === 'decided' ? decBadge(s.decision) : `<span class="badge ${s.status === 'reviewed' ? 'ovr' : 'bad'}">${SUB_ST[s.status]}</span>`}</td><td><button class="btn sm" data-s="${s.id}">فتح</button></td></tr>`).join('')}</tbody></table>`;
}
export async function projectSubmittals(t, p) {
  await loadProfiles(); await loadSla();
  const rows = await q(sb.from('submittals').select('*').eq('project_id', p.id).order('no', { ascending: false }).order('rev', { ascending: false }));
  const open = rows.filter(r => r.status !== 'decided'), late = open.filter(isOverdue);
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>الاعتمادات <span class="muted">(${open.length} قيد الإجراء${late.length ? ` · <b class="bad">${late.length} متأخرة</b>` : ''} من ${rows.length})</span></h2><span style="flex:1"></span>${canEdit() ? '<button class="btn primary" id="sNew">＋ طلب اعتماد</button>' : ''}</div>${rows.length ? subRows(rows) : '<p class="muted">لا توجد طلبات اعتماد بعد.</p>'}</div>`;
  if (canEdit()) $('#sNew').onclick = () => subForm(null, p, rows, () => projectSubmittals(t, p));
  $$('[data-s]', t).forEach(b => b.onclick = () => subDetail(rows.find(x => x.id === +b.getAttribute('data-s')), p, rows, () => projectSubmittals(t, p)));
}
async function subForm(s, p, existing, done, resubmitOf = null) {
  const v = s || resubmitOf || { kind: 'material', submitted_on: today() };
  const nextNo = resubmitOf ? resubmitOf.no : (existing.length ? Math.max(...existing.map(x => x.no)) + 1 : 1);
  await modal(`<form id="f" class="pgrid">
    <p class="wide muted">رقم الطلب: <b class="ltr">SUB-${String(nextNo).padStart(3, '0')}${resubmitOf ? '-R' + (resubmitOf.rev + 1) : s?.rev ? '-R' + s.rev : ''}</b> · موعد الرد التلقائي: ${SLA} أيام من التقديم</p>
    ${field('النوع *', sel('kind', Object.entries(SUB_KIND), v.kind))}
    ${field('تاريخ التقديم', inp('submitted_on', resubmitOf ? today() : (v.submitted_on || today()), 'type="date"'))}
    ${field('العنوان *', inp('title', v.title || '', 'required placeholder="مثال: عينة بلاط بورسلين 60×60"'), 'wide')}
    ${field('الوصف / المواصفة المقدمة', `<textarea name="description" rows="3">${esc(v.description || '')}</textarea>`, 'wide')}
    <div class="fld wide"><span>البند المرجعي من المرجع الفني (اختياري — اكتب للبحث)</span><input id="specq" value="${esc(v.spec_ref ? v.spec_ref + ' — ' + (v.spec_title || '') : '')}" placeholder="مثال: بلاط بورسلين أو 09 30 13" autocomplete="off"><input type="hidden" name="spec_ref" value="${esc(v.spec_ref || '')}"><input type="hidden" name="spec_title" value="${esc(v.spec_title || '')}"><div class="specdrop" id="specdrop"></div></div>
    ${field('مقدّم الطلب (المقاول / المورد)', inp('submitted_by', v.submitted_by || p.contractor || ''))}
    ${field('موعد الرد المطلوب', inp('due_on', v.due_on || '', 'type="date" placeholder="تلقائي"'))}
    ${fileFields(null, 'wide')}
    <div class="btnrow end wide">${s && isAdmin() ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${resubmitOf ? 'تسجيل إعادة التقديم' : 'حفظ'}</button></div></form>`, { title: resubmitOf ? 'إعادة تقديم' : s ? 'تعديل طلب الاعتماد' : 'طلب اعتماد جديد', wide: true, onOpen: async (w, close) => {
      const qi = $('#specq', w), dd = $('#specdrop', w);
      if (!REF.loaded) { try { await loadRef(false); } catch (e) { } }
      qi.oninput = () => { const s0 = norm(qi.value); if (!REF.loaded || s0.length < 2) { dd.innerHTML = ''; return; } const hits = REF.items.filter(it => norm(it.code).includes(s0) || norm(it.ar).includes(s0) || (it.keywords || []).some(k => norm(k).includes(s0))).slice(0, 8); dd.innerHTML = hits.map(it => `<div class="opt" data-c="${esc(it.code)}"><span class="cd">${esc(it.code)}</span> ${esc(it.ar)}</div>`).join(''); $$('.opt', dd).forEach(o => o.onclick = () => { const it = REF.byItem[o.getAttribute('data-c')]; w.querySelector('[name=spec_ref]').value = it.code; w.querySelector('[name=spec_title]').value = it.ar; qi.value = it.code + ' — ' + it.ar; dd.innerHTML = ''; }); };
      qi.onchange = () => { if (!qi.value.trim()) { w.querySelector('[name=spec_ref]').value = ''; w.querySelector('[name=spec_title]').value = ''; } };
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { const due = f.due_on || (() => { const d = new Date(f.submitted_on || today()); d.setDate(d.getDate() + SLA); return d.toISOString().slice(0, 10); })();
          const row = { project_id: p.id, kind: f.kind, title: f.title.trim(), description: f.description.trim(), spec_ref: f.spec_ref, spec_title: f.spec_title, submitted_by: f.submitted_by.trim(), submitted_on: f.submitted_on || today(), due_on: due };
          let sid = s?.id;
          if (s) await q(sb.from('submittals').update(row).eq('id', s.id));
          else { const ins = await q(sb.from('submittals').insert({ ...row, no: nextNo, rev: resubmitOf ? resubmitOf.rev + 1 : 0, parent_id: resubmitOf?.id || null, status: 'submitted', created_by: session.user.id }).select('id').single()); sid = ins.id; }
          const fi = e.target.querySelector('[name=file]'); if (fi?.files?.[0] || f.link.trim()) { const fr = { submittal_id: sid, side: 'submitted', link: f.link.trim() || null, created_by: session.user.id }; await withFile(e.target, fr, `${p.id}/sub/${sid}`); await q(sb.from('submittal_files').insert(fr)); }
          toast('تم الحفظ'); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
      const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف طلب الاعتماد وملفاته؟', 'حذف', true)) return; const fs = await q(sb.from('submittal_files').select('path').eq('submittal_id', s.id)); const paths = fs.map(r => r.path).filter(Boolean); if (paths.length) { try { await sb.storage.from(BUCKET).remove(paths); } catch (e) { } } await q(sb.from('submittals').delete().eq('id', s.id)); close(); done(); };
    } });
}
async function subDetail(s, p, existing, done) {
  const files = await q(sb.from('submittal_files').select('*').eq('submittal_id', s.id).order('id'));
  const chain = existing.filter(x => x.no === s.no && x.id !== s.id).sort((a, b) => a.rev - b.rev);
  const admin = isAdmin(), edit = canEdit(); const V = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const spec = s.spec_ref && REF.loaded ? REF.byItem[s.spec_ref] : null;
  const filesHtml = side => { const a = files.filter(f => f.side === side); return a.length ? a.map(f => fileCell(f)).join(' ') : '<span class="muted">—</span>'; };
  await modal(`<div class="kvs">${V('المشروع', esc(p.name))}${V('النوع', SUB_KIND[s.kind])}${V('مقدّمه', esc(s.submitted_by || '—'))}${V('تاريخ التقديم', dateAr(s.submitted_on))}${V('موعد الرد', `<span class="${isOverdue(s) ? 'bad' : ''}">${dateAr(s.due_on)}${isOverdue(s) ? ' — متأخر' : ''}</span>`)}${V('الحالة', s.status === 'decided' ? decBadge(s.decision) : SUB_ST[s.status])}</div>
    ${s.description ? `<p class="pre">${esc(s.description)}</p>` : ''}
    ${s.spec_ref ? `<div class="specbox"><b>البند المرجعي:</b> <span class="cd">${esc(s.spec_ref)}</span> ${esc(s.spec_title || '')} <a href="#/ref/${s.spec_ref.replace(/\s+/g, '-')}" target="_blank" class="small">فتح في المرجع الفني ›</a>${spec ? `<div class="muted small" style="margin-top:4px">${esc((spec.scope || '').slice(0, 220))}</div>${(safeArr(spec.specs)).slice(0, 5).length ? `<ul class="small" style="margin:4px 16px 0">${safeArr(spec.specs).slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}` : ''}</div>` : ''}
    <h3 class="sub-h">مرفقات التقديم</h3><div>${filesHtml('submitted')}</div>
    ${s.engineer_at || s.engineer_note ? `<h3 class="sub-h">مراجعة المهندس</h3><div class="pre">${s.engineer_recommend ? `<b>التوصية: ${DECISION[{ approve: 'approved', approve_notes: 'approved_notes', resubmit: 'resubmit', reject: 'rejected' }[s.engineer_recommend]] || ''}</b><br>` : ''}${esc(s.engineer_note || '')}<div class="muted small">${esc(pname(s.engineer_by))} · ${dateAr(s.engineer_at)}</div></div>` : ''}
    ${s.decided_at ? `<h3 class="sub-h">قرار الإدارة</h3><div class="pre">${decBadge(s.decision)}<br>${esc(s.decision_note || '')}<div class="muted small">${esc(pname(s.decided_by))} · ${dateAr(s.decided_at)}</div></div>` : ''}
    ${files.some(f => f.side === 'response') ? `<h3 class="sub-h">مرفقات الرد</h3><div>${filesHtml('response')}</div>` : ''}
    ${chain.length ? `<h3 class="sub-h">تقديمات سابقة / لاحقة لنفس الطلب</h3><ul class="rlist">${chain.map(c => `<li><span class="ltr">R${c.rev}</span> — ${dateAr(c.submitted_on)} — ${c.status === 'decided' ? DECISION[c.decision] : SUB_ST[c.status]}</li>`).join('')}</ul>` : ''}
    <div class="btnrow end wrap" style="margin-top:12px">${edit && s.status !== 'decided' ? '<button class="btn" data-edit>تعديل</button>' : ''}${edit && s.status === 'submitted' ? '<button class="btn primary" data-review>مراجعة المهندس</button>' : ''}${admin && s.status !== 'decided' ? '<button class="btn primary" data-decide>قرار الإدارة</button>' : ''}${edit && s.status === 'decided' && ['resubmit', 'rejected', 'approved_notes'].includes(s.decision) && !existing.some(x => x.parent_id === s.id) ? '<button class="btn" data-resub>إعادة التقديم (نسخة جديدة)</button>' : ''}<span style="flex:1"></span><button class="btn" data-x>إغلاق</button></div>`, { title: `SUB-${String(s.no).padStart(3, '0')}${s.rev ? '-R' + s.rev : ''} — ${s.title}`, wide: true, onOpen: (w, close) => {
      bindFiles(w, files);
      const ed = $('[data-edit]', w); if (ed) ed.onclick = () => { close(); subForm(s, p, existing, done); };
      const rv = $('[data-review]', w); if (rv) rv.onclick = () => { close(); reviewForm(s, p, done); };
      const dc = $('[data-decide]', w); if (dc) dc.onclick = () => { close(); decideForm(s, p, done); };
      const rs = $('[data-resub]', w); if (rs) rs.onclick = () => { close(); subForm(null, p, existing, done, s); };
    } });
}
const safeArr = v => Array.isArray(v) ? v : (typeof v === 'string' && v.startsWith('[') ? (() => { try { return JSON.parse(v.replace(/'/g, '"')); } catch (e) { return []; } })() : []);
async function reviewForm(s, p, done) {
  await modal(`<form id="f" class="pgrid">${field('توصية المهندس *', sel('engineer_recommend', [['approve', 'يوصى بالاعتماد'], ['approve_notes', 'يوصى بالاعتماد بملاحظات'], ['resubmit', 'يُطلب إعادة التقديم'], ['reject', 'يوصى بالرفض']], s.engineer_recommend || 'approve'), 'wide')}${field('ملاحظات المراجعة الفنية', `<textarea name="engineer_note" rows="4">${esc(s.engineer_note || '')}</textarea>`, 'wide')}${fileFields(null, 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ المراجعة ورفعها للقرار</button></div></form>`, { title: 'مراجعة المهندس', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { await q(sb.from('submittals').update({ engineer_recommend: f.engineer_recommend, engineer_note: f.engineer_note.trim(), engineer_by: session.user.id, engineer_at: new Date().toISOString(), status: 'reviewed' }).eq('id', s.id));
          const fi = e.target.querySelector('[name=file]'); if (fi?.files?.[0] || f.link.trim()) { const fr = { submittal_id: s.id, side: 'response', link: f.link.trim() || null, created_by: session.user.id }; await withFile(e.target, fr, `${p.id}/sub/${s.id}`); await q(sb.from('submittal_files').insert(fr)); }
          toast('رُفعت المراجعة للإدارة'); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
    } });
}
async function decideForm(s, p, done) {
  const map = { approve: 'approved', approve_notes: 'approved_notes', resubmit: 'resubmit', reject: 'rejected' };
  await modal(`<form id="f" class="pgrid">${s.engineer_note ? `<p class="wide pre"><b>توصية المهندس:</b> ${DECISION[map[s.engineer_recommend]] || '—'}<br>${esc(s.engineer_note)}</p>` : '<p class="wide muted">لم يراجعه المهندس بعد — يمكنك إصدار القرار مباشرة.</p>'}${field('القرار *', sel('decision', Object.entries(DECISION), s.decision || map[s.engineer_recommend] || 'approved'), 'wide')}${field('ملاحظات القرار', `<textarea name="decision_note" rows="3">${esc(s.decision_note || '')}</textarea>`, 'wide')}${fileFields(null, 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إصدار القرار</button></div></form>`, { title: 'قرار الإدارة', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { await q(sb.from('submittals').update({ decision: f.decision, decision_note: f.decision_note.trim(), decided_by: session.user.id, decided_at: new Date().toISOString(), status: 'decided' }).eq('id', s.id));
          const fi = e.target.querySelector('[name=file]'); if (fi?.files?.[0] || f.link.trim()) { const fr = { submittal_id: s.id, side: 'response', link: f.link.trim() || null, created_by: session.user.id }; await withFile(e.target, fr, `${p.id}/sub/${s.id}`); await q(sb.from('submittal_files').insert(fr)); }
          toast('صدر القرار: ' + DECISION[f.decision]); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
    } });
}
// الصفحة العامة للاعتمادات
export async function mountSubmittals(root, params) {
  await loadProfiles(); await loadSla();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الاعتمادات</h1></div><div class="filters"><input id="fq" placeholder="بحث…"><select id="fSt"><option value="">قيد الإجراء</option><option value="all">الكل</option><option value="submitted">بانتظار المهندس</option><option value="reviewed">بانتظار القرار</option><option value="late">متأخرة</option><option value="decided">صدر القرار</option></select><select id="fK"><option value="">كل الأنواع</option>${Object.entries(SUB_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div id="kp"></div><div id="sl"><p class="muted">…</p></div>`;
  const all = await q(sb.from('submittals').select('*, projects(name,contractor)').order('id', { ascending: false }));
  const open = all.filter(s => s.status !== 'decided'), late = open.filter(isOverdue);
  const avg = (() => { const d = all.filter(s => s.decided_at); return d.length ? Math.round(d.reduce((a, s) => a + (new Date(s.decided_at) - new Date(s.submitted_on)) / 864e5, 0) / d.length) : null; })();
  $('#kp').innerHTML = `<div class="kpis"><a class="kpi ${open.filter(s => s.status === 'submitted').length ? 'bad' : ''}" href="#/submittals?st=submitted"><b>${open.filter(s => s.status === 'submitted').length}</b><span>بانتظار مراجعة المهندس</span></a><a class="kpi ${open.filter(s => s.status === 'reviewed').length ? 'bad' : ''}" href="#/submittals?st=reviewed"><b>${open.filter(s => s.status === 'reviewed').length}</b><span>بانتظار قرار الإدارة</span></a><a class="kpi ${late.length ? 'bad' : ''}" href="#/submittals?st=late"><b>${late.length}</b><span>تجاوزت موعد الرد (${SLA} أيام)</span></a><div class="kpi"><b>${avg ?? '—'}</b><span>متوسط أيام البت في الطلب</span></div></div>`;
  if (params.get('st')) $('#fSt').value = params.get('st');
  const render = () => { const qs = $('#fq').value.toLowerCase(), st = $('#fSt').value, k = $('#fK').value;
    const rows = all.filter(s => (st === 'all' || (st === 'late' ? isOverdue(s) : st ? s.status === st : s.status !== 'decided')) && (!k || s.kind === k) && (!qs || (s.title + ' ' + (s.projects?.name || '') + ' ' + (s.submitted_by || '')).toLowerCase().includes(qs)));
    $('#sl').innerHTML = rows.length ? `<div class="pcard" style="padding:0;overflow:auto">${subRows(rows, { project: true })}</div>` : '<div class="empty-boq">لا توجد طلبات مطابقة</div>';
    $$('[data-s]', root).forEach(b => b.onclick = async () => { const s = all.find(x => x.id === +b.getAttribute('data-s')); const proj = await q(sb.from('projects').select('*').eq('id', s.project_id).single()); subDetail(s, proj, all.filter(x => x.project_id === s.project_id), () => mountSubmittals(root, params)); }); };
  ['fq', 'fSt', 'fK'].forEach(id => $('#' + id).oninput = render); render();
}

// ================= الصفحات العامة: سجل المستندات وسجل المخططات
export async function mountDocsAll(root, params) {
  await loadProfiles();
  const [rows, projects] = await Promise.all([q(sb.from('documents').select('*, projects(name,stage)').order('doc_date', { ascending: false }).order('id', { ascending: false })), q(sb.from('projects').select('id,name,stage').eq('archived', false).order('name'))]);
  const soonD = addDays(30);
  const missing = projects.filter(p => ['execution', 'handover', 'warranty'].includes(p.stage)).map(p => ({ p, m: REQUIRED_EXEC.filter(c => !rows.some(r => r.project_id === p.id && r.category === c)) })).filter(x => x.m.length);
  const expiring = rows.filter(r => r.expiry_date && r.expiry_date <= soonD);
  const openLetters = rows.filter(r => r.category.startsWith('letter') && r.reply_due && !r.replied_on);
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">سجل المستندات الرسمية</h1></div>
    <div class="kpis"><a class="kpi ${expiring.length ? 'bad' : ''}" href="#/documents?f=expiring"><b>${expiring.length}</b><span>ضمانات / تأمينات تنتهي خلال 30 يوماً</span></a><a class="kpi ${missing.length ? 'bad' : ''}" href="#/documents?f=missing"><b>${missing.length}</b><span>مشاريع تحت التنفيذ ناقصة مستندات أساسية</span></a><a class="kpi ${openLetters.filter(r => r.reply_due < today()).length ? 'bad' : ''}" href="#/documents?f=letters"><b>${openLetters.length}</b><span>خطابات بانتظار رد${openLetters.filter(r => r.reply_due < today()).length ? ' · ' + openLetters.filter(r => r.reply_due < today()).length + ' متأخرة' : ''}</span></a><div class="kpi"><b>${rows.length}</b><span>إجمالي المستندات</span></div></div>
    <div class="filters"><input id="fq" placeholder="بحث…"><select id="fF"><option value="">كل المستندات</option><option value="expiring">تنتهي خلال 30 يوماً</option><option value="missing">نواقص المشاريع</option><option value="letters">خطابات بانتظار رد</option></select><select id="fC"><option value="">كل الأنواع</option>${Object.entries(DOC_CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fP"><option value="">كل المشاريع</option>${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div id="dl"></div>`;
  if (params.get('f')) $('#fF').value = params.get('f');
  const render = () => { const qs = $('#fq').value.toLowerCase(), f = $('#fF').value, c = $('#fC').value, pj = $('#fP').value;
    if (f === 'missing') { $('#dl').innerHTML = missing.length ? `<div class="pcard"><table class="lst"><thead><tr><th>المشروع</th><th>المرحلة</th><th>المستندات الناقصة</th></tr></thead><tbody>${missing.filter(x => !pj || x.p.id === pj).map(x => `<tr data-open="${x.p.id}"><td><b>${esc(x.p.name)}</b></td><td>${esc(x.p.stage)}</td><td class="bad">${x.m.map(c => DOC_CAT[c]).join('، ')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-boq">جميع مشاريع التنفيذ مكتملة المستندات الأساسية</div>'; $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open') + '/docs'); return; }
    const list = rows.filter(r => (f !== 'expiring' || expiring.includes(r)) && (f !== 'letters' || openLetters.includes(r)) && (!c || r.category === c) && (!pj || r.project_id === pj) && (!qs || (r.title + ' ' + (r.doc_no || '') + ' ' + (r.party || '') + ' ' + (r.projects?.name || '')).toLowerCase().includes(qs)));
    $('#dl').innerHTML = list.length ? `<div class="pcard" style="padding:0;overflow:auto"><table class="lst"><thead><tr><th>المشروع</th><th>النوع</th><th>العنوان</th><th>الرقم</th><th>التاريخ</th><th>الجهة</th><th>الانتهاء / الرد</th><th>الملف</th></tr></thead><tbody>${list.map(r => `<tr><td><a href="#/project/${r.project_id}/docs">${esc(r.projects?.name || '')}</a></td><td>${DOC_CAT[r.category]}</td><td><b>${esc(r.title)}</b></td><td class="ltr">${esc(r.doc_no || '')}</td><td>${dateAr(r.doc_date)}</td><td>${esc(r.party || '')}</td><td class="${(r.expiry_date && r.expiry_date < today()) || (r.reply_due && !r.replied_on && r.reply_due < today()) ? 'bad' : ''}">${r.expiry_date ? dateAr(r.expiry_date) : r.reply_due ? (r.replied_on ? 'رُدّ ' + dateAr(r.replied_on) : 'رد قبل ' + dateAr(r.reply_due)) : '—'}</td><td>${fileCell(r)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-boq">لا توجد مستندات مطابقة</div>';
    bindFiles(root, rows); };
  ['fq', 'fF', 'fC', 'fP'].forEach(id => $('#' + id).oninput = render); render();
}
export async function mountDrawingsAll(root, params) {
  await loadProfiles();
  const [dwgs, revs, projects] = await Promise.all([q(sb.from('drawings').select('*, projects(name)').order('project_id').order('discipline').order('dwg_no')), q(sb.from('drawing_revisions').select('*').order('id', { ascending: false })), q(sb.from('projects').select('id,name').eq('archived', false).order('name'))]);
  const cur = d => revs.find(r => r.drawing_id === d.id);
  const st = k => dwgs.filter(d => cur(d)?.status === k).length;
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">سجل المخططات</h1></div>
    <div class="kpis"><div class="kpi"><b>${dwgs.length}</b><span>إجمالي المخططات</span></div><a class="kpi ${st('for_approval') ? 'bad' : ''}" href="#/drawings?st=for_approval"><b>${st('for_approval')}</b><span>بانتظار الاعتماد</span></a><div class="kpi"><b>${st('approved') + st('approved_notes')}</b><span>معتمدة</span></div><div class="kpi"><b>${st('as_built')}</b><span>كما نُفذ</span></div></div>
    <div class="filters"><input id="fq" placeholder="بحث برقم المخطط أو العنوان…"><select id="fSt"><option value="">كل الحالات</option>${Object.entries(DWG_ST).filter(([k]) => k !== 'superseded').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fD"><option value="">كل التخصصات</option>${Object.entries(DISC).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fP"><option value="">كل المشاريع</option>${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div id="gl"></div>`;
  if (params.get('st')) $('#fSt').value = params.get('st');
  const render = () => { const qs = $('#fq').value.toLowerCase(), s = $('#fSt').value, di = $('#fD').value, pj = $('#fP').value;
    const list = dwgs.filter(d => { const c = cur(d); return (!s || c?.status === s) && (!di || d.discipline === di) && (!pj || d.project_id === pj) && (!qs || ((d.dwg_no || '') + ' ' + d.title + ' ' + (d.projects?.name || '')).toLowerCase().includes(qs)); });
    $('#gl').innerHTML = list.length ? `<div class="pcard" style="padding:0;overflow:auto"><table class="lst"><thead><tr><th>المشروع</th><th>التخصص</th><th>رقم المخطط</th><th>العنوان</th><th>المراجعة</th><th>الحالة</th><th>التاريخ</th><th>الملف</th></tr></thead><tbody>${list.map(d => { const c = cur(d); return `<tr><td><a href="#/project/${d.project_id}/drawings">${esc(d.projects?.name || '')}</a></td><td>${DISC[d.discipline]}</td><td class="ltr"><b>${esc(d.dwg_no || '—')}</b></td><td>${esc(d.title)}</td><td class="ltr">${c ? esc(c.rev) : '—'}</td><td>${c ? dwgBadge(c.status) : '—'}</td><td>${dateAr(c?.issued_on)}</td><td>${c ? fileCell(c) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-boq">لا توجد مخططات مطابقة</div>';
    bindFiles(root, revs); };
  ['fq', 'fSt', 'fD', 'fP'].forEach(id => $('#' + id).oninput = render); render();
}
