// ===== رسومات تعليمات العمل: أيقونات خطوات بطاقة العامل (48×48 خطية) + مخططات توضيحية لبعض التعليمات =====
const P = {
  gloves: '<path d="M14 40V22c0-2 3-2 3 0v-9c0-2 3-2 3 0v7-10c0-2 3-2 3 0v10-8c0-2 3-2 3 0v10-6c0-2 3-2 3 0v14c0 6-3 10-8 10h-3c-3 0-4-2-4-4z"/><path d="M14 40h15"/>',
  gloves_red: '<path d="M14 40V22c0-2 3-2 3 0v-9c0-2 3-2 3 0v7-10c0-2 3-2 3 0v10-8c0-2 3-2 3 0v10-6c0-2 3-2 3 0v14c0 6-3 10-8 10h-3c-3 0-4-2-4-4z" fill="#F4C7C3"/><path d="M14 40h15"/>',
  goggles: '<path d="M6 22c0-4 4-6 8-6h20c4 0 8 2 8 6v4c0 4-3 6-7 6-3 0-5-2-6-4h-2c-1 2-3 4-6 4-4 0-7-2-7-6z"/><path d="M6 22H3M42 22h3"/>',
  mask: '<path d="M10 18c8-4 20-4 28 0v8c0 7-6 12-14 12S10 33 10 26z"/><path d="M10 20 4 16M38 20l6-4M16 24h16M16 29h16"/>',
  boots: '<path d="M14 8h10v20l12 4c3 1 4 3 4 6v2H10V12c0-2 2-4 4-4z"/><path d="M10 34h30M24 14H14"/>',
  gown: '<path d="M18 8h12l8 6-4 6-3-2v22H17V18l-3 2-4-6z"/><path d="M21 8c0 3 1 5 3 5s3-2 3-5"/>',
  harness: '<circle cx="24" cy="9" r="4"/><path d="M24 13v14M16 18l8 4 8-4M18 40l6-13 6 13M14 24h20"/>',
  ear: '<path d="M14 26a10 10 0 0 1 20 0"/><rect x="8" y="24" width="8" height="12" rx="3"/><rect x="32" y="24" width="8" height="12" rx="3"/>',
  ladder: '<path d="M16 6l-6 36M32 6l6 36M15 12h18M14 20h20M13 28h22M12 36h24"/>',
  wetsign: '<path d="M14 40 24 6l10 34"/><path d="M11 40h26"/><circle cx="24" cy="18" r="2.4"/><path d="M21 24l-2 7m4-6v7m3-7 2 6"/>',
  sign: '<path d="M14 40 24 6l10 34"/><path d="M11 40h26M24 15v11"/><circle cx="24" cy="31" r="1.6" fill="currentColor"/>',
  broom: '<path d="M30 6 22 26"/><path d="M16 24l12 4-4 14-4-1-3 1-3-2-3 1 1-4z"/>',
  mop: '<path d="M28 4 22 30"/><path d="M14 30h16l2 10H12z"/><path d="M16 34v6m4-6v6m4-6v6m4-6v6"/>',
  bucket: '<path d="M10 16h28l-4 24H14z"/><path d="M12 16c0-6 5-10 12-10s12 4 12 10"/><path d="M14 24h20"/>',
  dilute: '<path d="M18 6h12v4l4 6v20c0 3-2 5-5 5H19c-3 0-5-2-5-5V16l4-6z"/><path d="M14 26h20M18 6h12"/><path d="M38 14v10M35 20l3 4 3-4"/>',
  drop: '<path d="M24 6c6 9 12 15 12 22a12 12 0 0 1-24 0c0-7 6-13 12-22z"/>',
  spray: '<path d="M14 18h12v22H14z"/><path d="M16 18v-6h8v6M24 12h6l3 3"/><path d="M36 10l4-2m-4 6h5m-5 4 4 2"/>',
  clock: '<circle cx="24" cy="24" r="17"/><path d="M24 13v11l7 5"/>',
  clipboard: '<rect x="11" y="9" width="26" height="33" rx="3"/><path d="M18 6h12v6H18zM17 22l3 3 6-6M17 32h14"/>',
  fan: '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="3"/><path d="M24 21c-2-7 2-11 6-10-1 5-3 8-6 10zm3 4c7 1 9 6 7 9-4-3-6-6-7-9zm-5 1c-4 6-9 6-11 3 4-2 7-3 11-3z"/>',
  bin: '<path d="M12 14h24l-3 28H15z"/><path d="M8 14h32M19 14V9h10v5M20 21v15m8-15v15"/>',
  bag: '<path d="M14 18h20l3 22H11z"/><path d="M19 18c0-5 2-9 5-9s5 4 5 9M18 12l-3-4m15 4 3-4"/>',
  mirror: '<rect x="12" y="6" width="24" height="30" rx="12"/><path d="M20 14l-4 6m10-6-8 12M24 36v6M18 42h12"/>',
  hand: '<path d="M16 26V12c0-2 3-2 3 0v10-13c0-2 3-2 3 0v13-11c0-2 3-2 3 0v11-8c0-2 3-2 3 0v16c0 8-4 12-10 12-4 0-7-3-9-7l-3-7c-1-2 2-4 4-2l3 4"/>',
  sink: '<path d="M6 24h36c0 9-7 14-18 14S6 33 6 24z"/><path d="M24 24V12c0-3 3-4 6-4M30 8v4M24 38v4"/>',
  toilet: '<path d="M12 6h14v14H12z"/><path d="M10 22h28c0 7-5 11-12 11h-4l2 9H14l1-9c-3-2-5-5-5-11z"/>',
  refill: '<path d="M18 14h12v28H18z"/><path d="M20 14V8h8v6M24 8V4h6"/><path d="M34 22a8 8 0 0 1 0 12m4-16a14 14 0 0 1 0 20"/>',
  wrench: '<path d="M30 6a9 9 0 0 0-8 12L8 32a4 4 0 0 0 6 6l14-14a9 9 0 0 0 12-8l-5 3-5-1-1-5z"/>',
  lock: '<rect x="11" y="22" width="26" height="20" rx="3"/><path d="M16 22v-6a8 8 0 0 1 16 0v6M24 30v5"/>',
  shelf: '<path d="M8 6v36M40 6v36M8 18h32M8 30h32M8 42h32"/><rect x="12" y="8" width="6" height="10"/><rect x="22" y="11" width="6" height="7"/><rect x="13" y="22" width="9" height="8"/>',
  label: '<path d="M6 20 20 6h18v18L24 38z"/><circle cx="32" cy="12" r="2.4"/><path d="M16 22l8 8"/>',
  colors: '<rect x="6" y="10" width="16" height="12" rx="2" fill="#D9473B" stroke="none"/><rect x="26" y="10" width="16" height="12" rx="2" fill="#2F6FD6" stroke="none"/><rect x="6" y="26" width="16" height="12" rx="2" fill="#E8B923" stroke="none"/><rect x="26" y="26" width="16" height="12" rx="2" fill="#2E8B57" stroke="none"/>',
  red: '<rect x="8" y="8" width="32" height="32" rx="6" fill="#D9473B" stroke="none"/><path d="M18 30h12l1 6H17z M22 14l-2 16" stroke="#fff"/>',
  blue: '<rect x="8" y="8" width="32" height="32" rx="6" fill="#2F6FD6" stroke="none"/><path d="M18 30h12l1 6H17z M22 14l-2 16" stroke="#fff"/>',
  yellow: '<rect x="8" y="8" width="32" height="32" rx="6" fill="#E8B923" stroke="none"/><path d="M18 30h12l1 6H17z M22 14l-2 16" stroke="#fff"/>',
  green: '<rect x="8" y="8" width="32" height="32" rx="6" fill="#2E8B57" stroke="none"/><path d="M18 30h12l1 6H17z M22 14l-2 16" stroke="#fff"/>',
  cart: '<path d="M6 10h6l4 22h20l4-14H14"/><circle cx="18" cy="38" r="3"/><circle cx="34" cy="38" r="3"/>',
  handwash: '<path d="M10 30c4-4 8-6 14-6s10 2 14 6l-4 6H14z"/><path d="M24 6v8M20 10c0-2 2-4 4-4"/><path d="M18 18l-2 3m8-4v4m6-3 2 3"/>',
  cloth: '<path d="M8 14c6-4 10 4 16 0s10 4 16 0v20c-6 4-10-4-16 0s-10-4-16 0z"/>',
  bed: '<path d="M6 34V16M6 26h36v8M42 34v-6"/><rect x="10" y="19" width="10" height="7" rx="2"/><path d="M22 20h18v6"/>',
  phone: '<path d="M14 6h8l3 9-5 3a20 20 0 0 0 10 10l3-5 9 3v8c0 2-2 4-4 4C21 38 10 27 10 10c0-2 2-4 4-4z"/>',
  check: '<circle cx="24" cy="24" r="17"/><path d="M15 24l6 6 12-12"/>',
  absorb: '<path d="M8 34c6-6 26-6 32 0"/><path d="M12 24h24M16 16h16"/><circle cx="18" cy="30" r="1.5" fill="currentColor"/><circle cx="26" cy="29" r="1.5" fill="currentColor"/><circle cx="32" cy="31" r="1.5" fill="currentColor"/>',
  scoop: '<path d="M6 30h22l-4 8H10z"/><path d="M28 30 40 10"/><path d="M14 24l3-3 3 3"/>',
  power: '<path d="M18 6v8M30 6v8M14 14h20v8a10 10 0 0 1-20 0z"/><path d="M24 32v10"/><rect x="30" y="26" width="12" height="10" rx="2"/><path d="M33 26v-3a3 3 0 0 1 6 0v3"/>',
  squeegee: '<path d="M8 14h32M24 14v26"/><path d="M8 14v4h32v-4"/>',
  sharps: '<path d="M12 16h24v26H12z"/><path d="M14 16l2-6h16l2 6M18 24l10 10M28 24l-2 2"/><path d="M12 22h24" stroke-dasharray="2 2"/>',
  filter: '<rect x="8" y="10" width="32" height="28" rx="2"/><path d="M8 17h32M8 24h32M8 31h32M15 10v28M24 10v28M33 10v28"/>',
  coil: '<path d="M8 12v24M40 12v24M8 14h32M8 20h32M8 26h32M8 32h32"/><path d="M14 8c0 2-2 2-2 4m10-4c0 2-2 2-2 4m10-4c0 2-2 2-2 4" />',
  outdoor: '<rect x="6" y="10" width="36" height="26" rx="2"/><circle cx="20" cy="23" r="9"/><path d="M20 14v18M11 23h18M34 16v14M38 16v14M10 36v4M38 36v4"/>',
  bolt: '<path d="M27 4 12 27h11l-3 17 16-24H25z"/>',
  thermo: '<path d="M20 28V10a4 4 0 0 1 8 0v18a8 8 0 1 1-8 0z"/><circle cx="24" cy="34" r="3" fill="currentColor"/><path d="M24 31V16M32 12h6M32 18h4M32 24h6"/>',
  camera: '<rect x="6" y="14" width="36" height="24" rx="4"/><circle cx="24" cy="26" r="7"/><path d="M17 14l3-5h8l3 5"/>',
  belt: '<circle cx="14" cy="24" r="7"/><circle cx="36" cy="24" r="4"/><path d="M14 17l22 3M14 31l22-3"/>',
  duct: '<path d="M6 16h24l10 10v14H30V26H6z"/><path d="M12 16v10M18 16v10M24 16v10"/>',
  screen: '<rect x="6" y="8" width="36" height="24" rx="2"/><path d="M18 40h12M24 32v8M12 16h10M12 22h16"/><path d="M33 15l3 3-3 3"/>',
  gauge: '<path d="M8 32a16 16 0 1 1 32 0"/><path d="M24 32l8-10"/><circle cx="24" cy="32" r="2.4" fill="currentColor"/><path d="M12 32h3M33 32h3M24 16v3"/><path d="M30 18a14 14 0 0 1 6 8" stroke="#2E8B57" stroke-width="3.4"/>',
  valve: '<path d="M6 24h10M32 24h10M16 16l16 16M16 32l16-16M16 16v16M32 16v16"/><path d="M24 24V10M18 10h12"/>',
  alarm: '<path d="M14 32V22a10 10 0 0 1 20 0v10l3 4H11z"/><path d="M20 40a4 4 0 0 0 8 0M8 14l4 3m28-3-4 3M24 6v3"/>',
  swap: '<path d="M10 16h26l-5-5M38 32H12l5 5"/>',
  fuel: '<path d="M10 42V10c0-2 2-4 4-4h12c2 0 4 2 4 4v32M6 42h28M14 14h12v8H14z"/><path d="M30 18h4l4 6v12a3 3 0 0 1-6 0v-6h-2"/>',
  switch: '<rect x="10" y="6" width="28" height="36" rx="3"/><path d="M18 28l12-8M18 16h4M26 34h4"/><circle cx="18" cy="28" r="2.4" fill="currentColor"/>',
  generator: '<rect x="6" y="14" width="36" height="22" rx="2"/><path d="M10 36v4M38 36v4M24 18l-4 8h6l-4 8"/><path d="M32 20h6M32 26h6"/>',
  auto: '<rect x="8" y="12" width="32" height="24" rx="12"/><circle cx="28" cy="24" r="8" fill="currentColor"/><path d="M13 27l3-7 3 7M14 25h4" stroke-width="2"/>',
  permit: '<rect x="11" y="6" width="26" height="36" rx="2"/><path d="M17 14h14M17 20h14M17 26h8"/><circle cx="30" cy="34" r="4"/><path d="M28 34l1.5 1.5L32 33"/>',
  tank: '<rect x="8" y="12" width="32" height="28" rx="4"/><path d="M8 18h32M16 12V8h16v4M14 28c4-2 6 2 10 0s6 2 10 0"/>',
  sample: '<path d="M20 6h8M22 6v24a2 2 0 0 0 4 0V6"/><path d="M14 30h20l-2 12H16z"/><path d="M22 20h4"/>',
  extinguisher: '<path d="M18 16h12v24a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z"/><path d="M20 16v-4h8v4M24 12V8h8l4 4M32 8l6-2"/><path d="M18 24h12" />',
  pin: '<circle cx="20" cy="24" r="10"/><path d="M30 24h12M38 20v8"/><path d="M14 24h12"/>',
  hose: '<path d="M10 10c10 0 14 6 14 14s4 14 14 14"/><path d="M34 34l6 6M36 32l4-2"/>',
  tag: '<path d="M10 8h20l8 8v24H10z"/><circle cx="24" cy="15" r="2.4"/><path d="M16 26l4 4 10-10M16 36h16"/>',
  exit: '<rect x="6" y="10" width="36" height="28" rx="2"/><circle cx="20" cy="17" r="2.4"/><path d="M20 20l-3 7 4 2-2 6M20 22l5 3 3-2M17 27l-4 2"/><path d="M30 24h8m-3-3 3 3-3 3"/>',
  bulb: '<path d="M16 22a8 8 0 1 1 16 0c0 4-3 6-3 10H19c0-4-3-6-3-10z"/><path d="M19 36h10M21 40h6M24 4v3M10 10l2 2m26-2-2 2M6 22h3m30 0h3"/>',
  battery: '<rect x="6" y="14" width="32" height="20" rx="3"/><path d="M38 20h4v8h-4M12 20v8M18 20v8"/>',
  polish: '<path d="M18 16h12v24H18z"/><path d="M20 16v-6h8v6M30 8l4-2M32 12h4"/>',
  blade: '<path d="M8 30 30 8l10 10-22 22z"/><path d="M16 34l-6-6"/>',
  chair: '<path d="M14 6v20h20M14 26l-2 14M34 26l2 14M14 18h18"/><path d="M38 40h6" />',
  mixbottles: '<path d="M8 16h10v24H8zM10 16v-4h6v4M30 16h10v24H30zM32 16v-4h6v4"/><path d="M20 26h8m-3-3 3 3-3 3"/>',
  sprayplug: '<path d="M8 18h10v20H8zM10 18v-5h6v5M16 13h5"/><rect x="28" y="16" width="14" height="18" rx="3"/><circle cx="33" cy="25" r="1.5" fill="currentColor"/><circle cx="37" cy="25" r="1.5" fill="currentColor"/>',
  cup: '<path d="M12 14h20l-3 26H15z"/><path d="M32 18h4a4 4 0 0 1 0 8h-5M18 8c0-2 2-2 2-4m4 4c0-2 2-2 2-4"/>',
  wetmop: '<path d="M28 4 22 30"/><path d="M14 30h16l2 10H12z"/><path d="M38 12c2 3 4 5 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z"/>',
  door: '<path d="M12 42V6h20v36M8 42h32"/><circle cx="27" cy="24" r="1.6" fill="currentColor"/>',
  glass: '<path d="M10 34 18 14l6 8 6-12 8 24z"/><path d="M14 40h20"/>',
  sticker: '<path d="M8 8h32v20L28 40H8z"/><path d="M28 40V28h12"/>',
  elevator: '<rect x="10" y="6" width="28" height="36" rx="2"/><path d="M24 6v36M16 16l3-3 3 3M26 13l3 3 3-3"/>',
  foot: '<path d="M14 40c-4 0-6-4-4-8l4-10c1-3 6-3 7 0l3 6 10 4c4 2 2 8-2 8z"/><rect x="26" y="8" width="14" height="12" rx="2"/>',
  bags: '<path d="M6 20h14l2 20H4zM26 20h14l2 20H24z"/><path d="M10 20c0-4 1-6 3-6s3 2 3 6M30 20c0-4 1-6 3-6s3 2 3 6"/>',
  gascyl: '<path d="M16 14h16v26a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z"/><path d="M20 14v-4h8v4M22 10V6h4"/><path d="M16 24h16"/>',
  dropbolt: '<path d="M16 6c5 7 10 12 10 18a10 10 0 0 1-20 0c0-6 5-11 10-18z"/><path d="M36 12 30 26h6l-3 12"/>',
  handswitch: '<rect x="20" y="6" width="20" height="26" rx="2"/><path d="M30 12v8"/><path d="M10 40l4-12c1-2 4-2 5 0l2 4 6-2"/>',
  flame: '<path d="M24 4c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 6 4 6 0-6 0-12 2-18z"/>',
  box: '<path d="M8 16 24 8l16 8v18l-16 8-16-8z"/><path d="M8 16l16 8 16-8M24 24v18"/>',
};
const NO = { nowax: 'polish', nohose: 'hose', noscrape: 'blade', nodrag: 'chair', nomix: 'mixbottles', nospray: 'sprayplug', nofood: 'cup', nowet: 'wetmop', nocloth: 'cloth', noentry: 'door', noglass: 'glass', nomop: 'mop', nosticker: 'sticker', noelevator: 'elevator', nopress: 'foot', nomix_bag: 'bags', nocolor: 'colors', nofilter: 'filter', nogas: 'gascyl', nowater_elec: 'dropbolt', nodrop: 'drop', noalarm: 'alarm', nomanual: 'handswitch', nofire: 'flame', noblock: 'box', nocover: 'exit' };
const svg = (inner, extra = '') => `<svg viewBox="0 0 48 48" class="wpic" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}${extra}</svg>`;
export const pic = k => NO[k] ? svg(P[NO[k]] || '', '<circle cx="24" cy="24" r="21" stroke="#C8453A" stroke-width="3.4"/><path d="M9 9l30 30" stroke="#C8453A" stroke-width="3.4"/>') : svg(P[k] || P.check);
export const isNo = k => !!NO[k];

// ---------- مخططات توضيحية لبعض التعليمات (أرقامها تطابق الخطوات)
const T = (x, y, s, o = '') => `<text x="${x}" y="${y}" ${o}>${s}</text>`;
const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="11" fill="#123B5C"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="800">${n}</text>`;
export const ART = {
  // المكيف الجداري: الوحدة الداخلية والخارجية بأرقام خطوات WI-M01
  'WI-M01': () => `<svg viewBox="0 0 760 300" class="wart" font-family="Tajawal, sans-serif" font-size="14">
    <rect x="30" y="40" width="380" height="120" rx="18" fill="#F2F6F9" stroke="#123B5C" stroke-width="2.5"/>
    <rect x="50" y="56" width="340" height="34" rx="4" fill="#fff" stroke="#6B7A88"/>${Array.from({ length: 16 }, (_, i) => `<path d="M${62 + i * 20} 58v30" stroke="#B9C6D2"/>`).join('')}
    <rect x="50" y="96" width="340" height="22" rx="4" fill="#E6F4FB" stroke="#27A8DF"/>${Array.from({ length: 34 }, (_, i) => `<path d="M${54 + i * 10} 98v18" stroke="#27A8DF" stroke-width="1"/>`).join('')}
    <ellipse cx="220" cy="134" rx="150" ry="10" fill="none" stroke="#6B7A88" stroke-dasharray="6 4"/>
    <path d="M60 160h320l-12 18H72z" fill="#D8E2EA" stroke="#6B7A88"/><path d="M380 170 q30 10 30 50" stroke="#27A8DF" stroke-width="3" fill="none"/>
    ${num(60, 40, 3)}${T(78, 30, 'الفلتر', 'fill="#123B5C" font-weight="700"')}${num(400, 107, 4)}${T(390, 30, 'الملف الداخلي (المبخر) ← 4', 'fill="#123B5C" font-weight="700" text-anchor="end"')}
    ${num(220, 150, 5)}${T(240, 196, 'المروحة الأسطوانية', 'fill="#123B5C" font-weight="700"')}${num(412, 222, 6)}${T(300, 250, 'حوض وخط التصريف', 'fill="#123B5C" font-weight="700"')}
    <g transform="translate(28,0)"><rect x="520" y="60" width="210" height="160" rx="8" fill="#F2F6F9" stroke="#123B5C" stroke-width="2.5"/><circle cx="600" cy="140" r="56" fill="#fff" stroke="#6B7A88" stroke-width="2"/>
    <path d="M600 90v100M550 140h100M565 105l70 70M635 105l-70 70" stroke="#B9C6D2"/><circle cx="600" cy="140" r="8" fill="#6B7A88"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${672 + i * 6} 70v140" stroke="#27A8DF" stroke-width="1.2"/>`).join('')}
    <path d="M540 220v20M710 220v20" stroke="#123B5C" stroke-width="3"/>${num(720, 60, 7)}${T(730, 268, 'الوحدة الخارجية: المكثف والمروحة', 'fill="#123B5C" font-weight="700" text-anchor="end"')}${num(530, 220, 8)}</g>
    ${T(740, 292, 'الأرقام تطابق رقم الخطوة في الجدول. الكهرباء معزولة قبل أي فتح (الخطوة 2).', 'fill="#6B7A88" font-size="12" direction="rtl"')}</svg>`,
  // تسلسل تنظيف دورة المياه
  'WI-C02': () => { const st = [['لافتة وتهوية', 'sign'], ['النفايات', 'bin'], ['المرايا والأسطح العالية', 'mirror'], ['نقاط اللمس', 'hand'], ['الأحواض', 'sink'], ['المرحاض آخراً', 'toilet'], ['الأرضية نحو الباب', 'mop']];
    return `<div class="wflow">${st.map(([t, k], i) => `<div class="${k === 'toilet' ? 'last' : ''}"><i>${i + 1}</i>${pic(k)}<b>${t}</b></div>`).join('<span class="wfa">←</span>')}</div><p class="mn-note">القاعدة: من الأعلى إلى الأسفل، ومن الأنظف إلى الأكثر اتساخاً، والأرضية آخراً باتجاه الباب.</p>`; },
  // نظام الألوان
  'WI-C09': () => `<div class="wcolors">${[['#D9473B', 'الأحمر', 'دورات المياه والمراحيض', 'toilet'], ['#2F6FD6', 'الأزرق', 'المكاتب والممرات والانتظار', 'chair'], ['#E8B923', 'الأصفر', 'العزل والمناطق السريرية', 'bed'], ['#2E8B57', 'الأخضر', 'المطابخ والطعام', 'cup']].map(([c, n, d, k]) => `<div style="--c:${c}"><span>${pic(k)}</span><b>${n}</b><small>${d}</small></div>`).join('')}</div>`,
  // تخطيط غرفة الجانيتور
  'WI-C03': () => `<svg viewBox="0 0 760 260" class="wart" font-family="Tajawal, sans-serif" font-size="14">
    <rect x="20" y="20" width="720" height="220" fill="#F7FAFC" stroke="#123B5C" stroke-width="3"/><path d="M600 240v-6M680 240v-6" stroke="#fff" stroke-width="8"/><path d="M600 240a80 80 0 0 1 80-80" stroke="#6B7A88" stroke-dasharray="5 4" fill="none"/>
    <rect x="30" y="30" width="60" height="200" fill="#E6EEF5" stroke="#6B7A88"/>${[60, 110, 160].map(y => `<path d="M30 ${y + 10}h60" stroke="#6B7A88"/>`).join('')}${T(32, 252, 'رفوف المواد بحسب التوافق', 'fill="#123B5C" font-weight="700" font-size="12"')}
    <rect x="130" y="30" width="110" height="60" rx="6" fill="#fff" stroke="#27A8DF" stroke-width="2"/>${T(146, 66, 'محطة التخفيف', 'fill="#123B5C" font-weight="700"')}
    <rect x="270" y="30" width="120" height="70" rx="6" fill="#E6F4FB" stroke="#27A8DF" stroke-width="2"/><ellipse cx="330" cy="65" rx="40" ry="20" fill="#fff" stroke="#27A8DF"/>${T(282, 118, 'حوض الجانيتور', 'fill="#123B5C" font-weight="700"')}
    <path d="M420 34h200" stroke="#6B7A88" stroke-width="4"/>${['#D9473B', '#2F6FD6', '#E8B923', '#2E8B57'].map((c, i) => `<path d="M${440 + i * 48} 36v70" stroke="${c}" stroke-width="5"/><rect x="${428 + i * 48}" y="106" width="24" height="16" rx="3" fill="${c}"/>`).join('')}${T(440, 146, 'ممسحات معلقة لتجف، كل لون منفصل', 'fill="#123B5C" font-weight="700"')}
    <rect x="140" y="160" width="130" height="60" rx="8" fill="#fff" stroke="#6B7A88"/><circle cx="160" cy="222" r="8" fill="#6B7A88"/><circle cx="250" cy="222" r="8" fill="#6B7A88"/>${T(158, 196, 'عربة التنظيف', 'fill="#123B5C" font-weight="700"')}
    <rect x="300" y="170" width="150" height="50" rx="6" fill="#FFF3DF" stroke="#C77A00"/>${T(312, 200, 'بطاقات بيانات السلامة', 'fill="#7A4A00" font-weight="700"')}
    ${T(470, 226, 'الباب مقفل دائماً', 'fill="#C8453A" font-weight="800"')}</svg>`,
  // نقاط فحص الطفاية
  'WI-S01': () => `<svg viewBox="0 0 760 280" class="wart" font-family="Tajawal, sans-serif" font-size="14">
    <rect x="330" y="80" width="90" height="180" rx="16" fill="#E8564A" stroke="#7A2E22" stroke-width="2.5"/><rect x="345" y="56" width="60" height="28" rx="6" fill="#4A4A4A"/><path d="M405 66h50l20 14" stroke="#4A4A4A" stroke-width="6" fill="none"/>
    <path d="M340 110 q-60 40 -40 150" stroke="#222" stroke-width="7" fill="none"/><circle cx="375" cy="48" r="16" fill="#fff" stroke="#4A4A4A" stroke-width="3"/><path d="M365 54a12 12 0 0 1 20-10" stroke="#2E8B57" stroke-width="4" fill="none"/><path d="M375 48l6-7" stroke="#C8453A" stroke-width="2.5"/>
    <path d="M410 70h22" stroke="#E8B923" stroke-width="4"/><rect x="345" y="140" width="60" height="50" rx="4" fill="#fff" stroke="#7A2E22"/>
    ${num(310, 40, 3)}${T(120, 46, 'المؤشر في المنطقة الخضراء', 'fill="#123B5C" font-weight="700"')}${num(450, 60, 4)}${T(468, 64, 'المسمار والختم سليمان', 'fill="#123B5C" font-weight="700"')}
    ${num(285, 230, 5)}${T(90, 236, 'الخرطوم والفوهة بلا تلف', 'fill="#123B5C" font-weight="700"')}${num(430, 165, 6)}${T(448, 170, 'بطاقة الفحص موقعة ومؤرخة', 'fill="#123B5C" font-weight="700"')}
    ${num(450, 250, 1)}${T(468, 255, 'في مكانها، ظاهرة، ولا شيء أمامها', 'fill="#123B5C" font-weight="700"')}</svg>`,
  // الخط الزمني لاختبار المولد
  'WI-M06': () => `<svg viewBox="0 0 760 200" class="wart" font-family="Tajawal, sans-serif" font-size="14">
    <path d="M40 100h680" stroke="#123B5C" stroke-width="3"/><path d="M700 92l20 8-20 8" fill="#123B5C"/>
    ${[[95, 'الفحص قبل التشغيل', 'الوقود، الزيت، البطارية'], [215, 'محاكاة الانقطاع', 'من مفتاح التحويل'], [330, 'الإقلاع ونقل الحمل', 'خلال ثوانٍ'], [500, '30 دقيقة تحت الحمل', '30٪ من القدرة على الأقل'], [650, 'العودة والتبريد', 'المفتاح على «آلي»']].map(([x, a, b], i) => `<circle cx="${x}" cy="100" r="14" fill="${i === 3 ? '#27A8DF' : '#123B5C'}"/><text x="${x}" y="105" text-anchor="middle" fill="#fff" font-weight="800">${i + 1}</text><text direction="rtl" x="${x}" y="${i % 2 ? 150 : 62}" text-anchor="middle" fill="#123B5C" font-weight="800">${a}</text><text direction="rtl" x="${x}" y="${i % 2 ? 172 : 40}" text-anchor="middle" fill="#6B7A88" font-size="12">${b}</text>`).join('')}
    <rect x="340" y="92" width="300" height="16" rx="8" fill="#27A8DF" opacity=".25"/></svg>`,
};
