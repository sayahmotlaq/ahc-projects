// ===== المشاريع: لوحة المؤشرات، القائمة، بطاقة المشروع =====
import { sb, REF, STAGES, stageOf, PROJECT_TYPES, UPDATE_KINDS, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, fmt, fmt0, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';
import { mountBoq, calc, BOQ_STATUS } from './boq.js';

let profiles = [];
async function loadProfiles() { profiles = await q(sb.from('profiles').select('id,full_name,email,role').order('full_name')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';
const stageBadge = k => { const s = stageOf(k); return `<span class="stage" style="background:${s.color}">${esc(s.ar)}</span>`; };

// ---------- لوحة المؤشرات
export async function mountDashboard(root) {
  root.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
  const [projects] = await Promise.all([q(sb.from('projects').select('id,name,ref,facility,stage,priority,budget,contract_value,progress_actual,progress_planned,end_date,updated_at,engineer_id').eq('archived', false)), loadProfiles()]);
  const byStage = {}; STAGES.forEach(s => byStage[s.key] = { n: 0, v: 0 });
  projects.forEach(p => { const b = byStage[p.stage] || (byStage[p.stage] = { n: 0, v: 0 }); b.n++; b.v += Number(p.contract_value || p.budget || 0); });
  const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const late = active.filter(p => p.end_date && p.end_date < today() && p.stage === 'execution');
  const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0);
  const exec = projects.filter(p => p.stage === 'execution');
  root.innerHTML = `<div class="dash">
    <div class="kpis"><div class="kpi"><b>${projects.length}</b><span>إجمالي المشاريع</span></div><div class="kpi"><b>${active.length}</b><span>مشاريع قائمة</span></div><div class="kpi"><b>${exec.length}</b><span>تحت التنفيذ</span></div><div class="kpi ${late.length ? 'bad' : ''}"><b>${late.length}</b><span>متأخرة عن موعدها</span></div><div class="kpi"><b>${totalV >= 1e6 ? (totalV / 1e6).toFixed(1) + '<small> مليون</small>' : fmt0(totalV)}</b><span>القيمة الإجمالية (ر.س)</span></div></div>
    <div class="pcard"><h2><span class="ic"></span>المشاريع حسب المرحلة</h2><div class="stagebar">${STAGES.map(s => `<a class="stagecell" href="#/projects?stage=${s.key}" style="border-top-color:${s.color}"><b>${byStage[s.key].n}</b><span>${esc(s.ar)}</span><small>${money(Math.round(byStage[s.key].v))}</small></a>`).join('')}</div></div>
    <div class="two">
      <div class="pcard"><h2><span class="ic"></span>تحت التنفيذ</h2>${exec.length ? `<table class="lst"><thead><tr><th>المشروع</th><th>المهندس</th><th class="c">مخطط</th><th class="c">فعلي</th><th>الانتهاء</th></tr></thead><tbody>${exec.map(p => `<tr data-open="${p.id}"><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.facility || '')}</span></td><td>${esc(pname(p.engineer_id))}</td><td class="c">${p.progress_planned || 0}%</td><td class="c"><div class="bar"><i style="width:${p.progress_actual || 0}%"></i></div>${p.progress_actual || 0}%</td><td class="${p.end_date && p.end_date < today() ? 'bad' : ''}">${dateAr(p.end_date)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد مشاريع تحت التنفيذ حالياً.</p>'}</div>
      <div class="pcard"><h2><span class="ic"></span>آخر التحديثات</h2><div id="recent"><p class="muted">…</p></div></div>
    </div></div>`;
  $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open'));
  const ups = await q(sb.from('project_updates').select('id,project_id,kind,body,happened_on,created_by,projects(name)').order('created_at', { ascending: false }).limit(8));
  $('#recent').innerHTML = ups.length ? ups.map(u => `<div class="upd"><div class="uh"><span class="badge skel">${UPDATE_KINDS[u.kind] || u.kind}</span> <a href="#/project/${u.project_id}">${esc(u.projects?.name || '')}</a> <span class="muted">· ${esc(pname(u.created_by))} · ${dateAr(u.happened_on)}</span></div><div class="ub">${esc(u.body)}</div></div>`).join('') : '<p class="muted">لا توجد تحديثات بعد.</p>';
}

// ---------- القائمة
export async function mountProjects(root, params) {
  const edit = canEdit();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">المشاريع</h1><span style="flex:1"></span>${edit ? '<button class="btn primary" id="pNew">＋ مشروع جديد</button>' : ''}</div>
    <div class="filters"><input id="fq" placeholder="بحث بالاسم أو الرقم أو المنشأة…"><select id="fStage"><option value="">كل المراحل</option>${STAGES.map(s => `<option value="${s.key}" ${params.get('stage') === s.key ? 'selected' : ''}>${esc(s.ar)}</option>`).join('')}</select><select id="fEng"><option value="">كل المهندسين</option></select><label class="chk"><input type="checkbox" id="fArch"> عرض المؤرشفة</label></div>
    <div id="plist"><p class="muted">جارٍ التحميل…</p></div>`;
  await loadProfiles();
  $('#fEng').innerHTML += profiles.filter(p => ['admin', 'engineer'].includes(p.role)).map(p => `<option value="${p.id}">${esc(p.full_name)}</option>`).join('');
  let all = [];
  async function load() { all = await q(sb.from('projects').select('*').order('updated_at', { ascending: false })); render(); }
  function render() {
    const qs = ($('#fq').value || '').toLowerCase(), st = $('#fStage').value, en = $('#fEng').value, arch = $('#fArch').checked;
    const rows = all.filter(p => (arch || !p.archived) && (!st || p.stage === st) && (!en || p.engineer_id === en) && (!qs || [p.name, p.ref, p.facility, p.contractor].join(' ').toLowerCase().includes(qs)));
    $('#plist').innerHTML = rows.length ? `<table class="lst"><thead><tr><th>الرقم</th><th>المشروع</th><th>المنشأة</th><th>النوع</th><th>المرحلة</th><th>المهندس</th><th class="c">القيمة (ر.س)</th><th class="c">الإنجاز</th><th>آخر تحديث</th></tr></thead><tbody>${rows.map(p => `<tr data-open="${p.id}" class="${p.archived ? 'off' : ''}"><td class="cd">${esc(p.ref || '—')}</td><td><b>${esc(p.name)}</b>${p.priority === 'urgent' ? ' <span class="badge bad">عاجل</span>' : p.priority === 'high' ? ' <span class="badge ovr">مهم</span>' : ''}</td><td>${esc(p.facility || '—')}</td><td>${esc(p.type || '—')}</td><td>${stageBadge(p.stage)}</td><td>${esc(pname(p.engineer_id))}</td><td class="c n">${money(p.contract_value || p.budget)}</td><td class="c">${p.stage === 'execution' ? `<div class="bar"><i style="width:${p.progress_actual || 0}%"></i></div>${p.progress_actual || 0}%` : '—'}</td><td>${dateAr(p.updated_at)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-boq">لا توجد مشاريع مطابقة</div>';
    $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open'));
  }
  ['fq', 'fStage', 'fEng', 'fArch'].forEach(id => $('#' + id).oninput = render);
  if (edit) $('#pNew').onclick = () => editProject(null, id => location.hash = '#/project/' + id);
  await load();
}

async function editProject(p, done) {
  const isNew = !p; await loadProfiles();
  const engs = [['', '—'], ...profiles.filter(x => ['admin', 'engineer'].includes(x.role)).map(x => [x.id, x.full_name])];
  const html = `<form id="f" class="pgrid">
    ${field('اسم المشروع *', inp('name', p?.name || '', 'required'), 'wide')}
    ${field('رقم المشروع / المرجع', inp('ref', p?.ref || '', 'placeholder="AHC-PRJ-2026-001"'))}
    ${field('نوع المشروع', sel('type', PROJECT_TYPES, p?.type || PROJECT_TYPES[0]))}
    ${field('المنشأة / الموقع', inp('facility', p?.facility || ''))}
    ${field('الجهة الطالبة', inp('dept', p?.dept || ''))}
    ${field('المهندس المسؤول', sel('engineer_id', engs, p?.engineer_id || session.user.id))}
    ${field('الأولوية', sel('priority', [['low', 'منخفضة'], ['normal', 'عادية'], ['high', 'مهمة'], ['urgent', 'عاجلة']], p?.priority || 'normal'))}
    ${field('الميزانية التقديرية (ر.س)', inp('budget', p?.budget || '', 'type="number" min="0" step="1"'))}
    ${field('قيمة العقد (ر.س)', inp('contract_value', p?.contract_value || '', 'type="number" min="0" step="1"'))}
    ${field('المقاول', inp('contractor', p?.contractor || ''))}
    ${field('الاستشاري / المشرف', inp('consultant', p?.consultant || ''))}
    ${field('تاريخ المباشرة', inp('start_date', p?.start_date || '', 'type="date"'))}
    ${field('تاريخ الانتهاء التعاقدي', inp('end_date', p?.end_date || '', 'type="date"'))}
    ${field('الإنجاز المخطط %', inp('progress_planned', p?.progress_planned ?? 0, 'type="number" min="0" max="100" step="1"'))}
    ${field('الإنجاز الفعلي %', inp('progress_actual', p?.progress_actual ?? 0, 'type="number" min="0" max="100" step="1"'))}
    ${field('المدفوع حتى الآن (ر.س)', inp('paid_amount', p?.paid_amount ?? 0, 'type="number" min="0" step="1"'))}
    ${field('نطاق العمل / ملاحظات', `<textarea name="notes" rows="3">${esc(p?.notes || '')}</textarea>`, 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`;
  await modal(html, { title: isNew ? 'مشروع جديد' : 'تعديل بيانات المشروع', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const num = v => v === '' ? null : Number(v);
      const row = { name: f.name.trim(), ref: f.ref.trim(), type: f.type, facility: f.facility.trim(), dept: f.dept.trim(), engineer_id: f.engineer_id || null, priority: f.priority, budget: num(f.budget), contract_value: num(f.contract_value), contractor: f.contractor.trim(), consultant: f.consultant.trim(), start_date: f.start_date || null, end_date: f.end_date || null, progress_planned: num(f.progress_planned) || 0, progress_actual: num(f.progress_actual) || 0, paid_amount: num(f.paid_amount) || 0, notes: f.notes };
      try { let id = p?.id; if (isNew) { row.created_by = session.user.id; const r = await q(sb.from('projects').insert(row).select('id').single()); id = r.id; await sb.from('project_stage_log').insert({ project_id: id, from_stage: null, to_stage: 'request', note: 'إنشاء المشروع', by_user: session.user.id }); } else await q(sb.from('projects').update(row).eq('id', p.id)); toast('تم الحفظ'); close(); done && done(id); } catch (er) { err(er); } };
  } });
}

// ---------- بطاقة المشروع
export async function mountProject(root, id, tab = 'overview', sub) {
  const edit = canEdit();
  await loadProfiles();
  const p = await q(sb.from('projects').select('*').eq('id', id).maybeSingle());
  if (!p) { root.innerHTML = '<div class="empty-boq">المشروع غير موجود</div>'; return; }
  p.engineer_name = pname(p.engineer_id);
  if (tab === 'boq' && sub) { return mountBoq(root, sub, p, () => location.hash = `#/project/${id}/boq`); }
  const st = stageOf(p.stage);
  const tabs = [['overview', 'نظرة عامة'], ['boq', 'جداول الكميات'], ['updates', 'التحديثات والملاحظات'], ['log', 'سجل المراحل']];
  root.innerHTML = `<div class="phead">
    <div class="crumb"><a href="#/projects">المشاريع</a><span class="sep">›</span><span>${esc(p.name)}</span></div>
    <div class="ptitle"><div><h1>${esc(p.name)}</h1><div class="muted">${esc(p.ref || '')} ${p.ref ? '·' : ''} ${esc(p.facility || '')} · ${esc(p.type || '')} · المهندس: ${esc(p.engineer_name)}</div></div>
      <div class="btnrow">${stageBadge(p.stage)}${edit ? `<button class="btn primary" id="pStage">تغيير المرحلة</button><button class="btn" id="pEdit">تعديل البيانات</button>` : ''}${isAdmin() ? `<button class="btn ${p.archived ? '' : 'danger'}" id="pArch">${p.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>` : ''}</div></div>
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
  else if (tab === 'updates') updates(t, p, edit);
  else if (tab === 'log') stageLog(t, p);
}
function overview(t, p, edit) {
  const V = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const remaining = Number(p.contract_value || 0) - Number(p.paid_amount || 0);
  const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date) - new Date()) / 864e5) : null;
  t.innerHTML = `<div class="two">
    <div class="pcard"><h2><span class="ic"></span>البيانات الأساسية</h2><div class="kvs">${V('رقم المشروع', esc(p.ref || '—'))}${V('النوع', esc(p.type || '—'))}${V('المنشأة', esc(p.facility || '—'))}${V('الجهة الطالبة', esc(p.dept || '—'))}${V('الأولوية', { low: 'منخفضة', normal: 'عادية', high: 'مهمة', urgent: 'عاجلة' }[p.priority] || '—')}${V('تاريخ الإنشاء', dateAr(p.created_at))}</div>
      ${p.notes ? `<h3 class="sub">نطاق العمل / ملاحظات</h3><p class="pre">${esc(p.notes)}</p>` : ''}</div>
    <div class="pcard"><h2><span class="ic"></span>العقد والتنفيذ</h2><div class="kvs">${V('الميزانية التقديرية', money(p.budget) + ' ر.س')}${V('قيمة العقد', money(p.contract_value) + ' ر.س')}${V('المقاول', esc(p.contractor || '—'))}${V('الاستشاري', esc(p.consultant || '—'))}${V('المباشرة', dateAr(p.start_date))}${V('الانتهاء التعاقدي', dateAr(p.end_date) + (daysLeft !== null && p.stage === 'execution' ? ` <small class="${daysLeft < 0 ? 'bad' : 'muted'}">(${daysLeft < 0 ? 'متأخر ' + (-daysLeft) : 'متبقٍ ' + daysLeft} يوم)</small>` : ''))}${V('المدفوع', money(p.paid_amount) + ' ر.س')}${V('المتبقي من العقد', (p.contract_value ? money(remaining) : '—') + ' ر.س')}</div>
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
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('project_updates').insert({ project_id: p.id, kind: f.kind, happened_on: f.happened_on, ref_no: f.ref_no, amount: f.amount ? Number(f.amount) : null, body: f.body.trim(), created_by: session.user.id })); if (f.kind === 'payment' && f.amount) { await q(sb.from('projects').update({ paid_amount: Number(p.paid_amount || 0) + Number(f.amount) }).eq('id', p.id)); p.paid_amount = Number(p.paid_amount || 0) + Number(f.amount); } close(); updates(t, p, edit); } catch (er) { err(er); } };
  } });
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
