// رفع/تحديث المرجع الفني إلى Supabase (يُشغَّل من GitHub Actions بمفتاح service_role)
// - يُدرج الجديد ويحدّث المتغيّر فقط (لتفادي تضخيم سجل التدقيق).
// - لا يلمس الصفوف التي عدّلها الأدمن يدوياً من المنصة (updated_by IS NOT NULL).
import fs from 'node:fs';
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const ref = JSON.parse(fs.readFileSync(new URL('../data/reference.json', import.meta.url), 'utf8'));
const H = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function upsert(table, rows, chunk = 300) {
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const r = await fetch(`${URL}/rest/v1/${table}?on_conflict=code`, { method: 'POST', headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(part) });
    if (!r.ok) { console.error(table, r.status, await r.text()); process.exit(1); }
    n += part.length;
  }
  console.log(`${table}: upserted ${n}`);
}
async function fetchAll(table, select) {
  const out = []; let from = 0; const step = 1000;
  while (true) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=${select}&order=code`, { headers: { ...H, 'Range': `${from}-${from + step - 1}` } });
    if (!r.ok && r.status !== 206) { console.error(table, r.status, await r.text()); process.exit(1); }
    const rows = await r.json(); out.push(...rows); if (rows.length < step) break; from += step;
  }
  return out;
}
const same = (a, b, keys) => keys.every(k => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
function diff(name, incoming, existing, keys) {
  const by = new Map(existing.map(r => [r.code, r]));
  const out = incoming.filter(r => { const e = by.get(r.code); if (!e) return true; if (e.updated_by) return false; return !same(r, e, keys); });
  console.log(`${name}: ${incoming.length} in file, ${existing.length} in db, ${out.length} to write, ${existing.filter(e => e.updated_by).length} protected`);
  return out;
}
const numFix = r => ({ ...r, price: Number(r.price) });

await upsert('divisions', diff('divisions', ref.divisions, await fetchAll('divisions', 'code,ar,en,sort'), ['ar', 'en', 'sort']));
await upsert('sections', diff('sections', ref.sections, await fetchAll('sections', 'code,division_code,ar,en'), ['division_code', 'ar', 'en']));
const itemKeys = ['section_code', 'ar', 'en', 'unit', 'status', 'scope', 'specs', 'health', 'accept', 'method', 'refs', 'notes', 'keywords', 'price_basis'];
await upsert('items', diff('items', ref.items, await fetchAll('items', 'code,' + itemKeys.join(',') + ',updated_by'), itemKeys));
const varKeys = ['item_code', 'ar', 'en', 'unit', 'price', 'spec'];
const existingVars = (await fetchAll('variants', 'code,' + varKeys.join(',') + ',updated_by')).map(numFix);
await upsert('variants', diff('variants', ref.variants.map(numFix), existingVars, varKeys));

const r = await fetch(`${URL}/rest/v1/settings?key=eq.ref_version`, { method: 'PATCH', headers: { ...H, 'Prefer': 'return=minimal' },
  body: JSON.stringify({ value: { v: ref.version, generated: ref.generated, items: ref.items.length, variants: ref.variants.length }, updated_at: new Date().toISOString() }) });
console.log('ref_version', r.status, 'done');
