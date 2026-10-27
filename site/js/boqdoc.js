// ===== ملخص جدول الكميات PDF (للعرض على المتبرع وأصحاب القرار): نطاق الأعمال بنداً بنداً بوصف مختصر، بلا أسعار
// الشكل نفسه لدليل المواصفات واشتراطات التسليم (pdfdoc)، بالعربية أو الإنجليزية، برقم مرجعي في سجل الإصدار
import { sb, q } from './api.js';
import { esc, err, dateAr } from './ui.js';

const GROUPS = [
  ['gen', ['01', '02'], 'المتطلبات العامة', 'General Requirements'],
  ['civ', ['03', '04', '05', '31'], 'الأعمال الإنشائية والمدنية', 'Structural and Civil Works'],
  ['arc', ['06', '07', '08', '09', '10', '13'], 'الأعمال المعمارية والتشطيبات', 'Architectural Works and Finishes'],
  ['mep', ['14', '21', '22', '23', '25', '26'], 'الأعمال الكهروميكانيكية', 'Mechanical, Electrical and Plumbing'],
  ['elv', ['27', '28'], 'أنظمة التيار الخفيف والأمن والسلامة', 'Low-Current, Security and Safety Systems'],
  ['site', ['32', '33'], 'الموقع العام وتوصيل الخدمات', 'Site Works and Utility Connections'],
  ['fur', ['11', '12'], 'الأثاث والتجهيزات', 'Furniture and Equipment'],
  ['oth', [], 'أعمال أخرى', 'Other Works']];
const groupOf = d => !String(d || '').trim() ? 'gen' : (GROUPS.find(g => g[1].includes(String(d || '').slice(0, 2))) || GROUPS[GROUPS.length - 1])[0];
const LB = {
  ar: { kicker: 'ملخص جدول الكميات', h1: 'نطاق الأعمال<br>وجدول الكميات', sub: 'عرض مختصر لبنود المشروع ونطاق كل بند والمواصفات المعتمدة — بدون أسعار.', tag: 'للعرض والاطلاع', items: n => `${n} بنداً`,
    ov: 'نظرة عامة', ovP: (n, g) => `يتكون جدول الكميات من ${n} بنداً في ${g} مجموعات أعمال. كل بند مقطوعية شاملة للتوريد والتنفيذ والاختبار والتسليم حسب المخططات والمواصفات المعتمدة لتجمع الأحساء الصحي، والمواصفة التفصيلية لكل بند في الجدول الكامل على المنصة.`,
    grp: 'مجموعة الأعمال', cnt: 'عدد البنود', brands: 'أبرز العلامات المعتمدة في المشروع', excl: 'خارج نطاق هذا الجدول', no: '#', item: 'البند', scope: 'النطاق باختصار', qty: 'الكمية', lump: 'مقطوعية', zero: 'غير مشمول حالياً',
    end: 'المواصفات الفنية الكاملة لكل بند في جدول الكميات على المنصة، والعلامات المعتمدة وأسباب اعتمادها في «دليل المواصفات المعتمدة»، وما يُسلَّم عند الاستلام في «اشتراطات تسليم المشروع» — وتُصدر جميعها من صفحة الجدول نفسها.',
    title: 'ملخص جدول الكميات' },
  en: { kicker: 'Bill of Quantities — Summary', h1: 'Scope of Works<br>and Bill of Quantities', sub: 'A concise view of the project items, the scope of each item and the approved specifications — without prices.', tag: 'For presentation and information', items: n => `${n} items`,
    ov: 'Overview', ovP: (n, g) => `The bill of quantities comprises ${n} items in ${g} work groups. Each item is a lump sum covering supply, installation, testing and handover in accordance with the drawings and the approved specifications of Al-Ahsa Health Cluster; the detailed specification of each item is in the full BOQ on the platform.`,
    grp: 'Work group', cnt: 'Items', brands: 'Key approved brands in the project', excl: 'Outside the scope of this BOQ', no: '#', item: 'Item', scope: 'Scope in brief', qty: 'Qty', lump: 'Lump sum', zero: 'Not included at present',
    end: 'The full technical specification of each item is in the BOQ on the platform, the approved brands and the reasons for their approval are in the “Approved Specifications Guide”, and the handover deliverables are in the “Project Handover Requirements” — all issued from the same BOQ page.',
    title: 'BOQ Summary' } };

// وصف مختصر من نص البند: أول عبارة حتى الفاصلة المنقوطة أو نهاية الجملة، بحد أقصى ~140 حرفاً عند حد كلمة
const END_AR = /\s*وكل ما يلزم لإنجاز العمل[^.]*\.?/g, END_EN = /\s*Including everything required[^.]*\.?/gi;
function brief(s, en) {
  let x = String(s || '').replace(en ? END_EN : END_AR, '').replace(/\s+/g, ' ').trim();
  const cut = x.search(en ? /;|\.\s/ : /؛|\.\s/); if (cut > 40) x = x.slice(0, cut);
  if (x.length > 140) { x = x.slice(0, 140); x = x.slice(0, x.lastIndexOf(' ')) + '…'; }
  return x.replace(/[:،,]$/, '');
}

export async function openBoqSummary(boqId, lang = 'ar') {
  let win; try {
    const { prepDoc, openDoc, coverHtml } = await import('./pdfdoc.js'); win = prepDoc(); if (!win) return;
    const EN = lang === 'en', L = LB[EN ? 'en' : 'ar'];
    const boq = await q(sb.from('boqs').select('id,name,notes,project_id').eq('id', boqId).single());
    const [prj, lines] = await Promise.all([q(sb.from('projects').select('name,facility,type,category').eq('id', boq.project_id).single()), q(sb.from('boq_lines').select('kind,title,descr,unit,qty,div_code,ls_code,variant_code,sort,id').eq('boq_id', boqId).order('sort').order('id'))]);
    // بنود المرجع (غير الحرة): الاسم من المرجع الفني
    const vc = lines.filter(l => l.kind === 'ref' && l.variant_code).map(l => l.variant_code);
    if (vc.length) { const vs = await q(sb.from('variants').select('code,ar,en,unit,item_code,spec').in('code', vc)); const its = await q(sb.from('items').select('code,ar,en,section_code').in('code', [...new Set(vs.map(v => v.item_code))]));
      const V = Object.fromEntries(vs.map(v => [v.code, v])), I = Object.fromEntries(its.map(i => [i.code, i]));
      lines.forEach(l => { const v = V[l.variant_code]; if (!v) return; const it = I[v.item_code] || {}; l.title = l.title || `${it.ar || ''} — ${v.ar || ''}`; l.titleEn = `${it.en || it.ar || ''} — ${v.en || v.ar || ''}`; l.descr = l.descr || v.spec || ''; l.unit = l.unit || v.unit; l.div_code = l.div_code || String(v.item_code || '').slice(0, 2); }); }
    const codes = [...new Set(lines.map(l => l.ls_code).filter(Boolean))];
    const mats = codes.length ? await q(sb.from('materials').select('name,makers,ls_codes,sort').eq('active', true).order('sort')).then(r => r.filter(m => (m.ls_codes || []).some(c => codes.includes(c)))).catch(() => []) : [];
    const excl = String(boq.notes || '').split('\n').filter(x => x.trim() && /مستبعد|لا يشمل/.test(x)); const clean = x => String(x).replace(/^[-•\d.\s]+/, '').trim();
    let t = x => x, un = u => u;
    if (EN) { const I = await import('./i18n.js'); un = I.unitEN;
      t = await I.translator([prj.name, prj.facility, prj.type, boq.name, ...lines.flatMap(l => [l.title, l.descr]), ...mats.flatMap(m => [m.name, ...(m.makers || [])]), ...excl].filter(Boolean)); }
    const name = l => EN ? (l.kind === 'ref' && l.titleEn ? l.titleEn : t(l.title)) : l.title;
    const qty = l => +l.qty === 0 ? `<span class="z">${L.zero}</span>` : (/مقطوعية/.test(l.unit || '') ? L.lump : `${(+l.qty).toLocaleString(EN ? 'en' : 'ar-SA')} ${esc(EN ? un(l.unit || '') : (l.unit || ''))}`);
    const by = GROUPS.map(g => [g, lines.filter(l => groupOf(l.div_code) === g[0])]).filter(([, ls]) => ls.length);
    let n = 0;
    const tables = by.map(([g, ls], gi) => `<div class="sec ${gi ? '' : ''}"><div class="sh"><span class="sn">${gi + 2}</span><h2>${EN ? g[3] : g[2]}</h2></div>
      <table class="tbl bs"><thead><tr><th style="width:6%">${L.no}</th><th style="width:27%">${L.item}</th><th>${L.scope}</th><th style="width:12%">${L.qty}</th></tr></thead><tbody>
      ${ls.map(l => `<tr><td class="c">${++n}</td><td><b>${esc(name(l))}</b></td><td class="sc">${esc(brief(EN ? t(l.descr) : l.descr, EN))}</td><td class="c">${qty(l)}</td></tr>`).join('')}</tbody></table></div>`).join('');
    const makers = [...new Set(mats.flatMap(m => m.makers || []))].slice(0, 30);
    const body = `<div class="sec"><div class="sh"><span class="sn">1</span><h2>${L.ov}</h2></div><p class="lead">${L.ovP(lines.filter(l => +l.qty !== 0).length, by.length)}</p>
      <div class="ovg">${by.map(([g, ls]) => `<div><b>${ls.length}</b><span>${EN ? g[3] : g[2]}</span></div>`).join('')}</div>
      ${makers.length ? `<h3>${L.brands}</h3><div class="mk">${makers.map(x => `<span>${esc(EN ? t(x) : x)}</span>`).join('')}</div>` : ''}
      ${excl.length ? `<h3>${L.excl}</h3><ul class="ex">${excl.map(x => `<li>${esc(clean(EN ? t(x) : x))}</li>`).join('')}</ul>` : ''}</div>
      ${tables}
      <p class="end">${L.end}</p>`;
    const css = `.bs td{font-size:9.2pt;line-height:1.55}.bs td b{color:var(--n);font-weight:700}.bs td.sc{color:#33414d}.bs td.c,.bs th{text-align:center}.bs tr{break-inside:avoid}.z{color:var(--w);font-weight:700;font-size:8.6pt}
      .sec{margin-bottom:18px}.sec .sh{break-after:avoid;page-break-after:avoid}.sec .sh+table thead{break-before:avoid}.sec h3{font-size:11.5pt;margin:14px 0 6px;color:var(--n)}
      .ovg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.ovg div{border:1px solid var(--l);border-top:3px solid var(--s);border-radius:8px;padding:8px 10px;break-inside:avoid}.ovg b{display:block;font-size:18pt;color:var(--n);line-height:1.2}.ovg span{font-size:9pt;color:var(--g)}
      .mk{display:flex;flex-wrap:wrap;gap:5px}.mk span{background:var(--n);color:#fff;border-radius:6px;padding:2px 10px;font-size:9pt;font-weight:700;direction:ltr;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .ex{margin:4px 0;padding-${EN ? 'left' : 'right'}:18px;font-size:10pt}.end{margin-top:14px;padding:10px 14px;background:var(--s2);border-${EN ? 'left' : 'right'}:4px solid var(--s);border-radius:6px;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}`;
    const date = EN ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : dateAr(new Date().toISOString());
    const docCode = await (await import('./docctl.js')).issueDoc({ kind: 'sum', ref: boqId, title: prj.name, lang });
    openDoc({ win, lang, docCode, title: `${L.title} — ${t(prj.name)}`, body, css,
      cover: coverHtml({ en: EN, kicker: L.kicker, tag: L.tag, title: L.h1, sub: L.sub, project: t(prj.name), facility: [t(prj.facility || ''), t(prj.type || '')].filter(Boolean).join(' · '),
        pills: by.map(([g]) => EN ? g[3] : g[2]).slice(0, 5), edition: L.items(lines.filter(l => +l.qty !== 0).length), date }) });
  } catch (e) { try { win?.close(); } catch (x) { } err(e); }
}
