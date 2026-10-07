// ===== العروض التنفيذية: منطق مشترك بين المنصة والصفحة العامة (حالة البند، العدّاد، تصدير PowerPoint بهوية التجمع) =====
export const B_KIND = { targets: 'منجزات مستهدفة', proposal: 'مقترح', update: 'تحديث تنفيذي', other: 'عرض' };
export const B_ST = { draft: 'مسودة', published: 'منشور', archived: 'مؤرشف' };
const STAGE_AR = { request: 'طلب / فكرة', study: 'دراسة', approval: 'اعتماد', design: 'تصميم', tender: 'طرح', award: 'ترسية', execution: 'تنفيذ', handover: 'استلام ابتدائي', warranty: 'فترة الضمان', closed: 'مقفل', onhold: 'موقوف', cancelled: 'ملغى' };
export const COLORS = { navy: '123B5C', sky: '27A8DF', gold: 'B8860B', sage: '2E8B57', rust: 'A0522D', grey: '6B7A88', ink: '1C2B36', light: 'EEF3F7' };
const num = v => Number(v || 0);
export const dAr = (d, o = { year: 'numeric', month: 'long', day: 'numeric' }) => d ? new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', o) : '';
export const dShort = d => dAr(d, String(d || '').slice(0, 4) === String(new Date().getFullYear()) ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
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
  const { navy, sky, gold, sage, grey, ink } = COLORS; const W = 13.333, H = 7.5, M = 0.6, NAVY2 = '0D2B45', PANEL = '1C4A6E', LINE = 'DCE3EA', BG = 'F3F5F8';
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, rtlMode: true, align: 'right', fontFace: 'Tajawal', margin: 0 }, o));
  const R = (s, o) => s.addShape(pres.ShapeType.rect, o), RR = (s, o) => s.addShape(pres.ShapeType.roundRect, o);
  const cut = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const foot = `${dept} · ${org}`;
  const chrome = (s, dark) => { if (logo) s.addImage({ data: 'image/png;base64,' + logo, x: W - M - 1.35, y: 0.38, w: 1.35, h: 0.47 }); R(s, { x: 0, y: H - 0.42, w: W, h: 0.42, fill: { color: dark ? NAVY2 : 'FFFFFF' }, line: { color: dark ? NAVY2 : 'FFFFFF', width: 0 } }); T(s, foot, { x: M, y: H - 0.38, w: 5.5, h: 0.3, fontSize: 9.5, color: dark ? '8FA7BC' : grey, align: 'left' }); };
  const pageNo = (s, n) => T(s, String(n), { x: W - M - 0.5, y: H - 0.38, w: 0.5, h: 0.3, fontSize: 9.5, color: grey, align: 'right' });
  const st = briefStats(items); const dl = daysLeft(B.ref_date);
  const issued = dAr(new Date().toISOString().slice(0, 10));
  const kindAr = B_KIND[B.kind] || B_KIND.other;
  let pn = 1;

  // ---------- 1) الغلاف: عنوان يميناً + عدّاد كبير يساراً + مؤشرات + تمهيد
  {
    const s = pres.addSlide(); s.background = { color: navy }; chrome(s, true);
    // زخرفة: دائرتان شفافتان
    s.addShape(pres.ShapeType.ellipse, { x: -1.6, y: 4.2, w: 5.2, h: 5.2, fill: { color: sky, transparency: 88 }, line: { color: sky, transparency: 100, width: 0 } });
    s.addShape(pres.ShapeType.ellipse, { x: 9.8, y: -2.2, w: 5.2, h: 5.2, fill: { color: 'FFFFFF', transparency: 94 }, line: { color: 'FFFFFF', transparency: 100, width: 0 } });
    T(s, kindAr, { x: W - M - 7.9, y: 1.05, w: 7.9, h: 0.3, fontSize: 11, bold: true, color: '7FD0F2', charSpacing: 3 });
    T(s, B.title, { x: W - M - 7.9, y: 1.4, w: 7.9, h: 1.5, fontSize: B.title.length > 50 ? 26 : 32, bold: true, color: 'FFFFFF', valign: 'top', lineSpacingMultiple: 1.1 });
    R(s, { x: W - M - 1.1, y: 2.95, w: 1.1, h: 0.07, fill: { color: gold }, line: { color: gold, width: 0 } });
    if (B.subtitle) T(s, B.subtitle, { x: W - M - 7.9, y: 3.15, w: 7.9, h: 0.7, fontSize: 14.5, color: 'B9CBD9', valign: 'top', lineSpacingMultiple: 1.2 });
    // لوحة العدّاد يساراً
    const px = M, py = 1.05, pw = 3.9, ph = 3.0;
    RR(s, { x: px, y: py, w: pw, h: ph, fill: { color: PANEL }, line: { color: '2A5C85', width: 0.75 }, rectRadius: 0.14 });
    if (dl != null) {
      T(s, String(Math.max(0, Math.abs(dl))), { x: px, y: py + 0.25, w: pw, h: 1.5, fontSize: 84, bold: true, color: dl < 0 ? 'F28B82' : 'F2C94C', align: 'center', valign: 'middle' });
      T(s, dl < 0 ? `يوماً مضت على ${B.ref_label || 'الموعد'}` : dl === 0 ? `اليوم هو ${B.ref_label || 'الموعد'}` : `يوماً متبقية حتى ${B.ref_label || 'الموعد'}`, { x: px + 0.2, y: py + 1.8, w: pw - 0.4, h: 0.4, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center' });
      T(s, dAr(B.ref_date), { x: px + 0.2, y: py + 2.25, w: pw - 0.4, h: 0.35, fontSize: 12.5, color: 'B9CBD9', align: 'center' });
    } else {
      T(s, String(st.n), { x: px, y: py + 0.25, w: pw, h: 1.5, fontSize: 84, bold: true, color: 'F2C94C', align: 'center', valign: 'middle' });
      T(s, 'بنداً في هذا العرض', { x: px + 0.2, y: py + 1.8, w: pw - 0.4, h: 0.4, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center' });
    }
    // المؤشرات الأربعة
    const stats = [[String(st.n), 'بنداً في العرض', 'FFFFFF'], [String(st.exec + st.done), 'قيد التنفيذ أو منجزة', '8FE0B0'], [String(st.early), 'دراسة / طرح / حصر', 'F2C94C'], [st.avg + '٪', 'متوسط التقدم', '7FD0F2']];
    const bw = (W - 2 * M - 3 * 0.2) / 4;
    stats.forEach(([n, l, c], i) => { const x = W - M - (i + 1) * bw - i * 0.2; RR(s, { x, y: 4.3, w: bw, h: 0.95, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: 'FFFFFF', transparency: 80, width: 0.5 }, rectRadius: 0.1 }); T(s, n, { x: x + 0.15, y: 4.33, w: 1.1, h: 0.9, fontSize: 30, bold: true, color: c, align: 'center', valign: 'middle' }); T(s, l, { x: x + 1.3, y: 4.35, w: bw - 1.45, h: 0.85, fontSize: 12, color: 'DDE7EF', valign: 'middle' }); });
    if (B.intro) { RR(s, { x: M, y: 5.5, w: W - 2 * M, h: 1.25, fill: { color: NAVY2 }, line: { color: '2A5C85', width: 0.5 }, rectRadius: 0.1 }); T(s, cut(B.intro, 420), { x: M + 0.25, y: 5.58, w: W - 2 * M - 0.5, h: 1.1, fontSize: 12, color: 'E6EEF5', valign: 'middle', lineSpacingMultiple: 1.2 }); }
    const meta = [`تاريخ الإصدار: ${issued}`]; if (B.by) meta.push(`إعداد: ${B.by}`); meta.push('الأرقام حيّة من منصة إدارة المشاريع');
    T(s, meta.join('   ·   '), { x: W - M - 6.4, y: H - 0.38, w: 6.4, h: 0.3, fontSize: 9.5, color: '8FA7BC', align: 'right' });
    s.addNotes(`${kindAr}: ${B.title}`);
  }
  // ---------- 2) بطاقات البنود (12 لكل شريحة، عمودان من اليمين، شريط لون للحالة)
  const PER = 12, pages = Math.max(1, Math.ceil(items.length / PER));
  for (let pg = 0; pg < pages; pg++) {
    const s = pres.addSlide(); s.background = { color: BG }; chrome(s, false); pageNo(s, ++pn);
    T(s, pages > 1 ? `البنود ووضعها الراهن (${pg + 1} من ${pages})` : 'البنود ووضعها الراهن', { x: M, y: 0.4, w: 9, h: 0.5, fontSize: 22, bold: true, color: navy });
    T(s, `الوضع الراهن من منصة إدارة المشاريع بتاريخ ${issued}`, { x: M, y: 0.9, w: 9, h: 0.28, fontSize: 11, color: grey });
    const gap = 0.3, colW = (W - 2 * M - gap) / 2, rows = 6, y0 = 1.35, pitch = (H - 0.55 - y0) / rows, cardH = pitch - 0.1;
    items.slice(pg * PER, pg * PER + PER).forEach((it, k) => {
      const i = pg * PER + k, col = k < rows ? 0 : 1, row = k % rows, x = col === 0 ? W - M - colW : M, y = y0 + row * pitch, S = itemState(it);
      RR(s, { x, y, w: colW, h: cardH, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 0.75 }, rectRadius: 0.07, shadow: { type: 'outer', color: '123B5C', blur: 4, offset: 1, angle: 90, opacity: 0.08 } });
      R(s, { x: x + colW - 0.09, y: y + 0.12, w: 0.07, h: cardH - 0.24, fill: { color: S.hex }, line: { color: S.hex, width: 0 } });
      s.addShape(pres.ShapeType.ellipse, { x: x + colW - 0.58, y: y + 0.16, w: 0.36, h: 0.36, fill: { color: navy }, line: { color: navy, width: 0 } });
      T(s, String(i + 1), { x: x + colW - 0.58, y: y + 0.16, w: 0.36, h: 0.36, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      const tx = x + 1.65, tw = colW - 0.7 - 1.65;
      T(s, cut(it.title, 90), { x: tx, y: y + 0.1, w: tw, h: 0.46, fontSize: 11.5, bold: true, color: ink, valign: 'top', lineSpacingMultiple: 1.05 });
      if (S.line) T(s, cut(S.line, 66), { x: tx, y: y + 0.52, w: tw, h: 0.2, fontSize: 8.5, color: grey, valign: 'top' });
      RR(s, { x: x + 0.16, y: y + 0.14, w: 1.3, h: 0.3, fill: { color: S.hex }, line: { color: S.hex, width: 0 }, rectRadius: 0.15 });
      T(s, S.chip, { x: x + 0.16, y: y + 0.14, w: 1.3, h: 0.3, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      if (it.target_date) T(s, 'المستهدف ' + dShort(it.target_date), { x: x + 0.1, y: y + 0.5, w: 1.42, h: 0.22, fontSize: 8, color: grey, align: 'center' });
      if (S.pct != null) { const bx = x + 0.16, bwid = colW - 0.16 - 0.7; R(s, { x: bx, y: y + cardH - 0.11, w: bwid, h: 0.05, fill: { color: 'E3E8EE' }, line: { color: 'E3E8EE', width: 0 } }); if (S.pct > 0) R(s, { x: bx + bwid - bwid * S.pct / 100, y: y + cardH - 0.11, w: bwid * S.pct / 100, h: 0.05, fill: { color: S.hex }, line: { color: S.hex, width: 0 } }); }
    });
  }
  // ---------- 3) جدول التفاصيل (10 صفوف لكل شريحة)
  const hdr = t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: navy }, align: 'center', valign: 'middle', fontSize: 11, rtlMode: true, fontFace: 'Tajawal' } });
  const cell = (t, o = {}) => ({ text: t || '', options: Object.assign({ fontSize: 10, color: ink, valign: 'middle', align: 'right', rtlMode: true, fontFace: 'Tajawal' }, o) });
  const RPP = 12, tpages = Math.max(1, Math.ceil(items.length / RPP));
  const anyDetail = items.some(it => it.expected || it.show_text || it.notes);
  for (let pg = 0; pg < tpages; pg++) {
    const s = pres.addSlide(); s.background = { color: 'FFFFFF' }; chrome(s, false); pageNo(s, ++pn);
    T(s, (B.kind === 'targets' ? 'الإنجاز المتوقع' + (B.ref_date ? ` بحلول ${B.ref_label || 'الموعد'}` : '') : 'تفاصيل البنود') + (tpages > 1 ? ` (${pg + 1} من ${tpages})` : ''), { x: M, y: 0.4, w: 9.5, h: 0.5, fontSize: 22, bold: true, color: navy });
    T(s, anyDetail ? 'لكل بند: الوضع الراهن، والإنجاز المتوقع، وما سيُعرض ميدانياً، وملاحظات القسم' : 'يُعبّأ بواسطة رئيس القسم ويُحدَّث حتى الموعد', { x: M, y: 0.9, w: 9.5, h: 0.28, fontSize: 11, color: grey });
    const rows = [[hdr('ملاحظات'), hdr('ما سيُعرض ميدانياً'), hdr('الإنجاز المتوقع'), hdr('الوضع الراهن'), hdr('البند'), hdr('م')]];
    const slice = items.slice(pg * RPP, pg * RPP + RPP);
    slice.forEach((it, k) => { const S = itemState(it); const i = pg * RPP + k; const zebra = k % 2 ? 'F6F8FB' : 'FFFFFF';
      rows.push([cell(cut(it.notes, 90), { fill: { color: zebra }, fontSize: 9 }), cell(cut(it.show_text, 90), { fill: { color: zebra }, fontSize: 9.5 }), cell(it.expected, { align: 'center', bold: true, color: navy, fill: { color: zebra } }),
        { text: [{ text: S.chip, options: { bold: true, color: S.hex, fontSize: 9.5, breakLine: !!S.line } }, ...(S.line ? [{ text: cut(S.line, 34), options: { color: grey, fontSize: 7.5 } }] : [])], options: { align: 'center', valign: 'middle', rtlMode: true, fontFace: 'Tajawal', fill: { color: zebra } } },
        cell(cut(it.title, 80), { bold: true, fontSize: 9.5, fill: { color: zebra } }), cell(String(i + 1), { align: 'center', bold: true, color: navy, fill: { color: zebra } })]); });
    s.addTable(rows, { x: M, y: 1.3, w: W - 2 * M, colW: [2.1, 2.5, 1.8, 2.1, 3.23, 0.4], rowH: [0.38, ...slice.map(() => 0.44)], border: { type: 'solid', color: LINE, pt: 0.75 }, margin: [0.03, 0.08, 0.03, 0.08], autoPage: false });
  }
  // ---------- 4) الخاتمة / القرارات المطلوبة
  if (B.closing) {
    const s = pres.addSlide(); s.background = { color: navy }; chrome(s, true);
    s.addShape(pres.ShapeType.ellipse, { x: -1.6, y: 4.2, w: 5.2, h: 5.2, fill: { color: sky, transparency: 88 }, line: { color: sky, transparency: 100, width: 0 } });
    T(s, B.kind === 'proposal' ? 'التوصية والقرار المطلوب' : 'الخلاصة والقرارات المطلوبة', { x: M, y: 1.0, w: W - 2 * M - 1.5, h: 0.7, fontSize: 28, bold: true, color: 'FFFFFF' });
    R(s, { x: W - M - 1.1, y: 1.8, w: 1.1, h: 0.07, fill: { color: gold }, line: { color: gold, width: 0 } });
    const lines = B.closing.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) s.addText(lines.map((l, i) => ({ text: l, options: { bullet: { code: '25A0' }, breakLine: i < lines.length - 1, paraSpaceAfter: 8 } })), { x: M, y: 2.15, w: W - 2 * M, h: 4.2, fontSize: 15, color: 'E6EEF5', valign: 'top', rtlMode: true, align: 'right', fontFace: 'Tajawal', isTextBox: true, margin: 0, lineSpacingMultiple: 1.25 });
    else T(s, B.closing, { x: M, y: 2.15, w: W - 2 * M, h: 4.2, fontSize: 15, color: 'E6EEF5', valign: 'top', lineSpacingMultiple: 1.35 });
    T(s, `${issued}${B.by ? ' · إعداد ' + B.by : ''}`, { x: M, y: H - 0.38, w: 6, h: 0.3, fontSize: 9.5, color: '8FA7BC', align: 'right' });
  }
  return await pres.write({ outputType: 'blob' });
}
