// ===== الإدارة: المستخدمون، سجل الأسعار، سجل التدقيق =====
import { sb, ROLES, q, session, invalidateRef } from './api.js';
import { $, $$, esc, money, dateAr, toast, err, confirm, modal, field, inp, sel, formData } from './ui.js';

export async function mountAdmin(root, tab = 'users') {
  const tabs = [['users', 'المستخدمون'], ['prices', 'سجل الأسعار'], ['audit', 'سجل التدقيق'], ['settings', 'الإعدادات']];
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">الإدارة</h1></div><div class="tabs">${tabs.map(([k, t]) => `<a href="#/admin/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="atab"><p class="muted">…</p></div>`;
  const t = $('#atab');
  if (tab === 'users') users(t); else if (tab === 'prices') prices(t); else if (tab === 'audit') audit(t); else settings(t);
}
async function users(t) {
  const rows = await q(sb.from('profiles').select('*').order('created_at'));
  const pending = rows.filter(r => r.role === 'pending');
  t.innerHTML = `<div class="pcard"><h2><span class="ic"></span>المستخدمون <span class="muted">(${rows.length})</span></h2>
    ${pending.length ? `<div class="notice">يوجد ${pending.length} مستخدم بانتظار الاعتماد — حدد دوره ليتمكن من الدخول.</div>` : ''}
    <p class="muted" style="margin-bottom:10px">كيف ينضم مستخدم جديد: يفتح رابط المنصة ← «إنشاء حساب» بإيميله ← يظهر هنا بحالة «بانتظار الاعتماد» ← تحدد له الدور.</p>
    <table class="lst"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>المسمى</th><th>الجوال</th><th>منذ</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${r.role === 'pending' ? 'hl' : ''}"><td><b>${esc(r.full_name || '—')}</b></td><td class="ltr">${esc(r.email)}</td><td>${sel('role', Object.entries(ROLES), r.role, `data-role="${r.id}" ${r.id === session.user.id ? 'disabled' : ''}`)}</td><td>${esc(r.title || '—')}</td><td class="ltr">${esc(r.phone || '—')}</td><td>${dateAr(r.created_at)}</td><td><button class="btn sm" data-edit="${r.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`;
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
