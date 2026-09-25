// ===== التطبيق: الدخول، التوجيه، الهيكل =====
import { sb, session, loadSession, loadRef, REF, role, isAdmin, canRead, ROLES, q } from './api.js';
import { $, $$, esc, toast, err, modal, field, inp, formData, ico } from './ui.js';

const app = $('#app');
const NAV = [
  ['dashboard', 'لوحة المؤشرات', 'dash'], ['projects', 'المشاريع', 'folder'],
  ['sec', 'المتابعة'],
  ['tasks', 'المهام', 'check'], ['requests', 'الطلبات', 'inbox'], ['treports', 'التقارير الفنية والمحاضر', 'file'],
  ['sec', 'المستندات والمالية'],
  ['submittals', 'الاعتمادات', 'stamp'], ['documents', 'المستندات الرسمية', 'doc'], ['drawings', 'المخططات', 'draw'], ['payments', 'المستخلصات', 'coins'],
  ['sec', 'النظام'],
  ['report', 'التقارير', 'chart'], ['ref', 'المرجع الفني', 'book'], ['settings', 'الإعدادات والإشعارات', 'bell'], ['admin', 'الإدارة', 'cog', 'admin']];
const ALIAS = { treport: 'treports', project: 'projects' };
const BOTTOM = [['dashboard', 'المؤشرات', 'dash'], ['projects', 'المشاريع', 'folder'], ['tasks', 'المهام', 'check'], ['treports', 'التقارير', 'file'], ['more', 'المزيد', 'menu']];

let projIndex = null;
function shell(inner) {
  const p = session.profile;
  const navItems = NAV.filter(n => n[0] !== 'sec' ? (!n[3] || role() === n[3]) : true);
  const links = (cls) => navItems.map(n => n[0] === 'sec' ? `<div class="sec">${n[1]}</div>` : `<a href="#/${n[0]}" data-nav="${n[0]}" class="${cls}">${ico(n[2])}<span>${n[1]}</span><span class="cnt" data-cnt="${n[0]}"></span></a>`).join('');
  const mini = (() => { try { return localStorage.getItem('ahc_mini') === '1'; } catch (e) { return false; } })();
  app.innerHTML = `<div class="app2 ${mini ? 'mini' : ''}" id="app2">
    <aside class="side"><a class="brand" href="#/dashboard"><img src="assets/logo.png" alt=""><div><b>منصة إدارة المشاريع</b><small>تجمع الأحساء الصحي</small></div></a>
      <nav class="snav">${links('')}</nav>
      <button class="fold" id="fold" title="طيّ القائمة">${ico('fold')}</button></aside>
    <div class="mainwrap">
      <div class="topbar"><div class="gsearch" id="gsearch">${ico('search')}<span>ابحث عن مشروع…</span><kbd>⌘K</kbd></div><span style="flex:1"></span><span id="bellhost"></span>
        <div class="user"><div><b>${esc(p?.full_name || '')}</b><small>${esc(ROLES[role()] || '')}</small></div><div class="av">${esc((p?.full_name || '?').trim().charAt(0))}</div></div>
        <button class="ib" id="logout" title="خروج">${ico('logout')}</button></div>
      <main id="main">${inner || ''}</main></div></div>
    <nav class="bottom">${BOTTOM.map(b => `<a href="${b[0] === 'more' ? '#' : '#/' + b[0]}" data-nav="${b[0]}" ${b[0] === 'more' ? 'id="moreBtn"' : ''}>${ico(b[2])}${b[1]}<span class="cnt" data-cnt="${b[0]}"></span></a>`).join('')}</nav>
    <div class="sheet" id="sheet"><div class="sh">${links('')}<a href="#" id="logout2">${ico('logout')}<span>خروج</span></a></div></div>`;
  const out = async () => { await sb.auth.signOut(); location.hash = ''; boot(); };
  $('#logout').onclick = out; $('#logout2').onclick = e => { e.preventDefault(); out(); };
  $('#fold').onclick = () => { const a = $('#app2'); a.classList.toggle('mini'); try { localStorage.setItem('ahc_mini', a.classList.contains('mini') ? '1' : '0'); } catch (e) { } };
  $('#moreBtn').onclick = e => { e.preventDefault(); $('#sheet').classList.toggle('show'); };
  $('#sheet').addEventListener('click', e => { if (e.target === $('#sheet') || e.target.closest('a')) $('#sheet').classList.remove('show'); });
  $('#gsearch').onclick = openPalette;
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
  if (canRead()) import('./notif.js').then(n => { n.mountBell($('#bellhost')); n.registerSW(); });
}
function setNav(k) { const key = ALIAS[k] || k; $$('[data-nav]').forEach(a => a.classList.toggle('on', a.getAttribute('data-nav') === key)); $('#sheet')?.classList.remove('show'); }
export function setCounts(map) { Object.entries(map).forEach(([k, v]) => $$(`[data-cnt="${k}"]`).forEach(el => { el.textContent = v || ''; el.classList.toggle('show', !!v); })); }
async function openPalette() {
  if ($('.pal')) return;
  if (!projIndex) { try { projIndex = await q(sb.from('projects').select('id,name,ref,stage,category').eq('archived', false).order('name')); } catch (e) { projIndex = []; } }
  const pages = NAV.filter(n => n[0] !== 'sec' && (!n[3] || role() === n[3])).map(n => ({ id: null, name: n[1], link: '#/' + n[0], kind: 'صفحة' }));
  const w = document.createElement('div'); w.className = 'pal'; w.innerHTML = `<div class="box"><input id="palq" placeholder="اكتب اسم المشروع أو الصفحة…" autocomplete="off"><div class="list" id="pall"></div></div>`;
  document.body.appendChild(w); const inp = $('#palq', w), list = $('#pall', w); let sel = 0, items = [];
  const norm = s => (s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const render = () => { const qs = norm(inp.value.trim()); items = qs ? [...projIndex.filter(p => norm(p.name + ' ' + (p.ref || '')).includes(qs)).slice(0, 8).map(p => ({ name: p.name, link: '#/project/' + p.id, kind: p.category || 'مشروع' })), ...pages.filter(p => norm(p.name).includes(qs)).slice(0, 4)] : pages.slice(0, 8);
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
    <h1>منصة إدارة المشاريع</h1><p class="muted">إدارة الخدمات الفنية — قسم المشاريع</p>
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
  shell(`<div class="auth"><div class="authbox"><h1>بانتظار الاعتماد</h1><p>تم إنشاء حسابك (${esc(session.profile?.email || '')}) وهو بانتظار اعتماد مدير النظام وتحديد صلاحياتك. تواصل مع رئيس قسم المشاريع لتفعيل حسابك، ثم أعد تحميل الصفحة.</p><button class="btn primary" onclick="location.reload()">إعادة التحميل</button></div></div>`);
}
async function newPasswordScreen() {
  shell(`<div class="auth"><div class="authbox"><h1>كلمة مرور جديدة</h1><form id="pf">${field('كلمة المرور الجديدة', inp('password', '', 'type="password" required minlength="8" dir="ltr"'))}<button class="btn primary wide">حفظ</button></form></div></div>`);
  $('#pf').onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const { error } = await sb.auth.updateUser({ password: f.password }); if (error) return err(error); toast('تم تغيير كلمة المرور'); location.hash = '#/dashboard'; route(); };
}

// ---------- التوجيه
let refLoading = null;
async function ensureRef() { if (REF.loaded) return; if (!refLoading) refLoading = loadRef(false, msg => { const m = $('#main'); if (m) m.innerHTML = `<div class="loading"><div class="spin"></div>${esc(msg)}</div>`; }); await refLoading; }
async function route() {
  if (!session.user) return authScreen('login');
  if (!canRead()) return pendingScreen();
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, query] = h.split('?'); const params = new URLSearchParams(query || '');
  const parts = path.split('/'); const main = $('#main'); if (!main) shell('');
  const m = $('#main'); setNav(parts[0]);
  try {
    if (parts[0] === 'dashboard') { const { mountDashboard } = await import('./projects.js'); await mountDashboard(m); }
    else if (parts[0] === 'projects') { const { mountProjects } = await import('./projects.js'); await mountProjects(m, params); }
    else if (parts[0] === 'project') { await ensureRef(); const { mountProject } = await import('./projects.js'); await mountProject(m, parts[1], parts[2] || 'overview', parts[3]); }
    else if (parts[0] === 'tasks') { const { mountTasks } = await import('./tasks.js'); await mountTasks(m, params); }
    else if (parts[0] === 'requests') { const { mountRequests } = await import('./tasks.js'); await mountRequests(m, params); }
    else if (parts[0] === 'payments') { const { mountPayments } = await import('./payments.js'); await mountPayments(m, params); }
    else if (parts[0] === 'treports') { const { mountTReports } = await import('./treports.js'); await mountTReports(m, params); }
    else if (parts[0] === 'treport') { const t = await import('./treports.js'); if (parts[1] === 'new') await t.mountTReportEditor(m, null, params); else if (parts[2] === 'edit') await t.mountTReportEditor(m, parts[1], params); else await t.mountTReport(m, parts[1]); }
    else if (parts[0] === 'documents') { const { mountDocsAll } = await import('./docs.js'); await mountDocsAll(m, params); }
    else if (parts[0] === 'drawings') { const { mountDrawingsAll } = await import('./docs.js'); await mountDrawingsAll(m, params); }
    else if (parts[0] === 'settings') { const { mountSettings } = await import('./notif.js'); await mountSettings(m); }
    else if (parts[0] === 'submittals') { const { mountSubmittals } = await import('./docs.js'); await mountSubmittals(m, params); }
    else if (parts[0] === 'report') { const { mountReport } = await import('./report.js'); await mountReport(m, parts[1] || 'general', params); }
    else if (parts[0] === 'ref') { await ensureRef(); const { mountRef } = await import('./ref.js'); const code = parts[1] ? parts[1].replace(/-/g, ' ') : null; if (!m.querySelector('.refwrap')) mountRef(m, code); else if (code) { const { go } = await import('./ref.js'); go(code); } }
    else if (parts[0] === 'admin') { if (!isAdmin()) return location.hash = '#/dashboard'; const { mountAdmin } = await import('./admin.js'); await mountAdmin(m, parts[1] || 'users'); }
    else location.hash = '#/dashboard';
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
