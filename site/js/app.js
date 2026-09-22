// ===== التطبيق: الدخول، التوجيه، الهيكل =====
import { sb, session, loadSession, loadRef, REF, role, isAdmin, canRead, ROLES } from './api.js';
import { $, $$, esc, toast, err, modal, field, inp, formData } from './ui.js';

const app = $('#app');
const NAV = [['dashboard', 'لوحة المؤشرات'], ['projects', 'المشاريع'], ['ref', 'المرجع الفني'], ['admin', 'الإدارة', 'admin']];

function shell(inner) {
  const p = session.profile;
  app.innerHTML = `<header class="top">
    <img class="logo" src="assets/logo.png" alt="تجمع الأحساء الصحي">
    <nav class="nav">${NAV.filter(n => !n[2] || role() === n[2]).map(n => `<a href="#/${n[0]}" data-nav="${n[0]}">${n[1]}</a>`).join('')}</nav>
    <span style="flex:1"></span>
    <div class="who"><b>${esc(p?.full_name || '')}</b><span>${esc(ROLES[role()] || '')}</span></div>
    <button class="btn sm" id="logout">خروج</button>
    <button class="btn sm menubtn2" id="navbtn">☰</button>
  </header><main id="main">${inner || ''}</main>`;
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.hash = ''; boot(); };
  $('#navbtn').onclick = () => $('.nav').classList.toggle('show');
}
function setNav(k) { $$('[data-nav]').forEach(a => a.classList.toggle('on', a.getAttribute('data-nav') === k)); $('.nav')?.classList.remove('show'); }

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
    else if (parts[0] === 'ref') { await ensureRef(); const { mountRef } = await import('./ref.js'); const code = parts[1] ? parts[1].replace(/-/g, ' ') : null; if (!m.querySelector('.refwrap')) mountRef(m, code); else if (code) { const { go } = await import('./ref.js'); go(code); } }
    else if (parts[0] === 'admin') { if (!isAdmin()) return location.hash = '#/dashboard'; const { mountAdmin } = await import('./admin.js'); await mountAdmin(m, parts[1] || 'users'); }
    else location.hash = '#/dashboard';
  } catch (e) { err(e); m.innerHTML = `<div class="empty-boq">تعذّر التحميل: ${esc(e.message || e)}</div>`; }
}
window.addEventListener('hashchange', route);

async function boot() {
  app.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ التحميل…</div>';
  await loadSession();
  if (!session.user) return authScreen('login');
  shell(''); route();
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { loadSession().then(newPasswordScreen); } });
document.addEventListener('DOMContentLoaded', () => { if (!window.AHC_CONFIG?.url) { app.innerHTML = '<div class="auth"><div class="authbox"><h1>الإعداد غير مكتمل</h1><p>لم تُضبط بيانات الاتصال بقاعدة البيانات.</p></div></div>'; return; } boot(); });
