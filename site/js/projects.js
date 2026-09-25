// ===== المشاريع: لوحة المؤشرات، القائمة، بطاقة المشروع =====
import { sb, REF, STAGES, stageOf, PROJECT_TYPES, UPDATE_KINDS, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, fmt, fmt0, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';
import { mountBoq, calc, BOQ_STATUS } from './boq.js';
import { projectTasks, projectRequests } from './tasks.js';
import { projectPayments } from './payments.js';
import { projectTReports } from './treports.js';

const CATEGORIES = ['حكومي', 'شراء مباشر', 'شراكة مجتمعية'];
let profiles = [];
async function loadProfiles() { profiles = await q(sb.from('profiles').select('id,full_name,email,role').order('full_name')); return profiles; }
const pname = (id, fallback) => profiles.find(p => p.id === id)?.full_name || fallback || '—';
const stageBadge = k => { const s = stageOf(k); return `<span class="stage" style="background:${s.color}">${esc(s.ar)}</span>`; };

// ---------- لوحة المؤشرات
export async function mountDashboard(root) {
  root.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
  const [projects] = await Promise.all([q(sb.from('projects').select('id,name,ref,facility,stage,priority,budget,contract_value,paid_amount,progress_actual,progress_planned,end_date,updated_at,engineer_id,engineer_name,status_note,category').eq('archived', false)), loadProfiles()]);
  const byStage = {}; STAGES.forEach(s => byStage[s.key] = { n: 0, v: 0 });
  projects.forEach(p => { const b = byStage[p.stage] || (byStage[p.stage] = { n: 0, v: 0 }); b.n++; b.v += Number(p.contract_value || p.budget || 0); });
  const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const late = active.filter(p => p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'));
  const chs = await q(sb.from('challenges').select('id,project_id,title,severity,status,owner,projects(name)').neq('status', 'مغلق').order('severity'));
  const tasks = await q(sb.from('tasks').select('id,project_id,title,status,due_date,assignee_id,assignee_name,priority,projects(name)').in('status', ['open', 'in_progress']).order('due_date', { ascending: true, nullsFirst: false }));
  const reqs = await q(sb.from('requests').select('id,project_id,title,kind,status,priority,created_by,created_at,projects(name)').in('status', ['new', 'in_review']).order('id', { ascending: false }));
  const act = await loadActivity(); const stale = active.filter(p => isStale(p, act));
  const pays = await q(sb.from('payments').select('id,status,net_amount').in('status', ['submitted', 'review', 'approved', 'finance']));
  const payPend = pays.filter(r => r.status !== 'finance'), payFin = pays.filter(r => r.status === 'finance');
  const trs = await q(sb.from('tech_reports').select('id,project_id,kind,title,report_date,created_by,projects(name)').eq('status', 'published').order('id', { ascending: false }));
  const lateTasks = tasks.filter(t => t.due_date && t.due_date < today());
  const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0);
  const exec = projects.filter(p => p.stage === 'execution');
  root.innerHTML = `<div class="dash">
    <div class="kpis"><div class="kpi"><b>${projects.length}</b><span>إجمالي المشاريع</span></div><div class="kpi"><b>${active.length}</b><span>مشاريع قائمة</span></div><div class="kpi"><b>${exec.length}</b><span>تحت التنفيذ</span></div><div class="kpi ${late.length ? 'bad' : ''}"><b>${late.length}</b><span>متأخرة / متعثرة</span></div><div class="kpi ${chs.length ? 'bad' : ''}"><b>${chs.length}</b><span>تحديات مفتوحة</span></div><a class="kpi ${pays.length ? 'bad' : ''}" href="#/payments"><b>${payPend.length}<small> / ${payFin.length}</small></b><span>مستخلصات قيد الاعتماد / لدى المالية · ${money(Math.round(pays.reduce((a, r) => a + Number(r.net_amount || 0), 0)))} ر.س</span></a><a class="kpi ${trs.length ? 'bad' : ''}" href="#/treports"><b>${trs.length}</b><span>تقارير فنية بانتظار المراجعة</span></a><a class="kpi ${lateTasks.length ? 'bad' : ''}" href="#/tasks"><b>${tasks.length}</b><span>مهام مفتوحة${lateTasks.length ? ' · ' + lateTasks.length + ' متأخرة' : ''}</span></a><a class="kpi ${reqs.length ? 'bad' : ''}" href="#/requests"><b>${reqs.length}</b><span>طلبات بانتظار الرد</span></a><a class="kpi ${stale.length ? 'bad' : ''}" href="#/projects?g=all&flag=stale"><b>${stale.length}</b><span>بلا تحديث منذ ${STALE_DAYS} يوماً</span></a><div class="kpi"><b>${totalV >= 1e6 ? (totalV / 1e6).toFixed(1) + '<small> مليون</small>' : fmt0(totalV)}</b><span>القيمة الإجمالية (ر.س)</span></div></div>
    <div class="pcard"><h2><span class="ic"></span>المشاريع حسب المرحلة</h2><div class="stagebar">${STAGES.map(s => `<a class="stagecell" href="#/projects?stage=${s.key}" style="border-top-color:${s.color}"><b>${byStage[s.key].n}</b><span>${esc(s.ar)}</span><small>${money(Math.round(byStage[s.key].v))}</small></a>`).join('')}</div></div>
    <div class="two">
      <div class="pcard"><h2><span class="ic"></span>تحت التنفيذ</h2>${exec.length ? `<table class="lst"><thead><tr><th>المشروع</th><th>المهندس</th><th class="c">مخطط</th><th class="c">فعلي</th><th>الانتهاء</th></tr></thead><tbody>${exec.map(p => `<tr data-open="${p.id}"><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.facility || '')}</span></td><td>${esc(pname(p.engineer_id, p.engineer_name))}</td><td class="c">${p.progress_planned || 0}%</td><td class="c"><div class="bar"><i style="width:${p.progress_actual || 0}%"></i></div>${p.progress_actual || 0}%</td><td class="${late.includes(p) ? 'bad' : ''}">${dateAr(p.end_date)}${p.status_note ? ' · ' + esc(p.status_note) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد مشاريع تحت التنفيذ حالياً.</p>'}</div>
      <div class="pcard"><h2><span class="ic"></span>التحديات المفتوحة</h2>${chs.length ? chs.map(c => `<div class="upd"><div class="uh">${sevBadge(c.severity)} <a href="#/project/${c.project_id}/challenges">${esc(c.projects?.name || '')}</a> <span class="muted">· ${esc(c.owner || '')}</span></div><div class="ub">${esc(c.title)}</div></div>`).join('') : '<p class="muted">لا توجد تحديات مفتوحة.</p>'}</div>
    </div>
    <div class="two">
      <div class="pcard"><h2><span class="ic"></span>المهام المفتوحة <a class="muted small" href="#/tasks">عرض الكل</a></h2>${tasks.length ? `<table class="lst"><thead><tr><th>المهمة</th><th>المشروع</th><th>المكلّف</th><th>الموعد</th></tr></thead><tbody>${tasks.slice(0, 8).map(t => { const late = t.due_date && t.due_date < today(); return `<tr data-open="${t.project_id}"><td><b>${esc(t.title)}</b>${t.priority === 'urgent' ? ' <span class="badge bad">عاجلة</span>' : t.priority === 'high' ? ' <span class="badge ovr">مهمة</span>' : ''}</td><td class="muted">${esc(t.projects?.name || '')}</td><td>${esc(pname(t.assignee_id, t.assignee_name))}</td><td class="${late ? 'bad' : ''}">${dateAr(t.due_date)}${late ? ' · متأخرة' : ''}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">لا توجد مهام مفتوحة.</p>'}</div>
      <div class="pcard"><h2><span class="ic"></span>الطلبات بانتظار الرد <a class="muted small" href="#/requests">عرض الكل</a></h2>${reqs.length ? `<table class="lst"><thead><tr><th>الطلب</th><th>المشروع</th><th>مقدّمه</th><th>التاريخ</th></tr></thead><tbody>${reqs.slice(0, 8).map(r => `<tr data-open="${r.project_id}"><td><b>${esc(r.title)}</b><br><span class="muted">${({ approval: 'اعتماد', review: 'مراجعة', decision: 'قرار', support: 'دعم', other: 'أخرى' })[r.kind] || ''}</span></td><td class="muted">${esc(r.projects?.name || '')}</td><td>${esc(pname(r.created_by))}</td><td>${dateAr(r.created_at)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد طلبات بانتظار الرد.</p>'}</div>
    </div>
    ${stale.length ? `<div class="pcard"><h2><span class="ic"></span>مشاريع بلا تحديث منذ أكثر من ${STALE_DAYS} يوماً <span class="muted">(${stale.length})</span></h2><div class="chips">${stale.map(p => `<a class="chip" href="#/project/${p.id}">${esc(p.name)} <small>${Math.floor((Date.now() - new Date(act[p.id] || p.updated_at)) / 864e5)} يوم</small></a>`).join('')}</div></div>` : ''}
    <div class="pcard"><h2><span class="ic"></span>المحفظة حسب الفئة</h2><table class="lst"><thead><tr><th>الفئة</th><th class="c">عدد</th><th class="c">قيمة العقود (ر.س)</th><th class="c">المصروف (ر.س)</th><th class="c">متوسط الإنجاز</th><th class="c">متأخرة / متعثرة</th></tr></thead><tbody>${['حكومي', 'شراء مباشر', 'شراكة مجتمعية'].map(cat => { const ps = projects.filter(p => p.category === cat); const ex = ps.filter(p => p.stage === 'execution'); return `<tr data-cat="${cat}"><td><b>${cat}</b></td><td class="c">${ps.length}</td><td class="c n">${money(ps.reduce((a, p) => a + Number(p.contract_value || 0), 0))}</td><td class="c n">${money(ps.reduce((a, p) => a + Number(p.paid_amount || 0), 0))}</td><td class="c">${ex.length ? Math.round(ex.reduce((a, p) => a + Number(p.progress_actual || 0), 0) / ex.length) + '%' : '—'}</td><td class="c ${ps.filter(p => late.includes(p)).length ? 'bad' : ''}">${ps.filter(p => late.includes(p)).length}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="pcard"><h2><span class="ic"></span>آخر التحديثات</h2><div id="recent"><p class="muted">…</p></div></div></div>`;
  $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open'));
  $$('[data-cat]', root).forEach(tr => { tr.style.cursor = 'pointer'; tr.onclick = () => location.hash = '#/projects?cat=' + encodeURIComponent(tr.getAttribute('data-cat')); });
  const ups = await q(sb.from('project_updates').select('id,project_id,kind,body,happened_on,created_by,projects(name)').order('created_at', { ascending: false }).limit(8));
  $('#recent').innerHTML = ups.length ? ups.map(u => `<div class="upd"><div class="uh"><span class="badge skel">${UPDATE_KINDS[u.kind] || u.kind}</span> <a href="#/project/${u.project_id}">${esc(u.projects?.name || '')}</a> <span class="muted">· ${esc(pname(u.created_by))} · ${dateAr(u.happened_on)}</span></div><div class="ub">${esc(u.body)}</div></div>`).join('') : '<p class="muted">لا توجد تحديثات بعد.</p>';
}

// ---------- القائمة
const NOT_STARTED = ['request', 'study', 'approval', 'tender', 'award'];
export const groupOf = p => p.category === 'شراكة مجتمعية' ? 'partner' : (NOT_STARTED.includes(p.stage) ? 'study' : 'gov');
const GROUPS = [['gov', 'المشاريع الحكومية'], ['partner', 'الشراكة المجتمعية'], ['study', 'تحت الدراسة (الطلبات الجديدة)'], ['all', 'الكل']];
export const STALE_DAYS = 14;
export const isStale = (p, act) => { if (['closed', 'cancelled'].includes(p.stage) || p.archived) return false; const d = act?.[p.id] || p.updated_at; return d && (Date.now() - new Date(d)) > STALE_DAYS * 864e5; };
export async function loadActivity() { const rows = await q(sb.from('v_project_activity').select('*')); const m = {}; rows.forEach(r => m[r.project_id] = r.last_activity); return m; }
const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;

export async function mountProjects(root, params) {
  const edit = canEdit();
  const g0 = params.get('g') || (params.get('cat') === 'شراكة مجتمعية' ? 'partner' : params.get('cat') ? 'gov' : 'gov');
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">المشاريع</h1><span style="flex:1"></span>${edit ? '<button class="btn primary" id="pNew">＋ مشروع جديد</button>' : ''}</div>
    <div class="tabs" id="gtabs">${GROUPS.map(([k, t]) => `<a href="#/projects?g=${k}" class="${g0 === k ? 'on' : ''}" data-g="${k}">${t} <span class="cnt" data-cnt="${k}"></span></a>`).join('')}</div>
    <div class="filters"><input id="fq" placeholder="بحث بالاسم أو الرقم أو المنشأة أو المقاول…"><select id="fStage"><option value="">كل المراحل</option>${STAGES.map(s => `<option value="${s.key}" ${params.get('stage') === s.key ? 'selected' : ''}>${esc(s.ar)}</option>`).join('')}</select><select id="fEng"><option value="">كل مديري المشاريع</option></select><select id="fPr"><option value="">كل الأولويات</option><option value="urgent">عاجلة</option><option value="high">مهمة</option><option value="normal">عادية</option></select><select id="fFlag"><option value="">بدون تصفية إضافية</option><option value="late">المتأخرة / المتعثرة</option><option value="stale">بلا تحديث منذ ${STALE_DAYS} يوماً</option></select><select id="fSort"><option value="activity">الترتيب: آخر نشاط</option><option value="name">الاسم</option><option value="stage">المرحلة</option><option value="value_desc">القيمة (الأعلى)</option><option value="progress">الإنجاز</option><option value="end">تاريخ الانتهاء</option><option value="stale">الأقدم تحديثاً</option></select><label class="chk"><input type="checkbox" id="fArch"> المؤرشفة</label></div>
    <div id="plist"><p class="muted">جارٍ التحميل…</p></div>`;
  await loadProfiles();
  const names = [...new Set([...profiles.filter(p => ['admin', 'engineer'].includes(p.role)).map(p => p.full_name)])];
  let all = [], act = {}; let g = g0;
  $('#fEng').innerHTML += names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $$('[data-g]', root).forEach(a => a.onclick = e => { e.preventDefault(); g = a.getAttribute('data-g'); $$('[data-g]', root).forEach(x => x.classList.toggle('on', x === a)); history.replaceState(null, '', '#/projects?g=' + g); render(); });
  async function load() { [all, act] = await Promise.all([q(sb.from('projects').select('*')), loadActivity()]); all.forEach(p => { p._eng = pname(p.engineer_id, p.engineer_name); p._act = act[p.id] || p.updated_at; p._late = !!p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'); p._stale = isStale(p, act); }); GROUPS.forEach(([k]) => { const el = root.querySelector(`[data-cnt="${k}"]`); if (el) el.textContent = all.filter(p => !p.archived && (k === 'all' || groupOf(p) === k)).length; }); render(); }
  function render() {
    const qs = ($('#fq').value || '').toLowerCase(), st = $('#fStage').value, en = $('#fEng').value, pr = $('#fPr').value, fl = $('#fFlag').value, so = $('#fSort').value, arch = $('#fArch').checked;
    let rows = all.filter(p => (arch || !p.archived) && (g === 'all' || groupOf(p) === g) && (!st || p.stage === st) && (!en || p._eng === en) && (!pr || p.priority === pr) && (fl !== 'late' || p._late) && (fl !== 'stale' || p._stale) && (!qs || [p.name, p.ref, p.facility, p.contractor, p.beneficiary].join(' ').toLowerCase().includes(qs)));
    const si = k => STAGES.findIndex(s => s.key === k);
    const cmp = { activity: (a, b) => (b._act || '').localeCompare(a._act || ''), name: (a, b) => a.name.localeCompare(b.name, 'ar'), stage: (a, b) => si(a.stage) - si(b.stage) || a.name.localeCompare(b.name, 'ar'), value_desc: (a, b) => Number(b.contract_value || b.budget || 0) - Number(a.contract_value || a.budget || 0), progress: (a, b) => Number(b.progress_actual || 0) - Number(a.progress_actual || 0), end: (a, b) => (a.end_date || '9999').localeCompare(b.end_date || '9999'), stale: (a, b) => (a._act || '').localeCompare(b._act || '') }[so];
    rows.sort(cmp);
    const study = g === 'study';
    $('#plist').innerHTML = rows.length ? `<div class="pcard" style="padding:0;overflow:auto"><table class="lst"><thead><tr><th>م</th><th>المشروع</th>${study ? '<th>الأولوية</th><th>البرنامج المالي</th>' : '<th>الفئة</th>'}<th>المرحلة</th><th>مدير المشروع</th><th class="c">${study ? 'الميزانية التقديرية' : 'قيمة العقد'} (ر.س)</th>${study ? '<th>الطرح / الترسية</th>' : '<th class="c">الإنجاز</th><th>الانتهاء</th>'}<th>آخر نشاط</th></tr></thead><tbody>${rows.map((p, i) => `<tr data-open="${p.id}" class="${p.archived ? 'off' : ''}"><td class="c">${i + 1}</td><td><b>${esc(p.name)}</b>${p._stale ? ' <span class="badge ovr" title="بلا تحديث منذ أسبوعين">⏳ بلا تحديث</span>' : ''}<br><span class="muted">${esc(p.ref || '')} ${esc(p.facility || p.beneficiary || '')}</span></td>${study ? `<td>${p.priority === 'urgent' ? '<span class="badge bad">عاجلة</span>' : p.priority === 'high' ? '<span class="badge ovr">مهمة</span>' : 'عادية'}</td><td>${esc(p.funding || '—')}</td>` : `<td>${esc(p.category || '—')}</td>`}<td>${stageBadge(p.stage)}${p.status_note ? ` <span class="badge bad">${esc(p.status_note)}</span>` : ''}</td><td>${esc(p._eng)}</td><td class="c n">${money(study ? p.budget : (p.contract_value || p.budget))}</td>${study ? `<td>${dateAr(p.tender_date)} / ${dateAr(p.award_date)}</td>` : `<td class="c">${p.stage === 'execution' ? `<div class="bar"><i style="width:${p.progress_actual || 0}%"></i></div>${p.progress_actual || 0}%` : '—'}</td><td class="${p._late ? 'bad' : ''}">${dateAr(p.end_date)}</td>`}<td class="${p._stale ? 'bad' : 'muted'}">${daysAgo(p._act) === 0 ? 'اليوم' : 'منذ ' + daysAgo(p._act) + ' يوم'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-boq">لا توجد مشاريع مطابقة</div>';
    $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open'));
  }
  if (params.get('flag')) $('#fFlag').value = params.get('flag');
  ['fq', 'fStage', 'fEng', 'fPr', 'fFlag', 'fSort', 'fArch'].forEach(id => $('#' + id).oninput = render);
  if (edit) $('#pNew').onclick = () => editProject(null, id => location.hash = '#/project/' + id);
  await load();
}

async function editProject(p, done) {
  const isNew = !p; await loadProfiles();
  const engs = [['', '—'], ...profiles.filter(x => ['admin', 'engineer'].includes(x.role)).map(x => [x.id, x.full_name])];
  const html = `<form id="f" class="pgrid">
    ${field('اسم المشروع *', inp('name', p?.name || '', 'required'), 'wide')}
    ${field('رقم المشروع / المرجع', inp('ref', p?.ref || '', 'placeholder="AHC-PRJ-2026-001"'))}
    ${field('فئة المشروع', sel('category', CATEGORIES, p?.category || 'حكومي'))}
    ${field('نوع المشروع', sel('type', PROJECT_TYPES, p?.type || PROJECT_TYPES[0]))}
    ${field('المنشأة / الموقع', inp('facility', p?.facility || ''))}
    ${field('الجهة المستفيدة', inp('beneficiary', p?.beneficiary || ''))}
    ${field('الجهة الطالبة', inp('dept', p?.dept || ''))}
    ${field('المهندس المسؤول (حساب)', sel('engineer_id', engs, p?.engineer_id || ''))}
    ${field('اسم مدير المشروع', inp('engineer_name', p?.engineer_name || '', 'placeholder="يُستخدم إن لم يكن له حساب بعد"'))}
    ${field('البرنامج المالي', inp('funding', p?.funding || ''))}
    ${field('الأولوية', sel('priority', [['low', 'منخفضة'], ['normal', 'عادية'], ['high', 'مهمة'], ['urgent', 'عاجلة']], p?.priority || 'normal'))}
    ${field('الميزانية التقديرية (ر.س)', inp('budget', p?.budget || '', 'type="number" min="0" step="1"'))}
    ${field('الميزانية المعتمدة (ر.س)', inp('budget_approved', p?.budget_approved || '', 'type="number" min="0" step="1"'))}
    ${field('المبلغ الإضافي على العقد (ر.س)', inp('contract_extra', p?.contract_extra || '', 'type="number" min="0" step="1"'))}
    ${field('إجمالي قيمة العقد (ر.س)', inp('contract_value', p?.contract_value || '', 'type="number" min="0" step="1"'))}
    ${field('تاريخ الرفع للطرح', inp('tender_submit_date', p?.tender_submit_date || '', 'type="date"'))}
    ${field('تاريخ الطرح', inp('tender_date', p?.tender_date || '', 'type="date"'))}
    ${field('تاريخ الترسية', inp('award_date', p?.award_date || '', 'type="date"'))}
    ${field('المقاول', inp('contractor', p?.contractor || ''))}
    ${field('الاستشاري / المشرف', inp('consultant', p?.consultant || ''))}
    ${field('تاريخ المباشرة', inp('start_date', p?.start_date || '', 'type="date"'))}
    ${field('تاريخ الانتهاء التعاقدي', inp('end_date', p?.end_date || '', 'type="date"'))}
    ${field('المدة الإضافية (أيام)', inp('extra_days', p?.extra_days ?? 0, 'type="number" min="0" step="1"'))}
    ${field('تاريخ الانتهاء المعدّل', inp('revised_end_date', p?.revised_end_date || '', 'type="date"'))}
    ${field('وصف الحالة', sel('status_note', [['', '—'], ['متأخر', 'متأخر'], ['متعثر', 'متعثر']], p?.status_note || ''))}
    ${field('الإنجاز المخطط %', inp('progress_planned', p?.progress_planned ?? 0, 'type="number" min="0" max="100" step="1"'))}
    ${field('الإنجاز الفعلي %', inp('progress_actual', p?.progress_actual ?? 0, 'type="number" min="0" max="100" step="1"'))}
    ${field('مدفوعات سابقة خارج المنصة (ر.س)', inp('paid_opening', p?.paid_opening ?? p?.paid_amount ?? 0, 'type="number" min="0" step="1" title="المصروف عبر المستخلصات يُحتسب تلقائياً ويُضاف إلى هذا الرصيد"'))}
    ${field('نطاق العمل / ملاحظات', `<textarea name="notes" rows="3">${esc(p?.notes || '')}</textarea>`, 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`;
  await modal(html, { title: isNew ? 'مشروع جديد' : 'تعديل بيانات المشروع', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const num = v => v === '' ? null : Number(v);
      const row = { name: f.name.trim(), ref: f.ref.trim(), category: f.category, type: f.type, facility: f.facility.trim(), beneficiary: f.beneficiary.trim(), dept: f.dept.trim(), engineer_id: f.engineer_id || null, engineer_name: f.engineer_name.trim(), funding: f.funding.trim(), priority: f.priority, budget: num(f.budget), budget_approved: num(f.budget_approved), contract_extra: num(f.contract_extra) || 0, contract_value: num(f.contract_value), tender_submit_date: f.tender_submit_date || null, tender_date: f.tender_date || null, award_date: f.award_date || null, contractor: f.contractor.trim(), consultant: f.consultant.trim(), start_date: f.start_date || null, end_date: f.end_date || null, extra_days: num(f.extra_days) || 0, revised_end_date: f.revised_end_date || null, status_note: f.status_note || null, progress_planned: num(f.progress_planned) || 0, progress_actual: num(f.progress_actual) || 0, paid_opening: num(f.paid_opening) || 0, notes: f.notes };
      try { let id = p?.id; if (isNew) { row.created_by = session.user.id; const r = await q(sb.from('projects').insert(row).select('id').single()); id = r.id; await sb.from('project_stage_log').insert({ project_id: id, from_stage: null, to_stage: 'request', note: 'إنشاء المشروع', by_user: session.user.id }); } else await q(sb.from('projects').update(row).eq('id', p.id)); toast('تم الحفظ'); close(); done && done(id); } catch (er) { err(er); } };
  } });
}

// ---------- بطاقة المشروع
export async function mountProject(root, id, tab = 'overview', sub) {
  const edit = canEdit();
  await loadProfiles();
  const p = await q(sb.from('projects').select('*').eq('id', id).maybeSingle());
  if (!p) { root.innerHTML = '<div class="empty-boq">المشروع غير موجود</div>'; return; }
  p.engineer_name = pname(p.engineer_id, p.engineer_name);
  if (tab === 'boq' && sub) { return mountBoq(root, sub, p, () => location.hash = `#/project/${id}/boq`); }
  const st = stageOf(p.stage);
  const tabs = [['overview', 'نظرة عامة'], ['tasks', 'المهام'], ['requests', 'الطلبات'], ['payments', 'المستخلصات'], ['treports', 'التقارير الفنية'], ['challenges', 'التحديات والمخاطر'], ['boq', 'جداول الكميات'], ['updates', 'التحديثات والملاحظات'], ['log', 'سجل المراحل']];
  root.innerHTML = `<div class="phead">
    <div class="crumb"><a href="#/projects">المشاريع</a><span class="sep">›</span><span>${esc(p.name)}</span></div>
    <div class="ptitle"><div><h1>${esc(p.name)}</h1><div class="muted">${esc(p.category || '')} · ${esc(p.type || '')} ${p.facility ? '· ' + esc(p.facility) : ''} ${p.beneficiary ? '· ' + esc(p.beneficiary) : ''} · مدير المشروع: ${esc(p.engineer_name)}</div></div>
      <div class="btnrow">${stageBadge(p.stage)}${p.status_note ? `<span class="badge bad">${esc(p.status_note)}</span>` : ''}${isStale(p, await loadActivity()) ? '<span class="badge ovr">⏳ بلا تحديث منذ أسبوعين</span>' : ''}<a class="btn" href="#/report/custom?p=${id}">📄 تقرير المشروع</a>${edit ? `<button class="btn primary" id="pStage">تغيير المرحلة</button><button class="btn" id="pEdit">تعديل البيانات</button>` : ''}${isAdmin() ? `<button class="btn ${p.archived ? '' : 'danger'}" id="pArch">${p.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>` : ''}</div></div>
    <div class="stageline">${STAGES.filter(s => !['onhold', 'cancelled'].includes(s.key)).map((s, i) => { const idx = STAGES.findIndex(x => x.key === p.stage); const done = i < idx, cur = s.key === p.stage; return `<div class="sl ${done ? 'done' : ''} ${cur ? 'cur' : ''}" style="${cur ? '--c:' + s.color : ''}"><i></i><span>${esc(s.ar)}</span></div>`; }).join('')}</div>
    <div class="tabs">${tabs.map(([k, t]) => `<a href="#/project/${id}/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div></div><div id="ptab"></div>`;
  if (edit) {
    $('#pStage').onclick = () => changeStage(p, () => mountProject(root, id, tab));
    $('#pEdit').onclick = () => editProject(p, () => mountProject(root, id, tab));
  }
  if (isAdmin()) $('#pArch').onclick = async () => { await q(sb.from('projects').update({ archived: !p.archived }).eq('id', id)); mountProject(root, id, tab); };
  const t = $('#ptab');
  if (tab === 'overview') overview(t, p, edit);
  else if (tab === 'boq') boqList(t, p, edit);
  else if (tab === 'challenges') challenges(t, p, edit);
  else if (tab === 'tasks') projectTasks(t, p);
  else if (tab === 'requests') projectRequests(t, p);
  else if (tab === 'payments') projectPayments(t, p);
  else if (tab === 'treports') projectTReports(t, p);
  else if (tab === 'updates') updates(t, p, edit);
  else if (tab === 'log') stageLog(t, p);
}
function overview(t, p, edit) {
  const V = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const remaining = Number(p.contract_value || 0) - Number(p.paid_amount || 0);
  const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date) - new Date()) / 864e5) : null;
  t.innerHTML = `<div class="two">
    <div class="pcard"><h2><span class="ic"></span>البيانات الأساسية</h2><div class="kvs">${V('رقم المشروع', esc(p.ref || '—'))}${V('الفئة', esc(p.category || '—'))}${V('النوع', esc(p.type || '—'))}${V('المنشأة', esc(p.facility || '—'))}${V('الجهة المستفيدة', esc(p.beneficiary || '—'))}${V('البرنامج المالي', esc(p.funding || '—'))}${V('الرفع للطرح / الطرح / الترسية', `${dateAr(p.tender_submit_date)} / ${dateAr(p.tender_date)} / ${dateAr(p.award_date)}`)}${V('الأولوية', { low: 'منخفضة', normal: 'عادية', high: 'مهمة', urgent: 'عاجلة' }[p.priority] || '—')}${V('تاريخ الإنشاء', dateAr(p.created_at))}</div>
      ${p.notes ? `<h3 class="sub">نطاق العمل / ملاحظات</h3><p class="pre">${esc(p.notes)}</p>` : ''}</div>
    <div class="pcard"><h2><span class="ic"></span>العقد والتنفيذ</h2><div class="kvs">${V('الميزانية التقديرية', money(p.budget) + ' ر.س')}${V('الميزانية المعتمدة', money(p.budget_approved) + ' ر.س')}${V('الإضافي على العقد', money(p.contract_extra) + ' ر.س')}${V('إجمالي قيمة العقد', money(p.contract_value) + ' ر.س')}${V('المقاول', esc(p.contractor || '—'))}${V('الاستشاري', esc(p.consultant || '—'))}${V('المباشرة', dateAr(p.start_date))}${V('الانتهاء التعاقدي', dateAr(p.end_date) + (daysLeft !== null && p.stage === 'execution' ? ` <small class="${daysLeft < 0 ? 'bad' : 'muted'}">(${daysLeft < 0 ? 'متأخر ' + (-daysLeft) : 'متبقٍ ' + daysLeft} يوم)</small>` : ''))}${V('المدة الإضافية / الانتهاء المعدّل', `${p.extra_days || 0} يوم / ${dateAr(p.revised_end_date)}`)}${V('نسبة الصرف', p.contract_value ? Math.round(Number(p.paid_amount || 0) / Number(p.contract_value) * 100) + '%' : '—')}${V('المدفوع', money(p.paid_amount) + ' ر.س <a class="small" href="#/project/' + p.id + '/payments">المستخلصات ›</a>')}${V('المتبقي من العقد', (p.contract_value ? money(remaining) : '—') + ' ر.س')}</div>
      <div class="prog"><div class="pl"><span>الإنجاز المخطط</span><b>${p.progress_planned || 0}%</b></div><div class="bar"><i style="width:${p.progress_planned || 0}%;background:#A98736"></i></div><div class="pl"><span>الإنجاز الفعلي</span><b>${p.progress_actual || 0}%</b></div><div class="bar"><i style="width:${p.progress_actual || 0}%"></i></div></div></div></div>`;
}
async function boqList(t, p, edit) {
  const boqs = await q(sb.from('boqs').select('*').eq('project_id', p.id).order('created_at'));
  const totals = {};
  for (const b of boqs) { const lines = await q(sb.from('boq_lines').select('variant_code,qty,unit_price').eq('boq_id', b.id)); totals[b.id] = { c: calc(b, lines), n: lines.length }; }
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>جداول الكميات</h2><span style="flex:1"></span>${edit ? '<button class="btn primary" id="bNew">＋ جدول كميات جديد</button>' : ''}</div>
    ${boqs.length ? `<div class="plist">${boqs.map(b => `<div class="pitem" data-b="${b.id}"><div class="nm">${esc(b.name)} <span class="badge skel">${BOQ_STATUS[b.status]}</span></div><div class="sub">${totals[b.id].n} بند · احتياطي ${b.contingency}% · ضريبة ${b.vat}% · ${dateAr(b.created_at)}</div><div class="tot">${fmt(totals[b.id].c.grand)} ر.س</div></div>`).join('')}</div>` : '<div class="empty-boq">لا توجد جداول كميات لهذا المشروع بعد' + (edit ? ' — أنشئ جدولاً وابدأ باختيار البنود من المرجع' : '') + '</div>'}</div>`;
  $$('[data-b]', t).forEach(el => el.onclick = () => location.hash = `#/project/${p.id}/boq/${el.getAttribute('data-b')}`);
  if (edit) $('#bNew').onclick = () => modal(`<form id="f" class="pgrid">${field('اسم الجدول', inp('name', boqs.length ? 'إصدار ' + (boqs.length + 1) : 'تقديري'))}${field('الحالة', sel('status', Object.entries(BOQ_STATUS), 'draft'))}${field('نسبة الاحتياطي %', inp('contingency', 5, 'type="number" min="0" max="30" step="0.5"'))}${field('ضريبة القيمة المضافة %', inp('vat', 15, 'type="number" min="0" max="20"'))}${boqs.length ? field('نسخ البنود من', sel('copy', [['', '— جدول فارغ —'], ...boqs.map(b => [b.id, b.name])], ''), 'wide') : ''}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إنشاء</button></div></form>`, { title: 'جدول كميات جديد', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { const b = await q(sb.from('boqs').insert({ project_id: p.id, name: f.name, status: f.status, contingency: Number(f.contingency), vat: Number(f.vat), created_by: session.user.id }).select('id').single()); if (f.copy) { const src = await q(sb.from('boq_lines').select('variant_code,qty,loc,unit_price,sort').eq('boq_id', f.copy)); if (src.length) await q(sb.from('boq_lines').insert(src.map(l => ({ ...l, boq_id: b.id })))); } close(); location.hash = `#/project/${p.id}/boq/${b.id}`; } catch (er) { err(er); } };
  } });
}
async function updates(t, p, edit) {
  const ups = await q(sb.from('project_updates').select('*').eq('project_id', p.id).order('happened_on', { ascending: false }).order('id', { ascending: false }));
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>التحديثات والملاحظات</h2><span style="flex:1"></span>${edit ? '<button class="btn primary" id="uNew">＋ تحديث جديد</button>' : ''}</div>
    ${ups.length ? ups.map(u => `<div class="upd"><div class="uh"><span class="badge skel">${UPDATE_KINDS[u.kind] || u.kind}</span> <b>${dateAr(u.happened_on)}</b> <span class="muted">· ${esc(pname(u.created_by))}</span>${u.ref_no ? ` <span class="muted">· مرجع: ${esc(u.ref_no)}</span>` : ''}${u.amount ? ` <span class="muted">· ${money(u.amount)} ر.س</span>` : ''}${(isAdmin() || u.created_by === session.user?.id) ? ` <span class="del" data-du="${u.id}">✕</span>` : ''}</div><div class="ub pre">${esc(u.body)}</div></div>`).join('') : '<p class="muted">لا توجد تحديثات بعد.</p>'}</div>`;
  $$('[data-du]', t).forEach(el => el.onclick = async () => { if (!await confirm('حذف هذا التحديث؟', 'حذف', true)) return; await q(sb.from('project_updates').delete().eq('id', el.getAttribute('data-du'))); updates(t, p, edit); });
  if (edit) $('#uNew').onclick = () => modal(`<form id="f" class="pgrid">${field('النوع', sel('kind', Object.entries(UPDATE_KINDS), 'note'))}${field('التاريخ', inp('happened_on', today(), 'type="date"'))}${field('رقم المرجع / الخطاب (اختياري)', inp('ref_no', ''))}${field('المبلغ (للمستخلصات)', inp('amount', '', 'type="number" min="0" step="1"'))}${field('النص *', `<textarea name="body" rows="4" required></textarea>`, 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تحديث جديد', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('project_updates').insert({ project_id: p.id, kind: f.kind, happened_on: f.happened_on, ref_no: f.ref_no, amount: f.amount ? Number(f.amount) : null, body: f.body.trim(), created_by: session.user.id })); close(); updates(t, p, edit); } catch (er) { err(er); } };
  } });
}
const CH_CATS = ['فني', 'تعاقدي', 'مالي', 'تنظيمي', 'إداري', 'أخرى'], SEV = ['منخفضة', 'متوسطة', 'عالية', 'حرجة'], LIK = ['منخفضة', 'متوسطة', 'عالية'], CH_ST = ['مفتوح', 'قيد المعالجة', 'مغلق'];
const sevBadge = s => `<span class="badge ${s === 'حرجة' ? 'bad' : s === 'عالية' ? 'ovr' : 'skel'}">${esc(s)}</span>`;
async function challenges(t, p, edit) {
  const rows = await q(sb.from('challenges').select('*').eq('project_id', p.id).order('status').order('id', { ascending: false }));
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>التحديات والمخاطر <span class="muted">(${rows.filter(r => r.status !== 'مغلق').length} مفتوح من ${rows.length})</span></h2><span style="flex:1"></span>${edit ? '<button class="btn primary" id="cNew">＋ تحدٍ جديد</button>' : ''}</div>
    ${rows.length ? `<table class="lst"><thead><tr><th>التحدي</th><th>التصنيف</th><th>الخطورة</th><th>الاحتمالية</th><th>الأثر</th><th>الإجراء</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(c => `<tr class="${c.status === 'مغلق' ? 'off' : ''}"><td><b>${esc(c.title)}</b><br><span class="muted">رُصد ${dateAr(c.detected_on)}</span></td><td>${esc(c.category || '')}</td><td>${sevBadge(c.severity)}</td><td>${esc(c.likelihood || '')}</td><td class="muted">${c.impact_days ? c.impact_days + ' يوم' : ''}${c.impact_days && c.impact_amount ? ' · ' : ''}${c.impact_amount ? money(c.impact_amount) + ' ر.س' : ''}</td><td class="muted">${esc(c.action || '')}</td><td>${esc(c.owner || '')}</td><td>${dateAr(c.due_date)}</td><td><span class="badge ${c.status === 'مغلق' ? 'full' : c.status === 'مفتوح' ? 'bad' : 'ovr'}">${esc(c.status)}</span></td>${edit ? `<td><button class="btn sm" data-ce="${c.id}">تعديل</button></td>` : ''}</tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد تحديات مسجلة.</p>'}</div>`;
  const form = c => `<form id="f" class="pgrid">${field('وصف التحدي *', `<textarea name="title" rows="2" required>${esc(c?.title || '')}</textarea>`, 'wide')}${field('التصنيف', sel('category', CH_CATS, c?.category || 'فني'))}${field('درجة الخطورة', sel('severity', SEV, c?.severity || 'متوسطة'))}${field('الاحتمالية', sel('likelihood', LIK, c?.likelihood || 'متوسطة'))}${field('الحالة', sel('status', CH_ST, c?.status || 'مفتوح'))}${field('تأثير زمني (أيام)', inp('impact_days', c?.impact_days ?? '', 'type="number" min="0"'))}${field('تأثير مالي (ر.س)', inp('impact_amount', c?.impact_amount ?? '', 'type="number" min="0"'))}${field('تاريخ الرصد', inp('detected_on', c?.detected_on || today(), 'type="date"'))}${field('الموعد المستهدف', inp('due_date', c?.due_date || '', 'type="date"'))}${field('المسؤول', inp('owner', c?.owner || p.engineer_name || ''))}${field('الإجراء المتخذ', `<textarea name="action" rows="2">${esc(c?.action || '')}</textarea>`, 'wide')}${field('ملاحظات', `<textarea name="notes" rows="2">${esc(c?.notes || '')}</textarea>`, 'wide')}<div class="btnrow end wide">${c ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`;
  const open = c => modal(form(c), { title: c ? 'تعديل التحدي' : 'تحدٍ جديد', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const n = v => v === '' ? null : Number(v);
      const row = { project_id: p.id, title: f.title.trim(), category: f.category, severity: f.severity, likelihood: f.likelihood, status: f.status, impact_days: n(f.impact_days), impact_amount: n(f.impact_amount), detected_on: f.detected_on || null, due_date: f.due_date || null, owner: f.owner.trim(), action: f.action.trim(), notes: f.notes.trim() };
      try { if (c) await q(sb.from('challenges').update(row).eq('id', c.id)); else await q(sb.from('challenges').insert({ ...row, created_by: session.user.id })); close(); challenges(t, p, edit); } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف هذا التحدي؟', 'حذف', true)) return; await q(sb.from('challenges').delete().eq('id', c.id)); close(); challenges(t, p, edit); };
  } });
  if (edit) { $('#cNew').onclick = () => open(null); $$('[data-ce]', t).forEach(b => b.onclick = () => open(rows.find(x => x.id === +b.getAttribute('data-ce')))); }
}
async function stageLog(t, p) {
  const log = await q(sb.from('project_stage_log').select('*').eq('project_id', p.id).order('at', { ascending: false }));
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>سجل المراحل</h2>${log.length ? `<table class="lst"><thead><tr><th>التاريخ</th><th>من</th><th>إلى</th><th>بواسطة</th><th>ملاحظة</th></tr></thead><tbody>${log.map(l => `<tr><td>${dateAr(l.at)}</td><td>${l.from_stage ? stageBadge(l.from_stage) : '—'}</td><td>${stageBadge(l.to_stage)}</td><td>${esc(pname(l.by_user))}</td><td>${esc(l.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">—</p>'}</div>`;
}
async function changeStage(p, done) {
  await modal(`<form id="f" class="pgrid">${field('المرحلة الجديدة', sel('stage', STAGES.map(s => [s.key, s.ar]), p.stage), 'wide')}${field('ملاحظة (اختياري)', `<textarea name="note" rows="2" placeholder="مثال: تم فتح المظاريف بتاريخ… / أُرسي على شركة…"></textarea>`, 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">تحديث المرحلة</button></div></form>`, { title: 'تغيير مرحلة المشروع', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); if (f.stage === p.stage) return close(); try { await q(sb.rpc('set_stage', { p_id: p.id, p_stage: f.stage, p_note: f.note || null })); toast('تم تحديث المرحلة'); close(); done(); } catch (er) { err(er); } };
  } });
}
