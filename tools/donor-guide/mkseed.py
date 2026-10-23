import json, sys, re
sys.argv=['x']; import gen as G
def q(s): return "''" if s=="" else "$q$"+s+"$q$"
def arr(a): return "array["+",".join(q(x) for x in a)+"]::text[]" if a else "'{}'::text[]"
def iarr(a): return "array["+",".join(str(x) for x in a)+"]::int[]" if a else "'{}'::int[]"
def codes(label):
  m=re.match(r'LS-(\d+)(?: – (\d+))?',label); a=int(m.group(1)); b=int(m.group(2) or a)
  return ['LS-%02d'%i for i in range(a,b+1)]
rows=[]; secs=[]; n=0
def add(sec, it, kind='card'):
  global n; n+=1
  rows.append(f"insert into public.guide_cards(key,code_label,ls_codes,section,kind,sort,title,en,rule,approved,badges,rows,why,risk,submit,refs) values ({q('G-%02d'%n)},{q(it['code'])},{arr(codes(it['code']))},{q(sec)},{q(kind)},{n*10},{q(it['title'])},{q(it.get('en',''))},{q(it.get('rule','list'))},{q(it['approved'])},{arr(it.get('bd',[]))},{q(json.dumps(it.get('rows',[]),ensure_ascii=False))}::jsonb,{q(it.get('why',''))},{q(it.get('risk',''))},{arr(it.get('submit',[]))},{iarr(it.get('refs',[]))}) on conflict (key) do nothing;")
for t,_i,intro,items in G.SECTIONS:
  secs.append({'name':t,'intro':intro})
  for it in items: add(t,it)
S5='الأنظمة الكهروميكانيكية والتقنية'
secs.append({'name':S5,'intro':'هذه الأنظمة تعمل خلف الجدران، لكنها ترتبط بشبكات التجمع ولوحات التحكم وعقود الصيانة القائمة. لذلك يكون الاعتماد هنا أساسه التوافق والتوحيد قبل أي شيء.'})
for it in G.EXTRA: add(S5,it)
for a,b,c,d in G.MEP: add(S5,dict(code=a,title=b,approved=c,why=d,rule='list'),'row')
S6='الأثاث غير الطبي والمكتبي'
secs.append({'name':S6,'intro':'كراسي الانتظار وكاونترات الاستقبال ومكاتب التمريض والإدارة. أكثر بند يتشابه فيه الشكل ويختلف فيه العمر الفعلي، وأكثر بند يُعرض فيه البديل المحلي بسعر أقل.'})
add(S6,dict(code='LS-93',title='الأثاث المكتبي ومقاعد الانتظار',en='Herman Miller · Global · OFS · Steelcase',rule='list',approved='Herman Miller · Global · OFS · Steelcase',bd=['HD','HT','247','DIS','WAR'],rows=G.FURN_ROWS,
  why='لأنها تختبر منتجاتها وفق معايير BIFMA وتنشر نتائجها، وتقدّم ضمانات مكتوبة طويلة تغطي الاستخدام المتعدد الورديات، وتوفّر أقمشة مصممة للتنظيف بالمطهرات. وهذا ما يجعل الكرسي يبقى صالحاً عشر سنوات بدل سنة أو سنتين.',
  risk='تمزق القماش وتبقّعه، وانكسار القواعد والمساند، وانتفاخ الأسطح الخشبية، وفي المنشأة الصحية: قماش لا يمكن تطهيره ولا بد من استبداله.',submit=['تقارير اختبار BIFMA من مختبر معتمد','بيانات القماش (المسحات المزدوجة وقابلية التطهير والحريق)','خطاب الضمان من المصنّع','عينات القماش والتشطيب'],refs=[14]))
meta={'sections':secs,'sources':[list(x) for x in G.SOURCES],'standards':G.STANDARDS}
open('seed.sql','w').write('\n'.join(rows)); open('meta.json','w').write(json.dumps(meta,ensure_ascii=False))
print(n)
