// FLC Academy Testing only. Begins an authenticated, single-use Zoom OAuth link.
// The callback must consume state atomically; never log state or access tokens.
const enc = new TextEncoder();
const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
async function sha(input: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);
  const supabase = env("SUPABASE_URL");
  const secret = env("SUPABASE_SERVICE_ROLE_KEY");
  const anon = env("SUPABASE_ANON_KEY");
  const client = env("ZOOM_OAUTH_CLIENT_ID");
  const redirect = env("ZOOM_OAUTH_REDIRECT_URI");
  if (!supabase || !secret || !anon || !client || !redirect) return j({ error: "oauth_server_not_configured" }, 503);
  if (!redirect.startsWith(new URL("/functions/v1/zoom-identity-callback", supabase).href))
    return j({ error: "invalid_redirect_configuration" }, 503);
  const bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1] ?? "";
  if (!bearer) return j({ error: "academy_login_required" }, 401);
  let userRes: Response;
  try {
    userRes = await fetch(new URL("/auth/v1/user", supabase), {
      headers: { Authorization: `Bearer ${bearer}`, apikey: anon },
    });
  } catch { return j({ error: "auth_unavailable" }, 503); }
  if (!userRes.ok) return j({ error: "academy_login_required" }, 401);
  const user = await userRes.json() as { id?: string; email_confirmed_at?: string };
  if (!user.id || !user.email_confirmed_at) return j({ error: "academy_user_unconfirmed" }, 403);
  const h = { Authorization: `Bearer ${secret}`, apikey: secret, Accept: "application/json" };
  const check = new URL("/rest/v1/flc_zoom_test_agents", supabase);
  check.searchParams.set("academy_user_id", `eq.${user.id}`);
  check.searchParams.set("select", "id,zoom_user_id");
  check.searchParams.set("limit", "1");
  let agentRes: Response;
  try { agentRes = await fetch(check, { headers: h }); }
  catch { return j({ error: "agent_lookup_unavailable" }, 503); }
  if (!agentRes.ok) return j({ error: "agent_lookup_failed" }, 503);
  const agents = await agentRes.json() as Array<{ id: string; zoom_user_id: string | null }>;
  if (agents.length !== 1) return j({ error: "agent_not_registered_for_test" }, 403);
  if (agents[0].zoom_user_id) return j({ error: "zoom_already_linked" }, 409);
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const state = btoa(String.fromCharCode(...random)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const insert = new URL("/rest/v1/flc_zoom_test_oauth_states", supabase);
  let saved: Response;
  try {
    saved = await fetch(insert, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        state_hash: await sha(state),
        academy_user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      }),
    });
  } catch { return j({ error: "state_storage_unavailable" }, 503); }
  if (!saved.ok) return j({ error: "state_storage_failed" }, 503);
  const url = new URL("https://zoom.us/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  return j({ authorization_url: url.toString(), expires_in_seconds: 600 });
});
