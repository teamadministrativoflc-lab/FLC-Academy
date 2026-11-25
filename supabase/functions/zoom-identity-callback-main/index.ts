// FLC Academy MAIN: Zoom OAuth callback (identity link only; never assigns leads).
// Fail closed. Requires server-issued, single-use OAuth state and exact redirect URI.
// This function is NOT the Zoom attendance webhook and never distributes leads.
const env = (key: string) => Deno.env.get(key)?.trim() ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function sha256(input: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(input))));
}
Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const u = new URL(req.url);
  if (u.searchParams.has("error")) return json({ error: "zoom_authorization_denied" }, 400);
  const code = u.searchParams.get("code") ?? "";
  const state = u.searchParams.get("state") ?? "";
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(state) || !code || code.length > 2048)
    return json({ error: "invalid_oauth_response" }, 400);
  const supabase = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = env("ZOOM_OAUTH_CLIENT_ID");
  const clientSecret = env("ZOOM_OAUTH_CLIENT_SECRET");
  const redirectUri = env("ZOOM_OAUTH_REDIRECT_URI");
  if (!supabase || !serviceKey || !clientId || !clientSecret || !redirectUri)
    return json({ error: "oauth_server_not_configured" }, 503);
  // Validate against the project's canonical public Supabase URL, rather than
  // request origin (Edge runtime or reverse proxy may expose an internal host).
  // Also require the callback path to match. Never accept arbitrary redirects.
  const expectedRedirect = new URL("/functions/v1/zoom-identity-callback", supabase);
  // Zoom's redirect URI must equal the project's canonical public callback URL.
  // Supabase Edge may rewrite the request path internally; validating u.pathname
  // would reject an otherwise valid Zoom callback. Single-use signed state is
  // checked below, and the code is exchanged only against this fixed redirect URI.
  if (redirectUri !== expectedRedirect.href)
    return json({ error: "invalid_redirect_configuration" }, 503);
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const states = new URL("/rest/v1/flc_zoom_identity_oauth_states", supabase);
  states.searchParams.set("state_hash", `eq.${await sha256(state)}`);
  states.searchParams.set("used_at", "is.null");
  states.searchParams.set("expires_at", `gt.${new Date().toISOString()}`);
  states.searchParams.set("select", "academy_user_id");
  let consumed: Response;
  try {
    consumed = await fetch(states, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
  } catch { return json({ error: "state_validation_unavailable" }, 503); }
  if (!consumed.ok) return json({ error: "state_validation_failed" }, 503);
  const matches = await consumed.json() as Array<{ academy_user_id: string }>;
  if (matches.length !== 1) return json({ error: "invalid_or_expired_state" }, 400);
  const account = matches[0].academy_user_id;
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  const basic = btoa(`${clientId}:${clientSecret}`);
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
    });
  } catch { return json({ error: "zoom_token_unavailable" }, 502); }
  if (!tokenResponse.ok) return json({ error: "zoom_token_exchange_failed" }, 400);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) return json({ error: "zoom_token_missing" }, 502);
  let profileResponse: Response;
  try {
    profileResponse = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
  } catch { return json({ error: "zoom_profile_unavailable" }, 502); }
  if (!profileResponse.ok) return json({ error: "zoom_profile_failed" }, 502);
  const profile = await profileResponse.json() as { id?: string; email?: string };
  if (!profile.id || typeof profile.id !== "string" || profile.id.length > 256)
    return json({ error: "zoom_identity_missing" }, 502);
  // Main academy uses direct links; never alter roles, campaigns or availability.
  const linkUrl = new URL("/rest/v1/flc_zoom_identity_links", supabase);
  linkUrl.searchParams.set("academy_user_id", "eq." + account);
  linkUrl.searchParams.set("select", "zoom_user_id");
  const current = await fetch(linkUrl, { headers });
  if (!current.ok) return json({ error: "link_lookup_failed" }, 503);
  const existing = await current.json() as Array<{ zoom_user_id: string | null }>;
  if (existing.length > 1 || (existing.length === 1 && existing[0].zoom_user_id)) {
    return json({ error: "zoom_already_linked" }, 409);
  }
  const record = {
    academy_user_id: account,
    zoom_user_id: profile.id,
    zoom_email_normalized: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null,
    zoom_identity_verified_at: new Date().toISOString(),
  };
  const saved = await fetch(new URL("/rest/v1/flc_zoom_identity_links?on_conflict=academy_user_id", supabase), {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(record),
  });
  if (!saved.ok) return json({ error: "identity_storage_failed" }, 503);
  const rows = await saved.json() as Array<{ academy_user_id: string }>;
  if (rows.length !== 1) return json({ error: "identity_not_linked" }, 409);
  return new Response("Zoom identity linked to FLC Academy. You may close this page.", {
    status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
});
