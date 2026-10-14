// ===== متابعة أنظمة المنشآت: اللوحة، الجولة الشهرية، الملاحظات المرتبطة بدليل الإجراءات، سجل الأنظمة، التقرير الشهري =====
import { sb, q, session, isAdmin, role, canEdit } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, dateAr, ico } from './ui.js';
import { govBar, govChip } from './govlink.js';
import { buildReport, renderReport, STALE_DAYS, daysSince } from './fm_report.js';
import { attachBox, mountAttachBox } from './attach.js';

export const ST = {
  good: { ar: 'يعمل جيداً', cmp: 'مستوفٍ', i: '✓', c: '#2E8B57' },
  attention: { ar: 'يحتاج متابعة', cmp: 'ملاحظات بسيطة', i: '!', c: '#C99A1E' },
  partial: { ar: 'معطل جزئياً', cmp: 'ملاحظات جوهرية', i: '◐', c: '#D9772B' },
  down: { ar: 'معطل', cmp: 'غير مستوفٍ', i: '✕', c: '#C0392B' },
  na: { ar: 'لا ينطبق', cmp: 'لا ينطبق', i: '–', c: '#B5C0CB' },
};
const ORDER = ['good', 'attention', 'partial', 'down', 'na'];
const RANK = { down: 4, partial: 3, attention: 2, good: 1, na: 0 };
export const GRP = { system: 'الأنظمة الهندسية', low: 'التيار الخفيف', fire: 'السلامة من الحريق', area: 'المناطق الحرجة', compliance: 'الامتثال' };
export const OST = { open: 'مفتوحة', in_progress: 'قيد المعالجة', verify: 'بانتظار التحقق', closed: 'مغلقة' };
const OSTC = { open: '#C0392B', in_progress: '#1B6CA8', verify: '#C99A1E', closed: '#2E8B57' };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthAr = d => d ? `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '—';
const thisMonth = () => new Date().toISOString().slice(0, 7) + '-01';
const todayIso = () => new Date().toISOString().slice(0, 10);
const canW = () => ['admin', 'facility'].includes(role());
const stLabel = (s, sys) => (sys?.grp === 'compliance' ? ST[s]?.cmp : ST[s]?.ar) || '—';
const pill = (s, sys) => s ? `<span class="fmpill" style="--c:${ST[s].c}"><i>${ST[s].i}</i>${esc(stLabel(s, sys))}</span>` : '<span class="fmpill none">لم يُفحص</span>';
const opill = s => { s = OST[s] ? s : 'open'; return `<span class="fmopill" style="--c:${OSTC[s]}">${OST[s]}</span>`; };
const late = o => o.status !== 'closed' && o.due_date && o.due_date < todayIso();
const stale = o => o.status !== 'closed' && (daysSince(o.last_action_at || o.created_at) ?? 0) > STALE_DAYS;
const ago = d => { const n = daysSince(d); return n == null ? '' : n === 0 ? 'اليوم' : n === 1 ? 'أمس' : `قبل ${n} يوماً`; };
const snip = (t, n = 110) => t && t.length > n ? t.slice(0, n) + '…' : (t || '');
// كل تحديث للحالة أو الخطوة يتطلب ذكر المعالجة أو الإجراء المتخذ (وتفرضه قاعدة البيانات أيضاً)
async function askAction(title, label = 'المعالجة أو الإجراء المتخذ *', hint = 'اكتب ما تم فعلاً: من قام بماذا، وما النتيجة، وما التالي.') {
  return modal(`<form id="af"><p class="muted small m0">${esc(hint)}</p><label class="fld mt8"><span>${esc(label)}</span><textarea name="a" rows="3" required minlength="6" placeholder="مثال: تم التواصل مع مقاول الصيانة وتغيير القطعة، والنظام قيد الاختبار"></textarea></label><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ التحديث</button></div></form>`,
    { title, onOpen: (w, c) => { const f = $('#af', w); f.a.focus(); f.onsubmit = e => { e.preventDefault(); const v = f.a.value.trim(); if (v.length < 6) return toast('اكتب الإجراء المتخذ بوضوح', 'bad'); c(v); }; } });
}

let D = null, G = null;
async function govG() { if (!G) G = await (await import('./gov.js')).govData(); return G; }
const uname = c => G?.U?.[c]?.short || c || '—';
const uchip = c => c ? `<span class="uchip" style="--c:#${G?.U?.[c]?.color || '6B7A88'}">${esc(uname(c))}</span>` : '';

async function load() {
  const [fac, sys, latest, obs, rounds, people] = await Promise.all([
    q(sb.from('facilities').select('id,name,kind,sort,active').eq('active', true).order('sort').order('name')),
    q(sb.from('fm_systems').select('*').order('sort')),
    q(sb.from('v_fm_latest').select('*')),
    q(sb.from('fm_obs').select('*').order('id', { ascending: false })),
    q(sb.from('fm_rounds').select('id,facility_id,period,status,submitted_at,updated_at').order('period', { ascending: false })),
    q(sb.from('profiles').select('id,full_name,role').in('role', ['admin', 'facility', 'engineer'])),
  ]);
  await govG();
  const F = Object.fromEntries(fac.map(f => [f.id, f])), S = Object.fromEntries(sys.map(s => [s.code, s]));
  const L = {}; latest.forEach(l => { (L[l.facility_id] ||= {})[l.system_code] = l; });
  const P = Object.fromEntries(people.map(p => [p.id, p]));
  D = { fac, sys: sys.filter(s => s.active !== false), allSys: sys, F, S, L, obs, rounds, people, P };
  return D;
}
const pname = id => D?.P?.[id]?.full_name || '';
const openObsOf = (f, s) => D.obs.filter(o => o.facility_id === f && o.system_code === s && o.status !== 'closed');
const lastRound = f => D.rounds.find(r => r.facility_id === f);
function facStats(f) {
  const st = { good: 0, attention: 0, partial: 0, down: 0, na: 0, none: 0 };
  D.sys.forEach(s => { const l = D.L[f]?.[s.code]; if (l) st[l.status]++; else st.none++; });
  const base = st.good + st.attention + st.partial + st.down;
  return { ...st, ready: base ? Math.round(st.good / base * 100) : null, worst: st.down * 100 + st.partial * 10 + st.attention };
}
const suggestProc = (sys, sev) => sev === 'down' && sys?.critical ? 'G-11' : (sys?.proc || 'G-05');

// ---------- الهيكل العام
export async function mountFM(root, tab = 'dash', params = new URLSearchParams()) {
  await load();
  const nOpen = D.obs.filter(o => o.status !== 'closed').length, nLate = D.obs.filter(late).length;
  const tabs = [['dash', 'اللوحة'], ['round', 'الجولة الشهرية'], ['obs', `الملاحظات <b class="fmcnt ${nLate ? 'bad' : ''}">${nOpen}</b>`], ...(isAdmin() ? [['systems', 'سجل الأنظمة']] : []), ['report', 'التقرير الشهري']];
  root.innerHTML = `<div class="fmhead"><div><h1 class="pagetitle">متابعة أنظمة المنشآت</h1><p class="muted m0">حالة الأنظمة الحرجة في كل منشأة شهراً بشهر، وكل ملاحظة مربوطة بإجرائها في دليل الحوكمة وخطوتها الحالية.</p></div><span class="sp"></span>${canW() ? `<a class="btn primary" href="#/fm/round">＋ جولة شهرية</a><button class="btn" id="fmNewObs">＋ ملاحظة</button>` : ''}</div>
    <nav class="fmtabs">${tabs.map(([k, v]) => `<a href="#/fm/${k}" class="${tab === k ? 'on' : ''}">${v}</a>`).join('')}</nav><div id="fmBody"></div>`;
  $('#fmNewObs', root) && ($('#fmNewObs', root).onclick = () => obsForm(null, {}, () => mountFM(root, tab, params)));
  const t = $('#fmBody', root); const re = () => mountFM(root, tab, params);
  if (tab === 'round') return viewRound(t, params, re);
  if (tab === 'obs') return viewObs(t, params, re);
  if (tab === 'systems' && isAdmin()) return viewSystems(t, re);
  if (tab === 'report') return viewReport(t, params);
  return viewDash(t, params, re);
}

// ---------- اللوحة
function viewDash(t, params, re) {
  let grp = params.get('g') || '';
  const render = () => {
    const sys = D.sys.filter(s => !grp || s.grp === grp);
    const facs = D.fac.map(f => ({ f, st: facStats(f.id), r: lastRound(f.id) })).sort((a, b) => (a.r ? 0 : 1) - (b.r ? 0 : 1) || b.st.worst - a.st.worst || a.f.sort - b.f.sort);
    let good = 0, base = 0, bad = [], att = 0, undoc = 0;
    D.fac.forEach(f => D.sys.forEach(s => { const l = D.L[f.id]?.[s.code]; if (!l || l.status === 'na') return; base++; if (l.status === 'good') good++; else { if (l.status === 'attention') att++; else bad.push([f, s, l]); if (!openObsOf(f.id, s.code).length) undoc++; } }));
    const open = D.obs.filter(o => o.status !== 'closed'), lt = D.obs.filter(late), cm = thisMonth();
    const staleFac = D.fac.filter(f => { const r = lastRound(f.id); return !r || r.period < cm; });
    const latestP = D.rounds[0]?.period;
    const ready = base ? Math.round(good / base * 100) : 0;
    const kpi = (cls, big, lbl, sub = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="fmk ${cls}"><b>${big}</b><span>${lbl}</span>${sub ? `<small>${sub}</small>` : ''}</${href ? 'a' : 'div'}>`;
    const groups = [...new Set(sys.map(s => s.grp))];
    const worstSys = D.sys.map(s => ({ s, n: D.fac.filter(f => { const l = D.L[f.id]?.[s.code]; return l && !['good', 'na'].includes(l.status); }).length })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 8);
    const crit = [...open].sort((a, b) => (late(b) - late(a)) || (RANK[b.severity] - RANK[a.severity])).slice(0, 6);
    t.innerHTML = `<div class="fmkpis">
        <div class="fmk ring" style="--p:${ready}"><div class="rg"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" class="bgc"/><circle cx="18" cy="18" r="15.9" class="fgc" stroke-dasharray="${ready} 100"/></svg><b>${ready}<small>٪</small></b></div><span>جاهزية الأنظمة</span><small>${good} من ${base} نظاماً يعمل جيداً${latestP ? ' · آخر جولة ' + monthAr(latestP) : ''}</small></div>
        ${kpi(bad.length ? 'red' : '', bad.length, 'معطل كلياً أو جزئياً', bad.slice(0, 2).map(([f, s]) => esc(s.name) + ' — ' + esc(f.name)).join('<br>'))}
        ${kpi(att ? 'amber' : '', att, 'يحتاج متابعة', 'حالات تعمل مع ملاحظات')}
        ${(() => { const sl = open.filter(stale).length; return kpi(lt.length || sl ? 'red' : 'blue', open.length, 'ملاحظات مفتوحة', [lt.length ? `<b>${lt.length}</b> متأخرة عن موعدها` : '', sl ? `<b>${sl}</b> بلا تحديث منذ ${STALE_DAYS} أيام` : ''].filter(Boolean).join('<br>') || 'كلها محدّثة وفي موعدها', '#/fm/obs?due=1'); })()}
        ${kpi(undoc ? 'amber' : 'green', undoc, 'حالات بلا ملاحظة', undoc ? 'حالة غير سليمة لم تُفتح لها ملاحظة بعد' : 'كل حالة موثقة')}
        ${kpi(staleFac.length ? 'amber' : 'green', staleFac.length, 'منشآت لم تُحدَّث هذا الشهر', staleFac.length ? staleFac.slice(0, 3).map(f => esc(f.name)).join('، ') + (staleFac.length > 3 ? '…' : '') : 'كل المنشآت محدّثة')}
      </div>
      <div class="pcard fmmatrix"><div class="toolbar m0"><h2 class="m0">مصفوفة الحالة</h2><span class="muted small">آخر حالة مسجلة لكل نظام في كل منشأة</span><span class="sp"></span>
        <div class="fmfilt"><button data-g="" class="${!grp ? 'on' : ''}">الكل</button>${Object.entries(GRP).map(([k, v]) => `<button data-g="${k}" class="${grp === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="fmlegend">${ORDER.map(s => `<span><i style="--c:${ST[s].c}">${ST[s].i}</i>${ST[s].ar}</span>`).join('')}<span><i class="nd">!</i>بلا ملاحظة</span><span><i class="ob">•</i>ملاحظة مفتوحة</span></div>
        <div class="fmscroll"><table class="fmtab"><thead><tr><th class="fh" rowspan="2">المنشأة</th>${groups.map(g => `<th class="gh" colspan="${sys.filter(s => s.grp === g).length}">${GRP[g]}</th>`).join('')}</tr>
          <tr>${groups.map(g => sys.filter(s => s.grp === g).map(s => `<th class="sh" title="${esc(s.name)}"><span>${esc(s.name)}</span></th>`).join('')).join('')}</tr></thead>
          <tbody>${facs.map(({ f, st, r }) => `<tr><th class="fh"><a href="#/fm/round?f=${f.id}">${esc(f.name)}</a><div class="fhm">${st.ready === null ? '<span class="muted">لا جولة بعد</span>' : `<span class="rb"><i style="width:${st.ready}%"></i></span><b>${st.ready}٪</b><span class="muted">${monthAr(r?.period)}</span>`}</div></th>
            ${groups.map(g => sys.filter(s => s.grp === g).map(s => { const l = D.L[f.id]?.[s.code]; const oo = openObsOf(f.id, s.code); const nd = l && !['good', 'na'].includes(l.status) && !oo.length;
              return `<td><button class="fmc ${l ? 's-' + l.status : 's-none'} ${nd ? 'nd' : ''} ${oo.length ? 'ob' : ''}" data-f="${f.id}" data-s="${s.code}" title="${esc(f.name)} — ${esc(s.name)}: ${esc(l ? stLabel(l.status, s) : 'لم يُفحص')}${oo.length ? ' · ' + oo.length + ' ملاحظة مفتوحة' : ''}">${l ? ST[l.status].i : ''}</button></td>`; }).join('')).join('')}</tr>`).join('')}</tbody></table></div></div>
      <div class="fm2col">
        <div class="pcard"><h2>أكثر الأنظمة تعثراً</h2>${worstSys.length ? `<div class="fmbars">${worstSys.map(({ s, n }) => `<div class="fmbar"><span>${esc(s.name)}</span><i><em style="width:${Math.round(n / D.fac.length * 100)}%"></em></i><b>${n}</b></div>`).join('')}</div><p class="muted small m0">عدد المنشآت التي فيها النظام بحالة غير سليمة.</p>` : '<p class="muted">لا أنظمة متعثرة.</p>'}</div>
        <div class="pcard"><div class="toolbar m0"><h2 class="m0">ملاحظات تحتاج انتباهاً</h2><span class="sp"></span><a class="small" href="#/fm/obs">كل الملاحظات ‹</a></div>${crit.length ? `<div class="fmolist">${crit.map(obsRow).join('')}</div>` : '<p class="muted">لا ملاحظات مفتوحة.</p>'}</div>
      </div>`;
    $$('.fmfilt [data-g]', t).forEach(b => b.onclick = () => { grp = b.dataset.g; render(); });
    $$('.fmc', t).forEach(b => b.onclick = () => cellDetail(+b.dataset.f, b.dataset.s, re));
    bindObsRows(t, re);
  };
  render();
}

function obsRow(o) {
  const f = D.F[o.facility_id], s = D.S[o.system_code];
  const p = G?.P?.[o.proc], n = p?.steps?.length || 0;
  return `<button class="fmo ${late(o) ? 'late' : ''}" data-o="${o.id}" style="--c:${ST[o.severity]?.c || '#999'}">
    <span class="fmo-h"><b>#${o.id}</b> ${esc(o.title)}</span>
    <span class="fmo-m">${esc(f?.name || '')}${s ? ' · ' + esc(s.name) : ''}</span>
    ${o.status !== 'closed' ? `<span class="fmo-a ${stale(o) ? 'stale' : ''}">${o.last_action ? `↻ ${esc(snip(o.last_action))} <small>${ago(o.last_action_at)}</small>` : 'لم يُسجَّل إجراء بعد'}${stale(o) ? ` <b>بلا تحديث منذ ${daysSince(o.last_action_at || o.created_at)} يوماً</b>` : ''}</span>` : ''}
    <span class="fmo-f">${opill(o.status)}${o.proc ? `<span class="fmproc">${ico('book')} ${esc(o.proc)}${o.step && n ? ` · ${o.step}/${n}` : ''}</span>` : ''}${o.owner ? uchip(o.owner) : ''}${o.due_date ? `<span class="${late(o) ? 'bad' : 'muted'} small">${ico('clock')} ${dateAr(o.due_date)}</span>` : ''}${o.assignee_id || o.assignee_name ? `<span class="muted small">${ico('user')} ${esc(pname(o.assignee_id) || o.assignee_name)}</span>` : ''}</span></button>`;
}
const bindObsRows = (t, re) => $$('[data-o]', t).forEach(b => b.onclick = () => obsDetail(+b.dataset.o, re));

// ---------- خلية: النظام في المنشأة (السجل الشهري والملاحظات)
async function cellDetail(fid, code, re) {
  const f = D.F[fid], s = D.S[code];
  const hist = await q(sb.from('fm_checks').select('status,note,checked_on,fm_rounds!inner(period,facility_id)').eq('system_code', code).eq('fm_rounds.facility_id', fid));
  hist.sort((a, b) => a.fm_rounds.period < b.fm_rounds.period ? 1 : -1);
  const l = D.L[fid]?.[code], obs = D.obs.filter(o => o.facility_id === fid && o.system_code === code);
  await modal(`<div class="fmcell"><div class="fmcell-h">${pill(l?.status, s)}<div><b>${esc(s.name)}</b><span class="muted">${esc(f.name)}${s.name_en ? ' · ' + esc(s.name_en) : ''}</span></div></div>
    ${s.hint ? `<p class="muted small">ما يُفحص: ${esc(s.hint)}</p>` : ''}
    <div class="fmmeta">${uchip(s.owner)}${(s.partners || []).map(uchip).join('')}${s.proc ? govChip(s.proc, 'الإجراء الحاكم') : ''}${s.critical ? '<span class="badge ovr">نظام حرج</span>' : ''}</div>
    <h3 class="sub-h">السجل الشهري</h3>${hist.length ? `<div class="fmhist">${hist.slice(0, 12).map(h => `<div class="fmh" title="${esc(h.note || '')}"><i style="--c:${ST[h.status].c}">${ST[h.status].i}</i><span>${monthAr(h.fm_rounds.period)}</span><small>${esc(stLabel(h.status, s))}</small></div>`).join('')}</div>${l?.note ? `<p class="pre small">${esc(l.note)}</p>` : ''}` : '<p class="muted">لم يُفحص هذا النظام في هذه المنشأة بعد.</p>'}
    <div class="toolbar m0 mt12"><h3 class="sub-h m0">الملاحظات (${obs.length})</h3><span class="sp"></span>${canW() ? '<button class="btn sm primary" id="cNew">＋ ملاحظة</button>' : ''}</div>
    ${obs.length ? `<div class="fmolist">${obs.map(obsRow).join('')}</div>` : '<p class="muted">لا ملاحظات.</p>'}</div>`,
    { title: 'النظام في المنشأة', wide: true, onOpen: (w, close) => {
      $('#cNew', w) && ($('#cNew', w).onclick = () => { close(); obsForm(null, { facility_id: fid, system_code: code, severity: l && ['attention', 'partial', 'down'].includes(l.status) ? l.status : 'attention' }, re); });
      $$('[data-o]', w).forEach(b => b.onclick = () => { close(); obsDetail(+b.dataset.o, re); });
    } });
}

// ---------- الجولة الشهرية
async function viewRound(t, params, re) {
  const myF = (session.profile?.fac_ids || []).map(Number);
  const fid = +(params.get('f') || 0) || (myF.length === 1 ? myF[0] : null);
  const period = (params.get('p') || thisMonth().slice(0, 7)) + '-01';
  const pickers = `<div class="pcard fmpick"><label class="fld"><span>المنشأة</span>${sel('f', [['', '— اختر المنشأة —'], ...D.fac.map(f => [f.id, f.name])], fid || '')}</label><label class="fld"><span>الشهر</span><input type="month" name="p" value="${period.slice(0, 7)}" max="${thisMonth().slice(0, 7)}"></label>
    <div class="fmpick-st">${[...D.fac].sort((a, b) => myF.includes(b.id) - myF.includes(a.id)).map(f => { const r = D.rounds.find(x => x.facility_id === f.id && x.period === period); return `<a href="#/fm/round?f=${f.id}&p=${period.slice(0, 7)}" class="${f.id === fid ? 'on' : ''} ${r ? (r.status === 'submitted' ? 'ok' : 'dr') : ''}" title="${r ? (r.status === 'submitted' ? 'معتمدة' : 'مسودة') : 'لم تبدأ'}${myF.includes(f.id) ? ' — منشأتك' : ''}">${myF.includes(f.id) ? '★ ' : ''}${esc(f.name)}</a>`; }).join('')}</div></div>`;
  if (!fid) { t.innerHTML = pickers + '<div class="empty-boq">اختر المنشأة لبدء جولة الشهر أو مراجعتها. الأخضر: معتمدة، الذهبي: مسودة.</div>'; bindPick(t); return; }
  const round = D.rounds.find(r => r.facility_id === fid && r.period === period) || null;
  const checks = round ? await q(sb.from('fm_checks').select('*').eq('round_id', round.id)) : [];
  const C = Object.fromEntries(checks.map(c => [c.system_code, c]));
  const prevOf = code => { const l = D.L[fid]?.[code]; return l && l.period < period ? l : null; };
  const val = {}; D.sys.forEach(s => { val[s.code] = { status: C[s.code]?.status || prevOf(s.code)?.status || '', note: C[s.code]?.note || '' }; });
  const ro = !canW() || (round?.status === 'submitted' && !isAdmin());
  const f = D.F[fid];
  t.innerHTML = pickers + `<div class="fmround-h"><div><h2 class="m0">${esc(f.name)} — جولة ${monthAr(period)}</h2><p class="muted m0">${round ? (round.status === 'submitted' ? `معتمدة · ${dateAr(round.submitted_at)}` : 'مسودة لم تُعتمد بعد') : 'جولة جديدة: الحالات معبأة من آخر جولة، غيّر ما تغيّر فقط.'}</p></div><span class="sp"></span>${ro ? '' : `<button class="btn" id="rSave">حفظ مسودة</button><button class="btn primary" id="rSubmit">${round?.status === 'submitted' ? 'حفظ التعديلات' : 'اعتماد الجولة'}</button>`}</div>
    <div class="fmprog" id="rProg"></div>
    ${Object.entries(GRP).map(([g, gl]) => { const ss = D.sys.filter(s => s.grp === g); if (!ss.length) return ''; return `<section class="fmgsec"><h3>${gl}</h3>${ss.map(s => { const p = prevOf(s.code); const oo = openObsOf(fid, s.code);
      return `<div class="fmrow" data-s="${s.code}"><div class="fmrow-n"><b>${esc(s.name)}${s.critical ? ' <span class="crit" title="نظام حرج">●</span>' : ''}</b><small>${esc(s.hint || '')}</small><span class="fmrow-m">${uchip(s.owner)}${p ? `<span class="muted small">السابق (${monthAr(p.period)}): ${esc(stLabel(p.status, s))}</span>` : ''}</span></div>
        <div class="fmseg" role="radiogroup">${ORDER.map(k => `<button type="button" data-v="${k}" style="--c:${ST[k].c}" ${ro ? 'disabled' : ''} title="${esc(stLabel(k, s))}"><i>${ST[k].i}</i><span>${esc(stLabel(k, s))}</span></button>`).join('')}</div>
        <div class="fmrow-x"><input class="fmnote" placeholder="ملاحظة قصيرة (اختياري)" value="${esc(val[s.code].note)}" ${ro ? 'disabled' : ''}><span class="fmrow-o">${oo.map(o => `<button type="button" class="fmochip" data-o="${o.id}">#${o.id} ${OST[o.status]}</button>`).join('')}<span class="fmneed">يلزم ملاحظة${canW() ? ' <button type="button" class="btn sm" data-new>＋ ملاحظة</button>' : ''}</span></span></div></div>`; }).join('')}</section>`; }).join('')}`;
  bindPick(t);
  const paint = () => {
    let done = 0, bad = 0, need = 0;
    $$('.fmrow', t).forEach(r => { const c = r.dataset.s, v = val[c].status; $$('.fmseg button', r).forEach(b => b.classList.toggle('on', b.dataset.v === v));
      const nd = v && !['good', 'na'].includes(v) && !openObsOf(fid, c).length; r.classList.toggle('need', nd); r.dataset.st = v || ''; if (v) done++; if (v && !['good', 'na'].includes(v)) bad++; if (nd) need++; });
    $('#rProg', t).innerHTML = `<span><b>${done}</b> / ${D.sys.length} نظاماً</span><span class="pb"><i style="width:${Math.round(done / D.sys.length * 100)}%"></i></span><span>${bad} غير سليم</span>${need ? `<span class="bad">${need} بلا ملاحظة</span>` : ''}`;
  };
  paint();
  if (!ro) $$('.fmrow', t).forEach(r => { const c = r.dataset.s;
    $$('.fmseg button', r).forEach(b => b.onclick = () => { val[c].status = b.dataset.v; paint(); });
    $('.fmnote', r).oninput = e => { val[c].note = e.target.value; };
    $('[data-new]', r) && ($('[data-new]', r).onclick = async () => { const rid = await save('draft', true); obsForm(null, { facility_id: fid, system_code: c, severity: ['attention', 'partial', 'down'].includes(val[c].status) ? val[c].status : 'attention', source: 'round', round_id: rid, details: val[c].note }, async () => { await load(); viewRound(t, params, re); }); });
  });
  $$('.fmochip', t).forEach(b => b.onclick = () => obsDetail(+b.dataset.o, async () => { await load(); viewRound(t, params, re); }));
  async function save(status, silent) {
    const missing = D.sys.filter(s => !val[s.code].status);
    if (status === 'submitted' && missing.length) { toast(`حدّد حالة ${missing.length} نظام قبل الاعتماد: ${missing.slice(0, 3).map(s => s.name).join('، ')}`, 'bad'); return null; }
    try {
      const row = { facility_id: fid, period, note: round?.note || '', by_user: session.user.id, ...(status === 'submitted' ? { status: 'submitted', submitted_at: round?.submitted_at || new Date().toISOString() } : round ? {} : { status: 'draft' }) };
      const r = await q(sb.from('fm_rounds').upsert(row, { onConflict: 'facility_id,period' }).select('id').single());
      const rows = D.sys.filter(s => val[s.code].status).map(s => ({ round_id: r.id, system_code: s.code, status: val[s.code].status, note: val[s.code].note.trim(), checked_on: C[s.code]?.status === val[s.code].status && C[s.code]?.checked_on ? C[s.code].checked_on : todayIso() }));
      if (rows.length) await q(sb.from('fm_checks').upsert(rows, { onConflict: 'round_id,system_code' }));
      if (!silent) toast(status === 'submitted' ? 'اعتُمدت الجولة' : 'حُفظت المسودة');
      return r.id;
    } catch (e) { err(e); return null; }
  }
  $('#rSave', t) && ($('#rSave', t).onclick = async () => { if (await save('draft')) { await load(); viewRound(t, params, re); } });
  $('#rSubmit', t) && ($('#rSubmit', t).onclick = async () => {
    const need = D.sys.filter(s => { const v = val[s.code].status; return v && !['good', 'na'].includes(v) && !openObsOf(fid, s.code).length; });
    let auto = false;
    if (need.length) { const a = await modal(`<p>${need.length} حالة غير سليمة بلا ملاحظة:</p><ul class="rlist small">${need.map(s => `<li>${esc(s.name)} — ${esc(stLabel(val[s.code].status, s))}</li>`).join('')}</ul><p class="muted small">كل حالة غير سليمة تحتاج ملاحظة لها مسؤول وإجراء حتى لا تضيع. يمكن إنشاؤها الآن تلقائياً بإجرائها الحاكم من الدليل، ثم تُستكمل تفاصيلها من صفحة الملاحظات.</p><div class="btnrow end"><button class="btn" data-x>رجوع</button><button class="btn" data-k="skip">اعتماد دون إنشاء</button><button class="btn primary" data-k="auto">إنشاء الملاحظات واعتماد الجولة</button></div>`,
      { title: 'حالات بلا ملاحظة', onOpen: (w, close) => $$('[data-k]', w).forEach(b => b.onclick = () => close(b.dataset.k)) });
      if (!a) return; auto = a === 'auto'; }
    const fixed = D.obs.filter(o => o.facility_id === fid && o.status !== 'closed' && o.system_code && val[o.system_code]?.status === 'good');
    const rid = await save('submitted'); if (!rid) return;
    if (auto) { try { await q(sb.from('fm_obs').insert(need.map(s => { const v = val[s.code].status; return { facility_id: fid, system_code: s.code, title: `${s.name}: ${stLabel(v, s)}`, details: val[s.code].note.trim(), severity: v, proc: suggestProc(s, v), step: 1, owner: s.owner, source: 'round', round_id: rid, created_by: session.user.id }; }))); toast(`أُنشئت ${need.length} ملاحظة`); } catch (e) { err(e); } }
    if (fixed.length) await closeFixed(fixed);
    await load(); viewRound(t, params, re);
  });
}
// أنظمة صارت سليمة في الجولة ولها ملاحظات مفتوحة: تُغلق بذكر المعالجة، أو تبقى مفتوحة بتحديث
async function closeFixed(list) {
  await modal(`<form id="xf"><p>صارت هذه الأنظمة <b>سليمة</b> في الجولة، ولها ملاحظات مفتوحة. لكل ملاحظة: أغلقها بذكر المعالجة، أو أبقها مفتوحة.</p>${list.map(o => `<div class="fmfix"><label class="chk"><input type="checkbox" name="c_${o.id}" checked> إغلاق <b>#${o.id}</b> ${esc(o.title)}</label><textarea name="a_${o.id}" rows="2" placeholder="كيف عولجت؟ (مطلوب للإغلاق)"></textarea></div>`).join('')}<div class="btnrow end"><button type="button" class="btn" data-x>لاحقاً</button><button class="btn primary">حفظ</button></div></form>`,
    { title: 'إغلاق الملاحظات المعالجة', wide: true, onOpen: (w, close) => { $('#xf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const go = list.filter(o => x['c_' + o.id]);
      const miss = go.filter(o => (x['a_' + o.id] || '').trim().length < 6); if (miss.length) return toast('اكتب المعالجة لكل ملاحظة ستُغلق', 'bad');
      try { for (const o of go) { const a = x['a_' + o.id].trim(); await q(sb.from('fm_obs').update({ status: 'closed', last_action: a, close_note: a, step: G.P[o.proc]?.steps?.length || o.step }).eq('id', o.id)); } if (go.length) toast(`أُغلقت ${go.length} ملاحظة`); close(); } catch (e2) { err(e2); } }; } });
}
function bindPick(t) {
  const go = () => { const f = $('[name=f]', t).value, p = $('[name=p]', t).value; location.hash = `#/fm/round?${f ? 'f=' + f + '&' : ''}p=${p}`; };
  $('[name=f]', t).onchange = go; $('[name=p]', t).onchange = go;
}

// ---------- الملاحظات
function viewObs(t, params, re) {
  const st = { q: params.get('q') || '', f: params.get('f') || '', g: '', u: '', s: params.get('s') || 'active', late: params.get('late') === '1' || params.get('due') === '1' };
  t.innerHTML = `<div class="filters fmofilt"><input id="oq" placeholder="بحث في الملاحظات…" value="${esc(st.q)}">${sel('of', [['', 'كل المنشآت'], ...D.fac.map(f => [f.id, f.name])], st.f)}${sel('og', [['', 'كل المجموعات'], ...Object.entries(GRP)], '')}${sel('ou', [['', 'كل الأقسام'], ...G.units.filter(u => u.kind === 'unit').map(u => [u.code, u.short])], '')}${sel('os', [['active', 'المفتوحة (غير المغلقة)'], ['', 'الكل'], ...Object.entries(OST)], st.s)}<label class="chk"><input type="checkbox" id="ol" ${st.late ? 'checked' : ''}> المتأخرة أو بلا تحديث فقط</label></div>
    <div class="fmostats" id="oStats"></div><div id="oList"></div>`;
  const render = () => {
    const list = D.obs.filter(o => (!st.f || o.facility_id === +st.f) && (!st.g || D.S[o.system_code]?.grp === st.g) && (!st.u || o.owner === st.u) && (st.s === 'active' ? o.status !== 'closed' : !st.s || o.status === st.s) && (!st.late || late(o) || stale(o))
      && (!st.q || (o.title + ' ' + o.details + ' ' + (D.F[o.facility_id]?.name || '') + ' ' + (D.S[o.system_code]?.name || '') + ' #' + o.id).includes(st.q)));
    list.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || late(b) - late(a) || stale(b) - stale(a) || RANK[b.severity] - RANK[a.severity] || b.id - a.id);
    const c = k => D.obs.filter(o => o.status === k).length;
    $('#oStats', t).innerHTML = Object.entries(OST).map(([k, v]) => `<span style="--c:${OSTC[k]}"><b>${c(k)}</b>${v}</span>`).join('') + `<span style="--c:#C0392B"><b>${D.obs.filter(late).length}</b>متأخرة</span><span style="--c:#8A6A0B"><b>${D.obs.filter(stale).length}</b>بلا تحديث ${STALE_DAYS} أيام</span>`;
    $('#oList', t).innerHTML = list.length ? `<div class="fmolist grid">${list.map(obsRow).join('')}</div>` : '<div class="empty-boq">لا ملاحظات مطابقة.</div>';
    bindObsRows(t, re);
  };
  $('#oq', t).oninput = e => { st.q = e.target.value.trim(); render(); };
  $('[name=of]', t).onchange = e => { st.f = e.target.value; render(); };
  $('[name=og]', t).onchange = e => { st.g = e.target.value; render(); };
  $('[name=ou]', t).onchange = e => { st.u = e.target.value; render(); };
  $('[name=os]', t).onchange = e => { st.s = e.target.value; render(); };
  $('#ol', t).onchange = e => { st.late = e.target.checked; render(); };
  render();
  const id = +(params.get('id') || 0); if (id) obsDetail(id, re);
}

async function obsDetail(id, re) {
  let o = D.obs.find(x => x.id === id) || await q(sb.from('fm_obs').select('*').eq('id', id).maybeSingle());
  if (!o) return toast('الملاحظة غير موجودة', 'bad');
  const [log, wos] = await Promise.all([q(sb.from('fm_obs_log').select('*').eq('obs_id', id).order('id')), q(sb.from('ops_items').select('id,ref,title,status,unit,last_action').eq('fm_obs_id', id).order('id')).catch(() => [])]);
  const WST = { new: 'جديد', accepted: 'مستلم', in_progress: 'قيد التنفيذ', on_hold: 'معلّق', verify: 'بانتظار التأكيد', done: 'مكتمل', cancelled: 'ملغى' };
  const f = D.F[o.facility_id], s = D.S[o.system_code], p = G.P[o.proc], n = p?.steps?.length || 0;
  const w0 = canW(), closed = o.status === 'closed';
  const next = { open: ['in_progress', 'بدء المعالجة'], in_progress: ['verify', 'طلب التحقق'], verify: ['closed', 'إغلاق الملاحظة'], closed: ['in_progress', 'إعادة فتح'] }[o.status];
  const changed = { v: false };
  await modal(`${govBar([o.proc || 'G-05', closed ? 'done' : (o.step || 1)], OST[o.status])}
    <div class="fmod-h" style="--c:${ST[o.severity].c}"><div><b>#${o.id} — ${esc(o.title)}</b><span class="muted">${esc(f?.name || '')}${s ? ' · ' + esc(s.name) : ''}</span></div>${opill(o.status)}</div>
    ${o.details ? `<p class="pre">${esc(o.details)}</p>` : ''}
    <div class="fmlast ${stale(o) ? 'stale' : ''}"><span>آخر إجراء متخذ</span>${o.last_action ? `<p>${esc(o.last_action)}</p><small>${pname(o.last_action_by) ? esc(pname(o.last_action_by)) + ' · ' : ''}${dateAr(o.last_action_at)} (${ago(o.last_action_at)})</small>` : '<p class="muted">لم يُسجَّل أي إجراء بعد.</p>'}${stale(o) ? `<b>بلا تحديث منذ ${daysSince(o.last_action_at || o.created_at)} يوماً — المطلوب تحديث الحالة بالمعالجة أو الإجراء المتخذ</b>` : ''}</div>
    <div class="kvs">${[['الخطورة', pill(o.severity, s)], ['القسم المسؤول', uchip(o.owner) || '—'], ['المكلّف', esc(pname(o.assignee_id) || o.assignee_name || '—')], ['الموعد', o.due_date ? `<span class="${late(o) ? 'bad' : ''}">${dateAr(o.due_date)}${late(o) ? ' (متأخرة)' : ''}</span>` : '—'], ['المصدر', { round: 'الجولة الشهرية', manual: 'إدخال مباشر', import: 'مستوردة من ملف Excel' }[o.source] || '—'], ['أُنشئت', dateAr(o.created_at)], ...(o.project_id ? [['المشروع', `<a href="#/project/${o.project_id}">فتح المشروع</a>`]] : []), ...(closed ? [['أُغلقت', dateAr(o.closed_at) + (o.close_note ? ' — ' + esc(o.close_note) : '')]] : [])].map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    ${w0 && p && !closed ? `<div class="fmstep"><label class="fld"><span>الخطوة الحالية في ${esc(o.proc)}</span><select id="oStep">${p.steps.map((x, i) => `<option value="${i + 1}" ${o.step === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(uname(x.unit))}: ${esc(x.action.slice(0, 90))}</option>`).join('')}</select></label>${(o.step || 1) < n ? '<button class="btn sm" id="oAdv">✓ أُنجزت الخطوة ← التالية</button>' : ''}</div>` : ''}
    <div class="btnrow wrap mt8">${w0 ? `<button class="btn" id="oEdit">تعديل</button>${next ? `<button class="btn ${next[0] === 'closed' ? 'primary' : ''}" id="oNext">${next[1]}</button>` : ''}` : ''}${isAdmin() ? '<button class="btn ghost" id="oDel" style="color:#A6503B">حذف</button>' : ''}</div>
    <div class="toolbar m0 mt12"><h3 class="sub-h m0">أوامر العمل والإحالات للأقسام (${wos.length})</h3><span class="sp"></span>${!closed && (w0 || role() === 'tech') ? '<button class="btn sm primary" id="oWo">＋ أمر عمل للقسم المسؤول</button>' : ''}</div>
    ${wos.length ? `<div class="ochain">${wos.map(x => `<a class="ochain-i" href="#/ops/list?id=${x.id}" style="--c:#${G.U[x.unit]?.color || '6B7A88'}">${uchip(x.unit)}<b>${esc(x.title)}</b><small class="oi-ref">${esc(x.ref || '')}</small><span class="opill">${WST[x.status] || x.status}</span>${x.last_action ? `<small class="muted">↻ ${esc(snip(x.last_action, 70))}</small>` : ''}</a>`).join('')}</div>` : '<p class="muted small">لا أوامر عمل بعد. أمر العمل يصل لفريق القسم بأولوية ومهلة ويُتابع حتى الإغلاق، وحالته تظهر هنا.</p>'}
    ${attachBox('الصور والمرفقات')}
    <h3 class="sub-h">سجل المتابعة</h3><div class="fmlog">${log.length ? log.map(l => `<div class="fml ${l.kind}"><b>${esc(pname(l.by_user) || (l.kind === 'change' ? 'تحديث' : '—'))}</b><span class="muted small">${dateAr(l.at)}</span><p>${esc(l.body)}</p></div>`).join('') : '<p class="muted small">لا متابعات بعد.</p>'}</div>
    <div class="fmlogadd"><textarea id="oNote" rows="2" placeholder="أضف متابعة: ما تم، وما التالي… (تُسجَّل كآخر إجراء متخذ)"></textarea><button class="btn primary" id="oAdd">إضافة</button></div>`,
    { title: 'ملاحظة متابعة', wide: true, onOpen: (w, close) => {
      mountAttachBox(w, 'fmobs:' + o.id, { canAdd: canW() });
      const upd = async patch => { try { await q(sb.from('fm_obs').update(patch).eq('id', o.id)); changed.v = true; await load(); close(); obsDetail(o.id, re); } catch (e) { err(e); } };
      $('#oStep', w) && ($('#oStep', w).onchange = async e => { const to = +e.target.value; const a = await askAction(`الانتقال إلى الخطوة ${to}`); if (!a) { e.target.value = o.step || 1; return; } upd({ step: to, last_action: a, ...(o.status === 'open' ? { status: 'in_progress' } : {}) }); });
      $('#oAdv', w) && ($('#oAdv', w).onclick = async () => { const a = await askAction(`إنجاز الخطوة ${o.step || 1} والانتقال للتالية`, 'ما الذي أُنجز في هذه الخطوة؟ *'); if (!a) return; upd({ step: (o.step || 1) + 1, last_action: a, ...(o.status === 'open' ? { status: 'in_progress' } : {}) }); });
      $('#oEdit', w) && ($('#oEdit', w).onclick = () => { close(); obsForm(o, {}, re); });
      $('#oWo', w) && ($('#oWo', w).onclick = async () => { close(); const { newItem } = await import('./ops.js');
        const KMAP = { MNT: 'mnt', BME: 'bme', IT: 'it', GEN: 'gen', SAF: 'saf', FAC: 'fac', MED: 'med', PRJ: 'prj' };
        newItem({ kind: KMAP[o.owner] || 'mnt', fm_obs_id: o.id, facility_id: o.facility_id, title: o.title, details: o.details || '', source: 'fm', priority: o.severity === 'down' ? (s?.critical ? 'p1' : 'p2') : o.severity === 'partial' ? 'p2' : 'p3' }, () => obsDetail(o.id, re)); });
      $('#oNext', w) && ($('#oNext', w).onclick = async () => {
        if (next[0] === 'closed') { const note = await askAction('إغلاق الملاحظة', 'كيف عولجت؟ *', 'الإغلاق يعني أن المشكلة عولجت وتحقق منها. اكتب المعالجة النهائية ونتيجة التحقق.'); if (!note) return; return upd({ status: 'closed', close_note: note, last_action: note, step: n || o.step }); }
        const a = await askAction(next[1], next[0] === 'verify' ? 'ما الذي عولج ويحتاج تحققاً؟ *' : next[0] === 'in_progress' && o.status === 'closed' ? 'سبب إعادة الفتح *' : 'المعالجة أو الإجراء المتخذ *'); if (!a) return;
        upd({ status: next[0], last_action: a });
      });
      $('#oDel', w) && ($('#oDel', w).onclick = async () => { if (!await confirm('حذف الملاحظة وسجلها نهائياً؟', 'حذف', true)) return; try { await q(sb.from('fm_obs').delete().eq('id', o.id)); toast('حُذفت'); close(); re(); } catch (e) { err(e); } });
      $('#oAdd', w).onclick = async () => { const b = $('#oNote', w).value.trim(); if (!b) return; try { await q(sb.from('fm_obs_log').insert({ obs_id: o.id, body: b, by_user: session.user.id, kind: 'note' })); changed.v = true; close(); obsDetail(o.id, re); } catch (e) { err(e); } };
      w.addEventListener('click', e => { if ((e.target === w || e.target.hasAttribute('data-x')) && changed.v) re(); });
    } });
}

async function obsForm(o, preset = {}, done) {
  const v = o || { severity: 'attention', status: 'open', step: 1, source: 'manual', ...preset };
  const units = G.units.filter(u => u.kind === 'unit').map(u => [u.code, u.short]);
  const procs = Object.values(G.P).filter(p => p.active !== false).sort((a, b) => a.code.localeCompare(b.code));
  const people = [['', '—'], ...D.people.filter(p => ['admin', 'facility'].includes(p.role) || p.id === v.assignee_id).map(p => [p.id, p.full_name])];
  let projects = []; if (canEdit()) { try { projects = await q(sb.from('projects').select('id,name').neq('stage', 'cancelled').order('name')); } catch { } }
  const sysOpts = sid => [['', '— (عام للمنشأة)'], ...D.allSys.filter(s => s.active !== false || s.code === sid).map(s => [s.code, `${GRP[s.grp]} — ${s.name}`])];
  const stepOpts = (pc, cur) => { const p = G.P[pc]; return p ? p.steps.map((x, i) => `<option value="${i + 1}" ${+cur === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(uname(x.unit))}: ${esc(x.action.slice(0, 80))}</option>`).join('') : '<option value="">—</option>'; };
  const procSel = cur => `<select name="proc">${procs.map(p => `<option value="${p.code}" ${p.code === cur ? 'selected' : ''}>${p.code} — ${esc(p.title)}</option>`).join('')}</select>`;
  if (!v.proc) { const s = D.S[v.system_code]; v.proc = suggestProc(s, v.severity); v.owner ||= s?.owner || 'MNT'; }
  await modal(`<form id="f" class="pgrid">
    ${field('المنشأة *', sel('facility_id', [['', '—'], ...D.fac.map(f => [f.id, f.name])], v.facility_id || '', 'required'))}
    ${field('النظام', sel('system_code', sysOpts(v.system_code), v.system_code || ''))}
    ${field('عنوان الملاحظة *', inp('title', v.title || '', 'required placeholder="مثال: تعطل مضخة الإطفاء الرئيسية"'), 'wide')}
    ${field('الوصف والتفاصيل', `<textarea name="details" rows="3">${esc(v.details || '')}</textarea>`, 'wide')}
    ${field('الخطورة', sel('severity', [['attention', 'يحتاج متابعة'], ['partial', 'معطل جزئياً'], ['down', 'معطل']], v.severity))}
    ${field('القسم المسؤول', sel('owner', units, v.owner || 'MNT'))}
    <div class="fld wide fmprocf"><span>الإجراء الحاكم في الدليل <small class="muted" id="pHint"></small></span>${procSel(v.proc)}</div>
    ${field('الخطوة الحالية', `<select name="step">${stepOpts(v.proc, v.step || 1)}</select>`, 'wide')}
    ${field('المكلّف (حساب)', sel('assignee_id', people, v.assignee_id || ''))}
    ${field('أو اسم المكلّف', inp('assignee_name', v.assignee_name || ''))}
    ${field('الموعد المستهدف', inp('due_date', v.due_date || '', 'type="date"'))}
    ${projects.length ? field('مرتبطة بمشروع (إن تحولت لمشروع)', sel('project_id', [['', '—'], ...projects.map(p => [p.id, p.name])], v.project_id || '')) : ''}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${o ? 'حفظ' : 'إنشاء الملاحظة'}</button></div></form>`,
    { title: o ? 'تعديل ملاحظة' : 'ملاحظة جديدة', wide: true, onOpen: (w, close) => {
      const form = $('#f', w);
      const hint = () => { const s = D.S[form.system_code.value], sg = suggestProc(s, form.severity.value); $('#pHint', w).innerHTML = s ? `المقترح لهذا النظام: <a href="#" data-sug="${sg}">${sg}</a>${s.critical && form.severity.value === 'down' ? ' (نظام حرج معطل ← طوارئ)' : ''}` : ''; const a = $('[data-sug]', w); if (a) a.onclick = e => { e.preventDefault(); form.proc.value = sg; form.step.innerHTML = stepOpts(sg, 1); }; };
      form.proc.onchange = () => { form.step.innerHTML = stepOpts(form.proc.value, 1); };
      form.system_code.onchange = () => { const s = D.S[form.system_code.value]; if (s && !o) { form.owner.value = s.owner || form.owner.value; form.proc.value = suggestProc(s, form.severity.value); form.step.innerHTML = stepOpts(form.proc.value, 1); } hint(); };
      form.severity.onchange = hint; hint();
      form.onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
        const row = { facility_id: +x.facility_id, system_code: x.system_code || null, title: x.title.trim(), details: x.details.trim(), severity: x.severity, owner: x.owner, proc: x.proc, step: +x.step || null, assignee_id: x.assignee_id || null, assignee_name: x.assignee_name.trim(), due_date: x.due_date || null, ...(projects.length ? { project_id: x.project_id || null } : {}) };
        try {
          if (o) await q(sb.from('fm_obs').update(row).eq('id', o.id));
          else await q(sb.from('fm_obs').insert({ ...row, status: 'open', source: v.source || 'manual', round_id: v.round_id || null, created_by: session.user.id }));
          toast(o ? 'حُفظت' : 'أُنشئت الملاحظة'); close(); await load(); done && done();
        } catch (e2) { err(e2); } };
    } });
}

// ---------- سجل الأنظمة (للإدارة)
function viewSystems(t, re) {
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2 class="m0">سجل الأنظمة <span class="muted">(${D.allSys.length})</span></h2><span class="muted small">لكل نظام قسمه المالك وإجراؤه الحاكم؛ منها تُقترح الإجراءات للملاحظات تلقائياً.</span><span class="sp"></span><button class="btn primary" id="sNew">＋ نظام</button></div>
    <div class="tblwrap"><table class="lst"><thead><tr><th>الكود</th><th>النظام</th><th>المجموعة</th><th>القسم المالك</th><th>الإجراء الحاكم</th><th class="c">حرج</th><th class="c">الترتيب</th><th></th></tr></thead><tbody>
    ${D.allSys.map(s => `<tr class="${s.active === false ? 'off' : ''}"><td><b class="ltr">${esc(s.code)}</b></td><td>${esc(s.name)}<div class="muted small">${esc(s.name_en || '')}</div></td><td>${GRP[s.grp]}</td><td>${uchip(s.owner)}${(s.partners || []).map(uchip).join('')}</td><td>${s.proc ? govChip(s.proc) : '—'}</td><td class="c">${s.critical ? '●' : ''}</td><td class="c">${s.sort}</td><td><button class="btn sm" data-e="${esc(s.code)}">تعديل</button></td></tr>`).join('')}</tbody></table></div></div>`;
  const form = s => { const v = s || { grp: 'system', owner: 'MNT', partners: [], proc: 'G-05', sort: (D.allSys.slice(-1)[0]?.sort || 0) + 10, active: true };
    const units = G.units.filter(u => u.kind === 'unit');
    modal(`<form id="f" class="pgrid">${field('الكود *', inp('code', v.code || '', s ? 'readonly' : 'required placeholder="مثال: STER" dir="ltr"'))}${field('الترتيب', inp('sort', v.sort, 'type="number"'))}${field('الاسم *', inp('name', v.name || '', 'required'), 'wide')}${field('الاسم بالإنجليزية', inp('name_en', v.name_en || '', 'dir="ltr"'))}${field('المجموعة', sel('grp', Object.entries(GRP), v.grp))}${field('القسم المالك', sel('owner', units.map(u => [u.code, u.short]), v.owner))}${field('الإجراء الحاكم', sel('proc', Object.values(G.P).map(p => [p.code, p.code + ' — ' + p.title]), v.proc))}
      <div class="fld wide"><span>أقسام مشاركة</span><div class="chips">${units.map(u => `<label class="chip"><input type="checkbox" name="p_${u.code}" ${(v.partners || []).includes(u.code) ? 'checked' : ''}> ${esc(u.short)}</label>`).join('')}</div></div>
      ${field('ما الذي يُفحص', inp('hint', v.hint || ''), 'wide')}<label class="chk wide"><input type="checkbox" name="critical" ${v.critical ? 'checked' : ''}> نظام حرج (تعطله يُقترح له إجراء الطوارئ G-11)</label><label class="chk wide"><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}> فعّال (يظهر في الجولة والمصفوفة)</label>
      <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: s ? 'تعديل نظام' : 'نظام جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
        const row = { code: x.code.trim().toUpperCase(), name: x.name.trim(), name_en: x.name_en.trim(), grp: x.grp, owner: x.owner, proc: x.proc, partners: units.map(u => u.code).filter(c => x['p_' + c]), hint: x.hint.trim(), critical: !!x.critical, active: !!x.active, sort: +x.sort || 0 };
        try { if (s) await q(sb.from('fm_systems').update(row).eq('code', s.code)); else await q(sb.from('fm_systems').insert(row)); toast('حُفظ'); close(); re(); } catch (e2) { err(e2); } };
    } }); };
  $('#sNew', t).onclick = () => form(null);
  $$('[data-e]', t).forEach(b => b.onclick = () => form(D.S[b.dataset.e]));
}

// ---------- التقرير الشهري (للطباعة، ولرابط الجهة التنفيذية، ولملف Excel)
const tokenGen = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
async function reportData(period) {
  const rs = D.rounds.filter(r => r.period === period);
  const checks = rs.length ? await q(sb.from('fm_checks').select('round_id,system_code,status,note').in('round_id', rs.map(r => r.id))) : [];
  return buildReport(period, D, G, checks);
}
function viewReport(t, params) {
  const periods = [...new Set(D.rounds.map(r => r.period))].sort().reverse();
  const period = params.get('p') ? params.get('p') + '-01' : periods[0] || thisMonth();
  const admin = isAdmin();
  t.innerHTML = `<div class="toolbar noprint"><label class="fld m0" style="min-width:200px"><span>الشهر</span>${sel('rp', (periods.length ? periods : [period]).map(p => [p.slice(0, 7), monthAr(p)]), period.slice(0, 7))}</label><span class="sp"></span>
      ${admin ? '<button class="btn primary" id="rShare">نشر رابط للجهة التنفيذية</button>' : ''}<button class="btn" id="rXl">تصدير Excel</button><button class="btn" onclick="print()">طباعة / PDF</button></div>
    ${admin ? '<div id="rAdmin" class="noprint"></div>' : ''}<div id="rep" class="fmrep"><div class="loading"><div class="spin"></div></div></div>`;
  $('[name=rp]', t).onchange = e => location.hash = '#/fm/report?p=' + e.target.value;
  let R = null;
  (async () => { R = await reportData(period); $('#rep', t).innerHTML = renderReport(R); })();
  $('#rXl', t).onclick = async () => { if (!R) return; await exportXlsx(R); };
  if (!admin) return;
  $('#rShare', t).onclick = async () => {
    if (!R) return;
    const v = await modal(`<form id="sf" class="pgrid"><p class="wide muted small m0">يُنشأ إصدار مجمّد من تقرير ${monthAr(period)} كما هو الآن، يفتحه م. أيمن ونائب الرئيس من الجوال بلا حساب، ويستطيعان إرسال ملاحظة على التقرير أو على أي حالة فتصلك إشعاراً.</p>${field('صلاحية الرابط', sel('days', [['14', 'أسبوعان'], ['45', '45 يوماً'], ['90', '90 يوماً']], '45'))}${field('رمز دخول (اختياري)', inp('pin', '', 'inputmode="numeric" maxlength="8" placeholder="مثال: 2468" dir="ltr"'))}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">نشر الرابط</button></div></form>`,
      { title: 'نشر رابط التقرير', onOpen: (w, c) => { $('#sf', w).onsubmit = e => { e.preventDefault(); c(formData(e.target)); }; } });
    if (!v) return;
    try {
      const token = tokenGen();
      await q(sb.from('fm_shares').insert({ token, period, data: R, pin: v.pin.trim() || null, expires_at: new Date(Date.now() + (+v.days) * 864e5).toISOString(), created_by: session.user.id }));
      const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'fmr.html?t=' + token;
      const { linkModal } = await import('./share.js'); linkModal(url, `تقرير حالة الأنظمة الحرجة — ${monthAr(period)}`, v.pin.trim());
      shares();
    } catch (e) { err(e); }
  };
  const shares = async () => {
    const [ss, notes] = await Promise.all([q(sb.from('fm_shares').select('id,token,period,pin,expires_at,revoked,views,last_viewed_at,created_at').order('id', { ascending: false }).limit(12)), q(sb.from('fm_share_notes').select('*').order('id', { ascending: false }).limit(40))]);
    const box = $('#rAdmin', t); if (!box) return;
    const nNew = notes.filter(n => !n.seen).length;
    box.innerHTML = (ss.length || notes.length) ? `<div class="fm2col mb12"><div class="pcard"><h2>الروابط المنشورة</h2>${ss.length ? `<div class="tblwrap"><table class="lst"><thead><tr><th>الشهر</th><th>نُشر</th><th class="c">المشاهدات</th><th>الصلاحية</th><th></th></tr></thead><tbody>${ss.map(x => { const off = x.revoked || new Date(x.expires_at) < new Date(); return `<tr class="${off ? 'off' : ''}"><td>${monthAr(x.period)}${x.pin ? ' ' + ico('lock') : ''}</td><td>${dateAr(x.created_at)}</td><td class="c">${x.views}${x.last_viewed_at ? `<div class="muted small">${ago(x.last_viewed_at)}</div>` : ''}</td><td>${x.revoked ? 'موقوف' : off ? 'منتهٍ' : 'حتى ' + dateAr(x.expires_at)}</td><td>${off ? '' : `<button class="btn sm" data-cp="${x.token}">نسخ</button> <button class="btn sm ghost" data-rv="${x.id}">إيقاف</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">لا روابط بعد.</p>'}</div>
      <div class="pcard"><h2>ملاحظات الجهة التنفيذية ${nNew ? `<span class="fmcnt bad">${nNew} جديدة</span>` : ''}</h2>${notes.length ? `<div class="fmlog">${notes.map(n => `<div class="fml ${n.seen ? 'change' : ''}"><b>${esc(n.name)}</b>${n.role_title ? `<span class="muted small">${esc(n.role_title)} · </span>` : ''}<span class="muted small">${dateAr(n.created_at)}</span>${n.ref_title ? `<div class="small"><b>على:</b> ${esc(n.ref_title)}</div>` : ''}<p>${esc(n.body)}</p></div>`).join('')}</div>` : '<p class="muted">لا ملاحظات بعد.</p>'}</div></div>` : '';
    $$('[data-cp]', box).forEach(b => b.onclick = async () => { const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'fmr.html?t=' + b.dataset.cp; const { linkModal } = await import('./share.js'); linkModal(url, 'تقرير حالة الأنظمة الحرجة', ''); });
    $$('[data-rv]', box).forEach(b => b.onclick = async () => { if (!await confirm('إيقاف الرابط؟ لن يفتح بعد الآن.', 'إيقاف', true)) return; await q(sb.from('fm_shares').update({ revoked: true }).eq('id', +b.dataset.rv)); shares(); });
    if (nNew) q(sb.from('fm_share_notes').update({ seen: true }).eq('seen', false)).catch(() => {});
  };
  shares();
}

// ---------- ملف Excel منسّق: الملخص، المصفوفة الملونة، الملاحظات
async function exportXlsx(R) {
  try { const { loadExcelJS } = await import('./excel.js'); await loadExcelJS(); } catch (e) { return err('تعذّر تحميل مكتبة Excel'); }
  const wb = new ExcelJS.Workbook(); wb.creator = 'إدارة الخدمات الفنية — تجمع الأحساء الصحي';
  const NAVY = 'FF123B5C', SKY = 'FF27A8DF', F = { name: 'Tajawal', size: 11 };
  const COL = { good: 'FF2E8B57', attention: 'FFC99A1E', partial: 'FFD9772B', down: 'FFC0392B', na: 'FFDCE3EA' };
  const LBL = { good: 'يعمل جيداً', attention: 'يحتاج متابعة', partial: 'معطل جزئياً', down: 'معطل', na: 'لا ينطبق' };
  const head = (ws, row) => { const r = ws.getRow(row); r.eachCell(c => { c.font = { ...F, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; }); r.height = 34; };
  const title = (ws, text, span) => { ws.mergeCells(1, 1, 1, span); const c = ws.getCell(1, 1); c.value = text; c.font = { ...F, size: 15, bold: true, color: { argb: NAVY } }; c.alignment = { horizontal: 'right' }; ws.mergeCells(2, 1, 2, span); const d = ws.getCell(2, 1); d.value = `تجمع الأحساء الصحي — إدارة الخدمات الفنية · ${monthAr(R.period)} · صدر ${dateAr(R.issued)}`; d.font = { ...F, size: 10, color: { argb: 'FF66768A' } }; ws.getRow(2).height = 18; };
  // الملخص
  const s1 = wb.addWorksheet('الملخص', { views: [{ rightToLeft: true, showGridLines: false }] }); title(s1, 'تقرير حالة الأنظمة الحرجة في المنشآت', 4);
  const k = R.kpi; const rows = [['جاهزية الأنظمة', `${k.ready}٪ (${k.good} من ${k.base})`], ['منشآت مُحدَّثة', `${k.facDone} من ${k.facTotal}`], ['معطل كلياً أو جزئياً', k.bad], ['يحتاج متابعة', k.att], ['ملاحظات مفتوحة', k.open], ['منها متأخرة عن موعدها', k.late], ['منها بلا تحديث', k.stale], ['أُغلقت هذا الشهر', k.closedM]];
  s1.getRow(4).values = ['المؤشر', 'القيمة']; head(s1, 4); rows.forEach((r, i) => { const x = s1.getRow(5 + i); x.values = r; x.eachCell(c => { c.font = F; c.border = { bottom: { style: 'hair', color: { argb: 'FFE3E8EE' } } }; }); x.getCell(2).font = { ...F, bold: true, color: { argb: NAVY } }; });
  s1.getRow(15).values = ['المنشأة', 'الجاهزية']; head(s1, 15); R.matrix.forEach((m, i) => { const x = s1.getRow(16 + i); x.values = [m.name, m.ready == null ? '—' : m.ready / 100]; x.getCell(2).numFmt = '0%'; x.eachCell(c => c.font = F); });
  s1.columns = [{ width: 44 }, { width: 22 }, { width: 4 }, { width: 4 }];
  // المصفوفة
  const s2 = wb.addWorksheet('المصفوفة', { views: [{ rightToLeft: true, state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] }); title(s2, 'مصفوفة حالة الأنظمة', R.systems.length + 2);
  s2.getRow(4).values = ['المنشأة', ...R.systems.map(x => x.name), 'الجاهزية']; head(s2, 4); s2.getRow(4).height = 64;
  R.matrix.forEach((m, i) => { const x = s2.getRow(5 + i); x.values = [m.name, ...R.systems.map(sy => m.cells[sy.code] ? LBL[m.cells[sy.code]] : ''), m.ready == null ? '' : m.ready / 100]; x.height = 26;
    x.eachCell((c, ci) => { c.font = { ...F, size: 9 }; c.alignment = { vertical: 'middle', horizontal: ci === 1 ? 'right' : 'center', wrapText: true }; c.border = { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
      const st = ci > 1 && ci <= R.systems.length + 1 ? m.cells[R.systems[ci - 2].code] : null; if (st) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL[st] } }; c.font = { ...F, size: 9, bold: true, color: { argb: st === 'na' ? 'FF66768A' : 'FFFFFFFF' } }; } });
    x.getCell(R.systems.length + 2).numFmt = '0%'; x.getCell(1).font = { ...F, bold: true }; });
  s2.columns = [{ width: 34 }, ...R.systems.map(() => ({ width: 11 })), { width: 10 }];
  // الملاحظات
  const s3 = wb.addWorksheet('الحالات والملاحظات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4, showGridLines: false }] }); title(s3, 'الحالات قيد المعالجة', 11);
  s3.getRow(4).values = ['المنشأة', 'النظام', 'الحالة', 'رقم', 'الملاحظة', 'الإجراء الحاكم', 'الخطوة', 'حالة المتابعة', 'آخر إجراء متخذ', 'تاريخه', 'المسؤول / الموعد']; head(s3, 4);
  let r = 5; const OSTx = { open: 'مفتوحة', in_progress: 'قيد المعالجة', verify: 'بانتظار التحقق', closed: 'مغلقة' };
  R.active.forEach(a => a.obs.forEach(o => { const x = s3.getRow(r++); x.values = [a.fac, a.sys, LBL[a.status], '#' + o.id, o.title, o.proc, o.step ? `${o.step}${o.steps ? '/' + o.steps : ''}` : '', OSTx[o.status] || '', o.action || 'لم يُسجَّل', o.action_at ? new Date(o.action_at) : '', [o.owner, o.assignee, o.due ? 'الموعد ' + o.due : ''].filter(Boolean).join(' · ')];
    x.eachCell((c, ci) => { c.font = F; c.alignment = { vertical: 'top', wrapText: true }; c.border = { bottom: { style: 'hair', color: { argb: 'FFE3E8EE' } } }; });
    x.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL[a.status] } }; x.getCell(3).font = { ...F, bold: true, color: { argb: 'FFFFFFFF' } }; x.getCell(10).numFmt = 'yyyy-mm-dd';
    if (o.stale) x.getCell(9).font = { ...F, color: { argb: 'FFC0392B' } }; }));
  r += 1; s3.getRow(r).values = ['حالات تحتاج توثيقاً (غير سليمة بلا ملاحظة)']; s3.getRow(r).getCell(1).font = { ...F, bold: true, size: 13, color: { argb: NAVY } }; r++;
  s3.getRow(r).values = ['النظام', 'العدد', 'المنشآت', '', '', 'الإجراء الحاكم', '', '', 'القسم المالك']; head(s3, r); s3.mergeCells(r, 3, r, 5); r++;
  R.undoc.forEach(g => { const x = s3.getRow(r); x.values = [g.sys, g.facs.length, g.facs.map(f => f.name + (f.status !== 'attention' ? ` (${LBL[f.status]})` : '')).join('، '), '', '', g.proc, '', '', g.owner]; s3.mergeCells(r, 3, r, 5); x.eachCell(c => { c.font = F; c.alignment = { vertical: 'top', wrapText: true }; }); r++; });
  s3.columns = [{ width: 30 }, { width: 24 }, { width: 14 }, { width: 8 }, { width: 46 }, { width: 10 }, { width: 8 }, { width: 14 }, { width: 50 }, { width: 12 }, { width: 30 }];
  [s1, s2, s3].forEach(ws => { ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }; ws.headerFooter = { oddFooter: '&Lتجمع الأحساء الصحي — إدارة الخدمات الفنية&Rصفحة &P من &N' }; });
  const buf = await wb.xlsx.writeBuffer(); const { download } = await import('./ui.js');
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `تقرير حالة الأنظمة - ${monthAr(R.period)}.xlsx`);
}
