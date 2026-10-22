// ===== حقل «المشروع» داخل النماذج: قائمة مرتبة (مشاريعي أولاً) مع خيار «بلا مشروع» حيث يجوز =====
import { sb, q, session } from './api.js';
import { esc } from './ui.js';

let CACHE = null, AT = 0;
export async function projectsForField() {
  if (CACHE && Date.now() - AT < 60000) return CACHE;
  const rows = await q(sb.from('projects').select('id,name,ref,engineer_id,engineer_name,contractor,facility,stage').eq('archived', false).order('name'));
  CACHE = rows; AT = Date.now(); return rows;
}
// html للحقل؛ name="project_id"
export function projectFieldHtml(list, selected = '', { allowNone = true, label = 'المشروع', noneLabel = '— بلا مشروع —', required = false } = {}) {
  const me = session.user?.id; const mine = list.filter(p => p.engineer_id === me), rest = list.filter(p => p.engineer_id !== me);
  const opt = p => `<option value="${p.id}" ${String(p.id) === String(selected || '') ? 'selected' : ''}>${esc(p.name)}${p.ref ? ' — ' + esc(p.ref) : ''}</option>`;
  return `<label class="fld wide"><span>${esc(label)}${required ? ' *' : ''}</span><select name="project_id" ${required ? 'required' : ''}>${allowNone ? `<option value="">${esc(noneLabel)}</option>` : '<option value="">— اختر المشروع —</option>'}${mine.length ? `<optgroup label="مشاريعي">${mine.map(opt).join('')}</optgroup><optgroup label="كل المشاريع">${rest.map(opt).join('')}</optgroup>` : list.map(opt).join('')}</select></label>`;
}
export const projectById = (list, id) => list.find(p => String(p.id) === String(id)) || null;
