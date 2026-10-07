// ===== عارض العرض التنفيذي (بلا حساب): بنود حيّة من المنصة + تفاصيل عند الطلب + ملاحظات للقسم + تنزيل PowerPoint =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { B_KIND, itemState, briefStats, daysLeft, buildBriefPptx, dAr, dShort, PROC, FIN, laneAr, laneHex } from './brief_lib.js';
const cfg = window.AHC_CONFIG || {};
const sb = createClient(cfg.url, cfg.anon, { auth: { persistSession: false } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/></svg>',
};
const params = new URLSearchParams(location.search); const token = params.get('t') || '';
let B = null;
const lanes = it => { const has = it.proc_stage || it.proc_note || it.fin_stage || it.fin_note || (it.challenge || '').trim(); if (!has) return ''; return `<div class="lanes">${it.proc_stage || it.proc_note ? `<div class="lane"><i>المشتريات</i><span class="lc" style="background:#${laneHex(PROC, it.proc_stage)}">${esc(laneAr(PROC, it.proc_stage))}</span>${it.proc_note ? `<span>${esc(it.proc_note)}</span>` : ''}</div>` : ''}${it.fin_stage || it.fin_note ? `<div class="lane"><i>المالية</i><span class="lc" style="background:#${laneHex(FIN, it.fin_stage)}">${esc(laneAr(FIN, it.fin_stage))}</span>${it.fin_note ? `<span>${esc(it.fin_note)}</span>` : ''}</div>` : ''}${(it.challenge || '').trim() ? `<div class="lane ${it.needs_decision ? 'dec' : ''}"><i>التحدي</i>${it.needs_decision ? '<span class="lc" style="background:#C0392B">يحتاج قراركم</span>' : ''}<span>${esc(it.challenge)}</span></div>` : ''}${it.lanes_at ? `<small>آخر تحديث ${dShort(it.lanes_at)}</small>` : ''}</div>`; };

async function load(pin) {
  const { data, error } = await sb.rpc('get_brief', { p_token: token, p_pin: pin || null });
  if (error) return showErr('تعذّر الاتصال', 'تحقق من الاتصال بالإنترنت ثم أعد المحاولة.');
  if (data?.error === 'pin') return showPin(!!pin);
  if (data?.error) return showErr(data.error === 'expired' ? 'انتهت صلاحية هذا الرابط' : 'الرابط غير صالح', 'اطلب رابطاً محدّثاً من قسم المشاريع.');
  B = data; document.title = `${B.title} — ${B_KIND[B.kind] || 'عرض'}`; render();
}
function showErr(h, p) { $('#app').innerHTML = `<div class="xerr"><h2>${esc(h)}</h2><p>${esc(p)}</p></div>`; }
function showPin(wrong) { $('#app').innerHTML = `<div class="xerr"><h2>رمز الدخول</h2><p>هذا العرض محمي برمز، أدخله للمتابعة.</p><form id="pf"><input id="pin" inputmode="numeric" autocomplete="one-time-code" autofocus>${wrong ? '<p style="color:var(--red)">الرمز غير صحيح</p>' : ''}<br><button class="btn p" style="max-width:200px;margin:0 auto">فتح العرض</button></form></div>`; $('#pf').onsubmit = e => { e.preventDefault(); load($('#pin').value.trim()); }; }

function render() {
  const items = B.items || []; const st = briefStats(items); const dl = daysLeft(B.ref_date);
  const refL = B.ref_date ? (B.ref_label || 'الموعد') : 'الموعد';
  const card = (it, i) => { const S = itemState(it); const more = !!(it.notes || it.project || S.line); return `<div class="bi" data-i="${i}"><span class="no">${i + 1}</span><div class="m"><b>${esc(it.title)}</b>${S.line ? `<small>${esc(S.line)}</small>` : ''}${S.pct != null ? `<div class="pb"><i data-w="${S.pct}" style="background:#${S.hex}"></i></div>` : ''}${it.expected || it.show_text ? `<div class="ex">${it.expected ? `<div><span>المستهدف وقت ${esc(refL)}</span><b>${esc(it.expected)}</b></div>` : ''}${it.show_text ? `<div><span>ما سيُعرض ميدانياً</span><b>${esc(it.show_text)}</b></div>` : ''}</div>` : ''}${lanes(it)}${more ? `<small class="hint">اضغط لاستعراض التفاصيل</small>` : ''}</div><div class="side"><span class="ch" style="background:#${S.hex}">${esc(S.chip)}</span>${it.target_date ? `<span class="tgt">${dShort(it.target_date)}</span>` : ''}</div><span class="chev">${I.chev}</span></div>`; };
  $('#app').innerHTML = `
  <div class="top" id="top"><div class="in"><img src="assets/logo.png" alt=""><div class="t"><b>${esc(B.title)}</b><small>تجمع الأحساء الصحي · ${B_KIND[B.kind] || 'عرض'}</small></div><button class="ibtn" id="prn" title="طباعة / PDF">${I.print}</button></div></div>
  <div class="wrap">
    <header class="bhero in"><span class="kd">${esc((B_KIND[B.kind] || 'عرض').toUpperCase())}</span><h1>${esc(B.title)}</h1>${B.subtitle ? `<p class="sub">${esc(B.subtitle)}</p>` : ''}
      ${dl != null ? `<div class="cd ${dl < 0 ? 'over' : ''}"><b>${Math.abs(dl)}</b><span>${dl < 0 ? 'يوماً مضت على' : dl === 0 ? 'اليوم هو' : 'يوماً متبقية حتى'} <b>${esc(B.ref_label || 'الموعد')}</b><br>${dAr(B.ref_date)}</span></div>` : ''}
      <div class="bst"><div><b>${st.n}</b><span>بنداً</span></div><div><b>${st.exec + st.done}</b><span>قيد التنفيذ أو منجزة</span></div><div><b>${st.avg}%</b><span>متوسط التقدم</span></div>${st.decisions ? `<div class="dec"><b>${st.decisions}</b><span>تحتاج قراركم</span></div>` : ''}</div>
      <div class="meta"><span>إعداد <b>${esc(B.by || 'قسم المشاريع')}</b></span><span>آخر تحديث <b>${dAr(B.updated)}</b></span><span>الأرقام حيّة من منصة إدارة المشاريع</span></div></header>
    ${B.intro ? `<div class="bintro in" style="animation-delay:.05s">${esc(B.intro).replace(/\n/g, '<br>')}</div>` : ''}
    <section class="sec in" style="animation-delay:.1s"><h2>البنود <span class="n">${items.length}</span></h2><div class="card">${items.length ? items.map(card).join('') : '<div class="empty">لا بنود في هذا العرض بعد</div>'}</div></section>
    ${B.closing ? `<div class="bclose in" style="animation-delay:.15s"><h2>${B.kind === 'proposal' ? 'التوصية والقرار المطلوب' : 'الخلاصة والقرارات المطلوبة'}</h2>${esc(B.closing).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="tools"><button class="btn" id="pptx">${I.dl} تنزيل PowerPoint</button></div>
    <footer class="foot">عرض من منصة إدارة مشاريع تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع. البنود المرتبطة بمشاريع تعرض وضعها الحالي من المنصة لحظة الفتح؛ اضغط أي بند للتفاصيل أو لإرسال ملاحظة.</footer>
  </div>
  <button class="fab" id="fab">${I.msg} أرسل ملاحظة</button>
  <div class="ov" id="ov"></div><div class="sheet" id="sheet" role="dialog"><div class="grab"></div><div class="sh"><div style="flex:1;min-width:0"><h3 id="shT"></h3></div><button class="x" id="shX">${I.x}</button></div><div class="sb" id="shB"></div></div>`;
  wire(); motion();
}
function motion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = () => $$('.pb i').forEach(i => i.style.width = i.dataset.w + '%');
  if (reduced) return go();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.width = e.target.dataset.w + '%'; io.unobserve(e.target); } }), { threshold: .2 });
  $$('.pb i').forEach(el => io.observe(el)); addEventListener('beforeprint', go);
  const top = $('#top'); addEventListener('scroll', () => top.classList.toggle('on', scrollY > 30), { passive: true });
}
let sheetOpen = false, startY = 0;
function openSheet(title, sub, body) {
  $('#shT').innerHTML = esc(title) + (sub ? `<small>${sub}</small>` : ''); $('#shB').innerHTML = body; $('#shB').scrollTop = 0;
  $('#ov').style.display = 'block'; $('#sheet').style.display = 'flex'; requestAnimationFrame(() => { $('#ov').classList.add('on'); $('#sheet').classList.add('on'); });
  if (!sheetOpen) history.pushState({ sheet: 1 }, ''); sheetOpen = true; document.body.style.overflow = 'hidden';
}
function closeSheet(fromPop) { if (!sheetOpen) return; sheetOpen = false; $('#ov').classList.remove('on'); $('#sheet').classList.remove('on'); document.body.style.overflow = ''; setTimeout(() => { if (!sheetOpen) { $('#ov').style.display = 'none'; $('#sheet').style.display = 'none'; } }, 320); if (!fromPop && history.state?.sheet) history.back(); }
function wire() {
  $('#app').addEventListener('click', e => { const el = e.target.closest('[data-i]'); if (el) openItem(+el.dataset.i); });
  $('#ov').onclick = () => closeSheet(); $('#shX').onclick = () => closeSheet(); $('#fab').onclick = () => openNote(null); $('#prn').onclick = () => print();
  $('#pptx').onclick = async () => { const b = $('#pptx'); b.disabled = true; b.textContent = 'جارٍ التجهيز…'; try { const blob = await buildBriefPptx(B, B.items || []); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = B.title + '.pptx'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); } catch (er) { alert('تعذّر إنشاء الملف: ' + (er.message || er)); } finally { b.disabled = false; b.innerHTML = I.dl + ' تنزيل PowerPoint'; } };
  addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });
  const sh = $('#sheet'); sh.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchend', e => { const dy = e.changedTouches[0].clientY - startY; if (dy > 90 && $('#shB').scrollTop <= 0) closeSheet(); }, { passive: true });
}
function openItem(i) {
  const it = B.items[i]; if (!it) return; const S = itemState(it), p = it.project;
  const body = `<p style="margin:0 0 12px"><span class="ch" style="background:#${S.hex};color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px">${esc(S.chip)}</span>${S.late ? ' <span class="tag bad">متأخر</span>' : ''}${it.target_date ? ` <span class="tag">المستهدف ${dAr(it.target_date)}</span>` : ''}</p>
    ${S.pct != null ? `<div class="pb"><i data-w="${S.pct}" style="width:${S.pct}%;background:#${S.hex}"></i></div><div style="font-size:11.5px;color:var(--muted);margin:4px 0 12px">التقدم ${S.pct}%${p && p.stage === 'execution' ? ` · المخطط ${Math.round(Number(p.pl) || 0)}%` : ''}</div>` : ''}
    <div class="dg">${S.line ? `<div><span>الوضع الراهن</span><b>${esc(S.line)}</b></div>` : ''}${it.expected ? `<div><span>الإنجاز المتوقع${B.ref_date ? ' بحلول ' + esc(B.ref_label || 'الموعد') : ''}</span><b>${esc(it.expected)}</b></div>` : ''}${it.show_text ? `<div><span>ما سيُعرض ميدانياً</span><b>${esc(it.show_text)}</b></div>` : ''}${it.notes ? `<div><span>ملاحظات</span><b>${esc(it.notes)}</b></div>` : ''}</div>
    ${lanes(it)}
    ${p ? `<div class="kv">${p.facility ? `<div><span>المنشأة</span><b>${esc(p.facility)}</b></div>` : ''}${p.contractor ? `<div><span>المقاول</span><b>${esc(p.contractor)}</b></div>` : ''}${p.start ? `<div><span>المباشرة</span><b>${dAr(p.start)}</b></div>` : ''}${p.end ? `<div><span>الانتهاء</span><b>${dAr(p.end)}</b></div>` : ''}</div>` : ''}
    <div class="act"><button class="btn" id="nb">${I.msg} ملاحظة على هذا البند</button></div>`;
  openSheet(it.title, p ? 'مرتبط بمشروع في المنصة — الوضع حيّ' : 'بند من خارج المنصة', body);
  $('#nb').onclick = () => openNote(it);
}
function openNote(it) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ahc_exec') || '{}'); } catch (e) { }
  const body = `<form class="f" id="nf">${it ? `<p class="note" style="margin:0"><small>ملاحظة على</small>${esc(it.title)}</p>` : ''}<div class="two"><label>الاسم<input name="name" required value="${esc(saved.name || '')}" autocomplete="name"></label><label>الصفة<input name="role" value="${esc(saved.role || '')}" placeholder="مثال: مدير الإدارة"></label></div><label>الملاحظة أو التوجيه<textarea name="body" rows="4" required placeholder="اكتب ملاحظتك هنا…"></textarea></label><div class="act" style="margin-top:4px"><button type="button" class="btn" id="nc">إلغاء</button><button class="btn p">إرسال</button></div></form>`;
  openSheet('ملاحظة للقسم', 'تصل فوراً إلى رئيس قسم المشاريع', body);
  const f = $('#nf'); $('#nc').onclick = () => closeSheet();
  f.onsubmit = async e => { e.preventDefault(); const btn = f.querySelector('.btn.p'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    const name = f.name.value.trim(), role = f.role.value.trim(), text = f.body.value.trim();
    try { localStorage.setItem('ahc_exec', JSON.stringify({ name, role })); } catch (x) { }
    const { data, error } = await sb.rpc('add_brief_note', { p_token: token, p_name: name, p_role: role, p_body: text, p_item: it?.id || null });
    if (error || data?.error) { btn.disabled = false; btn.textContent = 'إرسال'; alert('تعذّر الإرسال، حاول مرة أخرى.'); return; }
    $('#shB').innerHTML = `<div class="ok-msg"><div class="ic">${I.check}</div><b>وصلت ملاحظتك</b><p style="color:var(--muted);margin:4px 0 0">شكراً لك، ستُتابع من القسم.</p><div class="act" style="justify-content:center"><button class="btn" id="nc2" style="max-width:200px">إغلاق</button></div></div>`; $('#nc2').onclick = () => closeSheet(); };
}
if (!token) showErr('الرابط غير مكتمل', 'افتح الرابط كما وصلك بلا تعديل.'); else load();
