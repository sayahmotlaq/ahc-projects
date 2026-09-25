// دالة إرسال إشعارات الجهاز (Web Push) — تُستدعى من قاعدة البيانات عند إدراج إشعار
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SECRET = Deno.env.get("PUSH_SECRET") ?? "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
webpush.setVapidDetails("mailto:saya7motlaq@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (req.headers.get("x-push-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  const n = await req.json();
  const sb = createClient(SB_URL, SB_KEY);
  // تفضيلات المستخدم: هل يريد هذا النوع على الجهاز؟
  const { data: prof } = await sb.from("profiles").select("notify_prefs").eq("id", n.user_id).maybeSingle();
  const prefs = (prof?.notify_prefs ?? {}) as Record<string, unknown>;
  if (prefs.push === false) return Response.json({ skipped: "push_off" });
  const kinds = (prefs.kinds ?? {}) as Record<string, boolean>;
  if (kinds[n.kind] === false) return Response.json({ skipped: "kind_off" });
  const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.user_id);
  if (!subs?.length) return Response.json({ sent: 0 });
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", n.user_id).is("read_at", null);
  const payload = JSON.stringify({ id: n.id, title: n.title, body: n.body, link: n.link, kind: n.kind, badge: count ?? 1 });
  let sent = 0; const dead: number[] = [];
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" }); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) dead.push(s.id); else console.error("push error", code, (e as Error).message); }
  }));
  if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
  if (sent) await sb.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
  return Response.json({ sent, removed: dead.length });
});
