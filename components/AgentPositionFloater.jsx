function AgentPositionFloater({user,setPage}) {
 const [rows,setRows]=React.useState([]),[error,setError]=React.useState(''),[open,setOpen]=React.useState(false);
 const [asOf,setAsOf]=React.useState('');
 const load=React.useCallback(async()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const from=today.slice(0,7)+'-01';
  const {data,error}=await window.flcSupabase.rpc('flc_agency_submitted_standings',{p_start:from,p_end:today});
  setAsOf(today);
  if(error){setError('No se pudo consultar tu posición.');return;}
  setRows(data||[]);setError('');
 },[user.id]);
 React.useEffect(()=>{
  load();const id=setInterval(load,60000);
  window.addEventListener('flc:new-sale',load);
  return()=>{clearInterval(id);window.removeEventListener('flc:new-sale',load);};
 },[load]);
 const mine=rows.find(r=>r.agent_id===user.id);
 const rank=mine?Number(mine.rank_policies):null;
 const leaders=[...rows].sort((a,b)=>Number(a.rank_policies)-Number(b.rank_policies)).slice(0,3);
 return <React.Fragment>
  {open&&<aside aria-label="Posición mensual de producción" style={{position:'fixed',right:20,bottom:385,zIndex:1005,width:'min(365px,calc(100vw - 32px))',maxHeight:'min(450px,calc(100vh - 420px))',overflowY:'auto',background:'#fff',color:'#1c3022',border:'2px solid #a6c77b',borderRadius:15,boxShadow:'0 10px 36px #0004',padding:18}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>🏆 Mi posición este mes</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar posición">×</button></div>
   <p style={{fontSize:12,color:'#597061'}}>Del {asOf?asOf.slice(0,7)+'-01':'inicio de mes'} al {asOf||'hoy'} · Pólizas sometidas</p>
   {error?<p role="alert">{error}</p>:<React.Fragment>
    <div style={{background:'#edf5ed',borderRadius:12,padding:12}}><div style={{fontSize:32,fontWeight:800}}>{rank?'#'+rank:'Sin posición'}</div><strong>{user.name}</strong><div>{mine?Number(mine.submitted_policies)+' póliza(s) sometida(s)':'Todavía no has sometido pólizas este mes.'}</div></div>
    <h4 style={{marginBottom:8}}>Podio del mes</h4>
    {leaders.length?leaders.map((r,i)=><div key={r.agent_id} style={{padding:'8px 0',borderBottom:'1px solid #e3ece3'}}>{['🥇','🥈','🥉'][i]} {r.full_name} · {r.submitted_policies} póliza(s)</div>):<p>Aún no hay producción.</p>}
   </React.Fragment>}
   <button type="button" onClick={()=>{setOpen(false);setPage('production');}} style={{marginTop:14,width:'100%',padding:10,background:'#166839',color:'#fff',border:0,borderRadius:8,cursor:'pointer'}}>Ver ranking completo</button>
  </aside>}
  <button type="button" aria-label={rank?'Tu posición mensual es '+rank:'Consultar mi posición mensual'} title="Mi posición este mes" onClick={()=>setOpen(v=>!v)} style={{position:'fixed',right:17,bottom:295,zIndex:1002,width:70,height:70,borderRadius:'50%',border:'4px solid #b9e1a6',background:'#17482f',color:'#fff',boxShadow:'0 6px 20px #0004',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0}}>
   <span style={{fontSize:22,lineHeight:1.1}}>🏆</span><span style={{fontSize:15,fontWeight:800,lineHeight:1.2}}>{rank?'#'+rank:'—'}</span>
  </button>
 </React.Fragment>;
}
window.AgentPositionFloater=AgentPositionFloater;
