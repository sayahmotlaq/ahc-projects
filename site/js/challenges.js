// ===== التحديات والمخاطر: سجل عام + تبويب المشروع، درجة محسوبة، مهام معالجة، سجل متابعة =====
import { sb, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData, money_inp, ico } from './ui.js';
import { taskForm, T_STATUS } from './tasks.js';
import { exportTable, xbtn } from './xlsx.js';

export const CH_CATS = ['فني', 'تعاقدي', 'مالي', 'تنظيمي', 'إداري', 'أخرى'];
export const SEV = ['منخفضة', 'متوسطة', 'عالية', 'حرجة'], LIK = ['منخفضة', 'متوسطة', 'عالية'];
export const CH_ST = ['مفتوح', 'قيد المعالجة', 'مغلق'];
const REASONS = { resolved: 'تمت المعالجة', change_order: 'تحوّل إلى أمر تغيير / تمديد', accepted: 'قُبل كمخاطرة (بلا إجراء)', cancelled: 'ملغى / لم يعد قائماً' };
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role').order('full_name')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';

export const scoreOf = c => (SEV.indexOf(c.severity) + 1 || 2) * (LIK.indexOf(c.likelihood) + 1 || 2);
const lvl = s => s >= 8 ? 'high' : s >= 4 ? 'mid' : 'low';
const lvlAr = { high: 'عالٍ', mid: 'متوسط', low: 'منخفض' };
export const scoreChip = c => { const s = c.score ?? scoreOf(c); return `<span class="score ${lvl(s)}" title="الأثر ${esc(c.severity)} × الاحتمالية ${esc(c.likelihood)}"><b>${s}</b><small>${lvlAr[lvl(s)]}</small></span>`; };
const stBadge = s => `<span class="badge ${s === 'مغلق' ? 'full' : s === 'قيد المعالجة' ? 'info' : 'ovr'}">${esc(s)}</span>`;
const overdue = c => c.status !== 'مغلق' && c.due_date && c.due_date < today();
const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;

// بطاقة التحدي (مشتركة بين الصفحة العامة وتبويب المشروع)
export function chCard(c, { project = false } = {}) {
  const tOpen = (c.tasks || []).filter(t => ['open', 'in_progress'].includes(t.status)).length, tAll = (c.tasks || []).length, tDone = (c.tasks || []).filter(t => t.status === 'done').length;
  const last = c.last_at || c.updated_at || c.created_at;
  return `<div class="chc ${c.status === 'مغلق' ? 'off' : ''} ${overdue(c) ? 'late' : ''}" data-ch="${c.id}">
    ${scoreChip(c)}
    <div class="chc-main"><b>${esc(c.title)}</b>
      <div class="chc-sub muted small">${project ? `<a href="#/project/${c.project_id}/challenges" onclick="event.stopPropagation()">${esc(c.projects?.name || '')}</a> · ` : ''}${esc(c.category || '')}${c.owner ? ' · ' + esc(c.owner) : ''}${c.impact_days ? ` · أثر ${c.impact_days} يوم` : ''}${c.impact_amount ? ` · ${money(c.impact_amount)} ر.س` : ''}</div>
      <div class="chc-meta">${stBadge(c.status)}${c.due_date ? `<span class="badge ${overdue(c) ? 'bad' : 'skel'}">${overdue(c) ? 'تجاوز ' : ''}${dateAr(c.due_date)}</span>` : ''}${tAll ? `<span class="badge ${tOpen ? 'info' : 'full'}">${ico('check')} ${tDone}/${tAll} مهام</span>` : c.status !== 'مغلق' && (c.score ?? scoreOf(c)) >= 8 ? '<span class="badge bad">بلا مهام</span>' : ''}${c.notes_n ? `<span class="badge skel">${c.notes_n} متابعة</span>` : ''}${last ? `<span class="muted small">آخر تحديث ${daysAgo(last) === 0 ? 'اليوم' : 'منذ ' + daysAgo(last) + ' يوم'}</span>` : ''}</div>
    </div><span class="chev">${ico('edit')}</span></div>`;
}

// تحميل التحديات مع مهامها وعدد متابعاتها
export async function loadChallenges(filter = {}) {
  let qq = sb.from('challenges').select('*, projects(name,engineer_id,stage)').order('status').order('score', { ascending: false }).order('due_date', { ascending: true, nullsFirst: false });
  if (filter.project_id) qq = qq.eq('project_id', filter.project_id);
  const rows = await q(qq);
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const [tasks, notes] = await Promise.all([q(sb.from('tasks').select('id,challenge_id,title,status,assignee_id,assignee_name,due_date,done_at').in('challenge_id', ids)), q(sb.from('challenge_notes').select('challenge_id,at').in('challenge_id', ids))]);
  rows.forEach(r => { r.tasks = tasks.filter(t => t.challenge_id === r.id); const ns = notes.filter(n => n.challenge_id === r.id); r.notes_n = ns.length; r.last_at = [r.updated_at, ...ns.map(n => n.at), ...r.tasks.map(t => t.done_at)].filter(Boolean).sort().slice(-1)[0]; });
  return rows;
}

// ---------- الصفحة العامة
export async function mountChallenges(root, params) {
  await loadProfiles();
  const me = session.user.id, admin = isAdmin();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">التحديات والمخاطر</h1><span class="sp"></span>${xbtn()}${canEdit() ? '<button class="btn primary" id="chNew">＋ تحدٍ جديد</button>' : ''}</div>
    <div class="kpis" id="chK"></div>
    <div class="filters"><input id="fq" placeholder="بحث…"><select id="fP"><option value="">كل المشاريع</option></select><select id="fSt"><option value="">المفتوحة وقيد المعالجة</option><option value="all">الكل</option>${CH_ST.map(s => `<option value="${s}">${s}</option>`).join('')}</select><select id="fLv"><option value="">كل الدرجات</option><option value="high">عالٍ (8+)</option><option value="mid">متوسط (4–6)</option><option value="low">منخفض</option></select><select id="fC"><option value="">كل التصنيفات</option>${CH_CATS.map(c => `<option>${c}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="fLate"> تجاوز الموعد</label><label class="chk"><input type="checkbox" id="fNoT"> بلا مهام</label></div>
    <div id="chL"></div>`;
  let all = [];
  const load = async () => { all = await loadChallenges(); if (!admin && canEdit()) all = all.filter(c => c.projects?.engineer_id === me || c.created_by === me); const ps = [...new Map(all.map(c => [c.project_id, c.projects?.name || ''])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ar')); $('#fP').innerHTML = '<option value="">كل المشاريع</option>' + ps.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join(''); render(); };
  const render = () => {
    const qs = $('#fq').value.toLowerCase(), pid = $('#fP').value, st = $('#fSt').value, lv = $('#fLv').value, cat = $('#fC').value, late = $('#fLate').checked, noT = $('#fNoT').checked;
    const open = all.filter(c => c.status !== 'مغلق');
    $('#chK').innerHTML = `<div class="kpi"><span>مفتوح</span><b>${open.length}</b><span>من ${all.length}</span></div><div class="kpi ${open.filter(c => lvl(c.score ?? scoreOf(c)) === 'high').length ? 'bad' : ''}"><span>درجة عالية</span><b>${open.filter(c => lvl(c.score ?? scoreOf(c)) === 'high').length}</b><span>يحتاج قراراً</span></div><div class="kpi ${open.filter(overdue).length ? 'bad' : ''}"><span>تجاوز الموعد</span><b>${open.filter(overdue).length}</b><span>الموعد المستهدف</span></div><div class="kpi"><span>بلا مهام معالجة</span><b>${open.filter(c => !(c.tasks || []).some(t => ['open', 'in_progress'].includes(t.status))).length}</b><span>مسجّل بلا عمل</span></div><div class="kpi"><span>أُغلق هذا الشهر</span><b>${all.filter(c => c.closed_at && c.closed_at.slice(0, 7) === today().slice(0, 7)).length}</b><span>${today().slice(0, 7)}</span></div>`;
    const rows = all.filter(c => (!pid || c.project_id === pid) && (st === 'all' || (st ? c.status === st : c.status !== 'مغلق')) && (!lv || lvl(c.score ?? scoreOf(c)) === lv) && (!cat || c.category === cat) && (!late || overdue(c)) && (!noT || !(c.tasks || []).length) && (!qs || (c.title + ' ' + (c.notes || '') + ' ' + (c.projects?.name || '') + ' ' + (c.owner || '')).toLowerCase().includes(qs)));
    root._rows = rows;
    $('#chL').innerHTML = rows.length ? `<div class="chlist">${rows.map(c => chCard(c, { project: true })).join('')}</div>` : '<div class="empty-boq">لا توجد تحديات مطابقة</div>';
    $$('[data-ch]', root).forEach(el => el.onclick = () => openChallenge(all.find(x => x.id === +el.getAttribute('data-ch')), load));
  };
  ['fq', 'fP', 'fSt', 'fLv', 'fC', 'fLate', 'fNoT'].forEach(id => $('#' + id).oninput = render);
  $('#xl').onclick = () => exportTable('التحديات - ' + today(), 'التحديات', [{ h: 'المشروع', k: c => c.projects?.name || '', w: 40 }, { h: 'التحدي', k: 'title', w: 44 }, { h: 'التصنيف', k: 'category', w: 10 }, { h: 'الأثر', k: 'severity', w: 10 }, { h: 'الاحتمالية', k: 'likelihood', w: 10 }, { h: 'الدرجة', k: c => c.score ?? scoreOf(c), t: 'int', w: 8 }, { h: 'أثر زمني (يوم)', k: 'impact_days', t: 'int', w: 10 }, { h: 'أثر مالي', k: 'impact_amount', t: 'money', w: 14 }, { h: 'المسؤول', k: 'owner', w: 16 }, { h: 'الموعد', k: 'due_date', t: 'date', w: 12 }, { h: 'الحالة', k: 'status', w: 12 }, { h: 'المهام', k: c => `${(c.tasks || []).filter(t => t.status === 'done').length}/${(c.tasks || []).length}`, w: 8 }, { h: 'الإجراء', k: 'action', w: 30 }, { h: 'سبب الإغلاق', k: c => REASONS[c.close_reason] || '', w: 18 }], root._rows || [], { title: 'سجل التحديات والمخاطر', subtitle: 'تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع · ' + today() });
  const nb = $('#chNew'); if (nb) nb.onclick = async () => { const ps = await q(sb.from('projects').select('id,name,engineer_id').eq('archived', false).order('name')); const mine = admin ? ps : ps.filter(p => p.engineer_id === me); if (!mine.length) return err('لا توجد مشاريع مرتبطة بحسابك'); chForm(null, null, mine, load); };
  await load();
  if (params?.get('project')) { $('#fP').value = params.get('project'); render(); }
  if (params?.get('id')) { const c = all.find(x => x.id === +params.get('id')); if (c) openChallenge(c, load); }
}

// ---------- تبويب المشروع
export async function projectChallenges(t, p) {
  await loadProfiles();
  const edit = canEdit();
  const rows = await loadChallenges({ project_id: p.id });
  const open = rows.filter(c => c.status !== 'مغلق');
  let showClosed = false;
  const render = () => {
    const list = showClosed ? rows : open;
    t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>التحديات والمخاطر <span class="muted">(${open.length} مفتوح من ${rows.length})</span></h2><span class="sp"></span><a class="small" href="#/challenges?project=${p.id}">السجل العام ${ico('chart')}</a>${rows.length > open.length ? `<label class="chk small"><input type="checkbox" id="chC" ${showClosed ? 'checked' : ''}> إظهار المغلقة</label>` : ''}${edit ? '<button class="btn primary" id="cNew">＋ تحدٍ جديد</button>' : ''}</div>
      ${list.length ? `<div class="chlist">${list.map(c => chCard(c)).join('')}</div>` : `<div class="empty-boq">${rows.length ? 'لا توجد تحديات مفتوحة' : 'لا توجد تحديات مسجلة — سجّل ما قد يؤثر على المدة أو التكلفة أو الجودة وحوّله إلى مهام.'}</div>`}</div>`;
    const reload = () => projectChallenges(t, p);
    if (edit) $('#cNew').onclick = () => chForm(null, p, null, reload);
    const cc = $('#chC'); if (cc) cc.onchange = () => { showClosed = cc.checked; render(); };
    $$('[data-ch]', t).forEach(el => el.onclick = () => openChallenge(rows.find(x => x.id === +el.getAttribute('data-ch')), reload));
  };
  render();
}

// ---------- نموذج الإضافة / التعديل
async function chForm(c, p, projects, done) {
  const html = `<form id="f" class="pgrid">
    ${!c && projects ? field('المشروع *', sel('project_id', projects.map(x => [x.id, x.name]), ''), 'wide') : ''}
    ${field('وصف التحدي *', `<textarea name="title" rows="2" required placeholder="مثال: تأخر توريد المولد الاحتياطي عن الموعد التعاقدي">${esc(c?.title || '')}</textarea>`, 'wide')}
    ${field('التصنيف', sel('category', CH_CATS, c?.category || 'فني'))}${field('الأثر إن وقع', sel('severity', SEV, c?.severity || 'متوسطة'))}${field('الاحتمالية', sel('likelihood', LIK, c?.likelihood || 'متوسطة'))}
    <div class="fld"><span>الدرجة (الأثر × الاحتمالية)</span><div id="scPrev" style="padding-top:4px"></div></div>
    ${field('تأثير زمني متوقع (أيام)', inp('impact_days', c?.impact_days ?? '', 'type="number" min="0"'))}${field('تأثير مالي متوقع (ر.س)', money_inp('impact_amount', c?.impact_amount ?? ''))}
    ${field('تاريخ الرصد', inp('detected_on', c?.detected_on || today(), 'type="date"'))}${field('الموعد المستهدف للمعالجة', inp('due_date', c?.due_date || '', 'type="date"'))}
    ${field('الجهة المسؤولة (مقاول / استشاري / جهة خارجية)', inp('owner', c?.owner || '', 'placeholder="اختياري — المكلَّف الفعلي يكون عبر المهام"'))}${c ? field('الحالة', sel('status', CH_ST.filter(s => s !== 'مغلق' || c.status === 'مغلق'), c.status)) : ''}
    ${field('خطة المعالجة المقترحة', `<textarea name="action" rows="2">${esc(c?.action || '')}</textarea>`, 'wide')}
    ${field('ملاحظات', `<textarea name="notes" rows="2">${esc(c?.notes || '')}</textarea>`, 'wide')}
    <div class="btnrow end wide">${c && isAdmin() ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`;
  await modal(html, { title: c ? 'تعديل التحدي' : 'تحدٍ جديد', wide: true, onOpen: (w, close) => {
    const f = $('#f', w); const prev = () => { const s = scoreOf({ severity: f.severity.value, likelihood: f.likelihood.value }); $('#scPrev', w).innerHTML = scoreChip({ score: s, severity: f.severity.value, likelihood: f.likelihood.value }); }; f.severity.onchange = f.likelihood.onchange = prev; prev();
    f.onsubmit = async e => { e.preventDefault(); const d = formData(f); const n = v => v === '' || v == null ? null : Number(v);
      const row = { project_id: c ? c.project_id : (p?.id || d.project_id), title: d.title.trim(), category: d.category, severity: d.severity, likelihood: d.likelihood, impact_days: n(d.impact_days), impact_amount: n(d.impact_amount), detected_on: d.detected_on || null, due_date: d.due_date || null, owner: d.owner.trim(), action: d.action.trim(), notes: d.notes.trim() };
      if (c && d.status) row.status = d.status;
      if (!row.project_id) return err('اختر المشروع');
      try { if (c) await q(sb.from('challenges').update(row).eq('id', c.id)); else await q(sb.from('challenges').insert({ ...row, created_by: session.user.id })); toast('تم الحفظ'); close(); done(); } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف هذا التحدي وكل متابعاته؟ (المهام المرتبطة تبقى)', 'حذف', true)) return; await q(sb.from('challenges').delete().eq('id', c.id)); close(); done(); };
  } });
}

// ---------- ملف التحدي
export async function openChallenge(c, done) {
  await loadProfiles();
  const me = session.user.id, admin = isAdmin(), edit = canEdit();
  const wrap = await new Promise(resolve => { modal('<div id="chBody"></div>', { title: 'ملف التحدي', wide: true, onOpen: w => resolve(w) }); });
  const close = () => wrap.close();
  let changed = false;
  const finish = () => { if (changed) done(); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.hasAttribute('data-x')) finish(); });
  const render = async () => {
    const [cur, tasks, notes] = await Promise.all([q(sb.from('challenges').select('*, projects(name,engineer_id), change_orders(no,title,status)').eq('id', c.id).single()), q(sb.from('tasks').select('*').eq('challenge_id', c.id).order('status').order('due_date', { ascending: true, nullsFirst: false })), q(sb.from('challenge_notes').select('*').eq('challenge_id', c.id).order('at', { ascending: false }))]);
    const tOpen = tasks.filter(t => ['open', 'in_progress'].includes(t.status)), closed = cur.status === 'مغلق';
    const tb = s => `<span class="badge ${s === 'done' ? 'full' : s === 'in_progress' ? 'info' : s === 'cancelled' ? 'skel' : 'ovr'}">${T_STATUS[s] || s}</span>`;
    $('#chBody', wrap).innerHTML = `<div class="chhead">${scoreChip(cur)}<div><h3 class="m0">${esc(cur.title)}</h3><div class="muted small"><a href="#/project/${cur.project_id}/challenges" data-nav>${esc(cur.projects?.name || '')}</a> · ${esc(cur.category)} · رُصد ${dateAr(cur.detected_on)} · بواسطة ${pname(cur.created_by)}</div></div>${stBadge(cur.status)}</div>
      ${overdue(cur) ? `<div class="alert warn">تجاوز الموعد المستهدف ${dateAr(cur.due_date)} بـ${daysAgo(cur.due_date)} يوم</div>` : ''}
      <div class="mb12 kvs" >${cur.impact_days ? `<div class="kv"><span>أثر زمني متوقع</span><b>${cur.impact_days} يوم</b></div>` : ''}${cur.impact_amount ? `<div class="kv"><span>أثر مالي متوقع</span><b>${money(cur.impact_amount)} ر.س</b></div>` : ''}${cur.owner ? `<div class="kv"><span>الجهة المسؤولة</span><b>${esc(cur.owner)}</b></div>` : ''}${cur.due_date ? `<div class="kv"><span>الموعد المستهدف</span><b class="${overdue(cur) ? 'bad' : ''}">${dateAr(cur.due_date)}</b></div>` : ''}${closed ? `<div class="kv"><span>أُغلق</span><b>${dateAr(cur.closed_at)} · ${REASONS[cur.close_reason] || ''} · ${pname(cur.closed_by)}</b></div>` : ''}${cur.change_orders ? `<div class="kv"><span>أمر تغيير مرتبط</span><b><a href="#/project/${cur.project_id}/changes" data-nav>رقم ${cur.change_orders.no}: ${esc(cur.change_orders.title)}</a></b></div>` : ''}</div>
      ${cur.action ? `<p class="small" style="margin:0 0 10px"><b>خطة المعالجة:</b> ${esc(cur.action)}</p>` : ''}${cur.notes ? `<p class="small muted" style="margin:0 0 10px">${esc(cur.notes)}</p>` : ''}
      <div class="chsec"><div class="toolbar" style="margin:0 0 6px"><h4 class="m0">مهام المعالجة <span class="muted">(${tasks.filter(t => t.status === 'done').length} منجزة من ${tasks.length})</span></h4><span class="sp"></span>${admin && !closed ? '<button class="btn sm primary" id="chTask">＋ مهمة من هذا التحدي</button>' : ''}</div>
        ${tasks.length ? `<table class="lst"><thead><tr><th>المهمة</th><th>المكلّف</th><th>الموعد</th><th>الحالة</th></tr></thead><tbody>${tasks.map(t => `<tr class="${t.status === 'done' || t.status === 'cancelled' ? 'off' : ''}" data-tk="${t.id}" style="cursor:pointer"><td><b>${esc(t.title)}</b>${t.progress_note ? `<br><small class="muted">${esc(t.progress_note)}</small>` : ''}</td><td>${esc(pname(t.assignee_id) !== '—' ? pname(t.assignee_id) : t.assignee_name || '—')}</td><td class="${t.due_date && t.due_date < today() && t.status !== 'done' ? 'bad' : ''}">${dateAr(t.due_date)}</td><td>${tb(t.status)}</td></tr>`).join('')}</tbody></table>` : `<p class="m0 muted small" >${admin ? 'لا توجد مهام بعد — أنشئ مهمة وكلّف بها مهندساً حتى يتحول التحدي إلى عمل يُتابَع.' : 'لا توجد مهام معالجة بعد. يمكنك إضافة متابعة أدناه أو رفع طلب للإدارة.'}</p>`}</div>
      <div class="chsec"><h4 style="margin:0 0 6px">سجل المتابعة <span class="muted">(${notes.length})</span></h4>
        ${edit && !closed ? `<form id="nf" class="chnote"><input name="body" placeholder="أضف متابعة: ما الذي تم؟ وما التالي؟" required autocomplete="off"><button class="btn sm primary">إضافة</button></form>` : ''}
        ${notes.length ? `<div class="tl">${notes.map(n => `<div class="e"><i>${ico('inbox')}</i><div><small>${dateAr(n.at)} · ${pname(n.by_user)}</small><b style="font-weight:500">${esc(n.body)}</b></div></div>`).join('')}</div>` : '<p class="m0 muted small" >لا توجد متابعات.</p>'}</div>
      <div class="mt12 btnrow end" >${edit ? `<button class="btn" id="chEdit">${ico('edit')} تعديل</button>` : ''}<span class="sp"></span>${edit && !closed ? (tOpen.length ? `<span class="muted small">لإغلاق التحدي أنجز أو ألغِ المهام المفتوحة (${tOpen.length})</span>` : '<button class="btn" id="chClose">إغلاق التحدي</button>') : ''}${edit && closed ? '<button class="btn" id="chReopen">إعادة فتح</button>' : ''}<button class="btn" data-x>إغلاق النافذة</button></div>`;
    $$('[data-nav]', wrap).forEach(a => a.onclick = () => { finish(); close(); });
    const tk = $('#chTask', wrap); if (tk) tk.onclick = () => taskForm(null, { id: cur.project_id, engineer_id: cur.projects?.engineer_id }, () => { changed = true; render(); }, { title: cur.title.slice(0, 80), details: cur.action || '', due_date: cur.due_date || '', priority: (cur.score ?? scoreOf(cur)) >= 8 ? 'urgent' : (cur.score ?? scoreOf(cur)) >= 4 ? 'high' : 'normal', challenge_id: cur.id });
    $$('[data-tk]', wrap).forEach(r => r.onclick = () => { const t = tasks.find(x => x.id === +r.getAttribute('data-tk')); if (admin || t.assignee_id === me) taskForm(t, { id: cur.project_id }, async () => { changed = true; await render(); if (cur.status !== 'مغلق' && tasks.length && !(await q(sb.from('tasks').select('id').eq('challenge_id', cur.id).in('status', ['open', 'in_progress']))).length && await confirm('أُنجزت كل مهام هذا التحدي. هل تريد إغلاقه الآن؟', 'إغلاق التحدي')) closeForm(cur); }); });
    const nf = $('#nf', wrap); if (nf) nf.onsubmit = async e => { e.preventDefault(); const body = nf.body.value.trim(); if (!body) return; try { await q(sb.from('challenge_notes').insert({ challenge_id: cur.id, body, by_user: me })); if (cur.status === 'مفتوح') await q(sb.from('challenges').update({ status: 'قيد المعالجة' }).eq('id', cur.id)); changed = true; render(); } catch (er) { err(er); } };
    const ed = $('#chEdit', wrap); if (ed) ed.onclick = () => chForm(cur, null, null, () => { changed = true; render(); });
    const cl = $('#chClose', wrap); if (cl) cl.onclick = () => closeForm(cur);
    const ro = $('#chReopen', wrap); if (ro) ro.onclick = async () => { if (!await confirm('إعادة فتح التحدي؟', 'إعادة فتح')) return; try { await q(sb.from('challenges').update({ status: 'قيد المعالجة' }).eq('id', cur.id)); changed = true; render(); } catch (er) { err(er); } };
  };
  const closeForm = async cur => {
    const cos = await q(sb.from('change_orders').select('id,no,title').eq('project_id', cur.project_id).order('no'));
    await modal(`<form id="f" class="pgrid">${field('سبب الإغلاق', sel('close_reason', Object.entries(REASONS), 'resolved'), 'wide')}${cos.length ? field('أمر التغيير المرتبط (إن وجد)', sel('change_order_id', [['', '—'], ...cos.map(o => [o.id, `رقم ${o.no}: ${o.title}`])], cur.change_order_id || ''), 'wide') : ''}${field('ملاحظة ختامية', inp('note', '', 'placeholder="اختياري — تُضاف لسجل المتابعة"'), 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إغلاق التحدي</button></div></form>`, { title: 'إغلاق التحدي', onOpen: (w, cl) => { $('#f', w).onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { if (d.note?.trim()) await q(sb.from('challenge_notes').insert({ challenge_id: cur.id, body: d.note.trim(), by_user: me })); await q(sb.from('challenges').update({ status: 'مغلق', close_reason: d.close_reason, change_order_id: d.change_order_id || null }).eq('id', cur.id)); toast('أُغلق التحدي'); changed = true; cl(); render(); } catch (er) { err(er); } }; } });
  };
  await render();
}
