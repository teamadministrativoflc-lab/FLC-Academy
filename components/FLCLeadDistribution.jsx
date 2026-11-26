function FLCLeadDistribution({user}) {
  const [agents,setAgents]=React.useState([]);
  const [availability,setAvailability]=React.useState({});
  const [loading,setLoading]=React.useState(true);
  const [busy,setBusy]=React.useState('');
  const [message,setMessage]=React.useState('');
  const [search,setSearch]=React.useState('');
  const [leadsCount,setLeadsCount]=React.useState(null);

  const refresh=React.useCallback(async()=>{
    setLoading(true);setMessage('');
    try {
      // Admin session only; database RLS is the real security boundary.
      const [profiles,states,leads]=await Promise.all([
        window.flcSupabase.from('agent_profiles').select('id,full_name,role').eq('role','agent').order('full_name'),
        window.flcSupabase.from('flc_distribution_agent_availability').select('agent_id,is_verified,verified_at'),
        window.flcSupabase.from('flc_distribution_leads').select('id',{count:'exact',head:true})
      ]);
      if(profiles.error)throw profiles.error;
      if(states.error)throw states.error;
      setAgents(profiles.data||[]);
      setAvailability(Object.fromEntries((states.data||[]).map(s=>[s.agent_id,s])));
      setLeadsCount(leads.error?null:leads.count);
    }catch(e){setMessage('No se pudieron cargar los datos de distribución. Comprueba que el SQL de activación esté instalado.');}
    finally{setLoading(false)}
  },[]);
  React.useEffect(()=>{if(user.role==='admin')refresh()},[user.id,user.role,refresh]);

  async function change(agent,active){
    if(busy)return;
    setBusy(agent.id);setMessage('');
    try{
      const {error}=await window.flcSupabase.rpc('flc_distribution_set_agent_active',{
        p_agent_id:agent.id,p_active:active
      });
      if(error)throw error;
      setMessage((active?'Agente verificado y activado: ':'Agente pausado: ')+agent.full_name);
      await refresh();
    }catch(err){setMessage('No fue posible cambiar la disponibilidad. Verifica permisos y que el SQL esté instalado.')}
    finally{setBusy('')}
  }
  if(user.role!=='admin')return <p>No autorizado.</p>;
  const filtered=agents.filter(a=>a.full_name.toLowerCase().includes(search.trim().toLowerCase()));
  const active=agents.filter(a=>availability[a.id]?.is_verified).length;
  return <div style={{maxWidth:1100,margin:'0 auto',padding:'16px 4px'}}>
    <h1 style={{fontSize:32,margin:'0 0 8px'}}>FLC Lead Distribution Center</h1>
    <p style={{color:'#5b665c'}}>Verificación manual de agentes · La asignación automática permanece desactivada.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}>
      {[['Agentes',agents.length],['Verificados',active],['Leads recibidos',leadsCount===null?'—':leadsCount]].map(([label,value])=>
        <div key={label} style={{background:'#fff',border:'1px solid #dae5d6',borderRadius:12,padding:18,minWidth:155}}>
          <div style={{fontSize:12,color:'#56705a'}}>{label}</div>
          <div style={{fontWeight:700,fontSize:26,color:'#173d26'}}>{value}</div>
        </div>)}
    </div>
    {message&&<p role="status" style={{background:'#f3f8ed',border:'1px solid #cbdac5',padding:12,borderRadius:9}}>{message}</p>}
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:15}}>
      <input aria-label="Buscar agente" placeholder="Buscar agente..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{padding:12,borderRadius:8,border:'1px solid #ccd7c9',flex:'1 1 260px'}} />
      <button type="button" onClick={refresh} disabled={loading} style={{padding:'12px 18px',borderRadius:8}}>Actualizar</button>
    </div>
    {loading?<p>Cargando agentes...</p>:<div style={{background:'white',border:'1px solid #dae5d6',borderRadius:12,overflow:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',minWidth:560}}>
        <thead><tr style={{background:'#f1f6ee',textAlign:'left'}}>
          <th style={{padding:13}}>Agente</th><th style={{padding:13}}>Estado</th><th style={{padding:13}}>Verificación Zoom</th>
        </tr></thead>
        <tbody>{filtered.map(agent=>{
          const enabled=!!availability[agent.id]?.is_verified;
          return <tr key={agent.id} style={{borderTop:'1px solid #e5ebe1'}}>
            <td style={{padding:13}}>{agent.full_name}</td>
            <td style={{padding:13,color:enabled?'#20683b':'#66716b'}}>{enabled?'Verificado':'Inactivo'}</td>
            <td style={{padding:13}}>
              <button type="button" disabled={busy===agent.id} onClick={()=>change(agent,!enabled)}
                style={{padding:'9px 13px',border:0,borderRadius:8,background:enabled?'#e7ecdf':'#215837',color:enabled?'#25472c':'#fff',cursor:'pointer'}}>
                {busy===agent.id?'Guardando...':enabled?'Pausar':'Verificar y activar'}
              </button>
            </td>
          </tr>
        })}</tbody>
      </table>
      {!filtered.length&&<p style={{padding:16}}>No hay agentes que coincidan con la búsqueda.</p>}
    </div>}
    <p style={{fontSize:12,color:'#69756e',marginTop:16}}>La verificación es manual. No certifica asistencia automáticamente. No asigna leads todavía.</p>
  </div>;
}
window.FLCLeadDistribution=FLCLeadDistribution;
