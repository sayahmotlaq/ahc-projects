// ===== أدلة المنشآت (R-42): دليل التشغيل والصيانة ودليل مستخدمي المنشأة — قالب حوكمة + بيانات المنشأة من المنصة =====
import { sb, q, session, isAdmin, canEdit } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, sel, formData, ico, dateAr } from './ui.js';

const KIND = { om: 'دليل التشغيل والصيانة', user: 'دليل مستخدمي المنشأة' };
const STATUS = { draft: ['مسودة', 'skel'], issued: ['معتمد', 'full'] };
const canWrite = () => isAdmin() || canEdit() || ['PRJ', 'FAC', 'MNT', 'SAF'].includes(session.profile?.unit);
const FRAME = { K: 'cal', A: 'auth', C: 'comm', PL: 'plan', RK: 'risk' };
// إحالات الحوكمة داخل النص: G-04 ← الإجراء، R-14 ← القاعدة، K-/A-/C-/PL-/RK- ← الإطار الإداري
const linkify = s => esc(s).replace(/\b(PL|RK|[A-Z])-(\d{2})\b/g, (m, p) => p === 'R' ? `<a class="gref in" href="#/gov/rules/${m}">${m}</a>` : FRAME[p] ? `<a class="gref in" href="#/gov/frame/${FRAME[p]}?h=${m}">${m}</a>` : `<a class="gref in" href="#/gov/sop/${m}">${m}</a>`);
const fmt = (txt, tok) => { const lines = String(txt || '').replace(/\{(\w+)\}/g, (m, k) => tok[k] || '—').split('\n'); let h = '', ul = false;
  const close = () => { if (ul) { h += '</ul>'; ul = false; } };
  for (const raw of lines) { const l = raw.trim(); if (!l) { close(); continue; }
    if (l.startsWith('- ')) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${linkify(l.slice(2))}</li>`; continue; }
    close();
    if (l.startsWith('## ')) h += `<h4>${esc(l.slice(3))}</h4>`; else if (l.startsWith('! ')) h += `<div class="mn-warn">${ico('alert')}<span>${linkify(l.slice(2))}</span></div>`; else if (l.startsWith('> ')) h += `<p class="mn-note">${linkify(l.slice(2))}</p>`; else h += `<p>${linkify(l)}</p>`; }
  close(); return h; };
const tbl = (cols, rows, empty) => rows.length ? `<div class="tblwrap"><table class="mn-t"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="mn-empty">${esc(empty)}</p>`;
const per = { day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' };
const FKIND = { hospital: 'مستشفى', center: 'مركز صحي', phc: 'مركز رعاية أولية', admin: 'مبنى إداري' };
const CRIT = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

export async function mountManuals(root, id, params) {
  if (id) return viewManual(root, +id);
  const [rows, facs, projs] = await Promise.all([
    q(sb.from('facility_manuals').select('id,kind,facility_id,project_id,title,status,version,updated_at,issued_at').order('updated_at', { ascending: false })),
    q(sb.from('facilities').select('id,name').eq('active', true).order('sort')),
    q(sb.from('projects').select('id,name,facility_id,stage').eq('archived', false).order('name'))]);
  const F = Object.fromEntries(facs.map(f => [f.id, f.name])), PJ = Object.fromEntries(projs.map(p => [p.id, p.name]));
  const byFac = {}; rows.forEach(r => (byFac[r.facility_id] ||= []).push(r));
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">أدلة المنشآت</h1><span class="muted small">دليلان لكل منشأة تُسلَّم: للتشغيل والصيانة، ولمستخدميها — لا تسليم بلا دليل (<a class="gref in" href="#/gov/rules/R-42">R-42</a>)</span><span class="sp"></span>${isAdmin() ? `<button class="btn sm ghost" id="mTpl">${ico('edit')} قوالب الأدلة</button>` : ''}${canWrite() ? `<button class="btn sm primary" id="mNew">＋ أدلة منشأة</button>` : ''}</div>
    <div class="mn-intro"><div><b>${ico('wrench')} ${KIND.om}</b><span>للمرافق والصيانة والأمن والسلامة: الأنظمة وخرائط الإغلاق، الأصول والضمانات، الصيانة الوقائية، والطوارئ.</span></div><div><b>${ico('users')} ${KIND.user}</b><span>لكادر المنشأة: كيف يبلّغون، أرقام مهمة، استخدام الفراغات، السلامة، وما يحتاج موافقة.</span></div><div><b>${ico('link')} مبني على الحوكمة</b><span>المواقع والأصول والضمانات وخطط الصيانة تُسحب من المنصة، وكل فقرة تحيل إلى إجرائها وقاعدتها.</span></div></div>
    ${rows.length ? Object.entries(byFac).map(([fid, list]) => `<h2 class="gh2">${ico('hospital')} ${esc(F[fid] || 'منشأة')}</h2><div class="mn-list">${list.map(r => `<a class="mn-card ${r.kind}" href="#/manuals/${r.id}"><span class="mn-k">${ico(r.kind === 'om' ? 'wrench' : 'users')}</span><div><b>${KIND[r.kind]}</b><small class="muted">${r.project_id && PJ[r.project_id] ? esc(PJ[r.project_id]) : 'بلا مشروع مرتبط'}</small></div><span class="badge ${STATUS[r.status][1]}">${STATUS[r.status][0]}${r.version ? ' — إصدار ' + r.version : ''}</span><small class="muted">آخر تحديث ${dateAr(r.updated_at)}</small></a>`).join('')}</div>`).join('') : '<div class="empty-boq">لا أدلة بعد. عند استلام أي مشروع يُنشئ قسم المشاريع أدلة المنشأة من زر «＋ أدلة منشأة»، أو من صفحة الإغلاق في المشروع.</div>'}`;
  const create = (pre = {}) => modal(`<form id="f" class="pgrid">${field('المنشأة', sel('facility_id', [['', '— اختر —'], ...facs.map(f => [f.id, f.name])], pre.facility_id || '', 'required'))}${field('المشروع الذي سُلّمت بموجبه (اختياري)', sel('project_id', [['', '— بلا —'], ...projs.map(p => [p.id, p.name])], pre.project_id || ''))}
    <div class="fld wide"><span>الأدلة</span><div class="chips"><label class="chip"><input type="checkbox" name="om" checked> ${KIND.om}</label><label class="chip"><input type="checkbox" name="user" checked> ${KIND.user}</label></div></div>
    <p class="muted small wide">يُنشأ الدليل مسودة بجداول المنشأة من المنصة، ثم يُكمل فريق المشروع جداول الأنظمة والخامات وقطع الغيار وجهات الاتصال، ويعتمده مدير الإدارة (A-30).</p>
    <div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إنشاء</button></div></form>`, { title: 'إنشاء أدلة منشأة', wide: true, onOpen: (w, close) => {
    const fs = $('[name=facility_id]', w), ps = $('[name=project_id]', w);
    ps.onchange = () => { const p = projs.find(x => x.id === ps.value); if (p?.facility_id && !fs.value) fs.value = p.facility_id; };
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const kinds = ['om', 'user'].filter(k => f[k]); if (!kinds.length) return toast('اختر دليلاً واحداً على الأقل', 'bad');
      try { const out = await q(sb.from('facility_manuals').insert(kinds.map(kind => ({ kind, facility_id: +f.facility_id, project_id: f.project_id || null, title: `${KIND[kind]} — ${F[f.facility_id]}` }))).select('id')); close(); toast('أُنشئت الأدلة'); location.hash = '#/manuals/' + out[0].id; } catch (er) { err(er); } };
  } });
  $('#mNew', root) && ($('#mNew', root).onclick = () => create());
  const pq = params?.get?.('project');
  if (pq) { const mine = rows.filter(r => r.project_id === pq); if (mine.length) { if (mine.length === 1) location.hash = '#/manuals/' + mine[0].id; else $$('.mn-card', root).forEach(c => mine.some(r => c.getAttribute('href') === '#/manuals/' + r.id) && c.classList.add('hl')); } else if (canWrite()) { const p = projs.find(x => x.id === pq); create({ project_id: p?.id, facility_id: p?.facility_id }); } }
  $('#mTpl', root) && ($('#mTpl', root).onclick = editTemplates);
}

async function viewManual(root, id) {
  const m = await q(sb.from('facility_manuals').select('*').eq('id', id).single());
  const [tpl, fac, proj, units] = await Promise.all([
    q(sb.from('manual_templates').select('*').eq('code', m.kind).single()),
    q(sb.from('facilities').select('*').eq('id', m.facility_id).single()),
    m.project_id ? q(sb.from('projects').select('*').eq('id', m.project_id).single()).catch(() => null) : null,
    q(sb.from('gov_units').select('code,short,name'))]);
  const U = Object.fromEntries(units.map(u => [u.code, u.short]));
  const need = new Set(tpl.sections.map(s => s.auto).filter(Boolean));
  const D = {};
  const load = async (k, fn) => { if (need.has(k) || (k === 'rooms' && need.has('rooms_brief'))) D[k] = await fn().catch(() => []); };
  await Promise.all([
    load('rooms', () => q(sb.from('fac_locations').select('id,code,name,building,floor,kind,critical').eq('facility_id', m.facility_id).eq('active', true).order('sort'))),
    load('assets', () => q(sb.from('assets').select('code,name,category,unit,maker,model,location_id,install_date,warranty_end,criticality').eq('facility_id', m.facility_id).eq('active', true).order('code'))),
    load('warranty', () => q(sb.from('assets').select('code,name,maker,warranty_end').eq('facility_id', m.facility_id).eq('active', true).not('warranty_end', 'is', null).order('warranty_end'))),
    load('plans', () => q(sb.from('ops_plans').select('title,unit,every,per,next_due,asset_id,location_id').eq('facility_id', m.facility_id).eq('active', true).order('unit'))),
    load('docs', async () => m.project_id ? { docs: await q(sb.from('documents').select('category,title,doc_no,doc_date').eq('project_id', m.project_id).order('category')), dwg: await q(sb.from('drawings').select('discipline,dwg_no,title').eq('project_id', m.project_id).order('discipline')) } : { docs: [], dwg: [] }),
    load('procs', async () => { const codes = [...new Set(tpl.sections.filter(s => s.auto === 'procs').flatMap(s => String(s.procs || '').split(/\s*·\s*/)).filter(Boolean))]; return codes.length ? q(sb.from('gov_processes').select('code,title,owner').in('code', codes)) : []; }),
  ]);
  const locCode = Object.fromEntries((D.rooms || []).map(r => [r.id, r.code]));
  const wEnd = proj?.warranty_end || (proj?.handover_initial_date && proj?.warranty_months ? new Date(new Date(proj.handover_initial_date).setMonth(new Date(proj.handover_initial_date).getMonth() + proj.warranty_months)).toISOString().slice(0, 10) : null);
  const tok = { facility: fac.name, project: proj?.name || '—', contractor: proj?.contractor || '—', handover: proj?.handover_initial_date ? dateAr(proj.handover_initial_date) : '—', warranty: wEnd ? dateAr(wEnd) : 'انتهاء فترة الضمان' };
  const rowsOf = s => { const r = m.data?.rows?.[s.rows]; if (Array.isArray(r)) return r; return (s.defaults || []).map(d => Object.fromEntries(s.cols.map((c, i) => [c[0], d[i] || '']))); };
  const AUTO = {
    project: () => { const kv = [['المنشأة', fac.name], ['نوع المنشأة', FKIND[fac.kind] || fac.kind], ['المشروع', proj?.name], ['نوع المشروع', proj?.type], ['المقاول', proj?.contractor], ['الاستشاري', proj?.consultant], ['مهندس المشروع', proj?.engineer_name], ['الاستلام الابتدائي', proj?.handover_initial_date && dateAr(proj.handover_initial_date)], ['نهاية الضمان', wEnd && dateAr(wEnd)], ['الاستلام النهائي', proj?.handover_final_date && dateAr(proj.handover_final_date)]].filter(x => x[1]);
      return `<div class="mn-kv">${kv.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>${!proj ? '<p class="mn-empty">لم يُربط الدليل بمشروع؛ تظهر بيانات المشروع عند ربطه.</p>' : ''}`; },
    rooms: () => tbl(['الرمز', 'الاسم', 'المبنى', 'الطابق', 'النوع', 'حرج'], (D.rooms || []).map(r => [`<b>${esc(r.code)}</b>`, esc(r.name), esc(r.building || ''), esc(r.floor || ''), esc(r.kind || ''), r.critical ? '<span class="badge bad">حرج</span>' : '']), 'لم تُسجل غرف المنشأة في المنصة بعد — تُسجل من المرافق ← المواقع والغرف (F-03).'),
    rooms_brief: () => { const g = {}; (D.rooms || []).forEach(r => (g[r.floor || 'غير محدد'] ||= []).push(r)); const ks = Object.keys(g); return ks.length ? `<div class="mn-rooms">${ks.map(f => `<div><h5>الطابق ${esc(f)}</h5><ul>${g[f].map(r => `<li><b>${esc(r.code)}</b> ${esc(r.name)}</li>`).join('')}</ul></div>`).join('')}</div>` : '<p class="mn-empty">تُضاف قائمة الغرف عند تسجيلها في المنصة.</p>'; },
    assets: () => tbl(['الرقم', 'الأصل', 'القسم', 'الصانع / الطراز', 'الموقع', 'التركيب', 'نهاية الضمان', 'الأهمية'], (D.assets || []).map(a => [`<b>${esc(a.code)}</b>`, esc(a.name), esc(U[a.unit] || a.unit || ''), esc([a.maker, a.model].filter(Boolean).join(' / ')), esc(locCode[a.location_id] || ''), a.install_date ? dateAr(a.install_date) : '', a.warranty_end ? dateAr(a.warranty_end) : '', esc(CRIT[a.criticality] || a.criticality || '')]), 'لم تُسجل أصول المنشأة في المنصة بعد — تُدرج أصول المشروع خلال أسبوع من الاستلام (G-04).'),
    warranty: () => `${wEnd ? `<p class="mn-note">ضمان المقاول للمشروع حتى <b>${dateAr(wEnd)}</b>.</p>` : ''}${tbl(['الأصل', 'الصانع', 'ينتهي ضمانه'], (D.warranty || []).map(a => [`<b>${esc(a.code)}</b> ${esc(a.name)}`, esc(a.maker || ''), dateAr(a.warranty_end)]), 'لا ضمانات أصول مسجلة في المنصة بعد.')}`,
    plans: () => tbl(['الخطة', 'القسم', 'التكرار', 'الموعد القادم'], (D.plans || []).map(p => [esc(p.title), esc(U[p.unit] || p.unit || ''), `كل ${p.every > 1 ? p.every + ' ' : ''}${per[p.per] || p.per || ''}`, p.next_due ? dateAr(p.next_due) : '']), 'لا خطط صيانة دورية مسجلة لهذه المنشأة بعد — تُنشأ من القسم ← الأعمال المخططة (G-06).'),
    docs: () => { const d = D.docs || { docs: [], dwg: [] }; return `${tbl(['التخصص', 'رقم المخطط', 'العنوان'], d.dwg.map(x => [esc(x.discipline || ''), esc(x.dwg_no || ''), esc(x.title || '')]), 'لا مخططات مسجلة للمشروع.')}${tbl(['التصنيف', 'الرقم', 'العنوان', 'التاريخ'], d.docs.map(x => [esc(x.category || ''), esc(x.doc_no || ''), esc(x.title || ''), x.doc_date ? dateAr(x.doc_date) : '']), 'لا مستندات مسجلة للمشروع.')}${m.project_id ? `<p class="noprint"><a class="btn sm ghost" href="#/project/${m.project_id}/docs">مستندات المشروع</a> <a class="btn sm ghost" href="#/project/${m.project_id}/drawings">مخططات المشروع</a></p>` : ''}`; },
    procs: () => tbl(['الإجراء', 'العنوان', 'المالك'], (D.procs || []).sort((a, b) => a.code.localeCompare(b.code)).map(p => [`<a class="gref in" href="#/gov/sop/${p.code}">${p.code}</a>`, esc(p.title), esc(U[p.owner] || p.owner)]), ''),
    log: () => tbl(['الإصدار', 'التاريخ', 'اعتمده', 'ملاحظة'], (m.log || []).map(l => [String(l.v), dateAr(l.at), esc(l.by || ''), esc(l.note || '')]), 'لم يصدر الدليل بعد — هذه مسودة.'),
  };
  const st = STATUS[m.status], secs = tpl.sections;
  root.innerHTML = `<div class="toolbar noprint"><a class="btn sm ghost" href="#/manuals">→ أدلة المنشآت</a><h2 class="m0">${esc(KIND[m.kind])} — ${esc(fac.name)}</h2><span class="badge ${st[1]}">${st[0]}${m.version ? ' — إصدار ' + m.version : ''}</span><span class="sp"></span><button class="btn sm" onclick="print()">${ico('print')} طباعة / PDF</button>${isAdmin() ? `<button class="btn sm primary" id="mIssue">${m.status === 'issued' ? 'إصدار جديد' : 'اعتماد وإصدار'}</button>` : ''}${isAdmin() ? '<button class="btn sm ghost" id="mDel" style="color:#A6503B">حذف</button>' : ''}</div>
    ${m.status === 'draft' ? `<div class="notice noprint">مسودة: ${canWrite() ? 'أكمل الجداول المعلّمة بـ«تحرير» ثم' : ''} يعتمدها مدير الإدارة (A-30) فتصدر برقم إصدار.</div>` : ''}
    <div class="mn-wrap"><nav class="mn-toc noprint"><b>المحتويات</b>${secs.map((s, i) => `<a href="#" data-go="s-${s.key}"><i>${i + 1}</i>${esc(s.title)}</a>`).join('')}</nav>
    <article class="mn-doc">
      <section class="mn-cover"><img src="assets/logo.png" alt="تجمع الأحساء الصحي" onerror="this.remove()"><div class="mn-ck">تجمع الأحساء الصحي · إدارة الخدمات الفنية</div><h1>${esc(KIND[m.kind])}</h1><h2>${esc(fac.name)}</h2><p>${esc(tpl.audience)}</p><div class="mn-cm"><span>${proj ? 'المشروع: ' + esc(proj.name) : ''}</span><span>${m.version ? 'الإصدار ' + m.version + ' — ' + dateAr(m.issued_at) : 'مسودة — ' + dateAr(m.updated_at)}</span>${m.issued_by ? `<span>اعتمده: ${esc(m.issued_by)}</span>` : ''}</div></section>
      <section class="mn-tocp"><h3>المحتويات</h3><ol>${secs.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol></section>
      ${secs.map((s, i) => `<section class="mn-sec" id="s-${s.key}"><h3><i>${i + 1}</i>${esc(s.title)}${s.rows && canWrite() ? `<button class="btn sm ghost noprint" data-ed="${s.key}">${ico('edit')} تحرير</button>` : ''}</h3>${fmt(s.body, tok)}${s.auto && AUTO[s.auto] ? AUTO[s.auto]() : ''}${s.rows && s.auto ? '<h4>يكمله فريق المشروع</h4>' : ''}${s.rows ? tbl(s.cols.map(c => c[1]), rowsOf(s).map(r => s.cols.map(c => linkify(r[c[0]] || ''))), 'لم تُعبأ بعد.') : ''}${m.data?.notes?.[s.key] ? `<p class="mn-note">${linkify(m.data.notes[s.key])}</p>` : ''}</section>`).join('')}
    </article></div>`;
  $$('[data-go]', root).forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const again = () => viewManual(root, id);
  $$('[data-ed]', root).forEach(b => b.onclick = () => { const s = secs.find(x => x.key === b.dataset.ed), cur = rowsOf(s);
    modal(`<form id="f" class="pgrid">${field(`${s.title} — سطر لكل صف: ${s.cols.map(c => c[1]).join(' | ')}`, `<textarea name="rows" rows="12">${esc(cur.map(r => s.cols.map(c => r[c[0]] || '').join(' | ').replace(/( \| )+$/, '')).join('\n'))}</textarea>`, 'wide')}${field('ملاحظة تظهر تحت الجدول (اختياري)', `<textarea name="note" rows="2">${esc(m.data?.notes?.[s.key] || '')}</textarea>`, 'wide')}<div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'تحرير: ' + s.title, wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target);
        const rows = String(f.rows || '').split('\n').map(x => x.trim()).filter(Boolean).map(line => { const ps = line.split('|').map(x => x.trim()); return Object.fromEntries(s.cols.map((c, i) => [c[0], ps[i] || ''])); });
        const data = { ...(m.data || {}), rows: { ...(m.data?.rows || {}), [s.rows]: rows }, notes: { ...(m.data?.notes || {}), [s.key]: f.note.trim() } };
        try { await q(sb.from('facility_manuals').update({ data, updated_at: new Date().toISOString() }).eq('id', id)); close(); toast('حُفظ'); again(); } catch (er) { err(er); } };
    } }); });
  $('#mIssue', root) && ($('#mIssue', root).onclick = () => modal(`<form id="f" class="pgrid">${field('ملاحظة الإصدار', `<textarea name="note" rows="2" placeholder="${m.version ? 'ما الذي تغيّر في هذا الإصدار' : 'الإصدار الأول عند الاستلام الابتدائي'}"></textarea>`, 'wide')}<p class="muted small wide">يصدر الدليل برقم ${m.version + 1}، ويُسجل في سجل الإصدارات باسمك وتاريخ اليوم.</p><div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">اعتماد وإصدار</button></div></form>`, { title: 'اعتماد الدليل وإصداره', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target), by = session.profile?.full_name || '', at = new Date().toISOString(), v = m.version + 1;
      try { await q(sb.from('facility_manuals').update({ status: 'issued', version: v, issued_at: at, issued_by: by, log: [...(m.log || []), { v, at, by, note: f.note.trim() }], updated_at: at }).eq('id', id)); close(); toast('صدر الإصدار ' + v); again(); } catch (er) { err(er); } };
  } }));
  $('#mDel', root) && ($('#mDel', root).onclick = async () => { if (!await confirm('حذف هذا الدليل نهائياً؟', 'حذف', true)) return; try { await q(sb.from('facility_manuals').delete().eq('id', id)); location.hash = '#/manuals'; } catch (er) { err(er); } });
}

// تحرير القوالب (للمسؤول): عنوان كل قسم ونصه — التغيير يظهر في كل أدلة المنشآت
async function editTemplates() {
  const tpls = await q(sb.from('manual_templates').select('*').order('code'));
  modal(`<div class="mn-tpls">${tpls.map(t => `<h3>${esc(t.title)}</h3>${t.sections.map((s, i) => `<details class="gdx"><summary>${i + 1}. ${esc(s.title)}</summary><div class="gdxb"><form data-t="${t.code}" data-k="${s.key}" class="pgrid">${field('العنوان', `<input name="title" value="${esc(s.title)}">`, 'wide')}${field('النص (## عنوان فرعي، - نقطة، ! تنبيه، > ملاحظة، {facility} {project} {contractor} {handover} {warranty})', `<textarea name="body" rows="10" dir="rtl">${esc(s.body || '')}</textarea>`, 'wide')}<div class="btnrow end wide"><button class="btn sm primary">حفظ القسم</button></div></form></div></details>`).join('')}`).join('')}</div>`, { title: 'قوالب أدلة المنشآت', wide: true, onOpen: w => {
    $$('form[data-t]', w).forEach(fm => fm.onsubmit = async e => { e.preventDefault(); const t = tpls.find(x => x.code === fm.dataset.t), f = formData(fm);
      const sections = t.sections.map(s => s.key === fm.dataset.k ? { ...s, title: f.title.trim(), body: f.body } : s);
      try { await q(sb.from('manual_templates').update({ sections, updated_at: new Date().toISOString() }).eq('code', t.code)); t.sections = sections; toast('حُفظ القسم'); } catch (er) { err(er); } });
  } });
}
