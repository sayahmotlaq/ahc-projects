// ===== المستخلصات المالية =====
import { sb, canEdit, isAdmin, role, q, session, today } from './api.js';
import { $, $$, esc, money, fmt, dateAr, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';

export const P_STATUS = { draft: 'مسودة', submitted: 'مقدَّم', review: 'قيد المراجعة', approved: 'معتمد', finance: 'محال للمالية', paid: 'مصروف', rejected: 'مرفوض' };
export const P_KIND = { advance: 'دفعة مقدمة', interim: 'مستخلص جارٍ', final: 'مستخلص ختامي', retention_release: 'إفراج عن الضمان' };
const PENDING = ['submitted', 'review', 'approved'];
export const pBadge = s => `<span class="badge ${s === 'paid' ? 'full' : s === 'rejected' ? 'skel' : s === 'draft' ? '' : s === 'finance' ? 'ovr' : 'bad'}">${P_STATUS[s] || s}</span>`;
const isFin = () => role() === 'finance';
const num = v => Number(String(v ?? '').replace(/,/g, '')) || 0;

// نفس معادلة قاعدة البيانات (للمعاينة الفورية)
export function calcPay(f) {
  const work = num(f.work_amount), rp = num(f.retention_pct), vp = num(f.vat_pct);
  const retention = ['advance', 'retention_release'].includes(f.kind) ? 0 : Math.round(work * rp) / 100;
  const vat = Math.round(work * vp) / 100;
  const net = work + vat - retention - num(f.advance_recovery) - num(f.penalty) - num(f.other_deductions);
  return { work, retention, vat, net: Math.round(net * 100) / 100 };
}
// هل يستطيع المستخدم تعديل بيانات المستخلص؟
const canEditPay = pm => isAdmin() || (canEdit() && (!pm || ['draft', 'submitted', 'review', 'rejected'].includes(pm.status)));

// الإجراءات المتاحة حسب الحالة والدور
function actions(pm) {
  const a = []; const s = pm.status;
  if (isAdmin()) {
    if (s === 'draft') a.push(['submitted', 'تقديم المستخلص', 'primary']);
    if (s === 'submitted') a.push(['review', 'بدء المراجعة', 'primary']);
    if (['submitted', 'review'].includes(s)) a.push(['approved', 'اعتماد', 'primary']);
    if (s === 'approved') a.push(['finance', 'إحالة للمالية', 'primary']);
    if (['approved', 'finance'].includes(s)) a.push(['paid', 'تسجيل الصرف', 'primary']);
    if (['submitted', 'review', 'approved', 'finance'].includes(s)) a.push(['rejected', 'رفض / إرجاع', 'danger']);
    if (['rejected', 'submitted'].includes(s)) a.push(['draft', 'إعادة إلى مسودة', '']);
  } else if (canEdit()) {
    if (s === 'draft' || s === 'rejected') a.push(['submitted', 'تقديم المستخلص', 'primary']);
    if (s === 'submitted') a.push(['draft', 'سحب (إعادة إلى مسودة)', '']);
  } else if (isFin()) {
    if (s === 'finance') { a.push(['paid', 'تسجيل الصرف', 'primary']); a.push(['rejected', 'إرجاع للإدارة', 'danger']); }
  }
  return a;
}

async function transition(pm, to, done) {
  const need = to === 'paid' ? `${field('تاريخ الصرف *', inp('paid_on', pm.paid_on || today(), 'type="date" required'))}${field('رقم أمر الدفع / الحوالة', inp('payment_order_no', pm.payment_order_no || ''))}`
    : to === 'rejected' ? field('سبب الرفض / الإرجاع *', `<textarea name="reject_reason" rows="3" required>${esc(pm.reject_reason || '')}</textarea>`, 'wide') : '';
  const label = { submitted: 'تقديم', review: 'بدء المراجعة', approved: 'اعتماد', finance: 'إحالة للمالية', paid: 'تسجيل الصرف', rejected: 'رفض / إرجاع', draft: 'إعادة إلى مسودة' }[to];
  await modal(`<form id="f" class="pgrid"><p class="wide">المستخلص رقم <b>${pm.no}</b> — ${P_KIND[pm.kind]} — الصافي <b>${fmt(pm.net_amount)} ر.س</b><br><span class="muted">الحالة: ${P_STATUS[pm.status]} ← <b>${P_STATUS[to]}</b></span></p>${need}${field('ملاحظة (تُحفظ في سجل المستخلص)', `<textarea name="note" rows="2"></textarea>`, 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn ${to === 'rejected' ? 'danger' : 'primary'}">${label}</button></div></form>`, { title: label + ' — مستخلص ' + pm.no, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
        const row = { status: to };
        if (to === 'submitted') row.submitted_on = today();
        if (to === 'approved') row.approved_on = today();
        if (to === 'finance') row.sent_finance_on = today();
        if (to === 'paid') { row.paid_on = f.paid_on; row.payment_order_no = f.payment_order_no.trim(); }
        if (to === 'rejected') row.reject_reason = f.reject_reason.trim();
        if (to === 'draft') { row.reject_reason = null; }
        try {
          await q(sb.from('payments').update(row).eq('id', pm.id));
          await q(sb.from('payment_log').insert({ payment_id: pm.id, from_status: pm.status, to_status: to, note: (f.note || '').trim() || (to === 'rejected' ? f.reject_reason.trim() : null), by_user: session.user.id }));
          toast('تم: ' + P_STATUS[to]); close(); done();
        } catch (er) { err(er); } };
    } });
}

// ---------- نموذج إنشاء / تعديل
async function payForm(pm, project, existing, done) {
  const editable = canEditPay(pm);
  const nextNo = existing.length ? Math.max(...existing.map(x => x.no)) + 1 : 1;
  const prevCum = existing.filter(x => x.status !== 'rejected' && x.kind !== 'advance' && x.kind !== 'retention_release').reduce((a, x) => a + Number(x.work_amount || 0), 0);
  const v = pm || { no: nextNo, kind: existing.length ? 'interim' : (project.contract_value ? 'interim' : 'interim'), retention_pct: 10, vat_pct: 15, cumulative_work: prevCum, work_amount: 0, advance_recovery: 0, penalty: 0, other_deductions: 0 };
  const dis = editable ? '' : 'disabled';
  const html = `<form id="f" class="pgrid">
    ${field('رقم المستخلص *', inp('no', v.no, `type="number" min="1" required ${dis}`))}
    ${field('النوع', sel('kind', Object.entries(P_KIND), v.kind, dis))}
    ${field('رقم فاتورة المقاول', inp('contractor_invoice_no', v.contractor_invoice_no || '', dis))}
    ${field('الفترة من', inp('period_from', v.period_from || '', `type="date" ${dis}`))}
    ${field('الفترة إلى', inp('period_to', v.period_to || '', `type="date" ${dis}`))}
    ${field('الأعمال المنفذة تراكمياً حتى نهاية الفترة (ر.س)', inp('cumulative_work', v.cumulative_work ?? 0, `type="number" min="0" step="0.01" ${dis}`))}
    ${field('قيمة أعمال هذا المستخلص (ر.س) *', inp('work_amount', v.work_amount ?? 0, `type="number" min="0" step="0.01" required ${dis}`))}
    ${field('نسبة حجز الضمان %', inp('retention_pct', v.retention_pct ?? 10, `type="number" min="0" max="100" step="0.5" ${dis}`))}
    ${field('ضريبة القيمة المضافة %', inp('vat_pct', v.vat_pct ?? 15, `type="number" min="0" max="100" step="0.5" ${dis}`))}
    ${field('استرداد الدفعة المقدمة (ر.س)', inp('advance_recovery', v.advance_recovery ?? 0, `type="number" min="0" step="0.01" ${dis}`))}
    ${field('غرامة تأخير (ر.س)', inp('penalty', v.penalty ?? 0, `type="number" min="0" step="0.01" ${dis}`))}
    ${field('خصومات أخرى (ر.س)', inp('other_deductions', v.other_deductions ?? 0, `type="number" min="0" step="0.01" ${dis}`))}
    ${field('ملاحظات', `<textarea name="notes" rows="2" ${dis}>${esc(v.notes || '')}</textarea>`, 'wide')}
    <div class="wide paycalc" id="pc"></div>
    <div class="btnrow end wide">${pm && (isAdmin() || (canEdit() && pm.status === 'draft')) ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-x>${editable ? 'إلغاء' : 'إغلاق'}</button>${editable ? '<button class="btn primary">حفظ</button>' : ''}</div></form>`;
  await modal(html, { title: pm ? `مستخلص رقم ${pm.no} — ${P_STATUS[pm.status]}` : 'مستخلص جديد', wide: true, onOpen: (w, close) => {
    const form = $('#f', w);
    const preview = () => { const f = formData(form); const c = calcPay(f); const pct = project.contract_value ? Math.round((num(f.cumulative_work) / Number(project.contract_value)) * 100) : null;
      $('#pc', w).innerHTML = `<div class="kvs"><div class="kv"><span>قيمة الأعمال</span><b>${fmt(c.work)}</b></div><div class="kv"><span>+ الضريبة</span><b>${fmt(c.vat)}</b></div><div class="kv"><span>− حجز الضمان</span><b>${fmt(c.retention)}</b></div><div class="kv"><span>− استرداد المقدمة</span><b>${fmt(num(f.advance_recovery))}</b></div><div class="kv"><span>− غرامات وخصومات</span><b>${fmt(num(f.penalty) + num(f.other_deductions))}</b></div><div class="kv net"><span>الصافي المستحق</span><b>${fmt(c.net)} ر.س</b></div></div>${pct !== null ? `<p class="muted small">الإنجاز المالي التراكمي ${pct}% من قيمة العقد (${money(project.contract_value)} ر.س)${project.progress_actual != null && project.stage === 'execution' && pct > Number(project.progress_actual) + 10 ? ' — <b class="bad">تنبيه: الإنجاز المالي يفوق الإنجاز الفعلي (' + project.progress_actual + '%) بأكثر من 10%</b>' : ''}</p>` : ''}`; };
    form.oninput = preview; preview();
    form.onsubmit = async e => { e.preventDefault(); const f = formData(form);
      const row = { project_id: project.id, no: num(f.no), kind: f.kind, contractor_invoice_no: f.contractor_invoice_no.trim(), period_from: f.period_from || null, period_to: f.period_to || null, cumulative_work: num(f.cumulative_work), work_amount: num(f.work_amount), retention_pct: num(f.retention_pct), vat_pct: num(f.vat_pct), advance_recovery: num(f.advance_recovery), penalty: num(f.penalty), other_deductions: num(f.other_deductions), notes: f.notes.trim() };
      if (existing.some(x => x.no === row.no && x.id !== pm?.id)) return err('رقم المستخلص مستخدم مسبقاً في هذا المشروع');
      try {
        if (pm) await q(sb.from('payments').update(row).eq('id', pm.id));
        else { const c = calcPay(row); const ins = await q(sb.from('payments').insert({ ...row, ...{ retention_amount: c.retention, vat_amount: c.vat, net_amount: c.net }, status: 'draft', created_by: session.user.id }).select('id').single()); await q(sb.from('payment_log').insert({ payment_id: ins.id, from_status: null, to_status: 'draft', note: 'إنشاء المستخلص', by_user: session.user.id })); }
        toast('تم الحفظ'); close(); done();
      } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف هذا المستخلص نهائياً؟', 'حذف', true)) return; try { await q(sb.from('payments').delete().eq('id', pm.id)); close(); done(); } catch (er) { err(er); } };
  } });
}

// ---------- بطاقة تفاصيل المستخلص (مع السجل والإجراءات)
async function payDetail(pm, project, existing, done) {
  const log = await q(sb.from('payment_log').select('*').eq('payment_id', pm.id).order('id'));
  const profs = await q(sb.from('profiles').select('id,full_name'));
  const nm = id => profs.find(p => p.id === id)?.full_name || '—';
  const acts = actions(pm);
  const V = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  await modal(`<div class="kvs">${V('المشروع', esc(project.name))}${V('النوع', P_KIND[pm.kind])}${V('الحالة', pBadge(pm.status))}${V('الفترة', `${dateAr(pm.period_from)} → ${dateAr(pm.period_to)}`)}${V('فاتورة المقاول', esc(pm.contractor_invoice_no || '—'))}${V('الأعمال التراكمية', fmt(pm.cumulative_work) + ' ر.س')}${V('قيمة أعمال المستخلص', fmt(pm.work_amount))}${V('الضريبة ' + pm.vat_pct + '%', fmt(pm.vat_amount))}${V('حجز الضمان ' + pm.retention_pct + '%', '− ' + fmt(pm.retention_amount))}${V('استرداد المقدمة', '− ' + fmt(pm.advance_recovery))}${V('غرامة / خصومات', '− ' + fmt(Number(pm.penalty) + Number(pm.other_deductions)))}<div class="kv net"><span>الصافي المستحق</span><b>${fmt(pm.net_amount)} ر.س</b></div></div>
    <div class="kvs" style="margin-top:8px">${V('تاريخ التقديم', dateAr(pm.submitted_on))}${V('تاريخ الاعتماد', dateAr(pm.approved_on))}${V('الإحالة للمالية', dateAr(pm.sent_finance_on))}${V('تاريخ الصرف', dateAr(pm.paid_on))}${V('أمر الدفع', esc(pm.payment_order_no || '—'))}${pm.reject_reason ? V('سبب الرفض', `<span class="bad">${esc(pm.reject_reason)}</span>`) : ''}</div>
    ${pm.notes ? `<p class="pre">${esc(pm.notes)}</p>` : ''}
    <h3 class="sub-h">سجل الإجراءات</h3>${log.length ? `<table class="lst"><thead><tr><th>التاريخ</th><th>الإجراء</th><th>بواسطة</th><th>ملاحظة</th></tr></thead><tbody>${log.map(l => `<tr><td>${dateAr(l.at)}</td><td>${l.from_status ? P_STATUS[l.from_status] + ' ← ' : ''}${P_STATUS[l.to_status] || l.to_status}</td><td>${esc(nm(l.by_user))}</td><td class="muted">${esc(l.note || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">—</p>'}
    <div class="btnrow end" style="margin-top:12px">${canEditPay(pm) ? '<button class="btn" data-edit>تعديل البيانات</button>' : ''}<span style="flex:1"></span>${acts.map(([to, l, c]) => `<button class="btn ${c}" data-to="${to}">${l}</button>`).join('')}<button class="btn" data-x>إغلاق</button></div>`, { title: `مستخلص رقم ${pm.no}`, wide: true, onOpen: (w, close) => {
      $$('[data-to]', w).forEach(b => b.onclick = () => { close(); transition(pm, b.getAttribute('data-to'), done); });
      const ed = $('[data-edit]', w); if (ed) ed.onclick = () => { close(); payForm(pm, project, existing, done); };
    } });
}

// ---------- ملخص مالي للمشروع
export function paySummary(p, rows) {
  const live = rows.filter(r => r.status !== 'rejected');
  const paid = rows.filter(r => r.status === 'paid');
  const certified = live.filter(r => !['advance', 'retention_release'].includes(r.kind)).reduce((a, r) => a + Number(r.work_amount || 0), 0);
  const paidNet = paid.reduce((a, r) => a + Number(r.net_amount || 0), 0);
  const pending = live.filter(r => PENDING.includes(r.status) || r.status === 'finance').reduce((a, r) => a + Number(r.net_amount || 0), 0);
  const retention = live.filter(r => ['approved', 'finance', 'paid'].includes(r.status)).reduce((a, r) => a + Number(r.retention_amount || 0), 0) - live.filter(r => r.kind === 'retention_release' && ['approved', 'finance', 'paid'].includes(r.status)).reduce((a, r) => a + Number(r.work_amount || 0), 0);
  const cv = Number(p.contract_value || 0); const totalPaid = Number(p.paid_opening || 0) + paidNet;
  const finPct = cv ? Math.round(certified / cv * 100) : null; const paidPct = cv ? Math.round(totalPaid / cv * 100) : null;
  const prog = Number(p.progress_actual || 0);
  const warn = finPct !== null && p.stage === 'execution' && finPct > prog + 10;
  return { certified, paidNet, pending, retention, cv, totalPaid, finPct, paidPct, warn, prog, html: `<div class="kpis fin"><div class="kpi"><b>${money(cv)}</b><span>قيمة العقد (ر.س)</span></div><div class="kpi"><b>${money(Math.round(certified))}</b><span>أعمال مُستخلصة تراكمياً${finPct !== null ? ` · ${finPct}%` : ''}</span></div><div class="kpi ${pending ? 'bad' : ''}"><b>${money(Math.round(pending))}</b><span>قيد الاعتماد / لدى المالية</span></div><div class="kpi"><b>${money(Math.round(totalPaid))}</b><span>المصروف${paidPct !== null ? ` · ${paidPct}%` : ''}${p.paid_opening ? ` <small>(منها ${money(p.paid_opening)} رصيد سابق)</small>` : ''}</span></div><div class="kpi"><b>${cv ? money(Math.round(cv - totalPaid)) : '—'}</b><span>المتبقي من العقد</span></div><div class="kpi"><b>${money(Math.round(retention))}</b><span>ضمان محتجز</span></div></div>${warn ? `<div class="alert bad">⚠ الإنجاز المالي (${finPct}%) يفوق الإنجاز الفعلي (${prog}%) بأكثر من 10% — يُنصح بمراجعة نسب الأعمال قبل الاعتماد.</div>` : ''}` };
}

function payRows(rows, opts = {}) {
  return `<table class="lst"><thead><tr>${opts.project ? '<th>المشروع</th>' : ''}<th class="c">رقم</th><th>النوع</th><th>الفترة</th><th class="c">قيمة الأعمال</th><th class="c">الخصومات</th><th class="c">الصافي</th><th>الحالة</th><th>آخر تاريخ</th><th></th></tr></thead><tbody>${rows.map(r => { const ded = Number(r.retention_amount) + Number(r.advance_recovery) + Number(r.penalty) + Number(r.other_deductions); const last = r.paid_on || r.sent_finance_on || r.approved_on || r.submitted_on || r.created_at; return `<tr class="${r.status === 'rejected' ? 'off' : ''}">${opts.project ? `<td><a href="#/project/${r.project_id}/payments">${esc(r.projects?.name || '')}</a></td>` : ''}<td class="c"><b>${r.no}</b></td><td>${P_KIND[r.kind]}</td><td class="muted">${r.period_from ? dateAr(r.period_from) + ' → ' + dateAr(r.period_to) : '—'}</td><td class="c n">${fmt(r.work_amount)}</td><td class="c n muted">${ded ? '− ' + fmt(ded) : '—'}</td><td class="c n"><b>${fmt(r.net_amount)}</b></td><td>${pBadge(r.status)}</td><td class="muted">${dateAr(last)}</td><td><button class="btn sm" data-p="${r.id}">فتح</button></td></tr>`; }).join('')}</tbody>${opts.totals ? `<tfoot><tr><td colspan="${opts.project ? 4 : 3}"><b>الإجمالي (${rows.length})</b></td><td class="c n"><b>${fmt(rows.reduce((a, r) => a + Number(r.work_amount), 0))}</b></td><td></td><td class="c n"><b>${fmt(rows.reduce((a, r) => a + Number(r.net_amount), 0))}</b></td><td colspan="3"></td></tr></tfoot>` : ''}</table>`;
}

// ---------- تبويب المشروع
export async function projectPayments(t, p) {
  const rows = await q(sb.from('payments').select('*').eq('project_id', p.id).order('no'));
  const s = paySummary(p, rows);
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>المستخلصات المالية <span class="muted">(${rows.length})</span></h2><span style="flex:1"></span>${canEdit() ? '<button class="btn primary" id="pmNew">＋ مستخلص جديد</button>' : ''}</div>${s.html}${rows.length ? payRows(rows, { totals: true }) : '<p class="muted">لا توجد مستخلصات على هذا المشروع بعد.</p>'}</div>`;
  if (canEdit()) $('#pmNew').onclick = () => payForm(null, p, rows, () => projectPayments(t, p));
  $$('[data-p]', t).forEach(b => b.onclick = () => payDetail(rows.find(x => x.id === +b.getAttribute('data-p')), p, rows, () => projectPayments(t, p)));
}

// ---------- الصفحة العامة
export async function mountPayments(root, params) {
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">المستخلصات المالية</h1></div>
    <div class="filters"><input id="fq" placeholder="بحث باسم المشروع أو رقم الفاتورة…"><select id="fSt"><option value="">قيد الإجراء (مقدَّم → لدى المالية)</option><option value="all">الكل</option>${Object.entries(P_STATUS).map(([k, v]) => `<option value="${k}" ${params.get('st') === k ? 'selected' : ''}>${v}</option>`).join('')}</select><select id="fK"><option value="">كل الأنواع</option>${Object.entries(P_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div id="kp"></div><div id="pl"><p class="muted">…</p></div>`;
  const all = await q(sb.from('payments').select('*, projects(name,contract_value)').order('id', { ascending: false }));
  const sum = arr => arr.reduce((a, r) => a + Number(r.net_amount || 0), 0);
  const pend = all.filter(r => PENDING.includes(r.status)), fin = all.filter(r => r.status === 'finance'), paid = all.filter(r => r.status === 'paid');
  const thisYear = paid.filter(r => (r.paid_on || '').startsWith(String(new Date().getFullYear())));
  $('#kp').innerHTML = `<div class="kpis"><a class="kpi ${pend.length ? 'bad' : ''}" href="#/payments?st=submitted"><b>${pend.length}</b><span>قيد الاعتماد · ${money(Math.round(sum(pend)))} ر.س</span></a><a class="kpi ${fin.length ? 'bad' : ''}" href="#/payments?st=finance"><b>${fin.length}</b><span>لدى المالية · ${money(Math.round(sum(fin)))} ر.س</span></a><div class="kpi"><b>${money(Math.round(sum(thisYear)))}</b><span>مصروف هذا العام (${thisYear.length} مستخلص)</span></div><div class="kpi"><b>${money(Math.round(sum(paid)))}</b><span>إجمالي المصروف عبر المستخلصات</span></div></div>`;
  const render = () => { const qs = $('#fq').value.toLowerCase(), st = $('#fSt').value, k = $('#fK').value;
    const rows = all.filter(r => (st === 'all' || (st ? r.status === st : [...PENDING, 'finance'].includes(r.status))) && (!k || r.kind === k) && (!qs || ((r.projects?.name || '') + ' ' + (r.contractor_invoice_no || '') + ' ' + (r.payment_order_no || '')).toLowerCase().includes(qs)));
    $('#pl').innerHTML = rows.length ? `<div class="pcard" style="padding:0;overflow:auto">${payRows(rows, { project: true, totals: true })}</div>` : '<div class="empty-boq">لا توجد مستخلصات مطابقة</div>';
    $$('[data-p]', root).forEach(b => b.onclick = async () => { const r = all.find(x => x.id === +b.getAttribute('data-p')); const proj = await q(sb.from('projects').select('*').eq('id', r.project_id).single()); const ex = all.filter(x => x.project_id === r.project_id); payDetail(r, proj, ex, () => mountPayments(root, params)); }); };
  if (params.get('st')) $('#fSt').value = params.get('st');
  ['fq', 'fSt', 'fK'].forEach(id => $('#' + id).oninput = render); render();
}
