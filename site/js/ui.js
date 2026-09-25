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
    const close = v => { wrap.remove(); resolve(v); };
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
export function formData(form) { const o = {}; new FormData(form).forEach((v, k) => o[k] = v); return o; }
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
export function debounce(fn, ms = 250) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

// ===== الأيقونات الخطية
export const ICONS = {
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
  fold: '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M14 8l4 4-4 4M18 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', clip: '<path d="m16 7-7.5 7.5a2.1 2.1 0 0 0 3 3L19 10a4.2 4.2 0 0 0-6-6L5.5 11.5a6.4 6.4 0 0 0 9 9L20 15"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-6-6-9 9"/>',
  print: '<path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z"/>', edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export const ico = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
