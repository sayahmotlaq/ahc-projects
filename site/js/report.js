// ===== التقرير التنفيذي (PDF) =====
import { sb, STAGES, stageOf, q, session, today } from './api.js';
import { $, $$, esc, fmt0, money, dateAr, toast, err } from './ui.js';
import { groupOf, isStale, loadActivity, STALE_DAYS } from './projects.js';

const R_KIND = { approval: 'اعتماد', review: 'مراجعة', decision: 'قرار', support: 'دعم', other: 'أخرى' };
function loadLib() { return new Promise((res, rej) => { if (window.html2pdf) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload = res; s.onerror = () => rej(new Error('cdn')); document.head.appendChild(s); }); }
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const mln = v => v >= 1e6 ? (v / 1e6).toFixed(1) + ' مليون' : fmt0(v);

export async function mountReport(root) {
  root.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ إعداد التقرير…</div>';
  const [projects, profiles, act, chs, tasks, reqs, ups] = await Promise.all([
    q(sb.from('projects').select('*').eq('archived', false)),
    q(sb.from('profiles').select('id,full_name')),
    loadActivity(),
    q(sb.from('challenges').select('*, projects(name)').neq('status', 'مغلق').order('severity'),),
    q(sb.from('tasks').select('*, projects(name)').in('status', ['open', 'in_progress'])),
    q(sb.from('requests').select('*, projects(name)').in('status', ['new', 'in_review'])),
    q(sb.from('project_updates').select('*, projects(name)').order('created_at', { ascending: false }).limit(10)),
  ]);
  const pn = (id, fb) => profiles.find(p => p.id === id)?.full_name || fb || '—';
  const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const exec = projects.filter(p => p.stage === 'execution').sort((a, b) => Number(b.contract_value || 0) - Number(a.contract_value || 0));
  const late = active.filter(p => p.status_note || (p.end_date && p.end_date < today() && p.stage === 'execution'));
  const stale = active.filter(p => isStale(p, act));
  const closed = projects.filter(p => p.stage === 'closed');
  const totalV = active.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0);
  const paid = active.reduce((a, p) => a + Number(p.paid_amount || 0), 0);
  const avgProg = exec.length ? Math.round(exec.reduce((a, p) => a + Number(p.progress_actual || 0), 0) / exec.length) : 0;
  const byStage = STAGES.map(s => ({ ...s, n: projects.filter(p => p.stage === s.key).length })).filter(s => s.n);
  const groups = [['gov', 'المشاريع الحكومية'], ['partner', 'الشراكة المجتمعية'], ['study', 'تحت الدراسة']].map(([k, t]) => { const ps = active.filter(p => groupOf(p) === k); return { t, n: ps.length, v: ps.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), paid: ps.reduce((a, p) => a + Number(p.paid_amount || 0), 0), late: ps.filter(p => late.includes(p)).length }; });
  const lateTasks = tasks.filter(t => t.due_date && t.due_date < today());
  const dateStr = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const refNo = 'AHC-EXR-' + today().replace(/-/g, '');
  const bar = (v, c = 'var(--lblue)') => `<div class="rbar"><i style="width:${Math.min(100, v)}%;background:${c}"></i></div>`;

  root.innerHTML = `<div class="toolbar noprint"><h1 class="pagetitle">التقرير التنفيذي</h1><span style="flex:1"></span><button class="btn primary" id="rPdf">⬇ تنزيل PDF</button><button class="btn" id="rPrint">طباعة / حفظ كـ PDF</button></div>
  <div class="rep" id="rep">
    <section class="rpage">
      <header class="rhead"><img src="assets/logo.png" alt=""><div class="rt"><h1>التقرير التنفيذي لمحفظة المشاريع</h1><div class="rs">تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع</div></div><div class="rmeta"><div><span>تاريخ الإصدار</span><b>${esc(dateStr)}</b></div><div><span>رقم التقرير</span><b class="ltr">${refNo}</b></div><div><span>أعدّه</span><b>${esc(session.profile?.full_name || '')}</b></div></div></header>
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
      <div class="rtwo">
        <div class="rcard"><h2>التحديات المفتوحة <small>(${chs.length})</small></h2>${chs.length ? `<table class="rt2"><thead><tr><th>المشروع</th><th>التحدي</th><th>الخطورة</th><th>المسؤول</th></tr></thead><tbody>${chs.slice(0, 12).map(c => `<tr><td>${esc(c.projects?.name || '')}</td><td>${esc(c.title)}</td><td><span class="rb ${c.severity === 'حرجة' || c.severity === 'عالية' ? 'bad' : 'mid'}">${esc(c.severity)}</span></td><td>${esc(c.owner || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد تحديات مفتوحة.</p>'}</div>
        <div class="rcard"><h2>مشاريع تحتاج متابعة</h2>
          <h3>متأخرة / متعثرة (${late.length})</h3>${late.length ? `<ul class="rlist">${late.map(p => `<li><b>${esc(p.name)}</b> <span class="muted">— ${esc(p.status_note || 'تجاوز الموعد')} · إنجاز ${p.progress_actual || 0}% · ${dateAr(p.end_date)}</span></li>`).join('')}</ul>` : '<p class="muted">لا يوجد.</p>'}
          <h3>بلا تحديث منذ أكثر من ${STALE_DAYS} يوماً (${stale.length})</h3>${stale.length ? `<ul class="rlist">${stale.slice(0, 12).map(p => `<li><b>${esc(p.name)}</b> <span class="muted">— آخر نشاط ${dateAr(act[p.id] || p.updated_at)}</span></li>`).join('')}${stale.length > 12 ? `<li class="muted">و${stale.length - 12} مشاريع أخرى…</li>` : ''}</ul>` : '<p class="muted">جميع المشاريع محدّثة.</p>'}</div>
      </div>
      <div class="rtwo">
        <div class="rcard"><h2>المهام المفتوحة <small>(${tasks.length}${lateTasks.length ? ' · ' + lateTasks.length + ' متأخرة' : ''})</small></h2>${tasks.length ? `<table class="rt2"><thead><tr><th>المهمة</th><th>المشروع</th><th>المكلّف</th><th>الموعد</th></tr></thead><tbody>${tasks.slice(0, 10).map(t => `<tr><td>${esc(t.title)}</td><td>${esc(t.projects?.name || '')}</td><td>${esc(pn(t.assignee_id, t.assignee_name))}</td><td class="${t.due_date && t.due_date < today() ? 'bad' : ''}">${dateAr(t.due_date)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد مهام مفتوحة.</p>'}</div>
        <div class="rcard"><h2>الطلبات بانتظار قرار الإدارة <small>(${reqs.length})</small></h2>${reqs.length ? `<table class="rt2"><thead><tr><th>الطلب</th><th>النوع</th><th>المشروع</th><th>مقدّمه</th></tr></thead><tbody>${reqs.slice(0, 10).map(r => `<tr><td>${esc(r.title)}</td><td>${R_KIND[r.kind] || ''}</td><td>${esc(r.projects?.name || '')}</td><td>${esc(pn(r.created_by))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">لا توجد طلبات معلقة.</p>'}</div>
      </div>
      <div class="rcard"><h2>آخر المستجدات</h2>${ups.length ? `<ul class="rlist">${ups.map(u => `<li><b>${esc(u.projects?.name || '')}</b>: ${esc(u.body)} <span class="muted">— ${dateAr(u.happened_on)}</span></li>`).join('')}</ul>` : '<p class="muted">—</p>'}</div>
      <footer class="rfoot"><div>صدر من منصة إدارة مشاريع تجمع الأحساء الصحي بتاريخ ${esc(today())} — البيانات كما هي مسجلة في المنصة وقت الإصدار.</div><div class="sig"><div>إعداد: رئيس قسم المشاريع<br><br>الاسم: ...................... التوقيع: ..............</div><div>اعتماد: مدير إدارة الخدمات الفنية<br><br>الاسم: ...................... التوقيع: ..............</div></div></footer>
    </section>
  </div>`;
  $('#rPrint').onclick = () => window.print();
  $('#rPdf').onclick = async () => {
    toast('جارٍ إنشاء ملف PDF…');
    try { await loadLib(); } catch (e) { return err('تعذّر تحميل مكتبة PDF — استخدم «طباعة / حفظ كـ PDF»'); }
    const el = $('#rep'); el.classList.add('pdfmode');
    try { await window.html2pdf().set({ margin: [8, 8, 8, 8], filename: `التقرير التنفيذي - ${today()}.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], before: '.rpage + .rpage' } }).from(el).save(); toast('تم تنزيل التقرير'); } catch (e) { err(e); } finally { el.classList.remove('pdfmode'); }
  };
}
