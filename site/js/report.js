// ===== التقارير: التقرير التنفيذي العام + التقرير المخصص =====
import { sb, STAGES, stageOf, q, session, today } from './api.js';
import { $, $$, esc, fmt, fmt0, money, dateAr, toast, err, ico } from './ui.js';
import { groupOf, isStale, loadActivity, STALE_DAYS } from './projects.js';
import { P_STATUS, P_KIND } from './payments.js';

const R_KIND = { approval: 'اعتماد', review: 'مراجعة', decision: 'قرار', support: 'دعم', other: 'أخرى' };
const T_STATUS = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', done: 'منجزة', cancelled: 'ملغاة' };
const R_STATUS = { new: 'جديد', in_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', done: 'منفذ' };
const GROUPS = { gov: 'المشاريع الحكومية', partner: 'الشراكة المجتمعية', study: 'المشاريع تحت الدراسة' };
const loadScript = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('cdn')); document.head.appendChild(el); });
async function loadLib() { if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const mln = v => v >= 1e6 ? (v / 1e6).toFixed(1) + ' مليون' : fmt0(v);
const bar = (v, c = 'var(--lblue)') => `<div class="rbar"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div>`;
const d10 = v => (v || '').toString().slice(0, 10);
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]]; };
const longDate = d => new Date(d || Date.now()).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// ---------- تحميل البيانات مرة واحدة
let D = null, Dts = 0;
async function loadData() {
  if (D && Date.now() - Dts < 60000) return D;
  const [projects, profiles, act, chs, tasks, reqs, ups, log, pays] = await Promise.all([
    q(sb.from('projects').select('*').eq('archived', false)),
    q(sb.from('profiles').select('id,full_name')),
    loadActivity(),
    q(sb.from('challenges').select('*, projects(name)').order('severity')),
    q(sb.from('tasks').select('*, projects(name)').order('id', { ascending: false })),
    q(sb.from('requests').select('*, projects(name)').order('id', { ascending: false })),
    q(sb.from('project_updates').select('*, projects(name)').order('happened_on', { ascending: false }).limit(1000)),
    q(sb.from('project_stage_log').select('*, projects(name)').order('at', { ascending: false }).limit(2000)),
    q(sb.from('payments').select('*, projects(name)').order('id', { ascending: false })),
  ]);
  D = { projects, profiles, act, chs, tasks, reqs, ups, log, pays, pn: (id, fb) => profiles.find(p => p.id === id)?.full_name || fb || '—' }; Dts = Date.now(); return D;
}
const periodFn = (from, to) => d => { const x = d10(d); return !!x && (!from || x >= from) && (!to || x <= to); };
const periodLabel = (from, to) => from && to ? `من ${dateAr(from)} إلى ${dateAr(to)}` : from ? `من ${dateAr(from)} حتى تاريخه` : to ? `حتى ${dateAr(to)}` : 'منذ بداية التسجيل حتى تاريخه';

// ---------- أجزاء مشتركة
function header(title, sub, meta) {
  return `<header class="rhead"><img src="assets/logo.png" alt=""><div class="rt"><h1>${esc(title)}</h1><div class="rs">تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع${sub ? ' · ' + esc(sub) : ''}</div></div><div class="rmeta">${meta.map(([k, v, ltr]) => `<div><span>${k}</span><b class="${ltr ? 'ltr' : ''}">${v}</b></div>`).join('')}</div></header>`;
}
const footer = (extra = '') => `<footer class="rfoot"><div>صدر من منصة إدارة مشاريع تجمع الأحساء الصحي بتاريخ ${esc(today())} — البيانات كما هي مسجلة في المنصة وقت الإصدار.${extra}</div><div class="sig"><div>إعداد: رئيس قسم المشاريع<br><br>الاسم: ...................... التوقيع: ..............</div><div>اعتماد: مدير إدارة الخدمات الفنية<br><br>الاسم: ...................... التوقيع: ..............</div></div></footer>`;

export async function exportPdf(el, filename) {
  toast('جارٍ إنشاء ملف PDF…');
  try { await loadLib(); } catch (e) { return err('تعذّر تحميل مكتبة PDF — استخدم «طباعة / حفظ كـ PDF»'); }
  el.classList.add('pdfmode');
  try {
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const W = 210, H = 297, M = 8, iw = W - 2 * M, ih = H - 2 * M;
    const pages = $$('.rpage', el);
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1200, scrollX: 0, scrollY: -window.scrollY });
      let w = iw, h = iw * canvas.height / canvas.width; if (h > ih) { h = ih; w = ih * canvas.width / canvas.height; }
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', (W - w) / 2, M, w, h);
      pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`${i + 1} / ${pages.length}`, W / 2, H - 4, { align: 'center' });
    }
    pdf.save(filename); toast('تم تنزيل التقرير');
  } catch (e) { err(e); } finally { el.classList.remove('pdfmode'); }
}

// ============ الصفحة الرئيسية للتقارير
export async function mountReport(root, tab = 'general', params = new URLSearchParams()) {
  root.innerHTML = `<div class="toolbar noprint"><h1 class="pagetitle">التقارير</h1></div><div class="tabs noprint"><a href="#/report" class="${tab !== 'custom' ? 'on' : ''}">التقرير التنفيذي العام</a><a href="#/report/custom" class="${tab === 'custom' ? 'on' : ''}">تقرير مخصص</a></div><div id="rbody"><div class="loading"><div class="spin"></div>جارٍ إعداد التقرير…</div></div>`;
  const body = $('#rbody');
  await loadData();
  if (tab === 'custom') customReport(body, params); else generalReport(body, params);
}

// ============ 1) التقرير التنفيذي العام (صفحتان)
function generalReport(root, params) {
  let from = params.get('from') || '', to = params.get('to') || '';
  const render = () => {
    const { projects, act, pn } = D; const inP = periodFn(from, to);
    const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
    const exec = projects.filter(p => p.stage === 'execution').sort((a, b) => Number(b.contract_value || 0) - Number(a.contract_value || 0));
    const late = active.filter(p => p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'));
    const stale = active.filter(p => isStale(p, act));
    const closed = projects.filter(p => p.stage === 'closed');
    const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0);
    const paid = active.reduce((a, p) => a + Number(p.paid_amount || 0), 0);
    const avgProg = exec.length ? Math.round(exec.reduce((a, p) => a + Number(p.progress_actual || 0), 0) / exec.length) : 0;
    const byStage = STAGES.map(s => ({ ...s, n: projects.filter(p => p.stage === s.key).length })).filter(s => s.n);
    const groups = Object.entries(GROUPS).map(([k, t]) => { const ps = active.filter(p => groupOf(p) === k); return { t, n: ps.length, v: ps.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), paid: ps.reduce((a, p) => a + Number(p.paid_amount || 0), 0), late: ps.filter(p => late.includes(p)).length }; });
    const chs = D.chs.filter(c => c.status !== 'مغلق');
    const tasks = D.tasks.filter(t => ['open', 'in_progress'].includes(t.status)).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const lateTasks = tasks.filter(t => t.due_date && t.due_date < today());
    const reqs = D.reqs.filter(r => ['new', 'in_review'].includes(r.status));
    const ups = D.ups.filter(u => inP(u.happened_on)).slice(0, 6);
    // نشاط الفترة
    const A = { stages: D.log.filter(l => inP(l.at)).length, ups: D.ups.filter(u => inP(u.happened_on)).length, tasksDone: D.tasks.filter(t => t.status === 'done' && inP(t.done_at || t.updated_at)).length, reqs: D.reqs.filter(r => inP(r.created_at)).length, chs: D.chs.filter(c => inP(c.detected_on || c.created_at)).length, paid: D.pays.filter(p => p.status === 'paid' && inP(p.paid_on)).reduce((a, p) => a + Number(p.net_amount || 0), 0), paidN: D.pays.filter(p => p.status === 'paid' && inP(p.paid_on)).length };
    const refNo = 'AHC-EXR-' + today().replace(/-/g, '');
    root.innerHTML = `<div class="filters noprint"><label class="fld"><span>من تاريخ</span><input type="date" id="rFrom" value="${from}"></label><label class="fld"><span>إلى تاريخ</span><input type="date" id="rTo" value="${to}"></label><div class="btnrow" style="align-self:flex-end"><button class="btn sm" data-q="month">هذا الشهر</button><button class="btn sm" data-q="quarter">هذا الربع</button><button class="btn sm" data-q="year">هذه السنة</button><button class="btn sm" data-q="all">الكل</button></div><span style="flex:1"></span><button class="btn primary" id="rPdf">${ico('download')} تنزيل PDF</button><button class="btn" id="rPrint">${ico('print')} طباعة</button></div>
    <div class="rep" id="rep">
    <section class="rpage">
      ${header('التقرير التنفيذي لمحفظة المشاريع', '', [['تاريخ الإصدار', esc(longDate())], ['فترة التقرير', periodLabel(from, to)], ['رقم التقرير', refNo, 1], ['أعدّه', esc(session.profile?.full_name || '')]])}
      <div class="rkpis">
        <div class="rk"><b>${projects.length}</b><span>إجمالي المشاريع</span></div>
        <div class="rk"><b>${exec.length}</b><span>تحت التنفيذ</span></div>
        <div class="rk ${late.length ? 'bad' : ''}"><b>${late.length}</b><span>متأخرة / متعثرة</span></div>
        <div class="rk"><b>${closed.length}</b><span>مستلمة نهائياً</span></div>
        <div class="rk"><b>${mln(totalV)}</b><span>قيمة المحفظة القائمة (ر.س)</span></div>
        <div class="rk"><b>${pct(paid, totalV)}%</b><span>نسبة الصرف الإجمالية</span></div>
        <div class="rk"><b>${avgProg}%</b><span>متوسط إنجاز التنفيذ</span></div>
        <div class="rk ${chs.length ? 'bad' : ''}"><b>${chs.length}</b><span>تحديات مفتوحة</span></div>
      </div>
      <div class="rtwo">
        <div class="rcard"><h2>المحفظة حسب الفئة</h2><table class="rt2"><thead><tr><th>الفئة</th><th class="c">عدد</th><th class="c">القيمة (ر.س)</th><th class="c">المصروف</th><th class="c">الصرف</th><th class="c">متأخرة</th></tr></thead><tbody>${groups.map(g => `<tr><td><b>${g.t}</b></td><td class="c">${g.n}</td><td class="c n">${money(Math.round(g.v))}</td><td class="c n">${money(Math.round(g.paid))}</td><td class="c">${pct(g.paid, g.v)}%</td><td class="c ${g.late ? 'bad' : ''}">${g.late}</td></tr>`).join('')}</tbody></table></div>
        <div class="rcard"><h2>التوزيع حسب المرحلة</h2>${byStage.map(s => `<div class="rrow"><span class="rl">${esc(s.ar)}</span>${bar(pct(s.n, projects.length), s.color)}<b>${s.n}</b></div>`).join('')}</div>
      </div>
      <div class="rcard"><h2>المشاريع تحت التنفيذ <small>(${exec.length})</small></h2><table class="rt2"><thead><tr><th>#</th><th>المشروع</th><th>مدير المشروع</th><th class="c">قيمة العقد</th><th class="c">مخطط</th><th class="c">فعلي</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>${exec.map((p, i) => { const l = late.includes(p); return `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b></td><td>${esc(pn(p.engineer_id, p.engineer_name))}</td><td class="c n">${money(p.contract_value)}</td><td class="c">${p.progress_planned || 0}%</td><td class="c">${bar(p.progress_actual || 0, l ? '#A6503B' : '#5F7A5B')}${p.progress_actual || 0}%</td><td class="${l ? 'bad' : ''}">${dateAr(p.end_date)}</td><td>${p.status_note ? `<span class="rb bad">${esc(p.status_note)}</span>` : l ? '<span class="rb bad">متأخر</span>' : '<span class="rb ok">منتظم</span>'}</td></tr>`; }).join('')}</tbody></table></div>
    </section>
    <section class="rpage">
      <div class="rcard rstrip"><h2>نشاط الفترة <small>(${periodLabel(from, to)})</small></h2><div class="rkpis six"><div class="rk"><b>${A.stages}</b><span>تغييرات مراحل</span></div><div class="rk"><b>${A.ups}</b><span>تحديثات مسجلة</span></div><div class="rk"><b>${A.tasksDone}</b><span>مهام أُنجزت</span></div><div class="rk"><b>${A.reqs}</b><span>طلبات قُدّمت</span></div><div class="rk"><b>${A.chs}</b><span>تحديات سُجّلت</span></div><div class="rk"><b>${money(Math.round(A.paid))}</b><span>مصروف عبر ${A.paidN} مستخلص (ر.س)</span></div></div></div>
      <div class="rtwo">
        <div class="rcard"><h2>التحديات المفتوحة <small>(${chs.length})</small></h2>${chs.length ? `<table class="rt2"><thead><tr><th>المشروع</th><th>التحدي</th><th>الخطورة</th><th>المسؤول</th></tr></thead><tbody>${chs.slice(0, 8).map(c => `<tr><td>${esc(c.projects?.name || '')}</td><td>${esc(c.title)}</td><td><span class="rb ${c.severity === 'حرجة' || c.severity === 'عالية' ? 'bad' : 'mid'}">${esc(c.severity)}</span></td><td>${esc(c.owner || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد تحديات مفتوحة.</p>'}</div>
        <div class="rcard"><h2>مشاريع تحتاج متابعة</h2>
          <h3>متأخرة / متعثرة (${late.length})</h3>${late.length ? `<ul class="rlist">${late.slice(0, 6).map(p => `<li><b>${esc(p.name)}</b> <span class="muted">— ${esc(p.status_note || 'تجاوز الموعد')} · إنجاز ${p.progress_actual || 0}% · ${dateAr(p.end_date)}</span></li>`).join('')}${late.length > 6 ? `<li class="muted">و${late.length - 6} مشاريع أخرى…</li>` : ''}</ul>` : '<p class="muted">لا يوجد.</p>'}
          <h3>بلا تحديث منذ أكثر من ${STALE_DAYS} يوماً (${stale.length})</h3>${stale.length ? `<ul class="rlist">${stale.slice(0, 6).map(p => `<li><b>${esc(p.name)}</b> <span class="muted">— آخر نشاط ${dateAr(act[p.id] || p.updated_at)}</span></li>`).join('')}${stale.length > 6 ? `<li class="muted">و${stale.length - 6} مشاريع أخرى…</li>` : ''}</ul>` : '<p class="muted">جميع المشاريع محدّثة.</p>'}</div>
      </div>
      <div class="rtwo">
        <div class="rcard"><h2>المهام المفتوحة <small>(${tasks.length}${lateTasks.length ? ' · ' + lateTasks.length + ' متأخرة' : ''})</small></h2>${tasks.length ? `<table class="rt2"><thead><tr><th>المهمة</th><th>المشروع</th><th>المكلّف</th><th>الموعد</th></tr></thead><tbody>${tasks.slice(0, 7).map(t => `<tr><td>${esc(t.title)}</td><td>${esc(t.projects?.name || '')}</td><td>${esc(pn(t.assignee_id, t.assignee_name))}</td><td class="${t.due_date && t.due_date < today() ? 'bad' : ''}">${dateAr(t.due_date)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد مهام مفتوحة.</p>'}</div>
        <div class="rcard"><h2>الطلبات بانتظار قرار الإدارة <small>(${reqs.length})</small></h2>${reqs.length ? `<table class="rt2"><thead><tr><th>الطلب</th><th>النوع</th><th>المشروع</th><th>مقدّمه</th></tr></thead><tbody>${reqs.slice(0, 7).map(r => `<tr><td>${esc(r.title)}</td><td>${R_KIND[r.kind] || ''}</td><td>${esc(r.projects?.name || '')}</td><td>${esc(pn(r.created_by))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد طلبات معلقة.</p>'}</div>
      </div>
      <div class="rcard"><h2>أبرز المستجدات خلال الفترة</h2>${ups.length ? `<ul class="rlist">${ups.map(u => `<li><b>${esc(u.projects?.name || '')}</b>: ${esc(u.body)} <span class="muted">— ${dateAr(u.happened_on)}</span></li>`).join('')}</ul>` : '<p class="muted">لا توجد تحديثات مسجلة في هذه الفترة.</p>'}</div>
      ${footer()}
    </section></div>`;
    $('#rPrint').onclick = () => window.print();
    $('#rPdf').onclick = () => exportPdf($('#rep'), `التقرير التنفيذي - ${today()}.pdf`);
    const apply = () => { from = $('#rFrom').value; to = $('#rTo').value; render(); };
    $('#rFrom').onchange = apply; $('#rTo').onchange = apply;
    $$('[data-q]').forEach(b => b.onclick = () => { const r = quick(b.getAttribute('data-q')); from = r[0]; to = r[1]; render(); });
  };
  render();
}
function quick(k) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (k === 'month') return [iso(new Date(y, m, 1)), today()];
  if (k === 'quarter') return [iso(new Date(y, Math.floor(m / 3) * 3, 1)), today()];
  if (k === 'year') return [iso(new Date(y, 0, 1)), today()];
  return ['', ''];
}

// ============ 2) التقرير المخصص
const SECTIONS = [
  ['kpis', 'المؤشرات الرئيسية'], ['portfolio', 'المحفظة حسب الفئة'], ['stages', 'التوزيع حسب المرحلة'], ['projects', 'جدول المشاريع'], ['exec', 'جدول التنفيذ'],
  ['challenges', 'التحديات والمخاطر'], ['tasks', 'المهام'], ['requests', 'الطلبات'], ['payments', 'المستخلصات المالية'], ['updates', 'التحديثات والملاحظات'], ['log', 'سجل المراحل'], ['cards', 'بطاقة تفصيلية لكل مشروع'],
];
const DEFAULTS = { one: ['cards', 'challenges', 'tasks', 'requests', 'payments', 'updates', 'log'], many: ['kpis', 'portfolio', 'stages', 'projects', 'exec', 'challenges', 'tasks', 'requests', 'payments'] };
const PREF_KEY = 'ahc_custom_report';

function customReport(root, params) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { }
  const st = { title: saved.title || 'تقرير متابعة المشاريع', scope: params.get('p') ? 'one' : params.get('g') ? params.get('g') : (saved.scope || 'all'), ids: params.get('p') ? [params.get('p')] : (saved.ids || []), from: params.get('from') || saved.from || '', to: params.get('to') || saved.to || '', sections: null, notes: saved.notes || '', all: saved.all !== false };
  const projects = [...D.projects].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const scopeProjects = () => st.scope === 'all' ? projects : st.scope === 'one' || st.scope === 'manual' ? projects.filter(p => st.ids.includes(p.id)) : projects.filter(p => groupOf(p) === st.scope);
  const defSections = () => (st.scope === 'one' || (st.scope === 'manual' && st.ids.length === 1)) ? DEFAULTS.one : DEFAULTS.many;
  if (saved.sections && !params.get('p') && !params.get('g')) st.sections = saved.sections;

  root.innerHTML = `<div class="rbuild noprint">
    <div class="pgrid">
      ${'<label class="fld wide"><span>عنوان التقرير</span><input id="cTitle" value="' + esc(st.title) + '"></label>'}
      <label class="fld"><span>نطاق التقرير</span><select id="cScope"><option value="all">جميع المشاريع</option><option value="gov">المشاريع الحكومية</option><option value="partner">الشراكة المجتمعية</option><option value="study">المشاريع تحت الدراسة</option><option value="one">مشروع واحد</option><option value="manual">مشاريع أختارها</option></select></label>
      <label class="fld" id="cOneW"><span>المشروع</span><select id="cOne">${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>من تاريخ</span><input type="date" id="cFrom" value="${st.from}"></label>
      <label class="fld"><span>إلى تاريخ</span><input type="date" id="cTo" value="${st.to}"></label>
      <div class="fld wide" id="cManualW"><span>اختر المشاريع</span><div class="chips" id="cManual">${projects.map(p => `<label class="chip"><input type="checkbox" value="${p.id}"> ${esc(p.name)}</label>`).join('')}</div></div>
      <div class="fld wide"><span>أقسام التقرير</span><div class="chips" id="cSecs">${SECTIONS.map(([k, t]) => `<label class="chip"><input type="checkbox" value="${k}"> ${t}</label>`).join('')}</div><label class="chk" style="margin-top:6px"><input type="checkbox" id="cAll"> إظهار كل السجلات (وليس المفتوحة/المعلقة فقط)</label></div>
      <label class="fld wide"><span>ملاحظات / مقدمة تظهر في التقرير</span><textarea id="cNotes" rows="2">${esc(st.notes)}</textarea></label>
    </div>
    <div class="btnrow end"><button class="btn" id="cReset">إعادة الضبط</button><span style="flex:1"></span><button class="btn primary" id="cPdf">${ico('download')} تنزيل PDF</button><button class="btn" id="cPrint">${ico('print')} طباعة</button></div>
  </div><div class="rep" id="rep"></div>`;
  const R = { title: $('#cTitle'), scope: $('#cScope'), one: $('#cOne'), from: $('#cFrom'), to: $('#cTo'), notes: $('#cNotes'), all: $('#cAll') };
  R.scope.value = st.scope; if (st.ids[0]) R.one.value = st.ids[0]; R.all.checked = st.all;
  const setSecs = arr => $$('#cSecs input').forEach(i => i.checked = arr.includes(i.value));
  setSecs(st.sections || defSections());
  $$('#cManual input').forEach(i => i.checked = st.ids.includes(i.value));
  const sync = () => {
    st.title = R.title.value; st.scope = R.scope.value; st.from = R.from.value; st.to = R.to.value; st.notes = R.notes.value; st.all = R.all.checked;
    st.ids = st.scope === 'one' ? [R.one.value] : st.scope === 'manual' ? $$('#cManual input:checked').map(i => i.value) : [];
    st.sections = $$('#cSecs input:checked').map(i => i.value);
    $('#cOneW').style.display = st.scope === 'one' ? '' : 'none'; $('#cManualW').style.display = st.scope === 'manual' ? '' : 'none';
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ title: st.title, scope: st.scope, ids: st.ids, from: st.from, to: st.to, sections: st.sections, notes: st.notes, all: st.all })); } catch (e) { }
    build();
  };
  R.scope.onchange = () => { st.scope = R.scope.value; setSecs((st.scope === 'one') ? DEFAULTS.one : DEFAULTS.many); sync(); };
  [R.title, R.one, R.from, R.to, R.notes, R.all].forEach(el => el.onchange = sync); R.title.oninput = sync; R.notes.oninput = sync;
  $$('#cManual input, #cSecs input').forEach(i => i.onchange = sync);
  $('#cReset').onclick = () => { try { localStorage.removeItem(PREF_KEY); } catch (e) { } location.hash = '#/report/custom'; mountReport($('#main'), 'custom'); };
  $('#cPrint').onclick = () => window.print();
  $('#cPdf').onclick = () => exportPdf($('#rep'), `${st.title || 'تقرير'} - ${today()}.pdf`);

  function build() {
    const S = scopeProjects(); const ids = new Set(S.map(p => p.id)); const inP = periodFn(st.from, st.to); const { pn, act } = D;
    const has = k => st.sections.includes(k);
    const blocks = [];
    const scopeLabel = st.scope === 'all' ? 'جميع المشاريع' : st.scope === 'one' ? (S[0]?.name || '') : st.scope === 'manual' ? `${S.length} مشاريع مختارة` : GROUPS[st.scope];
    blocks.push(header(st.title || 'تقرير', scopeLabel, [['تاريخ الإصدار', esc(longDate())], ['فترة التقرير', periodLabel(st.from, st.to)], ['رقم التقرير', 'AHC-CR-' + today().replace(/-/g, ''), 1], ['أعدّه', esc(session.profile?.full_name || '')]]));
    if (st.notes.trim()) blocks.push(`<div class="rcard rnote">${esc(st.notes).replace(/\n/g, '<br>')}</div>`);
    if (!S.length) blocks.push('<div class="rcard"><p class="muted">لم يتم اختيار أي مشروع.</p></div>');
    const active = S.filter(p => !['closed', 'cancelled'].includes(p.stage));
    const exec = S.filter(p => p.stage === 'execution');
    const late = active.filter(p => p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'));
    const chsAll = D.chs.filter(c => ids.has(c.project_id) && inP(c.detected_on || c.created_at) || (ids.has(c.project_id) && !st.from && !st.to));
    const chs = st.all ? chsAll : chsAll.filter(c => c.status !== 'مغلق');
    const tasksAll = D.tasks.filter(t => ids.has(t.project_id) && (inP(t.created_at) || inP(t.done_at) || (!st.from && !st.to)));
    const tasks = st.all ? tasksAll : tasksAll.filter(t => ['open', 'in_progress'].includes(t.status));
    const reqsAll = D.reqs.filter(r => ids.has(r.project_id) && (inP(r.created_at) || (!st.from && !st.to)));
    const reqs = st.all ? reqsAll : reqsAll.filter(r => ['new', 'in_review'].includes(r.status));
    const pays = D.pays.filter(p => ids.has(p.project_id) && (inP(p.paid_on) || inP(p.submitted_on) || inP(p.created_at) || (!st.from && !st.to))).sort((a, b) => (a.projects?.name || '').localeCompare(b.projects?.name || '', 'ar') || a.no - b.no);
    const ups = D.ups.filter(u => ids.has(u.project_id) && inP(u.happened_on) || (ids.has(u.project_id) && !st.from && !st.to));
    const log = D.log.filter(l => ids.has(l.project_id) && (inP(l.at) || (!st.from && !st.to)));
    if (S.length && has('kpis')) {
      const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), paid = active.reduce((a, p) => a + Number(p.paid_amount || 0), 0);
      const avgProg = exec.length ? Math.round(exec.reduce((a, p) => a + Number(p.progress_actual || 0), 0) / exec.length) : 0;
      blocks.push(`<div class="rkpis"><div class="rk"><b>${S.length}</b><span>عدد المشاريع</span></div><div class="rk"><b>${exec.length}</b><span>تحت التنفيذ</span></div><div class="rk ${late.length ? 'bad' : ''}"><b>${late.length}</b><span>متأخرة / متعثرة</span></div><div class="rk"><b>${S.filter(p => p.stage === 'closed').length}</b><span>مستلمة نهائياً</span></div><div class="rk"><b>${mln(totalV)}</b><span>القيمة القائمة (ر.س)</span></div><div class="rk"><b>${pct(paid, totalV)}%</b><span>نسبة الصرف</span></div><div class="rk"><b>${avgProg}%</b><span>متوسط إنجاز التنفيذ</span></div><div class="rk ${chsAll.filter(c => c.status !== 'مغلق').length ? 'bad' : ''}"><b>${chsAll.filter(c => c.status !== 'مغلق').length}</b><span>تحديات مفتوحة</span></div></div>`);
    }
    if (S.length > 1 && has('portfolio')) {
      const groups = Object.entries(GROUPS).map(([k, t]) => { const ps = active.filter(p => groupOf(p) === k); return { t, n: ps.length, v: ps.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), paid: ps.reduce((a, p) => a + Number(p.paid_amount || 0), 0), late: ps.filter(p => late.includes(p)).length }; }).filter(g => g.n);
      blocks.push(`<div class="rcard"><h2>المحفظة حسب الفئة</h2><table class="rt2"><thead><tr><th>الفئة</th><th class="c">عدد</th><th class="c">القيمة (ر.س)</th><th class="c">المصروف</th><th class="c">الصرف</th><th class="c">متأخرة</th></tr></thead><tbody>${groups.map(g => `<tr><td><b>${g.t}</b></td><td class="c">${g.n}</td><td class="c n">${money(Math.round(g.v))}</td><td class="c n">${money(Math.round(g.paid))}</td><td class="c">${pct(g.paid, g.v)}%</td><td class="c ${g.late ? 'bad' : ''}">${g.late}</td></tr>`).join('')}</tbody></table></div>`);
    }
    if (S.length > 1 && has('stages')) { const byStage = STAGES.map(s => ({ ...s, n: S.filter(p => p.stage === s.key).length })).filter(s => s.n); blocks.push(`<div class="rcard"><h2>التوزيع حسب المرحلة</h2>${byStage.map(s => `<div class="rrow"><span class="rl">${esc(s.ar)}</span>${bar(pct(s.n, S.length), s.color)}<b>${s.n}</b></div>`).join('')}</div>`); }
    if (S.length > 1 && has('projects')) chunk(S, 16).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>جدول المشاريع <small>(${S.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''})</small></h2><table class="rt2"><thead><tr><th>#</th><th>المشروع</th><th>الفئة</th><th>المرحلة</th><th>مدير المشروع</th><th class="c">القيمة (ر.س)</th><th class="c">الإنجاز</th><th>الانتهاء</th></tr></thead><tbody>${rows.map((p, i) => `<tr><td>${ci * 16 + i + 1}</td><td><b>${esc(p.name)}</b>${p.status_note ? ` <span class="rb bad">${esc(p.status_note)}</span>` : ''}</td><td>${esc(p.category || '')}</td><td><span class="rb" style="background:${stageOf(p.stage).color};color:#fff">${esc(stageOf(p.stage).ar)}</span></td><td>${esc(pn(p.engineer_id, p.engineer_name))}</td><td class="c n">${money(p.contract_value || p.budget)}</td><td class="c">${p.stage === 'execution' ? (p.progress_actual || 0) + '%' : '—'}</td><td class="${late.includes(p) ? 'bad' : ''}">${dateAr(p.end_date)}</td></tr>`).join('')}</tbody></table></div>`));
    if (has('exec') && exec.length) chunk(exec, 16).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>المشاريع تحت التنفيذ <small>(${exec.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''})</small></h2><table class="rt2"><thead><tr><th>#</th><th>المشروع</th><th>مدير المشروع</th><th class="c">قيمة العقد</th><th class="c">المصروف</th><th class="c">مخطط</th><th class="c">فعلي</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>${rows.map((p, i) => { const l = late.includes(p); return `<tr><td>${ci * 16 + i + 1}</td><td><b>${esc(p.name)}</b></td><td>${esc(pn(p.engineer_id, p.engineer_name))}</td><td class="c n">${money(p.contract_value)}</td><td class="c n">${money(p.paid_amount)}</td><td class="c">${p.progress_planned || 0}%</td><td class="c">${bar(p.progress_actual || 0, l ? '#A6503B' : '#5F7A5B')}${p.progress_actual || 0}%</td><td class="${l ? 'bad' : ''}">${dateAr(p.end_date)}</td><td>${p.status_note ? `<span class="rb bad">${esc(p.status_note)}</span>` : l ? '<span class="rb bad">متأخر</span>' : '<span class="rb ok">منتظم</span>'}</td></tr>`; }).join('')}</tbody></table></div>`));
    if (has('cards')) S.forEach(p => {
      const V = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`; const l = late.includes(p); const cv = Number(p.contract_value || 0);
      blocks.push(`<div class="rcard rproj"><h2>${esc(p.name)} <small>${esc(p.ref || '')}</small> <span class="rb" style="background:${stageOf(p.stage).color};color:#fff;float:left">${esc(stageOf(p.stage).ar)}</span></h2>
        <div class="rtwo"><div class="kvs">${V('الفئة / النوع', esc((p.category || '—') + ' / ' + (p.type || '—')))}${V('المنشأة', esc(p.facility || '—'))}${V('الجهة المستفيدة', esc(p.beneficiary || '—'))}${V('مدير المشروع', esc(pn(p.engineer_id, p.engineer_name)))}${V('المقاول', esc(p.contractor || '—'))}${V('الاستشاري', esc(p.consultant || '—'))}${V('البرنامج المالي', esc(p.funding || '—'))}${V('الأولوية', p.priority === 'urgent' ? 'عاجلة' : p.priority === 'high' ? 'مهمة' : 'عادية')}</div>
        <div class="kvs">${V('الميزانية التقديرية', money(p.budget) + ' ر.س')}${V('الميزانية المعتمدة', money(p.budget_approved) + ' ر.س')}${V('قيمة العقد', money(p.contract_value) + ' ر.س')}${V('المصروف', money(p.paid_amount) + (cv ? ` (${pct(Number(p.paid_amount || 0), cv)}%)` : ''))}${V('الطرح / الترسية', dateAr(p.tender_date) + ' / ' + dateAr(p.award_date))}${V('المباشرة / الانتهاء', dateAr(p.start_date) + ' / ' + dateAr(p.end_date))}${V('مدة إضافية / انتهاء معدّل', `${p.extra_days || 0} يوم / ${dateAr(p.revised_end_date)}`)}${V('الحالة', p.status_note ? `<span class="rb bad">${esc(p.status_note)}</span>` : l ? '<span class="rb bad">متأخر</span>' : isStale(p, act) ? '<span class="rb mid">بلا تحديث</span>' : '<span class="rb ok">منتظم</span>')}</div></div>
        ${p.stage === 'execution' ? `<div class="rrow"><span class="rl">الإنجاز المخطط ${p.progress_planned || 0}%</span>${bar(p.progress_planned || 0, '#8FA6B8')}</div><div class="rrow"><span class="rl">الإنجاز الفعلي ${p.progress_actual || 0}%</span>${bar(p.progress_actual || 0, l ? '#A6503B' : '#5F7A5B')}</div>` : ''}
        ${p.justification ? `<p class="rsm"><b>المبرر:</b> ${esc(p.justification)}</p>` : ''}${p.notes ? `<p class="rsm"><b>ملاحظات:</b> ${esc(p.notes)}</p>` : ''}</div>`);
    });
    const proj = r => S.length > 1 ? `<td>${esc(r.projects?.name || '')}</td>` : '';
    const pth = S.length > 1 ? '<th>المشروع</th>' : '';
    if (has('challenges')) chunk(chs, 14).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>التحديات والمخاطر <small>(${chs.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''}${st.all ? '' : ' · المفتوحة'})</small></h2>${rows.length ? `<table class="rt2"><thead><tr>${pth}<th>التحدي</th><th>التصنيف</th><th>الخطورة</th><th>الأثر</th><th>الإجراء</th><th>المسؤول</th><th>الحالة</th></tr></thead><tbody>${rows.map(c => `<tr>${proj(c)}<td><b>${esc(c.title)}</b></td><td>${esc(c.category || '')}</td><td><span class="rb ${c.severity === 'حرجة' || c.severity === 'عالية' ? 'bad' : 'mid'}">${esc(c.severity)}</span></td><td>${c.impact_days ? c.impact_days + ' يوم' : ''}${c.impact_amount ? ' · ' + money(c.impact_amount) + ' ر.س' : ''}</td><td>${esc(c.action || '')}</td><td>${esc(c.owner || '')}</td><td>${esc(c.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد تحديات.</p>'}</div>`));
    if (has('tasks')) chunk(tasks, 16).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>المهام <small>(${tasks.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''}${st.all ? '' : ' · المفتوحة'})</small></h2>${rows.length ? `<table class="rt2"><thead><tr>${pth}<th>المهمة</th><th>المكلّف</th><th>الموعد</th><th>الحالة</th><th>ملاحظة الإنجاز</th></tr></thead><tbody>${rows.map(t => `<tr>${proj(t)}<td><b>${esc(t.title)}</b></td><td>${esc(pn(t.assignee_id, t.assignee_name))}</td><td class="${t.due_date && t.due_date < today() && !['done', 'cancelled'].includes(t.status) ? 'bad' : ''}">${dateAr(t.due_date)}</td><td>${T_STATUS[t.status] || t.status}</td><td>${esc(t.progress_note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد مهام.</p>'}</div>`));
    if (has('requests')) chunk(reqs, 16).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>الطلبات <small>(${reqs.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''}${st.all ? '' : ' · المعلقة'})</small></h2>${rows.length ? `<table class="rt2"><thead><tr>${pth}<th>الطلب</th><th>النوع</th><th>مقدّمه</th><th>التاريخ</th><th>الحالة</th><th>الرد</th></tr></thead><tbody>${rows.map(r => `<tr>${proj(r)}<td><b>${esc(r.title)}</b></td><td>${R_KIND[r.kind] || ''}</td><td>${esc(pn(r.created_by))}</td><td>${dateAr(r.created_at)}</td><td>${R_STATUS[r.status] || r.status}</td><td>${esc(r.response || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد طلبات.</p>'}</div>`));
    if (has('payments')) { const tot = pays.reduce((a, r) => a + Number(r.net_amount || 0), 0), paidT = pays.filter(r => r.status === 'paid').reduce((a, r) => a + Number(r.net_amount || 0), 0); chunk(pays, 14).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>المستخلصات المالية <small>(${pays.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''})</small></h2>${rows.length ? `<table class="rt2"><thead><tr>${pth}<th class="c">رقم</th><th>النوع</th><th>الفترة</th><th class="c">قيمة الأعمال</th><th class="c">الصافي</th><th>الحالة</th><th>تاريخ الصرف</th></tr></thead><tbody>${rows.map(r => `<tr>${proj(r)}<td class="c">${r.no}</td><td>${P_KIND[r.kind]}</td><td>${r.period_from ? dateAr(r.period_from) + ' → ' + dateAr(r.period_to) : '—'}</td><td class="c n">${fmt(r.work_amount)}</td><td class="c n"><b>${fmt(r.net_amount)}</b></td><td>${P_STATUS[r.status]}</td><td>${dateAr(r.paid_on)}</td></tr>`).join('')}</tbody>${ci === arr.length - 1 ? `<tfoot><tr><td colspan="${S.length > 1 ? 5 : 4}"><b>الإجمالي</b></td><td class="c n"><b>${fmt(tot)}</b></td><td colspan="2">منها مصروف ${fmt(paidT)}</td></tr></tfoot>` : ''}</table>` : '<p class="muted">لا توجد مستخلصات.</p>'}</div>`)); }
    if (has('updates')) chunk(ups, 12).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>التحديثات والملاحظات <small>(${ups.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''})</small></h2>${rows.length ? `<ul class="rlist">${rows.map(u => `<li>${S.length > 1 ? `<b>${esc(u.projects?.name || '')}</b>: ` : ''}${esc(u.body)} <span class="muted">— ${dateAr(u.happened_on)}${u.amount ? ' · ' + money(u.amount) + ' ر.س' : ''}${u.ref_no ? ' · ' + esc(u.ref_no) : ''}</span></li>`).join('')}</ul>` : '<p class="muted">لا توجد تحديثات.</p>'}</div>`));
    if (has('log')) chunk(log, 18).forEach((rows, ci, arr) => blocks.push(`<div class="rcard"><h2>سجل المراحل <small>(${log.length}${arr.length > 1 ? ` · ${ci + 1}/${arr.length}` : ''})</small></h2>${rows.length ? `<table class="rt2"><thead><tr>${pth}<th>التاريخ</th><th>من</th><th>إلى</th><th>بواسطة</th><th>ملاحظة</th></tr></thead><tbody>${rows.map(l => `<tr>${proj(l)}<td>${dateAr(l.at)}</td><td>${esc(stageOf(l.from_stage).ar)}</td><td><b>${esc(stageOf(l.to_stage).ar)}</b></td><td>${esc(pn(l.by_user))}</td><td>${esc(l.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد تغييرات مراحل.</p>'}</div>`));
    blocks.push(footer());
    paginate($('#rep'), blocks);
  }
  sync();
}

// توزيع الكتل على صفحات A4 بحسب ارتفاعها الفعلي
export function paginate(rep, blocks) {
  const BUDGET = 1040; // px داخل الصفحة (A4 بعرض 210mm)
  rep.innerHTML = '<section class="rpage" id="rMeasure"></section>';
  const m = $('#rMeasure', rep); const pages = [[]]; let used = 0;
  blocks.forEach(html => {
    m.innerHTML = html; const h = (m.firstElementChild?.getBoundingClientRect().height || 0) + 10;
    if (used + h > BUDGET && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(html); used += h;
  });
  rep.innerHTML = pages.map(p => `<section class="rpage">${p.join('')}</section>`).join('');
}
