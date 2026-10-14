// ===== التطبيق: الدخول، التوجيه، الهيكل =====
import { sb, session, loadSession, loadRef, REF, role, isAdmin, canRead, ROLES, q } from './api.js';
import { $, $$, esc, toast, err, modal, field, inp, formData, ico } from './ui.js';
import { skeleton, markRoute, watch } from './fx.js';
import './govlink.js';

const app = $('#app');
const DEPTS = [['PRJ', 'المشاريع', '27A8DF'], ['FAC', 'المرافق', '2E8B57'], ['MNT', 'الصيانة', 'B8860B'], ['SAF', 'الأمن والسلامة', 'B03A48'], ['BME', 'الصيانة الطبية', 'A0522D'], ['MED', 'التجهيزات الطبية', '6B4C9A'], ['GEN', 'الخدمات العامة', '5F7A5B'], ['IT', 'تقنية المعلومات', '1B6CA8'], ['TRN', 'الحركة', '0E7C86']];
// القائمة: الإدارة ← الأقسام (كل قسم يتفتح على صفحاته مثل المشاريع) ← النظام
const TOP = [['tsd', 'لوحة الإدارة', 'dash', 'ops'], ['today', 'يومي', 'sun', 'read'], ['ops', 'البلاغات والطلبات', 'inbox', 'any'], ['map', 'الخريطة', 'map', 'read'], ['fm', 'متابعة أنظمة المنشآت', 'pulse', 'ops'], ['gov', 'الحوكمة والأدلة', 'book', 'ops'], ['fleet', 'سيارات المقر', 'car', 'any']];
const SYS = [['leaves', 'الإجازات والتغطية', 'clock', 'read'], ['report', 'التقارير', 'chart', 'read'], ['briefs', 'العروض التنفيذية', 'print', 'read'], ['performance', 'الأداء والإنجازات', 'users', 'admin'], ['me', 'إنجازاتي', 'users', ['engineer', 'clerk']], ['ref', 'المرجع الفني', 'book', 'read'], ['settings', 'الإعدادات والإشعارات', 'bell', 'any'], ['admin', 'الإدارة', 'cog', 'admin']];
const ASSET_U = ['MNT', 'BME', 'IT', 'MED', 'SAF', 'GEN'], PLAN_U = ['MNT', 'BME', 'SAF', 'IT', 'GEN', 'FAC', 'TRN'];
const SUBS = c => c === 'PRJ' ? [['dept/PRJ/work', 'طلبات وأعمال القسم', 'inbox', 'ops'], ['dashboard', 'لوحة المشاريع', 'chart', 'read'], ['projects', 'المشاريع', 'folder', 'read'], ['tasks', 'المهام', 'check', 'read'], ['requests', 'طلبات المشاريع', 'inbox', 'read'], ['challenges', 'التحديات والمخاطر', 'alert', 'read'], ['treports', 'التقارير الفنية والمحاضر', 'file', 'read'], ['submittals', 'الاعتمادات', 'stamp', 'read'], ['documents', 'المستندات الرسمية', 'doc', 'read'], ['drawings', 'المخططات', 'draw', 'read'], ['payments', 'المستخلصات', 'coins', 'read'], ['dept/PRJ/manual', 'دليل القسم', 'book', 'ops'], ['dept/PRJ/team', 'الفريق', 'users', 'ops']]
  : [...(c === 'TRN' ? [['dept/TRN/fleet', 'لوحة الحركة', 'car', 'ops'], ['dept/TRN/trips', 'سجل الحركة', 'clip2', 'ops'], ['dept/TRN/vehicles', 'الأسطول', 'key', 'ops']] : []), ['dept/' + c + '/work', 'الأعمال والبلاغات', 'inbox', 'ops'], ...(c === 'FAC' ? [['dept/FAC/locations', 'المواقع والغرف', 'map', 'ops']] : []), ...(['FAC', 'MNT'].includes(c) ? [['fm', 'متابعة أنظمة المنشآت', 'pulse', 'ops']] : []), ...(ASSET_U.includes(c) ? [['dept/' + c + '/assets', 'الأصول', 'stamp', 'ops']] : []), ...(PLAN_U.includes(c) ? [['dept/' + c + '/plans', 'الأعمال المخططة', 'clock', 'ops']] : []), ['dept/' + c + '/manual', 'دليل القسم', 'book', 'ops'], ['dept/' + c + '/team', 'الفريق', 'users', 'ops']];
// قائمة مسطحة للبحث ⌘K
const NAV = [...TOP, ...DEPTS.flatMap(([c, n]) => [['dept/' + c, 'قسم ' + n, 'dash', 'ops'], ...SUBS(c).filter(x => x[0].startsWith('dept/') || c === 'PRJ').map(x => [x[0], x[0].startsWith('dept/') ? `${x[1]} — ${n}` : x[1], x[2], x[3]])]), ...SYS];
const ALIAS = { treport: 'treports', project: 'projects' };
// الوصول: read = من يقرأ المنصة كاملة، ops = هم + موظفو الأقسام الفنية، any = الجميع (ومنهم المبلّغ)، أو دور/أدوار محددة
const OPS_ROLES = ['facility', 'tech'];
const allow = a => { const r = role(); if (!a || a === 'any') return true; if (a === 'read') return canRead(); if (a === 'ops') return canRead() || OPS_ROLES.includes(r); return Array.isArray(a) ? a.includes(r) : r === a; };
const ROUTE_ACCESS = { tsd: 'ops', dept: 'ops', ops: 'any', fleet: 'any', fm: 'ops', gov: 'ops', settings: 'any', open: 'read' };
const home = () => { const r = role(); if (r === 'requester') return 'ops'; if (r === 'head' && session.profile?.unit) return 'dept/' + session.profile.unit; if (OPS_ROLES.includes(r)) return session.profile?.unit ? 'dept/' + session.profile.unit : 'fm'; return isAdmin() ? 'tsd' : 'today'; };
const bottomFor = () => { const r = role(), u = session.profile?.unit;
  if (r === 'requester') return [['ops/mine', 'طلباتي', 'inbox'], ['ops/new', 'طلب جديد', 'plus'], ['settings', 'الإعدادات', 'cog'], ['more', 'المزيد', 'menu']];
  if (u === 'TRN' && OPS_ROLES.concat('head').includes(r)) return [['dept/TRN/fleet', 'الحركة', 'car'], ['dept/TRN/trips', 'السجل', 'clip2'], ['ops', 'البلاغات', 'inbox'], ['more', 'المزيد', 'menu']];
  if (OPS_ROLES.includes(r)) return [[u ? 'dept/' + u : 'tsd', 'قسمي', 'dash'], ['ops', 'البلاغات', 'inbox'], ['fm', 'الأنظمة', 'pulse'], ['more', 'المزيد', 'menu']];
  return [[isAdmin() ? 'tsd' : 'today', isAdmin() ? 'الإدارة' : 'يومي', isAdmin() ? 'dash' : 'sun'], ['ops', 'البلاغات', 'inbox'], ['projects', 'المشاريع', 'folder'], ['tasks', 'المهام', 'check'], ['more', 'المزيد', 'menu']]; };

let projIndex = null;
function shell(inner) {
  const p = session.profile;
  const icon = n => n.startsWith('dot:') ? `<i class="ndot" style="--c:#${n.slice(4)}"></i>` : ico(n);
  const link = n => `<a href="#/${n[0]}" data-nav="${n[0]}">${icon(n[2])}<span>${n[1]}</span><span class="cnt" data-cnt="${n[0]}"></span></a>`;
  let opened = []; try { opened = JSON.parse(localStorage.getItem('ahc_open') || '[]'); } catch (e) { }
  const links = () => { const top = TOP.filter(n => allow(n[3])), sys = SYS.filter(n => allow(n[3])), deps = allow('ops') ? DEPTS : [];
    return top.map(link).join('') + (deps.length ? '<div class="sec">الأقسام</div>' + deps.map(([c, nm, col]) => { const sub = SUBS(c).filter(x => allow(x[3]));
      return `<div class="ngrp ${opened.includes(c) ? 'open' : ''}" data-grp="${c}" style="--c:#${col}"><a href="#/dept/${c}" data-nav="dept/${c}">${icon('dot:' + col)}<span>${nm}</span><span class="cnt" data-cnt="dept/${c}"></span><i class="nchev" data-tg="${c}" title="عرض صفحات القسم">${ico('chev')}</i></a><div class="nsub">${sub.map(link).join('')}</div></div>`; }).join('') : '')
      + '<div class="sec">النظام</div>' + sys.map(link).join(''); };
  const mini = (() => { try { return localStorage.getItem('ahc_mini') === '1'; } catch (e) { return false; } })();
  app.innerHTML = `<div class="app2 ${mini ? 'mini' : ''}" id="app2">
    <aside class="side"><a class="brand" href="#/${home()}"><img src="assets/logo.png" alt=""><div><b>إدارة الخدمات الفنية</b><small>تجمع الأحساء الصحي</small></div></a>
      <nav class="snav">${links()}</nav>
      <button class="fold" id="fold" title="طيّ القائمة">${ico('fold')}</button></aside>
    <div class="mainwrap">
      <div class="topbar"><div class="gsearch" id="gsearch">${ico('search')}<span>ابحث عن صفحة أو مشروع أو قسم…</span><kbd>⌘K</kbd></div><span class="sp"></span><span id="bellhost"></span>
        <div class="user"><div><b>${esc(p?.full_name || '')}</b><small>${esc(ROLES[role()] || '')}</small></div><div class="av">${esc((p?.full_name || '?').trim().charAt(0))}</div></div>
        <button class="ib" id="logout" title="خروج">${ico('logout')}</button></div>
      <main id="main">${inner || ''}</main></div></div>
    <nav class="bottom">${bottomFor().map(b => `<a href="${b[0] === 'more' ? '#' : '#/' + b[0]}" data-nav="${b[0]}" ${b[0] === 'more' ? 'id="moreBtn"' : ''}>${ico(b[2])}${b[1]}<span class="cnt" data-cnt="${b[0]}"></span></a>`).join('')}</nav>
    <div class="sheet" id="sheet"><div class="sh">${links()}<a href="#" id="logout2">${ico('logout')}<span>خروج</span></a></div></div>`;
  const out = async () => { await sb.auth.signOut(); location.hash = ''; boot(); };
  $('#logout').onclick = out; $('#logout2').onclick = e => { e.preventDefault(); out(); };
  $('#fold').onclick = () => { const a = $('#app2'); a.classList.toggle('mini'); try { localStorage.setItem('ahc_mini', a.classList.contains('mini') ? '1' : '0'); } catch (e) { } };
  $('#moreBtn').onclick = e => { e.preventDefault(); $('#sheet').classList.toggle('show'); };
  $('#sheet').addEventListener('click', e => { if (e.target.closest('[data-tg]')) return; if (e.target === $('#sheet') || e.target.closest('a')) $('#sheet').classList.remove('show'); });
  // فتح وإغلاق صفحات القسم في القائمة دون الانتقال
  document.querySelectorAll('[data-tg]').forEach(t => t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const c = t.dataset.tg;
    $$(`.ngrp[data-grp="${c}"]`).forEach(g => g.classList.toggle('open')); const isOpen = $(`.snav .ngrp[data-grp="${c}"]`)?.classList.contains('open');
    try { let o = JSON.parse(localStorage.getItem('ahc_open') || '[]'); o = isOpen ? [...new Set([...o, c])] : o.filter(x => x !== c); localStorage.setItem('ahc_open', JSON.stringify(o)); } catch (er) { } }));
  $('#gsearch').onclick = openPalette;
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
  opsCounts();
  if (canRead() || ['facility', 'tech', 'requester'].includes(role())) import('./notif.js').then(n => { n.mountBell($('#bellhost')); n.registerSW(); });
}
// عدّادات القائمة: الجديد غير المستلم في كل قسم (يظهر بجانب القسم)، وطلباتي المنتظرة لتأكيدي
async function opsCounts() {
  try { if (!(canRead() || OPS_ROLES.includes(role()) || role() === 'requester')) return;
    const { data } = await sb.from('ops_items').select('unit,status,requester_id,created_by').in('status', ['new', 'verify']).limit(2000);
    const c = {}; (data || []).forEach(i => { if (i.status === 'new') c['dept/' + i.unit] = (c['dept/' + i.unit] || 0) + 1; if (i.status === 'verify' && (i.requester_id === session.user.id || i.created_by === session.user.id)) { c.ops = (c.ops || 0) + 1; c['ops/mine'] = (c['ops/mine'] || 0) + 1; } });
    setCounts(c); } catch (e) { }
}
function setNav(k) {
  let key = ALIAS[k] || k;
  if (!$$(`[data-nav="${key}"]`).length && key.startsWith('dept/')) key = key.split('/').slice(0, 2).join('/');
  if (!$$(`[data-nav="${key}"]`).length && key.startsWith('dept/')) key = 'tsd';
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.getAttribute('data-nav') === key));
  // القسم الذي فيه الصفحة الحالية يتفتح تلقائياً (المشروع داخل قسم المشاريع)
  $$('.ngrp').forEach(g => { if (g.querySelector('a.on')) g.classList.add('open', 'cur'); else g.classList.remove('cur'); });
  $('#sheet')?.classList.remove('show');
}
export function setCounts(map) { Object.entries(map).forEach(([k, v]) => $$(`[data-cnt="${k}"]`).forEach(el => { el.textContent = v || ''; el.classList.toggle('show', !!v); })); }
async function openPalette() {
  if ($('.pal')) return;
  if (!projIndex) { try { projIndex = canRead() ? await q(sb.from('projects').select('id,name,ref,stage,category').eq('archived', false).order('name')) : []; } catch (e) { projIndex = []; } }
  let opsIdx = []; try { if (canRead() || OPS_ROLES.includes(role())) { const { data } = await sb.from('ops_items').select('id,ref,title,unit,status').order('id', { ascending: false }).limit(400); opsIdx = data || []; } } catch (e) { }
  const pages = NAV.filter(n => n[0] !== 'sec' && allow(n[3])).map(n => ({ id: null, name: (n[0].startsWith('dept/') ? 'قسم ' : '') + n[1], link: '#/' + n[0], kind: n[0].startsWith('dept/') ? 'قسم' : 'صفحة' }));
  const w = document.createElement('div'); w.className = 'pal'; w.innerHTML = `<div class="box"><input id="palq" placeholder="اكتب اسم مشروع أو صفحة أو قسم، أو رقم عمل مثل MNT-26-…" autocomplete="off"><div class="list" id="pall"></div></div>`;
  document.body.appendChild(w); const inp = $('#palq', w), list = $('#pall', w); let sel = 0, items = [];
  const norm = s => (s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const render = () => { const qs = norm(inp.value.trim()); items = qs ? [...projIndex.filter(p => norm(p.name + ' ' + (p.ref || '')).includes(qs)).slice(0, 8).map(p => ({ name: p.name, link: '#/project/' + p.id, kind: p.category || 'مشروع' })), ...opsIdx.filter(o => norm(o.ref + ' ' + o.title).includes(qs)).slice(0, 6).map(o => ({ name: o.title, link: '#/ops/list?id=' + o.id, kind: o.ref })), ...pages.filter(p => norm(p.name).includes(qs)).slice(0, 4)] : pages.slice(0, 8);
    sel = 0; list.innerHTML = items.map((it, i) => `<a class="res ${i === sel ? 'sel' : ''}" href="${it.link}" data-i="${i}">${ico(it.id === null && it.kind === 'صفحة' ? 'dash' : 'folder')}<span>${esc(it.name)}</span><small>${esc(it.kind)}</small></a>`).join('') || '<p class="muted" style="padding:14px">لا نتائج</p>'; };
  const close = () => w.remove();
  inp.oninput = render; render(); inp.focus();
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); } else if (e.key === 'Enter') { if (items[sel]) { location.hash = items[sel].link; close(); } return; } else if (e.key === 'Escape') { close(); return; } else return; $$('.res', list).forEach((a, i) => a.classList.toggle('sel', i === sel)); };
  w.addEventListener('click', e => { if (e.target === w) close(); if (e.target.closest('.res')) close(); });
}

// ---------- شاشات الدخول
function authScreen(mode = 'login') {
  const isLogin = mode === 'login', isReset = mode === 'reset';
  app.innerHTML = `<div class="auth"><div class="authbox">
    <img src="assets/logo.png" alt="" class="alogo">
    <h1>إدارة الخدمات الفنية</h1><p class="muted">تجمع الأحساء الصحي — الأقسام والمشاريع والتشغيل في منصة واحدة</p>
    <form id="af">
      ${!isLogin && !isReset ? field('الاسم الكامل', inp('full_name', '', 'required autocomplete="name"')) : ''}
      ${field('البريد الإلكتروني', inp('email', '', 'type="email" required autocomplete="email" dir="ltr"'))}
      ${!isReset ? field('كلمة المرور', inp('password', '', 'type="password" required minlength="8" autocomplete="current-password" dir="ltr"')) : ''}
      <button class="btn primary wide" id="asub">${isLogin ? 'دخول' : isReset ? 'إرسال رابط إعادة التعيين' : 'إنشاء حساب'}</button>
    </form>
    <div class="alinks">${isLogin ? `<a href="#" data-m="signup">إنشاء حساب جديد</a> · <a href="#" data-m="reset">نسيت كلمة المرور</a>` : `<a href="#" data-m="login">العودة لتسجيل الدخول</a>`}</div>
    <p class="muted small">الحسابات الجديدة تحتاج اعتماد مدير النظام قبل الوصول للبيانات.</p></div></div>`;
  $$('[data-m]').forEach(a => a.onclick = e => { e.preventDefault(); authScreen(a.getAttribute('data-m')); });
  $('#af').onsubmit = async e => {
    e.preventDefault(); const f = formData(e.target); const btn = $('#asub'); btn.disabled = true;
    try {
      if (isLogin) { const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.password }); if (error) throw new Error(error.message.includes('Invalid') ? 'البريد أو كلمة المرور غير صحيحة' : error.message); await boot(); }
      else if (isReset) { const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.origin + location.pathname }); if (error) throw error; toast('أُرسل رابط إعادة التعيين إلى بريدك'); authScreen('login'); }
      else { const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { full_name: f.full_name.trim() } } }); if (error) throw new Error(error.message.includes('already') ? 'هذا البريد مسجل مسبقاً' : error.message); if (data.session) await boot(); else { toast('تم إنشاء الحساب — تحقق من بريدك لتأكيده ثم سجّل الدخول'); authScreen('login'); } }
    } catch (er) { err(er); } finally { btn.disabled = false; }
  };
}
function pendingScreen() {
  shell(`<div class="auth"><div class="authbox"><h1>بانتظار الاعتماد</h1><p>تم إنشاء حسابك (${esc(session.profile?.email || '')}) وهو بانتظار اعتماد مدير النظام وتحديد صلاحياتك. تواصل مع إدارة الخدمات الفنية لتفعيل حسابك (موظفو المنشآت يُفعَّلون كمُبلّغين لرفع البلاغات ومتابعتها)، ثم أعد تحميل الصفحة.</p><button class="btn primary" onclick="location.reload()">إعادة التحميل</button></div></div>`);
}
async function newPasswordScreen() {
  shell(`<div class="auth"><div class="authbox"><h1>كلمة مرور جديدة</h1><form id="pf">${field('كلمة المرور الجديدة', inp('password', '', 'type="password" required minlength="8" dir="ltr"'))}<button class="btn primary wide">حفظ</button></form></div></div>`);
  $('#pf').onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const { error } = await sb.auth.updateUser({ password: f.password }); if (error) return err(error); toast('تم تغيير كلمة المرور'); location.hash = '#/' + home(); route(); };
}

// ---------- التوجيه
let refLoading = null;
async function ensureRef() { if (REF.loaded) return; if (!refLoading) refLoading = loadRef(false, msg => { const m = $('#main'); if (m) m.innerHTML = `<div class="loading"><div class="spin"></div>${esc(msg)}</div>`; }); await refLoading; }
async function route() {
  if (!session.user) return authScreen('login');
  const r0 = role();
  if (!canRead() && !OPS_ROLES.includes(r0) && r0 !== 'requester') return pendingScreen();
  const h = location.hash.replace(/^#\/?/, '') || home();
  const top = h.split(/[/?]/)[0];
  if (!canRead() && !allow(ROUTE_ACCESS[top] || 'read')) { location.hash = '#/' + home(); return; }
  const [path, query] = h.split('?'); const params = new URLSearchParams(query || '');
  const parts = path.split('/'); const main = $('#main'); if (!main) shell('');
  const m = $('#main'); setNav(parts[0] === 'dept' ? parts.slice(0, parts[2] && parts[2] !== 'overview' ? 3 : 2).join('/') : (parts[0] === 'ops' && ['mine', 'new'].includes(parts[1]) && role() === 'requester') ? parts[0] + '/' + parts[1] : parts[0]); watch(m);
  const rkey = parts.slice(0, 2).join('/'); if (m._rkey !== rkey && parts[0] !== 'ref') { m._rkey = rkey; markRoute(); m.innerHTML = skeleton(parts[0] === 'project' ? 'page' : ['dashboard', 'today', 'performance', 'me', 'tsd', 'dept'].includes(parts[0]) ? 'page' : 'list'); m.classList.remove('pagein'); void m.offsetWidth; m.classList.add('pagein'); }
  try {
    if (parts[0] === 'today') { const { mountToday } = await import('./today.js'); await mountToday(m, params); }
    else if (parts[0] === 'dashboard') { const { mountDashboard } = await import('./projects.js'); await mountDashboard(m); }
    else if (parts[0] === 'projects') { const { mountProjects } = await import('./projects.js'); await mountProjects(m, params); }
    else if (parts[0] === 'project') { await ensureRef(); const { mountProject } = await import('./projects.js'); await mountProject(m, parts[1], parts[2] || 'overview', parts[3]); }
    else if (parts[0] === 'tasks') { const { mountTasks } = await import('./tasks.js'); await mountTasks(m, params); }
    else if (parts[0] === 'requests') { const { mountRequests } = await import('./tasks.js'); await mountRequests(m, params); }
    else if (parts[0] === 'challenges') { const { mountChallenges } = await import('./challenges.js'); await mountChallenges(m, params); }
    else if (parts[0] === 'payments') { const { mountPayments } = await import('./payments.js'); await mountPayments(m, params); }
    else if (parts[0] === 'treports') { const { mountTReports } = await import('./treports.js'); await mountTReports(m, params); }
    else if (parts[0] === 'treport') { const t = await import('./treports.js'); if (parts[1] === 'new') await t.mountTReportEditor(m, null, params); else if (parts[2] === 'edit') await t.mountTReportEditor(m, parts[1], params); else await t.mountTReport(m, parts[1]); }
    else if (parts[0] === 'documents') { const { mountDocsAll } = await import('./docs.js'); await mountDocsAll(m, params); }
    else if (parts[0] === 'drawings') { const { mountDrawingsAll } = await import('./docs.js'); await mountDrawingsAll(m, params); }
    else if (parts[0] === 'performance') { const pf = await import('./perf.js'); if (parts[1]) await pf.mountPerson(m, parts[1], params); else await pf.mountPerformance(m, params); }
    else if (parts[0] === 'me') { const { mountMyWork } = await import('./perf.js'); await mountMyWork(m, params); }
    else if (parts[0] === 'open') { const k = parts[1], id = parts[2]; history.replaceState(null, '', location.pathname + location.search + '#/today'); setNav('today'); const { mountToday } = await import('./today.js'); await mountToday(m, new URLSearchParams()); const { openQuick } = await import('./quick.js'); openQuick({ q: { k, id: /^\d+$/.test(id) ? +id : id }, link: '#/today' }, () => route()); }
    else if (parts[0] === 'tsd') { const d = await import('./depts.js'); if (parts[1] === 'report') await d.mountTSDReport(m, params); else await d.mountTSD(m); }
    else if (parts[0] === 'dept') { const { mountDept } = await import('./depts.js'); await mountDept(m, parts[1], parts[2] || 'overview', params); }
    else if (parts[0] === 'fleet') { const { mountMyFleet } = await import('./fleet.js'); await mountMyFleet(m); }
    else if (parts[0] === 'ops') { const { mountOps } = await import('./ops.js'); await mountOps(m, parts[1] || '', params); }
    else if (parts[0] === 'fm') { const { mountFM } = await import('./fm.js'); await mountFM(m, parts[1] || 'dash', params); }
    else if (parts[0] === 'gov') { const { mountGov } = await import('./gov.js'); await mountGov(m, parts[1] || 'start', parts[2] || null, params); }
    else if (parts[0] === 'map') { const { mountMap } = await import('./map.js'); await mountMap(m, params); }
    else if (parts[0] === 'briefs') { const br = await import('./briefs.js'); if (parts[1]) await br.mountBrief(m, +parts[1], params); else await br.mountBriefs(m, params); }
    else if (parts[0] === 'leaves') { const { mountLeaves } = await import('./leaves.js'); await mountLeaves(m, params); }
    else if (parts[0] === 'settings') { const { mountSettings } = await import('./notif.js'); await mountSettings(m); }
    else if (parts[0] === 'submittals') { const { mountSubmittals } = await import('./docs.js'); await mountSubmittals(m, params); }
    else if (parts[0] === 'report') { const { mountReport } = await import('./report.js'); await mountReport(m, parts[1] || 'general', params); }
    else if (parts[0] === 'ref') { await ensureRef(); const { mountRef } = await import('./ref.js'); const code = parts[1] ? parts[1].replace(/-/g, ' ') : null; if (!m.querySelector('.refwrap')) mountRef(m, code); else if (code) { const { go } = await import('./ref.js'); go(code); } }
    else if (parts[0] === 'admin') { if (!isAdmin()) return location.hash = '#/dashboard'; const { mountAdmin } = await import('./admin.js'); await mountAdmin(m, parts[1] || 'users'); }
    else location.hash = '#/' + home();
  } catch (e) { err(e); m.innerHTML = `<div class="empty-boq">تعذّر التحميل: ${esc(e.message || e)}</div>`; }
}
window.addEventListener('hashchange', route);
// مراقبة صدور نسخة جديدة من المنصة
let verNotified = false;
async function checkVersion() { if (verNotified || !window.AHC_CONFIG?.version) return; try { const t = await (await fetch('config.js?t=' + Date.now(), { cache: 'no-store' })).text(); const m = t.match(/version:\s*"([^"]+)"/); if (m && m[1] !== window.AHC_CONFIG.version) { verNotified = true; let tried = ''; try { tried = sessionStorage.getItem('ahc_ver_try') || ''; } catch (e) { } if (tried === m[1]) return; const b = document.createElement('div'); b.className = 'verbar'; b.innerHTML = '⬆ صدرت نسخة جديدة من المنصة — <b>اضغط هنا للتحديث</b>'; b.onclick = () => { try { sessionStorage.setItem('ahc_ver_try', m[1]); } catch (e) { } location.replace(location.pathname + '?r=' + Date.now() + location.hash); }; document.body.appendChild(b); } } catch (e) { } }
window.addEventListener('hashchange', checkVersion); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); }); setTimeout(checkVersion, 4000);

async function boot() {
  app.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ التحميل…</div>';
  await loadSession();
  if (!session.user) return authScreen('login');
  shell(''); route();
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { loadSession().then(newPasswordScreen); } });
document.addEventListener('DOMContentLoaded', () => { if (!window.AHC_CONFIG?.url) { app.innerHTML = '<div class="auth"><div class="authbox"><h1>الإعداد غير مكتمل</h1><p>لم تُضبط بيانات الاتصال بقاعدة البيانات.</p></div></div>'; return; } boot(); });
