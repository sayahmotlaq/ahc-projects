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

// ---------- جمع مصادر الخدمة حياً
async function gather(s) {
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
  return { pc, wc, procs, rules, auth, wis, ls, mats, cards, ho, stds, routeProcs };
}

// ---------- صفحة الخدمة
async function viewSvc(root, code) {
  const s = S.svc.find(x => x.code === code); if (!s) { root.innerHTML = '<p class="muted">الخدمة غير موجودة. <a href="#/services">دليل الخدمات</a></p>'; return; }
  const { pc, wc, procs, rules, auth, wis, ls, mats, cards, ho, stds, routeProcs } = await gather(s);
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
  add('coord', 'مع من التنسيق ولماذا', (s.coord || []).length ? `<div class="svc-coord">${s.coord.map(c => `<div style="--c:${ucol(c.u)}">${c.u ? uchip(c.u) : `<span class="uchip" style="--c:#6B7A88">${esc(c.l || '')}</span>`}<p>${linkify(c.why)}</p></div>`).join('')}</div>` : '');
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
  root.innerHTML = `<div class="toolbar noprint"><a class="btn sm ghost" href="#/services">→ دليل الخدمات</a><span class="sp"></span>${(s.routes || []).some(r => r.kind) ? `<button class="btn sm primary" id="svReq">${ico('plus')} اطلب هذه الخدمة</button>` : ''}<button class="btn sm" id="svBrief">${ico('print')} الخلاصة في صفحة PDF</button><button class="btn sm ghost" id="svDoc">${ico('print')} الملف الكامل PDF</button>${isAdmin() ? `<button class="btn sm ghost" id="svEd">${ico('edit')} تحرير</button>` : ''}</div>
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
  $('#svDoc', root).onclick = () => openSvcDoc(s.code);
  $('#svBrief', root).onclick = () => (s.brief?.steps?.length ? openSvcBrief(s.code) : openSvcDoc(s.code));
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

// ---------- ملف الخدمة / ملف الطلب PDF: كل ما يحتاجه المنفّذ والمستلم في مستند واحد بهوية التجمع ورقم مرجعي
// item (اختياري): { ref, fac, loc, title, unit, prio, date, by, route } — من صفحة الطلب
const ox = s => String(s || '').replace(/</g, '&lt;');
const pmd = txt => { let h = '', ul = false; for (const raw of String(txt || '').split('\n')) { const l = raw.trim(); if (!l) continue; if (l.startsWith('- ')) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${ox(l.slice(2))}</li>`; } else { if (ul) { h += '</ul>'; ul = false; } h += `<p>${ox(l)}</p>`; } } return h + (ul ? '</ul>' : ''); };
const pchk = txt => `<table class="chk">${String(txt || '').split('\n').map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => `<tr><td class="bx">☐</td><td>${ox(l.slice(2))}</td></tr>`).join('')}</table>`;
const prow = body => String(body || '').split('\n').filter(l => l.trim().startsWith('|')).slice(1).map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(x => x.trim()));
export async function openSvcDoc(code, item = null) {
  const { prepDoc, openDoc, coverHtml } = await import('./pdfdoc.js'); const win = prepDoc(); if (!win) return;
  try {
    await loadSvc(); const s = S.svc.find(x => x.code === code); if (!s) throw new Error('الخدمة غير موجودة');
    const G = await gather(s), P = Object.fromEntries(G.procs.map(p => [p.code, p])), sec = Object.fromEntries((s.sections || []).map(x => [x.key, x]));
    const un = c => S.U[c]?.name || c, us = c => S.U[c]?.short || c;
    const parts = []; const add = (t, h) => h && parts.push([t, h]);
    const chosen = item?.route ? (s.routes || []).findIndex(r => r.t === item.route) : -1;
    if (item) add('بيانات الطلب', `<table class="kv">${[['رقم الطلب', item.ref], ['العنوان', item.title], ['المنشأة', item.fac], ['الموقع', item.loc], ['القسم المختص', item.unit], ['الأولوية', item.prio], ['تاريخ الطلب', item.date], ['مقدم الطلب', item.by]].filter(x => x[1]).map(([k, v]) => `<tr><th>${k}</th><td>${ox(v)}</td></tr>`).join('')}</table>`);
    add('المسار', `<p>${ox(s.summary)}</p><table class="t"><thead><tr><th style="width:8mm"></th><th>الحالة</th><th>المسار</th><th>القسم</th><th>الإجراء</th></tr></thead><tbody>${(s.routes || []).map((r, i) => `<tr class="${i === chosen ? 'on' : ''}"><td class="bx">${i === chosen ? '☑' : '☐'}</td><td>${ox(r.t)}</td><td><b>${ox(r.out || '')}</b></td><td>${ox(us(r.unit))}</td><td class="ltr">${ox(r.proc || '')}</td></tr>`).join('')}</tbody></table>${item && chosen < 0 ? '<p class="note">حدِّد المسار المنطبق بعلامة ☑.</p>' : ''}`);
    if (sec.need) add(sec.need.title, pchk(sec.need.body));
    const flow = (s.flow || []).length ? s.flow : (P[G.routeProcs[0]]?.steps || []).map(x => ({ u: x.unit, a: x.action, o: x.where, sla: x.sla }));
    add('المسار خطوة بخطوة — نموذج متابعة', flow.length ? `<table class="t flow"><thead><tr><th>#</th><th>القسم</th><th>الخطوة</th><th>الناتج</th><th>المهلة</th><th style="width:22mm">التاريخ</th><th style="width:26mm">الاسم والتوقيع</th></tr></thead><tbody>${flow.map((f, i) => `<tr><td class="c">${i + 1}</td><td><b>${ox(us(f.u))}</b>${f.opt ? '<br><small>عند الحاجة</small>' : ''}</td><td>${ox(f.a)}${f.ref ? `<br><small class="ltr">${ox(f.ref)}</small>` : ''}</td><td>${ox(f.o || '')}</td><td>${ox(f.sla && f.sla !== '—' ? f.sla : '')}</td><td></td><td></td></tr>`).join('')}</tbody></table>` : '');
    const rx = s.raci || {};
    add('الأدوار', (rx.rows || []).length ? `<table class="t raci"><thead><tr><th>العمل</th>${rx.cols.map(c => `<th>${ox(us(c))}</th>`).join('')}</tr></thead><tbody>${rx.rows.map(r => `<tr><td>${ox(r.task)}</td>${rx.cols.map(c => `<td class="c"><b>${ox(r.v?.[c] || '')}</b></td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">R ينفّذ · A يعتمد ويُسأل · C يُستشار · I يُبلَّغ</p>` : '');
    add('التنسيق', (s.coord || []).length ? `<table class="t"><tbody>${s.coord.map(c => `<tr><th style="width:34mm">${ox(c.u ? un(c.u) : c.l)}</th><td>${ox(c.why)}</td></tr>`).join('')}</tbody></table>` : '');
    if (sec.reqs) add(sec.reqs.title, pmd(sec.reqs.body));
    add('المواصفات والمصنّعون المعتمدون', [G.mats.map(m => `<div class="box"><b>${ox(m.name)}</b> <span class="ltr small">${ox(m.code)}</span><div class="mk">${(m.makers || []).map(x => `<span>${ox(x)}</span>`).join('')}</div>${m.spec ? `<div class="small">${ox(m.spec)}</div>` : ''}<div class="small g">${m.rule === 'only' ? 'حصراً — لا بديل' : m.rule === 'eq' ? 'أو ما يعادله بعد الاعتماد الكتابي' : 'أي اسم من القائمة المعتمدة فقط'}</div></div>`).join(''),
      G.cards.map(c => `<div class="box"><b>دليل المواصفات — ${ox(c.title)}:</b> ${ox(c.approved)}${c.why ? `<div class="small g">لماذا: ${ox(c.why)}</div>` : ''}</div>`).join(''),
      G.ls.map(i => `<div class="box"><b>نص المواصفة: ${ox(i.title)}</b> <span class="ltr small">${ox(i.code)}</span><p class="small">${ox(i.descr)}</p></div>`).join(''),
      G.stds.length ? `<p class="small">المعايير: ${G.stds.map(x => ox(x.code + ' — ' + x.title)).join('، ')}</p>` : ''].join(''));
    const wis = G.wc.map(c => G.wis.find(w => w.code === c)).filter(Boolean);
    if (wis.length) { const w = wis[0], ws = Object.fromEntries((w.sections || []).map(x => [x.key, x]));
      add(`طريقة التنفيذ — ${w.title}`, `<p class="small g ltr" style="text-align:right">${ox(w.code)}</p>${ws.safety ? `<h4>السلامة ومعدات الوقاية</h4>${pmd(ws.safety.body)}` : ''}${ws.tools ? `<h4>الأدوات والمواد</h4>${pmd(ws.tools.body)}` : ''}
        <h4>الخطوات — يؤشّر الفني على كل خطوة</h4><table class="t"><thead><tr><th>#</th><th>الخطوة</th><th>التحقق</th><th style="width:10mm">✓</th></tr></thead><tbody>${prow(ws.steps?.body).map(r => `<tr><td class="c">${ox(r[0])}</td><td>${ox(r[1])}</td><td>${ox(r[2])}</td><td class="bx">☐</td></tr>`).join('')}</tbody></table>
        ${wis.slice(1).length ? `<p class="note">بعد التشغيل: ${wis.slice(1).map(x => ox(x.code + ' ' + x.title)).join('، ')}</p>` : ''}`); }
    add(sec.accept?.title || 'القبول والاستلام', (sec.accept ? pchk(sec.accept.body) : '') + (G.ho.length ? `<h4>ما يُسلَّم مع العمل</h4>${G.ho.map(h => `<div class="ho"><span class="bx">☐</span><b>${ox(h.title)}</b> <span class="ltr small g">${ox(h.code)}</span></div>`).join('')}` : ''));
    if (sec.donts) add(sec.donts.title, pmd(sec.donts.body));
    add('المراجع', [G.procs.length ? `<h4>الإجراءات</h4><ul>${G.pc.filter(c => P[c]).map(c => `<li><span class="ltr">${c}</span> ${ox(P[c].title)}</li>`).join('')}</ul>` : '', G.rules.length ? `<h4>القواعد</h4><ul>${G.rules.map(r => `<li><span class="ltr">${r.code}</span> <b>${ox(r.title)}</b> — ${ox(r.statement)}</li>`).join('')}</ul>` : '', G.auth.length ? `<h4>حدود الاعتماد</h4><ul>${G.auth.map(a => `<li><span class="ltr">${a.code}</span> ${ox(a.title)}${a.data?.limit ? ` — ${ox(a.data.limit)}` : ''}</li>`).join('')}</ul>` : ''].join(''));
    const signs = item ? ['المنشأة المستفيدة', 'قسم الصيانة', 'المقاول المنفّذ (إن وجد)'] : [];
    const body = `${s.status !== 'issued' && (s.confirm || []).length ? `<div class="warn"><b>نسخة مسودة — بنود بانتظار التأكيد:</b><ul>${s.confirm.map(c => `<li>${ox(c)}</li>`).join('')}</ul></div>` : ''}
      ${parts.map(([t, h], i) => `<section class="ps"><div class="sh"><span class="sn">${i + 1}</span><h2>${ox(t)}</h2></div>${h}</section>`).join('')}
      ${signs.length ? `<section class="ps sigp"><div class="sh"><span class="sn">✓</span><h2>محضر الاستلام</h2></div><p>نقرّ بأن العمل نُفّذ وفق الاشتراطات والمواصفات وتعليمات العمل المذكورة في هذا الملف، وتم اختباره واستلامه.</p><div class="sgs">${signs.map(x => `<div><b>${x}</b><span>الاسم:</span><span>التوقيع:</span><span>التاريخ:</span></div>`).join('')}</div></section>` : ''}`;
    const css = `.ps{margin-bottom:16px}.ps h2{font-size:15pt}.ps h4{margin:10px 0 4px;font-size:11pt}.ps ul{margin:4px 0;padding-right:18px}.ps li{margin:2px 0}
      .t{margin:6px 0;font-size:9.4pt}.t th,.t td{border:1px solid #D5DEE6;padding:5px 6px;vertical-align:top;text-align:right}.t thead th{background:#153E5C;color:#fff;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}.t tr{break-inside:avoid}.t tr.on td{background:#E8F6FC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .t.flow td{height:13mm}.c{text-align:center!important}.bx{text-align:center;font-size:13pt;width:8mm;color:#153E5C}.raci td,.raci th{text-align:center}.raci td:first-child{text-align:right}
      .kv{font-size:10.4pt;margin:4px 0}.kv th{width:34mm;text-align:right;color:#5B6B7A;font-weight:500;padding:5px 6px;border-bottom:1px solid #E3EAF0}.kv td{padding:5px 6px;border-bottom:1px solid #E3EAF0;font-weight:700}
      .chk{font-size:10pt}.chk td{padding:3px 4px;vertical-align:top}.note{font-size:9pt;color:#5B6B7A}.small{font-size:9pt}.g{color:#5B6B7A}
      .box{border:1px solid #E3EAF0;border-radius:8px;padding:8px 10px;margin:6px 0;break-inside:avoid}.box p{margin:4px 0 0;line-height:1.7}.mk{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0}.mk span{background:#153E5C;color:#fff;border-radius:5px;padding:1px 8px;font-size:9pt;direction:ltr;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .ho{display:flex;gap:6px;align-items:baseline;margin:3px 0}.warn{border:1px solid #E7D9B0;background:#FFF6E0;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:9.4pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sigp{break-before:page}.sgs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px}.sgs div{border:1.5px solid #153E5C;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:16px}.sgs b{color:#153E5C}.sgs span{border-bottom:1px dotted #9AA6B1;padding-bottom:4px;font-size:9.5pt}`;
    const docCode = await (await import('./docctl.js')).issueDoc({ kind: 'svc', ref: item?.ref || s.code, title: (item ? `${item.ref} — ` : '') + s.title, lang: 'ar' });
    openDoc({ win, docCode, title: (item ? `ملف الطلب ${item.ref} — ` : 'ملف الخدمة — ') + s.title, body, css,
      cover: coverHtml({ kicker: item ? 'ملف الطلب' : 'دليل الخدمات — ملف الخدمة', tag: s.status === 'issued' ? 'معتمد' : 'مسودة للمراجعة', title: ox(s.title), sub: item ? 'المسار، الأدوار، الاشتراطات والمواصفات، طريقة التنفيذ، والاستلام — نسخة لهذا الطلب.' : s.summary,
        project: item ? `${item.ref || ''} — ${item.title || ''}` : '', facility: item ? [item.fac, item.loc].filter(Boolean).join(' · ') : '', pills: [us(s.unit), s.cat, s.code].filter(Boolean),
        dept: 'إدارة الخدمات الفنية — ' + un(s.unit), edition: s.code, date: new Date().toISOString().slice(0, 10) }) });
  } catch (e) { try { win.close(); } catch (x) { } err(e); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-svcdoc],[data-svcfull]'); if (!b) return; e.preventDefault(); let it = null; try { it = JSON.parse(b.dataset.item || 'null'); } catch (x) { }
  if (b.dataset.svcfull) return openSvcDoc(b.dataset.svcfull, it);
  const s = S?.svc?.find(x => x.code === b.dataset.svcdoc); (s && !s.brief?.steps?.length ? openSvcDoc : openSvcBrief)(b.dataset.svcdoc, it); });

// ---------- الخلاصة في صفحة واحدة: ما يحتاجه المنفّذ والمستلم فعلاً، والتفاصيل في الملف الكامل والمنصة
export async function openSvcBrief(code, item = null) {
  const { prepDoc, openDoc } = await import('./pdfdoc.js'); const win = prepDoc(); if (!win) return;
  try {
    await loadSvc(); const s = S.svc.find(x => x.code === code); if (!s) throw new Error('الخدمة غير موجودة'); const B = s.brief || {};
    const us = c => S.U[c]?.short || c, col = c => S.U[c] ? '#' + (S.U[c].color || '6B7A88') : '#6B7A88';
    const chosen = item?.route ? (s.routes || []).find(r => r.t === item.route) : (s.routes || []).find(r => r.main);
    const list = (a, mark) => `<ul class="${mark}">${(a || []).map(x => `<li>${ox(x)}</li>`).join('')}</ul>`;
    const L = s.links || {}, refs = [...(L.procs || []), ...(L.rules || []), ...(L.wis || [])].join(' · ');
    const docCode = await (await import('./docctl.js')).issueDoc({ kind: 'svc', ref: item?.ref || s.code, title: 'خلاصة — ' + (item ? `${item.ref} — ` : '') + s.title, lang: 'ar' });
    const meta = item ? [item.ref, item.fac, item.loc, item.date, item.prio ? 'الأولوية: ' + item.prio : ''].filter(Boolean) : [s.code, us(s.unit), s.cat];
    const body = `<div class="bh"><div class="bh-k">${item ? 'ملف الطلب — خلاصة في صفحة' : 'دليل الخدمات — خلاصة في صفحة'}<span>تجمع الأحساء الصحي · إدارة الخدمات الفنية</span></div><h1>${ox(s.title)}</h1><div class="bh-m">${meta.map(x => `<span>${ox(x)}</span>`).join('')}</div></div>
      ${chosen ? `<div class="route"><b>☑ المسار:</b> ${ox(chosen.t)} <span>← ${ox(chosen.out || '')}${chosen.proc ? ' · ' + ox(chosen.proc) : ''}</span></div>` : ''}
      ${s.status !== 'issued' ? '<div class="draft">مسودة للمراجعة — قد تتغير المهل والأدوار بعد الاعتماد</div>' : ''}
      <div class="g2"><div class="bx"><h3>الخطوات ومن ينفّذها</h3><table class="st">${(B.steps || []).map(([u, t, sla], i) => `<tr><td class="n">${i + 1}</td><td class="u"><span style="--c:${col(u)}">${ox(us(u))}</span></td><td>${ox(t)}</td><td class="sla">${ox(sla || '')}</td><td class="ok">☐</td></tr>`).join('')}</table></div>
        <div class="col"><div class="bx"><h3>قبل البدء</h3>${list(B.before, 'chk')}</div><div class="bx"><h3>التنسيق مع</h3><ul class="co">${(B.coord || []).map(([u, t]) => `<li><b style="color:${col(u)}">${ox(us(u))}</b> ${ox(t)}</li>`).join('')}</ul></div></div></div>
      <div class="bx spec"><h3>المواصفات المعتمدة</h3><div class="br">${(B.brands || []).map(x => `<span>${ox(x)}</span>`).join('')}</div>${list(B.musts, 'dot two')}</div>
      <div class="g2 eq"><div class="bx"><h3>طريقة التنفيذ</h3>${list(B.how, 'chk num')}</div><div class="bx no"><h3>ممنوع</h3>${list(B.donts, 'x')}</div></div>
      <div class="bx"><h3>القبول والاستلام</h3>${list(B.accept, 'chk three')}</div>
      <div class="sg">${(B.sign || ['المنشأة', 'القسم المنفّذ']).map(x => `<div><b>${ox(x)}</b><span>الاسم</span><span>التوقيع</span><span>التاريخ</span></div>`).join('')}</div>
      <p class="rf">المرجع الكامل: دليل الخدمات ${ox(s.code)} في المنصة${refs ? ' — ' + ox(refs) : ''}</p>`;
    const css = `@page{margin:12mm 12mm 14mm}body{font-size:8.7pt;line-height:1.42}.doc{padding:0!important}.docstamp{margin-top:4px!important;padding-top:3px!important;font-size:7pt!important}
      .bh{background:#153E5C;color:#fff;border-radius:8px;padding:9px 14px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.bh-k{display:flex;justify-content:space-between;font-size:8.4pt;color:#9FDBF5;font-weight:700}.bh-k span{color:#C9D6E1;font-weight:500}
      .bh h1{color:#fff;font-size:15.5pt;margin:1px 0 3px}.bh-m{display:flex;flex-wrap:wrap;gap:5px}.bh-m span{background:rgba(255,255,255,.14);border-radius:12px;padding:0 9px;font-size:8.4pt}
      .route{margin:6px 0 0;padding:5px 10px;border-right:4px solid #27A8DF;background:#E8F6FC;border-radius:5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.route span{color:#153E5C;font-weight:700}
      .draft{margin-top:4px;font-size:7.8pt;color:#8a6200;background:#FFF4D6;border-radius:4px;padding:1px 8px;display:inline-block;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .g2{display:grid;grid-template-columns:1.65fr 1fr;gap:7px;margin-top:7px}.g2.eq{grid-template-columns:1.3fr 1fr}.col{display:flex;flex-direction:column;gap:7px}
      .bx{border:1px solid #D9E2EA;border-radius:7px;padding:5px 9px;margin-top:6px;break-inside:avoid}.g2 .bx,.col .bx{margin-top:0}
      .bx h3{font-size:9.6pt;margin:0 0 4px;color:#153E5C;border-bottom:2px solid #27A8DF;display:inline-block;padding-bottom:1px}
      .st{width:100%;border-collapse:collapse}.st td{padding:2px 3px;border-bottom:1px solid #EEF2F6;vertical-align:top}.st .n{width:5mm;color:#5B6B7A;font-weight:700;text-align:center}.st .u{width:18mm}
      .st .u span{display:inline-block;font-size:7.6pt;font-weight:700;color:var(--c);border:1px solid var(--c);border-radius:9px;padding:0 6px;white-space:nowrap}.st .sla{width:15mm;color:#5B6B7A;font-size:7.8pt;white-space:nowrap}.st .ok{width:5mm;font-size:11pt;color:#153E5C}
      ul{margin:0;padding:0;list-style:none}li{position:relative;padding-right:15px;margin:1.5px 0}
      ul.chk li::before{content:'☐';position:absolute;right:0;top:-1px;font-size:10pt;color:#153E5C}ul.x li::before{content:'✕';position:absolute;right:1px;color:#C8453A;font-weight:800}ul.dot li::before{content:'';position:absolute;right:3px;top:6px;width:5px;height:5px;border-radius:50%;background:#27A8DF}
      ul.co li{padding-right:0}ul.two{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}ul.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 10px}
      .no{background:#FDF3F2;border-color:#F3C9C4;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no h3{color:#C8453A;border-color:#C8453A}
      .br{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 5px}.br span{background:#153E5C;color:#fff;border-radius:5px;padding:0 8px;font-weight:700;direction:ltr;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sg{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.sg div{border:1.4px solid #153E5C;border-radius:7px;padding:5px 9px;display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:end;break-inside:avoid}
      .sg b{grid-column:1/-1;color:#153E5C}.sg span{font-size:8pt;color:#5B6B7A;border-bottom:1px dotted #9AA6B1;padding-bottom:4px;grid-column:1/-1}
      .rf{margin:6px 0 0;font-size:7.6pt;color:#5B6B7A}`;
    openDoc({ win, docCode, title: (item ? `خلاصة الطلب ${item.ref} — ` : 'خلاصة الخدمة — ') + s.title, body, css });
  } catch (e) { try { win.close(); } catch (x) { } err(e); }
}
