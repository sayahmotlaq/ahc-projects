// ===== العروض التنفيذية: منطق مشترك بين المنصة والصفحة العامة (حالة البند، العدّاد، تصدير PowerPoint بهوية التجمع) =====
export const B_KIND = { targets: 'منجزات مستهدفة', proposal: 'مقترح', update: 'تحديث تنفيذي', other: 'عرض' };
export const B_ST = { draft: 'مسودة', published: 'منشور', archived: 'مؤرشف' };
const STAGE_AR = { request: 'طلب / فكرة', study: 'دراسة', approval: 'اعتماد', design: 'تصميم', tender: 'طرح', award: 'ترسية', execution: 'تنفيذ', handover: 'استلام ابتدائي', warranty: 'فترة الضمان', closed: 'مقفل', onhold: 'موقوف', cancelled: 'ملغى' };
export const COLORS = { navy: '123B5C', sky: '27A8DF', gold: 'B8860B', sage: '2E8B57', rust: 'A0522D', grey: '6B7A88', ink: '1C2B36', light: 'EEF3F7' };
const num = v => Number(v || 0);
export const dAr = (d, o = { year: 'numeric', month: 'long', day: 'numeric' }) => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', o) : '';
export const dShort = d => dAr(d, { month: 'short', day: 'numeric' });
export const daysLeft = d => d ? Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5) : null;

// حالة البند الموحدة: شريحة + لون + نسبة + سطر الوضع الراهن
// البند المرتبط بمشروع يأخذ حالته حيّة من المشروع؛ والبند الحر يأخذها من حقوله اليدوية
export function itemState(it) {
  const p = it.project; let chip, color, pct = it.pct ?? null, line = it.status_text || '', late = false;
  if (it.done) { chip = 'منجز'; color = 'sage'; pct = 100; }
  else if (p) {
    const pa = Math.round(num(p.pa)); late = !!p.late;
    if (p.stage === 'execution') { chip = `تنفيذ ${pa}٪`; color = late ? 'rust' : 'sage'; pct = pa; }
    else if (['handover', 'warranty', 'closed'].includes(p.stage)) { chip = p.stage === 'handover' ? 'استلام ابتدائي' : 'منجز'; color = 'sage'; pct = 100; }
    else if (p.stage === 'tender') { chip = 'طرح'; color = 'navy'; pct = pct ?? 25; }
    else if (p.stage === 'award') { chip = 'ترسية'; color = 'sky'; pct = pct ?? 35; }
    else if (p.stage === 'onhold' || p.stage === 'cancelled') { chip = STAGE_AR[p.stage]; color = 'rust'; }
    else { chip = 'دراسة'; color = 'gold'; pct = pct ?? 10; }
    if (it.tag) chip = it.tag;
    if (!line) { const parts = [STAGE_AR[p.stage] || p.stage]; if (p.stage === 'execution') { parts.push(`${pa}٪ مقابل مخطط ${Math.round(num(p.pl))}٪`); if (p.end) parts.push((late && p.end < new Date().toISOString().slice(0, 10) ? 'تجاوز ' : 'الانتهاء ') + dShort(p.end)); if (p.contractor) parts.push(p.contractor); } else if (p.stage === 'tender' && p.tender) parts.push('الطرح ' + dShort(p.tender)); line = parts.join(' · '); }
  } else { chip = it.tag || 'حصر'; color = /تنفيذ/.test(chip) ? 'sage' : /دراس/.test(chip) ? 'gold' : /منجز|مكتمل/.test(chip) ? 'sage' : /متأخر|متعثر/.test(chip) ? 'rust' : 'sky'; }
  if (line === chip) line = '';
  return { chip, color, pct: pct == null ? null : Math.max(0, Math.min(100, Math.round(pct))), line, late, hex: COLORS[color] || COLORS.sky };
}
export function briefStats(items) {
  const st = items.map(itemState); const n = items.length;
  const done = st.filter(s => s.pct === 100).length, exec = st.filter(s => /^تنفيذ/.test(s.chip) && s.pct < 100).length, early = n - done - exec;
  const avg = n ? Math.round(st.reduce((a, s) => a + (s.pct ?? 0), 0) / n) : 0;
  return { n, done, exec, early, avg };
}

// ---------- تصدير PowerPoint بهوية التجمع (يُحمَّل pptxgen.bundle.js محلياً عند الطلب)
export function loadPptx() { return new Promise((res, rej) => { if (window.PptxGenJS) return res(); const s = document.createElement('script'); s.src = 'assets/pptxgen.bundle.js'; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة PowerPoint')); document.head.appendChild(s); }); }
async function logoB64() { try { const r = await fetch('assets/logo.png'); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(b); }); } catch (e) { return null; } }

export async function buildBriefPptx(B, items, { org = 'تجمع الأحساء الصحي', dept = 'إدارة الخدمات الفنية — قسم المشاريع' } = {}) {
  await loadPptx(); const logo = await logoB64();
  const pres = new PptxGenJS(); pres.layout = 'LAYOUT_WIDE'; pres.rtlMode = true; pres.lang = 'ar-SA'; pres.theme = { headFontFace: 'Tajawal', bodyFontFace: 'Tajawal' };
  pres.title = B.title; pres.author = dept; pres.company = org.replace(/&/g, '&amp;');
  const { navy, sky, gold, sage, grey, ink } = COLORS; const W = 13.333, M = 0.6;
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, rtlMode: true, align: 'right', fontFace: 'Tajawal', margin: 0 }, o));
  const foot = `${dept} · ${org}`;
  const chrome = (s, dark) => { if (logo) s.addImage({ data: 'image/png;base64,' + logo, x: W - M - 1.35, y: 0.38, w: 1.35, h: 0.47 }); T(s, foot, { x: M, y: 7.05, w: 7, h: 0.3, fontSize: 10, color: dark ? 'B9CBD9' : grey, align: 'left' }); };
  const st = briefStats(items); const dl = daysLeft(B.ref_date);
  const issued = dAr(new Date().toISOString().slice(0, 10));
  const kindAr = B_KIND[B.kind] || B_KIND.other;

  // --- 1) الغلاف: العنوان + المؤشرات + التمهيد
  {
    const s = pres.addSlide(); s.background = { color: navy }; chrome(s, true);
    T(s, kindAr.toUpperCase(), { x: M, y: 0.42, w: 6, h: 0.3, fontSize: 11, bold: true, color: sky, charSpacing: 2 });
    T(s, B.title, { x: M, y: 0.8, w: W - 2 * M - 1.5, h: 1.0, fontSize: B.title.length > 45 ? 26 : 30, bold: true, color: 'FFFFFF', valign: 'top' });
    if (B.subtitle) T(s, B.subtitle, { x: M, y: 1.8, w: W - 2 * M - 1.5, h: 0.45, fontSize: 15, color: 'B9CBD9' });
    const stats = [[String(st.n), 'بنداً في العرض'], [dl != null ? String(Math.max(0, dl)) : '—', dl != null ? `يوماً حتى ${B.ref_label || 'الموعد'}` : 'بلا موعد مرجعي'], [String(st.exec + st.done), 'قيد التنفيذ أو منجزة'], [String(st.early), 'دراسة / طرح / حصر']];
    stats.forEach(([n, l], i) => { const bw = 2.75, x = W - M - (i + 1) * (bw + 0.2) + 0.2; s.addShape(pres.ShapeType.roundRect, { x, y: 2.55, w: bw, h: 1.05, fill: { color: '1C4A6E' }, line: { color: '2A5C85', width: 0.5 }, rectRadius: 0.1 }); T(s, n, { x: x + 0.12, y: 2.58, w: 1.0, h: 1.0, fontSize: 34, bold: true, color: i === 1 ? 'F2C94C' : 'FFFFFF', align: 'center', valign: 'middle' }); T(s, l, { x: x + 1.15, y: 2.6, w: bw - 1.3, h: 0.95, fontSize: 12, color: 'DDE7EF', valign: 'middle' }); });
    if (B.intro) T(s, B.intro, { x: M, y: 3.95, w: W - 2 * M, h: 1.9, fontSize: 13.5, color: 'E6EEF5', valign: 'top', lineSpacingMultiple: 1.25 });
    const meta = [`تاريخ الإصدار: ${issued}`]; if (B.ref_date) meta.push(`${B.ref_label || 'الموعد المرجعي'}: ${dAr(B.ref_date)}`); if (B.by) meta.push(`إعداد: ${B.by}`);
    T(s, meta.join('     '), { x: M, y: 6.35, w: W - 2 * M, h: 0.35, fontSize: 11.5, color: 'B9CBD9' });
    s.addNotes(`${kindAr}: ${B.title}`);
  }
  // --- 2) بطاقات البنود (12 في الشريحة، عمودان من اليمين)
  const PER = 12, pages = Math.max(1, Math.ceil(items.length / PER));
  for (let pg = 0; pg < pages; pg++) {
    const s = pres.addSlide(); s.background = { color: 'FFFFFF' }; chrome(s, false);
    T(s, pages > 1 ? `البنود (${pg + 1} من ${pages})` : 'البنود ووضعها الراهن', { x: M, y: 0.4, w: 9, h: 0.55, fontSize: 24, bold: true, color: navy });
    T(s, `الوضع الراهن من منصة إدارة المشاريع بتاريخ ${issued}`, { x: M, y: 0.95, w: 9, h: 0.3, fontSize: 11.5, color: grey });
    const colW = (W - 2 * M - 0.3) / 2, cardH = 0.86, y0 = 1.45, rows = 6;
    items.slice(pg * PER, pg * PER + PER).forEach((it, k) => {
      const i = pg * PER + k, col = k < rows ? 0 : 1, row = k % rows, x = col === 0 ? W - M - colW : M, y = y0 + row * (cardH + 0.07), S = itemState(it);
      s.addShape(pres.ShapeType.roundRect, { x, y, w: colW, h: cardH, fill: { color: 'F6F8FB' }, line: { color: 'E3E8EE', width: 0.75 }, rectRadius: 0.06 });
      s.addShape(pres.ShapeType.ellipse, { x: x + colW - 0.5, y: y + 0.14, w: 0.36, h: 0.36, fill: { color: navy }, line: { color: navy, width: 0 } });
      T(s, String(i + 1), { x: x + colW - 0.5, y: y + 0.14, w: 0.36, h: 0.36, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      T(s, it.title, { x: x + 1.5, y: y + 0.07, w: colW - 2.1, h: 0.42, fontSize: 11.5, bold: true, color: ink, valign: 'top' });
      if (S.line) T(s, S.line, { x: x + 1.5, y: y + 0.5, w: colW - 2.1, h: 0.22, fontSize: 8.5, color: grey, valign: 'top' });
      s.addShape(pres.ShapeType.roundRect, { x: x + 0.14, y: y + 0.16, w: 1.22, h: 0.3, fill: { color: S.hex }, line: { color: S.hex, width: 0 }, rectRadius: 0.15 });
      T(s, S.chip, { x: x + 0.14, y: y + 0.16, w: 1.22, h: 0.3, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      if (it.target_date) T(s, 'المستهدف ' + dShort(it.target_date), { x: x + 0.14, y: y + 0.5, w: 1.3, h: 0.22, fontSize: 8, color: grey, align: 'center' });
      if (S.pct != null) { s.addShape(pres.ShapeType.rect, { x: x + 0.14, y: y + cardH - 0.1, w: colW - 0.28, h: 0.05, fill: { color: 'E3E8EE' }, line: { color: 'E3E8EE', width: 0 } }); if (S.pct > 0) s.addShape(pres.ShapeType.rect, { x: x + colW - 0.14 - (colW - 0.28) * S.pct / 100, y: y + cardH - 0.1, w: (colW - 0.28) * S.pct / 100, h: 0.05, fill: { color: S.hex }, line: { color: S.hex, width: 0 } }); }
    });
  }
  // --- 3) جدول التفاصيل: الوضع الراهن / الإنجاز المتوقع / ما سيُعرض / ملاحظات
  const hdr = t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: navy }, align: 'center', valign: 'middle', fontSize: 11, rtlMode: true, fontFace: 'Tajawal' } });
  const cell = (t, o = {}) => ({ text: t || '', options: Object.assign({ fontSize: 9.5, color: ink, valign: 'middle', align: 'right', rtlMode: true, fontFace: 'Tajawal' }, o) });
  const RPP = 12, tpages = Math.max(1, Math.ceil(items.length / RPP));
  const anyDetail = items.some(it => it.expected || it.show_text || it.notes);
  for (let pg = 0; pg < tpages; pg++) {
    const s = pres.addSlide(); s.background = { color: 'FFFFFF' }; chrome(s, false);
    T(s, (B.kind === 'targets' ? 'الإنجاز المتوقع' + (B.ref_date ? ` بحلول ${B.ref_label || 'الموعد'}` : '') : 'تفاصيل البنود') + (tpages > 1 ? ` (${pg + 1} من ${tpages})` : ''), { x: M, y: 0.4, w: 9.5, h: 0.55, fontSize: 24, bold: true, color: navy });
    T(s, anyDetail ? 'لكل بند: الوضع الراهن، والإنجاز المتوقع، وما سيُعرض ميدانياً، وملاحظات القسم' : 'يُعبّأ بواسطة رئيس القسم ويُحدَّث حتى الموعد', { x: M, y: 0.95, w: 9.5, h: 0.3, fontSize: 11.5, color: grey });
    const rows = [[hdr('ملاحظات'), hdr('ما سيُعرض ميدانياً'), hdr('الإنجاز المتوقع'), hdr('الوضع الراهن'), hdr('البند'), hdr('م')]];
    items.slice(pg * RPP, pg * RPP + RPP).forEach((it, k) => { const S = itemState(it); rows.push([cell(it.notes), cell(it.show_text), cell(it.expected, { align: 'center' }), cell(S.line ? `${S.chip}\n${S.line}` : S.chip, { align: 'center', bold: true, color: S.hex, fontSize: 8.5 }), cell(it.title, { bold: true }), cell(String(pg * RPP + k + 1), { align: 'center', bold: true, color: navy })]); });
    s.addTable(rows, { x: M, y: 1.4, w: W - 2 * M, colW: [2.2, 2.5, 1.7, 2.1, 3.23, 0.4], rowH: 0.42, border: { type: 'solid', color: 'D9E1E8', pt: 0.75 }, fill: { color: 'FFFFFF' }, margin: [0.03, 0.08, 0.03, 0.08], autoPage: false });
  }
  // --- 4) الخاتمة / القرارات المطلوبة
  if (B.closing) {
    const s = pres.addSlide(); s.background = { color: navy }; chrome(s, true);
    T(s, B.kind === 'proposal' ? 'التوصية والقرار المطلوب' : 'الخلاصة والقرارات المطلوبة', { x: M, y: 0.8, w: W - 2 * M - 1.5, h: 0.7, fontSize: 28, bold: true, color: 'FFFFFF' });
    s.addShape(pres.ShapeType.rect, { x: W - M - 1.2, y: 1.6, w: 1.2, h: 0.06, fill: { color: gold }, line: { color: gold, width: 0 } });
    T(s, B.closing, { x: M, y: 1.95, w: W - 2 * M, h: 4.3, fontSize: 15, color: 'E6EEF5', valign: 'top', lineSpacingMultiple: 1.35 });
    T(s, `${issued}${B.by ? ' · إعداد ' + B.by : ''}`, { x: M, y: 6.4, w: 8, h: 0.3, fontSize: 11.5, color: 'B9CBD9' });
  }
  return await pres.write({ outputType: 'blob' });
}
