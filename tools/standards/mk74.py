import json
def q(s): return "''" if s in (None, '') else "$s$" + str(s) + "$s$"
def arr(a): return ("array[" + ",".join(q(x) for x in a) + "]::text[]") if a else "'{}'::text[]"
def js(o): return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"

# ---------- المعايير: الداخلية (للتجمع) والمرجعية الخارجية
STD = [
 dict(code='AAHC-FM-STD-DIGITAL-SIGNAGE-001', kind='internal', title='معيار الشاشات الرقمية والتلفزيونات', en='Digital Signage & TV Installation Standard', owner='FAC', support=['IT', 'PRJ'], version='Rev 0', status='draft',
   scope='اختيار الشاشات وتركيبها وتشغيلها وإدارة محتواها في كل منشآت التجمع: المستشفيات والمراكز والمباني الإدارية والمناطق العامة والانتظار والاستقبال ومحطات التمريض والمكاتب وغرف الاجتماعات.',
   summary='شاشات تجارية للتشغيل المتواصل (Samsung QMC القياسي، QHC للإضاءة العالية، QBC للمناطق الإدارية غير الحرجة) بدقة 4K، ولا تلفزيون منزلي في المناطق العامة؛ مقبسان ونقطة شبكة خلف كل شاشة وكابلات مخفية؛ وربط شاشات المناطق العامة بمنصة Navori؛ ومقاسات وارتفاعات محددة لكل موقع.',
   file='assets/standards/AAHC-FM-STD-DIGITAL-SIGNAGE-001.pdf', link='', tokens=['AAHC-FM-STD-DIGITAL-SIGNAGE-001', 'Navori', 'Samsung QMC', 'QMC'],
   clauses=['الغرض: نهج موحد لاختيار الشاشات وتركيبها وتشغيلها وإدارتها في كل منشآت التجمع.',
     'المتطلبات العامة: شاشات احترافية تجارية للتشغيل المتواصل، وSamsung QMC أو ما يعادلها المعتمد هي الأساس؛ لا يُركَّب تلفزيون منزلي في المناطق العامة أو الحرجة؛ دقة 4K UHD كحد أدنى؛ حوامل تجارية معتمدة.',
     'الأنواع المعتمدة: QMC للتطبيقات الصحية القياسية، QHC للمناطق عالية الإضاءة، QBC للمناطق الإدارية غير الحرجة.',
     'الكهرباء: مقبسان كحد أدنى خلف كل شاشة (للشاشة وللمشغّل)، مخفيان خلفها، ويُفضَّل ربط أحدهما بالطوارئ/UPS.',
     'الشبكة: نقطة RJ45 سلكية لكل شاشة؛ والاتصال اللاسلكي بموافقة تقنية المعلومات فقط.',
     'الكابلات: كل الكابلات مخفية خلف الشاشة أو في مجارٍ معتمدة؛ لا أسلاك متدلية ولا تمديدات مؤقتة.',
     'ارتفاع منتصف الشاشة عن الأرضية المنتهية: الانتظار الصغيرة 1.5–1.7 م، الكبيرة 1.5–1.8 م، الاستقبال 1.5–1.7 م، محطات التمريض 1.6–1.8 م، المكاتب 1.4–1.6 م، المكاتب التنفيذية 1.3–1.5 م، الاجتماعات 1.2–1.4 م، الردهات الرئيسية 1.7–2.0 م.',
     'المقاسات: الانتظار الصغيرة 43–55، القياسية 55–65، الكبيرة 65، الردهات 65–75، القاعات الكبيرة 75 فأكثر، التمريض والاستقبال 43–55، المكاتب 55، التنفيذية والاجتماعات 55–65 بوصة.',
     'إدارة المحتوى: كل شاشات المناطق العامة مربوطة بمنصة Navori (مشغّل مدمج أو خارجي): التوعية الصحية، الدور، أوقات الانتظار، الإرشاد، التنبيهات الطارئة. ويُوصى بربط المكاتب والاجتماعات أيضاً.',
     'الحوكمة: كل تركيب جديد يلتزم بالمعيار، وأي خروج عنه بموافقة موثقة؛ وتنسّق المرافق وتقنية المعلومات والاتصال المؤسسي والمشاريع.']),
 dict(code='AHC-PRJ-HO', kind='internal', title='اشتراطات تسليم المشروع', en='Project Handover Requirements', owner='PRJ', support=['FAC', 'MNT'], version='', status='active',
   scope='ما يلتزم المقاول بتسليمه في كل مشروع: المخططات كما نُفِّذ، الضمانات والشهادات، الترميز والتوسيم، التشغيل والصيانة والتدريب، فترة الضمان والاستلام النهائي.', summary='26 اشتراطاً (HO-01..HO-26) تُرفق بجداول الكميات ويُولَّد منها بند «الإغلاق والضمان» في المشروع.',
   file='', link='#/handover', tokens=['HO-'], clauses=[]),
 dict(code='AHC-PRJ-SPEC', kind='internal', title='دليل المواصفات المعتمدة للتشطيبات والتجهيزات', en='Approved Specifications Guide', owner='PRJ', support=[], version='', status='active',
   scope='الشائع في السوق مقابل المعتمد لدى التجمع لكل بند محدد العلامة في جداول الكميات، وسبب الاعتماد وما يُقدَّم قبل التوريد.', summary='يصدر من جدول كميات أي مشروع باسمه بالعربية والإنجليزية، وبطاقاته تُدار من الإدارة ← دليل المواصفات.',
   file='', link='#guide', tokens=[], clauses=[]),
 dict(code='AHC-DSG', kind='internal', title='دليل معايير التصميم للمنشآت الصحية', en='Healthcare Facility Design Standards Guide', owner='PRJ', support=['FAC', 'IT', 'BME'], version='', status='active',
   scope='مبادئ التصميم ومساره، الفراغات النموذجية، الهوية والإرشاد، الخامات، ترميز الغرف، الأنظمة، التصميم للصيانة، الوصول الشامل، ومخرجات التصميم وقائمة مراجعته.', summary='يُرفق مع كل تكليف تصميم أو تأهيل، ولا يُعتمد تصميم للطرح قبل اجتياز قائمة مراجعته (R-44).',
   file='', link='#/manuals/g/design', tokens=[], clauses=[]),
 dict(code='AHC-CTR', kind='internal', title='دليل المقاول للعمل داخل المنشآت المشغّلة', en='Contractor Guide for Work in Operating Facilities', owner='PRJ', support=['SAF', 'FAC'], version='', status='active',
   scope='قبل المباشرة، الدخول والحركة، تصاريح العمل، مكافحة العدوى أثناء الأعمال، السلامة، الإيقافات، المخلفات، الجودة والاعتمادات، الحوادث، الاستلام، المخالفات، وإقرار المقاول.', summary='جزء من العقد (R-43)، ويُوقّع المقاول إقراره قبل المباشرة.',
   file='', link='#/manuals/g/contractor', tokens=[], clauses=[]),
 dict(code='AHC-CODE', kind='internal', title='نظام ترميز الغرف والأصول', en='Room and Asset Coding System', owner='FAC', support=['PRJ', 'MNT', 'BME'], version='', status='active',
   scope='رمز ثابت لكل فراغ (القسم/المنطقة – الطابق – رقم الغرفة) يُكتب على المخططات ولوحة الغرفة ويُسجَّل في المنصة، وترميز الأصول بلوحات QR وفق موقعها في Planon.', summary='كل بلاغ على رقم غرفة أو أصل (R-16)، ويطبّقه المقاول عند التسليم (HO-16، HO-17).',
   file='', link='#/manuals/g/design', tokens=['ترقيم الغرف', 'ترميز الأصول', 'Planon'], clauses=['مثال الرمز: ER-GF-001 (القسم – الطابق – الغرفة).', 'لا يتغير الرمز بتغيير الاستخدام إلا بإجراء إدارة التغيير (G-12).', 'الأصول بلوحات دائمة تحمل رمز QR: رمز الموقع في Planon / المبنى / الدور / الغرفة / نوع الأصل / الرقم التسلسلي.']),
]
EXT = [
 ('SBC 201', 'كود البناء السعودي العام', 'Saudi Building Code — General', ['SBC 201', 'SBC']),
 ('SBC 304', 'كود البناء السعودي — المباني الخرسانية', 'SBC — Concrete Structures', ['SBC 304']),
 ('SBC 401', 'كود البناء السعودي — الكهرباء', 'SBC — Electrical', ['SBC 401', 'الكود السعودي']),
 ('SBC 601', 'كود البناء السعودي — ترشيد الطاقة', 'SBC — Energy Conservation', ['SBC 601', 'كود الطاقة']),
 ('SBC 801', 'كود البناء السعودي — الحماية من الحريق', 'SBC — Fire Protection', ['SBC 801', 'كود الحماية من الحريق', 'الدفاع المدني']),
 ('NFPA 10', 'طفايات الحريق المحمولة', 'Portable Fire Extinguishers', ['NFPA 10']),
 ('NFPA 13', 'تركيب أنظمة الرشاشات', 'Installation of Sprinkler Systems', ['NFPA 13']),
 ('NFPA 20', 'مضخات الحريق الثابتة', 'Stationary Fire Pumps', ['NFPA 20']),
 ('NFPA 72', 'كود الإنذار والإشارة الوطني', 'National Fire Alarm and Signaling Code', ['NFPA 72', 'إنذار الحريق العنواني']),
 ('NFPA 99', 'كود منشآت الرعاية الصحية', 'Health Care Facilities Code', ['NFPA 99']),
 ('NFPA 101', 'كود سلامة الأرواح', 'Life Safety Code', ['NFPA 101']),
 ('NFPA 110', 'أنظمة الطاقة الاحتياطية والطوارئ', 'Emergency and Standby Power Systems', ['NFPA 110']),
 ('NFPA 2001', 'أنظمة الإطفاء بالغاز النظيف', 'Clean Agent Fire Extinguishing Systems', ['NFPA 2001', 'Novec 1230', 'FM200']),
 ('ASHRAE 170', 'تهوية منشآت الرعاية الصحية', 'Ventilation of Health Care Facilities', ['ASHRAE 170']),
 ('SMACNA', 'معايير مجاري الهواء', 'HVAC Duct Construction Standards', ['SMACNA']),
 ('HTM 02-01', 'أنظمة الغازات الطبية', 'Medical Gas Pipeline Systems', ['HTM 02-01']),
 ('IEC 61439', 'لوحات التوزيع منخفضة الجهد', 'Low-voltage Switchgear Assemblies', ['IEC 61439']),
 ('IEC 60364-7-710', 'التمديدات الكهربائية في المواقع الطبية', 'Electrical Installations — Medical Locations', ['IEC 60364-7-710', '60364']),
 ('TIA/EIA-568', 'الشبكات الهيكلية للاتصالات', 'Structured Cabling', ['TIA/EIA-568', 'EIA-568', 'Cat6A']),
 ('ANSI/BHMA A156', 'إكسسوارات الأبواب ودرجاتها', 'Builders Hardware Grades', ['ANSI/BHMA', 'BHMA', 'Grade 1']),
 ('ANSI/SDI A250.8', 'الأبواب والحلوق المعدنية', 'Steel Doors and Frames', ['A250.8']),
 ('EN 16005', 'سلامة الأبواب الآلية', 'Power Operated Pedestrian Doorsets — Safety', ['EN 16005']),
 ('UL 723 / ASTM E84', 'انتشار اللهب والدخان للمواد', 'Surface Burning Characteristics', ['UL 723', 'ASTM E84']),
 ('ASTM E283/E330/E331', 'أداء الجدار الساتر (الهواء والحمل والماء)', 'Curtain Wall Performance Tests', ['ASTM E283', 'ASTM E330', 'ASTM E331']),
 ('EN 438', 'ألواح HPL المضغوطة', 'High-pressure Decorative Laminates', ['EN 438', 'HPL']),
 ('ISO 13006 / EN 14411', 'بلاط السيراميك والبورسلين', 'Ceramic Tiles', ['ISO 13006', 'EN 14411']),
 ('ANSI/BIFMA', 'اختبارات الأثاث المكتبي', 'Office Furniture Tests', ['BIFMA']),
 ('ASTM D4157', 'مقاومة القماش للاحتكاك (Wyzenbeek)', 'Fabric Abrasion Resistance', ['ASTM D4157', 'Wyzenbeek', 'مسحة مزدوجة']),
 ('دليل الوصول الشامل', 'دليل الوصول الشامل (المملكة العربية السعودية)', 'Universal Access Guide (KSA)', ['الوصول الشامل', 'ذوي الإعاقة']),
 ('ADA 2010', 'معايير ADA لسهولة الوصول', 'ADA Standards for Accessible Design', ['ADA']),
 ('SASO', 'المواصفات القياسية السعودية واللوائح الفنية', 'Saudi Standards and Technical Regulations', ['SASO']),
 ('ICRA', 'تقييم مخاطر مكافحة العدوى أثناء الأعمال', 'Infection Control Risk Assessment', ['ICRA', 'مكافحة العدوى']),
 ('CBAHI', 'معايير المجلس المركزي لاعتماد المنشآت الصحية', 'CBAHI Accreditation Standards', ['سباهي', 'CBAHI']),
 ('MDMA', 'تسجيل الأجهزة الطبية — الهيئة العامة للغذاء والدواء', 'SFDA Medical Device Marketing Authorization', ['MDMA']),
]
for c, t, e, tk in EXT:
  STD.append(dict(code=c, kind='external', title=t, en=e, owner='', support=[], version='', status='active', scope='', summary='', file='', link='', tokens=tk, clauses=[]))

# ---------- المواد والمصنّعون المعتمدون
MAT = [
 ('M-01', 'الأبواب والأقفال', 'الأبواب المعدنية والمقاومة للحريق', ['HÖRMANN', 'الكحيمي', 'الدريس'], 'ضلفة 1.6 مم وحلق 2.0 مم', 'list', ['LS-54', 'LS-10'], ['ANSI/SDI A250.8', 'UL 723 / ASTM E84']),
 ('M-02', 'الأبواب والأقفال', 'إكسسوارات الأبواب (مفصلات، مغلقات، أجهزة خروج)', [], 'درجة ANSI/BHMA Grade 1 لكل الإكسسوارات', 'eq', ['LS-54', 'LS-10'], ['ANSI/BHMA A156']),
 ('M-03', 'الأبواب والأقفال', 'الأقفال الإلكترونية', ['SALTO'], 'XS4 Original Wide · PBE900 — عبر الموزّع المعتمد فقط', 'only', ['LS-54'], []),
 ('M-04', 'الأبواب والأقفال', 'الأبواب الأوتوماتيكية', ['Dorma'], 'EL 301 للاستخدام الكثيف، Fail-safe، بطارية ساعة', 'eq', ['LS-55', 'LS-11'], ['EN 16005']),
 ('M-05', 'الحماية والأرضيات والأسقف', 'حماية الجدران والزوايا', ['Acrovyn', 'Gerflor'], 'CS Group Acrovyn، وزوايا بارتفاع 1.5 م', 'eq', ['LS-62', 'LS-09'], ['UL 723 / ASTM E84']),
 ('M-06', 'الحماية والأرضيات والأسقف', 'الأرضيات الفينيل الطبي المتجانس', ['Gerflor'], 'Mipolam (Infinity) 2 مم', 'only', ['LS-58', 'LS-06'], []),
 ('M-07', 'الحماية والأرضيات والأسقف', 'البورسلين', ['EXA'], '', 'only', ['LS-59'], ['ISO 13006 / EN 14411']),
 ('M-08', 'الحماية والأرضيات والأسقف', 'الأسقف المستعارة', ['USG', 'MADA'], 'البلاط والشبكة من المنظومة نفسها', 'only', ['LS-60', 'LS-07'], []),
 ('M-09', 'الحماية والأرضيات والأسقف', 'ممسحة المدخل', ['emco'], 'MARSCHALL Premium Large + Care', 'eq', ['LS-53'], []),
 ('M-10', 'الحماية والأرضيات والأسقف', 'الدرابزين ومقابض الجدران', [], 'ستانلس ستيل 304', 'eq', ['LS-53'], []),
 ('M-11', 'دورات المياه', 'قواطع الحمامات', ['Bobrick', 'Fundermax'], 'Compact HPL 19 مم', 'list', ['LS-63', 'LS-14'], ['EN 438']),
 ('M-12', 'دورات المياه', 'إكسسوارات الحمامات والموزعات', ['Bobrick'], 'B-6806, B-4998, B-750, B-4388, B-43644, B-3942, B-6827, B-26627, B-26628', 'only', ['LS-63', 'LS-64'], ['ADA 2010']),
 ('M-13', 'دورات المياه', 'طاولة تغيير الحفاضات', ['Koala Kare'], 'KB310-SSRE', 'eq', ['LS-63'], []),
 ('M-14', 'دورات المياه', 'الأطقم الصحية والخلاطات', ['Ideal Standard', 'Grohe'], '', 'only', ['LS-67', 'LS-74'], []),
 ('M-15', 'دورات المياه', 'الخزانات المخفية', ['Geberit'], '', 'eq', ['LS-74'], []),
 ('M-16', 'المصاعد', 'المصاعد', ['Schindler'], '5000 (MRL)', 'only', ['LS-69'], []),
 ('M-17', 'الأنظمة التقنية', 'الشاشات الرقمية', ['Samsung', 'Navori'], 'QMC (القياسي)، QHC، QBC — مربوطة بمنصة Navori', 'eq', ['LS-85'], ['AAHC-FM-STD-DIGITAL-SIGNAGE-001']),
 ('M-18', 'الأنظمة التقنية', 'الإذاعة الداخلية والإخلاء الصوتي', ['Bosch', 'DSPPA'], 'Praesideo / Plena', 'list', ['LS-85'], []),
 ('M-19', 'الأنظمة التقنية', 'إنذار الحريق العنواني', ['Gent'], 'Gent من Honeywell، مربوط بالمراقبة المركزية', 'list', ['LS-86', 'LS-21'], ['NFPA 72', 'SBC 801']),
 ('M-20', 'الأنظمة التقنية', 'كاميرات المراقبة', ['Hikvision', 'Huawei', 'Belden'], 'Ultra Series Smart IP، مفاتيح PoE، Cat6A', 'list', ['LS-87'], []),
 ('M-21', 'الأنظمة التقنية', 'الشبكات والاتصالات', ['Legrand', 'Huawei', 'AVAYA'], 'IP Office 500', 'list', ['LS-83', 'LS-84', 'LS-20'], ['TIA/EIA-568']),
 ('M-22', 'الأنظمة التقنية', 'استدعاء التمريض (المراكز الصغيرة)', ['SOLT'], 'لاسلكي', 'eq', ['LS-88'], []),
 ('M-23', 'مكافحة الحريق', 'الرشاشات والمضخات والكبائن', ['Lifeco', 'NAFCO', 'SFFECO'], 'معتمدة UL/FM والدفاع المدني', 'list', ['LS-70', 'LS-71', 'LS-72', 'LS-24'], ['NFPA 13', 'NFPA 20', 'NFPA 10']),
 ('M-24', 'مكافحة الحريق', 'الإطفاء بالغاز النظيف', ['FM200', 'Novec 1230'], 'لغرفتي الكهرباء والاتصالات', 'list', ['LS-72'], ['NFPA 2001']),
 ('M-25', 'الميكانيكا', 'السخانات والمضخات', ['A.O. Smith', 'Grundfos'], '', 'list', ['LS-75', 'LS-26'], []),
 ('M-26', 'الميكانيكا', 'التكييف والتهوية', ['York', 'LG', 'Gree', 'Greenheck', 'Loren Cook', 'Armaflex'], 'York DEH 360 للوحدات المركزية', 'list', ['LS-77', 'LS-78', 'LS-22'], ['ASHRAE 170', 'SMACNA']),
 ('M-27', 'الكهرباء', 'اللوحات والقواطع والكابلات', ['ABB', 'Schneider', 'كابلات الرياض'], '', 'list', ['LS-79', 'LS-19'], ['IEC 61439']),
 ('M-28', 'الكهرباء', 'المخارج والإنارة', ['Legrand', 'MK', 'PROlight', 'PHILIPS', 'LEDVANCE'], '', 'list', ['LS-80', 'LS-18'], []),
 ('M-29', 'الكهرباء', 'التأريض', ['ABB', 'VERSE'], '', 'list', ['LS-81'], ['IEC 60364-7-710']),
 ('M-30', 'الكهرباء', 'الطاقة غير المنقطعة (UPS)', ['EATON'], 'On-Line Double Conversion', 'eq', ['LS-82'], []),
 ('M-31', 'الموقع العام', 'الري', ['RainBird'], '', 'only', ['LS-91', 'LS-29'], []),
 ('M-32', 'الأثاث', 'الأثاث غير الطبي والمكتبي', ['Herman Miller', 'Global', 'OFS', 'Steelcase'], 'تقارير BIFMA وضمان ممتد', 'list', ['LS-93', 'LS-34'], ['ANSI/BIFMA', 'ASTM D4157']),
 ('M-33', 'الإنشاءات', 'الخرسانة الجاهزة', ['العفالق', 'الكفاح', 'الناصر', 'الإبراهيم'], 'أسمنت مقاوم للكبريتات للخرسانة الملامسة للتربة', 'eq', ['LS-46', 'LS-47'], ['SBC 304']),
 ('M-34', 'الإنشاءات', 'البلوك', ['الإبراهيم', 'الناصر', 'أبتك', 'الكفاح'], '', 'eq', ['LS-49'], []),
 ('M-35', 'الإنشاءات', 'العزل الحراري والمائي', ['الجفالي', 'درع الصحراء', 'إيزوماكس', 'ديرمابت'], 'XPS 50 مم، لفائف بيتومين 4 مم', 'eq', ['LS-50', 'LS-51', 'LS-46'], []),
 ('M-36', 'التشطيبات', 'الدهانات', ['جوتن', 'الجزيرة', 'همبل'], '', 'list', ['LS-61', 'LS-08'], []),
 ('M-37', 'التشطيبات', 'الزجاج والجدار الساتر', ['Guardian', 'Dow Corning'], 'Low-E، فاصل حراري، سيليكون إنشائي 995', 'eq', ['LS-56', 'LS-11'], ['SBC 601', 'ASTM E283/E330/E331']),
 ('M-38', 'الميكانيكا', 'مواسير التغذية والصرف', ['الوطنية للبلاستيك', 'السعودية للمسبوكات'], 'PPR، HDPE، UPVC Class 4', 'eq', ['LS-73', 'LS-23'], []),
]

rows = []
for s in STD:
  rows.append(f"insert into public.standards (code,kind,title,en,owner,support,version,status,scope,summary,file,link,tokens,clauses,sort) values ({q(s['code'])},{q(s['kind'])},{q(s['title'])},{q(s['en'])},{q(s['owner']) if s['owner'] else 'null'},{arr(s['support'])},{q(s['version'])},{q(s['status'])},{q(s['scope'])},{q(s['summary'])},{q(s['file'])},{q(s['link'])},{arr(s['tokens'])},{js(s['clauses'])},{len(rows)*10}) on conflict (code) do nothing;")
mrows = []
for i, (c, cat, name, makers, spec, rule, ls, stds) in enumerate(MAT):
  mrows.append(f"insert into public.materials (code,category,name,makers,spec,rule,ls_codes,std_codes,sort) values ({q(c)},{q(cat)},{q(name)},{arr(makers)},{q(spec)},{q(rule)},{arr(ls)},{arr(stds)},{(i+1)*10}) on conflict (code) do nothing;")

sql = """-- 0074: سجل المعايير (للتجمع والمرجعية) وسجل المواد والمصنّعين المعتمدين — مصدر واحد تُربط به البنود والاشتراطات والقواعد والأدلة
create table if not exists public.standards (code text primary key, kind text not null default 'internal' check (kind in ('internal','external')), title text not null, en text not null default '',
  owner text references public.gov_units(code), support text[] not null default '{}', version text not null default '', status text not null default 'active' check (status in ('draft','active','approved','superseded')),
  issued_at date, scope text not null default '', summary text not null default '', file text not null default '', link text not null default '', tokens text[] not null default '{}', clauses jsonb not null default '[]',
  sort int not null default 0, active boolean not null default true, updated_at timestamptz not null default now());
create table if not exists public.materials (code text primary key, category text not null default '', name text not null, makers text[] not null default '{}', spec text not null default '',
  rule text not null default 'list' check (rule in ('only','list','eq')), ls_codes text[] not null default '{}', std_codes text[] not null default '{}', notes text not null default '',
  sort int not null default 0, active boolean not null default true, updated_at timestamptz not null default now());
create table if not exists public.std_links (id bigserial primary key, std_code text not null references public.standards(code) on delete cascade, kind text not null, key text not null, note text not null default '', unique (std_code, kind, key));
do $$ declare t text; begin
  foreach t in array array['standards','materials','std_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists p_read on public.%I', t); execute format('create policy p_read on public.%I for select using (auth.uid() is not null)', t);
    execute format('drop policy if exists p_admin on public.%I', t); execute format('create policy p_admin on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  if exists (select 1 from public.seed_marks where key = 'standards_v1') then return; end if;
""" + "\n".join(rows) + "\n" + "\n".join(mrows) + """
  insert into public.std_links (std_code, kind, key) values
    ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','rule','R-46'), ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','ho','HO-26'), ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','ls','LS-85'),
    ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','manual','design'), ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','manual','om'), ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','manual','user'), ('AAHC-FM-STD-DIGITAL-SIGNAGE-001','manual','contractor'),
    ('AHC-DSG','rule','R-44'), ('AHC-CTR','rule','R-43'), ('AHC-CODE','rule','R-16'), ('AHC-CODE','ho','HO-16'), ('AHC-CODE','ho','HO-17'), ('AHC-PRJ-HO','rule','R-42'), ('AHC-PRJ-HO','rule','R-07')
    on conflict do nothing;
  insert into public.seed_marks (key) values ('standards_v1');
end $$;
"""
open('/home/claude/platform/supabase/migrations/0074_standards_materials.sql', 'w').write(sql)
print(len(STD), len(MAT))
