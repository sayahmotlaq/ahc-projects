// ===== الإدارة ← الترجمة الإنجليزية: النصوص غير المترجمة لكل مصدر وإدخال ترجمتها =====
import { sb, q } from './api.js';
import { $, $$, esc, toast, err } from './ui.js';
import { loadEN, keyOf, normText, saveEN } from './i18n.js';

const hasAr = s => /[؀-ۿ]/.test(String(s || ''));
async function textsOf(src, boqId) {
  if (src === 'ls') { const r = await q(sb.from('ls_items').select('code,title,descr').eq('active', true).order('sort')); return r.flatMap(i => [[i.code, i.title], [i.code, i.descr]]); }
  if (src === 'ho') { const r = await q(sb.from('handover_reqs').select('code,grp,title,descr,deliver,stage').eq('active', true).order('sort')); return [...new Set(r.flatMap(h => [h.grp, h.stage]))].map(x => ['—', x]).concat(r.flatMap(h => [[h.code, h.title], [h.code, h.descr], [h.code, h.deliver]])); }
  if (src === 'guide') {
    const r = await q(sb.from('guide_cards').select('*').eq('active', true).order('sort')); const { data } = await sb.from('settings').select('value').eq('key', 'guide_meta').maybeSingle(); const m = data?.value || {};
    return r.flatMap(c => [c.title, c.approved, c.why, c.risk, ...(c.submit || []), ...(c.rows || []).flat()].map(x => [c.code_label, x])).concat((m.sections || []).flatMap(s => [['قسم', s.name], ['قسم', s.intro]]), (m.sources || []).map(s => ['مرجع', s[0]]), (m.standards || []).map(s => ['معيار', s]));
  }
  if (src === 'notes') { const { data } = await sb.from('settings').select('value').eq('key', 'boq_default_notes').maybeSingle(); return String(data?.value?.text || '').split('\n').filter(x => x.trim()).map(x => ['ملاحظة', x]); }
  if (src === 'boq' && boqId) {
    const b = await q(sb.from('boqs').select('name,notes,project_id').eq('id', boqId).single()); const p = await q(sb.from('projects').select('name,facility,type,dept,engineer_name,contractor').eq('id', b.project_id).single());
    const ls = await q(sb.from('boq_lines').select('ls_code,title,descr,loc,kind').eq('boq_id', boqId).order('id'));
    return [['المشروع', p.name], ['المنشأة', p.facility], ['النوع', p.type], ['الجهة', p.dept], ['المهندس', p.engineer_name], ['المقاول', p.contractor], ['الجدول', b.name], ...String(b.notes || '').split('\n').filter(x => x.trim()).map(x => ['ملاحظة', x]), ...ls.filter(l => l.kind === 'free').flatMap(l => [[l.ls_code || 'بند', l.title], [l.ls_code || 'بند', l.descr], [(l.ls_code || 'بند') + ' ملاحظة', l.loc]])];
  }
  return [];
}

export async function mountI18nAdmin(root) {
  const boqs = await q(sb.from('boqs').select('id,name,project_id').order('created_at', { ascending: false }).limit(300)).catch(() => []);
  const pn = Object.fromEntries((await q(sb.from('projects').select('id,name')).catch(() => [])).map(p => [p.id, p.name])); boqs.forEach(b => b.projects = { name: pn[b.project_id] || '' });
  let src = 'ls', boqId = '', onlyMissing = true, rows = [];
  const load = async () => {
    root.querySelector('#trList').innerHTML = '<p class="muted">…</p>';
    const db = await loadEN(true); const seen = new Set(); rows = [];
    for (const [tag, s] of await textsOf(src, boqId)) { const n = normText(s); if (!n || !hasAr(n) || seen.has(n)) continue; seen.add(n); const k = await keyOf(n); rows.push({ tag, src: n, k, en: db.get(k) || '' }); }
    draw();
  };
  const draw = () => {
    const miss = rows.filter(r => !r.en).length, list = rows.filter(r => !onlyMissing || !r.en);
    root.querySelector('#trStat').innerHTML = `${rows.length} نصاً — <b>${rows.length - miss}</b> مترجم، <b style="color:var(--bad,#b23a3a)">${miss}</b> بلا ترجمة`;
    root.querySelector('#trList').innerHTML = list.length ? list.map((r, i) => `<div class="trrow" data-k="${r.k}"><div class="trar"><span class="badge skel">${esc(r.tag || '')}</span> ${esc(r.src)}</div><textarea dir="ltr" rows="${Math.min(10, Math.max(2, Math.ceil(r.src.length / 90)))}" placeholder="English translation…">${esc(r.en)}</textarea><button class="btn sm primary" data-save>حفظ</button></div>`).join('') : '<p class="muted">لا نصوص ناقصة في هذا المصدر.</p>';
    $$('[data-save]', root).forEach(b => b.onclick = async () => { const row = b.closest('.trrow'); const r = rows.find(x => x.k === row.dataset.k); const v = row.querySelector('textarea').value.trim(); if (!v) return toast('اكتب الترجمة أولاً'); try { await saveEN(r.src, v); r.en = v; toast('حُفظت الترجمة'); if (onlyMissing) draw(); } catch (e) { err(e); } });
  };
  root.innerHTML = `<div class="pcard"><h2 class="m0">الترجمة الإنجليزية للمخرجات</h2>
    <p class="muted small">تُستخدم عند اختيار «English» في تصدير جدول الكميات واشتراطات التسليم ودليل المواصفات. كل نص عربي يُترجم مرة واحدة، وإذا عُدّل النص العربي لاحقاً يعود هنا بلا ترجمة حتى لا تبقى ترجمة قديمة. ما لم يُترجم يظهر في الملف بالعربية.</p>
    <div class="btnrow"><select id="trSrc"><option value="ls">بنود قائمة المقطوعية</option><option value="ho">اشتراطات التسليم</option><option value="guide">دليل المواصفات المعتمدة</option><option value="notes">الملاحظات العامة الافتراضية</option><option value="boq">جدول كميات مشروع…</option></select>
      <select id="trBoq" style="display:none"><option value="">— اختر الجدول —</option>${boqs.map(b => `<option value="${b.id}">${esc(b.projects?.name || '')} — ${esc(b.name)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="trMiss" checked> الناقص فقط</label><span class="sp"></span><span id="trStat" class="small"></span></div></div>
    <div id="trList" class="trlist"></div>`;
  $('#trSrc', root).onchange = e => { src = e.target.value; $('#trBoq', root).style.display = src === 'boq' ? '' : 'none'; if (src !== 'boq' || boqId) load(); else { rows = []; draw(); } };
  $('#trBoq', root).onchange = e => { boqId = e.target.value; if (boqId) load(); };
  $('#trMiss', root).onchange = e => { onlyMissing = e.target.checked; draw(); };
  await load();
}
