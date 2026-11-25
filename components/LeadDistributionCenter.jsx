// FLC Lead Distribution Center — read-only preview using new protected RPCs.
// No automatic agent assignment or outbound CRM update is enabled.
function LeadDistributionCenter({user}) {
  const [leads,setLeads]=React.useState([]);
  const [selected,setSelected]=React.useState(null);
  const [events,setEvents]=React.useState([]);
  const [loading,setLoading]=React.useState(true);
  const [eventsLoading,setEventsLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [query,setQuery]=React.useState('');
  const [status,setStatus]=React.useState('all');
  const [testAgents,setTestAgents]=React.useState([]);
  const [testAgentId,setTestAgentId]=React.useState('');
  const [testBusy,setTestBusy]=React.useState(false);
  const [testMessage,setTestMessage]=React.useState('');
  const date=x=>x?new Date(x).toLocaleString('es-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}):'—';
  const load=React.useCallback(async()=>{
    setLoading(true);setError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_my_leads',{p_limit:200});
    if(err){setError('No se pudieron cargar los leads: '+err.message);setLeads([]);}
    else setLeads(data||[]);
    setLoading(false);
  },[]);
  React.useEffect(()=>{load();},[load,user?.id]);
  React.useEffect(()=>{
    if(!selected){setEvents([]);return;}
    let active=true;setEventsLoading(true);
    window.flcSupabase.rpc('flc_distribution_lead_timeline',{p_lead_id:selected.lead_id,p_limit:100})
    .then(({data,error:err})=>{
      if(!active)return;
      setEvents(err?[]:(data||[]));setEventsLoading(false);
    });
    return()=>{active=false};
  },[selected?.lead_id]);
  const filtered=leads.filter(l=>{
    const s=[l.contact_name,l.source_campaign,l.external_lead_id,l.assigned_agent_name,l.lead_state].join(' ').toLowerCase();
    return (status==='all'||l.lifecycle_status===status)&&s.includes(query.toLowerCase());
  });
  const isAdmin=user?.role==='admin';
  const synthetic=!!selected && selected.external_lead_id?.startsWith('FLC-PRUEBA-') && selected.source_campaign!=='FLC_TEST_INTEGRACION';
  React.useEffect(()=>{
    if(!selected||!synthetic||!isAdmin||selected.assigned_agent_id){setTestAgents([]);setTestAgentId('');return;}
    let active=true;
    window.flcSupabase.rpc('flc_distribution_simulate_eligibility',{
      p_campaign_code:selected.source_campaign,p_state_code:selected.lead_state||''
    }).then(({data,error:err})=>{
      if(!active)return;
      setTestAgents(err?[]:(data||[]).filter(a=>a.eligible));
    });
    return()=>{active=false;};
  },[selected?.lead_id,selected?.source_campaign,selected?.lead_state,selected?.assigned_agent_id,isAdmin,synthetic]);
  const assignTest=async()=>{
    if(!selected||!synthetic||!testAgentId||testBusy||!isAdmin)return;
    if(!window.confirm('Esto asignará SOLO el contacto ficticio seleccionado. ¿Confirmas que el agente está realmente disponible y autorizado?'))return;
    setTestBusy(true);setTestMessage('');
    const {error:err}=await window.flcSupabase.rpc('flc_distribution_assign_test_lead',{
      p_lead_id:selected.lead_id,p_agent_id:testAgentId
    });
    setTestBusy(false);
    if(err)setTestMessage('No se pudo asignar: '+err.message);
    else{setTestMessage('Contacto de prueba asignado correctamente.');setSelected(null);await load();}
  };
  return <div className="flc-leads-center">
    <div className="breadcrumb">FLC Academy / <span>Lead Distribution Center</span></div>
    <h1 className="page-title">Lead <em>Distribution Center</em></h1>
    <p className="page-sub">Vista de recepción de campañas. La asignación automática está desactivada mientras verificamos las reglas de distribución.</p>
    <div className="flc-leads-summary">
      <div className="card"><span>Leads visibles</span><strong>{leads.length}</strong></div>
      <div className="card"><span>Asignados</span><strong>{leads.filter(l=>l.assigned_agent_id).length}</strong></div>
      <div className="card"><span>Pendientes de asignar</span><strong>{leads.filter(l=>!l.assigned_agent_id).length}</strong></div>
    </div>
    <div className="card">
      <div className="flc-leads-toolbar">
        <input aria-label="Buscar lead" placeholder="Buscar lead, ID o campaña"
          value={query} onChange={e=>setQuery(e.target.value)}/>
        <select aria-label="Filtrar estado" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="assigned">Asignado</option>
          <option value="paused">Pausado</option>
          <option value="closed">Cerrado</option>
          <option value="invalid">Inválido</option>
        </select>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>Actualizar</button>
      </div>
      {loading?<p role="status">Cargando leads…</p>:
      error?<p role="alert" style={{color:'#a33'}}>{error}</p>:
      <div className="flc-leads-scroll"><table className="flc-leads-table">
        <thead><tr><th>Contacto</th><th>Campaña</th><th>Estado</th><th>Situación</th><th>Agente</th><th>Recibido (ET)</th><th>Acción</th></tr></thead>
        <tbody>{filtered.map(l=><tr key={l.lead_id}>
          <td><strong>{l.contact_name||'Sin nombre'}</strong><small>{l.external_lead_id}</small></td>
          <td>{l.source_campaign}</td><td>{l.lead_state||'Sin verificar'}</td>
          <td>{l.lifecycle_status||'Pendiente'}</td><td>{l.assigned_agent_name||'Sin asignar'}</td>
          <td>{date(l.received_at)}</td>
          <td><button type="button" className="btn-secondary" onClick={()=>setSelected(l)}>Detalle</button></td>
        </tr>)}</tbody>
      </table>{filtered.length===0&&<p>No hay leads visibles con estos filtros.</p>}</div>}
      {!isAdmin&&<p style={{marginTop:12,fontSize:13}}>Por seguridad, solo puedes consultar leads asignados a tu cuenta.</p>}
    </div>
    {selected&&<div className="flc-leads-modal-backdrop" role="presentation" onClick={()=>setSelected(null)}>
      <section className="flc-leads-modal card" role="dialog" aria-modal="true" aria-label="Detalle del lead" onClick={e=>e.stopPropagation()}>
        <div className="flc-leads-modal-header"><div><strong>{selected.contact_name||'Lead'}</strong>
          <p>{selected.source_campaign} · {selected.lifecycle_status}</p></div>
          <button className="btn-secondary" onClick={()=>setSelected(null)}>Cerrar</button></div>
        <p>Teléfono: {selected.phone||'—'}</p>
        <p>Correo: {selected.email||'—'}</p>
        <p>Estado: {selected.lead_state||'No identificado'}</p>
        {isAdmin&&synthetic&&!selected.assigned_agent_id&&<div style={{padding:'12px 0',borderTop:'1px solid #dce8d7'}}>
          <h3>Asignación controlada (solo contacto ficticio)</h3>
          <p>Solo aparecerán agentes que cumplan campaña, estado y Zoom verificado. No se enviará información a AuraFlow.</p>
          <select aria-label="Agente elegible" value={testAgentId} onChange={e=>setTestAgentId(e.target.value)}>
            <option value="">Seleccionar agente elegible</option>
            {testAgents.map(a=><option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>)}
          </select>
          <button type="button" className="btn-green" disabled={!testAgentId||testBusy} onClick={assignTest}>
            {testBusy?'Asignando…':'Asignar contacto ficticio'}
          </button>
          {testAgents.length===0&&<p>No hay agentes elegibles y verificados para esta campaña/estado.</p>}
          {testMessage&&<p role="status">{testMessage}</p>}
        </div>}
        <h3>Historial</h3>
        {eventsLoading?<p>Cargando…</p>:events.length===0?<p>No hay eventos registrados todavía.</p>:
          events.map(e=><p key={e.event_id}><strong>{e.event_type}</strong> · {date(e.event_at)} · {e.actor_name}</p>)}
      </section>
    </div>}
  </div>;
}
window.LeadDistributionCenter=LeadDistributionCenter;
