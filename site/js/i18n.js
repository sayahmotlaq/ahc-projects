// ===== الترجمة الإنجليزية للمخرجات (جداول الكميات، اشتراطات التسليم، دليل المواصفات) =====
// كل نص عربي يُترجم مرة واحدة ويُحفظ في جدول i18n بمفتاح = SHA-256 للنص بعد توحيد المسافات.
// أي تعديل على النص العربي يغيّر مفتاحه فيظهر في «النصوص غير المترجمة» بدل أن تبقى ترجمة قديمة.
import { sb, q } from './api.js';

export const normText = s => String(s ?? '').replace(/[ \t\r\n ]+/g, ' ').trim();
const enc = new TextEncoder();
export async function keyOf(s) { const b = await crypto.subtle.digest('SHA-256', enc.encode(normText(s))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

let DB = null;
export async function loadEN(force = false) {
  if (DB && !force) return DB; DB = new Map();
  for (let from = 0; ; from += 1000) { const rows = await q(sb.from('i18n').select('k,en').range(from, from + 999)); rows.forEach(r => DB.set(r.k, r.en)); if (rows.length < 1000) break; }
  return DB;
}
const UNIT = { 'مقطوعية': 'Lump sum', 'غرفة': 'Room', 'جناح': 'Suite', 'عدد': 'No.', 'م2': 'm²', 'م²': 'm²', 'م.ط': 'LM', 'م ط': 'LM', 'م3': 'm³', 'م³': 'm³', 'كجم': 'kg', 'طن': 'ton', 'مجموعة': 'Set', 'لتر': 'litre', 'نقطة': 'Point', 'طقم': 'Set', 'زوج': 'Pair', 'شهر': 'Month', 'يوم': 'Day', 'ساعة': 'Hour' };
export const unitEN = u => UNIT[normText(u)] || u;
const hasAr = s => /[؀-ۿ]/.test(String(s || ''));

// يجهّز دالة ترجمة متزامنة لمجموعة نصوص: t(ar) ← الإنجليزي أو العربي نفسه إن لم يُترجم بعد
// النصوص متعددة الأسطر (الملاحظات العامة) تُترجم سطراً سطراً إن لم توجد ترجمة للنص كاملاً
export async function translator(texts) {
  const db = await loadEN(); const map = new Map(), missing = new Set();
  const one = async s => { const n = normText(s); if (!n || !hasAr(n)) return n; const k = await keyOf(n); if (db.has(k)) return db.get(k); return null; };
  for (const s of new Set(texts.filter(Boolean).map(String))) {
    let v = await one(s);
    if (v == null && s.includes('\n')) { const parts = []; let all = true; for (const line of s.split('\n')) { if (!line.trim()) { parts.push(''); continue; } const x = await one(line); if (x == null) { all = false; parts.push(line); missing.add(normText(line)); } else parts.push(x); } v = parts.join('\n'); if (all) missing.delete(normText(s)); }
    if (v == null) { missing.add(normText(s)); v = s; }
    map.set(s, v);
  }
  const t = s => s == null || s === '' ? s : (map.has(String(s)) ? map.get(String(s)) : String(s));
  t.missing = missing; return t;
}

// النصوص المطلوبة لتصدير جدول كميات بالإنجليزية (لصفحة «الترجمة» وللتحقق قبل التصدير)
export function boqTexts(prj, c) {
  const out = [prj.name, prj.facility, prj.type, prj.dept, prj.engineer, prj.boqName];
  if (prj.notes) out.push(prj.notes, ...prj.notes.split('\n').filter(x => x.trim())); // النص كاملاً لترجمة الكتلة سطراً سطراً، والأسطر لصفحة الترجمة
  c.groups.forEach(g => g.lines.forEach(L => { if (L.free) out.push(L.ln.title, L.ln.descr, L.ln.loc); else out.push(L.r.v.spec, L.ln.loc); }));
  (c.handover || []).forEach(h => out.push(h.grp, h.title, h.descr, h.deliver, h.stage));
  return out.filter(Boolean);
}

export async function saveEN(src, en) {
  const n = normText(src); const k = await keyOf(n);
  await q(sb.from('i18n').upsert({ k, src: n, en: normText(en) ? en.trim() : '', updated_at: new Date().toISOString() }, { onConflict: 'k' }));
  if (DB) DB.set(k, en.trim());
}
