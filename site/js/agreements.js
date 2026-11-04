// ===== الاتفاقيات: يعبّي الموظف بيانات المتبرع والمشروع، وتُبنى الاتفاقية وملحقها تلقائياً من القالب المعتمد — تصدير PDF وWord بهوية التجمع
import { sb, q, isAdmin, canEdit, session } from './api.js';
import { $, $$, esc, ico, toast, err, confirm, download, dateAr, parseMoney, fmtMoney } from './ui.js';
import { vars, resolve, toHtml, buildDocx, AGR_CSS, AGR_COPY, num, tafqeet } from './agrcore.js';

export const AST = { draft: ['مسودة', 'st-draft'], review: ['قيد المراجعة', 'st-plan'], sent: ['مرسلة للمتبرع', 'st-plan'], signed: ['موقعة', 'st-ok'], archived: ['أرشيف', 'st-draft'] };
const stb = s => { const [t, c] = AST[s] || AST.draft; return `<span class="stb ${c}">${t}</span>`; };
const code = a => `PA-${String(a.no).padStart(3, '0')}`;
let TPL = {};
async function tpl(c) { if (!TPL[c]) TPL[c] = await q(sb.from('agr_templates').select('*').eq('code', c).single()); return TPL[c]; }

export async function mountAgreements(root, id) {
  try { if (id) return await view(root, id); await list(root); } catch (e) { err(e); root.innerHTML = '<p class="muted">تعذر تحميل الاتفاقيات.</p>'; }
}

// ---------- القائمة
async function list(root) {
  const rows = await q(sb.from('agreements').select('id,no,title,donor,amount,status,updated_at,signed_at,data').order('no', { ascending: false }));
  const tot = rows.filter(r => r.status === 'signed').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  root.innerHTML = `<div class="hubh"><div><h1 class="pagetitle">اتفاقيات الشراكة المجتمعية</h1><p class="muted m0">تعبّي بيانات المتبرع والمشروع في خانات، وتُبنى الاتفاقية وملحقها تلقائياً من الصيغة المعتمدة، وتُصدَّر PDF وWord بهوية التجمع.</p></div>
    ${canEdit() ? `<button class="btn primary" id="agNew">＋ اتفاقية جديدة</button>` : ''}</div>
    <div class="agr-kpis"><div><b>${rows.length}</b><span>اتفاقية</span></div><div><b>${rows.filter(r => r.status === 'signed').length}</b><span>موقعة</span></div><div><b>${num(tot)}</b><span>ر.س تبرعات موقعة</span></div><div><b>${rows.filter(r => ['draft', 'review', 'sent'].includes(r.status)).length}</b><span>قيد الإعداد</span></div></div>
    ${rows.length ? `<div class="tblwrap"><table class="vt"><thead><tr><th>الرقم</th><th>المركز</th><th>المتبرع</th><th class="c">المبلغ (ر.س)</th><th class="c">الحالة</th><th class="c">آخر تحديث</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="agr-row" data-id="${r.id}" style="cursor:pointer"><td class="c ltr">${code(r)}</td><td><b>${esc(r.title || '—')}</b><br><small class="muted">${esc(r.data?.loc || '')}</small></td><td>${esc(r.donor || '—')}</td><td class="c price">${r.amount ? num(r.amount) : '—'}</td><td class="c">${stb(r.status)}</td><td class="c">${dateAr(r.updated_at)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="notice">لا توجد اتفاقيات بعد. ابدأ بـ «اتفاقية جديدة».</div>'}`;
  $$('.agr-row', root).forEach(r => r.onclick = () => location.hash = '#/agreements/' + r.dataset.id);
  const nb = $('#agNew', root); if (nb) nb.onclick = async () => {
    try { const t = await tpl('PA-PHC'); const last = await q(sb.from('agreements').select('data').order('no', { ascending: false }).limit(1));
      const p = last[0]?.data || {}; const data = { ...t.defaults, ...Object.fromEntries(['p1_coord', 'p1_email', 'p1_rep', 'p1_rep_title', 'affil'].filter(k => p[k]).map(k => [k, p[k]])), donor_type: 'person', donor_honor: 'الأستاذ', budget: {} };
      const [a] = await q(sb.from('agreements').insert({ tpl: 'PA-PHC', data, log: [{ at: new Date().toISOString(), by: session.profile?.full_name || '', ev: 'إنشاء' }] }).select('id'));
      location.hash = '#/agreements/' + a.id; } catch (e) { err(e); } };
}

// ---------- النموذج
const F = (label, inner, cls = '') => `<label class="fld ${cls}"><span>${label}</span>${inner}</label>`;
const I = (k, v, a = '') => `<input name="${k}" value="${esc(v ?? '')}" ${a}>`;
const N = (k, v, a = '') => `<input name="${k}" class="money" inputmode="decimal" dir="ltr" value="${esc(v === undefined || v === null || v === '' ? '' : fmtMoney(v))}" ${a}>`;
const S = (k, opts, v) => `<select name="${k}">${opts.map(([a, b]) => `<option value="${a}" ${String(a) === String(v ?? '') ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
const CB = (k, v, t) => `<label class="agr-cb"><input type="checkbox" name="${k}" ${v ? 'checked' : ''}> ${esc(t)}</label>`;

async function view(root, id) {
  const a = await q(sb.from('agreements').select('*').eq('id', id).single()); const t = await tpl(a.tpl);
  const projects = await q(sb.from('projects').select('id,name').eq('archived', false).order('name')).catch(() => []);
  const d = { ...t.defaults, ...a.data }; const ro = !canEdit();
  const B = t.body.budget, bud = d.budget || {};
  root.innerHTML = `<div class="hubh"><div><a class="muted small" href="#/agreements">← الاتفاقيات</a><h1 class="pagetitle">${esc(a.title || 'اتفاقية جديدة')} <small class="muted ltr">${code(a)}</small></h1>
      <p class="muted m0">${esc(t.title)} — ${esc(t.ver)}</p></div>
      <div class="btnrow"><select id="agSt" ${ro ? 'disabled' : ''}>${Object.entries(AST).map(([k, [n]]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="agr-out"><div><b>${ico('doc')} الاتفاقية</b><button class="btn primary" data-out="agreement:pdf">PDF</button><button class="btn" data-out="agreement:docx">Word</button></div>
      <div><b>${ico('book')} ملحق إجراءات وآليات العمل</b><button class="btn primary" data-out="annex:pdf">PDF</button><button class="btn" data-out="annex:docx">Word</button></div>
      <span class="muted small">يُحفظ النموذج تلقائياً قبل كل إصدار، ولكل ملف رقم مرجعي يُتحقق منه في المكتبة الفنية.</span></div>
    <div id="agWarn"></div>
    <form id="agF" class="agr-form" ${ro ? 'inert' : ''}>
      <section><h3>١. المتبرع (الطرف الثاني)</h3><div class="pgrid">
        ${F('نوع المتبرع', S('donor_type', [['person', 'فرد'], ['heirs', 'ورثة (أبناء المرحوم)'], ['company', 'شركة أو مؤسسة']], d.donor_type))}
        ${F('اللقب', I('donor_honor', d.donor_honor, 'placeholder="الأستاذ"'), 'agr-person')}
        ${F('الاسم كما يُكتب في الاتفاقية', I('donor_name', d.donor_name, 'placeholder="عبدالله بن غانم آل وتيد الدوسري"'), 'wide')}
        ${F('ممثل الشركة', I('company_rep', d.company_rep), 'agr-co')}${F('صفته', I('company_rep_title', d.company_rep_title, 'placeholder="المدير العام"'), 'agr-co')}
        ${F('رقم الهوية أو السجل التجاري (اختياري)', I('p2_id', d.p2_id, 'dir="ltr"'))}
        ${F('منسق المتبرع', I('p2_coord', d.p2_coord))}${F('بريد منسق المتبرع', I('p2_email', d.p2_email, 'dir="ltr" type="email"'))}</div></section>
      <section><h3>٢. المشروع</h3><div class="pgrid">
        ${F('الموقع (الحي أو الهجرة)', I('loc', d.loc, 'placeholder="هجرة الغويبة"'))}
        ${F('اسم المركز (التسمية)', I('center', d.center, 'placeholder="مركز … للرعاية الصحية الأولية"'), 'wide')}
        ${F('الأرض', S('land', [['cluster', 'يخصصها التجمع'], ['donor', 'أرض خاصة بالمتبرع (منفعة)']], d.land || 'cluster'))}
        ${F('مدة المنفعة (سنة)', I('land_years', d.land_years || 40, 'type="number" min="1" dir="ltr"'), 'agr-land')}
        ${F('مدة التنفيذ (شهر)', I('months', d.months, 'type="number" min="1" dir="ltr"'))}
        ${F('المشروع المرتبط في المنصة', S('project_id', [['', '— غير مرتبط —'], ...projects.map(p => [p.id, p.name])], a.project_id))}</div>
        <div class="agr-cbs">${CB('naming', d.naming !== false, 'بند تسمية المركز باسم المتبرع')}</div></section>
      <section><h3>٣. التمويل والميزانية</h3><div class="pgrid">${F('مبلغ التبرع (ر.س قبل الضريبة)', N('amount', d.amount))}<div class="fld wide"><span>كتابةً</span><b id="agW" class="agr-w"></b></div></div>
        <table class="vt agr-bud"><thead><tr><th style="width:40px"></th><th>البند</th><th style="width:180px">التكلفة الاسترشادية (ر.س)</th></tr></thead><tbody>
        ${B.map(([k, label, on0]) => { const b = bud[k] || {}; const on = b.on ?? on0; return `<tr><td class="c"><input type="checkbox" data-bon="${k}" ${on ? 'checked' : ''}></td><td>${esc(label.replace('{svc_list}', 'كهرباء – ماء – صرف صحي – اتصالات…'))}</td><td>${N('b_' + k, b.amt)}</td></tr>`; }).join('')}
        </tbody><tfoot><tr><td></td><td><b>المجموع</b></td><td class="price" id="agSum"></td></tr></tfoot></table>
        <div class="agr-cbs">${CB('cameras', d.cameras !== false, 'كاميرات المراقبة ضمن إيصال الخدمات')}${CB('show_costs', d.show_costs !== false, 'إظهار التكلفة الاسترشادية في الاتفاقية')}</div></section>
      <section><h3>٤. بيانات المشروع والخدمات</h3><div class="pgrid">
        ${F('مساحة الأرض التقريبية (م²)', N('land_area', d.land_area))}${F('عدد المواقف التقريبي', N('parking', d.parking))}${F('مسطح البناء التقريبي (م²)', N('bua', d.bua))}
        ${F('عدد الأدوار', S('floors', [[1, 'دور واحد'], [2, 'دوران'], [3, 'ثلاثة أدوار']], d.floors || 1))}
        ${F('عيادات طب الأسرة (حد أدنى)', I('fm', d.fm, 'type="number" min="0" dir="ltr"'))}${F('عيادات الأسنان', I('dent', d.dent, 'type="number" min="0" dir="ltr"'))}</div>
        <div class="agr-cbs"><span class="muted small">الخدمات الطبية:</span>${t.body.med.map(m => `<label class="agr-cb"><input type="checkbox" data-med="${esc(m)}" ${(d.med || []).includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('')}</div></section>
      <section><h3>٥. الطرف الأول</h3><div class="pgrid">
        ${F('التبعية', I('affil', d.affil))}${F('ممثل التجمع', I('p1_rep', d.p1_rep))}${F('صفته', I('p1_rep_title', d.p1_rep_title))}
        ${F('منسق التجمع', I('p1_coord', d.p1_coord, 'placeholder="المهندس …"'))}${F('بريد منسق التجمع', I('p1_email', d.p1_email, 'dir="ltr" type="email"'))}</div></section>
      <section><h3>٦. الصيغة</h3><div class="agr-cbs">
        ${CB('v2', d.v2 !== false, 'الصيغة المطوّرة: التعريفات، وتسوية الخلافات ودياً، وانقضاء الاتفاقية بالتسليم أو القوة القاهرة')}
        ${CB('annex', d.annex !== false, 'النص على أن الملحق جزء مكمل للاتفاقية')}</div>
        <p class="muted small">الصيغة الأساسية مطابقة لاتفاقيتي باسم الغدير وخالد العبدالقادر (مايو 2026). إضافات الصيغة المطوّرة تحتاج مراجعة الشؤون القانونية قبل أول توقيع.</p></section>
      ${ro ? '' : `<div class="btnrow end"><span class="muted small" id="agSaved"></span>${isAdmin() ? '<button type="button" class="btn danger" id="agDel">حذف</button>' : ''}<button type="button" class="btn primary" id="agSave">حفظ</button></div>`}
    </form>
    <details class="agr-log"><summary>سجل الاتفاقية</summary>${(a.log || []).slice().reverse().map(l => `<div>${dateAr(l.at)} — ${esc(l.ev)}${l.by ? ' · ' + esc(l.by) : ''}</div>`).join('') || '<div class="muted">—</div>'}</details>`;

  const f = $('#agF', root);
  const read = () => { const o = { ...a.data };
    $$('input[name],select[name]', f).forEach(i => { if (i.name === 'project_id') return; o[i.name] = i.type === 'checkbox' ? i.checked : i.classList.contains('money') ? (parseMoney(i.value) === '' ? null : Number(parseMoney(i.value))) : i.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value.trim(); });
    o.budget = Object.fromEntries(B.map(([k]) => [k, { on: $(`[data-bon="${k}"]`, f).checked, amt: o['b_' + k] ?? null }])); B.forEach(([k]) => delete o['b_' + k]);
    o.med = $$('[data-med]', f).filter(x => x.checked).map(x => x.dataset.med); o.floors = Number(o.floors) || 1; return o; };
  const paint = () => { const o = read();
    $$('.agr-person', f).forEach(x => x.style.display = o.donor_type === 'company' ? 'none' : ''); $$('.agr-co', f).forEach(x => x.style.display = o.donor_type === 'company' ? '' : 'none');
    $$('.agr-land', f).forEach(x => x.style.display = o.land === 'donor' ? '' : 'none');
    const sum = Object.values(o.budget).filter(b => b.on).reduce((s, b) => s + (Number(b.amt) || 0), 0);
    $('#agSum', f).textContent = num(sum); $('#agW', f).textContent = o.amount ? tafqeet(o.amount) : '—';
    const w = []; if (o.amount && sum && Math.round(sum) !== Math.round(o.amount)) w.push(`مجموع البنود (${num(sum)}) لا يساوي مبلغ التبرع (${num(o.amount)}) — الفرق ${num(o.amount - sum)} ر.س.`);
    if (!o.donor_name) w.push('اسم المتبرع غير مدخل.'); if (o.naming && !o.center) w.push('بند التسمية مفعّل واسم المركز غير مدخل.');
    const ex = o.budget.exec; if (ex?.on && ex.amt && o.bua) { const m2 = ex.amt / o.bua; if (m2 < 5000 || m2 > 6000) w.push(`تكلفة التنفيذ للمتر ${num(m2)} ر.س — خارج النطاق المعتاد في اتفاقيات التجمع (5,000–6,000 ر.س/م²). راجع بند التنفيذ أو المسطح.`); }
    $('#agWarn', root).innerHTML = w.length ? `<div class="notice">${w.map(esc).join('<br>')}</div>` : ''; };
  f.addEventListener('input', paint); f.addEventListener('change', paint); paint();
  $$('input.money', f).forEach(i => i.addEventListener('blur', () => { i.value = fmtMoney(i.value); }));

  const save = async (silent) => { if (ro) return a; const o = read(); const pid = $('[name=project_id]', f).value || null;
    const title = o.center || (o.loc ? `مركز رعاية صحية أولية — ${o.loc}` : ''); const donor = o.donor_type === 'heirs' ? `أبناء المرحوم/ ${o.donor_name}` : o.donor_name;
    const upd = { data: o, title, donor, amount: o.amount || null, project_id: pid, updated_at: new Date().toISOString() };
    await q(sb.from('agreements').update(upd).eq('id', a.id)); Object.assign(a, upd);
    if (!silent) { toast('حُفظت الاتفاقية'); } const s = $('#agSaved', root); if (s) s.textContent = 'آخر حفظ ' + new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); return a; };
  const sb1 = $('#agSave', root); if (sb1) sb1.onclick = () => save().catch(err);
  const del = $('#agDel', root); if (del) del.onclick = async () => { if (!await confirm('حذف هذه الاتفاقية نهائياً؟', 'حذف', true)) return; await q(sb.from('agreements').delete().eq('id', a.id)).catch(err); location.hash = '#/agreements'; };
  $('#agSt', root).onchange = async e => { const st = e.target.value; const log = [...(a.log || []), { at: new Date().toISOString(), by: session.profile?.full_name || '', ev: 'الحالة: ' + AST[st][0] }];
    try { await q(sb.from('agreements').update({ status: st, log, signed_at: st === 'signed' ? new Date().toISOString().slice(0, 10) : a.signed_at }).eq('id', a.id)); a.status = st; a.log = log; toast('تم تحديث الحالة'); } catch (x) { err(x); } };
  $$('[data-out]', root).forEach(b => b.onclick = async () => { const [kind, fmt] = b.dataset.out.split(':');
    const { prepDoc } = await import('./pdfdoc.js'); const win = fmt === 'pdf' ? prepDoc() : null; if (fmt === 'pdf' && !win) return;
    try { await save(true); await output(a, t, kind, fmt, win); } catch (e) { if (win) win.close(); err(e); } });
}

// ---------- الإصدار
let LOGO_BYTES = null;
async function logoBytes() { if (!LOGO_BYTES) LOGO_BYTES = new Uint8Array(await (await fetch(new URL('assets/logo.png', location.href).href)).arrayBuffer()); return LOGO_BYTES; }
function loadJSZip() { return new Promise((res, rej) => { if (window.JSZip) return res(window.JSZip); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error('تعذّر تحميل مكتبة Word')); document.head.appendChild(s); }); }

async function output(a, t, kind, fmt, win) {
  const V = vars(a.data, t); const blocks = resolve(t.body[kind], V);
  const { issueDoc, setHash } = await import('./docctl.js');
  const name = kind === 'agreement' ? 'اتفاقية شراكة مجتمعية' : 'ملحق إجراءات وآليات العمل';
  const title = `${name} — ${V.center_or}`;
  const ref = await issueDoc({ kind: kind === 'agreement' ? 'agr' : 'anx', ref: a.id, title });
  if (fmt === 'docx') {
    const JSZip = await loadJSZip();
    const blob = await buildDocx(JSZip, { blocks, V, tpl: t, kind, ref, logo: await logoBytes(), title, outType: 'blob' });
    setHash(ref, await blob.arrayBuffer());
    download(blob, `${name} - ${(V.center_or || '').replace(/[\\/:*?"<>|]/g, '')}.docx`); toast('تم تصدير ملف Word'); return;
  }
  const { openDoc, coverHtml } = await import('./pdfdoc.js');
  const body = `<div class="ag">${toHtml(blocks, V, t)}</div>`;
  const cover = kind === 'agreement' ? coverHtml({ kicker: 'الشراكة المجتمعية', title: 'اتفاقية شراكة مجتمعية', sub: `بين تجمع الأحساء الصحي التابع لـ${V.affil}\nو${V.p2title}`, project: V.center_or, facility: V.loc_or, pills: [], tag: 'اتفاقية', edition: ref, date: `${V.yg}م / ${V.yh}هـ` })
    : coverHtml({ kicker: 'الشراكة المجتمعية', title: 'ملحق إجراءات وآليات العمل', sub: `دليل المتبرع لرحلة إنشاء ${V.center_or}: الأطراف، والتواصل، وآلية الصرف، والتكلفة، والجودة، والاستلام.`, project: V.center_or, facility: V.loc_or, pills: [`${V.amount_n} ر.س`, `${V.months} شهراً`], tag: 'ملحق الاتفاقية', edition: ref, date: `${V.yg}م / ${V.yh}هـ` });
  await openDoc({ title, cover, body, css: AGR_CSS, win, docCode: ref, footC: kind === 'agreement' ? 'الأحرف الأولى:  الطرف الأول ........  الطرف الثاني ........' : '', copy: AGR_COPY, stamp: false });
}
