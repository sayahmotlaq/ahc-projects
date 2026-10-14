// ===== الحوكمة: إدارة الخدمات الفنية بأقسامها — الهيكل والعلاقات، موجّه الطلبات، مصفوفة الصلاحيات، الإجراءات، القواعد، أسئلة «كيف» =====
import { sb, q, session, isAdmin } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, ico, dateAr } from './ui.js';

const CODES = { A: ['يعتمد', 'A'], R: ['ينفّذ', 'R'], V: ['يراجع', 'V'], C: ['يُستشار', 'C'], I: ['يُبلَّغ', 'I'] };
const ROLES_PRJ = { EXEC: 'الإدارة التنفيذية', DIR: 'مدير الإدارة', HEAD: 'رئيس القسم', ENG: 'مهندس المشروع', CLERK: 'المنسق الإداري' };
const TABS = [['start', 'ابدأ من هنا'], ['map', 'الهيكل والعلاقات'], ['router', 'موجّه الطلبات'], ['matrix', 'مصفوفة الصلاحيات'], ['sop', 'الإجراءات'], ['rules', 'القواعد الحاكمة']];
let G = null;
async function load(force) {
  if (G && !force) return G;
  const [units, handoffs, rules, acts, procs, router, faq] = await Promise.all([
    q(sb.from('gov_units').select('*').order('sort')), q(sb.from('gov_handoffs').select('*').order('sort')), q(sb.from('gov_rules').select('*').order('sort')),
    q(sb.from('gov_activities').select('*').order('sort')), q(sb.from('gov_processes').select('*').order('sort')), q(sb.from('gov_router').select('*').order('sort')), q(sb.from('gov_faq').select('*').order('sort'))]);
  G = { units, handoffs, rules, acts, procs, router, faq, U: Object.fromEntries(units.map(u => [u.code, u])), P: Object.fromEntries(procs.map(p => [p.code, p])), R: Object.fromEntries(rules.map(r => [r.code, r])) };
  return G;
}
const un = c => G.U[c]?.short || c, uc = c => G.U[c]?.color || '6B7A88';
const chip = c => c ? `<span class="uchip" style="--c:#${uc(c)}">${esc(un(c))}</span>` : '';
const refLink = code => /^G-|^P-/.test(code) ? `<a class="gref" href="#/gov/sop/${code}">${esc(code)}</a>` : /^R-/.test(code) ? `<a class="gref" href="#/gov/rules/${code}">${esc(code)}</a>` : esc(code);

export async function mountGov(root, tab = 'start', id = null, params) {
  await load();
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الحوكمة</h1><span class="muted small">إدارة الخدمات الفنية — من يفعل ماذا ومتى</span><span class="sp"></span>${isAdmin() ? '<span class="badge skel">التعديل متاح لمدير النظام بالنقر على العناصر</span>' : ''}</div>
    <div class="tabs gtabs">${TABS.map(([k, t]) => `<a href="#/gov/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="gtab"></div>`;
  const t = $('#gtab', root);
  if (tab === 'map') viewMap(t); else if (tab === 'router') viewRouter(t); else if (tab === 'matrix') viewMatrix(t, params); else if (tab === 'sop') (id ? viewProc(t, id) : viewSops(t)); else if (tab === 'rules') viewRules(t, id); else viewStart(t);
}

// ---------- ابدأ من هنا: المبادئ + أسئلة كيف
function viewStart(t) {
  const vals = [['التعاون', 'الاحتياج لا يملكه قسم؛ من يستطيع البدء يبدأ ثم يُسوّى الاختصاص.'], ['المرونة', 'القواعد تخدم المريض والتشغيل لا العكس؛ الاستثناء يُسجَّل ويُراجع ولا يُمنع.'], ['الوضوح', 'لكل احتياج قناة واحدة، وقسم مسؤول، ومهلة معلومة، وموعد تسليم.'], ['المسؤولية', 'ما يُستلم يُسجَّل، وما يُسجَّل يُتابع، وما يُتابع يُغلق بمحضر.']];
  const units = G.units.filter(u => u.kind === 'unit');
  t.innerHTML = `<div class="gstart">
    <div class="ghero"><div><h2>كيف تعمل إدارة الخدمات الفنية معاً؟</h2><p>سبعة أقسام تخدم المنشآت نفسها. هذه الصفحة تجيب عن «متى يدخل كل قسم، وكيف ينتقل العمل بينها، ومن يعتمد ماذا» بطريقة يمكن الرجوع إليها في ثوانٍ.</p><div class="btnrow"><a class="btn primary" href="#/gov/router">عندي احتياج… لمن أوجهه؟</a><a class="btn" href="#/gov/map">خريطة العلاقات</a><a class="btn" href="#/gov/matrix">من يعتمد ماذا</a></div></div>
      <div class="gvals">${vals.map(([h, d]) => `<div><b>${h}</b><span>${d}</span></div>`).join('')}</div></div>
    <div class="gunits">${units.map(u => `<a class="gunit" href="#/gov/map?u=${u.code}" style="--c:#${u.color}"><i></i><b>${esc(u.short)}</b><small>${esc(u.mission)}</small></a>`).join('')}</div>
    <h2 class="gh2">أسئلة «كيف…؟» <span class="muted small">— كل إجابة تقود إلى إجرائها أو قاعدتها</span>${isAdmin() ? '<button class="btn sm" id="faqNew">＋ سؤال</button>' : ''}</h2>
    <div class="gfaq">${G.faq.map(f => `<details class="gq" data-faq="${f.id}"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p><div class="glinks">${(f.links || []).map(refLink).join(' ')}${f.action === 'router' ? '<a class="btn sm" href="#/gov/router">جرّب الموجّه</a>' : f.action === 'matrix' ? '<a class="btn sm" href="#/gov/matrix">افتح المصفوفة</a>' : ''}${isAdmin() ? `<button class="btn sm ghost" data-faqed="${f.id}">تعديل</button>` : ''}</div></details>`).join('')}</div></div>`;
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
  const render = key => { const n = nodes[key]; if (!n) return; const crumbs = path.map((p, i) => `<span class="gcrumb">${esc(p.a)}</span>`).join('<span class="muted">›</span>');
    t.innerHTML = `<div class="grouter"><div class="grq"><div class="muted small">${crumbs || 'ثلاث خطوات على الأكثر'}</div><h2>${esc(n.q)}</h2><div class="gopts">${n.opts.map((o, i) => `<button class="gopt" data-i="${i}">${esc(o.t)}</button>`).join('')}</div>${path.length ? '<button class="btn sm ghost" id="rBack">رجوع</button>' : ''}</div>${isAdmin() ? `<p class="small muted">مدير النظام: <button class="btn sm" id="rEdit">تعديل هذه الخطوة (JSON)</button></p>` : ''}</div>`;
    $$('.gopt', t).forEach(b => b.onclick = () => { const o = n.opts[+b.dataset.i]; path.push({ q: n.q, a: o.t }); if (o.next) render(o.next); else outcome(o.out); });
    $('#rBack', t) && ($('#rBack', t).onclick = () => { path.pop(); render(path.length ? nodes[pathKey()] : 'start'); });
    $('#rEdit', t) && ($('#rEdit', t).onclick = () => editRow('gov_router', n, [['q', 'السؤال', 'text'], ['opts', 'الخيارات (JSON)', 'json']], () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'router')), 'key'));
  };
  const pathKey = () => { let k = 'start'; for (const p of path) { const n = nodes[k]; const o = n.opts.find(x => x.t === p.a); if (!o || !o.next) break; k = o.next; } return k; };
  const outcome = o => { const u = G.U[o.unit], p = G.P[o.proc]; t.innerHTML = `<div class="grouter"><div class="gres" style="--c:#${u?.color || '6B7A88'}"><div class="muted small">${path.map(x => esc(x.a)).join(' › ')}</div><span class="uchip big" style="--c:#${u?.color || '6B7A88'}">${esc(u?.short || o.unit)}</span><h2>${esc(o.title)}</h2><p>${esc(o.text)}</p>${p ? `<div class="gresproc"><b>الإجراء:</b> <a href="#/gov/sop/${p.code}">${esc(p.code)} — ${esc(p.title)}</a><br><small class="muted">${esc(p.kpi)}</small></div>` : ''}<div class="btnrow mt10"><button class="btn" id="rAgain">سؤال آخر</button>${p ? `<a class="btn primary" href="#/gov/sop/${p.code}">افتح خطوات الإجراء</a>` : ''}</div></div></div>`; $('#rAgain', t).onclick = () => { path = []; render('start'); }; };
  render('start');
}

// ---------- مصفوفة الصلاحيات
function viewMatrix(t, params) {
  let scope = (params?.get?.('scope')) || 'units'; let fu = '';
  const render = () => { const cols = scope === 'units' ? ['EXEC', 'DIR', 'PRJ', 'FAC', 'MNT', 'BME', 'MED', 'GEN', 'IT'] : Object.keys(ROLES_PRJ); const name = c => scope === 'units' ? un(c) : ROLES_PRJ[c];
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
function viewSops(t) {
  const owners = [...new Set(G.procs.map(p => p.owner))];
  t.innerHTML = `<div class="toolbar"><input id="sq" placeholder="ابحث في الإجراءات…" style="min-width:260px"><span class="sp"></span>${isAdmin() ? '<button class="btn sm primary" id="pNew">＋ إجراء</button>' : ''}</div><div id="sl"></div>`;
  const render = () => { const s = ($('#sq', t).value || '').trim(); const ps = G.procs.filter(p => p.active !== false && (!s || (p.code + ' ' + p.title + ' ' + p.goal + ' ' + JSON.stringify(p.steps)).includes(s)));
    $('#sl', t).innerHTML = owners.map(o => { const list = ps.filter(p => p.owner === o); if (!list.length) return ''; return `<h2 class="gh2" style="--c:#${uc(o)}"><span class="uchip" style="--c:#${uc(o)}">${esc(un(o))}</span> <span class="muted small">${list.length} إجراء</span></h2><div class="gprocs">${list.map(p => `<a class="gproc" href="#/gov/sop/${p.code}" style="--c:#${uc(p.owner)}"><div class="gpc"><b>${esc(p.code)}</b><span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.goal)}</p><div class="gpu">${(p.units || []).map(chip).join('')}</div><small class="muted">${(p.steps || []).length} خطوة</small></a>`).join('')}</div>`; }).join('') || '<div class="empty-boq">لا نتائج</div>'; };
  $('#sq', t).oninput = render; render();
  $('#pNew', t) && ($('#pNew', t).onclick = () => editProc(null, () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'sop'))));
}
function viewProc(t, code) {
  const p = G.P[code]; if (!p) return t.innerHTML = '<div class="empty-boq">الإجراء غير موجود</div>';
  const lanes = [...new Set(p.steps.map(s => s.unit))];
  t.innerHTML = `<div class="toolbar"><a class="btn sm ghost" href="#/gov/sop">← الإجراءات</a><h2 class="m0">${esc(p.code)} — ${esc(p.title)}</h2><span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span><span class="sp"></span><button class="btn sm" onclick="print()">${ico('print')} طباعة</button>${isAdmin() ? `<button class="btn sm" id="pEd">تعديل</button>${p.status !== 'approved' ? '<button class="btn sm primary" id="pApp">اعتماد</button>' : ''}` : ''}</div>
    <div class="gpgrid"><div class="gkv"><span>المالك</span><b>${chip(p.owner)}</b></div><div class="gkv"><span>الأقسام المشاركة</span><b>${(p.units || []).map(chip).join('')}</b></div><div class="gkv wide"><span>الهدف</span><b>${esc(p.goal)}</b></div><div class="gkv"><span>متى يبدأ</span><b>${esc(p.trigger)}</b></div><div class="gkv"><span>المدخلات</span><b>${esc(p.inputs)}</b></div><div class="gkv"><span>المخرجات</span><b>${esc(p.outputs)}</b></div><div class="gkv"><span>مؤشر الأداء</span><b>${esc(p.kpi)}</b></div></div>
    <h3 class="sub-h">الخطوات <span class="muted small">— لون كل خطوة بلون القسم المسؤول عنها</span></h3>
    <div class="gswim"><div class="glanes">${lanes.map(u => `<div class="glane" style="--c:#${uc(u)}"><span>${esc(un(u))}</span></div>`).join('')}</div><div class="gsteps">${p.steps.map((s, i) => `<div class="gstep ${s.kind === 'decision' ? 'dec' : ''}" style="--c:#${uc(s.unit)};--lane:${lanes.indexOf(s.unit)}"><span class="gno">${i + 1}</span><div class="gsb"><div class="gsh">${chip(s.unit)}${s.role ? `<small class="muted">${esc(s.role)}</small>` : ''}${s.kind === 'decision' ? '<span class="badge ovr">قرار</span>' : ''}</div><p>${esc(s.action)}</p><div class="gsm">${s.sla ? `<span>⏱ ${esc(s.sla)}</span>` : ''}${s.where && s.where !== '—' ? `<span>📍 ${esc(s.where)}</span>` : ''}</div></div></div>`).join('')}</div></div>
    ${p.notes ? `<div class="notice mt12"><b>ملاحظات:</b> ${esc(p.notes)}</div>` : ''}
    <p class="muted small mt12">${p.approved_by ? `اعتُمد بواسطة ${esc(p.approved_by)} في ${dateAr(p.approved_at)}` : 'مسودة بانتظار الاعتماد'} · آخر تحديث ${dateAr(p.updated_at)}</p>`;
  $('#pEd', t) && ($('#pEd', t).onclick = () => editProc(p, () => load(true).then(() => mountGov(t.closest('#main') || document.body, 'sop', code))));
  $('#pApp', t) && ($('#pApp', t).onclick = async () => { if (!await confirm('اعتماد هذا الإجراء بإصداره الحالي؟', 'اعتماد')) return; await q(sb.from('gov_processes').update({ status: 'approved', approved_by: session.profile?.full_name || '', approved_at: new Date().toISOString().slice(0, 10) }).eq('code', code)); toast('اعتُمد'); await load(true); mountGov(t.closest('#main') || document.body, 'sop', code); });
}
function editProc(p, done) {
  const opts = G.units.map(u => [u.code, u.short]); const v = p || { code: '', title: '', owner: 'PRJ', units: [], goal: '', trigger: '', inputs: '', outputs: '', kpi: '', steps: [], notes: '', version: '1.0' };
  const stepRow = (s = {}, i) => `<div class="gserow" data-i="${i}"><select name="s_unit">${opts.map(([c, n]) => `<option value="${c}" ${s.unit === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><input name="s_action" placeholder="الإجراء" value="${esc(s.action || '')}"><input name="s_sla" placeholder="المهلة" value="${esc(s.sla || '')}" style="max-width:120px"><input name="s_where" placeholder="أين (شاشة/نموذج)" value="${esc(s.where || '')}" style="max-width:150px"><label class="chk"><input type="checkbox" name="s_dec" ${s.kind === 'decision' ? 'checked' : ''}> قرار</label><button type="button" class="btn sm ghost" data-rm>✕</button></div>`;
  modal(`<form id="f" class="pgrid">${field('الكود', inp('code', v.code, p ? 'readonly' : 'required placeholder="G-13"'))}${field('الإصدار', inp('version', v.version || '1.0'))}${field('العنوان', inp('title', v.title, 'required'), 'wide')}${field('المالك', sel('owner', opts, v.owner))}${field('الأقسام المشاركة', `<div class="chips">${opts.map(([c, n]) => `<label class="chip"><input type="checkbox" name="u_${c}" ${(v.units || []).includes(c) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`, 'wide')}${field('الهدف', `<textarea name="goal" rows="2">${esc(v.goal)}</textarea>`, 'wide')}${field('متى يبدأ', inp('trigger', v.trigger), 'wide')}${field('المدخلات', inp('inputs', v.inputs))}${field('المخرجات', inp('outputs', v.outputs))}${field('مؤشر الأداء', inp('kpi', v.kpi), 'wide')}<div class="fld wide"><span>الخطوات</span><div id="gse">${(v.steps || []).map(stepRow).join('')}</div><button type="button" class="btn sm" id="sAdd">＋ خطوة</button></div>${field('ملاحظات', `<textarea name="notes" rows="2">${esc(v.notes)}</textarea>`, 'wide')}<div class="btnrow end wide">${p ? '<button type="button" class="btn ghost" id="pDel" style="color:#A6503B">حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: p ? 'تعديل إجراء' : 'إجراء جديد', wide: true, onOpen: (w, close) => {
    const box = $('#gse', w); const bindRm = () => $$('[data-rm]', box).forEach(b => b.onclick = () => b.closest('.gserow').remove()); bindRm();
    $('#sAdd', w).onclick = () => { box.insertAdjacentHTML('beforeend', stepRow({}, box.children.length)); bindRm(); };
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const steps = $$('.gserow', box).map(r => ({ unit: $('[name=s_unit]', r).value, action: $('[name=s_action]', r).value.trim(), sla: $('[name=s_sla]', r).value.trim(), where: $('[name=s_where]', r).value.trim(), kind: $('[name=s_dec]', r).checked ? 'decision' : 'step' })).filter(s => s.action);
      const row = { title: f.title.trim(), version: f.version.trim(), owner: f.owner, units: opts.map(([c]) => c).filter(c => f['u_' + c]), goal: f.goal.trim(), trigger: f.trigger.trim(), inputs: f.inputs.trim(), outputs: f.outputs.trim(), kpi: f.kpi.trim(), steps, notes: f.notes.trim(), updated_at: new Date().toISOString() };
      try { if (p) await q(sb.from('gov_processes').update(row).eq('code', p.code)); else await q(sb.from('gov_processes').insert({ ...row, code: f.code.trim(), sort: 50 })); close(); toast('حُفظ'); done(); } catch (er) { err(er); } };
    $('#pDel', w) && ($('#pDel', w).onclick = async () => { if (!await confirm('حذف الإجراء؟', 'حذف', true)) return; await q(sb.from('gov_processes').delete().eq('code', p.code)); close(); done(); });
  } });
}

// ---------- القواعد الحاكمة
function viewRules(t, code) {
  const themes = [...new Set(G.rules.map(r => r.theme))];
  t.innerHTML = `<div class="toolbar"><p class="muted small m0">قواعد قصيرة تحسم «متى يدخل كل قسم» و«من يقرر»، وكل قاعدة تحيل إلى إجرائها. القيم المالية والزمنية المقترحة تحتاج اعتماداً.</p><span class="sp"></span>${isAdmin() ? '<button class="btn sm primary" id="rNew">＋ قاعدة</button>' : ''}</div>
    ${themes.map(th => `<h2 class="gh2">${esc(th)}</h2><div class="grules">${G.rules.filter(r => r.theme === th && r.active !== false).map(r => `<div class="grule ${code === r.code ? 'hl' : ''}" id="rule-${r.code}" style="--c:#${uc(r.owner)}"><div class="grh"><b>${esc(r.code)}</b> ${chip(r.owner)}${r.process_code ? refLink(r.process_code) : ''}${isAdmin() ? `<button class="btn sm ghost" data-red="${r.code}">تعديل</button>` : ''}</div><h3>${esc(r.title)}</h3><p>${esc(r.statement)}</p>${(r.criteria || []).length ? `<ul>${r.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}${r.note ? `<small class="muted">${esc(r.note)}</small>` : ''}</div>`).join('')}</div>`).join('')}`;
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
