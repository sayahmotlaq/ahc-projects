# -*- coding: utf-8 -*-
# مولّد دليل المواصفات المعتمدة للمتبرعين والمقاولين — HTML ثم PDF عبر Playwright
import html, os
D = os.path.dirname(os.path.abspath(__file__))
FD = '/root/.fonts/'
E = html.escape

BADGE = {
  'HD': ('Heavy Duty', 'استخدام شاق'), 'HT': ('High Traffic', 'حركة كثيفة'), 'DIS': ('Disinfectant‑Resistant', 'يتحمّل المطهرات'),
  'HYG': ('Hygienic', 'سطح صحي غير مسامي'), 'FIRE': ('Fire‑Rated', 'مقاوم للحريق'), 'G1': ('ANSI/BHMA Grade 1', 'أعلى درجة'),
  '247': ('24/7', 'تشغيل متواصل'), 'UNI': ('Standardized', 'موحّد مع منظومة التجمع'), 'ADA': ('Accessible', 'سهولة الوصول'),
  'WAR': ('Long Warranty', 'ضمان ممتد'),
}
def badges(ks): return '<div class="bdg">' + ''.join(f'<span class="b b-{k}"><b>{E(BADGE[k][0])}</b><i>{E(BADGE[k][1])}</i></span>' for k in ks) + '</div>'
def refs(rs): return ' '.join(f'<sup class="rf">[{r}]</sup>' for r in rs)

# كل بند: code, title, en, rule('only'|'list'|'eq'), approved, badges, rows[(prop, market, approved)], why, risk, submit[], refs
SECTIONS = [
 ('الأبواب والأقفال والإكسسوارات المعدنية', 'door', 'أكثر عناصر المبنى حركةً؛ الباب في ممر مستشفى يُفتح مئات المرات يومياً ويصطدم به السرير والعربة والكرسي المتحرك.', [
  dict(code='LS-54', title='الأبواب المعدنية والمقاومة للحريق', en='Hollow Metal & Fire‑Rated Doors', rule='list',
    approved='HÖRMANN أو الكحيمي أو الدريس', bd=['HD', 'HT', 'FIRE'],
    rows=[('سماكة ضلفة الباب', '0.8 – 1.2 مم غالباً', '1.6 مم (Gauge 16) — فئة «Extra Heavy Duty» في ANSI/SDI A250.8'),
          ('سماكة الحلق (الإطار)', '1.2 – 1.5 مم', '2.0 مم (Gauge 14)'),
          ('أبواب الحريق', 'ملصق غير موثّق أو باب عادي بمظهر مشابه', 'باب مُختبَر ومعلّم بملصق جهة اختبار معتمدة للمدة المطلوبة، ومطابق لشهادته بالكامل (الحلق والمفصلات والقفل والمغلاق)'),
          ('التشطيب', 'دهان عادي', 'دهان بودرة مخبوز يتحمّل التنظيف المتكرر'),
          ('حماية أسفل الباب', 'لا يوجد', 'لوح حماية (Kick Plate) بارتفاع 90 سم من CS Group')],
    why='الضلفة الرقيقة تنبعج من أول اصطدامات الأسرّة والعربات، فينحرف الباب ويختلّ إحكام القفل والمغلاق. وباب الحريق ليس «باباً سميكاً» فقط؛ هو منظومة مختبرة كاملة، وأي تغيير في مكوّن منها يُسقط تصنيفها.',
    risk='انبعاج وتقشّر خلال أشهر، وأبواب حريق لا تُغلق ذاتياً أو تسرّب الدخان، وملاحظات في زيارات الدفاع المدني والاعتماد (سباهي) تستوجب الاستبدال.',
    submit=['شهادة اختبار الحريق وصورة الملصق', 'كتالوج يوضّح السماكات والحشوة', 'عينة مقطع من الضلفة', 'جدول الأبواب والإكسسوارات (Door Schedule)'], refs=[]),
  dict(code='LS-54', title='المفصلات والمغلقات ومقابض الطوارئ', en='Door Hardware — ANSI/BHMA Grade 1', rule='eq',
    approved='درجة ANSI/BHMA Grade 1 لكل الإكسسوارات', bd=['G1', 'HD', 'HT'],
    rows=[('المفصلات (A156.1)', 'Grade 3: نحو 350,000 دورة', 'Grade 1: 2,500,000 دورة'),
          ('مغلقات الأبواب (A156.4)', 'Grade 3: نحو 500,000 دورة', 'Grade 1: 2,000,000 دورة'),
          ('أقفال الغاطس Mortise (A156.13)', 'Grade 3: نحو 800,000 دورة', 'Grade 1: 1,000,000 دورة + اختبارات قوة أعلى'),
          ('الأقفال الأسطوانية (A156.2)', 'Grade 3: نحو 200,000 دورة', 'Grade 1: 1,000,000 دورة'),
          ('أجهزة الخروج Panic (A156.3)', 'Grade 3: نحو 100,000 دورة', 'Grade 1: 500,000 دورة')],
    why='الدورة = فتحة وإغلاقة واحدة. باب ممر يُستخدم 300 مرة يومياً يستهلك أكثر من 100,000 دورة في السنة؛ أي أن إكسسوار الدرجة الثالثة قد ينتهي عمره الافتراضي في سنوات قليلة، بينما صُمّمت الدرجة الأولى للمباني التجارية والمؤسسية الكثيفة.',
    risk='مغلقات تسرّب الزيت وتصفق الأبواب، ومفصلات تهبط فيحتكّ الباب بالأرض، ومقابض طوارئ تتعطل في أخطر لحظة.',
    submit=['شهادة BHMA أو تقرير اختبار يذكر الدرجة صراحةً لكل صنف', 'كتالوج الموديل المورَّد'], refs=[1]),
  dict(code='LS-54', title='الأقفال الإلكترونية SALTO', en='SALTO XS4 Original Wide · PBE900 Panic', rule='only',
    approved='SALTO XS4 Original Wide للأقفال، وPBE900 لأبواب الطوارئ — عبر الموزّع المعتمد فقط', bd=['UNI', 'HD'],
    rows=[('طريقة الدخول', 'مفتاح ميكانيكي أو قفل إلكتروني منزلي/فندقي', 'بطاقة دخول ضمن منظومة صلاحيات مركزية مع Master Key'),
          ('إدارة الصلاحيات', 'نسخ المفاتيح وفقدها، لا يمكن سحب الصلاحية', 'تُمنح وتُسحب الصلاحية بالبطاقة فوراً'),
          ('سجل الدخول', 'لا يوجد', 'سجل تدقيق داخل القفل (650 – 1,000 حدث)'),
          ('البطارية', '—', '3 بطاريات AA تكفي نحو 40,000 – 60,000 فتحة'),
          ('التوريد والبرمجة', 'أي مورّد', 'الموزّع المعتمد فقط: البرمجة والترخيص والضمان')],
    why='غرف الأدوية والسجلات الطبية وغرف الخوادم والمستودعات تحتاج ضبط وصول موثّقاً. ووجود منظومة واحدة في كل منشآت التجمع يعني بطاقة واحدة للموظف، وبرمجيات واحدة، وفريق صيانة واحد.',
    risk='قفل خارج المنظومة لا يمكن ربطه ولا إدارته، فيبقى جزيرة منفصلة ويُستبدل عند أول تشغيل. والتوريد من غير الموزّع المعتمد قد يعني عدم القدرة على البرمجة أو فقدان الضمان.',
    submit=['خطاب الموزّع المعتمد لـ SALTO', 'جدول الأقفال لكل باب', 'تأكيد التوافق مع منظومة التجمع القائمة'], refs=[2]),
  dict(code='LS-55', title='الباب الأوتوماتيكي المنزلق', en='dormakaba (Dorma) EL 301 — Heavy Use', rule='eq',
    approved='Dorma EL 301 أو ما يعادله بعد الاعتماد', bd=['HD', 'HT', '247'],
    rows=[('فئة المحرك', 'محرك تجاري خفيف', 'محرك مخصص للاستخدام الكثيف المتواصل'),
          ('عند انقطاع الكهرباء', 'قد يتوقف مغلقاً', 'آلية Fail‑safe بالفتح، مع بطارية احتياطية لمدة ساعة'),
          ('السلامة', 'حساس حركة بسيط', 'حساسات حركة وأمان وفق متطلبات EN 16005 للأبواب الآلية'),
          ('الخدمة', 'لا وكيل محلي', 'وكيل معتمد وقطع غيار متوفرة')],
    why='المدخل الرئيسي يمر منه المرضى والزوار والأسرّة على مدار الساعة، وقد يكون مسار إخلاء. الباب يجب أن يفتح بأمان، ولا يغلق على مريض أو كرسي متحرك، ويفتح تلقائياً عند الطوارئ.',
    risk='أعطال متكررة في مدخل لا يمكن إغلاقه، وخطر انحباس أو اصطدام، وتعطّل مسار الإخلاء.',
    submit=['كتالوج المحرك وفئة الاستخدام', 'شهادة المطابقة لمعايير الأبواب الآلية', 'مخطط التركيب والحساسات'], refs=[]),
 ]),
 ('حماية الجدران والأرضيات والأسقف', 'shield', 'الأسطح التي يلمسها السرير والعربة والمطهّر كل يوم. معيارها ليس الشكل يوم التسليم، بل الحال بعد خمس سنوات من التنظيف اليومي.', [
  dict(code='LS-62', title='حماية الجدران والزوايا', en='Acrovyn Wall Protection (CS Group)', rule='eq',
    approved='Acrovyn من CS Group، ويُقبل Gerflor', bd=['HD', 'DIS', 'FIRE', 'HYG'],
    rows=[('المادة', 'زوايا ألمنيوم أو PVC رقيق، أو الاكتفاء بالدهان', 'ألواح وزوايا Acrovyn بسماكة 1.02 – 1.9 مم'),
          ('ارتفاع حماية الزوايا', 'قطع قصيرة', '1.5 م'),
          ('السلوك عند الحريق', 'غير مصنّف', 'Class A وفق UL 723 / ASTM E84'),
          ('التنظيف', 'يتشقق أو يصفرّ مع المطهرات', 'يتحمّل منظّفات المستشفيات المعتمدة'),
          ('التركيب', 'لاصق أو سيليكون', 'نظام تثبيت المصنّع')],
    why='الجدار المكسور أو المقشّر ليس مشكلة شكل فقط؛ هو سطح لا يمكن تطهيره ويتجمع فيه الغبار والبكتيريا، وإصلاحه المتكرر يعني إغلاق الممرات وتكلفة تشغيل دائمة.',
    risk='تكسّر الزوايا والجبس خلال السنة الأولى، ودهان متكرر، وملاحظات مكافحة العدوى.',
    submit=['Data Sheet بالسماكات وتصنيف الحريق', 'عينة اللون', 'تفاصيل التثبيت'], refs=[3]),
  dict(code='LS-58', title='الأرضيات الفينيل المتجانسة', en='Gerflor Mipolam (Infinity) 2 mm Homogeneous', rule='only',
    approved='Gerflor Mipolam متجانس 2 مم', bd=['HT', 'HYG', 'DIS', 'HD'],
    rows=[('نوع المادة', 'فينيل غير متجانس أو SPC/LVT بتعشيق، بطبقة سطحية رقيقة', 'فينيل متجانس 2 مم: اللون والمادة في كامل السماكة'),
          ('مقاومة الاحتكاك', 'غير موضّحة', 'أعلى فئة تآكل (Wear group T)'),
          ('الفواصل', 'فواصل مفتوحة بين القطع', 'لحام حراري للفواصل + رفع الأرضية على الجدار (Coving)'),
          ('الصيانة', 'يحتاج تشميعاً دورياً', 'معالجة Evercare: بلا تشميع طوال العمر'),
          ('النظافة', '—', 'مثبّط للبكتيريا والفطريات، ومقاوم لبقع الدم واليود'),
          ('مقاومة الانزلاق', 'غير موضّحة', 'PTV أعلى من 36')],
    why='الأرضية في المستشفى تُغسل يومياً بالمطهرات وتمر عليها العجلات باستمرار. الفاصل المفتوح يجمع السوائل والبكتيريا، والطبقة السطحية الرقيقة تتآكل فيظهر ما تحتها.',
    risk='انفصال القطع تحت العجلات، وبقع دائمة، وتجمع الأوساخ في الفواصل والزوايا، واستبدال كامل للأرضية.',
    submit=['Data Sheet الأصلي للمنتج', 'عينة واللون المعتمد', 'خطاب الوكيل وتأهيل فريق التركيب واللحام'], refs=[4]),
  dict(code='LS-59', title='بلاط البورسلين', en='EXA Porcelain', rule='only',
    approved='EXA حسب ما في جدول الكميات', bd=['HT', 'UNI'],
    rows=[('الفئة', 'سيراميك أو بورسلين مطلي يظهر لونه الداخلي عند الكسر', 'البورسلين المحدد في الجدول — امتصاص ماء ≤ 0.5% (فئة BIa)'),
          ('الدفعة واللون', 'دفعات مختلفة وألوان متفاوتة', 'دفعة واحدة موثّقة'),
          ('الاستبدال لاحقاً', 'صعب إيجاد بلاطة مطابقة', 'منتج متوفر يسهل الاستبدال منه في الصيانة')],
    why='الاعتماد يضمن ثبات اللون والمقاس وتوفّر البلاط للصيانة مستقبلاً، فلا تتحول كل بلاطة مكسورة إلى رقعة مختلفة.',
    risk='تفاوت الألوان، وصعوبة الاستبدال، وتشقق الحواف في مناطق العربات.', submit=['Data Sheet وعينة', 'رقم الدفعة'], refs=[]),
  dict(code='LS-60', title='الأسقف المستعارة', en='USG or MADA Ceiling Systems', rule='only',
    approved='USG أو MADA (البلاط والشبكة من المنظومة نفسها)', bd=['HYG', 'FIRE'],
    rows=[('البلاط', 'ألياف معدنية منخفضة الكثافة', 'بلاط مقاوم للرطوبة والترهّل وقابل للمسح'),
          ('الشبكة', 'شبكة رقيقة غير متوافقة مع البلاط', 'شبكة من نفس المنظومة'),
          ('الحريق', 'غير موضّح', 'تصنيف حريق موثّق')],
    why='الأسقف في المنشأة الصحية تُفتح كثيراً لصيانة التكييف والكهرباء، ويجب ألا تتبقع أو تترهل مع الرطوبة، وأن تبقى قابلة للتنظيف.',
    risk='بلاط مترهل ومتبقع خلال سنة، وتساقط عند الصيانة.', submit=['Data Sheet البلاط والشبكة', 'عينة'], refs=[]),
  dict(code='LS-53', title='ممسحة المدخل', en='emco MARSCHALL Premium Large + Care insert', rule='eq',
    approved='emco MARSCHALL Premium Large مع إدخال Care و517 PSL Care B', bd=['HT', 'HD'],
    rows=[('النوع', 'سجادة سطحية أو مطاطية فوق الأرضية', 'ممسحة مدمجة في حفرة بالأرضية بإطار وبروفيلات ألمنيوم'),
          ('الحركة', 'تتحرك وتتجعد مع العجلات', 'مستوية مع الأرضية ومناسبة للكراسي المتحركة والعربات'),
          ('الوظيفة', 'شكلية', 'تحتجز الأتربة والرطوبة عند الباب')],
    why='الأتربة الداخلة من المدخل هي أكبر سبب لتآكل الأرضيات داخل المنشأة، والسجادة السطحية خطر تعثّر.',
    risk='تعثّر المرضى، وتآكل أسرع للأرضيات، وتنظيف أكثر.', submit=['Data Sheet ومخطط الحفرة والمقاسات'], refs=[5]),
  dict(code='LS-53', title='الدرابزين ومقابض الجدران', en='Stainless Steel 304 Handrails', rule='eq',
    approved='ستانلس ستيل 304', bd=['DIS', 'HD'],
    rows=[('المادة', 'حديد مدهون أو ستانلس 201', 'ستانلس ستيل 304'),
          ('مع المطهرات', 'يصدأ ويتبقّع مع الكلور', 'مقاوم للتآكل')],
    why='الدرابزين يلمسه كل زائر ويُمسح بالمطهرات يومياً. ستانلس 201 يشبه 304 في المظهر لكنه أقل مقاومة للتآكل.',
    risk='صدأ وبقع خلال أشهر.', submit=['شهادة المادة (Mill Certificate) تذكر الدرجة 304'], refs=[]),
 ]),
 ('دورات المياه', 'drop', 'أكثر المناطق رطوبةً وتنظيفاً واستخداماً. كل مادة تمتص الماء أو تصدأ ستظهر مشكلتها في السنة الأولى.', [
  dict(code='LS-63', title='القواطع وأبواب الحمامات', en='Compact HPL 19 mm (Bobrick or Fundermax)', rule='list',
    approved='Bobrick أو Fundermax', bd=['HYG', 'DIS', 'HD'],
    rows=[('المادة', 'MDF أو خشب حبيبي مغطى بميلامين، أو كومباكت 12 مم', 'Compact HPL مصمت بسماكة 19 مم (EN 438‑4)'),
          ('مع الماء', 'ينتفخ ويتفكك من الأطراف', 'لا يتأثر بالماء والرطوبة'),
          ('الإكسسوارات', 'مفصلات وأرجل خفيفة', 'مفصلات وأرجل ستانلس ستيل من النظام نفسه')],
    why='القاطع يُغسل يومياً ويتعرض للماء المباشر. المواد الخشبية تنتفخ والطبقة السطحية تنفصل.',
    risk='انتفاخ الأطراف وتفكك المفصلات خلال أشهر، واستبدال كامل للقواطع.', submit=['Data Sheet وشهادة EN 438', 'مخطط الورشة'], refs=[]),
  dict(code='LS-63', title='إكسسوارات الحمامات', en='Bobrick Washroom Accessories', rule='only',
    approved='Bobrick (B‑6806, B‑4998, B‑750, B‑4388, B‑43644, B‑3942, B‑6827)', bd=['DIS', 'ADA', 'HD', 'UNI'],
    rows=[('المادة', 'زنك مطلي بالكروم أو ستانلس 201', 'ستانلس ستيل 304 بتشطيب ساتان'),
          ('مقابض الإسناد', 'تثبيت سطحي ضعيف', 'قضبان إسناد تتجاوز متطلب ADA (250 رطل‑قوة)'),
          ('قطع الغيار والمفاتيح', 'غير موحدة', 'موحّدة في كل منشآت التجمع')],
    why='مقبض الإسناد يتكئ عليه مريض أو كبير سن بكامل وزنه؛ سقوطه حادث. والإكسسوار الموحّد يعني قطع غيار ومفاتيح واحدة لفريق الصيانة.',
    risk='صدأ وكسر، وموزعات لا تقبل العبوات المعتمدة، وخطر على سلامة المرضى.', submit=['قائمة الموديلات مطابقة للجدول', 'كتالوج كل موديل'], refs=[]),
  dict(code='LS-63', title='طاولة تغيير الحفاضات', en='Koala Kare KB310‑SSRE', rule='eq',
    approved='Koala Kare KB310‑SSRE أو ما يعادله بعد الاعتماد', bd=['HYG', 'HD'],
    rows=[('التركيب', 'طاولة بلاستيكية سطحية', 'مدمجة في الجدار (Recessed) بغلاف ستانلس ستيل'),
          ('السرير', 'بلاستيك عادي', 'معالج بمادة Microban المضادة للميكروبات'),
          ('التحمّل والضمان', 'غير موضّح', 'حمل 136 كجم (300 رطل) وضمان 5 سنوات')],
    why='سطح يلامسه الأطفال مباشرة ويُطهّر بعد كل استخدام.', risk='كسر المفصلات وسقوط الطاولة.', submit=['Data Sheet'], refs=[6]),
  dict(code='LS-67', title='المغاسل والخلاطات', en='Solid Surface Counters · Ideal Standard / Grohe Mixers', rule='only',
    approved='الخلاطات: Ideal Standard أو Grohe — الأسطح: Solid Surface', bd=['HYG', 'DIS'],
    rows=[('سطح المغسلة', 'رخام صناعي أو خشب مغلف', 'Solid Surface بلا فواصل ظاهرة وغير مسامي، وأدراج بإغلاق هادئ'),
          ('الخلاط', 'سبائك زنك وخراطيش غير قياسية', 'نحاس بخراطيش سيراميك وقطع غيار متوفرة لدى الوكيل')],
    why='المغسلة نقطة نظافة اليدين الأولى في مكافحة العدوى؛ السطح المسامي يحتفظ بالبكتيريا، والخلاط الذي يسرّب يعطّل المغسلة.',
    risk='تسرّب وتكلّس وصعوبة إيجاد قطع الغيار.', submit=['Data Sheet ورقم الموديل'], refs=[]),
  dict(code='LS-74', title='الخزانات المخفية', en='Geberit Concealed Cisterns', rule='eq',
    approved='Geberit', bd=['UNI', 'WAR'],
    rows=[('قطع الغيار', 'غير مضمونة', 'ضمان توفّر قطع الغيار 50 سنة'),
          ('الصيانة', 'تكسير البلاط للوصول للخزان', 'صيانة من فتحة لوحة الدفع دون تكسير')],
    why='الخزان المخفي داخل الجدار؛ إذا تعطّل ولم تتوفر قطعه يعني تكسير التشطيبات.',
    risk='تكسير البلاط والجدار لإصلاح عطل بسيط.', submit=['Data Sheet ولوحة الدفع'], refs=[7]),
 ]),
 ('المصاعد', 'lift', 'المصعد في المنشأة الصحية ينقل المرضى والأسرّة والطوارئ، وتوقّفه يوقف الخدمة.', [
  dict(code='LS-69', title='المصاعد', en='Schindler 5000 (MRL)', rule='only',
    approved='Schindler 5000', bd=['UNI', 'HT', '247'],
    rows=[('المنتج', 'مصعد مجمّع من مكونات متعددة المصادر', 'Schindler 5000 بدون غرفة ماكينات (MRL)'),
          ('الصيانة', 'مورّد غير مرتبط بالمصنع', 'وكيل معتمد وقطع غيار أصلية وعقد صيانة'),
          ('التوحيد', 'نظام مختلف عن باقي المنشآت', 'توحيد الصيانة وقطع الغيار مع منشآت التجمع')],
    why='تعدد أنواع المصاعد يعني تعدد عقود الصيانة وقطع الغيار وتأخر الإصلاح.', risk='توقف طويل بانتظار قطع غير متوفرة.',
    submit=['العرض الفني من الوكيل', 'شهادات المطابقة والتسليم'], refs=[8]),
 ]),
]

MEP = [
  ('LS-70 – 72', 'مكافحة الحريق', 'Lifeco · NAFCO · SFFECO · سفيكو (الكبائن) · FM200 أو Novec 1230', 'رشاشات ومضخات وكبائن معتمدة UL/FM والدفاع المدني، وإطفاء بالغاز النظيف لغرفتي الكهرباء والاتصالات وفق NFPA 2001 لأن الماء يتلف الأجهزة.'),
  ('LS-75', 'السخانات والمضخات', 'A.O. Smith · Grundfos', 'تشغيل متواصل للمياه الساخنة والضغط، ووكلاء وقطع غيار متوفرة.'),
  ('LS-77 – 78', 'التكييف والتهوية', 'York DEH 360 · LG / Gree / York · Greenheck / Loren Cook · Armaflex', 'توافق مع منظومات التكييف القائمة، ومراوح شفط معتمدة الأداء، وعزل يمنع التكثّف.'),
  ('LS-79 – 81', 'الكهرباء والإنارة', 'ABB / Schneider · كابلات الرياض · Legrand BLANKO أو MK · PROlight (LEDVANCE، PHILIPS، ULTRA LIGHT، Lunor)', 'لوحات وقواطع موثوقة، وكابلات مطابقة للمواصفات السعودية، وإنارة طوارئ مربوطة بالـ UPS بقطع غيار متوفرة.'),
  ('LS-82', 'مزود الطاقة غير المنقطعة', 'EATON', 'حماية الأجهزة الحرجة من انقطاع الكهرباء.'),
  ('LS-83 – 84', 'الشبكات والاتصالات', 'Legrand · Huawei · AVAYA IP Office 500', 'توافق مع شبكة التجمع ونظام الاتصالات القائم.'),
  ('LS-85', 'الإذاعة الداخلية', 'Bosch Praesideo / Plena · DSPPA', 'إذاعة داخلية مربوطة بإنذار الحريق للإخلاء الصوتي، بكابلات LSZH.'),


  ('LS-88', 'استدعاء التمريض (للمراكز الصغيرة)', 'SOLT Wireless', 'الربط مع بقية الأنظمة المعتمدة في المراكز، وتعوّد المستخدمين عليه، وسهولة التركيب لأنه لاسلكي دون تمديدات: أزرار استدعاء (منها المقاوم للماء للحمامات)، وشاشة في محطة التمريض، وأجهزة نداء تُلبس على المعصم، ومدى يصل إلى 150 م. أما المستشفيات فتعتمد أنظمة استدعاء متطورة مختلفة.'),
  ('LS-91', 'الري', 'RainBird', 'تحكم موثوق بالري وقطع غيار متوفرة.'),
]

EXTRA = [
  dict(code='LS-85', title='الشاشات الرقمية وشاشات العرض', en='Samsung QMC Series + Navori — AAHC Digital Signage Standard', rule='eq',
    approved='Samsung QMC (القياسي)، وQHC للمناطق عالية الإضاءة، وQBC للمناطق الإدارية غير الحرجة — مربوطة بمنصة Navori', bd=['247', 'UNI', 'HD'],
    rows=[('نوع الشاشة', 'تلفزيون منزلي (Consumer TV)', 'شاشة عرض تجارية مصممة للتشغيل المتواصل؛ ولا يُركَّب التلفزيون المنزلي في المناطق العامة أو الحرجة'),
          ('الدقة والسطوع', 'غير موضّحة', '4K UHD كحد أدنى، وسطوع 500 nit في سلسلة QMC'),
          ('الضمان', 'ضمان منزلي لا يغطي الاستخدام التجاري', 'ضمان تجاري 3 سنوات يغطي التشغيل 24/7'),
          ('إدارة المحتوى', 'تشغيل محلي من USB', 'منصة Navori إلزامية في المناطق العامة (مشغّل مدمج أو خارجي)؛ للتوعية الصحية وأرقام الدور والتنبيهات الطارئة'),
          ('الكهرباء', 'مقبس واحد وتمديدة ظاهرة', 'مقبسان خلف الشاشة (للشاشة وللمشغّل)، ويُفضَّل ربط أحدهما بالطوارئ/UPS'),
          ('الشبكة', 'اتصال لاسلكي', 'نقطة شبكة سلكية RJ45 لكل شاشة؛ واللاسلكي بموافقة تقنية المعلومات فقط'),
          ('الكابلات', 'أسلاك متدلية ظاهرة', 'كل الكابلات مخفية خلف الشاشة أو في مجارٍ معتمدة'),
          ('الارتفاع والمقاس', 'حسب الاجتهاد', 'حسب جداول المعيار: الانتظار الصغيرة 43–55 بوصة بمنتصف 1.5–1.7 م، والردهة الرئيسية 65–75 بوصة بمنتصف 1.7–2.0 م')],
    why='الشاشة في صالات الانتظار قناة التجمع للتوعية الصحية وإدارة الدور والتنبيهات الطارئة، وتعمل طوال ساعات التشغيل. والربط بمنصة Navori يسمح ببث المحتوى من مكان واحد لكل المنشآت.',
    risk='تلفزيون يتعطل ويسقط ضمانه، وشاشة لا يمكن إدارتها مركزياً، وأسلاك ظاهرة لا تليق بالمنشأة.',
    submit=['Data Sheet الموديل', 'جدول مواقع الشاشات بالمقاسات والارتفاعات', 'تأكيد التوافق مع Navori ونقاط الكهرباء والشبكة'], refs=[17, 9]),
  dict(code='LS-86', title='نظام إنذار الحريق العنواني', en='Gent by Honeywell — Addressable, Online Monitoring', rule='list',
    approved='Gent من Honeywell، مربوط بالشبكة المركزية للمراقبة', bd=['FIRE', 'UNI', '247'],
    rows=[('نوع النظام', 'نظام تقليدي (Conventional) يحدد المنطقة فقط', 'نظام عنواني (Addressable) يحدد الكاشف بعينه'),
          ('المراقبة', 'لوحة محلية لا يراها إلا من في المبنى', 'مربوط بالشبكة المركزية للمراقبة والتحكم عن بُعد (Online web monitoring)'),
          ('الربط مع الأنظمة', 'محدود أو غير موجود', 'إيقاف التكييف وإغلاق مخامد الحريق، والإخلاء الصوتي، وفتح الباب الأوتوماتيكي وأذرع الطوارئ، واستدعاء المصعد'),
          ('الكابلات', 'كابلات عادية', 'كابلات LSZH قليلة الدخان وخالية من الهالوجين'),
          ('الاعتماد', '—', 'معتمد من الدفاع المدني')],
    why='المريض في المنشأة الصحية قد لا يستطيع الإخلاء وحده، فكل دقيقة مهمة. والربط بالمراقبة المركزية يوصل الإنذار إلى غرفة التحكم في التجمع حتى خارج أوقات الدوام.',
    risk='إنذارات لا يُعرف مصدرها بدقة، ونظام معزول لا يراه أحد ليلاً، ورفض في فحص الدفاع المدني.',
    submit=['اعتماد الدفاع المدني للمخططات', 'Data Sheet اللوحة والكواشف', 'مصفوفة الربط مع الأنظمة (Cause & Effect)'], refs=[]),
  dict(code='LS-87', title='كاميرات المراقبة', en='Hikvision Ultra Series Smart IP', rule='list',
    approved='Hikvision Ultra Series Smart IP، مع مفاتيح PoE من Huawei وكابلات Cat6A من Belden', bd=['UNI', '247', 'HD'],
    rows=[('دقة الكاميرا', '2 – 4 ميجابكسل غالباً', '8 ميجابكسل ليلية/نهارية بالأشعة تحت الحمراء'),
          ('الكاميرات الخارجية', 'غير مصنفة', 'Bullet أو PTZ بحماية IP66'),
          ('التسجيل', 'جهاز تسجيل تماثلي أو أقراص عادية', 'NVR شبكي ببحث ذكي (AI) وأقراص مخصصة للمراقبة بسعة تكفي مدة الحفظ'),
          ('الشبكة', 'مفاتيح وكابلات عامة', 'مفاتيح PoE من Huawei وكابلات Cat6A من Belden'),
          ('الاستلام', 'تشغيل فقط', 'اختبار وضوح الصورة ليلاً ونهاراً وزوايا التغطية ومدة التخزين الفعلية')],
    why='الكاميرا تُراجَع عند حادث أو بلاغ، وقيمتها في وضوح الصورة ليلاً ومدة الحفظ. وتوحيد النوع يسمح بربطها بمنظومة المراقبة لدى التجمع.',
    risk='صورة لا تُظهر الوجوه ليلاً، وتسجيل يُمسح قبل المدة المطلوبة، ونظام لا يمكن ربطه.',
    submit=['مخطط توزيع الكاميرات وزوايا التغطية', 'Data Sheet الكاميرا والـ NVR', 'حساب سعة التخزين'], refs=[]),
]

SOURCES = [
  ('Allegion — What are ANSI/BHMA hardware grades?', 'https://kc.allegion.com/kb/article/what-are-ansi-bhma-hardware-grades'),
  ('SALTO — XS4 Original datasheet', 'https://cms.saltosystems.com/sites/default/files/products/download/datasheet-xs4_original_sx6xxk-eng-10-20.pdf'),
  ('Construction Specialties — Acrovyn healthcare wall covering', 'https://www.c-sgroup.com/category/wall-protection/product-selector/healthcare-wall-covering'),
  ('RIBA Journal — Gerflor Mipolam with Evercare treatment', 'https://www.ribaj.com/spec/mipolam-with-evercare-treatment/'),
  ('ArchiExpo — emco MARSCHALL Premium entrance mat', 'https://www.archiexpo.com/prod/emco-bautechnik-gmbh/product-54726-2566842.html'),
  ('KaTom — Koala Kare KB310‑SSRE', 'https://www.katom.com/107-KB310SSRE.html'),
  ('Gulf Construction — Geberit extends parts guarantee to 50 years', 'https://gulfconstructiononline.com/Article/385983/Geberit_extends_parts_guarantee_to_50_years'),
  ('Buildings — Schindler 5000 MRL elevator', 'https://www.buildings.com/products/elevators-escalators/product/55287081/schindler-elevator-corp-this-machine-room-less-mrl-elevator-features-taller-cars-larger-entrances-and-higher-load-capacities'),
  ('Crown TV — Samsung QMC series', 'https://crowntv-us.com/blog/samsung-qmc-series-2025/'),
  ('Herman Miller — Warranty', 'https://www.hermanmiller.com/warranty/'),
  ('Global Furniture Group — Warranty', 'https://www.eandi.org/wp-content/uploads/Global_warranty_8.20.pdf'),
  ('OFS — Warranty', 'https://imagineaplace.ofs.com/page/warranty'),
  ('Steelcase — Warranty FAQ', 'https://steelcase.com/resources/documents/faq-warranty'),
  ('U.S. Defense Health Agency — DHA 12 52 00 Healthcare Seating', 'https://www.wbdg.org/FFC/DHA/DHA%2012%2052%2000.pdf'),
  ('Brentano — Abrasion (ACT guidelines)', 'https://brentanofabrics.com/faqs/abrasion/'),
  ('SOLT — Patient‑Nurse Wireless Calling System', 'https://www.solteurope.com/pages/patient-nurse-wireless-calling-system'),
  ('تجمع الأحساء الصحي — معيار تركيب الشاشات الرقمية والتلفزيونات AAHC-FM-STD-DIGITAL-SIGNAGE-001 (الإصدار 0 — مسودة)، مالكه إدارة المرافق', '')
]
STANDARDS = ['AAHC-FM-STD-DIGITAL-SIGNAGE-001 — معيار التجمع للشاشات الرقمية', 'ANSI/SDI A250.8 — الأبواب والحلوق المعدنية', 'ANSI/BHMA A156.1 / .2 / .3 / .4 / .13 — إكسسوارات الأبواب', 'EN 16005 — سلامة الأبواب الآلية',
  'UL 723 / ASTM E84 — انتشار اللهب والدخان', 'EN 438‑4 — ألواح Compact HPL', 'ISO 13006 / EN 14411 — بلاط السيراميك والبورسلين',
  'ADA 2010 Standards §609 — مقابض الإسناد', 'ANSI/BIFMA X5.1 / X5.4 / X5.5 — الأثاث المكتبي وكراسي الانتظار والطاولات', 'ASTM D4157 (Wyzenbeek) — مقاومة القماش للاحتكاك']

RULE = {'only': ('حصراً', 'r-only'), 'list': ('من القائمة المعتمدة', 'r-list'), 'eq': ('أو ما يعادله بعد الاعتماد', 'r-eq')}

def card(it):
  rl, rc = RULE[it['rule']]
  rows = ''.join(f'<tr><th>{E(p)}</th><td class="mk">{E(m)}</td><td class="ap">{E(a)}</td></tr>' for p, m, a in it['rows'])
  sub = ''.join(f'<li>{E(s)}</li>' for s in it['submit'])
  return f'''<section class="item">
  <header class="ih"><div class="ic">{E(it['code'])}</div><div class="it"><h3>{E(it['title'])} {refs(it['refs'])}</h3><div class="en">{E(it['en'])}</div></div><div class="rule {rc}">{E(rl)}</div></header>
  <div class="apr"><span>المعتمد لدى التجمع:</span> <b>{E(it['approved'])}</b></div>
  {badges(it['bd'])}
  <table class="cmp"><thead><tr><th>الخاصية</th><th class="mk">الشائع في السوق</th><th class="ap">المعتمد لدى التجمع</th></tr></thead><tbody>{rows}</tbody></table>
  <div class="why"><div class="w1"><h4>لماذا يهم في المنشأة الصحية؟</h4><p>{E(it['why'])}</p></div><div class="w2"><h4>لو رُكّب الشائع</h4><p>{E(it['risk'])}</p></div></div>
  <div class="sub"><b>يُقدَّم للاعتماد:</b><ul>{sub}</ul></div>
</section>'''

summary_rows = ''
for s in SECTIONS + [(0,0,0,EXTRA)]:
  for it in s[3]:
    rl, rc = RULE[it['rule']]
    summary_rows += f'<tr><td class="ltr c">{E(it["code"])}</td><td>{E(it["title"])}</td><td>{E(it["approved"])}</td><td><span class="rule sm {rc}">{E(rl)}</span></td></tr>'
summary_rows += '<tr><td class="ltr c">LS-70 – 91</td><td>الأنظمة الكهروميكانيكية والتقنية</td><td>انظر القسم الخامس</td><td><span class="rule sm r-list">من القائمة المعتمدة</span></td></tr>'
summary_rows += '<tr><td class="ltr c">LS-93</td><td>الأثاث غير الطبي والمكتبي</td><td>Herman Miller · Global · OFS · Steelcase</td><td><span class="rule sm r-list">من القائمة المعتمدة</span></td></tr>'

secs = ''
for i, (t, _ic, intro, items) in enumerate(SECTIONS, 1):
  secs += f'<div class="sec {"brk" if i > 1 else ""}"><div class="sh"><span class="sn">{i}</span><h2>{E(t)}</h2></div><p class="si">{E(intro)}</p>{"".join(card(x) for x in items)}</div>'

mep = ''.join(f'<tr><td class="ltr c">{E(a)}</td><td>{E(b)}</td><td class="ltr br">{E(c)}</td><td>{E(d)}</td></tr>' for a, b, c, d in MEP)

FURN_ROWS = [
  ('الاختبارات', 'لا توجد تقارير اختبار، أو ادعاءات عامة', 'اختبارات ANSI/BIFMA: X5.1 للكراسي، X5.4 لمقاعد الانتظار، X5.5 للمكاتب والطاولات'),
  ('ساعات الاستخدام', 'مصمم لاستخدام مكتبي فردي لوردية واحدة', 'خيارات للاستخدام المتواصل 24/7 متعدد الورديات (كاونترات الاستقبال، التمريض، غرف التحكم)'),
  ('الضمان', 'سنة إلى سنتين غالباً', 'Herman Miller: 12 سنة لكثير من المنتجات على أساس 3 ورديات · Global: 12 سنة لكل المكونات في فئة Heavy Duty · OFS: 12 سنة للمنتجات القياسية · Steelcase: ضمان محدود مدى الحياة لعدد من المكونات'),
  ('القماش — المسحات المزدوجة', '15,000 – 30,000 أو غير موضّح', 'لا يقل عن 75,000 مسحة مزدوجة للرعاية الصحية، وأكثر من 100,000 لفئة Heavy Duty'),
  ('قابلية التنظيف', 'قماش يمتص السوائل والبقع', 'تنجيد غير منفذ للسوائل يتحمّل منظّفات المستشفيات، وفراغ تنظيف بين المقعد والظهر'),
  ('الحريق', 'غير مختبر', 'Class A لانتشار اللهب ودخان ≤ 450 (ASTM E84)، وأقمشة مختبرة حسب نوعها'),
  ('التحمّل', 'غير محدد', '136 كجم لمقاعد الانتظار والكراسي المكتبية، و340 كجم للمقاعد المخصصة لذوي الوزن العالي'),
  ('الهيكل والأسطح', 'خشب حبيبي تنتفخ حوافه، ومسامير ظاهرة', 'هياكل معدنية وأسطح عالية الضغط وحواف محكمة'),
]
furn_rows = ''.join(f'<tr><th>{E(p)}</th><td class="mk">{E(m)}</td><td class="ap">{E(a)}</td></tr>' for p, m, a in FURN_ROWS)

BODY = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{{font-family:T;src:url(file://{FD}Tajawal-Regular.ttf)}}@font-face{{font-family:T;font-weight:500;src:url(file://{FD}Tajawal-Medium.ttf)}}
@font-face{{font-family:T;font-weight:700;src:url(file://{FD}Tajawal-Bold.ttf)}}@font-face{{font-family:T;font-weight:800;src:url(file://{FD}Tajawal-ExtraBold.ttf)}}
:root{{--n:#153E5C;--n2:#123B5C;--s:#27A8DF;--s2:#E8F6FC;--g:#5B6B7A;--l:#E3EAF0;--ok:#0F7B5F;--okb:#E7F5F0;--w:#B5562B;--wb:#FBEFE8}}
@page{{size:A4;margin:22mm 16mm 18mm}}
*{{box-sizing:border-box}}body{{font-family:T,sans-serif;color:#1d2b36;font-size:10.6pt;line-height:1.75;margin:0}}
h1,h2,h3,h4{{margin:0;color:var(--n)}}.ltr{{direction:ltr;unicode-bidi:isolate}}.c{{text-align:center}}
.brk{{break-before:page}}
.lead{{font-size:11.4pt;line-height:1.85}}.intro{{font-size:10.2pt;line-height:1.7}}
.intro h2,.sh h2{{font-size:18pt;font-weight:800}}
.intro .rib{{width:64px;height:5px;background:var(--s);border-radius:3px;margin:8px 0 16px}}
.intro p{{margin:0 0 11px}}
.sig{{margin-top:18px;padding:12px 16px;border-right:4px solid var(--s);background:var(--s2);border-radius:6px}}
.why5{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0}}
.why5 div{{border:1px solid var(--l);border-radius:8px;padding:10px 12px;break-inside:avoid}}.why5 b{{color:var(--n);display:block;font-size:11pt}}.why5 span{{font-size:9.6pt;color:var(--g)}}
.legend{{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:8px}}.legend div{{display:flex;gap:8px;align-items:center;font-size:9.5pt}}
.sh{{display:flex;align-items:center;gap:12px;border-bottom:3px solid var(--n);padding-bottom:8px;margin-bottom:6px}}
.sn{{background:var(--n);color:#fff;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:15pt}}
.si{{color:var(--g);margin:6px 0 14px}}
.item{{border:1px solid var(--l);border-radius:10px;padding:12px 14px 10px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid}}
.item.big{{break-inside:auto;page-break-inside:auto}}tr,.why,.ih{{break-inside:avoid}}
.ih{{display:flex;align-items:flex-start;gap:10px}}
.ic{{direction:ltr;background:var(--s2);color:var(--n);font-weight:700;font-size:9pt;padding:3px 8px;border-radius:5px;white-space:nowrap;margin-top:3px}}
.it{{flex:1}}.it h3{{font-size:13pt;font-weight:800;line-height:1.4}}.en{{direction:ltr;text-align:right;color:var(--s);font-weight:700;font-size:9.4pt}}
.rule{{font-size:8.6pt;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;margin-top:3px}}
.rule.sm{{font-size:8pt;padding:1px 8px}}
.r-only{{background:var(--n);color:#fff}}.r-list{{background:var(--s);color:#fff}}.r-eq{{background:#fff;color:var(--n);border:1px solid var(--n)}}
.apr{{margin:6px 0 4px;font-size:10pt}}.apr span{{color:var(--g)}}.apr b{{color:var(--n)}}
.bdg{{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 8px}}
.b{{display:inline-flex;align-items:center;gap:5px;border-radius:5px;padding:1px 7px;font-size:8.2pt;background:var(--n);color:#fff}}
.b b{{direction:ltr;font-weight:700}}.b i{{font-style:normal;opacity:.85}}
.b-HT,.b-247{{background:var(--s)}}.b-DIS,.b-HYG{{background:var(--ok)}}.b-FIRE{{background:#B23A3A}}.b-G1{{background:#0b2a40}}.b-UNI,.b-WAR{{background:#6B5BA8}}.b-ADA{{background:#2F6FB5}}
table{{width:100%;border-collapse:collapse}}
.cmp th,.cmp td{{border:1px solid var(--l);padding:5px 8px;vertical-align:top;font-size:9.6pt;line-height:1.6}}
.cmp thead th{{background:var(--n);color:#fff;font-weight:700;border-color:var(--n)}}
.cmp thead th.mk{{background:#7A8794;border-color:#7A8794}}.cmp thead th.ap{{background:var(--s);border-color:var(--s)}}
.cmp tbody th{{background:#F5F8FA;color:var(--n);width:22%;text-align:right;font-weight:700}}
.cmp td.mk{{color:#55626e;width:33%}}.cmp td.ap{{background:#F3FAFE;font-weight:500;color:#0f2c42}}
.why{{display:grid;grid-template-columns:1.25fr 1fr;gap:8px;margin-top:8px}}
.why>div{{border-radius:7px;padding:7px 10px}}.why h4{{font-size:9.8pt;margin-bottom:2px}}.why p{{margin:0;font-size:9.4pt;line-height:1.65}}
.w1{{background:var(--okb)}}.w1 h4{{color:var(--ok)}}.w2{{background:var(--wb)}}.w2 h4{{color:var(--w)}}
.sub{{font-size:9pt;margin-top:6px;color:var(--g);display:flex;gap:6px}}.sub b{{color:var(--n);white-space:nowrap}}.sub ul{{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:3px 6px}}
.sub li{{background:#F5F8FA;border-radius:4px;padding:0 6px}}
.sup,.rf{{color:var(--s);font-size:7.5pt;font-weight:700}}
.tbl th,.tbl td{{border-bottom:1px solid var(--l);padding:5px 7px;font-size:9.4pt;text-align:right;vertical-align:top}}
.tbl thead th{{background:var(--n);color:#fff;font-weight:700}}.tbl tbody tr:nth-child(even){{background:#F7FAFC}}
.tbl td.br{{text-align:left;font-weight:700;color:var(--n)}}
.box{{border:1px solid var(--l);border-radius:10px;padding:12px 14px;margin:12px 0;break-inside:avoid}}
.box h3{{font-size:12.5pt;margin-bottom:6px}}
.brands{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px}}
.brands div{{border:1px solid var(--l);border-top:4px solid var(--s);border-radius:8px;padding:8px 10px;font-size:9pt;line-height:1.55}}
.brands b{{direction:ltr;display:block;color:var(--n);font-size:11pt;text-align:right}}
.dr{{margin:8px 0}}.dr .r{{display:grid;grid-template-columns:150px 1fr 70px;gap:8px;align-items:center;margin:5px 0;font-size:9.4pt}}
.dr .bar{{height:14px;border-radius:7px;background:var(--l);overflow:hidden}}.dr .bar i{{display:block;height:100%;background:var(--s);border-radius:7px}}
.dr .r.mk .bar i{{background:#9AA6B1}}.dr .v{{direction:ltr;text-align:left;font-weight:700;color:var(--n)}}
.steps{{counter-reset:s;list-style:none;padding:0;margin:8px 0}}.steps li{{counter-increment:s;position:relative;padding:6px 44px 6px 0;border-bottom:1px dashed var(--l)}}
.steps li:before{{content:counter(s);position:absolute;right:0;top:6px;width:30px;height:30px;border-radius:50%;background:var(--s2);color:var(--n);font-weight:800;display:grid;place-items:center}}
.src li{{font-size:8.8pt;line-height:1.55;margin-bottom:4px}}.src a{{direction:ltr;unicode-bidi:isolate;color:var(--s);text-decoration:none;word-break:break-all;font-size:8pt}}
.std{{columns:2;font-size:9pt}}
.note{{background:var(--s2);border-radius:8px;padding:9px 12px;font-size:9.6pt;margin:10px 0}}
.end{{text-align:center;margin-top:24px;color:var(--n);font-weight:700}}
</style></head><body>

<div class="intro">
<h2>مقدمة</h2><div class="rib"></div>
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
<p style="margin:4px 0">كل بند في صفحة مستقلة تقريباً: الرمز كما في جدول الكميات، المعتمد لدى التجمع، شارات الأداء، جدول مقارنة بين الشائع في السوق والمعتمد، ثم سبب الاعتماد وما يُقدَّم قبل التوريد. والرقم الصغير بجانب العنوان يشير إلى المرجع في آخر الدليل.</p>
<div class="legend">
 <div><span class="rule sm r-only">حصراً</span> لا يُقبل بديل لارتباطه بمنظومة موحّدة أو اعتماد قائم</div>
 <div><span class="rule sm r-list">من القائمة المعتمدة</span> أي اسم من الأسماء المذكورة</div>
 <div><span class="rule sm r-eq">أو ما يعادله بعد الاعتماد</span> يُقبل بديل مطابق بعد اعتماده كتابياً</div>
 <div>الشارات الملونة (Heavy Duty، High Traffic…) تلخّص نوع الأداء المطلوب من البند.</div>
</div>
</div>

<div style="margin-top:16px"><h2 style="font-size:18pt;font-weight:800">ملخص البنود المعتمدة</h2><div class="intro"><div class="rib"></div></div>
<table class="tbl"><thead><tr><th style="width:15%">الرمز</th><th style="width:28%">البند</th><th>المعتمد لدى التجمع</th><th style="width:20%">الشرط</th></tr></thead><tbody>{summary_rows}</tbody></table>
<p class="note">الرموز (LS) هي أرقام البنود في جدول كميات مشروع النعيم بنظام المقطوعية، وتُطبَّق المواصفات نفسها على مشروع سعد الحسين وبقية مشاريع التبرع.</p></div>

{secs}

<div class="sec brk"><div class="sh"><span class="sn">5</span><h2>الأنظمة الكهروميكانيكية والتقنية</h2></div>
<p class="si">هذه الأنظمة تعمل خلف الجدران، لكنها ترتبط بشبكات التجمع ولوحات التحكم وعقود الصيانة القائمة. لذلك يكون الاعتماد هنا أساسه <b>التوافق والتوحيد</b> قبل أي شيء.</p>
{"".join(card(x) for x in EXTRA)}
<h3 style="margin:6px 0">بقية الأنظمة</h3>
<table class="tbl"><thead><tr><th style="width:13%">الرمز</th><th style="width:17%">النظام</th><th style="width:30%">المعتمد</th><th>سبب الاعتماد</th></tr></thead><tbody>{mep}</tbody></table>
<p class="note">أنظمة مكافحة الحريق وإنذاره تخضع لاعتماد الدفاع المدني، ولا يُركَّب أي مكوّن فيها قبل اعتماد مخططاته وموديلاته.</p></div>

<div class="sec brk"><div class="sh"><span class="sn">6</span><h2>الأثاث غير الطبي والمكتبي</h2></div>
<p class="si">كراسي الانتظار وكاونترات الاستقبال ومكاتب التمريض والإدارة. أكثر بند يتشابه فيه الشكل ويختلف فيه العمر الفعلي، وأكثر بند يُعرض فيه البديل المحلي بسعر أقل.</p>
<div class="brands">
 <div><b>Herman Miller</b>ضمان 12 سنة لكثير من منتجاتها على أساس الاستخدام لثلاث ورديات.<sup class="rf">[10]</sup></div>
 <div><b>Global (Canada)</b>فئة Heavy Duty: ضمان 12 سنة لكل المكونات للاستخدام 24/7، وقماش أعلى من 100,000 مسحة مزدوجة.<sup class="rf">[11]</sup></div>
 <div><b>OFS</b>ضمان 12 سنة للمنتجات القياسية، و5 سنوات للآليات والإسفنج.<sup class="rf">[12]</sup></div>
 <div><b>Steelcase</b>ضمان محدود مدى الحياة لعدد من المكونات، مع فترات محددة لبقية الأجزاء.<sup class="rf">[13]</sup></div>
</div>
<section class="item big" style="margin-top:10px"><header class="ih"><div class="ic">LS-93</div><div class="it"><h3>الأثاث المكتبي ومقاعد الانتظار {refs([14])}</h3><div class="en">Herman Miller · Global · OFS · Steelcase</div></div><div class="rule r-list">من القائمة المعتمدة</div></header>
{badges(["HD","HT","247","DIS","WAR"])}
<table class="cmp"><thead><tr><th>الخاصية</th><th class="mk">الأثاث الشائع في السوق</th><th class="ap">المعتمد لدى التجمع</th></tr></thead><tbody>{furn_rows}</tbody></table>
<div class="why"><div class="w1"><h4>لماذا هذه الشركات؟</h4><p>لأنها تختبر منتجاتها وفق معايير BIFMA وتنشر نتائجها، وتقدّم ضمانات مكتوبة طويلة تغطي الاستخدام المتعدد الورديات، وتوفّر أقمشة مصممة للتنظيف بالمطهرات. وهذا ما يجعل الكرسي يبقى صالحاً عشر سنوات بدل سنة أو سنتين.</p></div>
<div class="w2"><h4>لو رُكّب الشائع</h4><p>تمزق القماش وتبقّعه، وانكسار القواعد والمساند، وانتفاخ الأسطح الخشبية، وفي المنشأة الصحية: قماش لا يمكن تطهيره ولا بد من استبداله.</p></div></div>
</section>

<div class="box"><h3>ما معنى «المسحة المزدوجة» (Double Rub)؟</h3>
<p style="margin:0 0 6px">اختبار Wyzenbeek يحرّك قطعة قماش قطني خشن ذهاباً وإياباً على قماش التنجيد تحت شدّ ووزن ثابتين، وكل حركة ذهاب وعودة تُحسب مسحة مزدوجة واحدة. يتوقف العدّ عند ظهور تآكل واضح في القماش. كلما زاد الرقم، طال عمر التنجيد.{refs([15, 14, 11])}</p>
<div class="dr">
 <div class="r mk"><span>الحد العام للأماكن التجارية</span><div class="bar"><i style="width:15%"></i></div><span class="v">15,000</span></div>
 <div class="r mk"><span>الاستخدام التجاري الشاق</span><div class="bar"><i style="width:30%"></i></div><span class="v">30,000</span></div>
 <div class="r"><span>الحد الأدنى للرعاية الصحية</span><div class="bar"><i style="width:75%"></i></div><span class="v">75,000</span></div>
 <div class="r"><span>فئة Heavy Duty (Global)</span><div class="bar"><i style="width:100%"></i></div><span class="v">+100,000</span></div>
</div>
<p class="muted" style="margin:0;font-size:9pt;color:var(--g)">الأقمشة الشائعة في الأثاث المحلي تقع غالباً في المنطقة الرمادية أو لا يُذكر رقمها أصلاً.</p></div>

<div class="note"><b>عن المصنّع المحلي:</b> لا نقصد التقليل من الصناعة المحلية؛ الهدف هو الأداء الموثّق. والقائمة المعتمدة هي الأسماء الأربعة أعلاه، وأي منتج آخر يُقترح لا يُدرس إلا إذا قُدّمت معه تقارير اختبار BIFMA من مختبر معتمد، وبيانات القماش (المسحات المزدوجة وقابلية التطهير والحريق)، وضماناً مكتوباً من المصنّع يماثل ما سبق، ويبقى القرار للإدارة.</div>
</div>

<div class="sec brk"><div class="sh"><span class="sn">7</span><h2>الاعتماد قبل التوريد</h2></div>
<p class="si">حتى يسير المشروع بلا رفض في الموقع أو إعادة توريد، نرجو اتباع هذه الخطوات لكل بند:</p>
<ol class="steps">
 <li><b>تقديم طلب اعتماد (Submittal)</b> لكل بند قبل الشراء، يتضمن رقم البند في جدول الكميات والموديل المقترح.</li>
 <li><b>إرفاق المستندات الأصلية من المصنّع:</b> Data Sheet، وشهادات الاختبار، وشهادة المنشأ، وخطاب الوكيل أو الموزّع المعتمد، وخطاب الضمان.</li>
 <li><b>تقديم العينة</b> للبنود التي تحتاجها (الأرضيات، البلاط، الألوان، القماش، الإكسسوارات).</li>
 <li><b>للبنود «أو ما يعادله» فقط:</b> جدول مقارنة نقطة بنقطة بين المقترح والمعتمد على كل خاصية في هذا الدليل؛ والمعادل هو ما يساوي أو يتجاوز كل خاصية، لا معظمها.</li>
 <li><b>انتظار الاعتماد الكتابي</b> من قسم المشاريع قبل التوريد.</li>
 <li><b>عند وصول المواد:</b> مطابقة الموديل ورقم الدفعة والملصقات مع ما اعتُمد، وأي اختلاف يعني رفض المادة.</li>
</ol>
<div class="note">البنود المعلّمة <span class="rule sm r-only">حصراً</span> لا يُقدَّم لها بديل، لأنها ترتبط بمنظومة موحّدة في منشآت التجمع أو بعقود صيانة وقطع غيار قائمة.</div>

<h2 style="margin-top:22px">المراجع</h2><div class="intro"><div class="rib"></div></div>
<ol class="src">{"".join(f'<li>{E(t)}' + (f'<br><a href="{u}">{E(u)}</a>' if u else '') + '</li>' for t, u in SOURCES)}</ol>
<h3 style="margin-top:10px">المواصفات القياسية المشار إليها</h3>
<ul class="std">{"".join(f'<li>{E(s)}</li>' for s in STANDARDS)}</ul>
<p class="note">الأرقام الواردة مأخوذة من بيانات المصنّعين المنشورة والمواصفات القياسية وقت إعداد الدليل، وقد تختلف حسب الموديل. والمرجع النهائي عند التوريد هو Data Sheet الموديل المعتمد ووصف البند في جدول الكميات.</p>
<p class="end">شكراً لكم على عطائكم وتعاونكم<br><span style="font-weight:500;color:var(--g)">قسم المشاريع — إدارة الخدمات الفنية — تجمع الأحساء الصحي</span></p>
</div>
</body></html>'''

COVER = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{{font-family:T;src:url(file://{FD}Tajawal-Regular.ttf)}}@font-face{{font-family:T;font-weight:700;src:url(file://{FD}Tajawal-Bold.ttf)}}@font-face{{font-family:T;font-weight:800;src:url(file://{FD}Tajawal-ExtraBold.ttf)}}
@page{{size:A4;margin:0}}body{{margin:0;font-family:T}}
.c{{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff}}
.top{{padding:22mm 18mm 0;display:flex;justify-content:space-between;align-items:center}}.top img{{height:24mm}}
.tag{{color:#27A8DF;font-weight:700;font-size:11pt;border:1.5px solid #27A8DF;border-radius:30px;padding:4px 16px}}
.band{{position:absolute;left:0;right:0;top:78mm;height:150mm;background:#153E5C}}
.band:after{{content:"";position:absolute;left:0;right:0;bottom:0;height:8mm;background:#27A8DF}}
.tx{{position:absolute;top:100mm;right:18mm;left:18mm;color:#fff}}
.k{{color:#27A8DF;font-weight:700;font-size:13pt;letter-spacing:.5px}}
h1{{font-size:33pt;line-height:1.35;margin:8px 0 14px;font-weight:800}}
.sub{{font-size:14pt;line-height:1.7;opacity:.92;max-width:150mm}}
.pills{{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}}.pills span{{border:1px solid rgba(255,255,255,.45);border-radius:20px;padding:3px 12px;font-size:10pt;direction:ltr}}
.ft{{position:absolute;bottom:20mm;right:18mm;left:18mm;display:flex;justify-content:space-between;align-items:flex-end;color:#153E5C}}
.ft b{{font-size:12.5pt;display:block}}.ft span{{color:#5B6B7A;font-size:10.5pt}}
</style></head><body><div class="c">
<div class="top"><img src="file://{D}/logo.png"><span class="tag">للاطلاع والاسترشاد</span></div>
<div class="band"></div>
<div class="tx"><div class="k">دليل المتبرعين والمقاولين</div>
<h1>المواصفات المعتمدة للتشطيبات<br>والتجهيزات في المنشآت الصحية</h1>
<div class="sub">مقارنة بند بند بين الشائع في السوق والمعتمد لدى التجمع، ولماذا تحتاج المنشأة الصحية إلى مواد صُمّمت للاستخدام الشاق والحركة الكثيفة والتطهير اليومي.</div>
<div class="pills"><span>Heavy Duty</span><span>High Traffic</span><span>Disinfectant‑Resistant</span><span>ANSI/BHMA Grade 1</span><span>BIFMA</span></div></div>
<div class="ft"><div><b>إدارة الخدمات الفنية — قسم المشاريع</b><span>تجمع الأحساء الصحي</span></div><div style="text-align:left"><b>الإصدار الأول</b><span>أكتوبر 2026</span></div></div>
</div></body></html>'''

open(os.path.join(D, 'body.html'), 'w').write(BODY)
open(os.path.join(D, 'cover.html'), 'w').write(COVER)
print('ok')
