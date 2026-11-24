// FLC Academy: isolated AuraFlow user directory connectivity check.
// Read-only: queries HighLevel users/search, returns count and safe user IDs/names.
// Protected by the existing shared test header; no contact changes or assignment.
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const encoder=new TextEncoder();
async function equal(a:string,b:string){
  if(!a || !b || b.length<32 || a.length>512) return false;
  const hash=await Promise.all([a,b].map(v=>crypto.subtle.digest("SHA-256",encoder.encode(v))));
  const x=new Uint8Array(hash[0]),y=new Uint8Array(hash[1]);let d=0;
  for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
Deno.serve(async req=>{
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  const expected=Deno.env.get("FLC_LEAD_INGEST_TOKEN")??"";
  if(!await equal(req.headers.get("x-flc-ingest-token")??"",expected))return reply({error:"unauthorized"},401);
  const token=Deno.env.get("AURAFLOW_PRIVATE_INTEGRATION_TOKEN"),locationId=Deno.env.get("AURAFLOW_LOCATION_ID");
  if(!token||!locationId)return reply({error:"missing_configuration"},503);
  let upstream:Response;
  try{
    const url=new URL("https://services.leadconnectorhq.com/users/search");
    url.searchParams.set("locationId",locationId);
    upstream=await fetch(url.toString(),{method:"GET",headers:{"Authorization":`Bearer ${token}`,"Version":"2021-07-28","Accept":"application/json"},signal:AbortSignal.timeout(12000)});
  }catch{return reply({connected:false,error:"upstream_unreachable"},502)}
  if(!upstream.ok)return reply({connected:false,highlevel_status:upstream.status},502);
  let data:any;
  try{data=await upstream.json()}catch{return reply({connected:false,error:"bad_upstream_json"},502)}
  const list=Array.isArray(data?.users)?data.users:Array.isArray(data?.data?.users)?data.data.users:[];
  return reply({connected:true,users_found:list.length,users:list.slice(0,100).map((u:any)=>({
    id:String(u.id??""),name:[u.firstName,u.lastName].filter(Boolean).join(" ")||u.name||"Sin nombre",
    role:u.role?.type??u.role??null
  })),changes_made:false});
});
