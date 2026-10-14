// ===== عارض تقرير حالة الأنظمة المشارك (بلا حساب) + ملاحظات الجهة التنفيذية =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { renderReport, monthAr } from './fm_report.js';
const cfg = window.AHC_CONFIG || {};
const sb = createClient(cfg.url, cfg.anon, { auth: { persistSession: false } });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.getElementById('app');
const token = new URLSearchParams(location.search).get('t') || '';
const ERR = { bad_token: 'الرابط غير صحيح.', not_found: 'الرابط غير موجود أو أُوقف.', expired: 'انتهت صلاحية الرابط. اطلب رابطاً جديداً.' };
let me = (() => { try { return JSON.parse(localStorage.getItem('fmr_me') || '{}'); } catch { return {}; } })();

async function open(pin) {
  const { data, error } = await sb.rpc('get_fm_share', { p_token: token, p_pin: pin || null });
  if (error) { app.innerHTML = `<div class="fx-msg"><h1>تعذّر فتح التقرير</h1><p>${esc(error.message)}</p></div>`; return; }
  if (data?.error === 'pin') return pinForm(!!pin);
  if (data?.error) { app.innerHTML = `<div class="fx-msg"><h1>تقرير حالة الأنظمة</h1><p>${ERR[data.error] || 'تعذّر فتح التقرير.'}</p></div>`; return; }
  const R = data.data;
  document.title = `تقرير حالة الأنظمة — ${monthAr(R.period)}`;
  app.innerHTML = `<div class="fx-top"><div><b>تقرير حالة الأنظمة الحرجة</b><br><small>${monthAr(R.period)} · تجمع الأحساء الصحي</small></div><span class="sp"></span><button class="pri" id="xNote">أرسل ملاحظة</button><button id="xPrint">طباعة</button></div>
    <div class="fx-wrap"><div class="fmrep">${renderReport(R, { notes: true })}</div></div>`;
  document.getElementById('xPrint').onclick = () => print();
  document.getElementById('xNote').onclick = () => noteForm('', '');
  app.querySelectorAll('[data-note]').forEach(b => b.onclick = () => { const a = R.active[+b.dataset.note]; noteForm(`active:${b.dataset.note}`, `${a.fac} — ${a.sys}`); });
}
function pinForm(wrong) {
  app.innerHTML = `<div class="fx-msg"><h1>تقرير حالة الأنظمة الحرجة</h1><p>أدخل رمز الدخول المرسل لك.</p>${wrong ? '<p style="color:#C0392B">الرمز غير صحيح.</p>' : ''}<form id="pf"><input name="p" inputmode="numeric" autocomplete="off" autofocus><br><div class="fx-row" style="justify-content:center"><button class="pri">فتح</button></div></form></div>`;
  document.getElementById('pf').onsubmit = e => { e.preventDefault(); open(e.target.p.value.trim()); };
}
function noteForm(ref, refTitle) {
  const d = document.createElement('div'); d.className = 'fx-dlg';
  d.innerHTML = `<div class="fx-card"><h3>ملاحظة على التقرير</h3>${refTitle ? `<p style="margin:0;color:#66768A">على: <b>${esc(refTitle)}</b></p>` : ''}<form id="nf"><label>الاسم *<input name="n" required value="${esc(me.n || '')}"></label><label>الصفة<input name="r" value="${esc(me.r || '')}" placeholder="مثال: نائب الرئيس للتشغيل"></label><label>الملاحظة *<textarea name="b" rows="4" required></textarea></label><div class="fx-row"><button type="button" id="nc">إلغاء</button><button class="pri">إرسال</button></div></form></div>`;
  document.body.appendChild(d);
  d.querySelector('#nc').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#nf').onsubmit = async e => { e.preventDefault(); const f = e.target; me = { n: f.n.value.trim(), r: f.r.value.trim() }; try { localStorage.setItem('fmr_me', JSON.stringify(me)); } catch { }
    const { data, error } = await sb.rpc('add_fm_share_note', { p_token: token, p_name: me.n, p_role: me.r, p_body: f.b.value.trim(), p_ref: ref, p_ref_title: refTitle });
    if (error || data?.error) { const x = document.createElement('div'); x.className = 'fx-ok'; x.style.background = '#C0392B'; x.textContent = 'تعذّر الإرسال، حاول مرة أخرى'; document.body.appendChild(x); setTimeout(() => x.remove(), 3000); return; }
    d.remove(); const ok = document.createElement('div'); ok.className = 'fx-ok'; ok.textContent = 'وصلت ملاحظتك، شكراً لك'; document.body.appendChild(ok); setTimeout(() => ok.remove(), 3000); };
}
open();
