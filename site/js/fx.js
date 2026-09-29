// ===== نظام الحركة والصقل: هياكل تحميل، عدّ الأرقام، رسم الأشرطة، ظهور متدرج، حالات فارغة =====
// كل الحركات تعتمد على opacity/transform فقط (بلا إعادة تخطيط)، وتُعطَّل عند تفعيل "تقليل الحركة".
export const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let routeAt = 0;
export const markRoute = () => { routeAt = Date.now(); };
const qa = (root, sel) => [...(root.matches?.(sel) ? [root] : []), ...root.querySelectorAll(sel)];

// هيكل تحميل بحسب نوع الصفحة
export function skeleton(kind = 'page') {
  const line = (w = 100, h = 12) => `<i class="sk" style="width:${w}%;height:${h}px"></i>`;
  const card = (n = 3) => `<div class="skc">${Array.from({ length: n }, () => line(60 + Math.round(Math.random() * 35))).join('')}</div>`;
  if (kind === 'kpis') return `<div class="kpis">${Array.from({ length: 4 }, () => `<div class="kpi"><i class="sk" style="width:40%;height:10px"></i><i class="sk" style="width:35%;height:24px"></i><i class="sk" style="width:60%;height:9px"></i></div>`).join('')}</div>`;
  if (kind === 'list') return `<div class="skw">${card(2)}${card(2)}${card(2)}${card(2)}</div>`;
  if (kind === 'tab') return `<div class="skw"><div class="skc">${line(30, 16)}${line(100, 10)}${line(90, 10)}${line(95, 10)}${line(80, 10)}</div></div>`;
  return `<div class="skw"><div class="skh">${line(28, 22)}</div>${skeleton('kpis')}<div class="two">${card(4)}${card(4)}</div></div>`;
}

// عدّ الأرقام في مؤشرات KPI (يحافظ على اللاحقة مثل % أو <small>)
function countUp(b) {
  const tn = [...b.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)); if (!tn) return;
  const raw = tn.textContent; const m = raw.match(/^(\s*[+−-]?)([\d,]+(?:\.\d+)?)(.*)$/); if (!m) return;
  const target = Number(m[2].replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
  const dec = (m[2].split('.')[1] || '').length; const grouped = m[2].includes(','); const t0 = performance.now(); const dur = 650;
  const step = now => { const k = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3); const v = target * e; const s = dec ? v.toFixed(dec) : (grouped ? Math.round(v).toLocaleString('en') : String(Math.round(v))); tn.textContent = m[1] + s + m[3]; if (k < 1) requestAnimationFrame(step); else tn.textContent = raw; };
  requestAnimationFrame(step);
}
// رسم الأشرطة من الصفر إلى قيمتها
function growBars(root) {
  const bars = qa(root, '.bar i, .gt-bar > i, .pbar i, .hb-t .hb-paid'); if (!bars.length) return;
  bars.forEach(i => { i.dataset.w = i.style.width; i.style.transition = 'none'; i.style.width = '0'; });
  void root.offsetWidth;
  bars.forEach(i => { i.style.transition = ''; i.style.width = i.dataset.w; });
}
// ظهور متدرج لأول عناصر القوائم
const STAGGER = '.chlist > .chc, .inbox .it, .kpis > .kpi, .stagecell, .tl .e, .steps .step, .plist tr, table.lst tbody tr';
function stagger(root) {
  qa(root, STAGGER).forEach(el => { if (el.classList.contains('fx-in')) return; const i = [...el.parentElement.children].indexOf(el); if (i > 14) return; el.classList.add('fx-in'); el.style.animationDelay = (i * 28) + 'ms'; });
}
// حالة فارغة برسمة خطية
const EMPTY_SVG = `<svg viewBox="0 0 96 72" aria-hidden="true"><rect x="14" y="14" width="68" height="48" rx="8" fill="var(--bg)" stroke="var(--line)" stroke-width="2"/><path d="M14 26h68" stroke="var(--line)" stroke-width="2"/><circle cx="22" cy="20" r="2" fill="var(--line)"/><circle cx="29" cy="20" r="2" fill="var(--line)"/><path d="M28 40h40M28 48h26" stroke="var(--line)" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="56" r="11" fill="var(--sagebg)" stroke="var(--sage)" stroke-width="2"/><path d="M67 56l3.5 3.5L78 52" fill="none" stroke="var(--sage)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function emptyStates(root) {
  qa(root, '.empty-boq:not(.fx-empty)').forEach(el => { el.classList.add('fx-empty'); const txt = el.innerHTML; el.innerHTML = `${EMPTY_SVG}<div>${txt}</div>`; });
}

// نقطة الدخول: تُستدعى على كل جزء يُضاف للصفحة
export function enhance(root) {
  if (!root || root.nodeType !== 1) return;
  emptyStates(root);
  if (reduced()) return;
  const fresh = Date.now() - routeAt < 2500;
  if (fresh) qa(root, '.kpi b').forEach(countUp);
  growBars(root);
  stagger(root);
}

// مراقب خفيف: يعالج ما يُضاف إلى #main مرة واحدة لكل إضافة (مجمّعة)
export function watch(main) {
  if (!main || main._fx) return; main._fx = true;
  let pending = new Set(), h = null;
  const flush = () => { h = null; const nodes = [...pending]; pending = new Set(); nodes.forEach(n => { if (n.isConnected && !n.closest?.('.fx-done')) enhance(n); }); };
  new MutationObserver(muts => { muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) pending.add(n); })); if (!h) h = setTimeout(flush, 40); }).observe(main, { childList: true, subtree: true });
}
