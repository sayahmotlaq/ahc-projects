// ===== إدارة الخدمات الفنية: لوحة الإدارة (كل الأقسام في شاشة) وصفحة كل قسم (لوحته، أعماله، دليله، فريقه) =====
import { sb, q, session, isAdmin, role, canRead } from './api.js';
import { $, $$, esc, toast, err, modal, field, sel, formData, dateAr } from './ui.js';
import { O, loadOps, ST, PR, OPEN, isOpen, isLate, itemRow, bindRows, listView, newItem, openItem, uchip, uname, ucolor, pname, staffOf, dur, canFile } from './ops.js';

const MAN_PREFIX = { PRJ: 'P', FAC: 'F', MNT: 'M', SAF: 'H', BME: 'B', MED: 'E', GEN: 'S', IT: 'T' };
const month = () => new Date().toISOString().slice(0, 7);
const units = () => O.G.units.filter(u => u.kind === 'unit' && u.active !== false);
function stats(list) {
  const open = list.filter(isOpen), m = month();
  const doneM = list.filter(i => i.status === 'done' && (i.closed_at || '').slice(0, 7) === m);
  const tt = doneM.map(i => new Date(i.resolved_at || i.closed_at) - new Date(i.created_at)).filter(x => x > 0);
  const inSla = doneM.filter(i => !i.due_at || new Date(i.resolved_at || i.closed_at) <= new Date(i.due_at)).length;
  const rated = list.filter(i => i.rating);
  return { open: open.length, late: open.filter(isLate).length, fresh: open.filter(i => i.status === 'new').length, urgent: open.filter(i => ['p1', 'p2'].includes(i.priority)).length,
    doneM: doneM.length, avg: tt.length ? tt.reduce((a, b) => a + b, 0) / tt.length : null, sla: doneM.length ? Math.round(inSla / doneM.length * 100) : null,
    rating: rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1) : null, verify: open.filter(i => i.status === 'verify').length };
}
const kpi = (cls, big, lbl, sub = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="fmk ${cls}"><b>${big}</b><span>${lbl}</span>${sub ? `<small>${sub}</small>` : ''}</${href ? 'a' : 'div'}>`;
// الإحالات الجارية بين الأقسام: عنصر ابن مفتوح في قسم يختلف عن قسم أبيه
function flows() {
  const m = {};
  O.items.filter(i => i.parent_id && isOpen(i)).forEach(i => { const p = O.I[i.parent_id]; if (!p || p.unit === i.unit) return; const k = p.unit + '>' + i.unit; (m[k] ||= { from: p.unit, to: i.unit, items: [] }).items.push(i); });
  return Object.values(m).sort((a, b) => b.items.length - a.items.length);
}
let FMS = null;
async function fmState() {
  if (FMS) return FMS;
  try { const [sys, latest] = await Promise.all([q(sb.from('fm_systems').select('code,name,owner,critical').eq('active', true)), q(sb.from('v_fm_latest').select('facility_id,system_code,status'))]);
    FMS = { sys, latest }; } catch (e) { FMS = { sys: [], latest: [] }; }
  return FMS;
}

// ---------- لوحة الإدارة (#/tsd)
export async function mountTSD(root) {
  await loadOps(); const fm = await fmState();
  const all = stats(O.items), us = units(), fl = flows();
  const recent = await q(sb.from('ops_log').select('*').order('id', { ascending: false }).limit(14)).catch(() => []);
  const urgent = O.items.filter(i => isOpen(i) && (i.priority === 'p1' || isLate(i))).sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 6);
  const bad = fm.latest.filter(l => ['down', 'partial'].includes(l.status));
  root.innerHTML = `<div class="tsdhero"><div><small>تجمع الأحساء الصحي</small><h1>إدارة الخدمات الفنية</h1><p>ثمانية أقسام تعمل كمنظومة واحدة: كل طلب يصل للقسم المختص، وكل إحالة بين الأقسام مرئية، وكل عمل يسير وفق دليل إجراءاته.</p>
      <div class="btnrow">${canFile() ? '<button class="btn primary" id="tNew">＋ بلاغ أو طلب</button>' : ''}<a class="btn" href="#/ops/list">كل الأعمال</a><a class="btn" href="#/gov">الحوكمة والأدلة</a></div></div>
      <div class="tsdk">${[[all.open, 'عمل مفتوح'], [all.late, 'متأخر عن مهلته', all.late ? 'r' : ''], [all.urgent, 'طارئ أو عاجل', all.urgent ? 'a' : ''], [all.doneM, 'أُنجز هذا الشهر', 'g'], [all.sla == null ? '—' : all.sla + '٪', 'ضمن المهلة'], [all.rating || '—', 'رضا أصحاب الطلبات']].map(([b, l, c]) => `<div class="${c || ''}"><b>${b}</b><span>${l}</span></div>`).join('')}</div></div>
    <div class="tsdunits">${us.map(u => { const s = stats(O.items.filter(i => i.unit === u.code)); const sysBad = bad.filter(l => fm.sys.find(x => x.code === l.system_code)?.owner === u.code).length;
      return `<a class="tsdu" href="#/dept/${u.code}" style="--c:#${u.color}"><div class="tsdu-h"><b>${esc(u.short)}</b>${u.head ? `<small>${esc(u.head)}</small>` : ''}</div>
        <div class="tsdu-n"><span><b>${s.open}</b>مفتوح</span><span class="${s.late ? 'r' : ''}"><b>${s.late}</b>متأخر</span><span><b>${s.doneM}</b>أُنجز</span></div>
        <div class="tsdu-f">${s.fresh ? `<i class="fresh">${s.fresh} جديد</i>` : ''}${s.urgent ? `<i class="urg">${s.urgent} عاجل</i>` : ''}${sysBad ? `<i class="sys">🏥 ${sysBad} نظام معطل</i>` : ''}${!s.fresh && !s.urgent && !sysBad ? '<i class="ok">مستقر</i>' : ''}</div></a>`; }).join('')}</div>
    <div class="fm2col">
      <div class="pcard"><h2>العمل بين الأقسام <a class="small" href="#/ops/list">الكل ‹</a></h2>${fl.length ? `<div class="oflows">${fl.map(x => `<button class="oflow" data-flow="${x.from}>${x.to}">${uchip(x.from)}<span class="arr">←</span>${uchip(x.to)}<b>${x.items.length}</b><small>${esc(x.items.slice(0, 2).map(i => i.title).join('، '))}</small></button>`).join('')}</div>` : '<p class="muted">لا إحالات جارية بين الأقسام الآن. عند إحالة جزء من عمل لقسم آخر يظهر المسار هنا.</p>'}
        ${(() => { const h = (O.G.handoffs || []).length; return h ? `<p class="muted small mt8">في الدليل ${h} نقطة تسليم معرّفة بين الأقسام — <a href="#/gov/map">خريطة العلاقات</a>.</p>` : ''; })()}</div>
      <div class="pcard"><h2>يحتاج انتباهك الآن</h2>${urgent.length ? `<div class="olist">${urgent.map(i => itemRow(i)).join('')}</div>` : '<p class="muted">لا أعمال طارئة أو متأخرة.</p>'}</div>
    </div>
    <div class="pcard"><h2>أحدث النشاط في الأقسام</h2>${recent.length ? `<div class="oact">${recent.map(l => { const i = O.I[l.item_id]; return `<button class="oact-i" data-oi="${l.item_id}"><span class="dot" style="--c:${i ? ucolor(i.unit) : '#999'}"></span><b>${esc(pname(l.by_user) || (l.kind === 'handoff' ? 'إحالة' : 'تحديث'))}</b><span>${esc(l.body.slice(0, 140))}</span><small>${esc(i?.ref || '')} · ${dateAr(l.at)}</small></button>`; }).join('')}</div>` : '<p class="muted">لا نشاط بعد.</p>'}</div>`;
  const re = () => mountTSD(root);
  $('#tNew', root) && ($('#tNew', root).onclick = () => newItem({}, r => openItem(r.id, re)));
  bindRows(root, re);
  $$('[data-flow]', root).forEach(b => b.onclick = () => { const [a, z] = b.dataset.flow.split('>'); const l = O.items.filter(i => i.unit === z && isOpen(i) && O.I[i.parent_id]?.unit === a);
    modal(`<div class="olist">${l.map(i => itemRow(i)).join('')}</div>`, { title: `إحالات ${uname(a)} ← ${uname(z)}`, wide: true, onOpen: (w, c) => $$('[data-oi]', w).forEach(x => x.onclick = () => { c(); openItem(+x.dataset.oi, re); }) }); });
}

// ---------- صفحة القسم (#/dept/<code>/<tab>)
export async function mountDept(root, code, tab = 'overview', params = new URLSearchParams()) {
  await loadOps();
  const u = O.G.U[code]; if (!u || u.kind !== 'unit') { root.innerHTML = '<div class="empty-boq">القسم غير موجود.</div>'; return; }
  const mine = O.items.filter(i => i.unit === code), s = stats(mine), kinds = O.kinds.filter(k => k.unit === code && k.active !== false);
  const team = O.people.filter(p => p.unit === code || (p.role === 'facility' && !p.unit && ['FAC', 'MNT', 'SAF'].includes(code)));
  const procs = O.G.procs.filter(p => p.code.startsWith((MAN_PREFIX[code] || '#') + '-')).sort((a, b) => a.code.localeCompare(b.code));
  const tabs = [['overview', 'نظرة عامة'], ['work', `الأعمال <b class="fmcnt ${s.late ? 'bad' : ''}">${s.open}</b>`], ['manual', `دليل القسم <b class="fmcnt">${procs.length}</b>`], ['team', `الفريق <b class="fmcnt">${team.length}</b>`]];
  root.innerHTML = `<div class="dhero" style="--c:#${u.color}"><div class="dhero-t"><small>إدارة الخدمات الفنية ‹ الأقسام</small><h1>${esc(u.name)}</h1><p>${esc(u.mission || '')}</p>${u.head ? `<span class="dhead">رئيس القسم: <b>${esc(u.head)}</b></span>` : ''}</div>
      <div class="dhero-a">${kinds.filter(k => k.intake).map(k => `<button class="btn ${staffOf(code) ? '' : 'primary'}" data-nk="${k.code}">${k.icon} ${esc(k.name)}</button>`).join('')}${code === 'PRJ' && canRead() ? '<a class="btn" href="#/dashboard">لوحة المشاريع</a><a class="btn" href="#/projects">المشاريع</a>' : ''}</div></div>
    <nav class="fmtabs">${tabs.map(([k, v]) => `<a href="#/dept/${code}/${k}" class="${tab === k ? 'on' : ''}">${v}</a>`).join('')}</nav><div id="dBody"></div>`;
  const re = () => mountDept(root, code, tab, params);
  $$('[data-nk]', root).forEach(b => b.onclick = () => newItem({ kind: b.dataset.nk }, r => openItem(r.id, re)));
  const t = $('#dBody', root);
  if (tab === 'work') return listView(t, mine, { params, showUnit: false, units: false, re });
  if (tab === 'manual') return viewManual(t, code, procs);
  if (tab === 'team') return viewTeam(t, code, team, mine, re);
  // نظرة عامة
  const fm = await fmState();
  const sys = fm.sys.filter(x => x.owner === code);
  const incoming = mine.filter(i => isOpen(i) && i.parent_id && O.I[i.parent_id] && O.I[i.parent_id].unit !== code);
  const outgoing = O.items.filter(i => isOpen(i) && i.parent_id && i.unit !== code && O.I[i.parent_id]?.unit === code);
  const attn = mine.filter(isOpen).sort((a, b) => isLate(b) - isLate(a) || (a.status === 'new') - (b.status === 'new') || a.priority.localeCompare(b.priority)).filter(i => isLate(i) || i.status === 'new' || ['p1', 'p2'].includes(i.priority)).slice(0, 6);
  const hand = (O.G.handoffs || []).filter(h => h.from_unit === code || h.to_unit === code);
  let prj = '';
  if (code === 'PRJ' && canRead()) { try { const ps = await q(sb.from('projects').select('id,stage').eq('archived', false)); const by = k => ps.filter(p => p.stage === k).length; prj = `<div class="pcard"><h2>المشاريع <a class="small" href="#/dashboard">لوحة المشاريع ‹</a></h2><div class="dmini">${[['دراسة', by('study') + by('request') + by('approval')], ['تصميم وطرح', by('design') + by('tender') + by('award')], ['تنفيذ', by('execution')], ['استلام وضمان', by('handover') + by('warranty')]].map(([a, b]) => `<a href="#/projects"><b>${b}</b><span>${a}</span></a>`).join('')}</div></div>`; } catch (e) { } }
  t.innerHTML = `<div class="fmkpis dk">
      ${kpi('blue', s.open, 'عمل مفتوح', `${s.fresh} جديد · ${s.verify} بانتظار التأكيد`, `#/dept/${code}/work`)}
      ${kpi(s.late ? 'red' : 'green', s.late, 'متأخر عن مهلته', s.late ? 'يحتاج تدخلاً' : 'كل الأعمال في مهلتها', `#/dept/${code}/work?late=1`)}
      ${kpi(s.urgent ? 'amber' : '', s.urgent, 'طارئ أو عاجل')}
      ${kpi('green', s.doneM, 'أُنجز هذا الشهر', s.avg ? 'متوسط الإنجاز ' + dur(s.avg) : '')}
      ${kpi('', s.sla == null ? '—' : s.sla + '٪', 'ضمن المهلة', 'من أعمال هذا الشهر المنجزة')}
      ${kpi('', s.rating ? s.rating + ' ★' : '—', 'رضا أصحاب الطلبات')}</div>
    <div class="fm2col">
      <div class="pcard"><h2>يحتاج انتباهاً <a class="small" href="#/dept/${code}/work">كل الأعمال ‹</a></h2>${attn.length ? `<div class="olist">${attn.map(i => itemRow(i, { showUnit: false })).join('')}</div>` : '<p class="muted">لا أعمال متأخرة أو جديدة أو عاجلة.</p>'}</div>
      <div class="pcard"><h2>بين الأقسام</h2>
        <h3 class="sub-h m0">وارد إلينا من أقسام أخرى (${incoming.length})</h3>${incoming.length ? `<div class="olist">${incoming.slice(0, 5).map(i => itemRow(i, { showUnit: false })).join('')}</div>` : '<p class="muted small">لا شيء.</p>'}
        <h3 class="sub-h">صادر منا وننتظره (${outgoing.length})</h3>${outgoing.length ? `<div class="olist">${outgoing.slice(0, 5).map(i => itemRow(i)).join('')}</div>` : '<p class="muted small">لا شيء.</p>'}</div>
    </div>
    ${prj}
    ${sys.length ? `<div class="pcard"><h2>الأنظمة التي يملكها القسم <a class="small" href="#/fm">متابعة الأنظمة ‹</a></h2><div class="dsys">${sys.map(x => { const L = fm.latest.filter(l => l.system_code === x.code); const b = L.filter(l => ['down', 'partial'].includes(l.status)).length, a = L.filter(l => l.status === 'attention').length, g = L.filter(l => l.status === 'good').length;
        return `<a href="#/fm/dash" class="${b ? 'r' : a ? 'a' : 'g'}"><b>${esc(x.name)}${x.critical ? ' <i title="نظام حرج">●</i>' : ''}</b><span>${g} سليم${a ? ` · ${a} متابعة` : ''}${b ? ` · <em>${b} معطل</em>` : ''}</span></a>`; }).join('')}</div></div>` : ''}
    ${hand.length ? `<div class="pcard"><h2>نقاط التسليم في الدليل</h2><div class="dhand">${hand.map(h => `<div>${uchip(h.from_unit)}<span class="arr">←</span>${uchip(h.to_unit)}<span><b>${esc(h.trigger)}</b><small>${esc(h.deliverable || '')}${h.sla ? ' · ' + esc(h.sla) : ''}</small></span>${h.process_code ? `<a class="gref" data-peek="${esc(h.process_code)}" href="#/gov/sop/${esc(h.process_code)}">${esc(h.process_code)}</a>` : ''}</div>`).join('')}</div></div>` : ''}`;
  bindRows(t, re);
}

function viewManual(t, code, procs) {
  const shared = O.G.procs.filter(p => p.code.startsWith('G-') && ((p.owner === code) || (p.units || []).includes(code) || (p.steps || []).some(s => s.unit === code)));
  const rules = (O.G.rules || []).filter(r => r.owner === code);
  const card = p => `<a class="gproc" href="#/gov/sop/${p.code}" data-peek="${p.code}" style="--c:${ucolor(p.owner)}"><div class="gpc"><b>${esc(p.code)}</b><span class="badge ${p.status === 'approved' ? 'full' : 'skel'}">${p.status === 'approved' ? 'معتمد' : 'مسودة'} v${esc(p.version || '1.0')}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.goal || '')}</p><small class="muted">${(p.steps || []).length} خطوة</small></a>`;
  t.innerHTML = `<div class="pcard"><h2>دليل إجراءات ${esc(uname(code))} <a class="small" href="#/gov/sops">كل الأدلة ‹</a></h2>${procs.length ? `<div class="gprocs">${procs.map(card).join('')}</div>` : '<p class="muted">لم يُعدّ دليل هذا القسم بعد.</p>'}</div>
    <div class="pcard"><h2>إجراءات مشتركة يشارك فيها القسم</h2>${shared.length ? `<div class="gprocs">${shared.map(card).join('')}</div>` : '<p class="muted">—</p>'}</div>
    ${rules.length ? `<div class="pcard"><h2>القواعد الحاكمة التي يملكها القسم</h2><div class="drules">${rules.map(r => `<a class="gref" data-peek="${r.code}" href="#/gov/rules/${r.code}"><b>${esc(r.code)}</b> ${esc(r.title)}</a>`).join('')}</div></div>` : ''}`;
}

function viewTeam(t, code, team, mine, re) {
  t.innerHTML = `<div class="pcard"><h2>فريق ${esc(uname(code))}</h2>${team.length ? `<div class="dteam">${team.map(p => { const a = mine.filter(i => i.assignee_id === p.id && isOpen(i)), l = a.filter(isLate).length, d = mine.filter(i => i.assignee_id === p.id && i.status === 'done' && (i.closed_at || '').slice(0, 7) === month()).length;
      return `<div class="dmem"><span class="av">${esc((p.full_name || '?').trim().charAt(0))}</span><div><b>${esc(p.full_name)}</b><small>${esc(p.title || '')}</small></div><span class="sp"></span><span class="dmem-n"><b>${a.length}</b>مفتوح</span><span class="dmem-n ${l ? 'r' : ''}"><b>${l}</b>متأخر</span><span class="dmem-n g"><b>${d}</b>أُنجز</span></div>`; }).join('')}</div>` : '<p class="muted">لم يُضف أعضاء لهذا القسم بعد.</p>'}
    ${isAdmin() ? `<p class="muted small mt8">لإضافة عضو: <a href="#/admin/users">الإدارة ← المستخدمون</a>، ثم حدد له القسم والدور «موظف قسم فني».</p>` : ''}</div>`;
}
