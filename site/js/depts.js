// ===== إدارة الخدمات الفنية: لوحة الإدارة (كل الأقسام في شاشة) وصفحة كل قسم (لوحته، أعماله، دليله، فريقه) =====
import { sb, q, session, isAdmin, role, canRead } from './api.js';
import { $, $$, esc, toast, err, modal, field, sel, formData, dateAr, download } from './ui.js';
import { O, loadOps, ST, PR, OPEN, isOpen, isLate, itemRow, bindRows, listView, newItem, openItem, uchip, uname, ucolor, pname, staffOf, dur, canFile, activeCritical, criticalHtml, LST, locPill, locLabel, isStaff } from './ops.js';

const ASSET_UNITS = ['MNT', 'BME', 'IT', 'MED', 'SAF', 'GEN'], PLAN_UNITS = ['MNT', 'BME', 'SAF', 'IT', 'GEN', 'FAC'];
const AST = { in_service: { ar: 'في الخدمة', c: '#2E8B57' }, down: { ar: 'متعطل', c: '#C0392B' }, out: { ar: 'خارج الخدمة', c: '#7A8794' }, disposed: { ar: 'مُكهَّن', c: '#B5C0CB' } };
const CRIT = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const PER = { day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' };
const perLabel = p => p.every === 1 ? { day: 'يومياً', week: 'أسبوعياً', month: 'شهرياً', year: 'سنوياً' }[p.per] : `كل ${p.every} ${{ day: 'أيام', week: 'أسابيع', month: 'أشهر', year: 'سنوات' }[p.per]}`;
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
      <div class="btnrow">${canFile() ? '<button class="btn primary" id="tNew">＋ بلاغ أو طلب</button>' : ''}<a class="btn" href="#/ops/list">كل الأعمال</a><a class="btn" href="#/tsd/report">التقرير الشهري</a><a class="btn" href="#/map?l=ops">على الخريطة</a></div></div>
      <div class="tsdk">${[[all.open, 'عمل مفتوح'], [all.late, 'متأخر عن مهلته', all.late ? 'r' : ''], [all.urgent, 'طارئ أو عاجل', all.urgent ? 'a' : ''], [all.doneM, 'أُنجز هذا الشهر', 'g'], [all.sla == null ? '—' : all.sla + '٪', 'ضمن المهلة'], [all.rating || '—', 'رضا أصحاب الطلبات']].map(([b, l, c]) => `<div class="${c || ''}"><b>${b}</b><span>${l}</span></div>`).join('')}</div></div>
    <div class="tsdunits">${us.map(u => { const s = stats(O.items.filter(i => i.unit === u.code)); const sysBad = bad.filter(l => fm.sys.find(x => x.code === l.system_code)?.owner === u.code).length;
      return `<a class="tsdu" href="#/dept/${u.code}" style="--c:#${u.color}"><div class="tsdu-h"><b>${esc(u.short)}</b>${u.head ? `<small>${esc(u.head)}</small>` : ''}</div>
        <div class="tsdu-n"><span><b>${s.open}</b>مفتوح</span><span class="${s.late ? 'r' : ''}"><b>${s.late}</b>متأخر</span><span><b>${s.doneM}</b>أُنجز</span></div>
        <div class="tsdu-f">${s.fresh ? `<i class="fresh">${s.fresh} جديد</i>` : ''}${s.urgent ? `<i class="urg">${s.urgent} عاجل</i>` : ''}${sysBad ? `<i class="sys">🏥 ${sysBad} نظام معطل</i>` : ''}${!s.fresh && !s.urgent && !sysBad ? '<i class="ok">مستقر</i>' : ''}</div></a>`; }).join('')}</div>
    ${(() => { const c = activeCritical(); return `<div class="pcard"><h2>نافذ الآن في المنشآت <small class="muted">إغلاقات · تصاريح عمل · تعطيل أنظمة حريق · إيقافات مخططة (${c.length})</small></h2>${criticalHtml(c)}</div>`; })()}
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
  const tabs = [['overview', 'نظرة عامة'], ['work', `الأعمال <b class="fmcnt ${s.late ? 'bad' : ''}">${s.open}</b>`], ...(code === 'FAC' ? [['locations', `المواقع والغرف <b class="fmcnt ${O.locs.some(l => l.status !== 'operational') ? 'bad' : ''}">${O.locs.length}</b>`]] : []),
    ...(ASSET_UNITS.includes(code) ? [['assets', 'الأصول']] : []), ...(PLAN_UNITS.includes(code) ? [['plans', 'الأعمال المخططة']] : []), ['manual', `دليل القسم <b class="fmcnt">${procs.length}</b>`], ['team', `الفريق <b class="fmcnt">${team.length}</b>`]];
  root.innerHTML = `<div class="dhero" style="--c:#${u.color}"><div class="dhero-t"><small>إدارة الخدمات الفنية ‹ الأقسام</small><h1>${esc(u.name)}</h1><p>${esc(u.mission || '')}</p>${u.head ? `<span class="dhead">رئيس القسم: <b>${esc(u.head)}</b></span>` : ''}</div>
      <div class="dhero-a">${kinds.filter(k => k.intake || isStaff()).map(k => `<button class="btn ${k.intake && !staffOf(code) ? 'primary' : ''}" data-nk="${k.code}" title="${esc(k.descr)}">${k.icon} ${esc(k.name)}</button>`).join('')}${code === 'PRJ' && canRead() ? '<a class="btn" href="#/dashboard">لوحة المشاريع</a><a class="btn" href="#/projects">المشاريع</a>' : ''}</div></div>
    <nav class="fmtabs">${tabs.map(([k, v]) => `<a href="#/dept/${code}/${k}" class="${tab === k ? 'on' : ''}">${v}</a>`).join('')}</nav><div id="dBody"></div>`;
  const re = () => mountDept(root, code, tab, params);
  $$('[data-nk]', root).forEach(b => b.onclick = () => newItem({ kind: b.dataset.nk }, r => openItem(r.id, re)));
  const t = $('#dBody', root);
  if (tab === 'work') return listView(t, mine, { params, showUnit: false, units: false, re });
  if (tab === 'manual') return viewManual(t, code, procs);
  if (tab === 'locations' && code === 'FAC') return viewLocations(t, params, re);
  if (tab === 'assets') return viewAssets(t, code, params, re);
  if (tab === 'plans') return viewPlans(t, code, params, re);
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
    ${['FAC', 'MNT', 'SAF'].includes(code) ? (() => { const c = activeCritical(); return `<div class="pcard"><h2>نافذ الآن في المنشآت (${c.length})</h2>${criticalHtml(c)}</div>`; })() : ''}
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

// ---------- سجل المواقع والغرف (المرافق، F-03 وR-16): حالة كل غرفة وتاريخ أعمالها
async function viewLocations(t, params, re) {
  const can = staffOf('FAC');
  let fid = +(params.get('f') || 0) || (O.fac.find(f => O.locs.some(l => l.facility_id === f.id && l.status !== 'operational')) || O.fac.find(f => O.locs.some(l => l.facility_id === f.id)) || O.fac[0])?.id || 0, qs = '', stf = '';
  const render = () => {
    const L = O.locs.filter(l => l.facility_id === fid && (!stf || l.status === stf) && (!qs || `${l.code} ${l.name} ${l.building} ${l.floor} ${l.kind}`.includes(qs)));
    const all = O.locs.filter(l => l.facility_id === fid), cnt = k => all.filter(l => l.status === k).length;
    t.innerHTML = `<div class="filters"><select id="lf">${O.fac.map(f => `<option value="${f.id}" ${f.id === fid ? 'selected' : ''}>${esc(f.name)} (${O.locs.filter(l => l.facility_id === f.id).length})</option>`).join('')}</select><input id="lq" placeholder="بحث برقم الغرفة أو اسمها…" value="${esc(qs)}"><span class="sp"></span>${can ? '<button class="btn" id="lBulk">إضافة مجمّعة</button><button class="btn primary" id="lAdd">＋ موقع</button>' : ''}</div>
      <div class="ostats">${Object.entries(LST).map(([k, v]) => `<span style="--c:${v.c};cursor:pointer" data-st="${k}" class="${stf === k ? 'on' : ''}"><b>${cnt(k)}</b>${v.ar}</span>`).join('')}</div>
      ${L.length ? `<div class="olocs">${L.map(l => { const open = O.items.filter(i => i.location_id === l.id && isOpen(i)).length; return `<button class="oloc ${l.status}" data-loc="${l.id}" style="--c:${LST[l.status].c}"><b>${esc(l.code)}</b><span>${esc(l.name || '')}</span><small>${esc([l.building, l.floor, l.kind].filter(Boolean).join(' · '))}</small><span class="oi-f">${locPill(l)}${l.critical ? '<span class="olink" style="color:#C0392B;background:#FDEBE5">منطقة حرجة</span>' : ''}${open ? `<span class="olink">${open} عمل مفتوح</span>` : ''}</span>${l.status !== 'operational' && l.status_note ? `<small class="muted">${esc(l.status_note)}</small>` : ''}</button>`; }).join('')}</div>`
        : `<div class="empty-boq">${all.length ? 'لا مواقع مطابقة.' : 'لا مواقع مسجلة لهذه المنشأة بعد. سجّل الغرف والمناطق برموز ثابتة (المبنى-الدور-الغرفة) حتى تُربط بها البلاغات والإغلاقات ويُبنى تاريخ كل مكان (R-16).'}</div>`}`;
    $('#lf', t).onchange = e => { fid = +e.target.value; render(); };
    $('#lq', t).oninput = e => { qs = e.target.value.trim(); const c = e.target.selectionStart; render(); const i = $('#lq', t); i.focus(); i.setSelectionRange(c, c); };
    $$('[data-st]', t).forEach(b => b.onclick = () => { stf = stf === b.dataset.st ? '' : b.dataset.st; render(); });
    $('#lAdd', t) && ($('#lAdd', t).onclick = () => locForm(null, fid, render));
    $('#lBulk', t) && ($('#lBulk', t).onclick = () => bulkLocs(fid, render));
    $$('[data-loc]', t).forEach(b => b.onclick = () => locCard(+b.dataset.loc, render, re));
  };
  render();
}
async function reloadLocs() { O.locs = await q(sb.from('fac_locations').select('*').eq('active', true).order('facility_id').order('sort').order('code')); O.Loc = Object.fromEntries(O.locs.map(l => [l.id, l])); }
async function locForm(l, fid, done) {
  const v = l || { facility_id: fid, status: 'operational' };
  await modal(`<form id="lf2" class="pgrid">${field('المنشأة', `<select name="facility_id">${O.fac.map(f => `<option value="${f.id}" ${f.id === v.facility_id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>`)}
    ${field('الرمز *', `<input name="code" value="${esc(v.code || '')}" required dir="ltr" placeholder="ER-GF-012">`)}${field('الاسم', `<input name="name" value="${esc(v.name || '')}" placeholder="غرفة الفرز 2">`)}
    ${field('المبنى', `<input name="building" value="${esc(v.building || '')}">`)}${field('الدور', `<input name="floor" value="${esc(v.floor || '')}">`)}
    ${field('النوع', `<input name="kind" value="${esc(v.kind || '')}" list="lkinds" placeholder="عيادة، غرفة تنويم، عمليات…"><datalist id="lkinds">${['عيادة', 'غرفة تنويم', 'غرفة عزل', 'عمليات', 'عناية مركزة', 'طوارئ', 'مختبر', 'أشعة', 'صيدلية', 'مكتب', 'ممر', 'دورة مياه', 'مستودع', 'غرفة فنية'].map(x => `<option value="${x}">`).join('')}</datalist>`)}
    <label class="chk wide"><input type="checkbox" name="critical" ${v.critical ? 'checked' : ''}> منطقة حرجة (عمليات، عناية، طوارئ، عزل…) — يرفع مستوى اعتماد الإغلاق (R-12)</label>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
    { title: l ? 'تعديل موقع' : 'موقع جديد', wide: true, onOpen: (w, c) => { $('#lf2', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
      const row = { facility_id: +x.facility_id, code: x.code.trim(), name: x.name.trim(), building: x.building.trim(), floor: x.floor.trim(), kind: x.kind.trim(), critical: !!x.critical };
      try { if (l) await q(sb.from('fac_locations').update(row).eq('id', l.id)); else await q(sb.from('fac_locations').insert(row)); toast('حُفظ'); c(); await reloadLocs(); done(); } catch (e2) { err(e2); } }; } });
}
async function bulkLocs(fid, done) {
  await modal(`<form id="bf"><p class="muted small m0">سطر لكل موقع، والحقول مفصولة بـ | أو Tab (يمكن اللصق من Excel):<br><b dir="ltr">الرمز | الاسم | المبنى | الدور | النوع</b></p><textarea name="t" rows="10" dir="auto" placeholder="ER-GF-012 | غرفة الفرز 2 | الطوارئ | الأرضي | طوارئ"></textarea><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إضافة</button></div></form>`,
    { title: 'إضافة مواقع مجمّعة — ' + (O.F[fid]?.name || ''), wide: true, onOpen: (w, c) => { $('#bf', w).onsubmit = async e => { e.preventDefault();
      const rows = e.target.t.value.split(/\n/).map(x => x.split(/\t|\|/).map(y => y.trim())).filter(a => a[0]).map(([code, name = '', building = '', floor = '', kind = '']) => ({ facility_id: fid, code, name, building, floor, kind }));
      if (!rows.length) return toast('لا أسطر', 'bad');
      try { await q(sb.from('fac_locations').upsert(rows, { onConflict: 'facility_id,code' })); toast(`أُضيف ${rows.length} موقعاً`); c(); await reloadLocs(); done(); } catch (e2) { err(e2); } }; } });
}
async function locCard(id, done, re) {
  const l = O.Loc[id]; if (!l) return;
  const hist = await q(sb.from('ops_items').select('*').eq('location_id', id).order('id', { ascending: false }).limit(50)).catch(() => []);
  const can = staffOf('FAC');
  await modal(`<div class="ohead" style="--c:${LST[l.status].c}"><span class="oi-k big">📍</span><div><b>${esc(l.code)} — ${esc(l.name || '')}</b><span class="muted">${esc(O.F[l.facility_id]?.name || '')} · ${esc([l.building, l.floor, l.kind].filter(Boolean).join(' · '))}</span></div><span class="sp"></span>${locPill(l)}</div>
    ${l.status_note ? `<div class="fmlast"><span>الحالة منذ ${dateAr(l.status_since)}</span><p>${esc(l.status_note)}</p></div>` : ''}
    <div class="btnrow wrap">${can ? `<button class="btn primary" id="cClose">🚧 إغلاق للصيانة</button><button class="btn" id="cStat">تغيير الحالة يدوياً</button><button class="btn" id="cEdit">تعديل</button>` : ''}<button class="btn" id="cNew">＋ بلاغ على هذا الموقع</button></div>
    <h3 class="sub-h">تاريخ الموقع (${hist.length})</h3>${hist.length ? `<div class="olist">${hist.map(i => itemRow(i)).join('')}</div>` : '<p class="muted small">لا أعمال مسجلة على هذا الموقع بعد.</p>'}`,
    { title: 'الموقع', wide: true, onOpen: (w, c) => {
      $$('[data-oi]', w).forEach(b => b.onclick = () => { c(); openItem(+b.dataset.oi, re); });
      $('#cNew', w).onclick = () => { c(); newItem({ facility_id: l.facility_id, location_id: l.id }, r => openItem(r.id, re)); };
      $('#cClose', w) && ($('#cClose', w).onclick = () => { c(); newItem({ kind: 'closure', facility_id: l.facility_id, location_id: l.id, title: 'إغلاق ' + locLabel(l) + ' للصيانة', data: { level: l.critical ? 'مدير الإدارة (3–14 يوماً أو منطقة حرجة)' : '' } }, r => openItem(r.id, re)); });
      $('#cEdit', w) && ($('#cEdit', w).onclick = () => { c(); locForm(l, l.facility_id, done); });
      $('#cStat', w) && ($('#cStat', w).onclick = async () => {
        const r = await modal(`<form id="sf">${field('الحالة', `<select name="s">${Object.entries(LST).map(([k, v]) => `<option value="${k}" ${k === l.status ? 'selected' : ''}>${v.ar}</option>`).join('')}</select>`)}${field('السبب *', '<textarea name="n" rows="2" required></textarea>')}<p class="muted small">الأفضل أن يكون الإغلاق عبر نموذج «إغلاق موقع» حتى يمر بالاعتمادات وقائمة إعادة الفتح.</p><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'حالة الموقع', onOpen: (w2, c2) => { $('#sf', w2).onsubmit = e => { e.preventDefault(); c2(formData(e.target)); }; } });
        if (!r) return; try { await q(sb.from('fac_locations').update({ status: r.s, status_note: r.n.trim(), status_since: new Date().toISOString(), status_item: null }).eq('id', l.id)); toast('حُدّثت الحالة'); c(); await reloadLocs(); done(); } catch (e) { err(e); } });
    } });
}

// ---------- سجل الأصول للقسم
async function viewAssets(t, code, params, re) {
  const can = staffOf(code);
  let list = await q(sb.from('assets').select('*').eq('unit', code).eq('active', true).order('code').limit(3000)).catch(() => []);
  const st = { f: params.get('f') || '', s: '', q: '' };
  const render = () => {
    const L = list.filter(a => (!st.f || a.facility_id === +st.f) && (!st.s || a.status === st.s) && (!st.q || `${a.code} ${a.name} ${a.category} ${a.maker} ${a.model} ${a.serial}`.includes(st.q)));
    const base = list.filter(a => !st.f || a.facility_id === +st.f);
    t.innerHTML = `<div class="filters"><input id="aq" placeholder="بحث بالرمز أو الاسم أو الموديل أو الرقم التسلسلي…" value="${esc(st.q)}">${sel('af', [['', 'كل المنشآت'], ...O.fac.map(f => [f.id, f.name])], st.f)}<span class="sp"></span>${can ? '<button class="btn" id="aBulk">إضافة مجمّعة</button><button class="btn primary" id="aAdd">＋ أصل</button>' : ''}</div>
      <div class="ostats">${Object.entries(AST).map(([k, v]) => `<span style="--c:${v.c};cursor:pointer" data-st="${k}" class="${st.s === k ? 'on' : ''}"><b>${base.filter(a => a.status === k).length}</b>${v.ar}</span>`).join('')}<span style="--c:#A06200"><b>${base.filter(a => a.warranty_end && a.warranty_end >= new Date().toISOString().slice(0, 10)).length}</b>تحت الضمان</span></div>
      ${L.length ? `<div class="tblwrap"><table class="lst"><thead><tr><th>الرمز</th><th>الأصل</th><th>المنشأة والموقع</th><th>الشركة والموديل</th><th>الأهمية</th><th>الحالة</th><th>الضمان</th></tr></thead><tbody>${L.slice(0, 600).map(a => `<tr data-a="${a.id}" style="cursor:pointer"><td class="ltr"><b>${esc(a.code)}</b></td><td>${esc(a.name)}<div class="muted small">${esc(a.category || '')}</div></td><td>${esc(O.F[a.facility_id]?.name || '—')}<div class="muted small">${esc(locLabel(O.Loc[a.location_id]) || '')}</div></td><td>${esc([a.maker, a.model].filter(Boolean).join(' · ') || '—')}<div class="muted small ltr">${esc(a.serial || '')}</div></td><td>${CRIT[a.criticality] || ''}</td><td><span class="opill" style="--c:${AST[a.status].c}">${AST[a.status].ar}</span></td><td>${a.warranty_end ? dateAr(a.warranty_end) : '—'}</td></tr>`).join('')}</tbody></table></div>${L.length > 600 ? `<p class="muted small">يُعرض أول 600 من ${L.length} — استخدم البحث.</p>` : ''}`
        : `<div class="empty-boq">${list.length ? 'لا أصول مطابقة.' : `لا أصول مسجلة لقسم ${esc(uname(code))} بعد. سجّل الأصول (يدوياً أو بلصق قائمة من Excel) ليُبنى تاريخ كل أصل من بلاغاته وأعماله المخططة.`}</div>`}`;
    $('#aq', t).oninput = e => { st.q = e.target.value.trim(); const c = e.target.selectionStart; render(); const i = $('#aq', t); i.focus(); i.setSelectionRange(c, c); };
    $('[name=af]', t).onchange = e => { st.f = e.target.value; render(); };
    $$('[data-st]', t).forEach(b => b.onclick = () => { st.s = st.s === b.dataset.st ? '' : b.dataset.st; render(); });
    $$('[data-a]', t).forEach(r => r.onclick = () => assetCard(+r.dataset.a));
    $('#aAdd', t) && ($('#aAdd', t).onclick = () => assetForm(null));
    $('#aBulk', t) && ($('#aBulk', t).onclick = bulk);
  };
  const reload = async () => { list = await q(sb.from('assets').select('*').eq('unit', code).eq('active', true).order('code').limit(3000)); render(); };
  async function assetForm(a) {
    const v = a || { unit: code, facility_id: +st.f || '', criticality: 'medium', status: 'in_service' };
    await modal(`<form id="af2" class="pgrid">${field('الرمز *', `<input name="code" value="${esc(v.code || '')}" required dir="ltr" placeholder="${code}-0001">`)}${field('الاسم *', `<input name="name" value="${esc(v.name || '')}" required>`)}
      ${field('الفئة', `<input name="category" value="${esc(v.category || '')}">`)}${field('المنشأة', sel('facility_id', [['', '—'], ...O.fac.map(f => [f.id, f.name])], v.facility_id || ''))}
      ${field('الموقع (رمز الغرفة)', `<input name="loc" value="${esc(O.Loc[v.location_id]?.code || '')}" list="aloc" dir="ltr"><datalist id="aloc">${O.locs.map(l => `<option value="${esc(l.code)}">${esc(l.name)}</option>`).join('')}</datalist>`)}
      ${field('الشركة المصنّعة', `<input name="maker" value="${esc(v.maker || '')}">`)}${field('الموديل', `<input name="model" value="${esc(v.model || '')}">`)}${field('الرقم التسلسلي', `<input name="serial" value="${esc(v.serial || '')}" dir="ltr">`)}
      ${field('تاريخ التركيب', `<input type="date" name="install_date" value="${esc(v.install_date || '')}">`)}${field('نهاية الضمان', `<input type="date" name="warranty_end" value="${esc(v.warranty_end || '')}">`)}
      ${field('الأهمية', sel('criticality', Object.entries(CRIT), v.criticality))}${field('الحالة', sel('status', Object.entries(AST).map(([k, x]) => [k, x.ar]), v.status))}
      ${field('ملاحظات', `<textarea name="notes" rows="2">${esc(v.notes || '')}</textarea>`, 'wide')}
      <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
      { title: a ? 'تعديل أصل' : 'أصل جديد — ' + uname(code), wide: true, onOpen: (w, c) => { $('#af2', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
        const loc = O.locs.find(l => l.code === x.loc.trim() && (!x.facility_id || l.facility_id === +x.facility_id));
        const row = { unit: code, code: x.code.trim(), name: x.name.trim(), category: x.category.trim(), facility_id: x.facility_id ? +x.facility_id : null, location_id: loc?.id || null, maker: x.maker.trim(), model: x.model.trim(), serial: x.serial.trim(), install_date: x.install_date || null, warranty_end: x.warranty_end || null, criticality: x.criticality, status: x.status, notes: x.notes.trim() };
        try { if (a) await q(sb.from('assets').update(row).eq('id', a.id)); else await q(sb.from('assets').insert(row)); toast('حُفظ'); c(); await reload(); } catch (e2) { err(e2); } }; } });
  }
  async function bulk() {
    await modal(`<form id="bf"><p class="muted small m0">سطر لكل أصل، الحقول مفصولة بـ | أو Tab (يمكن اللصق من Excel):<br><b dir="ltr">الرمز | الاسم | الفئة | الشركة | الموديل | الرقم التسلسلي | رمز الغرفة</b></p>${field('المنشأة *', sel('f', [['', '— اختر —'], ...O.fac.map(f => [f.id, f.name])], st.f, 'required'))}<textarea name="t" rows="10" dir="auto"></textarea><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إضافة</button></div></form>`,
      { title: 'إضافة أصول مجمّعة — ' + uname(code), wide: true, onOpen: (w, c) => { $('#bf', w).onsubmit = async e => { e.preventDefault(); const fid = +e.target.f.value;
        const rows = e.target.t.value.split(/\n/).map(x => x.split(/\t|\|/).map(y => y.trim())).filter(a => a[0] && a[1]).map(([cd, name, category = '', maker = '', model = '', serial = '', lc = '']) => ({ unit: code, code: cd, name, category, maker, model, serial, facility_id: fid, location_id: O.locs.find(l => l.facility_id === fid && l.code === lc)?.id || null }));
        if (!rows.length) return toast('لا أسطر صالحة (الرمز والاسم مطلوبان)', 'bad');
        try { await q(sb.from('assets').upsert(rows, { onConflict: 'code' })); toast(`أُضيف ${rows.length} أصلاً`); c(); await reload(); } catch (e2) { err(e2); } }; } });
  }
  async function assetCard(id) {
    const a = list.find(x => x.id === id); if (!a) return;
    const [hist, plans] = await Promise.all([q(sb.from('ops_items').select('*').eq('asset_id', id).order('id', { ascending: false }).limit(60)).catch(() => []), q(sb.from('ops_plans').select('*').eq('asset_id', id)).catch(() => [])]);
    const faults = hist.filter(i => i.source !== 'ppm' && i.kind !== 'ppm');
    const down = faults.reduce((m, i) => m + (i.resolved_at || i.closed_at ? new Date(i.resolved_at || i.closed_at) - new Date(i.created_at) : 0), 0);
    await modal(`<div class="ohead" style="--c:${AST[a.status].c}"><span class="oi-k big">🏷️</span><div><b>${esc(a.code)} — ${esc(a.name)}</b><span class="muted">${esc(O.F[a.facility_id]?.name || '')}${a.location_id ? ' · ' + esc(locLabel(O.Loc[a.location_id])) : ''}</span></div><span class="sp"></span><span class="opill" style="--c:${AST[a.status].c}">${AST[a.status].ar}</span></div>
      <div class="kvs">${[['الفئة', a.category], ['الشركة والموديل', [a.maker, a.model].filter(Boolean).join(' · ')], ['الرقم التسلسلي', a.serial], ['الأهمية', CRIT[a.criticality]], ['التركيب', a.install_date ? dateAr(a.install_date) : ''], ['نهاية الضمان', a.warranty_end ? dateAr(a.warranty_end) : ''], ['أعطال مسجلة', faults.length], ['مجموع زمن التوقف', down ? dur(down) : '—']].map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>
      <div class="btnrow wrap mt8"><button class="btn primary" id="cF">＋ بلاغ عطل على الأصل</button>${can ? '<button class="btn" id="cP">🗓️ خطة دورية للأصل</button><button class="btn" id="cE">تعديل</button>' : ''}${can && code === 'BME' ? '<button class="btn" id="cR" title="G-08 الخطوة 5: كلفة الإصلاح تتجاوز 40٪ أو انتهى العمر">♻️ توصية إحلال للتجهيزات الطبية</button>' : ''}</div>
      ${plans.length ? `<h3 class="sub-h">الأعمال المخططة</h3><div class="dplans">${plans.map(p => `<div><b>${esc(p.title)}</b><span>${perLabel(p)} · القادم ${dateAr(p.next_due)}</span></div>`).join('')}</div>` : ''}
      <h3 class="sub-h">تاريخ الأصل (${hist.length})</h3>${hist.length ? `<div class="olist">${hist.map(i => itemRow(i)).join('')}</div>` : '<p class="muted small">لا أعمال مسجلة على هذا الأصل بعد.</p>'}`,
      { title: 'الأصل', wide: true, onOpen: (w, c) => {
        $$('[data-oi]', w).forEach(b => b.onclick = () => { c(); openItem(+b.dataset.oi, re); });
        const fk = O.kinds.find(k => k.unit === code && k.intake)?.code || 'mnt';
        $('#cF', w).onclick = () => { c(); newItem({ kind: fk, facility_id: a.facility_id, location_id: a.location_id, asset_id: a.id, asset: a.code, title: '' }, r => openItem(r.id, re)); };
        $('#cP', w) && ($('#cP', w).onclick = () => { c(); planForm(code, { asset_id: a.id, facility_id: a.facility_id, location_id: a.location_id, title: (code === 'BME' ? 'صيانة وقائية ومعايرة — ' : 'صيانة وقائية — ') + a.name }, () => {}); });
        $('#cE', w) && ($('#cE', w).onclick = () => { c(); assetForm(a); });
        $('#cR', w) && ($('#cR', w).onclick = () => { c(); const cost = hist.reduce((m, i) => m + (+i.data?.cost || 0), 0);
          newItem({ kind: 'med', facility_id: a.facility_id, location_id: a.location_id, asset_id: a.id, asset: a.code, title: 'توصية إحلال: ' + a.name, source: 'item', data: { device: [a.name, a.maker, a.model].filter(Boolean).join(' · '), reason: 'إحلال جهاز قائم', qty: 1 },
            details: `توصية من الصيانة الطبية (G-08 الخطوة 5، B-05).\nالأصل: ${a.code}${a.install_date ? ' — مركّب منذ ' + a.install_date : ''}\nأعطال مسجلة: ${faults.length}${cost ? ' — تكلفة إصلاحات: ' + cost.toLocaleString('en') + ' ر.س' : ''}\nمجموع زمن التوقف: ${down ? dur(down) : '—'}` }, r => openItem(r.id, re)); });
      } });
  }
  render();
  const aid = +(params.get('a') || 0); if (aid) assetCard(aid);
}

// ---------- الأعمال المخططة الدورية للقسم
async function viewPlans(t, code, params, re) {
  const can = staffOf(code);
  const load = () => q(sb.from('ops_plans').select('*').eq('unit', code).order('next_due')).catch(() => []);
  let plans = await load();
  const today = new Date().toISOString().slice(0, 10);
  const render = () => {
    const up = []; const lim = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    plans.filter(p => p.active).forEach(p => { let d = p.next_due, n = 0; while (d <= lim && n < 30) { up.push({ p, d }); const x = new Date(d); if (p.per === 'day') x.setDate(x.getDate() + p.every); else if (p.per === 'week') x.setDate(x.getDate() + 7 * p.every); else if (p.per === 'month') x.setMonth(x.getMonth() + p.every); else x.setFullYear(x.getFullYear() + p.every); d = x.toISOString().slice(0, 10); n++; } });
    up.sort((a, b) => a.d.localeCompare(b.d));
    const open = O.items.filter(i => i.unit === code && i.plan_id && isOpen(i));
    t.innerHTML = `<div class="toolbar"><p class="muted small m0" style="flex:1">كل خطة تولّد أمر عمل تلقائياً قبل موعدها بمهلة التحضير (صباح كل يوم)، ولا يُغلق الأمر إلا بإكمال بنود الخطة. ثم يُحسب الموعد التالي.</p>${can ? '<button class="btn" id="pGen">توليد المستحق الآن</button><button class="btn primary" id="pAdd">＋ خطة دورية</button>' : ''}</div>
      <div class="fm2col"><div class="pcard"><h2>الخطط (${plans.length})</h2>${plans.length ? `<div class="dplans">${plans.map(p => `<button data-p="${p.id}" class="${p.active ? '' : 'off'} ${p.next_due < today ? 'late' : ''}"><b>${esc(p.title)}</b><span>${perLabel(p)} · ${esc(O.F[p.facility_id]?.name || 'كل المنشآت')}${p.proc ? ' · 📘 ' + esc(p.proc) : ''}</span><span>الموعد القادم: <b>${dateAr(p.next_due)}</b>${(p.checklist || []).length ? ` · ${p.checklist.length} بنود` : ''}${p.active ? '' : ' · موقوفة'}</span></button>`).join('')}</div>` : '<p class="muted">لا خطط بعد. أضف خطط الصيانة الوقائية والاختبارات الدورية والمعايرة (مثل اختبار المولدات الشهري، فحص الإطفاء الربعي، معايرة الأجهزة الطبية).</p>'}</div>
      <div class="pcard"><h2>المستحق خلال 60 يوماً (${up.length})</h2>${up.length ? `<div class="dup">${up.slice(0, 40).map(x => `<div class="${x.d < today ? 'late' : ''}"><b>${dateAr(x.d)}</b><span>${esc(x.p.title)}</span></div>`).join('')}</div>` : '<p class="muted">لا شيء.</p>'}
        <h3 class="sub-h">أوامر مخططة مفتوحة (${open.length})</h3>${open.length ? `<div class="olist">${open.slice(0, 8).map(i => itemRow(i, { showUnit: false })).join('')}</div>` : '<p class="muted small">لا شيء.</p>'}</div></div>`;
    bindRows(t, re);
    $('#pAdd', t) && ($('#pAdd', t).onclick = () => planForm(code, {}, async () => { plans = await load(); render(); }));
    $('#pGen', t) && ($('#pGen', t).onclick = async () => { try { const { data, error } = await sb.rpc('ops_generate'); if (error) throw error; toast(data ? `وُلّد ${data} أمر عمل` : 'لا أعمال مستحقة الآن'); await loadOps(); plans = await load(); render(); } catch (e) { err(e); } });
    $$('[data-p]', t).forEach(b => b.onclick = () => { const p = plans.find(x => x.id === +b.dataset.p); if (can) planForm(code, p, async () => { plans = await load(); render(); }); });
  };
  render();
}
async function planForm(code, p0 = {}, done) {
  const v = { every: 1, per: 'month', lead_days: 7, priority: 'p4', next_due: new Date().toISOString().slice(0, 10), active: true, checklist: [], ...p0 };
  const procs = O.G.procs.filter(p => p.code.startsWith((MAN_PREFIX[code] || '#') + '-') || ['G-06'].includes(p.code)).map(p => [p.code, p.code + ' — ' + p.title]);
  let assets = []; try { assets = await q(sb.from('assets').select('id,code,name,facility_id').eq('unit', code).eq('active', true).order('code').limit(2000)); } catch (e) { }
  await modal(`<form id="pf" class="pgrid">${field('العنوان *', `<input name="title" value="${esc(v.title || '')}" required placeholder="مثال: اختبار تحميل مولدات الطوارئ">`, 'wide')}
    ${field('الإجراء الحاكم', sel('proc', [['', '—'], ...procs], v.proc || (code === 'BME' ? 'B-02' : code === 'MNT' ? 'M-03' : '')))}${field('المنشأة', sel('facility_id', [['', '—'], ...O.fac.map(f => [f.id, f.name])], v.facility_id || ''))}
    ${field('الأصل (اختياري)', `<input name="asset" list="pa" value="${esc(assets.find(a => a.id === v.asset_id)?.code || '')}" dir="ltr"><datalist id="pa">${assets.map(a => `<option value="${esc(a.code)}">${esc(a.name)}</option>`).join('')}</datalist>`)}
    ${field('التكرار', `<div class="row2"><input type="number" name="every" min="1" value="${v.every}" style="width:80px">${sel('per', Object.entries(PER), v.per)}</div>`)}
    ${field('الموعد القادم *', `<input type="date" name="next_due" value="${esc(v.next_due)}" required>`)}${field('مهلة التحضير (أيام قبل الموعد)', `<input type="number" name="lead_days" min="0" value="${v.lead_days}">`)}
    ${field('بنود الفحص (سطر لكل بند؛ يلزم إكمالها قبل إغلاق الأمر)', `<textarea name="checklist" rows="4">${esc((v.checklist || []).map(c => c.l).join('\n'))}</textarea>`, 'wide')}
    ${field('ملاحظات', `<input name="notes" value="${esc(v.notes || '')}">`, 'wide')}
    <label class="chk wide"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> الخطة فعّالة</label>
    <div class="btnrow end wide">${v.id ? '<button type="button" class="btn danger" id="pDel">حذف</button><span class="sp"></span>' : ''}<button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
    { title: v.id ? 'تعديل خطة' : 'خطة دورية — ' + uname(code), wide: true, onOpen: (w, c) => {
      $('#pDel', w) && ($('#pDel', w).onclick = async () => { try { await q(sb.from('ops_plans').delete().eq('id', v.id)); toast('حُذفت'); c(); done(); } catch (e) { err(e); } });
      $('#pf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const a = assets.find(z => z.code === (x.asset || '').trim());
        const row = { title: x.title.trim(), unit: code, kind: 'ppm', proc: x.proc || '', facility_id: x.facility_id ? +x.facility_id : (a?.facility_id || null), asset_id: a?.id || null, location_id: v.location_id || null, every: +x.every || 1, per: x.per, next_due: x.next_due, lead_days: +x.lead_days || 0, notes: x.notes.trim(), active: !!x.active,
          checklist: x.checklist.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => ({ k: 'p' + (i + 1), l })) };
        try { if (v.id) await q(sb.from('ops_plans').update(row).eq('id', v.id)); else await q(sb.from('ops_plans').insert(row)); toast('حُفظت الخطة'); c(); done(); } catch (e2) { err(e2); } };
    } });
}

// ---------- التقرير الشهري للإدارة (#/tsd/report?m=YYYY-MM): أداء كل قسم ومؤشرات الإدارة، للطباعة وExcel
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const mAr = m => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
export async function mountTSDReport(root, params) {
  await loadOps();
  const m = params.get('m') || month();
  const end = new Date(+m.slice(0, 4), +m.slice(5, 7), 1).toISOString();
  // كل أعمال الشهر (قد تكون أقدم من نافذة التحميل الافتراضية)
  const start = m + '-01T00:00:00Z';
  const all = await q(sb.from('ops_items').select('*').or(`created_at.gte.${start},closed_at.gte.${start},status.in.(new,accepted,in_progress,on_hold,verify)`).limit(5000)).catch(() => O.items);
  const inM = d => d && d >= start && d < end;
  const rows = units().map(u => { const L = all.filter(i => i.unit === u.code);
    const rec = L.filter(i => inM(i.created_at)), done = L.filter(i => i.status === 'done' && inM(i.closed_at));
    const openEnd = L.filter(i => i.created_at < end && !(i.closed_at && i.closed_at < end) && i.status !== 'cancelled');
    const lateEnd = openEnd.filter(i => i.due_at && i.due_at < (end < new Date().toISOString() ? end : new Date().toISOString()));
    const tt = done.map(i => new Date(i.resolved_at || i.closed_at) - new Date(i.created_at)).filter(x => x > 0);
    const ok = done.filter(i => !i.due_at || new Date(i.resolved_at || i.closed_at) <= new Date(i.due_at)).length;
    const rated = done.filter(i => i.rating);
    const handIn = rec.filter(i => i.parent_id).length, ppm = rec.filter(i => i.source === 'ppm').length;
    const cost = done.reduce((m, i) => m + (+i.data?.cost || 0), 0);
    return { u, cost, rec: rec.length, done: done.length, open: openEnd.length, late: lateEnd.length, avg: tt.length ? tt.reduce((a, b) => a + b, 0) / tt.length : null, sla: done.length ? Math.round(ok / done.length * 100) : null, rating: rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1) : null, handIn, ppm,
      kinds: Object.entries(rec.reduce((o, i) => (o[i.kind] = (o[i.kind] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 3) };
  });
  const T = rows.reduce((a, r) => ({ rec: a.rec + r.rec, done: a.done + r.done, open: a.open + r.open, late: a.late + r.late }), { rec: 0, done: 0, open: 0, late: 0 });
  const doneAll = all.filter(i => i.status === 'done' && inM(i.closed_at)), okAll = doneAll.filter(i => !i.due_at || new Date(i.resolved_at || i.closed_at) <= new Date(i.due_at)).length;
  const ratedAll = doneAll.filter(i => i.rating);
  const byFac = Object.entries(all.filter(i => inM(i.created_at)).reduce((o, i) => (o[i.facility_id] = (o[i.facility_id] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const crit = all.filter(i => ['closure', 'permit', 'impair', 'shutdown'].includes(O.K[i.kind]?.effect) && (inM(i.created_at) || inM(i.closed_at)));
  const maxR = Math.max(1, ...rows.map(r => Math.max(r.rec, r.done)));
  const months = []; for (let k = 0; k < 12; k++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); months.push(d.toISOString().slice(0, 7)); }
  root.innerHTML = `<div class="toolbar noprint"><a class="btn sm" href="#/tsd">→ لوحة الإدارة</a><span class="sp"></span><select id="rm">${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${mAr(x)}</option>`).join('')}</select><button class="btn" id="rx">تصدير Excel</button><button class="btn primary" onclick="print()">طباعة / PDF</button></div>
    <div class="tsdrep"><header class="fmrep-h"><img src="assets/logo.png" alt=""><div><h1>التقرير الشهري لإدارة الخدمات الفنية</h1><p>تجمع الأحساء الصحي · ${mAr(m)}</p></div><div class="fmrep-d">تاريخ الإصدار<br><b>${dateAr(new Date())}</b></div></header>
    <div class="fmrep-k"><div><b>${T.rec}</b><span>طلب وعمل جديد</span></div><div class="g"><b>${T.done}</b><span>أُنجز</span></div><div><b>${doneAll.length ? Math.round(okAll / doneAll.length * 100) + '٪' : '—'}</b><span>أُنجز ضمن المهلة</span></div><div class="${T.late ? 'r' : ''}"><b>${T.late}</b><span>متأخر نهاية الشهر</span></div><div><b>${T.open}</b><span>مفتوح نهاية الشهر</span></div><div><b>${ratedAll.length ? (ratedAll.reduce((a, b) => a + b.rating, 0) / ratedAll.length).toFixed(1) : '—'}</b><span>رضا أصحاب الطلبات</span></div></div>
    <h2>أداء الأقسام</h2><div class="tblwrap"><table class="rt2"><thead><tr><th>القسم</th><th class="c">وارد</th><th class="c">مُنجز</th><th>الوارد والمنجز</th><th class="c">ضمن المهلة</th><th class="c">متوسط الإنجاز</th><th class="c">متأخر</th><th class="c">مفتوح</th><th class="c">الرضا</th><th class="c">تكلفة الإصلاح</th><th>الأكثر طلباً</th></tr></thead><tbody>${rows.map(r => `<tr><td><b style="color:#${r.u.color}">${esc(r.u.short)}</b>${r.handIn || r.ppm ? `<div class="muted small">${r.handIn ? r.handIn + ' محال من أقسام' : ''}${r.handIn && r.ppm ? ' · ' : ''}${r.ppm ? r.ppm + ' مخطط' : ''}</div>` : ''}</td><td class="c">${r.rec}</td><td class="c">${r.done}</td><td><div class="rbars"><i style="width:${r.rec / maxR * 100}%;background:#${r.u.color}55"></i><i style="width:${r.done / maxR * 100}%;background:#${r.u.color}"></i></div></td><td class="c ${r.sla != null && r.sla < 80 ? 'bad' : ''}">${r.sla == null ? '—' : r.sla + '٪'}</td><td class="c">${r.avg ? dur(r.avg) : '—'}</td><td class="c ${r.late ? 'bad' : ''}">${r.late}</td><td class="c">${r.open}</td><td class="c">${r.rating || '—'}</td><td class="c">${r.cost ? r.cost.toLocaleString('en') : '—'}</td><td class="small">${r.kinds.map(([k, n]) => `${esc(O.K[k]?.short || k)} ${n}`).join('، ') || '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="fm2col"><div><h2>أكثر المنشآت طلباً</h2>${byFac.length ? `<div class="fmbars">${byFac.map(([f, n]) => `<div class="fmbar"><span>${esc(O.F[f]?.name || '—')}</span><i><em style="width:${Math.round(n / byFac[0][1] * 100)}%"></em></i><b>${n}</b></div>`).join('')}</div>` : '<p class="muted">لا طلبات هذا الشهر.</p>'}</div>
      <div><h2>الأعمال الحرجة خلال الشهر</h2>${crit.length ? `<ul class="rlist">${crit.slice(0, 12).map(i => `<li>${esc(O.K[i.kind]?.icon || '')} <b>${esc(O.K[i.kind]?.short || '')}</b>: ${esc(i.title)} — ${esc(O.F[i.facility_id]?.name || '')} <span class="muted">(${ST[i.status]?.ar})</span></li>`).join('')}</ul>` : '<p class="muted">لا إغلاقات أو تصاريح أو تعطيلات هذا الشهر.</p>'}</div></div></div>`;
  $('#rm', root).onchange = e => location.hash = '#/tsd/report?m=' + e.target.value;
  $('#rx', root).onclick = async () => {
    try { const { loadExcelJS } = await import('./excel.js'); await loadExcelJS(); } catch (e) { return err('تعذّر تحميل مكتبة Excel'); }
    const wb = new ExcelJS.Workbook(); wb.creator = 'إدارة الخدمات الفنية — تجمع الأحساء الصحي';
    const ws = wb.addWorksheet('أداء الأقسام', { views: [{ rightToLeft: true }] });
    ws.addRow([`التقرير الشهري لإدارة الخدمات الفنية — ${mAr(m)}`]).font = { bold: true, size: 14, name: 'Tajawal', color: { argb: 'FF123B5C' } }; ws.addRow([]);
    const h = ws.addRow(['القسم', 'وارد', 'مُنجز', 'ضمن المهلة ٪', 'متوسط الإنجاز (ساعة)', 'متأخر', 'مفتوح', 'الرضا', 'محال من أقسام', 'مخطط', 'تكلفة الإصلاح (ر.س)']);
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Tajawal' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B5C' } }; c.alignment = { horizontal: 'center' }; });
    rows.forEach(r => ws.addRow([r.u.short, r.rec, r.done, r.sla, r.avg ? Math.round(r.avg / 36e5) : null, r.late, r.open, r.rating ? +r.rating : null, r.handIn, r.ppm, r.cost || null]).eachCell(c => c.font = { name: 'Tajawal' }));
    ws.addRow(['الإجمالي', T.rec, T.done, doneAll.length ? Math.round(okAll / doneAll.length * 100) : null, null, T.late, T.open]).eachCell(c => c.font = { bold: true, name: 'Tajawal' });
    ws.columns.forEach((c, i) => c.width = i === 0 ? 22 : 14);
    const ws2 = wb.addWorksheet('الأعمال', { views: [{ rightToLeft: true }] });
    const h2 = ws2.addRow(['الرقم', 'القسم', 'النوع', 'العنوان', 'المنشأة', 'الموقع', 'الأولوية', 'الحالة', 'أُنشئ', 'أُغلق', 'آخر إجراء متخذ', 'التقييم']);
    h2.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Tajawal' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B5C' } }; });
    all.filter(i => inM(i.created_at) || inM(i.closed_at)).sort((a, b) => a.unit.localeCompare(b.unit) || a.id - b.id).forEach(i => ws2.addRow([i.ref, uname(i.unit), O.K[i.kind]?.name || i.kind, i.title, O.F[i.facility_id]?.name || '', i.location || '', PR[i.priority]?.ar, ST[i.status]?.ar, (i.created_at || '').slice(0, 10), (i.closed_at || '').slice(0, 10), i.last_action || '', i.rating || '']).eachCell(c => c.font = { name: 'Tajawal' }));
    ws2.columns.forEach((c, i) => c.width = [14, 14, 18, 40, 24, 20, 10, 14, 12, 12, 50, 8][i]);
    download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `تقرير-الخدمات-الفنية-${m}.xlsx`);
  };
}
