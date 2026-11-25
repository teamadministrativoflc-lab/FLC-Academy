// Manual verification of Zoom presence until automated Zoom verification ships.
// Admin only; backend RPC independently verifies admin role via auth.uid().
function FlcLeadActivation({user}) {
  const [agents,setAgents]=React.useState([]);
  const [statuses,setStatuses]=React.useState({});
  const [busy,setBusy]=React.useState({});
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState('');
  const [query,setQuery]=React.useState('');
  const load=React.useCallback(async()=>{
    setLoading(true);setError('');
    const [profiles,availability]=await Promise.all([
      window.flcSupabase.from('agent_profiles').select('id,full_name,role').eq('role','agent').order('full_name'),
      window.flcSupabase.from('flc_distribution_agent_availability').select('agent_id,is_verified,verified_at,updated_at')
    ]);
    if(profiles.error||availability.error){
      setError('No se pudieron consultar los agentes o su disponibilidad. Comprueba los permisos de Administración.');
    }else{
      setAgents(profiles.data||[]);
      setStatuses(Object.fromEntries((availability.data||[]).map(x=>[x.agent_id,x])));
    }
    setLoading(false);
  },[]);
  React.useEffect(()=>{if(user?.role==='admin')load();},[user?.id,user?.role,load]);
  const change=async(a,next)=>{
    if(busy[a.id]||user?.role!=='admin')return;
    if(next&&!window.confirm('¿Confirmaste personalmente que '+a.full_name+' está presente en Zoom y puede recibir leads?'))return;
    if(!next&&!window.confirm('¿Pausar a '+a.full_name+' para que no reciba leads nuevos?'))return;
    setBusy(v=>({...v,[a.id]:true}));setError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_set_agent_active',
      {p_agent_id:a.id,p_active:next});
    if(err){
      setError('No se pudo '+(next?'activar':'pausar')+' a '+a.full_name+': '+err.message);
    }else{
      const updated=Array.isArray(data)?data[0]:data;
      if(updated)setStatuses(v=>({...v,[a.id]:updated}));
      await load();
    }
    setBusy(v=>({...v,[a.id]:false}));
  };
  if(user?.role!=='admin')return <p role="alert">Acceso exclusivo de Administración.</p>;
  const visible=agents.filter(a=>a.full_name.toLowerCase().includes(query.toLowerCase().trim()));
  const active=agents.filter(a=>statuses[a.id]?.is_verified).length;
  return <section className="flc-manual-activation">
    <div className="breadcrumb">FLC Academy / <span>Distribución de leads</span></div>
    <h1 className="page-title">Agentes <em>disponibles</em></h1>
    <p className="page-sub">Verifica personalmente la presencia del agente en Zoom. Solo Administración puede activar o pausar la participación. La distribución automática de leads todavía está desactivada.</p>
    <div className="card" style={{marginBottom:18,display:'flex',gap:18,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
      <div><strong style={{fontSize:25,color:'#19482a'}}>{active}</strong><span> activados de {agents.length} agentes</span></div>
      <button type="button" onClick={load} disabled={loading} className="btn-secondary">Actualizar</button>
    </div>
    <div className="card">
      <label htmlFor="flc-agent-search">Buscar agente</label>
      <input id="flc-agent-search" value={query} onChange={e=>setQuery(e.target.value)}
        placeholder="Nombre del agente" style={{display:'block',padding:12,width:'100%',maxWidth:460,margin:'8px 0 20px',border:'1px solid #b6c9b7',borderRadius:8}}/>
      {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}
      {loading?<p>Cargando agentes…</p>:
       <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
         <thead><tr><th style={{textAlign:'left',padding:12}}>Agente</th><th style={{textAlign:'left',padding:12}}>Estado</th><th style={{textAlign:'left',padding:12}}>Acción</th></tr></thead>
         <tbody>{visible.map(a=>{
           const on=!!statuses[a.id]?.is_verified;
           return <tr key={a.id} style={{borderTop:'1px solid #dbe5d9'}}>
             <td style={{padding:12}}>{a.full_name}</td>
             <td style={{padding:12}}>{on?'🟢 Verificado manualmente':'⚪ Inactivo'}</td>
             <td style={{padding:12}}><button type="button" className={on?'btn-secondary':'btn-green'}
               disabled={!!busy[a.id]} onClick={()=>change(a,!on)}>
               {busy[a.id]?'Guardando…':on?'Pausar':'Verificar y activar'}
             </button></td>
           </tr>;
         })}</tbody>
       </table>{visible.length===0&&<p>No se encontraron agentes.</p>}</div>}
    </div>
  </section>;
}
window.FlcLeadActivation=FlcLeadActivation;
