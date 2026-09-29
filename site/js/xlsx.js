// ===== تصدير القوائم إلى Excel (ExcelJS) =====
import { loadExcelJS } from './excel.js';
import { toast, err, download } from './ui.js';
// cols: [{ h: 'العنوان', k: 'key' | (row)=>value, w: 18, t: 'money'|'date'|'text'|'int' }]
export async function exportTable(filename, sheetName, cols, rows, opts = {}) {
  try { await loadExcelJS(); } catch (e) { return err('تعذّر تحميل مكتبة Excel'); }
  const wb = new ExcelJS.Workbook(); wb.creator = 'منصة إدارة مشاريع تجمع الأحساء الصحي';
  const ws = wb.addWorksheet(sheetName.slice(0, 30), { views: [{ rightToLeft: true, state: 'frozen', ySplit: opts.title ? 3 : 1 }] });
  let r = 1;
  if (opts.title) { ws.mergeCells(1, 1, 1, cols.length); const c = ws.getCell(1, 1); c.value = opts.title; c.font = { name: 'Tajawal', size: 14, bold: true, color: { argb: 'FF123B5C' } }; c.alignment = { horizontal: 'right' }; ws.getRow(1).height = 24;
    ws.mergeCells(2, 1, 2, cols.length); const s = ws.getCell(2, 1); s.value = opts.subtitle || ''; s.font = { name: 'Tajawal', size: 10, color: { argb: 'FF66768A' } }; s.alignment = { horizontal: 'right' }; r = 3; }
  const head = ws.getRow(r); cols.forEach((c, i) => { const cell = head.getCell(i + 1); cell.value = c.h; cell.font = { name: 'Tajawal', bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B5C' } }; cell.alignment = { horizontal: c.t === 'money' || c.t === 'int' ? 'center' : 'right', vertical: 'middle' }; cell.border = { bottom: { style: 'thin', color: { argb: 'FFE3E8EE' } } }; });
  head.height = 22;
  rows.forEach((row, ri) => { const xr = ws.getRow(r + 1 + ri); cols.forEach((c, i) => { let v = typeof c.k === 'function' ? c.k(row) : row[c.k]; const cell = xr.getCell(i + 1);
    if (c.t === 'money') { v = v === null || v === undefined || v === '' ? null : Number(v); cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'left' }; }
    else if (c.t === 'int') { v = v === null || v === undefined || v === '' ? null : Number(v); cell.numFmt = '0'; cell.alignment = { horizontal: 'center' }; }
    else if (c.t === 'date') { v = v ? new Date(v) : null; cell.numFmt = 'yyyy-mm-dd'; cell.alignment = { horizontal: 'center' }; }
    else { v = v ?? ''; cell.alignment = { horizontal: 'right', wrapText: true }; }
    cell.value = v; cell.font = { name: 'Tajawal', size: 11 }; if (ri % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; }); });
  cols.forEach((c, i) => ws.getColumn(i + 1).width = c.w || 18);
  ws.autoFilter = { from: { row: r, column: 1 }, to: { row: r + rows.length, column: cols.length } };
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
  toast(`تم تصدير ${rows.length} صفاً`);
}
export const xbtn = (id = 'xl') => `<button class="btn" id="${id}" title="تصدير القائمة الحالية إلى Excel"><svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg> Excel</button>`;
