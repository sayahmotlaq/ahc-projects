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
