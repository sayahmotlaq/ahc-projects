// ===== أدوات الواجهة =====
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = s => (s || '').toString().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْ]/g, '').replace(/\s+/g, ' ').trim();
export const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = n => Math.round(Number(n) || 0).toLocaleString('en');
export const money = v => (Number(v) === 0 || v == null) ? '—' : Number(v).toLocaleString('en');
export const dateAr = d => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
export const idOf = code => code.replace(/\s+/g, '-');
export const list = (arr, ol = true) => (!arr || !arr.length) ? '<p class="muted">—</p>' : (ol ? '<ol>' : '<ul>') + arr.map(x => `<li>${esc(x)}</li>`).join('') + (ol ? '</ol>' : '</ul>');

export function toast(msg, kind = '') {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast show ' + kind; clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
export function err(e) { console.error(e); toast(typeof e === 'string' ? e : (e?.message || 'حدث خطأ'), 'bad'); }

export function modal(html, { title = '', wide = false, onOpen } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'mwrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="mhead"><h3>${esc(title)}</h3><button class="x" data-x>✕</button></div><div class="mbody">${html}</div></div>`;
    document.body.appendChild(wrap);
    let done = false; const close = v => { if (done) return; done = true; resolve(v); if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return wrap.remove(); wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 150); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.hasAttribute('data-x')) close(null); });
    wrap.close = close; onOpen && onOpen(wrap, close);
  });
}
export async function confirm(msg, ok = 'تأكيد', danger = false) {
  return modal(`<p style="font-size:14px;line-height:1.8">${esc(msg)}</p><div class="btnrow end"><button class="btn" data-x>إلغاء</button><button class="btn ${danger ? 'danger-solid' : 'primary'}" data-ok>${esc(ok)}</button></div>`,
    { title: 'تأكيد', onOpen: (w, close) => { $('[data-ok]', w).onclick = () => close(true); } });
}
export function field(label, inner, cls = '') { return `<label class="fld ${cls}"><span>${esc(label)}</span>${inner}</label>`; }
export const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
export const sel = (name, opts, val, attrs = '') => `<select name="${name}" ${attrs}>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
// حقول المبالغ: تقبل الفواصل والأرقام العربية والكسور، وتُنسَّق تلقائياً
export const parseMoney = v => { if (v === null || v === undefined) return ''; let t = String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/[,٬\s]/g, '').replace(/[^\d.\-]/g, ''); return t === '' || t === '-' || t === '.' ? '' : t; };
export const fmtMoney = v => { const t = parseMoney(v); if (t === '') return ''; const n = Number(t); if (!isFinite(n)) return ''; return n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
export const money_inp = (name, val = '', attrs = '') => `<input name="${name}" class="money" inputmode="decimal" dir="ltr" autocomplete="off" value="${esc(fmtMoney(val))}" ${attrs}>`;
document.addEventListener('focusin', e => { const i = e.target; if (i.classList?.contains('money')) { i.value = parseMoney(i.value); i.select?.(); } });
document.addEventListener('focusout', e => { const i = e.target; if (i.classList?.contains('money')) i.value = fmtMoney(i.value); });
export function formData(form) { const o = {}; new FormData(form).forEach((v, k) => o[k] = v); form.querySelectorAll?.('input.money').forEach(i => { if (i.name) o[i.name] = parseMoney(i.value); }); return o; }
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
export function debounce(fn, ms = 250) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

// ===== الأيقونات الخطية
export const ICONS = {
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  map: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  stamp: '<path d="M5 21h14M6 17h12v-3a3 3 0 0 0-3-3h-1l1-6a3 3 0 0 0-6 0l1 6H9a3 3 0 0 0-3 3z"/>',
  doc: '<path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4M8 12h8M8 16h5"/>',
  draw: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M3 15h6"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M15 9.5c3 .3 6 1.4 6 3v5c0 1.7-2.7 3-6 3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14a5 5 0 0 1 6 5"/>',
  fold: '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M14 8l4 4-4 4M18 12H9"/>',
  chev: '<path d="m15 6-6 6 6 6"/>', back: '<path d="m9 6 6 6-6 6"/>',
  // مجموعة خطية موحدة لأنواع الأعمال والأقسام (حزمة 83)
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.3-.4-.4-2.3z"/>',
  steth: '<path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 12v2.5a5 5 0 0 0 10 0V12"/><circle cx="19" cy="10" r="2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
  shield: '<path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z"/>',
  shieldok: '<path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M3 21h18M8 7h3M8 11h3M8 15h3"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  siren: '<path d="M7 17v-5a5 5 0 0 1 10 0v5"/><path d="M5 17h14v3H5zM12 3v2M4.6 6.6 6 8M19.4 6.6 18 8"/>',
  clipok: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
  clip2: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  flame: '<path d="M12 3c1 3 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.2-4.8 0 2 1 3.3 2 3.3 0-3-1.2-5.3.8-8.5z"/>',
  flameoff: '<path d="M12 3c1 3 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.2-4.8 0 2 1 3.3 2 3.3 0-3-1.2-5.3.8-8.5z"/><path d="M4 4l16 16"/>',
  recycle: '<path d="M7 19H4.5l3-5.2M17 19h2.5l-3-5.2M9.5 7.5 12 3.5l2.5 4M8 19h8"/><path d="m6 11 1.5 2.8L10 12M18 11l-1.5 2.8L14 12M10.5 6.5 12 3.5l1.5 3"/>',
  crane: '<path d="M5 21V4l10 2v3M5 7h15l-3 3M15 9v5M3 21h18"/><rect x="13" y="14" width="4" height="3" rx=".5"/>',
  cone: '<path d="M9.5 4h5L19 19H5z"/><path d="M8 10h8M6.8 14h10.4M3 19h18"/>',
  barrier: '<rect x="3" y="7" width="18" height="6" rx="1"/><path d="M8 7l-3 6M13 7l-3 6M18 7l-3 6M6 13v7M18 13v7"/>',
  permit: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
  power: '<path d="M12 3v8"/><path d="M6.5 7a8 8 0 1 0 11 0"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2"/>',
  car: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18M7 7l-1 5M17 7l1 5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M17 6l2 2M14.5 8.5l2 2"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  hospital: '<path d="M4 21V8l8-5 8 5v13M3 21h18M12 9v6M9 12h6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  megaphone: '<path d="M3 10v4h4l9 5V5l-9 5z"/><path d="M19.5 9a4 4 0 0 1 0 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.5-1.6L7 14"/>',
  okc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', clip: '<path d="m16 7-7.5 7.5a2.1 2.1 0 0 0 3 3L19 10a4.2 4.2 0 0 0-6-6L5.5 11.5a6.4 6.4 0 0 0 9 9L20 15"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-6-6-9 9"/>',
  print: '<path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z"/>', edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
// أيقونة نوع العمل: الاسم من ops_kinds.icon إن كان من المجموعة، وإلا حسب الرمز
const KICON = { mnt: 'wrench', bme: 'steth', it: 'monitor', gen: 'sparkle', saf: 'shield', fac: 'building', med: 'box', prj: 'ruler', emerg: 'siren', handover: 'clipok', drill: 'flame', dispose: 'recycle', spare: 'cog', mspec: 'clip2', siteprep: 'crane', worksite: 'cone', closure: 'barrier', permit: 'permit', impair: 'flameoff', shutdown: 'power', ppm: 'calendar', accept: 'box', recall: 'alert', access: 'key', ceval: 'star', vfix: 'car', vacc: 'alert' };
export const kic = (k, cls = '') => ico(ICONS[k?.icon] ? k.icon : (KICON[k?.code] || 'doc'), cls);
export const ico = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// ---------- «أضف إلى التقويم» لحدث واحد (Google أو ملف .ics لتقويم آيفون/Outlook)
export const calBtn = (ev, cls = 'btn sm') => `<button type="button" class="${cls}" data-cal="${esc(JSON.stringify(ev))}">${ico('clock')} أضف إلى التقويم</button>`;
export function bindCal(root = document) {
  $$('[data-cal]', root).forEach(b => { if (b._cal) return; b._cal = true; b.onclick = e => { e.preventDefault(); e.stopPropagation(); const ev = JSON.parse(b.getAttribute('data-cal')); calMenu(ev); }; });
}
function calMenu(ev) {
  const d = (ev.date || '').replace(/-/g, ''); if (!d) return toast('لا يوجد تاريخ لهذا البند', 'bad');
  const nx = new Date(ev.date); nx.setDate(nx.getDate() + 1); const d2 = nx.toISOString().slice(0, 10).replace(/-/g, '');
  const link = ev.url ? location.origin + location.pathname + ev.url : '';
  const details = (ev.desc ? ev.desc + '\n' : '') + link;
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${d}/${d2}&details=${encodeURIComponent(details)}`;
  const e = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AHC Projects//AR', 'BEGIN:VEVENT', `UID:${ev.uid || 'x' + Date.now()}@ahc-projects`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d2}`, `SUMMARY:${e(ev.title)}`, `DESCRIPTION:${e(details)}`, link ? `URL:${link}` : '', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(ev.title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  modal(`<p class="small muted m0">${esc(ev.title)} — ${dateAr(ev.date)}</p><div class="btnrow mt10" style="flex-direction:column;gap:8px"><button class="btn primary" id="calIcs">${ico('clock')} تقويم آيفون / Outlook (ملف تقويم)</button><a class="btn" target="_blank" rel="noopener" href="${g}">تقويم Google</a></div><p class="small muted mt10 m0">للاشتراك التلقائي في كل مواعيدك بلا إضافة يدوية: الإعدادات ← تقويمي.</p>`, { title: 'أضف إلى التقويم', onOpen: (w, close) => { $('#calIcs', w).onclick = () => { download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'event.ics'); close(); }; } });
}
