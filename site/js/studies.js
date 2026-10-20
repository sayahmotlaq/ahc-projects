// ===== الدراسات (قسم المشاريع) + جدول المواد والمواصفات المعتمدة =====
// الدراسة تجمع جداول الكميات وجداول المواصفات قبل بدء المشروع. كل جدول (كميات أو مواصفات) يظهر هنا ما دام بلا مشروع أو مشروعه لم يبدأ التنفيذ.
import { sb, q, session, isAdmin, canEdit, REF, STAGES, stageOf } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, sel, formData, dateAr, ico, fmt, debounce } from './ui.js';

export const NOT_STARTED = ['request', 'study', 'approval', 'design', 'tender', 'award'];
const ST = { draft: 'مسودة', ready: 'جاهزة', converted: 'حُوّلت إلى مشروع', archived: 'مؤرشفة' };
export const SPEC_ST = { draft: 'مسودة', approved: 'معتمد', issued: 'مُسلَّم للمقاول' };
const SUBMIT = [['sample', 'عينة'], ['data', 'بيانات فنية'], ['mockup', 'نموذج تجريبي'], ['test', 'تقرير اختبار']];
const KINDS = ['تطوير وتأهيل', 'إنشاء جديد', 'توسعة', 'تجديد عناصر', 'توريد وتركيب', 'أخرى'];
// اختيار جاهز: التشطيبات الداخلية والأبواب والمصاعد والإنارة
const PRESET = s => (s.startsWith('08') && !['08 44', '08 62', '08 63', '08 91', '08 92', '08 95'].some(x => s.startsWith(x)))
  || s.startsWith('09') || ['10 21', '10 26', '10 28', '12 35', '12 36', '14 21', '14 24', '14 26', '14 27', '14 28', '26 51', '26 52'].some(x => s.startsWith(x));
const canW = () => canEdit();
const badge = (t, c = 'skel') => `<span class="badge ${c}">${esc(t)}</span>`;

// ---------- قائمة الدراسات
export async function mountStudies(root, params) {
  const [studies, boqs, sets, projs, facs] = await Promise.all([
    q(sb.from('studies').select('*').order('updated_at', { ascending: false })),
    q(sb.from('boqs').select('id,name,status,project_id,study_id,pricing,updated_at,created_at').order('created_at', { ascending: false })),
    q(sb.from('spec_sets').select('id,name,status,project_id,study_id,updated_at,created_at').order('created_at', { ascending: false })),
    q(sb.from('projects').select('id,name,facility,stage,archived')),
    q(sb.from('facilities').select('id,name').eq('active', true).order('sort').order('name')),
  ]);
  const P = Object.fromEntries(projs.map(p => [p.id, p])), S = Object.fromEntries(studies.map(s => [s.id, s]));
  // المستند يبقى في الدراسات ما دام بلا مشروع أو مشروعه لم يبدأ التنفيذ
  const inScope = d => !d.project_id || (P[d.project_id] && NOT_STARTED.includes(P[d.project_id].stage) && !P[d.project_id].archived);
  const docs = [...boqs.map(b => ({ ...b, t: 'boq' })), ...sets.map(x => ({ ...x, t: 'spec' }))].filter(inScope);
  let tab = params.get('v') || 'studies', fq = '';
  const owner = d => d.project_id && P[d.project_id] ? { n: P[d.project_id].name, h: '#/project/' + d.project_id, f: P[d.project_id].facility, st: P[d.project_id].stage } : d.study_id && S[d.study_id] ? { n: S[d.study_id].title, h: '#/studies/' + d.study_id, f: S[d.study_id].facility } : { n: '—', h: '', f: '' };
  const docHref = d => d.t === 'spec' ? '#/spec/' + d.id : d.study_id && !d.project_id ? `#/studies/${d.study_id}/boq/${d.id}` : `#/project/${d.project_id}/boq/${d.id}`;
  const render = () => {
    const active = studies.filter(s => s.status !== 'archived' && s.status !== 'converted' || tab === 'all');
    const list = (tab === 'studies' ? studies.filter(s => !['archived', 'converted'].includes(s.status)) : tab === 'done' ? studies.filter(s => ['archived', 'converted'].includes(s.status)) : [])
      .filter(s => !fq || (s.title + ' ' + s.facility).includes(fq));
    const nDocs = sid => docs.filter(d => d.study_id === sid);
    root.querySelector('#stBody').innerHTML = tab === 'docs'
      ? (docs.length ? `<div class="pcard flat"><table class="lst"><thead><tr><th>المستند</th><th>النوع</th><th>يتبع</th><th>المنشأة</th><th>الحالة</th><th>آخر تحديث</th></tr></thead><tbody>${docs.filter(d => !fq || (d.name + owner(d).n + owner(d).f).includes(fq)).map(d => { const o = owner(d); return `<tr><td><a href="${docHref(d)}"><b>${esc(d.name)}</b></a></td><td>${d.t === 'spec' ? badge('مواد ومواصفات', 'info') : badge(d.pricing === 'lumpsum' ? 'كميات — مقطوعية' : 'جدول كميات')}</td><td>${o.h ? `<a href="${o.h}">${esc(o.n)}</a>` : '—'}${o.st ? ` <span class="muted small">(${esc(stageOf(o.st).ar)})</span>` : ''}</td><td>${esc(o.f || '—')}</td><td>${esc((d.t === 'spec' ? SPEC_ST : { draft: 'مسودة', approved: 'معتمد', tender: 'طرح', awarded: 'ترسية', final: 'ختامي' })[d.status] || d.status)}</td><td>${dateAr(d.updated_at || d.created_at)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty-boq">لا مستندات تحت الدراسة.</div>')
      : (list.length ? `<div class="stgrid">${list.map(s => { const dd = nDocs(s.id); return `<a class="pcard stcard" href="#/studies/${s.id}"><div class="stc-h"><b>${esc(s.title)}</b>${badge(ST[s.status], s.status === 'ready' ? 'ok' : 'skel')}</div><div class="muted small">${esc(s.facility || 'بلا منشأة')}${s.kind ? ' · ' + esc(s.kind) : ''}</div>
          <div class="stc-f"><span>${ico('coins')} ${dd.filter(d => d.t === 'boq').length} جدول كميات</span><span>${ico('file')} ${dd.filter(d => d.t === 'spec').length} مواد ومواصفات</span><span class="sp"></span><span class="muted small">${dateAr(s.updated_at)}</span></div>${s.project_id && P[s.project_id] ? `<div class="small">${ico('folder')} ${esc(P[s.project_id].name)}</div>` : ''}</a>`; }).join('')}</div>`
        : `<div class="empty-boq">${tab === 'done' ? 'لا دراسات محوّلة أو مؤرشفة.' : 'لا دراسات بعد. ابدأ دراسة جديدة، أو من صفحة المنشأة.'}</div>`);
  };
  root.innerHTML = `<div class="fmhead"><div class="fmhead-t"><h1 class="pagetitle">الدراسات</h1><p class="muted m0">كل جدول كميات وجدول مواد ومواصفات يبقى هنا حتى يبدأ مشروعه، وتُنشأ الدراسة من هنا أو من المنشأة أو من المشروع.</p></div>${canW() ? '<div class="fmhead-a"><button class="btn primary" id="stNew">＋ دراسة جديدة</button></div>' : ''}</div>
    <div class="toolbar"><nav class="fmtabs m0" style="border:0">${[['studies', `الدراسات القائمة <b class="fmcnt">${studies.filter(s => !['archived', 'converted'].includes(s.status)).length}</b>`], ['docs', `كل الجداول تحت الدراسة <b class="fmcnt">${docs.length}</b>`], ['done', 'المحوّلة والمؤرشفة']].map(([k, v]) => `<a href="#/studies?v=${k}" class="${tab === k ? 'on' : ''}">${v}</a>`).join('')}</nav><span class="sp"></span><input id="stQ" class="stq" placeholder="بحث في الدراسات والجداول…"></div>
    <div id="stBody"></div>`;
  $('#stQ', root).oninput = debounce(e => { fq = e.target.value.trim(); render(); }, 200);
  $('#stNew', root) && ($('#stNew', root).onclick = () => studyForm(null, facs));
  render();
  if (params.get('new') && canW()) studyForm(null, facs, +params.get('fac') || null);
}

async function studyForm(s, facs, facId = null) {
  facs ||= await q(sb.from('facilities').select('id,name').eq('active', true).order('sort').order('name'));
  const v = s || { title: '', facility_id: facId, kind: KINDS[0], status: 'draft', notes: '' };
  await modal(`<form id="f" class="pgrid">${field('عنوان الدراسة *', inp('title', v.title, 'required placeholder="مثال: تأهيل غرف العمليات — مستشفى الجبر"'), 'wide')}
    ${field('المنشأة', sel('facility_id', [['', '— بلا منشأة —'], ...facs.map(f => [f.id, f.name])], v.facility_id || ''))}${field('نوع الأعمال', sel('kind', KINDS, v.kind || KINDS[0]))}
    ${s ? field('الحالة', sel('status', Object.entries(ST).filter(([k]) => k !== 'converted' || s.status === 'converted'), v.status)) : ''}
    ${field('ملاحظات', '<textarea name="notes" rows="3">' + esc(v.notes || '') + '</textarea>', 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${s ? 'حفظ' : 'إنشاء الدراسة'}</button></div></form>`, { title: s ? 'تعديل الدراسة' : 'دراسة جديدة', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const fac = facs.find(f => f.id === +x.facility_id);
      const row = { title: x.title.trim(), facility_id: fac ? fac.id : null, facility: fac ? fac.name : '', kind: x.kind, notes: x.notes.trim(), ...(s ? { status: x.status } : {}) };
      try { if (s) { await q(sb.from('studies').update(row).eq('id', s.id)); close(); location.reload(); }
        else { const r = await q(sb.from('studies').insert({ ...row, created_by: session.user.id }).select('id').single()); close(); location.hash = '#/studies/' + r.id; } } catch (er) { err(er); } };
  } });
}

// ---------- صفحة الدراسة
export async function mountStudy(root, id, sub, subId) {
  const s = await q(sb.from('studies').select('*').eq('id', id).maybeSingle());
  if (!s) { root.innerHTML = '<div class="empty-boq">الدراسة غير موجودة</div>'; return; }
  const pseudo = { id: null, name: s.title, facility: s.facility, type: s.kind, ref: '', dept: '' };
  if (sub === 'boq' && subId) { const { mountBoq } = await import('./boq.js'); return mountBoq(root, subId, pseudo, () => location.hash = '#/studies/' + id); }
  const [boqs, sets, prj] = await Promise.all([
    q(sb.from('boqs').select('*').eq('study_id', id).order('created_at')),
    q(sb.from('spec_sets').select('*').eq('study_id', id).order('created_at')),
    s.project_id ? q(sb.from('projects').select('id,name,stage').eq('id', s.project_id).maybeSingle()) : null,
  ]);
  const w = canW() && s.status !== 'archived';
  root.innerHTML = `<div class="phead"><div class="crumb"><a href="#/studies">الدراسات</a><span class="sep">‹</span><span>${esc(s.title)}</span></div>
    <div class="ptitle"><div><h1>${esc(s.title)}</h1><div class="muted small" style="display:flex;flex-wrap:wrap;gap:4px 14px"><span>${esc(s.facility || 'بلا منشأة')}</span>${s.kind ? `<span>${esc(s.kind)}</span>` : ''}<span>أُنشئت ${dateAr(s.created_at)}</span></div></div>
    <div class="btnrow">${badge(ST[s.status], s.status === 'ready' ? 'ok' : 'skel')}${prj ? `<a class="btn" href="#/project/${prj.id}">${ico('folder')} المشروع: ${esc(prj.name)}</a>` : ''}${w ? `<button class="btn" id="sEdit">تعديل</button>${!prj ? '<button class="btn primary" id="sConv">تحويل إلى مشروع</button>' : ''}` : ''}</div></div></div>
    ${s.notes ? `<div class="pcard"><p class="m0" style="white-space:pre-wrap">${esc(s.notes)}</p></div>` : ''}
    <div class="fm2col"><div class="pcard"><div class="toolbar m0"><h2 class="m0">جداول الكميات</h2><span class="sp"></span>${w ? '<button class="btn sm primary" id="bNew">＋ جدول كميات</button>' : ''}</div>
      ${boqs.length ? `<div class="plist">${boqs.map(b => `<a class="pitem" href="${b.project_id ? `#/project/${b.project_id}/boq/${b.id}` : `#/studies/${id}/boq/${b.id}`}"><div class="nm">${esc(b.name)} ${badge({ draft: 'مسودة', approved: 'معتمد', tender: 'طرح', awarded: 'ترسية', final: 'ختامي' }[b.status] || b.status)}</div><div class="sub">${b.pricing === 'lumpsum' ? 'مقطوعية' : 'بالوحدة'} · ${dateAr(b.created_at)}</div></a>`).join('')}</div>` : '<p class="muted">لا جداول كميات بعد.</p>'}</div>
    <div class="pcard"><div class="toolbar m0"><h2 class="m0">جداول المواد والمواصفات المعتمدة</h2><span class="sp"></span>${w ? '<button class="btn sm primary" id="spNew">＋ جدول مواد ومواصفات</button>' : ''}</div>
      ${sets.length ? `<div class="plist">${sets.map(x => `<a class="pitem" href="#/spec/${x.id}"><div class="nm">${esc(x.name)} ${badge(SPEC_ST[x.status])}</div><div class="sub">${x.contractor ? esc(x.contractor) + ' · ' : ''}${dateAr(x.updated_at)}</div></a>`).join('')}</div>` : '<p class="muted">لا جداول مواد ومواصفات بعد.</p>'}</div></div>`;
  $('#sEdit', root) && ($('#sEdit', root).onclick = () => studyForm(s));
  $('#bNew', root) && ($('#bNew', root).onclick = async () => { try { const b = await q(sb.from('boqs').insert({ study_id: id, name: boqs.length ? 'إصدار ' + (boqs.length + 1) : 'تقديري', status: 'draft', created_by: session.user.id }).select('id').single()); location.hash = `#/studies/${id}/boq/${b.id}`; } catch (e) { err(e); } });
  $('#spNew', root) && ($('#spNew', root).onclick = () => newSpecSet({ study_id: id }));
  $('#sConv', root) && ($('#sConv', root).onclick = () => convert(s, boqs, sets));
}

async function convert(s, boqs, sets) {
  const ok = await confirm(`سيُنشأ مشروع جديد «${s.title}» بمرحلة «دراسة»، وتنتقل إليه جداول الدراسة (${boqs.length} كميات، ${sets.length} مواصفات). تبقى ظاهرة في الدراسات حتى يبدأ التنفيذ.`, 'إنشاء المشروع');
  if (!ok) return;
  try {
    const p = await q(sb.from('projects').insert({ name: s.title, facility: s.facility || '', facility_id: s.facility_id, type: s.kind === 'إنشاء جديد' ? 'إنشاء جديد' : s.kind === 'توسعة' ? 'توسعة' : 'تجديد وتأهيل', stage: 'study', engineer_id: session.user.id, engineer_name: session.profile?.full_name || '', created_by: session.user.id, notes: s.notes || null }).select('id').single());
    await sb.from('project_stage_log').insert({ project_id: p.id, from_stage: null, to_stage: 'study', note: 'إنشاء من الدراسة: ' + s.title, by_user: session.user.id });
    if (boqs.length) await q(sb.from('boqs').update({ project_id: p.id }).eq('study_id', s.id));
    if (sets.length) await q(sb.from('spec_sets').update({ project_id: p.id }).eq('study_id', s.id));
    await q(sb.from('studies').update({ project_id: p.id, status: 'converted' }).eq('id', s.id));
    toast('أُنشئ المشروع'); location.hash = '#/project/' + p.id;
  } catch (e) { err(e); }
}

// ---------- جداول المواد والمواصفات داخل المشروع
export async function projectSpecs(t, p) {
  const sets = await q(sb.from('spec_sets').select('*').eq('project_id', p.id).order('created_at'));
  t.innerHTML = `<div class="pcard"><div class="toolbar"><h2><span class="ic"></span>جداول المواد والمواصفات المعتمدة</h2><span class="sp"></span>${canW() ? '<button class="btn primary" id="spNew">＋ جدول مواد ومواصفات</button>' : ''}</div>
    <p class="muted small m0">قائمة البنود المعتمدة للمقاول بمواصفاتها من المرجع الفني الموحد: تختار الأقسام فتُعرض كل البنود، وتحذف ما لا يلزم، وتحدد الخيارات وأماكن الاستخدام والمصنّعين وما يُقدَّم للاعتماد.</p>
    ${sets.length ? `<div class="plist mt8">${sets.map(x => `<a class="pitem" href="#/spec/${x.id}"><div class="nm">${esc(x.name)} ${badge(SPEC_ST[x.status])}</div><div class="sub">${x.contractor ? esc(x.contractor) + ' · ' : ''}${dateAr(x.updated_at)}</div></a>`).join('')}</div>` : '<div class="empty-boq">لا جداول مواد ومواصفات لهذا المشروع بعد.</div>'}</div>`;
  $('#spNew', t) && ($('#spNew', t).onclick = () => newSpecSet({ project_id: p.id }));
}

// ---------- إنشاء جدول مواد ومواصفات: اختيار الأقسام
function secTree(chosen) {
  const cnt = s => s.items.filter(i => i.active !== false).length;
  return REF.divisions.filter(d => d.sections.some(cnt)).map(d => `<details class="sptree" ${d.sections.some(s => chosen.has(s.code)) ? 'open' : ''}><summary><label><input type="checkbox" data-div="${d.code}" ${d.sections.filter(cnt).every(s => chosen.has(s.code)) ? 'checked' : ''}> <b>${d.code}</b> ${esc(d.ar)}</label><span class="muted small">${d.sections.reduce((a, s) => a + cnt(s), 0)} بنداً</span></summary>
    <div>${d.sections.filter(cnt).map(s => `<label class="chk"><input type="checkbox" data-sec="${s.code}" ${chosen.has(s.code) ? 'checked' : ''}> <span class="ltr small">${s.code}</span> ${esc(s.ar)} <span class="muted small">(${cnt(s)})</span></label>`).join('')}</div></details>`).join('');
}
async function newSpecSet(owner) {
  const chosen = new Set(REF.sections.filter(s => PRESET(s.code)).map(s => s.code));
  await modal(`<form id="f" class="pgrid"><div class="wide">${field('اسم الجدول', inp('name', 'جدول المواد والمواصفات المعتمدة'))}</div>${field('المقاول (اختياري)', inp('contractor', ''))}
    <div class="wide"><div class="toolbar m0"><b>الأقسام المشمولة</b><span class="sp"></span><button type="button" class="btn sm" id="pre">التشطيبات والأبواب والمصاعد والإنارة</button><button type="button" class="btn sm ghost" id="none">إلغاء الكل</button></div>
      <p class="muted small m0">تُعرض كل بنود الأقسام المختارة بكل خياراتها، ثم تحذف ما لا يلزم من داخل الجدول.</p><div id="tree" class="sptreewrap">${secTree(chosen)}</div><div class="small" id="cnt"></div></div>
    <div class="btnrow end wide"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إنشاء الجدول</button></div></form>`, { title: 'جدول مواد ومواصفات جديد', wide: true, onOpen: (w, close) => {
    const upd = () => { const n = REF.items.filter(i => i.active !== false && chosen.has(i.section_code)).length; $('#cnt', w).textContent = `${chosen.size} قسماً · ${n} بنداً`; };
    const bind = () => {
      $$('[data-sec]', w).forEach(c => c.onchange = () => { c.checked ? chosen.add(c.dataset.sec) : chosen.delete(c.dataset.sec); upd(); });
      $$('[data-div]', w).forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = () => { REF.byDiv[c.dataset.div].sections.forEach(s => c.checked ? chosen.add(s.code) : chosen.delete(s.code)); $('#tree', w).innerHTML = secTree(chosen); bind(); upd(); }; });
    };
    bind(); upd();
    $('#pre', w).onclick = () => { chosen.clear(); REF.sections.filter(s => PRESET(s.code)).forEach(s => chosen.add(s.code)); $('#tree', w).innerHTML = secTree(chosen); bind(); upd(); };
    $('#none', w).onclick = () => { chosen.clear(); $('#tree', w).innerHTML = secTree(chosen); bind(); upd(); };
    $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); if (!chosen.size) return toast('اختر قسماً واحداً على الأقل', 'bad');
      const btn = e.submitter; btn.disabled = true;
      try {
        const set = await q(sb.from('spec_sets').insert({ ...owner, name: x.name.trim() || 'جدول المواد والمواصفات المعتمدة', contractor: x.contractor.trim(), created_by: session.user.id }).select('id').single());
        const items = REF.items.filter(i => i.active !== false && chosen.has(i.section_code));
        const rows = items.map((it, k) => ({ set_id: set.id, item_code: it.code, variants: it.variants.filter(v => v.active !== false).map(v => v.code), submit: ['sample', 'data'], sort: k }));
        for (let i = 0; i < rows.length; i += 300) await q(sb.from('spec_lines').insert(rows.slice(i, i + 300)));
        close(); location.hash = '#/spec/' + set.id;
      } catch (er) { btn.disabled = false; err(er); } };
  } });
}

// ---------- محرر جدول المواد والمواصفات
export async function mountSpec(root, id, params) {
  const set = await q(sb.from('spec_sets').select('*').eq('id', id).maybeSingle());
  if (!set) { root.innerHTML = '<div class="empty-boq">الجدول غير موجود</div>'; return; }
  const [lines, study, prj] = await Promise.all([
    q(sb.from('spec_lines').select('*').eq('set_id', id).order('item_code')),
    set.study_id ? q(sb.from('studies').select('id,title,facility,kind').eq('id', set.study_id).maybeSingle()) : null,
    set.project_id ? q(sb.from('projects').select('id,name,ref,facility,type,dept,engineer_name').eq('id', set.project_id).maybeSingle()) : null,
  ]);
  lines.forEach(l => { l.variants ||= []; l.submit ||= []; });
  const own = prj ? { n: prj.name, h: '#/project/' + prj.id + '/specs', f: prj.facility } : study ? { n: study.title, h: '#/studies/' + study.id, f: study.facility } : { n: '—', h: '#/studies', f: '' };
  const w = canW() && set.status !== 'issued' || isAdmin();
  let fq = '', print = params?.get('print') === '1';
  const L = Object.fromEntries(lines.map(l => [l.item_code, l]));
  const groups = () => { const by = {}; lines.forEach(l => { const it = REF.byItem[l.item_code]; if (!it) return; const d = it.div?.code || l.item_code.slice(0, 2), s = it.section_code; (by[d] ||= {}); (by[d][s] ||= []).push(l); }); return by; };
  const save = (l, patch) => { l._p = { ...(l._p || {}), ...patch }; clearTimeout(l._t);
    l._t = setTimeout(async () => { const p = l._p; l._p = null; try { await q(sb.from('spec_lines').update(p).eq('id', l.id)); flash(); } catch (e) { err(e); } }, 450); };
  const flash = () => { const s = $('#spSaved', root); if (s) { s.textContent = 'حُفظ'; clearTimeout(s._t); s._t = setTimeout(() => s.textContent = '', 1500); } };
  const head = () => `<div class="phead"><div class="crumb"><a href="#/studies">الدراسات</a><span class="sep">‹</span><a href="${own.h}">${esc(own.n)}</a><span class="sep">‹</span><span>${esc(set.name)}</span></div>
    <div class="ptitle"><div><h1>${esc(set.name)}</h1><div class="muted small" style="display:flex;flex-wrap:wrap;gap:4px 14px"><span>${esc(own.n)}</span>${own.f ? `<span>${esc(own.f)}</span>` : ''}${set.contractor ? `<span>المقاول: ${esc(set.contractor)}</span>` : ''}<span>${lines.length} بنداً</span><span id="spSaved" class="ok"></span></div></div>
    <div class="btnrow">${badge(SPEC_ST[set.status], set.status === 'draft' ? 'skel' : 'ok')}${w ? '<button class="btn" id="spEdit">البيانات والحالة</button><button class="btn" id="spAdd">＋ إضافة بنود</button>' : ''}<button class="btn" id="spPrint">${ico('print')} ${print ? 'عرض التحرير' : 'عرض للطباعة / PDF'}</button><button class="btn primary" id="spXl">${ico('download')} Excel</button></div></div></div>`;
  const vchip = (l, v) => `<button class="spv ${l.variants.includes(v.code) ? 'on' : ''}" data-l="${l.id}" data-v="${v.code}" ${w ? '' : 'disabled'} title="${esc(v.spec || '')}"><span class="ltr">${v.code.slice(-2)}</span> ${esc(v.ar)}</button>`;
  const lineHtml = l => { const it = REF.byItem[l.item_code];
    return `<div class="spl" data-id="${l.id}"><div class="spl-h"><a class="ltr cd" href="#/ref/${l.item_code.replace(/ /g, '-')}" target="_blank">${l.item_code}</a><b>${esc(it.ar)}</b><span class="muted small ltr">${esc(it.en || '')}</span>${it.status !== 'full' ? badge('مواصفة مختصرة') : ''}<span class="sp"></span>${w ? `<button class="iconbtn" data-del="${l.id}" title="حذف البند من الجدول">✕</button>` : ''}</div>
      ${it.variants.length ? `<div class="spvs"><span class="muted small">الخيارات المعتمدة:</span>${it.variants.filter(v => v.active !== false).map(v => vchip(l, v)).join('')}</div>` : ''}
      <div class="spf"><label><span>أماكن الاستخدام</span><input data-f="locs" value="${esc(l.locs || '')}" placeholder="مثال: غرف العمليات، الممرات" ${w ? '' : 'disabled'}></label>
        <label><span>المصنّعون المعتمدون</span><input data-f="makers" value="${esc(l.makers || '')}" placeholder="يُعبّأ لاحقاً" ${w ? '' : 'disabled'}></label>
        <label><span>ملاحظة للمشروع</span><input data-f="note" value="${esc(l.note || '')}" ${w ? '' : 'disabled'}></label>
        <div class="spsub"><span>يُقدَّم للاعتماد</span>${SUBMIT.map(([k, t]) => `<label class="chk"><input type="checkbox" data-s="${k}" ${l.submit.includes(k) ? 'checked' : ''} ${w ? '' : 'disabled'}> ${t}</label>`).join('')}</div></div></div>`; };
  const render = () => {
    const G = groups();
    const match = l => { if (!fq) return true; const it = REF.byItem[l.item_code]; return (l.item_code + it.ar + (it.en || '') + l.locs + l.makers).toLowerCase().includes(fq.toLowerCase()); };
    root.innerHTML = head() + (print ? printView(G) : `<div class="toolbar sptool"><input id="spQ" placeholder="بحث في البنود…" value="${esc(fq)}"><span class="muted small">${lines.filter(l => !l.makers).length} بنداً بلا مصنّعين</span><span class="sp"></span><span class="muted small">اضغط الخيار لإلغائه أو إعادته، و✕ لحذف البند.</span></div>
      ${Object.keys(G).sort().map(d => { const div = REF.byDiv[d]; return `<section class="pcard spdiv"><h2>الشعبة ${d} — ${esc(div?.ar || '')}</h2>${Object.keys(G[d]).sort().map(sc => { const ls = G[d][sc].filter(match); if (!ls.length) return ''; return `<div class="spsec"><div class="spsec-h"><b><span class="ltr">${sc}</span> ${esc(REF.bySec[sc]?.ar || '')}</b><span class="muted small">${ls.length}</span><span class="sp"></span>${w ? `<button class="btn sm ghost" data-delsec="${sc}">حذف القسم</button>` : ''}</div>${ls.map(lineHtml).join('')}</div>`; }).join('')}</section>`; }).join('') || '<div class="empty-boq">الجدول فارغ. أضف بنوداً.</div>'}`);
    bind();
  };
  const bind = () => {
    $('#spPrint', root).onclick = () => { print = !print; render(); if (print) setTimeout(() => window.print(), 300); };
    $('#spXl', root).onclick = () => exportSpecXlsx(set, lines, { name: own.n, facility: own.f, ref: prj?.ref || '', type: prj?.type || study?.kind || '', dept: prj?.dept || '', engineer_name: prj?.engineer_name || '' });
    $('#spEdit', root) && ($('#spEdit', root).onclick = () => editSet(set, () => mountSpec(root, id, params)));
    $('#spAdd', root) && ($('#spAdd', root).onclick = () => addItems(set, lines, () => mountSpec(root, id, params)));
    if (print) return;
    $('#spQ', root).oninput = debounce(e => { fq = e.target.value.trim(); const p = e.target.selectionStart; render(); const i = $('#spQ', root); i.focus(); i.setSelectionRange(p, p); }, 250);
    $$('.spv', root).forEach(b => b.onclick = () => { const l = lines.find(x => x.id === +b.dataset.l); const v = b.dataset.v; const vs = l.variants.includes(v) ? l.variants.filter(x => x !== v) : [...l.variants, v].sort(); b.classList.toggle('on'); l.variants = vs; save(l, { variants: vs }); });
    $$('.spl', root).forEach(el => { const l = lines.find(x => x.id === +el.dataset.id);
      $$('[data-f]', el).forEach(i => i.oninput = () => { l[i.dataset.f] = i.value; save(l, { [i.dataset.f]: i.value.trim() }); });
      $$('[data-s]', el).forEach(c => c.onchange = () => { const s = $$('[data-s]', el).filter(x => x.checked).map(x => x.dataset.s); l.submit = s; save(l, { submit: s }); }); });
    $$('[data-del]', root).forEach(b => b.onclick = async () => { try { await q(sb.from('spec_lines').delete().eq('id', +b.dataset.del)); const k = lines.findIndex(x => x.id === +b.dataset.del); lines.splice(k, 1); b.closest('.spl').remove(); flash(); } catch (e) { err(e); } });
    $$('[data-delsec]', root).forEach(b => b.onclick = async () => { const sc = b.dataset.delsec; const ids = lines.filter(l => REF.byItem[l.item_code]?.section_code === sc).map(l => l.id);
      if (!(await confirm(`حذف ${ids.length} بنداً من قسم ${REF.bySec[sc]?.ar || sc}؟`, 'حذف', true))) return;
      try { await q(sb.from('spec_lines').delete().in('id', ids)); ids.forEach(i => lines.splice(lines.findIndex(x => x.id === i), 1)); render(); } catch (e) { err(e); } });
  };
  // عرض الطباعة: جدول المواد ثم المواصفات المختصرة لكل بند
  const printView = G => { let n = 0; return `<div class="spdoc"><div class="spdoc-h"><img src="assets/logo.png" alt=""><div><b>تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع</b><h2>${esc(set.name)}</h2><span>${esc(own.n)}${own.f ? ' · ' + esc(own.f) : ''}${set.contractor ? ' · المقاول: ' + esc(set.contractor) : ''} · ${dateAr(new Date().toISOString())}</span></div></div>
    <table class="sptbl"><thead><tr><th>م</th><th>الكود</th><th>البند والخيارات المعتمدة</th><th>أماكن الاستخدام</th><th>المصنّعون المعتمدون</th><th>يُقدَّم للاعتماد</th></tr></thead><tbody>
    ${Object.keys(G).sort().map(d => `<tr class="dv"><td colspan="6">الشعبة ${d} — ${esc(REF.byDiv[d]?.ar || '')}</td></tr>` + Object.keys(G[d]).sort().flatMap(sc => G[d][sc]).map(l => { const it = REF.byItem[l.item_code]; const vs = l.variants.map(c => REF.byVar[c]).filter(Boolean); n++;
      return `<tr><td>${n}</td><td class="ltr">${l.item_code}</td><td><b>${esc(it.ar)}</b>${vs.length ? `<ul>${vs.map(v => `<li>${esc(v.ar)}${v.spec ? ` — <span class="muted">${esc(v.spec)}</span>` : ''}</li>`).join('')}</ul>` : ''}${l.note ? `<div class="small">ملاحظة: ${esc(l.note)}</div>` : ''}</td><td>${esc(l.locs || '—')}</td><td>${esc(l.makers || '—')}</td><td>${l.submit.map(s => SUBMIT.find(x => x[0] === s)?.[1]).filter(Boolean).join('، ') || '—'}</td></tr>`; }).join('')).join('')}</tbody></table>
    <div class="spnote">المواصفات الفنية التفصيلية لكل بند (المتطلبات، متطلبات المنشآت الصحية ومكافحة العدوى، معايير القبول، طريقة التنفيذ، المراجع) في ملف Excel المرفق وفي المرجع الفني الموحد بالكود نفسه، وهي جزء لا يتجزأ من هذا الجدول. أي مادة خارج هذا الجدول أو بمصنّع غير مدرج تحتاج اعتماداً مكتوباً من المالك قبل التوريد.</div>
    <div class="spsign"><div>إعداد: مهندس المشروع<br>الاسم:<br>التوقيع:</div><div>مراجعة: رئيس قسم المشاريع<br>الاسم:<br>التوقيع:</div><div>اعتماد: مدير إدارة الخدمات الفنية<br>الاسم:<br>التوقيع:</div></div></div>`; };
  render();
}

async function editSet(set, done) {
  await modal(`<form id="f" class="pgrid">${field('اسم الجدول', inp('name', set.name), 'wide')}${field('المقاول', inp('contractor', set.contractor || ''))}${field('الحالة', sel('status', Object.entries(SPEC_ST), set.status))}
    ${field('ملاحظات عامة', '<textarea name="notes" rows="3">' + esc(set.notes || '') + '</textarea>', 'wide')}
    <div class="btnrow end wide"><button type="button" class="btn danger" id="del">حذف الجدول</button><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'بيانات الجدول', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); try { await q(sb.from('spec_sets').update({ name: x.name.trim(), contractor: x.contractor.trim(), status: x.status, notes: x.notes.trim() }).eq('id', set.id)); close(); done(); } catch (er) { err(er); } };
    $('#del', w).onclick = async () => { if (!(await confirm('حذف الجدول وكل بنوده نهائياً؟', 'حذف', true))) return; try { await q(sb.from('spec_sets').delete().eq('id', set.id)); close(); location.hash = set.project_id ? `#/project/${set.project_id}/specs` : set.study_id ? '#/studies/' + set.study_id : '#/studies'; } catch (er) { err(er); } };
  } });
}

async function addItems(set, lines, done) {
  const have = new Set(lines.map(l => l.item_code));
  await modal(`<div><input id="aq" placeholder="ابحث بالاسم أو الكود (مثال: باب، 09 65، فينيل)…" autofocus><div class="toolbar m0 mt8"><span class="muted small">أو أضف قسماً كاملاً:</span><select id="asec"><option value="">— قسم —</option>${REF.sections.filter(s => s.items.some(i => !have.has(i.code))).map(s => `<option value="${s.code}">${s.code} ${esc(s.ar)}</option>`).join('')}</select><button class="btn sm" id="asecB">إضافة القسم</button></div><div id="ares" class="spadd"></div></div>`, { title: 'إضافة بنود', wide: true, onOpen: (w, close) => {
    const ins = async items => { const rows = items.filter(it => !have.has(it.code)).map((it, k) => ({ set_id: set.id, item_code: it.code, variants: it.variants.filter(v => v.active !== false).map(v => v.code), submit: ['sample', 'data'], sort: 1000 + k }));
      if (!rows.length) return toast('موجودة مسبقاً'); try { await q(sb.from('spec_lines').insert(rows)); rows.forEach(r => have.add(r.item_code)); toast(`أُضيف ${rows.length}`); return true; } catch (e) { err(e); } };
    const find = () => { const t = $('#aq', w).value.trim().toLowerCase(); if (t.length < 2) { $('#ares', w).innerHTML = ''; return; }
      const res = REF.items.filter(i => i.active !== false && (i.code.includes(t) || i.ar.toLowerCase().includes(t) || (i.en || '').toLowerCase().includes(t) || i.keywords.some(k => k.toLowerCase().includes(t)))).slice(0, 40);
      $('#ares', w).innerHTML = res.map(i => `<div class="pitem"><div class="nm"><span class="ltr cd">${i.code}</span> ${esc(i.ar)} ${i.status !== 'full' ? badge('مختصرة') : ''}</div><div class="sub">${esc(i.sec?.ar || '')}</div>${have.has(i.code) ? badge('موجود', 'ok') : `<button class="btn sm" data-a="${i.code}">إضافة</button>`}</div>`).join('') || '<p class="muted">لا نتائج.</p>';
      $$('[data-a]', w).forEach(b => b.onclick = async () => { if (await ins([REF.byItem[b.dataset.a]])) b.outerHTML = badge('أُضيف', 'ok'); }); };
    $('#aq', w).oninput = debounce(find, 200);
    $('#asecB', w).onclick = async () => { const sc = $('#asec', w).value; if (!sc) return; if (await ins(REF.bySec[sc].items.filter(i => i.active !== false))) { close(); done(); } };
    w.addEventListener('click', e => { if (e.target === w || e.target.hasAttribute('data-x')) done(); });
  } });
}

// ---------- تصدير Excel: جدول المواد المعتمدة + المواصفات الفنية التفصيلية
async function exportSpecXlsx(set, lines, prj) {
  if (!lines.length) return toast('الجدول فارغ');
  toast('جارٍ إعداد ملف Excel…');
  try {
    const codes = lines.map(l => l.item_code), full = {};
    for (let i = 0; i < codes.length; i += 150) (await q(sb.from('items').select('*').in('code', codes.slice(i, i + 150)))).forEach(it => full[it.code] = it);
    const { exportSpecExcel } = await import('./excel.js'); const { logo } = await import('./boq.js');
    await exportSpecExcel({ ...prj, date: new Date().toISOString().slice(0, 10), contractor: set.contractor, setName: set.name, notes: set.notes, status: SPEC_ST[set.status] }, lines.map(l => ({ ...l, it: { ...REF.byItem[l.item_code], ...full[l.item_code] }, vs: l.variants.map(c => REF.byVar[c]).filter(Boolean) })), REF, SUBMIT, await logo());
  } catch (e) { err(e); }
}
