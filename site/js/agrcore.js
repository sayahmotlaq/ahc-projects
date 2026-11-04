// ===== محرّك الاتفاقيات: المتغيرات المحسوبة، التفقيط، حل القالب، وتصيير HTML (للـ PDF) وWord (OOXML) من نفس الكتل — بلا اعتماد على الصفحة =====
const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة', 'الرابعة عشرة', 'الخامسة عشرة', 'السادسة عشرة', 'السابعة عشرة', 'الثامنة عشرة', 'التاسعة عشرة', 'العشرون', 'الحادية والعشرون', 'الثانية والعشرون'];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = n => Math.round(Number(n) || 0).toLocaleString('en');

// ---------- التفقيط (ريال، مذكر)
const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUND = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function upTo999(n, construct) {
  const h = Math.floor(n / 100), r = n % 100, p = [];
  if (h) p.push(h === 2 && construct && !r ? 'مائتا' : HUND[h]);
  if (r) p.push(r < 20 ? ONES[r] : (r % 10 ? ONES[r % 10] + ' و' + TENS[Math.floor(r / 10)] : TENS[Math.floor(r / 10)]));
  return p.join(' و');
}
function group(n, one, two, plural, sing) {
  if (!n) return '';
  if (n === 1) return one; if (n === 2) return two;
  if (n >= 3 && n <= 10) return upTo999(n) + ' ' + plural;
  return upTo999(n, true) + ' ' + sing;
}
export function tafqeet(v) {
  let n = Math.round(Number(v) || 0); if (!n) return 'صفر ريال سعودي';
  const b = Math.floor(n / 1e9), m = Math.floor(n / 1e6) % 1000, t = Math.floor(n / 1000) % 1000, r = n % 1000;
  const parts = [group(b, 'مليار', 'ملياران', 'مليارات', 'مليار'), group(m, 'مليون', 'مليونان', 'ملايين', 'مليون'), group(t, 'ألف', 'ألفان', 'آلاف', 'ألف'), r ? upTo999(r) : ''].filter(Boolean);
  return parts.join(' و') + ' ريال سعودي';
}
// السنة الهجرية والميلادية
export function years(d = new Date()) {
  let yh = ''; try { yh = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }).format(d).replace(/\D/g, ''); } catch (e) { }
  return { yg: String(d.getFullYear()), yh: yh || String(Math.round((d.getFullYear() - 622) * 1.0307)) };
}
const clinics = n => { n = Number(n) || 0; return `(${n}) ${n >= 3 && n <= 10 ? 'عيادات' : 'عيادة'}`; };

// ---------- المتغيرات المحسوبة من بيانات الاتفاقية
export function vars(d, tpl, at = new Date()) {
  const B = tpl.body.budget, type = d.donor_type || 'person', name = (d.donor_name || '').trim() || '........................';
  const honor = (d.donor_honor || 'الأستاذ').trim();
  const p2title = type === 'heirs' ? `أبناء المرحوم/ ${name}` : type === 'company' ? name : `${honor}/ ${name}`;
  const rep = (d.company_rep || '').trim() || '........................', repT = (d.company_rep_title || '').trim() || '................';
  const p2full = type === 'company' ? `${name}، ويمثلها في هذه الاتفاقية ${rep} بصفته ${repT}` : p2title;
  const budget = B.map(([k, label, on0, when, basis]) => { const b = (d.budget || {})[k] || {}; return { k, label, on: b.on ?? on0, amt: Number(b.amt) || 0, when, basis }; }).filter(x => x.on);
  const amount = Number(d.amount) || budget.reduce((s, x) => s + x.amt, 0);
  const bsum = budget.reduce((s, x) => s + x.amt, 0);
  const exec = budget.find(x => x.k === 'exec')?.amt || 0, bua = Number(d.bua) || 0, floors = Number(d.floors) || 1;
  const svc_list = 'كهرباء – ماء – صرف صحي – اتصالات' + (d.cameras !== false ? ' – كاميرات مراقبة وتوابعها' : '');
  const V = { ...years(at), affil: d.affil || 'شركة الصحة القابضة', p1_rep: d.p1_rep || '........................', p1_rep_title: d.p1_rep_title || 'الرئيس التنفيذي',
    p1_coord: d.p1_coord || '', p1_email: d.p1_email || '', p2_coord: d.p2_coord || '', p2_email: d.p2_email || '', p2_id: (d.p2_id || '').trim(),
    p2title, p2full, p2sig: type === 'company' ? `${name}\n${rep}` : p2title, type,
    and_companies: type === 'company' ? ' والشركات' : '', land_phrase: d.land === 'donor' ? ` على أرض خاصة بالطرف الثاني (منفعة لمدة ${Number(d.land_years) || 40} عاماً)` : '',
    loc: d.loc ? ` في ${d.loc.trim()}` : '', loc_or: d.loc ? `${d.loc.trim()} — محافظة الأحساء` : 'محافظة الأحساء',
    center: (d.center || '').trim() || '........................', center_or: (d.center || '').trim() || 'مركز رعاية صحية أولية',
    months: Number(d.months) || 36, amount, amount_n: num(amount), amount_w: tafqeet(amount), amount_vat: num(amount * 1.15), vat_n: num(amount * 0.15),
    bua_t: bua ? `${num(bua)} متر مربع (${floors === 1 ? 'دور واحد' : floors === 2 ? 'دوران' : floors + ' أدوار'})` : 'يُحدد في التصميم', svc_list,
    budget, bsum, exec, bua, floors, per_m2: exec && bua ? exec / bua : 0, show_costs: d.show_costs !== false,
    land_area: d.land_area, parking: d.parking, fm: d.fm ?? 3, dent: d.dent ?? 0, med: d.med || [],
    // الشروط المنطقية
    naming: d.naming !== false && !!(d.center || '').trim(), annex: d.annex !== false, v2: d.v2 !== false, donor_land: d.land === 'donor', company: type === 'company' };
  V.budget.forEach(x => x.label = fill(x.label, V));
  return V;
}
export const fill = (s, V) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => V[k] === undefined || typeof V[k] === 'object' ? m : String(V[k]));
const ok = (c, V) => !c || (c[0] === '!' ? !V[c.slice(1)] : !!V[c]);

// ---------- حل القالب: الشروط، المتغيرات، ترقيم المواد والأقسام
export function resolve(blocks, V) {
  let art = 0, sec = 0; const out = [];
  const one = b => { if (!ok(b.if, V)) return null; const x = { ...b };
    if (x.x !== undefined) x.x = fill(x.x, V);
    if (x.items) x.items = x.items.filter(i => typeof i !== 'object' || Array.isArray(i) || ok(i.if, V)).map(i => typeof i === 'string' ? fill(i, V) : Array.isArray(i) ? i.map(c => fill(c, V)) : { ...i, x: fill(i.x, V), then: i.then?.map(one).filter(Boolean) });
    if (x.rows) x.rows = x.rows.map(r => r.map(c => fill(c, V)));
    if (x.t === 'h' && !x.plain) { x.no = ORD[art++] || String(art); if (V.v2 && x.v2x) x.x = x.v2x; }
    if (x.t === 'h2') x.no = ++sec;
    return x; };
  for (const b of blocks) { const r = one(b); if (r) out.push(r); }
  return out;
}

// ---------- محتوى الكتل المحسوبة (مشترك بين HTML وWord)
export function computed(b, V, tpl) {
  switch (b.t) {
    case 'parties': return [
      ['الطرف الأول', `تجمع الأحساء الصحي، ويمثله في هذه الاتفاقية ${V.p1_rep} بصفته ${V.p1_rep_title}، ويشار إليه فيما بعد بـ «الطرف الأول».`],
      ['الطرف الثاني', `${V.p2full}${V.p2_id ? `، ${V.company ? 'سجل تجاري' : 'هوية'} رقم (${V.p2_id})` : ''}، ويشار إليه فيما بعد بـ «الطرف الثاني»، ويشار إليهما مجتمعين فيما بعد بـ «الطرفين».`]];
    case 'budget': return { head: V.show_costs ? ['م', 'البند', 'التكلفة الاسترشادية (ر.س)'] : ['م', 'البند'], w: V.show_costs ? [8, 66, 26] : [8, 92],
      rows: V.budget.map((x, i) => V.show_costs ? [String(i + 1), x.label, x.amt ? num(x.amt) : '—'] : [String(i + 1), x.label]),
      foot: V.show_costs ? ['', 'المجموع', num(V.bsum || V.amount)] : null };
    case 'pdata': return { w: [55, 45], rows: [['مساحة الأرض المستخدمة التقريبية', V.land_area ? `${num(V.land_area)} متر مربع` : '—'], ['عدد مواقف السيارات التقريبي', V.parking ? num(V.parking) : '—'],
      ['مسطح البناء التقريبي', V.bua ? `${num(V.bua)} متر مربع` : '—'], ['عدد الأدوار', String(V.floors)]], kv: true };
    case 'services': return [
      `عدد لا يقل عن ${clinics(V.fm)} طب أسرة${Number(V.dent) ? ` و${clinics(V.dent)} أسنان` : ''}.`, 'التثقيف الصحي والدوائي.',
      ...(V.med.length ? [`خدمات طبية (${V.med.join(' – ')}).`] : []), 'منطقة إدارية ومناطق خدمات للموظفين.', 'خدمات عامة (استقبال – انتظار – دورات مياه).'];
    case 'notices': return { head: ['', 'المنسق', 'البريد الإلكتروني'], w: [22, 40, 38], rows: [['عن الطرف الأول', V.p1_coord || '', V.p1_email || ''], ['عن الطرف الثاني', V.p2_coord || '', V.p2_email || '']], ltr: [2] };
    case 'phases': return { head: ['م', 'المرحلة', 'المدة التقريبية', 'ما يحدث', 'دوركم'], w: [5, 25, 16, 30, 24], rows: tpl.body.phases.map((p, i) => [String(i + 1), ...p]) };
    case 'cash': return { head: ['البند', 'المبلغ (ر.س)', 'متى يُصرف تقريباً', 'أساس الصرف'], w: [30, 15, 22, 33],
      rows: V.budget.map(x => [x.label.replace(/\s*\(.*\)\s*$/, '').split(' للمشروع')[0], x.amt ? num(x.amt) : '—', x.when, x.basis]) };
    case 'costbox': return { rows: [['مبلغ التبرع قبل الضريبة', `${V.amount_n} ر.س`], ['ضريبة القيمة المضافة (15%) على الفواتير', `${V.vat_n} ر.س تقريباً`], ['الإجمالي المتوقع شاملاً الضريبة', `${V.amount_vat} ر.س تقريباً`],
      ...(V.per_m2 ? [['تكلفة التنفيذ الاسترشادية للمتر المربع', `${num(V.per_m2)} ر.س / م² (قبل الضريبة، دون الأثاث وإيصال الخدمات)`]] : [])],
      note: 'للمقارنة: تراوحت تكلفة التنفيذ الاسترشادية في اتفاقيات التجمع للمراكز المماثلة (2025–2026) بين 5,000 و6,000 ريال للمتر المربع من مسطح البناء قبل الضريبة. السعر الملزم هو نتيجة الطرح.' };
    case 'sig': return b.annex ? [['ممثل الطرف الأول', 'إدارة الخدمات الفنية — قسم المشاريع', V.p1_coord || ''], ['ممثل الطرف الثاني', V.p2title, V.p2_coord || '']]
      : [['الطرف الأول', 'تجمع الأحساء الصحي', V.p1_rep + (V.p1_rep_title ? '\n' + V.p1_rep_title : '')], ['الطرف الثاني', V.company ? V.p2title : 'المتبرع', V.company ? (V.p2full.split('ويمثلها في هذه الاتفاقية ')[1] || '').split(' بصفته ')[0] : V.p2title]];
  }
}

// ---------- HTML (نافذة الطباعة PDF)
export const AGR_CSS = `
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ag-hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid var(--n);padding-bottom:10px;margin-bottom:18px}
.ag-hd img{height:17mm}.ag-ref{text-align:left;font-size:8.6pt;color:var(--g);line-height:1.6}.ag-ref b{color:var(--n);direction:ltr;display:inline-block}
.ag-tt{text-align:center;margin:6px 0 18px}.ag-tt .k{display:inline-block;color:var(--s);font-weight:800;font-size:10pt;letter-spacing:.5px;border:1.5px solid var(--s);border-radius:30px;padding:2px 14px;margin-bottom:8px}
.ag-tt h1{font-size:23pt;font-weight:800;color:var(--n);margin:2px 0 6px}.ag-tt .l{font-size:12.4pt;font-weight:700;color:#24394b;line-height:1.75}.ag-tt .y{display:inline-block;margin-top:8px;background:var(--n);color:#fff;border-radius:6px;padding:2px 14px;font-weight:700;font-size:10pt}
.ag p{margin:0 0 8px;text-align:justify}.ag{font-size:11pt;line-height:1.95}
.ag-pt{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 14px}.ag-pt div{border:1px solid var(--l);border-top:4px solid var(--s);border-radius:8px;padding:9px 12px;font-size:10.4pt;line-height:1.8;break-inside:avoid}
.ag-pt b{display:block;color:var(--n);font-size:10.6pt;margin-bottom:2px}
.ah{display:flex;align-items:center;gap:10px;margin:16px 0 7px;break-after:avoid;page-break-after:avoid}.ah .no{background:var(--n);color:#fff;border-radius:6px;padding:2px 11px;font-weight:800;font-size:10.4pt;white-space:nowrap}
.ah h3{font-size:12.4pt;font-weight:800;color:var(--n);margin:0;flex:1;border-bottom:1.5px solid var(--s2);padding-bottom:3px}.ah.plain h3{border-bottom:2px solid var(--s)}
.ag ol.n{list-style:none;counter-reset:n;padding:0;margin:0 0 8px}.ag ol.n>li{counter-increment:n;position:relative;padding-right:30px;margin:0 0 6px;text-align:justify}
.ag ol.n>li:before{content:counter(n);position:absolute;right:0;top:3px;width:21px;height:21px;border-radius:50%;background:var(--s2);color:var(--n);font-weight:800;font-size:9pt;display:grid;place-items:center;line-height:1}
.ag ul.d{margin:0 0 8px;padding-right:20px}.ag ul.d li{margin-bottom:4px}.ag ul.d li::marker{color:var(--s)}
.ag .tbl{margin:6px 0 8px}.ag .tbl td,.ag .tbl th{font-size:10pt;border:1px solid var(--l);padding:5px 8px;vertical-align:middle}.ag .tbl tfoot td{background:var(--n);color:#fff;font-weight:800}
.ag .tbl td.c,.ag .tbl th.c{text-align:center}.ag .tbl td.num{direction:ltr;text-align:center;font-weight:700;color:var(--n);white-space:nowrap}.ag .tbl.kv td:first-child{background:#F5F8FA;font-weight:700;color:var(--n)}
.ag .sm{font-size:9pt;color:var(--g)}.ag .ltrc{direction:ltr;text-align:center}
.ag-end{text-align:center;font-weight:700;color:var(--n);margin:16px 0 8px}
.ag-sig{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px;break-inside:avoid}.ag-sig>div{border:1px solid var(--l);border-radius:10px;padding:10px 14px}
.ag-sig h4{background:var(--s2);color:var(--n);text-align:center;border-radius:6px;padding:3px;margin:-2px -6px 8px;font-size:11pt}.ag-sig .o{font-weight:800;color:var(--n);text-align:center}.ag-sig .nm{text-align:center;white-space:pre-line;margin-bottom:10px}
.ag-sig .ln{display:flex;gap:8px;font-size:9.6pt;color:var(--g);margin-top:9px}.ag-sig .ln i{flex:1;border-bottom:1px dotted #9AA6B1}
.ag .defs{margin:4px 0 8px}.ag .defs div{display:grid;grid-template-columns:110px 1fr;gap:10px;padding:4px 0;border-bottom:1px dashed var(--l)}.ag .defs b{color:var(--n)}
.ag .faq div{border-right:3px solid var(--s);background:#F7FAFC;border-radius:6px;padding:7px 12px;margin:0 0 7px;break-inside:avoid}.ag .faq b{color:var(--n);display:block}
.ag .chk{list-style:none;padding:0}.ag .chk li{padding:4px 30px 4px 0;position:relative}.ag .chk li:before{content:"";position:absolute;right:0;top:9px;width:15px;height:15px;border:2px solid var(--s);border-radius:4px}
.ag .lead{font-size:11.6pt;color:#24394b}.ag .note.warn{background:var(--wb)}.ag .cbox{border:1.5px solid var(--s);border-radius:10px;padding:10px 14px;margin:10px 0;break-inside:avoid}.ag .cbox h4{font-size:11pt;margin-bottom:4px}
.ag .mx td:nth-child(2){background:#F3FAFE}`;
const html2 = s => esc(s).replace(/\n/g, '<br>');
const tblHtml = (t, cls = '') => `<table class="tbl ${cls}${t.kv ? ' kv' : ''}">${t.w ? `<colgroup>${t.w.map(w => `<col style="width:${w}%">`).join('')}</colgroup>` : ''}${t.head ? `<thead><tr>${t.head.map((h, i) => `<th class="${i === 0 && t.head[0] === 'م' ? 'c' : ''}">${esc(h)}</th>`).join('')}</tr></thead>` : ''}
  <tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td class="${(t.head && t.head[0] === 'م' && i === 0) ? 'c' : /^[\d,—]+$/.test(c) && i > 0 ? 'num' : (t.ltr || []).includes(i) ? 'ltrc' : ''}">${html2(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  ${t.foot ? `<tfoot><tr>${t.foot.map((c, i) => `<td class="${/^[\d,]+$/.test(c) ? 'num' : ''}" style="${/^[\d,]+$/.test(c) ? 'color:#fff' : ''}">${esc(c)}</td>`).join('')}</tr></tfoot>` : ''}</table>`;

export function toHtml(blocks, V, tpl) {
  const B = b => {
    switch (b.t) {
      case 'p': return `<p>${html2(b.x)}</p>`;
      case 'lead': return `<p class="lead">${html2(b.x)}</p>`;
      case 'small': return `<p class="sm">${html2(b.x)}</p>`;
      case 'end': return `<p class="ag-end">${esc(b.x)}</p>`;
      case 'note': return `<div class="note${b.kind === 'warn' ? ' warn' : ''}">${html2(b.x)}</div>`;
      case 'h': return b.plain ? `<div class="ah plain"><h3>${esc(b.x)}</h3></div>` : `<div class="ah"><span class="no">المادة ${b.no}</span><h3>${esc(b.x)}</h3></div>`;
      case 'h2': return `<div class="sh" style="margin-top:22px"><span class="sn">${b.no}</span><h2 style="font-size:15pt">${esc(b.x)}</h2></div>`;
      case 'h3': return `<h4 style="font-size:11.6pt;margin:12px 0 5px;color:var(--n)">${esc(b.x)}</h4>`;
      case 'ol': return `<ol class="n">${b.items.map(i => `<li>${html2(i.x)}${(i.then || []).map(B).join('')}</li>`).join('')}</ol>`;
      case 'ul': return `<ul class="d">${b.items.map(i => `<li>${html2(i.x ?? i)}</li>`).join('')}</ul>`;
      case 'steps': return `<ol class="steps">${b.items.map(i => `<li>${html2(i)}</li>`).join('')}</ol>`;
      case 'check': return `<ul class="chk">${b.items.map(i => `<li>${html2(i)}</li>`).join('')}</ul>`;
      case 'defs': return `<div class="defs">${b.items.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>`;
      case 'faq': return `<div class="faq">${b.items.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>`;
      case 'kv': return tblHtml({ rows: b.rows, w: [28, 72], kv: true });
      case 'tbl': case 'matrix': return tblHtml({ head: b.head, rows: b.rows, w: b.w }, b.t === 'matrix' ? 'mx' : '');
      case 'parties': return `<div class="ag-pt">${computed(b, V, tpl).map(([k, v]) => `<div><b>${k}</b>${esc(v)}</div>`).join('')}</div>`;
      case 'services': return `<ul class="d">${computed(b, V, tpl).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      case 'costbox': { const c = computed(b, V, tpl); return `<div class="cbox"><h4>الصورة المالية لمشروعكم</h4>${tblHtml({ rows: c.rows, w: [45, 55], kv: true })}<p class="sm" style="margin:4px 0 0">${esc(c.note)}</p></div>`; }
      case 'sig': return `<div class="ag-sig">${computed(b, V, tpl).map(([h, o, nm]) => `<div><h4>${esc(h)}</h4><div class="o">${esc(o)}</div><div class="nm">${esc(nm)}</div><div class="ln">التوقيع<i></i></div>${b.annex ? '' : '<div class="ln">الختم<i></i></div>'}<div class="ln">التاريخ<i></i></div></div>`).join('')}</div>`;
      case 'budget': case 'pdata': case 'notices': case 'phases': case 'cash': return tblHtml(computed(b, V, tpl));
      case 'pb': return '<div class="brk"></div>';
    }
    return '';
  };
  return blocks.map(B).join('');
}
export function titleHtml(V, ref, logo) {
  return `<div class="ag-hd"><img src="${logo}" alt=""><div class="ag-ref">الرقم المرجعي: <b>${esc(ref)}</b><br>إدارة الخدمات الفنية — قسم المشاريع</div></div>
  <div class="ag-tt"><span class="k">الشراكة المجتمعية</span><h1>اتفاقية شراكة مجتمعية</h1><div class="l">بين تجمع الأحساء الصحي التابع لـ${esc(V.affil)}<br>و${esc(V.p2title)}<br>لإنشاء وتجهيز مركز رعاية صحية أولية${esc(V.loc)} بمحافظة الأحساء</div><span class="y">${V.yg}م / ${V.yh}هـ</span></div>`;
}

// ---------- Word (OOXML) — يُبنى بـ JSZip (يمرَّر من الصفحة أو من Node)
const X = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = { n: '153E5C', s: '27A8DF', s2: 'E8F6FC', g: '5B6B7A', l: 'D5DFE7', f: 'F5F8FA', w: 'FBEFE8' };
const FONT = 'Tajawal';
function run(t, o = {}) {
  const sz = Math.round((o.sz || 11) * 2);
  const pr = `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${o.ltr ? '' : '<w:rtl/>'}</w:rPr>`;
  return String(t ?? '').split('\n').map((line, i) => `<w:r>${pr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join('');
}
function para(runs, o = {}) {
  const sp = `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 100}" w:line="${o.line ?? 300}" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.keep ? '<w:keepNext/>' : ''}${o.pb ? '<w:pageBreakBefore/>' : ''}${o.bdr || ''}${o.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>` : ''}<w:bidi/>${sp}${o.ind || ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
}
const P = (t, o = {}) => para(run(t, o), o);
function cell(content, w, o = {}) {
  const paras = Array.isArray(content) ? content.join('') : P(content, { jc: o.jc, b: o.b, color: o.color, sz: o.sz || 10, after: 0, line: 276, ltr: o.ltr });
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${paras}</w:tc>`;
}
const TW = 9638; // عرض النص (A4 بهوامش 2 سم)
function table(t, o = {}) {
  const ws = (t.w || t.rows[0].map(() => 100 / t.rows[0].length)).map(p => Math.round(TW * p / 100));
  const bd = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${C.l}"/>`).join('')}</w:tblBorders>`;
  const isNum = (c, i) => i > 0 && /^[\d,—]+$/.test(c);
  const head = t.head ? `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.head.map((h, i) => cell(h, ws[i], { fill: C.n, color: 'FFFFFF', b: true, jc: 'center' })).join('')}</w:tr>` : '';
  const rows = t.rows.map((r, ri) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c, ws[i], { fill: t.kv && i === 0 ? C.f : (o.mx && i === 1 ? 'F3FAFE' : (ri % 2 && !t.kv ? 'FAFCFD' : null)), b: (t.kv && i === 0) || isNum(c, i), color: (t.kv && i === 0) || isNum(c, i) ? C.n : null, jc: (t.head && t.head[0] === 'م' && i === 0) || isNum(c, i) || (t.ltr || []).includes(i) ? 'center' : null, ltr: isNum(c, i) || (t.ltr || []).includes(i) })).join('')}</w:tr>`).join('');
  const foot = t.foot ? `<w:tr>${t.foot.map((c, i) => cell(c, ws[i], { fill: C.n, color: 'FFFFFF', b: true, jc: i === t.foot.length - 1 ? 'center' : null, ltr: /^[\d,]+$/.test(c) })).join('')}</w:tr>` : '';
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TW}" w:type="dxa"/>${bd}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${ws.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${head}${rows}${foot}</w:tbl>` + P('', { after: 60, sz: 4 });
}
const IND = '<w:ind w:right="454" w:hanging="454"/>';
function docxBody(blocks, V, tpl, kind) {
  const B = b => {
    switch (b.t) {
      case 'p': return P(b.x, { jc: 'both' });
      case 'lead': return P(b.x, { jc: 'both', sz: 11.5, color: '24394B' });
      case 'small': return P(b.x, { sz: 9, color: C.g });
      case 'end': return P(b.x, { jc: 'center', b: true, color: C.n, before: 200 });
      case 'note': return P(b.x, { jc: 'both', sz: 10, shd: b.kind === 'warn' ? C.w : C.s2, bdr: `<w:pBdr><w:right w:val="single" w:sz="24" w:space="6" w:color="${b.kind === 'warn' ? 'B5562B' : C.s}"/></w:pBdr>`, before: 80, after: 140 });
      case 'h': return b.plain ? para(run(b.x, { b: true, sz: 13, color: C.n }), { keep: true, before: 200, after: 80, bdr: `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="${C.s}"/></w:pBdr>` })
        : para(run(`المادة ${b.no}`, { b: true, sz: 12, color: C.s }) + (b.x ? run(`:  ${b.x}`, { b: true, sz: 12.5, color: C.n }) : ''), { keep: true, before: 220, after: 80, shd: C.s2, bdr: `<w:pBdr><w:right w:val="single" w:sz="36" w:space="6" w:color="${C.n}"/></w:pBdr>` });
      case 'h2': return para(run(`${b.no}.  `, { b: true, sz: 15, color: C.s }) + run(b.x, { b: true, sz: 15, color: C.n }), { keep: true, before: 320, after: 120, bdr: `<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="3" w:color="${C.n}"/></w:pBdr>` });
      case 'h3': return P(b.x, { b: true, sz: 12, color: C.n, keep: true, before: 160, after: 60 });
      case 'ol': return b.items.map((i, n) => para(run(`${n + 1}.\t`, { b: true, color: C.s }) + run(i.x), { jc: 'both', ind: IND, after: 80 }) + (i.then || []).map(B).join('')).join('');
      case 'steps': return b.items.map((i, n) => para(run(`${n + 1}.\t`, { b: true, color: C.s }) + run(i), { jc: 'both', ind: IND, after: 80 })).join('');
      case 'ul': case 'services': case 'check': { const items = b.t === 'services' ? computed(b, V, tpl) : b.items.map(i => i.x ?? i); const m = b.t === 'check' ? '☐' : '•';
        return items.map(i => para(run(`${m}\t`, { b: true, color: C.s }) + run(i), { jc: 'both', ind: IND, after: 70 })).join(''); }
      case 'defs': return table({ rows: b.items, w: [22, 78], kv: true });
      case 'faq': return b.items.map(([k, v]) => para(run(k, { b: true, color: C.n }), { keep: true, after: 20, before: 80 }) + P(v, { jc: 'both', after: 80 })).join('');
      case 'kv': return table({ rows: b.rows, w: [28, 72], kv: true });
      case 'tbl': return table(b); case 'matrix': return table(b, { mx: true });
      case 'parties': return computed(b, V, tpl).map(([k, v]) => para(run(k + ': ', { b: true, color: C.n }) + run(v), { jc: 'both', after: 100 })).join('');
      case 'costbox': { const c = computed(b, V, tpl); return P('الصورة المالية لمشروعكم', { b: true, color: C.n, keep: true, before: 120 }) + table({ rows: c.rows, w: [45, 55], kv: true }) + P(c.note, { sz: 9, color: C.g }); }
      case 'sig': { const s = computed(b, V, tpl), w = Math.round(TW / 2);
        const col = ([h, o, nm]) => cell([P(h, { b: true, color: C.n, jc: 'center', shd: C.s2, after: 60 }), P(o, { b: true, jc: 'center', after: 20 }), P(nm, { jc: 'center', after: 200 }),
          P('التوقيع: ........................................', { color: C.g, sz: 10, after: 160 }), ...(b.annex ? [] : [P('الختم: ..........................................', { color: C.g, sz: 10, after: 160 })]), P('التاريخ: ........................................', { color: C.g, sz: 10, after: 60 })], w);
        return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TW}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideV'].map(x => `<w:${x} w:val="single" w:sz="4" w:space="0" w:color="${C.l}"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${w}"/><w:gridCol w:w="${w}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${s.map(col).join('')}</w:tr></w:tbl>` + P(''); }
      case 'budget': case 'pdata': case 'notices': case 'phases': case 'cash': return table(computed(b, V, tpl));
      case 'pb': return para('', { pb: true });
    }
    return '';
  };
  return blocks.map(B).join('');
}
function titleDocx(V, ref, kind) {
  if (kind === 'annex') return para(run('ملحق إجراءات وآليات العمل', { b: true, sz: 24, color: 'FFFFFF' }), { jc: 'center', shd: C.n, before: 0, after: 0, line: 360 })
    + para(run(`دليل المتبرع لرحلة إنشاء ${V.center_or}`, { b: true, sz: 13, color: 'FFFFFF' }), { jc: 'center', shd: C.n, after: 0 })
    + para(run(`الاتفاقية بين تجمع الأحساء الصحي و${V.p2title}`, { sz: 11, color: 'D9EEF8' }), { jc: 'center', shd: C.n, after: 0, line: 360 })
    + para(run('', { sz: 6 }), { shd: C.s, after: 200, line: 120 })
    + P(`الرقم المرجعي: ${ref}`, { sz: 9, color: C.g, jc: 'center', after: 200 });
  return P('الشراكة المجتمعية', { b: true, sz: 10, color: C.s, jc: 'center', after: 40 })
    + P('اتفاقية شراكة مجتمعية', { b: true, sz: 22, color: C.n, jc: 'center', after: 80 })
    + P(`بين تجمع الأحساء الصحي التابع لـ${V.affil}\nو${V.p2title}\nلإنشاء وتجهيز مركز رعاية صحية أولية${V.loc} بمحافظة الأحساء`, { b: true, sz: 12.5, color: '24394B', jc: 'center', after: 80, line: 340 })
    + P(`${V.yg}م / ${V.yh}هـ`, { b: true, sz: 10.5, color: C.n, jc: 'center', after: 60 })
    + P(`الرقم المرجعي: ${ref}`, { sz: 9, color: C.g, jc: 'center', after: 240, bdr: `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="${C.s}"/></w:pBdr>` });
}
const COPY = '© 2026 حقوق النشر محفوظة لتجمع الأحساء الصحي — إدارة الخدمات الفنية';
export async function buildDocx(JSZip, { blocks, V, tpl, kind, ref, logo, logoW = 1332, logoH = 467, title, outType }) {
  const z = new JSZip();
  const body = titleDocx(V, ref, kind) + docxBody(blocks, V, tpl, kind);
  const cx = Math.round(1.55 * 914400), cy = Math.round(cx * logoH / logoW);
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const pic = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const hw = Math.round(TW / 2);
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${ns}><w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TW}" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="12" w:space="0" w:color="${C.s}"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${hw}"/><w:gridCol w:w="${hw}"/></w:tblGrid><w:tr>
    ${cell([para(run(title, { b: true, sz: 9, color: C.n }), { after: 0 }), para(run('إدارة الخدمات الفنية — قسم المشاريع', { sz: 8, color: C.g }), { after: 60 })], hw)}
    ${cell([`<w:p><w:pPr><w:bidi/><w:jc w:val="left"/><w:spacing w:after="60"/></w:pPr>${pic}</w:p>`], hw)}</w:tr></w:tbl>${P('', { after: 0, sz: 4 })}</w:hdr>`;
  const fld = c => `<w:fldSimple w:instr=" ${c} "><w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`;
  const fw = [Math.round(TW * .44), Math.round(TW * .38), Math.round(TW * .18)];
  const initials = kind === 'agreement' ? 'الأحرف الأولى — الطرف الأول: ............   الطرف الثاني: ............' : '';
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${ns}><w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TW}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="${C.l}"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${fw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr>
    ${cell(COPY, fw[0], { sz: 7, color: C.g })}${cell(initials, fw[1], { sz: 7.5, color: C.n, jc: 'center' })}
    ${cell([`<w:p><w:pPr><w:bidi/><w:jc w:val="left"/><w:spacing w:after="0"/></w:pPr>${run('صفحة ', { sz: 8, color: C.g })}${fld('PAGE')}${run(' من ', { sz: 8, color: C.g })}${fld('NUMPAGES')}</w:p>`], fw[2])}</w:tr></w:tbl></w:ftr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rHdr"/><w:footerReference w:type="default" r:id="rFtr"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1531" w:right="1134" w:bottom="1247" w:left="1134" w:header="567" w:footer="510" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:bidi/></w:pPr><w:rPr><w:rtl/></w:rPr></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>تجمع الأحساء الصحي — إدارة الخدمات الفنية</dc:creator><dc:identifier>${X(ref)}</dc:identifier><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  z.file('word/_rels/header1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`);
  z.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="454"/><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  z.file('word/styles.xml', styles); z.file('word/document.xml', doc); z.file('word/header1.xml', header); z.file('word/footer1.xml', footer);
  z.file('word/media/logo.png', logo);
  return z.generateAsync({ type: outType || (typeof window === 'undefined' ? 'nodebuffer' : 'blob'), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
