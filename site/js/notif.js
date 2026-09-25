// ===== مركز الإشعارات (الجرس) + إشعارات الجهاز (Web Push) =====
import { sb, q, session } from './api.js';
import { $, $$, esc, dateAr, toast, err } from './ui.js';

export const N_KINDS = { task: 'المهام', request: 'الطلبات', treport: 'التقارير الفنية', comment: 'التعليقات', payment: 'المستخلصات', submittal: 'الاعتمادات', challenge: 'التحديات العالية', stage: 'تغيير المراحل', stale: 'مشاريع بلا تحديث' };
const ICON = { task: '✅', request: '📨', treport: '📋', comment: '💬', payment: '💰', submittal: '📐', challenge: '⚠️', stage: '🚩', stale: '⏳', info: 'ℹ️' };
let cache = [], unread = 0, timer = null, open = false;
const ago = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `منذ ${Math.floor(m / 60)} س` : dateAr(d); };

export async function refresh() {
  if (!session.user) return;
  try {
    cache = await q(sb.from('notifications').select('*').order('id', { ascending: false }).limit(40));
    unread = cache.filter(n => !n.read_at).length;
    const b = $('#nbell'); if (b) { b.classList.toggle('has', unread > 0); $('#ncount').textContent = unread > 99 ? '99+' : unread; }
    try { if (navigator.setAppBadge) { unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge(); } } catch (e) { }
    if (open) renderList();
  } catch (e) { }
}
export function mountBell(host) {
  host.insertAdjacentHTML('beforeend', `<div class="nwrap"><button class="nbell" id="nbell" title="الإشعارات">🔔<span id="ncount">0</span></button><div class="npanel" id="npanel"><div class="nhead"><b>الإشعارات</b><span style="flex:1"></span><button class="btn sm" id="nread">تعليم الكل كمقروء</button><a class="btn sm" href="#/settings">⚙</a></div><div id="nlist"></div></div></div>`);
  $('#nbell').onclick = e => { e.stopPropagation(); open = !open; $('#npanel').classList.toggle('show', open); if (open) renderList(); };
  document.addEventListener('click', e => { if (open && !e.target.closest('.nwrap')) { open = false; $('#npanel')?.classList.remove('show'); } });
  $('#nread').onclick = async () => { const ids = cache.filter(n => !n.read_at).map(n => n.id); if (ids.length) await q(sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)); refresh(); };
  refresh(); clearInterval(timer); timer = setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
function renderList() {
  const l = $('#nlist'); if (!l) return;
  l.innerHTML = cache.length ? cache.map(n => `<a class="nitem ${n.read_at ? '' : 'new'}" href="${esc(n.link || '#/dashboard')}" data-n="${n.id}"><span class="nic">${ICON[n.kind] || ICON.info}</span><span class="nt"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<em>${ago(n.created_at)}</em></span></a>`).join('') : '<p class="muted" style="padding:14px">لا توجد إشعارات.</p>';
  $$('[data-n]', l).forEach(a => a.onclick = async () => { const n = cache.find(x => x.id === +a.getAttribute('data-n')); open = false; $('#npanel').classList.remove('show'); if (n && !n.read_at) { n.read_at = new Date().toISOString(); await q(sb.from('notifications').update({ read_at: n.read_at }).eq('id', n.id)); refresh(); } });
}

// ---------- إشعارات الجهاز
const VAPID = () => window.AHC_CONFIG?.vapid || '';
const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...b].map(c => c.charCodeAt(0))); };
export function pushSupport() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent); const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { ok: false, why: isIOS && !standalone ? 'على آيفون: أضف المنصة إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحها من الأيقونة لتفعيل الإشعارات.' : 'هذا المتصفح لا يدعم إشعارات الجهاز.' };
  if (!VAPID()) return { ok: false, why: 'إشعارات الجهاز غير مفعّلة على الخادم بعد.' };
  return { ok: true };
}
export async function registerSW() { if (!('serviceWorker' in navigator)) return null; try { return await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('sw', e); return null; } }
export async function currentSub() { const reg = await navigator.serviceWorker?.getRegistration(); return reg ? reg.pushManager.getSubscription() : null; }
export async function enablePush() {
  const s = pushSupport(); if (!s.ok) throw new Error(s.why);
  const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('لم يُمنح الإذن — يمكنك تفعيله من إعدادات الجهاز');
  const reg = (await registerSW()) || (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID()) });
  const j = sub.toJSON();
  await q(sb.from('push_subscriptions').upsert({ user_id: session.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 120) }, { onConflict: 'endpoint' }));
  return sub;
}
export async function disablePush() { const sub = await currentSub(); if (sub) { await q(sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)); await sub.unsubscribe(); } }

// ---------- صفحة الإعدادات
export async function mountSettings(root) {
  const prof = await q(sb.from('profiles').select('notify_prefs,full_name,phone,title').eq('id', session.user.id).single());
  const prefs = prof.notify_prefs || {}; const kinds = prefs.kinds || {};
  const sup = pushSupport(); const sub = sup.ok ? await currentSub().catch(() => null) : null;
  const subs = await q(sb.from('push_subscriptions').select('id,ua,created_at').eq('user_id', session.user.id).order('id'));
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الإعدادات والإشعارات</h1></div>
    <div class="two">
    <div class="pcard"><h2><span class="ic"></span>إشعارات هذا الجهاز</h2>
      ${sup.ok ? `<p class="muted">${sub ? '✅ الإشعارات مفعّلة على هذا الجهاز.' : 'فعّل الإشعارات ليصلك تنبيه على هذا الجهاز حتى والمنصة مغلقة.'}</p><div class="btnrow">${sub ? '<button class="btn" id="pOff">إيقاف على هذا الجهاز</button><button class="btn" id="pTest">إرسال إشعار تجريبي</button>' : '<button class="btn primary" id="pOn">🔔 تفعيل الإشعارات على هذا الجهاز</button>'}</div>` : `<div class="alert warn">${esc(sup.why)}</div>`}
      ${subs.length ? `<h3 class="sub-h">الأجهزة المفعّلة (${subs.length})</h3><ul class="rlist">${subs.map(s => `<li>${esc(devName(s.ua))} <span class="muted">— ${dateAr(s.created_at)}</span></li>`).join('')}</ul>` : ''}
    </div>
    <div class="pcard"><h2><span class="ic"></span>ما الذي يصلني على الجهاز؟</h2><p class="muted small">كل الإشعارات تظهر دائماً في الجرس داخل المنصة؛ هنا تختار ما يُدفع منها إلى جوالك.</p>
      <label class="chk" style="margin-bottom:8px"><input type="checkbox" id="pushAll" ${prefs.push === false ? '' : 'checked'}> إرسال الإشعارات إلى أجهزتي</label>
      <div class="chips">${Object.entries(N_KINDS).map(([k, v]) => `<label class="chip"><input type="checkbox" data-k="${k}" ${kinds[k] === false ? '' : 'checked'}> ${v}</label>`).join('')}</div>
      <div class="btnrow end" style="margin-top:10px"><button class="btn primary" id="savePrefs">حفظ التفضيلات</button></div></div></div>`;
  const on = $('#pOn'); if (on) on.onclick = async () => { on.disabled = true; try { await enablePush(); toast('تم تفعيل الإشعارات على هذا الجهاز'); mountSettings(root); } catch (e) { err(e); on.disabled = false; } };
  const off = $('#pOff'); if (off) off.onclick = async () => { try { await disablePush(); toast('أُوقفت الإشعارات على هذا الجهاز'); mountSettings(root); } catch (e) { err(e); } };
  const t = $('#pTest'); if (t) t.onclick = async () => { try { const reg = await navigator.serviceWorker.ready; await reg.showNotification('منصة إدارة المشاريع', { body: 'هذا إشعار تجريبي — الإشعارات تعمل على هذا الجهاز ✅', icon: 'assets/logo.png', dir: 'rtl', lang: 'ar' }); } catch (e) { err(e); } };
  $('#savePrefs').onclick = async () => { const k = {}; $$('[data-k]').forEach(i => k[i.getAttribute('data-k')] = i.checked); try { await q(sb.from('profiles').update({ notify_prefs: { push: $('#pushAll').checked, kinds: k } }).eq('id', session.user.id)); toast('تم حفظ التفضيلات'); } catch (e) { err(e); } };
}
const devName = ua => /iphone/i.test(ua) ? 'آيفون' : /ipad/i.test(ua) ? 'آيباد' : /android/i.test(ua) ? 'أندرويد' : /macintosh/i.test(ua) ? 'ماك' : /windows/i.test(ua) ? 'ويندوز' : 'جهاز';
