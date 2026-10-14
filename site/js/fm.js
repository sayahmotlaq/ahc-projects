// ===== متابعة أنظمة المنشآت: اللوحة، الجولة الشهرية، الملاحظات المرتبطة بدليل الإجراءات، سجل الأنظمة، التقرير الشهري =====
import { sb, q, session, isAdmin, role, canEdit } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, dateAr } from './ui.js';
import { govBar, govChip } from './govlink.js';

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
    const stale = D.fac.filter(f => { const r = lastRound(f.id); return !r || r.period < cm; });
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
        ${kpi(lt.length ? 'red' : 'blue', open.length, 'ملاحظات مفتوحة', lt.length ? `منها <b>${lt.length}</b> متأخرة عن موعدها` : 'لا ملاحظات متأخرة', '#/fm/obs')}
        ${kpi(undoc ? 'amber' : 'green', undoc, 'حالات بلا ملاحظة', undoc ? 'حالة غير سليمة لم تُفتح لها ملاحظة بعد' : 'كل حالة موثقة')}
        ${kpi(stale.length ? 'amber' : 'green', stale.length, 'منشآت لم تُحدَّث هذا الشهر', stale.length ? stale.slice(0, 3).map(f => esc(f.name)).join('، ') + (stale.length > 3 ? '…' : '') : 'كل المنشآت محدّثة')}
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
    <span class="fmo-f">${opill(o.status)}${o.proc ? `<span class="fmproc">📘 ${esc(o.proc)}${o.step && n ? ` · ${o.step}/${n}` : ''}</span>` : ''}${o.owner ? uchip(o.owner) : ''}${o.due_date ? `<span class="${late(o) ? 'bad' : 'muted'} small">⏱ ${dateAr(o.due_date)}</span>` : ''}${o.assignee_id || o.assignee_name ? `<span class="muted small">👤 ${esc(pname(o.assignee_id) || o.assignee_name)}</span>` : ''}</span></button>`;
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
  const fid = +(params.get('f') || 0) || null;
  const period = (params.get('p') || thisMonth().slice(0, 7)) + '-01';
  const pickers = `<div class="pcard fmpick"><label class="fld"><span>المنشأة</span>${sel('f', [['', '— اختر المنشأة —'], ...D.fac.map(f => [f.id, f.name])], fid || '')}</label><label class="fld"><span>الشهر</span><input type="month" name="p" value="${period.slice(0, 7)}" max="${thisMonth().slice(0, 7)}"></label>
    <div class="fmpick-st">${D.fac.map(f => { const r = D.rounds.find(x => x.facility_id === f.id && x.period === period); return `<a href="#/fm/round?f=${f.id}&p=${period.slice(0, 7)}" class="${f.id === fid ? 'on' : ''} ${r ? (r.status === 'submitted' ? 'ok' : 'dr') : ''}" title="${r ? (r.status === 'submitted' ? 'معتمدة' : 'مسودة') : 'لم تبدأ'}">${esc(f.name)}</a>`; }).join('')}</div></div>`;
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
    const rid = await save('submitted'); if (!rid) return;
    if (auto) { try { await q(sb.from('fm_obs').insert(need.map(s => { const v = val[s.code].status; return { facility_id: fid, system_code: s.code, title: `${s.name}: ${stLabel(v, s)}`, details: val[s.code].note.trim(), severity: v, proc: suggestProc(s, v), step: 1, owner: s.owner, source: 'round', round_id: rid, created_by: session.user.id }; }))); toast(`أُنشئت ${need.length} ملاحظة`); } catch (e) { err(e); } }
    await load(); viewRound(t, params, re);
  });
}
function bindPick(t) {
  const go = () => { const f = $('[name=f]', t).value, p = $('[name=p]', t).value; location.hash = `#/fm/round?${f ? 'f=' + f + '&' : ''}p=${p}`; };
  $('[name=f]', t).onchange = go; $('[name=p]', t).onchange = go;
}

// ---------- الملاحظات
function viewObs(t, params, re) {
  const st = { q: params.get('q') || '', f: params.get('f') || '', g: '', u: '', s: params.get('s') || 'active', late: params.get('late') === '1' };
  t.innerHTML = `<div class="filters fmofilt"><input id="oq" placeholder="بحث في الملاحظات…" value="${esc(st.q)}">${sel('of', [['', 'كل المنشآت'], ...D.fac.map(f => [f.id, f.name])], st.f)}${sel('og', [['', 'كل المجموعات'], ...Object.entries(GRP)], '')}${sel('ou', [['', 'كل الأقسام'], ...G.units.filter(u => u.kind === 'unit').map(u => [u.code, u.short])], '')}${sel('os', [['active', 'المفتوحة (غير المغلقة)'], ['', 'الكل'], ...Object.entries(OST)], st.s)}<label class="chk"><input type="checkbox" id="ol" ${st.late ? 'checked' : ''}> المتأخرة فقط</label></div>
    <div class="fmostats" id="oStats"></div><div id="oList"></div>`;
  const render = () => {
    const list = D.obs.filter(o => (!st.f || o.facility_id === +st.f) && (!st.g || D.S[o.system_code]?.grp === st.g) && (!st.u || o.owner === st.u) && (st.s === 'active' ? o.status !== 'closed' : !st.s || o.status === st.s) && (!st.late || late(o))
      && (!st.q || (o.title + ' ' + o.details + ' ' + (D.F[o.facility_id]?.name || '') + ' ' + (D.S[o.system_code]?.name || '') + ' #' + o.id).includes(st.q)));
    list.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || late(b) - late(a) || RANK[b.severity] - RANK[a.severity] || b.id - a.id);
    const c = k => D.obs.filter(o => o.status === k).length;
    $('#oStats', t).innerHTML = Object.entries(OST).map(([k, v]) => `<span style="--c:${OSTC[k]}"><b>${c(k)}</b>${v}</span>`).join('') + `<span class="${D.obs.filter(late).length ? 'bad' : ''}" style="--c:#C0392B"><b>${D.obs.filter(late).length}</b>متأخرة</span>`;
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
  const log = await q(sb.from('fm_obs_log').select('*').eq('obs_id', id).order('id'));
  const f = D.F[o.facility_id], s = D.S[o.system_code], p = G.P[o.proc], n = p?.steps?.length || 0;
  const w0 = canW(), closed = o.status === 'closed';
  const next = { open: ['in_progress', 'بدء المعالجة'], in_progress: ['verify', 'طلب التحقق'], verify: ['closed', 'إغلاق الملاحظة'], closed: ['in_progress', 'إعادة فتح'] }[o.status];
  const changed = { v: false };
  await modal(`${govBar([o.proc || 'G-05', closed ? 'done' : (o.step || 1)], OST[o.status])}
    <div class="fmod-h" style="--c:${ST[o.severity].c}"><div><b>#${o.id} — ${esc(o.title)}</b><span class="muted">${esc(f?.name || '')}${s ? ' · ' + esc(s.name) : ''}</span></div>${opill(o.status)}</div>
    ${o.details ? `<p class="pre">${esc(o.details)}</p>` : ''}
    <div class="kvs">${[['الخطورة', pill(o.severity, s)], ['القسم المسؤول', uchip(o.owner) || '—'], ['المكلّف', esc(pname(o.assignee_id) || o.assignee_name || '—')], ['الموعد', o.due_date ? `<span class="${late(o) ? 'bad' : ''}">${dateAr(o.due_date)}${late(o) ? ' (متأخرة)' : ''}</span>` : '—'], ['المصدر', { round: 'الجولة الشهرية', manual: 'إدخال مباشر', import: 'مستوردة من ملف Excel' }[o.source] || '—'], ['أُنشئت', dateAr(o.created_at)], ...(o.project_id ? [['المشروع', `<a href="#/project/${o.project_id}">فتح المشروع</a>`]] : []), ...(closed ? [['أُغلقت', dateAr(o.closed_at) + (o.close_note ? ' — ' + esc(o.close_note) : '')]] : [])].map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    ${w0 && p && !closed ? `<div class="fmstep"><label class="fld"><span>الخطوة الحالية في ${esc(o.proc)}</span><select id="oStep">${p.steps.map((x, i) => `<option value="${i + 1}" ${o.step === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(uname(x.unit))}: ${esc(x.action.slice(0, 90))}</option>`).join('')}</select></label>${(o.step || 1) < n ? '<button class="btn sm" id="oAdv">✓ أُنجزت الخطوة ← التالية</button>' : ''}</div>` : ''}
    <div class="btnrow wrap mt8">${w0 ? `<button class="btn" id="oEdit">تعديل</button>${next ? `<button class="btn ${next[0] === 'closed' ? 'primary' : ''}" id="oNext">${next[1]}</button>` : ''}` : ''}${isAdmin() ? '<button class="btn ghost" id="oDel" style="color:#A6503B">حذف</button>' : ''}</div>
    <h3 class="sub-h">سجل المتابعة</h3><div class="fmlog">${log.length ? log.map(l => `<div class="fml ${l.kind}"><b>${esc(pname(l.by_user) || (l.kind === 'change' ? 'تحديث' : '—'))}</b><span class="muted small">${dateAr(l.at)}</span><p>${esc(l.body)}</p></div>`).join('') : '<p class="muted small">لا متابعات بعد.</p>'}</div>
    <div class="fmlogadd"><textarea id="oNote" rows="2" placeholder="أضف متابعة: ما تم، وما التالي…"></textarea><button class="btn primary" id="oAdd">إضافة</button></div>`,
    { title: 'ملاحظة متابعة', wide: true, onOpen: (w, close) => {
      const upd = async patch => { try { await q(sb.from('fm_obs').update(patch).eq('id', o.id)); changed.v = true; await load(); close(); obsDetail(o.id, re); } catch (e) { err(e); } };
      $('#oStep', w) && ($('#oStep', w).onchange = e => upd({ step: +e.target.value, ...(o.status === 'open' ? { status: 'in_progress' } : {}) }));
      $('#oAdv', w) && ($('#oAdv', w).onclick = () => upd({ step: (o.step || 1) + 1, ...(o.status === 'open' ? { status: 'in_progress' } : {}) }));
      $('#oEdit', w) && ($('#oEdit', w).onclick = () => { close(); obsForm(o, {}, re); });
      $('#oNext', w) && ($('#oNext', w).onclick = async () => {
        if (next[0] === 'closed') { const note = await modal(`<form id="cf"><label class="fld"><span>كيف عولجت؟ *</span><textarea name="n" rows="3" required></textarea></label><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إغلاق</button></div></form>`, { title: 'إغلاق الملاحظة', onOpen: (w2, c2) => { $('#cf', w2).onsubmit = e => { e.preventDefault(); c2(formData(e.target).n.trim()); }; } }); if (!note) return; return upd({ status: 'closed', close_note: note, step: n || o.step }); }
        upd({ status: next[0] });
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

// ---------- التقرير الشهري (للطباعة والعرض على الإدارة)
function viewReport(t, params) {
  const periods = [...new Set(D.rounds.map(r => r.period))].sort().reverse();
  const period = params.get('p') ? params.get('p') + '-01' : periods[0] || thisMonth();
  const rs = D.rounds.filter(r => r.period === period);
  t.innerHTML = `<div class="toolbar noprint"><label class="fld m0" style="min-width:200px"><span>الشهر</span>${sel('rp', (periods.length ? periods : [period]).map(p => [p.slice(0, 7), monthAr(p)]), period.slice(0, 7))}</label><span class="sp"></span><button class="btn primary" onclick="print()">طباعة / PDF</button></div><div id="rep" class="fmrep"><div class="loading"><div class="spin"></div></div></div>`;
  $('[name=rp]', t).onchange = e => location.hash = '#/fm/report?p=' + e.target.value;
  (async () => {
    const checks = rs.length ? await q(sb.from('fm_checks').select('round_id,system_code,status,note').in('round_id', rs.map(r => r.id))) : [];
    const byF = {}; checks.forEach(c => { const r = rs.find(x => x.id === c.round_id); (byF[r.facility_id] ||= {})[c.system_code] = c; });
    let good = 0, base = 0; const issues = [];
    D.fac.forEach(f => D.sys.forEach(s => { const c = byF[f.id]?.[s.code]; if (!c || c.status === 'na') return; base++; if (c.status === 'good') good++; else issues.push({ f, s, c }); }));
    issues.sort((a, b) => RANK[b.c.status] - RANK[a.c.status]);
    const open = D.obs.filter(o => o.status !== 'closed'), lt = D.obs.filter(late);
    const closedM = D.obs.filter(o => o.closed_at && o.closed_at.slice(0, 7) === period.slice(0, 7));
    const sc = f => D.sys.reduce((a, x) => a + (RANK[byF[f.id]?.[x.code]?.status] || 0) ** 2, 0); const facs = D.fac.filter(f => byF[f.id]).sort((a, b) => sc(b) - sc(a));
    $('#rep', t).innerHTML = `<header class="fmrep-h"><img src="assets/logo.png" alt=""><div><h1>تقرير حالة الأنظمة الحرجة في المنشآت</h1><p>تجمع الأحساء الصحي — إدارة الخدمات الفنية · ${monthAr(period)}</p></div><div class="fmrep-d">تاريخ الإصدار<br><b>${dateAr(todayIso())}</b></div></header>
      <div class="fmrep-k"><div><b>${base ? Math.round(good / base * 100) : 0}٪</b><span>جاهزية الأنظمة</span></div><div><b>${facs.length} / ${D.fac.length}</b><span>منشآت مُحدَّثة</span></div><div class="r"><b>${issues.filter(i => ['down', 'partial'].includes(i.c.status)).length}</b><span>معطل كلياً أو جزئياً</span></div><div class="a"><b>${issues.filter(i => i.c.status === 'attention').length}</b><span>يحتاج متابعة</span></div><div><b>${open.length}</b><span>ملاحظات مفتوحة${lt.length ? ` · ${lt.length} متأخرة` : ''}</span></div><div class="g"><b>${closedM.length}</b><span>أُغلقت هذا الشهر</span></div></div>
      <h2>المصفوفة</h2><table class="fmtab rep"><thead><tr><th class="fh">المنشأة</th>${D.sys.map(s => `<th class="sh"><span>${esc(s.name)}</span></th>`).join('')}</tr></thead><tbody>${facs.map(f => `<tr><th class="fh">${esc(f.name)}</th>${D.sys.map(s => { const c = byF[f.id]?.[s.code]; return `<td><span class="fmc ${c ? 's-' + c.status : 's-none'}">${c ? ST[c.status].i : ''}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <div class="fmlegend">${ORDER.map(s => `<span><i style="--c:${ST[s].c}">${ST[s].i}</i>${ST[s].ar}</span>`).join('')}</div>
      ${(() => { const withObs = issues.filter(i => D.obs.some(o => o.facility_id === i.f.id && o.system_code === i.s.code && o.status !== 'closed')), noObs = issues.filter(i => !withObs.includes(i));
        const grp = {}; noObs.forEach(i => { (grp[i.s.code] ||= { s: i.s, list: [] }).list.push(i); });
        const gl = Object.values(grp).sort((a, b) => b.list.length - a.list.length);
        return `<h2>الحالات قيد المعالجة <small class="muted">(${withObs.length})</small></h2>${withObs.length ? `<table class="rt2"><thead><tr><th>المنشأة</th><th>النظام</th><th>الحالة</th><th>الملاحظة والإجراء الحاكم</th><th>المسؤول</th><th>الموعد</th></tr></thead><tbody>${withObs.map(({ f, s, c }) => { const oo = D.obs.filter(o => o.facility_id === f.id && o.system_code === s.code && o.status !== 'closed');
          return `<tr><td>${esc(f.name)}</td><td>${esc(s.name)}</td><td>${pill(c.status, s)}</td><td>${oo.map(o => `<b>#${o.id}</b> ${esc(o.title)} <span class="muted">(${esc(o.proc || '')}${o.step ? ' · الخطوة ' + o.step : ''} · ${OST[o.status] || ''})</span>`).join('<br>')}</td><td>${oo.map(o => esc(uname(o.owner))).join('<br>')}</td><td>${oo.map(o => o.due_date ? `<span class="${late(o) ? 'bad' : ''}">${dateAr(o.due_date)}</span>` : '<span class="muted">بلا موعد</span>').join('<br>')}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">لا حالات قيد المعالجة.</p>'}
          <h2>حالات تحتاج توثيقاً <small class="muted">(${noObs.length} حالة في ${gl.length} أنظمة — غير سليمة بلا ملاحظة لها مسؤول وإجراء)</small></h2>${gl.length ? `<table class="rt2"><thead><tr><th>النظام</th><th class="c">العدد</th><th>المنشآت</th><th>القسم المالك</th><th>الإجراء الحاكم</th></tr></thead><tbody>${gl.map(g => `<tr><td><b>${esc(g.s.name)}</b></td><td class="c">${g.list.length}</td><td>${g.list.map(i => `${esc(i.f.name)}${i.c.status !== 'attention' ? ` <span class="bad">(${esc(stLabel(i.c.status, g.s))})</span>` : ''}`).join('، ')}</td><td>${esc(uname(g.s.owner))}</td><td>${esc(g.s.proc || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">كل الحالات غير السليمة موثقة.</p>'}`; })()}
      ${D.fac.length > facs.length ? `<p class="muted small">منشآت بلا جولة لهذا الشهر: ${D.fac.filter(f => !byF[f.id]).map(f => esc(f.name)).join('، ')}</p>` : ''}`;
  })();
}
