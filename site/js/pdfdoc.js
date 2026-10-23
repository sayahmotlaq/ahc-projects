// ===== مستندات PDF بهوية التجمع: نافذة مستقلة بغلاف وتنسيق طباعة A4 وفوتر حقوق النشر — تُحفظ PDF من نافذة الطباعة =====
import { esc, toast } from './ui.js';

export const COPYRIGHT = '© 2026 حقوق النشر محفوظة لتجمع الأحساء الصحي — إدارة الخدمات الفنية';
export const COPYRIGHT_EN = '© 2026 All rights reserved — Al Ahsa Health Cluster, Technical Services Department';
export const DOC_CSS = `:root{--n:#153E5C;--n2:#123B5C;--s:#27A8DF;--s2:#E8F6FC;--g:#5B6B7A;--l:#E3EAF0;--ok:#0F7B5F;--okb:#E7F5F0;--w:#B5562B;--wb:#FBEFE8}

*{box-sizing:border-box}body{font-family:'Tajawal',sans-serif;color:#1d2b36;font-size:10.6pt;line-height:1.75;margin:0}
h1,h2,h3,h4{margin:0;color:var(--n)}.ltr{direction:ltr;unicode-bidi:isolate}.c{text-align:center}
.brk{break-before:page}
.lead{font-size:11.4pt;line-height:1.85}.intro{font-size:10.2pt;line-height:1.7}
.intro h2,.sh h2{font-size:18pt;font-weight:800}
.intro .rib{width:64px;height:5px;background:var(--s);border-radius:3px;margin:8px 0 16px}
.intro p{margin:0 0 11px}
.sig{margin-top:18px;padding:12px 16px;border-right:4px solid var(--s);background:var(--s2);border-radius:6px}
.why5{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0}
.why5 div{border:1px solid var(--l);border-radius:8px;padding:10px 12px;break-inside:avoid}.why5 b{color:var(--n);display:block;font-size:11pt}.why5 span{font-size:9.6pt;color:var(--g)}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:8px}.legend div{display:flex;gap:8px;align-items:center;font-size:9.5pt}
.sh{display:flex;align-items:center;gap:12px;border-bottom:3px solid var(--n);padding-bottom:8px;margin-bottom:6px}
.sn{background:var(--n);color:#fff;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:15pt}
.si{color:var(--g);margin:6px 0 14px}
.item{border:1px solid var(--l);border-radius:10px;padding:12px 14px 10px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid}
.item.big{break-inside:auto;page-break-inside:auto}tr,.why,.ih{break-inside:avoid}
.ih{display:flex;align-items:flex-start;gap:10px}
.ic{direction:ltr;background:var(--s2);color:var(--n);font-weight:700;font-size:9pt;padding:3px 8px;border-radius:5px;white-space:nowrap;margin-top:3px}
.it{flex:1}.it h3{font-size:13pt;font-weight:800;line-height:1.4}.en{direction:ltr;text-align:right;color:var(--s);font-weight:700;font-size:9.4pt}
.rule{font-size:8.6pt;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;margin-top:3px}
.rule.sm{font-size:8pt;padding:1px 8px}
.r-only{background:var(--n);color:#fff}.r-list{background:var(--s);color:#fff}.r-eq{background:#fff;color:var(--n);border:1px solid var(--n)}
.apr{margin:6px 0 4px;font-size:10pt}.apr span{color:var(--g)}.apr b{color:var(--n)}
.bdg{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 8px}
.b{display:inline-flex;align-items:center;gap:5px;border-radius:5px;padding:1px 7px;font-size:8.2pt;background:var(--n);color:#fff}
.b b{direction:ltr;font-weight:700}.b i{font-style:normal;opacity:.85}
.b-HT,.b-247{background:var(--s)}.b-DIS,.b-HYG{background:var(--ok)}.b-FIRE{background:#B23A3A}.b-G1{background:#0b2a40}.b-UNI,.b-WAR{background:#6B5BA8}.b-ADA{background:#2F6FB5}
table{width:100%;border-collapse:collapse}
.cmp th,.cmp td{border:1px solid var(--l);padding:5px 8px;vertical-align:top;font-size:9.6pt;line-height:1.6}
.cmp thead th{background:var(--n);color:#fff;font-weight:700;border-color:var(--n)}
.cmp thead th.mk{background:#7A8794;border-color:#7A8794}.cmp thead th.ap{background:var(--s);border-color:var(--s)}
.cmp tbody th{background:#F5F8FA;color:var(--n);width:22%;text-align:right;font-weight:700}
.cmp td.mk{color:#55626e;width:33%}.cmp td.ap{background:#F3FAFE;font-weight:500;color:#0f2c42}
.why{display:grid;grid-template-columns:1.25fr 1fr;gap:8px;margin-top:8px}
.why>div{border-radius:7px;padding:7px 10px}.why h4{font-size:9.8pt;margin-bottom:2px}.why p{margin:0;font-size:9.4pt;line-height:1.65}
.w1{background:var(--okb)}.w1 h4{color:var(--ok)}.w2{background:var(--wb)}.w2 h4{color:var(--w)}
.sub{font-size:9pt;margin-top:6px;color:var(--g);display:flex;gap:6px}.sub b{color:var(--n);white-space:nowrap}.sub ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:3px 6px}
.sub li{background:#F5F8FA;border-radius:4px;padding:0 6px}
.sup,.rf{color:var(--s);font-size:7.5pt;font-weight:700}
.tbl th,.tbl td{border-bottom:1px solid var(--l);padding:5px 7px;font-size:9.4pt;text-align:right;vertical-align:top}
.tbl thead th{background:var(--n);color:#fff;font-weight:700}.tbl tbody tr:nth-child(even){background:#F7FAFC}
.tbl td.br{text-align:left;font-weight:700;color:var(--n)}
.box{border:1px solid var(--l);border-radius:10px;padding:12px 14px;margin:12px 0;break-inside:avoid}
.box h3{font-size:12.5pt;margin-bottom:6px}
.brands{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px}
.brands div{border:1px solid var(--l);border-top:4px solid var(--s);border-radius:8px;padding:8px 10px;font-size:9pt;line-height:1.55}
.brands b{direction:ltr;display:block;color:var(--n);font-size:11pt;text-align:right}
.dr{margin:8px 0}.dr .r{display:grid;grid-template-columns:150px 1fr 70px;gap:8px;align-items:center;margin:5px 0;font-size:9.4pt}
.dr .bar{height:14px;border-radius:7px;background:var(--l);overflow:hidden}.dr .bar i{display:block;height:100%;background:var(--s);border-radius:7px}
.dr .r.mk .bar i{background:#9AA6B1}.dr .v{direction:ltr;text-align:left;font-weight:700;color:var(--n)}
.steps{counter-reset:s;list-style:none;padding:0;margin:8px 0}.steps li{counter-increment:s;position:relative;padding:6px 44px 6px 0;border-bottom:1px dashed var(--l)}
.steps li:before{content:counter(s);position:absolute;right:0;top:6px;width:30px;height:30px;border-radius:50%;background:var(--s2);color:var(--n);font-weight:800;display:grid;place-items:center}
.src li{font-size:8.8pt;line-height:1.55;margin-bottom:4px}.src a{direction:ltr;unicode-bidi:isolate;color:var(--s);text-decoration:none;word-break:break-all;font-size:8pt}
.std{columns:2;font-size:9pt}
.note{background:var(--s2);border-radius:8px;padding:9px 12px;font-size:9.6pt;margin:10px 0}
.end{text-align:center;margin-top:24px;color:var(--n);font-weight:700}`;

const COVER_CSS = `.cv{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;break-after:page;page-break-after:always}
.cv-top{padding:22mm 18mm 0;display:flex;justify-content:space-between;align-items:center}.cv-top img{height:24mm}
.cv-tag{color:#27A8DF;font-weight:700;font-size:11pt;border:1.5px solid #27A8DF;border-radius:30px;padding:4px 16px}
.cv-band{position:absolute;left:0;right:0;top:78mm;height:150mm;background:#153E5C}
.cv-band:after{content:"";position:absolute;left:0;right:0;bottom:0;height:8mm;background:#27A8DF}
.cv-tx{position:absolute;top:96mm;right:18mm;left:18mm;color:#fff}
.cv-k{color:#27A8DF;font-weight:700;font-size:13pt}
.cv h1{font-size:31pt;line-height:1.35;margin:8px 0 12px;font-weight:800;color:#fff}
.cv-sub{font-size:13.5pt;line-height:1.7;opacity:.92;max-width:160mm}
.cv-prj{display:inline-block;margin-top:16px;background:rgba(255,255,255,.12);border-radius:10px;padding:8px 14px;font-size:12.5pt}.cv-prj b{display:block;font-size:15pt}
.cv-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.cv-pills span{border:1px solid rgba(255,255,255,.45);border-radius:20px;padding:3px 12px;font-size:10pt;direction:ltr}
.cv-ft{position:absolute;bottom:20mm;right:18mm;left:18mm;display:flex;justify-content:space-between;align-items:flex-end;color:#153E5C}
.cv-ft b{font-size:12.5pt;display:block}.cv-ft span{color:#5B6B7A;font-size:10.5pt}`;

// قلب التنسيق لليسار في النسخة الإنجليزية
const LTR_CSS = `body{line-height:1.6}.cmp tbody th,.tbl th,.tbl td{text-align:left}.en{text-align:left;direction:ltr}.sig{border-right:0;border-left:4px solid var(--s)}
.steps li{padding:6px 0 6px 44px}.steps li:before{right:auto;left:0}.dr .v{text-align:right}.brands b{text-align:left}.intro p{text-align:justify}.b i{display:none}.cv h1{font-size:26pt;line-height:1.25}`;
// cover: { kicker, title, sub, project, facility, pills[], tag, date, edition }
let LOGO = null;
async function logoData() { if (LOGO) return LOGO; try { const b = await (await fetch(new URL('assets/logo.png', location.href).href)).blob(); LOGO = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch (e) { LOGO = new URL('assets/logo.png', location.href).href; } return LOGO; }
// تُفتح النافذة فوراً عند الضغط (حتى لا يمنعها المتصفح) ثم تُملأ بالمستند
export function prepDoc() { const w = window.open('', '_blank'); if (!w) { toast('اسمح بفتح النوافذ المنبثقة لهذا الموقع ثم أعد المحاولة', 'bad'); return null; } w.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:40vh;direction:rtl">جارٍ تجهيز المستند…</p>'); w.document.close(); logoData(); return w; }
export function coverHtml(c) {
  const logo = '%%LOGO%%';
  return `<div class="cv"><div class="cv-top"><img src="${logo}" alt=""><span class="cv-tag">${esc(c.tag || (c.en ? 'For information and guidance' : 'للاطلاع والاسترشاد'))}</span></div><div class="cv-band"></div>
  <div class="cv-tx"><div class="cv-k">${esc(c.kicker || '')}</div><h1>${c.title}</h1>${c.sub ? `<div class="cv-sub">${esc(c.sub)}</div>` : ''}
  ${c.project ? `<div class="cv-prj"><b>${esc(c.project)}</b>${esc(c.facility || '')}</div>` : ''}
  ${(c.pills || []).length ? `<div class="cv-pills">${c.pills.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}</div>
  <div class="cv-ft"><div><b>${c.dept || (c.en ? 'Technical Services Department — Projects Section' : 'إدارة الخدمات الفنية — قسم المشاريع')}</b><span>${c.en ? 'Al Ahsa Health Cluster' : 'تجمع الأحساء الصحي'}</span></div><div style="text-align:${c.en ? 'right' : 'left'}"><b>${esc(c.edition || '')}</b><span>${esc(c.date || '')}</span></div></div></div>`;
}

// يفتح المستند في نافذة جديدة ويطلق الطباعة بعد تحميل الخط
export async function openDoc({ title, cover = '', body, css = '', win = null, lang = 'ar', docCode = '' }) {
  const en = lang === 'en', A = en ? 'left' : 'right', B = en ? 'right' : 'left';
  const w = win || prepDoc(); if (!w || w.closed) return;
  cover = cover.replace('%%LOGO%%', await logoData());
  const foot = (en ? COPYRIGHT_EN : COPYRIGHT).replace(/"/g, '\"');
  w.document.open();
  w.document.write(`<!doctype html><html lang="${en ? 'en' : 'ar'}" dir="${en ? 'ltr' : 'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:20mm 16mm 18mm;@bottom-${A}{content:"${foot}";font-family:Tajawal,sans-serif;font-size:7.5pt;color:#5B6B7A}${docCode ? `@bottom-center{content:"${docCode}";font-family:Tajawal,sans-serif;font-size:7pt;color:#9AA6B1;direction:ltr}` : ''}@bottom-${B}{content:counter(page) " / " counter(pages);font-family:Tajawal,sans-serif;font-size:8pt;color:#5B6B7A}@top-center{content:"";border-bottom:3px solid #27A8DF;width:100%;vertical-align:bottom;margin-bottom:6mm}}
${cover ? '@page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}@bottom-center{content:none}@top-center{content:none;border:0}}' : ''}
${DOC_CSS}
${COVER_CSS}
.docstamp{margin-top:18px;border-top:1px solid #E3EAF0;padding-top:8px;font-size:8.5pt;color:#5B6B7A;text-align:center}
.docbar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;justify-content:center;background:#153E5C;color:#fff;padding:10px;font-size:13px}
.docbar button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;background:#27A8DF;color:#fff}.docbar button.g{background:transparent;border:1px solid rgba(255,255,255,.5)}
@media screen{html{background:#E9EEF2}body{max-width:210mm;margin:0 auto 30px;background:#fff;box-shadow:0 2px 18px rgba(0,0,0,.12)}.doc{padding:20mm 16mm}.cv{margin-bottom:0;border-bottom:1px dashed #cdd6de}}
@media print{.docbar{display:none}body{max-width:none}.doc{padding:0}}
${en ? LTR_CSS : ''}
${css}
</style></head><body><div class="docbar" dir="rtl"><span>لحفظ الملف PDF: اضغط «طباعة» ثم اختر «حفظ بتنسيق PDF»</span><button onclick="print()">طباعة / حفظ PDF</button><button class="g" onclick="close()">إغلاق</button></div>${cover}<div class="doc">${body}${docCode ? `<p class="docstamp">${en ? 'Ref.' : 'الرقم المرجعي'} <span dir="ltr">${docCode}</span> — ${en ? 'Issued from the AHC Technical Services platform; any alteration voids this copy. Verify at ahc-tsd.com › Technical Library › Verify a document.' : 'نسخة صادرة من منصة إدارة الخدمات الفنية، وأي تعديل عليها يبطلها. يُتحقق منها في المنصة: المكتبة الفنية ← التحقق من وثيقة.'}</p>` : ''}</div></body></html>`);
  w.document.close();
  const go = () => (w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(() => w.print(), 350));
  if (w.document.readyState === 'complete') go(); else w.addEventListener('load', go);
}
