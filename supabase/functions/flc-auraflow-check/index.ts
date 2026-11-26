// FLC Academy Testing: read-only AuraFlow/HighLevel connectivity check.
// POST only. Secured with FLC_LEAD_INGEST_TOKEN for isolated testing;
// replace with purpose-specific admin authentication before production.
// Does NOT list contacts or agents, create records, or modify source CRM.
const encoder = new TextEncoder();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});
async function matchSecret(a: string, b: string) {
  if (!a || !b || b.length < 32 || a.length > 512) return false;
  const hashes = await Promise.all([a,b].map(s => crypto.subtle.digest("SHA-256", encoder.encode(s))));
  const x = new Uint8Array(hashes[0]), y = new Uint8Array(hashes[1]);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const testSecret = Deno.env.get("FLC_LEAD_INGEST_TOKEN") ?? "";
  const sent = request.headers.get("x-flc-ingest-token") ?? "";
  if (!await matchSecret(sent, testSecret)) return response({ error: "unauthorized" }, 401);
  const token = Deno.env.get("AURAFLOW_PRIVATE_INTEGRATION_TOKEN");
  const locationId = Deno.env.get("AURAFLOW_LOCATION_ID");
  if (!token || !locationId) return response({ error: "auraflow_not_configured" }, 503);
  let result: Response;
  try {
    result = await fetch(
      `https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}`,
      { method: "GET", headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28", "Accept": "application/json"
      }, signal: AbortSignal.timeout(10000) }
    );
  } catch {
    return response({ connected: false, error: "upstream_unreachable" }, 502);
  }
  if (!result.ok) {
    // Do not reveal full API response body (may contain protected data).
    return response({ connected: false, highlevel_status: result.status }, 502);
  }
  // Do not expose account information beyond connectivity validation.
  return response({ connected: true, access: "locations.readonly", changes_made: false });
});
