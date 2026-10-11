// ===== المرفقات العامة: ملفات (PDF، صور، Word، Excel، DWG…) مرتبطة بأي عنصر عبر مفتاح ref مثل treport:12 أو thread:c-55 =====
import { sb, q, session, isAdmin, canRead } from './api.js';
import { $, $$, esc, toast, err, confirm } from './ui.js';

const BUCKET = 'project-files', MAX = 25 * 1024 * 1024;
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.zip,.txt,.csv';
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const icon = n => { const e = (n.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase(); return e === 'pdf' ? '📄' : /^(jpe?g|png|webp|gif)$/.test(e) ? '🖼️' : /^(docx?|txt)$/.test(e) ? '📝' : /^(xlsx?|csv)$/.test(e) ? '📊' : /^(dwg|dxf)$/.test(e) ? '📐' : '📎'; };
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب';
const safeKey = s => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

export async function uploadAttachment(file, ref, projectId = null) {
  if (file.size > MAX) throw new Error(`«${file.name}» يتجاوز 25 م.ب`);
  let blob = file, name = file.name;
  if (/^image\//.test(file.type) && file.size > 600 * 1024) { try { const { compress } = await import('./treports.js'); blob = await compress(file, 2000, 0.85); name = name.replace(/\.[^.]+$/, '') + '.jpg'; } catch (e) { } }
  const m = name.match(/\.([A-Za-z0-9]{1,6})$/); const ext = m ? m[1].toLowerCase() : EXT[blob.type || file.type] || 'bin';
  const path = `attach/${safeKey(ref)}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error(error.message?.includes('exceeded') ? 'حجم الملف يتجاوز الحد المسموح' : error.message);
  return await q(sb.from('attachments').insert({ ref, project_id: projectId, name, path, size: blob.size, mime: blob.type || file.type || '', by_user: session.user.id }).select('*').single());
}
export async function openAttachment(a) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(a.path, 3600); if (error) return err(error); window.open(data.signedUrl, '_blank'); }
export async function deleteAttachment(a) { await sb.storage.from(BUCKET).remove([a.path]); await q(sb.from('attachments').delete().eq('id', a.id)); }
export const loadAttachments = async refs => refs.length ? q(sb.from('attachments').select('*').in('ref', refs).order('id')) : [];
export const canDel = a => isAdmin() || a.by_user === session.user.id;

// شريحة ملف صغيرة (للقراءة والفتح) — تُستخدم داخل سلاسل المتابعة وغيرها
export const attachChip = a => `<button type="button" class="achip" data-att="${a.id}" title="${esc(a.name)} · ${kb(a.size || 0)}">${icon(a.name)} <span>${esc(a.name)}</span></button>`;
export function bindChips(root, list, onDeleted) {
  $$('[data-att]', root).forEach(b => { b.onclick = e => { e.stopPropagation(); const a = list.find(x => x.id === +b.dataset.att); if (a) openAttachment(a); }; });
  $$('[data-attdel]', root).forEach(b => { b.onclick = async e => { e.stopPropagation(); const a = list.find(x => x.id === +b.dataset.attdel); if (!a || !await confirm(`حذف «${a.name}»؟`, 'حذف', true)) return; try { await deleteAttachment(a); onDeleted && onDeleted(a); } catch (er) { err(er); } }; });
}

// صندوق مرفقات كامل لعنصر: قائمة + رفع + حذف. ref مثل 'treport:12'
export const attachBox = (title = 'المرفقات') => `<div class="attbox"><h3 class="sub-h">${esc(title)} <span class="muted attn"></span></h3><div class="attl"><p class="muted small">…</p></div><label class="btn sm attadd">📎 إرفاق ملف <input type="file" multiple accept="${ACCEPT}" hidden></label><small class="muted"> PDF أو صور أو Word/Excel أو DWG — حتى 25 م.ب للملف</small></div>`;
export async function mountAttachBox(container, ref, { projectId = null, canAdd = canRead() } = {}) {
  const box = container.matches?.('.attbox') ? container : $('.attbox', container); if (!box) return;
  const list = $('.attl', box), n = $('.attn', box), add = $('.attadd', box), inp = $('input[type=file]', box);
  if (!canAdd) add.hidden = true;
  let rows = [];
  const render = () => { n.textContent = rows.length ? `(${rows.length})` : ''; list.innerHTML = rows.length ? rows.map(a => `<div class="attrow"><span class="aic">${icon(a.name)}</span><button type="button" class="aname" data-att="${a.id}">${esc(a.name)}</button><small class="muted">${kb(a.size || 0)}</small>${canDel(a) ? `<button type="button" class="x" data-attdel="${a.id}" title="حذف">✕</button>` : ''}</div>`).join('') : '<p class="muted small m0">لا مرفقات.</p>'; bindChips(list, rows, a => { rows = rows.filter(x => x.id !== a.id); render(); }); };
  const reload = async () => { rows = await loadAttachments([ref]); render(); };
  inp.onchange = async () => { const files = [...inp.files]; inp.value = ''; if (!files.length) return; add.classList.add('busy'); let k = 0; for (const f of files) { k++; try { toast(`رفع ${k} من ${files.length}: ${f.name}`); const a = await uploadAttachment(f, ref, projectId); rows.push(a); render(); } catch (er) { err(er); } } add.classList.remove('busy'); if (files.length) toast('اكتمل الرفع'); };
  await reload();
}
