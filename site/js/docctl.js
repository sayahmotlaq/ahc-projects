// ===== ضبط الوثائق الصادرة: رقم مرجعي لكل ملف يصدر من المنصة + سجل إصدار + بصمة الملف للتحقق =====
import { sb, q, session } from './api.js';

const pad = n => String(n).padStart(2, '0');
export const STAMP_AR = 'نسخة صادرة من منصة إدارة الخدمات الفنية — أي تعديل عليها يبطلها';
export const STAMP_EN = 'Issued from the AHC Technical Services platform — any alteration voids this copy';

// kind: boq | guide | ho ؛ ref: معرّف الجدول أو المشروع
export async function issueDoc({ kind, ref = '', title = '', lang = 'ar' }) {
  const d = new Date(); const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `AHC-${kind.toUpperCase()}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${rnd}`;
  try { await q(sb.from('doc_issues').insert({ code, kind, ref_id: String(ref || ''), title, lang, issued_by: session.user?.id || null, issued_name: session.profile?.full_name || '' })); } catch (e) { console.warn('doc_issues', e); }
  return code;
}
export async function sha256(buf) { const b = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function setHash(code, buf) { try { await q(sb.from('doc_issues').update({ sha256: await sha256(buf) }).eq('code', code)); } catch (e) { } }

// صفحة التحقق: إدخال الرقم المرجعي + (اختياري) الملف للمقارنة ببصمة النسخة الأصلية
export async function openVerify() {
  const { modal, esc, $, dateAr } = await import('./ui.js');
  modal(`<div class="pgrid"><label class="fld wide"><span>الرقم المرجعي المطبوع على الوثيقة</span><input id="vCode" dir="ltr" placeholder="AHC-BOQ-261023-1830-XXXX"></label>
    <label class="fld wide"><span>ملف Excel الذي قدّمه المقاول (اختياري — للمقارنة بالنسخة الأصلية)</span><input id="vFile" type="file" accept=".xlsx"></label>
    <div class="btnrow end wide"><button class="btn primary" id="vGo">تحقق</button></div><div id="vOut" class="wide"></div></div>`, { title: 'التحقق من وثيقة صادرة', onOpen: (w) => {
    $('#vGo', w).onclick = async () => {
      const code = $('#vCode', w).value.trim().toUpperCase(); const out = $('#vOut', w);
      const { data } = await sb.from('doc_issues').select('*').eq('code', code).maybeSingle();
      if (!data) { out.innerHTML = '<div class="notice bad">لا توجد وثيقة صادرة بهذا الرقم من المنصة.</div>'; return; }
      let cmp = ''; const f = $('#vFile', w).files[0];
      if (f) { const h = await sha256(await f.arrayBuffer()); cmp = !data.sha256 ? '<p class="muted">لا توجد بصمة محفوظة لهذه الوثيقة (ملفات PDF لا تُحفظ بصمتها).</p>' : h === data.sha256 ? '<div class="notice ok"><b>مطابق للنسخة الأصلية</b> — لم يُعدَّل الملف.</div>' : '<div class="notice bad"><b>غير مطابق</b> — الملف عُدِّل أو أعيد حفظه بعد إصداره. اطلب النسخة الأصلية أو قارن البنود يدوياً.</div>'; }
      out.innerHTML = `<div class="gpk-goal"><b>${esc(data.title || '')}</b><br>الرقم: <span class="ltr">${esc(data.code)}</span><br>النوع: ${esc({ boq: 'جدول كميات', guide: 'دليل المواصفات', ho: 'اشتراطات التسليم', svc: 'ملف خدمة أو طلب', sum: 'ملخص جدول الكميات' }[data.kind] || data.kind)} · ${data.lang === 'en' ? 'إنجليزي' : 'عربي'}<br>صدرت: ${esc(dateAr(data.issued_at))} ${new Date(data.issued_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}${data.issued_name ? ' — ' + esc(data.issued_name) : ''}</div>${cmp}`;
    };
  } });
}
