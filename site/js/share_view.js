// ===== عارض التقرير التنفيذي المشارك (بلا حساب) — طبقتان: ملخص تنفيذي ثم تفاصيل عند الطلب =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = window.AHC_CONFIG || {};
const sb = createClient(cfg.url, cfg.anon, { auth: { persistSession: false } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = v => Math.round(Number(v) || 0).toLocaleString('en');
const mln = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e8 ? 0 : 1) + ' مليون' : n0(v);
const dAr = (d, o = { month: 'short', day: 'numeric' }) => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', o) : '—';
const dFull = d => dAr(d, { year: 'numeric', month: 'long', day: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const I = {
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
};
const T_ST = { open: 'مفتوحة', in_progress: 'جارية', done: 'منجزة', cancelled: 'ملغاة' };
const lvl = s => s >= 8 ? 'high' : s >= 4 ? 'mid' : 'low', lvlAr = { high: 'عالٍ', mid: 'متوسط', low: 'منخفض' };
const scoreChip = s => `<span class="score ${lvl(s)}"><b>${s}</b><small>${lvlAr[lvl(s)]}</small></span>`;
const pbar = (a, p, bad) => `<div class="pb"><i class="${bad ? 'bad' : ''}" data-w="${Math.min(100, a)}"></i>${p != null ? `<u style="left:${Math.min(100, p)}%" title="المخطط ${p}%"></u>` : ''}</div>`;

const params = new URLSearchParams(location.search);
const token = params.get('t') || '';
let R = null, D = null;

// ---------- التحميل
async function load(pin) {
  const { data, error } = await sb.rpc('get_shared_report', { p_token: token, p_pin: pin || null });
  if (error) return showErr('تعذّر الاتصال', 'تحقق من الاتصال بالإنترنت ثم أعد المحاولة.');
  if (data?.error === 'pin') return showPin(!!pin);
  if (data?.error) return showErr(data.error === 'expired' ? 'انتهت صلاحية هذا الرابط' : 'الرابط غير صالح', data.error === 'expired' ? 'اطلب رابطاً محدّثاً من قسم المشاريع.' : 'تأكد من الرابط كاملاً، أو اطلب رابطاً جديداً من قسم المشاريع.');
  R = data; D = data.data; document.title = `${R.title} — ${dAr(R.issued, { year: 'numeric', month: 'long', day: 'numeric' })}`;
  render();
}
function showErr(h, p) { $('#app').innerHTML = `<div class="xerr"><h2>${esc(h)}</h2><p>${esc(p)}</p></div>`; }
function showPin(wrong) { $('#app').innerHTML = `<div class="xerr"><h2>رمز الدخول</h2><p>هذا التقرير محمي برمز، أدخله للمتابعة.</p><form id="pf"><input id="pin" inputmode="numeric" autocomplete="one-time-code" autofocus>${wrong ? '<p style="color:var(--red)">الرمز غير صحيح</p>' : ''}<br><button class="btn p" style="max-width:200px;margin:0 auto">فتح التقرير</button></form></div>`; $('#pf').onsubmit = e => { e.preventDefault(); load($('#pin').value.trim()); }; }

// ---------- الصفحة الرئيسية
function render() {
  const K = D.kpis, P = D.period; const per = D.from || D.to ? `${D.from ? 'من ' + dFull(D.from) : ''}${D.to ? ' إلى ' + dFull(D.to) : ' حتى تاريخه'}` : 'حتى تاريخ الإصدار';
  const exec = D.exec, dec = D.decisions, chs = Object.values(D.challenges).sort((a, b) => b.score - a.score || (a.due || '9').localeCompare(b.due || '9'));
  const preBy = {}; D.pre.forEach(p => (preBy[p.stage] = preBy[p.stage] || []).push(p));
  const preOrder = D.byStage.map(s => s.key).filter(k => preBy[k]);
  const row = (p) => `<div class="row" data-p="${p.id}"><span class="dot" style="background:${p.late ? 'var(--red)' : p.dev < -5 ? 'var(--gold)' : 'var(--sage)'}"></span><div class="m"><b>${esc(p.name)}</b><small>${esc(p.facility || p.category)}${p.eng ? ' · ' + esc(p.eng) : ''}${p.note ? ` · <span class="tag bad">${esc(p.note)}</span>` : p.late ? ' · <span class="tag bad">متأخر</span>' : ''}</small>${pbar(p.pa, p.pl, p.late)}</div><div class="e"><b>${p.pa}%</b><small>${p.end ? (p.daysLeft < 0 ? `تجاوز ${-p.daysLeft} يوم` : dAr(p.end)) : 'الانتهاء —'}</small></div><span class="chev">${I.chev}</span></div>`;
  $('#app').innerHTML = `
  <div class="top" id="top"><div class="in"><img src="assets/logo.png" alt=""><div class="t"><b>${esc(R.title)}</b><small>${esc(D.org?.name || 'تجمع الأحساء الصحي')} · ${dAr(R.issued, { year: 'numeric', month: 'long', day: 'numeric' })}</small></div><button class="ibtn" id="prn" title="طباعة / PDF">${I.print}</button></div></div>
  <div class="wrap">
    <header class="hero in"><h1>${esc(R.title)}</h1><p class="sub">${esc(D.org?.dept || 'إدارة الخدمات الفنية / قسم المشاريع')}</p><div class="meta"><span>تاريخ الإصدار <b>${dFull(R.issued)}</b></span><span>فترة النشاط <b>${per}</b></span>${D.by ? `<span>إعداد <b>${esc(D.by)}</b></span>` : ''}</div></header>

    <div class="kp in" style="animation-delay:.05s">
      <div class="k wide"><svg class="ring" viewBox="0 0 42 42"><circle class="bg" cx="21" cy="21" r="17"/><circle class="fg" cx="21" cy="21" r="17" stroke-dasharray="0 107" data-arc="${K.paidPct}" transform="rotate(-90 21 21)"/><text x="21" y="25" text-anchor="middle">${K.paidPct}%</text></svg><div><span>قيمة المحفظة القائمة</span><b data-cu="${K.totalV}">${mln(K.totalV)}<small>ر.س</small></b><span class="d">صُرف ${mln(K.paid)} ر.س${K.pendingPay ? ` · قيد الاعتماد ${mln(K.pendingPay)}` : ''}</span></div></div>
      <div class="k"><span>تحت التنفيذ</span><b>${K.exec}<small>مشروعاً</small></b><span class="d">متوسط الإنجاز ${K.avgA}% مقابل مخطط ${K.avgP}%</span></div>
      <div class="k ${K.late ? 'bad' : 'ok'}"><span>متأخرة / متعثرة</span><b>${K.late}</b><span class="d">${K.stale ? `${K.stale} بلا تحديث حديث` : 'المتابعة منتظمة'}</span></div>
      <div class="k ${K.chHigh ? 'bad' : ''}"><span>تحديات تحتاج قراراً</span><b>${K.chHigh}<small>من ${K.chOpen}</small></b><span class="d">درجة عالية أو تجاوزت موعدها</span></div>
      <div class="k"><span>إجمالي المشاريع</span><b>${K.total}</b><span class="d">${K.active} قائمة · ${K.closed} مستلمة نهائياً</span></div>
    </div>

    ${dec.length ? `<section class="sec in" style="animation-delay:.1s"><h2>يحتاج انتباهكم <span class="n">${dec.length}</span></h2><div class="card">${dec.map(d => `<div class="row" data-${d.k === 'challenge' ? 'c' : 'p'}="${d.id}"><span class="dot" style="background:${d.bad ? 'var(--red)' : 'var(--gold)'}"></span><div class="m"><b>${esc(d.title)}</b><small>${esc(d.sub)}</small></div><span class="tag ${d.bad ? 'bad' : 'warn'}">${esc(d.tag)}</span><span class="chev">${I.chev}</span></div>`).join('')}</div></section>` : ''}

    <section class="sec in" style="animation-delay:.15s"><h2>المشاريع تحت التنفيذ <span class="n">${exec.length}</span></h2><div class="card">${exec.length ? exec.map(row).join('') : '<div class="empty">لا توجد مشاريع تحت التنفيذ</div>'}</div></section>

    <section class="sec in" style="animation-delay:.2s"><h2>ما أُنجز خلال الفترة</h2><div class="card"><div class="strip"><div><b>${P.stages}</b><span>انتقالات مراحل</span></div><div><b>${P.ms}</b><span>معالم تحققت</span></div><div><b>${P.paidN}</b><span>مستخلصات صُرفت${P.paidV ? '<br>' + mln(P.paidV) + ' ر.س' : ''}</span></div><div><b>${P.tasksDone}</b><span>مهام أُنجزت</span></div></div>${D.highlights.length ? D.highlights.map(h => `<div class="hl" data-p="${h.pid}"><span class="ic ${h.k}">${h.k === 'ms' ? '◆' : h.k === 'pay' ? 'ر' : '➜'}</span><p>${esc(h.t)}</p><time>${dAr(h.d)}</time></div>`).join('') : '<div class="empty">لا توجد أحداث بارزة مسجلة في هذه الفترة</div>'}</div></section>

    <section class="sec in" style="animation-delay:.25s"><h2>التحديات المفتوحة <span class="n">${chs.length}</span></h2><div class="card">${chs.length ? chs.slice(0, 8).map(c => `<div class="row" data-c="${c.id}">${scoreChip(c.score)}<div class="m"><b>${esc(c.title)}</b><small>${esc(c.pname)}${c.due ? ` · ${c.overdue ? '<span class="tag bad">تجاوز ' + dAr(c.due) + '</span>' : 'الموعد ' + dAr(c.due)}` : ''}${c.tasks.length ? ` · ${c.tasks.filter(t => t.status === 'done').length}/${c.tasks.length} مهام` : ''}</small></div><span class="chev">${I.chev}</span></div>`).join('') + (chs.length > 8 ? `<div class="empty">و${chs.length - 8} تحديات أخرى بدرجة أقل</div>` : '') : '<div class="empty">لا توجد تحديات مفتوحة</div>'}</div></section>

    ${D.upcoming.length ? `<section class="sec in" style="animation-delay:.3s"><h2>معالم خلال 30 يوماً <span class="n">${D.upcoming.length}</span></h2><div class="card">${D.upcoming.map(m => `<div class="row" data-p="${m.pid}"><div class="m"><b>${esc(m.name)}</b><small>${esc(m.pname)}</small></div><div class="e"><b style="font-size:13px">${dAr(m.date)}</b></div><span class="chev">${I.chev}</span></div>`).join('')}</div></section>` : ''}

    <section class="sec in" style="animation-delay:.35s"><h2>مراحل ما قبل التنفيذ <span class="n">${D.pre.length}</span></h2><div class="card">${preOrder.length ? preOrder.map(k => { const ps = preBy[k]; const s = D.byStage.find(x => x.key === k); return `<details class="grp"><summary><span class="dot" style="background:${s.color}"></span>${esc(s.ar)} <span class="n">${ps.length}</span><span class="chev">${I.down}</span></summary>${ps.map(p => `<div class="row" data-p="${p.id}"><div class="m"><b>${esc(p.name)}</b><small>${esc(p.facility)}${p.budget ? ' · ' + mln(p.budget) + ' ر.س' : ''}${p.priority === 'urgent' ? ' · <span class="tag bad">عاجل</span>' : ''}</small></div><span class="chev">${I.chev}</span></div>`).join('')}</details>`; }).join('') : '<div class="empty">—</div>'}</div></section>

    ${D.post.length ? `<section class="sec in" style="animation-delay:.4s"><h2>مستلمة وتحت الضمان <span class="n">${D.post.length}</span></h2><div class="card"><details class="grp"><summary>عرض القائمة<span class="chev">${I.down}</span></summary>${D.post.map(p => `<div class="row" data-p="${p.id}"><div class="m"><b>${esc(p.name)}</b><small>${esc(p.stageAr)}${p.warrantyEnd ? ' · الضمان حتى ' + dAr(p.warrantyEnd, { year: 'numeric', month: 'short' }) : ''}</small></div><span class="chev">${I.chev}</span></div>`).join('')}</details></div></section>` : ''}

    <footer class="foot">صدر من منصة إدارة مشاريع ${esc(D.org?.name || 'تجمع الأحساء الصحي')} بتاريخ <b>${dFull(R.issued)}</b>. الأرقام كما كانت مسجلة في المنصة لحظة الإصدار؛ اضغط أي بند للاطلاع على تفاصيله.</footer>
  </div>
  <button class="fab" id="fab">${I.msg} أرسل ملاحظة</button>
  <div class="ov" id="ov"></div><div class="sheet" id="sheet" role="dialog"><div class="grab"></div><div class="sh"><div style="flex:1;min-width:0"><h3 id="shT"></h3></div><button class="x" id="shX">${I.x}</button></div><div class="sb" id="shB"></div></div>`;
  wire(); motion();
}

// ---------- الحركة (خفيفة: opacity/transform/width فقط)
function motion() {
  if (reduced) { $$('.pb i').forEach(i => i.style.width = i.dataset.w + '%'); $$('[data-arc]').forEach(c => c.setAttribute('stroke-dasharray', `${c.dataset.arc * 1.07} 107`)); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const el = e.target; io.unobserve(el); if (el.matches('.pb i')) el.style.width = el.dataset.w + '%'; if (el.hasAttribute('data-arc')) el.setAttribute('stroke-dasharray', `${el.dataset.arc * 1.07} 107`); }), { threshold: .2 });
  $$('.pb i, [data-arc]').forEach(el => io.observe(el));
  $$('.k b').forEach(b => { const tn = [...b.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)); if (!tn) return; const raw = tn.textContent; const m = raw.match(/^([\d,]+(?:\.\d+)?)(.*)$/); if (!m) return; const target = Number(m[1].replace(/,/g, '')); if (!target) return; const dec = (m[1].split('.')[1] || '').length; const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); tn.textContent = (dec ? (target * e).toFixed(dec) : Math.round(target * e).toLocaleString('en')) + m[2]; if (k < 1) requestAnimationFrame(step); else tn.textContent = raw; }; requestAnimationFrame(step); });
  addEventListener('beforeprint', () => { $$('.pb i').forEach(i => i.style.width = i.dataset.w + '%'); $$('[data-arc]').forEach(c => c.setAttribute('stroke-dasharray', `${c.dataset.arc * 1.07} 107`)); });
  const top = $('#top'); addEventListener('scroll', () => top.classList.toggle('on', scrollY > 30), { passive: true });
}

// ---------- الورقة المنزلقة
let sheetOpen = false, startY = 0;
function openSheet(title, sub, body, ref) {
  $('#shT').innerHTML = esc(title) + (sub ? `<small>${sub}</small>` : ''); $('#shB').innerHTML = body; $('#shB').scrollTop = 0;
  $('#ov').style.display = 'block'; $('#sheet').style.display = 'flex'; requestAnimationFrame(() => { $('#ov').classList.add('on'); $('#sheet').classList.add('on'); });
  if (!sheetOpen) history.pushState({ sheet: 1 }, ''); sheetOpen = true; document.body.style.overflow = 'hidden';
  $('#shB')._ref = ref || null; bindSheet();
}
function closeSheet(fromPop) { if (!sheetOpen) return; sheetOpen = false; $('#ov').classList.remove('on'); $('#sheet').classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { if (!sheetOpen) { $('#ov').style.display = 'none'; $('#sheet').style.display = 'none'; } }, 320); if (!fromPop && history.state?.sheet) history.back(); }
function wire() {
  const app = $('#app');
  app.addEventListener('click', e => { const p = e.target.closest('[data-p]'); if (p) return openProject(p.getAttribute('data-p')); const c = e.target.closest('[data-c]'); if (c) return openChallenge(+c.getAttribute('data-c')); });
  $('#ov').onclick = () => closeSheet(); $('#shX').onclick = () => closeSheet();
  $('#fab').onclick = () => openNote(null);
  $('#prn').onclick = () => print();
  addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });
  const sh = $('#sheet'); sh.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchend', e => { const dy = e.changedTouches[0].clientY - startY; if (dy > 90 && $('#shB').scrollTop <= 0) closeSheet(); }, { passive: true });
}
function bindSheet() { const b = $('#shB'); $$('[data-p]', b).forEach(el => el.onclick = e => { e.stopPropagation(); openProject(el.getAttribute('data-p')); }); $$('[data-c]', b).forEach(el => el.onclick = e => { e.stopPropagation(); openChallenge(+el.getAttribute('data-c')); }); const nb = $('#nb', b); if (nb) nb.onclick = () => openNote(b._ref); }

// ---------- تفاصيل مشروع
function openProject(id) {
  const p = D.exec.find(x => x.id === id) || D.projects[id]; if (!p) return;
  const inExec = p.stage === 'execution';
  const sc = p.sched; const paidPct = p.cv ? Math.round(p.paid / p.cv * 100) : 0;
  const body = `
    ${inExec ? `<div class="stats"><div class="st ${p.late ? 'bad' : p.dev >= 0 ? 'ok' : ''}"><span>الإنجاز الفعلي</span><b>${p.pa}%</b><small>المخطط ${p.pl}% (${p.dev >= 0 ? '+' : ''}${p.dev})</small></div><div class="st ${p.daysLeft != null && p.daysLeft < 0 ? 'bad' : ''}"><span>الانتهاء</span><b style="font-size:15px">${dAr(p.end)}</b><small>${p.daysLeft == null ? '' : p.daysLeft < 0 ? `تجاوز بـ${-p.daysLeft} يوم` : `متبقٍ ${p.daysLeft} يوم`}${p.extraDays ? ` · مُدّد ${p.extraDays} يوم` : ''}</small></div><div class="st"><span>الصرف</span><b>${paidPct}%</b><small>${mln(p.paid)} من ${mln(p.cv)} ر.س</small></div></div>
    ${p.note || p.late || p.stale ? `<p style="margin:0 0 10px">${p.note ? `<span class="tag bad">${esc(p.note)}</span> ` : p.late ? '<span class="tag bad">متأخر عن الموعد التعاقدي</span> ' : ''}${p.stale ? '<span class="tag warn">بلا تحديث منذ أكثر من أسبوعين</span>' : ''}</p>` : ''}
    ${pbar(p.pa, p.pl, p.late)}<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:4px"><span>الفعلي ${p.pa}%</span><span>▲ المخطط ${p.pl}%</span></div>` : ''}
    <div class="kv" style="margin-top:12px">${p.eng ? `<div><span>مدير المشروع</span><b>${esc(p.eng)}</b></div>` : ''}${p.contractor ? `<div><span>المقاول</span><b>${esc(p.contractor)}</b></div>` : ''}${p.facility ? `<div><span>المنشأة</span><b>${esc(p.facility)}</b></div>` : ''}<div><span>المرحلة</span><b>${esc(p.stageAr)}</b></div>${p.cv ? `<div><span>قيمة العقد</span><b>${n0(p.cv)} ر.س</b></div>` : p.budget ? `<div><span>الميزانية التقديرية</span><b>${n0(p.budget)} ر.س</b></div>` : ''}${p.start ? `<div><span>المباشرة</span><b>${dAr(p.start, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}${p.tender ? `<div><span>الطرح</span><b>${dAr(p.tender, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}${p.award ? `<div><span>الترسية</span><b>${dAr(p.award, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}</div>
    ${p.challenges.length ? `<h4>التحديات المفتوحة <span class="n">${p.challenges.length}</span></h4><div class="card">${p.challenges.map(c => `<div class="row" data-c="${c.id}">${scoreChip(c.score)}<div class="m"><b>${esc(c.title)}</b><small>${c.action ? esc(c.action.slice(0, 90)) : c.status}${c.due ? ' · ' + (c.due < today() ? '<span class="tag bad">تجاوز الموعد</span>' : 'الموعد ' + dAr(c.due)) : ''}</small></div><span class="chev">${I.chev}</span></div>`).join('')}</div>` : ''}
    ${sc && sc.ms.length ? `<h4>المعالم <span class="n">${sc.ms.filter(m => m.done).length} من ${sc.ms.length} تحققت</span></h4><ul class="ms">${sc.ms.map(m => `<li><span class="d ${m.done ? 'ok' : m.late ? 'late' : ''}"></span><span class="${m.late ? 'late-t' : ''}">${esc(m.name)}</span><time>${m.done ? 'تحقق ' + dAr(m.doneOn) : (m.late ? 'كان ' : '') + dAr(m.date)}</time></li>`).join('')}</ul>` : ''}
    ${sc && sc.pk.length ? `<h4>حزم الأعمال <span class="n">من الجدول الزمني: فعلي ${sc.actual}% / مخطط ${sc.planned}%</span></h4><ul class="pk">${sc.pk.sort((a, b) => b.w - a.w).slice(0, 8).map(k => `<li><div class="l"><span>${esc(k.name)} <span style="color:var(--muted)">(${k.w}%)</span></span><b>${k.pct}%</b></div><div class="pb"><i data-w="${k.pct}" style="width:${k.pct}%"></i></div></li>`).join('')}</ul>` : ''}
    ${p.next.length ? `<h4>الخطوات القادمة</h4>${p.next.map(t => `<div class="tsk"><span class="dot" style="background:${t.late ? 'var(--red)' : 'var(--lblue)'}"></span><div class="m">${esc(t.title)}<small>${esc(t.who)}${t.due ? ' · ' + (t.late ? '<span class="tag bad">متأخرة ' + dAr(t.due) + '</span>' : dAr(t.due)) : ''}</small></div></div>`).join('')}` : ''}
    ${p.lastUpdate || p.lastReport ? `<h4>آخر المستجدات</h4>${p.lastUpdate ? `<div class="note"><small>${dFull(p.lastUpdate.date)}</small>${esc(p.lastUpdate.body)}</div>` : ''}${p.lastReport ? `<p style="font-size:12.5px;color:var(--muted);margin:8px 0 0">آخر تقرير ميداني: ${esc(p.lastReport.title)} — ${dFull(p.lastReport.date)}</p>` : ''}` : ''}
    ${inExec ? `<h4>المالية</h4><div class="kv"><div><span>المستخلصات</span><b>${p.pays.paidN} مصروفة من ${p.pays.n}</b></div>${p.pays.pending ? `<div><span>قيد الاعتماد</span><b>${n0(p.pays.pending)} ر.س</b></div>` : ''}${p.pays.last ? `<div><span>آخر صرف</span><b>${dAr(p.pays.last, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}${p.changes ? `<div><span>أوامر تغيير معتمدة</span><b>${p.changes}</b></div>` : ''}${p.endBase && p.end !== p.endBase ? `<div><span>الانتهاء التعاقدي الأصلي</span><b>${dAr(p.endBase, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}</div>` : ''}
    <div class="act"><button class="btn" id="nb">${I.msg} ملاحظة على هذا المشروع</button></div>`;
  openSheet(p.name, `${esc(p.category)}${p.type ? ' · ' + esc(p.type) : ''}${p.ref ? ' · ' + esc(p.ref) : ''}`, body, { ref: 'project:' + p.id, title: p.name });
}

// ---------- تفاصيل تحدٍ
function openChallenge(id) {
  const c = D.challenges[id]; if (!c) return;
  const body = `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">${scoreChip(c.score)}<div style="flex:1"><div style="font-size:13px;color:var(--muted)">الدرجة = الأثر (${esc(c.sev)}) × الاحتمالية (${esc(c.lik)})</div><div style="margin-top:4px"><span class="tag ${c.status === 'قيد المعالجة' ? 'info' : 'warn'}">${esc(c.status)}</span> ${c.overdue ? '<span class="tag bad">تجاوز الموعد المستهدف</span>' : ''}</div></div></div>
    <div class="kv"><div data-p="${c.pid}" style="grid-column:1/-1;cursor:pointer"><span>المشروع</span><b style="color:var(--lblue)">${esc(c.pname)} ${I.chev.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')}</b></div><div><span>التصنيف</span><b>${esc(c.cat)}</b></div>${c.due ? `<div><span>الموعد المستهدف</span><b class="${c.overdue ? 'late-t' : ''}">${dAr(c.due, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}${c.impactDays ? `<div><span>أثر زمني متوقع</span><b>${c.impactDays} يوم</b></div>` : ''}${c.impactAmount ? `<div><span>أثر مالي متوقع</span><b>${n0(c.impactAmount)} ر.س</b></div>` : ''}${c.owner ? `<div><span>الجهة المسؤولة</span><b>${esc(c.owner)}</b></div>` : ''}${c.detected ? `<div><span>رُصد في</span><b>${dAr(c.detected, { year: 'numeric', month: 'short', day: 'numeric' })}</b></div>` : ''}</div>
    ${c.action ? `<h4>خطة المعالجة</h4><div class="note">${esc(c.action)}</div>` : ''}
    <h4>ما الذي يُعمل الآن <span class="n">${c.tasks.filter(t => t.status === 'done').length} منجزة من ${c.tasks.length}</span></h4>${c.tasks.length ? c.tasks.map(t => `<div class="tsk"><span class="dot" style="background:${t.status === 'done' ? 'var(--sage)' : t.status === 'in_progress' ? 'var(--lblue)' : 'var(--faint)'}"></span><div class="m">${esc(t.title)}<small>${esc(t.who)}${t.due ? ' · ' + dAr(t.due) : ''} · ${T_ST[t.status] || t.status}</small></div></div>`).join('') : '<p class="note">لم تُكلَّف مهام معالجة بعد.</p>'}
    ${c.notes.length ? `<h4>آخر المتابعات</h4><ul class="tl">${c.notes.map(n => `<li><small>${dFull(n.at)}</small>${esc(n.body)}</li>`).join('')}</ul>` : ''}
    <div class="act"><button class="btn" id="nb">${I.msg} ملاحظة على هذا التحدي</button></div>`;
  openSheet(c.title, `تحدٍ · ${esc(c.pname)}`, body, { ref: 'challenge:' + c.id, title: c.title });
}

// ---------- ملاحظة للإدارة
function openNote(ref) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ahc_exec') || '{}'); } catch (e) { }
  const body = `<form class="f" id="nf">${ref ? `<p class="note" style="margin:0"><small>ملاحظة على</small>${esc(ref.title)}</p>` : ''}<div class="two"><label>الاسم<input name="name" required value="${esc(saved.name || '')}" autocomplete="name"></label><label>الصفة<input name="role" value="${esc(saved.role || '')}" placeholder="مثال: نائب الرئيس"></label></div><label>الملاحظة أو التوجيه<textarea name="body" rows="4" required placeholder="اكتب ملاحظتك هنا…"></textarea></label><div class="act" style="margin-top:4px"><button type="button" class="btn" id="nc">إلغاء</button><button class="btn p">إرسال</button></div></form>`;
  openSheet('ملاحظة للقسم', 'تصل فوراً إلى رئيس قسم المشاريع', body, ref);
  const f = $('#nf'); $('#nc').onclick = () => closeSheet();
  f.onsubmit = async e => { e.preventDefault(); const btn = f.querySelector('.btn.p'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    const name = f.name.value.trim(), role = f.role.value.trim(), text = f.body.value.trim();
    try { localStorage.setItem('ahc_exec', JSON.stringify({ name, role })); } catch (x) { }
    const { data, error } = await sb.rpc('add_shared_note', { p_token: token, p_name: name, p_role: role, p_body: text, p_ref: ref?.ref || '', p_ref_title: ref?.title || '' });
    if (error || data?.error) { btn.disabled = false; btn.textContent = 'إرسال'; alert('تعذّر الإرسال، حاول مرة أخرى.'); return; }
    $('#shB').innerHTML = `<div class="ok-msg"><div class="ic">${I.check}</div><b>وصلت ملاحظتك</b><p style="color:var(--muted);margin:4px 0 0">شكراً لك، سيتم التعامل معها ومتابعتها من القسم.</p><div class="act" style="justify-content:center"><button class="btn" id="nc2" style="max-width:200px">إغلاق</button></div></div>`; $('#nc2').onclick = () => closeSheet(); };
}

if (!token) showErr('الرابط غير مكتمل', 'افتح الرابط كما وصلك بلا تعديل.'); else load();
