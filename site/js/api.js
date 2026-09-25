// ===== طبقة البيانات — Supabase =====
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.AHC_CONFIG || {};
export const sb = createClient(cfg.url, cfg.anon, { auth: { persistSession: true, autoRefreshToken: true } });

export const STAGES = [
  { key: 'request',   ar: 'طلب / فكرة',        color: '#8A8A8A' },
  { key: 'study',     ar: 'دراسة وتقدير',       color: '#A98736' },
  { key: 'approval',  ar: 'اعتماد',             color: '#B07A2A' },
  { key: 'design',    ar: 'تصميم ومخططات',      color: '#5F7A5B' },
  { key: 'tender',    ar: 'طرح',                color: '#27506B' },
  { key: 'award',     ar: 'ترسية وتعاقد',       color: '#1B6CA8' },
  { key: 'execution', ar: 'تنفيذ',              color: '#27A8DF' },
  { key: 'handover',  ar: 'استلام ابتدائي',     color: '#3C8D5A' },
  { key: 'warranty',  ar: 'فترة الضمان',        color: '#6F7F52' },
  { key: 'closed',    ar: 'مقفل',               color: '#153E5C' },
  { key: 'onhold',    ar: 'موقوف',              color: '#A6503B' },
  { key: 'cancelled', ar: 'ملغى',               color: '#7A2E22' },
];
export const stageOf = k => STAGES.find(s => s.key === k) || { key: k, ar: k, color: '#999' };
export const ROLES = { admin: 'مدير النظام', engineer: 'مهندس مشاريع', viewer: 'مطّلع (قراءة فقط)', finance: 'مالية (تسجيل الصرف فقط)', pending: 'بانتظار الاعتماد', disabled: 'موقوف' };
export const PROJECT_TYPES = ['إنشاء جديد', 'تجديد وتأهيل', 'توسعة', 'صيانة وإصلاح', 'توريد وتركيب', 'أعمال خارجية', 'دراسة'];
export const UPDATE_KINDS = { note: 'ملاحظة', visit: 'زيارة ميدانية', issue: 'معوّق / مشكلة', letter: 'خطاب', payment: 'مستخلص / دفعة', milestone: 'إنجاز' };

// ---------- الجلسة
export const session = { user: null, profile: null };
export async function loadSession() {
  const { data } = await sb.auth.getSession();
  session.user = data.session?.user || null;
  session.profile = null;
  if (session.user) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    session.profile = p;
  }
  return session;
}
export const role = () => session.profile?.role || 'anon';
export const isAdmin = () => role() === 'admin';
export const canEdit = () => ['admin', 'engineer'].includes(role());
export const canRead = () => ['admin', 'engineer', 'viewer', 'finance'].includes(role());

// ---------- المرجع الفني (مخزّن محلياً)
export const REF = { loaded: false, divisions: [], sections: [], items: [], variants: [], byDiv: {}, bySec: {}, byItem: {}, byVar: {}, version: null };
const CACHE_KEY = 'ahc_ref_cache_v1';

async function fetchAll(table, select, order) {
  const out = []; const step = 1000; let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + step - 1);
    if (order) q = q.order(order);
    const { data, error } = await q; if (error) throw error;
    out.push(...data); if (data.length < step) break; from += step;
  }
  return out;
}
export async function refVersion() {
  const { data } = await sb.from('settings').select('value,updated_at').eq('key', 'ref_version').maybeSingle();
  return data ? (data.updated_at + '|' + JSON.stringify(data.value)) : 'none';
}
export async function loadRef(force = false, onProgress) {
  const ver = await refVersion();
  if (!force) {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.ver === ver && (Date.now() - c.at) < 6 * 3600e3) { index(c.data); REF.version = ver; return REF; } } catch (e) { }
  }
  onProgress && onProgress('تحميل الشُّعب والأقسام…');
  const [divisions, sections] = await Promise.all([fetchAll('divisions', 'code,ar,en,sort,active', 'sort'), fetchAll('sections', 'code,division_code,ar,en,active', 'code')]);
  onProgress && onProgress('تحميل البنود…');
  const items = await fetchAll('items', 'code,section_code,ar,en,unit,status,keywords,active', 'code');
  onProgress && onProgress('تحميل الخيارات والأسعار…');
  const variants = await fetchAll('variants', 'code,item_code,ar,en,unit,price,spec,active', 'code');
  const data = { divisions, sections, items, variants };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ver, at: Date.now(), data })); } catch (e) { }
  index(data); REF.version = ver; return REF;
}
function index(d) {
  Object.assign(REF, d);
  REF.byDiv = {}; REF.bySec = {}; REF.byItem = {}; REF.byVar = {};
  REF.divisions.forEach(x => { x.sections = []; REF.byDiv[x.code] = x; });
  REF.sections.forEach(s => { s.items = []; REF.bySec[s.code] = s; const d = REF.byDiv[s.division_code]; if (d) { s.div = d; d.sections.push(s); } });
  REF.items.forEach(it => { it.variants = []; it.keywords = it.keywords || []; REF.byItem[it.code] = it; const s = REF.bySec[it.section_code]; if (s) { it.sec = s; it.div = s.div; s.items.push(it); } });
  REF.variants.forEach(v => { REF.byVar[v.code] = v; const it = REF.byItem[v.item_code]; if (it) { v.item = it; it.variants.push(v); } });
  REF.divisions.forEach(d => d.sections.sort((a, b) => a.code.localeCompare(b.code)));
  REF.sections.forEach(s => s.items.sort((a, b) => a.code.localeCompare(b.code)));
  REF.items.forEach(i => i.variants.sort((a, b) => a.code.localeCompare(b.code)));
  REF.loaded = true;
}
export function invalidateRef() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { } }
export async function itemDetail(code) {
  const { data, error } = await sb.from('items').select('*').eq('code', code).maybeSingle();
  if (error) throw error; return data;
}

// ---------- CRUD عام
export async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }
export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
