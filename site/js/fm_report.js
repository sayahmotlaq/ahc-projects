// ===== تقرير حالة الأنظمة الحرجة: بناء البيانات (داخل المنصة) وعرضها (في المنصة وفي الرابط العام بلا حساب) =====
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const RST = {
  good: { ar: 'يعمل جيداً', cmp: 'مستوفٍ', i: '✓', c: '#2E8B57' }, attention: { ar: 'يحتاج متابعة', cmp: 'ملاحظات بسيطة', i: '!', c: '#C99A1E' },
  partial: { ar: 'معطل جزئياً', cmp: 'ملاحظات جوهرية', i: '◐', c: '#D9772B' }, down: { ar: 'معطل', cmp: 'غير مستوفٍ', i: '✕', c: '#C0392B' }, na: { ar: 'لا ينطبق', cmp: 'لا ينطبق', i: '–', c: '#B5C0CB' },
};
const ROST = { open: 'مفتوحة', in_progress: 'قيد المعالجة', verify: 'بانتظار التحقق', closed: 'مغلقة' };
const RANK = { down: 4, partial: 3, attention: 2, good: 1, na: 0 };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthAr = d => d ? `${MONTHS[+String(d).slice(5, 7) - 1]} ${String(d).slice(0, 4)}` : '—';
const dAr = d => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const lbl = (s, grp) => (grp === 'compliance' ? RST[s]?.cmp : RST[s]?.ar) || '—';
const rpill = (s, grp) => s ? `<span class="fmpill" style="--c:${RST[s].c}"><i>${RST[s].i}</i>${esc(lbl(s, grp))}</span>` : '';
export const STALE_DAYS = 7;
export const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 864e5) : null;

// يبني صورة التقرير لشهر محدد من بيانات الوحدة (D) والحوكمة (G) والفحوص المجلوبة
export function buildReport(period, D, G, checks) {
  const rs = D.rounds.filter(r => r.period === period);
  const byF = {}; checks.forEach(c => { const r = rs.find(x => x.id === c.round_id); if (r) (byF[r.facility_id] ||= {})[c.system_code] = c; });
  const today = new Date().toISOString().slice(0, 10), un = c => G?.U?.[c]?.short || c || '';
  let good = 0, base = 0; const issues = [];
  D.fac.forEach(f => D.sys.forEach(s => { const c = byF[f.id]?.[s.code]; if (!c || c.status === 'na') return; base++; if (c.status === 'good') good++; else issues.push({ f, s, c }); }));
  issues.sort((a, b) => RANK[b.c.status] - RANK[a.c.status]);
  const openObs = D.obs.filter(o => o.status !== 'closed');
  const oInfo = o => ({ id: o.id, title: o.title, proc: o.proc || '', step: o.step || null, steps: G?.P?.[o.proc]?.steps?.length || 0, status: o.status, owner: un(o.owner), assignee: D.P?.[o.assignee_id]?.full_name || o.assignee_name || '', due: o.due_date, late: !!(o.due_date && o.due_date < today), action: o.last_action || '', action_at: o.last_action_at, stale: (daysSince(o.last_action_at) ?? 0) > STALE_DAYS });
  const active = [], undocG = {};
  issues.forEach(({ f, s, c }) => { const oo = openObs.filter(o => o.facility_id === f.id && o.system_code === s.code);
    if (oo.length) active.push({ fac: f.name, sys: s.name, grp: s.grp, status: c.status, obs: oo.map(oInfo) });
    else (undocG[s.code] ||= { sys: s.name, grp: s.grp, owner: un(s.owner), proc: s.proc || '', facs: [] }).facs.push({ name: f.name, status: c.status }); });
  const sc = f => D.sys.reduce((a, x) => a + (RANK[byF[f.id]?.[x.code]?.status] || 0) ** 2, 0);
  const facs = D.fac.filter(f => byF[f.id]).sort((a, b) => sc(b) - sc(a));
  return {
    period, issued: new Date().toISOString(),
    kpi: { ready: base ? Math.round(good / base * 100) : 0, good, base, facDone: facs.length, facTotal: D.fac.length, bad: issues.filter(i => ['down', 'partial'].includes(i.c.status)).length, att: issues.filter(i => i.c.status === 'attention').length,
      open: openObs.length, late: openObs.filter(o => o.due_date && o.due_date < today).length, stale: openObs.filter(o => (daysSince(o.last_action_at) ?? 0) > STALE_DAYS).length, closedM: D.obs.filter(o => o.closed_at && o.closed_at.slice(0, 7) === period.slice(0, 7)).length },
    systems: D.sys.map(s => ({ code: s.code, name: s.name, grp: s.grp })),
    matrix: facs.map(f => { const cells = {}; let g = 0, b = 0; D.sys.forEach(s => { const c = byF[f.id]?.[s.code]; if (c) { cells[s.code] = c.status; if (c.status !== 'na') { b++; if (c.status === 'good') g++; } } }); return { name: f.name, ready: b ? Math.round(g / b * 100) : null, cells }; }),
    active, undoc: Object.values(undocG).sort((a, b) => b.facs.length - a.facs.length),
    missing: D.fac.filter(f => !byF[f.id]).map(f => f.name),
  };
}

// يعرض التقرير (HTML) من صورته — يُستخدم كما هو في المنصة وفي الرابط العام
export function renderReport(R, { logo = 'assets/logo.png', notes = false } = {}) {
  const k = R.kpi;
  const obsLine = o => `<div class="fmr-o"><b>#${o.id}</b> ${esc(o.title)} <span class="muted">(${esc(o.proc)}${o.step ? ` · الخطوة ${o.step}${o.steps ? '/' + o.steps : ''}` : ''} · ${ROST[o.status] || ''})</span>${o.action ? `<div class="fmr-act ${o.stale ? 'stale' : ''}">↻ ${esc(o.action)} <small>— ${dAr(o.action_at)}${o.stale ? ` · بلا تحديث منذ ${daysSince(o.action_at)} يوماً` : ''}</small></div>` : '<div class="fmr-act stale">لم يُسجَّل أي إجراء بعد</div>'}</div>`;
  return `<header class="fmrep-h"><img src="${logo}" alt=""><div><h1>تقرير حالة الأنظمة الحرجة في المنشآت</h1><p>تجمع الأحساء الصحي — إدارة الخدمات الفنية · ${monthAr(R.period)}</p></div><div class="fmrep-d">تاريخ الإصدار<br><b>${dAr(R.issued)}</b></div></header>
    <div class="fmrep-k"><div><b>${k.ready}٪</b><span>جاهزية الأنظمة (${k.good} من ${k.base})</span></div><div><b>${k.facDone} / ${k.facTotal}</b><span>منشآت مُحدَّثة</span></div><div class="r"><b>${k.bad}</b><span>معطل كلياً أو جزئياً</span></div><div class="a"><b>${k.att}</b><span>يحتاج متابعة</span></div><div class="${k.late || k.stale ? 'r' : ''}"><b>${k.open}</b><span>ملاحظات مفتوحة${k.late ? ` · ${k.late} متأخرة` : ''}${k.stale ? ` · ${k.stale} بلا تحديث` : ''}</span></div><div class="g"><b>${k.closedM}</b><span>أُغلقت هذا الشهر</span></div></div>
    <h2>المصفوفة</h2><div class="fmscroll"><table class="fmtab rep"><thead><tr><th class="fh">المنشأة</th>${R.systems.map(s => `<th class="sh"><span>${esc(s.name)}</span></th>`).join('')}</tr></thead><tbody>${R.matrix.map(m => `<tr><th class="fh">${esc(m.name)}${m.ready != null ? ` <small class="muted">${m.ready}٪</small>` : ''}</th>${R.systems.map(s => { const st = m.cells[s.code]; return `<td><span class="fmc ${st ? 's-' + st : 's-none'}" title="${esc(s.name)}: ${esc(st ? lbl(st, s.grp) : 'لم يُفحص')}">${st ? RST[st].i : ''}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="fmlegend">${Object.keys(RST).map(s => `<span><i style="--c:${RST[s].c}">${RST[s].i}</i>${RST[s].ar}</span>`).join('')}</div>
    <h2>الحالات قيد المعالجة <small class="muted">(${R.active.length})</small></h2>${R.active.length ? `<div class="tblwrap"><table class="rt2"><thead><tr><th>المنشأة</th><th>النظام</th><th>الحالة</th><th>الملاحظة، الإجراء الحاكم، وآخر إجراء متخذ</th><th>المسؤول</th><th>الموعد</th>${notes ? '<th class="noprint"></th>' : ''}</tr></thead><tbody>${R.active.map((a, i) => `<tr><td>${esc(a.fac)}</td><td>${esc(a.sys)}</td><td>${rpill(a.status, a.grp)}</td><td>${a.obs.map(obsLine).join('')}</td><td>${a.obs.map(o => esc(o.owner) + (o.assignee ? `<div class="muted small">${esc(o.assignee)}</div>` : '')).join('<br>')}</td><td>${a.obs.map(o => o.due ? `<span class="${o.late ? 'bad' : ''}">${dAr(o.due)}</span>` : '<span class="muted">بلا موعد</span>').join('<br>')}</td>${notes ? `<td class="noprint"><button class="btn sm" data-note="${i}">ملاحظة</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">لا حالات قيد المعالجة.</p>'}
    <h2>حالات تحتاج توثيقاً <small class="muted">(${R.undoc.reduce((a, g) => a + g.facs.length, 0)} حالة في ${R.undoc.length} أنظمة — غير سليمة بلا ملاحظة لها مسؤول وإجراء)</small></h2>${R.undoc.length ? `<div class="tblwrap"><table class="rt2"><thead><tr><th>النظام</th><th class="c">العدد</th><th>المنشآت</th><th>القسم المالك</th><th>الإجراء الحاكم</th></tr></thead><tbody>${R.undoc.map(g => `<tr><td><b>${esc(g.sys)}</b></td><td class="c">${g.facs.length}</td><td>${g.facs.map(f => `${esc(f.name)}${f.status !== 'attention' ? ` <span class="bad">(${esc(lbl(f.status, g.grp))})</span>` : ''}`).join('، ')}</td><td>${esc(g.owner)}</td><td>${esc(g.proc || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">كل الحالات غير السليمة موثقة.</p>'}
    ${R.missing.length ? `<p class="muted small">منشآت بلا جولة لهذا الشهر: ${R.missing.map(esc).join('، ')}</p>` : ''}`;
}
