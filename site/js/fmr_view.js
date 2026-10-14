// ===== عارض تقرير حالة الأنظمة الحرجة المشارك (بلا حساب) — جوال أولاً، بنفس لغة التقرير التنفيذي (share.css) =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { RST, monthAr, daysSince } from './fm_report.js';
const cfg = window.AHC_CONFIG || {};
const sb = cfg.url ? createClient(cfg.url, cfg.anon, { auth: { persistSession: false } }) : null;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dAr = (d, o = { year: 'numeric', month: 'long', day: 'numeric' }) => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', o) : '—';
const dS = d => dAr(d, { month: 'short', day: 'numeric' });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const token = new URLSearchParams(location.search).get('t') || '';
const ERR = { bad_token: 'الرابط غير صحيح.', not_found: 'الرابط غير موجود أو أُوقف.', expired: 'انتهت صلاحية الرابط. اطلب رابطاً جديداً.' };
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  chev: svg('<path d="M15 6l-6 6 6 6"/>'), down: svg('<path d="M6 9l6 6 6-6"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  print: svg('<path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v7H6z"/>'),
  msg: svg('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>'), check: svg('<path d="M5 12l5 5L20 7"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  book: svg('<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>'), alert: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>'),
};
const ROST = { open: 'مفتوحة', in_progress: 'قيد المعالجة', verify: 'بانتظار التحقق', closed: 'مغلقة' };
const SEV = ['down', 'partial', 'attention', 'good', 'na'];
const lbl = (s, g) => (g === 'compliance' ? RST[s]?.cmp : RST[s]?.ar) || 'لم يُفحص';
const tagC = { down: 'bad', partial: 'bad', attention: 'warn', good: 'ok', na: '' };
const stTag = (s, g) => `<span class="tag ${tagC[s] || ''}">${esc(lbl(s, g))}</span>`;
const dot = s => `<span class="dot" style="background:${RST[s]?.c || 'var(--line)'}"></span>`;
const rcol = p => p == null ? 'var(--faint)' : p >= 85 ? 'var(--sage)' : p >= 65 ? 'var(--gold)' : 'var(--red)';
let R = null, me = (() => { try { return JSON.parse(localStorage.getItem('fmr_me') || '{}'); } catch { return {}; } })();

async function open(pin) {
  if (!sb) return showErr('تعذّر فتح التقرير', 'إعدادات الموقع غير مكتملة.');
  const { data, error } = await sb.rpc('get_fm_share', { p_token: token, p_pin: pin || null });
  if (error) return showErr('تعذّر فتح التقرير', error.message);
  if (data?.error === 'pin') return showPin(!!pin);
  if (data?.error) return showErr('تقرير حالة الأنظمة', ERR[data.error] || 'تعذّر فتح التقرير.');
  R = data.data; render();
}
function showErr(h, p) { $('#app').innerHTML = `<div class="xerr"><h2>${esc(h)}</h2><p>${esc(p)}</p></div>`; }
function showPin(wrong) {
  $('#app').innerHTML = `<div class="xerr"><img src="assets/logo.png" alt="" style="height:44px"><h2>تقرير حالة الأنظمة الحرجة</h2><p>هذا التقرير محمي برمز، أدخله للمتابعة.</p><form id="pf"><input id="pin" inputmode="numeric" autocomplete="off" autofocus>${wrong ? '<p style="color:var(--red);margin:0 0 8px">الرمز غير صحيح.</p>' : ''}<button class="btn p" style="width:160px">فتح التقرير</button></form></div>`;
  $('#pf').onsubmit = e => { e.preventDefault(); open($('#pin').value.trim()); };
}

// ---------- البناء
function render() {
  const k = R.kpi, mon = monthAr(R.period), sysBy = Object.fromEntries(R.systems.map(s => [s.code, s]));
  document.title = `حالة الأنظمة الحرجة — ${mon}`;
  // تجميع حسب النظام
  const bySys = R.systems.map(s => { const c = { down: 0, partial: 0, attention: 0, good: 0 }; let n = 0; R.matrix.forEach(m => { const st = m.cells[s.code]; if (st && st !== 'na') { c[st]++; n++; } }); return { ...s, c, n, bad: c.down + c.partial, iss: c.down + c.partial + c.attention }; })
    .filter(s => s.n).sort((a, b) => (b.c.down * 9 + b.c.partial * 4 + b.c.attention) - (a.c.down * 9 + a.c.partial * 4 + a.c.attention) || a.name.localeCompare(b.name, 'ar'));
  const weak = bySys.filter(s => s.iss), clean = bySys.filter(s => !s.iss);
  const undocN = R.undoc.reduce((a, g) => a + g.facs.length, 0);
  const verdict = k.bad ? `${k.bad} ${k.bad === 1 ? 'نظام معطل' : k.bad === 2 ? 'نظامان معطلان' : 'أنظمة معطلة'} كلياً أو جزئياً تحتاج متابعة` : k.att ? 'لا أنظمة معطلة، وبعضها يحتاج متابعة' : 'كل الأنظمة المفحوصة تعمل';

  const caseRow = (a, i) => { const o = a.obs[0] || {}; const late = a.obs.some(x => x.late), stale = a.obs.some(x => x.stale);
    return `<div class="row" data-a="${i}">${dot(a.status)}<div class="m"><b>${esc(a.sys)}</b><small>${esc(a.fac)}</small><small class="wrap2">${esc(o.title || '')}</small><span class="meta2">${stTag(a.status, a.grp)}${o.owner ? `<span>${I.user}${esc(o.owner)}</span>` : ''}${o.due ? `<span class="${late ? 'late' : ''}">${I.clock}${late ? 'تجاوز ' : ''}${dS(o.due)}</span>` : ''}${stale ? '<span class="tag bad">بلا تحديث</span>' : ''}</span></div><span class="chev">${I.chev}</span></div>`; };
  const strip = m => `<span class="fstrip" aria-hidden="true">${R.systems.map(s => `<i style="background:${m.cells[s.code] ? RST[m.cells[s.code]].c : '#E3E8EE'}"></i>`).join('')}</span>`;
  const facRow = (m, i) => { const c = { down: 0, partial: 0, attention: 0 }; Object.values(m.cells).forEach(s => { if (c[s] != null) c[s]++; });
    const sub = [c.down + c.partial ? `<span class="r">${c.down + c.partial} معطل</span>` : '', c.attention ? `<span class="a">${c.attention} متابعة</span>` : ''].filter(Boolean).join(' · ') || '<span class="g">كل الأنظمة سليمة</span>';
    return `<div class="row" data-f="${i}"><div class="m"><b>${esc(m.name)}</b><small class="fsub">${sub}</small>${strip(m)}</div><div class="e"><b style="color:${rcol(m.ready)}">${m.ready ?? '—'}${m.ready != null ? '%' : ''}</b><small>جاهزية</small></div><span class="chev">${I.chev}</span></div>`; };
  const sysRow = s => `<div class="row" data-s="${s.code}"><div class="m"><b>${esc(s.name)}</b><div class="sbar">${['down', 'partial', 'attention', 'good'].map(t => s.c[t] ? `<i style="flex:${s.c[t]};background:${RST[t].c}"></i>` : '').join('')}</div><small>${[s.c.down ? `${s.c.down} ${lbl('down', s.grp)}` : '', s.c.partial ? `${s.c.partial} ${lbl('partial', s.grp)}` : '', s.c.attention ? `${s.c.attention} ${lbl('attention', s.grp)}` : ''].filter(Boolean).join(' · ')}</small></div><div class="e"><b>${s.c.good}</b><small>من ${s.n} سليم</small></div><span class="chev">${I.chev}</span></div>`;

  $('#app').innerHTML = `
  <div class="top" id="top"><div class="in"><img src="assets/logo.png" alt=""><div class="t"><b>حالة الأنظمة الحرجة</b><small>${mon} · تجمع الأحساء الصحي</small></div><button class="ibtn" id="prn" title="طباعة / PDF">${I.print}</button></div></div>
  <div class="wrap">
    <header class="bhero in"><span class="kd">تقرير شهري · ${mon}</span><h1>حالة الأنظمة الحرجة في منشآت التجمع</h1><p class="sub">إدارة الخدمات الفنية — متابعة أنظمة المنشآت</p>
      <div class="cd ${k.ready < 65 ? 'over' : ''}"><b>${k.ready}<small style="font-size:20px">%</small></b><span><b>جاهزية الأنظمة الحرجة</b><br>${k.good} من ${k.base} نظاماً مفحوصاً يعمل جيداً · ${verdict}</span></div>
      <div class="bst"><div><b>${k.bad}</b><span>معطل كلياً أو جزئياً</span></div><div><b>${k.att}</b><span>يحتاج متابعة</span></div><div><b>${k.open}</b><span>ملاحظة مفتوحة</span></div><div><b>${k.closedM}</b><span>أُغلقت هذا الشهر</span></div>${k.late || k.stale ? `<div class="dec"><b>${k.late + k.stale}</b><span>${[k.late ? `${k.late} تجاوزت موعدها` : '', k.stale ? `${k.stale} بلا إجراء منذ أكثر من أسبوع` : ''].filter(Boolean).join(' · ')}</span></div>` : ''}</div>
      <div class="meta"><span>تاريخ الإصدار <b>${dAr(R.issued)}</b></span><span>المنشآت المُحدَّثة <b>${k.facDone} من ${k.facTotal}</b></span></div>
    </header>

    <section class="sec in" style="animation-delay:.05s"><h2>الحالات قيد المعالجة <span class="n">${R.active.length}</span></h2><div class="card">${R.active.length ? R.active.map(caseRow).join('') : '<div class="empty">لا حالات قيد المعالجة</div>'}</div></section>

    <section class="sec in" style="animation-delay:.1s"><h2>جاهزية المنشآت <span class="n">${R.matrix.length}</span></h2><div class="card">${R.matrix.map(facRow).join('')}${R.missing.length ? `<div class="miss">${I.alert}<span><b>بلا جولة هذا الشهر:</b> ${R.missing.map(esc).join('، ')}</span></div>` : ''}</div>
      <div class="lgd">${SEV.map(s => `<span>${dot(s)}${RST[s].ar}</span>`).join('')}<span><span class="dot" style="background:#E3E8EE"></span>لم يُفحص</span></div></section>

    <section class="sec in" style="animation-delay:.15s"><h2>حسب النظام <span class="n">${weak.length} عليها ملاحظات</span></h2><div class="card">${weak.slice(0, 6).map(sysRow).join('') || '<div class="empty">كل الأنظمة سليمة في كل المنشآت</div>'}${weak.length > 6 ? `<details class="grp"><summary>بقية الأنظمة التي عليها ملاحظات <span class="n">${weak.length - 6}</span><span class="chev">${I.down}</span></summary>${weak.slice(6).map(sysRow).join('')}</details>` : ''}${clean.length ? `<details class="grp"><summary>${dot('good')}سليمة في كل المنشآت <span class="n">${clean.length}</span><span class="chev">${I.down}</span></summary><div class="chips">${clean.map(s => `<span>${esc(s.name)}</span>`).join('')}</div></details>` : ''}</div></section>

    ${R.undoc.length ? `<section class="sec in" style="animation-delay:.2s"><h2>تحتاج توثيقاً <span class="n">${undocN} حالة</span></h2><div class="card"><p class="cnote">أنظمة غير سليمة لم تُفتح لها ملاحظة بمسؤول وإجراء بعد.</p>${R.undoc.map(g => `<details class="grp"><summary>${esc(g.sys)} <span class="n">${g.facs.length}</span>${g.owner ? `<span class="tag">${esc(g.owner)}</span>` : ''}<span class="chev">${I.down}</span></summary><div class="chips">${g.facs.map(f => `<span>${dot(f.status)}${esc(f.name)}</span>`).join('')}</div></details>`).join('')}</div></section>` : ''}

    <footer class="foot">صدر من منصة <b>إدارة الخدمات الفنية</b> — تجمع الأحساء الصحي بتاريخ <b>${dAr(R.issued)}</b>، من جولات مدراء المرافق الشهرية وملاحظات المتابعة كما كانت لحظة الإصدار. اضغط أي حالة أو منشأة للتفاصيل، أو أرسل ملاحظتك للقسم من الزر أدناه.</footer>
  </div>
  <button class="fab" id="fab">${I.msg} أرسل ملاحظة</button>
  <div class="ov" id="ov"></div><div class="sheet" id="sheet" role="dialog"><div class="grab"></div><div class="sh"><div style="flex:1;min-width:0"><h3 id="shT"></h3></div><button class="x" id="shX">${I.x}</button></div><div class="sb" id="shB"></div></div>`;
  wire(sysBy); motion();
}

// ---------- التفاصيل
const obsBlock = o => { const pct = o.steps ? Math.round((o.step || 0) / o.steps * 100) : null;
  return `<div class="obs"><b>#${o.id} ${esc(o.title)}</b>
    <div class="kv"><div><span>الحالة</span><b>${ROST[o.status] || '—'}</b></div><div><span>القسم المسؤول</span><b>${esc(o.owner || '—')}</b></div><div><span>المكلّف</span><b>${esc(o.assignee || '—')}</b></div><div><span>الموعد</span><b class="${o.late ? 'late-t' : ''}">${o.due ? dAr(o.due) + (o.late ? ' · متأخر' : '') : 'بلا موعد'}</b></div></div>
    ${o.proc ? `<div class="proc">${I.book}<span>الإجراء الحاكم <b>${esc(o.proc)}</b>${o.step ? ` · الخطوة ${o.step}${o.steps ? ' من ' + o.steps : ''}` : ''}</span></div>${pct != null ? `<div class="pb"><i data-w="${pct}" style="width:${pct}%"></i></div>` : ''}` : ''}
    <div class="note ${o.stale || !o.action ? 'stale' : ''}" style="margin-top:10px"><small>آخر إجراء متخذ${o.action_at ? ' · ' + dAr(o.action_at) : ''}${o.stale && o.action_at ? ` · بلا تحديث منذ ${daysSince(o.action_at)} يوماً` : ''}</small>${o.action ? esc(o.action) : 'لم يُسجَّل أي إجراء بعد'}</div></div>`; };
function openCase(i) {
  const a = R.active[i];
  openSheet(`${a.sys}`, `${esc(a.fac)} · ${esc(lbl(a.status, a.grp))}`, `${a.obs.map(obsBlock).join('')}<div class="act"><button class="btn p" id="nb">${I.msg}ملاحظة على هذه الحالة</button></div>`, { ref: `active:${i}`, title: `${a.fac} — ${a.sys}` });
}
function openFac(i, sysBy) {
  const m = R.matrix[i], groups = {};
  R.systems.forEach(s => { const st = m.cells[s.code] || 'none'; (groups[st] ||= []).push(s); });
  const act = R.active.map((a, j) => [a, j]).filter(([a]) => a.fac === m.name);
  const c = st => (groups[st] || []).length;
  const body = `<div class="stats"><div class="st ${m.ready < 65 ? 'bad' : 'ok'}"><span>الجاهزية</span><b>${m.ready ?? '—'}${m.ready != null ? '%' : ''}</b></div><div class="st ${c('down') + c('partial') ? 'bad' : ''}"><span>معطل</span><b>${c('down') + c('partial')}</b></div><div class="st"><span>يحتاج متابعة</span><b>${c('attention')}</b></div></div>
    ${act.length ? `<h4>قيد المعالجة <span class="n">${act.length}</span></h4><div class="card">${act.map(([a, j]) => `<div class="row" data-a="${j}">${dot(a.status)}<div class="m"><b>${esc(a.sys)}</b><small>${esc(a.obs[0]?.title || '')}</small></div><span class="chev">${I.chev}</span></div>`).join('')}</div>` : ''}
    ${['down', 'partial', 'attention'].filter(c).map(st => `<h4>${dot(st)}${RST[st].ar} <span class="n">${c(st)}</span></h4><ul class="ms">${groups[st].map(s => `<li>${esc(s.name)}<time>${esc(lbl(st, s.grp))}</time></li>`).join('')}</ul>`).join('')}
    ${c('good') ? `<h4>${dot('good')}يعمل جيداً <span class="n">${c('good')}</span></h4><div class="chips flat">${groups.good.map(s => `<span>${esc(s.name)}</span>`).join('')}</div>` : ''}
    ${c('none') + c('na') ? `<p class="cnote" style="padding:10px 0 0">${c('na') ? `لا ينطبق: ${groups.na.map(s => esc(s.name)).join('، ')}. ` : ''}${c('none') ? `لم يُفحص: ${groups.none.map(s => esc(s.name)).join('، ')}.` : ''}</p>` : ''}
    <div class="act"><button class="btn p" id="nb">${I.msg}ملاحظة على المنشأة</button></div>`;
  openSheet(m.name, `جولة ${monthAr(R.period)}`, body, { ref: `fac:${i}`, title: m.name });
}
function openSys(code) {
  const s = R.systems.find(x => x.code === code); const rows = R.matrix.map(m => ({ n: m.name, st: m.cells[code] })).filter(x => x.st && x.st !== 'na').sort((a, b) => SEV.indexOf(a.st) - SEV.indexOf(b.st));
  const ug = R.undoc.find(g => g.sys === s.name);
  openSheet(s.name, `${rows.filter(r => r.st === 'good').length} من ${rows.length} منشأة سليمة`, `<ul class="ms">${rows.map(r => `<li>${dot(r.st)}${esc(r.n)}<time>${stTag(r.st, s.grp)}</time></li>`).join('')}</ul>${ug ? `<p class="cnote" style="padding:12px 0 0">القسم المالك: <b>${esc(ug.owner || '—')}</b>${ug.proc ? ` · الإجراء الحاكم ${esc(ug.proc)}` : ''}</p>` : ''}<div class="act"><button class="btn p" id="nb">${I.msg}ملاحظة على النظام</button></div>`, { ref: `sys:${code}`, title: s.name });
}

// ---------- الورقة المنزلقة والتفاعل
let sheetOpen = false, startY = 0, SB = null;
function openSheet(title, sub, body, ref) {
  $('#shT').innerHTML = esc(title) + (sub ? `<small>${sub}</small>` : ''); const b = $('#shB'); b.innerHTML = body; b.scrollTop = 0; b._ref = ref || null;
  $('#ov').style.display = 'block'; $('#sheet').style.display = 'flex'; requestAnimationFrame(() => { $('#ov').classList.add('on'); $('#sheet').classList.add('on'); });
  if (!sheetOpen) history.pushState({ sheet: 1 }, ''); sheetOpen = true; document.body.style.overflow = 'hidden';
  $$('[data-a]', b).forEach(el => el.onclick = e => { e.stopPropagation(); openCase(+el.dataset.a); });
  const nb = $('#nb', b); if (nb) nb.onclick = () => openNote(b._ref);
}
function closeSheet(fromPop) { if (!sheetOpen) return; sheetOpen = false; $('#ov').classList.remove('on'); $('#sheet').classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { if (!sheetOpen) { $('#ov').style.display = 'none'; $('#sheet').style.display = 'none'; } }, 320); if (!fromPop && history.state?.sheet) history.back(); }
function wire(sysBy) {
  $('#app').addEventListener('click', e => { if (e.target.closest('#sheet')) return; const a = e.target.closest('[data-a]'); if (a) return openCase(+a.dataset.a); const f = e.target.closest('[data-f]'); if (f) return openFac(+f.dataset.f, sysBy); const s = e.target.closest('[data-s]'); if (s) return openSys(s.dataset.s); });
  $('#ov').onclick = () => closeSheet(); $('#shX').onclick = () => closeSheet(); $('#fab').onclick = () => openNote(null); $('#prn').onclick = () => print();
  addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });
  const sh = $('#sheet'); sh.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - startY > 90 && $('#shB').scrollTop <= 0) closeSheet(); }, { passive: true });
  addEventListener('beforeprint', () => $$('details.grp').forEach(d => d.open = true));
}
function motion() {
  const top = $('#top'); addEventListener('scroll', () => top.classList.toggle('on', scrollY > 30), { passive: true });
  if (reduced) return;
  $$('.bst b, .cd>b').forEach(b => { const tn = [...b.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)); if (!tn) return; const target = +tn.textContent; if (!target) return; const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - k, 3); tn.textContent = Math.round(target * e); if (k < 1) requestAnimationFrame(step); }; tn.textContent = '0'; requestAnimationFrame(step); });
}
function openNote(ref) {
  const body = `<form class="f" id="nf">${ref ? `<p class="note" style="margin:0"><small>ملاحظة على</small>${esc(ref.title)}</p>` : ''}<div class="two"><label>الاسم<input name="name" required value="${esc(me.n || '')}" autocomplete="name"></label><label>الصفة<input name="role" value="${esc(me.r || '')}" placeholder="مثال: نائب الرئيس"></label></div><label>الملاحظة أو التوجيه<textarea name="body" rows="4" required placeholder="اكتب ملاحظتك هنا…"></textarea></label><div class="act" style="margin-top:4px"><button type="button" class="btn" id="nc">إلغاء</button><button class="btn p">إرسال</button></div></form>`;
  openSheet('ملاحظة لإدارة الخدمات الفنية', 'تصل فوراً لمتابعة الأنظمة', body, ref);
  const f = $('#nf'); $('#nc').onclick = () => closeSheet();
  f.onsubmit = async e => { e.preventDefault(); const btn = f.querySelector('.btn.p'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    me = { n: f.name.value.trim(), r: f.role.value.trim() }; try { localStorage.setItem('fmr_me', JSON.stringify(me)); } catch { }
    const { data, error } = await sb.rpc('add_fm_share_note', { p_token: token, p_name: me.n, p_role: me.r, p_body: f.body.value.trim(), p_ref: ref?.ref || '', p_ref_title: ref?.title || '' });
    if (error || data?.error) { btn.disabled = false; btn.textContent = 'إرسال'; alert('تعذّر الإرسال، حاول مرة أخرى.'); return; }
    $('#shB').innerHTML = `<div class="ok-msg"><div class="ic">${I.check}</div><b>وصلت ملاحظتك</b><p style="color:var(--muted);margin:4px 0 0">شكراً لك، ستُتابَع من إدارة الخدمات الفنية.</p><div class="act" style="justify-content:center"><button class="btn" id="nc2" style="max-width:200px">إغلاق</button></div></div>`; $('#nc2').onclick = () => closeSheet(); };
}

if (!token) showErr('الرابط غير مكتمل', 'افتح الرابط كما وصلك بلا تعديل.'); else open();
