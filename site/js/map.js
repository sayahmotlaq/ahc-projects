// ===== الخريطة التفاعلية: المشاريع على خريطة الأحساء بألوان حسب ما ينتظر الرئيس + المرافق (Leaflet محلياً، خرائط OpenStreetMap) =====
import { sb, q, session, isAdmin, STAGES, stageOf } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, ico, dateAr } from './ui.js';
import { loadDashData, isLate } from './projects.js';
import { openProjectDrawer } from './quick.js';

const AHSA = [25.38, 49.59]; // مركز الأحساء الافتراضي
export const F_KIND = { hospital: 'مستشفى', center: 'مركز صحي', other: 'موقع آخر' };
// استخراج الإحداثيات من رابط خرائط Google (الطويل) أو من نص "lat, lng"
export function parseLatLng(s) {
  s = String(s || '').trim(); if (!s) return null;
  const pats = [/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination|center)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /^(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)$/];
  for (const re of pats) { const m = s.match(re); if (m) { const lat = +m[1], lng = +m[2]; if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng }; } }
  return null;
}
export const isShortLink = s => /(^|\/\/)(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.com\/\?.*cid=)/i.test(String(s || ''));
export const SHORT_MSG = 'الرابط مختصر ولا يحمل الإحداثيات. افتحه في المتصفح وانسخ الرابط الطويل من شريط العنوان، أو اضغط 📍 وحدد الموقع على الخريطة.';
export function loadLeaflet() {
  return new Promise((res, rej) => { if (window.L) return res(); if (!$('#lfcss')) { const l = document.createElement('link'); l.id = 'lfcss'; l.rel = 'stylesheet'; l.href = 'assets/leaflet/leaflet.css'; document.head.appendChild(l); } const s = document.createElement('script'); s.src = 'assets/leaflet/leaflet.js'; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة الخريطة')); document.head.appendChild(s); });
}
const tiles = map => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

// ---------- منتقي موقع (نافذة): نقر على الخريطة أو لصق رابط
export async function pickLocation(init, title = 'تحديد الموقع') {
  await loadLeaflet();
  return new Promise(resolve => {
    let cur = init && init.lat ? { lat: +init.lat, lng: +init.lng } : null;
    modal(`<div class="pickmap"><div class="btnrow"><input id="pkLink" placeholder="الصق رابط خرائط Google (الطويل) أو إحداثيات 25.38, 49.59" value="${cur ? cur.lat.toFixed(6) + ', ' + cur.lng.toFixed(6) : ''}" dir="ltr" style="flex:1"><button type="button" class="btn sm" id="pkGo">تحديد</button></div><div id="pkMap" class="lmap" style="height:52vh;margin:8px 0"></div><p class="muted small m0">انقر على الخريطة لتحديد الموقع أو اسحب العلامة. <span id="pkPos">${cur ? '' : 'لم يُحدد بعد'}</span></p><div class="btnrow end mt10"><button type="button" class="btn" data-x>إلغاء</button><button type="button" class="btn ghost" id="pkClear">إزالة الموقع</button><button type="button" class="btn primary" id="pkOk">اعتماد الموقع</button></div></div>`, { title, wide: true, onOpen: (w, close) => {
      const map = L.map($('#pkMap', w), { zoomControl: true }).setView(cur ? [cur.lat, cur.lng] : AHSA, cur ? 15 : 11); tiles(map);
      let mk = null; const place = (lat, lng, pan) => { cur = { lat, lng }; if (mk) mk.setLatLng([lat, lng]); else { mk = L.marker([lat, lng], { draggable: true }).addTo(map); mk.on('dragend', () => { const p = mk.getLatLng(); place(p.lat, p.lng, false); }); } $('#pkPos', w).textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`; $('#pkLink', w).value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`; if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 15)); };
      if (cur) place(cur.lat, cur.lng, false);
      map.on('click', e => place(e.latlng.lat, e.latlng.lng, false));
      setTimeout(() => map.invalidateSize(), 50);
      $('#pkGo', w).onclick = () => { const p = parseLatLng($('#pkLink', w).value); if (!p) return toast(isShortLink($('#pkLink', w).value) ? SHORT_MSG : 'لم أتعرف على إحداثيات في النص — استخدم الرابط الطويل من خرائط Google أو اكتب الإحداثيات', 'bad'); place(p.lat, p.lng, true); };
      $('#pkLink', w).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#pkGo', w).click(); } };
      $('#pkOk', w).onclick = () => { close(); resolve(cur ? { ...cur, link: $('#pkLink', w).value } : null); };
      $('#pkClear', w).onclick = () => { close(); resolve({ lat: null, lng: null, link: '' }); };
    } }).then(v => { if (v === null) resolve(undefined); });
  });
}

// ---------- حالة المشروع على الخريطة (أولوية: عاجل > ينتظرني > تنفيذ > مستلم > دراسة)
export function projectStatus(p, D) {
  const chHigh = D.chs.filter(c => c.project_id === p.id && ((c.score ?? 0) >= 8 || (c.due_date && c.due_date < new Date().toISOString().slice(0, 10))));
  const mine = D.inbox.filter(i => i.q && i.q.pid === p.id);
  const needMe = mine.filter(i => ['request', 'submittal', 'payment', 'change'].includes(i.q.k));
  const late = isLate(p);
  if (late || chHigh.length || p.status_note === 'متعثر') return { k: 'urgent', ar: 'عاجل / متعثر', color: '#C0392B', n: chHigh.length + (late ? 1 : 0), sub: [late ? 'متأخر عن الموعد' : '', chHigh.length ? `${chHigh.length} تحدٍ عالٍ` : ''].filter(Boolean).join(' · ') };
  if (needMe.length) return { k: 'me', ar: 'ينتظر قرارك', color: '#B8860B', n: needMe.length, sub: `${needMe.length} ${needMe.length === 1 ? 'بند ينتظر' : 'بنود تنتظر'} قرارك` };
  if (p.stage === 'execution') return { k: 'exec', ar: 'تحت التنفيذ', color: '#27A8DF', n: 0, sub: `تنفيذ ${Math.round(+p.progress_actual || 0)}٪` };
  if (['handover', 'warranty', 'closed'].includes(p.stage)) return { k: 'done', ar: 'مستلم', color: '#2E8B57', n: 0, sub: stageOf(p.stage).ar };
  return { k: 'pre', ar: 'دراسة / طرح', color: '#8A94A0', n: 0, sub: stageOf(p.stage).ar };
}

// ---------- صفحة الخريطة
export async function mountMap(root, params) {
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الخريطة</h1><span class="sp"></span>${isAdmin() ? '<a class="btn sm" href="#/admin/facilities">المرافق ومواقعها</a>' : ''}</div><div class="loading"><div class="spin"></div>جارٍ تحميل الخريطة…</div>`;
  let D, facs;
  try { [D, facs] = await Promise.all([loadDashData(), q(sb.from('facilities').select('*').eq('active', true).order('sort').order('name'))]); await loadLeaflet(); } catch (e) { return root.innerHTML = `<div class="empty-boq">تعذّر تحميل الخريطة: ${esc(e.message || e)}</div>`; }
  const fById = Object.fromEntries(facs.map(f => [f.id, f]));
  const active = D.projects.filter(p => !p.archived && !['closed', 'cancelled'].includes(p.stage));
  const located = [], unlocated = [];
  active.forEach(p => { const f = p.facility_id ? fById[p.facility_id] : null; const lat = p.lat ?? f?.lat, lng = p.lng ?? f?.lng; const st = projectStatus(p, D); if (lat != null && lng != null) located.push({ p, lat: +lat, lng: +lng, st, fac: f, own: p.lat != null }); else unlocated.push({ p, st }); });
  const counts = { urgent: 0, me: 0, exec: 0, pre: 0, done: 0 }; located.forEach(x => counts[x.st.k]++);
  const RANK = { urgent: 0, me: 1, exec: 2, pre: 3, done: 4 };
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الخريطة</h1><span class="muted small">${located.length} مشروعاً على الخريطة${unlocated.length ? ` · ${unlocated.length} بلا موقع` : ''}</span><span class="sp"></span>${isAdmin() ? '<a class="btn sm" href="#/admin/facilities">المرافق ومواقعها</a>' : ''}</div>
    <div class="mapfilters"><button class="mf on" data-f="all">الكل <b>${located.length}</b></button><button class="mf" data-f="urgent"><i style="background:#C0392B"></i>عاجل / متعثر <b>${counts.urgent}</b></button><button class="mf" data-f="me"><i style="background:#B8860B"></i>ينتظر قرارك <b>${counts.me}</b></button><button class="mf" data-f="exec"><i style="background:#27A8DF"></i>تحت التنفيذ <b>${counts.exec}</b></button><button class="mf" data-f="pre"><i style="background:#8A94A0"></i>دراسة / طرح <b>${counts.pre}</b></button><button class="mf" data-f="done"><i style="background:#2E8B57"></i>مستلم <b>${counts.done}</b></button></div>
    <div id="pmap" class="lmap big"></div>
    ${unlocated.length ? `<details class="pcard mt12"><summary><b>مشاريع بلا موقع (${unlocated.length})</b> <span class="muted small">— اربط المشروع بمنشأة من نموذج المشروع أو ضع رابط موقعه</span></summary><div class="chips mt8">${unlocated.map(x => `<a class="chip" href="#/project/${x.p.id}" style="border-color:${x.st.color}">${esc(x.p.name)}</a>`).join('')}</div></details>` : ''}`;
  const map = L.map($('#pmap', root), { zoomControl: true }).setView(AHSA, 11); tiles(map);
  // تجميع المشاريع ذات الموقع نفسه (المنشأة) في علامة واحدة
  const groups = {}; located.forEach(x => { const key = x.fac && !x.own ? 'f' + x.fac.id : x.lat.toFixed(5) + ',' + x.lng.toFixed(5); (groups[key] = groups[key] || { lat: x.lat, lng: x.lng, fac: x.own ? null : x.fac, items: [] }).items.push(x); });
  let layer = L.layerGroup().addTo(map); let filter = 'all';
  const draw = () => {
    layer.clearLayers(); const bounds = [];
    Object.values(groups).forEach(g => {
      const items = g.items.filter(x => filter === 'all' || x.st.k === filter); if (!items.length) return;
      items.sort((a, b) => RANK[a.st.k] - RANK[b.st.k]); const top = items[0].st; const n = items.length;
      const html = `<div class="pm ${top.k}" style="--c:${top.color}"><span>${n > 1 ? n : ''}</span></div>`;
      const mk = L.marker([g.lat, g.lng], { icon: L.divIcon({ className: 'pmw', html, iconSize: [36, 36], iconAnchor: [18, 18] }), title: g.fac ? g.fac.name : items[0].p.name }).addTo(layer);
      mk.bindTooltip(`<b>${esc(g.fac ? g.fac.name : items[0].p.name)}</b><br>${n > 1 ? `${n} مشاريع · ` : ''}${esc(top.ar)}${top.sub ? ' — ' + esc(top.sub) : ''}`, { direction: 'top', offset: [0, -14] });
      mk.on('click', () => { if (n === 1) return openProjectDrawer(items[0].p.id, located.map(x => x.p)); mk.bindPopup(`<div class="pmlist"><b>${esc(g.fac ? g.fac.name : 'الموقع')}</b>${items.map(x => `<a href="#" data-pid="${x.p.id}"><i style="background:${x.st.color}"></i><span>${esc(x.p.name)}</span><small>${esc(x.st.sub || x.st.ar)}</small></a>`).join('')}</div>`, { maxWidth: 340 }).openPopup(); });
      bounds.push([g.lat, g.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  };
  draw(); setTimeout(() => map.invalidateSize(), 80);
  map.on('popupopen', e => { $$('[data-pid]', e.popup.getElement()).forEach(a => a.onclick = ev => { ev.preventDefault(); map.closePopup(); openProjectDrawer(a.dataset.pid, located.map(x => x.p)); }); });
  $$('.mf', root).forEach(b => b.onclick = () => { filter = b.dataset.f; $$('.mf', root).forEach(x => x.classList.toggle('on', x === b)); draw(); });
}

// ---------- إدارة المرافق (تبويب في الإدارة)
export async function mountFacilities(t) {
  const rows = await q(sb.from('facilities').select('*').order('sort').order('name'));
  const nProj = await q(sb.from('projects').select('facility_id').eq('archived', false));
  t.innerHTML = `<div class="toolbar"><p class="muted small m0">المرافق (المستشفيات والمراكز) بإحداثياتها؛ كل مشروع مرتبط بمنشأة يظهر على الخريطة في موقعها ما لم يُحدد له موقع خاص.</p><span class="sp"></span><button class="btn primary sm" id="fNew">＋ منشأة</button></div>
    ${rows.length ? `<table class="lst"><thead><tr><th>المنشأة</th><th>النوع</th><th>الموقع</th><th class="c">المشاريع</th><th></th></tr></thead><tbody>${rows.map(f => `<tr class="${f.active ? '' : 'off'}"><td><b>${esc(f.name)}</b></td><td>${F_KIND[f.kind] || f.kind}</td><td>${f.lat != null ? `<span class="badge full">محدد</span> <small class="muted" dir="ltr">${(+f.lat).toFixed(5)}, ${(+f.lng).toFixed(5)}</small>` : '<span class="badge bad">غير محدد</span>'}</td><td class="c">${nProj.filter(p => p.facility_id === f.id).length}</td><td><button class="btn sm" data-loc="${f.id}">${f.lat != null ? 'تعديل الموقع' : 'تحديد الموقع'}</button> <button class="btn sm ghost" data-ed="${f.id}">تعديل</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-boq">لا مرافق بعد. أضف المستشفيات والمراكز ثم حدد موقع كل منها بالنقر على الخريطة أو بلصق رابط خرائط Google.</div>'}`;
  const reload = () => mountFacilities(t);
  const form = f => { const v = f || { name: '', kind: 'hospital', map_link: '', sort: rows.length + 1, active: true }; modal(`<form id="f" class="pgrid">${field('اسم المنشأة', inp('name', v.name, 'required'), 'wide')}${field('النوع', sel('kind', Object.entries(F_KIND), v.kind))}${field('الترتيب', inp('sort', v.sort ?? 0, 'type="number"'))}${field('رابط خرائط Google (اختياري — تُستخرج الإحداثيات تلقائياً)', inp('map_link', v.map_link || '', 'dir="ltr"'), 'wide')}<label class="chk wide"><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}> فعّالة</label><div class="btnrow end wide">${f ? '<button type="button" class="btn ghost" id="fDel" style="color:#A6503B">حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: f ? 'تعديل منشأة' : 'منشأة جديدة', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const d = formData(e.target); const row = { name: d.name.trim(), kind: d.kind, sort: +d.sort || 0, map_link: d.map_link.trim(), active: !!d.active }; const ll = parseLatLng(row.map_link); if (ll) { row.lat = ll.lat; row.lng = ll.lng; } else if (row.map_link && isShortLink(row.map_link)) toast(SHORT_MSG, 'bad'); try { if (f) await q(sb.from('facilities').update(row).eq('id', f.id)); else await q(sb.from('facilities').insert(row)); close(); toast(ll ? 'حُفظت المنشأة واستُخرج موقعها من الرابط' : 'حُفظت المنشأة'); reload(); } catch (er) { err(er); } };
    $('#fDel', w) && ($('#fDel', w).onclick = async () => { if (!await confirm('حذف المنشأة؟ تبقى المشاريع لكن بلا موقع موروث.', 'حذف', true)) return; await q(sb.from('facilities').delete().eq('id', f.id)); close(); reload(); });
  } }); };
  $('#fNew', t).onclick = () => form(null);
  $$('[data-ed]', t).forEach(b => b.onclick = () => form(rows.find(x => x.id === +b.dataset.ed)));
  $$('[data-loc]', t).forEach(b => b.onclick = async () => { const f = rows.find(x => x.id === +b.dataset.loc); const r = await pickLocation(f, 'موقع ' + f.name); if (r === undefined) return; try { await q(sb.from('facilities').update({ lat: r.lat, lng: r.lng, map_link: r.link || '' }).eq('id', f.id)); toast('حُفظ الموقع'); reload(); } catch (er) { err(er); } });
}
