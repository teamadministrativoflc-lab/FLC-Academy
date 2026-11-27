// Server-only, read-only Preview connectivity check.
// A locked-down route: no request input can select an AuraFlow contact.
import { getAuraFlowContactReadOnly } from '../lib/auraflow-readonly-client.js';

const SUPABASE_URL = 'https://fvhbzutxaoujtnnjzhlk.supabase.co';
// Publishable key is public by design, never a service role credential.
const SUPABASE_PUBLIC_KEY = 'sb_publishable_rAio9qIcW3ecuM4qxiUZ_A_Z8iuZhFE';

function respond(res, code, obj) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(code).json(obj);
}

export default async function handler(req,res) {
  if (process.env.VERCEL_ENV !== 'preview') return respond(res,404,{error:'Not available'});
  if (req.method !== 'POST') return respond(res,405,{error:'Method not allowed'});
  const authorization = req.headers.authorization;
  if (!authorization || !/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) {
    return respond(res,401,{error:'Authentication required'});
  }
  // Validate token with Supabase Auth, never trust a browser-supplied role.
  let userId;
  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers:{ apikey:SUPABASE_PUBLIC_KEY, Authorization:authorization },
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)
    });
    if (!authResponse.ok) return respond(res,401,{error:'Invalid session'});
    const user = await authResponse.json();
    userId = user?.id;
    if (!userId || !/^[a-f\d-]{36}$/i.test(userId)) {
      return respond(res,401,{error:'Invalid session'});
    }
    // Supabase row-level security must expose only authorized profile rows.
    const adminResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_profiles?id=eq.${encodeURIComponent(userId)}&role=eq.admin&select=id&limit=1`, {
        headers:{ apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization,
          Accept:'application/json' },
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)
      });
    if (!adminResponse.ok) return respond(res,403,{error:'Not authorized'});
    const rows=await adminResponse.json();
    if (!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==userId) {
      return respond(res,403,{error:'Not authorized'});
    }
  } catch { return respond(res,503,{error:'Authorization unavailable'}); }

  // The allowlist is a dedicated server-side Preview secret, and the client
  // never supplies a contact ID. This route cannot access arbitrary contacts.
  const id=process.env.AURAFLOW_TEST_CONTACT_ID;
  if (!id || !/^[A-Za-z0-9]{20}$/.test(id)) {
    return respond(res,503,{error:'Test contact not configured'});
  }
  try {
    const contact=await getAuraFlowContactReadOnly(id,
      {signal:AbortSignal.timeout(10000)});
    // Do not leak contact data in the response, logs, or browser.
    return respond(res,200,{connected:true,test_contact_found:contact.id===id,
      crm_write:false});
  } catch {
    return respond(res,502,{connected:false,crm_write:false,
      error:'Read-only AuraFlow lookup failed'});
  }
}
