// Supabase Edge Function: zoom-attendance-webhook
// TESTING: validate signed Zoom events, store receipts, and relay matched identity evidence to MAIN.
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
async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return hex(new Uint8Array(hash));
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
    // Privacy-safe identity diagnostics. Never log participant values.
    const p = (payload.payload as { object?: { participant?: Record<string, unknown> } } | undefined)?.object?.participant;
    const hasUserId = typeof p?.user_id === "string" && p.user_id.trim().length > 0;
    const hasParticipantId = typeof p?.id === "string" && p.id.trim().length > 0;
    const hasEmail = typeof p?.email === "string" && p.email.trim().length > 0;
    console.info("FLC Zoom identity fields:", JSON.stringify({
      user_id_present: hasUserId,
      participant_id_present: hasParticipantId,
      email_present: hasEmail
    }));
    // Privacy-safe correlation for supervised tests only. No raw user identifier.
    // A keyed HMAC fingerprint allows comparing join/leave and repeated sessions.
    if (hasUserId) {
      const userFingerprint = (await digest(secret, "flc-zoom-test-user:" + p!.user_id)).slice(0, 16);
      console.info("FLC Zoom test identity fingerprint:", userFingerprint);
    } else {
      console.info("FLC Zoom test identity fingerprint: unavailable");
    }
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
    // Lookup only the registered meeting; return no identifying details to logs.
    const lookup = new URL("/rest/v1/flc_zoom_test_meetings", supabaseUrl);
    lookup.searchParams.set("select", "id,authorized");
    lookup.searchParams.set("zoom_meeting_id", "eq." + String(incomingMeetingId));
    lookup.searchParams.set("limit", "1");
    const dbHeaders = {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    };
    let meetingResponse: Response;
    try {
      meetingResponse = await fetch(lookup, { headers: dbHeaders });
    } catch {
      console.warn("FLC Zoom meeting match: database_unreachable");
      return json({ error: "meeting_verification_unavailable" }, 503);
    }
    if (!meetingResponse.ok) {
      console.warn("FLC Zoom meeting match: database_lookup_failed", meetingResponse.status);
      return json({ error: "meeting_verification_unavailable" }, 503);
    }
    const matches = await meetingResponse.json() as Array<{ id: string; authorized: boolean }>;
    const matched = matches.length === 1;
    console.info("FLC Zoom meeting match:", matched ? "matched" : "not_matched");

    // Log only a SHA-256 fingerprint of the authenticated raw payload.
    // This deduplicates byte-for-byte redelivery without storing names,
    // participant IDs, email or the meeting's raw Zoom ID in receipts.
    // Unregistered meetings are ignored and never stored.
    if (!matched) return json({ accepted: true, presence_updated: false });

    const receiptUrl = new URL("/rest/v1/flc_zoom_test_event_receipts", supabaseUrl);
    receiptUrl.searchParams.set("on_conflict", "zoom_event_id");
    const receipt = {
      zoom_event_id: await sha256Hex(rawBody),
      event_type: payload.event,
      meeting_id: matches[0].id,
      outcome: matches[0].authorized ? "identity_unverified" : "meeting_unauthorized",
    };
    let receiptResponse: Response;
    try {
      receiptResponse = await fetch(receiptUrl, {
        method: "POST",
        headers: {
          ...dbHeaders, "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(receipt),
      });
    } catch {
      console.warn("FLC Zoom receipt: database_unreachable");
      return json({ error: "receipt_storage_unavailable" }, 503);
    }
    if (!receiptResponse.ok) {
      console.warn("FLC Zoom receipt: storage_failed", receiptResponse.status);
      return json({ error: "receipt_storage_unavailable" }, 503);
    }
    console.info("FLC Zoom receipt: stored_or_duplicate");
    // Zoom's participant.user_id is a meeting-scoped identifier and MUST NOT
    // be matched to OAuth /users/me.id. Use participant_user_id (Zoom account ID).
    // Legacy participant.id can be used only as a persistent fallback when present.
    // Both fields may be blank for attendees external to the host account.
    // Never use display name, meeting-scoped user_id or email as an identity fallback.
    const persistentZoomUserId =
      (typeof p?.participant_user_id === "string" && p.participant_user_id.trim()
        ? p.participant_user_id.trim() : "") ||
      (typeof p?.id === "string" && p.id.trim() ? p.id.trim() : "");
    console.info("FLC Zoom persistent identity:", persistentZoomUserId ? "present" : "unavailable");
    // Relay only if the event came from an authorized meeting and has a
    // persistent Zoom account identifier. Never transmit emails, names or tokens.
    // This has NO writes to agent availability or distribution.
    const relaySecret = Deno.env.get("FLC_ZOOM_RELAY_SECRET") ?? "";
    const target = "https://fvhbzutxaoujtnnjzhlk.supabase.co/functions/v1/flc-zoom-evidence-receiver";
    const eventTs = (payload as { event_ts?: unknown }).event_ts;
    const eventMs = typeof eventTs === "number" ? eventTs : NaN;
    if (matches[0].authorized && persistentZoomUserId && relaySecret.length >= 32
      && Number.isFinite(eventMs) && Math.abs(Date.now() - eventMs) <= 120000) {
      const body = JSON.stringify({
        source_event_hash: receipt.zoom_event_id,
        meeting_alias: "Nationwide - Sala de Trabajo",
        event_type: payload.event,
        zoom_user_id: persistentZoomUserId,
        source_event_at: new Date(eventMs).toISOString(),
      });
      const relayTimestamp = String(Math.floor(Date.now() / 1000));
      try {
        const relay = await fetch(target, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-flc-relay-timestamp": relayTimestamp,
            "x-flc-relay-signature": await digest(relaySecret, relayTimestamp + "." + body),
          },
          body,
          signal: AbortSignal.timeout(4000),
        });
        console.info("FLC Zoom relay outcome:", relay.ok ? "delivered" : "receiver_rejected");
      } catch {
        console.warn("FLC Zoom relay outcome: temporarily_unavailable");
      }
    } else {
      console.info("FLC Zoom relay outcome: skipped_ineligible_or_unconfigured");
    }
    // Fail closed: presence, eligibility and lead distribution remain untouched
    // until authenticated participant-to-agent mapping is implemented.
    return json({ accepted: true, presence_updated: false });
  }
  return json({ accepted: true, ignored: true });
});
