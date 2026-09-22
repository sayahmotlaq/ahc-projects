// ===== المرجع الفني: تصفح + بحث + تحرير (للأدمن) =====
import { sb, REF, isAdmin, itemDetail, invalidateRef, q, session } from './api.js';
import { $, $$, esc, norm, money, idOf, list, toast, err, modal, confirm, field, inp, sel, formData } from './ui.js';

let treeBuilt = false; let current = null;
const UNITS = ['عدد', 'م', 'م²', 'م³', 'كجم', 'طن', 'نقطة', 'مجموعة', 'مقطوعية', 'شهر', 'يوم', 'لتر', 'ساعة', '—'];

export function mountRef(root, code) {
  root.innerHTML = `<div class="refwrap">
    <aside class="refside" id="refside">
      <div class="searchbox"><span class="icon">⌕</span><input id="rq" type="text" placeholder="ابحث بالبند أو الرقم أو المصطلح…" autocomplete="off"><button class="clear" id="rqClear">✕</button></div>
      <div class="hint"><span>شعبة ← قسم ← بند</span><span class="legend"><i class="dotf"></i>مواصفة مفصّلة</span></div>
      <div class="tree" id="rtree"></div>
    </aside>
    <div class="refmain" id="rmain"></div>
    <button class="btn menubtn" id="rmenu">☰ القائمة</button>
  </div>`;
  buildTree(); wireSearch();
  $('#rmenu').onclick = () => $('#refside').classList.toggle('show');
  if (code) go(code); else home();
}

function buildTree() {
  const t = $('#rtree'); t.innerHTML = '';
  REF.divisions.filter(d => d.active !== false).forEach(d => {
    const nAll = d.sections.reduce((a, s) => a + s.items.length, 0);
    const dv = document.createElement('div'); dv.className = 'div'; dv.id = 'd-' + d.code;
    dv.innerHTML = `<div class="row"><span class="chev">▶</span><span class="code">${esc(d.code)}</span><span class="name">${esc(d.ar)}</span><span class="cnt">${nAll}</span></div><div class="secs"></div>`;
    dv.querySelector('.row').onclick = () => { dv.classList.toggle('open'); if (dv.classList.contains('open')) go(d.code); };
    const secs = dv.querySelector('.secs');
    d.sections.forEach(s => {
      const sv = document.createElement('div'); sv.className = 'sec'; sv.id = 's-' + idOf(s.code);
      sv.innerHTML = `<div class="row"><span class="chev">▶</span><span class="code">${esc(s.code)}</span><span class="name">${esc(s.ar)}</span><span class="cnt">${s.items.length}</span></div><div class="its"></div>`;
      sv.querySelector('.row').onclick = e => { e.stopPropagation(); sv.classList.toggle('open'); if (sv.classList.contains('open')) go(s.code); };
      const its = sv.querySelector('.its');
      s.items.forEach(it => {
        const iv = document.createElement('div'); iv.className = 'it' + (it.active === false ? ' off' : ''); iv.id = 'i-' + idOf(it.code);
        iv.innerHTML = `<span class="code">${esc(it.code)}</span><span class="name">${esc(it.ar)}</span>${it.status === 'full' ? '<span class="badge full">مفصّل</span>' : ''}`;
        iv.onclick = e => { e.stopPropagation(); go(it.code); };
        its.appendChild(iv);
      });
      secs.appendChild(sv);
    });
    t.appendChild(dv);
  });
  treeBuilt = true;
}

function node(code) {
  if (REF.byItem[code]) return { type: 'item', ref: REF.byItem[code] };
  if (REF.bySec[code]) return { type: 'sec', ref: REF.bySec[code] };
  if (REF.byDiv[code]) return { type: 'div', ref: REF.byDiv[code] };
  return null;
}
export function go(code) {
  const n = node(code); if (!n) return home();
  current = n; location.hash = '#/ref/' + idOf(code);
  $$('.it.active').forEach(x => x.classList.remove('active'));
  const d = n.ref.div || n.ref; const dv = document.getElementById('d-' + d.code); if (dv) dv.classList.add('open');
  const sec = n.type === 'item' ? n.ref.sec : (n.type === 'sec' ? n.ref : null);
  if (sec) { const sv = document.getElementById('s-' + idOf(sec.code)); if (sv) sv.classList.add('open'); }
  if (n.type === 'item') { const iv = document.getElementById('i-' + idOf(code)); if (iv) { iv.classList.add('active'); iv.scrollIntoView({ block: 'nearest' }); } }
  render(n); $('#rmain').scrollTop = 0;
  if (window.innerWidth <= 900) $('#refside').classList.remove('show');
}
function crumb(n) {
  const parts = [`<a data-go="home">المرجع</a>`];
  const path = n.type === 'item' ? [n.ref.div, n.ref.sec] : n.type === 'sec' ? [n.ref.div] : [];
  path.forEach(p => parts.push(`<span class="sep">›</span><a data-go="${esc(p.code)}"><span class="cd">${esc(p.code)}</span> — ${esc(p.ar)}</a>`));
  parts.push(`<span class="sep">›</span><span><span class="cd">${esc(n.ref.code)}</span> — ${esc(n.ref.ar)}</span>`);
  return `<div class="crumb">${parts.join('')}</div>`;
}
function priceRange(it) { const ps = it.variants.filter(v => v.active !== false).map(v => Number(v.price)).filter(p => p > 0); if (!ps.length) return '—'; const a = Math.min(...ps), b = Math.max(...ps); return a === b ? money(a) : money(a) + ' – ' + money(b); }

async function render(n) {
  const m = $('#rmain'); const adm = isAdmin();
  if (n.type === 'item') {
    const it = n.ref; m.innerHTML = crumb(n) + '<div class="doc"><p class="muted">جارٍ التحميل…</p></div>';
    let d; try { d = await itemDetail(it.code); } catch (e) { return err(e); }
    if (current?.ref !== it) return;
    let h = crumb(n) + `<div class="doc"><div class="dochead"><div class="big">
      <h1>${esc(d.ar)} ${d.active === false ? '<span class="badge skel">موقوف</span>' : ''}</h1><div class="en">${esc(d.en)}</div>
      <div class="meta"><span class="pill code">${esc(d.code)}</span><span class="pill">الشعبة: <b><span class="cd">${esc(it.div.code)}</span> ${esc(it.div.ar)}</b></span><span class="pill">القسم: <b>${esc(it.sec.ar)}</b></span><span class="pill">وحدة القياس: <b>${esc(d.unit || '—')}</b></span><span class="pill">الخيارات: <b>${it.variants.length}</b></span>
      <span class="badge ${d.status === 'full' ? 'full' : 'skel'}">${d.status === 'full' ? 'مواصفة مفصّلة بالكامل' : 'مُسعّر — المواصفة التفصيلية قيد الاستكمال'}</span></div></div>
      <div class="btnrow">${adm ? `<button class="btn primary" data-edit-item>تعديل البند</button><button class="btn" data-add-var>＋ خيار</button>` : ''}<button class="btn" onclick="window.print()">طباعة</button></div></div>`;
    h += `<div class="sec-card"><h2><span class="ic"></span>نطاق البند</h2><p>${esc(d.scope || '—')}</p></div>`;
    h += variantsCard(it, adm);
    if (d.status === 'full') {
      h += `<div class="sec-card"><h2><span class="ic"></span>المتطلبات الفنية</h2>${list(d.specs)}</div>`;
      h += `<div class="sec-card health"><h2><span class="ic"></span>متطلبات المنشآت الصحية ومكافحة العدوى</h2>${list(d.health, false)}</div>`;
      h += `<div class="sec-card accept"><h2><span class="ic"></span>معايير القبول والاختبار</h2>${list(d.accept)}</div>`;
      if (d.method?.length) h += `<div class="sec-card"><h2><span class="ic"></span>طريقة التنفيذ (Method Statement)</h2>${list(d.method)}</div>`;
      h += `<div class="sec-card"><h2><span class="ic"></span>المراجع والمعايير</h2><div class="refs">${(d.refs || []).map(r => `<span class="ref">${esc(r)}</span>`).join('')}</div></div>`;
    } else {
      h += `<div class="skel-note">المواصفة التفصيلية لهذا البند قيد الاستكمال. النطاق والخيارات والأسعار الاسترشادية معتمدة للاستخدام في جداول الكميات.</div>`;
    }
    if (d.notes?.length) h += `<div class="sec-card notes"><h2><span class="ic"></span>ملاحظات</h2>${list(d.notes, false)}</div>`;
    if (d.keywords?.length) h += `<div class="tags">${d.keywords.map(k => `<span class="tag">${esc(k)}</span>`).join('')}</div>`;
    m.innerHTML = h + '</div>';
    if (adm) {
      $('[data-edit-item]', m).onclick = () => editItem(d);
      $('[data-add-var]', m).onclick = () => editVariant(null, it);
      $$('[data-edit-var]', m).forEach(b => b.onclick = () => editVariant(REF.byVar[b.getAttribute('data-edit-var')], it));
    }
  } else if (n.type === 'sec') {
    const s = n.ref;
    let h = crumb(n) + `<div class="doc"><div class="dochead"><div class="big"><h1>${esc(s.ar)}</h1><div class="en">${esc(s.en)}</div>
      <div class="meta"><span class="pill code">${esc(s.code)}</span><span class="pill">الشعبة: <b><span class="cd">${esc(s.div.code)}</span> ${esc(s.div.ar)}</b></span><span class="pill">البنود: <b>${s.items.length}</b></span></div></div>
      <div class="btnrow">${adm ? `<button class="btn primary" data-add-item>＋ بند جديد</button>` : ''}</div></div><div class="grid">`;
    s.items.forEach(it => { h += `<div class="gcard ${it.active === false ? 'off' : ''}" data-go="${esc(it.code)}"><span class="code">${esc(it.code)}</span> ${it.status === 'full' ? '<span class="badge full">مفصّل</span>' : ''}<div class="nm">${esc(it.ar)}</div><div class="en">${esc(it.en)}</div><div class="cov">${it.variants.length} خيار · ${esc(it.unit || '—')} · ${priceRange(it)} ر.س</div></div>`; });
    m.innerHTML = h + '</div></div>';
    if (adm) $('[data-add-item]', m).onclick = () => editItem(null, s);
  } else {
    const d = n.ref; const nAll = d.sections.reduce((a, s) => a + s.items.length, 0);
    let h = crumb(n) + `<div class="doc"><div class="dochead"><div class="big"><h1>الشعبة <span class="cd">${esc(d.code)}</span> — ${esc(d.ar)}</h1><div class="en">Division ${esc(d.code)} — ${esc(d.en)}</div>
      <div class="meta"><span class="pill">الأقسام: <b>${d.sections.length}</b></span><span class="pill">البنود: <b>${nAll}</b></span><span class="pill">الخيارات المُسعّرة: <b>${d.sections.reduce((a, s) => a + s.items.reduce((b, i) => b + i.variants.length, 0), 0)}</b></span></div></div>
      <div class="btnrow">${adm ? `<button class="btn primary" data-add-sec>＋ قسم جديد</button>` : ''}</div></div><div class="grid">`;
    d.sections.forEach(s => { const f = s.items.filter(i => i.status === 'full').length; h += `<div class="gcard" data-go="${esc(s.code)}"><span class="code">${esc(s.code)}</span><div class="nm">${esc(s.ar)}</div><div class="en">${esc(s.en)}</div><div class="cov">${s.items.length} بند · ${s.items.reduce((a, i) => a + i.variants.length, 0)} خيار${f ? ' · ' + f + ' مفصّل' : ''}</div></div>`; });
    m.innerHTML = h + '</div></div>';
    if (adm) $('[data-add-sec]', m).onclick = () => editSection(d);
  }
  $$('[data-go]', m).forEach(el => el.onclick = () => { const c = el.getAttribute('data-go'); c === 'home' ? home() : go(c); });
}
function variantsCard(it, adm) {
  const vs = it.variants; if (!vs.length) return '<div class="sec-card vars"><p class="muted">لا توجد خيارات مُسعّرة بعد.</p></div>';
  let h = `<div class="sec-card vars"><h2><span class="ic"></span>الخيارات والأسعار الاسترشادية <small>(ريال سعودي / وحدة)</small></h2><div class="tblwrap"><table class="vt"><thead><tr><th class="c">الكود</th><th>الخيار</th><th>المواصفة المميِّزة</th><th class="c">الوحدة</th><th class="c">السعر</th>${adm ? '<th class="c"></th>' : ''}</tr></thead><tbody>`;
  vs.forEach(v => { h += `<tr class="${v.active === false ? 'off' : ''}"><td class="c"><span class="cd">${esc(v.code)}</span></td><td><div class="var-ar">${esc(v.ar)}</div><div class="var-en">${esc(v.en)}</div></td><td class="spec">${esc(v.spec || '')}</td><td class="c">${esc(v.unit)}</td><td class="c price">${money(v.price)}</td>${adm ? `<td class="c"><button class="btn sm" data-edit-var="${esc(v.code)}">تعديل</button></td>` : ''}</tr>`; });
  return h + `</tbody></table></div><div class="basis">الأسعار استرشادية لأغراض التقدير الأولي وتُحدَّث دورياً؛ السعر التعاقدي يُحدد بالطرح.</div></div>`;
}
export function home() {
  current = null; location.hash = '#/ref';
  $$('.it.active').forEach(x => x.classList.remove('active'));
  const nI = REF.items.length, nV = REF.variants.length, nF = REF.items.filter(i => i.status === 'full').length;
  $('#rmain').innerHTML = `<div class="doc home">
    <h1>المرجع الفني الموحد لمشاريع تجمع الأحساء الصحي</h1>
    <p class="lead">مرجع مواصفات فنية شامل لمنشآت الرعاية الصحية مبنيّ على تصنيف <b>MasterFormat (CSI)</b>، متوافق مع كود البناء السعودي (SBC) ومعايير CBAHI ومتطلبات وزارة الصحة / الصحة القابضة والمعايير الدولية (ASHRAE، NFPA، FGI، EN/ISO). كل بند له خيارات مُسعّرة تُبنى منها جداول الكميات مباشرة.</p>
    <div class="kpis"><div class="kpi"><b>${REF.divisions.length}</b><span>شعبة</span></div><div class="kpi"><b>${REF.sections.length}</b><span>قسم</span></div><div class="kpi"><b>${nI.toLocaleString('en')}</b><span>بند</span></div><div class="kpi"><b>${nV.toLocaleString('en')}</b><span>خيار مُسعّر</span></div><div class="kpi"><b>${nF.toLocaleString('en')}</b><span>مواصفة مفصّلة</span></div></div>
    <div class="howto">
      <div class="how"><b>التصفح الهرمي</b>اختر الشعبة ثم القسم ثم البند من القائمة الجانبية.</div>
      <div class="how"><b>البحث</b>اكتب أي كلمة عربية أو إنجليزية أو كوداً (مثل «HEPA» أو «سبليت 2 طن» أو «26 51») — يبحث في الأسماء والخيارات والكلمات المفتاحية.</div>
      <div class="how"><b>بطاقة البند</b>النطاق، جدول الخيارات والأسعار، ثم المتطلبات الفنية ومتطلبات المنشآت الصحية ومعايير القبول وطريقة التنفيذ والمراجع.</div>
      ${isAdmin() ? '<div class="how"><b>التحرير (مدير النظام)</b>من داخل أي بند أو قسم تجد أزرار التعديل والإضافة؛ كل تغيير في الأسعار يُحفظ في سجل الأسعار.</div>' : ''}
    </div>
    <div class="disc"><b>ضوابط الاستخدام:</b> القيم الموسومة <b>(يُعتمد)</b> تحتاج اعتماد المهندس الاستشاري للمشروع. عند التعارض بين المراجع تُطبَّق القيمة الأشد تحفظاً. هذا المرجع لا يُغني عن التصميم الهندسي المعتمد لكل مشروع.</div></div>`;
}

// ---------- البحث
function wireSearch() {
  const q = $('#rq'), clear = $('#rqClear'), tree = $('#rtree');
  const run = () => {
    const raw = q.value.trim(); clear.style.display = raw ? 'block' : 'none';
    let box = tree.querySelector('.results');
    if (raw.length < 2) { box && box.remove(); $$('.div', tree).forEach(x => x.style.display = ''); return; }
    const terms = norm(raw).split(' ').filter(Boolean); const scored = [];
    const test = (n, type) => {
      const name = norm(n.ar + ' ' + (n.en || '') + ' ' + n.code);
      const extra = type === 'item' ? norm((n.keywords || []).join(' ') + ' ' + n.variants.map(v => v.ar + ' ' + (v.en || '') + ' ' + (v.spec || '')).join(' ')) : '';
      if (!terms.every(t => name.includes(t) || extra.includes(t))) return;
      let sc = 0; terms.forEach(t => { if (norm(n.code).includes(t)) sc += 6; if (norm(n.ar).includes(t)) sc += 5; if (norm(n.en || '').includes(t)) sc += 3; if (extra.includes(t)) sc += 1; });
      scored.push({ n, type, sc: sc + (type === 'item' ? 1 : 0) });
    };
    REF.divisions.forEach(d => test(d, 'div')); REF.sections.forEach(s => test(s, 'sec')); REF.items.forEach(i => test(i, 'item'));
    scored.sort((a, b) => b.sc - a.sc);
    $$('.div', tree).forEach(x => x.style.display = 'none');
    if (!box) { box = document.createElement('div'); box.className = 'results'; tree.prepend(box); }
    if (!scored.length) { box.innerHTML = '<div class="empty">لا نتائج — جرّب مصطلحاً آخر أو الرقم</div>'; return; }
    box.innerHTML = scored.slice(0, 80).map(({ n, type }) => {
      const path = type === 'item' ? `${n.div.ar} › ${n.sec.ar}` : type === 'sec' ? n.div.ar : '';
      const badge = type === 'item' ? (n.status === 'full' ? '<span class="badge full">مفصّل</span>' : `<span class="badge skel">${n.variants.length} خيار</span>`) : `<span class="badge skel">${type === 'div' ? 'شعبة' : 'قسم'}</span>`;
      return `<div class="res" data-go="${esc(n.code)}"><div class="nm"><span class="code">${esc(n.code)}</span> ${esc(n.ar)} <span class="en">${esc(n.en || '')}</span> ${badge}</div><div class="path">${esc(path || '—')}</div></div>`;
    }).join('');
    $$('[data-go]', box).forEach(el => el.onclick = () => go(el.getAttribute('data-go')));
  };
  q.oninput = run; clear.onclick = () => { q.value = ''; run(); q.focus(); };
}

// ---------- التحرير (الأدمن)
const linesToArr = s => s.split('\n').map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
const arrToLines = a => (a || []).join('\n');
async function editItem(d, sec) {
  const isNew = !d; const s = sec || REF.bySec[d.section_code];
  const html = `<form id="f" class="pgrid">
    ${field('الكود *', inp('code', isNew ? s.code.slice(0, 6) + '' : d.code, isNew ? 'required placeholder="مثال: 09 30 40"' : 'readonly'))}
    ${field('وحدة القياس', sel('unit', UNITS, d?.unit || 'عدد'))}
    ${field('المسمى العربي *', inp('ar', d?.ar || '', 'required'), 'wide')}
    ${field('المسمى الإنجليزي', inp('en', d?.en || ''), 'wide')}
    ${field('نطاق البند', `<textarea name="scope" rows="3">${esc(d?.scope || '')}</textarea>`, 'wide')}
    ${field('المتطلبات الفنية (سطر لكل بند)', `<textarea name="specs" rows="6">${esc(arrToLines(d?.specs))}</textarea>`, 'wide')}
    ${field('متطلبات المنشآت الصحية (سطر لكل بند)', `<textarea name="health" rows="4">${esc(arrToLines(d?.health))}</textarea>`, 'wide')}
    ${field('معايير القبول والاختبار (سطر لكل بند)', `<textarea name="accept" rows="4">${esc(arrToLines(d?.accept))}</textarea>`, 'wide')}
    ${field('طريقة التنفيذ (سطر لكل خطوة)', `<textarea name="method" rows="4">${esc(arrToLines(d?.method))}</textarea>`, 'wide')}
    ${field('المراجع (سطر لكل مرجع)', `<textarea name="refs" rows="3">${esc(arrToLines(d?.refs))}</textarea>`, 'wide')}
    ${field('ملاحظات (سطر لكل ملاحظة)', `<textarea name="notes" rows="2">${esc(arrToLines(d?.notes))}</textarea>`, 'wide')}
    ${field('كلمات مفتاحية (مفصولة بفواصل)', inp('keywords', (d?.keywords || []).join('، ')), 'wide')}
    ${field('الحالة', sel('status', [['skeleton', 'مُسعّر — المواصفة قيد الاستكمال'], ['full', 'مواصفة مفصّلة بالكامل']], d?.status || 'skeleton'))}
    ${field('نشط', sel('active', [['true', 'نعم'], ['false', 'موقوف (لا يظهر في جداول الكميات الجديدة)']], String(d?.active !== false)))}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary" type="submit">حفظ</button></div></form>`;
  await modal(html, { title: isNew ? 'بند جديد في ' + s.ar : 'تعديل البند ' + d.code, wide: true, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const row = { code: f.code.trim(), section_code: s.code, ar: f.ar.trim(), en: f.en.trim(), unit: f.unit, scope: f.scope.trim(), specs: linesToArr(f.specs), health: linesToArr(f.health), accept: linesToArr(f.accept), method: linesToArr(f.method), refs: linesToArr(f.refs), notes: linesToArr(f.notes), keywords: f.keywords.split(/[,،]/).map(x => x.trim()).filter(Boolean), status: f.status, active: f.active === 'true', updated_by: session.user.id };
      try { await q(sb.from('items').upsert(row)); await bumpRef(); toast('تم الحفظ'); close(true); await reloadTree(row.code); } catch (er) { err(er); } };
  } });
}
async function editVariant(v, it) {
  const isNew = !v; const next = String(it.variants.length + 1).padStart(2, '0');
  const html = `<form id="f" class="pgrid">
    ${field('الكود *', inp('code', isNew ? `${it.code}-${next}` : v.code, isNew ? 'required' : 'readonly'))}
    ${field('الوحدة', sel('unit', UNITS, v?.unit || it.unit || 'عدد'))}
    ${field('المسمى العربي *', inp('ar', v?.ar || '', 'required'), 'wide')}
    ${field('المسمى الإنجليزي', inp('en', v?.en || ''), 'wide')}
    ${field('المواصفة المميِّزة', inp('spec', v?.spec || ''), 'wide')}
    ${field('سعر الوحدة الاسترشادي (ر.س) *', inp('price', v?.price ?? 0, 'type="number" min="0" step="0.01" required'))}
    ${field('نشط', sel('active', [['true', 'نعم'], ['false', 'موقوف']], String(v?.active !== false)))}
    ${isNew ? '' : field('ملاحظة تغيير السعر (اختياري)', inp('note', ''), 'wide')}
    <div class="btnrow end wide">${isNew ? '' : '<button type="button" class="btn danger" data-del>حذف الخيار</button>'}<span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary" type="submit">حفظ</button></div></form>`;
  await modal(html, { title: isNew ? 'خيار جديد — ' + it.ar : 'تعديل الخيار ' + v.code, onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
      const row = { code: f.code.trim(), item_code: it.code, ar: f.ar.trim(), en: f.en.trim(), unit: f.unit, spec: f.spec.trim(), price: Number(f.price), active: f.active === 'true', updated_by: session.user.id };
      try { await q(sb.from('variants').upsert(row)); if (!isNew && f.note && Number(f.price) !== Number(v.price)) { await sb.from('price_history').update({ note: f.note }).eq('variant_code', row.code).order('id', { ascending: false }).limit(1); } await bumpRef(); toast('تم الحفظ'); close(true); await reloadTree(it.code); } catch (er) { err(er); } };
    const del = $('[data-del]', w); if (del) del.onclick = async () => { if (!await confirm('حذف هذا الخيار نهائياً؟ إن كان مستخدماً في جداول كميات سابقة فالأفضل إيقافه بدل حذفه.', 'حذف', true)) return; try { await q(sb.from('variants').delete().eq('code', v.code)); await bumpRef(); close(true); await reloadTree(it.code); } catch (er) { err('تعذّر الحذف — الخيار مستخدم في جداول كميات. أوقفه بدلاً من حذفه.'); } };
  } });
}
async function editSection(d) {
  const html = `<form id="f" class="pgrid">${field('الكود *', inp('code', d.code + ' ', 'required placeholder="مثال: 10 95 00"'))}${field('المسمى العربي *', inp('ar', '', 'required'), 'wide')}${field('المسمى الإنجليزي', inp('en', ''), 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary" type="submit">حفظ</button></div></form>`;
  await modal(html, { title: 'قسم جديد في الشعبة ' + d.code, onOpen: (w, close) => { $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('sections').upsert({ code: f.code.trim(), division_code: d.code, ar: f.ar.trim(), en: f.en.trim() })); await bumpRef(); close(true); await reloadTree(f.code.trim()); } catch (er) { err(er); } }; } });
}
async function bumpRef() { await sb.from('settings').update({ value: { v: 'edit', at: Date.now() }, updated_at: new Date().toISOString() }).eq('key', 'ref_version'); invalidateRef(); }
async function reloadTree(code) { const { loadRef } = await import('./api.js'); await loadRef(true); buildTree(); go(code); }
