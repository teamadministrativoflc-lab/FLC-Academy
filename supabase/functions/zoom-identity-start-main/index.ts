// FLC Academy MAIN: user-initiated Zoom identity OAuth start.
// Does not change agent roles, availability, campaigns or lead distribution.
const enc = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
async function hash(input: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabase = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = env("SUPABASE_ANON_KEY");
  const clientId = env("ZOOM_OAUTH_CLIENT_ID");
  const redirectUri = env("ZOOM_OAUTH_REDIRECT_URI");
  if (!supabase || !serviceKey || !anonKey || !clientId || !redirectUri)
    return json({ error: "oauth_server_not_configured" }, 503);
  const expected = new URL("/functions/v1/zoom-identity-callback", supabase).href;
  if (redirectUri !== expected) return json({ error: "invalid_redirect_configuration" }, 503);

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!bearer) return json({ error: "academy_login_required" }, 401);
  let authResponse: Response;
  try {
    authResponse = await fetch(new URL("/auth/v1/user", supabase), {
      headers: { Authorization: `Bearer ${bearer}`, apikey: anonKey },
    });
  } catch { return json({ error: "auth_unavailable" }, 503); }
  if (!authResponse.ok) return json({ error: "academy_login_required" }, 401);
  const user = await authResponse.json() as { id?: string; email_confirmed_at?: string };
  if (!user.id || !user.email_confirmed_at) return json({ error: "academy_user_unconfirmed" }, 403);

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" };
  // Profile membership is required, but role 'agent' is NOT lead eligibility.
  const profileUrl = new URL("/rest/v1/agent_profiles", supabase);
  profileUrl.searchParams.set("id", "eq." + user.id);
  profileUrl.searchParams.set("select", "id");
  profileUrl.searchParams.set("limit", "1");
  const profileResponse = await fetch(profileUrl, { headers });
  if (!profileResponse.ok) return json({ error: "profile_check_unavailable" }, 503);
  const profiles = await profileResponse.json() as Array<{ id: string }>;
  if (profiles.length !== 1) return json({ error: "academy_profile_required" }, 403);

  const linkedUrl = new URL("/rest/v1/flc_zoom_identity_links", supabase);
  linkedUrl.searchParams.set("academy_user_id", "eq." + user.id);
  linkedUrl.searchParams.set("select", "zoom_user_id");
  linkedUrl.searchParams.set("limit", "1");
  const linkedResponse = await fetch(linkedUrl, { headers });
  if (!linkedResponse.ok) return json({ error: "identity_check_unavailable" }, 503);
  const existing = await linkedResponse.json() as Array<{ zoom_user_id: string | null }>;
  if (existing.length && existing[0].zoom_user_id)
    return json({ error: "zoom_already_linked" }, 409);

  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);
  const state = btoa(String.fromCharCode(...entropy))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const stateUrl = new URL("/rest/v1/flc_zoom_identity_oauth_states", supabase);
  const saved = await fetch(stateUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      state_hash: await hash(state),
      academy_user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }),
  });
  if (!saved.ok) return json({ error: "state_storage_failed" }, 503);

  const url = new URL("https://zoom.us/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return json({ authorization_url: url.toString(), expires_in_seconds: 600 });
});
