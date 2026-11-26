// Diagnostic ONLY — isolated Supabase TESTING project.
// READ-ONLY Zoom Server-to-Server OAuth access check for NationWide Financial.
// Never writes database records, changes attendance, or distributes leads.
// No participant names, emails, user identifiers, or access tokens are returned.
const textEncoder = new TextEncoder();
const send = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});
function constantTimeEqual(a: string, b: string): boolean {
  const aa = textEncoder.encode(a), bb = textEncoder.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return send({ error: "method_not_allowed" }, 405);
  // Protect this internal diagnostic even when JWT validation is switched off.
  const diagnosticKey = Deno.env.get("FLC_ZOOM_RELAY_SECRET") ?? "";
  const supplied = req.headers.get("x-flc-diagnostic-secret") ?? "";
  if (diagnosticKey.length < 32 || !constantTimeEqual(supplied, diagnosticKey))
    return send({ error: "unauthorized" }, 401);
  const accountId = Deno.env.get("ZOOM_S2S_ACCOUNT_ID") ?? "";
  const clientId = Deno.env.get("ZOOM_S2S_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("ZOOM_S2S_CLIENT_SECRET") ?? "";
  if (!accountId || !clientId || !clientSecret)
    return send({ error: "zoom_s2s_not_configured" }, 503);

  const tokenEndpoint = new URL("https://zoom.us/oauth/token");
  tokenEndpoint.searchParams.set("grant_type", "account_credentials");
  tokenEndpoint.searchParams.set("account_id", accountId);
  let tokenResult: Response;
  try {
    tokenResult = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(clientId + ":" + clientSecret) },
      signal: AbortSignal.timeout(8000),
    });
  } catch { return send({ stage: "token", error: "network_failure" }, 502); }
  if (!tokenResult.ok) {
    // Show only Zoom's numeric OAuth error code, never its raw response,
    // which could unexpectedly contain account data or sensitive details.
    let zoomErrorCode: number | null = null;
    let zoomErrorType: string | null = null;
    try {
      const detail = await tokenResult.json() as { error?: unknown; code?: unknown };
      const raw = typeof detail.code === "number" ? detail.code
        : typeof detail.error === "number" ? detail.error : null;
      if (raw !== null && Number.isSafeInteger(raw) && raw >= 0 && raw <= 999999) zoomErrorCode = raw;
      // Zoom's S2S OAuth failures often use a STRING error, not a numeric code.
      // Expose only allowlisted standard OAuth error identifiers, never raw reasons.
      const known = ["invalid_client", "invalid_request", "unsupported_grant_type", "unauthorized_client", "invalid_grant"];
      if (typeof detail.error === "string" && known.includes(detail.error))
        zoomErrorType = detail.error;
    } catch { /* Preserve safe generic error. */ }
    return send({
      stage: "token",
      error: "zoom_token_rejected",
      zoom_http_status: tokenResult.status,
      zoom_error_code: zoomErrorCode,
      zoom_error_type: zoomErrorType,
      credentials_exposed: false,
    }, 200);
  }
  let accessToken: string;
  try {
    const parsed = await tokenResult.json() as { access_token?: string };
    if (!parsed.access_token) return send({ stage: "token", error: "missing_access_token" }, 502);
    accessToken = parsed.access_token;
  } catch { return send({ stage: "token", error: "invalid_token_response" }, 502); }

  // Account-level dashboard endpoint: does not change the meeting.
  // Live query may report 404 if the specific meeting is no longer active.
  const url = new URL("https://api.zoom.us/v2/metrics/meetings/86016220425/participants");
  url.searchParams.set("type", "live");
  url.searchParams.set("page_size", "1");
  let result: Response;
  try {
    result = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch { return send({ stage: "participants", error: "network_failure" }, 502); }
  // Do not return the body (it may contain participants' private information).
  return send({
    token_status: "accepted",
    participant_api_http_status: result.status,
    participants_accessible: result.ok,
    meeting: "NationWide Financial",
    query_type: "live_read_only",
    participant_data_returned: false,
    attendance_or_lead_data_modified: false,
  });
});
