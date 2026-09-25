// ===== التطبيق: الدخول، التوجيه، الهيكل =====
import { sb, session, loadSession, loadRef, REF, role, isAdmin, canRead, ROLES } from './api.js';
import { $, $$, esc, toast, err, modal, field, inp, formData } from './ui.js';

const app = $('#app');
const NAV = [
  ['dashboard', 'لوحة المؤشرات'], ['projects', 'المشاريع'],
  ['work', 'المهام والطلبات', null, [['tasks', 'المهام'], ['requests', 'الطلبات']]],
  ['docs', 'المستندات', null, [['documents', 'المستندات الرسمية'], ['drawings', 'المخططات'], ['submittals', 'الاعتمادات']]],
  ['reports', 'التقارير', null, [['treports', 'التقارير الفنية والمحاضر'], ['report', 'التقرير التنفيذي'], ['report/custom', 'تقرير مخصص']]],
  ['payments', 'المستخلصات'], ['ref', 'المرجع الفني'], ['admin', 'الإدارة', 'admin']];
const PARENT = {}; NAV.forEach(n => (n[3] || []).forEach(c => PARENT[c[0].split('/')[0]] = n[0]));

function shell(inner) {
  const p = session.profile;
  app.innerHTML = `<header class="top">
    <img class="logo" src="assets/logo.png" alt="تجمع الأحساء الصحي">
    <nav class="nav">${NAV.filter(n => !n[2] || role() === n[2]).map(n => n[3] ? `<div class="grp" data-nav="${n[0]}"><a href="#/${n[3][0][0]}" class="gt" data-grp>${n[1]} <small>▾</small></a><div class="dd">${n[3].map(c => `<a href="#/${c[0]}" data-nav="${c[0]}">${c[1]}</a>`).join('')}</div></div>` : `<a href="#/${n[0]}" data-nav="${n[0]}">${n[1]}</a>`).join('')}</nav>
    <span style="flex:1"></span>
    <div class="who"><b>${esc(p?.full_name || '')}</b><span>${esc(ROLES[role()] || '')}</span></div>
    <button class="btn sm" id="logout">خروج</button>
    <button class="btn sm menubtn2" id="navbtn">☰</button>
  </header><main id="main">${inner || ''}</main>`;
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.hash = ''; boot(); };
  $('#navbtn').onclick = () => $('.nav').classList.toggle('show');
  $$('.grp .gt').forEach(a => a.onclick = e => { if (matchMedia('(max-width:900px)').matches || e.detail === 0) { e.preventDefault(); const g = a.parentElement; const open = g.classList.contains('open'); $$('.grp.open').forEach(x => x.classList.remove('open')); if (!open) g.classList.add('open'); } });
  document.addEventListener('click', e => { if (!e.target.closest('.grp')) $$('.grp.open').forEach(x => x.classList.remove('open')); });
}
function setNav(k, sub) { const key = sub ? k + '/' + sub : k; $$('[data-nav]').forEach(a => { const v = a.getAttribute('data-nav'); a.classList.toggle('on', v === key || (!sub && v === k) || v === PARENT[k]); }); $('.nav')?.classList.remove('show'); $$('.grp.open').forEach(x => x.classList.remove('open')); }

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
  const m = $('#main'); setNav(parts[0] === 'treport' ? 'treports' : parts[0], parts[0] === 'report' && parts[1] === 'custom' ? 'custom' : null);
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
