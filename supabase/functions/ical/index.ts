// تقويم الاشتراك (iCalendar) — رابط لكل مستخدم برمزه الخاص: /functions/v1/ical?t=<token>
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE = Deno.env.get("SITE_URL") ?? "https://sayahmotlaq.github.io/ahc-projects/";

const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// طيّ الأسطر عند 74 بايت دون قطع حرف UTF-8
function fold(line: string): string {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const bytes = enc.encode(line); if (bytes.length <= 74) return line;
  const out: string[] = []; let i = 0, first = true;
  while (i < bytes.length) {
    let n = Math.min(first ? 74 : 73, bytes.length - i);
    while (n > 0 && i + n < bytes.length && (bytes[i + n] & 0xC0) === 0x80) n--; // لا تقطع داخل حرف
    out.push((first ? "" : " ") + dec.decode(bytes.slice(i, i + n))); i += n; first = false;
  }
  return out.join("\r\n");
}
const ymd = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const t = (u.searchParams.get("t") ?? "").trim();
  if (!/^[a-f0-9]{24,64}$/.test(t)) return new Response("not found", { status: 404 });
  const sb = createClient(SB_URL, SB_KEY);
  const { data, error } = await sb.rpc("cal_feed", { p_token: t });
  if (error) return new Response("error", { status: 500 });
  const rows = (data ?? []) as { uid: string; kind: string; title: string; descr: string; on_date: string; url: string; done: boolean; owner_name: string }[];
  if (!rows.length && !(await sb.from("profiles").select("id").eq("cal_token", t).maybeSingle()).data) return new Response("not found", { status: 404 });
  const name = rows[0]?.owner_name ?? "";
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AHC Projects//Calendar//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc("مشاريع التجمع" + (name ? " — " + name : ""))}`, "X-WR-TIMEZONE:Asia/Riyadh", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  const now = stamp();
  for (const r of rows) {
    if (!r.on_date) continue;
    const link = SITE + r.url.replace(/^#?/, "#");
    L.push("BEGIN:VEVENT", `UID:${r.uid}@ahc-projects`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${ymd(r.on_date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(r.on_date))}`,
      `SUMMARY:${esc(r.title)}`, `DESCRIPTION:${esc((r.descr ? r.descr + "\n" : "") + link)}`, `URL:${link}`, `CATEGORIES:${esc(r.kind)}`, `STATUS:${r.done ? "CONFIRMED" : "TENTATIVE"}`, "TRANSP:TRANSPARENT");
    if (!r.done && ["task", "milestone", "submittal", "challenge", "document", "meeting"].includes(r.kind)) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)}`, "TRIGGER:-PT15H", "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  const body = L.map(fold).join("\r\n") + "\r\n";
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "content-disposition": 'inline; filename="ahc-projects.ics"' } });
});
