// ===== الإدارة: المستخدمون، سجل الأسعار، سجل التدقيق =====
import { sb, ROLES, q, session, invalidateRef } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, confirm, modal, field, inp, sel, formData } from './ui.js';

export async function mountAdmin(root, tab = 'users') {
  const tabs = [['users', 'المستخدمون'], ['quality', 'جودة البيانات'], ['prices', 'سجل الأسعار'], ['audit', 'سجل التدقيق'], ['settings', 'الإعدادات']];
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الإدارة</h1></div><div class="tabs">${tabs.map(([k, t]) => `<a href="#/admin/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="atab"><p class="muted">…</p></div>`;
  const t = $('#atab');
  if (tab === 'users') users(t); else if (tab === 'quality') quality(t); else if (tab === 'prices') prices(t); else if (tab === 'audit') audit(t); else settings(t);
}
async function users(t) {
  const rows = await q(sb.from('profiles').select('*').order('created_at'));
  const unlinked = await q(sb.from('projects').select('id,name,engineer_name,stage').is('engineer_id', null).eq('archived', false).order('name'));
  const engs = rows.filter(r => ['engineer', 'admin'].includes(r.role));
  const pending = rows.filter(r => r.role === 'pending');
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>المستخدمون <span class="muted">(${rows.length})</span></h2>
    ${pending.length ? `<div class="notice">يوجد ${pending.length} مستخدم بانتظار الاعتماد — حدد دوره ليتمكن من الدخول.</div>` : ''}
    <p class="muted" style="margin-bottom:10px">كيف ينضم مستخدم جديد: يفتح رابط المنصة ← «إنشاء حساب» بإيميله ← يظهر هنا بحالة «بانتظار الاعتماد» ← تحدد له الدور.</p>
    <table class="lst"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المسمى</th><th>الجوال</th><th>منذ</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${r.role === 'pending' ? 'hl' : ''}"><td><b>${esc(r.full_name || '—')}</b></td><td class="ltr">${esc(r.email)}</td><td>${sel('role', Object.entries(ROLES), r.role, `data-role="${r.id}" ${r.id === session.user.id ? 'disabled' : ''}`)}</td><td>${esc(r.title || '—')}</td><td class="ltr">${esc(r.phone || '—')}</td><td>${dateAr(r.created_at)}</td><td><button class="btn sm" data-edit="${r.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
  t.insertAdjacentHTML('beforeend', `<div class="pcard"><h2>مشاريع غير مربوطة بحساب مهندس <span class="badge ${unlinked.length ? 'ovr' : 'full'}">${unlinked.length}</span></h2><p class="muted small" style="margin-bottom:10px">اختر حساب المهندس لكل مشروع حتى تصله إشعاراته وتُحسب مؤشراته ويستطيع تعديل بياناته.</p>${unlinked.length ? `<table class="lst"><thead><tr><th>المشروع</th><th>الاسم المكتوب</th><th>حساب المهندس</th></tr></thead><tbody>${unlinked.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.engineer_name || '—')}</td><td><select data-link="${p.id}"><option value="">— اختر —</option>${engs.map(e => `<option value="${e.id}">${esc(e.full_name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>` : '<p class="muted">جميع المشاريع مربوطة بحسابات.</p>'}</div>`);
  $$('[data-link]', t).forEach(sl => sl.onchange = async () => { if (!sl.value) return; try { const e = engs.find(x => x.id === sl.value); await q(sb.from('projects').update({ engineer_id: sl.value, engineer_name: e.full_name }).eq('id', sl.getAttribute('data-link'))); toast('تم الربط'); sl.closest('tr').remove(); } catch (er) { err(er); } });
  $$('[data-role]', t).forEach(s => s.onchange = async () => { try { await q(sb.from('profiles').update({ role: s.value }).eq('id', s.getAttribute('data-role'))); toast('تم تحديث الدور'); users(t); } catch (e) { err(e); } });
  $$('[data-edit]', t).forEach(b => b.onclick = () => { const r = rows.find(x => x.id === b.getAttribute('data-edit')); modal(`<form id="f" class="pgrid">${field('الاسم', inp('full_name', r.full_name || ''), 'wide')}${field('المسمى الوظيفي', inp('title', r.title || ''))}${field('الجوال', inp('phone', r.phone || ''))}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تعديل مستخدم', onOpen: (w, close) => { $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('profiles').update({ full_name: f.full_name, title: f.title, phone: f.phone }).eq('id', r.id)); close(); users(t); } catch (er) { err(er); } }; } }); });
}
async function prices(t) {
  const rows = await q(sb.from('price_history').select('*, variants(ar,item_code)').order('changed_at', { ascending: false }).limit(300));
  const names = {}; (await q(sb.from('profiles').select('id,full_name'))).forEach(p => names[p.id] = p.full_name);
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>سجل تغييرات الأسعار <span class="muted">(آخر 300)</span></h2>${rows.length ? `<table class="lst"><thead><tr><th>التاريخ</th><th>الخيار</th><th class="c">من</th><th class="c">إلى</th><th class="c">التغير</th><th>بواسطة</th><th>ملاحظة</th></tr></thead><tbody>${rows.map(r => { const d = r.old_price ? ((r.new_price - r.old_price) / r.old_price * 100) : 0; return `<tr><td>${dateAr(r.changed_at)}</td><td><span class="cd">${esc(r.variant_code)}</span> ${esc(r.variants?.ar || '')}</td><td class="c n">${money(r.old_price)}</td><td class="c n">${money(r.new_price)}</td><td class="c ${d > 0 ? 'bad' : 'good'}">${d ? (d > 0 ? '+' : '') + d.toFixed(1) + '%' : '—'}</td><td>${esc(names[r.changed_by] || '—')}</td><td>${esc(r.note || '')}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">لا توجد تغييرات مسجلة بعد.</p>'}</div>`;
}
async function audit(t) {
  const rows = await q(sb.from('audit_log').select('*').order('at', { ascending: false }).limit(200));
  const names = {}; (await q(sb.from('profiles').select('id,full_name'))).forEach(p => names[p.id] = p.full_name);
  const T = { items: 'بند', variants: 'خيار', projects: 'مشروع', boqs: 'جدول كميات', profiles: 'مستخدم' }, A = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
  const diff = r => { if (r.action !== 'UPDATE') return ''; const ch = []; for (const k in (r.new_data || {})) { if (['updated_at', 'updated_by'].includes(k)) continue; if (JSON.stringify(r.old_data?.[k]) !== JSON.stringify(r.new_data[k])) ch.push(k); } return ch.join('، '); };
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>سجل التدقيق <span class="muted">(آخر 200 عملية)</span></h2><table class="lst"><thead><tr><th>التاريخ</th><th>الجدول</th><th>العملية</th><th>السجل</th><th>الحقول المتغيرة</th><th>بواسطة</th></tr></thead><tbody>${rows.map(r => `<tr><td>${new Date(r.at).toLocaleString('ar-SA-u-ca-gregory-nu-latn')}</td><td>${T[r.table_name] || r.table_name}</td><td>${A[r.action] || r.action}</td><td class="cd">${esc(r.row_id || '')} <span class="muted">${esc((r.new_data || r.old_data || {}).ar || (r.new_data || r.old_data || {}).name || '')}</span></td><td class="muted">${esc(diff(r))}</td><td>${esc(names[r.by_user] || 'النظام')}</td></tr>`).join('')}</tbody></table></div>`;
}
async function settings(t) {
  const rows = await q(sb.from('settings').select('*'));
  const get = k => rows.find(r => r.key === k)?.value;
  const org = get('org') || {}, admins = get('admin_emails') || [], rv = get('ref_version') || {};
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>إعدادات المنصة</h2><form id="f" class="pgrid">${field('اسم الجهة', inp('name', org.name || ''))}${field('الإدارة / القسم', inp('dept', org.dept || ''))}${field('إيميلات تصبح مدير نظام تلقائياً عند التسجيل (مفصولة بفواصل)', inp('admins', admins.join(', ')), 'wide')}<div class="btnrow end wide"><button class="btn primary">حفظ</button></div></form>
    <h3 class="sub">المرجع الفني</h3><p class="muted">إصدار البيانات: ${esc(JSON.stringify(rv))}</p><div class="btnrow"><button class="btn" id="clearCache">إعادة تحميل المرجع من الخادم</button></div></div>`;
  $('#f', t).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('settings').upsert([{ key: 'org', value: { name: f.name, dept: f.dept } }, { key: 'admin_emails', value: f.admins.split(/[,،]/).map(x => x.trim().toLowerCase()).filter(Boolean) }])); toast('تم الحفظ'); } catch (er) { err(er); } };
  $('#clearCache').onclick = () => { invalidateRef(); location.reload(); };
}

// ---------- جودة البيانات: نواقص تشوّه المؤشرات
async function quality(t) {
  t.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ فحص البيانات…</div>';
  const today = new Date().toISOString().slice(0, 10); const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const [projects, profiles, pays, trs, subs, tasks, chs, docs, dwgs, revs] = await Promise.all([
    q(sb.from('projects').select('id,name,stage,category,type,engineer_id,engineer_name,contract_value,budget,start_date,end_date,contractor,progress_actual,progress_planned,award_date,tender_date,updated_at').eq('archived', false)),
    q(sb.from('profiles').select('id,full_name,role,title,created_at')),
    q(sb.from('payments').select('id,project_id,no,kind,status,period_from,period_to,payment_order_no,work_amount')),
    q(sb.from('tech_reports').select('id,project_id,title,status,created_at')),
    q(sb.from('submittals').select('id,project_id,no,title,status,spec_ref,spec_title,due_on')),
    q(sb.from('tasks').select('id,project_id,title,status,due_date,assignee_id,assignee_name')),
    q(sb.from('challenges').select('id,project_id,title,status,owner,action,detected_on,created_at')),
    q(sb.from('documents').select('id,project_id,category,expiry_date')),
    q(sb.from('drawings').select('id,project_id,dwg_no,title')),
    q(sb.from('drawing_revisions').select('id,drawing_id,path,link')),
  ]);
  const pn = id => projects.find(p => p.id === id)?.name || '—';
  const act = projects.filter(p => !['closed', 'cancelled'].includes(p.stage));
  const exec = act.filter(p => p.stage === 'execution'); const contracted = act.filter(p => ['award', 'execution', 'handover', 'warranty'].includes(p.stage));
  const study = act.filter(p => ['request', 'study', 'approval', 'design', 'tender'].includes(p.stage));
  const P = (arr, link) => arr.map(p => ({ t: p.name, l: `#/project/${p.id}${link || ''}` }));
  const checks = [
    ['bad', 'مشاريع متعاقد عليها بلا قيمة عقد', 'تشوّه قيمة المحفظة ونسب الصرف', P(contracted.filter(p => !Number(p.contract_value)))],
    ['bad', 'مشاريع تحت التنفيذ بلا تاريخ انتهاء تعاقدي', 'لا يمكن حساب التأخر', P(exec.filter(p => !p.end_date))],
    ['bad', 'مشاريع تحت التنفيذ بلا تاريخ مباشرة', '', P(exec.filter(p => !p.start_date))],
    ['bad', 'مشاريع قائمة بلا حساب مهندس مسؤول', 'لا تصله إشعاراته ولا تُحسب مؤشراته', P(act.filter(p => !p.engineer_id), '')],
    ['warn', 'مشاريع متعاقد عليها بلا اسم مقاول', '', P(contracted.filter(p => !p.contractor))],
    ['warn', 'مشاريع تنفيذ بدأت منذ أكثر من 30 يوماً وإنجازها 0%', 'غالباً لم يُحدّث الإنجاز', P(exec.filter(p => p.start_date && p.start_date < ago(30) && !Number(p.progress_actual)))],
    ['warn', 'مشاريع تنفيذ بلا إنجاز مخطط', 'لا يمكن قياس الانحراف', P(exec.filter(p => !Number(p.progress_planned)))],
    ['warn', 'مشاريع تحت الدراسة بلا ميزانية تقديرية', '', P(study.filter(p => !Number(p.budget)))],
    ['warn', 'مشاريع بلا فئة أو نوع', '', P(act.filter(p => !p.category || !p.type))],
    ['warn', 'مشاريع تنفيذ ناقصة مستندات أساسية', 'العقد، محضر تسليم الموقع، الضمان البنكي، التأمين', exec.filter(p => ['contract', 'site_handover', 'bank_guarantee', 'insurance'].some(c => !docs.some(d => d.project_id === p.id && d.category === c))).map(p => ({ t: p.name, l: `#/project/${p.id}/docs` }))],
    ['bad', 'ضمانات أو تأمينات منتهية', '', docs.filter(d => ['bank_guarantee', 'insurance'].includes(d.category) && d.expiry_date && d.expiry_date < today).map(d => ({ t: pn(d.project_id) + ' — ' + (d.category === 'bank_guarantee' ? 'ضمان بنكي' : 'تأمين'), l: `#/project/${d.project_id}/docs` }))],
    ['warn', 'مستخلصات مقدَّمة بلا فترة', '', pays.filter(p => p.status !== 'draft' && p.kind !== 'advance' && (!p.period_from || !p.period_to)).map(p => ({ t: `${pn(p.project_id)} — مستخلص ${p.no}`, l: `#/project/${p.project_id}/payments` }))],
    ['warn', 'مستخلصات مصروفة بلا رقم أمر دفع', '', pays.filter(p => p.status === 'paid' && !p.payment_order_no).map(p => ({ t: `${pn(p.project_id)} — مستخلص ${p.no}`, l: `#/project/${p.project_id}/payments` }))],
    ['warn', 'تقارير فنية مسودة منذ أكثر من 7 أيام', 'إما تُنشر أو تُحذف', trs.filter(r => r.status === 'draft' && r.created_at < ago(7)).map(r => ({ t: r.title, l: `#/treport/${r.id}` }))],
    ['warn', 'طلبات اعتماد بلا بند مرجعي', 'يصعب التحقق من المطابقة', subs.filter(s => !s.spec_ref && !s.spec_title).map(s => ({ t: `${pn(s.project_id)} — SUB-${String(s.no).padStart(3, '0')}`, l: `#/project/${s.project_id}/submittals` }))],
    ['warn', 'مهام مفتوحة بلا موعد', 'لا تدخل في قياس الالتزام', tasks.filter(x => ['open', 'in_progress'].includes(x.status) && !x.due_date).map(x => ({ t: `${pn(x.project_id)} — ${x.title}`, l: `#/project/${x.project_id}/tasks` }))],
    ['warn', 'مهام مفتوحة بلا مكلَّف بحساب', 'لا تصل إشعاراتها لأحد', tasks.filter(x => ['open', 'in_progress'].includes(x.status) && !x.assignee_id).map(x => ({ t: `${pn(x.project_id)} — ${x.title}`, l: `#/project/${x.project_id}/tasks` }))],
    ['warn', 'تحديات مفتوحة بلا مسؤول أو إجراء', '', chs.filter(c => c.status !== 'مغلق' && (!c.owner || !c.action)).map(c => ({ t: `${pn(c.project_id)} — ${c.title}`, l: `#/project/${c.project_id}/challenges` }))],
    ['warn', 'تحديات مفتوحة منذ أكثر من 60 يوماً', 'تحتاج إغلاقاً أو تصعيداً', chs.filter(c => c.status !== 'مغلق' && (c.detected_on || c.created_at) < ago(60)).map(c => ({ t: `${pn(c.project_id)} — ${c.title}`, l: `#/project/${c.project_id}/challenges` }))],
    ['warn', 'مخططات بلا ملف ولا رابط', '', dwgs.filter(d => !revs.some(r => r.drawing_id === d.id && (r.path || r.link))).map(d => ({ t: `${pn(d.project_id)} — ${d.dwg_no || d.title}`, l: `#/project/${d.project_id}/drawings` }))],
    ['warn', 'حسابات بانتظار الاعتماد', '', profiles.filter(p => p.role === 'pending').map(p => ({ t: p.full_name || '—', l: '#/admin/users' }))],
  ];
  const issues = checks.reduce((a, c) => a + c[3].length, 0); const bad = checks.filter(c => c[0] === 'bad').reduce((a, c) => a + c[3].length, 0);
  const denom = Math.max(1, act.length * 6); const score = Math.max(0, Math.min(100, Math.round(100 - issues / denom * 100)));
  t.innerHTML = `<div class="kpis"><div class="kpi"><span>اكتمال البيانات</span><b class="${score >= 85 ? '' : 'bad'}">${score}%</b></div><div class="kpi ${bad ? 'bad' : ''}"><span>نواقص مؤثرة</span><b>${bad}</b></div><div class="kpi"><span>ملاحظات</span><b>${issues - bad}</b></div><div class="kpi"><span>مشاريع قائمة مفحوصة</span><b>${act.length}</b></div></div>
    <p class="muted small" style="margin:-6px 0 12px">الفحص يُحسب لحظياً من البيانات الحالية. النواقص المؤثرة (بالأحمر) تشوّه لوحة المؤشرات والتقارير مباشرة؛ الملاحظات تحسّن الدقة والمتابعة.</p>
    ${checks.filter(c => c[3].length).map(c => `<div class="pcard"><h2><span class="badge ${c[0]}">${c[3].length}</span> ${c[1]}${c[2] ? ` <small class="muted" style="font-weight:500">— ${c[2]}</small>` : ''}</h2><div class="chips">${c[3].slice(0, 40).map(i => `<a class="chip" href="${i.l}">${esc(i.t)}</a>`).join('')}${c[3].length > 40 ? `<span class="muted small">و${c[3].length - 40} أخرى…</span>` : ''}</div></div>`).join('') || '<div class="empty-boq">✅ لا توجد نواقص — البيانات مكتملة.</div>'}
    ${checks.filter(c => !c[3].length).length ? `<div class="pcard"><h2>فحوصات سليمة <span class="badge full">${checks.filter(c => !c[3].length).length}</span></h2><div class="chips">${checks.filter(c => !c[3].length).map(c => `<span class="chip">✓ ${c[1]}</span>`).join('')}</div></div>` : ''}`;
}
