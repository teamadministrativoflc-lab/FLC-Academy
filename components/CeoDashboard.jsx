function CeoDashboard({user,setPage}) {
 const [periodType,setPeriodType]=React.useState('month');
 const nyToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [periodDate,setPeriodDate]=React.useState(nyToday);
 const [reloadKey,setReloadKey]=React.useState(0);
 const [rows,setRows]=React.useState([]),[goal,setGoal]=React.useState(null),[leads,setLeads]=React.useState([]),[loading,setLoading]=React.useState(true),[error,setError]=React.useState('');
 const d=new Date(periodDate+'T12:00:00Z');
 if(periodType==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 if(periodType==='month')d.setUTCDate(1);
 if(periodType==='year'){d.setUTCMonth(0);d.setUTCDate(1);}
 const start=d.toISOString().slice(0,10);
 const endDate=new Date(d);
 if(periodType==='week')endDate.setUTCDate(endDate.getUTCDate()+6);
 if(periodType==='month'){endDate.setUTCMonth(endDate.getUTCMonth()+1);endDate.setUTCDate(0);}
 if(periodType==='year'){endDate.setUTCFullYear(endDate.getUTCFullYear()+1);endDate.setUTCDate(0);}
 const end=endDate.toISOString().slice(0,10);
 const rangeLabel=start===end?start:start+' al '+end;
 const move=n=>{const a=new Date(periodDate+'T12:00:00Z');if(periodType==='day')a.setUTCDate(a.getUTCDate()+n);if(periodType==='week')a.setUTCDate(a.getUTCDate()+7*n);if(periodType==='month')a.setUTCMonth(a.getUTCMonth()+n);if(periodType==='year')a.setUTCFullYear(a.getUTCFullYear()+n);setPeriodDate(a.toISOString().slice(0,10));};
 React.useEffect(()=>{
  if(user.role!=='admin')return;
  let active=true;setLoading(true);setError('');
  const fetchAll=async()=>{
   const [metrics,goals]=await Promise.all([
    window.flcSupabase.rpc('flc_period_team_metrics',{p_start:start,p_end:end,p_carrier:null}),
    window.flcSupabase.from('flc_agency_ap_goals').select('target_ap').eq('period_type',periodType).eq('period_start',start).maybeSingle()
   ]);
   let leadRows=[],leadError=null;
   for(let offset=0;offset<20000;offset+=1000){
    const r=await window.flcSupabase.from('flc_lead_investments').select('agent_id,provider,amount,spent_on').gte('spent_on',start).lte('spent_on',end).range(offset,offset+999);
    if(r.error){leadError=r.error;break;}
    leadRows=leadRows.concat(r.data||[]);if(!r.data||r.data.length<1000)break;
   }
   if(!active)return;
   if(metrics.error||goals.error||leadError){setError('No se pudo cargar el reporte completo. Revisa los permisos de Administración y los SQL 020, 033 y 034.');setRows([]);setGoal(null);setLeads([]);}
   else{setRows(metrics.data||[]);setGoal(goals.data?Number(goals.data.target_ap):null);setLeads(leadRows);}
   setLoading(false);
  };
  fetchAll();return()=>{active=false;};
 },[user.id,user.role,periodType,start,end,reloadKey]);
 if(user.role!=='admin')return <section style={{padding:26}}><h2>Acceso restringido</h2><p>Este panel es exclusivo de Administración.</p><button onClick={()=>setPage('dashboard')}>Volver</button></section>;
 const fmt=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const agency=rows.find(r=>r.scope==='agency');
 const teams=rows.filter(r=>r.scope==='team'&&Number(r.depth)===1).sort((a,b)=>Number(b.submitted_ap)-Number(a.submitted_ap));
 const otherTeams=rows.filter(r=>r.scope==='team'&&Number(r.depth)===0);
 const showTeams=teams.length?teams:otherTeams;
 const ap=Number(agency?.submitted_ap||0),verified=Number(agency?.verified_ap||0);
 const submitting=Number(agency?.submitting_agents||0),paidAgents=Number(agency?.verified_agents||0);
 const progress=goal?100*ap/goal:null;
 const flagged=showTeams.filter(r=>Number(r.submitted_ap)===0||Number(r.submitting_agents)===0||Number(r.verified_ap)===0);
 const leadTotal=leads.reduce((n,r)=>n+Number(r.amount),0);
 const leadProviders=[...new Set(leads.map(r=>r.provider))].sort().map(provider=>({provider,total:leads.filter(r=>r.provider===provider).reduce((n,r)=>n+Number(r.amount),0)}));
 const panelCard=(title,value,description)=><div style={{background:'#fff',border:'1px solid #d8e4da',borderRadius:12,padding:16}}><div style={{fontSize:13,color:'#566c5a'}}>{title}</div><div style={{fontSize:26,fontWeight:800,marginTop:8}}>{value}</div>{description&&<small style={{color:'#66796b'}}>{description}</small>}</div>;
 return <main style={{padding:'24px min(3vw,32px)',maxWidth:1400,margin:'auto',color:'#213527'}}>
  <button onClick={()=>setPage('dashboard')} style={{marginBottom:10}}>← Inicio</button>
  <h1 style={{margin:'0 0 4px'}}>📊 Panel de Dirección FLC</h1>
  <p style={{color:'#617165'}}>Acceso exclusivo de Administración. Producción real acreditada por split; AP sometida y Issue Paid verificada se mantienen separadas.</p>
  <section style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:10,background:'#f4f9f4',padding:15,borderRadius:12,margin:'15px 0'}}>
   <label>Período <select value={periodType} onChange={e=>setPeriodType(e.target.value)} style={{padding:9,marginLeft:5}}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option></select></label>
   <button onClick={()=>move(-1)}>← Anterior</button><input aria-label="Fecha" type="date" value={periodDate} onChange={e=>setPeriodDate(e.target.value)} style={{padding:8}}/><button onClick={()=>move(1)}>Siguiente →</button>
   <strong>{rangeLabel}</strong><button onClick={()=>setReloadKey(n=>n+1)} style={{marginLeft:'auto'}}>↻ Actualizar</button>
  </section>
  {loading?<p>Cargando producción y metas…</p>:error?<p role="alert" style={{color:'#a33'}}>{error}</p>:<React.Fragment>
   <section style={{background:'#eaf8ed',border:'1px solid #a7d3ad',borderRadius:15,padding:20}}>
    <h2 style={{margin:'0 0 12px'}}>🎯 Meta de AP sometida</h2>
    {goal?<React.Fragment>
     <div style={{fontSize:22}}><strong>{fmt(ap)}</strong> de {fmt(goal)} · <strong style={{color:'#087c39'}}>{progress.toFixed(1)}%</strong></div>
     <div style={{background:'#d6e5d8',height:20,borderRadius:20,overflow:'hidden',margin:'15px 0'}}><div style={{height:'100%',width:Math.max(0,Math.min(progress,100))+'%',background:'#0cba53'}}/></div>
     <p style={{marginBottom:0}}>{ap>=goal?'🎉 Meta cumplida.':'Faltan '+fmt(goal-ap)+' para completar la meta.'}</p>
    </React.Fragment>:<p>No hay una meta guardada para este período.</p>}
    <button onClick={()=>setPage('production')} style={{marginTop:12}}>Configurar metas en Production Center</button>
   </section>
   <h2>Indicadores de toda la agencia</h2>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
    {panelCard('AP sometida',fmt(ap),'Fecha de sometimiento')}
    {panelCard('AP Issue Paid verificada',fmt(verified),'Confirmada por Administración')}
    {panelCard('Pólizas sometidas',Number(agency?.submitted_policies||0).toLocaleString('en-US'))}
    {panelCard('Pólizas IP verificadas',Number(agency?.verified_policies||0).toLocaleString('en-US'))}
    {panelCard('Agentes que sometieron',submitting)}
    {panelCard('Agentes con IP verificada',paidAgents)}
    {panelCard('Promedio AP sometida / agente',fmt(submitting?ap/submitting:0))}
    {panelCard('Promedio AP verificada / agente',fmt(paidAgents?verified/paidAgents:0))}
    {panelCard('Inversión declarada en leads',fmt(leadTotal),'Sin verificación administrativa')}
   </div>
   <h2>👥 Producción por equipo</h2>
   <p style={{fontSize:13,color:'#536b58'}}>Equipos directos con su líder y descendientes. Las estructuras anidadas no deben sumarse entre sí ni al total de la agencia.</p>
   <div style={{overflowX:'auto',border:'1px solid #d7e4d8',borderRadius:12,background:'#fff'}}>
    <table style={{width:'100%',borderCollapse:'collapse',minWidth:760,fontSize:13}}>
     <thead style={{background:'#eaf4e8'}}><tr>{['Líder / equipo','AP sometida','AP IP verificada','Agentes que sometieron','Agentes IP verificada','Promedio AP sometida','Seguimiento'].map(t=><th key={t} style={{textAlign:'left',padding:12}}>{t}</th>)}</tr></thead>
     <tbody>{showTeams.map(t=>{const submitted=Number(t.submitted_ap),paid=Number(t.verified_ap),count=Number(t.submitting_agents);return <tr key={t.leader_id} style={{borderTop:'1px solid #e3ece4'}}>
      <td style={{padding:12,fontWeight:700}}>{t.leader_name}</td><td>{fmt(submitted)}</td><td>{fmt(paid)}</td><td>{count}</td><td>{Number(t.verified_agents)}</td><td>{fmt(count?submitted/count:0)}</td>
      <td>{submitted===0?<span style={{color:'#a23d2f'}}>Sin AP sometida</span>:paid===0?<span style={{color:'#8d6518'}}>Sin IP verificada en este período</span>:<span style={{color:'#18713b'}}>Con producción verificada</span>}</td>
     </tr>})}</tbody>
    </table>
    {!showTeams.length&&<p style={{padding:15}}>No hay equipos directos configurados para mostrar.</p>}
   </div>
   <section style={{marginTop:20,background:'#fff8ea',border:'1px solid #e3d3a6',padding:17,borderRadius:12}}>
    <h2 style={{marginTop:0}}>🔎 Alertas para seguimiento</h2>
    <p style={{fontSize:13}}>Estas señales ayudan a priorizar conversaciones. Una póliza sometida puede tardar en llegar a Issue Paid; ausencia de verificación no significa necesariamente falta de cierre.</p>
    {flagged.length?flagged.map(t=><p key={t.leader_id} style={{borderTop:'1px solid #e9dec4',paddingTop:9}}><strong>{t.leader_name}</strong>: {Number(t.submitted_ap)===0?'sin AP sometida':Number(t.verified_ap)===0?'AP sometida registrada, pero sin Issue Paid verificada en el período':'sin agentes productores registrados'}.</p>):<p>Sin alertas con estos criterios para el período seleccionado.</p>}
   </section>
   <section style={{marginTop:20,padding:17,border:'1px solid #d6e5d5',borderRadius:12}}>
    <h2 style={{marginTop:0}}>📈 Inversión en leads por proveedor</h2>
    {leadProviders.length?leadProviders.map(r=><p key={r.provider}><strong>{r.provider}</strong>: {fmt(r.total)}</p>):<p>Sin inversiones registradas en el período.</p>}
    <small>Montos declarados por los agentes. No se mezclan con AP sometida.</small>
   </section>
  </React.Fragment>}
 </main>;
}
window.CeoDashboard=CeoDashboard;
