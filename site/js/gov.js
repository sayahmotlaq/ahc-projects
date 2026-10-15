// ===== الحوكمة: إدارة الخدمات الفنية بأقسامها — الهيكل والعلاقات، موجّه الطلبات، مصفوفة الصلاحيات، الإجراءات، القواعد، أسئلة «كيف» =====
import { sb, q, session, isAdmin } from './api.js';
import { $, $$, esc as esc0, toast, err, modal, confirm, field, inp, sel, formData, ico, kic, dateAr } from './ui.js';

// في السياق العربي (RTL) السهم الدال على «ثم/يؤدي إلى» هو ← ؛ أي → يُدخل يدوياً يُعرض ←
const esc = s => esc0(String(s ?? '').replace(/→/g, '←'));
const CODES = { A: ['يعتمد', 'A'], R: ['ينفّذ', 'R'], V: ['يراجع', 'V'], C: ['يُستشار', 'C'], I: ['يُبلَّغ', 'I'] };
const ROLES_PRJ = { EXEC: 'الإدارة التنفيذية', DIR: 'مدير الإدارة', HEAD: 'رئيس القسم', ENG: 'مهندس المشروع', CLERK: 'المنسق الإداري' };
const TABS = [['start', 'ابدأ من هنا'], ['map', 'الهيكل والعلاقات'], ['router', 'موجّه الطلبات'], ['matrix', 'مصفوفة الصلاحيات'], ['frame', 'الإطار الإداري'], ['sop', 'الإجراءات'], ['rules', 'القواعد الحاكمة']];
let G = null;
// الطباعة تعرض الدليل كاملاً: تفتح الأقسام المطوية
addEventListener('beforeprint', () => $$('details.gdx,details.gfc,details.gfr').forEach(d => d.open = true));
async function load(force) {
  if (G && !force) return G;
  const [units, handoffs, rules, acts, procs, router, faq, frame] = await Promise.all([
    q(sb.from('gov_units').select('*').order('sort')), q(sb.from('gov_handoffs').select('*').order('sort')), q(sb.from('gov_rules').select('*').order('sort')),
    q(sb.from('gov_activities').select('*').order('sort')), q(sb.from('gov_processes').select('*').order('sort')), q(sb.from('gov_router').select('*').order('sort')), q(sb.from('gov_faq').select('*').order('sort')), q(sb.from('gov_frame').select('*').eq('active', true).order('sort')).catch(() => [])]);
  G = { units, handoffs, rules, acts, procs, router, faq, frame, F: Object.fromEntries(frame.map(f => [f.code, f])), U: Object.fromEntries(units.map(u => [u.code, u])), P: Object.fromEntries(procs.map(p => [p.code, p])), R: Object.fromEntries(rules.map(r => [r.code, r])) };
  return G;
}
const un = c => G.U[c]?.short || c, uc = c => G.U[c]?.color || '6B7A88';
const chip = c => c ? `<span class="uchip" style="--c:#${uc(c)}">${esc(un(c))}</span>` : '';
const refLink = code => /^[A-QS-Z]-\d/.test(code) ? `<a class="gref" data-peek="${esc(code)}" href="#/gov/sop/${code}">${esc(code)}</a>` : /^R-/.test(code) ? `<a class="gref" data-peek="${esc(code)}" href="#/gov/rules/${code}">${esc(code)}</a>` : esc(code);
// نص مع تحويل أكواد الإجراءات والقواعد (G-05، P-03، R-01) إلى إحالات قابلة للنقر
const FSEG = { plan: 'plan', auth: 'auth', comm: 'comm', cal: 'cal', risk: 'risk' };
const frameLink = (c, cls = 'gref in') => { const f = G?.F?.[c]; return f && FSEG[f.kind] ? `<a class="${cls}" href="#/gov/frame/${f.kind}?h=${c}" title="${esc(f.title)}">${esc(c)}</a>` : esc(c); };
const linkify = s => esc(s).replace(/\b(RK-\d{2}|[A-Z]-\d{2})\b/g, m => (G?.P?.[m] || G?.R?.[m]) ? refLink(m).replace('class="gref"', 'class="gref in"') : G?.F?.[m] ? frameLink(m) : m);

// طبقة التفصيل للخطوة (اختيارية): تفاصيل التنفيذ، معيار القرار، التصعيد، السجل — مطوية افتراضياً
const hasX = s => !!((s.detail || []).length || s.criteria || s.escalate || s.record);
const stepX = s => hasX(s) ? `<div class="gsx">${(s.detail || []).length ? `<ul>${s.detail.map(d => `<li>${linkify(d)}</li>`).join('')}</ul>` : ''}${s.criteria ? `<div class="gsx-r crit"><b>معيار القرار</b><span>${linkify(s.criteria)}</span></div>` : ''}${s.escalate ? `<div class="gsx-r esc"><b>التصعيد</b><span>${linkify(s.escalate)}</span></div>` : ''}${s.record ? `<div class="gsx-r rec"><b>السجل الناتج</b><span>${esc(s.record)}</span></div>` : ''}</div>` : '';
const stepHtml = (s, i, cur) => `<div class="gstep ${s.kind === 'decision' ? 'dec' : ''} ${cur === i + 1 ? 'cur' : ''} ${typeof cur === 'number' && i + 1 < cur ? 'past' : ''}" style="--c:#${uc(s.unit)}"><span class="gno"><i>${i + 1}</i></span><div class="gsb"><div class="gsh">${chip(s.unit)}${s.role ? `<small class="muted">${esc(s.role)}</small>` : ''}${s.kind === 'decision' ? '<span class="badge ovr">قرار</span>' : ''}${cur === i + 1 ? '<span class="badge info">أنت هنا</span>' : ''}</div><p>${linkify(s.action)}</p><div class="gsm">${s.sla ? `<span>${ico('clock')} ${esc(s.sla)}</span>` : ''}${s.where && s.where !== '—' ? `<span>${ico('pin')} ${esc(s.where)}</span>` : ''}${hasX(s) ? `<button type="button" class="gsxb" onclick="this.closest('.gstep').classList.toggle('open')">التفاصيل</button>` : ''}</div>${stepX(s)}</div></div>`;
const flowHtml = (p, cur) => `<div class="gflow">${(p.steps || []).map((s, i) => `<span class="gfi">${i ? '<i class="gfa">←</i>' : ''}<span class="gfs ${s.kind === 'decision' ? 'dec' : ''} ${cur === i + 1 ? 'cur' : ''}" style="--c:#${uc(s.unit)}"><b><i>${i + 1}</i></b>${esc(un(s.unit))}</span></span>`).join('')}</div>`;
const who = s => esc(un(s.unit)) + (s.role && s.role !== un(s.unit) ? ' / ' + esc(s.role) : '');

// ---------- نافذة جانبية للإحالات: تفتح الإجراء أو القاعدة فوق أي صفحة أو نافذة دون مغادرتها، وعند الطلب على خطوة محددة
const PEEK = { stack: [] };
function nowBox(p, step) {
  const n = (p.steps || []).length;
  if (step === 'done') return `<div class="gpk-now done"><b>اكتمل هذا الإجراء لهذا البند</b><span>آخر خطوة: ${linkify(p.steps[n - 1]?.action || '')}</span></div>`;
  const k = Number(step); if (!k || !p.steps?.[k - 1]) return '';
  const c = p.steps[k - 1], nx = p.steps[k];
  return `<div class="gpk-now"><b>أنت في الخطوة ${k} من ${n} — ${who(c)}</b><span>${linkify(c.action)}${c.sla && c.sla !== '—' ? ` <small>· المهلة: ${esc(c.sla)}</small>` : ''}</span>${nx ? `<span class="nx"><b>التالي:</b> ${who(nx)} — ${linkify(nx.action)}</span>` : '<span class="nx">هذه آخر خطوة في الإجراء.</span>'}</div>`;
}
function peekBody(code, step) {
  const p = G.P[code], r = G.R[code];
  const cur = step === 'done' ? (p?.steps || []).length + 1 : Number(step) || null;
  if (p) return `<div class="gpk-h" style="--c:#${uc(p.owner)}"><b>${esc(p.code)}</b>${chip(p.owner)}<span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span></div><h3>${esc(p.title)}</h3>
    ${step ? nowBox(p, step) : ''}
    ${p.goal ? `<p class="gpk-goal">${linkify(p.goal)}</p>` : ''}${p.trigger ? `<p class="muted small"><b>متى يبدأ:</b> ${esc(p.trigger)}</p>` : ''}
    ${flowHtml(p, cur)}<div class="gsteps">${(p.steps || []).map((s, i) => stepHtml(s, i, cur)).join('')}</div>
    ${p.notes ? `<div class="notice mt12"><b>ملاحظات:</b> ${linkify(p.notes)}</div>` : ''}`;
  if (r) return `<div class="gpk-h" style="--c:#${uc(r.owner)}"><b>${esc(r.code)}</b>${chip(r.owner)}${r.theme ? `<span class="muted small">${esc(r.theme)}</span>` : ''}</div><h3>${esc(r.title)}</h3>
    <p class="gpk-goal">${linkify(r.statement)}</p>${(r.criteria || []).length ? `<ul class="gpk-ul">${r.criteria.map(c => `<li>${linkify(c)}</li>`).join('')}</ul>` : ''}${r.note ? `<p class="muted small">${linkify(r.note)}</p>` : ''}
    ${r.process_code && G.P[r.process_code] ? `<p class="mt12">الإجراء المرتبط: ${refLink(r.process_code)} — ${esc(G.P[r.process_code].title)}</p>` : ''}`;
  return '<div class="empty-boq">غير موجود في الحوكمة</div>';
}
function renderPeek() {
  let el = document.getElementById('gpeek');
  const top = PEEK.stack[PEEK.stack.length - 1];
  if (!top) { if (el) { el.classList.remove('on'); setTimeout(() => !PEEK.stack.length && el.remove(), 220); } return; }
  if (!el) { el = document.createElement('div'); el.id = 'gpeek'; document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on')); }
  const full = /^R-/.test(top.code) ? `#/gov/rules/${top.code}` : `#/gov/sop/${top.code}`, prev = PEEK.stack[PEEK.stack.length - 2];
  el.innerHTML = `<div class="gpeek-bg" data-pk="x"></div><aside class="gpeek" role="dialog" aria-label="${esc(top.code)}"><div class="gpk-top">${prev ? `<button class="btn sm ghost" data-pk="back" title="رجوع">→ ${esc(prev.code)}</button>` : ''}<span class="sp"></span><a class="btn sm" href="${full}" data-pk="full">فتح الصفحة كاملة</a><button class="btn sm ghost" data-pk="x" title="إغلاق (Esc)">✕</button></div><div class="gpk-body">${peekBody(top.code, top.step)}</div></aside>`;
  el.classList.add('on');
  const c = el.querySelector('.gstep.cur'); if (c) setTimeout(() => c.scrollIntoView({ block: 'center', behavior: 'smooth' }), 240);
}
export async function govData(force) { return load(force); }
export async function openPeek(code, step) { if (!G) await load(); const top = PEEK.stack[PEEK.stack.length - 1]; if (top && top.code === code && String(top.step || '') === String(step || '')) return; PEEK.stack.push({ code, step: step || null }); renderPeek(); }
export function peekAction(a) { if (a === 'x' || a === 'full') PEEK.stack = []; else if (a === 'back') PEEK.stack.pop(); renderPeek(); }
export const peekOpen = () => PEEK.stack.length > 0;

// ---------- شريط «الإجراء الحاكم» داخل شاشات المنصة (يملؤه govlink.js)
export function govBarHtml(code, step, note) {
  const p = G?.P?.[code]; if (!p) return '';
  const n = (p.steps || []).length, k = step === 'done' ? n : Number(step) || 0, c = k ? p.steps[k - 1] : null, nx = step === 'done' ? null : (k ? p.steps[k] : p.steps[0]);
  const where = step === 'done' ? '<span class="gbs ok">✓ اكتمل الإجراء</span>' : c ? `<span class="gbs"><b>الخطوة ${k}/${n}</b> ${who(c)}: ${esc(c.action)}</span>` : `<span class="gbs">${n} خطوات</span>`;
  return `<button type="button" class="gb" data-peek="${esc(code)}" data-step="${esc(step || '')}" style="--c:#${uc(p.owner)}" title="اضغط لعرض الإجراء كاملاً${c ? ' والخطوة الحالية' : ''}"><span class="gbi">${ico('book')}</span><span class="gbt"><span class="gbh"><b class="gbc">${esc(code)}</b> ${esc(p.title)}${note ? ` <small>· ${esc(note)}</small>` : ''}</span>${where}${nx && step !== 'done' ? `<span class="gbn">التالي: ${who(nx)}</span>` : ''}</span><span class="gbo">عرض ‹</span></button>`;
}

export async function mountGov(root, tab = 'start', id = null, params) {
  await load();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الحوكمة</h1><span class="muted small">إدارة الخدمات الفنية — من يفعل ماذا ومتى</span><span class="sp"></span>${isAdmin() ? '<span class="badge skel">التعديل متاح لمدير النظام بالنقر على العناصر</span>' : ''}</div>
    <div class="tabs gtabs">${TABS.map(([k, t]) => `<a href="#/gov/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="gtab"></div>`;
  const t = $('#gtab', root);
  if (tab === 'map') viewMap(t); else if (tab === 'router') viewRouter(t); else if (tab === 'matrix') viewMatrix(t, params); else if (tab === 'sop') (id ? viewProc(t, id) : viewSops(t, params)); else if (tab === 'rules') viewRules(t, id); else if (tab === 'frame') viewFrame(t, id || 'plan', params); else viewStart(t);
}

// ---------- ابدأ من هنا: المبادئ + أسئلة كيف
function viewStart(t) {
  const vals = [['التعاون', 'الاحتياج لا يملكه قسم؛ من يستطيع البدء يبدأ ثم يُسوّى الاختصاص.'], ['المرونة', 'القواعد تخدم المريض والتشغيل لا العكس؛ الاستثناء يُسجَّل ويُراجع ولا يُمنع.'], ['الوضوح', 'لكل احتياج قناة واحدة، وقسم مسؤول، ومهلة معلومة، وموعد تسليم.'], ['المسؤولية', 'ما يُستلم يُسجَّل، وما يُسجَّل يُتابع، وما يُتابع يُغلق بمحضر.']];
  const units = G.units.filter(u => u.kind === 'unit');
  t.innerHTML = `<div class="gstart">
    <div class="ghero"><div><h2>كيف تعمل إدارة الخدمات الفنية معاً؟</h2><p>${(n => ({ 7: 'سبعة', 8: 'ثمانية', 9: 'تسعة', 10: 'عشرة' })[n] || n)(G.units.filter(u => u.kind === 'unit' && u.active !== false).length)} أقسام تخدم المنشآت نفسها. هذه الصفحة تجيب عن «متى يدخل كل قسم، وكيف ينتقل العمل بينها، ومن يعتمد ماذا» بطريقة يمكن الرجوع إليها في ثوانٍ.</p><div class="btnrow"><a class="btn primary" href="#/gov/router">عندي احتياج… لمن أوجهه؟</a><a class="btn" href="#/gov/map">خريطة العلاقات</a><a class="btn" href="#/gov/matrix">من يعتمد ماذا</a></div></div>
      <div class="gvals">${vals.map(([h, d]) => `<div><b>${h}</b><span>${d}</span></div>`).join('')}</div></div>
    <div class="gunits">${units.map(u => `<a class="gunit" href="#/gov/map?u=${u.code}" style="--c:#${u.color}"><i></i><b>${esc(u.short)}</b><small>${esc(u.mission)}</small></a>`).join('')}</div>
    <h2 class="gh2">أسئلة «كيف…؟» <span class="muted small">— كل إجابة تقود إلى إجرائها أو قاعدتها</span>${isAdmin() ? '<button class="btn sm" id="faqNew">＋ سؤال</button>' : ''}</h2>
    <div class="gfaq">${G.faq.map(f => `<details class="gq" data-faq="${f.id}"><summary>${esc(f.q)}</summary><p>${linkify(f.a)}</p><div class="glinks">${(f.links || []).map(refLink).join(' ')}${f.action === 'router' ? '<a class="btn sm" href="#/gov/router">جرّب الموجّه</a>' : f.action === 'matrix' ? '<a class="btn sm" href="#/gov/matrix">افتح المصفوفة</a>' : ''}${isAdmin() ? `<button class="btn sm ghost" data-faqed="${f.id}">تعديل</button>` : ''}</div></details>`).join('')}</div></div>`;
  if (isAdmin()) { const fe = f => editRow('gov_faq', f, [['q', 'السؤال', 'text'], ['a', 'الإجابة', 'textarea'], ['links', 'الروابط (أكواد مفصولة بفاصلة مثل G-04, R-07)', 'list'], ['action', 'زر إضافي', 'select', [['', '—'], ['router', 'جرّب الموجّه'], ['matrix', 'افتح المصفوفة']]], ['sort', 'الترتيب', 'number']], () => mountGov(t.closest('#main') || document.body, 'start')); $('#faqNew', t).onclick = () => fe(null); $$('[data-faqed]', t).forEach(b => b.onclick = e => { e.preventDefault(); fe(G.faq.find(x => x.id === +b.dataset.faqed)); }); }
}

// ---------- الهيكل والعلاقات: مخطط دائري + نقاط التسليم
function viewMap(t) {
  const units = G.units.filter(u => u.kind === 'unit'); const sel0 = new URLSearchParams(location.hash.split('?')[1] || '').get('u') || '';
  const W = 760, H = 580, cx = W / 2, cy = H / 2, R = 220; const pos = {}; units.forEach((u, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / units.length; pos[u.code] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const hs = G.handoffs.filter(h => pos[h.from_unit] && pos[h.to_unit]);
  const edge = h => { const a = pos[h.from_unit], b = pos[h.to_unit]; const mx = (a.x + b.x) / 2 + (cy - (a.y + b.y) / 2) * 0.12, my = (a.y + b.y) / 2 + ((a.x + b.x) / 2 - cx) * 0.12; return `<path class="ge" data-h="${h.id}" data-f="${h.from_unit}" data-t="${h.to_unit}" d="M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}" stroke="#${uc(h.from_unit)}" marker-end="url(#arr)"/>`; };
  t.innerHTML = `<div class="gmapwrap"><div class="gmap"><svg viewBox="0 0 ${W} ${H}"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6B7A88"/></marker></defs>
      <circle cx="${cx}" cy="${cy}" r="62" class="ghub"/><text x="${cx}" y="${cy - 6}" class="ght">إدارة الخدمات</text><text x="${cx}" y="${cy + 14}" class="ght">الفنية</text>
      ${hs.map(edge).join('')}
      ${units.map(u => { const w = u.short.split(' '); const l1 = w.length > 1 ? w.slice(0, Math.ceil(w.length / 2)).join(' ') : u.short, l2 = w.length > 1 ? w.slice(Math.ceil(w.length / 2)).join(' ') : ''; return `<g class="gn" data-u="${u.code}" transform="translate(${pos[u.code].x},${pos[u.code].y})"><circle r="44" fill="#${u.color}"/><text class="gnt"><tspan x="0" y="${l2 ? -3 : 5}">${esc(l1)}</tspan>${l2 ? `<tspan x="0" y="15">${esc(l2)}</tspan>` : ''}</text></g>`; }).join('')}
    </svg><p class="muted small m0">انقر على قسم لعرض ما يستلمه وما يسلّمه، أو على سهم لعرض «متى ينتقل العمل وماذا يُسلَّم».</p></div>
    <div class="gside" id="gside"></div></div>
    <h2 class="gh2">نقاط التسليم بين الأقسام <span class="muted small">(${G.handoffs.length})</span>${isAdmin() ? '<button class="btn sm" id="hNew">＋ نقطة تسليم</button>' : ''}</h2>
    <div class="ghand" id="ghand"></div>`;
  const side = $('#gside', t), list = $('#ghand', t);
  const hoRow = h => `<div class="gho" data-ho="${h.id}"><div class="ghoh">${chip(h.from_unit)} <span class="garr">←</span> ${chip(h.to_unit)}${h.process_code ? `<span class="sp"></span>${refLink(h.process_code)}` : ''}</div><div class="ghob"><b>متى:</b> ${esc(h.trigger)}</div>${h.deliverable ? `<div class="ghob"><b>ماذا يُسلَّم:</b> ${esc(h.deliverable)}</div>` : ''}${h.sla ? `<div class="ghob"><b>المهلة:</b> ${esc(h.sla)}</div>` : ''}${h.note ? `<div class="ghob muted">${esc(h.note)}</div>` : ''}${isAdmin() ? `<button class="btn sm ghost" data-hed="${h.id}">تعديل</button>` : ''}</div>`;
  const showUnit = code => { const u = G.U[code]; if (!u) return; $$('.gn', t).forEach(g => g.classList.toggle('on', g.dataset.u === code)); $$('.ge', t).forEach(e => e.classList.toggle('dim', e.dataset.f !== code && e.dataset.t !== code));
    const out = G.handoffs.filter(h => h.from_unit === code), inn = G.handoffs.filter(h => h.to_unit === code);
    side.innerHTML = `<div class="gcard" style="--c:#${u.color}"><h3>${esc(u.name)}</h3><p>${esc(u.mission)}</p>${u.head ? `<small class="muted">المسؤول: ${esc(u.head)}</small>` : ''}<h4>المسؤوليات</h4><ul>${(u.duties || []).map(d => `<li>${esc(d)}</li>`).join('')}</ul><h4>يستلم من</h4>${inn.length ? inn.map(h => `<div class="gmini"><b>${esc(un(h.from_unit))}</b>: ${esc(h.trigger)}</div>`).join('') : '<p class="muted small">—</p>'}<h4>يسلّم إلى</h4>${out.length ? out.map(h => `<div class="gmini"><b>${esc(un(h.to_unit))}</b>: ${esc(h.trigger)}</div>`).join('') : '<p class="muted small">—</p>'}${isAdmin() ? `<button class="btn sm" data-ued="${u.code}">تعديل القسم</button>` : ''}</div>`;
    list.innerHTML = [...inn, ...out].map(hoRow).join('') || '<p class="muted">لا نقاط تسليم مسجلة.</p>'; bind(); };
  const showEdge = id => { const h = G.handoffs.find(x => x.id === +id); if (!h) return; $$('.ge', t).forEach(e => e.classList.toggle('dim', e.dataset.h !== String(id))); side.innerHTML = `<div class="gcard" style="--c:#${uc(h.from_unit)}"><h3>${esc(un(h.from_unit))} ← ${esc(un(h.to_unit))}</h3>${hoRow(h)}</div>`; bind(); };
  const bind = () => { if (!isAdmin()) return; $$('[data-hed]', t).forEach(b => b.onclick = () => editHandoff(G.handoffs.find(x => x.id === +b.dataset.hed), () => mountGov(t.closest('#main') || document.body, 'map'))); $$('[data-ued]', t).forEach(b => b.onclick = () => editRow('gov_units', G.U[b.dataset.ued], [['name', 'الاسم الكامل', 'text'], ['short', 'الاسم المختصر', 'text'], ['head', 'المسؤول', 'text'], ['mission', 'الرسالة', 'textarea'], ['duties', 'المسؤوليات (سطر لكل مسؤولية)', 'lines'], ['color', 'اللون (hex بلا #)', 'text']], () => mountGov(t.closest('#main') || document.body, 'map'), 'code')); };
  $$('.gn', t).forEach(g => g.onclick = () => showUnit(g.dataset.u));
  $$('.ge', t).forEach(e => e.onclick = () => showEdge(e.dataset.h));
  $('#hNew', t) && ($('#hNew', t).onclick = () => editHandoff(null, () => mountGov(t.closest('#main') || document.body, 'map')));
  if (sel0 && G.U[sel0]) showUnit(sel0); else { list.innerHTML = G.handoffs.map(hoRow).join(''); side.innerHTML = `<div class="gcard"><h3>العلاقات بين الأقسام</h3><p>${G.handoffs.length} نقطة تسليم موثقة: لكل واحدة «متى» و«ماذا يُسلَّم» و«المهلة» والإجراء الذي يفصّلها.</p><p class="muted small">المبدأ: المنشأة تتعامل مع قناة واحدة (المرافق)، والأقسام تتسلم بعضها من بعض بمحاضر لا بالشفهي.</p></div>`; bind(); }
}
function editHandoff(h, done) { const opts = G.units.map(u => [u.code, u.short]); editRow('gov_handoffs', h, [['from_unit', 'من', 'select', opts], ['to_unit', 'إلى', 'select', opts], ['trigger', 'متى ينتقل العمل', 'textarea'], ['deliverable', 'ماذا يُسلَّم', 'textarea'], ['sla', 'المهلة', 'text'], ['process_code', 'الإجراء المرتبط (مثل G-04)', 'text'], ['note', 'ملاحظة', 'textarea'], ['sort', 'الترتيب', 'number']], done); }

// ---------- موجّه الطلبات
function viewRouter(t) {
  const nodes = Object.fromEntries(G.router.map(n => [n.key, n])); let path = [];
  const render = key => { const n = nodes[key]; if (!n) return; const crumbs = path.map((p, i) => `<span class="gcrumb">${esc(p.a)}</span>`).join('<span class="muted">‹</span>');
    t.innerHTML = `<div class="grouter"><div class="grq"><div class="muted small">${crumbs || 'ثلاث خطوات على الأكثر'}</div><h2>${esc(n.q)}</h2><div class="gopts">${n.opts.map((o, i) => `<button class="gopt" data-i="${i}">${esc(o.t)}</button>`).join('')}</div>${path.length ? '<button class="btn sm ghost" id="rBack">رجوع</button>' : ''}</div>${isAdmin() ? `<p class="small muted">مدير النظام: <button class="btn sm" id="rEdit">تعديل هذه الخطوة (JSON)</button></p>` : ''}</div>`;
    $$('.gopt', t).forEach(b => b.onclick = () => { const o = n.opts[+b.dataset.i]; path.push({ q: n.q, a: o.t }); if (o.next) render(o.next); else outcome(o.out); });
    $('#rBack', t) && ($('#rBack', t).onclick = () => { path.pop(); render(path.length ? nodes[pathKey()] : 'start'); });
    $('#rEdit', t) && ($('#rEdit', t).onclick = () => editRow('gov_router', n, [['q', 'السؤال', 'text'], ['opts', 'الخيارات (JSON)', 'json']], () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'router')), 'key'));
  };
  const pathKey = () => { let k = 'start'; for (const p of path) { const n = nodes[k]; const o = n.opts.find(x => x.t === p.a); if (!o || !o.next) break; k = o.next; } return k; };
  const outcome = o => { const u = G.U[o.unit], p = G.P[o.proc]; t.innerHTML = `<div class="grouter"><div class="gres" style="--c:#${u?.color || '6B7A88'}"><div class="muted small">${path.map(x => esc(x.a)).join(' ‹ ')}</div><span class="uchip big" style="--c:#${u?.color || '6B7A88'}">${esc(u?.short || o.unit)}</span><h2>${esc(o.title)}</h2><p>${esc(o.text)}</p>${p ? `<div class="gresproc"><b>الإجراء:</b> <a href="#/gov/sop/${p.code}">${esc(p.code)} — ${esc(p.title)}</a><br><small class="muted">${esc(p.kpi)}</small></div>` : ''}<div class="btnrow mt10"><button class="btn" id="rAgain">سؤال آخر</button>${p ? `<a class="btn primary" href="#/gov/sop/${p.code}">افتح خطوات الإجراء</a>` : ''}</div></div></div>`; $('#rAgain', t).onclick = () => { path = []; render('start'); }; };
  render('start');
}

// ---------- مصفوفة الصلاحيات
function viewMatrix(t, params) {
  let scope = (params?.get?.('scope')) || 'units'; let fu = '';
  const render = () => { const cols = scope === 'units' ? G.units.filter(u => (u.kind === 'mgmt' || u.kind === 'unit') && u.active !== false).map(u => u.code) : Object.keys(ROLES_PRJ); const name = c => scope === 'units' ? un(c) : ROLES_PRJ[c];
    const rows = G.acts.filter(a => a.scope === scope && (!fu || a.raci?.[fu])); const groups = [...new Set(rows.map(r => r.grp))];
    t.innerHTML = `<div class="toolbar"><div class="subtabs"><a href="#" data-sc="units" class="${scope === 'units' ? 'on' : ''}">بين الأقسام</a><a href="#" data-sc="prj" class="${scope === 'prj' ? 'on' : ''}">داخل قسم المشاريع (الأدوار)</a></div><span class="sp"></span><select id="mfu"><option value="">كل الأعمدة</option>${cols.map(c => `<option value="${c}" ${fu === c ? 'selected' : ''}>ما يخص ${esc(name(c))}</option>`).join('')}</select><button class="btn sm" id="mXl">Excel</button>${isAdmin() ? '<button class="btn sm primary" id="aNew">＋ نشاط</button>' : ''}</div>
      <div class="glegend">${Object.entries(CODES).map(([k, [v]]) => `<span class="rc ${k}">${k}</span> ${v}`).join(' &nbsp; ')}<span class="muted small"> — انقر على خلية لتغييرها (مدير النظام)</span></div>
      <div class="tblwrap"><table class="lst gmat"><thead><tr><th class="act">النشاط</th>${cols.map(c => `<th><span class="uchip" style="--c:#${scope === 'units' ? uc(c) : '123B5C'}">${esc(name(c))}</span></th>`).join('')}</tr></thead><tbody>${groups.map(g => `<tr class="ggrp"><td colspan="${cols.length + 1}">${esc(g)}</td></tr>${rows.filter(r => r.grp === g).map(r => `<tr data-a="${r.id}"><td class="act">${esc(r.title)}${r.note ? `<small class="muted">${esc(r.note)}</small>` : ''}${isAdmin() ? `<button class="btn sm ghost aed" data-aed="${r.id}">✎</button>` : ''}</td>${cols.map(c => { const v = r.raci?.[c]; return `<td class="rcell ${isAdmin() ? 'can' : ''}" data-a="${r.id}" data-c="${c}">${v ? `<span class="rc ${v}" title="${CODES[v]?.[0] || v}">${v}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}`).join('')}</tbody></table></div>`;
    $$('[data-sc]', t).forEach(a => a.onclick = e => { e.preventDefault(); scope = a.dataset.sc; fu = ''; render(); });
    $('#mfu', t).onchange = e => { fu = e.target.value; render(); };
    $('#mXl', t).onclick = async () => { const { exportTable } = await import('./xlsx.js'); exportTable('مصفوفة الصلاحيات', 'المصفوفة', [{ h: 'المحور', k: 'grp', w: 28 }, { h: 'النشاط', k: 'title', w: 60 }, ...cols.map(c => ({ h: name(c), k: r => r.raci?.[c] ? `${r.raci[c]} ${CODES[r.raci[c]]?.[0] || ''}` : '', w: 14 }))], rows); };
    if (isAdmin()) { const order = ['', 'A', 'R', 'V', 'C', 'I'];
      $$('.rcell.can', t).forEach(td => td.onclick = async () => { const a = G.acts.find(x => x.id === +td.dataset.a); const cur = a.raci?.[td.dataset.c] || ''; const nxt = order[(order.indexOf(cur) + 1) % order.length]; const raci = { ...(a.raci || {}) }; if (nxt) raci[td.dataset.c] = nxt; else delete raci[td.dataset.c]; try { await q(sb.from('gov_activities').update({ raci }).eq('id', a.id)); a.raci = raci; td.innerHTML = nxt ? `<span class="rc ${nxt}">${nxt}</span>` : ''; } catch (e) { err(e); } });
      const ae = a => editRow('gov_activities', a, [['grp', 'المحور', 'text'], ['title', 'النشاط', 'textarea'], ['note', 'ملاحظة', 'text'], ['sort', 'الترتيب', 'number']], () => load(true).then(render), 'id', { scope });
      $('#aNew', t).onclick = () => ae(null); $$('[data-aed]', t).forEach(b => b.onclick = () => ae(G.acts.find(x => x.id === +b.dataset.aed))); }
  };
  render();
}

// ---------- الإجراءات
// الإجراءات: مشتركة بين الأقسام (G-) + دليل إجراءات لكل قسم (المشاريع P-، المرافق F-، الصيانة M-، …)
const MAN_PREFIX = { PRJ: 'P', FAC: 'F', MNT: 'M', SAF: 'H', BME: 'B', MED: 'E', GEN: 'S', IT: 'T', TRN: 'V' };
const isShared = p => /^G-/.test(p.code);
async function markImpl(t) {
  try { if (!KINDS) KINDS = await q(sb.from('ops_kinds').select('code,name,icon,unit,proc,intake,active').eq('active', true)).catch(() => []);
    $$('a.gproc[href^="#/gov/sop/"]', t).forEach(a => { const c = a.getAttribute('href').split('/').pop(); const n = KINDS.filter(k => k.proc === c).length + (IMPL[c] || []).length;
      a.querySelector('.gpc')?.insertAdjacentHTML('beforeend', n ? `<span class="gimpl-b" title="له تطبيق في المنصة">مطبّق</span>` : `<span class="gimpl-b off" title="لم يُربط بشاشة أو نموذج بعد">ورقي</span>`); }); } catch (e) { }
}
function viewSops(t, params) {
  const depts = G.units.filter(u => u.kind === 'unit' && u.active !== false);
  let fil = params?.get?.('u') || '';
  t.innerHTML = `<div class="toolbar"><input id="sq" placeholder="ابحث في الإجراءات…" style="min-width:240px"><span class="sp"></span>${isAdmin() ? '<button class="btn sm primary" id="pNew">＋ إجراء</button>' : ''}</div><div class="gman" id="gman"></div><div id="sl"></div>`;
  const card = p => `<a class="gproc" href="#/gov/sop/${p.code}" style="--c:#${uc(p.owner)}"><div class="gpc"><b>${esc(p.code)}</b><span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.goal)}</p><div class="gpu">${(p.units || []).map(chip).join('')}</div><small class="muted">${(p.steps || []).length} خطوة${hasDoc(p) ? ' · <b class="gdeep">دليل مفصّل</b>' : ''}</small></a>`;
  const render = () => {
    const s = ($('#sq', t).value || '').trim();
    const all = G.procs.filter(p => p.active !== false), ps = all.filter(p => !s || (p.code + ' ' + p.title + ' ' + p.goal + ' ' + JSON.stringify(p.steps)).includes(s));
    const shared = ps.filter(isShared), mine = c => ps.filter(p => !isShared(p) && p.owner === c), cnt = c => all.filter(p => !isShared(p) && p.owner === c).length;
    $('#gman', t).innerHTML = `<button class="gmb ${!fil ? 'on' : ''}" data-u=""><b>${all.length}</b>الكل</button><button class="gmb ${fil === 'G' ? 'on' : ''}" data-u="G" style="--c:#123B5C"><b>${all.filter(isShared).length}</b>المشتركة بين الأقسام</button>${depts.map(u => `<button class="gmb ${fil === u.code ? 'on' : ''} ${cnt(u.code) ? '' : 'nil'}" data-u="${u.code}" style="--c:#${uc(u.code)}"><b>${cnt(u.code) || '—'}</b>دليل ${esc(u.short)}</button>`).join('')}`;
    $$('#gman [data-u]', t).forEach(b => b.onclick = () => { fil = b.dataset.u; render(); });
    const blocks = [];
    if (!fil || fil === 'G') if (shared.length || fil === 'G') blocks.push(`<h2 class="gh2"><span class="uchip" style="--c:#123B5C">الإجراءات المشتركة بين الأقسام</span> <span class="muted small">${shared.length} إجراء · تحكم انتقال العمل من قسم إلى آخر</span></h2><div class="gprocs">${shared.map(card).join('') || '<div class="empty-boq">لا نتائج</div>'}</div>`);
    if (fil !== 'G') depts.filter(u => !fil || fil === u.code).forEach(u => { const list = mine(u.code); if (!list.length && s) return;
      blocks.push(`<h2 class="gh2" style="--c:#${uc(u.code)}"><span class="uchip" style="--c:#${uc(u.code)}">دليل إجراءات ${esc(u.name)}</span> <span class="muted small">${list.length ? `${list.length} إجراء · <bdi>${esc(list[0].code)}</bdi> إلى <bdi>${esc(list[list.length - 1].code)}</bdi>` : ''}</span></h2>${list.length ? `<div class="gprocs">${list.map(card).join('')}</div>` : `<div class="gman-nil">لم يُعدّ دليل إجراءات هذا القسم بعد. ${(n => n ? `ويملك القسم حالياً ${n === 1 ? 'إجراءً مشتركاً واحداً' : n === 2 ? 'إجراءين مشتركين' : n + ' إجراءات مشتركة'} مع بقية الأقسام.` : '')(shared.filter(p => p.owner === u.code).length)}</div>`}`); });
    $('#sl', t).innerHTML = blocks.join('') || '<div class="empty-boq">لا نتائج</div>';
    markImpl($('#sl', t));
  };
  $('#sq', t).oninput = render; render();
  $('#pNew', t) && ($('#pNew', t).onclick = () => editProc(null, () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'sop'))));
}
// ---------- أين يُنفَّذ الإجراء في المنصة: النماذج (من ops_kinds.proc) والشاشات، والأعمال الجارية عليه وعلى كل خطوة
const IMPL = {
  'G-01': [['#/ops/new', 'مركز البلاغات والطلبات'], ['#/ops/list', 'الاستقبال الموحد — كل الأعمال']], 'G-02': [['#/projects', 'المشاريع']], 'G-04': [['#/projects', 'المشاريع (الاستلام الابتدائي)']],
  'G-06': [['#/dept/MNT/plans', 'الأعمال المخططة — الصيانة']], 'G-11': [['#/tsd', 'لوحة الإدارة — نافذ الآن']],
  'F-02': [['#/fm/round', 'الجولة الشهرية لمتابعة الأنظمة'], ['#/fm', 'متابعة أنظمة المنشآت']], 'F-03': [['#/dept/FAC/locations', 'سجل المواقع والغرف']], 'F-04': [['#/tsd/report', 'التقرير الشهري للإدارة'], ['#/fm/report', 'تقرير حالة الأنظمة']],
  'M-03': [['#/dept/MNT/plans', 'الأعمال المخططة — الصيانة'], ['#/fm', 'متابعة الأنظمة الحرجة']], 'M-04': [['#/dept/MNT/assets', 'أصول الصيانة']],
  'H-04': [['#/dept/SAF/assets', 'أصول وسجلات الأمن والسلامة']], 'H-05': [['#/dept/SAF/assets', 'أصول الأمن (الكاميرات وضبط الدخول)']], 'H-06': [['#/fm', 'متابعة الأنظمة — اشتراطات الدفاع المدني']],
  'B-01': [['#/dept/BME/assets', 'سجل الأجهزة الطبية']], 'B-02': [['#/dept/BME/plans', 'الأعمال المخططة — الصيانة الطبية']], 'B-03': [['#/dept/BME/assets', 'الأجهزة وعقود خدمتها']], 'E-05': [['#/dept/BME/assets', 'سجل الأجهزة (توصيات الإحلال)']],
  'S-01': [['#/dept/GEN/plans', 'الأعمال المخططة — الخدمات العامة']], 'S-02': [['#/dept/GEN/plans', 'الأعمال المخططة — النفايات']], 'S-03': [['#/dept/GEN/plans', 'الأعمال المخططة — مكافحة الحشرات']],
  'T-04': [['#/dept/IT/plans', 'الأعمال المخططة — النسخ الاحتياطي']], 'T-02': [['#/projects', 'المشاريع']],
  'P-01': [['#/projects', 'المشاريع — مشروع جديد']], 'P-02': [['#/projects', 'جداول الكميات (في المشروع)'], ['#/ref', 'المرجع الفني']], 'P-03': [['#/projects', 'حزمة الطرح (في المشروع)']], 'P-04': [['#/projects', 'الجدول الزمني (في المشروع)']],
  'P-05': [['#/treports', 'التقارير الفنية والمحاضر']], 'P-06': [['#/submittals', 'الاعتمادات']], 'P-07': [['#/payments', 'المستخلصات']], 'P-08': [['#/projects', 'أوامر التغيير (في المشروع)']], 'P-09': [['#/challenges', 'التحديات والمخاطر']],
  'P-10': [['#/tasks', 'المهام'], ['#/requests', 'طلبات المشاريع']], 'P-11': [['#/documents', 'المستندات الرسمية']], 'P-12': [['#/treports', 'محاضر الاجتماعات']], 'P-13': [['#/projects', 'الإغلاق (في المشروع)']], 'P-14': [['#/projects', 'الضمان (في المشروع)']],
  'P-15': [['#/report', 'التقارير'], ['#/briefs', 'العروض التنفيذية']], 'P-16': [['#/admin/quality', 'فاحص جودة البيانات']],
  // إجراءات تُنفَّذ بنماذج إجراءات أخرى
  'V-01': [['#/fleet', 'سيارات المقر — طلب سيارة'], ['#/dept/TRN/fleet', 'لوحة الحركة — التسليم والاستلام']], 'V-02': [['#/dept/TRN/vehicles', 'سجل الأسطول ووثائقه']], 'V-03': [['k:vfix'], ['#/dept/TRN/plans', 'الأعمال المخططة — صيانة السيارات']], 'V-04': [['#/dept/TRN/trips', 'سجل الحركة — التعبئة والكيلومترات']], 'V-05': [['k:vacc'], ['#/dept/TRN/trips', 'سجل الحركة — من استخدم السيارة']], 'V-06': [['#/fleet', 'طلب سيارة بمبيت'], ['#/dept/TRN/fleet', 'لوحة الحركة']],
  'G-09': [['k:it'], ['#/projects', 'المشاريع']], 'H-07': [['k:permit'], ['k:saf']], 'E-03': [['k:mspec']], 'S-04': [['k:gen']], 'T-03': [['k:it'], ['#/dept/BME/assets', 'سجل الأجهزة الطبية']],
};
let KINDS = null;
async function implBox(t, p) {
  const box = $('#gimpl', t); if (!box) return;
  try {
    if (!KINDS) KINDS = await q(sb.from('ops_kinds').select('code,name,icon,unit,proc,intake,active').eq('active', true)).catch(() => []);
    const ks = [...KINDS.filter(k => k.proc === p.code), ...(IMPL[p.code] || []).filter(m => m[0].startsWith('k:')).map(m => KINDS.find(k => k.code === m[0].slice(2))).filter(Boolean)];
    const items = await q(sb.from('ops_items').select('id,step,status').eq('proc', p.code).in('status', ['new', 'accepted', 'in_progress', 'on_hold', 'verify']).limit(1000)).catch(() => []);
    const steps = {}; items.forEach(i => steps[i.step || 1] = (steps[i.step || 1] || 0) + 1);
    // المشاريع على خطوات إجراءات المشاريع (من مرحلة كل مشروع)
    if (/^P-0[135]|^P-1[34]$/.test(p.code)) { try { const { GOV } = await import('./govlink.js'); const ps = await q(sb.from('projects').select('stage').eq('archived', false)); ps.forEach(x => { const [c, st] = GOV.project(x); if (c === p.code && st !== 'done') steps[st] = (steps[st] || 0) + 1; }); } catch (e) { } }
    const mods = (IMPL[p.code] || []).filter(m => !m[0].startsWith('k:'));
    if (!ks.length && !mods.length) { box.innerHTML = '<div class="gimpl none"><b>لم يُربط بعد بشاشة أو نموذج في المنصة</b><span class="muted small">يُنفَّذ حالياً ورقياً أو خارج المنصة.</span></div>'; return; }
    const total = Object.values(steps).reduce((a, b) => a + b, 0);
    box.innerHTML = `<div class="gimpl"><div class="gimpl-h"><b>يُنفَّذ في المنصة</b>${total ? `<span class="badge info">${total} جارٍ الآن</span>` : '<span class="muted small">لا أعمال جارية عليه الآن</span>'}</div>
      <div class="gimpl-l">${ks.map(k => `<button class="btn sm ${k.intake ? '' : 'ghost'}" data-nk="${k.code}">${kic(k)} ${esc(k.name)}</button>`).join('')}${mods.map(([h, l]) => `<a class="btn sm ghost" href="${h}">${esc(l)}</a>`).join('')}${ks.length || total ? `<a class="btn sm ghost" href="#/ops/list?proc=${p.code}">الأعمال على هذا الإجراء</a>` : ''}</div></div>`;
    $$('[data-nk]', box).forEach(b => b.onclick = async () => { const o = await import('./ops.js'); o.newItem({ kind: b.dataset.nk }, r => o.openItem(r.id)); });
    $$('.gsteps .gstep', t).forEach((el, i) => { const n = steps[i + 1]; if (n) el.querySelector('.gsh')?.insertAdjacentHTML('beforeend', `<span class="badge info" title="أعمال متوقفة عند هذه الخطوة الآن">${n} هنا الآن</span>`); });
  } catch (e) { box.innerHTML = ''; }
}
// ---------- الدليل التفصيلي للإجراء (doc): طبقات — ملخص ظاهر، وكل ما سواه عند الطلب
const hasDoc = p => !!(p.doc && (p.doc.purpose || p.doc.scope || (p.doc.kpis || []).length));
const DOC_LISTS = {
  definitions: [['t', 'المصطلح'], ['d', 'التعريف']],
  roles: [['role', 'الدور'], ['resp', 'المسؤولية']],
  risks: [['risk', 'الخطر'], ['control', 'الضابط']],
  exceptions: [['case', 'الحالة'], ['action', 'التصرف']],
  records: [['name', 'السجل'], ['where', 'مكان الحفظ'], ['keep', 'مدة الحفظ']],
  refs: [['std', 'المرجع'], ['title', 'الموضوع']],
  kpis: [['name', 'المؤشر'], ['formula', 'طريقة الحساب'], ['target', 'المستهدف'], ['freq', 'الدورية'], ['source', 'المصدر'], ['auto', 'رمز الحساب الآلي']],
};
const tbl = (rows, cols) => rows?.length ? `<div class="tblwrap"><table class="gdt"><thead><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${linkify(r[c[0]] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
// مؤشرات تُحسب آلياً من بيانات المنصة (آخر 90 يوماً) — الرمز في doc.kpis[].auto
const D90 = () => new Date(Date.now() - 90 * 864e5).toISOString();
const pct = (a, b) => b ? { v: Math.round(100 * a / b) + '٪', n: `${a} من ${b}` } : null;
const opsQ = (kind, cols) => q(sb.from('ops_items').select(cols).eq('kind', kind).gte('created_at', D90()).limit(2000));
const OPEN_S = ['new', 'accepted', 'in_progress', 'on_hold', 'verify'];
const closedAt = i => i.resolved_at || i.closed_at;
const AUTO = {
  permit_ontime: async () => { const r = (await opsQ('permit', 'status,data,resolved_at,closed_at')).filter(i => closedAt(i) && i.data?.to); return pct(r.filter(i => new Date(closedAt(i)) <= new Date(new Date(i.data.to).getTime() + 2 * 36e5)).length, r.length); },
  impair_ontime: async () => { const r = (await opsQ('impair', 'status,data,resolved_at,closed_at')).filter(i => closedAt(i) && i.data?.to); return pct(r.filter(i => new Date(closedAt(i)) <= new Date(i.data.to)).length, r.length); },
  impair_open: async () => { const r = await q(sb.from('ops_items').select('id,data').eq('kind', 'impair').in('status', OPEN_S)); const late = r.filter(i => i.data?.to && new Date(i.data.to) < new Date()).length; return { v: String(r.length), n: late ? `${late} تجاوز موعد الإعادة` : 'لا متأخر' }; },
  emerg_response: async () => { const r = await opsQ('emerg', 'created_at,accepted_at,started_at'); return pct(r.filter(i => (i.accepted_at || i.started_at) && new Date(i.accepted_at || i.started_at) - new Date(i.created_at) <= 2 * 36e5).length, r.length); },
  emerg_close_avg: async () => { const r = (await opsQ('emerg', 'created_at,resolved_at,closed_at')).filter(closedAt); if (!r.length) return null; const h = r.reduce((a, i) => a + (new Date(closedAt(i)) - new Date(i.created_at)), 0) / r.length / 36e5; return { v: h < 48 ? h.toFixed(1) + ' ساعة' : (h / 24).toFixed(1) + ' يوم', n: `${r.length} بلاغ مغلق` }; },
  ppm_month: async () => { const d = new Date(), m0 = new Date(d.getFullYear(), d.getMonth(), 1), m1 = new Date(d.getFullYear(), d.getMonth() + 1, 1); const r = await q(sb.from('ops_items').select('status,plan_id,kind').or('kind.eq.ppm,plan_id.not.is.null').gte('due_at', m0.toISOString()).lt('due_at', m1.toISOString()).limit(5000)); return pct(r.filter(i => !OPEN_S.includes(i.status) && i.status !== 'cancelled').length, r.filter(i => i.status !== 'cancelled').length); },
  ppm_late: async () => { const r = await q(sb.from('ops_items').select('id').or('kind.eq.ppm,plan_id.not.is.null').in('status', OPEN_S).lt('due_at', new Date().toISOString()).limit(5000)); return { v: String(r.length), n: 'أمر مفتوح تجاوز موعده' }; },
  handover_2w: async () => { const r = (await q(sb.from('ops_items').select('created_at,resolved_at,closed_at').eq('kind', 'handover').gte('created_at', new Date(Date.now() - 365 * 864e5).toISOString()))).filter(closedAt); return pct(r.filter(i => new Date(closedAt(i)) - new Date(i.created_at) <= 14 * 864e5).length, r.length); },
  trips_ontime: async () => { const r = await q(sb.from('vehicle_trips').select('back_at,expected_back').eq('status', 'returned').gte('out_at', D90()).limit(5000)); const x = r.filter(i => i.expected_back); return pct(x.filter(i => new Date(i.back_at) <= new Date(new Date(i.expected_back).getTime() + 15 * 6e4)).length, x.length); },
  trips_late: async () => { const r = await q(sb.from('vehicle_trips').select('id').eq('status', 'out').lt('expected_back', new Date().toISOString())); return { v: String(r.length), n: 'سيارة خارج المقر بعد موعدها' }; },
};
async function fillKpis(t) {
  for (const el of $$('[data-auto]', t)) {
    const f = AUTO[el.dataset.auto]; if (!f) { el.remove(); continue; }
    try { const r = await f(); el.innerHTML = r ? `<b>${esc(r.v)}</b><small>${esc(r.n)}</small>` : '<small>لا بيانات كافية بعد</small>'; } catch (e) { el.innerHTML = '<small>تعذر الحساب</small>'; }
  }
}
function docPanes(p) {
  const d = p.doc || {};
  const intro = `<div class="gdintro">${d.purpose ? `<p class="gdpur"><b>الغرض</b>${linkify(d.purpose)}</p>` : ''}
    ${d.scope || d.out_of_scope || (d.definitions || []).length ? `<details class="gdx"><summary>النطاق والتعريفات</summary><div class="gdxb">${d.scope ? `<p><b>يشمل:</b> ${linkify(d.scope)}</p>` : ''}${d.out_of_scope ? `<p><b>لا يشمل:</b> ${linkify(d.out_of_scope)}</p>` : ''}${(d.definitions || []).length ? `<dl class="gddl">${d.definitions.map(x => `<dt>${esc(x.t)}</dt><dd>${linkify(x.d)}</dd>`).join('')}</dl>` : ''}</div></details>` : ''}</div>`;
  const roles = `${(d.roles || []).length ? `<h3 class="sub-h">الأدوار والمسؤوليات</h3>${tbl(d.roles, DOC_LISTS.roles)}` : ''}${(d.risks || []).length ? `<h3 class="sub-h">المخاطر وضوابطها</h3>${tbl(d.risks, DOC_LISTS.risks)}` : ''}${(d.exceptions || []).length ? `<h3 class="sub-h">الحالات الاستثنائية</h3>${tbl(d.exceptions, DOC_LISTS.exceptions)}` : ''}`;
  const kpis = (d.kpis || []).length ? `<div class="gdk">${d.kpis.map(k => `<div class="gdkc"><div class="gdkh"><b>${esc(k.name)}</b>${k.auto ? `<span class="gdkv" data-auto="${esc(k.auto)}"><small>…</small></span>` : ''}</div><p>${esc(k.formula)}</p><div class="gdkm"><span>المستهدف: <b>${esc(k.target)}</b></span><span>${esc(k.freq)}</span><span>${esc(k.source)}</span></div></div>`).join('')}</div><p class="muted small">القيم الحية محسوبة من المنصة (آخر 90 يوماً، وشهر التقويم الحالي لمؤشر الصيانة المخططة)، وما لا قيمة له يُقاس من مصدره المذكور.</p>` : '';
  const recs = `${(d.records || []).length ? `<h3 class="sub-h">السجلات والنماذج</h3>${tbl(d.records, DOC_LISTS.records)}` : ''}${(d.refs || []).length ? `<h3 class="sub-h">المراجع والمعايير</h3>${tbl(d.refs, DOC_LISTS.refs)}` : ''}${d.review ? `<p class="mt12"><b>مراجعة الإجراء:</b> ${esc(d.review)}</p>` : ''}`;
  const tabs = [['steps', 'الخطوات'], roles && ['roles', 'الأدوار والضوابط'], kpis && ['kpis', 'المؤشرات'], recs && ['recs', 'السجلات والمراجع']].filter(Boolean);
  return { intro, tabs, panes: { roles, kpis, recs } };
}
function viewProc(t, code) {
  const p = G.P[code]; if (!p) return t.innerHTML = '<div class="empty-boq">الإجراء غير موجود</div>';
  const lanes = [...new Set(p.steps.map(s => s.unit))], deep = hasDoc(p), D = deep ? docPanes(p) : null, anyX = p.steps.some(hasX);
  const steps = `<div class="gdsh"><h3 class="sub-h m0">الخطوات <span class="muted small">— لون كل خطوة بلون القسم المسؤول عنها</span></h3>${anyX ? '<button type="button" class="btn sm ghost" id="gxAll">توسيع كل التفاصيل</button>' : ''}</div>
    ${flowHtml(p)}
    <div class="gswim"><div class="glanes">${lanes.map(u => `<div class="glane" style="--c:#${uc(u)}"><span>${esc(un(u))}</span></div>`).join('')}</div><div class="gsteps">${p.steps.map(stepHtml).join('')}</div></div>
    ${p.notes ? `<div class="notice mt12"><b>ملاحظات:</b> ${linkify(p.notes)}</div>` : ''}`;
  t.innerHTML = `<div class="toolbar"><a class="btn sm ghost" href="#/gov/sop">→ الإجراءات</a><h2 class="m0">${esc(p.code)} — ${esc(p.title)}</h2><span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span><span class="sp"></span><button class="btn sm" onclick="print()">${ico('print')} طباعة</button>${isAdmin() ? `<button class="btn sm" id="pEd">تعديل</button><button class="btn sm" id="pDoc">الدليل التفصيلي</button>${p.status !== 'approved' ? '<button class="btn sm primary" id="pApp">اعتماد</button>' : ''}` : ''}</div>
    <div class="gpgrid"><div class="gkv"><span>المالك</span><b>${chip(p.owner)}</b></div><div class="gkv"><span>الأقسام المشاركة</span><b>${(p.units || []).map(chip).join('')}</b></div><div class="gkv wide"><span>الهدف</span><b>${esc(p.goal)}</b></div><div class="gkv"><span>متى يبدأ</span><b>${esc(p.trigger)}</b></div><div class="gkv"><span>المدخلات</span><b>${esc(p.inputs)}</b></div><div class="gkv"><span>المخرجات</span><b>${esc(p.outputs)}</b></div><div class="gkv"><span>مؤشر الأداء</span><b>${esc(p.kpi)}</b></div></div>
    ${deep ? D.intro : ''}
    <div id="gimpl"></div>
    ${deep ? `<div class="gdseg" role="tablist">${D.tabs.map(([k, l], i) => `<button type="button" role="tab" data-pane="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
      <div class="gdpane on" data-p="steps">${steps}</div>${D.tabs.slice(1).map(([k, l]) => `<div class="gdpane" data-p="${k}"><h2 class="gdpt">${l}</h2>${D.panes[k]}</div>`).join('')}` : steps}
    <p class="muted small mt12">${p.approved_by ? `اعتُمد بواسطة ${esc(p.approved_by)} في ${dateAr(p.approved_at)}` : 'مسودة بانتظار الاعتماد'} · آخر تحديث ${dateAr(p.updated_at)}</p>`;
  implBox(t, p);
  $$('.gdseg button', t).forEach(b => b.onclick = () => { $$('.gdseg button', t).forEach(x => x.classList.toggle('on', x === b)); $$('.gdpane', t).forEach(x => x.classList.toggle('on', x.dataset.p === b.dataset.pane)); });
  const xa = $('#gxAll', t); if (xa) xa.onclick = () => { const open = !xa.classList.contains('on'); xa.classList.toggle('on', open); xa.textContent = open ? 'طي التفاصيل' : 'توسيع كل التفاصيل'; $$('.gsteps .gstep', t).forEach(el => el.querySelector('.gsx') && el.classList.toggle('open', open)); };
  if (deep) fillKpis(t);
  const again = () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'sop', code));
  $('#pEd', t) && ($('#pEd', t).onclick = () => editProc(p, again));
  $('#pDoc', t) && ($('#pDoc', t).onclick = () => editDoc(p, again));
  $('#pApp', t) && ($('#pApp', t).onclick = async () => { if (!await confirm('اعتماد هذا الإجراء بإصداره الحالي؟', 'اعتماد')) return; await q(sb.from('gov_processes').update({ status: 'approved', approved_by: session.profile?.full_name || '', approved_at: new Date().toISOString().slice(0, 10) }).eq('code', code)); toast('اعتُمد'); await load(true); mountGov(t.closest('#main') || document.body, 'sop', code); });
}
// محرر الدليل التفصيلي: الجداول تُكتب سطراً لكل صف وتُفصل الأعمدة بـ « | »
function editDoc(p, done) {
  const d = p.doc || {};
  const toL = (k) => (d[k] || []).map(r => DOC_LISTS[k].map(([c]) => r[c] || '').join(' | ').replace(/( \| )+$/, '')).join('\n');
  const fromL = (k, txt) => String(txt || '').split('\n').map(x => x.trim()).filter(Boolean).map(line => { const parts = line.split('|').map(x => x.trim()), o = {}; DOC_LISTS[k].forEach(([c], i) => { if (parts[i]) o[c] = parts[i]; }); return o; }).filter(o => Object.keys(o).length);
  const ta = (k, lbl, rows = 4) => field(`${lbl} <small class="muted">— سطر لكل صف: ${DOC_LISTS[k].map(c => c[1]).join(' | ')}</small>`, `<textarea name="${k}" rows="${rows}">${esc0(toL(k))}</textarea>`, 'wide');
  modal(`<form id="f" class="pgrid">${field('الغرض', `<textarea name="purpose" rows="2">${esc0(d.purpose || '')}</textarea>`, 'wide')}${field('النطاق (يشمل)', `<textarea name="scope" rows="2">${esc0(d.scope || '')}</textarea>`, 'wide')}${field('لا يشمل', `<textarea name="out_of_scope" rows="2">${esc0(d.out_of_scope || '')}</textarea>`, 'wide')}
    ${ta('definitions', 'التعريفات', 3)}${ta('roles', 'الأدوار والمسؤوليات')}${ta('risks', 'المخاطر وضوابطها')}${ta('exceptions', 'الحالات الاستثنائية', 3)}${ta('kpis', 'المؤشرات')}${ta('records', 'السجلات والنماذج', 3)}${ta('refs', 'المراجع والمعايير', 3)}
    ${field('مراجعة الإجراء', inp('review', d.review || ''), 'wide')}
    <p class="muted small wide">رموز الحساب الآلي المتاحة للمؤشرات: ${Object.keys(AUTO).map(k => `<bdi>${k}</bdi>`).join('، ')}. تفاصيل كل خطوة (معيار القرار، التصعيد، السجل) تُحرَّر من «تعديل».</p>
    <div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: `الدليل التفصيلي — ${p.code}`, wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const doc = { purpose: f.purpose.trim(), scope: f.scope.trim(), out_of_scope: f.out_of_scope.trim(), review: f.review.trim() };
      Object.keys(DOC_LISTS).forEach(k => doc[k] = fromL(k, f[k]));
      Object.keys(doc).forEach(k => { if (!doc[k] || (Array.isArray(doc[k]) && !doc[k].length)) delete doc[k]; });
      try { await q(sb.from('gov_processes').update({ doc, updated_at: new Date().toISOString() }).eq('code', p.code)); close(); toast('حُفظ'); done(); } catch (er) { err(er); } };
  } });
}
function editProc(p, done) {
  const opts = G.units.map(u => [u.code, u.short]); const v = p || { code: '', title: '', owner: 'PRJ', units: [], goal: '', trigger: '', inputs: '', outputs: '', kpi: '', steps: [], notes: '', version: '1.0' };
  const stepRow = (s = {}, i) => `<div class="gserow" data-i="${i}"><select name="s_unit">${opts.map(([c, n]) => `<option value="${c}" ${s.unit === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><input name="s_role" placeholder="الدور (اختياري)" value="${esc0(s.role || '')}" style="max-width:130px"><input name="s_action" placeholder="الإجراء" value="${esc(s.action || '')}"><input name="s_sla" placeholder="المهلة" value="${esc(s.sla || '')}" style="max-width:120px"><input name="s_where" placeholder="أين (شاشة/نموذج)" value="${esc(s.where || '')}" style="max-width:150px"><label class="chk"><input type="checkbox" name="s_dec" ${s.kind === 'decision' ? 'checked' : ''}> قرار</label><button type="button" class="btn sm ghost" data-rm>✕</button><details class="gsedx"><summary>تفاصيل الخطوة${hasX(s) ? ' ●' : ''}</summary><textarea name="s_detail" rows="3" placeholder="تفاصيل التنفيذ — سطر لكل نقطة">${esc0((s.detail || []).join('\n'))}</textarea><input name="s_crit" placeholder="معيار القرار (اختياري)" value="${esc0(s.criteria || '')}"><input name="s_esc" placeholder="التصعيد (اختياري)" value="${esc0(s.escalate || '')}"><input name="s_rec" placeholder="السجل الناتج (اختياري)" value="${esc0(s.record || '')}"></details></div>`;
  modal(`<form id="f" class="pgrid">${field('الكود', inp('code', v.code, p ? 'readonly' : 'required placeholder="G-13 أو F-06 أو M-06"'))}${field('الإصدار', inp('version', v.version || '1.0'))}${field('العنوان', inp('title', v.title, 'required'), 'wide')}${field('المالك', sel('owner', opts, v.owner))}${field('الأقسام المشاركة', `<div class="chips">${opts.map(([c, n]) => `<label class="chip"><input type="checkbox" name="u_${c}" ${(v.units || []).includes(c) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`, 'wide')}${field('الهدف', `<textarea name="goal" rows="2">${esc(v.goal)}</textarea>`, 'wide')}${field('متى يبدأ', inp('trigger', v.trigger), 'wide')}${field('المدخلات', inp('inputs', v.inputs))}${field('المخرجات', inp('outputs', v.outputs))}${field('مؤشر الأداء', inp('kpi', v.kpi), 'wide')}<div class="fld wide"><span>الخطوات</span><div id="gse">${(v.steps || []).map(stepRow).join('')}</div><button type="button" class="btn sm" id="sAdd">＋ خطوة</button></div>${field('ملاحظات', `<textarea name="notes" rows="2">${esc(v.notes)}</textarea>`, 'wide')}<div class="btnrow end wide">${p ? '<button type="button" class="btn ghost" id="pDel" style="color:#A6503B">حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: p ? 'تعديل إجراء' : 'إجراء جديد', wide: true, onOpen: (w, close) => {
    const box = $('#gse', w); const bindRm = () => $$('[data-rm]', box).forEach(b => b.onclick = () => b.closest('.gserow').remove()); bindRm();
    $('#sAdd', w).onclick = () => { box.insertAdjacentHTML('beforeend', stepRow({}, box.children.length)); bindRm(); };
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const steps = $$('.gserow', box).map(r => ({ unit: $('[name=s_unit]', r).value, action: $('[name=s_action]', r).value.trim().replace(/→/g, '←'), sla: $('[name=s_sla]', r).value.trim(), where: $('[name=s_where]', r).value.trim(), kind: $('[name=s_dec]', r).checked ? 'decision' : 'step', role: $('[name=s_role]', r).value.trim() || undefined, detail: $('[name=s_detail]', r).value.split('\n').map(x => x.trim()).filter(Boolean), criteria: $('[name=s_crit]', r).value.trim() || undefined, escalate: $('[name=s_esc]', r).value.trim() || undefined, record: $('[name=s_rec]', r).value.trim() || undefined })).filter(s => s.action).map(s => { if (!s.detail.length) delete s.detail; return s; });
      const row = { title: f.title.trim(), version: f.version.trim(), owner: f.owner, units: opts.map(([c]) => c).filter(c => f['u_' + c]), goal: f.goal.trim(), trigger: f.trigger.trim(), inputs: f.inputs.trim(), outputs: f.outputs.trim(), kpi: f.kpi.trim(), steps, notes: f.notes.trim(), updated_at: new Date().toISOString() };
      try { if (p) await q(sb.from('gov_processes').update(row).eq('code', p.code)); else await q(sb.from('gov_processes').insert({ ...row, code: f.code.trim(), sort: 50 })); close(); toast('حُفظ'); done(); } catch (er) { err(er); } };
    $('#pDel', w) && ($('#pDel', w).onclick = async () => { if (!await confirm('حذف الإجراء؟', 'حذف', true)) return; await q(sb.from('gov_processes').delete().eq('code', p.code)); close(); done(); });
  } });
}

// ---------- الإطار الإداري: حدود الاعتماد، اللجان، التقويم السنوي، سجل المخاطر (جدول gov_frame)
const FSEGS = [['plan', 'خطط المرافق', 'I-PLAN'], ['auth', 'حدود الاعتماد', 'I-AUTH'], ['comm', 'اللجان', 'I-COMM'], ['cal', 'التقويم السنوي', 'I-CAL'], ['risk', 'سجل المخاطر', 'I-RISK']];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
// من يقترح/يراجع/يعتمد: رمز قسم ← شارة بلونه، HEAD ← رئيس القسم المختص، C-xx ← اللجنة، وغير ذلك نص
const actor = x => x === 'HEAD' ? '<span class="uchip" style="--c:#6B7A88">رئيس القسم المختص</span>' : G.U[x] ? chip(x) : /^C-\d/.test(x) && G.F[x] ? `<a class="uchip lnk" style="--c:#123B5C" href="#/gov/frame/comm?h=${x}">${esc(G.F[x].title)}</a>` : x === '—' ? '<span class="muted">—</span>' : `<span class="gtxt">${esc(x)}</span>`;
const actors = a => (Array.isArray(a) ? a : [a]).filter(Boolean).map(actor).join('');
const refs = x => String(x || '').split(/\s*·\s*/).filter(Boolean).map(r => `<span class="gfrf">${linkify(r)}</span>`).join('');
const riskLvl = n => n >= 15 ? ['crit', 'حرج'] : n >= 10 ? ['high', 'مرتفع'] : n >= 5 ? ['med', 'متوسط'] : ['low', 'منخفض'];
const FFIELDS = {
  intro: [['text', 'النص', 'textarea'], ['points', 'المبادئ (سطر لكل مبدأ)', 'lines']],
  auth: [['grp', 'المجموعة', 'text'], ['propose', 'يقترح (رموز مفصولة بفاصلة: PRJ، DIR، HEAD، C-02 أو نص)', 'list'], ['review', 'يراجع', 'list'], ['approve', 'يعتمد', 'list'], ['limit', 'الحد أو الشرط', 'textarea'], ['ref', 'المرجع (أكواد)', 'text']],
  comm: [['grp', 'النوع (دائمة / مؤقتة / دوري)', 'text'], ['purpose', 'الغرض', 'textarea'], ['chair', 'الرئيس (رمز قسم أو نص)', 'text'], ['secretary', 'المقرر', 'text'], ['members', 'الأعضاء (مفصولة بفاصلة)', 'list'], ['freq', 'الانعقاد', 'text'], ['quorum', 'النصاب', 'text'], ['duties', 'المهام (سطر لكل مهمة)', 'lines'], ['outputs', 'المخرجات (سطر لكل مخرج)', 'lines'], ['reports_to', 'ترفع إلى', 'text'], ['procs', 'الإجراءات المرتبطة', 'text']],
  cal: [['grp', 'المجموعة', 'text'], ['freq', 'التكرار', 'text'], ['months', 'الأشهر (أرقام مفصولة بفاصلة 1–12)', 'list'], ['owner', 'المسؤول (رمز قسم)', 'text'], ['ref', 'المرجع', 'text'], ['note', 'ملاحظة', 'text']],
  plan: [['owner', 'المالك (رمز قسم)', 'text'], ['purpose', 'الغرض', 'textarea'], ['scope', 'النطاق', 'textarea'], ['objectives', 'الأهداف السنوية (سطر لكل هدف)', 'lines'], ['elements', 'عناصر البرنامج — سطر لكل عنصر: العنصر | الوصف', 'rows', ['0', '1']], ['procs', 'الإجراءات (أكواد مفصولة بـ ·)', 'text'], ['risks', 'المخاطر (RK-xx)', 'text'], ['cal', 'نشاطات التقويم (K-xx)', 'text'], ['comm', 'اللجان (C-xx)', 'text'], ['kpis', 'المؤشرات — سطر لكل مؤشر: الاسم | المستهدف | الدورية | المصدر | رمز آلي', 'rows', ['name', 'target', 'freq', 'source', 'auto']], ['training', 'التدريب (سطر لكل بند)', 'lines'], ['records', 'السجلات (سطر لكل سجل)', 'lines'], ['eval', 'التقييم السنوي', 'textarea']],
  risk: [['grp', 'الفئة', 'text'], ['l', 'الاحتمال (1–5)', 'number'], ['i', 'الأثر (1–5)', 'number'], ['cause', 'السبب', 'textarea'], ['effect', 'الأثر المتوقع', 'textarea'], ['controls', 'الضوابط القائمة (سطر لكل ضابط)', 'lines'], ['plan', 'خطة المعالجة', 'textarea'], ['owner', 'المالك (رمز قسم)', 'text'], ['ref', 'المرجع', 'text']],
};
function editFrame(kind, row, done) {
  const d = row?.data || {}, fs = FFIELDS[kind];
  const val = (k, type, cols) => { const v = k === 'grp' ? row?.grp : d[k]; if (type === 'rows') return (v || []).map(r => cols.map(c => r?.[c] ?? '').join(' | ').replace(/( \| )+$/, '')).join('\n'); return type === 'lines' ? (v || []).join('\n') : type === 'list' ? (v || []).join('، ') : v ?? ''; };
  modal(`<form id="f" class="pgrid">${kind === 'intro' ? '' : field('الكود', inp('code', row?.code || '', row ? 'readonly' : 'required'))}${field('العنوان', inp('title', row?.title || '', 'required'), 'wide')}
    ${fs.map(([k, lbl, type, cols]) => field(lbl, type === 'textarea' || type === 'lines' || type === 'rows' ? `<textarea name="${k}" rows="${type === 'textarea' ? 2 : 4}">${esc0(val(k, type, cols))}</textarea>` : inp(k, val(k, type), type === 'number' ? 'type="number" min="1" max="5"' : ''), ['textarea', 'lines', 'list', 'rows'].includes(type) || k === 'ref' ? 'wide' : '')).join('')}
    ${field('الترتيب', inp('sort', row?.sort ?? 900, 'type="number"'))}
    <div class="btnrow end wide">${row && kind !== 'intro' ? '<button type="button" class="btn ghost" id="eDel" style="color:#A6503B">حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: row ? `تعديل — ${row.title}` : 'إضافة', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target), data = { ...d };
      for (const [k, , type, cols] of fs) { let v = f[k]; if (type === 'rows') { const arr = cols[0] === '0'; v = String(v).split('\n').map(x => x.trim()).filter(Boolean).map(line => { const ps = line.split('|').map(x => x.trim()); if (arr) return cols.map((c, i) => ps[i] || ''); const o = {}; cols.forEach((c, i) => { if (ps[i]) o[c] = ps[i]; }); return o; }); } else if (type === 'number') v = Math.min(5, Math.max(1, Number(v) || 1)); else if (type === 'lines') v = String(v).split('\n').map(x => x.trim()).filter(Boolean); else if (type === 'list') { v = String(v).split(/[,،]/).map(x => x.trim()).filter(Boolean); if (k === 'months') v = v.map(Number).filter(n => n >= 1 && n <= 12); } else v = String(v).trim(); data[k] = v; }
      const out = { title: f.title.trim(), grp: data.grp ?? row?.grp ?? '', sort: Number(f.sort) || 0, data, updated_at: new Date().toISOString() }; delete data.grp;
      try { if (row) await q(sb.from('gov_frame').update(out).eq('code', row.code)); else await q(sb.from('gov_frame').insert({ ...out, code: f.code.trim(), kind })); close(); toast('حُفظ'); await load(true); done(); } catch (er) { err(er); } };
    $('#eDel', w) && ($('#eDel', w).onclick = async () => { if (!await confirm('حذف هذا العنصر؟', 'حذف', true)) return; await q(sb.from('gov_frame').update({ active: false }).eq('code', row.code)); close(); await load(true); done(); });
  } });
}
function viewFrame(t, seg, params) {
  if (!FSEGS.some(s => s[0] === seg)) seg = 'plan';
  const hl = params?.get?.('h') || '', items = G.frame.filter(f => f.kind === seg), intro = G.F[FSEGS.find(s => s[0] === seg)[2]];
  const again = () => mountGov(t.closest('#main') || document.body, 'frame', seg);
  const adm = isAdmin();
  t.innerHTML = `<div class="gdseg gfseg">${FSEGS.map(([k, l]) => `<a href="#/gov/frame/${k}" class="${k === seg ? 'on' : ''}">${l}<small>${G.frame.filter(f => f.kind === k).length}</small></a>`).join('')}</div>
    ${intro ? `<div class="gfintro"><p>${linkify(intro.data.text || '')}</p>${(intro.data.points || []).length ? `<details class="gdx"><summary>المبادئ</summary><div class="gdxb"><ul class="gfpts">${intro.data.points.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div></details>` : ''}${adm ? `<button class="btn sm ghost" data-fed="${intro.code}">تعديل المقدمة</button>` : ''}</div>` : ''}
    <div class="gfbody"></div>
    <p class="muted small mt12 noprint">مسودة مقترحة للاعتماد — الحدود والقيم تُضبط بقرار الإدارة. ${adm ? `<button class="btn sm" id="fNew">＋ إضافة</button>` : ''} <button class="btn sm ghost" onclick="print()">${ico('print')} طباعة</button></p>`;
  const body = $('.gfbody', t);
  ({ plan: fPlan, auth: fAuth, comm: fComm, cal: fCal, risk: fRisk })[seg](body, items, hl);
  if (adm) { $$('[data-fed]', t).forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const r = G.F[b.dataset.fed]; editFrame(r.kind, r, again); }); $('#fNew', t).onclick = () => editFrame(seg, null, again); }
  if (hl && seg !== 'plan') setTimeout(() => { const el = $(`[data-code="${hl}"]`, t); if (el) { el.classList.add('hl'); if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView({ block: 'center' }); } }, 50);
}
const edBtn = c => isAdmin() ? `<button class="btn sm ghost gfed" data-fed="${c}">تعديل</button>` : '';
function fPlan(b, items, hl) {
  let cur = items.find(p => p.code === hl) || items[0]; if (!cur) { b.innerHTML = '<div class="empty-boq">لا خطط بعد</div>'; return; }
  const codes = x => String(x || '').split(/\s*·\s*/).filter(Boolean);
  const sc = r => (r.data.l || 1) * (r.data.i || 1);
  const stat = p => { const d = p.data; return `${codes(d.procs).length} إجراء · ${codes(d.risks).length} خطر · ${codes(d.cal).length} نشاط`; };
  const topRisk = p => { const rs = codes(p.data.risks).map(c => G.F[c]).filter(Boolean); if (!rs.length) return ''; const m = Math.max(...rs.map(sc)), [lv, ln] = riskLvl(m); return `<span class="gfrs mini ${lv}" title="أعلى خطر مرتبط">${m} ${ln}</span>`; };
  const detail = p => { const d = p.data;
    const procs = codes(d.procs).map(c => G.P[c] ? `<li>${refLink(c).replace('class="gref"', 'class="gref in"')} ${esc(G.P[c].title)}</li>` : G.R[c] ? `<li>${refLink(c).replace('class="gref"', 'class="gref in"')} ${esc(G.R[c].title)}</li>` : '').join('');
    const risks = codes(d.risks).map(c => G.F[c]).filter(Boolean).sort((a, c) => sc(c) - sc(a)).map(r => { const [lv] = riskLvl(sc(r)); return `<li><span class="gfrs mini ${lv}">${sc(r)}</span> ${frameLink(r.code)} ${esc(r.title)}</li>`; }).join('');
    const cal = codes(d.cal).map(c => G.F[c]).filter(Boolean).map(r => `<li>${frameLink(r.code)} ${esc(r.title)} <small class="muted">— ${esc(r.data.freq || '')}${(r.data.months || []).length && (r.data.months || []).length < 12 ? ': ' + r.data.months.map(m => MONTHS[m - 1]).join('، ') : ''}</small></li>`).join('');
    const comm = codes(d.comm).map(c => G.F[c]).filter(Boolean).map(r => `<li>${frameLink(r.code)} ${esc(r.title)} <small class="muted">— ${esc(r.data.freq || '')}</small></li>`).join('');
    return `<div class="gfpd" style="--c:#${uc(d.owner)}" data-code="${p.code}"><div class="gfpdh"><b>${esc(p.code)}</b><h2>${esc(p.title)}</h2>${actor(d.owner)}<span class="sp"></span>${edBtn(p.code)}</div>
      <div class="gdpur"><b>الغرض</b>${linkify(d.purpose || '')}</div>${d.scope ? `<p class="gfscope"><b>النطاق:</b> ${linkify(d.scope)}</p>` : ''}
      <div class="gfp2"><div><h3 class="sub-h">الأهداف السنوية</h3><ul class="gfobj">${(d.objectives || []).map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div>
        <div><h3 class="sub-h">المؤشرات</h3><div class="gdk one">${(d.kpis || []).map(k => `<div class="gdkc"><div class="gdkh"><b>${esc(k.name)}</b>${k.auto ? `<span class="gdkv" data-auto="${esc(k.auto)}"><small>…</small></span>` : ''}</div><div class="gdkm"><span>المستهدف: <b>${esc(k.target || '')}</b></span><span>${esc(k.freq || '')}</span><span>${linkify(k.source || '')}</span></div></div>`).join('')}</div></div></div>
      ${(d.elements || []).length ? `<h3 class="sub-h">عناصر البرنامج</h3><ol class="gfel">${d.elements.map(e => `<li><b>${esc(e[0])}</b><span>${linkify(e[1] || '')}</span></li>`).join('')}</ol>` : ''}
      <h3 class="sub-h">أين تُنفَّذ الخطة</h3><div class="gflinks">${procs ? `<div><small>الإجراءات</small><ul>${procs}</ul></div>` : ''}${risks ? `<div><small>المخاطر من السجل</small><ul>${risks}</ul></div>` : ''}${cal ? `<div><small>التقويم السنوي</small><ul>${cal}</ul></div>` : ''}${comm ? `<div><small>اللجان</small><ul>${comm}</ul></div>` : ''}</div>
      ${(d.training || []).length ? `<details class="gdx"><summary>التدريب</summary><div class="gdxb"><ul class="gfpts">${d.training.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div></details>` : ''}
      ${(d.records || []).length ? `<details class="gdx"><summary>السجلات والوثائق</summary><div class="gdxb"><ul class="gfpts">${d.records.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div></details>` : ''}
      ${d.eval ? `<details class="gdx"><summary>التقييم السنوي للخطة</summary><div class="gdxb"><p>${linkify(d.eval)}</p></div></details>` : ''}</div>`; };
  const draw = () => {
    $$('.gfpc', b).forEach(x => x.classList.toggle('on', x.dataset.pc === cur.code));
    $('.gfpw', b).innerHTML = detail(cur); fillKpis($('.gfpw', b));
    if (isAdmin()) $$('.gfpw [data-fed]', b).forEach(x => x.onclick = () => editFrame('plan', G.F[x.dataset.fed], () => mountGov(b.closest('#main') || document.body, 'frame', 'plan', new URLSearchParams('h=' + cur.code))));
  };
  b.innerHTML = `<div class="gfplans">${items.map(p => `<button type="button" class="gfpc" data-pc="${p.code}" style="--c:#${uc(p.data.owner)}"><small>${esc(p.code)}</small><b>${esc(p.title)}</b><span class="gfpcm">${actor(p.data.owner)}${topRisk(p)}</span><small class="muted">${stat(p)}</small></button>`).join('')}</div><div class="gfpw"></div>`;
  $$('.gfpc', b).forEach(x => x.onclick = () => { cur = G.F[x.dataset.pc]; history.replaceState(null, '', `#/gov/frame/plan?h=${cur.code}`); draw(); if (innerWidth < 900) $('.gfpw', b).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  draw();
}
function fAuth(b, items) {
  const units = G.units.filter(u => u.kind !== 'ext');
  const draw = () => { const fq = ($('#faQ', b)?.value || '').trim(), fu = $('#faU', b)?.value || '';
    const rows = items.filter(r => (!fq || (r.title + ' ' + (r.data.limit || '')).includes(fq)) && (!fu || ['propose', 'review', 'approve'].some(k => (r.data[k] || []).includes(fu))));
    const grps = [...new Set(rows.map(r => r.grp))];
    $('.gfa-l', b).innerHTML = rows.length ? grps.map(g => `<h3 class="sub-h">${esc(g)}</h3><div class="tblwrap"><table class="gdt gfa"><thead><tr><th>القرار</th><th>يقترح</th><th>يراجع</th><th>يعتمد</th><th>الحد أو الشرط</th><th>المرجع</th></tr></thead><tbody>${rows.filter(r => r.grp === g).map(r => `<tr data-code="${r.code}"><td data-l="القرار"><small class="muted">${esc(r.code)}</small> ${esc(r.title)}${edBtn(r.code)}</td><td data-l="يقترح">${actors(r.data.propose)}</td><td data-l="يراجع">${actors(r.data.review)}</td><td data-l="يعتمد" class="gfap">${actors(r.data.approve)}</td><td data-l="الحد أو الشرط">${linkify(r.data.limit || '')}</td><td data-l="المرجع">${refs(r.data.ref)}</td></tr>`).join('')}</tbody></table></div>`).join('') : '<div class="empty-boq">لا قرارات مطابقة</div>';
    if (isAdmin()) $$('.gfa-l [data-fed]', b).forEach(x => x.onclick = () => editFrame('auth', G.F[x.dataset.fed], () => mountGov(b.closest('#main') || document.body, 'frame', 'auth'))); };
  b.innerHTML = `<div class="gffil noprint"><input id="faQ" placeholder="ابحث عن قرار…"><select id="faU"><option value="">كل الأقسام</option>${units.map(u => `<option value="${u.code}">صلاحيات: ${esc(u.short)}</option>`).join('')}</select></div><div class="gfa-l"></div>`;
  $('#faQ', b).oninput = draw; $('#faU', b).onchange = draw; draw();
}
function fComm(b, items) {
  b.innerHTML = `<div class="gfcomm">${items.map(c => { const d = c.data; return `<details class="gfc" data-code="${c.code}"><summary><div class="gfch"><b>${esc(c.code)}</b><span class="badge">${esc(c.grp)}</span>${edBtn(c.code)}</div><h3>${esc(c.title)}</h3><p>${linkify(d.purpose || '')}</p><div class="gfck"><span><small>الرئيس</small>${actor(d.chair)}</span><span><small>الانعقاد</small><b>${esc(d.freq || '')}</b></span></div></summary>
    <div class="gfcb"><div class="gfck"><span><small>المقرر</small>${actor(d.secretary)}</span><span><small>النصاب</small><b>${esc(d.quorum || '')}</b></span><span><small>ترفع إلى</small><b>${esc(d.reports_to || '')}</b></span></div>
    <div class="gfcm"><small>الأعضاء</small><div>${actors(d.members)}</div></div>
    ${(d.duties || []).length ? `<div><small>المهام</small><ul>${d.duties.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div>` : ''}
    ${(d.outputs || []).length ? `<div><small>المخرجات</small><ul>${d.outputs.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div>` : ''}
    ${d.procs ? `<div class="gfcp"><small>الإجراءات</small> ${refs(d.procs)}</div>` : ''}</div></details>`; }).join('')}</div>`;
  if (isAdmin()) $$('[data-fed]', b).forEach(x => x.onclick = e => { e.preventDefault(); editFrame('comm', G.F[x.dataset.fed], () => mountGov(b.closest('#main') || document.body, 'frame', 'comm')); });
}
function fCal(b, items) {
  const now = new Date().getMonth() + 1; let m = now;
  const grps = [...new Set(items.map(r => r.grp))];
  const list = () => { const rows = items.filter(r => (r.data.months || []).includes(m));
    $$('.gfmon button', b).forEach(x => x.classList.toggle('on', +x.dataset.m === m)); $$('.gfyr [data-mc]', b).forEach(x => x.classList.toggle('cur', +x.dataset.mc === m));
    $('.gfml', b).innerHTML = `<h3 class="sub-h">${MONTHS[m - 1]}${m === now ? ' <span class="badge info">الشهر الحالي</span>' : ''} <span class="muted small">— ${rows.length} نشاط</span></h3><div class="gfacts">${rows.map(r => `<div class="gfact" data-code="${r.code}" style="--c:#${uc(r.data.owner)}"><div class="gfah">${actor(r.data.owner)}<span class="badge">${esc(r.data.freq || '')}</span>${edBtn(r.code)}</div><b>${esc(r.title)}</b>${r.data.note ? `<small class="muted">${esc(r.data.note)}</small>` : ''}${r.data.ref ? `<div class="gfref">${refs(r.data.ref)}</div>` : ''}</div>`).join('')}</div>`;
    if (isAdmin()) $$('.gfml [data-fed]', b).forEach(x => x.onclick = () => editFrame('cal', G.F[x.dataset.fed], () => mountGov(b.closest('#main') || document.body, 'frame', 'cal'))); };
  b.innerHTML = `<div class="gfmon noprint">${MONTHS.map((n, i) => `<button type="button" data-m="${i + 1}" class="${i + 1 === now ? 'now' : ''}">${n}<small>${items.filter(r => (r.data.months || []).includes(i + 1)).length}</small></button>`).join('')}</div><div class="gfml"></div>
    <h3 class="sub-h mt12">الخريطة السنوية</h3><div class="tblwrap"><table class="gdt gfyr"><thead><tr><th>النشاط</th>${MONTHS.map((n, i) => `<th data-mc="${i + 1}">${n.slice(0, 3)}</th>`).join('')}</tr></thead><tbody>${grps.map(g => `<tr class="gfg"><td colspan="13">${esc(g)}</td></tr>${items.filter(r => r.grp === g).map(r => `<tr><td>${esc(r.title)}</td>${MONTHS.map((n, i) => `<td data-mc="${i + 1}">${(r.data.months || []).includes(i + 1) ? `<i style="--c:#${uc(r.data.owner)}"></i>` : ''}</td>`).join('')}</tr>`).join('')}`).join('')}</tbody></table></div>`;
  $$('.gfmon button', b).forEach(x => x.onclick = () => { m = +x.dataset.m; list(); });
  $$('.gfyr th[data-mc]', b).forEach(x => x.onclick = () => { m = +x.dataset.mc; list(); });
  list();
}
function fRisk(b, items) {
  let cell = null;
  const sc = r => (r.data.l || 1) * (r.data.i || 1);
  const draw = () => { const rows = items.filter(r => !cell || (r.data.l === cell[0] && r.data.i === cell[1])).sort((a, c) => sc(c) - sc(a));
    $$('.gfhm [data-c]', b).forEach(x => x.classList.toggle('on', !!cell && x.dataset.c === cell.join('-')));
    $('.gfrl', b).innerHTML = `${cell ? `<p class="small">المعروض: احتمال ${cell[0]} × أثر ${cell[1]} <button class="btn sm ghost" id="rkAll">عرض الكل</button></p>` : ''}${rows.map(r => { const s = sc(r), [lv, ln] = riskLvl(s), d = r.data; return `<details class="gfr" data-code="${r.code}"><summary><span class="gfrs ${lv}"><b>${s}</b><small>${ln}</small></span><div class="gfrt"><div class="gfah"><small class="muted">${esc(r.code)} · ${esc(r.grp)}</small>${actor(d.owner)}${edBtn(r.code)}</div><b>${esc(r.title)}</b><small class="muted">احتمال ${d.l} × أثر ${d.i}</small></div></summary>
      <div class="gfrb"><p><b>السبب:</b> ${linkify(d.cause || '')}</p><p><b>الأثر:</b> ${linkify(d.effect || '')}</p>${(d.controls || []).length ? `<div><b>الضوابط القائمة</b><ul>${d.controls.map(x => `<li>${linkify(x)}</li>`).join('')}</ul></div>` : ''}${d.plan && d.plan !== '—' ? `<p class="gfplan"><b>خطة المعالجة:</b> ${linkify(d.plan)}</p>` : ''}${d.ref ? `<p class="gfref">${refs(d.ref)}</p>` : ''}</div></details>`; }).join('')}`;
    $('#rkAll', b) && ($('#rkAll', b).onclick = () => { cell = null; draw(); });
    if (isAdmin()) $$('.gfrl [data-fed]', b).forEach(x => x.onclick = e => { e.preventDefault(); editFrame('risk', G.F[x.dataset.fed], () => mountGov(b.closest('#main') || document.body, 'frame', 'risk')); }); };
  const cnt = (l, i) => items.filter(r => r.data.l === l && r.data.i === i).length;
  const lvCount = k => items.filter(r => riskLvl(sc(r))[0] === k).length;
  b.innerHTML = `<div class="gfrisk"><div class="gfhmw"><div class="gfhm">${[5, 4, 3, 2, 1].map(l => `<span class="ax">${l}</span>${[1, 2, 3, 4, 5].map(i => { const n = cnt(l, i); return `<button type="button" data-c="${l}-${i}" class="${riskLvl(l * i)[0]}" ${n ? '' : 'disabled'}>${n || ''}</button>`; }).join('')}`).join('')}<span></span>${[1, 2, 3, 4, 5].map(i => `<span class="ax">${i}</span>`).join('')}</div><div class="gfhmx"><span>↑ الاحتمال</span><span>الأثر →</span></div></div>
    <div class="gfsum">${[['crit', 'حرج'], ['high', 'مرتفع'], ['med', 'متوسط'], ['low', 'منخفض']].map(([k, l]) => `<div class="gfrs ${k}"><b>${lvCount(k)}</b><small>${l}</small></div>`).join('')}</div></div><div class="gfrl"></div>`;
  $$('.gfhm [data-c]', b).forEach(x => x.onclick = () => { const c = x.dataset.c.split('-').map(Number); cell = cell && cell.join('-') === x.dataset.c ? null : c; draw(); });
  draw();
}

// ---------- القواعد الحاكمة
function viewRules(t, code) {
  const themes = [...new Set(G.rules.map(r => r.theme))];
  t.innerHTML = `<div class="toolbar"><p class="muted small m0">قواعد قصيرة تحسم «متى يدخل كل قسم» و«من يقرر»، وكل قاعدة تحيل إلى إجرائها. القيم المالية والزمنية المقترحة تحتاج اعتماداً.</p><span class="sp"></span>${isAdmin() ? '<button class="btn sm primary" id="rNew">＋ قاعدة</button>' : ''}</div>
    ${themes.map(th => `<h2 class="gh2">${esc(th)}</h2><div class="grules">${G.rules.filter(r => r.theme === th && r.active !== false).map(r => `<div class="grule ${code === r.code ? 'hl' : ''}" id="rule-${r.code}" style="--c:#${uc(r.owner)}"><div class="grh"><b>${esc(r.code)}</b> ${chip(r.owner)}${r.process_code ? refLink(r.process_code) : ''}${isAdmin() ? `<button class="btn sm ghost" data-red="${r.code}">تعديل</button>` : ''}</div><h3>${esc(r.title)}</h3><p>${linkify(r.statement)}</p>${(r.criteria || []).length ? `<ul>${r.criteria.map(c => `<li>${linkify(c)}</li>`).join('')}</ul>` : ''}${r.note ? `<small class="muted">${esc(r.note)}</small>` : ''}</div>`).join('')}</div>`).join('')}`;
  if (code) $('#rule-' + code, t)?.scrollIntoView({ block: 'center' });
  if (isAdmin()) { const re = r => editRow('gov_rules', r, [['code', 'الكود', 'text'], ['title', 'العنوان', 'text'], ['theme', 'المحور', 'text'], ['statement', 'نص القاعدة', 'textarea'], ['criteria', 'المعايير (سطر لكل معيار)', 'lines'], ['owner', 'القسم المالك', 'select', G.units.map(u => [u.code, u.short])], ['process_code', 'الإجراء المرتبط', 'text'], ['note', 'ملاحظة', 'text'], ['sort', 'الترتيب', 'number']], () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'rules')), 'code'); $('#rNew', t).onclick = () => re(null); $$('[data-red]', t).forEach(b => b.onclick = () => re(G.R[b.dataset.red])); }
}

// ---------- محرر صفوف عام (نماذج بسيطة لكل الجداول)
function editRow(table, row, fields, done, pk = 'id', extra = {}) {
  const val = (k, type) => { const v = row?.[k]; if (type === 'lines') return (v || []).join('\n'); if (type === 'list') return (v || []).join(', '); if (type === 'json') return JSON.stringify(v ?? [], null, 1); return v ?? ''; };
  modal(`<form id="f" class="pgrid">${fields.map(([k, lbl, type, opts]) => field(lbl, type === 'textarea' || type === 'lines' || type === 'json' ? `<textarea name="${k}" rows="${type === 'json' ? 8 : 3}" ${type === 'json' ? 'dir="ltr"' : ''}>${esc(val(k, type))}</textarea>` : type === 'select' ? sel(k, opts, val(k)) : inp(k, val(k, type), type === 'number' ? 'type="number"' : (k === pk && row ? 'readonly' : '')), type === 'text' && k !== 'code' && k !== 'sort' && k !== 'color' ? 'wide' : (['textarea', 'lines', 'json'].includes(type) ? 'wide' : ''))).join('')}<div class="btnrow end wide">${row ? '<button type="button" class="btn ghost" id="eDel" style="color:#A6503B">حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: row ? 'تعديل' : 'إضافة', wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const out = { ...extra };
      for (const [k, , type] of fields) { let v = f[k]; if (type === 'number') v = Number(v) || 0; else if (type === 'lines') v = String(v).split('\n').map(x => x.trim()).filter(Boolean); else if (type === 'list') v = String(v).split(/[,،]/).map(x => x.trim()).filter(Boolean); else if (type === 'json') { try { v = JSON.parse(v); } catch (er) { return toast('JSON غير صالح', 'bad'); } } else v = String(v).trim(); out[k] = v; }
      try { if (row) { const key = row[pk]; delete out[pk]; await q(sb.from(table).update(out).eq(pk, key)); } else await q(sb.from(table).insert(out)); close(); toast('حُفظ'); await load(true); done(); } catch (er) { err(er); } };
    $('#eDel', w) && ($('#eDel', w).onclick = async () => { if (!await confirm('حذف هذا العنصر؟', 'حذف', true)) return; await q(sb.from(table).delete().eq(pk, row[pk])); close(); await load(true); done(); });
  } });
}
