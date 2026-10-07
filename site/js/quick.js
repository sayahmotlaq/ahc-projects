// ===== الإجراء السريع: قرارات من مكانك بلا انتقال + درج المشروع =====
import { sb, q, session, isAdmin, today, STAGES, stageOf } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, modal, field, inp, formData, ico } from './ui.js';
import { threadBox, mountThread } from './thread.js';

let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role')); return profiles; }
const pname = (id, fb) => profiles.find(p => p.id === id)?.full_name || fb || '—';
const proj = async id => q(sb.from('projects').select('*').eq('id', id).single());

// ---------- فتح الإجراء المناسب لعنصر من صندوق الإجراءات
export async function openQuick(item, done) {
  const k = item.q; if (!k) { location.hash = item.link; return; }
  const finish = () => done && done(item);
  try {
    await loadProfiles();
    if (!k.pid && ['request', 'payment', 'submittal', 'task', 'change'].includes(k.k)) { const tbl = { request: 'requests', payment: 'payments', submittal: 'submittals', task: 'tasks', change: 'change_orders' }[k.k]; const ent = await q(sb.from(tbl).select('project_id').eq('id', k.id).single()); k.pid = ent.project_id; }
    switch (k.k) {
      case 'request': { const [r, p] = await Promise.all([q(sb.from('requests').select('*').eq('id', k.id).single()), proj(k.pid)]); const { requestForm } = await import('./tasks.js'); return requestForm(r, p, finish); }
      case 'payment': { const [pm, p, all] = await Promise.all([q(sb.from('payments').select('*').eq('id', k.id).single()), proj(k.pid), q(sb.from('payments').select('*').eq('project_id', k.pid))]); const { payDetail } = await import('./payments.js'); return payDetail(pm, p, all, finish); }
      case 'submittal': { const [s, p, all] = await Promise.all([q(sb.from('submittals').select('*').eq('id', k.id).single()), proj(k.pid), q(sb.from('submittals').select('*').eq('project_id', k.pid))]); const { subDetail } = await import('./docs.js'); return subDetail(s, p, all, finish); }
      case 'treport': return quickReport(k.id, finish);
      case 'task': { const [t, p] = await Promise.all([q(sb.from('tasks').select('*').eq('id', k.id).single()), proj(k.pid)]); const { taskForm } = await import('./tasks.js'); return taskForm(t, p, finish); }
      case 'challenge': { const c = await q(sb.from('challenges').select('*, projects(name,engineer_id,engineer_name)').eq('id', k.id).single()); const { openChallenge } = await import('./challenges.js'); return openChallenge(c, finish); }
      case 'change': { const [c, p, rows] = await Promise.all([q(sb.from('change_orders').select('*').eq('id', k.id).single()), proj(k.pid), q(sb.from('change_orders').select('*').eq('project_id', k.pid))]); const { coDetail } = await import('./closeout.js'); return coDetail(c, p, rows, finish); }
      case 'leave': { const { openLeave } = await import('./leaves.js'); return openLeave(k.id, null, finish); }
      case 'warranty': return quickAssign(k.pid, finish, { title: `جولة فحص العيوب قبل انتهاء الضمان`, details: `فترة الضمان تنتهي ${dateAr(k.date)} — تنفيذ جولة فحص العيوب وتوثيقها بتقرير ومخاطبة المقاول بالملاحظات.`, due: k.date }, `فترة الضمان تنتهي ${dateAr(k.date)}`);
      case 'doc': return quickAssign(k.pid, finish, { title: `تجديد ${k.cat === 'bank_guarantee' ? 'الضمان البنكي' : 'وثيقة التأمين'}: ${k.title}`, details: `${k.date < today() ? 'منتهية منذ' : 'تنتهي في'} ${dateAr(k.date)} — مخاطبة المقاول لتقديم التجديد قبل الموعد.`, due: k.date }, `${k.cat === 'bank_guarantee' ? 'ضمان بنكي' : 'وثيقة تأمين'} — ${k.date < today() ? 'منتهية' : 'تنتهي ' + dateAr(k.date)}`);
      case 'stale': return quickStale(k.ids, finish);
      default: location.hash = item.link;
    }
  } catch (e) { err(e); }
}

// ---------- مراجعة تقرير فني من مكانك
async function quickReport(id, done) {
  const r = await q(sb.from('tech_reports').select('*, projects(id,name,engineer_id,engineer_name)').eq('id', id).single());
  const [photos, { TR_KIND, signed }] = await Promise.all([q(sb.from('report_photos').select('*').eq('report_id', id).order('sort').order('id').limit(6)), import('./treports.js')]);
  const urls = await signed(photos.map(p => p.path)).catch(() => ({}));
  const admin = isAdmin(); const items = Array.isArray(r.items) ? r.items : [];
  const cut = (t, n = 600) => t && t.length > n ? esc(t.slice(0, n)) + '…' : esc(t || '');
  const P = (k, v) => v ? `<h3 class="sub-h">${k}</h3><div class="pre small" style="max-height:160px;overflow:auto">${cut(v)}</div>` : '';
  await modal(`<div class="qrep"><div class="kvs"><div class="kv"><span>المشروع</span><b>${esc(r.projects?.name || '')}</b></div><div class="kv"><span>النوع</span><b>${TR_KIND[r.kind] || r.kind}</b></div><div class="kv"><span>التاريخ</span><b>${dateAr(r.report_date)}</b></div><div class="kv"><span>المهندس</span><b>${esc(pname(r.created_by))}</b></div>${r.progress_seen != null ? `<div class="kv"><span>الإنجاز المشاهد</span><b>${r.progress_seen}%</b></div>` : ''}</div>
      ${P(r.kind === 'meeting' ? 'ما دار في الاجتماع' : 'الملخص', r.summary)}${P('الملاحظات والمخالفات', r.findings)}${P('التوصيات / المطلوب', r.recommendations)}
      ${items.length ? `<h3 class="sub-h">القرارات والتكليفات (${items.length})</h3><ul class="rlist small">${items.slice(0, 6).map(it => `<li>${esc(it.text)}${it.owner ? ` — <span class="muted">${esc(it.owner)}</span>` : ''}${it.due ? ` <span class="muted">· ${dateAr(it.due)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${photos.length ? `<h3 class="sub-h">الصور (${photos.length})</h3><div class="qphotos">${photos.map(p => `<a href="${urls[p.path] || '#'}" target="_blank"><img src="${urls[p.path] || ''}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      ${threadBox('treport', id, 'التعليقات والمتابعة')}
      <form id="f" class="mt10"><label class="fld"><span>ملاحظة المراجعة (اختياري — إلزامي عند الإعادة)</span><textarea name="note" rows="2"></textarea></label></form>
      <div class="btnrow end wrap mt10"><a class="btn" href="#/treport/${id}">التقرير كاملاً</a><span class="sp"></span>${admin && r.status === 'published' ? '<button class="btn danger" data-rv="returned">إعادة للمهندس</button><button class="btn primary" data-rv="reviewed">تمت المراجعة ✓</button>' : ''}</div></div>`, { title: r.title, wide: true, onOpen: (w, close) => {
      $$('[data-rv]', w).forEach(b => b.onclick = async () => { const to = b.getAttribute('data-rv'); const note = $('[name=note]', w).value.trim(); if (to === 'returned' && !note) { toast('اكتب سبب الإعادة'); $('[name=note]', w).focus(); return; }
        try { await q(sb.from('tech_reports').update({ status: to, review_note: note || null, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }).eq('id', id)); if (note) await q(sb.from('report_comments').insert({ report_id: id, body: (to === 'reviewed' ? 'ملاحظة المراجعة: ' : 'أُعيد التقرير: ') + note, by_user: session.user.id })); toast(to === 'reviewed' ? 'تمت المراجعة' : 'أُعيد للمهندس'); close(); done(); } catch (e) { err(e); } });
      $$('a[href]', w).forEach(a => a.onclick = () => close());
      mountThread(w, 'treport', id, { projectId: r.project_id });
    } });
}

// ---------- تكليف سريع لمهندس المشروع (مستند ينتهي / ضمان / مشروع ساكن)
async function quickAssign(pid, done, preset, why) {
  const p = await proj(pid); const { taskForm } = await import('./tasks.js');
  await modal(`<p class="small m0"><b>${esc(p.name)}</b> — ${esc(why)}</p><p class="muted small">المهندس: ${esc(pname(p.engineer_id, p.engineer_name))}</p><div class="btnrow end wrap mt12"><a class="btn" href="#/project/${pid}">فتح المشروع</a><span class="sp"></span><button class="btn primary" data-task>كلّف المهندس بمهمة</button></div>`, { title: 'إجراء سريع', onOpen: (w, close) => {
    $('[data-task]', w).onclick = () => { close(); taskForm(null, p, done, { title: preset.title, details: preset.details, assignee_id: p.engineer_id, due_date: preset.due && preset.due > today() ? preset.due : today() }); };
    $$('a[href]', w).forEach(a => a.onclick = () => close());
  } });
}
async function quickStale(ids, done) {
  const ps = await q(sb.from('projects').select('id,name,engineer_id,engineer_name,updated_at,stage').in('id', ids));
  const { taskForm } = await import('./tasks.js');
  await modal(`<p class="muted small m0">مشاريع بلا أي نشاط مسجّل منذ أسبوعين — اطلب تحديثاً من مهندسها بضغطة (مهمة بموعد 3 أيام).</p><div class="holist mt8">${ps.map(p => `<div class="hoi"><span><b>${esc(p.name)}</b><br><small class="muted">${esc(pname(p.engineer_id, p.engineer_name))} · ${stageOf(p.stage).ar}</small></span><button class="btn sm primary" data-p="${p.id}">اطلب تحديثاً</button></div>`).join('')}</div>`, { title: 'مشاريع بلا تحديث', wide: true, onOpen: (w, close) => {
    $$('[data-p]', w).forEach(b => b.onclick = () => { const p = ps.find(x => x.id === b.getAttribute('data-p')); close(); const d = new Date(); d.setDate(d.getDate() + 3); taskForm(null, p, done, { title: `تحديث حالة المشروع: ${p.name}`, details: 'لا يوجد نشاط مسجل على المشروع منذ أسبوعين — يُرجى تسجيل تحديث بالحالة الراهنة والعوائق إن وُجدت.', assignee_id: p.engineer_id, due_date: d.toISOString().slice(0, 10) }); });
  } });
}

// ---------- ربط قائمة إجراءات: كل عنصر يفتح إجراءه السريع ويختفي بعد الإنجاز
export function bindInbox(root, items, onDone) {
  $$('[data-qi]', root).forEach(el => {
    const i = +el.getAttribute('data-qi'); const item = items[i]; if (!item) return;
    const open = e => { if (e.target.closest('[data-qgo]')) return; e.preventDefault(); openQuick(item, () => { el.classList.add('done'); setTimeout(() => { el.remove(); onDone && onDone(item); }, 420); }); };
    el.addEventListener('click', open);
  });
}
export const inboxItem = (i, idx, ago) => `<div class="it qi" data-qi="${idx}" tabindex="0"><div class="ic ${i.cls}">${ico(i.ic)}</div><div class="t"><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></div><span class="age ${i.bad ? 'bad' : ''}">${i.bad ? 'متأخر' : ago(i.age)}</span><span class="btn sm ${i.cls === 'a' ? 'primary' : ''}">${i.q ? i.act : '<span data-qgo>' + i.act + '</span>'}</span></div>`;

// ---------- درج المشروع: المتابعة في 30 ثانية بلا مغادرة الصفحة
let drawerList = [];
export async function openProjectDrawer(id, list) {
  if (list) drawerList = list;
  await loadProfiles();
  let w = $('#pdrawer'); if (!w) { w = document.createElement('div'); w.id = 'pdrawer'; w.className = 'pdrawer'; w.innerHTML = '<div class="pdov"></div><aside class="pdbox"><div class="pdbody"><div class="loading"><div class="spin"></div></div></div></aside>'; document.body.appendChild(w); $('.pdov', w).onclick = closeDrawer; }
  requestAnimationFrame(() => w.classList.add('on'));
  const body = $('.pdbody', w); body.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ التحميل…</div>';
  const [p, tasks, subs, pays, chs, ms, ups, trs, reqs] = await Promise.all([
    proj(id),
    q(sb.from('tasks').select('id,title,status,due_date,assignee_id,assignee_name').eq('project_id', id).in('status', ['open', 'in_progress']).order('due_date', { ascending: true, nullsFirst: false })),
    q(sb.from('submittals').select('id,no,rev,title,status,due_on').eq('project_id', id).neq('status', 'decided')),
    q(sb.from('payments').select('id,no,status,net_amount').eq('project_id', id).in('status', ['submitted', 'review', 'approved', 'finance'])),
    q(sb.from('challenges').select('id,title,score,status,due_date').eq('project_id', id).neq('status', 'مغلق').order('score', { ascending: false }).limit(3)),
    q(sb.from('schedule_items').select('id,name,planned_end,actual_end').eq('project_id', id).eq('kind', 'milestone').is('actual_end', null).gte('planned_end', today()).order('planned_end').limit(2)),
    q(sb.from('project_updates').select('id,kind,body,happened_on,created_by').eq('project_id', id).order('happened_on', { ascending: false }).limit(3)),
    q(sb.from('tech_reports').select('id,title,kind,report_date,status').eq('project_id', id).order('report_date', { ascending: false }).limit(2)),
    q(sb.from('requests').select('id,title,status,created_by').eq('project_id', id).in('status', ['new', 'in_review'])),
  ]);
  const idx = drawerList.indexOf(id); const prev = idx > 0 ? drawerList[idx - 1] : null, next = idx >= 0 && idx < drawerList.length - 1 ? drawerList[idx + 1] : null;
  const pa = Number(p.progress_actual || 0), pp = Number(p.progress_planned || 0); const cv = Number(p.contract_value || 0), paid = Number(p.paid_amount || 0);
  const lateT = tasks.filter(t => t.due_date && t.due_date < today());
  const st = stageOf(p.stage); const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date) - new Date()) / 864e5) : null;
  const lastAct = ups[0]?.happened_on || p.updated_at?.slice(0, 10); const lastDays = lastAct ? Math.floor((Date.now() - new Date(lastAct)) / 864e5) : null;
  const need = [];
  reqs.forEach(r => need.push({ q: { k: 'request', id: r.id, pid: id }, ic: 'inbox', t: `طلب: ${r.title}`, s: pname(r.created_by) }));
  subs.filter(s => s.status === 'reviewed').forEach(s => need.push({ q: { k: 'submittal', id: s.id, pid: id }, ic: 'stamp', t: `اعتماد SUB-${String(s.no).padStart(3, '0')}: ${s.title}`, s: 'بانتظار قرارك' }));
  pays.forEach(r => need.push({ q: { k: 'payment', id: r.id, pid: id }, ic: 'coins', t: `مستخلص ${r.no} — ${money(Math.round(r.net_amount))} ر.س`, s: ({ submitted: 'مقدَّم', review: 'قيد المراجعة', approved: 'معتمد — للإحالة', finance: 'لدى المالية' })[r.status] }));
  trs.filter(r => r.status === 'published').forEach(r => need.push({ q: { k: 'treport', id: r.id }, ic: 'file', t: r.title, s: 'تقرير بانتظار المراجعة' }));
  lateT.slice(0, 3).forEach(t => need.push({ q: { k: 'task', id: t.id, pid: id }, ic: 'check', t: `مهمة متأخرة: ${t.title}`, s: `${pname(t.assignee_id, t.assignee_name)} · ${dateAr(t.due_date)}`, bad: true }));
  chs.filter(c => Number(c.score || 0) >= 8).forEach(c => need.push({ q: { k: 'challenge', id: c.id }, ic: 'alert', t: `تحدٍ بدرجة ${c.score}: ${c.title}`, s: c.status }));
  body.innerHTML = `<div class="pdhead"><div class="pdnav"><button class="btn sm" data-nav="${prev || ''}" ${prev ? '' : 'disabled'} title="السابق">‹</button><span class="muted small">${idx >= 0 ? `${idx + 1} / ${drawerList.length}` : ''}</span><button class="btn sm" data-nav="${next || ''}" ${next ? '' : 'disabled'} title="التالي">›</button><span class="sp"></span><button class="btn sm" data-close>✕</button></div>
      <h2>${esc(p.name)}</h2><div class="muted small">${esc(p.facility || '')}${p.ref ? ' · ' + esc(p.ref) : ''} · <span class="badge" style="background:${st.color}22;color:${st.color}">${st.ar}</span> · ${esc(pname(p.engineer_id, p.engineer_name))}</div></div>
    ${p.stage === 'execution' ? `<div class="pdprog"><div class="row"><span>الإنجاز الفعلي <b>${pa}%</b> / المخطط ${pp}%</span><span class="${daysLeft !== null && daysLeft < 0 ? 'bad' : ''}">${daysLeft === null ? '' : daysLeft < 0 ? `متأخر ${-daysLeft} يوماً` : `باقٍ ${daysLeft} يوماً`}</span></div><div class="bar ${pa < pp - 5 ? 'warn' : ''}"><i style="width:${pa}%"></i></div><div class="bar thin"><i style="width:${pp}%;background:var(--line)"></i></div><div class="row muted small"><span>العقد ${money(cv)} ر.س</span><span>صُرف ${cv ? Math.round(paid / cv * 100) : 0}%</span></div></div>` : ''}
    ${p.status_note ? `<div class="alert bad">${esc(p.status_note)}</div>` : ''}
    <div class="pdkv"><div><span>آخر نشاط</span><b class="${lastDays > 14 ? 'bad' : ''}">${lastDays === null ? '—' : lastDays === 0 ? 'اليوم' : `منذ ${lastDays} يوم`}</b></div><div><span>المعلم القادم</span><b>${ms[0] ? `${esc(ms[0].name)} <small class="muted">${dateAr(ms[0].planned_end)}</small>` : '—'}</b></div><div><span>مهام مفتوحة</span><b>${tasks.length}${lateT.length ? ` <small class="bad">(${lateT.length} متأخرة)</small>` : ''}</b></div><div><span>أعلى تحدٍ</span><b>${chs[0] ? `${esc(chs[0].title)} <small class="muted">درجة ${chs[0].score}</small>` : '—'}</b></div></div>
    <h3 class="sub-h">ينتظر قرارك هنا ${need.length ? `<span class="badge ${need.some(n => n.bad) ? 'bad' : 'ovr'}">${need.length}</span>` : '<span class="badge skel">0</span>'}</h3>
    <div class="inbox pdneed">${need.length ? need.map((n, i) => `<div class="it qi" data-qi="${i}"><div class="ic ${n.bad ? 'd' : 'b'}">${ico(n.ic)}</div><div class="t"><b>${esc(n.t)}</b><small>${esc(n.s || '')}</small></div><span class="btn sm">افتح</span></div>`).join('') : '<p class="muted small">لا شيء معلقاً عليك في هذا المشروع.</p>'}</div>
    <h3 class="sub-h">آخر التحديثات</h3>${ups.length ? `<div class="tl">${ups.map(u => `<div class="e"><i>•</i><div><b style="font-weight:500">${esc(u.body.slice(0, 140))}</b><small class="muted"> — ${dateAr(u.happened_on)} · ${esc(pname(u.created_by))}</small></div></div>`).join('')}</div>` : '<p class="muted small">لا تحديثات مسجلة.</p>'}
    ${trs.length ? `<div class="small muted mt8">آخر تقرير: <a href="#/treport/${trs[0].id}">${esc(trs[0].title)}</a> · ${dateAr(trs[0].report_date)}</div>` : ''}
    <form id="pdnote" class="mt12"><label class="fld"><span>أضف ملاحظة متابعة (تُسجَّل في تحديثات المشروع)</span><textarea name="body" rows="2" placeholder="مثال: تمت مناقشة التأخر مع المقاول…"></textarea></label><div class="btnrow end mt8"><button class="btn sm primary">حفظ الملاحظة</button></div></form>
    <div class="btnrow wrap mt12"><a class="btn primary" href="#/project/${id}">فتح المشروع كاملاً</a><button class="btn" data-ask>كلّف المهندس</button><a class="btn" href="#/treport/new?p=${id}">＋ تقرير</a></div>`;
  $$('[data-nav]', body).forEach(b => b.onclick = () => { const t = b.getAttribute('data-nav'); if (t) openProjectDrawer(t); });
  $('[data-close]', body).onclick = closeDrawer;
  $$('a[href]', body).forEach(a => a.addEventListener('click', closeDrawer));
  $('#pdnote', body).onsubmit = async e => { e.preventDefault(); const t = $('[name=body]', body).value.trim(); if (!t) return; try { await q(sb.from('project_updates').insert({ project_id: id, kind: 'note', body: t, happened_on: today(), created_by: session.user.id })); toast('سُجّلت الملاحظة'); openProjectDrawer(id); } catch (er) { err(er); } };
  $('[data-ask]', body).onclick = async () => { const { taskForm } = await import('./tasks.js'); taskForm(null, p, () => openProjectDrawer(id), { assignee_id: p.engineer_id }); };
  bindInbox(body, need, () => openProjectDrawer(id));
}
export function closeDrawer() { const w = $('#pdrawer'); if (!w) return; w.classList.remove('on'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); const w = $('#pdrawer.on'); if (!w) return; const nv = $$('[data-nav]', w); if (e.key === 'ArrowLeft') nv[1]?.click(); if (e.key === 'ArrowRight') nv[0]?.click(); });
