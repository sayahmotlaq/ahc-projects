// ===== الأداء والإنجازات: سجل جهد موثّق لكل موظف + مؤشرات التزام آلية =====
import { sb, isAdmin, q, session, today, STAGES } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, ico } from './ui.js';
import { exportTable, xbtn } from './xlsx.js';

const KINDS = { treport: ['تقارير فنية ومحاضر', 'file'], update: ['تحديثات وملاحظات', 'edit'], payment: ['مستخلصات مُعدّة', 'coins'], submittal: ['طلبات اعتماد', 'stamp'], submittal_review: ['مراجعات اعتمادات', 'stamp'], submittal_decision: ['قرارات اعتماد', 'stamp'], task_done: ['مهام منجزة', 'check'], task_created: ['تكليفات', 'check'], challenge: ['تحديات مرصودة', 'alert'], stage: ['نقل مراحل', 'chart'], request: ['طلبات للإدارة', 'inbox'], request_response: ['ردود على طلبات', 'inbox'], document: ['مستندات مسجلة', 'doc'], drawing: ['مخططات مرفوعة', 'draw'], boq: ['جداول كميات', 'book'], comment: ['تعليقات', 'inbox'], project: ['مشاريع منشأة', 'folder'] };
const PERIODS = { week: 'هذا الأسبوع', month: 'هذا الشهر', quarter: 'هذا الربع', year: 'هذه السنة', all: 'منذ البداية' };
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function range(k) { const t = new Date(), y = t.getFullYear(), m = t.getMonth(); const dow = (t.getDay() + 1) % 7; // الأسبوع يبدأ الأحد
  if (k === 'week') { const d = new Date(t); d.setDate(t.getDate() - dow); return [iso(d), today()]; }
  if (k === 'month') return [iso(new Date(y, m, 1)), today()];
  if (k === 'quarter') return [iso(new Date(y, Math.floor(m / 3) * 3, 1)), today()];
  if (k === 'year') return [iso(new Date(y, 0, 1)), today()];
  return ['', today()]; }
const weeksIn = (from, to) => Math.max(1, Math.ceil(((new Date(to) - new Date(from || '2026-01-01')) / 864e5 + 1) / 7));

// ---------- حساب مؤشرات موظف واحد
function compute(uid, acts, projects, tasks, subs, trs, from, to) {
  const mine = acts.filter(a => a.user_id === uid);
  const myProjects = projects.filter(p => p.engineer_id === uid && !p.archived && !['closed', 'cancelled'].includes(p.stage));
  const counts = {}; mine.forEach(a => counts[a.kind] = (counts[a.kind] || 0) + 1);
  const weeks = weeksIn(from, to);
  // 1) تغطية التحديث: نسبة أسابيع×مشاريع فيها نشاط واحد على الأقل
  let covered = 0, slots = 0;
  myProjects.forEach(p => { for (let w = 0; w < weeks; w++) { const ws = new Date(from || '2026-01-01'); ws.setDate(ws.getDate() + w * 7); const we = new Date(ws); we.setDate(ws.getDate() + 7); if (ws > new Date()) break; slots++; if (mine.some(a => a.project_id === p.id && new Date(a.at) >= ws && new Date(a.at) < we)) covered++; } });
  const coverage = slots ? Math.round(covered / slots * 100) : null;
  // 2) الالتزام بالمواعيد: مهام منجزة في وقتها
  const myDone = tasks.filter(t => t.assignee_id === uid && t.status === 'done' && t.done_at && (!from || t.done_at.slice(0, 10) >= from) && t.done_at.slice(0, 10) <= to);
  const withDue = myDone.filter(t => t.due_date); const onTime = withDue.filter(t => t.done_at.slice(0, 10) <= t.due_date).length;
  const lateOpen = tasks.filter(t => t.assignee_id === uid && ['open', 'in_progress'].includes(t.status) && t.due_date && t.due_date < today()).length;
  const punctual = withDue.length ? Math.round(onTime / withDue.length * 100) : null;
  // 3) سرعة الاستجابة: أيام من تقديم الاعتماد حتى مراجعة المهندس
  const myRev = subs.filter(s => s.engineer_by === uid && s.engineer_at && (!from || s.engineer_at.slice(0, 10) >= from) && s.engineer_at.slice(0, 10) <= to);
  const respDays = myRev.length ? Math.round(myRev.reduce((a, s) => a + Math.max(0, (new Date(s.engineer_at) - new Date(s.submitted_on)) / 864e5), 0) / myRev.length * 10) / 10 : null;
  // 4) الجودة: تقارير رُوجعت دون إعادة + توصيات اعتماد وافقت عليها الإدارة
  const myTr = trs.filter(r => r.created_by === uid && r.status !== 'draft' && (!from || (r.published_at || r.created_at).slice(0, 10) >= from));
  const reviewed = myTr.filter(r => r.status === 'reviewed').length, returned = myTr.filter(r => r.status === 'returned').length;
  const agreed = mine.filter(a => a.kind === 'submittal_review' && a.outcome === 'agreed').length, changed = mine.filter(a => a.kind === 'submittal_review' && a.outcome === 'changed').length;
  const qualityN = reviewed + returned + agreed + changed; const quality = qualityN ? Math.round((reviewed + agreed) / qualityN * 100) : null;
  // مؤشر الالتزام (0–100): معادلة معلنة — تغطية 40 · مواعيد 30 · استجابة 30 (≤2 يوم = كامل، ≥10 أيام = صفر)
  const respScore = respDays === null ? null : Math.max(0, Math.min(100, Math.round((10 - respDays) / 8 * 100)));
  const parts = [[coverage, 40], [punctual, 30], [respScore, 30]].filter(x => x[0] !== null);
  const score = parts.length ? Math.round(parts.reduce((a, x) => a + x[0] * x[1], 0) / parts.reduce((a, x) => a + x[1], 0)) : null;
  return { uid, mine, counts, total: mine.length, projects: myProjects, value: myProjects.reduce((a, p) => a + Number(p.contract_value || p.budget || 0), 0), coverage, punctual, onTime, withDue: withDue.length, lateOpen, respDays, myRev: myRev.length, quality, reviewed, returned, agreed, changed, score };
}
async function loadAll(from, to) {
  let qa = sb.from('v_user_activity').select('*').lte('at', to + 'T23:59:59').order('at', { ascending: false }).limit(5000); if (from) qa = qa.gte('at', from);
  const [acts, profiles, projects, tasks, subs, trs, lb] = await Promise.all([q(qa), q(sb.from('profiles').select('id,full_name,role,title').order('full_name')), q(sb.from('projects').select('id,name,engineer_id,stage,archived,contract_value,budget')), q(sb.from('tasks').select('id,assignee_id,status,due_date,done_at')), q(sb.from('submittals').select('id,engineer_by,engineer_at,submitted_on')), q(sb.from('tech_reports').select('id,created_by,status,published_at,created_at')), q(sb.from('settings').select('value').eq('key', 'perf_leaderboard').maybeSingle())]);
  return { acts, profiles, projects, tasks, subs, trs, leaderboard: lb?.value === true };
}
const scoreBadge = s => s === null ? '<span class="badge skel">لا بيانات كافية</span>' : `<span class="badge ${s >= 80 ? 'full' : s >= 60 ? 'ovr' : 'bad'}">${s}</span>`;
const pct = v => v === null ? '—' : v + '%';

// ---------- صفحة الإدارة: كل الموظفين
export async function mountPerformance(root, params) {
  if (!isAdmin()) return mountMyWork(root, params);
  const per = params.get('p') || 'month'; const [from, to] = range(per);
  root.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ حساب المؤشرات…</div>';
  const D = await loadAll(from, to);
  const staff = D.profiles.filter(p => ['engineer', 'admin'].includes(p.role));
  const rows = staff.map(p => ({ p, m: compute(p.id, D.acts, D.projects, D.tasks, D.subs, D.trs, from, to) })).sort((a, b) => (b.m.score ?? -1) - (a.m.score ?? -1) || b.m.total - a.m.total);
  const teamAvg = (() => { const s = rows.map(r => r.m.score).filter(x => x !== null); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; })();
  root.innerHTML = `<div class="toolbar"><div><h1 class="pagetitle">الأداء والإنجازات</h1><p class="muted">سجل جهد موثّق لكل موظف يُبنى تلقائياً من عمله في المنصة · ${PERIODS[per]}${from ? ` (${dateAr(from)} → ${dateAr(to)})` : ''}</p></div><span class="sp"></span><div class="m0 subtabs" >${Object.entries(PERIODS).map(([k, v]) => `<a href="#/performance?p=${k}" class="${per === k ? 'on' : ''}">${v}</a>`).join('')}</div>${xbtn('xl')}</div>
    <div class="kpis"><div class="kpi"><span>موظفون</span><b>${staff.length}</b></div><div class="kpi"><span>إجراءات موثقة في الفترة</span><b>${D.acts.length}</b></div><div class="kpi"><span>متوسط مؤشر الالتزام</span><b>${teamAvg ?? '—'}</b></div><div class="kpi"><span>لوحة الشرف للمهندسين</span><b style="font-size:16px">${D.leaderboard ? 'مفعّلة' : 'غير مفعّلة'}</b><span><a href="#" id="lbToggle">${D.leaderboard ? 'إيقاف' : 'تفعيل'}</a></span></div></div>
    <div class="flat pcard" ><table class="lst"><thead><tr><th>الموظف</th><th class="c">مشاريع قائمة</th><th class="c">إجراءات</th><th class="c">تقارير</th><th class="c">تحديثات</th><th class="c">مهام في وقتها</th><th class="c">تغطية التحديث الأسبوعي</th><th class="c">استجابة الاعتمادات</th><th class="c">الجودة</th><th class="c">مؤشر الالتزام</th><th></th></tr></thead><tbody>${rows.map(({ p, m }) => `<tr data-u="${p.id}"><td><b>${esc(p.full_name)}</b><br><span class="muted small">${esc(p.title || (p.role === 'admin' ? 'إدارة' : 'مهندس مشاريع'))}</span></td><td class="c">${m.projects.length}<br><span class="muted small">${money(Math.round(m.value / 1e6 * 10) / 10)} م</span></td><td class="c"><b>${m.total}</b></td><td class="c">${m.counts.treport || 0}</td><td class="c">${m.counts.update || 0}</td><td class="c ${m.lateOpen ? 'bad' : ''}">${m.withDue ? `${m.onTime}/${m.withDue}` : '—'}${m.lateOpen ? `<br><span class="small">${m.lateOpen} متأخرة الآن</span>` : ''}</td><td class="c">${pct(m.coverage)}</td><td class="c">${m.respDays === null ? '—' : m.respDays + ' يوم'}</td><td class="c">${pct(m.quality)}</td><td class="c">${scoreBadge(m.score)}</td><td><a class="btn sm" href="#/performance/${p.id}?p=${per}">السجل</a></td></tr>`).join('')}</tbody></table></div>
    <p class="mt10 muted small" >مؤشر الالتزام = تغطية التحديث الأسبوعي ×40% + المهام المنجزة في وقتها ×30% + سرعة الاستجابة للاعتمادات ×30% (يومان أو أقل = 100، عشرة أيام أو أكثر = 0). المؤشرات نسب لا أعداد، فلا تتأثر بعدد المشاريع. الجودة = التقارير التي رُوجعت دون إعادة + توصيات الاعتماد التي اعتمدتها الإدارة كما هي.</p>`;
  $$('[data-u]', root).forEach(tr => tr.onclick = e => { if (!e.target.closest('a')) location.hash = `#/performance/${tr.getAttribute('data-u')}?p=${per}`; });
  $('#xl').onclick = () => exportTable('الأداء - ' + PERIODS[per] + ' - ' + today(), 'الأداء', [{ h: 'الموظف', k: r => r.p.full_name, w: 24 }, { h: 'الدور', k: r => r.p.role === 'admin' ? 'إدارة' : 'مهندس', w: 10 }, { h: 'مشاريع قائمة', k: r => r.m.projects.length, t: 'int', w: 10 }, { h: 'قيمة المشاريع', k: r => r.m.value, t: 'money', w: 16 }, { h: 'إجراءات موثقة', k: r => r.m.total, t: 'int', w: 10 }, { h: 'تقارير', k: r => r.m.counts.treport || 0, t: 'int', w: 8 }, { h: 'تحديثات', k: r => r.m.counts.update || 0, t: 'int', w: 8 }, { h: 'مهام منجزة', k: r => r.m.counts.task_done || 0, t: 'int', w: 10 }, { h: 'مهام في وقتها %', k: r => r.m.punctual, t: 'int', w: 12 }, { h: 'تغطية التحديث %', k: r => r.m.coverage, t: 'int', w: 12 }, { h: 'استجابة الاعتمادات (يوم)', k: r => r.m.respDays, w: 14 }, { h: 'الجودة %', k: r => r.m.quality, t: 'int', w: 10 }, { h: 'مؤشر الالتزام', k: r => r.m.score, t: 'int', w: 12 }], rows, { title: 'الأداء والإنجازات — ' + PERIODS[per], subtitle: (from ? dateAr(from) + ' → ' + dateAr(to) : '') });
  $('#lbToggle').onclick = async e => { e.preventDefault(); try { await q(sb.from('settings').upsert({ key: 'perf_leaderboard', value: !D.leaderboard })); toast(D.leaderboard ? 'أُوقفت لوحة الشرف' : 'فُعّلت لوحة الشرف'); mountPerformance(root, params); } catch (er) { err(er); } };
}

// ---------- سجل موظف (للإدارة) / إنجازاتي (للموظف)
export async function mountPerson(root, uid, params) {
  const per = params.get('p') || 'month'; const [from, to] = range(per);
  const self = uid === session.user.id; if (!isAdmin() && !self) return location.hash = '#/me';
  root.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ إعداد السجل…</div>';
  const D = await loadAll(from, to);
  const p = D.profiles.find(x => x.id === uid); if (!p) return root.innerHTML = '<div class="empty-boq">المستخدم غير موجود</div>';
  const m = compute(uid, D.acts, D.projects, D.tasks, D.subs, D.trs, from, to);
  const staff = D.profiles.filter(x => ['engineer', 'admin'].includes(x.role));
  const others = staff.filter(x => x.id !== uid).map(x => compute(x.id, D.acts, D.projects, D.tasks, D.subs, D.trs, from, to));
  const avg = k => { const v = others.map(o => o[k]).filter(x => x !== null && x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const pn = id => D.projects.find(x => x.id === id)?.name || '';
  const byDay = {}; m.mine.forEach(a => { const d = a.at.slice(0, 10); (byDay[d] = byDay[d] || []).push(a); });
  const days = Object.keys(byDay).sort().reverse();
  const outcome = a => a.kind === 'treport' ? (a.outcome === 'reviewed' ? '<span class="badge full">رُوجع</span>' : a.outcome === 'returned' ? '<span class="badge bad">أُعيد</span>' : '<span class="badge ovr">بانتظار المراجعة</span>') : a.kind === 'task_done' ? (a.outcome === 'on_time' ? '<span class="badge full">في وقتها</span>' : a.outcome === 'late' ? '<span class="badge bad">متأخرة</span>' : '') : a.kind === 'submittal_review' ? (a.outcome === 'agreed' ? '<span class="badge full">اعتُمدت التوصية</span>' : a.outcome === 'changed' ? '<span class="badge ovr">غُيّرت التوصية</span>' : '') : a.kind === 'challenge' ? `<span class="badge ${a.outcome === 'مغلق' ? 'full' : 'skel'}">${esc(a.outcome || '')}</span>` : '';
  const rank = D.leaderboard || isAdmin() ? (() => { const all = [...others.map(o => o.score), m.score].filter(x => x !== null).sort((a, b) => b - a); return m.score === null ? null : all.indexOf(m.score) + 1; })() : null;
  root.innerHTML = `<div class="toolbar"><div><div class="crumb">${isAdmin() ? '<a href="#/performance">الأداء والإنجازات</a><span class="sep">›</span>' : ''}<span>${self ? 'إنجازاتي' : esc(p.full_name)}</span></div><h1 class="pagetitle">${self ? 'إنجازاتي' : esc(p.full_name)}</h1><p class="muted">${esc(p.title || (p.role === 'admin' ? 'إدارة' : 'مهندس مشاريع'))} · ${PERIODS[per]}${from ? ` (${dateAr(from)} → ${dateAr(to)})` : ''}</p></div><span class="sp"></span><div class="m0 subtabs" >${Object.entries(PERIODS).map(([k, v]) => `<a href="#/${self && !isAdmin() ? 'me' : 'performance/' + uid}?p=${k}" class="${per === k ? 'on' : ''}">${v}</a>`).join('')}</div><button class="btn primary" id="pdf">${ico('download')} سجل الإنجازات PDF</button></div>
    <div class="kpis hero"><div class="kpi"><span>إجراءات موثقة</span><b>${m.total}</b><span>على ${new Set(m.mine.map(a => a.project_id)).size} مشروع</span></div><div class="kpi"><span>مشاريع قائمة تحت إدارته</span><b>${m.projects.length}</b><span>${money(Math.round(m.value))} ر.س</span></div><div class="kpi"><span>مؤشر الالتزام</span><b>${m.score ?? '—'}</b><span>${avg('score') !== null ? `متوسط الفريق ${avg('score')}` : ''}${rank ? ` · الترتيب ${rank} من ${others.length + 1}` : ''}</span></div><div class="kpi"><span>الجودة</span><b>${pct(m.quality)}</b><span>${m.reviewed} تقرير رُوجع${m.returned ? ` · ${m.returned} أُعيد` : ''}${m.agreed + m.changed ? ` · ${m.agreed}/${m.agreed + m.changed} توصية اعتُمدت` : ''}</span></div></div>
    <div class="two">
      <div class="pcard"><h2>المؤشرات مقابل متوسط الفريق</h2><table class="lst"><thead><tr><th>المؤشر</th><th class="c">${self ? 'أنا' : esc(p.full_name.split(' ')[0])}</th><th class="c">متوسط الفريق</th><th>التفاصيل</th></tr></thead><tbody>
        <tr><td>تغطية التحديث الأسبوعي</td><td class="c"><b>${pct(m.coverage)}</b></td><td class="c">${pct(avg('coverage'))}</td><td class="muted small">نسبة الأسابيع التي سُجّل فيها نشاط لكل مشروع قائم</td></tr>
        <tr><td>المهام في وقتها</td><td class="c"><b>${pct(m.punctual)}</b></td><td class="c">${pct(avg('punctual'))}</td><td class="muted small">${m.onTime} من ${m.withDue} مهمة لها موعد${m.lateOpen ? ` · <span class="bad">${m.lateOpen} متأخرة الآن</span>` : ''}</td></tr>
        <tr><td>سرعة الاستجابة للاعتمادات</td><td class="c"><b>${m.respDays === null ? '—' : m.respDays + ' يوم'}</b></td><td class="c">${avg('respDays') === null ? '—' : avg('respDays') + ' يوم'}</td><td class="muted small">${m.myRev} مراجعة · من التقديم حتى توصية المهندس</td></tr>
        <tr><td>الجودة</td><td class="c"><b>${pct(m.quality)}</b></td><td class="c">${pct(avg('quality'))}</td><td class="muted small">تقارير رُوجعت دون إعادة وتوصيات اعتُمدت كما هي</td></tr>
        <tr><td>إجراءات موثقة</td><td class="c"><b>${m.total}</b></td><td class="c">${avg('total') ?? '—'}</td><td class="muted small">عدد كل ما سُجّل في المنصة (يتأثر بحجم المشاريع)</td></tr></tbody></table></div>
      <div class="pcard"><h2>توزيع الإنجازات</h2>${Object.keys(m.counts).length ? `<div class="kvs" style="grid-template-columns:1fr 1fr">${Object.entries(m.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="kv"><span>${ico(KINDS[k]?.[1] || 'dash')} ${KINDS[k]?.[0] || k}</span><b>${n}</b></div>`).join('')}</div>` : '<p class="muted">لا إجراءات مسجلة في هذه الفترة.</p>'}</div>
    </div>
    <div class="pcard"><h2>سجل الإنجازات <span class="badge skel">${m.total}</span></h2>${days.length ? days.map(d => `<h3 class="sub-h">${dateAr(d)} <small class="muted">(${byDay[d].length})</small></h3><div class="tl">${byDay[d].map(a => `<div class="e"><i>${ico(KINDS[a.kind]?.[1] || 'dash')}</i><div><b><a href="${esc(a.link || '#')}" style="color:inherit">${esc(a.title)}</a> ${outcome(a)}</b><small>${esc(pn(a.project_id))} · ${new Date(a.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</small></div></div>`).join('')}</div>`).join('') : '<div class="empty-boq">لا توجد إجراءات موثقة في هذه الفترة.</div>'}</div>`;
  $('#pdf').onclick = async () => {
    const { paginate, exportPdf } = await import('./report.js');
    const wrap = document.createElement('div'); wrap.className = 'rep'; wrap.id = 'rep'; document.body.appendChild(wrap);
    const blocks = [`<header class="rhead"><img src="assets/logo.png" alt=""><div class="rt"><h1>سجل الإنجازات — ${esc(p.full_name)}</h1><div class="rs">تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع · ${esc(p.title || 'مهندس مشاريع')}</div></div><div class="rmeta"><div><span>الفترة</span><b>${PERIODS[per]}${from ? ` · ${dateAr(from)} → ${dateAr(to)}` : ''}</b></div><div><span>تاريخ الإصدار</span><b>${dateAr(today())}</b></div><div><span>المصدر</span><b>منصة إدارة المشاريع (سجل آلي)</b></div></div></header>`,
      `<div class="rkpis"><div class="rk"><b>${m.total}</b><span>إجراء موثق</span></div><div class="rk"><b>${m.projects.length}</b><span>مشاريع قائمة تحت إدارته</span></div><div class="rk"><b>${m.counts.treport || 0}</b><span>تقارير فنية ومحاضر</span></div><div class="rk"><b>${m.counts.task_done || 0}</b><span>مهام منجزة</span></div><div class="rk"><b>${pct(m.coverage)}</b><span>تغطية التحديث الأسبوعي</span></div><div class="rk"><b>${pct(m.punctual)}</b><span>مهام في وقتها</span></div><div class="rk"><b>${m.respDays === null ? '—' : m.respDays + ' يوم'}</b><span>استجابة الاعتمادات</span></div><div class="rk"><b>${pct(m.quality)}</b><span>الجودة</span></div></div>`,
      `<div class="rcard"><h2>المشاريع تحت إدارته</h2>${m.projects.length ? `<table class="rt2"><thead><tr><th>المشروع</th><th>المرحلة</th><th class="c">القيمة (ر.س)</th><th class="c">إجراءات في الفترة</th></tr></thead><tbody>${m.projects.map(pr => `<tr><td>${esc(pr.name)}</td><td>${esc(STAGES.find(s => s.key === pr.stage)?.ar || pr.stage)}</td><td class="c n">${money(pr.contract_value || pr.budget)}</td><td class="c">${m.mine.filter(a => a.project_id === pr.id).length}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">—</p>'}</div>`];
    const rows = m.mine.slice().sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 0; i < rows.length; i += 22) blocks.push(`<div class="rcard"><h2>سجل الإجراءات ${rows.length > 22 ? `<small>(${i / 22 + 1}/${Math.ceil(rows.length / 22)})</small>` : ''}</h2><table class="rt2"><thead><tr><th>#</th><th>التاريخ</th><th>الإجراء</th><th>المشروع</th><th>النتيجة</th></tr></thead><tbody>${rows.slice(i, i + 22).map((a, j) => `<tr><td>${i + j + 1}</td><td>${dateAr(a.at)}</td><td>${esc(a.title)}</td><td>${esc(pn(a.project_id))}</td><td>${outcome(a).replace(/<[^>]+>/g, '')}</td></tr>`).join('')}</tbody></table></div>`);
    blocks.push(`<footer class="rfoot"><div>سجل آلي مستخرج من منصة إدارة مشاريع تجمع الأحساء الصحي بتاريخ ${esc(today())} — يوثّق الإجراءات كما سُجّلت في المنصة.</div><div class="sig"><div>الموظف: ${esc(p.full_name)}<br><br>التوقيع: ..............</div><div>رئيس قسم المشاريع<br><br>التوقيع: ..............</div></div></footer>`);
    paginate(wrap, blocks); wrap.style.position = 'absolute'; wrap.style.left = '-10000px'; wrap.style.top = '0'; wrap.style.width = '210mm';
    try { await exportPdf(wrap, `سجل الإنجازات - ${p.full_name} - ${today()}.pdf`); } finally { wrap.remove(); }
  };
}
export async function mountMyWork(root, params) { return mountPerson(root, session.user.id, params); }
