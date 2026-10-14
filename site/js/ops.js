// ===== المحرّك التشغيلي لإدارة الخدمات الفنية: مركز البلاغات والطلبات، تفاصيل العمل وسلسلته بين الأقسام، النموذج، اللوحة =====
import { sb, q, session, isAdmin, role, canRead } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, dateAr } from './ui.js';
import { govBar, govChip } from './govlink.js';
import { attachBox, mountAttachBox, uploadAttachment } from './attach.js';

export const ST = {
  new: { ar: 'جديد', c: '#7A8794' }, accepted: { ar: 'مستلم', c: '#1B6CA8' }, in_progress: { ar: 'قيد التنفيذ', c: '#27A8DF' },
  on_hold: { ar: 'معلّق', c: '#A98736' }, verify: { ar: 'بانتظار التأكيد', c: '#C99A1E' }, done: { ar: 'مكتمل', c: '#2E8B57' }, cancelled: { ar: 'ملغى', c: '#B5C0CB' },
};
export const OPEN = ['new', 'accepted', 'in_progress', 'on_hold', 'verify'];
export const PR = {
  p1: { ar: 'طارئ', c: '#C0392B', sla: 'استجابة خلال ساعتين ومعالجة مؤقتة فوراً' }, p2: { ar: 'عاجل', c: '#D9772B', sla: 'خلال 24 ساعة' },
  p3: { ar: 'عادي', c: '#1B6CA8', sla: 'خلال 5 أيام عمل' }, p4: { ar: 'مخطط', c: '#6F7F52', sla: 'يُجدول مع الأعمال المخططة' },
};
const SRC = { portal: 'مركز البلاغات', phone: 'بلاغ هاتفي', round: 'جولة ميدانية', ppm: 'صيانة مخططة', item: 'إحالة من قسم آخر', fm: 'متابعة الأنظمة', project: 'مشروع', other: 'أخرى' };
const STAFF_ROLES = ['admin', 'engineer', 'clerk', 'facility', 'tech', 'head'];
export const isOpen = i => OPEN.includes(i.status);
export const isLate = i => isOpen(i) && i.due_at && new Date(i.due_at) < new Date();
const hrs = ms => Math.round(ms / 36e5);
export function dur(ms) { const h = Math.abs(ms) / 36e5; if (h < 1) return Math.max(1, Math.round(h * 60)) + ' دقيقة'; if (h < 48) return Math.round(h) + ' ساعة'; return Math.round(h / 24) + ' يوماً'; }
const ago = d => { if (!d) return ''; const ms = Date.now() - new Date(d).getTime(); return ms < 6e4 ? 'الآن' : 'قبل ' + dur(ms); };
const snip = (t, n = 110) => t && t.length > n ? t.slice(0, n) + '…' : (t || '');
export const me = () => session.profile || {};
// هل المستخدم من فريق القسم؟ (يطابق ops_staff في قاعدة البيانات)
export const staffOf = u => isAdmin() || (STAFF_ROLES.includes(role()) && (me().unit === u || (role() === 'facility' && !me().unit && ['FAC', 'MNT', 'SAF'].includes(u))));
export const myFacs = () => (me().fac_ids || []).map(Number);
export const isStaff = () => STAFF_ROLES.includes(role());
export const canFile = () => canRead() || ['facility', 'tech', 'requester'].includes(role());

// ---------- البيانات
export let O = null;
export async function loadOps() {
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const [kinds, items, fac, people, G, locs] = await Promise.all([
    q(sb.from('ops_kinds').select('*').order('sort')),
    q(sb.from('ops_items').select('*').or(`status.in.(new,accepted,in_progress,on_hold,verify),updated_at.gte.${since}`).order('id', { ascending: false }).limit(2000)),
    q(sb.from('facilities').select('id,name,kind,sort,active').eq('active', true).order('sort').order('name')),
    role() === 'requester' ? Promise.resolve([]) : q(sb.from('profiles').select('id,full_name,role,unit,title,phone').not('role', 'in', '(pending,disabled)')),
    import('./gov.js').then(m => m.govData()),
    q(sb.from('fac_locations').select('*').eq('active', true).order('facility_id').order('sort').order('code')).catch(() => []),
  ]);
  const just = O?.just; O = { just, kinds, K: Object.fromEntries(kinds.map(k => [k.code, k])), items, I: Object.fromEntries(items.map(i => [i.id, i])), fac, F: Object.fromEntries(fac.map(f => [f.id, f])), people, P: Object.fromEntries(people.map(p => [p.id, p])), G, locs, Loc: Object.fromEntries(locs.map(l => [l.id, l])) };
  return O;
}
export const uname = c => O?.G?.U?.[c]?.short || c || '—';
export const ucolor = c => '#' + (O?.G?.U?.[c]?.color || '6B7A88');
export const uchip = c => c ? `<span class="uchip" style="--c:${ucolor(c)}">${esc(uname(c))}</span>` : '';
export const pname = id => O?.P?.[id]?.full_name || '';
export const stPill = s => `<span class="opill" style="--c:${ST[s]?.c || '#999'}">${ST[s]?.ar || s}</span>`;
export const prPill = p => `<span class="oprio ${p}" style="--c:${PR[p]?.c}">${PR[p]?.ar || p}</span>`;
export function slaChip(i) {
  if (i.status === 'cancelled') return '';
  if (!isOpen(i)) { const t = (i.resolved_at || i.closed_at) && i.created_at ? new Date(i.resolved_at || i.closed_at) - new Date(i.created_at) : null; const ok = !i.due_at || new Date(i.resolved_at || i.closed_at) <= new Date(i.due_at);
    return t != null ? `<span class="osla ${ok ? 'ok' : 'bad'}" title="زمن الإنجاز">✓ ${dur(t)}${ok ? '' : ' (بعد المهلة)'}</span>` : ''; }
  if (!i.due_at) return '';
  const ms = new Date(i.due_at) - Date.now();
  return ms < 0 ? `<span class="osla bad" title="تجاوز المهلة">⏱ متأخر ${dur(ms)}</span>` : `<span class="osla ${ms < 6 * 36e5 ? 'warn' : ''}" title="المتبقي من المهلة">⏱ متبقٍ ${dur(ms)}</span>`;
}
const kindOf = i => O.K[i.kind] || { name: i.kind, icon: '•' };
export const LST = { operational: { ar: 'تشغيلية', c: '#2E8B57' }, closed: { ar: 'مغلقة للصيانة', c: '#C0392B' }, restricted: { ar: 'تشغيل مقيد', c: '#C99A1E' }, out: { ar: 'خارج الخدمة', c: '#7A8794' } };
export const locPill = l => l ? `<span class="opill" style="--c:${LST[l.status]?.c}">${LST[l.status]?.ar}</span>` : '';
export const locLabel = l => l ? [l.code, l.name].filter(Boolean).join(' — ') : '';
const fmtDT = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }); };
// العمل التشغيلي النشط (إغلاق نافذ، تصريح جارٍ، تعطيل حريق، إيقاف مخطط) — يراه الجميع لأنه يمس أكثر من قسم
export const activeCritical = () => O.items.filter(i => ['closure', 'permit', 'impair', 'shutdown'].includes(O.K[i.kind]?.effect) && isOpen(i) && i.status !== 'new' || (O.K[i.kind]?.effect === 'shutdown' && ['new', 'accepted'].includes(i.status)));
export function criticalHtml(list) {
  if (!list.length) return '<p class="muted">لا إغلاقات أو تصاريح أو تعطيلات نافذة الآن.</p>';
  const now = Date.now();
  return `<div class="ocrit">${list.map(i => { const k = O.K[i.kind], f = O.F[i.facility_id], fr = i.data?.from, to = i.data?.to, over = to && new Date(to) < now && i.status !== 'done';
    return `<button class="ocrit-i ${over ? 'over' : ''}" data-oi="${i.id}" style="--c:${ucolor(i.unit)}"><span class="oi-k">${k.icon}</span><span><b>${esc(k.short || k.name)}: ${esc(i.title)}</b><small>${esc(f?.name || '')}${i.location ? ' · ' + esc(i.location) : ''}</small><small>${fr ? esc(fmtDT(fr)) : ''}${to ? ' ← ' + esc(fmtDT(to)) : ''}${over ? ' · <em>تجاوز موعد الإعادة</em>' : ''}</small></span>${stPill(i.status)}</button>`; }).join('')}</div>`;
}
const children = id => O.items.filter(x => x.parent_id === id);

// ---------- صف العمل
export function itemRow(i, { showUnit = true } = {}) {
  const k = kindOf(i), f = O.F[i.facility_id], ch = children(i.id), par = i.parent_id ? O.I[i.parent_id] : null;
  const just = O.just && O.just.id === i.id && Date.now() - O.just.at < 5000;
  return `<button class="oi ${isLate(i) ? 'late' : ''} ${i.status} ${just ? 'just' : ''}" data-oi="${i.id}" style="--c:${just ? ST[i.status]?.c : PR[i.priority]?.c}">
    <span class="oi-h"><span class="oi-k" title="${esc(k.name)}">${k.icon}</span><b>${esc(i.title)}</b><small class="oi-ref">${esc(i.ref || '#' + i.id)}</small></span>
    <span class="oi-m">${esc(f?.name || '—')}${i.location ? ' · ' + esc(i.location) : ''}${i.asset ? ' · ' + esc(i.asset) : ''}</span>
    ${isOpen(i) ? `<span class="oi-a">${i.last_action ? `↻ ${esc(snip(i.last_action))} <small>${ago(i.last_action_at)}</small>` : '<span class="muted">لم يُسجَّل إجراء بعد</span>'}</span>` : ''}
    <span class="oi-f">${stPill(i.status)}${prPill(i.priority)}${slaChip(i)}${showUnit ? uchip(i.unit) : ''}${i.assignee_id || i.assignee_name ? `<span class="muted small">👤 ${esc(pname(i.assignee_id) || i.assignee_name)}</span>` : ''}${par ? `<span class="olink" title="محال من ${esc(uname(par.unit))}">↰ ${esc(uname(par.unit))}</span>` : ''}${ch.length ? `<span class="olink" title="أعمال محالة لأقسام أخرى">⇠ ${ch.map(c => esc(uname(c.unit))).join('، ')}</span>` : ''}${i.fm_obs_id ? '<span class="olink">🏥 متابعة الأنظمة</span>' : ''}</span></button>`;
}
export const bindRows = (root, re) => $$('[data-oi]', root).forEach(b => { b.onclick = () => openItem(+b.dataset.oi, re); if (b.tagName !== 'BUTTON') b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(+b.dataset.oi, re); } }; });

// ---------- لوحة كانبان
export function boardHtml(items) {
  const cols = ['new', 'accepted', 'in_progress', 'on_hold', 'verify'];
  return `<div class="oboard">${cols.map(s => { const l = items.filter(i => i.status === s).sort((a, b) => a.priority.localeCompare(b.priority) || isLate(b) - isLate(a)); return `<section class="obcol" data-st="${s}" style="--c:${ST[s].c}"><h3>${ST[s].ar} <span>${l.length}</span></h3><div>${l.map(i => itemRow(i).replace(/^\s*<button /, '<div role="button" tabindex="0" ').replace(/<\/button>\s*$/, '</div>')).join('') || '<p class="muted small">—</p>'}</div></section>`; }).join('')}</div>`;
}

// ---------- طلب المعالجة أو الإجراء المتخذ (إلزامي مع كل تحديث)
export async function askAction(title, label = 'المعالجة أو الإجراء المتخذ *', hint = 'اكتب ما تم فعلاً: من قام بماذا، وما النتيجة، وما التالي.', extra = '') {
  return modal(`<form id="af"><p class="muted small m0">${esc(hint)}</p>${extra}<label class="fld mt8"><span>${esc(label)}</span><textarea name="a" rows="3" required minlength="6"></textarea></label><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`,
    { title, onOpen: (w, c) => { const f = $('#af', w); f.a.focus(); f.onsubmit = e => { e.preventDefault(); const v = f.a.value.trim(); if (v.length < 6) return toast('اكتب الإجراء بوضوح', 'bad'); const x = formData(f); c({ ...x, a: v }); }; } });
}

// ---------- كتالوج الطلبات: «ماذا تحتاج؟»
export const catalogHtml = (only, staffKinds = false) => {
  const ks = O.kinds.filter(k => k.active !== false && (k.intake || (staffKinds && isStaff())) && (!only || only.includes(k.unit))).sort((a, b) => b.intake - a.intake || a.sort - b.sort);
  return `<div class="ocat">${ks.map(k => `<button class="ocard" data-kind="${k.code}" style="--c:${ucolor(k.unit)}"><span class="ocard-i">${k.icon}</span><b>${esc(k.name)}</b><small>${esc(k.descr)}</small><span class="ocard-f">${uchip(k.unit)}${k.proc ? `<span class="muted small">📘 ${esc(k.proc)}</span>` : ''}</span></button>`).join('')}</div>`;
};
export async function pickKind(title = 'ماذا تحتاج؟', exclude) {
  return modal(`<p class="muted small m0">اختر نوع الطلب؛ يصل مباشرة إلى القسم المختص ويُعالج وفق إجرائه في الدليل.</p>${catalogHtml(exclude ? Object.keys(O.G.U).filter(u => u !== exclude) : null, true)}`,
    { title, wide: true, onOpen: (w, c) => $$('[data-kind]', w).forEach(b => b.onclick = () => c(b.dataset.kind)) });
}

// ---------- نموذج بلاغ أو طلب أو عمل
function fieldHtml(f, v) {
  const name = 'd_' + f.k, req = f.req ? 'required' : '';
  const ctl = f.t === 'datetime-local' && v ? inp(name, String(v).slice(0, 16), `type="datetime-local" ${req}`) : f.t === 'select' ? sel(name, [['', '—'], ...(f.o || [])], v ?? '', req) : f.t === 'textarea' ? `<textarea name="${name}" rows="2" ${req}>${esc(v ?? '')}</textarea>` : inp(name, v ?? '', `type="${f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'datetime-local' ? 'datetime-local' : 'text'}" ${req}`);
  return field(f.l + (f.req ? ' *' : ''), ctl, f.t === 'textarea' ? 'wide' : '');
}
// الأولوية المقترحة من أثر البلاغ (R-17)
function suggestPrio(kind, d) {
  const v = Object.values(d).join(' ');
  if (/خطر على السلامة|متوقف ولا يوجد بديل/.test(v) || (kind === 'saf' && d.injury === 'نعم')) return 'p1';
  if (/يوقف غرفة|متوقف ويوجد بديل|نظام سريري/.test(v) || d.patient === 'نعم') return 'p2';
  return null;
}
export async function newItem(preset = {}, done) {
  if (!O) await loadOps();
  let kind = preset.kind;
  if (!kind) { kind = await pickKind(preset.parent_id ? 'إحالة إلى قسم آخر — اختر نوع العمل' : 'ماذا تحتاج؟', preset.parent_id ? O.I[preset.parent_id]?.unit : null); if (!kind) return; }
  const k = O.K[kind]; if (!k) return toast('نوع غير معروف', 'bad');
  const v = { priority: k.prio || 'p3', facility_id: me().facility_id || '', ...preset };
  const staff = isStaff();
  const par = v.parent_id ? O.I[v.parent_id] : null;
  const fields = Array.isArray(k.fields) ? k.fields : [];
  await modal(`<form id="f" class="pgrid">
    <div class="okhead wide" style="--c:${ucolor(k.unit)}"><span class="ocard-i">${k.icon}</span><div><b>${esc(k.name)}</b><small>${esc(k.descr)}</small></div><span class="sp"></span>${uchip(k.unit)}${k.proc ? govChip(k.proc, 'يُعالج وفق') : ''}</div>
    ${par ? `<div class="notice wide">إحالة من <b>${esc(par.ref)}</b> — ${esc(par.title)} (${esc(uname(par.unit))}). يُربط العملان وتصل حالة هذا العمل إلى فريق ${esc(uname(par.unit))}.</div>` : ''}
    ${field('المنشأة *', sel('facility_id', [['', '— اختر —'], ...O.fac.map(f => [f.id, f.name])], v.facility_id || '', 'required'))}
    ${field('الموقع: الغرفة أو المنطقة' + (k.effect === 'closure' ? ' *' : ''), inp('location', v.location || (v.location_id ? locLabel(O.Loc[v.location_id]) : ''), `list="locList" autocomplete="off" placeholder="اكتب رقم الغرفة أو اسمها، أو وصف الموقع" ${k.effect === 'closure' ? 'required' : ''}`) + '<datalist id="locList"></datalist><small class="muted" id="locHint"></small>')}
    ${field('العنوان *', inp('title', v.title || '', 'required placeholder="وصف مختصر للمشكلة أو الطلب"'), 'wide')}
    ${fields.map(f => fieldHtml(f, v.data?.[f.k])).join('')}
    ${field('التفاصيل', `<textarea name="details" rows="3" placeholder="ماذا حدث؟ متى؟ ما الأثر؟">${esc(v.details || '')}</textarea>`, 'wide')}
    ${field('الأصل أو الجهاز (إن وجد)', inp('asset', v.asset || '', 'list="assetList" autocomplete="off" placeholder="رمز الأصل أو اسمه"') + '<datalist id="assetList"></datalist><small class="muted" id="assetHint"></small>')}
    <div class="fld"><span>الصور والمرفقات</span><input type="file" name="files" multiple accept="image/*,.pdf"></div>
    <div class="fld wide"><span>الأولوية <small class="muted" id="psug"></small></span><div class="oprioseg">${Object.entries(PR).map(([p, x]) => `<label style="--c:${x.c}"><input type="radio" name="priority" value="${p}" ${v.priority === p ? 'checked' : ''}><b>${x.ar}</b><small>${x.sla}</small></label>`).join('')}</div></div>
    ${staff && !par ? `<details class="wide"><summary class="small">إدخال نيابة عن متصل (بلاغ هاتفي)</summary><div class="pgrid mt8">${field('اسم مقدّم البلاغ', inp('requester_name', v.requester_name || ''))}${field('جواله', inp('requester_phone', v.requester_phone || '', 'dir="ltr"'))}</div></details>` : ''}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${par ? 'إرسال الإحالة' : 'إرسال'}</button></div></form>`,
    { title: par ? 'إحالة إلى قسم آخر' : 'بلاغ أو طلب جديد', wide: true, onOpen: (w, close) => {
      const form = $('#f', w);
      const sug = () => { const d = {}; fields.forEach(f => d[f.k] = form['d_' + f.k]?.value || ''); const p = suggestPrio(kind, d); $('#psug', w).innerHTML = p ? `المقترح من الأثر: <a href="#" data-p="${p}">${PR[p].ar}</a>` : ''; const a = $('[data-p]', w); if (a) a.onclick = e => { e.preventDefault(); form.querySelector(`[name=priority][value=${p}]`).checked = true; }; };
      fields.forEach(f => form['d_' + f.k] && (form['d_' + f.k].onchange = sug)); sug();
      const locsOf = () => O.locs.filter(l => l.facility_id === +form.facility_id.value);
      const fillLoc = () => { const L = locsOf(); $('#locList', w).innerHTML = L.map(l => `<option value="${esc(locLabel(l))}">${esc([l.building, l.floor, LST[l.status]?.ar].filter(Boolean).join(' · '))}</option>`).join(''); $('#locHint', w).textContent = L.length ? `${L.length} موقعاً مسجلاً في هذه المنشأة — اختر من القائمة ليُربط العمل بسجل الموقع (R-16)` : (form.facility_id.value ? 'لا مواقع مسجلة لهذه المنشأة بعد؛ اكتب وصف الموقع' : ''); };
      let AS = [];
      const fillAssets = async () => { const fid = +form.facility_id.value; if (!fid || role() === 'requester') { AS = []; return; } try { AS = await q(sb.from('assets').select('id,code,name,unit,location_id,status').eq('facility_id', fid).eq('active', true).order('code').limit(800)); } catch (e) { AS = []; }
        const mineU = AS.filter(a => a.unit === k.unit), list = mineU.length ? mineU : AS; $('#assetList', w).innerHTML = list.map(a => `<option value="${esc(a.code)}">${esc(a.name)}</option>`).join(''); $('#assetHint', w).textContent = list.length ? `${list.length} أصلاً مسجلاً — اختر الرمز ليُربط العمل بتاريخ الأصل` : ''; };
      form.facility_id.onchange = () => { fillLoc(); fillAssets(); }; fillLoc(); fillAssets();
      if (v.asset_id && !v.asset) q(sb.from('assets').select('code').eq('id', v.asset_id).maybeSingle()).then(a => { if (a) form.asset.value = a.code; }).catch(() => {});
      form.onsubmit = async e => { e.preventDefault(); const x = formData(form); const data = {}; fields.forEach(f => { if (x['d_' + f.k] !== '' && x['d_' + f.k] != null) data[f.k] = f.t === 'number' ? +x['d_' + f.k] : x['d_' + f.k]; });
        const phone = staff && (x.requester_name || '').trim();
        const loc = locsOf().find(l => locLabel(l) === x.location.trim() || l.code === x.location.trim());
        if (k.effect === 'closure' && !loc && locsOf().length) return toast('اختر الموقع من سجل مواقع المنشأة حتى تُحدَّث حالته عند الإغلاق والفتح', 'bad');
        const ast = AS.find(a => a.code === (x.asset || '').trim()) || (v.asset_id ? { id: v.asset_id } : null);
        const row = { kind, unit: k.unit, facility_id: +x.facility_id, location: loc ? locLabel(loc) : x.location.trim(), location_id: loc?.id || (ast?.location_id ?? null), asset_id: ast?.id || null, asset: (x.asset || '').trim(), title: x.title.trim(), details: x.details.trim(), priority: x.priority || 'p3', data,
          source: par ? 'item' : phone ? 'phone' : (v.source || 'portal'), parent_id: v.parent_id || null, fm_obs_id: v.fm_obs_id || null, project_id: v.project_id || null,
          ...(phone ? { requester_name: x.requester_name.trim(), requester_phone: (x.requester_phone || '').trim() } : {}), ...(v.last_action ? { last_action: v.last_action } : {}), created_by: session.user.id };
        const btn = form.querySelector('.btn.primary'); btn.disabled = true;
        try {
          const r = await q(sb.from('ops_items').insert(row).select('*').single());
          const files = [...(form.files?.files || [])]; for (const fl of files) { try { await uploadAttachment(fl, 'ops:' + r.id); } catch (e2) { err(e2); } }
          toast(`أُرسل ${r.ref || ''} إلى ${uname(r.unit)}`); close(); await loadOps(); done && done(r);
        } catch (e2) { err(e2); btn.disabled = false; } };
    } });
}

// ---------- تفاصيل العمل وسلسلته بين الأقسام
export async function openItem(id, re) {
  if (!O) await loadOps();
  let i = O.I[id] || await q(sb.from('ops_items').select('*').eq('id', id).maybeSingle());
  if (!i) return toast('العمل غير موجود أو لا تملك صلاحية عرضه', 'bad');
  const [log, kids, parent, obs] = await Promise.all([
    q(sb.from('ops_log').select('*').eq('item_id', id).order('id')),
    q(sb.from('ops_items').select('*').eq('parent_id', id).order('id')),
    i.parent_id ? q(sb.from('ops_items').select('*').eq('id', i.parent_id).maybeSingle()) : null,
    i.fm_obs_id && canRead() || (i.fm_obs_id && ['facility', 'tech'].includes(role())) ? q(sb.from('fm_obs').select('id,title,status,facility_id').eq('id', i.fm_obs_id).maybeSingle()).catch(() => null) : null,
  ]);
  const k = kindOf(i), f = O.F[i.facility_id], P = O.G.P[i.proc], n = P?.steps?.length || 0;
  const staff = staffOf(i.unit) || staffOf('FAC') || i.assignee_id === session.user.id, owner = staffOf(i.unit) || i.assignee_id === session.user.id;
  const mineReq = i.requester_id === session.user.id || i.created_by === session.user.id;
  const open = isOpen(i);
  const flow = { new: [['accepted', 'استلام', 'primary']], accepted: [['in_progress', 'بدء التنفيذ', 'primary'], ['on_hold', 'تعليق']], in_progress: [['verify', 'أُنجز — بانتظار تأكيد صاحب الطلب', 'primary'], ['done', 'إغلاق مباشر'], ['on_hold', 'تعليق']], on_hold: [['in_progress', 'استئناف', 'primary']], verify: [['done', 'إغلاق', 'primary'], ['in_progress', 'إعادة للتنفيذ']], done: [['in_progress', 'إعادة فتح']], cancelled: [['new', 'إعادة فتح']] }[i.status] || [];
  const dataKv = [...(Array.isArray(k.fields) ? k.fields : []), ...(Array.isArray(k.close_fields) ? k.close_fields : [])].filter(x => i.data?.[x.k] != null && i.data[x.k] !== '').map(x => [x.l, esc(x.t === 'datetime-local' ? fmtDT(i.data[x.k]) : String(i.data[x.k]))]);
  const loc = i.location_id ? O.Loc[i.location_id] : null;
  const gates = Array.isArray(k.gates) ? k.gates : [], checks = [...(Array.isArray(k.checklist) ? k.checklist : []), ...(Array.isArray(i.data?.plan_check) ? i.data.plan_check : [])];
  const ast = i.asset_id ? await q(sb.from('assets').select('id,code,name,unit,status').eq('id', i.asset_id).maybeSingle()).catch(() => null) : null;
  const gHtml = gates.length ? `<h3 class="sub-h">الاعتمادات المطلوبة من الأقسام</h3><div class="ogates">${gates.map(g => { const a = i.data?.gates?.[g.k];
      return `<div class="ogate ${a ? 'ok' : ''}" style="--c:${ucolor(g.unit)}"><span class="ogate-i">${a ? '✓' : '⏳'}</span><div><b>${esc(g.l)}</b><small>${uchip(g.unit)} ${a ? `${esc(a.name || '')} · ${fmtDT(a.at)}${a.note ? ' — ' + esc(a.note) : ''}` : `مطلوب قبل «${ST[g.before]?.ar || g.before}»`}</small></div>${!a && staffOf(g.unit) && isOpen(i) ? `<button class="btn sm primary" data-gate="${g.k}">اعتماد</button>` : ''}</div>`; }).join('')}</div>` : '';
  const done = checks.filter(c => i.data?.check?.[c.k]).length;
  const cHtml = checks.length ? `<h3 class="sub-h">قائمة التحقق قبل الإغلاق <small class="muted">(${done}/${checks.length})</small></h3><div class="ocheck">${checks.map(c => `<label class="${i.data?.check?.[c.k] ? 'on' : ''}"><input type="checkbox" data-chk="${c.k}" ${i.data?.check?.[c.k] ? 'checked' : ''} ${owner && isOpen(i) ? '' : 'disabled'}> ${esc(c.l)}</label>`).join('')}</div>` : '';
  const chainRow = (x, rel) => `<button type="button" class="ochain-i" data-oi="${x.id}" style="--c:${ucolor(x.unit)}"><span class="ochain-r">${rel}</span>${uchip(x.unit)}<b>${esc(x.title)}</b><small class="oi-ref">${esc(x.ref || '')}</small>${stPill(x.status)}${x.last_action ? `<small class="muted">↻ ${esc(snip(x.last_action, 70))}</small>` : ''}</button>`;
  const chain = [parent ? chainRow(parent, '↰ محال من') : '', ...kids.map(c => chainRow(c, '⇠ أُحيل إلى')), obs ? `<a class="ochain-i" href="#/fm/obs?id=${obs.id}" style="--c:#2E8B57"><span class="ochain-r">🏥 من متابعة الأنظمة</span><b>#${obs.id} ${esc(obs.title)}</b></a>` : '', i.project_id ? `<a class="ochain-i" href="#/project/${i.project_id}" style="--c:#27A8DF"><span class="ochain-r">📐 مشروع مرتبط</span><b>فتح المشروع</b></a>` : ''].filter(Boolean);
  const people = O.people.filter(p => p.unit === i.unit || (p.role === 'facility' && !p.unit && ['FAC', 'MNT', 'SAF'].includes(i.unit)) || p.id === i.assignee_id);
  const changed = { v: false };
  await modal(`${i.proc ? govBar([i.proc, i.status === 'done' ? 'done' : (i.step || 1)], ST[i.status]?.ar) : ''}
    <div class="ohead" style="--c:${PR[i.priority]?.c}"><span class="oi-k big">${k.icon}</span><div><b>${esc(i.title)}</b><span class="muted">${esc(i.ref || '')} · ${esc(k.name)} · ${esc(f?.name || '—')}${i.location ? ' · ' + esc(i.location) : ''}</span></div><span class="sp"></span>${stPill(i.status)}${prPill(i.priority)}</div>
    <div class="oi-f mb8">${uchip(i.unit)}${ast ? `<a class="olink" href="#/dept/${ast.unit}/assets?a=${ast.id}">🏷️ ${esc(ast.code)} — ${esc(ast.name)}${ast.status === 'down' ? ' (متعطل)' : ''}</a>` : ''}${i.plan_id ? '<span class="olink">🗓️ عمل مخطط دوري</span>' : ''}${loc ? `<span class="small">📍 ${esc(locLabel(loc))}</span>${locPill(loc)}` : ''}${slaChip(i)}${i.due_at && open ? `<span class="muted small">المهلة: ${new Date(i.due_at).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}</span>` : ''}</div>
    ${i.details ? `<p class="pre">${esc(i.details)}</p>` : ''}
    <div class="fmlast ${open && i.last_action_at && Date.now() - new Date(i.last_action_at) > 3 * 864e5 ? 'stale' : ''}"><span>آخر إجراء متخذ</span>${i.last_action ? `<p>${esc(i.last_action)}</p><small>${pname(i.last_action_by) ? esc(pname(i.last_action_by)) + ' · ' : ''}${ago(i.last_action_at)}</small>` : '<p class="muted">لم يُسجَّل أي إجراء بعد.</p>'}</div>
    <div class="kvs">${[...dataKv, ['رقم الأصل', esc(i.asset || '—')], ['المكلّف', esc(pname(i.assignee_id) || i.assignee_name || '—')], ['مقدّم الطلب', esc(pname(i.requester_id) || i.requester_name || pname(i.created_by) || '—') + (i.requester_phone ? ` <span class="ltr">${esc(i.requester_phone)}</span>` : '')], ['المصدر', SRC[i.source] || '—'], ['أُنشئ', dateAr(i.created_at)], ...(i.closed_at ? [[i.status === 'cancelled' ? 'أُلغي' : 'أُغلق', dateAr(i.closed_at)]] : []), ...(i.rating ? [['تقييم صاحب الطلب', '★'.repeat(i.rating) + '☆'.repeat(5 - i.rating) + (i.feedback ? ' — ' + esc(i.feedback) : '')]] : [])].map(([a, b]) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`).join('')}</div>
    ${gHtml}${cHtml}
    ${chain.length ? `<h3 class="sub-h">سلسلة العمل بين الأقسام</h3><div class="ochain">${chain.join('')}</div>` : ''}
    ${owner && P && open ? `<div class="fmstep"><label class="fld"><span>الخطوة الحالية في ${esc(i.proc)}</span><select id="oStep">${P.steps.map((x, j) => `<option value="${j + 1}" ${i.step === j + 1 ? 'selected' : ''}>${j + 1}. ${esc(uname(x.unit))}: ${esc(x.action.slice(0, 90))}</option>`).join('')}</select></label>${(i.step || 1) < n ? '<button class="btn sm" id="oAdv">✓ أُنجزت الخطوة ← التالية</button>' : ''}</div>` : ''}
    <div class="btnrow wrap mt8">
      ${owner ? flow.map(([s, l, c]) => `<button class="btn ${c || ''}" data-to="${s}">${l}</button>`).join('') : ''}
      ${owner && open ? '<button class="btn" id="oAssign">تكليف</button><button class="btn" id="oPrio">الأولوية</button>' : ''}
      ${staff && open ? '<button class="btn" id="oRoute">إعادة توجيه</button>' : ''}
      ${(owner || staff) && open ? '<button class="btn" id="oSpawn">⇠ إحالة جزء لقسم آخر</button>' : ''}
      ${owner && open && i.unit !== 'PRJ' ? '<button class="btn" id="oPrj" title="R-01: إذا تجاوز حدود الصيانة">📐 تحويل إلى مشروع</button>' : ''}
      ${owner && i.unit === 'PRJ' && canRead() ? '<button class="btn" id="oLinkP">ربط بمشروع</button>' : ''}
      ${!owner && mineReq && i.status === 'verify' ? '<button class="btn primary" id="rOk">✓ تأكيد المعالجة</button><button class="btn" id="rNo">لم تُعالج</button>' : ''}
      ${!owner && mineReq && i.status === 'new' ? '<button class="btn danger" id="rCancel">إلغاء طلبي</button>' : ''}
      ${mineReq && i.status === 'done' && !i.rating ? '<button class="btn" id="rRate">★ قيّم الخدمة</button>' : ''}
      ${owner && i.status === 'new' ? '<button class="btn ghost" data-to="cancelled">إلغاء</button>' : ''}
      ${isAdmin() ? '<button class="btn ghost" id="oDel" style="color:#A6503B">حذف</button>' : ''}
    </div>
    ${attachBox('الصور والمرفقات')}
    <h3 class="sub-h">السجل والمتابعة</h3><div class="fmlog">${log.length ? log.map(l => `<div class="fml ${l.kind}"><b>${esc(pname(l.by_user) || (l.kind === 'note' ? '—' : l.kind === 'handoff' ? 'إحالة' : 'تحديث'))}</b><span class="muted small">${dateAr(l.at)} ${new Date(l.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</span><p>${esc(l.body)}</p></div>`).join('') : '<p class="muted small">لا سجل بعد.</p>'}</div>
    <div class="fmlogadd"><textarea id="oNote" rows="2" placeholder="أضف متابعة: ما تم، وما التالي… (تُسجَّل كآخر إجراء متخذ)"></textarea><button class="btn primary" id="oAdd">إضافة</button></div>`,
    { title: `${k.name} — ${i.ref || ''}`, wide: true, onOpen: (w, close) => {
      mountAttachBox(w, 'ops:' + i.id, { canAdd: true });
      const reopen = async () => { changed.v = true; await loadOps(); close(); openItem(i.id, re); };
      const upd = async patch => { try { await q(sb.from('ops_items').update(patch).eq('id', i.id)); O.just = { id: i.id, at: Date.now() }; await reopen(); } catch (e) { err(e); } };
      $$('[data-oi]', w).forEach(b => b.onclick = () => { close(); openItem(+b.dataset.oi, re); });
      $$('a[href^="#/"]:not([data-peek])', w).forEach(a => a.addEventListener('click', () => close()));
      $$('[data-gate]', w).forEach(b => b.onclick = async () => { const g = gates.find(x => x.k === b.dataset.gate);
        const r = await modal(`<form id="gf"><p class="m0">${esc(g.l)}</p><p class="muted small">يُسجَّل الاعتماد باسمك ووقته في سجل العمل، ويصل إشعار لفريق ${esc(uname(i.unit))}.</p>${field('ملاحظة أو اشتراطات (اختياري)', '<textarea name="n" rows="2"></textarea>')}<div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">اعتماد</button></div></form>`, { title: 'اعتماد', onOpen: (w2, c) => { $('#gf', w2).onsubmit = e => { e.preventDefault(); c(formData(e.target)); }; } });
        if (!r) return; try { const { error } = await sb.rpc('ops_gate', { p_id: i.id, p_key: g.k, p_note: (r.n || '').trim() }); if (error) throw error; toast('اعتُمد'); await reopen(); } catch (e) { err(e); } });
      $$('[data-chk]', w).forEach(c => c.onchange = async () => { try { const cur = (await q(sb.from('ops_items').select('data').eq('id', i.id).single()))?.data || i.data || {}; const ck = { ...(cur.check || {}), [c.dataset.chk]: c.checked }; await q(sb.from('ops_items').update({ data: { ...cur, check: ck } }).eq('id', i.id)); i.data = { ...cur, check: ck }; c.closest('label').classList.toggle('on', c.checked); changed.v = true; } catch (e) { err(e); c.checked = !c.checked; } });
      $$('[data-to]', w).forEach(b => b.onclick = async () => {
        const to = b.dataset.to, lab = { accepted: 'ملاحظة الاستلام (مثل: موعد الزيارة أو المكلّف) *', in_progress: i.status === 'done' || i.status === 'cancelled' ? 'سبب إعادة الفتح *' : 'ما الذي بدأ؟ *', on_hold: 'سبب التعليق (قطعة غيار، مقاول، اعتماد…) *', verify: 'ما الذي أُنجز؟ (يصل لصاحب الطلب ليؤكده) *', done: 'المعالجة النهائية *', cancelled: 'سبب الإلغاء *' }[to];
        const cf = ['verify', 'done'].includes(to) && Array.isArray(k.close_fields) ? k.close_fields : [];
        const a = await askAction(ST[to].ar, lab, undefined, cf.length ? `<div class="pgrid mt8">${cf.map(f => fieldHtml(f, i.data?.[f.k])).join('')}</div>` : ''); if (!a) return;
        const cd = {}; cf.forEach(f => { const val = a['d_' + f.k]; if (val !== '' && val != null) cd[f.k] = f.t === 'number' ? +val : val; });
        const miss = cf.filter(f => f.req && (cd[f.k] == null || cd[f.k] === '')); if (miss.length) return toast('أكمل: ' + miss.map(f => f.l).join('، '), 'bad');
        upd({ status: to, last_action: a.a, ...(cf.length ? { data: { ...((await q(sb.from('ops_items').select('data').eq('id', i.id).single()))?.data || i.data || {}), ...cd } } : {}), ...(to === 'done' && n ? { step: n } : {}), ...(to === 'accepted' && !i.assignee_id && !i.assignee_name && isStaff() ? { assignee_id: session.user.id } : {}) });
      });
      $('#oStep', w) && ($('#oStep', w).onchange = async e => { const to = +e.target.value; const a = await askAction(`الانتقال إلى الخطوة ${to}`); if (!a) { e.target.value = i.step || 1; return; } upd({ step: to, last_action: a.a, ...(i.status === 'new' || i.status === 'accepted' ? { status: 'in_progress' } : {}) }); });
      $('#oAdv', w) && ($('#oAdv', w).onclick = async () => { const a = await askAction(`إنجاز الخطوة ${i.step || 1}`, 'ما الذي أُنجز في هذه الخطوة؟ *'); if (!a) return; upd({ step: (i.step || 1) + 1, last_action: a.a, ...(i.status === 'new' || i.status === 'accepted' ? { status: 'in_progress' } : {}) }); });
      $('#oAssign', w) && ($('#oAssign', w).onclick = async () => {
        const r = await modal(`<form id="as" class="pgrid">${field('من فريق ' + esc(uname(i.unit)), sel('assignee_id', [['', '—'], ...people.map(p => [p.id, p.full_name + (p.title ? ' — ' + p.title : '')])], i.assignee_id || ''), 'wide')}${field('أو اسم (مقاول أو فني بلا حساب)', inp('assignee_name', i.assignee_name || ''), 'wide')}<div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تكليف', onOpen: (w2, c) => { $('#as', w2).onsubmit = e => { e.preventDefault(); c(formData(e.target)); }; } });
        if (r) upd({ assignee_id: r.assignee_id || null, assignee_name: (r.assignee_name || '').trim() });
      });
      $('#oPrio', w) && ($('#oPrio', w).onclick = async () => {
        const r = await modal(`<form id="pp"><div class="oprioseg">${Object.entries(PR).map(([p, x]) => `<label style="--c:${x.c}"><input type="radio" name="p" value="${p}" ${i.priority === p ? 'checked' : ''}><b>${x.ar}</b><small>${x.sla}</small></label>`).join('')}</div><p class="muted small">تتغير المهلة تلقائياً بحسب الأولوية (R-17: الأولوية بأثر البلاغ لا بمن رفعه).</p><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'الأولوية', onOpen: (w2, c) => { $('#pp', w2).onsubmit = e => { e.preventDefault(); c(formData(e.target).p); }; } });
        if (r && r !== i.priority) upd({ priority: r });
      });
      $('#oRoute', w) && ($('#oRoute', w).onclick = async () => {
        const kd = await pickKind('إعادة توجيه — إلى أي قسم ونوع؟', i.unit); if (!kd) return;
        const a = await askAction('إعادة توجيه إلى ' + uname(O.K[kd].unit), 'سبب إعادة التوجيه *', 'يُنقل العمل بالكامل إلى القسم الآخر ويبدأ إجراءه من الخطوة الأولى. للإحالة الجزئية استخدم «إحالة جزء لقسم آخر».'); if (!a) return;
        upd({ kind: kd, unit: O.K[kd].unit, proc: O.K[kd].proc || '', step: O.K[kd].proc ? 1 : null, status: 'new', assignee_id: null, assignee_name: '', last_action: a.a });
      });
      $('#oSpawn', w) && ($('#oSpawn', w).onclick = () => { close(); newItem({ parent_id: i.id, facility_id: i.facility_id, location: i.location, asset: i.asset, title: '', source: 'item' }, () => openItem(i.id, re)); });
      $('#oPrj', w) && ($('#oPrj', w).onclick = async () => { close(); newItem({ kind: 'prj', parent_id: i.id, facility_id: i.facility_id, location: i.location, title: i.title, details: i.details, source: 'item' }, () => openItem(i.id, re)); });
      $('#oLinkP', w) && ($('#oLinkP', w).onclick = async () => {
        const ps = await q(sb.from('projects').select('id,name,stage').eq('archived', false).order('name'));
        const r = await modal(`<form id="lp">${field('المشروع', sel('p', [['', '—'], ...ps.map(p => [p.id, p.name])], i.project_id || ''))}<p class="muted small">لتسجيل مشروع جديد: افتح <a href="#/projects">المشاريع</a> ← مشروع جديد، ثم اربطه هنا.</p><div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">ربط</button></div></form>`, { title: 'ربط بمشروع', onOpen: (w2, c) => { $('#lp', w2).onsubmit = e => { e.preventDefault(); c(formData(e.target)); }; } });
        if (r) upd({ project_id: r.p || null });
      });
      const rate = async (to) => {
        const r = await modal(`<form id="rt"><p class="m0">${to === 'done' ? 'هل عولج طلبك كما يجب؟ قيّم الخدمة:' : 'قيّم الخدمة:'}</p><div class="ostars">${[5, 4, 3, 2, 1].map(s => `<label><input type="radio" name="rating" value="${s}" ${s === 5 ? 'checked' : ''}><span>${'★'.repeat(s)}</span></label>`).join('')}</div>${field('ملاحظة (اختياري)', inp('feedback', ''))}<div class="btnrow end"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${to === 'done' ? 'تأكيد وإغلاق' : 'إرسال'}</button></div></form>`, { title: 'تأكيد المعالجة', onOpen: (w2, c) => { $('#rt', w2).onsubmit = e => { e.preventDefault(); c(formData(e.target)); }; } });
        if (!r) return;
        upd({ ...(to ? { status: to, last_action: `أكّد صاحب الطلب المعالجة${r.feedback ? ': ' + r.feedback.trim() : ''}` } : {}), rating: +r.rating, feedback: (r.feedback || '').trim() });
      };
      $('#rOk', w) && ($('#rOk', w).onclick = () => rate('done'));
      $('#rRate', w) && ($('#rRate', w).onclick = () => rate(null));
      $('#rNo', w) && ($('#rNo', w).onclick = async () => { const a = await askAction('لم تُعالج المشكلة', 'ما الذي ما زال قائماً؟ *'); if (a) upd({ status: 'in_progress', last_action: 'أفاد صاحب الطلب أنها لم تُعالج: ' + a.a }); });
      $('#rCancel', w) && ($('#rCancel', w).onclick = async () => { const a = await askAction('إلغاء الطلب', 'سبب الإلغاء *'); if (a) upd({ status: 'cancelled', last_action: a.a }); });
      $('#oDel', w) && ($('#oDel', w).onclick = async () => { if (!await confirm('حذف العمل وسجله نهائياً؟', 'حذف', true)) return; try { await q(sb.from('ops_items').delete().eq('id', i.id)); toast('حُذف'); changed.v = true; close(); await loadOps(); re && re(); } catch (e) { err(e); } });
      $('#oAdd', w).onclick = async () => { const b = $('#oNote', w).value.trim(); if (!b) return; try { await q(sb.from('ops_log').insert({ item_id: i.id, body: b, by_user: session.user.id, kind: 'note' })); await reopen(); } catch (e) { err(e); } };
      w.addEventListener('click', e => { if ((e.target === w || e.target.hasAttribute('data-x')) && changed.v && re) re(); });
    } });
}

// ---------- قائمة بمرشحات (تُستخدم في المركز وفي صفحة القسم)
export function listView(t, items, { params = new URLSearchParams(), showUnit = true, re, units = true } = {}) {
  const st = { q: params.get('q') || '', u: params.get('u') || '', f: params.get('f') || '', s: params.get('s') || 'open', p: '', who: params.get('who') || (role() === 'facility' && myFacs().length ? 'fac' : ''), late: params.get('late') === '1', view: params.get('v') || (() => { try { return sessionStorage.getItem('ops_view') || 'list'; } catch (e) { return 'list'; } })() };
  t.innerHTML = `<div class="filters ofilt"><input id="lq" placeholder="بحث بالعنوان أو الرقم أو الموقع…" value="${esc(st.q)}">
    ${units ? sel('lu', [['', 'كل الأقسام'], ...O.G.units.filter(u => u.kind === 'unit').map(u => [u.code, u.short])], st.u) : ''}
    ${sel('lf', [['', 'كل المنشآت'], ...O.fac.map(f => [f.id, f.name])], st.f)}
    ${sel('ls', [['open', 'المفتوحة'], ['', 'الكل'], ...Object.entries(ST).map(([k, v]) => [k, v.ar])], st.s)}
    ${sel('lp', [['', 'كل الأولويات'], ...Object.entries(PR).map(([k, v]) => [k, v.ar])], '')}
    ${sel('lw', [['', 'الجميع'], ['me', 'المكلّف بها أنا'], ['mine', 'رفعتها أنا'], ...(myFacs().length ? [['fac', 'منشآتي']] : [])], st.who)}
    <label class="chk"><input type="checkbox" id="ll" ${st.late ? 'checked' : ''}> المتأخرة فقط</label><span class="sp"></span>
    <div class="oview"><button data-v="list" class="${st.view === 'list' ? 'on' : ''}">قائمة</button><button data-v="board" class="${st.view === 'board' ? 'on' : ''}">لوحة</button></div></div><div class="ostats" id="lS"></div><div id="lL"></div>`;
  const render = () => {
    const nq = st.q.toLowerCase();
    let l = items.filter(i => (!st.u || i.unit === st.u) && (!st.f || i.facility_id === +st.f) && (st.s === 'open' ? isOpen(i) : !st.s || i.status === st.s) && (!st.p || i.priority === st.p)
      && (!st.who || (st.who === 'me' ? i.assignee_id === session.user.id : st.who === 'fac' ? myFacs().includes(i.facility_id) : (i.created_by === session.user.id || i.requester_id === session.user.id))) && (!st.late || isLate(i))
      && (!nq || `${i.title} ${i.ref} ${i.location} ${i.asset} ${i.details} ${O.F[i.facility_id]?.name || ''}`.toLowerCase().includes(nq)));
    l.sort((a, b) => isOpen(b) - isOpen(a) || isLate(b) - isLate(a) || a.priority.localeCompare(b.priority) || b.id - a.id);
    const base = items.filter(i => (!st.u || i.unit === st.u) && (!st.f || i.facility_id === +st.f));
    $('#lS', t).innerHTML = ['new', 'accepted', 'in_progress', 'on_hold', 'verify'].map(s => `<span style="--c:${ST[s].c}"><b>${base.filter(i => i.status === s).length}</b>${ST[s].ar}</span>`).join('') + `<span style="--c:#C0392B"><b>${base.filter(isLate).length}</b>متأخرة</span><span style="--c:#2E8B57"><b>${base.filter(i => i.status === 'done' && i.closed_at && i.closed_at.slice(0, 7) === new Date().toISOString().slice(0, 7)).length}</b>أُنجزت هذا الشهر</span>`;
    $('#lL', t).innerHTML = st.view === 'board' ? boardHtml(l.filter(isOpen)) : (l.length ? `<div class="olist">${l.map(i => itemRow(i, { showUnit })).join('')}</div>` : '<div class="empty-boq">لا أعمال مطابقة.</div>');
    bindRows(t, re); if (st.view === 'board') bindBoard(t, re);
  };
  $('#lq', t).oninput = e => { st.q = e.target.value.trim(); render(); };
  $('[name=lu]', t) && ($('[name=lu]', t).onchange = e => { st.u = e.target.value; render(); });
  $('[name=lf]', t).onchange = e => { st.f = e.target.value; render(); };
  $('[name=ls]', t).onchange = e => { st.s = e.target.value; render(); };
  $('[name=lp]', t).onchange = e => { st.p = e.target.value; render(); };
  $('[name=lw]', t).onchange = e => { st.who = e.target.value; render(); };
  $('#ll', t).onchange = e => { st.late = e.target.checked; render(); };
  $$('.oview [data-v]', t).forEach(b => b.onclick = () => { st.view = b.dataset.v; try { sessionStorage.setItem('ops_view', st.view); } catch (e) { } $$('.oview [data-v]', t).forEach(x => x.classList.toggle('on', x === b)); if (st.view === 'board' && st.s !== 'open') { st.s = 'open'; $('[name=ls]', t).value = 'open'; } render(); });
  render();
}

// ---------- لوحة الأعمال: سحب البطاقة إلى عمود حالة آخر = تحديث الحالة بإجراء متخذ
function bindBoard(t, re) {
  if (!matchMedia('(pointer:fine)').matches) return;
  let dragId = null;
  $$('.oboard .oi', t).forEach(c => { const i = O.I[+c.dataset.oi]; if (!i || !(staffOf(i.unit) || i.assignee_id === session.user.id)) return;
    c.draggable = true; c.title = 'اسحب البطاقة إلى عمود آخر لتغيير حالتها';
    c.addEventListener('dragstart', e => { dragId = i.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i.id)); });
    c.addEventListener('dragend', () => { c.classList.remove('dragging'); $$('.obcol.over', t).forEach(x => x.classList.remove('over')); }); });
  $$('.obcol', t).forEach(col => {
    col.addEventListener('dragover', e => { if (dragId == null) return; e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', async e => { e.preventDefault(); col.classList.remove('over'); const id = dragId; dragId = null; const i = O.I[id], to = col.dataset.st; if (!i || i.status === to) return;
      const k = O.K[i.kind] || {}; const cf = ['verify', 'done'].includes(to) && Array.isArray(k.close_fields) ? k.close_fields : [];
      if (cf.length) { toast('أكمل بيانات الإنجاز من نافذة العمل'); return openItem(id, re); }
      const lab = { accepted: 'ملاحظة الاستلام *', in_progress: 'ما الذي بدأ؟ *', on_hold: 'سبب التعليق *', verify: 'ما الذي أُنجز؟ *', new: 'سبب الإعادة إلى «جديد» *' }[to] || 'الإجراء المتخذ *';
      const a = await askAction(`${ST[i.status].ar} ← ${ST[to].ar}`, lab); if (!a) return;
      try { await q(sb.from('ops_items').update({ status: to, last_action: a.a }).eq('id', id)); O.just = { id, at: Date.now() }; toast(`${i.ref}: ${ST[to].ar}`); await loadOps(); re && re(); } catch (er) { err(er); } });
  });
}

// ---------- مركز البلاغات والطلبات (#/ops/<tab>)
export async function mountOps(root, tab, params = new URLSearchParams()) {
  await loadOps();
  const req = role() === 'requester';
  tab = tab || (req ? 'mine' : 'list');
  const mine = O.items.filter(i => i.created_by === session.user.id || i.requester_id === session.user.id);
  const tabs = req ? [['mine', `طلباتي <b class="fmcnt">${mine.filter(isOpen).length}</b>`], ['new', 'طلب جديد']] : [['list', 'كل الأعمال'], ['new', 'طلب جديد'], ['mine', `طلباتي <b class="fmcnt">${mine.filter(isOpen).length}</b>`]];
  root.innerHTML = `<div class="fmhead"><div><h1 class="pagetitle">البلاغات والطلبات</h1><p class="muted m0">قناة واحدة لكل احتياجات المنشآت (R-05): يصل الطلب إلى القسم المختص بأولوية ومهلة، ويُعالج وفق إجرائه في الدليل، ويرى صاحبه كل خطوة حتى يؤكد المعالجة.</p></div><span class="sp"></span>${canFile() ? '<button class="btn primary" id="oNew">＋ بلاغ أو طلب</button>' : ''}</div>
    <nav class="fmtabs">${tabs.map(([k, v]) => `<a href="#/ops/${k}" class="${tab === k ? 'on' : ''}">${v}</a>`).join('')}</nav><div id="oBody"></div>`;
  const re = () => mountOps(root, tab, params);
  $('#oNew', root) && ($('#oNew', root).onclick = () => newItem({}, r => { location.hash = '#/ops/' + (req ? 'mine' : 'list'); re(); openItem(r.id, re); }));
  const t = $('#oBody', root);
  if (tab === 'new') {
    t.innerHTML = `<h2 class="sub-h m0">ماذا تحتاج؟</h2><p class="muted small">اختر نوع الطلب. الحالات الطارئة (خطر على السلامة أو توقف منطقة حرجة) تُرفع بأولوية «طارئ» وتُتابع هاتفياً أيضاً.</p>${catalogHtml()}`;
    $$('[data-kind]', t).forEach(b => b.onclick = () => newItem({ kind: b.dataset.kind }, r => { location.hash = '#/ops/' + (req ? 'mine' : 'list'); openItem(r.id, re); }));
  } else if (tab === 'mine') {
    t.innerHTML = mine.length ? `<div class="olist">${mine.sort((a, b) => isOpen(b) - isOpen(a) || b.id - a.id).map(i => itemRow(i)).join('')}</div>` : `<div class="empty-boq">لم ترفع طلبات بعد. <a href="#/ops/new">ارفع أول طلب</a></div>`;
    bindRows(t, re);
  } else listView(t, O.items, { params, re });
  const id = +(params.get('id') || 0); if (id) openItem(id, re);
}
