// FLC Academy PRIMARY — isolated intake for controlled manual tests.
// It does NOT configure AuraFlow webhooks, assign agents, or call prospects.
// Deploy only to primary project fvhbzutxaoujtnnjzhlk.
// Secret: FLC_DISTRIBUTION_INGEST_TOKEN (new independent secret, >=32 chars).
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const clean=(x:unknown,max=200)=>typeof x==="string"?x.trim().slice(0,max):"";
const first=(...xs:unknown[])=>xs.map(x=>clean(x)).find(Boolean)??"";
const encoder=new TextEncoder();
async function same(a:string,b:string){
  if(!a||!b||b.length<32||a.length>512)return false;
  const hashes=await Promise.all([a,b].map(x=>crypto.subtle.digest("SHA-256",encoder.encode(x))));
  const x=new Uint8Array(hashes[0]),y=new Uint8Array(hashes[1]);let n=0;
  for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;
}
Deno.serve(async req=>{
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  const expected=Deno.env.get("FLC_DISTRIBUTION_INGEST_TOKEN")??"";
  if(expected.length<32)return reply({error:"not_configured"},503);
  if(!await same(req.headers.get("x-flc-distribution-token")??"",expected))
    return reply({error:"unauthorized"},401);
  if(Number(req.headers.get("content-length")??0)>65536)return reply({error:"payload_too_large"},413);
  let raw:string;
  try{raw=await req.text()}catch{return reply({error:"unreadable"},400)}
  if(raw.length>65536)return reply({error:"payload_too_large"},413);
  let p:Record<string,unknown>;
  try{const o=JSON.parse(raw);if(!o||typeof o!=="object"||Array.isArray(o))throw Error();p=o}
  catch{return reply({error:"invalid_json"},400)}
  const c=p.contact&&typeof p.contact==="object"&&!Array.isArray(p.contact)
    ?p.contact as Record<string,unknown>:p;
  const id=first(c.id,c.contact_id,c.contactId,p.contact_id,p.contactId,p.id);
  const phone=first(c.phone,c.phone_number,p.phone);
  const email=first(c.email,p.email).toLowerCase();
  if(!id)return reply({error:"missing_contact_id"},422);
  if(!phone&&!email)return reply({error:"missing_contact_info"},422);
  const full=first(c.name,c.full_name,p.full_name);
  const campaignObject=p.campaign&&typeof p.campaign==="object"?p.campaign as Record<string,unknown>:null;
  const campaign=first(
    new URL(req.url).searchParams.get("flc_campaign"),
    p.flc_campaign,
    campaignObject?.name,
    p.campaign,
    "PENDIENTE_IDENTIFICAR"
  );
  const project=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!project||!key)return reply({error:"database_not_configured"},503);
  const url=new URL("/rest/v1/flc_distribution_leads",project);
  url.searchParams.set("on_conflict","source_crm,source_contact_id");
  let resp:Response;
  try{
    resp=await fetch(url.toString(),{
      method:"POST",
      headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=representation"},
      body:JSON.stringify({
        source_crm:"auraflow",source_contact_id:id,source_campaign:campaign,
        first_name:first(c.first_name,c.firstName,p.first_name,full.split(/\\s+/)[0]),
        last_name:first(c.last_name,c.lastName,p.last_name,full.split(/\\s+/).slice(1).join(" ")),
        phone:phone||null,email:email||null,lead_state:first(p.flc_state,c.state,p.state)||null
      }),
      signal:AbortSignal.timeout(12000)
    });
  }catch{return reply({error:"database_unavailable"},503)}
  if(!resp.ok){console.error("FLC distribution insert HTTP",resp.status);return reply({error:"database_insert_failed"},503)}
  const rows=await resp.json() as Array<{id:string}>;
  return reply({accepted:true,inserted:rows.length>0,duplicate:rows.length===0,assignment_created:false});
});
