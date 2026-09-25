// ===== المشاريع: لوحة المؤشرات، القائمة، بطاقة المشروع =====
import { sb, REF, STAGES, stageOf, PROJECT_TYPES, UPDATE_KINDS, canEdit, isAdmin, role, q, session, today } from './api.js';
import { $, $$, esc, fmt, fmt0, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico } from './ui.js';
import { mountBoq, calc, BOQ_STATUS } from './boq.js';
import { projectTasks, projectRequests } from './tasks.js';
import { projectPayments } from './payments.js';
import { projectTReports } from './treports.js';
import { projectDocs, projectDrawings, projectSubmittals, isOverdue as subLate } from './docs.js';

const CATEGORIES = ['حكومي', 'شراء مباشر', 'شراكة مجتمعية'];
let profiles = [];
async function loadProfiles() { profiles = await q(sb.from('profiles').select('id,full_name,email,role').order('full_name')); return profiles; }
const pname = (id, fallback) => profiles.find(p => p.id === id)?.full_name || fallback || '—';
const stageBadge = k => { const s = stageOf(k); return `<span class="stage" style="background:${s.color}">${esc(s.ar)}</span>`; };

// ---------- لوحة المؤشرات
export async function mountDashboard(root) {
  root.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ التحميل…</div>';
  const me = session.user.id; const admin = isAdmin(); const fin = role() === 'finance';
  const [projects] = await Promise.all([q(sb.from('projects').select('id,name,ref,facility,stage,priority,budget,contract_value,paid_amount,progress_actual,progress_planned,end_date,updated_at,engineer_id,engineer_name,status_note,category').eq('archived', false)), loadProfiles()]);
  const [chs, tasks, reqs, act, pays, subs, docsExp, trs, ups] = await Promise.all([
    q(sb.from('challenges').select('id,project_id,title,severity,status,owner,created_at,projects(name)').neq('status', 'مغلق').order('severity')),
    q(sb.from('tasks').select('id,project_id,title,status,due_date,assignee_id,assignee_name,priority,created_at,projects(name)').in('status', ['open', 'in_progress']).order('due_date', { ascending: true, nullsFirst: false })),
    q(sb.from('requests').select('id,project_id,title,kind,status,priority,created_by,created_at,projects(name)').in('status', ['new', 'in_review']).order('id', { ascending: false })),
    loadActivity(),
    q(sb.from('payments').select('id,project_id,no,status,net_amount,created_by,updated_at,projects(name)').in('status', ['submitted', 'review', 'approved', 'finance'])),
    q(sb.from('submittals').select('id,project_id,no,rev,title,status,due_on,created_by,submitted_on,projects(name,engineer_id)').neq('status', 'decided')),
    q(sb.from('documents').select('id,project_id,category,title,expiry_date,projects(name)').in('category', ['bank_guarantee', 'insurance']).order('expiry_date')),
    q(sb.from('tech_reports').select('id,project_id,kind,title,report_date,created_by,published_at,projects(name)').eq('status', 'published').order('id', { ascending: false })),
    q(sb.from('project_updates').select('id,project_id,kind,body,happened_on,created_by,projects(name)').order('happened_on', { ascending: false }).limit(6)),
  ]);
  const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const exec = projects.filter(p => p.stage === 'execution');
  const late = active.filter(p => p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'));
  const stale = active.filter(p => isStale(p, act));
  const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0);
  const paid = active.reduce((a, p) => a + Number(p.paid_amount || 0), 0);
  const avgA = exec.length ? Math.round(exec.reduce((a, p) => a + Number(p.progress_actual || 0), 0) / exec.length) : 0;
  const avgP = exec.length ? Math.round(exec.reduce((a, p) => a + Number(p.progress_planned || 0), 0) / exec.length) : 0;
  const soonD = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
  const expiring = docsExp.filter(d => d.expiry_date && d.expiry_date <= soonD);
  const lateTasks = tasks.filter(t => t.due_date && t.due_date < today());
  const subsLate = subs.filter(subLate);
  const payPend = pays.filter(r => r.status !== 'finance'), payFin = pays.filter(r => r.status === 'finance');
  const ago = d => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d)) / 864e5); return m <= 0 ? 'اليوم' : m === 1 ? 'أمس' : `منذ ${m} يوم`; };
  // ---- صندوق الإجراءات: ما ينتظر المستخدم الحالي تحديداً
  const inbox = [];
  const push = (cls, ic, title, sub, link, age, act, bad) => inbox.push({ cls, ic, title, sub, link, age, act, bad });
  if (admin) {
    reqs.forEach(r => push('b', 'inbox', `طلب: ${r.title}`, `${r.projects?.name || ''} · ${pname(r.created_by)}`, `#/project/${r.project_id}/requests`, r.created_at, 'الرد'));
    payPend.forEach(r => push('a', 'coins', `مستخلص رقم ${r.no} — ${r.projects?.name || ''}`, `الصافي ${money(Math.round(r.net_amount))} ر.س · ${({ submitted: 'مقدَّم', review: 'قيد المراجعة', approved: 'معتمد — للإحالة' })[r.status]}`, `#/project/${r.project_id}/payments`, r.updated_at, 'اعتماد'));
    subs.filter(s => s.status === 'reviewed').forEach(s => push('b', 'stamp', `SUB-${String(s.no).padStart(3, '0')}${s.rev ? '-R' + s.rev : ''} ${s.title}`, `${s.projects?.name || ''} · راجعه المهندس`, `#/project/${s.project_id}/submittals`, s.submitted_on, 'القرار', subLate(s)));
    trs.forEach(r => push('c', 'file', r.title, `${r.projects?.name || ''} · ${pname(r.created_by)}`, `#/treport/${r.id}`, r.published_at, 'مراجعة'));
    chs.filter(c => ['حرجة', 'عالية'].includes(c.severity)).slice(0, 5).forEach(c => push('d', 'alert', `تحدٍ ${c.severity}: ${c.title}`, c.projects?.name || '', `#/project/${c.project_id}/challenges`, c.created_at, 'عرض'));
  }
  if (fin) payFin.forEach(r => push('a', 'coins', `مستخلص رقم ${r.no} — ${r.projects?.name || ''}`, `الصافي ${money(Math.round(r.net_amount))} ر.س · محال للمالية`, `#/project/${r.project_id}/payments`, r.updated_at, 'تسجيل الصرف'));
  if (!admin) {
    tasks.filter(t => t.assignee_id === me).forEach(t => push(t.due_date && t.due_date < today() ? 'd' : 'e', 'check', t.title, `${t.projects?.name || ''}${t.due_date ? ' · الموعد ' + dateAr(t.due_date) : ''}`, `#/project/${t.project_id}/tasks`, t.created_at, 'تحديث', t.due_date && t.due_date < today()));
    subs.filter(s => s.status === 'submitted' && (s.projects?.engineer_id === me || s.created_by === me)).forEach(s => push('b', 'stamp', `SUB-${String(s.no).padStart(3, '0')} ${s.title}`, `${s.projects?.name || ''} · بانتظار مراجعتك`, `#/project/${s.project_id}/submittals`, s.submitted_on, 'مراجعة', subLate(s)));
  } else {
    lateTasks.slice(0, 5).forEach(t => push('d', 'check', `مهمة متأخرة: ${t.title}`, `${t.projects?.name || ''} · ${pname(t.assignee_id, t.assignee_name)} · ${dateAr(t.due_date)}`, `#/project/${t.project_id}/tasks`, t.due_date, 'متابعة', true));
  }
  expiring.forEach(d => push('a', 'doc', `${d.category === 'bank_guarantee' ? 'ضمان بنكي' : 'وثيقة تأمين'} ${d.expiry_date < today() ? 'منتهية' : 'تنتهي ' + dateAr(d.expiry_date)}`, `${d.projects?.name || ''} · ${d.title}`, `#/project/${d.project_id}/docs`, d.expiry_date, 'عرض', d.expiry_date < today()));
  if (stale.length) push('d', 'clock', `${stale.length} مشاريع بلا أي تحديث منذ ${STALE_DAYS} يوماً`, stale.slice(0, 3).map(p => p.name).join(' · ') + (stale.length > 3 ? ' …' : ''), '#/projects?flag=stale', null, 'عرض');
  const byStage = STAGES.map(s => ({ ...s, n: projects.filter(p => p.stage === s.key).length })).filter(s => s.n);
  const groupsD = [['طلب ودراسة', ['request', 'study', 'approval'], '#8A8A8A'], ['تصميم وطرح', ['design', 'tender', 'award'], '#A98736'], ['تنفيذ', ['execution'], '#27A8DF'], ['استلام وضمان', ['handover', 'warranty'], '#2E8B57'], ['مقفل / موقوف', ['closed', 'onhold', 'cancelled'], '#123B5C']].map(([t, ks, c]) => ({ t, c, n: projects.filter(p => ks.includes(p.stage)).length }));
  let off = 25; const tot = projects.length || 1; const arcs = groupsD.filter(g => g.n).map(g => { const len = g.n / tot * 100; const h = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${g.c}" stroke-width="5" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${off}"/>`; off -= len; return h; }).join('');
  const hour = new Date().getHours(); const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير';
  const first = (session.profile?.full_name || '').split(' ')[0];
  root.innerHTML = `<div class="dash">
    <div class="toolbar"><div><h1 class="pagetitle">${greet}، ${esc(first)}</h1><p class="muted">${new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${inbox.length ? `${inbox.length} إجراء بانتظارك` : 'لا إجراءات معلقة عليك'}</p></div><span style="flex:1"></span><a class="btn" href="#/report">${ico('chart')} التقرير التنفيذي</a>${canEdit() ? `<a class="btn primary" href="#/projects?new=1">${ico('plus')} مشروع جديد</a>` : ''}</div>
    <div class="kpis hero">
      <a class="kpi" href="#/projects"><span>مشاريع قائمة</span><b>${active.length}<small> من ${projects.length}</small></b><span>${projects.filter(p => p.stage === 'closed').length} مستلمة نهائياً</span></a>
      <a class="kpi" href="#/projects?stage=execution"><span>تحت التنفيذ</span><b>${exec.length}<small> متوسط إنجاز ${avgA}%</small></b><span>المخطط ${avgP}% ${avgA < avgP ? `<b class="bad" style="font-size:12px">−${avgP - avgA} نقاط</b>` : ''}</span></a>
      <a class="kpi ${late.length ? 'bad' : ''}" href="#/projects?flag=late"><span>متأخرة / متعثرة</span><b>${late.length}</b><span>${stale.length} بلا تحديث منذ أسبوعين</span></a>
      <a class="kpi" href="#/payments"><span>قيمة المحفظة القائمة</span><b>${totalV >= 1e6 ? (totalV / 1e6).toFixed(1) : money(Math.round(totalV))}<small> ${totalV >= 1e6 ? 'مليون ' : ''}ر.س</small></b><span>صُرف ${totalV ? Math.round(paid / totalV * 100) : 0}% · قيد الاعتماد ${money(Math.round(pays.reduce((a, r) => a + Number(r.net_amount || 0), 0)))}</span></a>
    </div>
    <div class="two">
      <div class="pcard inbox"><h2>بانتظار إجراءك ${inbox.length ? `<span class="badge bad">${inbox.length}</span>` : ''}</h2>${inbox.length ? inbox.slice(0, 12).map(i => `<div class="it"><div class="ic ${i.cls}">${ico(i.ic)}</div><div class="t"><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></div><span class="age ${i.bad ? 'bad' : ''}">${i.bad ? 'متأخر' : ago(i.age)}</span><a class="btn sm ${i.cls === 'a' ? 'primary' : ''}" href="${i.link}">${i.act}</a></div>`).join('') + (inbox.length > 12 ? `<p class="muted small" style="padding-top:8px">و${inbox.length - 12} إجراءات أخرى…</p>` : '') : '<div class="empty-boq">لا يوجد ما ينتظرك الآن 👌</div>'}</div>
      <div class="stack">
        <div class="pcard"><h2>توزيع المراحل</h2><div class="donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--line2)" stroke-width="5"/>${arcs}<text x="21" y="20" text-anchor="middle" font-size="7" font-weight="800" fill="var(--text)" font-family="Tajawal">${projects.length}</text><text x="21" y="26" text-anchor="middle" font-size="3.2" fill="var(--muted)" font-family="Tajawal">مشروعاً</text></svg><div class="leg">${groupsD.map(g => `<div><i style="background:${g.c}"></i>${g.t}<b>${g.n}</b></div>`).join('')}</div></div>
          <div class="stagebar" style="margin-top:12px">${byStage.map(s => `<a class="stagecell" href="#/projects?stage=${s.key}" style="border-top-color:${s.color}"><b>${s.n}</b><span>${esc(s.ar)}</span></a>`).join('')}</div></div>
        <div class="pcard"><h2>المهام والطلبات</h2><div class="kvs" style="grid-template-columns:1fr"><div class="kv"><span>مهام مفتوحة</span><b><a href="#/tasks">${tasks.length}</a>${lateTasks.length ? ` <span class="badge bad">${lateTasks.length} متأخرة</span>` : ''}</b></div><div class="kv"><span>طلبات بانتظار الرد</span><b><a href="#/requests">${reqs.length}</a></b></div><div class="kv"><span>اعتمادات قيد الإجراء</span><b><a href="#/submittals">${subs.length}</a>${subsLate.length ? ` <span class="badge bad">${subsLate.length} متأخرة</span>` : ''}</b></div><div class="kv"><span>تقارير بانتظار المراجعة</span><b><a href="#/treports">${trs.length}</a></b></div><div class="kv"><span>مستخلصات قيد الاعتماد / لدى المالية</span><b><a href="#/payments">${payPend.length} / ${payFin.length}</a></b></div><div class="kv"><span>تحديات مفتوحة</span><b>${chs.length}</b></div></div></div>
      </div>
    </div>
    <div class="pcard"><h2>المشاريع تحت التنفيذ <span class="badge skel">${exec.length}</span><a class="small" href="#/projects">كل المشاريع</a></h2>${exec.length ? `<div style="overflow:auto"><table class="lst"><thead><tr><th>المشروع</th><th>مدير المشروع</th><th>الإنجاز</th><th class="c">قيمة العقد</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>${exec.sort((a, b) => Number(b.contract_value || 0) - Number(a.contract_value || 0)).map(p => { const l = late.includes(p); const pa = Number(p.progress_actual || 0), pp = Number(p.progress_planned || 0); return `<tr data-open="${p.id}"><td><b>${esc(p.name)}</b><br><span class="muted small">${esc(p.category || '')}${p.type ? ' · ' + esc(p.type) : ''}${p.facility ? ' · ' + esc(p.facility) : ''}</span></td><td>${esc(pname(p.engineer_id, p.engineer_name))}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="bar ${l ? 'bad' : pa < pp - 5 ? 'warn' : ''}" style="flex:1;min-width:80px"><i style="width:${pa}%;${l ? 'background:var(--red)' : pa < pp - 5 ? 'background:var(--gold)' : ''}"></i></div><b class="num">${pa}%</b><small class="muted">/ ${pp}%</small></div></td><td class="c n">${money(p.contract_value)}</td><td class="${l ? 'bad' : ''}">${dateAr(p.end_date)}</td><td>${p.status_note ? `<span class="badge bad">${esc(p.status_note)}</span>` : l ? '<span class="badge bad">متأخر</span>' : isStale(p, act) ? '<span class="badge ovr">بلا تحديث</span>' : '<span class="badge full">منتظم</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-boq">لا توجد مشاريع تحت التنفيذ حالياً</div>'}</div>
    <div class="two">
      <div class="pcard"><h2>آخر المستجدات</h2>${ups.length ? `<div class="tl">${ups.map(u => `<div class="e"><i>${({ visit: '📍', issue: '⚠', payment: '💰', letter: '✉', milestone: '★' })[u.kind] || '•'}</i><div><b><a href="#/project/${u.project_id}/updates">${esc(u.projects?.name || '')}</a></b><small>${esc(u.body)} — ${dateAr(u.happened_on)}${u.created_by ? ' · ' + esc(pname(u.created_by)) : ''}</small></div></div>`).join('')}</div>` : '<p class="muted">لا توجد تحديثات بعد.</p>'}</div>
      <div class="pcard"><h2>المحفظة حسب الفئة</h2><div style="overflow:auto"><table class="lst"><thead><tr><th>الفئة</th><th class="c">عدد</th><th class="c">قيمة العقود</th><th class="c">الصرف</th><th class="c">متأخرة</th></tr></thead><tbody>${['حكومي', 'شراء مباشر', 'شراكة مجتمعية'].map(cat => { const ps = active.filter(p => p.category === cat); const v = ps.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), pd = ps.reduce((a, p) => a + Number(p.paid_amount || 0), 0); return `<tr><td><b>${cat}</b></td><td class="c">${ps.length}</td><td class="c n">${money(Math.round(v))}</td><td class="c">${v ? Math.round(pd / v * 100) : 0}%</td><td class="c ${ps.filter(p => late.includes(p)).length ? 'bad' : ''}">${ps.filter(p => late.includes(p)).length}</td></tr>`; }).join('')}</tbody></table></div></div>
    </div></div>`;
  $$('[data-open]', root).forEach(tr => tr.onclick = () => location.hash = '#/project/' + tr.getAttribute('data-open'));
  try { const { setCounts } = await import('./app.js'); setCounts({ tasks: admin ? lateTasks.length : tasks.filter(t => t.assignee_id === me).length, requests: admin ? reqs.length : 0, submittals: admin ? subs.filter(s => s.status === 'reviewed').length : subs.filter(s => s.status === 'submitted' && s.projects?.engineer_id === me).length, treports: admin ? trs.length : 0, payments: admin ? payPend.length : fin ? payFin.length : 0 }); } catch (e) { }
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
  if (edit && params.get('new')) { history.replaceState(null, '', '#/projects'); editProject(null, id => location.hash = '#/project/' + id); }
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
  const TG = [['overview', 'نظرة عامة', 'dash', [['overview', 'الملخص']]], ['follow', 'المتابعة', 'check', [['tasks', 'المهام'], ['requests', 'الطلبات'], ['challenges', 'التحديات والمخاطر'], ['updates', 'التحديثات والملاحظات'], ['log', 'سجل المراحل']]], ['fin', 'المالية', 'coins', [['boq', 'جداول الكميات'], ['payments', 'المستخلصات']]], ['docs', 'المستندات', 'doc', [['docs', 'المستندات الرسمية'], ['drawings', 'المخططات'], ['submittals', 'الاعتمادات'], ['treports', 'التقارير الفنية والمحاضر']]]];
  const grp = TG.find(g => g[3].some(x => x[0] === tab)) || TG[0];
  const act0 = await loadActivity();
  root.innerHTML = `<div class="phead">
    <div class="crumb"><a href="#/projects">المشاريع</a><span class="sep">›</span><a href="#/projects?g=${groupOf(p)}">${({ gov: 'الحكومية', partner: 'الشراكة المجتمعية', study: 'تحت الدراسة' })[groupOf(p)]}</a><span class="sep">›</span><span>${esc(p.name)}</span></div>
    <div class="ptitle"><div><h1>${esc(p.name)}</h1><div class="muted small" style="display:flex;flex-wrap:wrap;gap:4px 14px">${p.ref ? `<span class="ltr">${esc(p.ref)}</span>` : ''}<span>${esc(p.category || '')}${p.type ? ' · ' + esc(p.type) : ''}</span>${p.facility ? `<span>${esc(p.facility)}</span>` : ''}<span>مدير المشروع: ${esc(p.engineer_name)}</span>${p.contractor ? `<span>المقاول: ${esc(p.contractor)}</span>` : ''}</div></div>
      <div class="btnrow">${stageBadge(p.stage)}${p.status_note ? `<span class="badge bad">${esc(p.status_note)}</span>` : ''}${isStale(p, act0) ? '<span class="badge ovr">بلا تحديث منذ أسبوعين</span>' : ''}<a class="btn" href="#/report/custom?p=${id}">${ico('file')} تقرير المشروع</a>${edit ? `<button class="btn" id="pStage">تغيير المرحلة</button><button class="btn primary" id="pEdit">${ico('edit')} تعديل البيانات</button>` : ''}${isAdmin() ? `<button class="btn ${p.archived ? '' : 'danger'}" id="pArch">${p.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>` : ''}</div></div>
    <div class="stageline">${STAGES.filter(s => !['onhold', 'cancelled'].includes(s.key)).map((s, i) => { const idx = STAGES.findIndex(x => x.key === p.stage); const done = i < idx, cur = s.key === p.stage; return `<div class="sl ${done ? 'done' : ''} ${cur ? 'cur' : ''}" style="${cur ? '--c:' + s.color : ''}"><i></i><span>${esc(s.ar)}</span></div>`; }).join('')}</div>
    <div class="tabs">${TG.map(g => `<a href="#/project/${id}/${g[3][0][0]}" class="${grp === g ? 'on' : ''}">${ico(g[2])} ${g[1]}</a>`).join('')}</div>
    ${grp[3].length > 1 ? `<div class="subtabs">${grp[3].map(([k, t]) => `<a href="#/project/${id}/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div>` : ''}</div><div id="ptab"></div>`;
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
  else if (tab === 'docs') projectDocs(t, p);
  else if (tab === 'drawings') projectDrawings(t, p);
  else if (tab === 'submittals') projectSubmittals(t, p);
  else if (tab === 'updates') updates(t, p, edit);
  else if (tab === 'log') stageLog(t, p);
}
async function overview(t, p, edit) {
  const V = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const cv = Number(p.contract_value || 0), paid = Number(p.paid_amount || 0);
  const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date) - new Date()) / 864e5) : null;
  const pa = Number(p.progress_actual || 0), pp = Number(p.progress_planned || 0);
  const late = p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution');
  const [tasks, reqs, chs, pays, subs, docs, ups, log, trs] = await Promise.all([
    q(sb.from('tasks').select('id,title,status,due_date,assignee_id,assignee_name').eq('project_id', p.id).in('status', ['open', 'in_progress'])),
    q(sb.from('requests').select('id,title,status').eq('project_id', p.id).in('status', ['new', 'in_review'])),
    q(sb.from('challenges').select('id,title,severity,status').eq('project_id', p.id).neq('status', 'مغلق')),
    q(sb.from('payments').select('id,no,status,net_amount,retention_amount,work_amount,kind').eq('project_id', p.id)),
    q(sb.from('submittals').select('id,no,rev,title,status,due_on').eq('project_id', p.id).neq('status', 'decided')),
    q(sb.from('documents').select('id,category,title,expiry_date').eq('project_id', p.id)),
    q(sb.from('project_updates').select('id,kind,body,happened_on,created_by').eq('project_id', p.id).order('happened_on', { ascending: false }).limit(5)),
    q(sb.from('project_stage_log').select('id,from_stage,to_stage,at,note').eq('project_id', p.id).order('at', { ascending: false }).limit(3)),
    q(sb.from('tech_reports').select('id,title,kind,report_date,status').eq('project_id', p.id).order('id', { ascending: false }).limit(3)),
  ]);
  const soonD = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
  const att = [];
  if (late) att.push(['d', 'alert', p.status_note ? `المشروع ${p.status_note}` : `تجاوز موعد الانتهاء بـ${-daysLeft} يوماً`, 'راجع الجدول الزمني والتحديات', `#/project/${p.id}/challenges`]);
  if (p.stage === 'execution' && pa < pp - 5) att.push(['a', 'chart', `الإنجاز الفعلي أقل من المخطط بـ${pp - pa} نقاط`, `فعلي ${pa}% مقابل مخطط ${pp}%`, `#/project/${p.id}/updates`]);
  docs.filter(d => ['bank_guarantee', 'insurance'].includes(d.category) && d.expiry_date && d.expiry_date <= soonD).forEach(d => att.push(['a', 'doc', `${d.category === 'bank_guarantee' ? 'الضمان البنكي' : 'وثيقة التأمين'} ${d.expiry_date < today() ? 'منتهية' : 'تنتهي ' + dateAr(d.expiry_date)}`, d.title, `#/project/${p.id}/docs`]));
  if (['execution', 'handover', 'warranty'].includes(p.stage)) { const miss = ['contract', 'site_handover', 'bank_guarantee', 'insurance'].filter(c => !docs.some(d => d.category === c)); if (miss.length) att.push(['a', 'doc', `${miss.length} مستندات أساسية ناقصة`, miss.map(c => ({ contract: 'العقد', site_handover: 'محضر تسليم الموقع', bank_guarantee: 'الضمان البنكي', insurance: 'التأمين' })[c]).join('، '), `#/project/${p.id}/docs`]); }
  const subsW = subs.filter(x => x.status === 'reviewed'); if (subsW.length) att.push(['b', 'stamp', `${subsW.length} اعتماد بانتظار قرار الإدارة`, subsW.map(x => 'SUB-' + String(x.no).padStart(3, '0')).join('، '), `#/project/${p.id}/submittals`]);
  const subsL = subs.filter(subLate); if (subsL.length) att.push(['d', 'stamp', `${subsL.length} اعتماد تجاوز موعد الرد`, '', `#/project/${p.id}/submittals`]);
  const payW = pays.filter(x => ['submitted', 'review', 'approved', 'finance'].includes(x.status)); if (payW.length) att.push(['a', 'coins', `${payW.length} مستخلص قيد الاعتماد / لدى المالية`, money(Math.round(payW.reduce((a, x) => a + Number(x.net_amount || 0), 0))) + ' ر.س', `#/project/${p.id}/payments`]);
  const lateT = tasks.filter(x => x.due_date && x.due_date < today()); if (lateT.length) att.push(['d', 'check', `${lateT.length} مهمة متأخرة`, lateT.map(x => x.title).slice(0, 2).join('، '), `#/project/${p.id}/tasks`]);
  if (reqs.length) att.push(['b', 'inbox', `${reqs.length} طلب بانتظار رد الإدارة`, '', `#/project/${p.id}/requests`]);
  chs.filter(c => ['حرجة', 'عالية'].includes(c.severity)).forEach(c => att.push(['d', 'alert', `تحدٍ ${c.severity}: ${c.title}`, '', `#/project/${p.id}/challenges`]));
  const retention = pays.filter(x => ['approved', 'finance', 'paid'].includes(x.status)).reduce((a, x) => a + Number(x.retention_amount || 0), 0);
  const timeline = [...ups.map(u => ({ at: u.happened_on, ic: ({ visit: '📍', issue: '⚠', payment: '💰', letter: '✉', milestone: '★' })[u.kind] || '•', t: u.body, s: `${UPDATE_KINDS[u.kind] || ''} · ${dateAr(u.happened_on)} · ${pname(u.created_by)}`, l: `#/project/${p.id}/updates` })), ...log.map(l => ({ at: l.at, ic: '🚩', t: `انتقل إلى مرحلة ${stageOf(l.to_stage).ar}`, s: `${dateAr(l.at)}${l.note ? ' · ' + l.note : ''}`, l: `#/project/${p.id}/log` })), ...trs.map(r => ({ at: r.report_date, ic: '📋', t: r.title, s: dateAr(r.report_date), l: `#/treport/${r.id}` }))].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 7);
  t.innerHTML = `<div class="g3">
    <div class="stack">
      <div class="pcard"><h2>العقد والتنفيذ</h2><div class="kvs">${V('إجمالي قيمة العقد', money(p.contract_value) + ' ر.س')}${V('الميزانية المعتمدة', money(p.budget_approved) + ' ر.س')}${V('الميزانية التقديرية', money(p.budget) + ' ر.س')}${V('الإضافي على العقد', money(p.contract_extra) + ' ر.س')}${V('المباشرة', dateAr(p.start_date))}${V('الانتهاء التعاقدي', dateAr(p.end_date) + (daysLeft !== null && p.stage === 'execution' ? ` <small class="${daysLeft < 0 ? 'bad' : 'muted'}">(${daysLeft < 0 ? 'متأخر ' + (-daysLeft) : 'متبقٍ ' + daysLeft} يوم)</small>` : ''))}${V('المدة الإضافية / الانتهاء المعدّل', `${p.extra_days || 0} يوم / ${dateAr(p.revised_end_date)}`)}${V('الرفع للطرح / الطرح / الترسية', `${dateAr(p.tender_submit_date)} / ${dateAr(p.tender_date)} / ${dateAr(p.award_date)}`)}</div>
        ${p.stage === 'execution' || pa || pp ? `<div style="margin-top:12px"><div style="display:flex;align-items:center;gap:10px;font-size:12.5px"><span class="muted" style="width:60px">الفعلي</span><div class="bar ${late ? 'bad' : pa < pp - 5 ? 'warn' : ''}" style="flex:1"><i style="width:${pa}%;${late ? 'background:var(--red)' : pa < pp - 5 ? 'background:var(--gold)' : ''}"></i></div><b class="num" style="width:40px;text-align:left">${pa}%</b></div><div style="display:flex;align-items:center;gap:10px;font-size:12.5px;margin-top:6px"><span class="muted" style="width:60px">المخطط</span><div class="bar" style="flex:1"><i style="width:${pp}%;background:var(--faint)"></i></div><b class="num" style="width:40px;text-align:left">${pp}%</b></div></div>` : ''}</div>
      <div class="pcard"><h2>البيانات الأساسية</h2><div class="kvs">${V('رقم المشروع', esc(p.ref || '—'))}${V('الفئة / النوع', esc((p.category || '—') + ' / ' + (p.type || '—')))}${V('المنشأة', esc(p.facility || '—'))}${V('الجهة المستفيدة', esc(p.beneficiary || '—'))}${V('البرنامج المالي', esc(p.funding || '—'))}${V('الأولوية', { low: 'منخفضة', normal: 'عادية', high: 'مهمة', urgent: 'عاجلة' }[p.priority] || '—')}${V('المقاول', esc(p.contractor || '—'))}${V('الاستشاري', esc(p.consultant || '—'))}</div>${p.justification ? `<h3 class="sub">المبرر</h3><p class="pre">${esc(p.justification)}</p>` : ''}${p.notes ? `<h3 class="sub">نطاق العمل / ملاحظات</h3><p class="pre">${esc(p.notes)}</p>` : ''}</div>
      <div class="pcard"><h2>آخر النشاط<a class="small" href="#/project/${p.id}/updates">كل التحديثات</a></h2>${timeline.length ? `<div class="tl">${timeline.map(x => `<div class="e"><i>${x.ic}</i><div><b><a href="${x.l}" style="color:inherit">${esc(x.t)}</a></b><small>${esc(x.s)}</small></div></div>`).join('')}</div>` : '<p class="muted">لا يوجد نشاط مسجل بعد.</p>'}</div>
    </div>
    <div class="stack">
      <div class="pcard fincard"><div class="row"><span class="muted">المصروف حتى الآن</span>${cv ? `<span class="badge ${paid / cv > (pa / 100) + .1 && p.stage === 'execution' ? 'ovr' : 'full'}">${Math.round(paid / cv * 100)}%</span>` : ''}</div><div class="big num">${money(Math.round(paid))} <small>ر.س</small></div>${cv ? `<div class="bar"><i style="width:${Math.min(100, Math.round(paid / cv * 100))}%"></i></div>` : ''}<div class="row"><span>المتبقي من العقد</span><b class="num">${cv ? money(Math.round(cv - paid)) : '—'}</b></div><div class="row"><span>مستخلصات مصروفة</span><b class="num">${pays.filter(x => x.status === 'paid').length}</b></div><div class="row"><span>قيد الاعتماد</span><b class="num ${payW.length ? 'bad' : ''}">${money(Math.round(payW.reduce((a, x) => a + Number(x.net_amount || 0), 0)))}</b></div><div class="row"><span>ضمان محتجز</span><b class="num">${money(Math.round(retention))}</b></div><div class="btnrow end" style="margin-top:4px"><a class="btn sm" href="#/project/${p.id}/payments">المستخلصات ›</a></div></div>
      <div class="pcard inbox"><h2>يحتاج انتباهاً ${att.length ? `<span class="badge ${att.some(a => a[0] === 'd') ? 'bad' : 'ovr'}">${att.length}</span>` : ''}</h2>${att.length ? att.map(a => `<a class="it" href="${a[4]}" style="color:inherit;text-decoration:none"><div class="ic ${a[0]}">${ico(a[1])}</div><div class="t"><b>${esc(a[2])}</b>${a[3] ? `<small>${esc(a[3])}</small>` : ''}</div></a>`).join('') : '<p class="muted">لا شيء يستدعي الانتباه حالياً.</p>'}</div>
      <div class="pcard"><h2>المتابعة</h2><div class="kvs" style="grid-template-columns:1fr">${V('مهام مفتوحة', `<a href="#/project/${p.id}/tasks">${tasks.length}</a>`)}${V('طلبات معلقة', `<a href="#/project/${p.id}/requests">${reqs.length}</a>`)}${V('تحديات مفتوحة', `<a href="#/project/${p.id}/challenges">${chs.length}</a>`)}${V('اعتمادات قيد الإجراء', `<a href="#/project/${p.id}/submittals">${subs.length}</a>`)}${V('مستندات مسجلة', `<a href="#/project/${p.id}/docs">${docs.length}</a>`)}</div></div>
    </div></div>`;
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
