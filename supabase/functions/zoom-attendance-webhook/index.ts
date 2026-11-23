// Supabase Edge Function: zoom-attendance-webhook
// PREPARATION ONLY: validate Zoom CRC and signed event authenticity.
// Deliberately does NOT mark agents present until Zoom-to-Academy identity
// mapping, authorized meeting allowlist and replay/idempotency are ready.
// Deploy with JWT verification disabled ONLY for this webhook; HMAC verification
// below is the authentication boundary.
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
async function digest(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return hex(new Uint8Array(signature));
}
function safeEqual(a: string, b: string) {
  const x = encoder.encode(a), y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("ZOOM_WEBHOOK_SECRET_TOKEN");
  if (!secret) return json({ error: "webhook_not_configured" }, 503);
  const rawBody = await request.text();
  if (rawBody.length > 150_000) return json({ error: "payload_too_large" }, 413);

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: "invalid_json" }, 400); }

  if (payload.event === "endpoint.url_validation") {
    const token = (payload.payload as { plainToken?: unknown } | undefined)?.plainToken;
    if (typeof token !== "string" || !token || token.length > 4096)
      return json({ error: "invalid_plain_token" }, 400);
    return json({ plainToken: token, encryptedToken: await digest(secret, token) });
  }

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature) {
    return json({ error: "missing_zoom_signature" }, 401);
  }
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    return json({ error: "stale_zoom_request" }, 401);
  const expected = "v0=" + await digest(secret, `v0:${timestamp}:${rawBody}`);
  if (!safeEqual(signature.toLowerCase(), expected))
    return json({ error: "invalid_zoom_signature" }, 401);

  if (payload.event === "meeting.participant_joined" ||
      payload.event === "meeting.participant_left") {
    // Log only the verified event TYPE. No names, email, meeting IDs or token.
    console.info("FLC Zoom verified event:", payload.event);
    // Compare Zoom event's meeting ID to a pre-registered testing meeting.
    // Use privileged server credentials only; never log meeting IDs or keys.
    const eventPayload = payload.payload as { object?: { id?: unknown } } | undefined;
    const incomingMeetingId = eventPayload?.object?.id;
    if (typeof incomingMeetingId !== "string" && typeof incomingMeetingId !== "number") {
      console.info("FLC Zoom meeting match: missing_id");
      return json({ accepted: true, presence_updated: false, reason: "missing_meeting_id" });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.warn("FLC Zoom meeting match: database_not_configured");
      return json({ error: "meeting_verification_unavailable" }, 503);
    }
    const lookup = new URL("/rest/v1/flc_zoom_test_meetings", supabaseUrl);
    lookup.searchParams.set("select", "authorized");
    lookup.searchParams.set("zoom_meeting_id", "eq." + String(incomingMeetingId));
    lookup.searchParams.set("limit", "1");
    const meetingResponse = await fetch(lookup, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" }
    });
    if (!meetingResponse.ok) {
      console.warn("FLC Zoom meeting match: database_lookup_failed", meetingResponse.status);
      return json({ error: "meeting_verification_unavailable" }, 503);
    }
    const matches = await meetingResponse.json() as Array<{ authorized: boolean }>;
    const meetingMatched = matches.length === 1;
    console.info("FLC Zoom meeting match:", meetingMatched ? "matched" : "not_matched");
    // Never enable presence until verified agent mapping is implemented.
    return json({ accepted: true, presence_updated: false });
    // Fail closed: do not equate a display name with an Academy user.
    // Next phase must securely associate Zoom participant identity to an agent,
    // verify account and authorized meeting, and reconcile join/leave.
    return json({ accepted: true, presence_updated: false });
  }
  return json({ accepted: true, ignored: true });
});
