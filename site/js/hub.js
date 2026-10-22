// ===== صفحات مجمّعة بتبويبات: «المهام والطلبات» و«المستندات والاعتمادات» — بدل صفحات متفرقة في القائمة =====
import { esc } from './ui.js';

export const HUBS = {
  work: { title: 'المهام والطلبات', sub: 'كل ما يحتاج متابعة على المشاريع في مكان واحد.', tabs: [
    ['tasks', 'المهام', async (m, p) => (await import('./tasks.js')).mountTasks(m, p)],
    ['requests', 'الطلبات', async (m, p) => (await import('./tasks.js')).mountRequests(m, p)],
    ['challenges', 'التحديات والمخاطر', async (m, p) => (await import('./challenges.js')).mountChallenges(m, p)],
  ] },
  records: { title: 'المستندات والاعتمادات', sub: 'التقارير الفنية والمحاضر، طلبات الاعتماد، المستندات الرسمية، والمخططات لكل المشاريع.', tabs: [
    ['treports', 'التقارير الفنية والمحاضر', async (m, p) => (await import('./treports.js')).mountTReports(m, p)],
    ['submittals', 'الاعتمادات', async (m, p) => (await import('./docs.js')).mountSubmittals(m, p)],
    ['documents', 'المستندات الرسمية', async (m, p) => (await import('./docs.js')).mountDocsAll(m, p)],
    ['drawings', 'المخططات', async (m, p) => (await import('./docs.js')).mountDrawingsAll(m, p)],
  ] },
};
// المسار القديم ← المجموعة (الروابط القديمة تبقى تعمل وتفتح داخل المجموعة)
export const HUB_OF = Object.fromEntries(Object.entries(HUBS).flatMap(([h, d]) => d.tabs.map(t => [t[0], h])));

export async function mountHub(root, hub, tab, params) {
  const H = HUBS[hub]; const cur = H.tabs.find(t => t[0] === tab) || H.tabs[0];
  root.innerHTML = `<div class="hubh"><div><h1 class="pagetitle">${esc(H.title)}</h1><p class="muted m0">${esc(H.sub)}</p></div></div>
    <nav class="fmtabs hubtabs">${H.tabs.map(t => `<a href="#/${t[0]}" class="${t === cur ? 'on' : ''}">${esc(t[1])}</a>`).join('')}</nav><div class="hub-body" id="hubBody"></div>`;
  await cur[2](root.querySelector('#hubBody'), params);
}
