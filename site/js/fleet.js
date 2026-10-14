// ===== قسم الحركة: لوحة الحركة (تسليم السيارات واستلامها)، سجل الحركة، الأسطول، وصفحة «سيارات المقر» لكل موظف =====
import { sb, q, session, isAdmin, canRead, role } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, dateAr, download, ico } from './ui.js';
import { O, loadOps, uchip, uname, ucolor, pname, dur, staffOf } from './ops.js';

const VST = { available: { ar: 'متاحة', c: '#2E8B57' }, out: { ar: 'خارج المقر', c: '#1B6CA8' }, maint: { ar: 'في الصيانة', c: '#C99A1E' }, off: { ar: 'موقوفة', c: '#7A8794' } };
const TST = { requested: { ar: 'طلب جديد', c: '#C99A1E' }, out: { ar: 'خارج المقر', c: '#1B6CA8' }, returned: { ar: 'أُعيدت', c: '#2E8B57' }, cancelled: { ar: 'ملغى', c: '#9AA6B2' }, rejected: { ar: 'مرفوض', c: '#C0392B' } };
const VKIND = { sedan: 'سيدان', suv: 'دفع رباعي', pickup: 'بيك أب', van: 'فان', bus: 'حافلة', other: 'أخرى' };
const CHK = [['clean', 'النظافة'], ['tires', 'الإطارات'], ['body', 'لا أضرار ظاهرة بالهيكل'], ['docs', 'الاستمارة والتأمين داخل السيارة'], ['card', 'بطاقة الوقود'], ['kit', 'الطفاية وعدة الطوارئ']];
const FUEL = [[0, 'فارغ'], [2, '¼'], [4, '½'], [6, '¾'], [8, 'ممتلئ']];
const fuelTxt = n => n == null ? '—' : (FUEL.find(f => f[0] === n)?.[1] || `${n}/8`);
const T = d => d ? new Date(d).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }) : '—';
const DT = d => d ? new Date(d).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isToday = d => d && new Date(d) >= today0();
const km = t => t.odo_back != null && t.odo_out != null ? t.odo_back - t.odo_out : null;
const isLateT = t => t.status === 'out' && t.expected_back && new Date(t.expected_back) < new Date();
const backLate = t => t.status === 'returned' && t.expected_back && new Date(t.back_at) > new Date(new Date(t.expected_back).getTime() + 15 * 6e4);
const isTrn = () => staffOf('TRN');
const plate = (p, big = false) => { const s = String(p || ''); const n = (s.match(/[0-9٠-٩]+/g) || []).join(' '), l = s.replace(/[0-9٠-٩]/g, '').trim(); return `<span class="plate ${big ? 'big' : ''}" title="${esc(s)}"><b>${esc(n || s)}</b>${l ? `<i>${esc(l)}</i>` : ''}<s>KSA</s></span>`; };
const vPill = s => `<span class="opill" style="--c:${VST[s]?.c}">${VST[s]?.ar || s}</span>`;
const tPill = (t) => isLateT(t) ? '<span class="opill" style="--c:#C0392B">متأخرة عن العودة</span>' : `<span class="opill" style="--c:${TST[t.status]?.c}">${TST[t.status]?.ar || t.status}</span>`;
const docDays = d => d ? Math.floor((new Date(d) - today0()) / 864e5) : null;
const DOCS = [['reg_exp', 'الاستمارة'], ['ins_exp', 'التأمين'], ['insp_exp', 'الفحص الدوري']];
const docIssues = v => DOCS.map(([k, l]) => { const n = docDays(v[k]); return n == null ? null : n < 0 ? { l, n, bad: true, t: `${l} منتهية منذ ${-n} يوماً` } : n <= 30 ? { l, n, t: `${l} تنتهي خلال ${n} يوماً` } : null; }).filter(Boolean);
const serviceDue = v => (v.service_date && docDays(v.service_date) <= 7) || (v.service_km && v.odometer >= v.service_km - 500);
const vName = v => [v.make, v.model, v.year].filter(Boolean).join(' ') || VKIND[v.kind] || 'سيارة';

// ---------- البيانات
export const F = { V: [], VI: {}, trips: [] };
export async function loadFleet() {
  const from = new Date(); from.setDate(1); from.setMonth(from.getMonth() - 1); from.setHours(0, 0, 0, 0);
  const [V, trips] = await Promise.all([
    q(sb.from('vehicles').select('*').order('active', { ascending: false }).order('sort').order('plate')),
    q(sb.from('vehicle_trips').select('*').or(`status.in.(requested,out),created_at.gte.${from.toISOString()},out_at.gte.${from.toISOString()}`).order('id', { ascending: false }).limit(3000)),
  ]);
  Object.assign(F, { V, VI: Object.fromEntries(V.map(v => [v.id, v])), trips });
  return F;
}

// ---------- تبويبات القسم
export async function mountFleetTab(t, tab, params, re) {
  t.innerHTML = '<div class="empty-boq">…</div>';
  try { await loadFleet(); } catch (e) { t.innerHTML = `<div class="empty-boq">تعذّر تحميل بيانات الحركة: ${esc(e.message || e)}</div>`; return; }
  if (tab === 'trips') return viewTrips(t, params, re);
  if (tab === 'vehicles') return viewVehicles(t, params, re);
  return viewDash(t, re);
}

function viewDash(t, re) {
  const act = F.V.filter(v => v.active), out = F.trips.filter(x => x.status === 'out'), late = out.filter(isLateT), reqs = F.trips.filter(x => x.status === 'requested').sort((a, b) => new Date(a.need_at || a.created_at) - new Date(b.need_at || b.created_at));
  const todayT = F.trips.filter(x => isToday(x.out_at) || isToday(x.back_at)), kmToday = todayT.reduce((a, x) => a + (isToday(x.back_at) ? km(x) || 0 : 0), 0);
  const avail = act.filter(v => v.status === 'available'), maint = act.filter(v => ['maint', 'off'].includes(v.status));
  const alerts = act.flatMap(v => [...docIssues(v).map(d => ({ v, ...d })), ...(serviceDue(v) ? [{ v, t: 'الصيانة الدورية مستحقة', bad: false }] : [])]);
  const tripOf = v => out.find(x => x.vehicle_id === v.id);
  const can = isTrn();
  const card = v => { const tr = tripOf(v), L = tr && isLateT(tr), di = docIssues(v), blocked = di.some(d => d.bad);
    return `<div class="flv ${v.status} ${L ? 'late' : ''}" data-v="${v.id}" style="--c:${L ? '#C0392B' : VST[v.status]?.c}">
      <div class="flv-h">${plate(v.plate)}<span class="flv-st">${L ? 'متأخرة' : VST[v.status]?.ar}</span></div>
      <div class="flv-n"><b>${esc(vName(v))}</b><small>${[VKIND[v.kind], v.color, v.seats ? v.seats + ' مقاعد' : ''].filter(Boolean).map(esc).join(' · ')} · ${Number(v.odometer || 0).toLocaleString('en')} كم</small></div>
      ${tr ? `<div class="flv-trip"><div class="flv-who">${ico('user')}<b>${esc(tr.driver_name)}</b>${uchip(tr.unit)}</div><small>${ico('pin')} ${esc(tr.dest || O.F[tr.facility_id]?.name || '—')} · ${esc(tr.purpose)}</small>
        <div class="flv-time"><span>خرجت ${T(tr.out_at)}</span><span class="${L ? 'bad' : ''}">${L ? 'متأخرة ' + dur(Date.now() - new Date(tr.expected_back)) : (tr.overnight ? 'مبيت حتى ' + DT(tr.expected_back) : 'العودة ' + T(tr.expected_back))}</span></div></div>`
        : di.length || serviceDue(v) ? `<div class="flv-warn">${di.map(d => `<span class="${d.bad ? 'bad' : ''}">${ico('alert')} ${esc(d.t)}</span>`).join('')}${serviceDue(v) ? `<span>${ico('wrench')} الصيانة الدورية مستحقة</span>` : ''}</div>` : ''}
      ${can ? `<div class="flv-a">${tr ? `<button class="btn primary" data-ret="${tr.id}">${ico('download')} استلام</button>` : v.status === 'available' ? `<button class="btn primary" data-out="${v.id}" ${blocked ? 'disabled title="وثيقة منتهية — R-41"' : ''}>${ico('key')} تسليم</button>` : `<button class="btn" data-back="${v.id}">إعادة للخدمة</button>`}</div>` : ''}
    </div>`; };
  // إحصاءات الشهر
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const done = F.trips.filter(x => x.status === 'returned' && new Date(x.back_at) >= m0), kmM = done.reduce((a, x) => a + (km(x) || 0), 0);
  const onTime = done.length ? Math.round(done.filter(x => !backLate(x)).length / done.length * 100) : null;
  const hrs = done.length ? done.reduce((a, x) => a + (new Date(x.back_at) - new Date(x.out_at)), 0) / done.length : null;
  const byU = {}; done.forEach(x => { const k = x.unit || '—'; byU[k] = (byU[k] || 0) + 1; }); const uMax = Math.max(1, ...Object.values(byU));
  const byV = {}; done.forEach(x => { byV[x.vehicle_id] = (byV[x.vehicle_id] || 0) + (km(x) || 0); }); const vTop = Object.entries(byV).sort((a, b) => b[1] - a[1]).slice(0, 6), vMax = Math.max(1, ...vTop.map(x => x[1]));
  const days = new Set(done.map(x => x.vehicle_id + ':' + String(x.out_at).slice(0, 10))).size; const wd = (() => { let n = 0; for (let d = new Date(m0); d <= new Date(); d.setDate(d.getDate() + 1)) if (![5, 6].includes(d.getDay())) n++; return n; })();
  const util = act.length && wd ? Math.min(100, Math.round(days / (act.length * wd) * 100)) : null;
  const tl = [...todayT.flatMap(x => [isToday(x.out_at) ? { at: x.out_at, x, k: 'out' } : null, isToday(x.back_at) ? { at: x.back_at, x, k: 'back' } : null]).filter(Boolean)].sort((a, b) => new Date(b.at) - new Date(a.at));

  t.innerHTML = `<div class="fltool">${can ? `<button class="btn primary" id="flOut">${ico('key')} تسليم سيارة</button>` : ''}<button class="btn" id="flReq">${ico('plus')} طلب سيارة</button><span class="sp"></span><a class="btn ghost" href="#/dept/TRN/trips">${ico('clip2')} سجل الحركة</a><a class="btn ghost" href="#/dept/TRN/vehicles">${ico('car')} الأسطول</a></div>
    ${!act.length ? `<div class="pcard dhow" style="--c:#0E7C86"><h2>ابدأ بتسجيل سيارات المقر</h2><p class="muted">سجّل كل سيارة بلوحتها وعدادها ووثائقها، ثم يسلّمها مسؤول الحركة من هذه اللوحة ويستلمها في نفس اليوم (V-01).</p><div class="dready"><a href="#/dept/TRN/vehicles?add=1">＋ أضف السيارات</a><a href="#/admin/users">＋ أضف مسؤول الحركة (الدور «موظف قسم فني» + القسم «الحركة»)</a></div></div>` : ''}
    <div class="fmkpis dk flk">
      <div class="fmk green"><b>${avail.length}</b><span>متاحة الآن</span><small>من ${act.length} سيارة نشطة</small></div>
      <div class="fmk blue"><b>${out.length}</b><span>خارج المقر</span><small>${out.filter(x => x.overnight).length ? out.filter(x => x.overnight).length + ' بمبيت معتمد' : 'كلها تعود اليوم'}</small></div>
      <div class="fmk ${late.length ? 'red' : 'green'}"><b>${late.length}</b><span>متأخرة عن العودة</span><small>${late.length ? 'تواصل مع مستلميها' : 'لا تأخير'}</small></div>
      <div class="fmk ${reqs.length ? 'amber' : ''}"><b>${reqs.length}</b><span>طلبات بانتظار التسليم</span></div>
      <div class="fmk ${maint.length ? 'amber' : ''}"><b>${maint.length}</b><span>في الصيانة أو موقوفة</span></div>
      <div class="fmk"><b>${todayT.filter(x => isToday(x.out_at)).length}</b><span>رحلات اليوم</span><small>${kmToday.toLocaleString('en')} كم مقطوعة</small></div>
    </div>
    <div class="flgrid">
      <div class="pcard"><h2>السيارات الآن <span class="muted small">${act.length}</span></h2>${act.length ? `<div class="flboard">${[...act].sort((a, b) => (isLateT(tripOf(b) || {}) - isLateT(tripOf(a) || {})) || ['out', 'available', 'maint', 'off'].indexOf(a.status) - ['out', 'available', 'maint', 'off'].indexOf(b.status)).map(card).join('')}</div>` : '<p class="muted">لا سيارات مسجلة بعد.</p>'}</div>
      <div class="flside">
        <div class="pcard"><h2>طلبات بانتظار التسليم <span class="muted small">${reqs.length}</span></h2>${reqs.length ? `<div class="flreq">${reqs.map(x => `<div class="flr" data-t="${x.id}"><div><b>${esc(x.driver_name)}</b> ${uchip(x.unit)}<small>${esc(x.purpose)}${x.dest ? ' · ' + esc(x.dest) : ''}</small><small class="${x.need_at && new Date(x.need_at) < new Date() ? 'bad' : ''}">${ico('clock')} ${x.need_at ? DT(x.need_at) : 'الآن'}${x.overnight ? ' · <b>مبيت</b>' : ''}</small></div>${can ? `<div class="btnrow"><button class="btn sm primary" data-give="${x.id}">تسليم</button><button class="btn sm ghost" data-rej="${x.id}">رفض</button></div>` : ''}</div>`).join('')}</div>` : '<p class="muted small">لا طلبات معلّقة.</p>'}</div>
        <div class="pcard"><h2>تنبيهات الأسطول <span class="muted small">${alerts.length}</span></h2>${alerts.length ? `<ul class="flal">${alerts.map(a => `<li class="${a.bad ? 'bad' : ''}" data-v="${a.v.id}">${plate(a.v.plate)}<span>${esc(a.t)}</span></li>`).join('')}</ul>` : '<p class="muted small">الوثائق سارية ولا صيانة مستحقة.</p>'}</div>
      </div>
    </div>
    <div class="fm2col">
      <div class="pcard"><h2>حركة اليوم</h2>${tl.length ? `<ol class="fltl">${tl.map(e => `<li class="${e.k}" data-t="${e.x.id}"><time>${T(e.at)}</time><span class="d"></span><div><b>${e.k === 'out' ? 'تسليم' : 'استلام'} ${esc(F.VI[e.x.vehicle_id]?.plate || '')}</b><small>${esc(e.x.driver_name)} · ${esc(uname(e.x.unit))}${e.k === 'back' ? ` · ${km(e.x) ?? '—'} كم${e.x.damage ? ' · <em>ضرر</em>' : ''}` : ` · ${esc(e.x.dest || e.x.purpose)}`}</small></div></li>`).join('')}</ol>` : '<p class="muted small">لم تخرج سيارة اليوم بعد.</p>'}</div>
      <div class="pcard"><h2>هذا الشهر <a class="small" href="#/dept/TRN/trips">التفاصيل ‹</a></h2>
        <div class="dmini flm"><div><b>${done.length}</b><span>رحلة منجزة</span></div><div><b>${kmM.toLocaleString('en')}</b><span>كم مقطوعة</span></div><div><b>${onTime == null ? '—' : onTime + '٪'}</b><span>عادت في موعدها</span></div><div><b>${hrs ? dur(hrs) : '—'}</b><span>متوسط مدة الرحلة</span></div><div><b>${util == null ? '—' : util + '٪'}</b><span>استغلال الأسطول</span></div></div>
        ${Object.keys(byU).length ? `<h3 class="sub-h">الرحلات حسب القسم</h3><div class="flbars">${Object.entries(byU).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div><span>${esc(uname(u))}</span><i style="--w:${n / uMax * 100}%;--c:${ucolor(u)}"></i><b>${n}</b></div>`).join('')}</div>` : ''}
        ${vTop.length ? `<h3 class="sub-h">الأكثر استخداماً (كم)</h3><div class="flbars">${vTop.map(([v, n]) => `<div><span>${esc(F.VI[v]?.plate || '')}</span><i style="--w:${n / vMax * 100}%;--c:#0E7C86"></i><b>${n.toLocaleString('en')}</b></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
  const done2 = () => re();
  $('#flOut', t)?.addEventListener('click', () => handover(null, null, done2));
  $('#flReq', t).onclick = () => requestForm(done2);
  $$('[data-out]', t).forEach(b => b.onclick = e => { e.stopPropagation(); handover(null, +b.dataset.out, done2); });
  $$('[data-ret]', t).forEach(b => b.onclick = e => { e.stopPropagation(); receive(+b.dataset.ret, done2); });
  $$('[data-give]', t).forEach(b => b.onclick = e => { e.stopPropagation(); handover(+b.dataset.give, null, done2); });
  $$('[data-rej]', t).forEach(b => b.onclick = e => { e.stopPropagation(); reject(+b.dataset.rej, done2); });
  $$('[data-back]', t).forEach(b => b.onclick = async e => { e.stopPropagation(); if (!await confirm('إعادة السيارة للخدمة (متاحة للتسليم)؟ تأكد من إغلاق بلاغ إصلاحها.', 'إعادة للخدمة')) return; try { await q(sb.from('vehicles').update({ status: 'available' }).eq('id', +b.dataset.back)); toast('أُعيدت للخدمة'); done2(); } catch (x) { err(x); } });
  $$('[data-v]', t).forEach(c => c.onclick = e => { if (e.target.closest('button,a')) return; vehicleCard(+c.dataset.v, done2); });
  $$('[data-t]', t).forEach(c => c.onclick = e => { if (e.target.closest('button,a')) return; tripCard(+c.dataset.t, done2); });
  // تحديث المؤقتات كل دقيقة ما دامت اللوحة معروضة
  clearInterval(window.__flTick); window.__flTick = setInterval(() => { if (!document.body.contains(t) || !$('.flboard', t)) return clearInterval(window.__flTick); if (!document.querySelector('.mwrap')) re(); }, 60000);
}

// ---------- النماذج
const fuelPick = (name, val) => `<div class="flfuel" data-fuel="${name}">${FUEL.map(([v, l]) => `<button type="button" data-f="${v}" class="${val === v ? 'on' : ''}"><i style="--h:${v / 8 * 100}%"></i>${l}</button>`).join('')}<input type="hidden" name="${name}" value="${val ?? ''}"></div>`;
const bindFuel = w => $$('.flfuel', w).forEach(g => $$('button', g).forEach(b => b.onclick = () => { $$('button', g).forEach(x => x.classList.toggle('on', x === b)); $('input', g).value = b.dataset.f; }));
const chkBox = (prefix, val = {}) => `<div class="flchk">${CHK.map(([k, l]) => `<label><input type="checkbox" name="${prefix}_${k}" ${val[k] !== false ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
const readChk = (x, prefix) => Object.fromEntries(CHK.map(([k]) => [k, x[prefix + '_' + k] === 'on']));
const localDT = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 16); };
const defBack = () => { const d = new Date(); d.setHours(15, 30, 0, 0); if (d < new Date(Date.now() + 36e5)) return new Date(Date.now() + 36e5); return d; };
const people = () => (O.people || []).filter(p => p.full_name).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
const unitOpts = () => [['', '—'], ...(O.G?.units || []).filter(u => u.kind === 'unit' || u.kind === 'mgmt').map(u => [u.code, u.short])];
const facOpts = () => [['', 'المقر الرئيسي أو جهة أخرى'], ...(O.fac || []).map(f => [f.id, f.name])];
async function uploadFiles(files, ref) { if (!files?.length) return; const { uploadAttachment } = await import('./attach.js'); for (const f of files) { try { await uploadAttachment(f, ref); } catch (e) { err(e); } } }

// طلب سيارة: الموظف لنفسه، أو مسؤول الحركة نيابة عن موظف
export async function requestForm(done) {
  if (!O.G) await loadOps();
  const staff = isTrn(), need = new Date(Date.now() + 36e5); need.setMinutes(0, 0, 0);
  modal(`<form id="rf" class="pgrid">
    ${staff ? `${field('الموظف *', `<input name="who" list="flppl" required autocomplete="off" placeholder="اكتب الاسم"><datalist id="flppl">${people().map(p => `<option value="${esc(p.full_name)}">${esc(uname(p.unit))}</option>`).join('')}</datalist>`)}${field('القسم', sel('unit', unitOpts(), ''))}` : ''}
    ${field('غرض المهمة *', inp('purpose', '', 'required placeholder="مثال: زيارة موقع مشروع توسعة الطوارئ"'), 'wide')}
    ${field('الوجهة', sel('facility_id', facOpts(), ''))}${field('تفاصيل الوجهة', inp('dest', '', 'placeholder="الجهة أو الحي"'))}
    ${field('وقت الخروج *', `<input type="datetime-local" name="need_at" required value="${localDT(need)}">`)}${field('العودة المتوقعة *', `<input type="datetime-local" name="expected_back" required value="${localDT(defBack())}">`)}
    <label class="flon wide"><input type="checkbox" name="overnight"><span><b>مبيت أو خارج المحافظة</b><small>يحتاج اعتماد رئيس قسم الحركة مسبقاً (V-06)</small></span></label>
    ${field('عدد المرافقين', inp('passengers', '', 'type="number" min="0" max="40"'))}${field('جوال للتواصل', inp('phone', session.profile?.phone || '', 'inputmode="tel" dir="ltr"'))}
    <p class="muted small wide">العودة في اليوم نفسه قبل 3:30 م (R-38). يصلك إشعار عند تسليم السيارة.</p>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إرسال الطلب</button></div></form>`,
    { title: staff ? 'طلب سيارة لموظف' : 'طلب سيارة من المقر', wide: true, onOpen: (w, c) => { $('#rf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
      const row = { purpose: x.purpose.trim(), dest: x.dest.trim() || (O.F[x.facility_id]?.name || ''), facility_id: x.facility_id ? +x.facility_id : null, need_at: new Date(x.need_at).toISOString(), expected_back: new Date(x.expected_back).toISOString(), overnight: !!x.overnight, passengers: x.passengers ? +x.passengers : null, phone: x.phone.trim(), status: 'requested' };
      if (new Date(row.expected_back) <= new Date(row.need_at)) return toast('موعد العودة قبل وقت الخروج', 'bad');
      if (!row.overnight && new Date(row.expected_back).toDateString() !== new Date(row.need_at).toDateString()) return toast('العودة في يوم آخر تحتاج اختيار «مبيت» (V-06)', 'bad');
      if (staff) { const p = people().find(p => p.full_name === x.who.trim()); Object.assign(row, { user_id: p?.id || null, driver_name: x.who.trim(), unit: x.unit || p?.unit || null }); }
      try { await q(sb.from('vehicle_trips').insert(row)); toast('وصل طلبك لقسم الحركة'); c(); done && done(); } catch (er) { err(er); } }; } });
}

// التسليم: من طلب قائم أو مباشرة (موظف حاضر)
async function handover(tripId, vehId, done) {
  const tr = tripId ? F.trips.find(x => x.id === tripId) : null;
  const avail = F.V.filter(v => v.active && v.status === 'available' && !docIssues(v).some(d => d.bad));
  if (!avail.length) return toast('لا توجد سيارة متاحة الآن', 'bad');
  const v0 = vehId ? F.VI[vehId] : avail[0];
  modal(`<form id="hf" class="pgrid">
    ${tr ? `<div class="flsum wide"><b>${esc(tr.driver_name)}</b> ${uchip(tr.unit)}<span class="d">${esc(tr.purpose)}${tr.dest ? ' · ' + esc(tr.dest) : ''}</span><small>${tr.ref} · طُلب لـ ${DT(tr.need_at)}${tr.overnight ? ' · مبيت' : ''}</small></div>`
      : `${field('مستلم السيارة *', `<input name="who" list="flppl" required autocomplete="off" placeholder="اكتب الاسم"><datalist id="flppl">${people().map(p => `<option value="${esc(p.full_name)}">${esc(uname(p.unit))}</option>`).join('')}</datalist>`)}${field('القسم', sel('unit', unitOpts(), ''))}
         ${field('غرض المهمة *', inp('purpose', '', 'required'), 'wide')}${field('الوجهة', sel('facility_id', facOpts(), ''))}${field('تفاصيل الوجهة', inp('dest', ''))}${field('جوال', inp('phone', '', 'inputmode="tel" dir="ltr"'))}`}
    ${field('السيارة *', sel('vehicle_id', avail.map(v => [v.id, `${v.plate} — ${vName(v)}`]), v0?.id, 'required id="hv"'), 'wide')}
    ${field('العداد عند التسليم *', inp('odo_out', v0?.odometer ?? '', 'type="number" required min="0" id="hodo" dir="ltr"'))}
    ${field('العودة المتوقعة *', `<input type="datetime-local" name="expected_back" required value="${localDT(tr?.expected_back || defBack())}">`)}
    <div class="fld wide"><span>مستوى الوقود *</span>${fuelPick('fuel_out', 8)}</div>
    <div class="fld wide"><span>قائمة التحقق عند التسليم</span>${chkBox('c')}</div>
    <label class="flon wide"><input type="checkbox" name="lic" required><span><b>اطّلعت على رخصة قيادة سارية للمستلم</b></span></label>
    ${tr?.overnight ? '' : `<label class="flon wide"><input type="checkbox" name="overnight"><span><b>مبيت معتمد</b><small>باعتماد رئيس قسم الحركة (V-06)</small></span></label>`}
    ${field('ملاحظات التسليم', inp('notes_out', '', 'placeholder="خدش قديم في الباب الخلفي…"'), 'wide')}
    ${field('صور السيارة (اختياري)', '<input type="file" name="ph" accept="image/*" multiple capture="environment">', 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${ico('key')} تسليم المفتاح</button></div></form>`,
    { title: 'تسليم سيارة', wide: true, onOpen: (w, c) => { bindFuel(w);
      $('#hv', w).onchange = e => { $('#hodo', w).value = F.VI[e.target.value]?.odometer ?? ''; };
      $('#hf', w).onsubmit = async e => { e.preventDefault(); const f = e.target, x = formData(f), b = f.querySelector('.btn.primary'); b.disabled = true;
        const row = { vehicle_id: +x.vehicle_id, odo_out: +x.odo_out, fuel_out: +x.fuel_out, chk_out: readChk(x, 'c'), expected_back: new Date(x.expected_back).toISOString(), notes_out: x.notes_out.trim(), status: 'out' };
        if (tr?.overnight || x.overnight) row.overnight = true;
        try {
          let id;
          if (tr) { await q(sb.from('vehicle_trips').update(row).eq('id', tr.id)); id = tr.id; }
          else { const p = people().find(p => p.full_name === x.who.trim()); const r = await q(sb.from('vehicle_trips').insert({ ...row, user_id: p?.id || null, driver_name: x.who.trim(), unit: x.unit || p?.unit || null, purpose: x.purpose.trim(), facility_id: x.facility_id ? +x.facility_id : null, dest: x.dest.trim() || (O.F[x.facility_id]?.name || ''), phone: x.phone.trim() }).select('id').single()); id = r.id; }
          await uploadFiles(f.ph.files, 'trip:' + id);
          toast('سُلّمت السيارة ' + (F.VI[row.vehicle_id]?.plate || '')); c(); done && done();
        } catch (er) { b.disabled = false; err(er); } }; } });
}

// الاستلام
async function receive(tripId, done) {
  const tr = F.trips.find(x => x.id === tripId), v = F.VI[tr.vehicle_id];
  modal(`<form id="bf" class="pgrid">
    <div class="flsum wide">${plate(v?.plate)}<b>${esc(tr.driver_name)}</b> ${uchip(tr.unit)}<span class="d">${esc(tr.purpose)}${tr.dest ? ' · ' + esc(tr.dest) : ''}</span><small>خرجت ${DT(tr.out_at)} · العداد ${Number(tr.odo_out).toLocaleString('en')} · الوقود ${fuelTxt(tr.fuel_out)}${isLateT(tr) ? ` · <em>متأخرة ${dur(Date.now() - new Date(tr.expected_back))}</em>` : ''}</small></div>
    ${field('العداد عند الاستلام *', inp('odo_back', '', `type="number" required min="${tr.odo_out}" id="bodo" dir="ltr" placeholder="${tr.odo_out}"`))}<div class="fld"><span>المسافة</span><b class="flkm" id="bkm">—</b></div>
    <div class="fld wide"><span>مستوى الوقود *</span>${fuelPick('fuel_back', null)}</div>
    ${field('تعبئة وقود (لتر)', inp('fuel_added', '', 'type="number" step="0.1" min="0" dir="ltr"'))}${field('مبلغ التعبئة (ر.س)', inp('fuel_cost', '', 'type="number" step="0.01" min="0" dir="ltr"'))}
    <div class="fld wide"><span>قائمة التحقق عند الاستلام</span>${chkBox('c')}</div>
    <label class="flon wide bad"><input type="checkbox" name="damage" id="bdmg"><span><b>يوجد ضرر أو عطل</b><small>تتحول السيارة إلى «في الصيانة» ويُفتح بلاغ عطل تلقائياً (V-03)</small></span></label>
    <div class="wide" id="bdn" hidden>${field('وصف الضرر أو العطل *', '<textarea name="damage_note" rows="2"></textarea>')}</div>
    ${field('ملاحظات الاستلام', inp('notes_back', ''), 'wide')}
    ${field('صور (اختياري)', '<input type="file" name="ph" accept="image/*" multiple capture="environment">', 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${ico('okc')} تأكيد الاستلام</button></div></form>`,
    { title: 'استلام سيارة ' + (v?.plate || ''), wide: true, onOpen: (w, c) => { bindFuel(w);
      $('#bodo', w).oninput = e => { const d = +e.target.value - tr.odo_out; $('#bkm', w).textContent = e.target.value ? (d < 0 ? 'أقل من عداد التسليم' : d.toLocaleString('en') + ' كم') : '—'; $('#bkm', w).classList.toggle('bad', d < 0 || d > 600); };
      $('#bdmg', w).onchange = e => { $('#bdn', w).hidden = !e.target.checked; $('[name=damage_note]', w).required = e.target.checked; };
      $('#bf', w).onsubmit = async e => { e.preventDefault(); const f = e.target, x = formData(f); if (x.fuel_back === '') return toast('اختر مستوى الوقود', 'bad'); const b = f.querySelector('.btn.primary'); b.disabled = true;
        const row = { status: 'returned', odo_back: +x.odo_back, fuel_back: +x.fuel_back, chk_back: readChk(x, 'c'), damage: !!x.damage, damage_note: (x.damage_note || '').trim(), notes_back: x.notes_back.trim(), fuel_added: x.fuel_added ? +x.fuel_added : null, fuel_cost: x.fuel_cost ? +x.fuel_cost : null };
        try { await q(sb.from('vehicle_trips').update(row).eq('id', tr.id)); await uploadFiles(f.ph.files, 'trip:' + tr.id); toast(row.damage ? 'استُلمت وفُتح بلاغ عطل للسيارة' : 'استُلمت السيارة'); c(); done && done(); } catch (er) { b.disabled = false; err(er); } }; } });
}

async function reject(tripId, done) {
  modal(`<form id="jf">${field('سبب الرفض *', '<textarea name="reason" rows="2" required placeholder="لا سيارة متاحة في الوقت المطلوب…"></textarea>')}<div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn danger-solid">رفض الطلب</button></div></form>`,
    { title: 'رفض طلب سيارة', onOpen: (w, c) => { $('#jf', w).onsubmit = async e => { e.preventDefault(); try { await q(sb.from('vehicle_trips').update({ status: 'rejected', reason: formData(e.target).reason.trim() }).eq('id', tripId)); c(); done && done(); } catch (er) { err(er); } }; } });
}

// بطاقة الرحلة + محضر للطباعة
export async function tripCard(id, done) {
  let tr = F.trips.find(x => x.id === id); if (!tr) tr = await q(sb.from('vehicle_trips').select('*').eq('id', id).single());
  const v = F.VI[tr.vehicle_id] || (tr.vehicle_id ? await q(sb.from('vehicles').select('*').eq('id', tr.vehicle_id).single()).catch(() => null) : null);
  const mine = tr.user_id === session.user?.id || tr.created_by === session.user?.id, staff = isTrn();
  const chk = c => c && Object.keys(c).length ? CHK.map(([k, l]) => `<span class="${c[k] ? 'ok' : 'bad'}">${c[k] ? '✓' : '✕'} ${l}</span>`).join('') : '<span class="muted">—</span>';
  modal(`<div class="ohead" style="--c:${TST[tr.status]?.c}"><span class="oi-k big" style="--k:#0E7C86">${ico('car')}</span><div><b>${esc(tr.purpose)}</b><span class="muted">${tr.ref} · ${esc(tr.driver_name)} · ${esc(uname(tr.unit))}</span></div><span class="sp"></span>${tPill(tr)}</div>
    <div class="ogrid flcard">
      <div><span>السيارة</span><b>${v ? plate(v.plate) + ' ' + esc(vName(v)) : 'لم تُخصص بعد'}</b></div><div><span>الوجهة</span><b>${esc(tr.dest || O.F?.[tr.facility_id]?.name || '—')}</b></div>
      <div><span>طُلبت لـ</span><b>${tr.need_at ? DT(tr.need_at) : '—'}</b></div><div><span>العودة المتوقعة</span><b>${DT(tr.expected_back)}${tr.overnight ? ' · مبيت' : ''}</b></div>
      <div><span>التسليم</span><b>${tr.out_at ? `${DT(tr.out_at)} · ${Number(tr.odo_out).toLocaleString('en')} كم · وقود ${fuelTxt(tr.fuel_out)}` : '—'}</b><small>${tr.out_by ? 'بواسطة ' + esc(pname(tr.out_by)) : ''}</small></div>
      <div><span>الاستلام</span><b class="${backLate(tr) ? 'bad' : ''}">${tr.back_at ? `${DT(tr.back_at)} · ${Number(tr.odo_back).toLocaleString('en')} كم · وقود ${fuelTxt(tr.fuel_back)}` : '—'}</b><small>${tr.back_by ? 'بواسطة ' + esc(pname(tr.back_by)) : ''}</small></div>
      ${tr.back_at ? `<div><span>المسافة والمدة</span><b>${km(tr)} كم · ${dur(new Date(tr.back_at) - new Date(tr.out_at))}</b></div><div><span>التعبئة</span><b>${tr.fuel_added ? tr.fuel_added + ' لتر' + (tr.fuel_cost ? ' · ' + tr.fuel_cost + ' ر.س' : '') : '—'}</b></div>` : ''}
      ${tr.status === 'rejected' || tr.status === 'cancelled' ? `<div class="wide"><span>السبب</span><b>${esc(tr.reason || '—')}</b></div>` : ''}
    </div>
    ${tr.out_at ? `<h3 class="sub-h">قائمة التحقق</h3><div class="flchkv"><div><small>عند التسليم</small>${chk(tr.chk_out)}</div>${tr.back_at ? `<div><small>عند الاستلام</small>${chk(tr.chk_back)}</div>` : ''}</div>` : ''}
    ${tr.notes_out || tr.notes_back ? `<p class="small">${tr.notes_out ? `<b>عند التسليم:</b> ${esc(tr.notes_out)}<br>` : ''}${tr.notes_back ? `<b>عند الاستلام:</b> ${esc(tr.notes_back)}` : ''}</p>` : ''}
    ${tr.damage ? `<div class="alert bad">${ico('alert')} <b>ضرر عند الاستلام:</b> ${esc(tr.damage_note)}${tr.ops_item_id ? ` — <a href="#/ops/list?id=${tr.ops_item_id}">بلاغ العطل</a>` : ''}</div>` : ''}
    <div id="tAtt"></div>
    <div class="btnrow end"><button class="btn" id="tPr">${ico('print')} محضر التسليم والاستلام</button>${tr.status === 'requested' && (mine || staff) ? '<button class="btn danger" id="tCx">إلغاء الطلب</button>' : ''}${staff && tr.status === 'requested' ? `<button class="btn primary" id="tGive">تسليم</button>` : ''}${staff && tr.status === 'out' ? `<button class="btn" id="tExt">تمديد موعد العودة</button><button class="btn primary" id="tRet">استلام</button>` : ''}</div>`,
    { title: 'رحلة ' + tr.ref, wide: true, onOpen: async (w, c) => {
      if (tr.out_at) { try { const { mountAttachBox, attachBox } = await import('./attach.js'); $('#tAtt', w).innerHTML = attachBox('صور التسليم والاستلام'); mountAttachBox($('#tAtt', w), 'trip:' + tr.id, { canAdd: staff }); } catch (e) { } }
      $('#tPr', w).onclick = () => printTrip(tr, v);
      $('#tCx', w)?.addEventListener('click', async () => { if (!await confirm('إلغاء طلب السيارة؟', 'إلغاء الطلب', true)) return; try { await q(sb.from('vehicle_trips').update({ status: 'cancelled', reason: 'ألغاه ' + (session.profile?.full_name || '') }).eq('id', tr.id)); c(); done && done(); } catch (e) { err(e); } });
      $('#tGive', w)?.addEventListener('click', () => { c(); handover(tr.id, null, done); });
      $('#tRet', w)?.addEventListener('click', () => { c(); receive(tr.id, done); });
      $('#tExt', w)?.addEventListener('click', () => { c(); modal(`<form id="xf">${field('موعد العودة الجديد', `<input type="datetime-local" name="eb" required value="${localDT(new Date(Math.max(Date.now(), new Date(tr.expected_back)) + 36e5))}">`)}<label class="flon"><input type="checkbox" name="ov" ${tr.overnight ? 'checked' : ''}><span><b>مبيت معتمد</b></span></label><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تمديد موعد العودة', onOpen: (w2, c2) => { $('#xf', w2).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); try { await q(sb.from('vehicle_trips').update({ expected_back: new Date(x.eb).toISOString(), overnight: !!x.ov }).eq('id', tr.id)); c2(); done && done(); } catch (er) { err(er); } }; } }); });
    } });
}
function printTrip(tr, v) {
  const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`, chk = c => CHK.map(([k, l]) => `${c?.[k] ? '☑' : '☐'} ${l}`).join('&nbsp;&nbsp; ');
  const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 'bad');
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>محضر ${tr.ref}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet"><style>
    body{font-family:Tajawal,sans-serif;color:#16202A;margin:28px 34px;font-size:13.5px} header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #123B5C;padding-bottom:10px} header img{height:54px} h1{font-size:19px;color:#123B5C;margin:0} header p{margin:2px 0 0;color:#6B7A88;font-size:12px} .ref{margin-inline-start:auto;text-align:left;font-size:12px;color:#6B7A88} .ref b{display:block;font-size:15px;color:#123B5C}
    h2{font-size:14px;color:#0E7C86;margin:16px 0 6px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #DCE3EA;padding:7px 9px;text-align:right;vertical-align:top} th{background:#F3F6F9;width:24%;font-weight:700;color:#3A4A5A}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px} .sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px} .sig div{border-top:1px solid #9AA6B2;padding-top:6px;font-size:12px;color:#6B7A88;min-height:60px} .foot{margin-top:24px;font-size:11px;color:#9AA6B2;text-align:center}
    @media print{body{margin:12mm}}</style></head><body>
    <header><img src="${location.origin}${location.pathname.replace(/[^/]*$/, '')}assets/logo.png"><div><h1>محضر تسليم واستلام سيارة</h1><p>تجمع الأحساء الصحي — إدارة الخدمات الفنية — قسم الحركة · V-01</p></div><div class="ref">رقم الرحلة<b>${tr.ref}</b></div></header>
    <h2>بيانات المهمة</h2><table>${row('المستلم', `${esc(tr.driver_name)} — ${esc(uname(tr.unit))}${tr.phone ? ' — ' + esc(tr.phone) : ''}`)}${row('الغرض', esc(tr.purpose))}${row('الوجهة', esc(tr.dest || '—'))}${row('السيارة', v ? `${esc(v.plate)} — ${esc(vName(v))}` : '—')}${row('العودة المتوقعة', DT(tr.expected_back) + (tr.overnight ? ' (مبيت معتمد)' : ''))}</table>
    <div class="two"><div><h2>عند التسليم</h2><table>${row('الوقت', DT(tr.out_at))}${row('العداد', tr.odo_out != null ? Number(tr.odo_out).toLocaleString('en') + ' كم' : '—')}${row('الوقود', fuelTxt(tr.fuel_out))}${row('الفحص', chk(tr.chk_out))}${row('ملاحظات', esc(tr.notes_out || '—'))}</table></div>
    <div><h2>عند الاستلام</h2><table>${row('الوقت', DT(tr.back_at))}${row('العداد', tr.odo_back != null ? Number(tr.odo_back).toLocaleString('en') + ' كم' : '—')}${row('الوقود', fuelTxt(tr.fuel_back))}${row('الفحص', tr.back_at ? chk(tr.chk_back) : '—')}${row('الضرر', tr.damage ? esc(tr.damage_note) : 'لا يوجد')}</table></div></div>
    ${tr.back_at ? `<p><b>المسافة:</b> ${km(tr)} كم &nbsp; · &nbsp; <b>المدة:</b> ${dur(new Date(tr.back_at) - new Date(tr.out_at))}${tr.fuel_added ? ` &nbsp; · &nbsp; <b>تعبئة:</b> ${tr.fuel_added} لتر${tr.fuel_cost ? ' / ' + tr.fuel_cost + ' ر.س' : ''}` : ''}</p>` : ''}
    <div class="sig"><div>توقيع المستلم: ${esc(tr.driver_name)}</div><div>توقيع مسؤول الحركة: ${esc(pname(tr.back_by || tr.out_by) || '')}</div></div>
    <p class="foot">أُصدر من منصة إدارة الخدمات الفنية بتاريخ ${dateAr(new Date())} — يلتزم المستلم بإعادة السيارة في اليوم نفسه (R-38) وتُنسب إليه المخالفات خلال فترة استخدامها (R-40).</p>
    <script>onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

// ---------- سجل الحركة
function viewTrips(t, params, re) {
  const m = params.get('m') || new Date().toISOString().slice(0, 7);
  const render = async () => {
    const f = Object.fromEntries(new FormData($('#flf', t)));
    const [y, mo] = f.m.split('-').map(Number), a = new Date(y, mo - 1, 1), b = new Date(y, mo, 1);
    let rows = await q(sb.from('vehicle_trips').select('*').or(`and(out_at.gte.${a.toISOString()},out_at.lt.${b.toISOString()}),and(out_at.is.null,created_at.gte.${a.toISOString()},created_at.lt.${b.toISOString()})`).order('id', { ascending: false }).limit(3000));
    if (f.v) rows = rows.filter(x => String(x.vehicle_id) === f.v); if (f.u) rows = rows.filter(x => x.unit === f.u);
    if (f.s === 'late') rows = rows.filter(x => isLateT(x) || backLate(x)); else if (f.s === 'damage') rows = rows.filter(x => x.damage); else if (f.s) rows = rows.filter(x => x.status === f.s);
    if (f.q) { const s = f.q.trim(); rows = rows.filter(x => [x.ref, x.driver_name, x.purpose, x.dest, F.VI[x.vehicle_id]?.plate].join(' ').includes(s)); }
    const ret = rows.filter(x => x.status === 'returned'), K = ret.reduce((a2, x) => a2 + (km(x) || 0), 0), L = rows.filter(x => isLateT(x) || backLate(x)).length, fuel = ret.reduce((a2, x) => a2 + (+x.fuel_cost || 0), 0);
    t._rows = rows;
    $('#flres', t).innerHTML = `<div class="flsumrow"><span><b>${rows.length}</b> رحلة</span><span><b>${K.toLocaleString('en')}</b> كم</span><span class="${L ? 'bad' : ''}"><b>${L}</b> تأخر عن موعد العودة</span><span><b>${rows.filter(x => x.damage).length}</b> بضرر</span>${fuel ? `<span><b>${fuel.toLocaleString('en')}</b> ر.س وقود</span>` : ''}</div>
      ${rows.length ? `<div class="tblwrap"><table class="lst fltab"><thead><tr><th>الرحلة</th><th>السيارة</th><th>المستلم</th><th>الغرض والوجهة</th><th>الخروج</th><th>العودة</th><th class="c">كم</th><th>الحالة</th></tr></thead><tbody>${rows.map(x => `<tr data-t="${x.id}" class="${isLateT(x) || backLate(x) ? 'late' : ''}"><td class="ltr small">${x.ref}</td><td>${x.vehicle_id ? plate(F.VI[x.vehicle_id]?.plate) : '—'}</td><td><b>${esc(x.driver_name)}</b><div class="muted small">${esc(uname(x.unit))}</div></td><td>${esc(x.purpose)}<div class="muted small">${esc(x.dest || '')}</div></td><td class="small">${x.out_at ? DT(x.out_at) : '<span class="muted">' + DT(x.need_at) + '</span>'}</td><td class="small ${backLate(x) ? 'bad' : ''}">${x.back_at ? DT(x.back_at) : x.status === 'out' ? '<span class="muted">' + T(x.expected_back) + ' متوقع</span>' : '—'}</td><td class="c">${km(x) ?? '—'}</td><td>${tPill(x)}${x.damage ? ' <span class="opill" style="--c:#C0392B">ضرر</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">لا رحلات بهذه التصفية.</p>'}`;
    $$('[data-t]', t).forEach(r => r.onclick = () => tripCard(+r.dataset.t, render));
  };
  t.innerHTML = `<form class="fltool" id="flf"><input type="month" name="m" value="${m}"><select name="v"><option value="">كل السيارات</option>${F.V.map(v => `<option value="${v.id}">${esc(v.plate)}</option>`).join('')}</select><select name="u">${unitOpts().map(([c, n]) => `<option value="${c}">${c ? esc(n) : 'كل الأقسام'}</option>`).join('')}</select><select name="s"><option value="">كل الحالات</option>${Object.entries(TST).map(([k, s]) => `<option value="${k}">${s.ar}</option>`).join('')}<option value="late">تأخرت عن موعد العودة</option><option value="damage">بضرر</option></select><input name="q" placeholder="بحث: اسم، لوحة، رقم رحلة…"><span class="sp"></span><button type="button" class="btn" id="flx">${ico('download')} Excel</button></form><div id="flres"><div class="empty-boq">…</div></div>`;
  if (params.get('v')) $('[name=v]', t).value = params.get('v');
  $('#flf', t).onchange = render; $('#flf', t).oninput = e => { if (e.target.name === 'q') render(); }; $('#flf', t).onsubmit = e => e.preventDefault();
  $('#flx', t).onclick = () => exportTrips(t._rows || [], $('[name=m]', t).value);
  render().catch(err);
}
async function exportTrips(rows, m) {
  try { const { loadExcelJS } = await import('./excel.js'); await loadExcelJS(); } catch (e) { return err('تعذّر تحميل مكتبة Excel'); }
  const wb = new ExcelJS.Workbook(); wb.creator = 'إدارة الخدمات الفنية — قسم الحركة'; const ws = wb.addWorksheet('سجل الحركة', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] });
  const F0 = { name: 'Tajawal', size: 11 }, NAVY = 'FF123B5C';
  ws.getCell('A1').value = `سجل حركة سيارات المقر — ${m}`; ws.getCell('A1').font = { ...F0, size: 15, bold: true, color: { argb: NAVY } };
  ws.getRow(3).values = ['الرحلة', 'السيارة', 'المستلم', 'القسم', 'الجوال', 'الغرض', 'الوجهة', 'الخروج', 'العودة المتوقعة', 'العودة', 'عداد الخروج', 'عداد العودة', 'كم', 'وقود خروج', 'وقود عودة', 'تعبئة لتر', 'تعبئة ر.س', 'الحالة', 'تأخر', 'ضرر', 'ملاحظات'];
  ws.getRow(3).eachCell(c => { c.font = { ...F0, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7C86' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  const d = v => v ? new Date(v) : null;
  rows.forEach((x, i) => { const r = ws.getRow(4 + i); r.values = [x.ref, F.VI[x.vehicle_id]?.plate || '', x.driver_name, uname(x.unit), x.phone || '', x.purpose, x.dest || '', d(x.out_at), d(x.expected_back), d(x.back_at), x.odo_out, x.odo_back, km(x), fuelTxt(x.fuel_out), fuelTxt(x.fuel_back), x.fuel_added, x.fuel_cost, TST[x.status]?.ar, isLateT(x) || backLate(x) ? 'نعم' : '', x.damage ? x.damage_note : '', [x.notes_out, x.notes_back].filter(Boolean).join(' / ')];
    r.eachCell(c => { c.font = F0; c.alignment = { vertical: 'top', wrapText: true }; }); [8, 9, 10].forEach(k => r.getCell(k).numFmt = 'yyyy-mm-dd hh:mm'); });
  ws.columns = [12, 14, 22, 14, 13, 30, 22, 17, 17, 17, 11, 11, 8, 9, 9, 9, 9, 12, 7, 24, 28].map(w => ({ width: w }));
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  const buf = await wb.xlsx.writeBuffer(); download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `سجل الحركة - ${m}.xlsx`);
}

// ---------- الأسطول
function viewVehicles(t, params, re) {
  const can = isTrn(), vs = F.V;
  t.innerHTML = `<div class="fltool">${can ? `<button class="btn primary" id="vAdd">${ico('plus')} سيارة</button><button class="btn" id="vBulk">لصق مجمّع من Excel</button>` : ''}<span class="sp"></span><span class="muted small">${vs.filter(v => v.active).length} سيارة نشطة</span></div>
    ${vs.length ? `<div class="tblwrap"><table class="lst fltab"><thead><tr><th>اللوحة</th><th>السيارة</th><th>الحالة</th><th class="c">العداد</th><th>الاستمارة</th><th>التأمين</th><th>الفحص الدوري</th><th>الصيانة القادمة</th><th>بطاقة الوقود</th></tr></thead><tbody>${vs.map(v => { const dc = k => { const n = docDays(v[k]); return `<td class="small ${n == null ? 'muted' : n < 0 ? 'bad' : n <= 30 ? 'warn' : ''}">${v[k] ? dateAr(v[k]) : '—'}</td>`; };
      return `<tr data-v="${v.id}" class="${v.active ? '' : 'muted'}"><td>${plate(v.plate)}</td><td><b>${esc(vName(v))}</b><div class="muted small">${[VKIND[v.kind], v.color, v.seats ? v.seats + ' مقاعد' : ''].filter(Boolean).map(esc).join(' · ')}</div></td><td>${v.active ? vPill(v.status) : '<span class="opill" style="--c:#B5C0CB">غير نشطة</span>'}</td><td class="c ltr">${Number(v.odometer || 0).toLocaleString('en')}</td>${dc('reg_exp')}${dc('ins_exp')}${dc('insp_exp')}<td class="small ${serviceDue(v) ? 'warn' : ''}">${[v.service_km ? Number(v.service_km).toLocaleString('en') + ' كم' : '', v.service_date ? dateAr(v.service_date) : ''].filter(Boolean).join(' أو ') || '—'}</td><td class="small ltr">${esc(v.fuel_card || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-boq">لا سيارات مسجلة بعد.</div>'}`;
  $('#vAdd', t)?.addEventListener('click', () => vehicleForm(null, re));
  $('#vBulk', t)?.addEventListener('click', () => bulkVehicles(re));
  $$('[data-v]', t).forEach(r => r.onclick = () => vehicleCard(+r.dataset.v, re));
  if (params.get('add') === '1' && can) vehicleForm(null, re);
  if (params.get('v')) vehicleCard(+params.get('v'), re);
}
async function vehicleCard(id, done) {
  const v = F.VI[id]; if (!v) return;
  const ts = await q(sb.from('vehicle_trips').select('*').eq('vehicle_id', id).order('id', { ascending: false }).limit(15)).catch(() => []);
  const di = docIssues(v), can = isTrn();
  modal(`<div class="flvhead">${plate(v.plate, true)}<div><b>${esc(vName(v))}</b><span class="muted">${[VKIND[v.kind], v.color, v.seats ? v.seats + ' مقاعد' : '', v.keys_loc ? 'المفتاح: ' + v.keys_loc : ''].filter(Boolean).map(esc).join(' · ')}</span></div><span class="sp"></span>${vPill(v.status)}</div>
    ${di.length ? `<div class="alert ${di.some(d => d.bad) ? 'bad' : 'warn'}">${di.map(d => esc(d.t)).join(' · ')}${di.some(d => d.bad) ? ' — لا تُسلَّم حتى التجديد (R-41)' : ''}</div>` : ''}
    <div class="ogrid flcard"><div><span>العداد</span><b>${Number(v.odometer || 0).toLocaleString('en')} كم</b></div><div><span>الصيانة القادمة</span><b class="${serviceDue(v) ? 'bad' : ''}">${[v.service_km ? Number(v.service_km).toLocaleString('en') + ' كم' : '', v.service_date ? dateAr(v.service_date) : ''].filter(Boolean).join(' أو ') || '—'}</b></div>
      ${DOCS.map(([k, l]) => `<div><span>${l}</span><b>${v[k] ? dateAr(v[k]) : '—'}</b></div>`).join('')}<div><span>بطاقة الوقود</span><b class="ltr">${esc(v.fuel_card || '—')}</b></div>${v.notes ? `<div class="wide"><span>ملاحظات</span><b>${esc(v.notes)}</b></div>` : ''}</div>
    <h3 class="sub-h">آخر الرحلات</h3>${ts.length ? `<div class="flmini">${ts.map(x => `<div data-t="${x.id}"><span>${x.out_at ? DT(x.out_at) : DT(x.created_at)}</span><b>${esc(x.driver_name)}</b><small>${esc(x.purpose)}</small><span>${km(x) != null ? km(x) + ' كم' : ''}</span>${tPill(x)}</div>`).join('')}</div>` : '<p class="muted small">لا رحلات بعد.</p>'}
    <div class="btnrow end">${can ? `<button class="btn" id="vEd">تعديل</button>${v.status === 'available' ? '<button class="btn" id="vMt">إيقاف للصيانة</button>' : ['maint', 'off'].includes(v.status) ? '<button class="btn" id="vOk">إعادة للخدمة</button>' : ''}` : ''}<a class="btn ghost" href="#/dept/TRN/trips?v=${v.id}">كل رحلاتها</a></div>`,
    { title: 'سيارة ' + v.plate, wide: true, onOpen: (w, c) => {
      $$('[data-t]', w).forEach(r => r.onclick = () => { c(); tripCard(+r.dataset.t, done); });
      $('#vEd', w)?.addEventListener('click', () => { c(); vehicleForm(v, done); });
      const st = async s => { try { await q(sb.from('vehicles').update({ status: s }).eq('id', v.id)); c(); done && done(); } catch (e) { err(e); } };
      $('#vMt', w)?.addEventListener('click', () => st('maint')); $('#vOk', w)?.addEventListener('click', () => st('available'));
    } });
}
function vehicleForm(v, done) {
  v = v || { kind: 'sedan', active: true };
  modal(`<form id="vf" class="pgrid">
    ${field('رقم اللوحة *', inp('plate', v.plate || '', 'required placeholder="أ ب ج 1234"'))}${field('النوع', sel('kind', Object.entries(VKIND), v.kind))}
    ${field('الشركة', inp('make', v.make || '', 'placeholder="تويوتا"'))}${field('الموديل', inp('model', v.model || '', 'placeholder="كامري"'))}
    ${field('سنة الصنع', inp('year', v.year || '', 'type="number" min="1990" max="2035"'))}${field('اللون', inp('color', v.color || ''))}
    ${field('عدد المقاعد', inp('seats', v.seats || '', 'type="number" min="1" max="60"'))}${field('العداد الحالي (كم)', inp('odometer', v.odometer ?? 0, 'type="number" min="0" dir="ltr"'))}
    ${field('انتهاء الاستمارة', inp('reg_exp', v.reg_exp || '', 'type="date"'))}${field('انتهاء التأمين', inp('ins_exp', v.ins_exp || '', 'type="date"'))}
    ${field('انتهاء الفحص الدوري', inp('insp_exp', v.insp_exp || '', 'type="date"'))}${field('بطاقة الوقود', inp('fuel_card', v.fuel_card || '', 'dir="ltr"'))}
    ${field('الصيانة القادمة عند (كم)', inp('service_km', v.service_km || '', 'type="number" min="0" dir="ltr"'))}${field('أو بتاريخ', inp('service_date', v.service_date || '', 'type="date"'))}
    ${field('مكان المفتاح', inp('keys_loc', v.keys_loc || '', 'placeholder="خزنة مكتب الحركة"'))}${field('نشطة', sel('active', [['true', 'نعم'], ['false', 'لا (خرجت من الأسطول)']], String(v.active !== false)))}
    ${field('ملاحظات', inp('notes', v.notes || ''), 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
    { title: v.id ? 'تعديل سيارة' : 'سيارة جديدة', wide: true, onOpen: (w, c) => { $('#vf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target);
      const row = { plate: x.plate.trim(), kind: x.kind, make: x.make.trim(), model: x.model.trim(), year: x.year ? +x.year : null, color: x.color.trim(), seats: x.seats ? +x.seats : null, odometer: +x.odometer || 0, reg_exp: x.reg_exp || null, ins_exp: x.ins_exp || null, insp_exp: x.insp_exp || null, fuel_card: x.fuel_card.trim(), service_km: x.service_km ? +x.service_km : null, service_date: x.service_date || null, keys_loc: x.keys_loc.trim(), active: x.active === 'true', notes: x.notes.trim() };
      try { if (v.id) await q(sb.from('vehicles').update(row).eq('id', v.id)); else await q(sb.from('vehicles').insert(row)); toast('حُفظت السيارة'); c(); done && done(); } catch (er) { err(er); } }; } });
}
function bulkVehicles(done) {
  modal(`<p class="muted small">الصق من Excel صفاً لكل سيارة بالترتيب: <b>اللوحة · الشركة · الموديل · السنة · العداد · انتهاء الاستمارة · انتهاء التأمين</b> (التواريخ بصيغة 2027-05-31). السيارات الموجودة بنفس اللوحة تُتخطّى.</p><textarea id="vb" rows="9" style="width:100%" dir="auto"></textarea><div class="btnrow end"><button class="btn" data-x>إلغاء</button><button class="btn primary" id="vbGo">إضافة</button></div>`,
    { title: 'إضافة سيارات مجمّعة', wide: true, onOpen: (w, c) => { $('#vbGo', w).onclick = async () => {
      const have = new Set(F.V.map(v => v.plate.trim()));
      const rows = $('#vb', w).value.split('\n').map(l => l.split('\t').map(s => s.trim())).filter(r => r[0] && !have.has(r[0])).map(r => ({ plate: r[0], make: r[1] || '', model: r[2] || '', year: +r[3] || null, odometer: +String(r[4] || 0).replace(/,/g, '') || 0, reg_exp: /^\d{4}-\d\d-\d\d$/.test(r[5] || '') ? r[5] : null, ins_exp: /^\d{4}-\d\d-\d\d$/.test(r[6] || '') ? r[6] : null }));
      if (!rows.length) return toast('لا صفوف جديدة', 'bad');
      try { await q(sb.from('vehicles').insert(rows)); toast(`أُضيفت ${rows.length} سيارة`); c(); done && done(); } catch (e) { err(e); } }; } });
}

// ---------- «سيارات المقر» لكل موظف (#/fleet)
export async function mountMyFleet(root) {
  await loadOps(); const uid = session.user.id;
  const [mine, V] = await Promise.all([q(sb.from('vehicle_trips').select('*').or(`user_id.eq.${uid},created_by.eq.${uid}`).order('id', { ascending: false }).limit(40)), q(sb.from('vehicles').select('id,plate,make,model,year,kind,status,active').eq('active', true))]);
  Object.assign(F, { V, VI: Object.fromEntries(V.map(v => [v.id, v])), trips: mine });
  const cur = mine.filter(x => x.status === 'out'), pend = mine.filter(x => x.status === 'requested'), hist = mine.filter(x => !['out', 'requested'].includes(x.status));
  const nAvail = V.filter(v => v.status === 'available').length;
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">سيارات المقر</h1><span class="sp"></span>${isTrn() ? `<a class="btn" href="#/dept/TRN/fleet">${ico('dash')} لوحة الحركة</a>` : ''}<button class="btn primary" id="mfReq">${ico('plus')} طلب سيارة</button></div>
    <p class="muted">لمهام العمل خارج المقر: اطلب السيارة قبل الخروج بساعة، ويسلّمك إياها قسم الحركة بمحضر، وتعيدها في اليوم نفسه قبل 3:30 م. <span class="flavail"><i></i>${nAvail} سيارة متاحة الآن</span></p>
    ${cur.map(x => { const v = F.VI[x.vehicle_id], L = isLateT(x); return `<div class="flcur ${L ? 'late' : ''}" data-t="${x.id}"><div>${plate(v?.plate, true)}</div><div><small>معك الآن</small><b>${esc(v ? vName(v) : '')}</b><span>${esc(x.purpose)}${x.dest ? ' · ' + esc(x.dest) : ''}</span></div><div class="flcur-t"><small>${L ? 'تجاوزت موعد العودة' : 'أعدها قبل'}</small><b>${L ? dur(Date.now() - new Date(x.expected_back)) : T(x.expected_back)}</b><small>خرجت ${T(x.out_at)} · ${Number(x.odo_out).toLocaleString('en')} كم</small></div></div>`; }).join('')}
    <div class="fm2col"><div class="pcard"><h2>طلباتي <span class="muted small">${pend.length}</span></h2>${pend.length ? `<div class="flmini">${pend.map(x => `<div data-t="${x.id}"><span>${DT(x.need_at)}</span><b>${esc(x.purpose)}</b><small>${esc(x.dest || '')}${x.overnight ? ' · مبيت' : ''}</small>${tPill(x)}</div>`).join('')}</div>` : '<p class="muted small">لا طلبات قائمة.</p>'}</div>
      <div class="pcard"><h2>رحلاتي السابقة</h2>${hist.length ? `<div class="flmini">${hist.slice(0, 15).map(x => `<div data-t="${x.id}"><span>${DT(x.out_at || x.created_at)}</span><b>${esc(x.purpose)}</b><small>${esc(F.VI[x.vehicle_id]?.plate || '')}${km(x) != null ? ' · ' + km(x) + ' كم' : ''}</small>${tPill(x)}</div>`).join('')}</div>` : '<p class="muted small">لا رحلات بعد.</p>'}</div></div>`;
  const re = () => mountMyFleet(root);
  $('#mfReq', root).onclick = () => requestForm(re);
  $$('[data-t]', root).forEach(r => r.onclick = () => tripCard(+r.dataset.t, re));
}
