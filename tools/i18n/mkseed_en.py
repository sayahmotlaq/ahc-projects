import json, re, hashlib, sys, os
S='/tmp/claude-0/-home-claude/7c86dd4e-69c5-56a0-a099-f115107adf98/scratchpad'
sys.path.insert(0, S+'/en'); sys.path.insert(0, S+'/donor')
os.chdir(S+'/donor')
import gen as G, gen_en as GE
def norm(s): return re.sub(r'[ \t\r\n ]+',' ',s).strip()
pairs={}
def add(a,e):
  if a is None or e is None: return
  a=norm(a); 
  if not a or not re.search('[؀-ۿ]',a): return
  if a in pairs and pairs[a]!=e: print('CONFLICT',a[:60],'|',pairs[a][:50],'|',e[:50])
  pairs[a]=e
ls=json.load(open(S+'/en/ls.json')); byc={x['c']:x for x in ls}
T={}
for m in ['t1','t2','t3','t4','t5']:
  T.update(__import__(m).T)
T['LS-93']=T['LS-34']
for c,x in byc.items():
  if c not in T: print('MISSING LS',c); continue
  add(x['t'],T[c][0]); add(x['d'],T[c][1])
import t6
ho=json.load(open(S+'/en/ho.json'))
for x in ho:
  e=t6.HO[x['c']]; add(x['t'],e[0]); add(x['d'],e[1]); add(x['v'],e[2])
for a,e in t6.GRP.items(): add(a,e)
for a,e in t6.STAGE.items(): add(a,e)
for a,e in t6.NOTES: add(a,e)
# guide
def card(a,e):
  for f in ['title','approved','why','risk']: add(a.get(f),e.get(f))
  for ra,re_ in zip(a.get('rows',[]),e.get('rows',[])):
    for x,y in zip(ra,re_): add(x,y)
  for x,y in zip(a.get('submit',[]),e.get('submit',[])): add(x,y)
for sa,se in zip(G.SECTIONS,GE.SECTIONS):
  add(sa[0],se[0]); add(sa[2],se[1])
  for a,e in zip(sa[3],se[2]): card(a,e)
for a,e in zip(G.EXTRA,GE.EXTRA): card(a,e)
for a,e in zip(G.MEP,GE.MEP):
  add(a[1],e[1]); add(a[2],e[2]); add(a[3],e[3])
for a,e in zip(G.FURN_ROWS,GE.FURN_ROWS):
  for x,y in zip(a,e): add(x,y)
add('الأنظمة الكهروميكانيكية والتقنية','MEP & Technology Systems')
add('هذه الأنظمة تعمل خلف الجدران، لكنها ترتبط بشبكات التجمع ولوحات التحكم وعقود الصيانة القائمة. لذلك يكون الاعتماد هنا أساسه التوافق والتوحيد قبل أي شيء.','These systems work behind the walls, but they connect to Cluster networks, control panels and existing maintenance contracts. Here, approval is based first and foremost on compatibility and standardization.')
add('الأثاث غير الطبي والمكتبي','Non‑Medical & Office Furniture')
add('كراسي الانتظار وكاونترات الاستقبال ومكاتب التمريض والإدارة. أكثر بند يتشابه فيه الشكل ويختلف فيه العمر الفعلي، وأكثر بند يُعرض فيه البديل المحلي بسعر أقل.','Waiting seating, reception counters, nurse stations and administrative desks. This is the item where appearance is most similar and actual service life differs most — and where local alternatives are most often offered at a lower price.')
add('الأثاث المكتبي ومقاعد الانتظار','Office Furniture & Waiting Seating')
add('لأنها تختبر منتجاتها وفق معايير BIFMA وتنشر نتائجها، وتقدّم ضمانات مكتوبة طويلة تغطي الاستخدام المتعدد الورديات، وتوفّر أقمشة مصممة للتنظيف بالمطهرات. وهذا ما يجعل الكرسي يبقى صالحاً عشر سنوات بدل سنة أو سنتين.','Because they test their products to BIFMA standards and publish the results, provide long written warranties covering multi‑shift use, and offer fabrics designed for cleaning with disinfectants. This is what keeps a chair serviceable for ten years instead of one or two.')
add('تمزق القماش وتبقّعه، وانكسار القواعد والمساند، وانتفاخ الأسطح الخشبية، وفي المنشأة الصحية: قماش لا يمكن تطهيره ولا بد من استبداله.','Torn and stained fabric, broken bases and armrests, swollen wooden surfaces — and in a healthcare facility, fabric that cannot be disinfected and must be replaced.')
for a,e in [('تقارير اختبار BIFMA من مختبر معتمد','BIFMA test reports from an accredited laboratory'),('بيانات القماش (المسحات المزدوجة وقابلية التطهير والحريق)','Fabric data (double rubs, disinfectant cleanability and fire)'),('خطاب الضمان من المصنّع','Manufacturer’s warranty letter'),('عينات القماش والتشطيب','Fabric and finish samples')]: add(a,e)
for (ta,ua),(te,ue) in zip(G.SOURCES,GE.SOURCES): add(ta,te)
for a,e in zip(G.STANDARDS,GE.STANDARDS): add(a,e)
# misc
for a,e in [('مركز صحي النعيم','Al Naeem Health Centre'),('مركز النعيم','Al Naeem Health Centre'),('مركز سعد الحسين','Saad Al Hussain Health Centre'),('مركز صحي سعد الحسين','Saad Al Hussain Health Centre'),('مقطوعية — نموذج المسار الرابع','Lump Sum — Track 4 Model'),('مقطوعية','Lump sum'),('إنشاء جديد','New construction'),('تجديد وتأهيل','Renovation and rehabilitation'),('توسعة','Extension'),('صيانة وإصلاح','Maintenance and repair'),('توريد وتركيب','Supply and installation'),('أعمال خارجية','External works'),('دراسة','Study')]: add(a,e)
pairs['الشبكة']='Network'; pairs['التركيب']='Installation'; pairs['ستانلس ستيل 304']='Stainless steel 304'; add('شبكة التعليق','Suspension grid')
rows=[]
def q(x): return "$t$"+x+"$t$"
for a,e in pairs.items():
  k=hashlib.sha256(a.encode('utf-8')).hexdigest()
  rows.append(f"({q(k)},{q(a)},{q(e)})")
assert not any('$t$' in a or '$t$' in e for a,e in pairs.items())
sql="""-- 0073: الترجمة الإنجليزية لمخرجات المنصة — جدول i18n (المفتاح SHA-256 للنص العربي بعد توحيد المسافات)
-- بذور: بنود قائمة المقطوعية، اشتراطات التسليم، الملاحظات العامة، بطاقات دليل المواصفات. لا تُستبدل ترجمة عدّلها المدير (on conflict do nothing).
create table if not exists public.i18n (k text primary key, src text not null, en text not null default '', updated_at timestamptz not null default now());
alter table public.i18n enable row level security;
grant select, insert, update, delete on public.i18n to authenticated;
drop policy if exists p_read on public.i18n; create policy p_read on public.i18n for select using (public.can_read());
drop policy if exists p_write on public.i18n; create policy p_write on public.i18n for all using (public.is_admin()) with check (public.is_admin());
insert into public.i18n (k, src, en) values
"""+",\n".join(rows)+"\non conflict (k) do nothing;\n"+"""
-- تمييز «الشبكة» في بطاقة الأسقف عن شبكة الكاميرات (لتصح الترجمة)
update public.guide_cards set rows = replace(rows::text, '["الشبكة", "شبكة رقيقة', '["شبكة التعليق", "شبكة رقيقة')::jsonb where title = 'الأسقف المستعارة' and rows::text like '%["الشبكة", "شبكة رقيقة%';
"""
open('/home/claude/platform/supabase/migrations/0073_i18n_en.sql','w').write(sql)
print(len(pairs))
