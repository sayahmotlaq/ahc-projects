// ===== جداول الكميات (مرتبطة بقاعدة البيانات) =====
import { sb, REF, canEdit, q, session, itemDetail } from './api.js';
import { $, $$, esc, norm, fmt, money, toast, err, confirm, modal, field, inp, sel, formData, debounce } from './ui.js';
import { exportExcel } from './excel.js';

const STATUS = { draft: 'مسودة', approved: 'معتمد', tender: 'طرح', awarded: 'ترسية', final: 'ختامي' };
let LOGO_B64 = null;
async function logo() { if (LOGO_B64) return LOGO_B64; const b = await (await fetch('assets/logo.png')).blob(); LOGO_B64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); }); return LOGO_B64; }

export function calc(boq, lines) {
  const groups = {}; let subtotal = 0;
  lines.forEach(ln => {
    const v = REF.byVar[ln.variant_code]; if (!v) return;
    const price = Math.round(Number(ln.unit_price ?? v.price) * Number(boq.factor || 1) * 100) / 100;
    const total = Math.round(price * Number(ln.qty || 0) * 100) / 100;
    const d = v.item.div; (groups[d.code] = groups[d.code] || { div: d, lines: [], total: 0 });
    groups[d.code].lines.push({ ln, r: { v, it: v.item, div: d, sec: v.item.sec }, price, total }); groups[d.code].total += total; subtotal += total;
  });
  const ordered = Object.values(groups).sort((a, b) => a.div.code.localeCompare(b.div.code));
  ordered.forEach(g => g.lines.sort((a, b) => a.ln.variant_code.localeCompare(b.ln.variant_code)));
  const cont = subtotal * Number(boq.contingency || 0) / 100, base = subtotal + cont, vat = base * Number(boq.vat || 0) / 100;
  return { groups: ordered, subtotal, cont, base, vat, grand: base + vat };
}

export async function mountBoq(root, boqId, project, onBack) {
  const edit = canEdit();
  let boq = await q(sb.from('boqs').select('*').eq('id', boqId).single());
  let lines = await q(sb.from('boq_lines').select('*').eq('boq_id', boqId).order('id'));
  let picked = null;
  root.innerHTML = `
    <div class="toolbar">
      <button class="btn" id="bBack">‹ المشروع</button>
      <div class="titleblock"><b>${esc(project.name)}</b><span class="muted">جدول الكميات: ${esc(boq.name)} · <span class="badge skel">${STATUS[boq.status] || boq.status}</span></span></div>
      <span style="flex:1"></span>
      <button class="btn primary" id="bExcel">⬇ تصدير Excel</button>
      ${edit ? `<button class="btn" id="bSettings">إعدادات الجدول</button><button class="btn" id="bRefresh" title="تحديث أسعار البنود من المرجع الحالي">تحديث الأسعار</button>` : ''}
      <button class="btn" onclick="window.print()">طباعة</button>
    </div>
    ${edit ? `<div class="pcard noprint"><h2><span class="ic"></span>إضافة بند من المرجع</h2>
      <div class="qsearch"><input id="qk" type="text" placeholder="بحث سريع: اسم البند أو الخيار أو الكود (مثال: سبليت 2 طن، HEPA، 26 51)…" autocomplete="off"><div class="drop" id="qkDrop"></div></div>
      <div class="cascade">
        <select id="cDiv"><option value="">— الشعبة —</option>${REF.divisions.map(d => `<option value="${d.code}">${d.code} — ${esc(d.ar)}</option>`).join('')}</select>
        <select id="cSec" disabled><option value="">— القسم —</option></select>
        <select id="cItem" disabled><option value="">— البند —</option></select>
        <select id="cVar" disabled><option value="">— الخيار —</option></select>
      </div>
      <div class="pick" id="pick" style="display:none"><div class="info" id="pickInfo"></div>
        <label class="fld"><span>الكمية *</span><input type="number" id="pQty" min="0" step="any" placeholder="0"></label>
        <label class="fld"><span>الموقع / ملاحظة</span><input type="text" id="pLoc" placeholder="مثال: عيادة 3 — الدور الأول"></label>
        <button class="btn primary" id="pAdd">إضافة</button></div></div>` : ''}
    <div class="pcard"><h2><span class="ic"></span>البنود <span class="muted" id="lineCount"></span></h2><div class="tblwrap-bq" id="bqTable"></div><div class="totals" id="bqTotals"></div></div>`;
  $('#bBack').onclick = onBack;
  $('#bExcel').onclick = async () => {
    const c = calc(boq, lines);
    // تفاصيل البنود المستخدمة لصفحة المواصفات
    const codes = [...new Set(c.groups.flatMap(g => g.lines.map(L => L.r.it.code)))];
    const { data } = await sb.from('items').select('*').in('code', codes);
    (data || []).forEach(d => { const it = REF.byItem[d.code]; if (it) Object.assign(it, { scope: d.scope, specs: d.specs, health: d.health, accept: d.accept, method: d.method, refs: d.refs, status: d.status }); });
    const eng = project.engineer_name || '';
    const prj = { name: project.name, ref: project.ref, facility: project.facility, type: project.type, dept: project.dept, engineer: eng, date: boq.created_at?.slice(0, 10), contingency: boq.contingency, vat: boq.vat, factor: boq.factor };
    exportExcel(prj, c, await logo());
  };
  if (edit) {
    $('#bSettings').onclick = () => settings();
    $('#bRefresh').onclick = async () => { if (!await confirm('تحديث أسعار جميع البنود من المرجع الحالي؟ ستُستبدل الأسعار المحفوظة في هذا الجدول.')) return; try { for (const ln of lines) { const v = REF.byVar[ln.variant_code]; if (v && Number(v.price) !== Number(ln.unit_price)) { await q(sb.from('boq_lines').update({ unit_price: v.price }).eq('id', ln.id)); ln.unit_price = v.price; } } renderTable(); toast('تم تحديث الأسعار'); } catch (e) { err(e); } };
    cascade(); quick();
  }
  renderTable();

  function settings() {
    modal(`<form id="f" class="pgrid">${field('اسم الجدول', inp('name', boq.name))}${field('الحالة', sel('status', Object.entries(STATUS), boq.status))}${field('نسبة الاحتياطي %', inp('contingency', boq.contingency, 'type="number" min="0" max="30" step="0.5"'))}${field('ضريبة القيمة المضافة %', inp('vat', boq.vat, 'type="number" min="0" max="20" step="1"'))}${field('مُعامل تعديل الأسعار', inp('factor', boq.factor, 'type="number" min="0.5" max="2" step="0.01"'))}${field('ملاحظات', `<textarea name="notes" rows="2">${esc(boq.notes || '')}</textarea>`, 'wide')}<div class="btnrow end wide"><button type="button" class="btn danger" data-del>حذف الجدول</button><span style="flex:1"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: 'إعدادات جدول الكميات', onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const row = { name: f.name, status: f.status, contingency: Number(f.contingency), vat: Number(f.vat), factor: Number(f.factor), notes: f.notes }; try { await q(sb.from('boqs').update(row).eq('id', boq.id)); Object.assign(boq, row); close(); $('.titleblock .muted').innerHTML = `جدول الكميات: ${esc(boq.name)} · <span class="badge skel">${STATUS[boq.status]}</span>`; renderTable(); } catch (er) { err(er); } };
      $('[data-del]', w).onclick = async () => { if (!await confirm('حذف جدول الكميات وكل بنوده نهائياً؟', 'حذف', true)) return; try { await q(sb.from('boqs').delete().eq('id', boq.id)); close(); onBack(); } catch (er) { err(er); } };
    } });
  }
  function cascade() {
    const cDiv = $('#cDiv'), cSec = $('#cSec'), cItem = $('#cItem'), cVar = $('#cVar');
    const reset = (s, ph) => { s.innerHTML = `<option value="">${ph}</option>`; s.disabled = true; };
    cDiv.onchange = () => { reset(cSec, '— القسم —'); reset(cItem, '— البند —'); reset(cVar, '— الخيار —'); hidePick(); const d = REF.byDiv[cDiv.value]; if (!d) return; d.sections.forEach(s => cSec.insertAdjacentHTML('beforeend', `<option value="${s.code}">${s.code} — ${esc(s.ar)}</option>`)); cSec.disabled = false; };
    cSec.onchange = () => { reset(cItem, '— البند —'); reset(cVar, '— الخيار —'); hidePick(); const s = REF.bySec[cSec.value]; if (!s) return; s.items.filter(i => i.active !== false).forEach(it => cItem.insertAdjacentHTML('beforeend', `<option value="${it.code}">${it.code} — ${esc(it.ar)}</option>`)); cItem.disabled = false; };
    cItem.onchange = () => { reset(cVar, '— الخيار —'); hidePick(); const it = REF.byItem[cItem.value]; if (!it) return; const vs = it.variants.filter(v => v.active !== false); vs.forEach(v => cVar.insertAdjacentHTML('beforeend', `<option value="${v.code}">${esc(v.ar)} — ${esc(v.unit)} — ${money(v.price)} ر.س</option>`)); cVar.disabled = false; if (vs.length === 1) { cVar.value = vs[0].code; cVar.onchange(); } };
    cVar.onchange = () => showPick(cVar.value);
    $('#pAdd').onclick = addPicked; $('#pQty').addEventListener('keydown', e => { if (e.key === 'Enter') addPicked(); });
  }
  function setCascade(vcode) { const v = REF.byVar[vcode]; if (!v) return; $('#cDiv').value = v.item.div.code; $('#cDiv').onchange(); $('#cSec').value = v.item.sec.code; $('#cSec').onchange(); $('#cItem').value = v.item.code; $('#cItem').onchange(); $('#cVar').value = vcode; showPick(vcode); }
  function showPick(vcode) {
    const v = REF.byVar[vcode]; if (!v) return hidePick(); picked = vcode;
    const price = Math.round(Number(v.price) * Number(boq.factor || 1) * 100) / 100;
    $('#pickInfo').innerHTML = `<b><span class="cd">${esc(v.code)}</span> ${esc(v.ar)}</b><br>${esc(v.en || '')}${v.spec ? '<br>' + esc(v.spec) : ''}<br>الوحدة: <b>${esc(v.unit)}</b> · سعر الوحدة: <b>${price ? fmt(price) : '—'} ر.س</b> · <a href="#/ref/${v.item.code.replace(/\s+/g, '-')}" target="_blank">فتح البند في المرجع</a>`;
    $('#pick').style.display = ''; $('#pQty').value = ''; $('#pQty').focus();
  }
  function hidePick() { picked = null; $('#pick').style.display = 'none'; }
  async function addPicked() {
    if (!picked) return; const qty = Number($('#pQty').value); if (!(qty > 0)) { toast('أدخل الكمية'); $('#pQty').focus(); return; }
    const loc = $('#pLoc').value.trim(); const v = REF.byVar[picked];
    try {
      const ex = lines.find(l => l.variant_code === picked && (l.loc || '') === loc);
      if (ex) { ex.qty = Math.round((Number(ex.qty) + qty) * 1000) / 1000; await q(sb.from('boq_lines').update({ qty: ex.qty }).eq('id', ex.id)); }
      else { const row = await q(sb.from('boq_lines').insert({ boq_id: boq.id, variant_code: picked, qty, loc, unit_price: v.price, sort: lines.length }).select().single()); lines.push(row); }
      renderTable(); toast('أُضيف البند'); $('#pQty').value = ''; $('#pLoc').value = '';
    } catch (e) { err(e); }
  }
  function quick() {
    const inp = $('#qk'), drop = $('#qkDrop');
    inp.oninput = debounce(() => {
      const raw = inp.value.trim(); if (raw.length < 2) { drop.classList.remove('show'); return; }
      const terms = norm(raw).split(' ').filter(Boolean); const res = [];
      for (const v of REF.variants) { if (v.active === false || !v.item) continue; const it = v.item; const hay = norm(it.ar + ' ' + (it.en || '') + ' ' + it.code + ' ' + v.ar + ' ' + (v.en || '') + ' ' + (v.spec || '') + ' ' + (it.keywords || []).join(' '));
        if (terms.every(t => hay.includes(t))) { let sc = 0; terms.forEach(t => { if (norm(v.ar).includes(t)) sc += 3; if (norm(it.ar).includes(t)) sc += 2; if (norm(it.code).includes(t)) sc += 4; }); res.push({ v, sc }); if (res.length > 400) break; } }
      res.sort((a, b) => b.sc - a.sc);
      drop.innerHTML = res.slice(0, 40).map(({ v }) => `<div data-v="${esc(v.code)}"><span class="cd">${esc(v.code)}</span>${esc(v.item.ar)} ← <b>${esc(v.ar)}</b> <span class="en">${esc(v.unit)} · ${money(v.price)}</span></div>`).join('') || '<div>لا نتائج</div>';
      drop.classList.add('show');
      $$('[data-v]', drop).forEach(el => el.onclick = () => { setCascade(el.getAttribute('data-v')); drop.classList.remove('show'); inp.value = ''; });
    }, 200);
    inp.onblur = () => setTimeout(() => drop.classList.remove('show'), 180);
  }
  function renderTable() {
    const c = calc(boq, lines); const wrap = $('#bqTable');
    $('#lineCount').textContent = lines.length ? `(${lines.length} بند)` : '';
    if (!lines.length) { wrap.innerHTML = '<div class="empty-boq">لا توجد بنود بعد' + (edit ? ' — اختر بنداً من المرجع أعلاه وأدخل كميته' : '') + '</div>'; $('#bqTotals').innerHTML = ''; return; }
    let h = `<table class="bq"><thead><tr><th class="c">م</th><th class="c">الكود</th><th>البند</th><th>المواصفة</th><th class="c">الوحدة</th><th class="c">الكمية</th><th class="c">سعر الوحدة</th><th class="c">الإجمالي</th><th>الموقع</th>${edit ? '<th class="c noprint"></th>' : ''}</tr></thead><tbody>`;
    let n = 0;
    c.groups.forEach(g => {
      h += `<tr class="divrow"><td colspan="10">الشعبة ${g.div.code} — ${esc(g.div.ar)}</td></tr>`;
      g.lines.forEach(L => { n++; h += `<tr><td class="c">${n}</td><td class="c"><span class="cd">${esc(L.r.v.code)}</span></td><td><div class="desc-ar">${esc(L.r.it.ar)} — ${esc(L.r.v.ar)}</div><div class="desc-en">${esc(L.r.v.en || '')}</div></td><td class="spec">${esc(L.r.v.spec || '')}</td><td class="c">${esc(L.r.v.unit)}</td><td class="c">${edit ? `<input class="qty" type="number" min="0" step="any" value="${L.ln.qty}" data-i="${L.ln.id}">` : L.ln.qty}</td><td class="n">${L.price ? fmt(L.price) : '—'}</td><td class="n">${fmt(L.total)}</td><td>${edit ? `<input class="loc" value="${esc(L.ln.loc || '')}" data-li="${L.ln.id}" placeholder="—">` : esc(L.ln.loc || '')}</td>${edit ? `<td class="c noprint"><span class="del" data-del="${L.ln.id}" title="حذف">✕</span></td>` : ''}</tr>`; });
      h += `<tr class="subrow"><td colspan="7">مجموع الشعبة ${g.div.code}</td><td class="n">${fmt(g.total)}</td><td colspan="2"></td></tr>`;
    });
    wrap.innerHTML = h + '</tbody></table>';
    if (edit) {
      $$('input.qty', wrap).forEach(el => el.onchange = async () => { const id = +el.getAttribute('data-i'); const ln = lines.find(l => l.id === id); ln.qty = Math.max(0, Number(el.value) || 0); try { await q(sb.from('boq_lines').update({ qty: ln.qty }).eq('id', id)); renderTable(); } catch (e) { err(e); } });
      $$('input.loc', wrap).forEach(el => el.onchange = async () => { const id = +el.getAttribute('data-li'); const ln = lines.find(l => l.id === id); ln.loc = el.value.trim(); try { await q(sb.from('boq_lines').update({ loc: ln.loc }).eq('id', id)); } catch (e) { err(e); } });
      $$('[data-del]', wrap).forEach(el => el.onclick = async () => { const id = +el.getAttribute('data-del'); try { await q(sb.from('boq_lines').delete().eq('id', id)); lines = lines.filter(l => l.id !== id); renderTable(); } catch (e) { err(e); } });
    }
    $('#bqTotals').innerHTML = `<div class="tot"><span>المجموع قبل الاحتياطي</span><b>${fmt(c.subtotal)}</b></div><div class="tot"><span>الاحتياطي (${boq.contingency || 0}%)</span><b>${fmt(c.cont)}</b></div><div class="tot"><span>المجموع الخاضع للضريبة</span><b>${fmt(c.base)}</b></div><div class="tot"><span>ضريبة القيمة المضافة (${boq.vat || 0}%)</span><b>${fmt(c.vat)}</b></div><div class="tot grand"><span>الإجمالي التقديري (ر.س)</span><b>${fmt(c.grand)}</b></div>`;
  }
}
export { STATUS as BOQ_STATUS };
