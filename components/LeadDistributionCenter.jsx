function LeadDistributionCenter({ user, setPage }) {
  const [leads,setLeads]=React.useState([]);
  const [selected,setSelected]=React.useState(null);
  const [timeline,setTimeline]=React.useState([]);
  const [loading,setLoading]=React.useState(true);
  const [historyLoading,setHistoryLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [historyError,setHistoryError]=React.useState('');
  const [query,setQuery]=React.useState('');
  const [status,setStatus]=React.useState('all');
  const [participating,setParticipating]=React.useState(false);
  const [availability,setAvailability]=React.useState(false);
  const [availableBusy,setAvailableBusy]=React.useState(false);
  const [availabilityError,setAvailabilityError]=React.useState('');
  const availableRef=React.useRef(false);

  React.useEffect(()=>{
    let active=true;
    availableRef.current=false;
    setAvailability(false);
    setParticipating(false);
    if(!user?.id)return;
    window.flcSupabase.rpc('flc_my_lead_participation').then(({data,error})=>{
      if(active&&!error)setParticipating(!!data);
    });
    return ()=>{active=false;};
  },[user?.id]);

  const setDisponible=async next=>{
    if(availableBusy||!participating)return;
    setAvailableBusy(true);setAvailabilityError('');
    try{
      const {data,error:err}=await window.flcSupabase.rpc('flc_set_my_lead_availability',{p_available:next});
      if(err)throw err;
      const ok=!!(Array.isArray(data)?data[0]?.is_available:data?.is_available);
      availableRef.current=ok;setAvailability(ok);
    }catch(e){
      setAvailabilityError('No se pudo cambiar disponibilidad. Verifica acceso y conexión.');
    }finally{setAvailableBusy(false);}
  };

  React.useEffect(()=>{
    if(!availability||!user?.id)return;
    // The server lease expires after 90 seconds if no heartbeat arrives.
    const timer=setInterval(async()=>{
      if(!availableRef.current)return;
      const {data,error:err}=await window.flcSupabase.rpc('flc_set_my_lead_availability',{p_available:true});
      if(err||!(Array.isArray(data)?data[0]?.is_available:data?.is_available)){
        availableRef.current=false;setAvailability(false);
        setAvailabilityError('Disponibilidad vencida o conexión interrumpida. Actívala nuevamente.');
      }
    },45000);
    return()=>clearInterval(timer);
  },[availability,user?.id]);
  const labels={new:'Nuevo',assigned:'Asignado',working:'En proceso',
    appointment:'Cita',sold:'Venta cerrada',recycle_pending:'Pendiente de reasignar',
    archived:'Archivado'};
  const dateTime=x=>x?new Intl.DateTimeFormat('es-US',{
    dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'
  }).format(new Date(x)):'—';
  const eventLabels={imported:'Importación',assigned:'Asignación',
    released:'Liberación',status_changed:'Cambio de estado',
    crm_synced:'Sincronización CRM',recycle_eligible:'Elegible para reciclaje',
    duplicate_review:'Revisión de duplicado',sale_linked:'Venta vinculada',
    call_attempt:'Intento de llamada',note_added:'Nota registrada',
    appointment_set:'Cita agendada'};
  const loadLeads=React.useCallback(async()=>{
    if(!user?.id)return;
    setLoading(true);setError('');
    try{
      const {data,error:err}=await window.flcSupabase.rpc('flc_my_leads',{p_limit:200});
      if(err)throw err;
      setLeads(Array.isArray(data)?data:[]);
    }catch(e){
      setError('No se pudieron cargar los leads. La base de datos de este módulo puede estar pendiente de activación.');
      setLeads([]);
    }finally{setLoading(false);}
  },[user?.id]);
  React.useEffect(()=>{loadLeads();},[loadLeads]);
  React.useEffect(()=>{
    let active=true;
    if(!selected){setTimeline([]);return;}
    (async()=>{
      setHistoryLoading(true);setHistoryError('');setTimeline([]);
      const {data,error:err}=await window.flcSupabase.rpc('flc_lead_timeline',{
        p_lead_id:selected.lead_id,p_limit:200
      });
      if(!active)return;
      if(err)setHistoryError('El historial no está disponible todavía.');
      else setTimeline(Array.isArray(data)?data:[]);
      setHistoryLoading(false);
    })();
    return()=>{active=false;};
  },[selected?.lead_id]);

  const filtered=leads.filter(lead=>{
    const text=[lead.contact_name,lead.external_lead_id,lead.source_campaign,
      lead.assigned_agent_name,lead.lifecycle_status].join(' ').toLowerCase();
    return (status==='all'||lead.lifecycle_status===status)&&text.includes(query.toLowerCase().trim());
  });
  return <div className="flc-leads-center">
    <div className="breadcrumb">FLC Academy / <span>Lead Distribution Center</span></div>
    <h1 className="page-title">Lead <em>Distribution Center</em></h1>
    <p className="page-sub">Gestión de leads e historial de actividades dentro de FLC Academy.</p>
    {participating&&<div className="card flc-leads-presence" aria-label="Disponibilidad para recibir leads">
      <div><strong>Recepción de leads</strong>
      <p>{availability?'Disponible en Academy. Recibirás leads solo si Zoom confirma tu presencia.':'No disponible: no recibirás leads nuevos.'}</p></div>
      <button type="button" className={availability?'btn-secondary':'btn-green'}
        onClick={()=>setDisponible(!availability)} disabled={availableBusy}>
        {availableBusy?'Guardando…':availability?'Pasar a No disponible':'Estoy Disponible'}
      </button>
      {availabilityError&&<p role="alert" className="flc-leads-error">{availabilityError}</p>}
    </div>}
    <div className="flc-leads-summary">
      <div className="card"><span>Leads visibles</span><strong>{leads.length}</strong></div>
      <div className="card"><span>Asignados</span><strong>{leads.filter(x=>x.assigned_agent_id).length}</strong></div>
      <div className="card"><span>Pendientes de reasignación</span><strong>{leads.filter(x=>x.lifecycle_status==='recycle_pending').length}</strong></div>
    </div>
    <div className="card">
      <div className="flc-leads-toolbar">
        <input aria-label="Buscar lead" placeholder="Buscar lead, ID, campaña o agente"
          value={query} onChange={e=>setQuery(e.target.value)} />
        <select aria-label="Filtrar estado" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          {Object.entries(labels).map(([key,name])=><option key={key} value={key}>{name}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={loadLeads}>Actualizar</button>
      </div>
      {loading?<p role="status">Cargando leads…</p>:
       error?<p role="alert" className="flc-leads-error">{error}</p>:
       <div className="flc-leads-scroll"><table className="flc-leads-table">
        <thead><tr><th>Lead</th><th>Campaña</th><th>Zona</th><th>Estado</th><th>Agente</th><th>Registro</th><th>Acción</th></tr></thead>
        <tbody>{filtered.map(lead=><tr key={lead.lead_id}>
          <td><strong>{lead.contact_name||'Sin nombre'}</strong><small>{lead.external_lead_id||'—'}</small></td>
          <td>{lead.source_campaign||'—'}</td><td>{lead.timezone_label||'Por verificar'}{lead.state_code?' · '+lead.state_code:''}</td><td>{labels[lead.lifecycle_status]||lead.lifecycle_status}</td>
          <td>{lead.assigned_agent_name||'Sin asignar'}</td><td>{dateTime(lead.created_at)}</td>
          <td><button type="button" className="btn-secondary" onClick={()=>setSelected(lead)}>Ver historial</button></td>
        </tr>)}</tbody>
      </table>{!filtered.length&&<p>No hay leads que coincidan con estos filtros.</p>}</div>}
    </div>
    {selected&&<div className="flc-leads-modal-backdrop" role="presentation" onClick={()=>setSelected(null)}>
      <section className="flc-leads-modal card" role="dialog" aria-modal="true" aria-label="Historial del lead"
        onClick={e=>e.stopPropagation()}>
        <div className="flc-leads-modal-header"><div>
          <strong>Historial del lead</strong><p>{selected.contact_name||'Sin nombre'} · {selected.external_lead_id||selected.lead_id}</p>
        </div><button type="button" className="btn-secondary" onClick={()=>setSelected(null)}>Cerrar</button></div>
        {historyLoading?<p>Cargando historial…</p>:historyError?<p role="alert">{historyError}</p>:
        timeline.length?timeline.map(ev=><div className="flc-leads-event" key={ev.event_id}>
          <div><strong>{eventLabels[ev.event_type]||ev.event_type}</strong><span>{dateTime(ev.event_at)} ET</span></div>
          <small>{ev.actor_name||ev.source_system||'Sistema'}</small>
          {ev.details&&Object.keys(ev.details).length>0&&
          <pre>{JSON.stringify(ev.details,null,2)}</pre>}
        </div>):<p>Todavía no hay actividades registradas para este lead.</p>}
        <p className="flc-leads-disclaimer">Las horas se muestran en Eastern para la administración. La hora local del contacto se habilitará cuando se haya verificado su zona.</p>
      </section>
    </div>}
  </div>;
}
window.LeadDistributionCenter=LeadDistributionCenter;
