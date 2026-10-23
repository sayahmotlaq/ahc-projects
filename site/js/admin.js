// ===== الإدارة: المستخدمون، سجل الأسعار، سجل التدقيق =====
import { sb, ROLES, q, session, invalidateRef } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, confirm, modal, field, inp, sel, formData, kic, ico, ICONS } from './ui.js';

export async function mountAdmin(root, tab = 'users') {
  const tabs = [['users', 'المستخدمون'], ['quality', 'جودة البيانات'], ['prices', 'سجل الأسعار'], ['audit', 'سجل التدقيق'], ['lumpsum', 'بنود المقطوعية'], ['guide', 'دليل المواصفات'], ['i18n', 'الترجمة الإنجليزية'], ['facilities', 'المرافق والخريطة'], ['kinds', 'نماذج الأقسام'], ['settings', 'الإعدادات']];
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الإدارة</h1></div><div class="tabs">${tabs.map(([k, t]) => `<a href="#/admin/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="atab"><p class="muted">…</p></div>`;
  const t = $('#atab');
  if (tab === 'users') users(t); else if (tab === 'quality') quality(t); else if (tab === 'prices') prices(t); else if (tab === 'audit') audit(t); else if (tab === 'i18n') (await import('./i18nadmin.js')).mountI18nAdmin(t).catch(err); else if (tab === 'guide') (await import('./guide.js')).mountGuideAdmin(t).catch(err); else if (tab === 'lumpsum') (await import('./lumpsum.js')).mountLsAdmin(t).catch(err); else if (tab === 'facilities') (await import('./map.js')).mountFacilities(t).catch(err); else if (tab === 'kinds') kinds(t).catch(err); else settings(t);
}
// ---------- توزيع الأدوار: دليل الأدوار + السجل المعتمد مسبقاً (يأخذ الموظف دوره تلقائياً عند تسجيله بإيميله)
const ROLE_GUIDE = [
  ['admin', 'مدير النظام', 'كل شيء: الأقسام والمشاريع والإعدادات والمستخدمين والنماذج.', 'صالح'],
  ['viewer', 'القيادة والاطلاع', 'يرى كل الأقسام والمشاريع والتقارير ولوحة الإدارة، بلا تعديل.', 'م. أيمن، نائب الرئيس'],
  ['head', 'رئيس قسم + القسم', 'يرى المنصة كاملة، ويدير أعمال قسمه (استلام، تكليف، إغلاق، اعتمادات قسمه، الأصول والخطط)، وتصله أعمال قسمه.', 'رؤساء الأقسام الثمانية'],
  ['engineer', 'مهندس مشاريع', 'ينشئ مشاريعه ويعدّلها، ويعمل على طلبات قسم المشاريع.', 'مهندسو قسم المشاريع'],
  ['tech', 'موظف قسم فني + القسم', 'أعمال قسمه وأصوله وخططه، ومتابعة الأنظمة، والحوكمة؛ لا يرى المشاريع والمالية.', 'فنيو ومهندسو الأقسام'],
  ['facility', 'مدير مرفق + منشآته', 'الجولة الشهرية لمنشآته، أعمال منشآته وإشعاراتها، فرز الطلبات الواردة (المرافق قناة الاستقبال الموحدة)، والإغلاقات والمواقع؛ لا يرى المشاريع.', 'مدراء المرافق في المستشفيات'],
  ['clerk', 'إداري', 'اطلاع على المشاريع وطباعة ورفع مستندات.', 'السكرتارية'],
  ['finance', 'مالية', 'تسجيل صرف المستخلصات فقط.', 'المالية'],
  ['requester', 'مُبلّغ + منشأته', 'يرفع البلاغات والطلبات ويتابعها ويؤكد معالجتها ويقيّمها فقط.', 'موظفو المنشآت'],
];
async function roster(t) {
  const [rows, units, facs, profs] = await Promise.all([q(sb.from('role_roster').select('*').order('role').order('full_name')), q(sb.from('gov_units').select('code,short,kind').eq('kind', 'unit').order('sort')), q(sb.from('facilities').select('id,name').eq('active', true).order('sort')), q(sb.from('profiles').select('email,role'))]);
  const U = Object.fromEntries(units.map(u => [u.code, u.short])), F = Object.fromEntries(facs.map(f => [f.id, f.name])), P = Object.fromEntries(profs.map(p => [(p.email || '').toLowerCase(), p]));
  const box = document.createElement('div'); box.className = 'pcard'; t.prepend(box);
  box.innerHTML = `<h2>توزيع الأدوار</h2>
    <details class="mb10"><summary class="small"><b>دليل الأدوار</b> — من يرى ماذا ومن يفعل ماذا</summary><table class="lst mt8 nocard"><thead><tr><th>الدور</th><th>الصلاحيات</th><th>لمن</th></tr></thead><tbody>${ROLE_GUIDE.map(([k, n, d, w]) => `<tr><td><b>${esc(n)}</b></td><td class="small">${esc(d)}</td><td class="small muted">${esc(w)}</td></tr>`).join('')}</tbody></table></details>
    <div class="toolbar m0"><b>السجل المعتمد مسبقاً <span class="muted">(${rows.length})</span></b><span class="muted small">يأخذ الموظف دوره وقسمه ومنشآته تلقائياً لحظة تسجيله بإيميله، بلا انتظار اعتماد.</span><span class="sp"></span><button class="btn sm" id="rBulk">إضافة مجمّعة</button><button class="btn sm primary" id="rAdd">＋ موظف</button></div>
    ${rows.length ? `<table class="lst"><thead><tr><th>الاسم</th><th>الإيميل</th><th>الدور</th><th>القسم</th><th>المنشآت</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(r => { const p = P[r.email]; return `<tr><td><b>${esc(r.full_name)}</b>${r.title ? `<div class="muted small">${esc(r.title)}</div>` : ''}</td><td class="ltr small">${esc(r.email)}</td><td>${esc(ROLES[r.role] || r.role)}</td><td>${esc(U[r.unit] || '—')}</td><td class="small">${(r.fac_ids || []).map(i => esc(F[i] || '#' + i)).join('، ') || (r.role === 'facility' ? '<span class="bad">لم تُربط</span>' : '—')}</td><td>${p ? `<span class="badge full">مسجّل</span>` : '<span class="badge skel">لم يسجّل بعد</span>'}</td><td><button class="btn sm" data-r="${esc(r.email)}">تعديل</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">لا أحد بعد.</p>'}
    <p class="muted small mt8">أرسل للموظف رابط المنصة ليُنشئ حساباً بإيميله الرسمي نفسه المسجل هنا.</p>`;
  const form = async r0 => {
    const v = r0 || { email: '', full_name: '', role: 'tech', unit: '', fac_ids: [], title: '' };
    await modal(`<form id="rf" class="pgrid">${field('الاسم *', inp('full_name', v.full_name, 'required'))}${field('الإيميل *', inp('email', v.email, `required type="email" dir="ltr" ${r0 ? 'readonly' : ''}`))}
      ${field('الدور', sel('role', ROLE_GUIDE.map(([k, n]) => [k, n]), v.role))}${field('القسم', sel('unit', [['', '—'], ...units.map(u => [u.code, u.short])], v.unit || ''))}${field('المسمى', inp('title', v.title || ''))}
      <div class="fld wide"><span>المنشآت (لمدير المرفق والمُبلّغ)</span><div class="chips">${facs.map(f => `<label class="chip"><input type="checkbox" name="f_${f.id}" ${(v.fac_ids || []).map(Number).includes(f.id) ? 'checked' : ''}> ${esc(f.name)}</label>`).join('')}</div></div>
      <div class="btnrow end wide">${r0 ? '<button type="button" class="btn danger" id="rDel">حذف من السجل</button><span class="sp"></span>' : ''}<button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
      { title: r0 ? 'تعديل' : 'موظف في السجل', wide: true, onOpen: (w, c) => {
        $('#rDel', w) && ($('#rDel', w).onclick = async () => { try { await q(sb.from('role_roster').delete().eq('email', r0.email)); c(); users(t); } catch (e) { err(e); } });
        $('#rf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const row = { email: x.email.trim().toLowerCase(), full_name: x.full_name.trim(), role: x.role, unit: x.unit || null, title: x.title.trim(), fac_ids: facs.filter(f => x['f_' + f.id]).map(f => f.id) };
          try { await q(sb.from('role_roster').upsert(row, { onConflict: 'email' })); toast('حُفظ — يُطبَّق فوراً إن كان مسجلاً'); c(); users(t); } catch (er) { err(er); } }; } });
  };
  $('#rAdd', box).onclick = () => form(null);
  $$('[data-r]', box).forEach(b => b.onclick = () => form(rows.find(r => r.email === b.dataset.r)));
  $('#rBulk', box).onclick = () => modal(`<form id="bf"><p class="muted small m0">سطر لكل موظف (لصق من Excel): <b>الاسم | الإيميل | الدور | القسم</b><br>الأدوار: ${ROLE_GUIDE.map(([k, n]) => `${esc(n)} = <span dir="ltr">${k}</span>`).join('، ')}<br>الأقسام: ${units.map(u => `${esc(u.short)} = ${u.code}`).join('، ')}</p><textarea name="t" rows="10" dir="auto"></textarea><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إضافة</button></div></form>`,
    { title: 'إضافة مجمّعة للسجل', wide: true, onOpen: (w, c) => { $('#bf', w).onsubmit = async e => { e.preventDefault();
      const byName = Object.fromEntries([...ROLE_GUIDE.map(([k, n]) => [n.split(' +')[0], k]), ...units.map(u => [u.short, u.code])]);
      const rs = e.target.t.value.split(/\n/).map(l => l.split(/\t|\|/).map(x => x.trim())).filter(a => a[1] && a[1].includes('@')).map(([n, em, r = 'tech', u = '']) => ({ full_name: n, email: em.toLowerCase(), role: ROLE_GUIDE.some(g => g[0] === r) ? r : (byName[r] || 'tech'), unit: units.some(x => x.code === u) ? u : (byName[u] || null) }));
      if (!rs.length) return toast('لا أسطر صالحة', 'bad');
      try { await q(sb.from('role_roster').upsert(rs, { onConflict: 'email' })); toast(`أُضيف ${rs.length}`); c(); users(t); } catch (er) { err(er); } }; } });
}
async function users(t) {
  const rows = await q(sb.from('profiles').select('*').order('created_at'));
  const UNITS = (await q(sb.from('gov_units').select('code,short,kind').eq('kind', 'unit').order('sort'))).map(u => [u.code, u.short]);
  const facs = await q(sb.from('facilities').select('id,name').eq('active', true).order('sort')); const FAC = Object.fromEntries(facs.map(f => [f.id, f.name]));
  const unlinked = await q(sb.from('projects').select('id,name,engineer_name,stage').is('engineer_id', null).eq('archived', false).order('name'));
  const engs = rows.filter(r => ['engineer', 'admin'].includes(r.role));
  const pending = rows.filter(r => r.role === 'pending');
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>المستخدمون <span class="muted">(${rows.length})</span></h2>
    ${pending.length ? `<div class="notice">يوجد ${pending.length} مستخدم بانتظار الاعتماد — حدد دوره ليتمكن من الدخول.</div>` : ''}
    <p class="mb10 muted" >كيف ينضم مستخدم جديد: يفتح رابط المنصة ← «إنشاء حساب» بإيميله ← يظهر هنا بحالة «بانتظار الاعتماد» ← تحدد له الدور والقسم. موظفو الأقسام الفنية: «موظف قسم فني» مع قسمه (يعمل على أعمال قسمه)، وموظفو المنشآت: «مُبلّغ من المنشأة» مع منشأته (يرفع البلاغات ويتابعها).</p>
    <table class="lst"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>القسم</th><th>المسمى</th><th>الجوال</th><th>منذ</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${r.role === 'pending' ? 'hl' : ''}"><td><b>${esc(r.full_name || '—')}</b>${(r.fac_ids || []).length ? `<div class="muted small">${(r.fac_ids || []).map(i => esc(FAC[i] || '')).join('، ')}</div>` : r.role === 'requester' && r.facility_id ? `<div class="muted small">${esc(FAC[r.facility_id] || '')}</div>` : ''}</td><td class="ltr">${esc(r.email)}</td><td>${sel('role', Object.entries(ROLES), r.role, `data-role="${r.id}" ${r.id === session.user.id ? 'disabled' : ''}`)}</td><td>${sel('unit', [['', '—'], ...UNITS], r.unit || '', `data-unit="${r.id}"`)}</td><td>${esc(r.title || '—')}</td><td class="ltr">${esc(r.phone || '—')}</td><td>${dateAr(r.created_at)}</td><td><button class="btn sm" data-edit="${r.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
  roster(t).catch(err);
  t.insertAdjacentHTML('beforeend', `<div class="pcard"><h2>مشاريع غير مربوطة بحساب مهندس <span class="badge ${unlinked.length ? 'ovr' : 'full'}">${unlinked.length}</span></h2><p class="mb10 muted small" >اختر حساب المهندس لكل مشروع حتى تصله إشعاراته وتُحسب مؤشراته ويستطيع تعديل بياناته.</p>${unlinked.length ? `<table class="lst"><thead><tr><th>المشروع</th><th>الاسم المكتوب</th><th>حساب المهندس</th></tr></thead><tbody>${unlinked.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.engineer_name || '—')}</td><td><select data-link="${p.id}"><option value="">— اختر —</option>${engs.map(e => `<option value="${e.id}">${esc(e.full_name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>` : '<p class="muted">جميع المشاريع مربوطة بحسابات.</p>'}</div>`);
  $$('[data-link]', t).forEach(sl => sl.onchange = async () => { if (!sl.value) return; try { const e = engs.find(x => x.id === sl.value); await q(sb.from('projects').update({ engineer_id: sl.value, engineer_name: e.full_name }).eq('id', sl.getAttribute('data-link'))); toast('تم الربط'); sl.closest('tr').remove(); } catch (er) { err(er); } });
  $$('[data-unit]', t).forEach(s => s.onchange = async () => { try { await q(sb.from('profiles').update({ unit: s.value || null }).eq('id', s.getAttribute('data-unit'))); toast('تم تحديث القسم'); } catch (e) { err(e); } });
  $$('[data-role]', t).forEach(s => s.onchange = async () => { try { await q(sb.from('profiles').update({ role: s.value }).eq('id', s.getAttribute('data-role'))); toast('تم تحديث الدور'); users(t); } catch (e) { err(e); } });
  $$('[data-edit]', t).forEach(b => b.onclick = () => { const r = rows.find(x => x.id === b.getAttribute('data-edit')); modal(`<form id="f" class="pgrid">${field('الاسم', inp('full_name', r.full_name || ''), 'wide')}${field('المسمى الوظيفي', inp('title', r.title || ''))}${field('الجوال', inp('phone', r.phone || ''))}${field('القسم', sel('unit', [['', '—'], ...UNITS], r.unit || ''))}${field('المنشأة (للمُبلّغين)', sel('facility_id', [['', '—'], ...facs.map(f => [f.id, f.name])], r.facility_id || ''))}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تعديل مستخدم', onOpen: (w, close) => { $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('profiles').update({ full_name: f.full_name, title: f.title, phone: f.phone, unit: f.unit || null, facility_id: f.facility_id ? +f.facility_id : null }).eq('id', r.id)); close(); users(t); } catch (er) { err(er); } }; } }); });
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
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>إعدادات المنصة</h2><form id="f" class="pgrid">${field('اسم الجهة', inp('name', org.name || ''))}${field('الإدارة / القسم', inp('dept', org.dept || ''))}${field('إيميلات تصبح مدير نظام تلقائياً عند التسجيل (مفصولة بفواصل)', inp('admins', admins.join(', ')), 'wide')}
    <div class="wide"><h3 class="sub">قواعد المتابعة</h3></div>
    ${field('مدة الرد على الاعتمادات (أيام)', inp('sla', get('submittal_sla_days') ?? 7, 'type="number" min="1" max="60"'))}
    ${field('عتبة «بلا تحديث» (أيام)', inp('stale', get('stale_days') ?? 14, 'type="number" min="3" max="90"'))}
    ${field('تنبيه انتهاء الضمان والتأمين قبل (أيام)', inp('docexp', get('doc_expiry_alert_days') ?? 30, 'type="number" min="7" max="180"'))}
    ${field('تنبيه انتهاء فترة ضمان المشروع قبل (أيام)', inp('warr', get('warranty_alert_days') ?? 60, 'type="number" min="7" max="365"'))}
    ${field('لوحة الشرف للمهندسين', sel('lb', [['false', 'غير مفعّلة (كل مهندس يرى نفسه ومتوسط الفريق)'], ['true', 'مفعّلة (يظهر ترتيب المهندس بين زملائه)']], String(get('perf_leaderboard') === true)), 'wide')}
    <div class="btnrow end wide"><button class="btn primary">حفظ</button></div></form>
    <h3 class="sub">المرجع الفني</h3><p class="muted">إصدار البيانات: ${esc(JSON.stringify(rv))}</p><div class="btnrow"><button class="btn" id="clearCache">إعادة تحميل المرجع من الخادم</button></div></div>`;
  $('#f', t).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); try { await q(sb.from('settings').upsert([{ key: 'org', value: { name: f.name, dept: f.dept } }, { key: 'admin_emails', value: f.admins.split(/[,،]/).map(x => x.trim().toLowerCase()).filter(Boolean) }, { key: 'submittal_sla_days', value: Number(f.sla) || 7 }, { key: 'stale_days', value: Number(f.stale) || 14 }, { key: 'doc_expiry_alert_days', value: Number(f.docexp) || 30 }, { key: 'warranty_alert_days', value: Number(f.warr) || 60 }, { key: 'perf_leaderboard', value: f.lb === 'true' }])); toast('تم الحفظ — تُطبّق الإعدادات عند إعادة تحميل الصفحة'); } catch (er) { err(er); } };
  $('#clearCache').onclick = () => { invalidateRef(); location.reload(); };
}

// ---------- جودة البيانات: نواقص تشوّه المؤشرات
async function quality(t) {
  t.innerHTML = '<div class="loading"><div class="spin"></div>جارٍ فحص البيانات…</div>';
  const today = new Date().toISOString().slice(0, 10); const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const [projects, profiles, pays, trs, subs, tasks, chs, docs, dwgs, revs] = await Promise.all([
    q(sb.from('projects').select('id,name,stage,category,type,engineer_id,engineer_name,contract_value,budget,start_date,end_date,contractor,progress_actual,progress_planned,award_date,tender_date,updated_at').eq('archived', false)),
    q(sb.from('profiles').select('id,full_name,role,title,created_at')),
    q(sb.from('payments').select('id,project_id,no,kind,status,period_from,period_to,payment_order_no,work_amount,retention_pct,vat_pct')),
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
    ['bad', 'قيمة عقد تبدو شاملة الضريبة', 'قيمة العقد تساوي قيمة أعمال مستخلص × 1.15 — القاعدة: كل المبالغ قبل الضريبة', P(projects.filter(p => pays.some(x => x.project_id === p.id && Number(x.work_amount) > 0 && Math.abs(Number(x.work_amount) * (1 + Number(x.vat_pct || 15) / 100) - Number(p.contract_value)) < 1)), '/payments')],
    ['warn', 'مستخلصات بنسبة حجز ضمان غير معتادة (> 20٪)', 'غالباً خطأ إدخال', P(projects.filter(p => pays.some(x => x.project_id === p.id && Number(x.retention_pct) > 20)), '/payments')],
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
    ${checks.filter(c => c[3].length).map(c => `<div class="pcard"><h2><span class="badge ${c[0]}">${c[3].length}</span> ${c[1]}${c[2] ? ` <small class="muted" style="font-weight:500">— ${c[2]}</small>` : ''}</h2><div class="chips">${c[3].slice(0, 40).map(i => `<a class="chip" href="${i.l}">${esc(i.t)}</a>`).join('')}${c[3].length > 40 ? `<span class="muted small">و${c[3].length - 40} أخرى…</span>` : ''}</div></div>`).join('') || '<div class="empty-boq">' + ico('okc') + ' لا توجد نواقص — البيانات مكتملة.</div>'}
    ${checks.filter(c => !c[3].length).length ? `<div class="pcard"><h2>فحوصات سليمة <span class="badge full">${checks.filter(c => !c[3].length).length}</span></h2><div class="chips">${checks.filter(c => !c[3].length).map(c => `<span class="chip">✓ ${c[1]}</span>`).join('')}</div></div>` : ''}`;
}

// ---------- نماذج الأقسام (أنواع الأعمال في المحرّك التشغيلي): الحقول، بيانات الإنجاز، الاعتمادات، قائمة التحقق
async function kinds(t) {
  const [ks, units, procs] = await Promise.all([q(sb.from('ops_kinds').select('*').order('sort')), q(sb.from('gov_units').select('code,short,color,kind').order('sort')), q(sb.from('gov_processes').select('code,title').order('code'))]);
  const U = Object.fromEntries(units.map(u => [u.code, u]));
  t.innerHTML = `<div class="pcard"><div class="toolbar m0"><h2 class="m0">نماذج الأقسام <span class="muted">(${ks.length})</span></h2><span class="sp"></span><button class="btn primary" id="kNew">＋ نموذج</button></div>
    <p class="muted small">كل نموذج نوع عمل لقسمه: يظهر للجميع في مركز البلاغات إن كان «استقبال»، أو لفرق الأقسام فقط. الحقول وبيانات الإنجاز والاعتمادات وقائمة التحقق تُكتب بصيغة JSON — التعديل يسري فوراً على الطلبات الجديدة.</p>
    <table class="lst"><thead><tr><th></th><th>النموذج</th><th>القسم</th><th>الإجراء</th><th>الأولوية</th><th>الظهور</th><th>حقول</th><th>اعتمادات</th><th>تحقق</th><th></th></tr></thead><tbody>${ks.map(k => `<tr class="${k.active === false ? 'muted' : ''}"><td class="kic" style="--k:#${U[k.unit]?.color || '6B7A88'}">${kic(k)}</td><td><b>${esc(k.name)}</b><div class="muted small ltr">${esc(k.code)}</div></td><td><span class="uchip" style="--c:#${U[k.unit]?.color || '6B7A88'}">${esc(U[k.unit]?.short || k.unit)}</span></td><td>${esc(k.proc || '—')}</td><td>${esc(k.prio)}</td><td>${k.intake ? 'استقبال للجميع' : 'فرق الأقسام'}${k.active === false ? ' · موقوف' : ''}</td><td class="c">${(k.fields || []).length}</td><td class="c">${(k.gates || []).length}</td><td class="c">${(k.checklist || []).length}</td><td><button class="btn sm" data-k="${k.code}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
  const form = async k0 => {
    const k = k0 || { code: '', unit: 'MNT', name: '', short: '', icon: '', descr: '', proc: '', intake: true, prio: 'p3', fields: [], close_fields: [], gates: [], checklist: [], sort: 200, active: true };
    const J = v => esc(JSON.stringify(v || [], null, 1));
    await modal(`<form id="kf" class="pgrid">${field('الرمز *', inp('code', k.code, `required dir="ltr" ${k0 ? 'readonly' : ''} pattern="[a-z_]+"`))}${field('القسم', sel('unit', units.filter(u => u.kind === 'unit').map(u => [u.code, u.short]), k.unit))}
      ${field('الاسم *', inp('name', k.name, 'required'))}${field('اسم مختصر', inp('short', k.short))}${field('أيقونة', sel('icon', [['', 'تلقائية حسب النموذج'], ...Object.keys(ICONS).map(n => [n, n])], ICONS[k.icon] ? k.icon : ''))}${field('الإجراء الحاكم', sel('proc', [['', '—'], ...procs.map(p => [p.code, p.code + ' — ' + p.title])], k.proc))}
      ${field('الوصف', inp('descr', k.descr), 'wide')}${field('الأولوية المقترحة', sel('prio', [['p1', 'طارئ'], ['p2', 'عاجل'], ['p3', 'عادي'], ['p4', 'مخطط']], k.prio))}${field('الترتيب', inp('sort', k.sort, 'type="number"'))}
      <label class="chk"><input type="checkbox" name="intake" ${k.intake ? 'checked' : ''}> يظهر للجميع في مركز البلاغات</label><label class="chk"><input type="checkbox" name="active" ${k.active !== false ? 'checked' : ''}> فعّال</label>
      ${field('حقول النموذج — [{"k":"المفتاح","l":"العنوان","t":"text|textarea|select|number|date|datetime-local","o":["خيار"],"req":true}]', `<textarea name="fields" rows="5" dir="ltr">${J(k.fields)}</textarea>`, 'wide')}
      ${field('بيانات الإنجاز (تُطلب عند «أُنجز» أو «إغلاق») — بالصيغة نفسها', `<textarea name="close_fields" rows="4" dir="ltr">${J(k.close_fields)}</textarea>`, 'wide')}
      ${field('اعتمادات الأقسام — [{"k":"saf","unit":"SAF","l":"العنوان","before":"in_progress|verify|done"}]', `<textarea name="gates" rows="3" dir="ltr">${J(k.gates)}</textarea>`, 'wide')}
      ${field('قائمة التحقق قبل الإغلاق — [{"k":"clean","l":"التنظيف"}]', `<textarea name="checklist" rows="3" dir="ltr">${J(k.checklist)}</textarea>`, 'wide')}
      <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
      { title: k0 ? 'تعديل نموذج' : 'نموذج جديد', wide: true, onOpen: (w, c) => { $('#kf', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const row = { unit: x.unit, name: x.name.trim(), short: x.short.trim(), icon: x.icon.trim() || '•', descr: x.descr.trim(), proc: x.proc, prio: x.prio, sort: +x.sort || 0, intake: !!x.intake, active: !!x.active };
        for (const f of ['fields', 'close_fields', 'gates', 'checklist']) { try { const v = JSON.parse(x[f] || '[]'); if (!Array.isArray(v)) throw 0; row[f] = v; } catch (er) { return toast('صيغة JSON غير صحيحة في: ' + f, 'bad'); } }
        try { if (k0) await q(sb.from('ops_kinds').update(row).eq('code', k0.code)); else await q(sb.from('ops_kinds').insert({ code: x.code.trim(), ...row })); toast('حُفظ'); c(); kinds(t); } catch (er) { err(er); } }; } });
  };
  $('#kNew', t).onclick = () => form(null);
  $$('[data-k]', t).forEach(b => b.onclick = () => form(ks.find(k => k.code === b.dataset.k)));
}
