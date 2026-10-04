// ===== الإجازات والتغطية: تقويم، طلب بتسليم عمل لبديل، قبول البديل، اعتماد الإدارة، العودة، سجل كامل =====
import { sb, q, session, isAdmin, role, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico, debounce } from './ui.js';
import { exportTable } from './xlsx.js';
import { uploadOne, openFile } from './docs.js';

export const KINDS = { annual: 'سنوية', emergency: 'اضطرارية', sick: 'مرضية', mission: 'انتداب / مهمة عمل', unpaid: 'بدون راتب', other: 'أخرى' };
export const LSTATUS = { pending_delegate: 'بانتظار قبول البديل', pending_approval: 'بانتظار اعتماد الإدارة', approved: 'معتمدة', rejected: 'مرفوضة', cancelled: 'ملغاة', returned: 'منتهية — استُلم العمل' };
const DSTATUS = { pending: 'لم يردّ بعد', accepted: 'قبل التسليم', declined: 'اعتذر', none: 'بلا بديل' };
const LOG = { submitted: 'تقديم الطلب', edited: 'تعديل الطلب', delegate_accepted: 'قبول البديل للتسليم', delegate_declined: 'اعتذار البديل', delegate_changed: 'تغيير البديل', pending_approval: 'أُحيل لاعتماد الإدارة', approved: 'اعتماد', rejected: 'رفض', cancelled: 'إلغاء', returned: 'العودة واستلام العمل' };
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const stBadge = s => `<span class="badge ${s === 'approved' ? 'full' : s === 'returned' ? 'skel' : s === 'rejected' || s === 'cancelled' ? 'bad' : s === 'pending_approval' ? 'ovr' : 'info'}">${LSTATUS[s] || s}</span>`;
const iso = d => d.toISOString().slice(0, 10);
const addD = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthKey = d => d.slice(0, 7);
const fmtRange = (a, b) => `${dateAr(a)} ← ${dateAr(b)}`;
const first = n => (n || '').trim().split(' ')[0];
let profiles = [];
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';

async function load(ym) {
  const me = session.user.id;
  const from = addD(ym + '-01', -7), to = addD(ym + '-01', 45);
  const [cal, mine, hol, st, bal, pf] = await Promise.all([
    q(sb.from('v_leaves_cal').select('*').lte('start_date', to).gte('end_date', from)),
    q(sb.from('leaves').select('*').order('created_at', { ascending: false }).limit(300)),
    q(sb.from('holidays').select('*').order('start_date')),
    q(sb.from('settings').select('value').eq('key', 'leaves').maybeSingle()),
    q(sb.rpc('leave_balance', { p_user: me, p_year: new Date().getFullYear() })),
    profiles.length ? Promise.resolve(profiles) : q(sb.from('profiles').select('id,full_name,role,title').not('role', 'in', '("pending","disabled")').order('full_name')),
  ]);
  profiles = pf;
  const cfg = Object.assign({ count_mode: 'calendar', min_cover: 1, annual_default: 30 }, st?.value || {});
  return { cal, mine, hol, cfg, bal: Array.isArray(bal) ? bal[0] : bal, me };
}

export async function mountLeaves(root, params) {
  const me = session.user.id, admin = isAdmin();
  let ym = params.get('m') || today().slice(0, 7);
  const D = await load(ym);
  const eng = profiles.filter(p => ['engineer', 'admin'].includes(p.role));
  const onDay = d => D.cal.filter(l => l.start_date <= d && l.end_date >= d);
  const todayOn = onDay(today()).filter(l => ['approved', 'returned'].includes(l.status));
  const pendAdm = D.mine.filter(l => l.status === 'pending_approval'), pendDel = D.mine.filter(l => l.delegate_id === me && l.delegate_status === 'pending' && l.status === 'pending_delegate');
  const myLeaves = D.mine.filter(l => l.user_id === me);
  const toReturn = myLeaves.filter(l => l.status === 'approved' && l.end_date < today());
  const [y, m] = ym.split('-').map(Number); const firstDay = new Date(Date.UTC(y, m - 1, 1)); const startDow = firstDay.getUTCDay(); const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = iso(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7), next = iso(new Date(Date.UTC(y, m, 1))).slice(0, 7);
  const holOn = d => D.hol.find(h => h.start_date <= d && h.end_date >= d);
  const kindCls = k => `k-${k}`;
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="lc off"></div>';
  for (let d = 1; d <= dim; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`; const dow = (startDow + d - 1) % 7; const h = holOn(ds);
    const L = onDay(ds); const approved = L.filter(l => ['approved', 'returned'].includes(l.status)); const engOff = approved.filter(l => eng.some(e => e.id === l.user_id)).length;
    const conflict = approved.length && (eng.length - engOff) < Number(D.cfg.min_cover || 0);
    cells += `<div class="lc ${dow >= 5 ? 'we' : ''} ${h ? 'hol' : ''} ${ds === today() ? 'today' : ''} ${conflict ? 'conf' : ''}" data-d="${ds}"><div class="dn"><b>${d}</b>${h ? `<small title="${esc(h.name)}">${esc(h.name)}</small>` : ''}</div><div class="chips">${L.slice(0, 3).map(l => `<span class="lchip ${kindCls(l.kind)} ${['approved', 'returned'].includes(l.status) ? '' : 'pend'}" data-open="${l.id}" title="${esc(l.user_name)} — ${KINDS[l.kind]} (${LSTATUS[l.status]})">${esc(first(l.user_name))}</span>`).join('')}${L.length > 3 ? `<span class="lchip more" data-day="${ds}">+${L.length - 3}</span>` : ''}</div></div>`;
  }
  const monthName = firstDay.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
  const monthLeaves = D.cal.filter(l => l.start_date <= `${ym}-${dim}` && l.end_date >= `${ym}-01`).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const row = l => `<tr data-open="${l.id}" class="${l.status === 'cancelled' || l.status === 'rejected' ? 'off' : ''}"><td><b>${esc(l.user_name || pname(l.user_id))}</b></td><td>${KINDS[l.kind]}</td><td>${fmtRange(l.start_date, l.end_date)}</td><td class="c">${l.days}</td><td>${l.delegate_id ? esc(l.delegate_name || pname(l.delegate_id)) : '<span class="muted">—</span>'}</td><td>${stBadge(l.status)}</td></tr>`;
  const tbl = rows => rows.length ? `<table class="lst"><thead><tr><th>الموظف</th><th>النوع</th><th>الفترة</th><th class="c">الأيام</th><th>البديل</th><th>الحالة</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>` : '';
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الإجازات والتغطية</h1><span class="sp"></span><button class="btn primary" id="lvNew">＋ طلب إجازة</button>${admin ? '<button class="btn" id="lvCfg">الإعدادات والأرصدة</button><button class="btn" id="lvXl">⬇ Excel</button>' : ''}</div>
    <div class="kpis">
      <div class="kpi"><b>${todayOn.length}</b><span>في إجازة اليوم${todayOn.length ? ': ' + todayOn.map(l => first(l.user_name)).join('، ') : ''}</span></div>
      ${admin ? `<a class="kpi ${pendAdm.length ? 'bad' : ''}" href="#lvPend"><b>${pendAdm.length}</b><span>بانتظار قرارك</span></a>` : `<div class="kpi"><b>${myLeaves.filter(l => l.status.startsWith('pending')).length}</b><span>طلباتي المعلقة</span></div>`}
      ${pendDel.length ? `<a class="kpi bad" href="#lvDel"><b>${pendDel.length}</b><span>تسليم بانتظار قبولك</span></a>` : ''}
      <div class="kpi"><b>${D.bal ? D.bal.remaining : '—'}<small class="muted" style="font-size:12px"> / ${D.bal ? D.bal.total : '—'}</small></b><span>رصيدي السنوي المتبقي ${new Date().getFullYear()}${D.bal?.pending ? ` (معلق ${D.bal.pending})` : ''}</span></div>
    </div>
    ${toReturn.length ? `<div class="alert warn">انتهت إجازتك — <button class="btn sm primary" data-open="${toReturn[0].id}">أكّد استلام عملك</button></div>` : ''}
    <div class="pcard lcalcard"><div class="toolbar m0"><button class="btn sm" data-m="${prev}">‹</button><h2 class="m0">${monthName}</h2><button class="btn sm" data-m="${next}">›</button><button class="btn sm" data-m="${today().slice(0, 7)}">اليوم</button><span class="sp"></span><span class="legend"><i class="k-annual"></i>سنوية <i class="k-emergency"></i>اضطرارية <i class="k-sick"></i>مرضية <i class="k-mission"></i>انتداب <i class="pend"></i>قيد الطلب <i class="conf"></i>تغطية غير كافية</span></div>
      <div class="lcal"><div class="lhead">${DAYS_AR.map(d => `<div>${d}</div>`).join('')}</div><div class="lgrid">${cells}</div></div></div>
    ${admin && pendAdm.length ? `<div class="pcard" id="lvPend"><h2>بانتظار قرارك <span class="badge bad">${pendAdm.length}</span></h2>${tbl(pendAdm)}</div>` : ''}
    ${pendDel.length ? `<div class="pcard" id="lvDel"><h2>تسليم عمل بانتظار قبولك <span class="badge bad">${pendDel.length}</span></h2>${tbl(pendDel)}</div>` : ''}
    ${admin && D.mine.filter(l => l.status === 'pending_delegate').length ? `<div class="pcard"><h2>بانتظار قبول البديل</h2>${tbl(D.mine.filter(l => l.status === 'pending_delegate'))}</div>` : ''}
    <div class="pcard"><h2>إجازات ${monthName} <span class="badge skel">${monthLeaves.length}</span></h2>${monthLeaves.length ? tbl(monthLeaves) : '<p class="muted">لا إجازات في هذا الشهر.</p>'}</div>
    ${!admin ? `<div class="pcard"><h2>طلباتي <span class="badge skel">${myLeaves.length}</span></h2>${myLeaves.length ? tbl(myLeaves) : '<p class="muted">لم تقدّم طلبات بعد.</p>'}</div>` : ''}`;
  const refresh = () => mountLeaves(root, new URLSearchParams({ m: ym }));
  $$('[data-m]', root).forEach(b => b.onclick = () => { location.hash = '#/leaves?m=' + b.getAttribute('data-m'); });
  $('#lvNew', root).onclick = () => leaveForm(null, D, refresh);
  $$('[data-open]', root).forEach(el => el.onclick = e => { e.preventDefault(); openLeave(+el.getAttribute('data-open'), D, refresh); });
  $$('[data-day]', root).forEach(el => el.onclick = () => { const ds = el.getAttribute('data-day'); modal(tbl(onDay(ds)), { title: 'في إجازة يوم ' + dateAr(ds), wide: true, onOpen: w => $$('[data-open]', w).forEach(r => r.onclick = () => openLeave(+r.getAttribute('data-open'), D, refresh)) }); });
  if (admin) { $('#lvCfg', root).onclick = () => settingsModal(D, refresh); $('#lvXl', root).onclick = () => exportTable('الإجازات - ' + today(), 'الإجازات', [{ h: 'الموظف', k: l => pname(l.user_id), w: 24 }, { h: 'النوع', k: l => KINDS[l.kind], w: 14 }, { h: 'من', k: 'start_date', t: 'date', w: 12 }, { h: 'إلى', k: 'end_date', t: 'date', w: 12 }, { h: 'الأيام', k: 'days', t: 'int', w: 8 }, { h: 'البديل', k: l => l.delegate_id ? pname(l.delegate_id) : '', w: 20 }, { h: 'قبول البديل', k: l => DSTATUS[l.delegate_status], w: 14 }, { h: 'الحالة', k: l => LSTATUS[l.status], w: 22 }, { h: 'السبب', k: 'reason', w: 30 }, { h: 'قرار الإدارة', k: 'decision_note', w: 24 }, { h: 'تاريخ التقديم', k: l => l.created_at?.slice(0, 10), t: 'date', w: 12 }], D.mine, { title: 'سجل الإجازات', subtitle: today() }); }
  if (params.get('id')) openLeave(+params.get('id'), D, refresh);
}

// ---------- قائمة التسليم التلقائية
async function buildHandover(uid, from, to) {
  const items = [];
  const projs = await q(sb.from('projects').select('id,name,stage').eq('engineer_id', uid).eq('archived', false).not('stage', 'in', '("closed","cancelled")'));
  projs.forEach(p => items.push({ t: `مشروع: ${p.name}`, l: `#/project/${p.id}`, done: false }));
  const tasks = await q(sb.from('tasks').select('id,title,due_date,project_id').eq('assignee_id', uid).in('status', ['open', 'in_progress']));
  tasks.forEach(t => items.push({ t: `مهمة: ${t.title}${t.due_date ? ` (موعدها ${dateAr(t.due_date)})` : ''}`, l: `#/project/${t.project_id}/tasks`, done: false }));
  if (projs.length) {
    const ms = await q(sb.from('schedule_items').select('id,name,planned_end,project_id').in('project_id', projs.map(p => p.id)).eq('kind', 'milestone').is('actual_end', null).gte('planned_end', from).lte('planned_end', to));
    ms.forEach(s => items.push({ t: `معلم خلال الإجازة: ${s.name} — ${projs.find(p => p.id === s.project_id)?.name || ''} (${dateAr(s.planned_end)})`, l: `#/project/${s.project_id}/schedule`, done: false }));
    const mt = await q(sb.from('tech_reports').select('id,title,next_meeting,project_id').in('project_id', projs.map(p => p.id)).gte('next_meeting', from).lte('next_meeting', to));
    mt.forEach(r => items.push({ t: `اجتماع خلال الإجازة: ${r.title} (${dateAr(r.next_meeting)})`, l: `#/treport/${r.id}`, done: false }));
    const subs = await q(sb.from('submittals').select('id,no,title,project_id').in('project_id', projs.map(p => p.id)).neq('status', 'decided'));
    subs.forEach(s => items.push({ t: `اعتماد مفتوح SUB-${String(s.no).padStart(3, '0')}: ${s.title}`, l: `#/project/${s.project_id}/submittals`, done: false }));
  }
  return items;
}
const hoList = (items, editable, tickable) => items.length ? `<div class="holist">${items.map((it, i) => `<label class="hoi ${it.done ? 'done' : ''}"><input type="checkbox" data-ho="${i}" ${it.done ? 'checked' : ''} ${tickable ? '' : 'disabled'}><span>${it.l ? `<a href="${esc(it.l)}" target="_blank">${esc(it.t)}</a>` : esc(it.t)}</span>${editable ? `<button type="button" class="x" data-rm="${i}">✕</button>` : ''}</label>`).join('')}</div>` : '<p class="muted small">لا توجد عناصر — أضف ما يلزم تسليمه.</p>';

// ---------- نموذج الطلب
async function leaveForm(l, D, done) {
  const me = session.user.id; const admin = isAdmin();
  const v = l || { kind: 'annual', start_date: today(), end_date: today(), reason: '', delegate_id: '', handover: [], handover_note: '', user_id: me };
  const cands = profiles.filter(p => ['admin', 'engineer', 'clerk'].includes(p.role) && p.id !== v.user_id);
  let handover = Array.isArray(v.handover) ? [...v.handover] : [];
  if (!l) { try { handover = await buildHandover(me, v.start_date, v.end_date); } catch (e) { } }
  const who = admin && !l ? field('الموظف', sel('user_id', profiles.map(p => [p.id, p.full_name]), me)) : '';
  await modal(`<form id="f" class="pgrid">${who}${field('نوع الإجازة *', sel('kind', Object.entries(KINDS), v.kind, 'id="lk"'))}${field('من *', inp('start_date', v.start_date, 'type="date" required id="ls"'))}${field('إلى *', inp('end_date', v.end_date, 'type="date" required id="le"'))}
      <div class="wide lvinfo" id="lvInfo"></div>
      ${field('السبب / ملاحظة', `<textarea name="reason" rows="2">${esc(v.reason || '')}</textarea>`, 'wide')}
      <div class="fld wide" id="lvFile" style="display:none"><span>المرفق (تقرير طبي / خطاب)</span><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png">${v.file_name ? `<small class="muted">الحالي: ${esc(v.file_name)}</small>` : ''}</div>
      ${field('البديل الذي يتسلّم العمل', sel('delegate_id', [['', '— بلا بديل (أعمال لا تحتاج تغطية) —'], ...cands.map(p => [p.id, `${p.full_name}${p.title ? ' — ' + p.title : ''}`])], v.delegate_id || ''), 'wide')}
      <div class="wide"><div class="toolbar m0"><h3 class="sub-h m0">قائمة تسليم العمل</h3><span class="sp"></span><button type="button" class="btn sm" id="hoGen">إعادة التوليد من المنصة</button></div><p class="muted small">وُلّدت تلقائياً من مشاريعك ومهامك ومواعيدك خلال الإجازة؛ احذف ما لا يلزم وأضف ما تراه.</p><div id="hoBox">${hoList(handover, true, false)}</div><div class="btnrow mt8"><input type="text" id="hoNew" placeholder="عنصر تسليم إضافي… (مثال: متابعة مقاول الكهرباء في مشروع كذا)" style="flex:1"><button type="button" class="btn sm" id="hoAdd">إضافة</button></div></div>
      ${field('ملاحظات التسليم للبديل', `<textarea name="handover_note" rows="3" placeholder="أين الملفات، من تتواصل معه، ما ينتظر قراراً…">${esc(v.handover_note || '')}</textarea>`, 'wide')}
      <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${l ? 'حفظ التعديل' : 'تقديم الطلب'}</button></div></form>`, { title: l ? 'تعديل طلب الإجازة' : 'طلب إجازة جديد', wide: true, onOpen: (w, close) => {
      const info = $('#lvInfo', w); const ls = $('#ls', w), le = $('#le', w), lk = $('#lk', w);
      const calc = debounce(async () => { if (!ls.value || !le.value) return; if (le.value < ls.value) le.value = ls.value; try { const days = await q(sb.rpc('leave_days', { p_start: ls.value, p_end: le.value })); const bal = D.bal; const overlap = D.cal.filter(x => x.id !== l?.id && x.status !== 'cancelled' && x.start_date <= le.value && x.end_date >= ls.value && x.user_id !== v.user_id);
        info.innerHTML = `<b>${days} يوم</b>${lk.value === 'annual' && bal ? ` · رصيدك المتبقي ${bal.remaining} يوم${days > bal.remaining ? ' <span class="bad">— يتجاوز الرصيد</span>' : ''}` : ''}${D.cfg.count_mode === 'workdays' ? ' <small class="muted">(أيام عمل بلا عطل)</small>' : ''}${overlap.length ? `<br><span class="muted small">في إجازة خلال نفس الفترة: ${overlap.map(x => `${esc(first(x.user_name))} (${LSTATUS[x.status]})`).join('، ')}</span>` : ''}`; } catch (e) { info.textContent = ''; } }, 250);
      ls.onchange = le.onchange = lk.onchange = () => { calc(); $('#lvFile', w).style.display = lk.value === 'sick' ? '' : 'none'; }; calc(); $('#lvFile', w).style.display = lk.value === 'sick' ? '' : 'none';
      const renderHo = () => { $('#hoBox', w).innerHTML = hoList(handover, true, false); $$('[data-rm]', w).forEach(b => b.onclick = () => { handover.splice(+b.getAttribute('data-rm'), 1); renderHo(); }); };
      renderHo();
      $('#hoAdd', w).onclick = () => { const t = $('#hoNew', w).value.trim(); if (!t) return; handover.push({ t, done: false }); $('#hoNew', w).value = ''; renderHo(); };
      $('#hoNew', w).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#hoAdd', w).click(); } };
      $('#hoGen', w).onclick = async () => { handover = await buildHandover($('[name=user_id]', w)?.value || v.user_id, ls.value, le.value); renderHo(); };
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true;
        try { const row = { kind: f.kind, start_date: f.start_date, end_date: f.end_date, reason: f.reason.trim(), delegate_id: f.delegate_id || null, handover, handover_note: f.handover_note.trim() };
          const file = e.target.querySelector('[name=file]')?.files?.[0]; if (file) { toast('جارٍ رفع المرفق…'); const u = await uploadOne(file, `leaves/${v.user_id}`); Object.assign(row, u); }
          if (l) await q(sb.from('leaves').update(row).eq('id', l.id)); else await q(sb.from('leaves').insert({ ...row, user_id: f.user_id || me }));
          toast(l ? 'تم الحفظ' : (row.delegate_id ? 'قُدّم الطلب وأُرسل للبديل لقبول التسليم' : 'قُدّم الطلب للإدارة')); close(); done(); } catch (er) { err(er); btn.disabled = false; } };
    } });
}

// ---------- تفاصيل الطلب والإجراءات
export async function openLeave(id, D, done) {
  const me = session.user.id, admin = isAdmin();
  let l = null; try { l = await q(sb.from('leaves').select('*').eq('id', id).maybeSingle()); } catch (e) { }
  if (!l) { const c = (D?.cal || []).find(x => x.id === id); if (!c) return toast('لا يمكنك عرض هذا الطلب'); return modal(`<div class="kvs">${kv('الموظف', esc(c.user_name))}${kv('النوع', KINDS[c.kind])}${kv('الفترة', fmtRange(c.start_date, c.end_date))}${kv('الأيام', c.days)}${kv('البديل', esc(c.delegate_name || '—'))}${kv('الحالة', stBadge(c.status))}</div>`, { title: 'إجازة' }); }
  const [log, bal] = await Promise.all([q(sb.from('leave_log').select('*').eq('leave_id', id).order('id')), admin || l.user_id === me ? q(sb.rpc('leave_balance', { p_user: l.user_id, p_year: Number(l.start_date.slice(0, 4)) })) : Promise.resolve(null)]);
  const B = Array.isArray(bal) ? bal[0] : bal;
  const owner = l.user_id === me, deleg = l.delegate_id === me; const pending = ['pending_delegate', 'pending_approval'].includes(l.status);
  const overlap = (D?.cal || []).filter(x => x.id !== l.id && x.start_date <= l.end_date && x.end_date >= l.start_date && x.user_id !== l.user_id);
  const ho = Array.isArray(l.handover) ? l.handover : [];
  const actions = [];
  if (deleg && l.delegate_status === 'pending' && pending) actions.push('<button class="btn primary" data-a="accept">أقبل التسليم</button><button class="btn" data-a="decline">أعتذر</button>');
  if (admin && pending) actions.push(`<button class="btn primary" data-a="approve">اعتماد</button><button class="btn danger" data-a="reject">رفض</button>`);
  if (owner && pending) actions.push('<button class="btn" data-a="edit">تعديل</button>');
  if ((owner || admin) && (pending || (l.status === 'approved' && l.start_date > today()))) actions.push('<button class="btn danger" data-a="cancel">إلغاء الطلب</button>');
  if ((owner || admin) && l.status === 'approved' && l.end_date <= today()) actions.push('<button class="btn primary" data-a="return">استلمت عملي</button>');
  if (admin && l.status === 'approved' && l.end_date > today()) actions.push('<button class="btn" data-a="return">إنهاء مبكر واستلام العمل</button>');
  await modal(`<div class="lvdet">
      <div class="kvs">${kv('الموظف', `<b>${esc(pname(l.user_id))}</b>`)}${kv('النوع', KINDS[l.kind])}${kv('الفترة', fmtRange(l.start_date, l.end_date))}${kv('الأيام', `<b>${l.days}</b>`)}${kv('الحالة', stBadge(l.status))}${kv('البديل', l.delegate_id ? `${esc(pname(l.delegate_id))} <span class="badge ${l.delegate_status === 'accepted' ? 'full' : l.delegate_status === 'declined' ? 'bad' : 'ovr'}">${DSTATUS[l.delegate_status]}</span>` : '<span class="muted">بلا بديل</span>')}${l.reason ? kv('السبب', esc(l.reason)) : ''}${l.path ? kv('المرفق', `<button class="btn sm" id="lvAtt">${ico('clip')} ${esc(l.file_name || 'ملف')}</button>`) : ''}${B && l.kind === 'annual' ? kv('رصيد ' + l.start_date.slice(0, 4), `${B.remaining} متبقٍ من ${B.total}${l.status.startsWith('pending') && l.days > B.remaining ? ' <span class="bad">— الطلب يتجاوز الرصيد</span>' : ''}`) : ''}${l.decided_at ? kv('قرار الإدارة', `${esc(pname(l.decided_by))} · ${dateAr(l.decided_at)}${l.decision_note ? ' — ' + esc(l.decision_note) : ''}`) : ''}${l.returned_at ? kv('العودة', `${dateAr(l.returned_at)}${l.return_note ? ' — ' + esc(l.return_note) : ''}`) : ''}</div>
      ${overlap.length ? `<div class="alert ${overlap.some(x => ['approved', 'returned'].includes(x.status)) ? 'warn' : ''}">في إجازة خلال نفس الفترة: ${overlap.map(x => `<b>${esc(first(x.user_name))}</b> (${fmtRange(x.start_date, x.end_date)} — ${LSTATUS[x.status]})`).join('، ')}</div>` : ''}
      <h3 class="sub-h">قائمة تسليم العمل ${ho.length ? `<small class="muted">(${ho.filter(x => x.done).length}/${ho.length} مستلَم)</small>` : ''}</h3>
      <div id="hoView">${hoList(ho, false, deleg || admin)}</div>
      ${l.handover_note ? `<p class="small" style="white-space:pre-wrap"><b>ملاحظات التسليم:</b> ${esc(l.handover_note)}</p>` : ''}${l.delegate_note ? `<p class="small"><b>ردّ البديل:</b> ${esc(l.delegate_note)}</p>` : ''}
      <h3 class="sub-h">السجل</h3><div class="tl">${log.map(x => `<div class="e"><i>•</i><div><b>${LOG[x.action] || x.action}</b><small class="muted"> — ${esc(pname(x.by_user))} · ${new Date(x.at).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}${x.note ? ' · ' + esc(x.note) : ''}</small></div></div>`).join('')}</div>
      ${actions.length ? `<div class="btnrow end mt12" style="flex-wrap:wrap;gap:8px">${actions.join('')}</div>` : ''}
    </div>`, { title: `طلب إجازة #${l.id}`, wide: true, onOpen: (w, close) => {
      const att = $('#lvAtt', w); if (att) att.onclick = () => openFile(l);
      $$('[data-ho]', w).forEach(cb => cb.onchange = async () => { ho[+cb.getAttribute('data-ho')].done = cb.checked; try { await q(sb.from('leaves').update({ handover: ho }).eq('id', l.id)); cb.closest('.hoi').classList.toggle('done', cb.checked); } catch (e) { err(e); } });
      const act = async (a) => {
        try {
          if (a === 'edit') { close(); return leaveForm(l, D, done); }
          if (a === 'accept') { await q(sb.from('leaves').update({ delegate_status: 'accepted', delegate_note: '' }).eq('id', l.id)); toast('قبلت التسليم — الطلب الآن لدى الإدارة'); }
          if (a === 'decline') { const n = await ask('سبب الاعتذار (يصل لصاحب الطلب)'); if (n === null) return; await q(sb.from('leaves').update({ delegate_status: 'declined', delegate_note: n }).eq('id', l.id)); }
          if (a === 'approve') { if (l.delegate_id && l.delegate_status !== 'accepted' && !await confirm('البديل لم يقبل التسليم بعد — اعتماد الإجازة على أي حال؟')) return; const n = await ask('ملاحظة الاعتماد (اختياري)', false); if (n === null) return; await q(sb.from('leaves').update({ status: 'approved', decision_note: n }).eq('id', l.id)); toast('اعتُمدت الإجازة'); }
          if (a === 'reject') { const n = await ask('سبب الرفض'); if (n === null) return; await q(sb.from('leaves').update({ status: 'rejected', decision_note: n }).eq('id', l.id)); }
          if (a === 'cancel') { if (!await confirm('إلغاء طلب الإجازة؟', 'إلغاء الطلب', true)) return; await q(sb.from('leaves').update({ status: 'cancelled' }).eq('id', l.id)); }
          if (a === 'return') { const n = await ask('ملاحظة العودة (اختياري)', false); if (n === null) return; await q(sb.from('leaves').update({ status: 'returned', return_note: n }).eq('id', l.id)); toast('سُجّل استلامك للعمل'); }
          close(); done();
        } catch (e) { err(e); }
      };
      $$('[data-a]', w).forEach(b => b.onclick = () => act(b.getAttribute('data-a')));
    } });
}
const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
function ask(label, required = true) {
  return modal(`<form id="f"><label class="fld"><span>${esc(label)}</span><textarea name="n" rows="3" ${required ? 'required' : ''}></textarea></label><div class="btnrow end mt10"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">تأكيد</button></div></form>`, { title: 'تأكيد', onOpen: (w, close) => { $('#f', w).onsubmit = e => { e.preventDefault(); close(formData(e.target).n.trim()); }; } });
}

// ---------- الإعدادات والأرصدة والعطل (الإدارة)
async function settingsModal(D, done) {
  const year = new Date().getFullYear();
  const bals = await q(sb.from('leave_balances').select('*').eq('year', year));
  const staff = profiles.filter(p => ['admin', 'engineer', 'clerk', 'finance'].includes(p.role));
  const b = u => bals.find(x => x.user_id === u) || { annual_days: D.cfg.annual_default, carried: 0, adjustment: 0 };
  await modal(`<form id="f">
      <h3 class="sub-h">القواعد</h3><div class="pgrid">${field('احتساب الأيام', sel('count_mode', [['calendar', 'أيام تقويمية (شاملة العطل)'], ['workdays', 'أيام عمل (بلا جمعة/سبت وعطل رسمية)']], D.cfg.count_mode))}${field('الحد الأدنى للمهندسين الحاضرين', inp('min_cover', D.cfg.min_cover, 'type="number" min="0"'))}${field('الرصيد السنوي الافتراضي', inp('annual_default', D.cfg.annual_default, 'type="number" min="0"'))}</div>
      <h3 class="sub-h mt12">أرصدة ${year}</h3><p class="muted small">الرصيد استرشادي للتنسيق الداخلي؛ المرجع الرسمي نظام الموارد البشرية.</p>
      <table class="lst nocard"><thead><tr><th>الموظف</th><th class="c">السنوي</th><th class="c">مرحّل</th><th class="c">تعديل ±</th></tr></thead><tbody>${staff.map(p => { const x = b(p.id); return `<tr><td>${esc(p.full_name)}</td><td class="c"><input type="number" name="a_${p.id}" value="${x.annual_days}" style="width:70px"></td><td class="c"><input type="number" name="c_${p.id}" value="${x.carried}" style="width:70px"></td><td class="c"><input type="number" name="j_${p.id}" value="${x.adjustment}" style="width:70px"></td></tr>`; }).join('')}</tbody></table>
      <h3 class="sub-h mt12">العطل الرسمية</h3><div id="holBox">${D.hol.map(h => `<div class="hoi"><span><b>${esc(h.name)}</b> — ${fmtRange(h.start_date, h.end_date)}</span><button type="button" class="x" data-hdel="${h.id}">✕</button></div>`).join('') || '<p class="muted small">لا عطل مسجلة.</p>'}</div>
      <div class="pgrid mt8">${field('اسم العطلة', inp('hname', '', 'placeholder="عيد الفطر"'))}${field('من', inp('hfrom', '', 'type="date"'))}${field('إلى', inp('hto', '', 'type="date"'))}<div class="fld"><span>&nbsp;</span><button type="button" class="btn" id="hAdd">＋ إضافة عطلة</button></div></div>
      <div class="btnrow end mt12"><button type="button" class="btn" data-x>إغلاق</button><button class="btn primary">حفظ القواعد والأرصدة</button></div></form>`, { title: 'إعدادات الإجازات', wide: true, onOpen: (w, close) => {
      $$('[data-hdel]', w).forEach(x => x.onclick = async () => { try { await q(sb.from('holidays').delete().eq('id', +x.getAttribute('data-hdel'))); x.closest('.hoi').remove(); } catch (e) { err(e); } });
      $('#hAdd', w).onclick = async () => { const n = $('[name=hname]', w).value.trim(), a = $('[name=hfrom]', w).value, z = $('[name=hto]', w).value || a; if (!n || !a) return toast('أدخل الاسم والتاريخ'); try { await q(sb.from('holidays').insert({ name: n, start_date: a, end_date: z })); toast('أُضيفت'); close(); const D2 = await load(today().slice(0, 7)); settingsModal(D2, done); } catch (e) { err(e); } };
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try {
        await q(sb.from('settings').upsert({ key: 'leaves', value: { count_mode: f.count_mode, min_cover: Number(f.min_cover) || 0, annual_default: Number(f.annual_default) || 30 }, updated_at: new Date().toISOString() }));
        const rows = staff.map(p => ({ user_id: p.id, year, annual_days: Number(f['a_' + p.id]) || 0, carried: Number(f['c_' + p.id]) || 0, adjustment: Number(f['j_' + p.id]) || 0, updated_at: new Date().toISOString() }));
        await q(sb.from('leave_balances').upsert(rows)); toast('تم الحفظ'); close(); done(); } catch (er) { err(er); } };
    } });
}

// ---------- بطاقة «يومي»
export async function todayLeavesCard() {
  const me = session.user.id, admin = isAdmin();
  const [on, mine] = await Promise.all([q(sb.from('v_leaves_cal').select('*').lte('start_date', today()).gte('end_date', today()).in('status', ['approved', 'returned'])), q(sb.from('leaves').select('id,user_id,delegate_id,status,delegate_status,start_date,end_date,days').in('status', ['pending_delegate', 'pending_approval', 'approved']).order('start_date'))]);
  const pendA = admin ? mine.filter(l => l.status === 'pending_approval') : [];
  const pendD = mine.filter(l => l.delegate_id === me && l.delegate_status === 'pending' && l.status === 'pending_delegate');
  const cover = on.filter(l => l.delegate_id === me);
  if (!on.length && !pendA.length && !pendD.length) return '';
  return `<div class="pcard inbox"><h2>الإجازات والتغطية<a class="small" href="#/leaves">التقويم</a></h2>
    ${on.length ? `<p class="small m0">في إجازة اليوم: ${on.map(l => `<b>${esc(l.user_name)}</b>${l.delegate_name ? ` <span class="muted">(يغطيه ${esc(first(l.delegate_name))})</span>` : ''}`).join('، ')}</p>` : ''}
    ${cover.length ? `<p class="small mt8"><b>أنت تغطي اليوم:</b> ${cover.map(l => esc(l.user_name)).join('، ')} — <a href="#/leaves?id=${cover[0].id}">قائمة التسليم</a></p>` : ''}
    ${pendD.map(l => `<a class="it" href="#/leaves?id=${l.id}"><div class="ic d">${ico('clock')}</div><div class="t"><b>تسليم عمل بانتظار قبولك</b><small>${fmtRange(l.start_date, l.end_date)}</small></div></a>`).join('')}
    ${pendA.map(l => `<a class="it" href="#/leaves?id=${l.id}"><div class="ic a">${ico('clock')}</div><div class="t"><b>طلب إجازة بانتظار قرارك</b><small>${fmtRange(l.start_date, l.end_date)} · ${l.days} يوم</small></div></a>`).join('')}</div>`;
}
