// ===== تصدير جدول الكميات إلى Excel (ExcelJS) =====
import { esc, fmt, toast, download } from './ui.js';
const today = () => new Date().toISOString().slice(0,10);
// ---------- تصدير Excel (ExcelJS)
export function loadExcelJS(){ return new Promise((res, rej) => { if(window.ExcelJS) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; s.onload = res; s.onerror = () => rej(new Error('cdn')); document.head.appendChild(s); }); }
const NAVY='FF153E5C', BLUE='FF1B6CA8', LB='FFEAF3F9', CARD='FFF5F1EE', GOLDBG='FFFFF4D6', WHITE='FFFFFFFF', GREY='FF5E5E5E';
const FONT = 'Arial';
const thin = {style:'thin', color:{argb:'FFC9C2B8'}};
const B = {top:thin, left:thin, bottom:thin, right:thin};
function mc(ws, r1, c1, r2, c2){ if(r2>r1 || c2>c1) ws.mergeCells(r1, c1, r2, c2); }
function hdr(ws, prj, title, sub, L){
  // L = {cols, titleCol, logoW, logoH, pairs:[[lab1,lab2,val1,val2], [lab1,lab2,val1,val2]|null]}
  ws.views = [{rightToLeft:true, showGridLines:false}];
  ws.properties.defaultRowHeight = 18;
  ws.addImage(ws.workbook._ahcLogo, {tl:{col:0.2, row:0.25}, ext:{width:L.logoW||205, height:L.logoH||72}});
  const tc = L.titleCol;
  mc(ws,1,tc,1,L.cols); mc(ws,2,tc,2,L.cols); mc(ws,3,tc,3,L.cols);
  ws.getCell(1,tc).value = 'تجمع الأحساء الصحي — إدارة الخدمات الفنية / قسم المشاريع'; ws.getCell(1,tc).font = {name:FONT, size:11, bold:true, color:{argb:NAVY}};
  ws.getCell(2,tc).value = title; ws.getCell(2,tc).font = {name:FONT, size:16, bold:true, color:{argb:NAVY}};
  ws.getCell(3,tc).value = sub; ws.getCell(3,tc).font = {name:FONT, size:10, color:{argb:GREY}};
  [1,2,3].forEach(r => ws.getCell(r,tc).alignment = {horizontal:'right', vertical:'middle'});
  ws.getRow(1).height = 24; ws.getRow(2).height = 28; ws.getRow(3).height = 20; ws.getRow(4).height = 10;
  const info = [['اسم المشروع', prj.name||'—'], ['رقم المشروع / المرجع', prj.ref||'—'], ['المنشأة / الموقع', prj.facility||'—'], ['نوع المشروع', prj.type||'—'], ['الجهة الطالبة', prj.dept||'—'], ['المهندس المسؤول', prj.engineer||'—'], ['التاريخ', prj.date||'—'], ['مصدر الأسعار', 'المرجع الفني الموحد لمشاريع تجمع الأحساء الصحي (استرشادي)']];
  const per = L.pairs.length; let r = 5;
  for(let i=0;i<info.length;i+=per){
    for(let k=0;k<per;k++){ const it = info[i+k]; if(!it) continue; const [l1,l2,v1,v2] = L.pairs[k];
      mc(ws,r,l1,r,l2); mc(ws,r,v1,r,v2);
      const lc = ws.getCell(r,l1); lc.value = it[0]; lc.font = {name:FONT, size:10, bold:true, color:{argb:NAVY}}; lc.fill = {type:'pattern', pattern:'solid', fgColor:{argb:CARD}}; lc.border = B; lc.alignment = {horizontal:'right', vertical:'middle'};
      const vc = ws.getCell(r,v1); vc.value = it[1]; vc.font = {name:FONT, size:10}; vc.border = B; vc.alignment = {horizontal:'right', vertical:'middle', wrapText:true};
      for(let c=l1;c<=v2;c++){ ws.getCell(r,c).border = B; }
    }
    ws.getRow(r).height = 20; r++;
  }
  ws.getRow(r).height = 8;
  return r+1; // صف رأس الجدول
}
function thead(ws, r, labels, widths){
  labels.forEach((t, i) => { const c = ws.getCell(r, i+1); c.value = t; c.font = {name:FONT, size:10, bold:true, color:{argb:WHITE}}; c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:NAVY}}; c.alignment = {horizontal:'center', vertical:'middle', wrapText:true}; c.border = B; });
  ws.getRow(r).height = 24;
  widths.forEach((w, i) => ws.getColumn(i+1).width = w);
}
function cellStyle(c, opts={}){ c.font = Object.assign({name:FONT, size:10}, opts.font||{}); c.border = B; c.alignment = Object.assign({vertical:'middle', wrapText:true, horizontal:'right'}, opts.align||{}); if(opts.fill) c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:opts.fill}}; if(opts.fmt) c.numFmt = opts.fmt; }
function pageSetup(ws, landscape, prj, titleRow){
  ws.pageSetup = {orientation: landscape?'landscape':'portrait', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0, printTitlesRow:`${titleRow}:${titleRow}`, margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.25,footer:0.25}, horizontalCentered:true};
  ws.headerFooter = {oddHeader:`&R&"Arial,Bold"&9${(prj.name||'').replace(/&/g,'&&')}`, oddFooter:`&L&8تجمع الأحساء الصحي — المرجع الفني الموحد&C&8صفحة &P / &N&R&8التاريخ: ${prj.date||''}`};
}
async function boqSheet(wb, prj, c, priced){
  const ws = wb.addWorksheet(priced ? 'جدول الكميات المسعّر' : 'جدول الكميات للطرح', {properties:{tabColor:{argb: priced?NAVY:'FF6F7F52'}}});
  const cols = 8;
  [5,12,48,36,8,10,15,17].forEach((w,i)=>ws.getColumn(i+1).width=w);
  let r = hdr(ws, prj, priced ? 'جدول الكميات التقديري (مُسعّر)' : 'جدول الكميات — نسخة الطرح (بدون أسعار)', priced ? 'الأسعار استرشادية من المرجع الفني الموحد لأغراض التقدير الأولي' : 'يُعبّأ سعر الوحدة من قبل المقاول المتقدم — بالريال السعودي شاملاً التوريد والتركيب', {cols, titleCol:4, pairs:[[1,2,3,4],[5,6,7,8]]});
  thead(ws, r, ['م','الكود','البند / الوصف','المواصفة المميِّزة','الوحدة','الكمية','سعر الوحدة (ر.س)','الإجمالي (ر.س)'], [5,12,48,36,8,10,15,17]);
  const first = r+1; let n = 0; const subRows = [];
  c.groups.forEach(g => {
    r++; ws.mergeCells(r,1,r,cols); const dc = ws.getCell(r,1); dc.value = `الشعبة ${g.div.code} — ${g.div.ar} (${g.div.en})`; cellStyle(dc, {font:{bold:true, color:{argb:NAVY}, size:11}, fill:LB}); ws.getRow(r).height = 20;
    const gStart = r+1;
    g.lines.forEach(L => { r++; n++;
      const vals = [n, L.r.v.code, `${L.r.it.ar} — ${L.r.v.ar}\n${L.r.v.en}${L.ln.loc?'\n[الموقع: '+L.ln.loc+']':''}`, L.r.v.spec||'', L.r.v.unit, L.ln.qty, priced ? (L.price||0) : null, null];
      vals.forEach((v, i) => { const cell = ws.getCell(r, i+1); if(v!==null) cell.value = v; cellStyle(cell, {align:{horizontal:[0,1,4,5].includes(i)?'center':'right'}, fmt: i===5?'#,##0.###': (i>=6?'#,##0.00':undefined)}); });
      ws.getCell(r,8).value = {formula:`F${r}*G${r}`};
      if(!priced){ ws.getCell(r,7).fill = {type:'pattern', pattern:'solid', fgColor:{argb:GOLDBG}}; ws.getCell(r,7).protection = {locked:false}; }
      else ws.getCell(r,6).protection = {locked:false};
      const lines = 2 + (L.ln.loc?1:0); ws.getRow(r).height = Math.max(30, 15*lines, 15*Math.ceil((L.r.v.spec||'').length/40));
    });
    r++; ws.mergeCells(r,1,r,7); const sc = ws.getCell(r,1); sc.value = `مجموع الشعبة ${g.div.code} — ${g.div.ar}`; cellStyle(sc, {font:{bold:true, color:{argb:NAVY}}, fill:CARD});
    const st = ws.getCell(r,8); st.value = {formula:`SUM(H${gStart}:H${r-1})`}; cellStyle(st, {font:{bold:true, color:{argb:NAVY}}, fill:CARD, fmt:'#,##0.00'}); subRows.push(r);
  });
  // الإجماليات
  const sumF = subRows.map(x=>`H${x}`).join(',');
  r += 2;
  const tot = [['المجموع قبل الاحتياطي', {formula:`SUM(${sumF})`}], [`الاحتياطي (${prj.contingency||0}%)`, {formula:`H${r}*${(prj.contingency||0)/100}`}], ['المجموع الخاضع للضريبة', {formula:`H${r}+H${r+1}`}], [`ضريبة القيمة المضافة (${prj.vat||0}%)`, {formula:`H${r+2}*${(prj.vat||0)/100}`}], ['الإجمالي العام (ر.س)', {formula:`H${r+2}+H${r+3}`}]];
  tot.forEach(([lab, f], i) => { const rr = r+i; ws.mergeCells(rr,5,rr,7); const lc = ws.getCell(rr,5); lc.value = lab; cellStyle(lc, {font:{bold:true, color:{argb: i===4?WHITE:NAVY}}, fill: i===4?NAVY:CARD}); const vc = ws.getCell(rr,8); vc.value = f; cellStyle(vc, {font:{bold:true, color:{argb: i===4?WHITE:NAVY}, size: i===4?12:10}, fill: i===4?NAVY:CARD, fmt:'#,##0.00'}); ws.getRow(rr).height = i===4?24:19; });
  r += tot.length + 1;
  ws.mergeCells(r,1,r,cols); const note = ws.getCell(r,1); note.value = priced ? 'ملاحظة: الأسعار استرشادية مأخوذة من المرجع الفني الموحد لمشاريع تجمع الأحساء الصحي (توريد وتركيب) وتُحدَّث دورياً؛ السعر التعاقدي يُحدد بنتيجة الطرح. الكميات تقديرية وتُصفّى بالقياس الفعلي.' : 'تعليمات للمتقدم: تُعبّأ خانة «سعر الوحدة» فقط (الخلايا المظللة)؛ الإجماليات تُحسب تلقائياً. الأسعار بالريال السعودي شاملة التوريد والتركيب والاختبار وجميع الملحقات وفق المواصفات الفنية المرفقة، غير شاملة ضريبة القيمة المضافة إلا حيث ذُكر.'; cellStyle(note, {font:{size:9, italic:true, color:{argb:GREY}}}); ws.getRow(r).height = 44;
  // توقيعات
  r += 2; const sig = ['إعداد: مهندس المشروع', 'مراجعة: رئيس قسم المشاريع', 'اعتماد: مدير إدارة الخدمات الفنية'];
  sig.forEach((t, i) => { const c1 = 1 + i*3; mc(ws, r, c1, r, Math.min(c1+1, cols)); const cell = ws.getCell(r, c1); cell.value = t + '\n\nالاسم: ................................\nالتوقيع: ..............................'; cellStyle(cell, {font:{size:9}, align:{vertical:'top'}}); }); ws.getRow(r).height = 62;
  pageSetup(ws, true, prj, first-1);
  await ws.protect('', {selectLockedCells:true, selectUnlockedCells:true, formatColumns:true, formatRows:true});
  return ws;
}
function specSheet(wb, prj, c){
  const ws = wb.addWorksheet('المواصفات الفنية', {properties:{tabColor:{argb:BLUE}}});
  const cols = 3;
  ws.getColumn(1).width = 5; ws.getColumn(2).width = 26; ws.getColumn(3).width = 118;
  let r = hdr(ws, prj, 'المواصفات الفنية وطريقة التنفيذ للبنود', 'مستخرجة من المرجع الفني الموحد لمشاريع تجمع الأحساء الصحي — جزء لا يتجزأ من جدول الكميات', {cols, titleCol:3, logoW:190, logoH:67, pairs:[[1,2,3,3]]});
  const specStart = r;
  const seen = new Set(); let n = 0;
  const secs = [['نطاق البند', it => [it.scope||'—']], ['المتطلبات الفنية', it => it.specs], ['متطلبات المنشآت الصحية ومكافحة العدوى', it => it.health], ['معايير القبول والاختبار', it => it.accept], ['طريقة التنفيذ (Method Statement)', it => it.method], ['المراجع والمعايير', it => it.refs]];
  c.groups.forEach(g => {
    r++; ws.mergeCells(r,1,r,cols); const dc = ws.getCell(r,1); dc.value = `الشعبة ${g.div.code} — ${g.div.ar}`; cellStyle(dc, {font:{bold:true, size:12, color:{argb:WHITE}}, fill:NAVY}); ws.getRow(r).height = 22;
    g.lines.forEach(L => { const it = L.r.it; if(seen.has(it.code)) { return; } seen.add(it.code); n++;
      r++; ws.mergeCells(r,1,r,cols); const tc = ws.getCell(r,1); tc.value = `${n}. [${it.code}] ${it.ar} — ${it.en}`; cellStyle(tc, {font:{bold:true, size:11, color:{argb:NAVY}}, fill:LB}); ws.getRow(r).height = 20;
      // الخيارات المستخدمة في هذا المشروع
      const used = c.groups.flatMap(gg=>gg.lines).filter(x=>x.r.it.code===it.code).map(x=>`${x.r.v.code} — ${x.r.v.ar}${x.r.v.spec?': '+x.r.v.spec:''} (${x.r.v.unit})`);
      const blocks = [['الخيارات المحددة في المشروع', used], ...secs.map(([t,f]) => [t, f(it)])];
      blocks.forEach(([title, arr]) => { if(!arr||!arr.length) return; r++; mc(ws,r,1,r,2); const lc = ws.getCell(r,1); lc.value = title; cellStyle(lc, {font:{bold:true, color:{argb:NAVY}}, fill:CARD, align:{vertical:'top'}}); ws.getCell(r,2).border = B; const vc = ws.getCell(r,3); const txt = arr.length===1 ? arr[0] : arr.map((x,i)=>`${i+1}. ${x}`).join('\n'); vc.value = txt; cellStyle(vc, {align:{vertical:'top'}}); const lines = arr.reduce((a,x)=>a+Math.ceil((x.length+4)/125),0); ws.getRow(r).height = Math.min(409, Math.max(18, 14.5*lines + 2)); });
      if(it.status!=='full'){ r++; ws.mergeCells(r,1,r,cols); const nc = ws.getCell(r,1); nc.value = 'ملاحظة: المواصفة التفصيلية لهذا البند قيد الاستكمال في المرجع؛ يُعتمد النطاق ومواصفة الخيار المحدد والمواصفات العامة للشعبة.'; cellStyle(nc, {font:{size:9, italic:true, color:{argb:GREY}}}); }
      r++; ws.getRow(r).height = 6;
    });
  });
  pageSetup(ws, false, prj, specStart);
  return ws;
}
export async function exportExcel(prj, c, LOGO_B64){
  if(!c.groups.length){ toast('لا توجد بنود للتصدير'); return; }
  toast('جارٍ إنشاء ملف Excel…');
  try { await loadExcelJS(); } catch(e){ toast('تعذّر تحميل مكتبة Excel — تحقق من الاتصال بالإنترنت'); return; }
  const wb = new ExcelJS.Workbook(); wb.creator = 'تجمع الأحساء الصحي — المرجع الفني الموحد'; wb.created = new Date();
  wb._ahcLogo = wb.addImage({base64: LOGO_B64, extension:'png'});
  await boqSheet(wb, prj, c, true); await boqSheet(wb, prj, c, false); specSheet(wb, prj, c);
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), `جدول الكميات - ${prj.name||'مشروع'} - ${prj.date||today()}.xlsx`);
  toast('تم تصدير ملف Excel');
}
