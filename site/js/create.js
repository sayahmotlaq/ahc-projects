// ===== «＋ جديد» من أي مكان: قائمة إنشاء موحدة + اختيار المشروع بالبحث (يُعبأ تلقائياً داخل صفحة المشروع) =====
import { sb, q, session, isAdmin, canEdit, canDocs, canRead, role, REF, loadRef, stageOf } from './api.js';
import { $, $$, esc, toast, err, modal, ico, norm } from './ui.js';

const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const ctxProject = () => { const m = location.hash.match(/^#\/project\/([0-9a-f-]{36})/); return m ? m[1] : null; };
const full = id => q(sb.from('projects').select('*').eq('id', id).single());

// اختيار المشروع: بحث بالاسم أو الرقم أو المنشأة، مشاريعي أولاً، والمؤرشف مستبعد
export async function pickProject({ title = 'اختر المشروع', allowNone = false } = {}) {
  const here = ctxProject(); if (here) return full(here);
  const rows = await q(sb.from('projects').select('id,name,ref,facility,stage,engineer_id,engineer_name,updated_at').eq('archived', false).order('updated_at', { ascending: false }));
  const me = session.user.id; rows.sort((a, b) => (b.engineer_id === me) - (a.engineer_id === me));
  return new Promise(resolve => {
    let picked = null;
    modal(`<div class="pkp"><p class="muted small m0" style="margin-bottom:8px">يُسجَّل على مشروع — اختر المشروع ثم يُفتح النموذج.</p><input id="ppq" placeholder="ابحث باسم المشروع أو رقمه أو المنشأة…" autocomplete="off">${allowNone ? '<button class="pkp-i none" data-none>— بلا مشروع (طلب عام) —</button>' : ''}<div id="ppl" class="pkp-l"></div></div>`, { title, onOpen: (w, close) => {
      const draw = () => { const t = norm($('#ppq', w).value);
        const list = rows.filter(p => !t || norm(`${p.name} ${p.ref || ''} ${p.facility || ''} ${p.engineer_name || ''}`).includes(t)).slice(0, 60);
        $('#ppl', w).innerHTML = list.map(p => `<button class="pkp-i" data-id="${p.id}"><b>${esc(p.name)}</b><span>${p.engineer_id === me ? '<em>مشروعي</em> · ' : ''}${esc(stageOf(p.stage).ar)}${p.facility ? ' · ' + esc(p.facility) : ''}${p.ref ? ' · <span class="ltr">' + esc(p.ref) + '</span>' : ''}</span></button>`).join('') || '<p class="muted">لا نتائج.</p>';
        $$('.pkp-i[data-id]', w).forEach(b => b.onclick = async () => { picked = await full(b.dataset.id); close(true); }); };
      $('#ppq', w).oninput = draw; draw(); setTimeout(() => $('#ppq', w)?.focus(), 50);
      const n = $('[data-none]', w); if (n) n.onclick = () => { picked = 'none'; close(true); };
    } }).then(() => resolve(picked === 'none' ? { none: true } : picked));
  });
}

const projectList = (tbl, pid) => q(sb.from(tbl).select('*').eq('project_id', pid));
const ensureRef = async () => { if (!REF.loaded) await loadRef(); };

// كل إجراء: [المفتاح، العنوان، الأيقونة، الوصف، الصلاحية، المجموعة، المنفذ]
const ACTIONS = [
  ['task', 'مهمة', 'check', 'تكليف بعمل بموعد', canEdit, 'prj', async p => (await import('./tasks.js')).taskForm(null, p, done('المهمة')), { direct: true }],
  ['request', 'طلب', 'inbox', 'طلب على مشروع أو عام', canEdit, 'prj', async p => (await import('./tasks.js')).requestForm(null, p, done('الطلب')), { direct: true }],
  ['challenge', 'تحدٍ أو خطر', 'alert', 'معوّق يحتاج تدخلاً', canEdit, 'prj', async p => (await import('./challenges.js')).chForm(null, p, await (await import('./pfield.js')).projectsForField(), done('التحدي')), { direct: true }],
  ['treport', 'تقرير فني أو محضر', 'file', 'زيارة، استلام، اجتماع', canEdit, 'prj', async p => { location.hash = `#/treport/new?p=${p.id}`; }],
  ['submittal', 'طلب اعتماد', 'stamp', 'مواد، مخططات، عينات', canEdit, 'prj', async p => (await import('./docs.js')).subForm(null, p, await projectList('submittals', p.id), done('طلب الاعتماد'))],
  ['doc', 'مستند رسمي', 'doc', 'عقد، خطاب، ضمان، تأمين', canDocs, 'prj', async p => (await import('./docs.js')).docForm(null, p, done('المستند'))],
  ['drawing', 'مخطط', 'draw', 'رفع مخطط أو مراجعة', canEdit, 'prj', async p => (await import('./docs.js')).dwgForm(null, p, done('المخطط'))],
  ['payment', 'مستخلص', 'coins', 'دفعة للمقاول', canEdit, 'prj', async p => (await import('./payments.js')).payForm(null, p, await projectList('payments', p.id), done('المستخلص'))],
  ['change', 'أمر تغيير أو تمديد', 'edit', 'زيادة، تخفيض، مدة', canEdit, 'prj', async p => (await import('./closeout.js')).coForm(null, p, await projectList('change_orders', p.id), done('أمر التغيير'))],
  ['boq', 'جدول كميات', 'coins', 'تقديري أو مقطوعية', canEdit, 'prj', async p => { location.hash = `#/project/${p.id}/boq?new=1`; }],
  ['spec', 'جدول مواد ومواصفات', 'ruler', 'البنود المعتمدة للمقاول', canEdit, 'prj', async p => { await ensureRef(); (await import('./studies.js')).newSpecSet({ project_id: p.id }); }],
  ['project', 'مشروع جديد', 'folder', 'تسجيل مشروع', canEdit, 'gen', async () => (await import('./projects.js')).editProject(null, id => location.hash = '#/project/' + id)],
  ['study', 'دراسة', 'ruler', 'قبل أن يصير مشروعاً', canEdit, 'gen', async () => { location.hash = '#/studies?new=1&r=' + Date.now(); }],
  ['ops', 'بلاغ أو طلب صيانة', 'wrench', 'للأقسام الفنية', () => true, 'gen', async () => { location.hash = '#/ops/new'; }],
];
function done(what) { return () => { toast(`حُفظ ${what}`); rerender(); }; }

export async function openCreate() {
  const acts = ACTIONS.filter(a => a[4]());
  if (!acts.length) return;
  const here = ctxProject(); let hereName = '';
  if (here) { try { hereName = (await q(sb.from('projects').select('name').eq('id', here).single())).name; } catch (e) { } }
  const card = a => `<button class="cr-i" data-k="${a[0]}">${ico(a[2])}<b>${a[1]}</b><small>${a[3]}</small></button>`;
  const prj = acts.filter(a => a[5] === 'prj'), gen = acts.filter(a => a[5] === 'gen');
  modal(`${prj.length ? `<div class="cr-h">${hereName ? `في مشروع: <b>${esc(hereName)}</b>` : 'العمل والمشاريع'}</div><div class="cr-g">${prj.map(card).join('')}</div>` : ''}
    ${gen.length ? `<div class="cr-h">عام</div><div class="cr-g">${gen.map(card).join('')}</div>` : ''}`, { title: 'إنشاء جديد', wide: true, onOpen: (w, close) => {
    $$('[data-k]', w).forEach(b => b.onclick = async () => {
      const a = ACTIONS.find(x => x[0] === b.dataset.k); close();
      try {
        if (a[5] === 'gen') return a[6]();
        await run(a);
      } catch (e) { err(e); }
    });
  } });
}

// زر إنشاء في صفحة قائمة عامة: يختار المشروع ثم يفتح النموذج
export function listNew(key) { const a = ACTIONS.find(x => x[0] === key); if (!a || !a[4]()) return ''; return `<button class="btn primary" data-lnew="${key}">＋ ${a[1]}</button>`; }
export function bindListNew(root) { $$('[data-lnew]', root).forEach(b => b.onclick = async () => { try { await run(ACTIONS.find(x => x[0] === b.dataset.lnew)); } catch (e) { err(e); } }); }
async function run(a) {
  if (a[7]?.direct) { const here = ctxProject(); return a[6](here ? await full(here) : null); }
  const p = await pickProject({ title: `إنشاء: ${a[1]}`, ...(a[7] || {}) }); if (!p) return; return a[6](p.none ? null : p);
}
