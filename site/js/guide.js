// ===== دليل المواصفات المعتمدة للمتبرعين والمقاولين: يُصدَّر PDF من جدول كميات المشروع باسمه (بطاقات البنود الموجودة فيه فقط) + إدارة البطاقات =====
import { sb, q } from './api.js';
import { $, $$, esc, toast, err, modal, confirm, field, inp, formData, dateAr } from './ui.js';

const BADGE = {
  HD: ['Heavy Duty', 'استخدام شاق'], HT: ['High Traffic', 'حركة كثيفة'], DIS: ['Disinfectant‑Resistant', 'يتحمّل المطهرات'], HYG: ['Hygienic', 'سطح صحي غير مسامي'],
  FIRE: ['Fire‑Rated', 'مقاوم للحريق'], G1: ['ANSI/BHMA Grade 1', 'أعلى درجة'], 247: ['24/7', 'تشغيل متواصل'], UNI: ['Standardized', 'موحّد مع منظومة التجمع'],
  ADA: ['Accessible', 'سهولة الوصول'], WAR: ['Long Warranty', 'ضمان ممتد'],
};
const RULE = { only: ['حصراً', 'r-only'], list: ['من القائمة المعتمدة', 'r-list'], eq: ['أو ما يعادله بعد الاعتماد', 'r-eq'] };
const RULE_EN = { only: 'Exclusive', list: 'From approved list', eq: 'Or approved equivalent' };
// تسميات المستند بالعربية والإنجليزية
const LB = {
  ar: { appr: 'المعتمد لدى التجمع:', prop: 'الخاصية', mk: 'الشائع في السوق', ap: 'المعتمد لدى التجمع', whyF: 'لماذا هذه الشركات؟', why: 'لماذا يهم في المنشأة الصحية؟', risk: 'لو رُكّب الشائع', sub: 'يُقدَّم للاعتماد:', other: 'بقية الأنظمة', code: 'الرمز', sys: 'النظام', apr2: 'المعتمد', reason: 'سبب الاعتماد', item: 'البند', cond: 'الشرط',
    sum: 'ملخص البنود المعتمدة', sumP: ' في هذا المشروع', note1: (b) => `الرموز (LS) هي أرقام البنود في جدول الكميات${b}، ووصف البند في الجدول هو المرجع التعاقدي، وهذا الدليل يشرح أسبابه.`, approval: 'الاعتماد قبل التوريد', srcs: 'المراجع', stds: 'المواصفات القياسية المشار إليها',
    fig: 'الأرقام الواردة مأخوذة من بيانات المصنّعين المنشورة والمواصفات القياسية وقت إعداد الدليل، وقد تختلف حسب الموديل. والمرجع النهائي عند التوريد هو Data Sheet الموديل المعتمد ووصف البند في جدول الكميات.', end: 'شكراً لكم على عطائكم وتعاونكم', endS: 'قسم المشاريع — إدارة الخدمات الفنية — تجمع الأحساء الصحي',
    title: 'دليل المواصفات المعتمدة', kicker: 'دليل المتبرعين والمقاولين', h1: 'المواصفات المعتمدة للتشطيبات<br>والتجهيزات في المنشآت الصحية', subC: 'مقارنة بند بند بين الشائع في السوق والمعتمد لدى التجمع، ولماذا تحتاج المنشأة الصحية إلى مواد صُمّمت للاستخدام الشاق والحركة الكثيفة والتطهير اليومي.', contr: 'المقاول: ', ed: 'دليل استرشادي', none: 'لا توجد في هذا الجدول بنود مقطوعية مرتبطة ببطاقات الدليل' },
  en: { appr: 'Approved by the Cluster:', prop: 'Property', mk: 'Common in the market', ap: 'Approved by the Cluster', whyF: 'Why these companies?', why: 'Why it matters in a healthcare facility', risk: 'If the common option is installed', sub: 'Submit for approval:', other: 'Other systems', code: 'Code', sys: 'System', apr2: 'Approved', reason: 'Reason for approval', item: 'Item', cond: 'Condition',
    sum: 'Summary of approved items', sumP: ' in this project', note1: (b) => `The (LS) codes are the item numbers in the Bill of Quantities${b}; the item description in the BOQ is the contractual reference, and this guide explains the reasons behind it.`, approval: 'Approval Before Supply', srcs: 'Sources', stds: 'Referenced standards',
    fig: 'Figures are taken from manufacturers’ published data and standards at the time of preparation and may vary by model. The final reference at supply is the data sheet of the approved model and the item description in the BOQ. This English edition is a translation for reference; the Arabic text governs.', end: 'Thank you for your generosity and cooperation', endS: 'Projects Section — Technical Services Department — Al Ahsa Health Cluster',
    title: 'Approved Specifications Guide', kicker: 'A Guide for Donors and Contractors', h1: 'Approved Specifications for Finishes<br>and Fit‑Out in Healthcare Facilities', subC: 'An item‑by‑item comparison between what is common in the market and what the Cluster approves — and why healthcare facilities need materials designed for heavy duty, high traffic and daily disinfection.', contr: 'Contractor: ', ed: 'Guidance document', none: 'This BOQ has no lump‑sum items linked to guide cards' },
};
const FURN = 'الأثاث غير الطبي والمكتبي';

const loadCards = async (all = false) => { let x = sb.from('guide_cards').select('*').order('sort'); if (!all) x = x.eq('active', true); return q(x); };
const loadMeta = async () => { try { const { data } = await sb.from('settings').select('value').eq('key', 'guide_meta').maybeSingle(); return data?.value || {}; } catch (e) { return {}; } };

const badges = ks => `<div class="bdg">${(ks || []).filter(k => BADGE[k]).map(k => `<span class="b b-${k}"><b>${esc(BADGE[k][0])}</b><i>${esc(BADGE[k][1])}</i></span>`).join('')}</div>`;
const refs = (rs, map) => (rs || []).filter(r => map[r]).map(r => `<sup class="rf">[${map[r]}]</sup>`).join(' ');
let EN = false;
const rule = (r, sm = '') => { const [t, c] = RULE[r] || RULE.list; return `<span class="rule ${sm} ${c}">${EN ? RULE_EN[r] || RULE_EN.list : t}</span>`; };

function card(c, rm, t = x => x, L = LB.ar) {
  const rows = (c.rows || []).map(([p, m, a]) => `<tr><th>${esc(t(p))}</th><td class="mk">${esc(t(m))}</td><td class="ap">${esc(t(a))}</td></tr>`).join('');
  return `<section class="item${c.section === FURN ? ' big' : ''}"><header class="ih"><div class="ic">${esc(c.code_label)}</div><div class="it"><h3>${esc(t(c.title))} ${refs(c.refs, rm)}</h3><div class="en">${esc(c.en)}</div></div>${rule(c.rule)}</header>
  <div class="apr"><span>${L.appr}</span> <b>${esc(t(c.approved))}</b></div>${badges(c.badges)}
  ${rows ? `<table class="cmp"><thead><tr><th>${L.prop}</th><th class="mk">${L.mk}</th><th class="ap">${L.ap}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
  <div class="why"><div class="w1"><h4>${c.section === FURN ? L.whyF : L.why}</h4><p>${esc(t(c.why))}</p></div>${c.risk ? `<div class="w2"><h4>${L.risk}</h4><p>${esc(t(c.risk))}</p></div>` : ''}</div>
  ${(c.submit || []).length ? `<div class="sub"><b>${L.sub}</b><ul>${c.submit.map(s => `<li>${esc(t(s))}</li>`).join('')}</ul></div>` : ''}</section>`;
}

const INTRO = `<div class="intro"><h2>مقدمة</h2><div class="rib"></div>
<p class="lead">نتقدّم أولاً بخالص الشكر والتقدير لكل متبرّع اختار أن يكون أثره في مكانٍ يُشفى فيه الناس. إن تطوير مركز صحي أو تجهيزه عملٌ يبقى نفعه سنوات طويلة، ويمرّ به كل يوم مرضى وأسر وممارسون صحيون.</p>
<p>ولأن هذا العطاء يستحق أن يدوم، أعددنا هذا الدليل <b>للاطلاع والاسترشاد</b>، ليكون مرجعاً مشتركاً بيننا وبين المتبرعين والمقاولين المنفذين. فهو يوضّح لماذا نحدّد في جداول الكميات أنواعاً ومواصفات بعينها، وما الذي يميّزها عن البدائل الشائعة في السوق، بالأرقام والمراجع الفنية الصادرة عن المصنّعين وجهات المواصفات.</p>
<p>الفرق في الغالب لا يظهر يوم التسليم؛ فالبابان قد يتشابهان شكلاً، والكرسيان قد يبدوان متماثلين. لكن المنشأة الصحية تعمل على مدار الساعة، وتُنظَّف يومياً بمطهرات قوية، وتمر في ممراتها الأسرّة والعربات باستمرار. هنا يظهر الفرق بعد أشهر قليلة: إما مادة صُمّمت لهذا الاستخدام فتبقى، وإما مادة صُمّمت لمكتب أو منزل فتحتاج إلى إصلاح أو استبدال، ويتحمّل المبنى تكلفة التشغيل ويتأثر أثر التبرع.</p>
<p>المواصفات هنا ليست تفضيلاً لعلامة على أخرى، بل خلاصة تجربة التشغيل والصيانة في منشآت التجمع، ومتطلبات الدفاع المدني والاعتماد الصحي ومكافحة العدوى، والحرص على <b>توحيد الأنظمة</b> بين المنشآت حتى تكون قطع الغيار والصيانة متاحة وسريعة.</p>
<div class="sig">نأمل أن يكون هذا الدليل عوناً للجميع، وفريق قسم المشاريع بإدارة الخدمات الفنية حاضرٌ دائماً للإجابة عن أي استفسار ومراجعة أي بديل مقترح قبل التوريد، حتى يخرج المشروع بأفضل صورة تليق بالمتبرع وبالمستفيدين.</div>
<h2 style="margin-top:22px">لماذا تختلف المنشأة الصحية؟</h2><div class="rib"></div>
<div class="why5">
 <div><b>تشغيل متواصل 24/7</b><span>لا إجازات ولا ساعات إغلاق؛ الباب والكرسي والإنارة تعمل ثلاث ورديات يومياً.</span></div>
 <div><b>حركة كثيفة وعجلات</b><span>أسرّة وعربات أدوية وطعام وكراسي متحركة تصطدم بالأبواب والجدران والزوايا.</span></div>
 <div><b>تطهير يومي بمواد قوية</b><span>مركّبات الكلور والكحول والأمونيوم الرباعي تُتلف المواد غير المصمّمة لها.</span></div>
 <div><b>مكافحة العدوى</b><span>كل فاصل مفتوح أو سطح مسامي أو مادة تمتص الماء مكان لتجمع الميكروبات.</span></div>
 <div><b>السلامة والاعتماد</b><span>متطلبات الدفاع المدني ومعايير الاعتماد الصحي (سباهي) تشمل الأبواب والأرضيات والأثاث.</span></div>
 <div><b>توحيد الصيانة</b><span>منظومة واحدة للأقفال والمصاعد والإكسسوارات تعني قطع غيار واحدة وإصلاحاً أسرع.</span></div>
</div>
<h3 class="brk">كيف تقرأ هذا الدليل</h3>
<p style="margin:4px 0">لكل بند بطاقة: الرمز كما في جدول الكميات، المعتمد لدى التجمع، شارات الأداء، جدول مقارنة بين الشائع في السوق والمعتمد، ثم سبب الاعتماد وما يُقدَّم قبل التوريد. والرقم الصغير بجانب العنوان يشير إلى المرجع في آخر الدليل.</p>
<div class="legend">
 <div><span class="rule sm r-only">حصراً</span> لا يُقبل بديل لارتباطه بمنظومة موحّدة أو اعتماد قائم</div>
 <div><span class="rule sm r-list">من القائمة المعتمدة</span> أي اسم من الأسماء المذكورة</div>
 <div><span class="rule sm r-eq">أو ما يعادله بعد الاعتماد</span> يُقبل بديل مطابق بعد اعتماده كتابياً</div>
 <div>الشارات الملونة (Heavy Duty، High Traffic…) تلخّص نوع الأداء المطلوب من البند.</div>
</div></div>`;

const FURN_EXTRA = rm => `<div class="brands">
 <div><b>Herman Miller</b>ضمان 12 سنة لكثير من منتجاتها على أساس الاستخدام لثلاث ورديات.${refs([10], rm)}</div>
 <div><b>Global (Canada)</b>فئة Heavy Duty: ضمان 12 سنة لكل المكونات للاستخدام 24/7، وقماش أعلى من 100,000 مسحة مزدوجة.${refs([11], rm)}</div>
 <div><b>OFS</b>ضمان 12 سنة للمنتجات القياسية، و5 سنوات للآليات والإسفنج.${refs([12], rm)}</div>
 <div><b>Steelcase</b>ضمان محدود مدى الحياة لعدد من المكونات، مع فترات محددة لبقية الأجزاء.${refs([13], rm)}</div></div>`;
const FURN_AFTER = rm => `<div class="box"><h3>ما معنى «المسحة المزدوجة» (Double Rub)؟</h3>
<p style="margin:0 0 6px">اختبار Wyzenbeek يحرّك قطعة قماش قطني خشن ذهاباً وإياباً على قماش التنجيد تحت شدّ ووزن ثابتين، وكل حركة ذهاب وعودة تُحسب مسحة مزدوجة واحدة. يتوقف العدّ عند ظهور تآكل واضح في القماش. كلما زاد الرقم، طال عمر التنجيد.${refs([15, 14, 11], rm)}</p>
<div class="dr">
 <div class="r mk"><span>الحد العام للأماكن التجارية</span><div class="bar"><i style="width:15%"></i></div><span class="v">15,000</span></div>
 <div class="r mk"><span>الاستخدام التجاري الشاق</span><div class="bar"><i style="width:30%"></i></div><span class="v">30,000</span></div>
 <div class="r"><span>الحد الأدنى للرعاية الصحية</span><div class="bar"><i style="width:75%"></i></div><span class="v">75,000</span></div>
 <div class="r"><span>فئة Heavy Duty (Global)</span><div class="bar"><i style="width:100%"></i></div><span class="v">+100,000</span></div></div>
<p style="margin:0;font-size:9pt;color:var(--g)">الأقمشة الشائعة في الأثاث المحلي تقع غالباً في المنطقة الرمادية أو لا يُذكر رقمها أصلاً.</p></div>
<div class="note"><b>عن المصنّع المحلي:</b> لا نقصد التقليل من الصناعة المحلية؛ الهدف هو الأداء الموثّق. والقائمة المعتمدة هي الأسماء الأربعة أعلاه، وأي منتج آخر يُقترح لا يُدرس إلا إذا قُدّمت معه تقارير اختبار BIFMA من مختبر معتمد، وبيانات القماش (المسحات المزدوجة وقابلية التطهير والحريق)، وضماناً مكتوباً من المصنّع يماثل ما سبق، ويبقى القرار للإدارة.</div>`;

const STEPS = `<p class="si">حتى يسير المشروع بلا رفض في الموقع أو إعادة توريد، نرجو اتباع هذه الخطوات لكل بند:</p>
<ol class="steps">
 <li><b>تقديم طلب اعتماد (Submittal)</b> لكل بند قبل الشراء، يتضمن رقم البند في جدول الكميات والموديل المقترح.</li>
 <li><b>إرفاق المستندات الأصلية من المصنّع:</b> Data Sheet، وشهادات الاختبار، وشهادة المنشأ، وخطاب الوكيل أو الموزّع المعتمد، وخطاب الضمان.</li>
 <li><b>تقديم العينة</b> للبنود التي تحتاجها (الأرضيات، البلاط، الألوان، القماش، الإكسسوارات).</li>
 <li><b>للبنود «أو ما يعادله» فقط:</b> جدول مقارنة نقطة بنقطة بين المقترح والمعتمد على كل خاصية في هذا الدليل؛ والمعادل هو ما يساوي أو يتجاوز كل خاصية، لا معظمها.</li>
 <li><b>انتظار الاعتماد الكتابي</b> من قسم المشاريع قبل التوريد.</li>
 <li><b>عند وصول المواد:</b> مطابقة الموديل ورقم الدفعة والملصقات مع ما اعتُمد، وأي اختلاف يعني رفض المادة.</li></ol>
<div class="note">البنود المعلّمة <span class="rule sm r-only">حصراً</span> لا يُقدَّم لها بديل، لأنها ترتبط بمنظومة موحّدة في منشآت التجمع أو بعقود صيانة وقطع غيار قائمة.</div>`;

const INTRO_EN = `<div class="intro"><h2>Introduction</h2><div class="rib"></div>
<p class="lead">We would first like to extend our sincere thanks and appreciation to every donor who has chosen to leave their mark in a place where people heal. Developing or equipping a health centre is a gift whose benefit lasts for many years, touching patients, families and healthcare professionals every day.</p>
<p>Because such generosity deserves to endure, we have prepared this guide <b>for information and guidance</b>, as a shared reference between us, donors and the executing contractors. It explains why our bills of quantities specify particular products and specifications, and what distinguishes them from the common alternatives in the market — with figures and technical references published by manufacturers and standards bodies.</p>
<p>The difference rarely shows on handover day; two doors may look alike, and two chairs may appear identical. But a healthcare facility operates around the clock, is cleaned daily with strong disinfectants, and sees beds and trolleys moving through its corridors constantly. This is where the difference appears within a few months: either a material designed for this use, which lasts, or a material designed for an office or home, which needs repair or replacement — leaving the building with the operating cost and diminishing the impact of the donation.</p>
<p>These specifications do not reflect a preference for one brand over another. They are the outcome of operating and maintenance experience across Cluster facilities, the requirements of Civil Defense, healthcare accreditation and infection control, and our commitment to <b>standardizing systems</b> across facilities so that spare parts and maintenance remain available and fast.</p>
<div class="sig">We hope this guide is of help to everyone. The Projects Section team at the Technical Services Department is always available to answer any enquiry and to review any proposed alternative before supply, so that every project is delivered in a manner worthy of the donor and of those it serves.</div>
<h2 style="margin-top:22px">Why is a healthcare facility different?</h2><div class="rib"></div>
<div class="why5">
 <div><b>24/7 operation</b><span>No holidays or closing hours; doors, chairs and lighting work three shifts a day.</span></div>
 <div><b>Heavy, wheeled traffic</b><span>Beds, medication and meal trolleys and wheelchairs strike doors, walls and corners.</span></div>
 <div><b>Daily disinfection</b><span>Chlorine, alcohol and quaternary ammonium compounds damage materials not designed for them.</span></div>
 <div><b>Infection control</b><span>Every open joint, porous surface or water‑absorbing material is a place for microbes to collect.</span></div>
 <div><b>Safety & accreditation</b><span>Civil Defense requirements and healthcare accreditation standards (CBAHI) cover doors, floors and furniture.</span></div>
 <div><b>Standardized maintenance</b><span>One system for locks, elevators and accessories means one set of spare parts and faster repairs.</span></div>
</div>
<h3 class="brk">How to read this guide</h3>
<p style="margin:4px 0">Each item has its own card: the code as it appears in the BOQ, the product approved by the Cluster, performance badges, a comparison table between what is common in the market and what is approved, followed by the reason for approval and what must be submitted before supply. The small number beside a title refers to the sources at the end of the guide.</p>
<div class="legend">
 <div><span class="rule sm r-only">Exclusive</span> No alternative accepted, as the item is tied to a standardized system or existing approval</div>
 <div><span class="rule sm r-list">From approved list</span> Any of the names listed</div>
 <div><span class="rule sm r-eq">Or approved equivalent</span> A matching alternative is accepted after written approval</div>
 <div>The coloured badges (Heavy Duty, High Traffic…) summarize the type of performance required of the item.</div>
</div></div>`;
const FURN_EXTRA_EN = rm => `<div class="brands">
 <div><b>Herman Miller</b>12‑year warranty on many products, based on three‑shift use.${refs([10], rm)}</div>
 <div><b>Global (Canada)</b>Heavy Duty category: 12‑year warranty on all components for 24/7 use, and fabrics above 100,000 double rubs.${refs([11], rm)}</div>
 <div><b>OFS</b>12‑year warranty on standard products; 5 years on mechanisms and foam.${refs([12], rm)}</div>
 <div><b>Steelcase</b>Limited lifetime warranty on many components, with defined periods for other parts.${refs([13], rm)}</div></div>`;
const FURN_AFTER_EN = rm => `<div class="box"><h3>What is a “double rub”?</h3>
<p style="margin:0 0 6px">The Wyzenbeek test moves a piece of cotton duck back and forth across the upholstery fabric under fixed tension and load; each back‑and‑forth movement counts as one double rub. Counting stops when noticeable wear appears. The higher the number, the longer the upholstery lasts.${refs([15, 14, 11], rm)}</p>
<div class="dr">
 <div class="r mk"><span>General contract threshold</span><div class="bar"><i style="width:15%"></i></div><span class="v">15,000</span></div>
 <div class="r mk"><span>Heavy‑duty commercial use</span><div class="bar"><i style="width:30%"></i></div><span class="v">30,000</span></div>
 <div class="r"><span>Healthcare minimum</span><div class="bar"><i style="width:75%"></i></div><span class="v">75,000</span></div>
 <div class="r"><span>Heavy Duty category (Global)</span><div class="bar"><i style="width:100%"></i></div><span class="v">100,000+</span></div></div>
<p style="margin:0;font-size:9pt;color:var(--g)">Fabrics in common local furniture usually fall in the grey range, or their rating is not stated at all.</p></div>
<div class="note"><b>About local manufacturers:</b> We do not mean to diminish local industry; the aim is documented performance. The approved list consists of the four names above, and any other proposed product will be considered only if accompanied by BIFMA test reports from an accredited laboratory, fabric data (double rubs, disinfectant cleanability and fire), and a written manufacturer’s warranty comparable to the above. The final decision rests with the Department.</div>`;
const STEPS_EN = `<p class="si">To keep the project free of site rejections and re‑supply, please follow these steps for every item:</p>
<ol class="steps">
 <li><b>Submit a material submittal</b> for each item before purchase, stating the BOQ item number and the proposed model.</li>
 <li><b>Attach original manufacturer documents:</b> data sheet, test certificates, certificate of origin, authorized agent or distributor letter, and warranty letter.</li>
 <li><b>Provide samples</b> for items that require them (flooring, tiles, colours, fabrics, accessories).</li>
 <li><b>For “or approved equivalent” items only:</b> a point‑by‑point comparison of the proposed and approved product against every property in this guide; an equivalent equals or exceeds every property — not most of them.</li>
 <li><b>Await written approval</b> from the Projects Section before supply.</li>
 <li><b>On delivery:</b> the model, batch number and labels are checked against the approval; any difference means rejection of the material.</li></ol>
<div class="note">Items marked <span class="rule sm r-only">Exclusive</span> are not open to alternatives, as they are tied to a standardized system across Cluster facilities or to existing maintenance and spare‑parts contracts.</div>`;

// boqId = null → الدليل الكامل بلا مشروع؛ lang = 'en' للنسخة الإنجليزية
export async function openGuide(boqId, lang = 'ar') {
  let win; try {
    const { prepDoc } = await import('./pdfdoc.js'); win = prepDoc(); if (!win) return;
    EN = lang === 'en'; const L = LB[EN ? 'en' : 'ar'];
    const [all, meta] = await Promise.all([loadCards(), loadMeta()]);
    let cards = all, prj = null, boq = null;
    if (boqId) {
      boq = await q(sb.from('boqs').select('id,name,project_id').eq('id', boqId).single());
      prj = await q(sb.from('projects').select('name,facility,contractor').eq('id', boq.project_id).single());
      const codes = new Set((await q(sb.from('boq_lines').select('ls_code').eq('boq_id', boqId))).map(l => l.ls_code).filter(Boolean));
      cards = all.filter(c => (c.ls_codes || []).some(x => codes.has(x)));
      if (!cards.length) { win.close(); return toast(LB.ar.none, 'bad'); }
    }
    let t = x => x;
    if (EN) { const I = await import('./i18n.js');
      t = await I.translator([prj?.name, prj?.facility, prj?.contractor, boq?.name, ...cards.flatMap(c => [c.title, c.approved, c.why, c.risk, c.section, ...(c.submit || []), ...(c.rows || []).flat()]), ...(meta.sections || []).flatMap(s => [s.name, s.intro]), ...(meta.sources || []).map(x => x[0]), ...(meta.standards || [])].filter(Boolean)); }
    // ترقيم المراجع المستخدمة فقط بالترتيب
    const SRC = meta.sources || []; const used = [];
    const mark = r => { if (SRC[r - 1] && !used.includes(r)) used.push(r); };
    cards.forEach(c => (c.refs || []).forEach(mark)); if (cards.some(c => c.section === FURN)) [10, 11, 12, 13, 15, 14].forEach(mark);
    const rm = Object.fromEntries(used.map((r, i) => [r, i + 1]));
    const secs = (meta.sections || []).map(s => s.name).concat([...new Set(cards.map(c => c.section))]).filter((s, i, a) => a.indexOf(s) === i);
    const intro = Object.fromEntries((meta.sections || []).map(s => [s.name, s.intro]));
    let n = 0, body = '';
    const summary = cards.map(c => `<tr><td class="ltr c">${esc(c.code_label)}</td><td>${esc(t(c.title))}</td><td>${esc(t(c.approved))}</td><td>${rule(c.rule, 'sm')}</td></tr>`).join('');
    for (const s of secs) {
      const cs = cards.filter(c => c.section === s); if (!cs.length) continue; n++;
      const big = cs.filter(c => c.kind !== 'row'), rows = cs.filter(c => c.kind === 'row');
      body += `<div class="sec brk"><div class="sh"><span class="sn">${n}</span><h2>${esc(t(s))}</h2></div><p class="si">${esc(t(intro[s] || ''))}</p>${s === FURN ? (EN ? FURN_EXTRA_EN(rm) : FURN_EXTRA(rm)) : ''}
        ${big.map(c => card(c, rm, t, L)).join('')}
        ${rows.length ? `${big.length ? `<h3 style="margin:6px 0">${L.other}</h3>` : ''}<table class="tbl"><thead><tr><th style="width:13%">${L.code}</th><th style="width:17%">${L.sys}</th><th style="width:30%">${L.apr2}</th><th>${L.reason}</th></tr></thead><tbody>${rows.map(c => `<tr><td class="ltr c">${esc(c.code_label)}</td><td>${esc(t(c.title))}</td><td class="ltr br">${esc(t(c.approved))}</td><td>${esc(t(c.why))}</td></tr>`).join('')}</tbody></table>` : ''}
        ${s === FURN ? (EN ? FURN_AFTER_EN(rm) : FURN_AFTER(rm)) : ''}</div>`;
    }
    const date = EN ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : dateAr(new Date().toISOString());
    const html = `${EN ? INTRO_EN : INTRO}
      <div style="margin-top:16px"><h2 style="font-size:18pt;font-weight:800">${L.sum}${prj ? L.sumP : ''}</h2><div class="intro"><div class="rib"></div></div>
      <table class="tbl"><thead><tr><th style="width:15%">${L.code}</th><th style="width:28%">${L.item}</th><th>${L.ap}</th><th style="width:20%">${L.cond}</th></tr></thead><tbody>${summary}</tbody></table>
      <p class="note">${L.note1(boq ? (EN ? ` “${esc(t(boq.name))}”` : ` «${esc(boq.name)}»`) : '')}</p></div>
      ${body}
      <div class="sec brk"><div class="sh"><span class="sn">${n + 1}</span><h2>${L.approval}</h2></div>${EN ? STEPS_EN : STEPS}
      <h2 style="margin-top:22px">${L.srcs}</h2><div class="intro"><div class="rib"></div></div>
      <ol class="src">${used.map(r => { const [st, u] = SRC[r - 1]; return `<li>${esc(t(st))}${u ? `<br><a href="${esc(u)}">${esc(u)}</a>` : ''}</li>`; }).join('')}</ol>
      <h3 style="margin-top:10px">${L.stds}</h3><ul class="std">${(meta.standards || []).map(s => `<li>${esc(t(s))}</li>`).join('')}</ul>
      <p class="note">${L.fig}</p>
      <p class="end">${L.end}<br><span style="font-weight:500;color:var(--g)">${L.endS}</span></p></div>`;
    const { openDoc, coverHtml } = await import('./pdfdoc.js');
    openDoc({ win, lang, title: `${L.title}${prj ? ' — ' + t(prj.name) : ''}`, body: html,
      cover: coverHtml({ en: EN, kicker: L.kicker, title: L.h1, sub: L.subC,
        project: prj ? t(prj.name) : '', facility: prj ? [t(prj.facility), prj.contractor ? L.contr + t(prj.contractor) : ''].filter(Boolean).join(' · ') : '', pills: ['Heavy Duty', 'High Traffic', 'Disinfectant‑Resistant', 'ANSI/BHMA Grade 1', 'BIFMA'], edition: L.ed, date }) });
  } catch (e) { try { win?.close(); } catch (x) { } err(e); }
}

// ===== إدارة البطاقات (المدير) =====
export async function mountGuideAdmin(root) {
  const rows = await loadCards(true);
  const secs = () => [...new Set(rows.map(r => r.section))];
  const render = () => {
    root.innerHTML = `<div class="pcard"><div class="btnrow"><div><h2 class="m0">بطاقات دليل المواصفات المعتمدة</h2><p class="muted small m0">كل بطاقة مرتبطة برموز بنود المقطوعية (LS)؛ ويُصدر الدليل من صفحة جدول الكميات في المشروع بالبطاقات الموجودة في جدوله فقط. ${rows.filter(r => r.active).length} بطاقة فعالة.</p></div><span class="sp"></span><button class="btn" id="gAll">معاينة الدليل الكامل</button><button class="btn primary" id="gNew">＋ بطاقة</button></div></div>
      ${secs().map(s => `<section class="pcard"><h2>${esc(s)}</h2>${rows.filter(r => r.section === s).map(r => `<div class="hoq ${r.active ? '' : 'off'}"><div class="hoq-h"><span class="ltr cd">${esc(r.code_label)}</span><b>${esc(r.title)}</b><span class="badge skel">${RULE[r.rule]?.[0] || ''}</span>${r.kind === 'row' ? '<span class="badge skel">سطر في جدول</span>' : ''}<span class="sp"></span><button class="btn sm ghost" data-e="${esc(r.key)}">تعديل</button></div><p class="small">${esc(r.approved)}</p></div>`).join('')}</section>`).join('')}`;
    $('#gAll', root).onclick = () => openGuide(null);
    $('#gNew', root).onclick = () => form(null);
    $$('[data-e]', root).forEach(b => b.onclick = () => form(rows.find(r => r.key === b.dataset.e)));
  };
  const form = r => {
    const v = r || { key: 'G-' + String(Math.max(0, ...rows.map(x => +x.key.slice(2) || 0)) + 1).padStart(2, '0'), code_label: '', ls_codes: [], section: secs()[0] || '', kind: 'card', sort: Math.max(0, ...rows.map(x => x.sort || 0)) + 10, title: '', en: '', rule: 'list', approved: '', badges: [], rows: [], why: '', risk: '', submit: [], refs: [], active: true };
    const ta = (n, val, rr = 3) => `<textarea name="${n}" rows="${rr}">${esc(val)}</textarea>`;
    modal(`<form id="f" class="pgrid">${field('المفتاح', inp('key', v.key, 'readonly'))}${field('الرمز المعروض', inp('code_label', v.code_label, 'placeholder="LS-54"'))}
      ${field('رموز بنود المقطوعية المرتبطة (بفاصلة)', inp('ls_codes', (v.ls_codes || []).join(', '), 'dir="ltr" placeholder="LS-70, LS-71"'), 'wide')}
      ${field('القسم', `<input name="section" list="gS" value="${esc(v.section)}" required><datalist id="gS">${secs().map(s => `<option value="${esc(s)}">`).join('')}</datalist>`)}
      ${field('الشكل', `<select name="kind"><option value="card" ${v.kind === 'card' ? 'selected' : ''}>بطاقة كاملة</option><option value="row" ${v.kind === 'row' ? 'selected' : ''}>سطر في جدول الأنظمة</option></select>`)}
      ${field('العنوان *', inp('title', v.title, 'required'), 'wide')}${field('العنوان الإنجليزي / المنتج', inp('en', v.en, 'dir="ltr"'), 'wide')}
      ${field('الشرط', `<select name="rule">${Object.entries(RULE).map(([k, [t]]) => `<option value="${k}" ${v.rule === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}${field('الترتيب', inp('sort', v.sort, 'type="number"'))}
      ${field('المعتمد لدى التجمع', inp('approved', v.approved), 'wide')}
      <div class="fld wide"><span>الشارات</span><div class="btnrow">${Object.entries(BADGE).map(([k, [e, a]]) => `<label class="chk"><input type="checkbox" name="b_${k}" ${(v.badges || []).includes(k) ? 'checked' : ''}> ${esc(e)} — ${esc(a)}</label>`).join('')}</div></div>
      ${field('جدول المقارنة — سطر لكل خاصية: الخاصية | الشائع في السوق | المعتمد', ta('rows', (v.rows || []).map(x => x.join(' | ')).join('\n'), 6), 'wide')}
      ${field('لماذا يهم في المنشأة الصحية؟ (وفي سطر الجدول: سبب الاعتماد)', ta('why', v.why), 'wide')}${field('لو رُكّب الشائع', ta('risk', v.risk, 2), 'wide')}
      ${field('يُقدَّم للاعتماد — سطر لكل مستند', ta('submit', (v.submit || []).join('\n')), 'wide')}${field('أرقام المراجع (بفاصلة)', inp('refs', (v.refs || []).join(', '), 'dir="ltr"'))}
      <label class="chk"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> فعّالة</label>
      <div class="btnrow end wide">${r ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">حفظ</button></div></form>`, { title: r ? 'تعديل بطاقة' : 'بطاقة جديدة', wide: true, onOpen: (w, close) => {
      $('#f', w).onsubmit = async e => { e.preventDefault(); const x = formData(e.target); const lines = s => String(s || '').split('\n').map(t => t.trim()).filter(Boolean);
        const row = { key: x.key, code_label: x.code_label.trim(), ls_codes: x.ls_codes.split(/[,،\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean), section: x.section.trim(), kind: x.kind, sort: +x.sort || 0, title: x.title.trim(), en: x.en.trim(), rule: x.rule, approved: x.approved.trim(),
          badges: Object.keys(BADGE).filter(k => x['b_' + k]), rows: lines(x.rows).map(l => { const p = l.split('|').map(t => t.trim()); return [p[0] || '', p[1] || '', p.slice(2).join(' | ')]; }), why: x.why.trim(), risk: x.risk.trim(), submit: lines(x.submit),
          refs: x.refs.split(/[,،\s]+/).map(Number).filter(n => n > 0), active: !!x.active, updated_at: new Date().toISOString() };
        try { await q(sb.from('guide_cards').upsert(row, { onConflict: 'key' })); if (r) Object.assign(r, row); else rows.push(row); rows.sort((a, b) => a.sort - b.sort); close(); render(); toast('تم الحفظ'); } catch (er) { err(er); } };
      const d = $('[data-del]', w); if (d) d.onclick = async () => { if (!(await confirm('حذف البطاقة؟ (الأفضل إيقافها)', 'حذف', true))) return; try { await q(sb.from('guide_cards').delete().eq('key', r.key)); rows.splice(rows.indexOf(r), 1); close(); render(); } catch (er) { err(er); } };
    } });
  };
  render();
}
