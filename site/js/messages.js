// ===== رسائل اليوم من الإدارة: صوت الرئيس في «يومي» — توجيه / شكر / تنبيه / معلومة، بقراءات وردود =====
import { sb, q, session, isAdmin, today } from './api.js';
import { $, $$, esc, dateAr, toast, err, modal, confirm, field, inp, sel, formData, ico } from './ui.js';

export const M_KIND = { direct: ['توجيه', 'k-direct'], thanks: ['شكر وتقدير', 'k-thanks'], alert: ['تنبيه', 'k-alert'], info: ['معلومة', 'k-info'] };
let profiles = [];
async function loadProfiles() { if (!profiles.length) profiles = await q(sb.from('profiles').select('id,full_name,role,title').not('role', 'in', '("pending","disabled")').order('full_name')); return profiles; }
const pname = id => profiles.find(p => p.id === id)?.full_name || '—';
const first = n => (n || '').trim().split(' ')[0];
const initials = n => (n || '؟').trim().split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('');
const ago = d => { const m = Math.floor((Date.now() - new Date(d)) / 6e4); return m < 1 ? 'الآن' : m < 60 ? `منذ ${m} د` : m < 1440 ? `منذ ${Math.floor(m / 60)} س` : dateAr(d); };

async function loadMessages(all = false) {
  const me = session.user.id, admin = isAdmin();
  let qb = sb.from('messages').select('*').order('pinned', { ascending: false }).order('show_from', { ascending: false }).limit(all ? 60 : 12);
  if (!all) qb = qb.eq('archived', false).lte('show_from', new Date().toISOString());
  const msgs = await q(qb);
  const ids = msgs.map(m => m.id);
  const reads = ids.length ? await q(sb.from('message_reads').select('*').in('message_id', ids)) : [];
  return { msgs: msgs.filter(m => all || !m.expires_at || new Date(m.expires_at) > new Date()), reads, me, admin };
}

// ---------- بطاقة «يومي»
let LAST = null;
export async function todayMessagesCard(root, focusId) {
  await loadProfiles();
  const { msgs, reads, me, admin } = await loadMessages(false); LAST = { msgs, reads, me, admin, focusId };
  const mine = m => m.author_id === me;
  const authors = [...new Set(msgs.map(m => m.author_id))];
  const title = admin ? 'رسائلك للفريق' : authors.length === 1 ? `رسائل اليوم من ${esc(first(pname(authors[0])))}` : 'رسائل اليوم من الإدارة';
  if (!admin && !msgs.length) return '';
  const targets = m => m.audience === 'all' ? profiles.filter(p => p.id !== m.author_id).map(p => p.id) : m.recipients;
  const item = m => {
    const r = reads.find(x => x.message_id === m.id && x.user_id === me); const K = M_KIND[m.kind] || M_KIND.info;
    const toMe = m.recipients?.includes(me); const priv = m.visibility === 'private';
    const tg = targets(m); const rd = reads.filter(x => x.message_id === m.id && tg.includes(x.user_id)); const unread = tg.filter(u => !rd.some(x => x.user_id === u));
    const replies = reads.filter(x => x.message_id === m.id && x.reply);
    return `<div class="msg ${K[1]} ${m.pinned ? 'pinned' : ''} ${toMe && !r && !mine(m) ? 'new' : ''}" data-m="${m.id}" id="msg${m.id}">
      <div class="mh"><span class="av">${esc(initials(pname(m.author_id)))}</span><div class="mi"><b>${esc(pname(m.author_id))}</b><small>${ago(m.show_from)} · <span class="kchip">${K[0]}</span>${m.pinned ? ' · 📌 مثبتة' : ''}${m.audience === 'users' ? ` · إلى: ${esc(m.recipients.map(u => first(pname(u))).join('، '))}` : ''}${priv ? ' · <span class="lock">🔒 خاصة</span>' : ''}</small></div></div>
      <div class="mb">${esc(m.body)}</div>
      ${m.link ? `<a class="mlink" href="${esc(m.link)}">${ico('folder')} ${esc(m.link_label || m.link)}</a>` : ''}
      ${replies.length && (admin || mine(m)) ? `<div class="mreplies">${replies.map(x => `<div class="mr"><b>${esc(first(pname(x.user_id)))}:</b> ${esc(x.reply)}</div>`).join('')}</div>` : ''}
      <div class="mf">
        ${!mine(m) ? (r ? `<span class="read">✓ قرأتها${r.reply ? ' · رددت' : ''}</span>${r.reply ? '' : `<button class="btn sm" data-reply="${m.id}">ردّ قصير</button>`}` : `<button class="btn sm primary" data-read="${m.id}">قرأتها ✓</button><button class="btn sm" data-reply="${m.id}">ردّ قصير</button>`) : ''}
        ${admin || mine(m) ? `<span class="muted small" title="${esc(unread.map(u => first(pname(u))).join('، ') || 'الكل قرأها')}">قرأها ${rd.length} / ${tg.length}${unread.length && unread.length <= 3 ? ` <span class="muted">(لم يقرأ: ${esc(unread.map(u => first(pname(u))).join('، '))})</span>` : ''}</span><span class="sp"></span><button class="btn sm" data-task="${m.id}" title="تحويل الرسالة إلى مهمة">→ مهمة</button><button class="btn sm" data-pin="${m.id}">${m.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button><button class="btn sm" data-edit="${m.id}">تعديل</button><button class="btn sm" data-arch="${m.id}">أرشفة</button>` : ''}
      </div></div>`;
  };
  const html = `<div class="pcard msgs" id="msgsCard"><h2>${title} ${msgs.length ? `<span class="badge ${msgs.some(m => m.recipients?.includes(me) && !reads.some(x => x.message_id === m.id && x.user_id === me) && m.author_id !== me) ? 'bad' : 'skel'}">${msgs.length}</span>` : ''}<span class="sp"></span>${admin ? '<button class="btn sm primary" id="mNew">＋ رسالة</button>' : ''}<button class="btn sm" id="mArch">الأرشيف</button></h2>
    ${msgs.length ? `<div class="mlist">${msgs.map(item).join('')}</div>` : `<p class="muted small m0">لم ترسل رسالة اليوم — كلمة صباحية قصيرة للفريق، أو شكر لمن أنجز أمس، تصنع فرقاً.</p>`}</div>`;
  return html;
}
export function bindMessagesCard(root) {
  if (!LAST) return; const { msgs, reads, me, focusId } = LAST;
  {
    const card = $('#msgsCard', root); if (!card) return;
    const refresh = async () => { const h = await todayMessagesCard(root); card.outerHTML = h || ''; bindMessagesCard(root); };
    const nb = $('#mNew', card); if (nb) nb.onclick = () => composer(null, refresh);
    $('#mArch', card).onclick = () => archive(refresh);
    $$('[data-read]', card).forEach(b => b.onclick = async () => { try { await q(sb.from('message_reads').upsert({ message_id: +b.getAttribute('data-read'), user_id: me })); b.closest('.msg').classList.remove('new'); refresh(); } catch (e) { err(e); } });
    $$('[data-reply]', card).forEach(b => b.onclick = () => { const id = +b.getAttribute('data-reply'); modal(`<form id="f"><label class="fld"><span>ردّ قصير (يصل الكاتب إشعاراً)</span><textarea name="reply" rows="2" required maxlength="300"></textarea></label><div class="btnrow end mt10"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">إرسال</button></div></form>`, { title: 'ردّ', onOpen: (w, close) => { $('#f', w).onsubmit = async e => { e.preventDefault(); try { await q(sb.from('message_reads').upsert({ message_id: id, user_id: me, reply: formData(e.target).reply.trim() })); toast('أُرسل الرد'); close(); refresh(); } catch (er) { err(er); } }; } }); });
    $$('[data-pin]', card).forEach(b => b.onclick = async () => { const m = msgs.find(x => x.id === +b.getAttribute('data-pin')); try { await q(sb.from('messages').update({ pinned: !m.pinned }).eq('id', m.id)); refresh(); } catch (e) { err(e); } });
    $$('[data-arch]', card).forEach(b => b.onclick = async () => { try { await q(sb.from('messages').update({ archived: true }).eq('id', +b.getAttribute('data-arch'))); toast('أُرشفت'); refresh(); } catch (e) { err(e); } });
    $$('[data-edit]', card).forEach(b => b.onclick = () => composer(msgs.find(x => x.id === +b.getAttribute('data-edit')), refresh));
    $$('[data-task]', card).forEach(b => b.onclick = async () => { const m = msgs.find(x => x.id === +b.getAttribute('data-task')); const { taskForm } = await import('./tasks.js'); const pid = (m.link || '').match(/#\/project\/([0-9a-f-]{36})/)?.[1]; const p = pid ? await q(sb.from('projects').select('*').eq('id', pid).single()) : await pickProject(); if (!p) return; taskForm(null, p, refresh, { title: m.body.slice(0, 80), details: m.body, assignee_id: m.audience === 'users' && m.recipients.length === 1 ? m.recipients[0] : (p.engineer_id || '') }); });
    if (focusId) { const el = $('#msg' + focusId, card); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('hl'); } LAST.focusId = null; }
  }
}
async function pickProject() {
  const ps = await q(sb.from('projects').select('*').eq('archived', false).order('name'));
  return new Promise(res => { let ok = false; modal(`<form id="f">${field('المشروع الذي تُنشأ فيه المهمة', sel('p', ps.map(p => [p.id, p.name]), ps[0]?.id))}<div class="btnrow end mt10"><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">متابعة</button></div></form>`, { title: 'تحويل إلى مهمة', onOpen: (w, close) => { $('#f', w).onsubmit = e => { e.preventDefault(); ok = true; close(); res(ps.find(p => p.id === formData(e.target).p)); }; } }).then(() => { if (!ok) res(null); }); });
}

// ---------- الإنشاء / التعديل (الإدارة)
async function composer(m, done) {
  await loadProfiles(); const me = session.user.id;
  const v = m || { kind: 'info', body: '', audience: 'all', recipients: [], visibility: 'public', pinned: false, expires: '7', link: '', link_label: '' };
  const staff = profiles.filter(p => p.id !== me);
  const ps = await q(sb.from('projects').select('id,name').eq('archived', false).not('stage', 'in', '("closed","cancelled")').order('name'));
  const exp = m ? (m.expires_at ? String(Math.max(1, Math.round((new Date(m.expires_at) - new Date(m.show_from)) / 864e5))) : '0') : '7';
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(6, 30, 0, 0); return d; };
  const toLocal = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 16); };
  await modal(`<form id="f" class="pgrid">
      ${field('نوع الرسالة', sel('kind', Object.entries(M_KIND).map(([k, v]) => [k, v[0]]), v.kind))}
      ${field('إلى', sel('audience', [['all', 'الجميع'], ['users', 'أشخاص محددون']], v.audience, 'id="aud"'))}
      <div class="wide" id="recBox" style="${v.audience === 'users' ? '' : 'display:none'}"><div class="chips">${staff.map(p => `<label class="chip chk"><input type="checkbox" name="rec" value="${p.id}" ${v.recipients?.includes(p.id) ? 'checked' : ''}> ${esc(p.full_name)}</label>`).join('')}</div><label class="chk mt8"><input type="checkbox" name="private" ${v.visibility === 'private' ? 'checked' : ''}> خاصة — يراها المستلمون فقط (وإلا تظهر للجميع باسمهم، كالشكر العلني)</label></div>
      ${field('نص الرسالة *', `<textarea name="body" rows="4" required maxlength="1200" placeholder="قصيرة وواضحة… مثال: شكراً لحسين على تقرير المدخل أمس — هذا هو المستوى المطلوب من الجميع.">${esc(v.body)}</textarea>`, 'wide')}
      ${field('ربط بمشروع (اختياري)', sel('link', [['', '—'], ...ps.map(p => [`#/project/${p.id}`, p.name])], v.link || ''), 'wide')}
      ${field('تبقى ظاهرة', sel('expires', [['1', 'يوماً واحداً'], ['3', '3 أيام'], ['7', 'أسبوعاً'], ['30', 'شهراً'], ['0', 'حتى أرشفتها']], exp))}
      ${field('موعد الظهور', `<div class="btnrow"><input name="show_from" type="datetime-local" value="${m ? toLocal(m.show_from) : ''}" style="flex:1"><button type="button" class="btn sm" id="tmr">صباح الغد</button></div>`)}
      <label class="chk"><input type="checkbox" name="pinned" ${v.pinned ? 'checked' : ''}> تثبيت أعلى الصندوق</label>
      <div class="btnrow end wide">${m ? '<button type="button" class="btn danger" data-del>حذف</button>' : ''}<span class="sp"></span><button type="button" class="btn" data-x>إلغاء</button><button class="btn primary">${m ? 'حفظ' : 'إرسال'}</button></div></form>`, { title: m ? 'تعديل الرسالة' : 'رسالة للفريق', wide: true, onOpen: (w, close) => {
      $('#aud', w).onchange = () => { $('#recBox', w).style.display = $('#aud', w).value === 'users' ? '' : 'none'; };
      $('#tmr', w).onclick = () => { $('[name=show_from]', w).value = toLocal(tomorrow()); };
      $('#f', w).onsubmit = async e => { e.preventDefault(); const f = formData(e.target); const rec = $$('[name=rec]:checked', w).map(x => x.value);
        if (f.audience === 'users' && !rec.length) return toast('اختر مستلماً واحداً على الأقل');
        const show = f.show_from ? new Date(f.show_from) : (m ? new Date(m.show_from) : new Date());
        const row = { kind: f.kind, body: f.body.trim(), audience: f.audience, recipients: f.audience === 'users' ? rec : [], visibility: f.audience === 'users' && f.private ? 'private' : 'public', pinned: !!f.pinned, show_from: show.toISOString(), expires_at: f.expires === '0' ? null : new Date(show.getTime() + Number(f.expires) * 864e5).toISOString(), link: f.link || null, link_label: f.link ? ps.find(p => `#/project/${p.id}` === f.link)?.name || null : null, updated_at: new Date().toISOString() };
        try { if (m) await q(sb.from('messages').update(row).eq('id', m.id)); else await q(sb.from('messages').insert({ ...row, author_id: me })); toast(m ? 'تم الحفظ' : (show > new Date() ? 'ستظهر في موعدها' : 'أُرسلت')); close(); done(); } catch (er) { err(er); } };
      const d = $('[data-del]', w); if (d) d.onclick = async () => { if (!await confirm('حذف الرسالة نهائياً؟', 'حذف', true)) return; try { await q(sb.from('messages').delete().eq('id', m.id)); close(); done(); } catch (er) { err(er); } };
    } });
}

// ---------- الأرشيف
async function archive(done) {
  await loadProfiles(); const { msgs, reads, me, admin } = await loadMessages(true);
  const old = msgs;
  await modal(old.length ? `<div class="mlist arch">${old.map(m => { const K = M_KIND[m.kind] || M_KIND.info; const n = reads.filter(x => x.message_id === m.id).length; return `<div class="msg ${K[1]} ${m.archived ? 'off' : ''}"><div class="mh"><span class="av">${esc(initials(pname(m.author_id)))}</span><div class="mi"><b>${esc(pname(m.author_id))}</b><small>${dateAr(m.show_from)} · ${K[0]}${m.archived ? ' · مؤرشفة' : new Date(m.show_from) > new Date() ? ' · مجدولة' : ''}${m.audience === 'users' ? ' · إلى: ' + esc(m.recipients.map(u => first(pname(u))).join('، ')) : ''}</small></div>${admin ? `<span class="sp"></span><span class="muted small">قرأها ${n}</span>${m.archived ? `<button class="btn sm" data-un="${m.id}">إعادة</button>` : ''}` : ''}</div><div class="mb">${esc(m.body)}</div></div>`; }).join('')}</div>` : '<p class="muted">لا رسائل سابقة.</p>', { title: 'أرشيف الرسائل', wide: true, onOpen: (w, close) => {
    $$('[data-un]', w).forEach(b => b.onclick = async () => { try { await q(sb.from('messages').update({ archived: false }).eq('id', +b.getAttribute('data-un'))); close(); done(); } catch (e) { err(e); } });
  } });
}
