// استيراد المشاريع والتحديات من data/import_projects.json إلى Supabase (مرة واحدة لكل ملف)
import fs from 'node:fs'; import crypto from 'node:crypto';
const BASE = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const file = new URL('../data/import_projects.json', import.meta.url);
if (!fs.existsSync(file)) { console.log('no import file'); process.exit(0); }
const raw = fs.readFileSync(file, 'utf8'); const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
const api = async (path, opt = {}) => { const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } }); const t = await r.text(); if (!r.ok) { console.error(path, r.status, t); process.exit(1); } return t ? JSON.parse(t) : null; };
const done = await api(`settings?key=eq.imports`); const list = done[0]?.value?.list || [];
if (list.includes(hash)) { console.log('import already applied', hash); process.exit(0); }
const data = JSON.parse(raw);
const existing = await api(`projects?select=id,name`); const byName = new Map(existing.map(p => [p.name, p.id]));
let ins = 0, upd = 0;
for (const p of data.projects) {
  const id = byName.get(p.name);
  if (id) { await api(`projects?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p) }); upd++; }
  else { const r = await api('projects', { method: 'POST', body: JSON.stringify({ ...p, dept: 'إدارة الخدمات الفنية — قسم المشاريع' }) }); byName.set(p.name, r[0].id); await api('project_stage_log', { method: 'POST', body: JSON.stringify({ project_id: r[0].id, from_stage: null, to_stage: p.stage, note: 'استيراد من ملف متابعة المشاريع 17-9-2026' }) }); ins++; }
}
console.log(`projects: inserted ${ins}, updated ${upd}`);
const exCh = await api(`challenges?select=id,project_id,title`);
let cin = 0;
for (const c of data.challenges) {
  const pid = byName.get(c.project); if (!pid) { console.log('no project for challenge', c.project); continue; }
  const { project, ...row } = c;
  if (exCh.find(x => x.project_id === pid && x.title === c.title)) continue;
  await api('challenges', { method: 'POST', body: JSON.stringify({ ...row, project_id: pid }) }); cin++;
}
console.log(`challenges: inserted ${cin}`);
await api(`settings?key=eq.imports`, { method: done.length ? 'PATCH' : 'POST', body: JSON.stringify(done.length ? { value: { list: [...list, hash] } } : { key: 'imports', value: { list: [hash] } }) });
console.log('import done', hash);
