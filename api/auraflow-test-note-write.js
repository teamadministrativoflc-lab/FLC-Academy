// Controlled one-contact test note API. PREVIEW ONLY and disabled by default.
// Requires AURAFLOW_TEST_WRITE_ENABLED=true in Preview, separately from token.
// This route is NOT an agent synchronization endpoint. No request payload is used.
// No automatic retries: HighLevel's note creation has no idempotency-key support.
const SUPABASE_URL='https://fvhbzutxaoujtnnjzhlk.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_rAio9qIcW3ecuM4qxiUZ_A_Z8iuZhFE';
const BASE_URL='https://services.leadconnectorhq.com';
const MARKER='FLC-AURAFLOW-READWRITE-TEST-20261127';
const NOTE='PRUEBA CONTROLADA DE INTEGRACIÓN FLC ACADEMY. Esta nota confirma la conexión con AuraFlow. No representa una gestión real del cliente. ['+MARKER+']';

function reply(res,status,body){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(status).json(body);
}
async function isAdmin(authorization){
 const common={apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization};
 const auth=await fetch(SUPABASE_URL+'/auth/v1/user',{
  headers:common,signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});
 if(!auth.ok)return false;
 const user=await auth.json();
 if(!/^[a-f\d-]{36}$/i.test(user?.id||''))return false;
 const r=await fetch(SUPABASE_URL+'/rest/v1/agent_profiles?id=eq.'+encodeURIComponent(user.id)+'&role=eq.admin&select=id&limit=1',{
  headers:{...common,Accept:'application/json'},signal:AbortSignal.timeout(8000),
  cache:'no-store',redirect:'error'});
 if(!r.ok)return false;
 const rows=await r.json();
 return Array.isArray(rows)&&rows.length===1&&rows[0].id===user.id;
}
export default async function handler(req,res){
 if(process.env.VERCEL_ENV!=='preview')return reply(res,404,{error:'Not available'});
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
 const authorization=req.headers.authorization;
 if(!authorization||!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))
  return reply(res,401,{error:'Authentication required'});
 try{
  if(!await isAdmin(authorization))return reply(res,403,{error:'Not authorized'});
 }catch{return reply(res,503,{error:'Authorization unavailable'});}
 if(process.env.AURAFLOW_TEST_WRITE_ENABLED!=='true')
  return reply(res,423,{error:'Test write is disabled'});
 const id=process.env.AURAFLOW_TEST_CONTACT_ID;
 const token=process.env.AURAFLOW_API_TOKEN;
 if(!/^[A-Za-z0-9]{20}$/.test(id||'')||!token?.startsWith('pit-'))
  return reply(res,503,{error:'Test contact or credential not configured'});
 const headers={Authorization:'Bearer '+token,Version:'v3',Accept:'application/json'};
 const url=BASE_URL+'/contacts/'+encodeURIComponent(id)+'/notes';
 try{
  // Check for the unique marker first. If an earlier request succeeded but
  // its response was lost, this prevents a deliberate manual repeat.
  // This is NOT concurrency-safe. Never expose an automated retry.
  const existing=await fetch(url,{method:'GET',headers,
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!existing.ok)return reply(res,502,{error:'Preflight notes lookup failed'});
  const notes=(await existing.json()).notes;
  if(!Array.isArray(notes))return reply(res,502,{error:'Unexpected notes response'});
  if(notes.some(n=>String(n?.body||'').includes(MARKER)))
   return reply(res,200,{already_exists:true,crm_write:false});
  // Also verify the exact test contact still exists.
  const contact=await fetch(BASE_URL+'/contacts/'+encodeURIComponent(id),{
   headers:{...headers,Version:'2021-07-28'},cache:'no-store',
   redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!contact.ok)return reply(res,502,{error:'Contact verification failed'});
  const record=(await contact.json()).contact;
  if(record?.id!==id||!String(record?.firstName||'').toUpperCase().includes('FLC PRUEBA'))
   return reply(res,403,{error:'Contact is not the dedicated test record'});
  const written=await fetch(url,{method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({body:NOTE,title:'FLC Academy - prueba técnica'}),
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(written.status!==201)return reply(res,502,{error:'Test note was not confirmed'});
  const result=await written.json();
  return reply(res,200,{created:true,test_contact_only:true,
   note_id_recorded:Boolean(result?.note?.id)});
 }catch{
  // A timeout after POST has an unknown outcome. Never retry automatically.
  return reply(res,502,{error:'Outcome uncertain: check test contact notes before retry'});
 }
}
