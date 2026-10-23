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
  let tb = null; const flush = () => { if (tb) { const [hd, ...rs] = tb; h += `<div class="tblwrap"><table class="mn-t"><thead><tr>${hd.map(c => `<th>${linkify(c)}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr>${hd.map((_, i) => `<td>${linkify(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; tb = null; } };
  const close = () => { if (ul) { h += '</ul>'; ul = false; } flush(); };
  for (const raw of lines) { const l = raw.trim(); if (!l) { close(); continue; }
    if (l.startsWith('|')) { if (ul) { h += '</ul>'; ul = false; } (tb ||= []).push(l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim())); continue; }
    flush();
    if (l.startsWith('- ')) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${linkify(l.slice(2))}</li>`; continue; }
    close();
    if (l.startsWith('## ')) h += `<h4>${esc(l.slice(3))}</h4>`; else if (l.startsWith('! ')) h += `<div class="mn-warn">${ico('alert')}<span>${linkify(l.slice(2))}</span></div>`; else if (l.startsWith('> ')) h += `<p class="mn-note">${linkify(l.slice(2))}</p>`; else h += `<p>${linkify(l)}</p>`; }
  close(); return h; };
const tbl = (cols, rows, empty) => rows.length ? `<div class="tblwrap"><table class="mn-t"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="mn-empty">${esc(empty)}</p>`;
const per = { day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' };
const FKIND = { hospital: 'مستشفى', center: 'مركز صحي', phc: 'مركز رعاية أولية', admin: 'مبنى إداري' };
const CRIT = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

export async function mountManuals(root, id, params, sub) {
  if (id === 'example') return viewManual(root, null, sampleOf(sub === 'user' ? 'user' : 'om'));
  if (id === 'g') return viewGuide(root, sub);
  if (id === 'card') return viewCard(root, sub, params?.get?.('lang') || 'ar', params?.get?.('ar') === '1');
  if (id) return viewManual(root, +id);
  let [rows, gens, facs, projs] = await Promise.all([
    q(sb.from('facility_manuals').select('id,kind,facility_id,project_id,title,status,version,updated_at,issued_at').order('updated_at', { ascending: false })),
    q(sb.from('manual_templates').select('code,title,audience,icon,status,ver,scope,sections,cat,unit,card').in('scope', ['general', 'wi']).order('sort')).catch(() => []),
    q(sb.from('facilities').select('id,name').eq('active', true).order('sort')),
    q(sb.from('projects').select('id,name,facility_id,stage').eq('archived', false).order('name')).catch(() => [])]);
  const wis = gens.filter(g => g.scope === 'wi'); gens = gens.filter(g => g.scope !== 'wi');
  const F = Object.fromEntries(facs.map(f => [f.id, f.name])), PJ = Object.fromEntries(projs.map(p => [p.id, p.name]));
  const byFac = {}; rows.forEach(r => (byFac[r.facility_id] ||= []).push(r));
  root.innerHTML = `<div class="toolbar"><h1 class="pagetitle">أدلة المنشآت</h1><span class="muted small">دليلان لكل منشأة تُسلَّم: للتشغيل والصيانة، ولمستخدميها — لا تسليم بلا دليل (<a class="gref in" href="#/gov/rules/R-42">R-42</a>)</span><span class="sp"></span>${isAdmin() ? `<button class="btn sm ghost" id="mTpl">${ico('edit')} قوالب الأدلة</button>` : ''}${canWrite() ? `<button class="btn sm primary" id="mNew">＋ أدلة منشأة</button>` : ''}</div>
    <div class="mn-intro"><div><b>${ico('wrench')} ${KIND.om}</b><span>للمرافق والصيانة والأمن والسلامة: الأنظمة وخرائط الإغلاق، الأصول والضمانات، الصيانة الوقائية، والطوارئ.</span></div><div><b>${ico('users')} ${KIND.user}</b><span>لكادر المنشأة: كيف يبلّغون، أرقام مهمة، استخدام الفراغات، السلامة، وما يحتاج موافقة.</span></div><div><b>${ico('link')} مبني على الحوكمة</b><span>المواقع والأصول والضمانات وخطط الصيانة تُسحب من المنصة، وكل فقرة تحيل إلى إجرائها وقاعدتها.</span></div></div>
    <h2 class="gh2">${ico('star')} أمثلة للاطلاع <span class="muted small">— منشأة افتراضية توضح شكل الدليلين بعد تعبئتهما</span></h2>
    <div class="mn-list">${['om', 'user'].map(k => `<a class="mn-card ${k} ex" href="#/manuals/example/${k}"><span class="mn-k">${ico(k === 'om' ? 'wrench' : 'users')}</span><div><b>${KIND[k]}</b><small class="muted">مركز صحي النموذج — بيانات توضيحية</small></div><span class="badge info">مثال</span><small class="muted">${k === 'om' ? '15 قسماً: الأنظمة وخرائط الإغلاق، الأصول، الضمانات، الصيانة، الطوارئ' : '11 قسماً: كيف أبلّغ، أرقام مهمة، الاستخدام، السلامة، افعل ولا تفعل'}</small></a>`).join('')}</div>
    ${gens.length ? `<h2 class="gh2">${ico('book')} الأدلة العامة للإدارة <span class="muted small">— دليل واحد لكل الإدارة، يُعتمد ويُصدر برقم إصدار</span></h2><div class="mn-list">${gens.map(g => `<a class="mn-card gen" href="#/manuals/g/${g.code}"><span class="mn-k">${ico(g.icon || 'book')}</span><div><b>${esc(g.title)}</b><small class="muted">${esc(g.audience)}</small></div><span class="badge ${STATUS[g.status]?.[1] || 'skel'}">${STATUS[g.status]?.[0] || 'مسودة'}${g.ver ? ' — إصدار ' + g.ver : ''}</span><small class="muted">${(g.sections || []).length} قسماً</small></a>`).join('')}</div>` : ''}
    ${wis.length ? `<h2 class="gh2" id="mn-wi">${ico('clipok')} تعليمات العمل <span class="muted small">— كيف يُنفذ العمل خطوة بخطوة، ولكل تعليمات بطاقة للعامل بالأيقونات وبأكثر من لغة</span></h2>
      <div class="mn-wis">${[...new Set(wis.map(w => w.cat))].map(c => `<div class="mn-wig"><h4>${esc(c)}</h4>${wis.filter(w => w.cat === c).map(w => `<div class="mn-wi"><a href="#/manuals/g/${w.code}"><small>${esc(w.code)}</small><b>${esc(w.title)}</b></a>${w.card?.steps?.length ? `<a class="btn sm ghost" href="#/manuals/card/${w.code}" title="بطاقة العامل">${ico('users')} بطاقة العامل</a>` : ''}</div>`).join('')}</div>`).join('')}</div>` : ''}
    <h2 class="gh2">${ico('hospital')} أدلة المنشآت المسلَّمة</h2>
    ${rows.length ? Object.entries(byFac).map(([fid, list]) => `<h3 class="sub-h">${esc(F[fid] || 'منشأة')}</h3><div class="mn-list">${list.map(r => `<a class="mn-card ${r.kind}" href="#/manuals/${r.id}"><span class="mn-k">${ico(r.kind === 'om' ? 'wrench' : 'users')}</span><div><b>${KIND[r.kind]}</b><small class="muted">${r.project_id && PJ[r.project_id] ? esc(PJ[r.project_id]) : 'بلا مشروع مرتبط'}</small></div><span class="badge ${STATUS[r.status][1]}">${STATUS[r.status][0]}${r.version ? ' — إصدار ' + r.version : ''}</span><small class="muted">آخر تحديث ${dateAr(r.updated_at)}</small></a>`).join('')}</div>`).join('') : '<div class="empty-boq">لا أدلة بعد. عند استلام أي مشروع يُنشئ قسم المشاريع أدلة المنشأة من زر «＋ أدلة منشأة»، أو من صفحة الإغلاق في المشروع.</div>'}`;
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
  if (params?.get?.('sec') === 'wi') setTimeout(() => $('#mn-wi', root)?.scrollIntoView({ block: 'start' }), 60);
  const pq = params?.get?.('project');
  if (pq) { const mine = rows.filter(r => r.project_id === pq); if (mine.length) { if (mine.length === 1) location.hash = '#/manuals/' + mine[0].id; else $$('.mn-card', root).forEach(c => mine.some(r => c.getAttribute('href') === '#/manuals/' + r.id) && c.classList.add('hl')); } else if (canWrite()) { const p = projs.find(x => x.id === pq); create({ project_id: p?.id, facility_id: p?.facility_id }); } }
  $('#mTpl', root) && ($('#mTpl', root).onclick = () => editTemplates());
}

// قشرة المستند: الغلاف والفهرس الجانبي والأقسام — مشتركة بين أدلة المنشآت والأدلة العامة والأمثلة
function docShell({ toolbar, notice, title, sub, audience, meta, secs, sectionHtml }) {
  return `<div class="toolbar noprint">${toolbar}</div>${notice || ''}
    <div class="mn-wrap"><nav class="mn-toc noprint"><b>المحتويات</b>${secs.map((s, i) => `<a href="#" data-go="s-${s.key}"><i>${i + 1}</i>${esc(s.title)}</a>`).join('')}</nav>
    <article class="mn-doc">
      <section class="mn-cover"><img src="assets/logo.png" alt="تجمع الأحساء الصحي" onerror="this.remove()"><div class="mn-ck">تجمع الأحساء الصحي · إدارة الخدمات الفنية</div><h1>${esc(title)}</h1>${sub ? `<h2>${esc(sub)}</h2>` : ''}<p>${esc(audience)}</p><div class="mn-cm">${meta}</div></section>
      <section class="mn-tocp"><h3>المحتويات</h3><ol>${secs.map(s => `<li>${esc(s.title)}</li>`).join('')}</ol></section>
      ${secs.map((s, i) => `<section class="mn-sec" id="s-${s.key}">${sectionHtml(s, i)}</section>`).join('')}
    </article></div>`;
}
const bindToc = root => $$('[data-go]', root).forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
const procsOf = secs => [...new Set(secs.filter(s => s.auto === 'procs').flatMap(s => String(s.procs || '').split(/\s*·\s*/)).filter(Boolean))];

async function viewManual(root, id, sample) {
  const m = sample ? sample.m : await q(sb.from('facility_manuals').select('*').eq('id', id).single());
  const [tpl, fac, proj, units] = await Promise.all([
    q(sb.from('manual_templates').select('*').eq('code', m.kind).single()),
    sample ? sample.fac : q(sb.from('facilities').select('*').eq('id', m.facility_id).single()),
    sample ? sample.proj : m.project_id ? q(sb.from('projects').select('*').eq('id', m.project_id).single()).catch(() => null) : null,
    q(sb.from('gov_units').select('code,short,name'))]);
  const U = Object.fromEntries(units.map(u => [u.code, u.short]));
  const need = new Set(tpl.sections.map(s => s.auto).filter(Boolean));
  const D = {};
  const load = async (k, fn) => { if (sample && k !== 'procs') { D[k] = sample.D[k] || []; return; } if (need.has(k) || (k === 'rooms' && need.has('rooms_brief'))) D[k] = await fn().catch(() => []); };
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
  const st = STATUS[m.status], secs = tpl.sections, ed = canWrite() && !sample;
  root.innerHTML = docShell({
    toolbar: `<a class="btn sm ghost" href="#/manuals">→ أدلة المنشآت</a><h2 class="m0">${esc(KIND[m.kind])} — ${esc(fac.name)}</h2>${sample ? '<span class="badge info">مثال</span>' : `<span class="badge ${st[1]}">${st[0]}${m.version ? ' — إصدار ' + m.version : ''}</span>`}<span class="sp"></span>${sample ? `<a class="btn sm ghost" href="#/manuals/example/${m.kind === 'om' ? 'user' : 'om'}">مثال ${KIND[m.kind === 'om' ? 'user' : 'om']}</a>` : ''}<button class="btn sm" onclick="print()">${ico('print')} طباعة / PDF</button>${isAdmin() && !sample ? `<button class="btn sm primary" id="mIssue">${m.status === 'issued' ? 'إصدار جديد' : 'اعتماد وإصدار'}</button><button class="btn sm ghost" id="mDel" style="color:#A6503B">حذف</button>` : ''}`,
    notice: sample ? '<div class="notice info noprint"><b>مثال توضيحي:</b> منشأة ومشروع وبيانات افتراضية لتوضيح شكل الدليل بعد تعبئته. في الأدلة الفعلية تُسحب الجداول من بيانات المنشأة في المنصة.</div>' : m.status === 'draft' ? `<div class="notice noprint">مسودة: ${ed ? 'أكمل الجداول المعلّمة بـ«تحرير» ثم' : ''} يعتمدها مدير الإدارة (A-30) فتصدر برقم إصدار.</div>` : '',
    title: KIND[m.kind], sub: fac.name, audience: tpl.audience,
    meta: `<span>${proj ? 'المشروع: ' + esc(proj.name) : ''}</span><span>${m.version ? 'الإصدار ' + m.version + ' — ' + dateAr(m.issued_at) : 'مسودة — ' + dateAr(m.updated_at)}</span>${m.issued_by ? `<span>اعتمده: ${esc(m.issued_by)}</span>` : ''}`,
    secs, sectionHtml: (s, i) => `<h3><i>${i + 1}</i>${esc(s.title)}${s.rows && ed ? `<button class="btn sm ghost noprint" data-ed="${s.key}">${ico('edit')} تحرير</button>` : ''}</h3>${fmt(s.body, tok)}${s.auto && AUTO[s.auto] ? AUTO[s.auto]() : ''}${s.rows && s.auto ? '<h4>يكمله فريق المشروع</h4>' : ''}${s.rows ? tbl(s.cols.map(c => c[1]), rowsOf(s).map(r => s.cols.map(c => linkify(r[c[0]] || ''))), 'لم تُعبأ بعد.') : ''}${m.data?.notes?.[s.key] ? `<p class="mn-note">${linkify(m.data.notes[s.key])}</p>` : ''}` });
  bindToc(root);
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
async function editTemplates(only) {
  let tpls = await q(sb.from('manual_templates').select('*').order('scope').order('sort'));
  if (typeof only === 'string') tpls = tpls.filter(t => t.code === only);
  modal(`<div class="mn-tpls">${tpls.map(t => `<h3>${esc(t.title)}</h3>${t.sections.map((s, i) => `<details class="gdx"><summary>${i + 1}. ${esc(s.title)}</summary><div class="gdxb"><form data-t="${t.code}" data-k="${s.key}" class="pgrid">${field('العنوان', `<input name="title" value="${esc(s.title)}">`, 'wide')}${field('النص (## عنوان فرعي، - نقطة، ! تنبيه، > ملاحظة، {facility} {project} {contractor} {handover} {warranty})', `<textarea name="body" rows="10" dir="rtl">${esc(s.body || '')}</textarea>`, 'wide')}<div class="btnrow end wide"><button class="btn sm primary">حفظ القسم</button></div></form></div></details>`).join('')}`).join('')}</div>`, { title: 'قوالب أدلة المنشآت', wide: true, onOpen: w => {
    $$('form[data-t]', w).forEach(fm => fm.onsubmit = async e => { e.preventDefault(); const t = tpls.find(x => x.code === fm.dataset.t), f = formData(fm);
      const sections = t.sections.map(s => s.key === fm.dataset.k ? { ...s, title: f.title.trim(), body: f.body } : s);
      try { await q(sb.from('manual_templates').update({ sections, updated_at: new Date().toISOString() }).eq('code', t.code)); t.sections = sections; toast('حُفظ القسم'); } catch (er) { err(er); } });
  } });
}

// ---------- الأدلة العامة (scope=general): نفس قشرة المستند، والاعتماد والإصدار على القالب نفسه
async function viewGuide(root, code) {
  const [tpl, units] = await Promise.all([q(sb.from('manual_templates').select('*').eq('code', code).single()), q(sb.from('gov_units').select('code,short'))]);
  const U = Object.fromEntries(units.map(u => [u.code, u.short])), codes = procsOf(tpl.sections);
  const procs = codes.length ? await q(sb.from('gov_processes').select('code,title,owner').in('code', codes)).catch(() => []) : [];
  const P = Object.fromEntries(procs.map(p => [p.code, p]));
  const st = STATUS[tpl.status] || STATUS.draft, isWi = tpl.scope === 'wi';
  const { ART } = isWi ? await import('./wi_art.js') : { ART: {} };
  const UN = Object.fromEntries(units.map(u => [u.code, u.short]));
  const secs0 = [...tpl.sections]; if (isWi) { const at = secs0.findIndex(x => x.key === 'steps'); secs0.splice(at < 0 ? 1 : at + 1, 0, ...(ART[code] ? [{ key: 'art', title: 'توضيح مصوّر' }] : []), { key: 'photos', title: 'صور من الميدان' }); }
  root.innerHTML = docShell({
    toolbar: `<a class="btn sm ghost" href="#/manuals${isWi ? '?sec=wi' : ''}">→ أدلة المنشآت</a><h2 class="m0">${esc(tpl.title)}</h2><span class="badge ${st[1]}">${st[0]}${tpl.ver ? ' — إصدار ' + tpl.ver : ''}</span><span class="sp"></span>${isWi && tpl.card?.steps?.length ? `<a class="btn sm" href="#/manuals/card/${code}">${ico('users')} بطاقة العامل</a>` : ''}<button class="btn sm" onclick="print()">${ico('print')} طباعة / PDF</button>${isAdmin() ? `<button class="btn sm ghost" id="gEd">${ico('edit')} تحرير النص</button><button class="btn sm primary" id="gIssue">${tpl.status === 'issued' ? 'إصدار جديد' : 'اعتماد وإصدار'}</button>` : ''}`,
    notice: (tpl.status !== 'issued' ? '<div class="notice noprint">مسودة بانتظار اعتماد مدير الإدارة؛ يمكن تعديل أي قسم من «تحرير النص».</div>' : '') + `<div class="noprint"><div class="srcslot" data-src="manual" data-key="${esc(tpl.code)}" data-src-text="${esc(tpl.title + ' ' + (tpl.sections || []).map(x => x.body || '').join(' '))}"></div></div>`,
    title: tpl.title, sub: isWi ? `تعليمات عمل ${tpl.code} — ${UN[tpl.unit] || ''}` : 'دليل عام — إدارة الخدمات الفنية', audience: tpl.audience,
    meta: `<span>${tpl.ver ? 'الإصدار ' + tpl.ver + ' — ' + dateAr(tpl.issued_at) : 'مسودة — ' + dateAr(tpl.updated_at)}</span>${tpl.issued_by ? `<span>اعتمده: ${esc(tpl.issued_by)}</span>` : ''}`,
    secs: [...secs0, { key: 'log', title: 'سجل الإصدارات' }],
    sectionHtml: (s, i) => s.key === 'art' ? `<h3><i>${i + 1}</i>توضيح مصوّر</h3>${ART[code]()}` : s.key === 'photos' ? `<h3><i>${i + 1}</i>صور من الميدان</h3><p class="muted small">صور فعلية من منشآت التجمع توضح الطريقة الصحيحة؛ اسم الملف يظهر وصفاً للصورة.</p><div class="mn-photos" id="wiPh"><p class="mn-empty">…</p></div>` : s.auto === 'checklist' ? `<h3><i>${i + 1}</i>${esc(s.title)}</h3>${fmt(s.body, {})}<ul class="mn-chk">${(tpl.checklist || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : s.key === 'log' && !s.body ? `<h3><i>${i + 1}</i>سجل الإصدارات</h3>${tbl(['الإصدار', 'التاريخ', 'اعتمده', 'ملاحظة'], (tpl.log || []).map(l => [String(l.v), dateAr(l.at), esc(l.by || ''), esc(l.note || '')]), 'لم يصدر الدليل بعد — هذه مسودة.')}`
      : `<h3><i>${i + 1}</i>${esc(s.title)}</h3>${fmt(s.body, {})}${s.auto === 'procs' ? `<div class="mn-procs">${String(s.procs || '').split(/\s*·\s*/).filter(c => P[c]).map(c => `<a href="#/gov/sop/${c}"><b>${c}</b>${esc(P[c].title)}<small>${esc(U[P[c].owner] || '')}</small></a>`).join('')}</div>` : ''}` });
  bindToc(root);
  if (isWi) wiPhotos($('#wiPh', root), code);
  $('#gEd', root) && ($('#gEd', root).onclick = () => editTemplates(code));
  $('#gIssue', root) && ($('#gIssue', root).onclick = () => modal(`<form id="f" class="pgrid">${field('ملاحظة الإصدار', '<textarea name="note" rows="2"></textarea>', 'wide')}<p class="muted small wide">يصدر الدليل برقم ${(tpl.ver || 0) + 1} باسمك وتاريخ اليوم.</p><div class="btnrow end wide"><span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">اعتماد وإصدار</button></div></form>`, { title: 'اعتماد الدليل وإصداره', onOpen: (w, close) => {
    $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target), by = session.profile?.full_name || '', at = new Date().toISOString(), v = (tpl.ver || 0) + 1;
      try { await q(sb.from('manual_templates').update({ status: 'issued', ver: v, issued_at: at, issued_by: by, log: [...(tpl.log || []), { v, at, by, note: f.note.trim() }], updated_at: at }).eq('code', code)); close(); toast('صدر الإصدار ' + v); viewGuide(root, code); } catch (er) { err(er); } };
  } }));
}

// ---------- مثال توضيحي: منشأة ومشروع وبيانات افتراضية (لا تُحفظ في قاعدة البيانات)
function sampleOf(kind) {
  const fac = { id: 0, name: 'مركز صحي النموذج (مثال)', kind: 'center' };
  const proj = { name: 'إنشاء مركز صحي — نموذج المسار الرابع (مثال)', type: 'إنشاء جديد', contractor: 'شركة المقاول (مثال)', consultant: 'المكتب الاستشاري (مثال)', engineer_name: 'مهندس المشروع', handover_initial_date: '2026-09-01', warranty_months: 12 };
  const R = (id, code, name, floor, kindR, critical) => ({ id, code, name, building: 'المبنى الرئيسي', floor, kind: kindR, critical });
  const rooms = [R(1, 'REC-GF-001', 'الاستقبال والتسجيل', 'الأرضي', 'استقبال'), R(2, 'WAI-GF-002', 'الانتظار الرئيسي', 'الأرضي', 'انتظار'), R(3, 'OPD-GF-010', 'عيادة طب الأسرة 1', 'الأرضي', 'عيادة'), R(4, 'OPD-GF-011', 'عيادة طب الأسرة 2', 'الأرضي', 'عيادة'), R(5, 'PRO-GF-020', 'غرفة الإجراءات', 'الأرضي', 'إجراءات', true), R(6, 'EMR-GF-030', 'غرفة الإسعاف والملاحظة', 'الأرضي', 'طوارئ', true), R(7, 'DEN-FF-101', 'عيادة الأسنان', 'الأول', 'عيادة'), R(8, 'LAB-FF-110', 'المختبر', 'الأول', 'مختبر', true), R(9, 'ELE-GF-090', 'غرفة الكهرباء الرئيسية', 'الأرضي', 'أنظمة', true), R(10, 'MEC-RF-201', 'غرفة الأنظمة على السطح', 'السطح', 'أنظمة')];
  const A = (code, name, unit, maker, model, loc, inst, w, crit) => ({ code, name, unit, maker, model, location_id: loc, install_date: inst, warranty_end: w, criticality: crit });
  const assets = [A('MNT-GEN-01', 'مولد احتياطي 250 ك.ف.أ', 'MNT', 'الصانع (مثال)', 'G-250', 9, '2026-08-15', '2027-09-01', 'critical'), A('MNT-ATS-01', 'مفتاح التحويل الآلي', 'MNT', 'الصانع (مثال)', 'ATS-400', 9, '2026-08-15', '2027-09-01', 'critical'), A('MNT-AHU-01', 'وحدة مناولة هواء — العيادات', 'MNT', 'الصانع (مثال)', 'AHU-12', 10, '2026-08-01', '2027-09-01', 'high'), A('MNT-CH-01', 'وحدة تبريد', 'MNT', 'الصانع (مثال)', 'CH-80', 10, '2026-08-01', '2027-09-01', 'high'), A('SAF-FAP-01', 'لوحة الإنذار من الحريق', 'SAF', 'الصانع (مثال)', 'FA-2', 9, '2026-08-20', '2027-09-01', 'critical'), A('IT-SW-01', 'محوّل الشبكة الرئيسي', 'IT', 'الصانع (مثال)', 'SW-48', 9, '2026-08-25', '2027-09-01', 'high')];
  const plans = [{ title: 'اختبار المولد تحت الحمل', unit: 'MNT', every: 1, per: 'month', next_due: '2026-11-05' }, { title: 'فحص وتنظيف فلاتر وحدات التكييف', unit: 'MNT', every: 3, per: 'month', next_due: '2026-12-01' }, { title: 'فحص لوحة الإنذار والكواشف', unit: 'SAF', every: 3, per: 'month', next_due: '2026-12-10' }, { title: 'فحص الطفايات', unit: 'SAF', every: 1, per: 'month', next_due: '2026-11-01' }, { title: 'صيانة وحدة التبريد', unit: 'MNT', every: 6, per: 'month', next_due: '2027-02-01' }];
  const D = { rooms, assets, warranty: assets.map(a => ({ code: a.code, name: a.name, maker: a.maker, warranty_end: a.warranty_end })), plans,
    docs: { dwg: [{ discipline: 'معماري', dwg_no: 'A-101', title: 'مسقط الدور الأرضي كما نُفذ' }, { discipline: 'كهرباء', dwg_no: 'E-201', title: 'مخطط اللوحات والتغذية كما نُفذ' }, { discipline: 'ميكانيك', dwg_no: 'M-301', title: 'مخطط التكييف كما نُفذ' }, { discipline: 'حريق', dwg_no: 'F-401', title: 'مخطط الإنذار والرشاشات كما نُفذ' }], docs: [{ category: 'كتيبات', doc_no: 'OM-01', title: 'كتيب تشغيل وصيانة المولد', doc_date: '2026-08-28' }, { category: 'شهادات', doc_no: 'TC-05', title: 'شهادة اختبار نظام الإنذار', doc_date: '2026-08-30' }, { category: 'محاضر', doc_no: 'HO-01', title: 'محضر الاستلام الابتدائي', doc_date: '2026-09-01' }] } };
  const rows = {
    contacts: [{ role: 'غرفة الصيانة (طوارئ على مدار الساعة)', name: 'المناوب', phone: 'داخلي 100', note: 'أي عطل يهدد السلامة أو الخدمة' }, { role: 'الأمن والسلامة', name: 'مشرف السلامة', phone: 'داخلي 200', note: 'حريق، دخان، تعطيل أنظمة الحريق، حادث' }, { role: 'المرافق', name: 'منسق المنشأة', phone: 'داخلي 300', note: 'إغلاق غرفة، نقل أو تعديل مساحة' }, { role: 'تقنية المعلومات', name: 'الدعم الفني', phone: 'داخلي 400', note: 'الشبكة والأنظمة' }, { role: 'الصيانة الطبية', name: 'مهندس الأجهزة', phone: 'داخلي 500', note: 'أعطال الأجهزة الطبية' }, { role: 'مقاول المشروع (فترة الضمان)', name: 'مدير المشروع لدى المقاول', phone: '05xxxxxxxx', note: 'عيوب الضمان — عبر قسم المشاريع' }],
    systems: [{ system: 'الكهرباء — التغذية الرئيسية واللوحات', desc: 'لوحة رئيسية 800 أمبير ولوحات فرعية لكل جناح', where: 'ELE-GF-090', shutoff: 'القاطع الرئيسي في اللوحة الرئيسية، وقواطع الأجنحة في لوحاتها', serves: 'كامل المبنى', note: '' }, { system: 'المولد الاحتياطي والتحويل الآلي', desc: '250 ك.ف.أ مع تحويل آلي', where: 'ساحة الخدمات الخلفية', shutoff: 'مفتاح الإيقاف في لوحة المولد', serves: 'الإسعاف، الإجراءات، المختبر، الإنارة الاحتياطية', note: 'اختبار شهري تحت الحمل (K-01)' }, { system: 'التكييف والتهوية', desc: 'وحدة تبريد ووحدتا مناولة هواء', where: 'MEC-RF-201', shutoff: 'لوحة التحكم بالسطح', serves: 'كل الفراغات', note: 'ضغط سالب في غرفة الإسعاف' }, { system: 'المياه والصرف', desc: 'خزان علوي ومضخات', where: 'السطح وغرفة المضخات', shutoff: 'المحبس الرئيسي عند مدخل الخدمة، ومحابس لكل دورة مياه', serves: 'كامل المبنى', note: 'خطة إدارة المياه (K-10)' }, { system: 'الغازات الطبية', desc: 'أسطوانات أكسجين بمنظم آلي', where: 'غرفة الغازات الخارجية', shutoff: 'صمام المنطقة أمام غرفة الإسعاف', serves: 'الإسعاف والإجراءات', note: 'إنذار المنطقة في محطة التمريض' }, { system: 'الإنذار من الحريق', desc: 'لوحة عنونة وكواشف دخان وحرارة', where: 'الاستقبال', shutoff: '— (لا يُعطّل إلا بسجل تعطيل H-01)', serves: 'كامل المبنى', note: 'NFPA 72' }],
    materials: [{ item: 'أرضيات الفينيل', code: 'رمز الخامة في المرجع الفني (مثال)', where: 'العيادات والممرات', care: 'منظف متعادل، بلا شمع', source: 'المورد المعتمد' }, { item: 'حماية الجدران', code: 'رمز الخامة (مثال)', where: 'الممرات', care: 'مسح بمطهر معتمد', source: 'المورد المعتمد' }, { item: 'الأسقف المعلقة', code: '60×60 (مثال)', where: 'كل الفراغات العامة', care: 'استبدال البلاطة المتضررة بالرمز نفسه', source: 'المخزون الاحتياطي' }],
    spares: [{ item: 'بلاطات سقف', qty: '20', for: 'الأسقف', where: 'مخزن الصيانة' }, { item: 'فلاتر وحدات التكييف', qty: 'طقم واحد', for: 'التكييف', where: 'MEC-RF-201' }, { item: 'مفاتيح الأبواب والخزائن', qty: 'حسب الجدول المرفق', for: 'الأبواب', where: 'المرافق' }],
    warranties: [{ item: 'المولد', supplier: 'الوكيل (مثال)', until: '2028-09-01', contact: '05xxxxxxxx', note: 'ضمان الوكيل سنتان' }, { item: 'العزل المائي للسطح', supplier: 'مقاول العزل (مثال)', until: '2036-09-01', contact: '—', note: 'عشر سنوات' }] };
  const m = { id: 0, kind, facility_id: 0, project_id: null, status: 'issued', version: 1, issued_at: '2026-09-01', issued_by: 'مدير الإدارة (مثال)', updated_at: '2026-09-01', data: { rows }, log: [{ v: 1, at: '2026-09-01', by: 'مدير الإدارة (مثال)', note: 'الإصدار الأول عند الاستلام الابتدائي' }] };
  return { m, fac, proj, D };
}

// ---------- صور الميدان على تعليمات العمل (مرفقات بالمفتاح wi:CODE)
async function wiPhotos(box, code) {
  if (!box) return;
  const at = await import('./attach.js');
  const canAdd = isAdmin() || canEdit() || ['GEN', 'MNT', 'SAF', 'FAC', 'BME', 'IT'].includes(session.profile?.unit);
  const draw = async () => {
    const list = (await at.loadAttachments(['wi:' + code]).catch(() => [])).filter(a => /^image\//.test(a.mime || '') || /\.(jpe?g|png|webp)$/i.test(a.name));
    const urls = await Promise.all(list.map(a => sb.storage.from('project-files').createSignedUrl(a.path, 3600).then(r => r.data?.signedUrl).catch(() => null)));
    box.innerHTML = `${list.length ? list.map((a, i) => `<figure>${urls[i] ? `<img src="${urls[i]}" alt="${esc(a.name)}" loading="lazy">` : ''}<figcaption>${esc(a.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))}</figcaption>${at.canDel(a) ? `<button class="btn sm ghost noprint" data-del="${a.id}">حذف</button>` : ''}</figure>`).join('') : '<p class="mn-empty">لا صور بعد.' + (canAdd ? ' أضف صوراً من الميدان تبيّن الطريقة الصحيحة؛ سمِّ الملف بوصف الصورة قبل رفعه.' : '') + '</p>'}${canAdd ? `<label class="btn sm noprint mn-phadd">${ico('camera')} إضافة صور<input type="file" accept="image/*" multiple hidden></label>` : ''}`;
    const inpF = box.querySelector('input[type=file]'); if (inpF) inpF.onchange = async () => { try { for (const f of inpF.files) await at.uploadAttachment(f, 'wi:' + code); toast('أُضيفت الصور'); draw(); } catch (er) { err(er); } };
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!await confirm('حذف الصورة؟', 'حذف', true)) return; const a = list.find(x => x.id === +b.dataset.del); try { await at.deleteAttachment(a); draw(); } catch (er) { err(er); } });
  };
  draw();
}

// ---------- بطاقة العامل: أيقونات وخطوات قصيرة بالعربية ولغة ثانية، صفحة واحدة للطباعة PDF
const LANGS = { en: ['English', 'ltr'], ur: ['اردو', 'rtl'], bn: ['বাংলা', 'ltr'], hi: ['हिन्दी', 'ltr'], tl: ['Filipino', 'ltr'] };
const LBL = { ar: ['معدات الوقاية الإلزامية', 'الخطوات', 'ممنوع'], en: ['Required protection', 'Steps', 'Do not'], ur: ['لازمی حفاظتی سامان', 'مراحل', 'منع ہے'], bn: ['প্রয়োজনীয় সুরক্ষা', 'ধাপ', 'নিষেধ'], hi: ['ज़रूरी सुरक्षा', 'चरण', 'मना है'], tl: ['Kailangang proteksyon', 'Mga hakbang', 'Bawal'] };
const PPE = { gloves: ['قفازات', 'Gloves', 'دستانے', 'গ্লাভস', 'दस्ताने', 'Guwantes'], gloves_red: ['قفازات حمراء', 'Red gloves', 'سرخ دستانے', 'লাল গ্লাভস', 'लाल दस्ताने', 'Pulang guwantes'], goggles: ['نظارة واقية', 'Goggles', 'حفاظتی چشمہ', 'সুরক্ষা চশমা', 'सुरक्षा चश्मा', 'Goggles'], mask: ['كمامة', 'Mask', 'ماسک', 'মাস্ক', 'मास्क', 'Mask'], boots: ['حذاء سلامة', 'Safety shoes', 'حفاظتی جوتے', 'নিরাপত্তা জুতা', 'सुरक्षा जूते', 'Safety na sapatos'], gown: ['رداء واقٍ', 'Gown', 'گاؤن', 'গাউন', 'गाउन', 'Gown'], harness: ['حزام أمان', 'Harness', 'حفاظتی بیلٹ', 'নিরাপত্তা বেল্ট', 'सुरक्षा बेल्ट', 'Harness'], ear: ['واقي سمع', 'Ear protection', 'کان کی حفاظت', 'কানের সুরক্ষা', 'कान सुरक्षा', 'Proteksyon sa tainga'], ladder: ['سلّم معتمد', 'Approved ladder', 'منظور سیڑھی', 'অনুমোদিত মই', 'मंज़ूर सीढ़ी', 'Aprubadong hagdan'], wetsign: ['لافتة أرضية مبللة', 'Wet floor sign', 'گیلے فرش کا بورڈ', 'ভেজা মেঝে সাইন', 'गीला फर्श बोर्ड', 'Karatulang basa'] };
const LI = { ar: 0, en: 1, ur: 2, bn: 3, hi: 4, tl: 5 };
function ensureFonts() { if (document.getElementById('wiFonts')) return; const l = document.createElement('link'); l.id = 'wiFonts'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@500;700&family=Noto+Sans+Bengali:wght@500;700&family=Noto+Sans+Devanagari:wght@500;700&display=swap'; document.head.appendChild(l); }
const WT = {
  'WI-C01': ['Vinyl floor cleaning and care', 'ونائل فرش کی صفائی اور دیکھ بھال', 'ভিনাইল মেঝে পরিষ্কার ও যত্ন', 'विनाइल फर्श की सफाई और देखभाल', 'Paglilinis at pag-aalaga ng vinyl na sahig'],
  'WI-C02': ['Toilet cleaning and disinfection', 'ٹوائلٹ کی صفائی اور جراثیم کشی', 'টয়লেট পরিষ্কার ও জীবাণুমুক্তকরণ', 'शौचालय की सफाई और कीटाणुशोधन', 'Paglilinis at pag-disinfect ng CR'],
  'WI-C03': ['Janitor room: organization and use', 'جینیٹر روم: ترتیب اور استعمال', 'জ্যানিটর রুম: গোছানো ও ব্যবহার', 'जैनिटर रूम: व्यवस्था और उपयोग', 'Janitor room: pag-aayos at paggamit'],
  'WI-C04': ['Daily cleaning of clinics and exam rooms', 'کلینک اور معائنہ کمروں کی روزانہ صفائی', 'ক্লিনিক ও পরীক্ষা কক্ষের দৈনিক পরিষ্কার', 'क्लिनिक और जांच कक्षों की दैनिक सफाई', 'Araw-araw na paglilinis ng klinika'],
  'WI-C05': ['Terminal cleaning of isolation and procedure rooms', 'آئسولیشن اور پروسیجر کمروں کی آخری صفائی', 'আইসোলেশন ও প্রসিডিউর কক্ষের চূড়ান্ত পরিষ্কার', 'आइसोलेशन और प्रक्रिया कक्षों की अंतिम सफाई', 'Terminal cleaning ng isolation at procedure room'],
  'WI-C06': ['Blood and body fluid spills', 'خون اور جسمانی رطوبت کا گرنا', 'রক্ত ও শরীরের তরল ছিটকে পড়া', 'खून और शरीर के तरल का फैलना', 'Natapong dugo at likido ng katawan'],
  'WI-C07': ['Cleaning glass facades and signs', 'شیشے کے اگلے حصے اور بورڈ کی صفائی', 'কাচের সম্মুখভাগ ও সাইন পরিষ্কার', 'कांच के अग्रभाग और बोर्ड की सफाई', 'Paglilinis ng salaming harapan at karatula'],
  'WI-C08': ['Collecting and moving waste inside the facility', 'سہولت کے اندر کچرا جمع اور منتقل کرنا', 'ফ্যাসিলিটির ভেতরে বর্জ্য সংগ্রহ ও পরিবহন', 'सुविधा के अंदर कचरा इकट्ठा करना और ले जाना', 'Pagkolekta at paglipat ng basura sa loob'],
  'WI-C09': ['Color-coded cleaning tools', 'صفائی کے اوزاروں کا رنگ نظام', 'পরিষ্কারের সরঞ্জামের রঙ পদ্ধতি', 'सफाई औजारों की रंग प्रणाली', 'Sistema ng kulay ng gamit panlinis'],
  'WI-M01': ['Periodic maintenance of split air conditioners', 'اسپلٹ اے سی کی باقاعدہ دیکھ بھال', 'স্প্লিট এসির নিয়মিত রক্ষণাবেক্ষণ', 'स्प्लिट एसी का नियमित रखरखाव', 'Regular na maintenance ng split aircon'],
  'WI-M02': ['Periodic maintenance of ducted split and package units', 'ڈکٹ اسپلٹ اور پیکج یونٹ کی دیکھ بھال', 'ডাক্টেড স্প্লিট ও প্যাকেজ ইউনিটের রক্ষণাবেক্ষণ', 'डक्टेड स्प्लिट और पैकेज यूनिट का रखरखाव', 'Maintenance ng ducted split at package unit'],
  'WI-M03': ['Periodic maintenance of VRF systems', 'وی آر ایف سسٹم کی دیکھ بھال', 'ভিআরএফ সিস্টেমের রক্ষণাবেক্ষণ', 'वीआरएफ सिस्टम का रखरखाव', 'Maintenance ng VRF system'],
  'WI-M04': ['Periodic maintenance of AHU and FCU', 'اے ایچ یو اور ایف سی یو کی دیکھ بھال', 'এএইচইউ ও এফসিইউ রক্ষণাবেক্ষণ', 'एएचयू और एफसीयू का रखरखाव', 'Maintenance ng AHU at FCU'],
  'WI-M05': ['Chiller operation and maintenance', 'چلر کا آپریشن اور دیکھ بھال', 'চিলার পরিচালনা ও রক্ষণাবেক্ষণ', 'चिलर संचालन और रखरखाव', 'Operasyon at maintenance ng chiller'],
  'WI-M06': ['Monthly generator load test', 'جنریٹر کا ماہانہ لوڈ ٹیسٹ', 'জেনারেটরের মাসিক লোড টেস্ট', 'जनरेटर का मासिक लोड टेस्ट', 'Buwanang load test ng generator'],
  'WI-M07': ['Cleaning and disinfecting water tanks', 'پانی کی ٹنکیوں کی صفائی اور جراثیم کشی', 'পানির ট্যাংক পরিষ্কার ও জীবাণুমুক্তকরণ', 'पानी की टंकियों की सफाई और कीटाणुशोधन', 'Paglilinis at pag-disinfect ng tangke ng tubig'],
  'WI-S01': ['Monthly fire extinguisher check', 'آگ بجھانے والے آلات کا ماہانہ معائنہ', 'অগ্নিনির্বাপকের মাসিক পরীক্ষা', 'अग्निशामक की मासिक जांच', 'Buwanang pagsusuri ng fire extinguisher'],
  'WI-S02': ['Emergency lighting and exit sign check', 'ایمرجنسی لائٹ اور ایگزٹ بورڈ کا معائنہ', 'জরুরি আলো ও এক্সিট সাইন পরীক্ষা', 'आपातकालीन लाइट और एग्ज़िट बोर्ड की जांच', 'Pagsusuri ng emergency light at exit sign'],
};
const KICK = { ar: 'تعليمات عمل', en: 'Work instruction', ur: 'کام کی ہدایات', bn: 'কাজের নির্দেশনা', hi: 'कार्य निर्देश', tl: 'Tagubilin sa trabaho' };
const ORG = { ar: 'تجمع الأحساء الصحي · إدارة الخدمات الفنية', en: 'Al-Ahsa Health Cluster · Technical Services', ur: 'الاحساء ہیلتھ کلسٹر · تکنیکی خدمات', bn: 'আল-আহসা হেলথ ক্লাস্টার · কারিগরি সেবা', hi: 'अल-अहसा हेल्थ क्लस्टर · तकनीकी सेवाएं', tl: 'Al-Ahsa Health Cluster · Teknikal na Serbisyo' };
// بطاقة العامل: تضغط اللغة فتتحول البطاقة كاملة لها؛ «مع العربية» يضيف العربية تحت كل سطر
async function viewCard(root, code, lang, withAr) {
  if (!LANGS[lang] && lang !== 'ar') lang = 'ar';
  if (withAr === undefined) withAr = new URLSearchParams(location.hash.split('?')[1] || '').get('ar') === '1';
  ensureFonts();
  const [tpl, { pic }] = await Promise.all([q(sb.from('manual_templates').select('code,title,card,unit,ver,status').eq('code', code).single()), import('./wi_art.js')]);
  const c = tpl.card || {}, isAr = lang === 'ar', both = !isAr && withAr, L = LBL[lang] || LBL.ar, dir = isAr ? 'rtl' : LANGS[lang][1], li = LI[lang];
  const title = isAr ? tpl.title : (WT[code]?.[li - 1] || tpl.title);
  const line = (main, ar) => `<span class="mn1" lang="${lang}" dir="${dir}">${esc(main || ar || '')}</span>${both && ar ? `<span class="mn2" lang="ar" dir="rtl">${esc(ar)}</span>` : ''}`;
  const tx = o => line(o.t?.[lang], o.t?.ar);
  const H = k => line(L[k], LBL.ar[k]);
  const langs = [['ar', 'العربية'], ...Object.entries(LANGS).map(([k, v]) => [k, v[0]])];
  root.innerHTML = `<div class="toolbar noprint"><a class="btn sm ghost" href="#/manuals/g/${code}">→ التعليمات الكاملة</a><h2 class="m0">بطاقة العامل</h2><span class="sp"></span><div class="wlangs" role="tablist" aria-label="لغة البطاقة">${langs.map(([k, l]) => `<button type="button" role="tab" data-lang="${k}" class="${k === lang ? 'on' : ''}" lang="${k}">${esc(l)}</button>`).join('')}</div>${!isAr ? `<label class="chk wwith"><input type="checkbox" id="wAr" ${withAr ? 'checked' : ''}> مع العربية</label>` : ''}<button class="btn sm primary" onclick="print()">${ico('print')} طباعة / PDF</button></div>
    <p class="muted small noprint">اختر لغة العامل فتتحول البطاقة كاملة لها، ثم اطبعها على A4 أو احفظها PDF من نافذة الطباعة. الترجمات تُراجع مع متحدث باللغة قبل التعميم.</p>
    <article class="wcard" dir="${dir}" lang="${lang}">
      <header><img src="assets/logo.png" alt="" onerror="this.remove()"><div><small>${esc(tpl.code)} · ${esc(KICK[lang])}</small><h1>${esc(title)}</h1>${both ? `<div class="mn2h" dir="rtl">${esc(tpl.title)}</div>` : ''}</div></header>
      ${(c.ppe || []).length ? `<section class="wppe"><h3>${H(0)}</h3><div>${c.ppe.map(k => `<figure>${pic(k)}<figcaption>${line(PPE[k]?.[li], PPE[k]?.[0])}</figcaption></figure>`).join('')}</div></section>` : ''}
      <section class="wsteps"><h3>${H(1)}</h3><ol>${(c.steps || []).map((s, i) => `<li><i>${i + 1}</i>${pic(s.i)}<p>${tx(s)}</p></li>`).join('')}</ol></section>
      ${(c.donts || []).length ? `<section class="wdonts"><h3>${H(2)}</h3><ul>${c.donts.map(s => `<li>${pic(s.i)}<p>${tx(s)}</p></li>`).join('')}</ul></section>` : ''}
      <footer><span>${esc(ORG[lang])}</span><span>${esc(tpl.code)}${tpl.ver ? ' · v' + tpl.ver : ''}</span></footer>
    </article>`;
  const go = (l, a) => { history.replaceState(null, '', `#/manuals/card/${code}?lang=${l}${a ? '&ar=1' : ''}`); viewCard(root, code, l, a); };
  root.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => go(b.dataset.lang, withAr));
  const cb = root.querySelector('#wAr'); if (cb) cb.onchange = () => go(lang, cb.checked);
}
