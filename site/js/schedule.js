// ===== الجدول الزمني: حزم الأعمال والمعالم، منحنى S، الخط الأساس =====
import { sb, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico, calBtn, bindCal } from './ui.js';

const D1 = 864e5;
const dstr = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s); d.setDate(d.getDate() + n); return dstr(d); };
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / D1);
// نفس معادلة قاعدة البيانات
export function calc(items, day = today()) {
  const pk = items.filter(i => i.kind === 'package'); const tw = pk.reduce((a, i) => a + Number(i.weight || 0), 0);
  if (!tw) return { planned: null, actual: null };
  let pl = 0, ac = 0;
  pk.forEach(i => { let f = 0; if (i.planned_start && i.planned_end) { if (day >= i.planned_end) f = 1; else if (day <= i.planned_start) f = 0; else f = days(i.planned_start, day) / Math.max(1, days(i.planned_start, i.planned_end)); } pl += Number(i.weight) * f; ac += Number(i.weight) * Number(i.pct || 0) / 100; });
  return { planned: Math.round(pl / tw * 1000) / 10, actual: Math.round(ac / tw * 1000) / 10 };
}
const TEMPLATES = {
  'توريد وتركيب': [['التصنيع والتوريد', 40], ['التركيب', 35], ['الاختبارات والتشغيل', 15], ['التدريب والتسليم', 10]],
  'تجديد وتأهيل': [['الإزالة والتجهيز', 10], ['الأعمال الإنشائية', 20], ['الميكانيكية والتكييف', 25], ['الكهربائية والتيار الخفيف', 20], ['التشطيبات', 20], ['التشغيل والتسليم', 5]],
  'إنشاء جديد': [['التجهيز والأعمال المؤقتة', 5], ['الأعمال الترابية والأساسات', 12], ['الهيكل الإنشائي', 23], ['الأعمال الميكانيكية', 15], ['الأعمال الكهربائية', 12], ['التشطيبات الداخلية', 18], ['الواجهات والأعمال الخارجية', 10], ['التشغيل والتسليم', 5]],
  'توسعة': [['التجهيز والربط بالقائم', 8], ['الأساسات والهيكل', 27], ['الأعمال الميكانيكية', 15], ['الأعمال الكهربائية', 12], ['التشطيبات', 23], ['الأعمال الخارجية', 10], ['التشغيل والتسليم', 5]],
  'صيانة وإصلاح': [['الحصر والتجهيز', 15], ['التنفيذ', 70], ['الاختبار والتسليم', 15]],
  'أعمال خارجية': [['تجهيز الموقع', 15], ['الأعمال المدنية', 45], ['التركيبات', 30], ['التسليم', 10]],
  'دراسة': [['جمع البيانات والرفع', 30], ['التصميم المبدئي', 30], ['التصميم التفصيلي والمواصفات', 30], ['التسليم', 10]],
};
const MS_TEMPLATES = ['المباشرة الفعلية', 'وصول التوريدات الرئيسية', 'اكتمال الأعمال الرئيسية', 'التشغيل التجريبي', 'الاستلام الابتدائي'];

export async function projectSchedule(t, p) {
  const [items, snaps] = await Promise.all([q(sb.from('schedule_items').select('*').eq('project_id', p.id).order('planned_start', { ascending: true, nullsFirst: false }).order('planned_end')), q(sb.from('schedule_snapshots').select('*').eq('project_id', p.id).order('on_date'))]);
  const own = isAdmin() || (canEdit() && p.engineer_id === session.user.id);
  const pk = items.filter(i => i.kind === 'package'), ms = items.filter(i => i.kind === 'milestone');
  const tw = pk.reduce((a, i) => a + Number(i.weight || 0), 0);
  const c = calc(items); const pStart = pk.length ? pk.map(i => i.planned_start).filter(Boolean).sort()[0] : p.start_date; const pEnd = pk.length ? pk.map(i => i.planned_end).filter(Boolean).sort().slice(-1)[0] : (p.revised_end_date || p.end_date);
  // الانحراف بالأيام: متى كان يجب أن نصل للفعلي الحالي؟
  let delayDays = null, forecast = null;
  if (c.planned !== null && pStart && pEnd) { let d = pStart; const end = addDays(pEnd, 400); while (d <= end && calc(items, d).planned < c.actual) d = addDays(d, 1); delayDays = c.actual >= 100 ? 0 : (c.actual === 0 && today() <= pStart) ? 0 : days(d, today()); forecast = delayDays > 0 ? addDays(pEnd, delayDays) : pEnd; }
  const lateMs = ms.filter(m => !m.actual_end && m.planned_end && m.planned_end < today());
  const staleP = pk.filter(i => i.pct > 0 && i.pct < 100 && i.pct_updated_at && days(i.pct_updated_at.slice(0, 10), today()) > 30);
  const baselined = !!p.schedule_baseline_at;
  const sched = p.progress_mode === 'schedule';
  const hasGuide = !items.length;
  t.innerHTML = `<div class="sched">
    <div class="toolbar"><h2 class="m0">الجدول الزمني ${baselined ? '<span class="badge full">خط أساس معتمد ' + dateAr(p.schedule_baseline_at) + '</span>' : items.length ? '<span class="badge ovr">مسودة — لم يُعتمد الخط الأساس</span>' : ''}</h2><span class="sp"></span><button class="btn" id="sGuide">${ico('book')} كيف أستخدمه؟</button>${own ? `<button class="btn" id="sTpl">قالب جاهز</button><button class="btn" id="sPaste">لصق من Excel</button><button class="btn" id="sMs">＋ معلم</button><button class="btn primary" id="sPk">＋ حزمة أعمال</button>` : ''}</div>
    <div id="sGuideBox" class="pcard guide" ${hasGuide ? '' : 'hidden'}>${guideHtml()}</div>
    ${items.length ? `<div class="kpis hero" style="margin-top:0"><div class="kpi"><span>المخطط اليوم</span><b>${c.planned}%</b><span>يتحرك يومياً من تواريخ الحزم</span></div><div class="kpi"><span>الفعلي من الجدول</span><b>${c.actual}%</b><span>من نسب الحزم × أوزانها</span></div><div class="kpi ${c.planned !== null && c.actual < c.planned - 5 ? 'bad' : ''}"><span>الانحراف</span><b>${c.planned === null ? '—' : (c.actual - c.planned > 0 ? '+' : '') + (Math.round((c.actual - c.planned) * 10) / 10)} <small>نقطة</small></b><span>${delayDays !== null ? (delayDays > 0 ? `متأخر ${delayDays} يوماً` : delayDays < 0 ? `متقدم ${-delayDays} يوماً` : 'على الجدول') : ''}</span></div><div class="kpi"><span>الانتهاء المتوقع</span><b style="font-size:18px">${forecast ? dateAr(forecast) : '—'}</b><span>المخطط ${dateAr(pEnd)}</span></div><div class="kpi ${lateMs.length ? 'bad' : ''}"><span>معالم متأخرة</span><b>${lateMs.length}</b><span>من ${ms.length}</span></div></div>
    ${Math.round(tw) !== 100 ? `<div class="alert warn">مجموع أوزان الحزم ${Math.round(tw * 10) / 10}% — يُفضّل أن يكون 100% حتى تكون النسب دقيقة (المنصة تحسب النسب من مجموع الأوزان الحالي).</div>` : ''}
    ${staleP.length ? `<div class="alert warn">⏳ ${staleP.length} حزمة جارية لم تُحدَّث نسبتها منذ أكثر من 30 يوماً: ${staleP.map(i => esc(i.name)).join('، ')}</div>` : ''}
    <div class="pcard"><div class="toolbar" style="margin:0 0 8px"><h2 class="m0">مصدر نسبة الإنجاز في المشروع</h2><span class="sp"></span>${own ? `<select id="sMode"><option value="manual" ${!sched ? 'selected' : ''}>يدوي (كما هو الآن) — الجدول مؤشر موازٍ</option><option value="schedule" ${sched ? 'selected' : ''}>من الجدول الزمني — تُحدَّث النسب تلقائياً</option></select>` : `<b>${sched ? 'من الجدول الزمني' : 'يدوي'}</b>`}</div><p class="m0 muted small" >حالياً: الإنجاز الفعلي المسجل يدوياً <b>${p.progress_actual || 0}%</b> والمخطط <b>${p.progress_planned || 0}%</b>${c.planned !== null ? ` · ومن الجدول: فعلي <b>${c.actual}%</b> ومخطط <b>${c.planned}%</b>` : ''}. عندما تطمئن للجدول حوّل المصدر إليه فتتحدث نسب المشروع والتقارير منه تلقائياً كل يوم.</p></div>
    <div class="pcard"><h2>منحنى الإنجاز (S-Curve)</h2>${scurve(items, snaps, pStart, pEnd, p)}</div>
    <div class="flat pcard" >${gantt(items, pStart, pEnd, own)}</div>
    <div class="mt10 btnrow" >${isAdmin() && items.length ? (baselined ? '<button class="btn" id="sShift">إزاحة الجدول (بعد تمديد)</button><button class="btn" id="sUnbase">إلغاء اعتماد الخط الأساس</button>' : '<button class="btn primary" id="sBase">اعتماد الخط الأساس</button>') : ''}</div>` : ''}
  </div>`;
  const reload = async () => { const np = await q(sb.from('projects').select('*').eq('id', p.id).single()); Object.assign(p, np); projectSchedule(t, p); };
  bindCal(t);
  $('#sGuide').onclick = () => { const g = $('#sGuideBox'); g.hidden = !g.hidden; if (!g.hidden) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if (own) {
    $('#sPk').onclick = () => itemForm(null, 'package', p, items, reload);
    $('#sMs').onclick = () => itemForm(null, 'milestone', p, items, reload);
    $('#sTpl').onclick = () => templateForm(p, items, reload);
    $('#sPaste').onclick = () => pasteForm(p, items, reload);
    $$('[data-si]', t).forEach(el => el.onclick = () => itemForm(items.find(x => x.id === +el.getAttribute('data-si')), null, p, items, reload));
    $$('[data-pct]', t).forEach(el => el.onchange = async () => { const it = items.find(x => x.id === +el.getAttribute('data-pct')); let v = Math.max(0, Math.min(100, Number(el.value) || 0)); const row = { pct: v }; if (v > 0 && !it.actual_start) row.actual_start = today(); if (v >= 100 && !it.actual_end) row.actual_end = today(); if (v < 100) row.actual_end = null; try { await q(sb.from('schedule_items').update(row).eq('id', it.id)); toast('تم تحديث ' + it.name); reload(); } catch (e) { err(e); } });
    $$('[data-msdone]', t).forEach(el => el.onclick = async () => { const it = items.find(x => x.id === +el.getAttribute('data-msdone')); const d = it.actual_end ? null : today(); try { await q(sb.from('schedule_items').update({ actual_end: d, pct: d ? 100 : 0 }).eq('id', it.id)); reload(); } catch (e) { err(e); } });
    const sm = $('#sMode'); if (sm) sm.onchange = async () => { const m = sm.value; if (m === 'schedule' && c.planned === null) { sm.value = 'manual'; return err('أضف حزم أعمال أولاً'); } if (!await confirm(m === 'schedule' ? 'سيُستبدل الإنجاز اليدوي بالمحسوب من الجدول وتتحدث نسب المشروع تلقائياً. متابعة؟' : 'العودة للإدخال اليدوي؟', 'تأكيد')) { sm.value = p.progress_mode || 'manual'; return; } try { const upd = { progress_mode: m }; if (m === 'schedule') { upd.progress_planned = Math.round(c.planned); upd.progress_actual = Math.round(c.actual); } await q(sb.from('projects').update(upd).eq('id', p.id)); toast('تم'); reload(); } catch (e) { err(e); } };
  }
  const sb1 = $('#sBase'); if (sb1) sb1.onclick = async () => { if (!await confirm(`اعتماد الخط الأساس: تُثبَّت التواريخ والأوزان الحالية مرجعاً للمقارنة، ولا يستطيع المهندس تعديل المخطط بعدها إلا بأمر تمديد أو موافقتك. المجموع الحالي للأوزان ${Math.round(tw)}%.`, 'اعتماد')) return; try { for (const it of items) await q(sb.from('schedule_items').update({ baseline_start: it.planned_start, baseline_end: it.planned_end }).eq('id', it.id)); await q(sb.from('projects').update({ schedule_baseline_at: new Date().toISOString(), schedule_baseline_by: session.user.id }).eq('id', p.id)); toast('اعتُمد الخط الأساس'); reload(); } catch (e) { err(e); } };
  const su = $('#sUnbase'); if (su) su.onclick = async () => { if (!await confirm('إلغاء اعتماد الخط الأساس يسمح بتعديل المخطط بحرية. متابعة؟', 'إلغاء الاعتماد', true)) return; await q(sb.from('projects').update({ schedule_baseline_at: null, schedule_baseline_by: null }).eq('id', p.id)); reload(); };
  const sh = $('#sShift'); if (sh) sh.onclick = () => modal(`<form id="f" class="pgrid">${field('عدد أيام الإزاحة', inp('days', p.extra_days || 0, 'type="number" required'))}${field('ابتداءً من', inp('from', today(), 'type="date"'))}<p class="wide muted small">تُزاح نهايات الحزم والمعالم غير المنتهية بعد هذا التاريخ بعدد الأيام، ويبقى الخط الأساس الأصلي للمقارنة.</p><div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إزاحة</button></div></form>`, { title: 'إزاحة الجدول بعد تمديد', onOpen: (w, close) => { $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { const { error } = await sb.rpc('shift_schedule', { pid: p.id, p_days: Number(f.days), p_from: f.from || today() }); if (error) throw error; toast('تمت الإزاحة'); close(); reload(); } catch (er) { err(er); } }; } });
}

// ---------- منحنى S
function scurve(items, snaps, pStart, pEnd, p) {
  if (!pStart || !pEnd) return '<p class="muted">حدد تواريخ الحزم لعرض المنحنى.</p>';
  const W = 760, H = 240, L = 44, R = 16, T = 14, B = 34; const x0 = new Date(pStart), x1 = new Date(Math.max(new Date(pEnd), new Date())); const span = Math.max(1, x1 - x0);
  const X = d => L + (new Date(d) - x0) / span * (W - L - R), Y = v => T + (100 - v) / 100 * (H - T - B);
  const pts = []; for (let d = new Date(x0); d <= x1; d.setDate(d.getDate() + Math.max(1, Math.round(span / D1 / 60)))) pts.push([X(d), Y(calc(items, dstr(d)).planned)]); pts.push([X(x1), Y(calc(items, dstr(x1)).planned)]);
  const act = snaps.filter(s => s.on_date <= today()).map(s => [X(s.on_date), Y(Number(s.actual))]); const cnow = calc(items); if (cnow.actual !== null) act.push([X(today()), Y(cnow.actual)]);
  const months = []; for (let d = new Date(x0.getFullYear(), x0.getMonth(), 1); d <= x1; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
  const step = Math.ceil(months.length / 10);
  return `<svg viewBox="0 0 ${W} ${H}" class="scurve" style="width:100%;height:auto;direction:ltr">
    ${[0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line2)"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--muted)">${v}%</text>`).join('')}
    ${months.filter((m, i) => i % step === 0).map(m => `<text x="${X(m)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--muted)">${m.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', year: '2-digit' })}</text>`).join('')}
    <line x1="${X(today())}" x2="${X(today())}" y1="${T}" y2="${H - B}" stroke="var(--gold)" stroke-dasharray="4 3"/><text x="${X(today())}" y="${T - 2}" font-size="10" text-anchor="middle" fill="var(--gold)">اليوم</text>
    <polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="var(--faint)" stroke-width="2"/>
    ${act.length > 1 ? `<polyline points="${act.map(q => q.join(',')).join(' ')}" fill="none" stroke="var(--lblue)" stroke-width="2.5"/>` : ''}${act.length ? `<circle cx="${act[act.length - 1][0]}" cy="${act[act.length - 1][1]}" r="4" fill="var(--lblue)"/>` : ''}
    ${items.filter(i => i.kind === 'milestone' && i.planned_end).map(m => `<path d="M${X(m.planned_end)} ${H - B - 8} l5 5 -5 5 -5 -5z" fill="${m.actual_end ? 'var(--sage)' : m.planned_end < today() ? 'var(--red)' : 'var(--navy)'}"><title>${esc(m.name)}</title></path>`).join('')}
    <g font-size="10"><rect x="${L + 6}" y="${T + 4}" width="12" height="3" fill="var(--faint)"/><text x="${L + 22}" y="${T + 9}" fill="var(--muted)">المخطط</text><rect x="${L + 70}" y="${T + 4}" width="12" height="3" fill="var(--lblue)"/><text x="${L + 86}" y="${T + 9}" fill="var(--muted)">الفعلي</text></g></svg>`;
}
// ---------- الجدول الزمني (Gantt مبسط)
function gantt(items, pStart, pEnd, own) {
  if (!pStart || !pEnd) return '<p class="muted" style="padding:16px">—</p>';
  const x0 = new Date(pStart), x1 = new Date(Math.max(new Date(pEnd), new Date())); const span = Math.max(1, x1 - x0);
  const pos = d => Math.max(0, Math.min(100, (new Date(d) - x0) / span * 100));
  const months = []; for (let d = new Date(x0.getFullYear(), x0.getMonth(), 1); d <= x1; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
  const rows = [...items].sort((a, b) => (a.planned_start || a.planned_end || '').localeCompare(b.planned_start || b.planned_end || ''));
  return `<table class="lst gantt"><thead><tr><th style="min-width:220px">البند</th><th class="c">الوزن</th><th class="c">الإنجاز</th><th style="min-width:360px"><div class="gt-months">${months.map(m => `<span style="left:${pos(m)}%">${m.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short' })}</span>`).join('')}<i class="gt-today" style="left:${pos(today())}%"></i></div></th><th>المخطط</th><th>الفعلي</th><th></th></tr></thead><tbody>${rows.map(i => {
    const late = !i.actual_end && i.planned_end && i.planned_end < today() && (i.kind === 'milestone' || Number(i.pct) < 100);
    if (i.kind === 'milestone') return `<tr class="ms"><td><b>◆ ${esc(i.name)}</b><br><small class="muted">معلم</small></td><td class="c">—</td><td class="c">${i.actual_end ? '<span class="badge full">تحقق</span>' : late ? '<span class="badge bad">متأخر</span>' : '<span class="badge skel">قادم</span>'}</td><td><div class="gt-track"><i class="gt-today" style="left:${pos(today())}%"></i>${i.planned_end ? `<span class="gt-ms ${i.actual_end ? 'ok' : late ? 'late' : ''}" style="left:${pos(i.planned_end)}%" title="${esc(i.name)}"></span>` : ''}${i.actual_end ? `<span class="gt-ms act" style="left:${pos(i.actual_end)}%"></span>` : ''}</div></td><td>${dateAr(i.planned_end)}${i.baseline_end && i.baseline_end !== i.planned_end ? `<br><small class="muted">أساس ${dateAr(i.baseline_end)}</small>` : ''}</td><td>${i.actual_end ? dateAr(i.actual_end) : '—'}</td><td class="c" style="white-space:nowrap">${own ? `<button class="btn sm ${i.actual_end ? '' : 'primary'}" data-msdone="${i.id}">${i.actual_end ? 'تراجع' : 'تحقق'}</button> <button class="btn sm ghost" data-si="${i.id}">${ico('edit')}</button> ` : ''}${i.planned_end && !i.actual_end ? `<button type="button" class="btn sm ghost" title="أضف إلى التقويم" data-cal="${esc(JSON.stringify({ uid: 'ms-' + i.id, title: '◆ معلم: ' + i.name, date: i.planned_end, desc: '', url: '' }))}">${ico('clock')}</button>` : ''}</td></tr>`;
    const w = i.planned_start && i.planned_end ? Math.max(0.5, pos(i.planned_end) - pos(i.planned_start)) : 0;
    return `<tr><td><b>${esc(i.name)}</b>${i.note ? `<br><small class="muted">${esc(i.note)}</small>` : ''}</td><td class="c">${Number(i.weight)}%</td><td class="c">${own ? `<input class="pct-in" type="number" min="0" max="100" step="1" value="${Number(i.pct || 0)}" data-pct="${i.id}">` : `<b>${Number(i.pct || 0)}%</b>`}</td><td><div class="gt-track"><i class="gt-today" style="left:${pos(today())}%"></i>${w ? `<div class="gt-bar ${late ? 'late' : ''}" style="left:${pos(i.planned_start)}%;width:${w}%"><i style="width:${Number(i.pct || 0)}%"></i></div>` : ''}${i.baseline_start && (i.baseline_start !== i.planned_start || i.baseline_end !== i.planned_end) ? `<div class="gt-base" style="left:${pos(i.baseline_start)}%;width:${Math.max(0.5, pos(i.baseline_end) - pos(i.baseline_start))}%"></div>` : ''}</div></td><td>${dateAr(i.planned_start)} ← ${dateAr(i.planned_end)}</td><td>${i.actual_start ? dateAr(i.actual_start) + ' ← ' + (i.actual_end ? dateAr(i.actual_end) : '…') : '—'}</td><td class="c">${own ? `<button class="btn sm ghost" data-si="${i.id}">${ico('edit')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`;
}
// ---------- نماذج
async function itemForm(it, kind, p, items, done) {
  kind = it?.kind || kind; const v = it || { weight: 0, pct: 0 };
  await modal(`<form id="f" class="pgrid">${field('الاسم *', inp('name', v.name || '', 'required'), 'wide')}
    ${kind === 'package' ? `${field('الوزن % من المشروع *', inp('weight', v.weight ?? 0, 'type="number" min="0" max="100" step="0.5" required'))}${field('البداية المخططة *', inp('planned_start', v.planned_start || p.start_date || '', 'type="date" required'))}${field('النهاية المخططة *', inp('planned_end', v.planned_end || '', 'type="date" required'))}${field('نسبة الإنجاز الحالية %', inp('pct', v.pct ?? 0, 'type="number" min="0" max="100" step="1"'))}${field('البداية الفعلية', inp('actual_start', v.actual_start || '', 'type="date"'))}${field('النهاية الفعلية', inp('actual_end', v.actual_end || '', 'type="date"'))}` : `${field('التاريخ المخطط *', inp('planned_end', v.planned_end || '', 'type="date" required'))}${field('تاريخ التحقق الفعلي', inp('actual_end', v.actual_end || '', 'type="date"'))}`}
    ${field('ملاحظة', inp('note', v.note || ''), 'wide')}
    <div class="btnrow end wide">${it ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: it ? 'تعديل ' + (kind === 'package' ? 'حزمة أعمال' : 'معلم') : (kind === 'package' ? 'حزمة أعمال جديدة' : 'معلم جديد'), wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
        const row = { project_id: p.id, kind, name: f.name.trim(), note: f.note.trim(), planned_end: f.planned_end || null, actual_end: f.actual_end || null };
        if (kind === 'package') { Object.assign(row, { weight: Number(f.weight) || 0, planned_start: f.planned_start || null, pct: Math.max(0, Math.min(100, Number(f.pct) || 0)), actual_start: f.actual_start || null }); if (row.planned_start && row.planned_end && row.planned_end < row.planned_start) return err('النهاية قبل البداية'); if (row.pct >= 100 && !row.actual_end) row.actual_end = today(); if (row.pct > 0 && !row.actual_start) row.actual_start = today(); }
        else { row.weight = 0; row.pct = f.actual_end ? 100 : 0; }
        try { if (it) await q(sb.from('schedule_items').update(row).eq('id', it.id)); else await q(sb.from('schedule_items').insert({ ...row, sort: items.length + 1, created_by: session.user.id })); toast('تم الحفظ'); close(); done(); } catch (er) { err(er); } };
      const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف البند؟', 'حذف', true)) return; await q(sb.from('schedule_items').delete().eq('id', it.id)); close(); done(); };
    } });
}
async function templateForm(p, items, done) {
  const types = Object.keys(TEMPLATES); const def = types.includes(p.type) ? p.type : types[0];
  await modal(`<form id="f" class="pgrid">${field('نوع المشروع', sel('type', types, def), 'wide')}${field('بداية المشروع', inp('start', p.start_date || today(), 'type="date" required'))}${field('نهاية المشروع', inp('end', p.revised_end_date || p.end_date || '', 'type="date" required'))}<label class="chk wide"><input type="checkbox" name="ms" checked> إضافة المعالم القياسية (${MS_TEMPLATES.length})</label><p class="wide muted small">تُوزَّع الحزم على المدة بحسب أوزانها بالتتابع مع تداخل بسيط، ثم عدّل التواريخ لتطابق البرنامج الزمني المعتمد للمقاول.${items.length ? ' <b>تنبيه:</b> سيُضاف القالب إلى البنود الموجودة.' : ''}</p><div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إنشاء الجدول</button></div></form>`, { title: 'قالب جاهز حسب نوع المشروع', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const tpl = TEMPLATES[f.type]; const total = Math.max(1, days(f.start, f.end)); if (total < 1) return err('تحقق من التواريخ');
        const rows = []; let cursor = 0; tpl.forEach(([name, w], i) => { const len = Math.max(1, Math.round(total * w / 100 * (tpl.length > 3 ? 1.35 : 1.1))); const s = Math.min(total - 1, Math.round(cursor)); const en = Math.min(total, s + len); rows.push({ project_id: p.id, kind: 'package', sort: i + 1, name, weight: w, planned_start: addDays(f.start, s), planned_end: addDays(f.start, Math.max(s + 1, en)), pct: 0, created_by: session.user.id }); cursor += total * w / 100; });
        rows[rows.length - 1].planned_end = f.end;
        if (f.ms) MS_TEMPLATES.forEach((m, i) => rows.push({ project_id: p.id, kind: 'milestone', sort: 100 + i, name: m, weight: 0, planned_end: i === 0 ? f.start : i === MS_TEMPLATES.length - 1 ? f.end : addDays(f.start, Math.round(total * [0, 0.25, 0.7, 0.9, 1][i])), pct: 0, created_by: session.user.id }));
        try { await q(sb.from('schedule_items').insert(rows)); toast(`أُنشئ ${rows.length} بنداً`); close(); done(); } catch (er) { err(er); } };
    } });
}
async function pasteForm(p, items, done) {
  await modal(`<form id="f"><p class="muted small">انسخ من Excel أعمدة بهذا الترتيب: <b>الاسم، الوزن%، البداية، النهاية</b> (تاريخ بصيغة 2026-03-15)، ثم الصقها هنا. سطر بلا وزن وبتاريخ واحد يُعتبر معلماً.</p><textarea name="txt" rows="8" style="width:100%;direction:rtl" placeholder="الأعمال الإنشائية	25	2026-01-10	2026-05-30
وصول المعدات		2026-04-01"></textarea><div class="mt10 btnrow end" ><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">استيراد</button></div></form>`, { title: 'لصق الجدول من Excel', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const rows = []; const norm = s => (s || '').trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\//g, '-');
        f.txt.split(/\r?\n/).forEach((line, i) => { if (!line.trim()) return; const c = line.split(/\t|;|\s{2,}|,/).map(x => x.trim()); if (c.length < 2) return; const name = c[0]; const wgt = Number(norm(c[1])); const d1 = norm(c[2]), d2 = norm(c[3]); const isDate = s => /^\d{4}-\d{1,2}-\d{1,2}$/.test(s);
          if (!wgt && isDate(d1) && !isDate(d2)) rows.push({ project_id: p.id, kind: 'milestone', sort: items.length + i, name, weight: 0, planned_end: d1, pct: 0, created_by: session.user.id });
          else if (isDate(d1) && isDate(d2)) rows.push({ project_id: p.id, kind: 'package', sort: items.length + i, name, weight: wgt || 0, planned_start: d1, planned_end: d2, pct: 0, created_by: session.user.id }); });
        if (!rows.length) return err('لم أتعرف على أي سطر — تحقق من الترتيب والتواريخ');
        try { await q(sb.from('schedule_items').insert(rows)); toast(`استُورد ${rows.length} بنداً`); close(); done(); } catch (er) { err(er); } };
    } });
}
function guideHtml() {
  return `<h2>${ico('book')} كيف أستخدم الجدول الزمني؟</h2>
  <div class="steps">
    <div class="step"><i>1</i><div><b>ابنِ الجدول مرة واحدة عند المباشرة (10 دقائق)</b><p>اضغط <b>قالب جاهز</b> ليُنشئ لك حزم الأعمال المعتادة لنوع مشروعك موزعة على المدة، أو <b>لصق من Excel</b> إن كان لديك البرنامج الزمني للمقاول. ثم عدّل الأسماء والتواريخ والأوزان لتطابق البرنامج المعتمد.</p></div></div>
    <div class="step"><i>2</i><div><b>الحزمة = مجموعة أعمال لها وزن وبداية ونهاية</b><p>مثل «الأعمال الكهربائية 15%». مجموع أوزان الحزم يجب أن يكون 100%. المخطط يتحرك من تلقاء نفسه كل يوم بحسب هذه التواريخ، فلا تحتاج تحديثه أبداً.</p></div></div>
    <div class="step"><i>3</i><div><b>المعلم = حدث له تاريخ فقط</b><p>مثل «وصول المعدات» أو «التشغيل التجريبي». لا نسبة له؛ عندما يتحقق اضغط <b>تحقق</b>. المعلم الذي يفوت تاريخه يظهر تنبيهاً فوراً حتى لو بدت النسبة الإجمالية مقبولة.</p></div></div>
    <div class="step"><i>4</i><div><b>حدّث نسب الحزم شهرياً (دقيقتان)</b><p>مع كل مستخلص أو تقرير شهري اكتب نسبة كل حزمة جارية في خانة «الإنجاز» مباشرة في الجدول. تُحسب نسبة المشروع فوراً من الأوزان، ويُرسم الفعلي على المنحنى. الحزمة التي لا تُحدَّث 30 يوماً تظهر تنبيهاً.</p></div></div>
    <div class="step"><i>5</i><div><b>اعتماد الخط الأساس ثم المصدر</b><p>عندما يطابق الجدول البرنامج المعتمد، تعتمده الإدارة كـ<b>خط أساس</b> فتُقفل التواريخ المخططة (أي تعديل بعدها يكون بأمر تمديد يُزيح الجدول مع الاحتفاظ بالأساس للمقارنة). وعندما تطمئن للأرقام حوّل «مصدر نسبة الإنجاز» من يدوي إلى الجدول، فتتحدث نسب المشروع والتقارير تلقائياً.</p></div></div>
  </div>
  <div class="mt8 kvs" ><div class="kv"><span>الانحراف بالنقاط</span><b>الفعلي − المخطط اليوم</b></div><div class="kv"><span>الانحراف بالأيام</span><b>اليوم − التاريخ الذي كان يجب أن نبلغ فيه النسبة الفعلية الحالية</b></div><div class="kv"><span>الانتهاء المتوقع</span><b>النهاية المخططة + أيام التأخر الحالية</b></div><div class="kv"><span>من يعدّل؟</span><b>مهندس المشروع والإدارة؛ وبعد اعتماد الأساس المخطط للإدارة فقط</b></div></div>`;
}
