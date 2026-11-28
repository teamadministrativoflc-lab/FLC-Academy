// Preview-only, read-only inspection of the AuraFlow results outbox.
// No CRM write, no queue mutation, no service_role key, no client identifiers.
const SUPABASE_URL='https://fvhbzutxaoujtnnjzhlk.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_rAio9qIcW3ecuM4qxiUZ_A_Z8iuZhFE';
function send(res,status,body){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}
export default async function handler(req,res){
  if(process.env.VERCEL_ENV!=='preview')
    return send(res,404,{error:'not_available'});
  if(req.method!=='POST')
    return send(res,405,{error:'method_not_allowed'});
  const auth=req.headers.authorization||'';
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))
    return send(res,401,{error:'session_required'});
  try{
    // Supabase function performs its own auth.uid() / admin role check.
    const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/flc_distribution_auraflow_outbox_status_admin',{
      method:'POST',
      headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:auth,'Content-Type':'application/json'},
      body:'{}',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)
    });
    if(response.status===404)return send(res,503,{error:'inspection_rpc_not_installed',dry_run:true,crm_write:false});
    if(response.status===401||response.status===403)
      return send(res,403,{error:'admin_access_required',dry_run:true,crm_write:false});
    if(!response.ok)return send(res,503,{error:'outbox_inspection_unavailable',dry_run:true,crm_write:false});
    const rows=await response.json();
    if(!Array.isArray(rows))return send(res,503,{error:'unexpected_response',dry_run:true,crm_write:false});
    const counts={pending:0,processing:0,sent:0,retry:0,failed:0,skipped:0};
    for(const row of rows){
      if(Object.prototype.hasOwnProperty.call(counts,row.status)){
        const count=Number(row.total);
        if(Number.isSafeInteger(count)&&count>=0)counts[row.status]=count;
      }
    }
    return send(res,200,{dry_run:true,crm_write:false,counts,transmissions_attempted:0});
  }catch{return send(res,503,{error:'inspection_unavailable',dry_run:true,crm_write:false});}
}
