# 0082: مصنّعون معتمدون للغازات الطبية والمولدات ووحدات الحلقة والمحولات (سجل المواد + بطاقات الدليل + بندان جديدان في قائمة المقطوعية LS-95/96)،
# وتوضيح بطاقة التكييف G-22، وربط بنود جدول فاطمة العفالق بها، وترجمة نصوص الجدول الإنجليزية.
import hashlib, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk80_fatima import L, NOTES_ADD
from mk82_en import EN, NOTES_EN
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
def q(s): return "$t$" + s + "$t$"
def arr(lst): return "array[" + ",".join(q(x) for x in lst) + "]::text[]" if lst else "'{}'::text[]"
def norm(s): return re.sub(r'[ \t\r\n ]+', ' ', s).strip()
def key(s): return hashlib.sha256(norm(s).encode()).hexdigest()
BY = {x['k']: x for x in L}
FAT = "(select id from public.boqs where name = 'مقطوعية — مركز فاطمة العفالق' order by created_at limit 1)"
SEC = 'الأنظمة الكهروميكانيكية والتقنية'
CARDS = [
  dict(key='G-30', code_label='LS-76', ls=['LS-76'], sort=245, title='الغازات الطبية', en='Medical Gases', approved='BeaconMedaes · Amico · Dräger · Atlas Copco (محطات الهواء والشفط)',
       approved_en='BeaconMedaes · Amico · Dräger · Atlas Copco (air and vacuum plants)', why='نظام يمس سلامة المرضى مباشرة: مصنّعون متخصصون، واختبارات HTM 02-01 / NFPA 99 قبل التشغيل، ودعم فني لما بعد البيع.',
       why_en="A system that directly affects patient safety: specialist manufacturers, HTM 02-01 / NFPA 99 testing before operation, and after-sales technical support."),
  dict(key='G-31', code_label='LS-95', ls=['LS-95'], sort=246, title='وحدات الحلقة الرئيسية والمحولات', en='Ring Main Units and Transformers', approved='Lucy · Schneider · Hitachi Energy · الفنار · الشركة السعودية للمحولات',
       approved_en='Lucy · Schneider · Hitachi Energy · Alfanar · Saudi Transformers Company', why='تستلمها الشركة السعودية للكهرباء، فلا يُقبل إلا ما في قائمتها المعتمدة.',
       why_en='They are accepted by the Saudi Electricity Company, so only items on its approved list are acceptable.'),
  dict(key='G-32', code_label='LS-96', ls=['LS-96'], sort=247, title='المولدات ومفاتيح التحويل الآلي', en='Generators and Automatic Transfer Switches', approved='Cummins · Caterpillar · FG Wilson · MTU — مفاتيح التحويل: ASCO · Cummins · ABB',
       approved_en='Cummins · Caterpillar · FG Wilson · MTU — transfer switches: ASCO · Cummins · ABB', why='التشغيل الاحتياطي للأحمال الحرجة: علامات معروفة بوكلاء صيانة وقطع غيار في المملكة، واختبار تحميل كامل وفق NFPA 110.',
       why_en='Standby power for critical loads: established brands with service agents and spare parts in the Kingdom, and full-load testing per NFPA 110.')]
G22_OLD = 'York DEH 360 · LG / Gree / York · Greenheck / Loren Cook · Armaflex'
G22_NEW = 'York DEH 360 (وحدات Package) · LG / Gree / York (الوحدات المنفصلة وDX) · Greenheck / Loren Cook · Armaflex'
G22_EN = 'York DEH 360 (package units) · LG / Gree / York (split and DX units) · Greenheck / Loren Cook · Armaflex'
MATS = [('M-39', 'الميكانيكا', 'الغازات الطبية', ['BeaconMedaes', 'Amico', 'Dräger', 'Atlas Copco'], 'Atlas Copco لمحطات الهواء والشفط فقط', 'list', ['LS-76'], ['HTM 02-01', 'NFPA 99'], 390),
        ('M-40', 'الكهرباء', 'المولدات ومفاتيح التحويل الآلي', ['Cummins', 'Caterpillar', 'FG Wilson', 'MTU', 'ASCO', 'ABB'], 'مفاتيح التحويل: ASCO أو Cummins أو ABB', 'list', ['LS-96'], ['NFPA 110'], 400),
        ('M-41', 'الكهرباء', 'وحدات الحلقة الرئيسية والمحولات', ['Lucy', 'Schneider', 'Hitachi Energy', 'الفنار', 'الشركة السعودية للمحولات'], 'من القائمة المعتمدة لدى الشركة السعودية للكهرباء', 'list', ['LS-95'], [], 410)]
NEWLS = [('LS-95', 'MV', 805), ('LS-96', 'GEN', 806)]

o = ["-- 0082: مصنّعون معتمدون للغازات الطبية والمولدات ووحدات الحلقة والمحولات (المواد M-39..41، بطاقات G-30..32، بندا المقطوعية LS-95/96)، توضيح G-22، ربط بنود جدول فاطمة العفالق، والترجمة الإنجليزية لنصوصه. المولّد tools/boq/mk82.py"]
for code, k, sort in NEWLS:
  x = BY[k]
  o.append(f"insert into public.ls_items (code, grp, title, descr, sort, active, unit, div_code, refs) values ({q(code)}, 'مركز نموذج المسار الرابع', {q(x['title'])}, {q(x['descr'])}, {sort}, true, 'مقطوعية', '26', {arr(x['refs'])}) on conflict (code) do nothing;")
for m in MATS:
  o.append(f"insert into public.materials (code, category, name, makers, spec, rule, ls_codes, std_codes, sort) values ({q(m[0])}, {q(m[1])}, {q(m[2])}, {arr(m[3])}, {q(m[4])}, {q(m[5])}, {arr(m[6])}, {arr(m[7])}, {m[8]}) on conflict (code) do nothing;")
for c in CARDS:
  o.append(f"insert into public.guide_cards (key, code_label, ls_codes, section, kind, sort, title, en, rule, approved, why) values ({q(c['key'])}, {q(c['code_label'])}, {arr(c['ls'])}, {q(SEC)}, 'row', {c['sort']}, {q(c['title'])}, {q(c['en'])}, 'list', {q(c['approved'])}, {q(c['why'])}) on conflict (key) do nothing;")
o.append(f"update public.guide_cards set approved = {q(G22_NEW)} where key = 'G-22' and approved = {q(G22_OLD)};")
o.append(f"update public.boq_lines set ls_code = 'LS-95', descr = {q(BY['MV']['descr'])} where boq_id = {FAT} and title = {q(BY['MV']['title'])} and ls_code is null;")
o.append(f"update public.boq_lines set ls_code = 'LS-96', descr = {q(BY['GEN']['descr'])} where boq_id = {FAT} and title = {q(BY['GEN']['title'])} and ls_code is null;")
o.append(f"update public.boq_lines set descr = {q(BY['LS-76']['descr'])} where boq_id = {FAT} and ls_code = 'LS-76' and descr not like '%BeaconMedaes%';")
# الترجمة
pairs = {}
for k, (t, d, n) in EN.items():
  x = BY[k]
  if n: pairs[x['note']] = n
  if t: pairs[x['title']] = t
  if d: pairs[x['descr']] = d
for a, e in NOTES_EN.items(): pairs[a] = e
for c in CARDS: pairs[c['title']] = c['en']; pairs[c['approved']] = c['approved_en']; pairs[c['why']] = c['why_en']
pairs[G22_NEW] = G22_EN
# تحقق: كل ملاحظة وكل نص معدّل له ترجمة، وكل سطر في الملاحظات الخاصة مترجم
miss = [x['k'] for x in L if x['note'] not in pairs or (x['mode'] != 'copy' and (x['title'] not in pairs or x['descr'] not in pairs))]
miss += [l for l in NOTES_ADD.split('\n') if l.strip() and l.strip() not in pairs]
assert not miss, miss
vals = ',\n'.join(f"  ({q(key(a))}, {q(norm(a))}, {q(e)})" for a, e in pairs.items())
o.append(f"insert into public.i18n (k, src, en) values\n{vals}\non conflict (k) do nothing;")
open(os.path.join(ROOT, 'supabase', 'migrations', '0082_makers_fatima_en.sql'), 'w').write('\n'.join(o) + '\n')
print('translations', len(pairs))
