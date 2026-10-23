// ===== المعايير والمواد المعتمدة: مصدر واحد تُربط به البنود والاشتراطات والقواعد والأدلة وتعليمات العمل =====
// «أين يُطبَّق» يُحسب من النصوص نفسها (كلمات المعيار المفتاحية) + روابط صريحة في std_links، فيبقى محدّثاً دائماً.
import { sb, q, isAdmin } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, formData, ico, norm } from './ui.js';

export const STATUS = { draft: ['مسودة', 'st-draft'], active: ['معمول به', 'st-active'], approved: ['معتمد', 'st-ok'], superseded: ['مستبدل', 'st-old'] };
export const RULE = { only: ['حصراً', 'r-only'], list: ['من القائمة المعتمدة', 'r-list'], eq: ['أو ما يعادله بعد الاعتماد', 'r-eq'] };
let D = null;
const all = async (tbl, cols, order) => { const out = []; for (let f = 0; ; f += 1000) { let x = sb.from(tbl).select(cols).range(f, f + 999); if (order) x = x.order(order); const r = await q(x); out.push(...r); if (r.length < 1000) break; } return out; };

export async function loadStd(force = false) {
  if (D && !force) return D;
  const [stds, mats, links, units] = await Promise.all([q(sb.from('standards').select('*').eq('active', true).order('sort')), q(sb.from('materials').select('*').order('sort')), q(sb.from('std_links').select('*')), q(sb.from('gov_units').select('code,name,short')).catch(() => [])]);
  D = { stds, mats, links, units: Object.fromEntries(units.map(u => [u.code, u])), corpus: null };
  return D;
}
// النصوص التي يُبحث فيها عن المعايير (تُحمَّل مرة واحدة عند الحاجة)
async function corpus() {
  if (D.corpus) return D.corpus;
  const safe = p => p.catch(() => []);
  const [ls, ho, rules, mans, cards, items] = await Promise.all([
    safe(q(sb.from('ls_items').select('code,title,descr').eq('active', true).order('sort'))), safe(q(sb.from('handover_reqs').select('code,title,descr,deliver').eq('active', true).order('sort'))),
    safe(q(sb.from('gov_rules').select('code,title,statement,criteria').order('sort'))), safe(q(sb.from('manual_templates').select('code,title,sections,scope'))),
    safe(q(sb.from('guide_cards').select('key,code_label,title,approved,rows,why').eq('active', true).order('sort'))), safe(all('items', 'code,ar,refs', 'code'))]);
  const T = o => Object.values(o).map(v => typeof v === 'string' ? v : JSON.stringify(v ?? '')).join(' ');
  D.corpus = {
    ls: ls.map(r => ({ key: r.code, label: r.title, text: r.title + ' ' + r.descr })),
    ho: ho.map(r => ({ key: r.code, label: r.title, text: T(r) })),
    rule: rules.map(r => ({ key: r.code, label: r.title, text: T(r) })),
    manual: mans.map(r => ({ key: r.code, label: r.title, scope: r.scope, text: r.title + ' ' + JSON.stringify(r.sections || '') })),
    guide: cards.map(r => ({ key: r.key, label: `${r.code_label} ${r.title}`, text: T(r) })),
    ref: items.map(r => ({ key: r.code, label: r.ar, text: (Array.isArray(r.refs) ? r.refs.join(' ') : JSON.stringify(r.refs || '')) })),
  };
  return D.corpus;
}
const rx = t => { const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return /[A-Za-z0-9]/.test(t) ? new RegExp(`(^|[^A-Za-z0-9])${e}(?![A-Za-z0-9])`, 'i') : new RegExp(e); };
export async function usesOf(s) {
  await loadStd(); const C = await corpus(); const res = {};
  const toks = [s.code, ...(s.tokens || [])].filter(Boolean).map(rx);
  for (const [k, list] of Object.entries(C)) res[k] = list.filter(x => toks.some(r => r.test(x.text)));
  D.links.filter(l => l.std_code === s.code).forEach(l => { const list = C[l.kind] || []; const it = list.find(x => x.key === l.key) || { key: l.key, label: '' }; (res[l.kind] ||= []); if (!res[l.kind].some(x => x.key === l.key)) res[l.kind].unshift(it); });
  res.mat = D.mats.filter(m => (m.std_codes || []).includes(s.code));
  return res;
}
// المعايير التي يذكرها نص ما (لشارات «المصدر» في الصفحات الأخرى)
export async function stdsInText(text, kind, key) {
  await loadStd(); const t = String(text || '');
  return D.stds.filter(s => [s.code, ...(s.tokens || [])].filter(Boolean).some(x => rx(x).test(t)) || D.links.some(l => l.std_code === s.code && l.kind === kind && l.key === key));
}
export function srcChips(stds, mats = []) {
  if (!stds.length && !mats.length) return '';
  return `<div class="srcchips"><span class="muted small">المصدر:</span>${stds.map(s => `<button class="srcchip ${s.kind}" data-std="${esc(s.code)}" title="${esc(s.title)}">${ico(s.kind === 'internal' ? 'shield' : 'book')} ${esc(s.kind === 'internal' ? s.title : s.code)}</button>`).join('')}${mats.map(m => `<button class="srcchip mat" data-mat="${esc(m.code)}" title="${esc(m.name)}">${ico('stamp')} ${esc(m.makers.slice(0, 3).join(' · ') || m.name)}</button>`).join('')}</div>`;
}
export function bindSrc(root) { $$('[data-std]', root).forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openStd(b.dataset.std); }); $$('[data-mat]', root).forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openMat(b.dataset.mat); }); }

// ---------- اللوحة الجانبية
const PK = [];
function panel(html) {
  let el = $('#spk'); if (!el) { el = document.createElement('div'); el.id = 'spk'; document.body.appendChild(el); }
  el.innerHTML = `<div class="gpeek-bg" data-x></div><aside class="gpeek" role="dialog"><div class="gpk-top">${PK.length > 1 ? '<button class="btn sm ghost" data-back>→ رجوع</button>' : ''}<span class="sp"></span><a class="btn sm" href="#/standards">كل المعايير</a><button class="btn sm ghost" data-x title="إغلاق">✕</button></div><div class="gpk-body">${html}</div></aside>`;
  requestAnimationFrame(() => el.classList.add('on'));
  const close = () => { PK.length = 0; el.classList.remove('on'); setTimeout(() => el.remove(), 220); };
  $$('[data-x]', el).forEach(b => b.onclick = close); const bk = $('[data-back]', el); if (bk) bk.onclick = () => { PK.pop(); const t = PK.pop(); t && (t.t === 's' ? openStd(t.c) : openMat(t.c)); };
  $$('a[href^="#"]', el).forEach(a => a.addEventListener('click', () => { if (!a.dataset.rule) close(); }));
  $$('[data-rule]', el).forEach(a => a.onclick = async e => { e.preventDefault(); close(); (await import('./gov.js')).openPeek(a.dataset.rule); });
  bindSrc(el);
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
}
const unitName = c => D.units[c]?.name || c || '';
const stBadge = s => { const [t, c] = STATUS[s] || STATUS.active; return `<span class="stb ${c}">${t}</span>`; };
const ruleBadge = r => { const [t, c] = RULE[r] || RULE.list; return `<span class="rule sm ${c}">${t}</span>`; };
const GROUPS = [['mat', 'المواد والمصنّعون المعتمدون'], ['ls', 'بنود المقطوعية'], ['ho', 'اشتراطات التسليم'], ['rule', 'قواعد الحوكمة'], ['manual', 'الأدلة وتعليمات العمل'], ['guide', 'بطاقات دليل المواصفات'], ['ref', 'بنود المرجع الفني']];
const hrefOf = (k, x) => k === 'ls' ? (isAdmin() ? '#/admin/lumpsum' : '#/library') : k === 'ho' ? '#/handover' : k === 'manual' ? `#/manuals/g/${x.key}` : k === 'guide' ? (isAdmin() ? '#/admin/guide' : '#/library') : k === 'ref' ? `#/ref/${String(x.key).replace(/\s+/g, '-')}` : '#';

export async function openStd(code) {
  try {
    await loadStd(); const s = D.stds.find(x => x.code === code); if (!s) return toast('المعيار غير موجود');
    PK.push({ t: 's', c: code }); panel('<p class="muted">…</p>');
    const u = await usesOf(s); const total = GROUPS.reduce((a, [k]) => a + (u[k]?.length || 0), 0);
    panel(`<div class="gpk-h"><span class="ltr cd">${esc(s.code)}</span>${stBadge(s.status)}${s.version ? `<span class="badge skel">${esc(s.version)}</span>` : ''}</div>
      <h3>${esc(s.title)}</h3>${s.en ? `<div class="muted ltr small" style="text-align:right">${esc(s.en)}</div>` : ''}
      ${s.owner ? `<p class="small"><b>المالك:</b> ${esc(unitName(s.owner))}${(s.support || []).length ? ` · <b>المساندون:</b> ${s.support.map(unitName).map(esc).join('، ')}` : ''}</p>` : ''}
      <div class="btnrow">${s.file ? `<a class="btn sm primary" href="${esc(s.file)}" target="_blank" rel="noopener">${ico('file')} الملف الأصلي</a>` : ''}${s.link ? `<a class="btn sm" href="${esc(s.link)}">${ico('book')} فتح</a>` : ''}</div>
      ${s.scope ? `<div class="gpk-goal"><b>النطاق:</b> ${esc(s.scope)}</div>` : ''}${s.summary ? `<div class="gpk-goal"><b>الخلاصة:</b> ${esc(s.summary)}</div>` : ''}
      ${(s.clauses || []).length ? `<h4 class="sub-h">بنود المعيار</h4><ol class="gpk-ul">${s.clauses.map(c => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}
      <h4 class="sub-h">أين يُطبَّق <span class="muted small">(${total})</span></h4>
      ${total ? GROUPS.map(([k, t]) => { const L = u[k] || []; if (!L.length) return ''; const show = L.slice(0, k === 'ref' ? 25 : 60);
        return `<div class="usegrp"><b>${t} <span class="muted">(${L.length})</span></b><div class="uselist">${show.map(x => k === 'mat' ? `<button class="usei" data-mat="${esc(x.code)}"><span class="ltr cd">${esc(x.code)}</span> ${esc(x.name)}</button>` : k === 'rule' ? `<a class="usei" href="#/gov/rules/${esc(x.key)}" data-rule="${esc(x.key)}"><span class="ltr cd">${esc(x.key)}</span> ${esc(x.label)}</a>` : `<a class="usei" href="${hrefOf(k, x)}"><span class="ltr cd">${esc(x.key)}</span> ${esc(x.label || '')}</a>`).join('')}${L.length > show.length ? `<span class="muted small">و${L.length - show.length} أخرى</span>` : ''}</div></div>`; }).join('') : '<p class="muted">لم يُربط بعد بأي بند أو قاعدة أو دليل.</p>'}`);
  } catch (e) { err(e); }
}
export async function openMat(code) {
  try {
    await loadStd(); const m = D.mats.find(x => x.code === code); if (!m) return toast('غير موجود');
    PK.push({ t: 'm', c: code });
    const stds = D.stds.filter(s => (m.std_codes || []).includes(s.code));
    const C = await corpus(); const ls = C.ls.filter(x => (m.ls_codes || []).includes(x.key));
    panel(`<div class="gpk-h"><span class="ltr cd">${esc(m.code)}</span>${ruleBadge(m.rule)}<span class="badge skel">${esc(m.category)}</span></div><h3>${esc(m.name)}</h3>
      ${m.makers.length ? `<div class="makers">${m.makers.map(x => `<span class="maker">${esc(x)}</span>`).join('')}</div>` : ''}
      ${m.spec ? `<div class="gpk-goal"><b>المواصفة:</b> ${esc(m.spec)}</div>` : ''}${m.notes ? `<div class="gpk-goal">${esc(m.notes)}</div>` : ''}
      <p class="small muted">${m.rule === 'only' ? 'لا يُقبل بديل؛ مرتبط بمنظومة موحّدة أو اعتماد قائم.' : m.rule === 'eq' ? 'يُقبل بديل مطابق في كل خاصية بعد اعتماده كتابياً.' : 'أي اسم من الأسماء المذكورة.'}</p>
      ${stds.length ? `<h4 class="sub-h">المعايير</h4>${srcChips(stds)}` : ''}
      ${ls.length ? `<h4 class="sub-h">بنود المقطوعية</h4><div class="uselist">${ls.map(x => `<a class="usei" href="${hrefOf('ls', x)}"><span class="ltr cd">${esc(x.key)}</span> ${esc(x.label)}</a>`).join('')}</div>` : ''}`);
  } catch (e) { err(e); }
}

// ---------- الصفحة
const TABS = [['int', 'معايير التجمع'], ['ext', 'المعايير المرجعية'], ['mat', 'المواد والمصنّعون المعتمدون'], ['chk', 'فحص التطابق']];
export async function mountStandards(root, params) {
  await loadStd(true);
  let tab = (params?.get && params.get('t')) || 'int', fq = '';
  const head = () => `<div class="hubh"><div><h1 class="pagetitle">المعايير والمواد المعتمدة</h1><p class="muted m0">المرجع الذي يرجع إليه كل بند وقاعدة ودليل وتعليمة: معايير التجمع، والكودات والمواصفات المرجعية، والمواد والمصنّعون المعتمدون — وأين يُطبَّق كل منها.</p></div>
    ${isAdmin() ? `<div class="btnrow">${tab === 'mat' ? '<button class="btn primary" id="sNewM">＋ مادة</button>' : tab !== 'chk' ? '<button class="btn primary" id="sNewS">＋ معيار</button>' : ''}</div>` : ''}</div>
    <nav class="fmtabs hubtabs">${TABS.map(([k, t]) => `<a href="#/standards?t=${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</nav>
    ${tab !== 'chk' ? `<div class="toolbar"><input id="sQ" class="stq" placeholder="بحث…" value="${esc(fq)}"></div>` : ''}<div id="sBody"></div>`;
  const body = () => {
    const t = norm(fq), hit = s => !t || norm(Object.values(s).join(' ')).includes(t);
    if (tab === 'int') return `<div class="stdgrid">${D.stds.filter(s => s.kind === 'internal' && hit(s)).map(s => `<div class="stdcard" data-open="${esc(s.code)}"><div class="gpk-h"><span class="ltr cd">${esc(s.code)}</span>${stBadge(s.status)}</div><b>${esc(s.title)}</b><p>${esc(s.summary || s.scope || '')}</p><div class="small muted">${s.owner ? 'المالك: ' + esc(unitName(s.owner)) : ''}</div><div class="btnrow"><button class="btn sm" data-open="${esc(s.code)}">التفاصيل وأين يُطبَّق</button>${s.file ? `<a class="btn sm ghost" href="${esc(s.file)}" target="_blank" rel="noopener">${ico('file')} الملف</a>` : ''}${isAdmin() ? `<button class="btn sm ghost" data-es="${esc(s.code)}">تعديل</button>` : ''}</div></div>`).join('') || '<p class="muted">لا نتائج.</p>'}</div>`;
    if (tab === 'ext') return `<table class="tbl stdtbl"><thead><tr><th>الرمز</th><th>المعيار</th><th>بالإنجليزية</th><th></th></tr></thead><tbody>${D.stds.filter(s => s.kind === 'external' && hit(s)).map(s => `<tr data-open="${esc(s.code)}"><td class="ltr cd">${esc(s.code)}</td><td><b>${esc(s.title)}</b></td><td class="ltr muted small">${esc(s.en)}</td><td>${isAdmin() ? `<button class="btn sm ghost" data-es="${esc(s.code)}">تعديل</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
    if (tab === 'mat') { const ms = D.mats.filter(m => m.active && hit(m)); return [...new Set(ms.map(m => m.category))].map(c => `<section class="pcard"><h2>${esc(c)}</h2><div class="matlist">${ms.filter(m => m.category === c).map(m => `<div class="matrow" data-mopen="${esc(m.code)}"><div class="mt"><span class="ltr cd">${esc(m.code)}</span><b>${esc(m.name)}</b>${ruleBadge(m.rule)}</div><div class="makers">${m.makers.map(x => `<span class="maker">${esc(x)}</span>`).join('') || `<span class="muted small">${esc(m.spec)}</span>`}</div><div class="small muted">${m.makers.length && m.spec ? esc(m.spec) + ' · ' : ''}<span class="ltr">${(m.ls_codes || []).join(' · ')}</span></div>${isAdmin() ? `<button class="btn sm ghost" data-em="${esc(m.code)}">تعديل</button>` : ''}</div>`).join('')}</div></section>`).join('') || '<p class="muted">لا نتائج.</p>'; }
    return `<div class="pcard"><p class="m0">يقارن المصنّعين المعتمدين في هذا السجل بنص بنود المقطوعية في القائمة وفي جدول كميات تختاره، ويُظهر أي اسم معتمد غير مذكور في البند — حتى لا تختلف المواصفة بين مكان وآخر.</p>
      <div class="btnrow" style="margin-top:8px"><select id="chkBoq"><option value="">القائمة فقط</option></select><span class="sp"></span><span id="chkSum" class="small"></span></div></div><div id="chkOut"><p class="muted">…</p></div>`;
  };
  const render = () => {
    root.innerHTML = head(); $('#sBody', root).innerHTML = body();
    const qi = $('#sQ', root); if (qi) qi.oninput = e => { fq = e.target.value; const p = e.target.selectionStart; $('#sBody', root).innerHTML = body(); bind(); qi.focus(); qi.setSelectionRange(p, p); };
    $('#sNewS', root) && ($('#sNewS', root).onclick = () => stdForm(null, tab === 'ext' ? 'external' : 'internal'));
    $('#sNewM', root) && ($('#sNewM', root).onclick = () => matForm(null));
    bind(); if (tab === 'chk') runCheck(root);
  };
  const bind = () => {
    $$('[data-open]', root).forEach(b => b.onclick = e => { if (e.target.closest('a,[data-es]')) return; e.stopPropagation(); openStd(b.dataset.open); });
    $$('[data-mopen]', root).forEach(b => b.onclick = e => { if (e.target.closest('[data-em]')) return; openMat(b.dataset.mopen); });
    $$('[data-es]', root).forEach(b => b.onclick = e => { e.stopPropagation(); stdForm(D.stds.find(s => s.code === b.dataset.es)); });
    $$('[data-em]', root).forEach(b => b.onclick = e => { e.stopPropagation(); matForm(D.mats.find(m => m.code === b.dataset.em)); });
  };
  const reload = async () => { await loadStd(true); render(); };
  const stdForm = (s, kind = 'internal') => {
    const v = s || { code: '', kind, title: '', en: '', owner: '', support: [], version: '', status: kind === 'internal' ? 'draft' : 'active', scope: '', summary: '', file: '', link: '', tokens: [], clauses: [], sort: (D.stds.length + 1) * 10, active: true };
    modal(`<form id="f" class="pgrid">${field('الرمز *', inp('code', v.code, s ? 'readonly dir="ltr"' : 'required dir="ltr"'))}${field('النوع', `<select name="kind"><option value="internal" ${v.kind === 'internal' ? 'selected' : ''}>معيار للتجمع</option><option value="external" ${v.kind === 'external' ? 'selected' : ''}>مرجعي (كود/مواصفة)</option></select>`)}
      ${field('العنوان *', inp('title', v.title, 'required'), 'wide')}${field('بالإنجليزية', inp('en', v.en, 'dir="ltr"'), 'wide')}
      ${field('القسم المالك', `<select name="owner"><option value="">—</option>${Object.values(D.units).map(u => `<option value="${u.code}" ${v.owner === u.code ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`)}${field('الأقسام المساندة (رموز بفاصلة)', inp('support', (v.support || []).join(', '), 'dir="ltr"'))}
      ${field('الإصدار', inp('version', v.version))}${field('الحالة', `<select name="status">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${field('النطاق', `<textarea name="scope" rows="2">${esc(v.scope)}</textarea>`, 'wide')}${field('الخلاصة', `<textarea name="summary" rows="3">${esc(v.summary)}</textarea>`, 'wide')}
      ${field('بنود المعيار — سطر لكل بند', `<textarea name="clauses" rows="6">${esc((v.clauses || []).join('\n'))}</textarea>`, 'wide')}
      ${field('رابط الملف (مسار في المنصة أو رابط خارجي)', inp('file', v.file, 'dir="ltr"'), 'wide')}${field('رابط صفحة في المنصة', inp('link', v.link, 'dir="ltr" placeholder="#/handover"'))}
      ${field('كلمات يُعرف بها في النصوص (بفاصلة)', inp('tokens', (v.tokens || []).join(', ')), 'wide')}
      <div class="btnrow end wide">${s ? '<button type="button" class="btn danger" data-del>إيقاف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: s ? 'تعديل معيار' : 'معيار جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const sp = t => String(t || '').split(/[,،]/).map(y => y.trim()).filter(Boolean);
        const row = { code: x.code.trim(), kind: x.kind, title: x.title.trim(), en: x.en.trim(), owner: x.owner || null, support: sp(x.support).map(y => y.toUpperCase()), version: x.version.trim(), status: x.status, scope: x.scope.trim(), summary: x.summary.trim(), clauses: String(x.clauses || '').split('\n').map(y => y.trim()).filter(Boolean), file: x.file.trim(), link: x.link.trim(), tokens: sp(x.tokens), sort: v.sort, active: true, updated_at: new Date().toISOString() };
        try { await q(sb.from('standards').upsert(row, { onConflict: 'code' })); close(); toast('حُفظ'); reload(); } catch (er) { err(er); } };
      const d = $('[data-del]', w); if (d) d.onclick = async () => { if (!(await confirm('إيقاف المعيار وإخفاؤه من السجل؟', 'إيقاف', true))) return; try { await q(sb.from('standards').update({ active: false }).eq('code', s.code)); close(); reload(); } catch (er) { err(er); } };
    } });
  };
  const matForm = m => {
    const v = m || { code: 'M-' + String(Math.max(0, ...D.mats.map(x => +x.code.slice(2) || 0)) + 1).padStart(2, '0'), category: '', name: '', makers: [], spec: '', rule: 'list', ls_codes: [], std_codes: [], notes: '', sort: (D.mats.length + 1) * 10, active: true };
    const cats = [...new Set(D.mats.map(x => x.category))];
    modal(`<form id="f" class="pgrid">${field('الرمز', inp('code', v.code, 'readonly dir="ltr"'))}${field('الفئة', `<input name="category" list="mC" value="${esc(v.category)}" required><datalist id="mC">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
      ${field('المادة / النظام *', inp('name', v.name, 'required'), 'wide')}${field('المصنّعون المعتمدون (بفاصلة — كما يُكتبون في البنود)', inp('makers', (v.makers || []).join(', ')), 'wide')}
      ${field('الموديل / المواصفة', inp('spec', v.spec), 'wide')}${field('الشرط', `<select name="rule">${Object.entries(RULE).map(([k, [t]]) => `<option value="${k}" ${v.rule === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${field('بنود المقطوعية (بفاصلة)', inp('ls_codes', (v.ls_codes || []).join(', '), 'dir="ltr"'))}${field('رموز المعايير (بفاصلة)', inp('std_codes', (v.std_codes || []).join(', '), 'dir="ltr"'), 'wide')}
      ${field('ملاحظات', `<textarea name="notes" rows="2">${esc(v.notes)}</textarea>`, 'wide')}<label class="chk"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> فعّالة</label>
      <div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: m ? 'تعديل مادة معتمدة' : 'مادة معتمدة جديدة', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const sp = t => String(t || '').split(/[,،]/).map(y => y.trim()).filter(Boolean);
        const row = { code: x.code, category: x.category.trim(), name: x.name.trim(), makers: sp(x.makers), spec: x.spec.trim(), rule: x.rule, ls_codes: sp(x.ls_codes).map(y => y.toUpperCase()), std_codes: sp(x.std_codes), notes: x.notes.trim(), sort: v.sort, active: !!x.active, updated_at: new Date().toISOString() };
        try { await q(sb.from('materials').upsert(row, { onConflict: 'code' })); close(); toast('حُفظ'); reload(); } catch (er) { err(er); } };
    } });
  };
  render();
}

// ---------- فحص التطابق: المصنّعون المعتمدون مقابل نص البنود
async function runCheck(root) {
  try {
    const C = await corpus(); const boqs = await q(sb.from('boqs').select('id,name,project_id').eq('pricing', 'lumpsum').order('created_at', { ascending: false })).catch(() => []);
    const pn = Object.fromEntries((await q(sb.from('projects').select('id,name')).catch(() => [])).map(p => [p.id, p.name]));
    const sel = $('#chkBoq', root); sel.innerHTML = '<option value="">القائمة فقط</option>' + boqs.map(b => `<option value="${b.id}">${esc(pn[b.project_id] || '')} — ${esc(b.name)}</option>`).join('');
    const nb = boqs.find(b => /النعيم/.test(pn[b.project_id] || '')); if (nb) sel.value = nb.id;
    const has = (txt, m) => norm(txt).includes(norm(m));
    const draw = async () => {
      let lines = []; if (sel.value) lines = await q(sb.from('boq_lines').select('ls_code,descr,title,loc').eq('boq_id', sel.value));
      let bad = 0, n = 0;
      const rows = D.mats.filter(m => m.active && m.makers.length).map(m => {
        const lt = C.ls.filter(x => (m.ls_codes || []).includes(x.key)).map(x => x.text).join(' ');
        const bl = lines.filter(l => (m.ls_codes || []).includes(l.ls_code)); const bt = bl.map(l => l.title + ' ' + l.descr + ' ' + (l.loc || '')).join(' ');
        const missL = m.makers.filter(x => !has(lt, x)), missB = sel.value ? (bl.length ? m.makers.filter(x => !has(bt, x)) : null) : undefined;
        const ok = !missL.length && (!missB || !missB.length); n++; if (!ok) bad++;
        const cell = miss => miss === undefined ? '' : miss === null ? '<span class="muted small">البند غير موجود في الجدول</span>' : miss.length ? `<span class="chk-bad">ناقص: ${miss.map(esc).join('، ')}</span>` : '<span class="chk-ok">✓ مطابق</span>';
        return `<tr class="${ok ? '' : 'bad'}"><td><button class="usei" data-mat="${esc(m.code)}"><span class="ltr cd">${esc(m.code)}</span> ${esc(m.name)}</button></td><td>${m.makers.map(esc).join('، ')}</td><td>${cell(missL)}</td>${sel.value ? `<td>${cell(missB)}</td>` : ''}</tr>`;
      });
      $('#chkSum', root).innerHTML = bad ? `<b style="color:#b23a3a">${bad}</b> من ${n} تحتاج مراجعة` : `<b style="color:#0F7B5F">كلها مطابقة</b> (${n})`;
      $('#chkOut', root).innerHTML = `<table class="tbl chktbl"><thead><tr><th>المادة</th><th>المعتمد في السجل</th><th>نص البند في القائمة</th>${sel.value ? '<th>نص البند في الجدول المختار</th>' : ''}</tr></thead><tbody>${rows.join('')}</tbody></table>
        <p class="muted small">«ناقص» يعني أن الاسم المعتمد في السجل غير مذكور في نص البند. صحّح البند (الإدارة ← بنود المقطوعية، أو الجدول نفسه) أو السجل، حسب أيهما الصحيح.</p>`;
      bindSrc(root);
    };
    sel.onchange = draw; await draw();
  } catch (e) { err(e); }
}

// يملأ كل خانة «المصدر» (.srcslot[data-src]) بشارات المعايير والمواد المرتبطة — تُستدعى تلقائياً من مراقب الصفحة في app.js
export async function decorate(root = document) {
  const els = $$('.srcslot[data-src]:not([data-done])', root); if (!els.length) return;
  els.forEach(e => e.dataset.done = '1');
  try { await loadStd(); } catch (e) { return; }
  for (const el of els) {
    const kind = el.dataset.src, key = el.dataset.key || '', text = el.dataset.srcText || '';
    const stds = (await stdsInText(text, kind, key)).slice(0, 8);
    const mats = kind === 'ls' && key ? D.mats.filter(m => m.active && (m.ls_codes || []).includes(key)) : [];
    el.innerHTML = srcChips(stds, mats);
  }
  bindSrc(root);
}
