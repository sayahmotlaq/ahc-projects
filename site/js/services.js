// ===== دليل الخدمات: مرجع متكامل لكل طلب — المسار، الأدوار، التنسيق، الاشتراطات، المواصفات، طريقة التنفيذ، الاستلام، المراجع
// كل ما في الصفحة يُقرأ حياً من مصدره (الإجراءات، القواعد، حدود الاعتماد، تعليمات العمل، سجل المواد، بنود المقطوعية، اشتراطات التسليم، المعايير)
import { sb, q, isAdmin, session } from './api.js';
import { $, $$, esc, ico, toast, err, modal, field, formData, norm } from './ui.js';

export const SST = { issued: ['معتمدة', 'st-ok'], draft: ['مسودة للمراجعة', 'st-draft'], planned: ['قيد الإعداد', 'st-plan'] };
const DEPT = ['MNT', 'FAC', 'PRJ', 'SAF', 'IT', 'BME', 'MED', 'GEN', 'TRN'];
const RACI_T = { R: 'ينفّذ', A: 'يعتمد ويُسأل', C: 'يُستشار', I: 'يُبلَّغ' };
let S = null;

export async function loadSvc(force = false) {
  if (S && !force) return S;
  const [svc, units] = await Promise.all([q(sb.from('services').select('*').eq('active', true).order('sort')), q(sb.from('gov_units').select('*'))]);
  S = { svc, U: Object.fromEntries(units.map(u => [u.code, u])) }; return S;
}
const uname = c => S?.U?.[c]?.short || c || '';
const ucol = c => '#' + (S?.U?.[c]?.color || '6B7A88');
const uchip = c => c ? `<span class="uchip" style="--c:${ucol(c)}">${esc(uname(c))}</span>` : '';
const stb = s => { const [t, c] = SST[s] || SST.draft; return `<span class="stb ${c}">${t}</span>`; };

// مطابقة نص حر (عنوان طلب أو بحث) بالخدمات: الكلمة الأطول أوثق، والخدمات المكتملة أولاً
export function matchSvc(text, list = S?.svc || [], n = 5) {
  const t = ' ' + norm(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' '; if (t.trim().length < 2) return [];
  return list.map(s => { let sc = 0; for (const k of [...(s.keywords || []), s.title]) { const kk = norm(k); if (kk.length > 1 && (t.includes(' ' + kk) || t.includes(' ال' + kk))) sc += kk.length; }
    const words = t.trim().split(' ').filter(w => w.length > 2); if (words.length && words.every(w => norm(s.title + ' ' + (s.keywords || []).join(' ')).includes(w))) sc += 3;
    return { s, sc: sc ? sc + (s.status === 'planned' ? 0 : 4) : 0 }; }).filter(x => x.sc).sort((a, b) => b.sc - a.sc).slice(0, n).map(x => x.s);
}

// روابط الرموز داخل النص: الإجراءات والقواعد تفتح النافذة الجانبية، وحدود الاعتماد صفحتها، وتعليمات العمل صفحتها، والمواد لوحتها
const linkify = s => esc(s).replace(/\b(WI-[A-Z]\d{2}|[A-Z]-\d{2}|LS-\d{2}|HO-\d{2})\b/g, m =>
  m.startsWith('WI-') ? `<a class="gref in" href="#/manuals/g/${m}">${m}</a>` : /^(LS|HO)-/.test(m) ? `<span class="gref in">${m}</span>`
  : /^A-/.test(m) ? `<a class="gref in" href="#/gov/frame/auth?h=${m}">${m}</a>` : S?.cardCodes?.has(m) && !S?.procCodes?.has(m) ? `<span class="gref in" title="بطاقة دليل المواصفات">${m}</span>` : /^M-\d{2}$/.test(m) && S?.matCodes?.has(m) && !S?.procCodes?.has(m) ? `<a class="gref in" href="#" data-mat="${m}">${m}</a>`
  : `<a class="gref in" data-peek="${m}" href="#/gov/${m.startsWith('R-') ? 'rules' : 'sop'}/${m}">${m}</a>`);
const md = txt => { let h = '', ul = false; for (const raw of String(txt || '').split('\n')) { const l = raw.trim(); if (!l) { if (ul) { h += '</ul>'; ul = false; } continue; }
  if (l.startsWith('- ')) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${linkify(l.slice(2))}</li>`; } else { if (ul) { h += '</ul>'; ul = false; } h += `<p>${linkify(l)}</p>`; } }
  return h + (ul ? '</ul>' : ''); };
// جدول خطوات تعليمة العمل (بصيغة | # | الخطوة | التحقق |)
const stepsTbl = body => { const rows = String(body || '').split('\n').filter(l => l.trim().startsWith('|')).map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(x => x.trim())); if (rows.length < 2) return md(body);
  const [hd, ...rs] = rows; return `<div class="tblwrap"><table class="mn-t"><thead><tr>${hd.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr>${hd.map((_, i) => `<td>${linkify(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };

export async function mountServices(root, code, params = new URLSearchParams()) {
  try { await loadSvc(true); if (code) return await viewSvc(root, code); catalog(root, params.get('q') || ''); } catch (e) { err(e); root.innerHTML = '<p class="muted">تعذر تحميل دليل الخدمات.</p>'; }
}

// ---------- الكتالوج: «ماذا تحتاج؟»
function catalog(root, q0) {
  const by = DEPT.map(u => [u, S.svc.filter(s => s.unit === u)]).filter(([, l]) => l.length);
  const ready = S.svc.filter(s => s.status !== 'planned').length;
  const card = s => `<a class="svc-card ${s.status}" href="#/services/${s.code}" style="--c:${ucol(s.unit)}"><span class="svc-i">${ico(s.icon || 'book')}</span><div><b>${esc(s.title)}</b><small>${esc(s.summary)}</small></div>${s.status !== 'issued' ? stb(s.status) : ''}</a>`;
  root.innerHTML = `<div class="hubh"><div><h1 class="pagetitle">دليل الخدمات</h1><p class="muted m0">ماذا تحتاج؟ لكل طلب صفحة واحدة: أي مسار ينطبق، ومن يعتمد وينفّذ ويستلم، ومع من التنسيق، والاشتراطات والمواصفات المعتمدة، وطريقة التنفيذ، والمراجع — كلها من مصادرها في المنصة.</p></div></div>
    <div class="svc-search"><span>${ico('search')}</span><input id="svq" placeholder="اكتب ما تحتاجه: مكيف، مقبس، تسريب، شاشة، نقل قسم، كاميرا…" autocomplete="off" value="${esc(q0)}"></div>
    <div id="svr"></div>
    <p class="muted small">${S.svc.length} خدمة في الدليل — ${ready} مكتملة المرجع، والباقي «قيد الإعداد» بمساره وإجرائه الحاكم.</p>
    <div id="svall">${by.map(([u, l]) => `<h2 class="libh" style="--c:${ucol(u)}"><span class="svc-dot"></span>${esc(S.U[u]?.name || u)} <small class="muted">(${l.length})</small></h2><div class="svc-grid">${l.map(card).join('')}</div>`).join('')}</div>`;
  const inp = $('#svq', root), out = $('#svr', root);
  const run = () => { const v = inp.value.trim(); if (!v) { out.innerHTML = ''; return; } const m = matchSvc(v, S.svc, 8);
    out.innerHTML = m.length ? `<div class="svc-grid hits">${m.map(card).join('')}</div>` : `<div class="notice">لا توجد خدمة بهذا الوصف بعد. ارفع طلبك من «＋ جديد» وسيوجّهه قسم المرافق، أو ابحث بكلمة أخرى.</div>`; };
  inp.oninput = run; run(); if (!q0) inp.focus();
}

// ---------- صفحة الخدمة
async function viewSvc(root, code) {
  const s = S.svc.find(x => x.code === code); if (!s) { root.innerHTML = '<p class="muted">الخدمة غير موجودة. <a href="#/services">دليل الخدمات</a></p>'; return; }
  const L = s.links || {}, flowRefs = (s.flow || []).flatMap(f => String(f.ref || '').split(/\s*·\s*/)), routeProcs = (s.routes || []).map(r => r.proc).filter(Boolean);
  const pc = [...new Set([...(L.procs || []), ...flowRefs.filter(c => /^[A-Z]-\d{2}$/.test(c) && !c.startsWith('R-') && !c.startsWith('A-')), ...routeProcs])];
  const rc = [...new Set([...(L.rules || []), ...flowRefs.filter(c => c.startsWith('R-'))])], ac = [...new Set([...(L.auth || []), ...flowRefs.filter(c => /^A-\d/.test(c))])];
  const wc = [...new Set([...(L.wis || []), ...flowRefs.filter(c => c.startsWith('WI-'))])];
  const safe = p => Promise.resolve(p).catch(() => []);
  const [procs, rules, auth, wis, ls, mats, cards, ho, stds] = await Promise.all([
    pc.length ? safe(q(sb.from('gov_processes').select('code,title,owner,steps,goal').in('code', pc))) : [], rc.length ? safe(q(sb.from('gov_rules').select('code,title,statement').in('code', rc))) : [],
    ac.length ? safe(q(sb.from('gov_frame').select('code,title,data').in('code', ac))) : [], wc.length ? safe(q(sb.from('manual_templates').select('code,title,unit,status,card,sections').in('code', wc))) : [],
    (L.ls || []).length ? safe(q(sb.from('ls_items').select('code,title,descr').in('code', L.ls))) : [], (L.mats || []).length ? safe(q(sb.from('materials').select('code,name,makers,rule,spec,category').in('code', L.mats))) : [],
    (L.cards || []).length ? safe(q(sb.from('guide_cards').select('key,title,approved,why').in('key', L.cards))) : [], (L.ho || []).length ? safe(q(sb.from('handover_reqs').select('code,title,descr').in('code', L.ho))) : [],
    (L.stds || []).length ? safe(q(sb.from('standards').select('code,title,kind').in('code', L.stds))) : []]);
  S.procCodes = new Set(procs.map(p => p.code)); S.matCodes = new Set(mats.map(m => m.code)); S.cardCodes = new Set(cards.map(c => c.key));
  const P = Object.fromEntries(procs.map(p => [p.code, p])), sec = Object.fromEntries((s.sections || []).map(x => [x.key, x]));
  const planned = s.status === 'planned';
  // الأقسام بالترتيب؛ كل قسم يظهر فقط إن كان له محتوى
  const parts = [];
  const add = (id, t, html) => html && parts.push([id, t, html]);
  add('routes', 'أي مسار ينطبق على طلبك؟', (s.routes || []).length ? `<div class="svc-routes">${s.routes.map((r, i) => `<div class="svc-route ${r.main ? 'main' : ''}" style="--c:${ucol(r.unit)}"><div class="svc-rq">${esc(r.t)}</div><div class="svc-ra"><span class="svc-arrow">←</span><b>${esc(r.out || (P[r.proc]?.title) || '')}</b></div><div class="svc-rf">${uchip(r.unit)}${r.proc ? `<a class="gref in" data-peek="${esc(r.proc)}" href="#/gov/sop/${esc(r.proc)}">${esc(r.proc)}</a> <small class="muted">${esc(P[r.proc]?.title || '')}</small>` : ''}<span class="sp"></span>${r.kind ? `<button class="btn sm ${r.main ? 'primary' : ''}" data-req="${i}">اطلب بهذا المسار</button>` : r.link ? `<a class="btn sm" href="${esc(r.link)}">افتح</a>` : ''}</div></div>`).join('')}</div>` : '');
  add('need', sec.need?.title || 'ما يرفقه مقدم الطلب', sec.need ? md(sec.need.body) : '');
  const flow = (s.flow || []).length ? s.flow : planned && routeProcs[0] && P[routeProcs[0]] ? (P[routeProcs[0]].steps || []).map(x => ({ u: x.unit, a: x.action, o: x.where, sla: x.sla, ref: '' })) : [];
  add('flow', 'المسار خطوة بخطوة', flow.length ? `${planned && !(s.flow || []).length ? `<p class="muted small">خطوات الإجراء الحاكم ${linkify(routeProcs[0])} كما في دليل الحوكمة، إلى أن تُستكمل خطوات هذه الخدمة.</p>` : ''}<ol class="svc-flow">${flow.map(f => `<li style="--c:${ucol(f.u)}"><div class="svc-fh">${uchip(f.u)}${f.opt ? '<span class="badge skel">عند الحاجة</span>' : ''}${f.sla && f.sla !== '—' ? `<span class="svc-sla">${ico('clock')} ${esc(f.sla)}</span>` : ''}</div><div class="svc-fa">${linkify(f.a)}</div><div class="svc-fo">${f.o ? `<span>الناتج: <b>${esc(f.o)}</b></span>` : ''}${f.ref ? `<span class="svc-fr">${linkify(f.ref)}</span>` : ''}</div></li>`).join('')}</ol>` : '');
  const rx = s.raci || {};
  add('raci', 'الأدوار: من ينفّذ ومن يعتمد', (rx.rows || []).length ? `<div class="tblwrap"><table class="mn-t svc-raci"><thead><tr><th>العمل</th>${rx.cols.map(c => `<th>${uchip(c)}</th>`).join('')}</tr></thead><tbody>${rx.rows.map(r => `<tr><td>${esc(r.task)}</td>${rx.cols.map(c => { const v = r.v?.[c] || ''; return `<td class="rcx">${v ? v.split('/').map(x => `<span class="raci r-${x}" title="${RACI_T[x] || ''}">${x}</span>`).join('') : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="svc-leg">${Object.entries(RACI_T).map(([k, t]) => `<span><span class="raci r-${k}">${k}</span> ${t}</span>`).join('')}</p>` : '');
  add('coord', 'مع من التنسيق ولماذا', (s.coord || []).length ? `<div class="svc-coord">${s.coord.map(c => `<div style="--c:${ucol(c.u)}">${uchip(c.u)}<p>${linkify(c.why)}</p></div>`).join('')}</div>` : '');
  add('reqs', sec.reqs?.title || 'الاشتراطات', sec.reqs ? md(sec.reqs.body) : '');
  const specs = [
    mats.length ? `<div class="svc-mats">${mats.map(m => `<button class="svc-mat" data-mat="${esc(m.code)}"><span class="ltr cd">${esc(m.code)}</span><b>${esc(m.name)}</b><span class="makers">${(m.makers || []).map(x => `<span class="maker">${esc(x)}</span>`).join('')}</span>${m.spec ? `<small>${esc(m.spec)}</small>` : ''}<small class="muted">${m.rule === 'only' ? 'حصراً — لا بديل' : m.rule === 'eq' ? 'أو ما يعادله بعد الاعتماد الكتابي' : 'أي اسم من القائمة المعتمدة'}</small></button>`).join('')}</div>` : '',
    cards.length ? cards.map(c => `<div class="gpk-goal"><b>دليل المواصفات ${esc(c.key)} — ${esc(c.title)}:</b> المعتمد: ${esc(c.approved)}${c.why ? `<br><span class="muted">لماذا: ${esc(c.why)}</span>` : ''}</div>`).join('') : '',
    ls.length ? ls.map(i => `<details class="svc-ls"><summary><span class="ltr cd">${esc(i.code)}</span> نص بند المقطوعية: ${esc(i.title)}</summary><p>${esc(i.descr)}</p></details>`).join('') : '',
    stds.length ? `<p class="small">المعايير: ${stds.map(x => `<a class="srcchip" href="#" data-std="${esc(x.code)}">${ico('shield')} ${esc(x.code)} — ${esc(x.title)}</a>`).join(' ')}</p>` : ''].join('');
  add('specs', 'المواصفات والمصنّعون المعتمدون', specs);
  add('wi', 'طريقة التنفيذ وتعليمات العمل', wis.length ? wc.map(c => wis.find(w => w.code === c)).filter(Boolean).map(w => { const st = (w.sections || []).find(x => x.key === 'steps'); return `<div class="svc-wi"><div class="svc-wih"><a href="#/manuals/g/${w.code}"><span class="ltr cd">${esc(w.code)}</span> <b>${esc(w.title)}</b></a><span class="sp"></span>${w.card?.steps?.length ? `<a class="btn sm ghost" href="#/manuals/card/${w.code}">${ico('users')} بطاقة العامل</a>` : ''}<a class="btn sm" href="#/manuals/g/${w.code}">التعليمة كاملة</a></div>${st ? `<details ${w.code === wc[0] ? 'open' : ''}><summary>الخطوات</summary>${stepsTbl(st.body)}</details>` : ''}</div>`; }).join('') : '');
  add('accept', sec.accept?.title || 'القبول والاستلام', (sec.accept ? md(sec.accept.body) : '') + (ho.length ? `<h4 class="sub-h">ما يُسلَّم مع العمل</h4><ul class="svc-ho">${ho.map(h => `<li><span class="ltr cd">${esc(h.code)}</span> <b>${esc(h.title)}</b>${h.descr ? ` — <span class="muted">${esc(String(h.descr).slice(0, 160))}${String(h.descr).length > 160 ? '…' : ''}</span>` : ''}</li>`).join('')}</ul>` : ''));
  add('donts', sec.donts?.title || 'ممنوعات', sec.donts ? `<div class="svc-donts">${md(sec.donts.body)}</div>` : '');
  add('faq', sec.faq?.title || 'أسئلة متكررة', sec.faq ? md(sec.faq.body) : '');
  const refs = [procs.length ? `<h4 class="sub-h">الإجراءات</h4><ul class="svc-refs">${pc.filter(c => P[c]).map(c => `<li><a class="gref in" data-peek="${c}" href="#/gov/sop/${c}">${c}</a> ${esc(P[c].title)} ${uchip(P[c].owner)}</li>`).join('')}</ul>` : '',
    rules.length ? `<h4 class="sub-h">القواعد</h4><ul class="svc-refs">${rules.map(r => `<li><a class="gref in" data-peek="${r.code}" href="#/gov/rules/${r.code}">${r.code}</a> <b>${esc(r.title)}</b> — <span class="muted">${esc(r.statement)}</span></li>`).join('')}</ul>` : '',
    auth.length ? `<h4 class="sub-h">حدود الاعتماد</h4><ul class="svc-refs">${auth.map(a => `<li><a class="gref in" href="#/gov/frame/auth?h=${a.code}">${a.code}</a> ${esc(a.title)} — يعتمد: ${(a.data?.approve || []).map(x => x === 'HEAD' ? '<span class="uchip" style="--c:#6B7A88">رئيس القسم المختص</span>' : uchip(x)).join(' ')}${a.data?.limit ? ` <small class="muted">(${esc(a.data.limit)})</small>` : ''}</li>`).join('')}</ul>` : ''].join('');
  add('refs', 'المراجع', refs);
  if (planned) parts.splice(1, 0, ['todo', 'ما بقي لهذه الخدمة', `<div class="notice">هذه الخدمة <b>قيد الإعداد</b>: المسار والإجراء الحاكم جاهزان أعلاه ويمكن رفع الطلب الآن. تُستكمل الأدوار والاشتراطات والمواصفات وطريقة التنفيذ في الدفعات القادمة.</div>`]);

  const conf = (s.confirm || []).length ? `<div class="notice svc-conf"><b>${ico('alert')} بانتظار تأكيد</b><ul>${s.confirm.map(c => `<li>${linkify(c)}</li>`).join('')}</ul></div>` : '';
  root.innerHTML = `<div class="toolbar noprint"><a class="btn sm ghost" href="#/services">→ دليل الخدمات</a><span class="sp"></span>${(s.routes || []).some(r => r.kind) ? `<button class="btn sm primary" id="svReq">${ico('plus')} اطلب هذه الخدمة</button>` : ''}<button class="btn sm" onclick="print()">${ico('print')} طباعة / PDF</button>${isAdmin() ? `<button class="btn sm ghost" id="svEd">${ico('edit')} تحرير</button>` : ''}</div>
    <div class="svc-hero" style="--c:${ucol(s.unit)}"><span class="svc-hi">${ico(s.icon || 'book')}</span><div><div class="svc-meta"><span class="ltr cd">${esc(s.code)}</span>${stb(s.status)}${uchip(s.unit)}<span class="muted small">${esc(s.cat)}</span></div><h1>${esc(s.title)}</h1><p>${linkify(s.summary)}</p></div></div>
    ${(s.facts || []).length ? `<div class="svc-facts">${s.facts.map(([k, v]) => `<div><small>${esc(k)}</small><b>${linkify(v)}</b></div>`).join('')}</div>` : ''}
    ${conf}
    <div class="mn-wrap svc-wrap"><nav class="mn-toc noprint"><b>المحتويات</b>${parts.map(([id, t], i) => `<a href="#" data-go="${id}"><i>${i + 1}</i>${esc(t)}</a>`).join('')}</nav>
    <div class="svc-doc">${parts.map(([id, t, h], i) => `<section class="svc-sec" id="sv-${id}"><h2><i>${i + 1}</i>${esc(t)}</h2>${h}</section>`).join('')}
    <p class="muted small svc-foot">${s.updated_by ? 'آخر تعديل: ' + esc(s.updated_by) + ' — ' : ''}كل ما في هذه الصفحة مربوط بمصدره: النقر على أي رمز يفتح الإجراء أو القاعدة أو المادة أو التعليمة نفسها.</p></div></div>`;
  $$('[data-go]', root).forEach(a => a.onclick = e => { e.preventDefault(); $('#sv-' + a.dataset.go, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $$('[data-mat]', root).forEach(b => b.onclick = async e => { e.preventDefault(); (await import('./standards.js')).openMat(b.dataset.mat); });
  $$('[data-std]', root).forEach(b => b.onclick = async e => { e.preventDefault(); (await import('./standards.js')).openStd(b.dataset.std); });
  const req = r => fileReq(s, r);
  $$('[data-req]', root).forEach(b => b.onclick = () => req(s.routes[+b.dataset.req]));
  const rb = $('#svReq', root); if (rb) rb.onclick = async () => { const rs = s.routes.filter(r => r.kind); if (rs.length === 1) return req(rs[0]); $('#sv-routes', root)?.scrollIntoView({ behavior: 'smooth' }); toast('اختر المسار الذي ينطبق على طلبك'); };
  const ed = $('#svEd', root); if (ed) ed.onclick = () => editSvc(s, () => viewSvc(root, code).catch(err));
}

// رفع الطلب: نموذج البلاغات والطلبات نفسه، بعنوان الخدمة ومرجعها
export async function fileReq(s, r) {
  try { const { newItem } = await import('./ops.js'); await newItem({ kind: r.kind, title: s.title, details: `وفق دليل الخدمات ${s.code} — ${s.title}\nالمسار: ${r.t}`, svc: s.code }); } catch (e) { err(e); }
}

// ---------- تحرير (المدير): الحالة والملخص ونصوص الأقسام وبنود التأكيد
function editSvc(s, done) {
  const secs = s.sections || [];
  modal(`<form id="f" class="pgrid">
    ${field('الحالة', `<select name="status">${Object.entries(SST).map(([k, [t]]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
    ${field('الكلمات الدالة (يُطابَق بها البحث وعنوان الطلب) — مفصولة بفاصلة', `<input name="keywords" value="${esc((s.keywords || []).join('، '))}">`, 'wide')}
    ${field('الملخص', `<textarea name="summary" rows="3">${esc(s.summary)}</textarea>`, 'wide')}
    ${secs.map((x, i) => field(`${x.title} — سطر لكل بند يبدأ بـ «- »`, `<textarea name="sec${i}" rows="6">${esc(x.body)}</textarea>`, 'wide')).join('')}
    ${field('بنود بانتظار التأكيد — سطر لكل بند (احذف السطر عند تأكيده)', `<textarea name="confirm" rows="3">${esc((s.confirm || []).join('\n'))}</textarea>`, 'wide')}
    <p class="muted small wide">المسار والخطوات والأدوار والروابط تُعدَّل في الدفعات القادمة من هنا أيضاً؛ ما يُعرض من المواد والإجراءات والتعليمات يُقرأ حياً من مصادره.</p>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تحرير ' + s.code, wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const out = { status: f.status, summary: f.summary.trim(), keywords: f.keywords.split(/[،,]/).map(x => x.trim()).filter(Boolean), confirm: f.confirm.split('\n').map(x => x.trim()).filter(Boolean),
        sections: secs.map((x, i) => ({ ...x, body: f['sec' + i] })), updated_at: new Date().toISOString(), updated_by: session.profile?.full_name || '' };
      if (out.status === 'issued' && !s.ver) out.ver = '1.0';
      try { await q(sb.from('services').update(out).eq('code', s.code)); toast('حُفظ'); close(); await loadSvc(true); done(); } catch (er) { err(er); } };
  } });
}
