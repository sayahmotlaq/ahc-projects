// ===== حزمة الطرح: جاهزية الطرح + تجميع جدول الكميات والمخططات والمستندات في مكان واحد + تنزيل ZIP =====
import { sb, loadRef, canEdit, canDocs, q, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, download, ico } from './ui.js';
import { DISC, DWG_ST, TENDER_CAT, dwgBadge, fileCell, bindFiles, docForm, dwgForm, BUCKET } from './docs.js';
import { BOQ_STATUS, boqExportData, logo } from './boq.js';
import { buildExcel } from './excel.js';

// ---------- البيانات والجاهزية (تُستخدم من التبويب ومن ملخص المشروع)
export async function tenderData(p, pre = {}) {
  const [boqs, docs, dwgs] = await Promise.all([
    pre.boqs ? Promise.resolve(pre.boqs) : q(sb.from('boqs').select('id,name,status,notes,pricing,hide_prices,created_at').eq('project_id', p.id).order('created_at', { ascending: false })),
    pre.docs ? Promise.resolve(pre.docs) : q(sb.from('documents').select('*').eq('project_id', p.id).order('doc_date', { ascending: false })),
    q(sb.from('drawings').select('*').eq('project_id', p.id).order('discipline').order('dwg_no')),
  ]);
  const revs = dwgs.length ? await q(sb.from('drawing_revisions').select('*').in('drawing_id', dwgs.map(d => d.id)).eq('status', 'for_tender').order('id', { ascending: false })) : [];
  const tdw = dwgs.map(d => ({ d, rev: revs.find(r => r.drawing_id === d.id) })).filter(x => x.rev);
  const tboqs = boqs.filter(b => b.status === 'tender');
  const tdocs = docs.filter(d => TENDER_CAT[d.category]);
  const by = c => tdocs.filter(d => d.category === c);
  const items = [
    { k: 'boq', req: true, ok: tboqs.length > 0, label: 'جدول كميات بحالة «طرح»', hint: tboqs.length ? `${tboqs.map(b => b.name).join('، ')}` : (boqs.length ? 'افتح الجدول ← إعدادات الجدول ← الحالة: طرح' : 'أنشئ جدول الكميات (مقطوعية أو من المرجع)'), link: boqs.length ? `#/project/${p.id}/boq${boqs.length === 1 ? '/' + boqs[0].id : ''}` : `#/project/${p.id}/boq?new=1` },
    { k: 'notes', req: false, ok: tboqs.some(b => (b.notes || '').trim()), label: 'ملاحظات عامة في جدول الطرح', hint: 'الرجوع للمخططات، شمولية الأسعار، زيارة الموقع… (إعدادات الجدول)', link: tboqs[0] ? `#/project/${p.id}/boq/${tboqs[0].id}` : null },
    { k: 'terms', req: true, ok: by('tender_terms').length > 0, label: 'كراسة الشروط والمواصفات', hint: 'ملف الكراسة المعتمد (PDF / Word) أو رابطه', act: 'doc:tender_terms' },
    { k: 'dwg', req: true, ok: tdw.length > 0, label: 'مخططات الطرح', hint: tdw.length ? Object.entries(tdw.reduce((a, x) => (a[x.d.discipline] = (a[x.d.discipline] || 0) + 1, a), {})).map(([k, n]) => `${DISC[k]} ${n}`).join(' · ') : 'ارفع كل مخطط بمراجعة بحالة «للطرح» — تبقى في تبويب المخططات وتُجمع هنا', act: 'dwg' },
    { k: 'specs', req: false, ok: by('tender_specs').length > 0, label: 'المواصفات الفنية', hint: 'لبنود المرجع تُولَّد ورقة المواصفات تلقائياً في ملف Excel؛ ارفع ملفاً مستقلاً إن وُجد', act: 'doc:tender_specs' },
    { k: 'visit', req: false, ok: by('site_visit').length > 0, label: 'محضر زيارة الموقع', hint: 'يُرفع بعد زيارة المتنافسين للموقع', act: 'doc:site_visit' },
  ];
  const reqN = items.filter(i => i.req).length, reqOk = items.filter(i => i.req && i.ok).length;
  return { boqs, tboqs, docs, tdocs, dwgs, tdw, items, reqN, reqOk, pct: Math.round(reqOk / reqN * 100) };
}

// ---------- صندوق الملخص
export function tenderBox(p, T) {
  const edit = canEdit();
  return `<div class="pcard inbox tbox ${T.pct < 100 ? 'hint' : ''}"><div class="toolbar m0"><h2 class="m0">حزمة الطرح <span class="badge ${T.pct === 100 ? 'full' : 'ovr'}">${T.reqOk}/${T.reqN}</span></h2><span class="sp"></span><a class="btn sm ${T.pct === 100 ? '' : 'primary'}" href="#/project/${p.id}/tender">${T.pct === 100 ? 'فتح الحزمة' : 'إكمال الحزمة'}</a></div>
    <div class="bar mt8"><i style="width:${T.pct}%"></i></div>
    <div class="tlist mt8">${T.items.filter(i => i.req).map(i => `<div class="ti ${i.ok ? 'ok' : ''}"><span class="dot">${i.ok ? '✓' : ''}</span><span>${esc(i.label)}</span></div>`).join('')}</div>
    ${T.pct === 100 ? `<p class="muted small" style="margin:8px 0 0">الحزمة مكتملة — يمكنك تنزيلها ملفاً واحداً (ZIP) من التبويب.</p>` : ''}</div>`;
}

// ---------- التبويب
export async function projectTender(t, p) {
  const T = await tenderData(p); const edit = canEdit(), docsOk = canDocs();
  const refresh = () => projectTender(t, p);
  const byCat = Object.keys(TENDER_CAT).map(c => [c, T.tdocs.filter(d => d.category === c)]).filter(([, a]) => a.length);
  const dwgGroups = Object.keys(DISC).map(k => [k, T.tdw.filter(x => x.d.discipline === k)]).filter(([, a]) => a.length);
  t.innerHTML = `<div class="pcard tender"><div class="toolbar"><h2><span class="ic"></span>حزمة الطرح</h2><span class="sp"></span>
      <button class="btn primary" id="tZip" ${T.tboqs.length || T.tdw.length || T.tdocs.length ? '' : 'disabled'}>⬇ تنزيل الحزمة (ZIP)</button>
      ${docsOk ? `<button class="btn" id="tDoc">＋ مستند طرح</button>` : ''}${edit ? `<button class="btn" id="tDwg">＋ مخطط للطرح</button>` : ''}</div>
    <p class="muted small mb10">كل مستند يبقى في مكانه الطبيعي (جداول الكميات، المخططات، المستندات الرسمية) ويُجمع هنا تلقائياً بوسم الطرح: جدول بحالة «طرح»، مراجعة مخطط بحالة «للطرح»، ومستندات من أنواع الطرح. عند التنفيذ يضيف المهندس مراجعات جديدة على نفس المخططات ولا يُنقل شيء.</p>
    <div class="tready"><div><b>جاهزية الطرح: ${T.reqOk} من ${T.reqN} متطلبات أساسية</b><div class="bar mt8"><i style="width:${T.pct}%"></i></div></div><div class="tpct ${T.pct === 100 ? 'ok' : ''}">${T.pct}%</div></div>
    <div class="tchk">${T.items.map(i => `<div class="ti ${i.ok ? 'ok' : ''} ${i.req ? 'req' : ''}"><span class="dot">${i.ok ? '✓' : ''}</span><div class="tx"><b>${esc(i.label)} ${i.req ? '' : '<small class="muted">(موصى به)</small>'}</b><small>${esc(i.hint)}</small></div>${!i.ok && (i.link || i.act) ? (i.link ? `<a class="btn sm" href="${i.link}">${i.k === 'boq' && !T.boqs.length ? 'إنشاء' : 'فتح'}</a>` : (docsOk || (i.act === 'dwg' && edit)) ? `<button class="btn sm" data-act="${i.act}">رفع</button>` : '') : ''}</div>`).join('')}</div></div>
    <div class="pcard"><h2><span class="ic"></span>محتويات الحزمة</h2>
      <h3 class="sub-h">1. جدول الكميات ${T.tboqs.length ? '' : '<small class="muted">— لا يوجد جدول بحالة طرح</small>'}</h3>
      ${T.tboqs.length ? `<table class="lst"><thead><tr><th>الجدول</th><th>الحالة</th><th>طريقة التسعير</th><th>التاريخ</th><th class="nocard"></th></tr></thead><tbody>${T.tboqs.map(b => `<tr><td><b>${esc(b.name)}</b>${b.notes ? ' <small class="muted">· بملاحظات عامة</small>' : ''}</td><td><span class="badge info">${BOQ_STATUS[b.status]}</span></td><td>${b.pricing === 'lumpsum' ? 'مقطوعية' : 'بالوحدة'}${b.hide_prices ? ' · بلا أسعار' : ''}</td><td>${dateAr(b.created_at)}</td><td class="nocard"><a class="btn sm" href="#/project/${p.id}/boq/${b.id}">فتح</a></td></tr>`).join('')}</tbody></table>` : (T.boqs.length ? `<p class="muted small">الجداول الموجودة (${T.boqs.map(b => `${esc(b.name)}: ${BOQ_STATUS[b.status]}`).join('، ')}) — غيّر حالة الجدول المطلوب إلى «طرح» من إعداداته.</p>` : '')}
      <h3 class="sub-h">2. المخططات للطرح ${T.tdw.length ? `<small class="muted">(${T.tdw.length})</small>` : '<small class="muted">— لا توجد مخططات بمراجعة «للطرح»</small>'}</h3>
      ${dwgGroups.map(([k, a]) => `<div class="muted small mt8"><b>${DISC[k]}</b></div><table class="lst"><thead><tr><th>رقم المخطط</th><th>العنوان</th><th>المراجعة</th><th>التاريخ</th><th>الملف</th></tr></thead><tbody>${a.map(x => `<tr><td class="ltr"><b>${esc(x.d.dwg_no || '—')}</b></td><td>${esc(x.d.title)}</td><td class="ltr">${esc(x.rev.rev)} ${dwgBadge(x.rev.status)}</td><td>${dateAr(x.rev.issued_on)}</td><td>${fileCell(x.rev)}</td></tr>`).join('')}</tbody></table>`).join('')}
      <h3 class="sub-h">3. مستندات الطرح ${T.tdocs.length ? `<small class="muted">(${T.tdocs.length})</small>` : '<small class="muted">— لم يُرفع شيء بعد</small>'}</h3>
      ${byCat.map(([c, a]) => `<div class="muted small mt8"><b>${TENDER_CAT[c]}</b></div><table class="lst"><thead><tr><th>العنوان</th><th>الرقم</th><th>التاريخ</th><th>الجهة</th><th>الملف</th><th class="nocard"></th></tr></thead><tbody>${a.map(r => `<tr><td><b>${esc(r.title)}</b>${r.notes ? `<br><small class="muted">${esc(r.notes)}</small>` : ''}</td><td class="ltr">${esc(r.doc_no || '')}</td><td>${dateAr(r.doc_date)}</td><td>${esc(r.party || '')}</td><td>${fileCell(r)}</td><td class="nocard">${docsOk ? `<button class="btn sm" data-d="${r.id}">تعديل</button>` : ''}</td></tr>`).join('')}</tbody></table>`).join('')}
      <p class="muted small mt12">بعد الترسية: ارفع «خطاب الترسية» ثم «العقد» في المستندات الرسمية، وانقل المشروع إلى مرحلة التنفيذ.</p>
    </div>`;
  bindFiles(t, [...T.tdw.map(x => x.rev), ...T.tdocs]);
  const newDoc = cat => docForm(null, p, refresh, { category: cat || 'tender_terms' });
  const newDwg = () => dwgForm(null, p, refresh, { status: 'for_tender' });
  if (docsOk) { const b = $('#tDoc', t); if (b) b.onclick = () => newDoc(); $$('[data-d]', t).forEach(b => b.onclick = () => docForm(T.tdocs.find(x => x.id === +b.getAttribute('data-d')), p, refresh)); }
  if (edit) { const b = $('#tDwg', t); if (b) b.onclick = newDwg; }
  $$('[data-act]', t).forEach(b => b.onclick = () => { const a = b.getAttribute('data-act'); if (a === 'dwg') newDwg(); else newDoc(a.split(':')[1]); });
  $('#tZip', t).onclick = () => buildZip(p, T).catch(err);
}

// ---------- ZIP
function loadJSZip() { return new Promise((res, rej) => { if (window.JSZip) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة الضغط — تحقق من الاتصال')); document.head.appendChild(s); }); }
const safe = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
const extOf = r => (r.file_name || r.path || '').match(/\.([A-Za-z0-9]{1,6})$/)?.[1]?.toLowerCase() || 'bin';
async function fetchFile(path) { const { data, error } = await sb.storage.from(BUCKET).download(path); if (error) throw new Error(error.message); return data; }
async function buildZip(p, T) {
  const btn = $('#tZip'); btn.disabled = true; toast('جارٍ تجهيز حزمة الطرح…');
  try {
    await loadJSZip(); const zip = new JSZip(); const idx = []; const links = [];
    const F = { terms: '01-كراسة الشروط والمواصفات', boq: '02-جدول الكميات', dwg: '03-المخططات', add: '04-ملاحق وتعاميم', min: '05-محاضر' };
    const put = async (folder, name, row) => { if (row.path) { zip.file(`${folder}/${name}`, await fetchFile(row.path)); idx.push(`${folder}/${name}`); } else if (row.link) links.push(`${folder}/${name} ← ${row.link}`); };
    for (const d of T.tdocs) { const folder = d.category === 'tender_addendum' ? F.add : ['site_visit', 'bid_opening'].includes(d.category) ? F.min : F.terms; await put(folder, `${safe(TENDER_CAT[d.category])} - ${safe(d.title)}${d.doc_no ? ' (' + safe(d.doc_no) + ')' : ''}.${extOf(d)}`, d); }
    if (T.tboqs.length) { await loadRef(); const LG = await logo(); for (const b of T.tboqs) { const lines = await q(sb.from('boq_lines').select('*').eq('boq_id', b.id).order('id')); const { prj, c } = await boqExportData(b, lines, p); if (c.groups.length) { const buf = await buildExcel(prj, c, LG); const name = `${F.boq}/جدول الكميات - ${safe(b.name)}.xlsx`; zip.file(name, buf); idx.push(name); } } }
    for (const x of T.tdw) await put(`${F.dwg}/${safe(DISC[x.d.discipline])}`, `${safe(x.d.dwg_no || 'DWG')} - ${safe(x.d.title)} - R${safe(x.rev.rev)}.${extOf(x.rev)}`, x.rev);
    const head = `حزمة الطرح — ${p.name}\nتجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع\nالتاريخ: ${today()}${p.ref ? `\nرقم المشروع: ${p.ref}` : ''}${p.facility ? `\nالمنشأة: ${p.facility}` : ''}\n\nالمحتويات (${idx.length} ملف):\n` + idx.map((x, i) => `${i + 1}. ${x}`).join('\n') + (links.length ? `\n\nروابط خارجية (غير مضمّنة في الملف):\n` + links.join('\n') : '') + `\n\nالجاهزية: ${T.reqOk}/${T.reqN} متطلبات أساسية.`;
    zip.file('00-قائمة المحتويات.txt', '﻿' + head);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    download(blob, `حزمة الطرح - ${safe(p.name)} - ${today()}.zip`); toast(`تم تجهيز الحزمة (${idx.length} ملف)`);
  } finally { btn.disabled = false; }
}
