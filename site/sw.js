// عامل الخدمة: استقبال إشعارات الجهاز فقط (لا يخزّن ملفات المنصة)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: 'منصة المشاريع', body: e.data ? e.data.text() : '' }; }
  const base = self.registration.scope;
  const p = self.registration.showNotification(d.title || 'منصة إدارة المشاريع', { body: d.body || '', icon: base + 'assets/logo.png', badge: base + 'assets/badge.png', dir: 'rtl', lang: 'ar', tag: 'ahc-' + (d.id || Date.now()), renotify: false, data: { link: d.link || '' } });
  e.waitUntil(Promise.all([p, (self.navigator.setAppBadge && d.badge != null) ? self.navigator.setAppBadge(d.badge).catch(() => { }) : Promise.resolve()]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = self.registration.scope + (e.notification.data?.link || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) { c.navigate(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
