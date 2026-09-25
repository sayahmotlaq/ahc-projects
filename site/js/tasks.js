// ===== المهام (من الإدارة) والطلبات (من المهندسين) =====
import { sb, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';

export const T_STATUS = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', done: 'منجزة', cancelled: 'ملغاة' };
export const R_STATUS = { new: 'جديد', in_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', done: 'منفذ' };
export const R_KIND = { approval: 'طلب اعتماد', review: 'طلب مراجعة', decision: 'طلب قرار', support: 'طلب دعم', other: 'أخرى' };
const PRIO = { low: 'منخفضة', normal: 'عادية', high: 'مهمة', urgent: 'عاجلة' };
const prioBadge = p => p === 'urgent' ? '<span class="badge bad">عاجلة</span>' : p === 'high' ? '<span class="badge ovr">مهمة</span>' : '';
const tBadge = s => `<span class="badge ${s === 'done' ? 'full' : s === 'in_progress' ? 'info' : s === 'cancelled' ? 'skel' : 'ovr'}">${T_STATUS[s] || s}</span>`;
const rBadge = s => `<span class="badge ${s === 'approved' || s === 'done' ? 'full' : s === 'rejected' ? 'bad' : s === 'in_review' ? 'info' : 'ovr'}">${R_STATUS[s] || s}</span>`;
const isLate = (r, doneStates) => r.due_date && r.due_date < today() && !doneStates.includes(r.status);

let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role').order('full_name')); return profiles; }
const pname = (id, fb) => profiles.find(p => p.id === id)?.full_name || fb || '—';

// ---------- نموذج المهمة (أدمن) / تحديث حالة (مكلّف)
export async function taskForm(t, project, done, preset = null) {
  await loadProfiles(); const v = t || preset || {};
  const admin = isAdmin(); const me = session.user.id;
  const people = [['', '—'], ...profiles.filter(p => ['admin', 'engineer'].includes(p.role)).map(p => [p.id, p.full_name])];
  const html = admin ? `<form id="f" class="pgrid">
      ${field('عنوان المهمة *', inp('title', v.title || '', 'required'), 'wide')}
      ${field('التفاصيل', `<textarea name="details" rows="3">${esc(v.details || '')}</textarea>`, 'wide')}
      ${field('المكلّف (حساب)', sel('assignee_id', people, v.assignee_id || project?.engineer_id || ''))}
      ${field('اسم المكلّف (إن لم يكن له حساب)', inp('assignee_name', v.assignee_name || project?.engineer_name || ''))}
      ${field('الأولوية', sel('priority', Object.entries(PRIO), v.priority || 'normal'))}
      ${field('الموعد', inp('due_date', v.due_date || '', 'type="date"'))}
      ${t ? field('الحالة', sel('status', Object.entries(T_STATUS), t.status)) : ''}
      ${t ? field('ملاحظة الإنجاز', `<textarea name="progress_note" rows="2">${esc(t.progress_note || '')}</textarea>`, 'wide') : ''}
      <div class="btnrow end wide">${t ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`
    : `<div class="pre" style="margin-bottom:10px"><b>${esc(t.title)}</b><br><span class="muted">${esc(t.details || '')}</span></div><form id="f" class="pgrid">
      ${field('الحالة', sel('status', [['open', 'مفتوحة'], ['in_progress', 'قيد التنفيذ'], ['done', 'منجزة']], t.status))}
      ${field('ملاحظة الإنجاز', `<textarea name="progress_note" rows="3">${esc(t.progress_note || '')}</textarea>`, 'wide')}
      <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">تحديث</button></div></form>`;
  await modal(html, { title: t ? (admin ? 'تعديل المهمة' : 'تحديث حالة المهمة') : 'مهمة جديدة', wide: admin, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      try {
        if (admin) { const row = { project_id: project.id, title: f.title.trim(), details: f.details.trim(), assignee_id: f.assignee_id || null, assignee_name: f.assignee_name.trim(), priority: f.priority, due_date: f.due_date || null }; if (preset?.report_id) row.report_id = preset.report_id; if (t) { row.status = f.status; row.progress_note = f.progress_note; await q(sb.from('tasks').update(row).eq('id', t.id)); } else await q(sb.from('tasks').insert({ ...row, created_by: me })); }
        else await q(sb.from('tasks').update({ status: f.status, progress_note: f.progress_note }).eq('id', t.id));
        toast('تم الحفظ'); close(); done();
      } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف المهمة؟', 'حذف', true)) return; await q(sb.from('tasks').delete().eq('id', t.id)); close(); done(); };
  } });
}
function taskRows(rows, opts = {}) {
  const me = session.user.id;
  return `<table class="lst"><thead><tr>${opts.project ? '<th>المشروع</th>' : ''}<th>المهمة</th><th>المكلّف</th><th>الموعد</th><th>الحالة</th><th>ملاحظة الإنجاز</th><th></th></tr></thead><tbody>${rows.map(t => `<tr class="${t.status === 'done' || t.status === 'cancelled' ? 'off' : ''}">${opts.project ? `<td><a href="#/project/${t.project_id}/tasks">${esc(t.projects?.name || '')}</a></td>` : ''}<td><b>${esc(t.title)}</b> ${prioBadge(t.priority)}<br><span class="muted">${esc(t.details || '')}</span></td><td>${esc(pname(t.assignee_id, t.assignee_name))}</td><td class="${isLate(t, ['done', 'cancelled']) ? 'bad' : ''}">${dateAr(t.due_date)}${isLate(t, ['done', 'cancelled']) ? ' · متأخرة' : ''}</td><td>${tBadge(t.status)}${t.done_at ? `<br><span class="muted">${dateAr(t.done_at)}</span>` : ''}</td><td class="muted">${esc(t.progress_note || '')}</td><td>${(isAdmin() || t.assignee_id === me) && t.status !== 'cancelled' ? `<button class="btn sm" data-t="${t.id}">${isAdmin() ? 'تعديل' : 'تحديث'}</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
}

// ---------- نموذج الطلب (مهندس) / الرد (أدمن)
async function requestForm(r, project, done) {
  const admin = isAdmin(); const me = session.user.id; const mine = r && r.created_by === me && r.status === 'new';
  let replies = r ? await q(sb.from('request_replies').select('*').eq('request_id', r.id).order('id')) : [];
  await loadProfiles();
  const canEditBody = !r || mine || admin;
  const html = `<div>
    ${r ? `<div class="pcard" style="padding:12px 14px;margin-bottom:10px"><div class="uh"><span class="badge skel">${R_KIND[r.kind]}</span> ${rBadge(r.status)} ${prioBadge(r.priority)} <span class="muted">· ${esc(pname(r.created_by))} · ${dateAr(r.created_at)}</span></div><b>${esc(r.title)}</b><div class="pre muted">${esc(r.details || '')}</div>${r.response ? `<div class="notice" style="margin-top:8px"><b>رد الإدارة:</b> ${esc(r.response)} <span class="muted">— ${esc(pname(r.responded_by))} ${dateAr(r.responded_at)}</span></div>` : ''}
      ${replies.length ? `<h3 class="sub">المتابعات</h3>${replies.map(x => `<div class="upd"><div class="uh"><b>${esc(pname(x.by_user))}</b> <span class="muted">${dateAr(x.at)}</span>${x.status_after ? ' ' + rBadge(x.status_after) : ''}</div><div class="ub">${esc(x.body)}</div></div>`).join('')}` : ''}</div>` : ''}
    <form id="f" class="pgrid">
      ${canEditBody ? `${field('نوع الطلب', sel('kind', Object.entries(R_KIND), r?.kind || 'approval'))}${field('الأولوية', sel('priority', Object.entries(PRIO), r?.priority || 'normal'))}${field('عنوان الطلب *', inp('title', r?.title || '', 'required'), 'wide')}${field('التفاصيل / المبررات', `<textarea name="details" rows="3">${esc(r?.details || '')}</textarea>`, 'wide')}${field('المطلوب قبل', inp('due_date', r?.due_date || '', 'type="date"'))}` : ''}
      ${admin && r ? `${field('حالة الطلب', sel('status', Object.entries(R_STATUS), r.status))}${field('رد الإدارة', `<textarea name="response" rows="3">${esc(r.response || '')}</textarea>`, 'wide')}` : ''}
      ${r ? field('إضافة متابعة / تعليق', `<textarea name="reply" rows="2" placeholder="اختياري — يُحفظ في سجل الطلب"></textarea>`, 'wide') : ''}
      <div class="btnrow end wide">${r && (admin || mine) ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${r ? 'حفظ' : 'إرسال الطلب'}</button></div></form></div>`;
  await modal(html, { title: r ? 'الطلب #' + r.id : 'طلب جديد إلى الإدارة', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      try {
        let id = r?.id;
        if (!r) { const x = await q(sb.from('requests').insert({ project_id: project.id, kind: f.kind, priority: f.priority, title: f.title.trim(), details: f.details.trim(), due_date: f.due_date || null, created_by: me }).select('id').single()); id = x.id; }
        else { const row = {}; if (canEditBody) Object.assign(row, { kind: f.kind, priority: f.priority, title: f.title.trim(), details: f.details.trim(), due_date: f.due_date || null }); if (admin) Object.assign(row, { status: f.status, response: f.response }); if (Object.keys(row).length) await q(sb.from('requests').update(row).eq('id', r.id)); }
        if (r && f.reply && f.reply.trim()) await q(sb.from('request_replies').insert({ request_id: id, body: f.reply.trim(), status_after: admin ? f.status : null, by_user: me }));
        toast(r ? 'تم الحفظ' : 'أُرسل الطلب'); close(); done();
      } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف الطلب؟', 'حذف', true)) return; await q(sb.from('requests').delete().eq('id', r.id)); close(); done(); };
  } });
}
function requestRows(rows, opts = {}) {
  return `<table class="lst"><thead><tr>${opts.project ? '<th>المشروع</th>' : ''}<th>الطلب</th><th>النوع</th><th>مقدّم الطلب</th><th>التاريخ</th><th>المطلوب قبل</th><th>الحالة</th><th>رد الإدارة</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${['approved', 'rejected', 'done'].includes(r.status) ? 'off' : ''}">${opts.project ? `<td><a href="#/project/${r.project_id}/requests">${esc(r.projects?.name || '')}</a></td>` : ''}<td><b>${esc(r.title)}</b> ${prioBadge(r.priority)}<br><span class="muted">${esc((r.details || '').slice(0, 120))}</span></td><td>${R_KIND[r.kind] || r.kind}</td><td>${esc(pname(r.created_by))}</td><td>${dateAr(r.created_at)}</td><td class="${isLate(r, ['approved', 'rejected', 'done']) ? 'bad' : ''}">${dateAr(r.due_date)}</td><td>${rBadge(r.status)}</td><td class="muted">${esc((r.response || '').slice(0, 120))}</td><td><button class="btn sm" data-r="${r.id}">${isAdmin() ? 'رد / تعديل' : 'فتح'}</button></td></tr>`).join('')}</tbody></table>`;
}

// ---------- تبويبات المشروع
export async function projectTasks(t, p) {
  await loadProfiles();
  const rows = await q(sb.from('tasks').select('*').eq('project_id', p.id).order('status').order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: false }));
  const open = rows.filter(r => !['done', 'cancelled'].includes(r.status));
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>المهام <span class="muted">(${open.length} مفتوحة من ${rows.length})</span></h2><span style="flex:1"></span>${isAdmin() ? '<button class="btn primary" id="tNew">＋ مهمة جديدة</button>' : ''}</div>${rows.length ? taskRows(rows) : '<p class="muted">لا توجد مهام على هذا المشروع.</p>'}</div>`;
  if (isAdmin()) $('#tNew').onclick = () => taskForm(null, p, () => projectTasks(t, p));
  $$('[data-t]', t).forEach(b => b.onclick = () => taskForm(rows.find(x => x.id === +b.getAttribute('data-t')), p, () => projectTasks(t, p)));
}
export async function projectRequests(t, p) {
  await loadProfiles();
  const rows = await q(sb.from('requests').select('*').eq('project_id', p.id).order('id', { ascending: false }));
  const pending = rows.filter(r => ['new', 'in_review'].includes(r.status));
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>الطلبات إلى الإدارة <span class="muted">(${pending.length} بانتظار الرد من ${rows.length})</span></h2><span style="flex:1"></span>${canEdit() ? '<button class="btn primary" id="rNew">＋ طلب جديد</button>' : ''}</div>${rows.length ? requestRows(rows) : '<p class="muted">لا توجد طلبات على هذا المشروع.</p>'}</div>`;
  if (canEdit()) $('#rNew').onclick = () => requestForm(null, p, () => projectRequests(t, p));
  $$('[data-r]', t).forEach(b => b.onclick = () => requestForm(rows.find(x => x.id === +b.getAttribute('data-r')), p, () => projectRequests(t, p)));
}

// ---------- الصفحات العامة
export async function mountTasks(root, params) {
  await loadProfiles();
  const me = session.user.id;
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">المهام</h1></div>
    <div class="filters"><input id="fq" placeholder="بحث…"><select id="fSt"><option value="">المفتوحة وقيد التنفيذ</option><option value="all">الكل</option>${Object.entries(T_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fAs"><option value="">كل المكلفين</option>${!isAdmin() ? '' : ''}${profiles.filter(p => ['admin', 'engineer'].includes(p.role)).map(p => `<option value="${p.id}" ${params.get('me') && p.id === me ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="fLate"> المتأخرة فقط</label></div><div id="tl"><p class="muted">…</p></div>`;
  const all = await q(sb.from('tasks').select('*, projects(name)').order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: false }));
  const render = () => { const qs = $('#fq').value.toLowerCase(), st = $('#fSt').value, as = $('#fAs').value, late = $('#fLate').checked;
    const rows = all.filter(t => (st === 'all' || (st ? t.status === st : ['open', 'in_progress'].includes(t.status))) && (!as || t.assignee_id === as) && (!late || isLate(t, ['done', 'cancelled'])) && (!qs || (t.title + ' ' + (t.details || '') + ' ' + (t.projects?.name || '')).toLowerCase().includes(qs)));
    $('#tl').innerHTML = rows.length ? `<div class="pcard">${taskRows(rows, { project: true })}</div>` : '<div class="empty-boq">لا توجد مهام مطابقة</div>';
    $$('[data-t]', root).forEach(b => b.onclick = () => { const t = all.find(x => x.id === +b.getAttribute('data-t')); taskForm(t, { id: t.project_id }, () => mountTasks(root, params)); }); };
  ['fq', 'fSt', 'fAs', 'fLate'].forEach(id => $('#' + id).oninput = render); render();
}
export async function mountRequests(root, params) {
  await loadProfiles();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الطلبات</h1></div>
    <div class="filters"><input id="fq" placeholder="بحث…"><select id="fSt"><option value="">بانتظار الرد</option><option value="all">الكل</option>${Object.entries(R_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fK"><option value="">كل الأنواع</option>${Object.entries(R_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div id="rl"><p class="muted">…</p></div>`;
  const all = await q(sb.from('requests').select('*, projects(name)').order('id', { ascending: false }));
  const render = () => { const qs = $('#fq').value.toLowerCase(), st = $('#fSt').value, k = $('#fK').value;
    const rows = all.filter(r => (st === 'all' || (st ? r.status === st : ['new', 'in_review'].includes(r.status))) && (!k || r.kind === k) && (!qs || (r.title + ' ' + (r.details || '') + ' ' + (r.projects?.name || '')).toLowerCase().includes(qs)));
    $('#rl').innerHTML = rows.length ? `<div class="pcard">${requestRows(rows, { project: true })}</div>` : '<div class="empty-boq">لا توجد طلبات مطابقة</div>';
    $$('[data-r]', root).forEach(b => b.onclick = () => { const r = all.find(x => x.id === +b.getAttribute('data-r')); requestForm(r, { id: r.project_id }, () => mountRequests(root, params)); }); };
  ['fq', 'fSt', 'fK'].forEach(id => $('#' + id).oninput = render); render();
}
