// ===== العروض التنفيذية: منجزات مستهدفة / مقترحات / تحديثات — تُبنى من بنود مرتبطة بالمشاريع (حيّة) أو حرّة، وتُنشر برابط بلا حساب وتُصدَّر PowerPoint =====
import { sb, q, session, isAdmin, SETTINGS } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico, download } from './ui.js';
import { B_KIND, B_ST, itemState, briefStats, daysLeft, buildBriefPptx, dAr, PROC, FIN, laneAr, laneHex } from './brief_lib.js';
import { linkModal } from './share.js';

const PSEL = 'id,name,stage,progress_actual,progress_planned,end_date,revised_end_date,start_date,contractor,facility,status_note,tender_date';
const normItem = it => { const p = it.projects; return { ...it, project: p ? { id: p.id, name: p.name, stage: p.stage, pa: p.progress_actual, pl: p.progress_planned, end: p.revised_end_date || p.end_date, start: p.start_date, contractor: p.contractor, facility: p.facility, status_note: p.status_note, tender: p.tender_date, late: p.stage === 'execution' && !!(p.status_note || ((p.revised_end_date || p.end_date) && (p.revised_end_date || p.end_date) < new Date().toISOString().slice(0, 10))) } : null }; };
// مسارا المشتريات والمالية والتحدي تحت البند
export const lanesHtml = it => { const has = it.proc_stage || it.proc_note || it.fin_stage || it.fin_note || (it.challenge || '').trim(); if (!has) return ''; return `<div class="lanes">${it.proc_stage || it.proc_note ? `<div class="lane"><i>المشتريات</i><span class="lchip" style="background:#${laneHex(PROC, it.proc_stage)}">${esc(laneAr(PROC, it.proc_stage))}</span>${it.proc_note ? `<span class="ln">${esc(it.proc_note)}</span>` : ''}</div>` : ''}${it.fin_stage || it.fin_note ? `<div class="lane"><i>المالية</i><span class="lchip" style="background:#${laneHex(FIN, it.fin_stage)}">${esc(laneAr(FIN, it.fin_stage))}</span>${it.fin_note ? `<span class="ln">${esc(it.fin_note)}</span>` : ''}</div>` : ''}${(it.challenge || '').trim() ? `<div class="lane ch ${it.needs_decision ? 'dec' : ''}"><i>التحدي</i>${it.needs_decision ? '<span class="lchip" style="background:#C0392B">يحتاج قرار الرئيس التنفيذي</span>' : ''}<span class="ln">${esc(it.challenge)}</span></div>` : ''}${it.lanes_at ? `<small class="muted lat">آخر تحديث ${dateAr(it.lanes_at)}</small>` : ''}</div>`; };
const loadItems = async id => (await q(sb.from('brief_items').select(`*,projects(${PSEL})`).eq('brief_id', id).order('sort'))).map(normItem);
export const publicUrl = t => location.origin + location.pathname.replace(/[^/]*$/, '') + 'b.html?t=' + t;
const token = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
const kindBadge = k => `<span class="badge bk ${k}">${B_KIND[k] || k}</span>`;
const stBadge = s => `<span class="badge ${s === 'published' ? 'full' : s === 'archived' ? 'bad' : 'skel'}">${B_ST[s] || B_ST.draft}</span>`;
const countdown = b => { const d = daysLeft(b.ref_date); return d == null ? '' : d < 0 ? `<span class="badge bad">تجاوز الموعد بـ ${-d} يوم</span>` : `<span class="badge ovr">${d === 0 ? 'الموعد اليوم' : `متبقٍ ${d} يوماً`}</span>`; };

// ---------- القائمة
export async function mountBriefs(root, params) {
  const [rows, notes] = await Promise.all([q(sb.from('briefs').select('*').order('updated_at', { ascending: false })), isAdmin() ? q(sb.from('brief_notes').select('brief_id,seen')) : []]);
  const counts = await q(sb.from('brief_items').select('brief_id'));
  const show = params.get('all') ? rows : rows.filter(r => r.status !== 'archived');
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">العروض التنفيذية</h1><span class="sp"></span>${isAdmin() ? '<button class="btn primary" id="bNew">＋ عرض جديد</button>' : ''}</div>
    <p class="muted small">عروض تُبنى من بنود مرتبطة بالمشاريع (تتحدث حيّة) أو بنود حرّة من خارج المنصة، وتُنشر للجهة التنفيذية برابط يفتح بلا حساب، وتُصدَّر PowerPoint بهوية التجمع.</p>
    ${show.length ? `<div class="bgrid">${show.map(b => { const n = counts.filter(c => c.brief_id === b.id).length; const ns = notes.filter(x => x.brief_id === b.id), un = ns.filter(x => !x.seen).length; return `<a class="bcard ${b.status}" href="#/briefs/${b.id}"><div class="bch">${kindBadge(b.kind)}${stBadge(b.status)}${countdown(b)}${un ? `<span class="badge bad">${un} ملاحظة جديدة</span>` : ''}</div><b>${esc(b.title)}</b>${b.subtitle ? `<small>${esc(b.subtitle)}</small>` : ''}<div class="bcf"><span>${n} بند</span>${b.ref_date ? `<span>${esc(b.ref_label || 'الموعد')} ${dateAr(b.ref_date)}</span>` : ''}${b.status === 'published' ? `<span>${b.views || 0} مشاهدة</span>` : ''}<span class="sp"></span><span>${dateAr(b.updated_at)}</span></div></a>`; }).join('')}</div>` : '<div class="empty-boq">لا توجد عروض بعد — أنشئ أول عرض (مثل «المنجزات المستهدفة قبل زيارة ديسمبر»).</div>'}
    ${rows.length > show.length ? `<p class="small"><a href="#/briefs?all=1">إظهار المؤرشفة (${rows.length - show.length})</a></p>` : ''}`;
  $('#bNew') && ($('#bNew').onclick = () => briefForm(null, id => location.hash = '#/briefs/' + id));
}

// ---------- نموذج العرض
async function briefForm(b, done) {
  const v = b || { kind: 'targets', title: '', subtitle: '', ref_label: 'موعد الزيارة', ref_date: '', intro: '', closing: '' };
  await modal(`<form id="f" class="pgrid">
    ${field('نوع العرض', sel('kind', Object.entries(B_KIND), v.kind))}
    ${field('العنوان', inp('title', v.title, 'required maxlength="140" placeholder="مثال: المنجزات المستهدفة قبل زيارة منتصف ديسمبر 2026"'), 'wide')}
    ${field('سطر توضيحي (اختياري)', inp('subtitle', v.subtitle || '', 'maxlength="200"'), 'wide')}
    ${field('تسمية الموعد المرجعي', inp('ref_label', v.ref_label || 'الموعد المرجعي', 'maxlength="40" placeholder="موعد الزيارة"'))}
    ${field('الموعد المرجعي (للعدّاد)', inp('ref_date', v.ref_date || '', 'type="date"'))}
    ${field('تمهيد يظهر أعلى العرض (اختياري)', `<textarea name="intro" rows="3" maxlength="1200">${esc(v.intro || '')}</textarea>`, 'wide')}
    ${field('الخلاصة / القرارات المطلوبة (اختياري)', `<textarea name="closing" rows="3" maxlength="1500">${esc(v.closing || '')}</textarea>`, 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${b ? 'حفظ' : 'إنشاء العرض'}</button></div></form>`, { title: b ? 'تعديل العرض' : 'عرض تنفيذي جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const row = { kind: f.kind, title: f.title.trim(), subtitle: f.subtitle.trim(), ref_label: f.ref_label.trim() || 'الموعد المرجعي', ref_date: f.ref_date || null, intro: f.intro.trim(), closing: f.closing.trim() };
        try { let id = b?.id; if (b) await q(sb.from('briefs').update(row).eq('id', b.id)); else { const r = await q(sb.from('briefs').insert({ ...row, status: 'draft', created_by: session.user.id }).select('id').single()); id = r.id; } close(); toast(b ? 'تم الحفظ' : 'أُنشئ العرض'); done && done(id); } catch (er) { err(er); } };
    } });
}

// ---------- صفحة العرض
export async function mountBrief(root, id, params) {
  const b = await q(sb.from('briefs').select('*').eq('id', id).single());
  const [items, projects, notes] = await Promise.all([loadItems(b.id), isAdmin() ? q(sb.from('projects').select('id,name,stage,facility').eq('archived', false).order('name')) : [], isAdmin() ? q(sb.from('brief_notes').select('*').eq('brief_id', b.id).order('id', { ascending: false })) : []]);
  const admin = isAdmin(); const st = briefStats(items); const dl = daysLeft(b.ref_date); const unseen = notes.filter(n => !n.seen).length;
  const row = (it, i) => { const S = itemState(it); return `<div class="bitem ${admin ? 'can' : ''}" data-id="${it.id}"><span class="bno">${i + 1}</span><div class="bmain"><div class="bt"><b>${esc(it.title)}</b>${it.project ? `<a class="tag" href="#/project/${it.project.id}" title="فتح المشروع">${esc(it.project.name)}</a>` : '<span class="tag free">بند حر</span>'}</div>${S.line ? `<small class="muted">${esc(S.line)}</small>` : ''}${it.expected || it.show_text || it.notes ? `<div class="bdet">${it.expected ? `<span><i>الإنجاز المتوقع:</i> ${esc(it.expected)}</span>` : ''}${it.show_text ? `<span><i>ما سيُعرض:</i> ${esc(it.show_text)}</span>` : ''}${it.notes ? `<span><i>ملاحظات:</i> ${esc(it.notes)}</span>` : ''}</div>` : ''}${lanesHtml(it)}${S.pct != null ? `<div class="pb"><i style="width:${S.pct}%;background:#${S.hex}"></i></div>` : ''}</div><div class="bside"><span class="bchip" style="background:#${S.hex}">${esc(S.chip)}</span>${it.target_date ? `<small class="muted">المستهدف ${dateAr(it.target_date)}</small>` : ''}</div>${admin ? `<div class="bact"><button class="btn sm ghost" data-mv="-1" title="أعلى">↑</button><button class="btn sm ghost" data-mv="1" title="أسفل">↓</button></div>` : ''}</div>`; };
  root.innerHTML = `<div class="toolbar"><a class="btn sm ghost" href="#/briefs">← العروض</a><h1 class="pagetitle">${esc(b.title)}</h1>${kindBadge(b.kind)}${stBadge(b.status)}<span class="sp"></span>
      ${admin ? `<button class="btn sm" id="bEdit">${ico('edit')} تعديل</button><button class="btn sm ${b.status === 'published' ? '' : 'primary'}" id="bPub">${b.status === 'published' ? 'الرابط العام' : 'نشر رابط للجهة التنفيذية'}</button>` : ''}
      <button class="btn sm" id="bPptx">${ico('download')} PowerPoint</button>
      ${admin ? `<button class="btn sm ${unseen ? 'primary' : ''}" id="bNotes">ملاحظات الجهة التنفيذية${notes.length ? ` (${notes.length})` : ''}</button>` : ''}</div>
    ${b.subtitle ? `<p class="muted m0">${esc(b.subtitle)}</p>` : ''}
    <div class="kpis"><div class="kpi"><b>${st.n}</b><span>بنداً</span></div>${dl != null ? `<div class="kpi ${dl < 0 ? 'bad' : ''}"><b>${Math.abs(dl)}</b><span>${dl < 0 ? 'يوماً بعد ' : 'يوماً حتى '}${esc(b.ref_label || 'الموعد')} · ${dateAr(b.ref_date)}</span></div>` : ''}<div class="kpi"><b>${st.exec + st.done}</b><span>قيد التنفيذ أو منجزة</span></div><div class="kpi"><b>${st.early}</b><span>دراسة / طرح / حصر</span></div><div class="kpi"><b>${st.avg}%</b><span>متوسط التقدم</span></div>${st.decisions ? `<div class="kpi bad"><b>${st.decisions}</b><span>تحتاج قرار الرئيس التنفيذي</span></div>` : ''}${b.status === 'published' ? `<div class="kpi"><b>${b.views || 0}</b><span>مشاهدة${b.last_viewed_at ? ' · آخرها ' + dateAr(b.last_viewed_at) : ''}</span></div>` : ''}</div>
    ${b.intro ? `<div class="pcard bintro">${esc(b.intro).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="pcard"><h2>البنود ${admin ? `<span class="sp"></span><button class="btn sm" id="bAddP">＋ من المشاريع</button><button class="btn sm primary" id="bAdd">＋ بند</button>` : ''}</h2>
      <div id="bl" class="blist">${items.length ? items.map(row).join('') : '<p class="muted">لا بنود بعد. أضف بنوداً مرتبطة بمشاريع المنصة أو بنوداً حرّة.</p>'}</div></div>
    ${b.closing ? `<div class="pcard"><h2>الخلاصة والقرارات المطلوبة</h2><p class="m0">${esc(b.closing).replace(/\n/g, '<br>')}</p></div>` : ''}
    ${admin ? `<p class="small muted">${b.status === 'archived' ? `<a href="#" id="bUnarch">إعادة التفعيل</a>` : `<a href="#" id="bArch">أرشفة العرض</a>`} · <a href="#" id="bDel" style="color:#A6503B">حذف نهائي</a></p>` : ''}`;
  const reload = () => mountBrief(root, id, params);
  if (admin) {
    $('#bEdit').onclick = () => briefForm(b, reload);
    $('#bAdd').onclick = () => itemForm(b, null, projects, items.length, reload);
    $('#bAddP').onclick = () => pickProjects(b, projects, items, reload);
    $$('.bitem', root).forEach(el => { el.onclick = e => { if (e.target.closest('a,button')) return; const it = items.find(x => x.id === +el.dataset.id); itemForm(b, it, projects, items.length, reload); }; });
    $$('[data-mv]', root).forEach(btn => btn.onclick = async e => { e.stopPropagation(); const el = btn.closest('.bitem'); const i = items.findIndex(x => x.id === +el.dataset.id), j = i + Number(btn.dataset.mv); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; try { await Promise.all(items.map((x, k) => sb.from('brief_items').update({ sort: k + 1 }).eq('id', x.id))); reload(); } catch (er) { err(er); } });
    $('#bPub').onclick = () => publishBrief(b, reload);
    $('#bNotes').onclick = () => notesModal(b, notes, items, reload);
    $('#bArch') && ($('#bArch').onclick = async e => { e.preventDefault(); await q(sb.from('briefs').update({ status: 'archived' }).eq('id', b.id)); toast('أُرشف العرض'); reload(); });
    $('#bUnarch') && ($('#bUnarch').onclick = async e => { e.preventDefault(); await q(sb.from('briefs').update({ status: b.token ? 'published' : 'draft' }).eq('id', b.id)); reload(); });
    $('#bDel').onclick = async e => { e.preventDefault(); if (!await confirm('حذف العرض وكل بنوده وملاحظاته نهائياً؟', 'حذف', true)) return; await q(sb.from('briefs').delete().eq('id', b.id)); toast('حُذف العرض'); location.hash = '#/briefs'; };
    if (params.get('notes')) notesModal(b, notes, items, reload);
  }
  $('#bPptx').onclick = async () => { const btn = $('#bPptx'); btn.disabled = true; btn.textContent = 'جارٍ التجهيز…'; try { const blob = await buildBriefPptx({ ...b, by: session.profile?.full_name || '' }, items, { org: SETTINGS.org?.name, dept: SETTINGS.org?.dept?.replace(' / ', ' — ') }); download(blob, b.title.replace(/[\\/:*?"<>|]/g, '-') + '.pptx'); toast('نُزّل ملف PowerPoint'); } catch (er) { err(er); } finally { btn.disabled = false; btn.innerHTML = ico('download') + ' PowerPoint'; } };
}

// ---------- بند: مرتبط بمشروع أو حر
async function itemForm(b, it, projects, count, done) {
  const v = it || { title: '', project_id: '', tag: '', pct: '', status_text: '', expected: '', show_text: '', notes: '', target_date: '', done: false, proc_stage: '', proc_note: '', fin_stage: '', fin_note: '', challenge: '', needs_decision: false };
  await modal(`<form id="f" class="pgrid">
    ${field('عنوان البند كما سيظهر في العرض', inp('title', v.title, 'required maxlength="200" placeholder="مثال: تطوير المدخل الرئيسي — مستشفى الملك فيصل"'), 'wide')}
    ${field('ربط بمشروع في المنصة (اختياري — يسحب الوضع حيّاً)', sel('project_id', [['', '— بند حر من خارج المنصة —'], ...projects.map(p => [p.id, p.name + (p.facility ? ' · ' + p.facility : '')])], v.project_id || ''), 'wide')}
    ${field('شريحة الحالة (تُستنتج من المشروع إن تُركت فارغة)', inp('tag', v.tag || '', 'maxlength="30" list="tagList" placeholder="دراسة / حصر / تجهيز / تنفيذ…"'))}
    ${field('نسبة التقدم اليدوية ٪ (للبنود الحرّة)', inp('pct', v.pct ?? '', 'type="number" min="0" max="100" inputmode="numeric"'))}
    ${field('التاريخ المستهدف', inp('target_date', v.target_date || '', 'type="date"'))}
    ${field('الوضع الراهن (سطر مختصر؛ يُكمَّل من المشروع إن فرغ)', inp('status_text', v.status_text || '', 'maxlength="200"'), 'wide')}
    ${field('الإنجاز المتوقع' + (b.ref_date ? ` بحلول ${esc(b.ref_label || 'الموعد')}` : ''), inp('expected', v.expected || '', 'maxlength="200" placeholder="مثال: 100٪ وتشغيل"'))}
    ${field('ما سيُعرض ميدانياً', inp('show_text', v.show_text || '', 'maxlength="200"'))}
    ${field('ملاحظات', `<textarea name="notes" rows="2" maxlength="600">${esc(v.notes || '')}</textarea>`, 'wide')}
    <h3 class="sub-h wide">الوضع مع المشتريات والمالية (يُحدَّث دورياً)</h3>
    ${field('مرحلة المشتريات', sel('proc_stage', PROC, v.proc_stage || ''))}
    ${field('ملاحظة المشتريات (رقم الطرح، الموعد، العائق…)', inp('proc_note', v.proc_note || '', 'maxlength="200"'))}
    ${field('مرحلة المالية', sel('fin_stage', FIN, v.fin_stage || ''))}
    ${field('ملاحظة المالية (المبلغ، رقم المستخلص، العائق…)', inp('fin_note', v.fin_note || '', 'maxlength="200"'))}
    ${field('التحدي الحالي', `<textarea name="challenge" rows="2" maxlength="400" placeholder="ما الذي يعيق هذا البند الآن؟">${esc(v.challenge || '')}</textarea>`, 'wide')}
    <label class="chk wide"><input type="checkbox" name="needs_decision" ${v.needs_decision ? 'checked' : ''}> يحتاج قرار الرئيس التنفيذي (يظهر بشريحة حمراء بارزة في العرض)</label>
    <label class="chk wide"><input type="checkbox" name="done" ${v.done ? 'checked' : ''}> منجز (يُعرض مكتملاً بغض النظر عن حالة المشروع)</label>
    <datalist id="tagList"><option value="دراسة"><option value="حصر"><option value="تجهيز"><option value="طرح"><option value="ترسية"><option value="تنفيذ"><option value="منجز"></datalist>
    <div class="btnrow end wide">${it ? '<button type="button" class="btn ghost" id="iDel" style="color:#A6503B">حذف البند</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${it ? 'حفظ' : 'إضافة'}</button></div></form>`, { title: it ? 'تعديل البند' : 'بند جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const row = { title: f.title.trim(), project_id: f.project_id || null, tag: f.tag.trim(), pct: f.pct === '' ? null : Math.max(0, Math.min(100, +f.pct)), status_text: f.status_text.trim(), expected: f.expected.trim(), show_text: f.show_text.trim(), notes: f.notes.trim(), target_date: f.target_date || null, done: !!f.done, proc_stage: f.proc_stage || '', proc_note: f.proc_note.trim(), fin_stage: f.fin_stage || '', fin_note: f.fin_note.trim(), challenge: f.challenge.trim(), needs_decision: !!f.needs_decision };
        try { if (it) await q(sb.from('brief_items').update(row).eq('id', it.id)); else await q(sb.from('brief_items').insert({ ...row, brief_id: b.id, sort: count + 1 })); close(); done(); } catch (er) { err(er); } };
      $('#iDel', w) && ($('#iDel', w).onclick = async () => { if (!await confirm('حذف هذا البند؟', 'حذف', true)) return; await q(sb.from('brief_items').delete().eq('id', it.id)); close(); done(); });
    } });
}
async function pickProjects(b, projects, items, done) {
  const have = new Set(items.map(i => i.project_id).filter(Boolean));
  await modal(`<input id="pq" placeholder="بحث في المشاريع…" style="width:100%;margin-bottom:8px"><div class="pickl" id="pl">${projects.map(p => `<label class="pk ${have.has(p.id) ? 'off' : ''}"><input type="checkbox" value="${p.id}" ${have.has(p.id) ? 'disabled checked' : ''}><span>${esc(p.name)}</span><small class="muted">${esc(p.facility || '')}</small></label>`).join('')}</div>
    <div class="btnrow end mt10"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary" id="pOk">إضافة المحدد</button></div>`, { title: 'إضافة بنود من مشاريع المنصة', onOpen: (w, close) => {
      $('#pq', w).oninput = () => { const s = $('#pq', w).value.trim(); $$('.pk', w).forEach(l => l.hidden = !!s && !l.textContent.includes(s)); };
      $('#pOk', w).onclick = async () => { const ids = $$('input:checked:not(:disabled)', w).map(i => i.value); if (!ids.length) return close(); try { await q(sb.from('brief_items').insert(ids.map((pid, k) => ({ brief_id: b.id, sort: items.length + k + 1, title: projects.find(p => p.id === pid).name, project_id: pid })))); close(); toast(`أُضيف ${ids.length} بند`); done(); } catch (er) { err(er); } };
    } });
}

// ---------- النشر برابط عام
async function publishBrief(b, done) {
  if (b.status === 'published' && b.token) {
    const alive = !b.expires_at || b.expires_at > new Date().toISOString();
    return modal(`<div class="sharebox"><p class="small muted m0">الرابط ${alive ? 'فعّال' : '<b style="color:#A6503B">منتهي الصلاحية</b>'}${b.expires_at ? ` · ينتهي ${dateAr(b.expires_at)}` : ''} · ${b.views || 0} مشاهدة. يفتح بلا حساب، والبيانات المرتبطة بالمشاريع تظهر حيّة وقت الفتح.</p>
      <div class="linkrow"><input id="shUrl" value="${esc(publicUrl(b.token))}" readonly dir="ltr"><button class="btn primary" id="shCopy">نسخ</button></div>${b.pin ? `<p class="small m0">رمز الدخول: <b>${esc(b.pin)}</b></p>` : ''}
      <div class="btnrow mt10"><a class="btn" target="_blank" href="https://wa.me/?text=${encodeURIComponent(b.title + '\n' + publicUrl(b.token) + (b.pin ? '\nرمز الدخول: ' + b.pin : ''))}">واتساب</a><a class="btn" target="_blank" href="${esc(publicUrl(b.token))}">معاينة</a><button class="btn" id="shExt">تمديد سنة</button><span class="sp"></span><button class="btn ghost" id="shRev" style="color:#A6503B">إيقاف الرابط</button></div></div>`, { title: 'الرابط العام للعرض', onOpen: (w, close) => {
        $('#shCopy', w).onclick = async () => { try { await navigator.clipboard.writeText(publicUrl(b.token)); toast('نُسخ الرابط'); } catch (e) { $('#shUrl', w).select(); document.execCommand('copy'); toast('نُسخ الرابط'); } };
        $('#shExt', w).onclick = async () => { await q(sb.from('briefs').update({ expires_at: new Date(Date.now() + 365 * 864e5).toISOString() }).eq('id', b.id)); close(); toast('مُدّدت الصلاحية'); done(); };
        $('#shRev', w).onclick = async () => { if (!await confirm('إيقاف الرابط؟ لن يفتح بعد الآن (يمكن نشر رابط جديد لاحقاً).', 'إيقاف', true)) return; await q(sb.from('briefs').update({ status: 'draft', token: null }).eq('id', b.id)); close(); toast('أُوقف الرابط'); done(); };
      } });
  }
  await modal(`<form id="f" class="pgrid">
    ${field('صلاحية الرابط', sel('days', [['30', 'شهر'], ['90', 'ثلاثة أشهر'], ['365', 'سنة']], '90'))}
    ${field('رمز دخول (اختياري)', inp('pin', '', 'inputmode="numeric" placeholder="مثال 4 أرقام"'))}
    <p class="wide muted small m0">الرابط يفتح بلا حساب على الجوال والحاسب. البنود المرتبطة بمشاريع تعرض وضعها الحيّ من المنصة في كل فتح، وتصلك إشعارات بملاحظات الجهة التنفيذية. يمكن إيقاف الرابط في أي وقت.</p>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">نشر الرابط</button></div></form>`, { title: 'نشر العرض للجهة التنفيذية', onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const t = token();
        try { await q(sb.from('briefs').update({ status: 'published', token: t, pin: f.pin.trim() || null, expires_at: new Date(Date.now() + Number(f.days) * 864e5).toISOString() }).eq('id', b.id)); close(); linkModal(publicUrl(t), b.title, f.pin.trim()); done(); } catch (er) { err(er); } };
    } });
}

// ---------- ملاحظات الجهة التنفيذية
async function notesModal(b, notes, items, done) {
  await modal(`<div class="shares">${notes.length ? notes.map(n => { const it = items.find(x => x.id === n.item_id); return `<div class="shn ${n.seen ? '' : 'new'}"><div><b>${esc(n.name)}</b>${n.role_title ? ` <span class="muted">· ${esc(n.role_title)}</span>` : ''} <span class="muted small">· ${dateAr(n.created_at)}</span>${it ? `<br><span class="badge skel">${esc(it.title)}</span>` : ''}<p class="m0">${esc(n.body)}</p></div><button class="btn sm ghost" data-del="${n.id}" title="حذف">✕</button></div>`; }).join('') : '<p class="muted">لا ملاحظات بعد. تظهر هنا ملاحظات من يفتح الرابط العام.</p>'}</div>`, { title: 'ملاحظات الجهة التنفيذية', wide: true, onOpen: async (w, close) => {
      $$('[data-del]', w).forEach(x => x.onclick = async () => { await q(sb.from('brief_notes').delete().eq('id', +x.dataset.del)); x.closest('.shn').remove(); });
      if (notes.some(n => !n.seen)) await sb.from('brief_notes').update({ seen: true }).eq('brief_id', b.id).eq('seen', false);
    } });
  done();
}
