# 0086: تحديث نص قالب PA-PHC — لا ذكر لإدارة الخدمات الفنية/قسم المشاريع في الاتفاقية وملحقها (طلب المستخدم 4 نوفمبر). يعيد كتابة body من content.py
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from content import AGREEMENT, ANNEX, PHASES, BUDGET, MED
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
body = {"agreement": AGREEMENT, "annex": ANNEX, "phases": PHASES, "budget": BUDGET, "med": MED}
sql = "-- 0086: تحديث نص قالب الاتفاقية والملحق (بلا ذكر الإدارة والقسم). المولّد tools/agreements/mk86.py\n" \
      f"update public.agr_templates set body = $t${json.dumps(body, ensure_ascii=False)}$t$::jsonb, updated_at = now() where code = 'PA-PHC';\n"
open(os.path.join(ROOT, 'supabase', 'migrations', '0086_agr_text.sql'), 'w').write(sql); print('ok')
