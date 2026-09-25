// ===== التقارير الفنية ومحاضر الاجتماعات =====
import { sb, canEdit, isAdmin, q, session, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico } from './ui.js';

export const TR_KIND = { visit: 'زيارة ميدانية', status: 'تقرير حالة', weekly: 'تقرير أسبوعي', monthly: 'تقرير شهري', incident: 'بلاغ / ملاحظة عاجلة', meeting: 'محضر اجتماع' };
export const TR_STATUS = { draft: 'مسودة', published: 'بانتظار المراجعة', reviewed: 'تمت المراجعة', returned: 'مُعاد للمهندس' };
export const trBadge = s => `<span class="badge ${s === 'reviewed' ? 'full' : s === 'published' ? 'ovr' : s === 'returned' ? 'bad' : 'skel'}">${TR_STATUS[s] || s}</span>`;
const BUCKET = 'report-photos';
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role').order('full_name')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';
const mine = r => r.created_by === session.user.id;
const canEditReport = r => isAdmin() || (canEdit() && mine(r) && r.status !== 'reviewed');

// ضغط الصورة في المتصفح قبل الرفع (≈ 300 كيلوبايت بدل عدة ميجابايت)
export function compress(file, max = 1600, qual = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('compress')), 'image/jpeg', qual); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('صورة غير صالحة')); }; img.src = url;
  });
}
async function signed(paths) {
  if (!paths.length) return {};
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600); if (error) throw error;
  const m = {}; (data || []).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; }); return m;
}

// ---------- القائمة العامة
export async function mountTReports(root, params) {
  await loadProfiles();
  const projects = await q(sb.from('projects').select('id,name').eq('archived', false).order('name'));
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">التقارير الفنية والمحاضر</h1><span style="flex:1"></span>${canEdit() ? '<a class="btn primary" href="#/treport/new">＋ تقرير جديد</a>' : ''}</div>
    <div class="filters"><input id="fq" placeholder="بحث…"><select id="fSt"><option value="">${isAdmin() ? 'بانتظار المراجعة' : 'الكل'}</option>${isAdmin() ? '<option value="all">الكل</option>' : ''}${Object.entries(TR_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fK"><option value="">كل الأنواع</option>${Object.entries(TR_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><select id="fP"><option value="">كل المشاريع</option>${projects.map(p => `<option value="${p.id}" ${params.get('p') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${canEdit() && !isAdmin() ? '<label class="chk"><input type="checkbox" id="fMe"> تقاريري فقط</label>' : ''}</div><div id="tl"><p class="muted">…</p></div>`;
  const all = await q(sb.from('tech_reports').select('id,project_id,kind,title,report_date,status,created_by,published_at,reviewed_at,progress_seen,projects(name)').order('report_date', { ascending: false }).order('id', { ascending: false }));
  if (params.get('st')) $('#fSt').value = params.get('st');
  const render = () => { const qs = $('#fq').value.toLowerCase(), st = $('#fSt').value, k = $('#fK').value, pj = $('#fP').value, me = $('#fMe')?.checked;
    const rows = all.filter(r => (st === 'all' || (st ? r.status === st : (isAdmin() ? r.status === 'published' : true))) && (!k || r.kind === k) && (!pj || r.project_id === pj) && (!me || mine(r)) && (!qs || (r.title + ' ' + (r.projects?.name || '')).toLowerCase().includes(qs)));
    $('#tl').innerHTML = rows.length ? `<div class="pcard" style="padding:0;overflow:auto">${rowsHtml(rows, true)}</div>` : '<div class="empty-boq">لا توجد تقارير مطابقة</div>'; };
  ['fq', 'fSt', 'fK', 'fP', 'fMe'].forEach(id => { const el = $('#' + id); if (el) el.oninput = render; }); render();
}
function rowsHtml(rows, withProject) {
  return `<table class="lst"><thead><tr><th>التاريخ</th><th>النوع</th><th>العنوان</th>${withProject ? '<th>المشروع</th>' : ''}<th>المهندس</th><th>الحالة</th></tr></thead><tbody>${rows.map(r => `<tr data-open-r="${r.id}"><td>${dateAr(r.report_date)}</td><td>${TR_KIND[r.kind]}</td><td><b>${esc(r.title || TR_KIND[r.kind])}</b></td>${withProject ? `<td class="muted">${esc(r.projects?.name || '')}</td>` : ''}<td>${esc(pname(r.created_by))}</td><td>${trBadge(r.status)}</td></tr>`).join('')}</tbody></table>`;
}
document.addEventListener('click', e => { const tr = e.target.closest('[data-open-r]'); if (tr) location.hash = '#/treport/' + tr.getAttribute('data-open-r'); });

// ---------- تبويب المشروع
export async function projectTReports(t, p) {
  await loadProfiles();
  const rows = await q(sb.from('tech_reports').select('*').eq('project_id', p.id).order('report_date', { ascending: false }).order('id', { ascending: false }));
  const pend = rows.filter(r => r.status === 'published');
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>التقارير الفنية والمحاضر <span class="muted">(${rows.length}${pend.length ? ' · ' + pend.length + ' بانتظار المراجعة' : ''})</span></h2><span style="flex:1"></span>${canEdit() ? `<a class="btn primary" href="#/treport/new?p=${p.id}">＋ تقرير جديد</a>` : ''}</div>${rows.length ? rowsHtml(rows, false) : '<p class="muted">لا توجد تقارير فنية على هذا المشروع بعد.</p>'}</div>`;
}

// ---------- المحرر (صفحة كاملة مناسبة للجوال)
export async function mountTReportEditor(root, id, params) {
  await loadProfiles();
  const projects = await q(sb.from('projects').select('id,name,engineer_id').eq('archived', false).order('name'));
  const r = id ? await q(sb.from('tech_reports').select('*').eq('id', id).single()) : { project_id: params.get('p') || projects[0]?.id || '', kind: params.get('k') || 'visit', report_date: today(), items: [], status: 'draft' };
  if (id && !canEditReport(r)) return location.hash = '#/treport/' + id;
  let photos = id ? await q(sb.from('report_photos').select('*').eq('report_id', id).order('sort').order('id')) : [];
  let urls = await signed(photos.map(p => p.path)).catch(() => ({}));
  const pending = []; // صور جديدة لم تُرفع بعد {blob, url, caption}
  const items = Array.isArray(r.items) ? r.items.map(x => ({ ...x })) : [];
  const meeting = () => $('#kind').value === 'meeting';

  root.innerHTML = `<div class="phead"><div class="crumb"><a href="#/treports">التقارير الفنية</a><span class="sep">›</span><span>${id ? 'تعديل تقرير' : 'تقرير جديد'}</span></div></div>
  <form id="trf" class="pcard trform">
    <div class="pgrid">
      ${field('المشروع *', sel('project_id', projects.map(p => [p.id, p.name]), r.project_id, 'required'))}
      ${field('نوع التقرير *', `<select name="kind" id="kind">${Object.entries(TR_KIND).map(([k, v]) => `<option value="${k}" ${r.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      ${field('التاريخ *', inp('report_date', r.report_date || today(), 'type="date" required'))}
      ${field('العنوان', inp('title', r.title || '', 'placeholder="يُملأ تلقائياً إن تُرك فارغاً"'))}
      <div class="fld period"><span>فترة التقرير (للأسبوعي والشهري)</span><div class="btnrow"><input type="date" name="period_from" value="${r.period_from || ''}"><input type="date" name="period_to" value="${r.period_to || ''}"></div></div>
      ${field('الموقع / المنطقة / مكان الاجتماع', inp('location', r.location || ''))}
      ${field('الحضور', inp('attendees', r.attendees || '', 'placeholder="الأسماء والجهات"'), 'wide')}
      <label class="fld wide"><span id="lblSummary">ملخص الزيارة / وصف الوضع</span><textarea name="summary" rows="4">${esc(r.summary || '')}</textarea></label>
      <div class="wide notmeeting">${field('الملاحظات والمخالفات', `<textarea name="findings" rows="4">${esc(r.findings || '')}</textarea>`)}</div>
      <div class="wide notmeeting">${field('التوصيات / المطلوب', `<textarea name="recommendations" rows="3">${esc(r.recommendations || '')}</textarea>`)}</div>
      <div class="notmeeting">${field('نسبة الإنجاز المشاهدة % (اختياري)', inp('progress_seen', r.progress_seen ?? '', 'type="number" min="0" max="100" step="1"'))}</div>
      <div class="wide onlymeeting"><div class="fld"><span>القرارات والتكليفات</span><div id="items"></div><button type="button" class="btn sm" id="addItem">＋ إضافة قرار</button></div></div>
      <div class="onlymeeting">${field('موعد الاجتماع القادم', inp('next_meeting', r.next_meeting || '', 'type="date"'))}</div>
      <div class="fld wide"><span>الصور</span>
        <div class="photogrid" id="pg"></div>
        <div class="btnrow"><label class="btn primary"><input type="file" accept="image/*" capture="environment" multiple hidden id="cam">${ico('camera')} التقاط صورة</label><label class="btn"><input type="file" accept="image/*" multiple hidden id="gal">${ico('image')} من الاستوديو</label><span class="muted small" id="pinfo"></span></div></div>
    </div>
    <div class="btnrow end" style="margin-top:12px">${id && (isAdmin() || r.status === 'draft') ? '<button type="button" class="btn danger" id="del">حذف</button>' : ''}<span style="flex:1"></span><a class="btn" href="#/${id ? 'treport/' + id : 'treports'}">إلغاء</a><button type="button" class="btn" id="saveDraft">حفظ كمسودة</button><button type="button" class="btn primary" id="publish">${r.status === 'reviewed' ? 'حفظ' : 'نشر التقرير'}</button></div>
  </form>`;
  const f = $('#trf');
  const toggle = () => { const m = meeting(); $$('.notmeeting', f).forEach(e => e.style.display = m ? 'none' : ''); $$('.onlymeeting', f).forEach(e => e.style.display = m ? '' : 'none'); $('#lblSummary').textContent = m ? 'جدول الأعمال وما دار في الاجتماع' : 'ملخص الزيارة / وصف الوضع'; };
  $('#kind').onchange = toggle; toggle();
  const people = profiles.filter(p => ['admin', 'engineer'].includes(p.role));
  const renderItems = () => { $('#items').innerHTML = items.map((it, i) => `<div class="itemrow"><input placeholder="القرار / التكليف" value="${esc(it.text || '')}" data-i="${i}" data-k="text"><input list="ppl" placeholder="المسؤول" value="${esc(it.owner || '')}" data-i="${i}" data-k="owner"><input type="date" value="${it.due || ''}" data-i="${i}" data-k="due"><button type="button" class="btn sm danger" data-rm="${i}">✕</button></div>`).join('') + `<datalist id="ppl">${people.map(p => `<option value="${esc(p.full_name)}">`).join('')}</datalist>`;
    $$('#items input').forEach(el => el.oninput = () => items[+el.getAttribute('data-i')][el.getAttribute('data-k')] = el.value); $$('#items [data-rm]').forEach(b => b.onclick = () => { items.splice(+b.getAttribute('data-rm'), 1); renderItems(); }); };
  $('#addItem').onclick = () => { items.push({ text: '', owner: '', due: '' }); renderItems(); }; renderItems();
  const renderPhotos = () => { $('#pg').innerHTML = photos.map(p => `<div class="ph"><img src="${urls[p.path] || ''}" alt=""><input placeholder="تعليق" value="${esc(p.caption || '')}" data-cap="${p.id}"><button type="button" class="x" data-delp="${p.id}">✕</button></div>`).join('') + pending.map((p, i) => `<div class="ph new"><img src="${p.url}" alt=""><input placeholder="تعليق" value="${esc(p.caption)}" data-pcap="${i}"><button type="button" class="x" data-delpend="${i}">✕</button></div>`).join('');
    $('#pinfo').textContent = (photos.length + pending.length) ? `${photos.length + pending.length} صورة` : 'لم تُضف صور بعد';
    $$('[data-cap]').forEach(el => el.onchange = () => { const p = photos.find(x => x.id === +el.getAttribute('data-cap')); p.caption = el.value; p._dirty = true; });
    $$('[data-pcap]').forEach(el => el.oninput = () => pending[+el.getAttribute('data-pcap')].caption = el.value);
    $$('[data-delp]').forEach(b => b.onclick = async () => { const p = photos.find(x => x.id === +b.getAttribute('data-delp')); if (!await confirm('حذف الصورة؟', 'حذف', true)) return; await sb.storage.from(BUCKET).remove([p.path]); await q(sb.from('report_photos').delete().eq('id', p.id)); photos = photos.filter(x => x !== p); renderPhotos(); });
    $$('[data-delpend]').forEach(b => b.onclick = () => { pending.splice(+b.getAttribute('data-delpend'), 1); renderPhotos(); }); };
  const addFiles = async files => { for (const file of files) { try { const blob = await compress(file); pending.push({ blob, url: URL.createObjectURL(blob), caption: '' }); } catch (e) { err(e); } } renderPhotos(); };
  $('#cam').onchange = e => addFiles([...e.target.files]); $('#gal').onchange = e => addFiles([...e.target.files]); renderPhotos();

  async function save(status) {
    const d = formData(f); if (!d.project_id) return err('اختر المشروع');
    const kind = d.kind; const title = d.title.trim() || `${TR_KIND[kind]} — ${projects.find(p => p.id === d.project_id)?.name || ''} — ${dateAr(d.report_date)}`;
    const row = { project_id: d.project_id, kind, title, report_date: d.report_date, period_from: d.period_from || null, period_to: d.period_to || null, location: d.location.trim(), attendees: d.attendees.trim(), summary: d.summary.trim(), findings: kind === 'meeting' ? '' : d.findings.trim(), recommendations: kind === 'meeting' ? '' : d.recommendations.trim(), progress_seen: kind !== 'meeting' && d.progress_seen !== '' ? Number(d.progress_seen) : null, items: kind === 'meeting' ? items.filter(i => (i.text || '').trim()) : [], next_meeting: kind === 'meeting' && d.next_meeting ? d.next_meeting : null };
    if (status) { row.status = status; if (status === 'published' && !r.published_at) row.published_at = new Date().toISOString(); }
    const btns = $$('button', f); btns.forEach(b => b.disabled = true);
    try {
      let rid = id;
      if (id) await q(sb.from('tech_reports').update(row).eq('id', id));
      else { const ins = await q(sb.from('tech_reports').insert({ ...row, status: status || 'draft', created_by: session.user.id }).select('id').single()); rid = ins.id; }
      for (const p of photos.filter(x => x._dirty)) await q(sb.from('report_photos').update({ caption: p.caption }).eq('id', p.id));
      let n = 0; for (const p of pending) { n++; toast(`رفع الصورة ${n} من ${pending.length}…`); const path = `${rid}/${Date.now()}_${n}.jpg`; const { error } = await sb.storage.from(BUCKET).upload(path, p.blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw error; await q(sb.from('report_photos').insert({ report_id: rid, path, caption: p.caption, sort: photos.length + n, created_by: session.user.id })); }
      toast(status === 'published' ? 'تم نشر التقرير' : 'تم الحفظ'); location.hash = '#/treport/' + rid;
    } catch (e) { err(e); btns.forEach(b => b.disabled = false); }
  }
  $('#saveDraft').onclick = () => save(r.status === 'reviewed' ? null : 'draft');
  $('#publish').onclick = () => save(r.status === 'reviewed' ? null : 'published');
  const del = $('#del'); if (del) del.onclick = async () => { if (!await confirm('حذف التقرير وصوره نهائياً؟', 'حذف', true)) return; if (photos.length) await sb.storage.from(BUCKET).remove(photos.map(p => p.path)); await q(sb.from('tech_reports').delete().eq('id', id)); location.hash = '#/treports'; };
}

// ---------- عرض التقرير
export async function mountTReport(root, id) {
  await loadProfiles();
  const r = await q(sb.from('tech_reports').select('*, projects(id,name,engineer_id,engineer_name,contractor,facility)').eq('id', id).maybeSingle());
  if (!r) return root.innerHTML = '<div class="empty-boq">التقرير غير موجود</div>';
  const [photos, comments, tasks] = await Promise.all([q(sb.from('report_photos').select('*').eq('report_id', id).order('sort').order('id')), q(sb.from('report_comments').select('*').eq('report_id', id).order('id')), q(sb.from('tasks').select('id,title,status,assignee_id,assignee_name,due_date').eq('report_id', id))]);
  const urls = await signed(photos.map(p => p.path)).catch(() => ({}));
  const admin = isAdmin(); const editable = canEditReport(r); const items = Array.isArray(r.items) ? r.items : [];
  const P = (k, v) => v ? `<div class="rsec"><h3>${k}</h3><div class="pre">${esc(v)}</div></div>` : '';
  const TS = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', done: 'منجزة', cancelled: 'ملغاة' };
  const blocks = [];
  blocks.push(`<header class="rhead"><img src="assets/logo.png" alt=""><div class="rt"><h1>${esc(r.title)}</h1><div class="rs">${TR_KIND[r.kind]} · ${esc(r.projects?.name || '')}${r.projects?.facility ? ' · ' + esc(r.projects.facility) : ''}</div></div><div class="rmeta"><div><span>التاريخ</span><b>${dateAr(r.report_date)}</b></div>${r.period_from ? `<div><span>الفترة</span><b>${dateAr(r.period_from)} → ${dateAr(r.period_to)}</b></div>` : ''}<div><span>أعدّه</span><b>${esc(pname(r.created_by))}</b></div><div><span>الحالة</span><b>${TR_STATUS[r.status]}</b></div>${r.reviewed_at ? `<div><span>راجعه</span><b>${esc(pname(r.reviewed_by))} · ${dateAr(r.reviewed_at)}</b></div>` : ''}</div></header>`);
  const kv = [r.location ? [r.kind === 'meeting' ? 'مكان الاجتماع' : 'الموقع / المنطقة', r.location] : null, r.attendees ? ['الحضور', r.attendees] : null, r.projects?.contractor ? ['المقاول', r.projects.contractor] : null, r.progress_seen != null ? ['الإنجاز المشاهد', r.progress_seen + '%'] : null, r.next_meeting ? ['الاجتماع القادم', dateAr(r.next_meeting)] : null].filter(Boolean);
  if (kv.length) blocks.push(`<div class="kvs trkv">${kv.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`);
  [[r.kind === 'meeting' ? 'جدول الأعمال وما دار في الاجتماع' : 'الملخص', r.summary], ['الملاحظات والمخالفات', r.findings], ['التوصيات / المطلوب', r.recommendations]].forEach(([k, v]) => { if (v) blocks.push(P(k, v)); });
  if (items.length) blocks.push(`<div class="rsec"><h3>القرارات والتكليفات</h3><table class="rt2"><thead><tr><th>#</th><th>القرار / التكليف</th><th>المسؤول</th><th>الموعد</th>${admin ? '<th class="noprint"></th>' : ''}</tr></thead><tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.text)}</td><td>${esc(it.owner || '')}</td><td>${dateAr(it.due)}</td>${admin ? `<td class="noprint">${it.task_id ? '<span class="badge full">مهمة</span>' : `<button class="btn sm" data-item="${i}">→ مهمة</button>`}</td>` : ''}</tr>`).join('')}</tbody></table></div>`);
  for (let i = 0; i < photos.length; i += 4) blocks.push(`<div class="rsec"><h3>${i === 0 ? `الصور (${photos.length})` : 'الصور — تابع'}</h3><div class="photos">${photos.slice(i, i + 4).map((p, j) => `<figure><img src="${urls[p.path] || ''}" alt="" crossorigin="anonymous" data-full="${urls[p.path] || ''}"><figcaption>${i + j + 1}. ${esc(p.caption || '')}</figcaption></figure>`).join('')}</div></div>`);
  if (r.review_note) blocks.push(`<div class="rsec"><h3>ملاحظة المراجعة</h3><div class="pre ${r.status === 'returned' ? 'bad' : ''}">${esc(r.review_note)}</div></div>`);
  if (tasks.length) blocks.push(`<div class="rsec"><h3>المهام المرتبطة بالتقرير</h3><ul class="rlist">${tasks.map(t => `<li><a href="#/project/${r.project_id}/tasks">${esc(t.title)}</a> <span class="muted">— ${esc(pname(t.assignee_id) !== '—' ? pname(t.assignee_id) : t.assignee_name || '')} · ${TS[t.status]} · ${dateAr(t.due_date)}</span></li>`).join('')}</ul></div>`);
  blocks.push(`<footer class="rfoot"><div>صدر من منصة إدارة مشاريع تجمع الأحساء الصحي — ${esc(today())}</div><div class="sig"><div>المهندس: ${esc(pname(r.created_by))}<br><br>التوقيع: ..............</div><div>رئيس قسم المشاريع<br><br>التوقيع: ..............</div></div></footer>`);
  root.innerHTML = `<div class="phead noprint"><div class="crumb"><a href="#/treports">التقارير الفنية</a><span class="sep">›</span><a href="#/project/${r.project_id}/treports">${esc(r.projects?.name || '')}</a><span class="sep">›</span><span>${esc(r.title)}</span></div>
    <div class="btnrow wrap">${trBadge(r.status)}<span style="flex:1"></span>${editable ? `<a class="btn" href="#/treport/${id}/edit">تعديل</a>` : ''}${r.status === 'draft' && mine(r) ? '<button class="btn primary" id="pub">نشر التقرير</button>' : ''}${r.status === 'returned' && mine(r) ? '<button class="btn primary" id="pub">إعادة النشر بعد التعديل</button>' : ''}${admin && r.status === 'published' ? '<button class="btn primary" id="rev">✓ تمت المراجعة</button><button class="btn" id="ret">إعادة للمهندس</button>' : ''}${admin ? '<button class="btn" id="mkTask">＋ مهمة من التقرير</button>' : ''}<button class="btn" id="pdf">${ico('download')} PDF</button><button class="btn" id="prn">${ico('print')} طباعة</button></div></div>
  <div class="rep" id="rep"></div>
  <div class="pcard noprint"><h2><span class="ic"></span>التعليقات <span class="muted">(${comments.length})</span></h2>${comments.length ? comments.map(c => `<div class="upd"><div class="uh"><b>${esc(pname(c.by_user))}</b> <span class="muted">· ${dateAr(c.at)}</span>${admin || c.by_user === session.user.id ? ` <button class="btn sm" data-delc="${c.id}">حذف</button>` : ''}</div><div class="ub">${esc(c.body)}</div></div>`).join('') : '<p class="muted">لا توجد تعليقات.</p>'}
    <form id="cf" class="btnrow" style="margin-top:8px"><input name="body" placeholder="اكتب تعليقاً…" required style="flex:1"><button class="btn primary">إرسال</button></form></div>`;
  const { paginate } = await import('./report.js'); paginate($('#rep'), blocks);
  const reload = () => mountTReport(root, id);
  $('#cf').onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { await q(sb.from('report_comments').insert({ report_id: id, body: d.body.trim(), by_user: session.user.id })); reload(); } catch (er) { err(er); } };
  $$('[data-delc]').forEach(b => b.onclick = async () => { await q(sb.from('report_comments').delete().eq('id', +b.getAttribute('data-delc'))); reload(); });
  const pub = $('#pub'); if (pub) pub.onclick = async () => { try { await q(sb.from('tech_reports').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)); toast('تم النشر'); reload(); } catch (e) { err(e); } };
  const rev = $('#rev'); if (rev) rev.onclick = () => reviewDialog('reviewed');
  const ret = $('#ret'); if (ret) ret.onclick = () => reviewDialog('returned');
  async function reviewDialog(to) {
    await modal(`<form id="f"><label class="fld"><span>${to === 'reviewed' ? 'ملاحظة المراجعة (اختياري)' : 'سبب الإعادة *'}</span><textarea name="note" rows="3" ${to === 'returned' ? 'required' : ''}>${esc(r.review_note || '')}</textarea></label><div class="btnrow end" style="margin-top:10px"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${to === 'reviewed' ? 'تأكيد المراجعة' : 'إعادة للمهندس'}</button></div></form>`, { title: to === 'reviewed' ? 'اعتماد مراجعة التقرير' : 'إعادة التقرير للمهندس', onOpen: (w, close) => {
        $('#f', w).onsubmit = async e => { e.preventDefault(); const d = formData(e.target); try { await q(sb.from('tech_reports').update({ status: to, review_note: d.note.trim() || null, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }).eq('id', id)); if (d.note.trim()) await q(sb.from('report_comments').insert({ report_id: id, body: (to === 'reviewed' ? 'ملاحظة المراجعة: ' : 'أُعيد التقرير: ') + d.note.trim(), by_user: session.user.id })); toast(to === 'reviewed' ? 'تمت المراجعة' : 'أُعيد التقرير'); close(); reload(); } catch (er) { err(er); } };
      } });
  }
  const project = { id: r.project_id, engineer_id: r.projects?.engineer_id || r.created_by, engineer_name: r.projects?.engineer_name };
  const mk = $('#mkTask'); if (mk) mk.onclick = async () => { const { taskForm } = await import('./tasks.js'); taskForm(null, project, reload, { report_id: +id, title: '', details: `مرجع: ${r.title} (${TR_KIND[r.kind]} ${dateAr(r.report_date)})`, assignee_id: r.created_by }); };
  $$('[data-item]').forEach(b => b.onclick = async () => { const i = +b.getAttribute('data-item'); const it = items[i]; const { taskForm } = await import('./tasks.js'); const owner = profiles.find(p => p.full_name === it.owner);
    taskForm(null, project, async () => { const t = await q(sb.from('tasks').select('id').eq('report_id', id).order('id', { ascending: false }).limit(1)); if (t[0]) { const ni = items.map((x, j) => j === i ? { ...x, task_id: t[0].id } : x); await q(sb.from('tech_reports').update({ items: ni }).eq('id', id)); } reload(); }, { report_id: +id, title: it.text, details: `قرار رقم ${i + 1} من ${r.title}`, assignee_id: owner?.id || '', assignee_name: owner ? '' : (it.owner || ''), due_date: it.due || '' }); });
  $('#prn').onclick = () => window.print();
  $('#pdf').onclick = async () => { const { exportPdf } = await import('./report.js'); exportPdf($('#rep'), `${r.title}.pdf`); };
  $$('.photos img').forEach(im => im.onclick = () => modal(`<img src="${im.getAttribute('data-full')}" style="max-width:100%;border-radius:8px">`, { title: 'الصورة', wide: true }));
}
