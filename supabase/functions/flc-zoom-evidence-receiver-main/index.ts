// FLC Academy MAIN — minimal trusted Zoom attendance evidence receiver.
// Inert until FLC_ZOOM_RELAY_SECRET is configured in BOTH isolated environments
// and the testing webhook is explicitly updated. Never updates lead availability.
const te = new TextEncoder();
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
async function hmacHex(keyText: string, value: string) {
  const key = await crypto.subtle.importKey("raw", te.encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(value));
  return Array.from(new Uint8Array(sig), v => v.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string) {
  const x = te.encode(a), y = te.encode(b);
  if (x.length !== y.length) return false;
  let v = 0; for (let i = 0; i < x.length; ++i) v |= x[i] ^ y[i];
  return v === 0;
}
Deno.serve(async request => {
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("FLC_ZOOM_RELAY_SECRET") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (secret.length < 32 || !url || !key) return respond({ error: "relay_not_configured" }, 503);
  const timestamp = request.headers.get("x-flc-relay-timestamp") ?? "";
  const signature = request.headers.get("x-flc-relay-signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return respond({ error: "unauthorized" }, 401);
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 120) return respond({ error: "expired" }, 401);
  const raw = await request.text();
  if (raw.length > 4096) return respond({ error: "too_large" }, 413);
  if (!equal(signature, await hmacHex(secret, `${timestamp}.${raw}`)))
    return respond({ error: "unauthorized" }, 401);
  let p: Record<string, unknown>;
  try { p = JSON.parse(raw); } catch { return respond({ error: "invalid_json" }, 400); }
  if (p.meeting_alias !== "Nationwide - Sala de Trabajo" ||
      !["meeting.participant_joined", "meeting.participant_left"].includes(String(p.event_type)) ||
      typeof p.zoom_user_id !== "string" || !p.zoom_user_id.trim() || p.zoom_user_id.length > 256 ||
      typeof p.source_event_hash !== "string" || !/^[a-f0-9]{64}$/.test(p.source_event_hash) ||
      typeof p.source_event_at !== "string" || !Number.isFinite(Date.parse(p.source_event_at))) {
    return respond({ error: "invalid_payload" }, 400);
  }
  const eventTime = Date.parse(p.source_event_at);
  if (Math.abs(Date.now() - eventTime) > 2 * 60_000) return respond({ error: "stale_event" }, 400);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  const lookup = new URL("/rest/v1/flc_zoom_identity_links", url);
  lookup.searchParams.set("select", "academy_user_id");
  lookup.searchParams.set("zoom_user_id", "eq." + p.zoom_user_id);
  lookup.searchParams.set("limit", "1");
  let res: Response;
  try { res = await fetch(lookup, { headers }); }
  catch { return respond({ error: "identity_lookup_failed" }, 503); }
  if (!res.ok) return respond({ error: "identity_lookup_failed" }, 503);
  const linked = await res.json() as Array<{ academy_user_id: string }>;
  if (linked.length !== 1) return respond({ accepted: true, matched: false, recorded: false });
  const evidence = {
    academy_user_id: linked[0].academy_user_id,
    meeting_alias: p.meeting_alias,
    event_type: p.event_type,
    source_event_hash: p.source_event_hash,
    source_event_at: new Date(eventTime).toISOString(),
    evidence_status: "identity_verified",
  };
  const insert = new URL("/rest/v1/flc_zoom_attendance_evidence", url);
  insert.searchParams.set("on_conflict", "source_event_hash");
  try {
    res = await fetch(insert, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(evidence),
    });
  } catch { return respond({ error: "evidence_storage_failed" }, 503); }
  if (!res.ok) return respond({ error: "evidence_storage_failed" }, 503);
  return respond({ accepted: true, matched: true, recorded_or_duplicate: true, availability_changed: false });
});
