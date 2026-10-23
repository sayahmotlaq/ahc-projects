// ===== اشتراطات تسليم المشروع على المقاول (HO-NN): قائمة معتمدة تُرفق بجدول الكميات وتُولَّد منها بنود الإغلاق =====
import { sb, q, isAdmin } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, formData, ico, download } from './ui.js';

const STAGES = ['قبل الاستلام الابتدائي', 'عند الاستلام الابتدائي', 'خلال فترة الضمان', 'قبل الاستلام النهائي'];
export const loadHO = async (all = false) => { let x = sb.from('handover_reqs').select('*').order('sort').order('code'); if (!all) x = x.eq('active', true); return q(x); };

export async function mountHandover(root) {
  const rows = await loadHO(true);
  let fq = '', print = false;
  const grps = () => [...new Set(rows.map(r => r.grp))];
  const render = () => {
    const list = rows.filter(r => (isAdmin() || r.active) && (!fq || (r.code + r.title + r.descr + r.deliver).includes(fq)));
    root.innerHTML = `<div class="fmhead"><div class="fmhead-t"><h1 class="pagetitle">اشتراطات تسليم المشروع</h1><p class="muted m0">ما يلتزم المقاول بتسليمه: المخططات كما نُفِّذ، الضمانات والشهادات، الترميز والتوسيم، التشغيل والصيانة والتدريب. تُرفق تلقائياً بملف Excel لجدول الكميات، وتُولَّد منها بنود «الإغلاق والضمان» في المشروع.</p></div>
      <div class="fmhead-a"><button class="btn" id="hoPrint">${ico('print')} PDF للطباعة</button><button class="btn primary" id="hoXl">${ico('download')} Excel</button>${isAdmin() ? '<button class="btn" id="hoNew">＋ اشتراط</button>' : ''}</div></div>
      ${print ? printView(list) : `<div class="toolbar"><input id="hoQ" class="stq" placeholder="بحث في الاشتراطات…" value="${esc(fq)}"><span class="muted small">${list.filter(r => r.active).length} اشتراطاً فعالاً</span></div>
      ${grps().map(g => { const ls = list.filter(r => r.grp === g); return ls.length ? `<section class="pcard hogrp"><h2>${esc(g)}</h2>${ls.map(r => `<div class="hoq ${r.active ? '' : 'off'}"><div class="hoq-h"><span class="ltr cd">${r.code}</span><b>${esc(r.title)}</b><span class="badge skel">${esc(r.stage || '')}</span><span class="sp"></span>${isAdmin() ? `<button class="btn sm ghost" data-e="${r.code}">تعديل</button>` : ''}</div><p>${esc(r.descr)}</p>${r.deliver ? `<div class="small"><b>المطلوب تسليمه:</b> ${esc(r.deliver)}</div>` : ''}</div>`).join('')}</section>` : ''; }).join('')}`}`;
    $('#hoPrint', root).onclick = () => openHandoverDoc();
    $('#hoXl', root).onclick = () => exportHO(rows.filter(r => r.active));
    $('#hoNew', root) && ($('#hoNew', root).onclick = () => form(null));
    if (print) return;
    $('#hoQ', root).oninput = e => { fq = e.target.value.trim(); const p = e.target.selectionStart; render(); const i = $('#hoQ', root); i.focus(); i.setSelectionRange(p, p); };
    $$('[data-e]', root).forEach(b => b.onclick = () => form(rows.find(r => r.code === b.dataset.e)));
  };
  const printView = list => `<div class="spdoc"><div class="spdoc-h"><img src="assets/logo.png" alt=""><div><b>تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع</b><h2>اشتراطات تسليم المشروع</h2><span>جزء لا يتجزأ من العقد ووثائق الطرح</span></div></div>
    <table class="sptbl"><thead><tr><th>م</th><th>الكود</th><th>الاشتراط</th><th>المطلوب تسليمه</th><th>التوقيت</th></tr></thead><tbody>${grps().map(g => { const ls = list.filter(r => r.grp === g && r.active); return ls.length ? `<tr class="dv"><td colspan="5">${esc(g)}</td></tr>` + ls.map(r => `<tr><td>${rows.filter(x => x.active).indexOf(r) + 1}</td><td class="ltr">${r.code}</td><td><b>${esc(r.title)}</b><div>${esc(r.descr)}</div></td><td>${esc(r.deliver || '')}</td><td>${esc(r.stage || '')}</td></tr>`).join('') : ''; }).join('')}</tbody></table>
    <div class="spnote">يُعدّ استيفاء هذه الاشتراطات شرطاً للاستلام الابتدائي أو النهائي حسب التوقيت المحدد لكل بند، ولا يُصرف المستخلص الختامي ولا يُفرج عن الضمانات قبل استيفائها كاملة.</div></div>`;
  const form = r => {
    const v = r || { code: 'HO-' + String(Math.max(0, ...rows.map(x => +x.code.slice(3) || 0)) + 1).padStart(2, '0'), grp: grps()[0] || '', title: '', descr: '', deliver: '', stage: STAGES[0], sort: Math.max(0, ...rows.map(x => x.sort || 0)) + 10, active: true };
    modal(`<form id="f" class="pgrid">${field('الكود', inp('code', v.code, r ? 'readonly' : 'required'))}${field('المجموعة', `<input name="grp" list="hoG" value="${esc(v.grp)}" required><datalist id="hoG">${grps().map(g => `<option value="${esc(g)}">`).join('')}</datalist>`)}
      ${field('الاشتراط *', inp('title', v.title, 'required'), 'wide')}${field('النص التعاقدي', `<textarea name="descr" rows="5">${esc(v.descr)}</textarea>`, 'wide')}
      ${field('المطلوب تسليمه (الصيغة والنسخ)', inp('deliver', v.deliver || ''), 'wide')}${field('التوقيت', `<input name="stage" list="hoS" value="${esc(v.stage || '')}"><datalist id="hoS">${STAGES.map(s => `<option value="${s}">`).join('')}</datalist>`)}${field('الترتيب', inp('sort', v.sort, 'type="number"'))}
      <label class="chk wide"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> فعّال (يُرفق بالجداول ويُولَّد في الإغلاق)</label>
      <div class="btnrow end wide">${r ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: r ? 'تعديل اشتراط' : 'اشتراط جديد', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const row = { code: x.code.trim(), grp: x.grp.trim(), title: x.title.trim(), descr: x.descr.trim(), deliver: x.deliver.trim(), stage: x.stage.trim(), sort: +x.sort || 0, active: !!x.active, updated_at: new Date().toISOString() };
        try { if (r) { await q(sb.from('handover_reqs').update(row).eq('code', r.code)); Object.assign(r, row); } else { await q(sb.from('handover_reqs').insert(row)); rows.push(row); rows.sort((a, b) => a.sort - b.sort); } close(); render(); toast('تم الحفظ'); } catch (er) { err(er); } };
      const d = $('[data-del]', w); if (d) d.onclick = async () => { if (!(await confirm('حذف الاشتراط؟ (الأفضل إيقافه)', 'حذف', true))) return; try { await q(sb.from('handover_reqs').delete().eq('code', r.code)); rows.splice(rows.indexOf(r), 1); close(); render(); } catch (er) { err(er); } };
    } });
  };
  render();
}

async function exportHO(list) {
  if (!list.length) return toast('لا اشتراطات');
  try {
    const X = await import('./excel.js'); const { logo } = await import('./boq.js'); await X.loadExcelJS();
    const wb = new ExcelJS.Workbook(); wb._ahcLogo = wb.addImage({ base64: await logo(), extension: 'png' });
    X.handoverSheet(wb, { name: 'اشتراطات تسليم المشروع — قالب عام', date: new Date().toISOString().slice(0, 10) }, list);
    download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `اشتراطات تسليم المشروع - ${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) { err(e); }
}

// توليد بنود الإغلاق في المشروع من الاشتراطات (ما لم يكن موجوداً)
export async function closeoutFromHO(projectId, items) {
  const list = await loadHO(); const have = new Set(items.map(i => i.label));
  const rows = list.map(h => `[${h.code}] ${h.title}`).filter(l => !have.has(l)).map((label, k) => ({ project_id: projectId, sort: items.length + k + 1, label, note: '' }));
  if (!rows.length) { toast('كل الاشتراطات موجودة في القائمة'); return 0; }
  await q(sb.from('closeout_items').insert(rows)); toast(`أُضيف ${rows.length} بنداً`); return rows.length;
}

// ===== مستند PDF بهوية التجمع (عام أو باسم المشروع) =====
const STC = { 'قبل الاستلام الابتدائي': '#27A8DF', 'عند الاستلام الابتدائي': '#153E5C', 'خلال فترة الضمان': '#0F7B5F', 'قبل الاستلام النهائي': '#6B5BA8' };
export async function openHandoverDoc({ projectId = null, boqName = '' } = {}) {
  let win; try {
    const { prepDoc } = await import('./pdfdoc.js'); win = prepDoc(); if (!win) return;
    const list = await loadHO(); if (!list.length) { win.close(); return toast('لا اشتراطات فعالة'); }
    const prj = projectId ? await q(sb.from('projects').select('name,facility,contractor').eq('id', projectId).single()) : null;
    const grps = [...new Set(list.map(r => r.grp))]; let k = 0;
    const st = s => `<span class="hst" style="background:${STC[s] || '#5B6B7A'}">${esc(s || '')}</span>`;
    const body = `<div class="intro"><h2>عن هذه الاشتراطات</h2><div class="rib"></div>
      <p>تحدد هذه الوثيقة ما يلتزم المقاول بتسليمه حتى تُستلم المنشأة جاهزة للتشغيل والصيانة: المخططات كما نُفِّذ، والضمانات والشهادات، وترميز الأصول وتوسيمها، وكتيبات التشغيل والتدريب، ومتطلبات فترة الضمان والاستلام النهائي. وهي <b>جزء لا يتجزأ من العقد ووثائق الطرح</b>${boqName ? ` المرفقة بجدول الكميات «${esc(boqName)}»` : ''}.</p>
      <div class="hlg">${Object.keys(STC).map(s => `<div>${st(s)}</div>`).join('')}</div>
      <table class="tbl" style="margin-top:10px"><thead><tr><th style="width:8%">م</th><th>المجموعة</th><th style="width:18%">عدد الاشتراطات</th></tr></thead><tbody>${grps.map((g, i) => `<tr><td class="c">${i + 1}</td><td>${esc(g)}</td><td class="c">${list.filter(r => r.grp === g).length}</td></tr>`).join('')}</tbody></table></div>
      ${grps.map((g, i) => `<div class="sec ${i ? '' : 'brk'}" style="margin-top:14px"><div class="sh"><span class="sn">${i + 1}</span><h2>${esc(g)}</h2></div>
        ${list.filter(r => r.grp === g).map(r => `<div class="hitem"><div class="hh"><span class="ic">${esc(r.code)}</span><b>${esc(r.title)}</b>${st(r.stage)}</div><p>${esc(r.descr)}</p>${r.deliver ? `<div class="hdl"><span>المطلوب تسليمه</span>${esc(r.deliver)}</div>` : ''}<div class="hck">☐ استُلم &nbsp;&nbsp; التاريخ: ............ &nbsp;&nbsp; ملاحظات: ..............................</div></div>`).join('')}</div>`).join('')}
      <div class="note" style="margin-top:14px">يُعدّ استيفاء هذه الاشتراطات شرطاً للاستلام الابتدائي أو النهائي حسب التوقيت المحدد لكل بند، ولا يُصرف المستخلص الختامي ولا يُفرج عن الضمانات قبل استيفائها كاملة.</div>
      <div class="hsig"><h3>إقرار المقاول</h3><p>نقرّ نحن الموقعين أدناه بأننا اطلعنا على اشتراطات تسليم المشروع الواردة في هذه الوثيقة (${list.length} اشتراطاً)، ونلتزم بتنفيذها وتسليمها كاملة في مواعيدها المحددة.</p>
        <div class="hsg"><div><b>المقاول</b><span>الاسم: ${esc(prj?.contractor || '')}</span><span>المفوض بالتوقيع:</span><span>التوقيع:</span><span>الختم:</span><span>التاريخ:</span></div><div><b>عن تجمع الأحساء الصحي — قسم المشاريع</b><span>الاسم:</span><span>الصفة:</span><span>التوقيع:</span><span>التاريخ:</span></div></div></div>`;
    const css = `.hlg{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.hst{color:#fff;border-radius:20px;padding:1px 10px;font-size:8.4pt;font-weight:700;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .hitem{border:1px solid var(--l);border-radius:9px;padding:9px 12px;margin:0 0 9px;break-inside:avoid}.hh{display:flex;gap:8px;align-items:center}.hh b{flex:1;color:var(--n);font-size:11.5pt}.hitem p{margin:5px 0;font-size:9.8pt;line-height:1.7}
      .hdl{background:var(--s2);border-radius:6px;padding:5px 9px;font-size:9.4pt}.hdl span{display:inline-block;font-weight:700;color:var(--n);margin-inline-end:8px}.hck{margin-top:6px;font-size:8.6pt;color:var(--g)}
      .hsig{break-inside:avoid;margin-top:18px;border:2px solid var(--n);border-radius:10px;padding:14px 16px}.hsig h3{font-size:14pt}.hsg{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:10px}.hsg div{display:flex;flex-direction:column;gap:12px}.hsg b{color:var(--n)}.hsg span{border-bottom:1px dotted #9AA6B1;padding-bottom:4px;font-size:10pt}`;
    const { openDoc, coverHtml } = await import('./pdfdoc.js');
    openDoc({ win, title: `اشتراطات تسليم المشروع${prj ? ' — ' + prj.name : ''}`, body, css,
      cover: coverHtml({ kicker: 'وثيقة تعاقدية', tag: 'جزء من وثائق الطرح', title: 'اشتراطات تسليم المشروع', sub: 'ما يلتزم المقاول بتسليمه: المخططات كما نُفِّذ، الضمانات والشهادات، الترميز والتوسيم، التشغيل والصيانة والتدريب، وفترة الضمان.',
        project: prj?.name, facility: prj ? [prj.facility, prj.contractor ? 'المقاول: ' + prj.contractor : ''].filter(Boolean).join(' · ') : '', pills: ['As‑Built', 'O&M', 'Warranties', 'Asset Tagging', 'Training'], edition: `${list.length} اشتراطاً`, date: new Date().toISOString().slice(0, 10) }) });
  } catch (e) { try { win?.close(); } catch (x) { } err(e); }
}
