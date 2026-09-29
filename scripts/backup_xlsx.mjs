// تصدير جداول المنصة إلى ملف Excel واحد (للنسخة الاحتياطية الأسبوعية)
import pg from 'pg'; import ExcelJS from 'exceljs';
const url = process.env.DB_URL_RESOLVED; if (!url) { console.error('no db url'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } }); await client.connect();
const TABLES = ['projects', 'project_stage_log', 'project_updates', 'challenges', 'tasks', 'requests', 'request_replies', 'payments', 'payment_log', 'submittals', 'submittal_files', 'documents', 'drawings', 'drawing_revisions', 'tech_reports', 'report_photos', 'report_comments', 'boqs', 'boq_lines', 'profiles', 'settings', 'variants', 'items', 'sections', 'divisions'];
const wb = new ExcelJS.Workbook(); wb.creator = 'AHC Projects backup';
let total = 0;
for (const t of TABLES) {
  let rows; try { rows = (await client.query(`select * from public.${t} order by 1`)).rows; } catch (e) { console.log('skip', t, e.message); continue; }
  const ws = wb.addWorksheet(t.slice(0, 31), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  const cols = rows.length ? Object.keys(rows[0]) : ['(empty)'];
  ws.addRow(cols).font = { bold: true };
  rows.forEach(r => ws.addRow(cols.map(c => { const v = r[c]; return v === null ? null : (typeof v === 'object' && !(v instanceof Date)) ? JSON.stringify(v) : v; })));
  cols.forEach((c, i) => ws.getColumn(i + 1).width = Math.min(50, Math.max(12, c.length + 4)));
  total += rows.length; console.log(t, rows.length);
}
await wb.xlsx.writeFile(process.argv[2] || 'backup.xlsx'); await client.end(); console.log('rows total', total);
