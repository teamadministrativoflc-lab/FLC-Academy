// FLC Academy Testing — AuraFlow (HighLevel) lead intake only.
// Never assigns agents, triggers outbound calls, or modifies source CRM.
// Required secret in Supabase Edge Functions: FLC_LEAD_INGEST_TOKEN
// HighLevel Webhook header: X-FLC-Ingest-Token: <same secret>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const text = (x: unknown, max = 500): string =>
  typeof x === "string" ? x.trim().slice(0, max) : typeof x === "number" ? String(x) : "";
const first = (...values: unknown[]) => values.map(v => text(v)).find(Boolean) ?? "";
const encoder = new TextEncoder();
async function validSecret(provided: string, expected: string): Promise<boolean> {
  if (!expected || !provided || provided.length > 256) return false;
  const hashes = await Promise.all([expected, provided].map(x => crypto.subtle.digest("SHA-256", encoder.encode(x))));
  const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("FLC_LEAD_INGEST_TOKEN") ?? "";
  if (!secret || secret.length < 32) return json({ error: "ingest_not_configured" }, 503);
  const receivedToken = req.headers.get("x-flc-ingest-token") ?? "";
  if (!(await validSecret(receivedToken, secret))) return json({ error: "unauthorized" }, 401);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 65536) return json({ error: "payload_too_large" }, 413);
  let body: string;
  try { body = await req.text(); } catch { return json({ error: "request_unreadable" }, 400); }
  if (body.length > 65536) return json({ error: "payload_too_large" }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return json({ error: "invalid_json" }, 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400);
  const p = parsed as Record<string, unknown>;
  const contact = p.contact && typeof p.contact === "object" && !Array.isArray(p.contact)
    ? p.contact as Record<string, unknown> : p;
  const contactId = first(contact.id, contact.contact_id, contact.contactId, p.contact_id, p.contactId, p.id);
  if (!contactId || contactId.length > 200) return json({ error: "missing_contact_id" }, 422);
  const phone = first(contact.phone, contact.phone_number, p.phone);
  const email = first(contact.email, p.email).toLowerCase();
  if (!phone && !email) return json({ error: "missing_contact_info" }, 422);
  const full = first(contact.name, contact.full_name, p.full_name);
  const firstName = first(contact.first_name, contact.firstName, p.first_name, full ? full.split(/\s+/)[0] : "");
  const lastName = first(contact.last_name, contact.lastName, p.last_name, full ? full.split(/\s+/).slice(1).join(" ") : "");
  // Campaign value is explicitly set in HighLevel Custom Data for this workflow.
  const campaign = first(p.flc_campaign, p.campaign, "FLC | IUL Español | TikTok | Nov 2026");
  const region = first(p.flc_state, contact.state, p.state);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "database_not_configured" }, 503);
  const url = new URL("/rest/v1/flc_lead_ingest_test", supabaseUrl);
  url.searchParams.set("on_conflict", "source_crm,source_contact_id");
  // Never overwrite an existing lead on repeated webhook deliveries.
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        source_crm: "auraflow",
        source_contact_id: contactId,
        campaign,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        state: region || null,
      }),
    });
  } catch {
    return json({ error: "database_unavailable" }, 503);
  }
  if (!response.ok) {
    console.error("FLC lead ingest database failure", response.status);
    return json({ error: "database_insert_failed" }, 503);
  }
  const rows = await response.json() as Array<{ id: string }>;
  return json({ accepted: true, inserted: rows.length === 1, duplicate: rows.length === 0 });
});
