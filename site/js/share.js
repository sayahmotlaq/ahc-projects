// ===== التقرير التنفيذي المشارك برابط: بناء اللقطة، النشر، إدارة الروابط والملاحظات =====
import { sb, STAGES, stageOf, q, session, today, SETTINGS } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico } from './ui.js';
import { groupOf, isLate, isStale, loadActivity } from './projects.js';
import { calc } from './schedule.js';

const d10 = v => (v || '').toString().slice(0, 10);
const num = v => Number(v || 0);
const inRange = (d, from, to) => { const x = d10(d); return !!x && (!from || x >= from) && (!to || x <= to); };
const SEV = ['منخفضة', 'متوسطة', 'عالية', 'حرجة'], LIK = ['منخفضة', 'متوسطة', 'عالية'];
const scoreOf = c => c.score ?? ((SEV.indexOf(c.severity) + 1 || 2) * (LIK.indexOf(c.likelihood) + 1 || 2));

// ---------- بناء اللقطة المجمّدة (كل ما تحتاجه الصفحة العامة، بلا أي معرّفات حساسة)
export async function buildSnapshot(from, to) {
  const [projects, profiles, act, chs, tasks, reqs, ups, log, pays, sched, cos, trs, notes] = await Promise.all([
    q(sb.from('projects').select('*').eq('archived', false)),
    q(sb.from('profiles').select('id,full_name')),
    loadActivity(),
    q(sb.from('challenges').select('*').neq('status', 'مغلق')),
    q(sb.from('tasks').select('id,project_id,title,status,due_date,done_at,assignee_id,assignee_name,challenge_id,priority')),
    q(sb.from('requests').select('id,project_id,title,kind,status,created_at').in('status', ['new', 'in_review'])),
    q(sb.from('project_updates').select('project_id,kind,body,happened_on').order('happened_on', { ascending: false }).limit(600)),
    q(sb.from('project_stage_log').select('project_id,from_stage,to_stage,at').order('at', { ascending: false }).limit(500)),
    q(sb.from('payments').select('id,project_id,no,status,net_amount,paid_on,updated_at')),
    q(sb.from('schedule_items').select('project_id,kind,name,weight,planned_start,planned_end,actual_end,pct')),
    q(sb.from('change_orders').select('id,project_id,no,title,kind,amount,days,status,created_at')),
    q(sb.from('tech_reports').select('project_id,kind,title,report_date,status').neq('status', 'draft').order('report_date', { ascending: false }).limit(400)),
    q(sb.from('challenge_notes').select('challenge_id,body,at').order('at', { ascending: false }).limit(400)),
  ]);
  const pn = id => profiles.find(p => p.id === id)?.full_name || '';
  const byP = (arr, pid) => arr.filter(x => x.project_id === pid);
  const T = today();
  const active = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const exec = projects.filter(p => p.stage === 'execution');
  const late = active.filter(isLate);
  const stale = active.filter(p => isStale(p, act));
  const totalV = active.reduce((a, p) => a + num(p.contract_value || p.budget), 0);
  const paid = active.reduce((a, p) => a + num(p.paid_amount), 0);
  const chOpen = chs.filter(c => active.some(p => p.id === c.project_id));
  const chHigh = chOpen.filter(c => scoreOf(c) >= 8 || (c.due_date && c.due_date < T));

  // بطاقة مشروع مفصّلة (الطبقة الثانية)
  const projCard = p => {
    const items = byP(sched, p.id); const sc = items.length ? calc(items) : { planned: null, actual: null };
    const ms = items.filter(i => i.kind === 'milestone').sort((a, b) => (a.planned_end || '').localeCompare(b.planned_end || ''));
    const pch = byP(chOpen, p.id).sort((a, b) => scoreOf(b) - scoreOf(a));
    const ptasks = byP(tasks, p.id);
    const open = ptasks.filter(t => ['open', 'in_progress'].includes(t.status)).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const pp = byP(pays, p.id);
    const lastUp = byP(ups, p.id)[0]; const lastTr = byP(trs, p.id)[0];
    const end = p.revised_end_date || p.end_date;
    const daysLeft = end ? Math.round((new Date(end) - new Date(T)) / 864e5) : null;
    const pa = num(p.progress_actual), pl = num(p.progress_planned);
    return {
      id: p.id, name: p.name, ref: p.ref || '', facility: p.facility || '', category: p.category || '', type: p.type || '', eng: pn(p.engineer_id) || p.engineer_name || '', contractor: p.contractor || '',
      stage: p.stage, stageAr: stageOf(p.stage).ar, color: stageOf(p.stage).color,
      cv: num(p.contract_value), budget: num(p.budget), paid: num(p.paid_amount), paidPct: num(p.contract_value) ? Math.round(num(p.paid_amount) / num(p.contract_value) * 100) : 0,
      pa, pl, dev: pa - pl, late: isLate(p), note: p.status_note || '', stale: isStale(p, act),
      start: p.start_date || '', end: end || '', endBase: p.end_date || '', extraDays: num(p.extra_days), daysLeft, award: p.award_date || '', tender: p.tender_date || '',
      sched: items.length ? { planned: sc.planned, actual: sc.actual, ms: ms.map(m => ({ name: m.name, date: m.planned_end, done: !!m.actual_end, doneOn: m.actual_end || '', late: !m.actual_end && m.planned_end && m.planned_end < T })), pk: items.filter(i => i.kind === 'package').map(i => ({ name: i.name, w: num(i.weight), pct: num(i.pct), s: i.planned_start, e: i.planned_end })) } : null,
      challenges: pch.map(c => ({ id: c.id, title: c.title, score: scoreOf(c), status: c.status, due: c.due_date || '', action: c.action || '' })),
      next: open.slice(0, 4).map(t => ({ title: t.title, who: pn(t.assignee_id) || t.assignee_name || '', due: t.due_date || '', late: !!(t.due_date && t.due_date < T && t.status !== 'done') })),
      pays: { n: pp.length, paidN: pp.filter(x => x.status === 'paid').length, pending: pp.filter(x => ['submitted', 'review', 'approved', 'finance'].includes(x.status)).reduce((a, x) => a + num(x.net_amount), 0), last: pp.filter(x => x.status === 'paid').sort((a, b) => (b.paid_on || '').localeCompare(a.paid_on || ''))[0]?.paid_on || '' },
      lastUpdate: lastUp ? { date: lastUp.happened_on, body: (lastUp.body || '').slice(0, 220), kind: lastUp.kind } : null,
      lastReport: lastTr ? { date: lastTr.report_date, title: lastTr.title, kind: lastTr.kind } : null,
      changes: byP(cos, p.id).filter(c => c.status === 'approved').length,
      lastAct: act[p.id] || p.updated_at,
    };
  };

  // التحديات (الطبقة الثانية)
  const chCard = c => { const p = projects.find(x => x.id === c.project_id); const ct = tasks.filter(t => t.challenge_id === c.id); return {
    id: c.id, pid: c.project_id, pname: p?.name || '', title: c.title, score: scoreOf(c), sev: c.severity, lik: c.likelihood, cat: c.category || '', status: c.status, due: c.due_date || '', overdue: !!(c.due_date && c.due_date < T), detected: c.detected_on || '', impactDays: num(c.impact_days), impactAmount: num(c.impact_amount), action: c.action || '', owner: c.owner || '',
    tasks: ct.map(t => ({ title: t.title, who: pn(t.assignee_id) || t.assignee_name || '', status: t.status, due: t.due_date || '' })),
    notes: notes.filter(n => n.challenge_id === c.id).slice(0, 5).map(n => ({ at: n.at, body: n.body.slice(0, 200) })),
  }; };

  // نشاط الفترة وأبرز الإنجازات
  const per = x => inRange(x, from, to);
  const stagesIn = log.filter(l => per(l.at));
  const tasksDone = tasks.filter(t => t.status === 'done' && per(t.done_at));
  const paidIn = pays.filter(x => x.status === 'paid' && per(x.paid_on || x.updated_at));
  const msDone = sched.filter(i => i.kind === 'milestone' && i.actual_end && per(i.actual_end));
  const trsIn = trs.filter(r => per(r.report_date));
  const pname = id => projects.find(p => p.id === id)?.name || '';
  const highlights = [
    ...stagesIn.filter(l => ['execution', 'handover', 'award', 'tender', 'closed'].includes(l.to_stage)).map(l => ({ d: d10(l.at), t: `انتقل «${pname(l.project_id)}» إلى مرحلة ${stageOf(l.to_stage).ar}`, k: 'stage', pid: l.project_id })),
    ...msDone.map(m => ({ d: d10(m.actual_end), t: `تحقق معلم «${m.name}» في ${pname(m.project_id)}`, k: 'ms', pid: m.project_id })),
    ...paidIn.map(x => ({ d: d10(x.paid_on || x.updated_at), t: `صرف مستخلص رقم ${x.no} (${money(Math.round(num(x.net_amount)))} ر.س) — ${pname(x.project_id)}`, k: 'pay', pid: x.project_id })),
  ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);

  // يحتاج قراركم / انتباهكم
  const decisions = [
    ...chHigh.sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 5).map(c => ({ k: 'challenge', id: c.id, title: c.title, sub: pname(c.project_id), tag: c.due_date && c.due_date < T ? 'تجاوز موعده' : 'درجة ' + scoreOf(c), bad: true })),
    ...cos.filter(c => c.status === 'submitted').slice(0, 3).map(c => ({ k: 'change', id: c.project_id, title: `${c.kind === 'time' ? 'طلب تمديد' : 'أمر تغيير'} رقم ${c.no}: ${c.title}`, sub: `${pname(c.project_id)}${c.amount ? ' · ' + money(Math.round(num(c.amount))) + ' ر.س' : ''}${c.days ? ' · ' + c.days + ' يوم' : ''}`, tag: 'بانتظار الاعتماد', bad: false })),
    ...late.filter(p => p.status_note === 'متعثر').slice(0, 3).map(p => ({ k: 'project', id: p.id, title: p.name, sub: p.facility || '', tag: 'متعثر', bad: true })),
  ].slice(0, 7);

  // المعالم القادمة (30 يوماً)
  const soon = d10(new Date(Date.now() + 30 * 864e5).toISOString());
  const upcoming = sched.filter(i => i.kind === 'milestone' && !i.actual_end && i.planned_end && i.planned_end >= T && i.planned_end <= soon).sort((a, b) => a.planned_end.localeCompare(b.planned_end)).slice(0, 8).map(m => ({ name: m.name, date: m.planned_end, pname: pname(m.project_id), pid: m.project_id }));

  const pre = active.filter(p => !['execution', 'handover', 'warranty'].includes(p.stage));
  const post = projects.filter(p => ['handover', 'warranty'].includes(p.stage));
  const byStage = STAGES.map(s => ({ key: s.key, ar: s.ar, color: s.color, n: projects.filter(p => p.stage === s.key).length })).filter(s => s.n);
  const GROUPS = { gov: 'المشاريع الحكومية', partner: 'الشراكة المجتمعية', study: 'تحت الدراسة' };
  const groups = Object.entries(GROUPS).map(([k, t]) => { const ps = active.filter(p => groupOf(p) === k); return { t, n: ps.length, v: ps.reduce((a, p) => a + num(p.contract_value || p.budget), 0), paid: ps.reduce((a, p) => a + num(p.paid_amount), 0), late: ps.filter(isLate).length }; }).filter(g => g.n);

  return {
    v: 1, issued: new Date().toISOString(), from: from || '', to: to || '', org: SETTINGS.org, by: session.profile?.full_name || '',
    kpis: { total: projects.length, active: active.length, exec: exec.length, late: late.length, stale: stale.length, closed: projects.filter(p => p.stage === 'closed').length, totalV, paid, paidPct: totalV ? Math.round(paid / totalV * 100) : 0, avgA: exec.length ? Math.round(exec.reduce((a, p) => a + num(p.progress_actual), 0) / exec.length) : 0, avgP: exec.length ? Math.round(exec.reduce((a, p) => a + num(p.progress_planned), 0) / exec.length) : 0, chOpen: chOpen.length, chHigh: chHigh.length, pendingPay: pays.filter(x => ['submitted', 'review', 'approved', 'finance'].includes(x.status)).reduce((a, x) => a + num(x.net_amount), 0) },
    period: { stages: stagesIn.length, tasksDone: tasksDone.length, paidN: paidIn.length, paidV: paidIn.reduce((a, x) => a + num(x.net_amount), 0), ms: msDone.length, reports: trsIn.length, reqs: reqs.length },
    highlights, decisions, upcoming, byStage, groups,
    exec: exec.sort((a, b) => num(b.contract_value) - num(a.contract_value)).map(projCard),
    pre: pre.map(p => ({ id: p.id, name: p.name, stage: p.stage, stageAr: stageOf(p.stage).ar, color: stageOf(p.stage).color, facility: p.facility || '', budget: num(p.budget || p.contract_value), eng: pn(p.engineer_id) || p.engineer_name || '', priority: p.priority || '', tender: p.tender_date || '', award: p.award_date || '' })),
    post: post.map(p => ({ id: p.id, name: p.name, stage: p.stage, stageAr: stageOf(p.stage).ar, color: stageOf(p.stage).color, facility: p.facility || '', cv: num(p.contract_value), warrantyEnd: p.warranty_end || '', handover: p.handover_initial_date || '' })),
    projects: Object.fromEntries([...pre, ...post].map(p => [p.id, projCard(p)])),
    challenges: Object.fromEntries(chOpen.map(c => [c.id, chCard(c)])),
  };
}

// ---------- النشر وإدارة الروابط (داخل المنصة)
const token = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
export const shareUrl = t => location.origin + location.pathname.replace(/[^/]*$/, '') + 'r.html?t=' + t;

export async function publishShare(from, to) {
  await modal(`<form id="f" class="pgrid">
    ${field('عنوان التقرير', inp('title', 'التقرير التنفيذي لمحفظة المشاريع', 'required'), 'wide')}
    ${field('صلاحية الرابط', sel('days', [['14', 'أسبوعان'], ['30', 'شهر'], ['90', 'ثلاثة أشهر'], ['365', 'سنة']], '30'))}
    ${field('رمز دخول (اختياري)', inp('pin', '', 'inputmode="numeric" placeholder="مثال 4 أرقام"'))}
    <p class="wide muted small m0">يُنشأ إصدار مجمّد من التقرير بحالة البيانات الآن${from || to ? ` (فترة النشاط: ${from ? 'من ' + dateAr(from) : ''} ${to ? 'إلى ' + dateAr(to) : ''})` : ''}. الرابط يفتح بلا حساب، ويمكن إلغاؤه في أي وقت من «الروابط المنشورة».</p>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إنشاء الرابط</button></div></form>`, { title: 'نشر رابط للإدارة التنفيذية', onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const btn = e.target.querySelector('button.primary'); btn.disabled = true; btn.textContent = 'جارٍ التجهيز…';
        try { const data = await buildSnapshot(from, to); const t = token(); const exp = new Date(Date.now() + Number(f.days) * 864e5).toISOString();
          await q(sb.from('shared_reports').insert({ token: t, title: f.title.trim(), period_from: from || null, period_to: to || null, data, pin: f.pin.trim() || null, expires_at: exp, created_by: session.user.id }));
          close(); linkModal(shareUrl(t), f.title.trim(), f.pin.trim());
        } catch (er) { err(er); btn.disabled = false; btn.textContent = 'إنشاء الرابط'; } };
    } });
}
export function linkModal(url, title, pin) {
  const msg = `${title}\n${url}${pin ? '\nرمز الدخول: ' + pin : ''}`;
  modal(`<div class="sharebox"><p class="small muted m0">انسخ الرابط وأرسله في واتساب أو البريد. يفتح مباشرة على الجوال بلا تسجيل دخول.</p>
    <div class="linkrow"><input id="shUrl" value="${esc(url)}" readonly dir="ltr"><button class="btn primary" id="shCopy">${ico('clip')} نسخ</button></div>
    ${pin ? `<p class="small m0">رمز الدخول: <b>${esc(pin)}</b> — أرسله في رسالة منفصلة.</p>` : ''}
    <div class="btnrow mt10"><a class="btn" target="_blank" href="https://wa.me/?text=${encodeURIComponent(msg)}">واتساب</a><a class="btn" target="_blank" href="${esc(url)}">معاينة</a><span class="sp"></span><button class="btn" data-x>إغلاق</button></div></div>`, { title: 'الرابط جاهز', onOpen: w => { $('#shCopy', w).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('نُسخ الرابط'); } catch (e) { $('#shUrl', w).select(); document.execCommand('copy'); toast('نُسخ الرابط'); } }; } });
}

export async function manageShares(openNotesOf = null) {
  const [rows, notes] = await Promise.all([q(sb.from('shared_reports').select('id,token,title,period_from,period_to,expires_at,revoked,views,last_viewed_at,created_at').order('id', { ascending: false }).limit(30)), q(sb.from('shared_notes').select('*').order('id', { ascending: false }).limit(200))]);
  const T = new Date().toISOString();
  const html = `<div class="shares">${rows.length ? rows.map(r => { const ns = notes.filter(n => n.report_id === r.id); const dead = r.revoked || r.expires_at < T; return `<div class="shr ${dead ? 'off' : ''}"><div class="sp"><b>${esc(r.title)}</b> <span class="badge ${dead ? 'skel' : 'full'}">${r.revoked ? 'ملغى' : r.expires_at < T ? 'منتهي' : 'فعّال'}</span><br><small class="muted">أُنشئ ${dateAr(r.created_at)} · ينتهي ${dateAr(r.expires_at)} · ${r.views ?? 0} مشاهدة${r.last_viewed_at ? ' · آخرها ' + dateAr(r.last_viewed_at) : ''}${ns.length ? ` · <b>${ns.length} ملاحظة</b>` : ''}</small></div>
      ${dead ? '' : `<button class="btn sm" data-copy="${r.token}">نسخ الرابط</button><button class="btn sm ghost" data-rev="${r.id}">إلغاء</button>`}${ns.length ? `<button class="btn sm ${ns.some(n => !n.seen) ? 'primary' : ''}" data-notes="${r.id}">الملاحظات</button>` : ''}</div>
      <div class="shnotes" id="shn${r.id}" ${openNotesOf === r.id ? '' : 'hidden'}>${ns.map(n => `<div class="shn ${n.seen ? '' : 'new'}"><div><b>${esc(n.name)}</b>${n.role_title ? ` <span class="muted">· ${esc(n.role_title)}</span>` : ''} <span class="muted small">· ${dateAr(n.created_at)}</span>${n.ref_title ? `<br><span class="badge skel">${esc(n.ref_title)}</span>` : ''}<p class="m0">${esc(n.body)}</p></div></div>`).join('')}</div>`; }).join('') : '<p class="muted">لم يُنشر أي رابط بعد.</p>'}</div>`;
  await modal(html, { title: 'الروابط المنشورة وملاحظات الإدارة التنفيذية', wide: true, onOpen: (w, close) => {
    $$('[data-copy]', w).forEach(b => b.onclick = async () => { const u = shareUrl(b.getAttribute('data-copy')); try { await navigator.clipboard.writeText(u); toast('نُسخ الرابط'); } catch (e) { prompt('انسخ الرابط:', u); } });
    $$('[data-rev]', w).forEach(b => b.onclick = async () => { if (!await confirm('إلغاء هذا الرابط؟ لن يفتح بعد الآن.', 'إلغاء الرابط', true)) return; await q(sb.from('shared_reports').update({ revoked: true }).eq('id', +b.getAttribute('data-rev'))); close(); manageShares(); });
    $$('[data-notes]', w).forEach(b => b.onclick = async () => { const id = +b.getAttribute('data-notes'); const box = $('#shn' + id, w); box.hidden = !box.hidden; if (!box.hidden) { await sb.from('shared_notes').update({ seen: true }).eq('report_id', id).eq('seen', false); b.classList.remove('primary'); $$('.shn.new', box).forEach(x => x.classList.remove('new')); } });
    if (openNotesOf) { const b = $(`[data-notes="${openNotesOf}"]`, w); if (b) { sb.from('shared_notes').update({ seen: true }).eq('report_id', openNotesOf).eq('seen', false); b.classList.remove('primary'); } }
  } });
}
