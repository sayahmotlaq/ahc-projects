// ===== «يومي»: ملخص شخصي — ما حدث منذ آخر زيارة، المطلوب اليوم، هذا الأسبوع، ما أنجزته اليوم =====
import { sb, isAdmin, canEdit, role, q, session, today, STAGES } from './api.js';
import { $, $$, esc, money, dateAr, ico } from './ui.js';
import { loadDashData, FINISHED } from './projects.js';
import { inboxItem, bindInbox, openProjectDrawer } from './quick.js';

const GREET_AM = ['صباح الخير يا {n}، يوم جديد وفرصة جديدة.', 'صباح النشاط يا {n}.', 'أهلاً {n}، جهّزت لك خلاصة يومك.', 'صباح الخير {n}، لنبدأ بالأهم.', 'يومك سعيد يا {n}.'];
const GREET_PM = ['مساء الخير يا {n}.', 'أهلاً {n}، هذا وضع يومك حتى الآن.', 'مساؤك طيب {n}.'];
const CLOSE = ['ختام موفق يا {n}. ما أنجزته اليوم صار موثقاً باسمك.', 'شكراً على جهدك اليوم يا {n}، كل إجراء سجلته يحسب لك.', 'يوم مكتمل يا {n}. راحة طيبة وإلى الغد.', 'أحسنت {n}. ما تركته اليوم مرتباً سيجدك مرتاحاً غداً.'];
const THU = 'خميس مبارك يا {n}، أسبوع مكتمل. عطلة سعيدة.';
const SUN = 'بداية أسبوع موفقة يا {n}.';
const pick = (arr, seed) => arr[seed % arr.length];
const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ICON_K = { task: 'check', request: 'inbox', treport: 'file', comment: 'inbox', payment: 'coins', submittal: 'stamp', challenge: 'alert', stage: 'chart', stale: 'clock', digest: 'bell' };
const N = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;
const acts = n => N(n, 'إجراء واحد', 'إجراءان', 'إجراءات', 'إجراءً');
const ago = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 60 ? `منذ ${Math.max(1, m)} د` : m < 1440 ? `منذ ${Math.floor(m / 60)} س` : dateAr(d); };

export async function mountToday(root, params) {
  root.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ تجهيز يومك…</div>';
  const me = session.user.id; const admin = isAdmin();
  const first = (session.profile?.full_name || '').trim().split(' ')[0] || '';
  // آخر زيارة (تُحدَّث مرة لكل جلسة)
  let lastSeen = session.profile?.last_seen || null;
  if (!sessionStorage.getItem('ahc_seen_set')) { try { await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', me); sessionStorage.setItem('ahc_seen_set', '1'); sessionStorage.setItem('ahc_prev_seen', lastSeen || ''); } catch (e) { } }
  else lastSeen = sessionStorage.getItem('ahc_prev_seen') || lastSeen;
  const sinceIso = lastSeen || new Date(Date.now() - 864e5).toISOString();
  const leavesCard = await import('./leaves.js').then(m => m.todayLeavesCard()).catch(() => '');
  // أعمال الأقسام المسندة إليّ، وطلباتي المفتوحة (المحرّك التشغيلي)
  const opsCard = await import('./ops.js').then(async o => { const O = await o.loadOps(); const me = session.user.id;
    const mine = O.items.filter(i => o.isOpen(i) && i.assignee_id === me).sort((a, b) => o.isLate(b) - o.isLate(a) || a.priority.localeCompare(b.priority));
    const unitNew = session.profile?.unit ? O.items.filter(i => i.unit === session.profile.unit && i.status === 'new') : [];
    const asked = O.items.filter(i => o.isOpen(i) && (i.requester_id === me || i.created_by === me) && i.assignee_id !== me);
    if (!mine.length && !unitNew.length && !asked.length) return '';
    return `<div class="pcard"><h2>أعمال الأقسام <span class="badge ${mine.some(o.isLate) ? 'bad' : 'ovr'}">${mine.length + unitNew.length}</span><a class="small" href="#/ops/list?who=me">كل أعمالي ‹</a></h2>
      ${unitNew.length ? `<p class="small m0"><b>${unitNew.length}</b> طلب جديد في قسمك لم يُستلم — <a href="#/dept/${session.profile.unit}/work?s=new">استلمها</a></p>` : ''}
      ${mine.length ? `<div class="olist mt8">${mine.slice(0, 5).map(i => o.itemRow(i)).join('')}</div>` : ''}
      ${asked.length ? `<h3 class="sub-h">طلبات رفعتها (${asked.length})</h3><div class="olist">${asked.slice(0, 3).map(i => o.itemRow(i)).join('')}</div>` : ''}</div>`; }).catch(() => '');
  // ذُكرت في متابعات (@منشن) — غير المقروءة أولاً ثم آخر 5 مقروءة
  const mentions = await q(sb.from('mentions').select('*').eq('user_id', me).order('id', { ascending: false }).limit(30)).catch(() => []);
  const unseenM = mentions.filter(m => !m.seen_at), seenM = mentions.filter(m => m.seen_at).slice(0, 5);
  let mprofs = []; const pname = id => mprofs.find(x => x.id === id)?.full_name || '';
  const K_AR = { task: 'مهمة', request: 'طلب', challenge: 'تحدٍ', submittal: 'اعتماد', payment: 'مستخلص', change: 'أمر تغيير', treport: 'تقرير', leave: 'إجازة' };
  const mentionRow = m => `<div class="mnr ${m.seen_at ? 'seen' : ''}" data-mn="${m.id}" data-k="${m.kind}" data-ref="${esc(m.ref_id)}"><span class="av">${esc((pname(m.by_user) || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join(''))}</span><div class="mt"><b>${esc(pname(m.by_user))}</b> ذكرك في ${K_AR[m.kind] || m.kind}${m.project_id ? ` — ${esc(D.projects.find(p => p.id === m.project_id)?.name || '')}` : ''}<small>${esc(m.excerpt)}</small></div><small class="muted">${dateAr(m.at)}</small></div>`;
  let mentionsCard = '', myMentionsCard = '';
  // الإشارات التي أرسلتها أنا: ماذا صار عليها (قُرئت؟ رُدّ عليها؟) حتى تُغلق
  const sent = await q(sb.from('mentions').select('*').eq('by_user', me).is('closed_at', null).order('id', { ascending: false }).limit(40)).catch(() => []);
  let sentReplies = [];
  if (sent.length) { const refs = [...new Set(sent.map(m => m.ref_id))]; sentReplies = await q(sb.from('v_thread').select('kind,ref_id,by_user,at').in('ref_id', refs)).catch(() => []); }
  if (mentions.length || sent.length) mprofs = await q(sb.from('profiles').select('id,full_name')).catch(() => []);
  const replyOf = m => sentReplies.find(r => r.kind === m.kind && String(r.ref_id) === String(m.ref_id) && r.by_user === m.user_id && r.at > m.at);
  const msgsCard = await import('./messages.js').then(m => m.todayMessagesCard(root, params?.get?.('msg'))).catch(e => { console.error(e); return ''; });
  const [D, notes, allToday, meetings] = await Promise.all([
    loadDashData(),
    q(sb.from('notifications').select('*').gte('created_at', sinceIso).order('id', { ascending: false }).limit(20)),
    q(sb.from('v_user_activity').select('*').gte('at', today() + 'T00:00:00').order('at', { ascending: false })),
    q(sb.from('tech_reports').select('id,title,project_id,next_meeting,projects(name)').gte('next_meeting', today()).lte('next_meeting', plus(7)).order('next_meeting')),
  ]);
  const mineToday = allToday.filter(a => a.user_id === me);
  // نبض الفريق اليوم (للإدارة): من فعل ماذا
  const pulse = admin ? Object.values(allToday.filter(a => a.user_id && a.user_id !== me).reduce((m, a) => { const u = m[a.user_id] || (m[a.user_id] = { id: a.user_id, n: 0, last: a }); u.n++; return m; }, {})).sort((a, b) => b.n - a.n) : [];
  const myProjects = admin ? D.projects : D.projects.filter(p => p.engineer_id === me);
  const sentRow = m => { const rp = replyOf(m); const st = rp ? ['ردّ ' + ago(rp.at), 'full'] : m.seen_at ? ['قُرئت ' + ago(m.seen_at), 'ovr'] : ['لم تُقرأ بعد', 'bad']; return `<div class="mnr sent ${rp ? 'replied' : ''}" data-mn="${m.id}" data-k="${m.kind}" data-ref="${esc(m.ref_id)}"><span class="av">${esc((pname(m.user_id) || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join(''))}</span><div class="mt"><b>@${esc(pname(m.user_id))}</b> على ${K_AR[m.kind] || m.kind}${m.project_id ? ` — ${esc(D.projects.find(p => p.id === m.project_id)?.name || '')}` : ''}<small>${esc(m.excerpt)}</small></div><div class="mst"><span class="badge ${st[1]}">${st[0]}</span><small class="muted">${dateAr(m.at)}</small><button type="button" class="btn sm ghost" data-mnclose="${m.id}" title="إغلاق هذه الإشارة من قائمتي">✓ تم</button></div></div>`; };
  myMentionsCard = sent.length ? `<div class="pcard mentions"><h2>إشاراتي للفريق <span class="badge ${sent.some(m => !m.seen_at) ? 'ovr' : 'skel'}">${sent.length}</span></h2><p class="muted small" style="margin:-6px 0 8px">من ذكرتهم ولم تُغلق إشارتهم بعد: هل قرؤوا؟ هل ردّوا؟</p>${sent.map(sentRow).join('')}</div>` : '';
  mentionsCard = mentions.length ? `<div class="pcard mentions"><h2>ذُكرت في متابعات <span class="badge ${unseenM.length ? 'bad' : 'skel'}">${unseenM.length || mentions.length}</span></h2>${unseenM.map(mentionRow).join('')}${seenM.length ? `<details class="mnseen"><summary class="muted small">المقروءة (${seenM.length})</summary>${seenM.map(mentionRow).join('')}</details>` : ''}</div>` : '';
  const now = new Date(); const h = now.getHours(); const dow = now.getDay(); // 0 أحد … 4 خميس
  const closing = h >= 15;
  const profs = admin ? await q(sb.from('profiles').select('id,full_name')) : []; const pn = id => profs.find(x => x.id === id)?.full_name || '';
  const initials = n => (n || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('');
  const pulseHtml = admin ? `<div class="pcard pulse"><h2>نبض الفريق اليوم <span class="badge ${pulse.length ? 'full' : 'skel'}">${pulse.length}</span><a class="small" href="#/performance">الأداء</a></h2>${pulse.length ? `<div class="pstrip">${pulse.map(u => { const nm = pn(u.id) || u.last.user_name || ''; return `<a class="pp" href="${esc(u.last.link || '#/performance')}" title="${esc(u.last.title || '')}"><span class="av">${esc(initials(nm))}</span><b>${esc(nm.split(' ').slice(0, 2).join(' ') || '—')}</b><small>${u.n} ${u.n === 1 ? 'إجراء' : u.n === 2 ? 'إجراءان' : 'إجراءات'} · ${esc((u.last.title || '').slice(0, 42))}</small></a>`; }).join('')}</div>` : `<p class="muted small m0">لم يسجّل أحد من الفريق نشاطاً بعد اليوم${h < 10 ? ' — ما زال الوقت مبكراً' : ''}.</p>`}</div>` : '';
  const seed = dayOfYear();
  const greet = (closing ? (dow === 4 ? THU : pick(CLOSE, seed)) : dow === 0 && h < 12 ? SUN + ' ' + pick(GREET_AM, seed) : h < 12 ? pick(GREET_AM, seed) : pick(GREET_PM, seed)).replace(/\{n\}/g, first);
  // المطلوب اليوم: من صندوق الإجراءات + مهامي اليوم
  const todayItems = D.inbox.slice(0, 12);
  const dueToday = D.tasks.filter(t => (admin || t.assignee_id === me) && t.due_date && t.due_date <= today());
  // هذا الأسبوع
  const week = [];
  myProjects.filter(p => p.stage === 'execution' && p.end_date && p.end_date >= today() && p.end_date <= plus(7)).forEach(p => week.push([p.end_date, 'chart', `انتهاء تعاقدي: ${p.name}`, `#/project/${p.id}`]));
  D.tasks.filter(t => (admin || t.assignee_id === me) && t.due_date && t.due_date > today() && t.due_date <= plus(7)).forEach(t => week.push([t.due_date, 'check', `موعد مهمة: ${t.title}`, `#/project/${t.project_id}/tasks`]));
  D.subs.filter(s => s.due_on && s.due_on >= today() && s.due_on <= plus(7) && (admin || s.projects?.engineer_id === me || s.created_by === me)).forEach(s => week.push([s.due_on, 'stamp', `موعد الرد على SUB-${String(s.no).padStart(3, '0')} ${s.title}`, `#/project/${s.project_id}/submittals`]));
  meetings.filter(m => admin || myProjects.some(p => p.id === m.project_id)).forEach(m => week.push([m.next_meeting, 'users', `اجتماع: ${m.projects?.name || ''}`, `#/treport/${m.id}`]));
  D.docsExp.filter(d => d.expiry_date && d.expiry_date >= today() && d.expiry_date <= plus(7) && (admin || myProjects.some(p => p.id === d.project_id))).forEach(d => week.push([d.expiry_date, 'doc', `${d.category === 'bank_guarantee' ? 'انتهاء ضمان بنكي' : 'انتهاء تأمين'}: ${d.projects?.name || ''}`, `#/project/${d.project_id}/docs`]));
  week.sort((a, b) => a[0].localeCompare(b[0]));
  const nDone = mineToday.length, nTodo = todayItems.length + dueToday.filter(t => !todayItems.some(i => i.link.includes(t.project_id) && i.ic === 'check')).length;
  const lead = closing ? (nDone ? `أنجزت اليوم ${acts(nDone)} موثقة باسمك${nTodo ? `، وبقي ${acts(nTodo)} لغدٍ` : '، ولم يبقَ عليك شيء معلق'}.` : `لم يُسجَّل لك إجراء اليوم${nTodo ? `، وينتظرك ${acts(nTodo)}` : ''}.`) : (nTodo ? `عليك اليوم ${acts(nTodo)}${nDone ? `، وأنجزت حتى الآن ${acts(nDone)}` : ''}.` : (nDone ? `أنجزت حتى الآن ${acts(nDone)}، ولا شيء معلق عليك.` : 'لا شيء معلق عليك الآن.'));
  // حركة الفريق: آخر التعليقات والمتابعات للجميع كسلسلة واحدة
  const feedHtml = await teamFeed(D, 12).catch(e => { console.error(e); return ''; });
  root.innerHTML = `<div class="today">
    <div class="hero ${closing ? 'pm' : 'am'}"><div><div class="muted small">${now.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div><h1>${esc(greet)}</h1><p>${esc(lead)}</p></div><div class="btnrow">${canEdit() ? `<a class="btn" href="#/treport/new">${ico('file')} تقرير فني</a>` : ''}<a class="btn primary" href="#/dashboard">${ico('dash')} لوحة المؤشرات</a></div></div>
    <nav class="tqk"><button class="tqk-new" id="tqNew">＋ إنشاء جديد</button><a href="#/projects">${ico('folder')} المشاريع</a><a href="#/work">${ico('check')} المهام والطلبات</a><a href="#/records">${ico('doc')} المستندات والاعتمادات</a><a href="#/studies">${ico('ruler')} الدراسات</a><a href="#/library">${ico('book')} المكتبة الفنية</a></nav>
    <div class="two">
      <div class="stack">
        <div class="pcard inbox"><h2>مطلوب منك اليوم ${nTodo ? `<span class="badge ${todayItems.some(i => i.bad) ? 'bad' : 'ovr'}">${nTodo}</span>` : ''}</h2>${todayItems.length ? todayItems.map((i, idx) => inboxItem(i, idx, D.ago)).join('') : '<p class="muted">لا يوجد ما ينتظرك الآن</p>'}</div>
        <div class="pcard"><h2>هذا الأسبوع <span class="badge skel">${week.length}</span></h2>${week.length ? `<div class="tl">${week.slice(0, 10).map(w => `<div class="e"><i>${ico(w[1])}</i><div><b><a href="${w[3]}" style="color:inherit">${esc(w[2])}</a></b><small>${w[0] === today() ? 'اليوم' : w[0] === plus(1) ? 'غداً' : dateAr(w[0])}</small></div></div>`).join('')}</div>` : '<p class="muted">لا مواعيد خلال الأيام السبعة القادمة.</p>'}</div>
      </div>
      <div class="stack">
        ${opsCard}
        ${mentionsCard}
        ${myMentionsCard}
        ${leavesCard}
        <div class="pcard"><h2>${closing ? 'ما أنجزته اليوم' : 'أنجزته حتى الآن'} <span class="badge ${nDone ? 'full' : 'skel'}">${nDone}</span></h2>${mineToday.length ? `<div class="tl">${mineToday.map(a => `<div class="e"><i>${ico({ treport: 'file', update: 'edit', payment: 'coins', submittal: 'stamp', submittal_review: 'stamp', submittal_decision: 'stamp', task_done: 'check', task_created: 'check', challenge: 'alert', stage: 'chart', request: 'inbox', request_response: 'inbox', document: 'doc', drawing: 'draw', boq: 'book', comment: 'inbox', project: 'folder' }[a.kind] || 'dash')}</i><div><b><a href="${esc(a.link || '#')}" style="color:inherit">${esc(a.title)}</a></b><small>${esc(D.projects.find(p => p.id === a.project_id)?.name || '')} · ${new Date(a.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</small></div></div>`).join('')}</div>` : `<p class="muted">${closing ? 'لم يُسجَّل إجراء اليوم.' : 'لم تسجل إجراءً بعد. أول تحديث أو تقرير سيظهر هنا فوراً.'}</p>`}<div class="btnrow end" style="margin-top:6px"><a class="btn sm" href="#/${admin ? 'performance/' + me : 'me'}">سجل إنجازاتي الكامل ‹</a></div></div>
        <div class="pcard"><h2>ما حدث منذ آخر زيارة <span class="badge skel">${notes.length}</span></h2><p class="muted small" style="margin:-6px 0 8px">${lastSeen ? 'منذ ' + dateAr(lastSeen) + ' ' + new Date(lastSeen).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }) : 'آخر 24 ساعة'}</p>${notes.length ? notes.map(n => `<a class="nitem ${n.read_at ? '' : 'new'}" href="${esc(n.link || '#')}" style="padding:8px 4px"><span class="nic">${ico(ICON_K[n.kind] || 'bell')}</span><span class="nt"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<em>${ago(n.created_at)}</em></span></a>`).join('') : '<p class="muted">لا جديد يخصك منذ آخر زيارة.</p>'}</div>
      </div>
    </div>
    ${msgsCard}
    ${feedHtml}
    ${pulseHtml}</div>`;
  const tq = root.querySelector('#tqNew'); if (tq) tq.onclick = async () => (await import('./create.js')).openCreate();
  import('./messages.js').then(m => m.bindMessagesCard(root)).catch(() => { });
  bindFeed(root, D, () => mountToday(root, params));
  if (opsCard) import('./ops.js').then(o => o.bindRows(root, () => mountToday(root, params)));
  $$('[data-mnclose]', root).forEach(b => b.onclick = async e => { e.stopPropagation(); const id = +b.dataset.mnclose; await sb.from('mentions').update({ closed_at: new Date().toISOString() }).eq('id', id); const row = b.closest('.mnr'); row.remove(); const card = row && $('.mentions', root); });
  $$('.mnr', root).forEach(el => el.onclick = async () => { if (el.classList.contains('sent')) { const { openQuick } = await import('./quick.js'); const ref = el.dataset.ref; return openQuick({ q: { k: el.dataset.k, id: /^\d+$/.test(ref) ? +ref : ref }, link: '#/today' }, () => mountToday(root, params)); } const id = +el.dataset.mn; if (!el.classList.contains('seen')) { el.classList.add('seen'); sb.from('mentions').update({ seen_at: new Date().toISOString() }).eq('id', id).then(() => { }); } const { openQuick } = await import('./quick.js'); const ref = el.dataset.ref; openQuick({ q: { k: el.dataset.k, id: /^\d+$/.test(ref) ? +ref : ref }, link: '#/today' }, () => mountToday(root, params)); });
  bindInbox(root, todayItems, () => { const h = $('.inbox h2 .badge', root); const n = root.querySelectorAll('.qi').length; if (h) h.textContent = n; if (!n) { const box = $('.inbox', root); if (box && !box.querySelector('p.muted')) box.insertAdjacentHTML('beforeend', '<p class="muted">أنجزت كل ما ينتظرك</p>'); } });
}

// ---------- حركة الفريق (سلسلة التعليقات والمتابعات لكل الفريق)
const FK = { task: ['مهمة', 'tasks', 'title'], request: ['طلب', 'requests', 'title'], challenge: ['تحدٍ', 'challenges', 'title'], submittal: ['اعتماد', 'submittals', 'title'], payment: ['مستخلص', 'payments', 'no'], change: ['أمر تغيير', 'change_orders', 'title'], treport: ['تقرير', 'tech_reports', 'title'], leave: ['إجازة', 'leaves', 'kind'], boq: ['جدول كميات', 'boqs', 'name'] };
const FEED_N = 12;
let feedProfiles = [];
async function teamFeed(D, limit = FEED_N, offset = 0) {
  const rows = await q(sb.from('v_thread').select('*').order('at', { ascending: false }).range(offset, offset + limit - 1));
  if (!rows.length) return offset ? '' : `<div class="pcard feed"><h2>حركة الفريق <span class="badge skel">0</span></h2><p class="muted small m0">لا تعليقات بعد. كل متابعة يكتبها أي زميل على مهمة أو طلب أو تقرير تظهر هنا للجميع.</p></div>`;
  if (!feedProfiles.length) feedProfiles = await q(sb.from('profiles').select('id,full_name')).catch(() => []);
  const pn = id => feedProfiles.find(x => x.id === id)?.full_name || '—';
  // عناوين العناصر دفعة واحدة لكل نوع
  const titles = {};
  await Promise.all(Object.entries(FK).map(async ([k, [, tbl, col]]) => { const ids = [...new Set(rows.filter(r => r.kind === k).map(r => r.ref_id))]; if (!ids.length) return; const t = await q(sb.from(tbl).select('id,' + col).in('id', ids)).catch(() => []); t.forEach(x => titles[k + ':' + x.id] = col === 'no' ? 'رقم ' + x[col] : col === 'kind' ? '' : (x[col] || '')); }));
  const mns = await q(sb.from('mentions').select('uid,user_id').in('uid', rows.map(r => r.uid))).catch(() => []);
  const names = feedProfiles.map(p => (p.full_name || '').trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  const hi = t => names.length ? t.replace(new RegExp('@(' + names.map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g'), '<b class="mn">@$1</b>') : t;
  const item = r => { const [lbl] = FK[r.kind] || [r.kind]; const title = titles[r.kind + ':' + r.ref_id]; const prj = D.projects.find(p => p.id === r.project_id)?.name || ''; const mn = mns.filter(m => m.uid === r.uid).map(m => pn(m.user_id)); const who = pn(r.by_user);
    return `<div class="fi" data-k="${r.kind}" data-ref="${esc(r.ref_id)}" data-pid="${r.project_id || ''}"><span class="av">${esc(who.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join(''))}</span><div class="fb"><div class="fh"><b>${esc(who)}</b> ${mn.length ? `أشار إلى <b>${esc(mn.join('، '))}</b> في` : r.status_after ? 'غيّر حالة' : 'علّق على'} ${lbl}${title ? ` «${esc(String(title).slice(0, 60))}»` : ''}${prj ? ` <span class="muted">— ${esc(prj)}</span>` : ''}<small>${ago(r.at)}</small></div><div class="ft">${hi(esc(r.body || ''))}</div></div></div>`; };
  return offset ? rows.map(item).join('') : `<div class="pcard feed"><h2>حركة الفريق <span class="badge full">${rows.length}${rows.length >= limit ? '+' : ''}</span><span class="sp"></span><button class="btn sm ghost" id="feedRef" title="تحديث">↻</button></h2><div class="fl">${rows.map(item).join('')}</div><div class="btnrow mt8"><button class="btn sm" id="feedMore" data-off="${rows.length}">عرض الأقدم</button></div></div>`;
}
function bindFeed(root, D, refresh) {
  const box = $('.feed', root); if (!box) return;
  const bindItems = () => $$('.fi', box).forEach(el => el.onclick = async () => { const { openQuick } = await import('./quick.js'); const ref = el.dataset.ref; openQuick({ q: { k: el.dataset.k, id: /^\d+$/.test(ref) ? +ref : ref, pid: el.dataset.pid || null }, link: '#/today' }, refresh); });
  bindItems();
  const rf = $('#feedRef', box); if (rf) rf.onclick = refresh;
  const more = $('#feedMore', box); if (more) more.onclick = async () => { const off = +more.dataset.off; more.disabled = true; const html = await teamFeed(D, FEED_N, off).catch(() => ''); if (!html) { more.textContent = 'لا أقدم'; return; } $('.fl', box).insertAdjacentHTML('beforeend', html); more.dataset.off = off + FEED_N; more.disabled = false; bindItems(); };
}
