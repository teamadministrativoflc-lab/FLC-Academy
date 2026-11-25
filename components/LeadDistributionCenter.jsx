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
  const [rrTestBusy,setRrTestBusy]=React.useState(false);
  const [rrTestResult,setRrTestResult]=React.useState('');
  const [pendingQueue,setPendingQueue]=React.useState([]);
  const [pendingLoading,setPendingLoading]=React.useState(false);
  const [pendingError,setPendingError]=React.useState('');
  const [rrQueue,setRrQueue]=React.useState([]);
  const [rrLoading,setRrLoading]=React.useState(false);
  const [rrError,setRrError]=React.useState('');
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
  const isAdmin=user?.role==='admin';
  const loadPending=React.useCallback(async()=>{
    if(!isAdmin)return;
    setPendingLoading(true);setPendingError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_preview_pending',{p_limit:200});
    if(err){setPendingError('No se pudo evaluar la cola: '+err.message);setPendingQueue([]);}
    else setPendingQueue(data||[]);
    setPendingLoading(false);
  },[isAdmin]);
  React.useEffect(()=>{loadPending();},[loadPending]);
  const loadRoundRobin=React.useCallback(async()=>{
    if(!isAdmin)return;
    setRrLoading(true);setRrError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_round_robin_preview',{p_limit:200});
    if(err){setRrError('No se pudo simular Round Robin: '+err.message);setRrQueue([]);}
    else setRrQueue(data||[]);
    setRrLoading(false);
  },[isAdmin]);
  React.useEffect(()=>{loadRoundRobin();},[loadRoundRobin]);
  const refreshAll=async()=>{await Promise.all([load(),loadPending(),loadRoundRobin()]);};
  const filtered=leads.filter(l=>{
    const s=[l.contact_name,l.source_campaign,l.external_lead_id,l.assigned_agent_name,l.lead_state].join(' ').toLowerCase();
    return (status==='all'||l.lifecycle_status===status)&&s.includes(query.toLowerCase());
  });
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
  const simulateSafeAssignment=async()=>{
    if(!selected||!synthetic||rrTestBusy||!isAdmin)return;
    setRrTestBusy(true);setRrTestResult('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_round_robin_assign_test',{
      p_lead_id:selected.lead_id
    });
    setRrTestBusy(false);
    if(err){setRrTestResult('Error: '+err.message);return;}
    if(data?.assigned){
      setRrTestResult('Contacto ficticio asignado a '+(data.agent_name||'agente elegible'));
      await load();
    }else if(data?.reason==='hold_no_available_agent'){
      setRrTestResult('Correcto: en espera porque no hay agentes disponibles. No se asignó el contacto.');
    }else{
      setRrTestResult('Sin asignación: '+(data?.reason||'sin resultado'));
    }
  };
  const waitingCount=pendingQueue.filter(l=>l.decision==='hold_no_available_agent').length;
  const readyCount=pendingQueue.filter(l=>l.decision==='ready_for_manual_review').length;
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
        <button type="button" className="btn-secondary" onClick={refreshAll} disabled={loading||pendingLoading}>Actualizar</button>
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
    {isAdmin&&<div className="card" style={{marginTop:20}}>
      <h2 style={{fontSize:22,marginBottom:8}}>Cola de distribución (simulación)</h2>
      <p style={{color:'#677466',marginBottom:12}}>Consulta de solo lectura. No asigna contactos ni envía mensajes. Los agentes inactivos no son elegibles.</p>
      {pendingLoading?<p role="status">Evaluando leads pendientes…</p>:
       pendingError?<p role="alert" style={{color:'#a33'}}>{pendingError}</p>:<>
         <div style={{display:'flex',gap:24,flexWrap:'wrap',marginBottom:12}}>
           <span><strong>{pendingQueue.length}</strong> pendientes evaluados</span>
           <span><strong>{waitingCount}</strong> en espera</span>
           <span><strong>{readyCount}</strong> con agentes elegibles</span>
         </div>
         <div style={{overflowX:'auto'}}><table className="flc-leads-table">
           <thead><tr><th>Contacto</th><th>Campaña</th><th>Estado</th><th>Elegibles</th><th>Decisión</th></tr></thead>
           <tbody>{pendingQueue.map(p=><tr key={p.lead_id}>
             <td>{p.contact_name||'Sin nombre'}</td><td>{p.source_campaign}</td>
             <td>{p.state_code||'Sin estado'}</td><td>{p.eligible_count}</td>
             <td>{p.decision==='hold_no_available_agent'?'En espera — ningún agente disponible':'Listo para revisión manual'}</td>
           </tr>)}</tbody>
         </table>{pendingQueue.length===0&&<p>No hay leads pendientes.</p>}</div>
       </>}
    </div>}
    {isAdmin&&<div className="card" style={{marginTop:20}}>
      <h2 style={{fontSize:22,marginBottom:8}}>Round Robin — turnos propuestos</h2>
      <p style={{color:'#677466',marginBottom:12}}>Simulación por campaña y estado. No asigna contactos ni avanza el turno real. Los agentes inactivos quedan excluidos.</p>
      {rrLoading?<p role="status">Calculando turnos…</p>:
       rrError?<p role="alert" style={{color:'#a33'}}>{rrError}</p>:
       <div style={{overflowX:'auto'}}>
         <table className="flc-leads-table">
           <thead><tr><th>Contacto</th><th>Campaña</th><th>Estado</th><th>Elegibles</th><th>Siguiente agente</th><th>Decisión</th></tr></thead>
           <tbody>{rrQueue.map(p=><tr key={p.lead_id}>
             <td>{p.contact_name||'Sin nombre'}</td>
             <td>{p.source_campaign}</td><td>{p.state_code||'Sin estado'}</td>
             <td>{p.eligible_count}</td>
             <td>{p.suggested_agent_name||'—'}</td>
             <td>{p.decision==='hold_no_available_agent'?'En espera':'Listo para revisión'}</td>
           </tr>)}</tbody>
         </table>
         {rrQueue.length===0&&<p>No hay leads pendientes.</p>}
       </div>}
    </div>}
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
        {isAdmin&&synthetic&&!selected.assigned_agent_id&&<div style={{borderTop:'1px solid #dce8d7',marginTop:14,paddingTop:14}}>
          <h3>Prueba del motor Round Robin</h3>
          <p>Solo admite contactos ficticios. Si no hay agentes disponibles, el lead permanece en espera. Si hay uno elegible, esta acción sí lo asigna dentro de la academia.</p>
          <button type="button" className="btn-secondary" onClick={simulateSafeAssignment} disabled={rrTestBusy}>
            {rrTestBusy?'Comprobando…':'Ejecutar Round Robin de prueba'}
          </button>
          {rrTestResult&&<p role="status" style={{marginTop:10}}>{rrTestResult}</p>}
        </div>}
        <h3>Historial</h3>
        {eventsLoading?<p>Cargando…</p>:events.length===0?<p>No hay eventos registrados todavía.</p>:
          events.map(e=><p key={e.event_id}><strong>{e.event_type}</strong> · {date(e.event_at)} · {e.actor_name}</p>)}
      </section>
    </div>}
  </div>;
}
window.LeadDistributionCenter=LeadDistributionCenter;
