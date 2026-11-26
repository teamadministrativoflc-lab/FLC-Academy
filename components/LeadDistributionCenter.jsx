// FLC Lead Distribution Center — protected agent/admin views and manual workflows.
// Automatic assignments are controlled by the server-side automation switch and scheduled task.
function LeadDistributionCenter({user,setPage}) {
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
  const [realAgents,setRealAgents]=React.useState([]);
  const [realAgentId,setRealAgentId]=React.useState('');
  const [realAssignBusy,setRealAssignBusy]=React.useState(false);
  const [appointmentOverride,setAppointmentOverride]=React.useState(false);
  const [appointmentReason,setAppointmentReason]=React.useState('');
  const [realAssignResult,setRealAssignResult]=React.useState('');
  const [rrTestBusy,setRrTestBusy]=React.useState(false);
  const [rrTestResult,setRrTestResult]=React.useState('');
  const [pendingQueue,setPendingQueue]=React.useState([]);
  const [pendingLoading,setPendingLoading]=React.useState(false);
  const [pendingError,setPendingError]=React.useState('');
  const [rrQueue,setRrQueue]=React.useState([]);
  const [rrLoading,setRrLoading]=React.useState(false);
  const [rrError,setRrError]=React.useState('');
  const [followUps,setFollowUps]=React.useState([]);
  const [completedFollowUps,setCompletedFollowUps]=React.useState([]);
  const [showCompletedFollowUps,setShowCompletedFollowUps]=React.useState(false);
  const [completeBusyId,setCompleteBusyId]=React.useState(null);
  const [completionFeedback,setCompletionFeedback]=React.useState('');
  const [followUpsBusy,setFollowUpsBusy]=React.useState(false);
  const [followUpsError,setFollowUpsError]=React.useState('');
  // Agent-owned manual activity; no external CRM write is performed here.
  const [activityKind,setActivityKind]=React.useState('call');
  const [activityResult,setActivityResult]=React.useState('no_answer');
  const [activityNote,setActivityNote]=React.useState('');
  const [activityFollowUp,setActivityFollowUp]=React.useState('');
  const [activityBusy,setActivityBusy]=React.useState(false);
  const [activityFeedback,setActivityFeedback]=React.useState('');
  const [voidBusy,setVoidBusy]=React.useState(false);
  const [recentlySubmitted,setRecentlySubmitted]=React.useState(false);
  const canLogActivity=!!selected && !isAdminAccount(user) && selected.assigned_agent_id===user?.id;
  function isAdminAccount(u){return u?.role==='admin';}
  React.useEffect(()=>{
    setActivityKind('call');setActivityResult('no_answer');setActivityNote('');
    setActivityFollowUp('');setActivityFeedback('');setRecentlySubmitted(false);
  },[selected?.lead_id]);
  const saveActivity=async()=>{
    if(!selected||!canLogActivity||activityBusy||recentlySubmitted)return;
    if((activityKind==='appointment'||activityKind==='follow_up')&&!activityFollowUp){
      setActivityFeedback('Selecciona fecha y hora del seguimiento.');return;
    }
    const followUp=activityFollowUp?new Date(activityFollowUp).toISOString():null;
    setActivityBusy(true);setActivityFeedback('');
    const {data:activityData,error:err}=await window.flcSupabase.rpc('flc_distribution_record_activity',{
      p_lead_id:selected.lead_id,p_kind:activityKind,
      p_result:activityKind==='call'?activityResult:null,
      p_note:activityNote.trim()||null,p_follow_up_at:followUp
    });
    setActivityBusy(false);
    if(err){setActivityFeedback('No se pudo guardar: '+err.message);return;}
    setRecentlySubmitted(true);
    setActivityFeedback(activityData?.duplicate_prevented?'Ya existía una gestión idéntica reciente. No se duplicó.':'Gestión guardada en FLC Academy. Sincronización a AuraFlow aún no habilitada.');
    setActivityNote('');setActivityFollowUp('');
    const result=await window.flcSupabase.rpc('flc_distribution_lead_timeline',{
      p_lead_id:selected.lead_id,p_limit:100
    });
    if(!result.error)setEvents(result.data||[]);
    await loadFollowUps();
  };
  const voidManualActivity=async e=>{
    if(!selected||!canLogActivity||voidBusy)return;
    const reason=window.prompt('Motivo para anular esta gestión (mínimo 5 caracteres):');
    if(reason===null)return;
    if(reason.trim().length<5){setActivityFeedback('Escribe un motivo de al menos cinco caracteres.');return;}
    if(!window.confirm('Se marcará la gestión como ANULADA, conservando el historial. ¿Continuar?'))return;
    setVoidBusy(true);
    const {error:err}=await window.flcSupabase.rpc('flc_distribution_void_activity',{
      p_lead_id:selected.lead_id,p_event_id:e.event_id,p_reason:reason.trim()
    });
    setVoidBusy(false);
    if(err){setActivityFeedback('No se pudo anular: '+err.message);return;}
    setActivityFeedback('Gestión anulada con historial conservado.');
    const result=await window.flcSupabase.rpc('flc_distribution_lead_timeline',{
      p_lead_id:selected.lead_id,p_limit:100
    });
    if(!result.error)setEvents(result.data||[]);
    await loadFollowUps();
  };
  const openSaleForm=()=>{
    if(!selected||!canLogActivity||!setPage)return;
    window.sessionStorage.setItem('flc_new_sale_from_lead',JSON.stringify({
      leadId:selected.lead_id,
      contactName:selected.contact_name||'',
      campaign:selected.source_campaign||'',
      sourceContactId:selected.external_lead_id||'',
      agentId:user.id
    }));
    setSelected(null);
    setPage('production');
  };
  const describeEvent=e=>{
    const d=e.details||{};
    const names={agent_call_logged:'Llamada',agent_note_logged:'Nota',agent_follow_up_logged:'Seguimiento',agent_appointment_logged:'Cita',agent_follow_up_completed:'Seguimiento completado'};
    const results={no_answer:'No contestó',voicemail:'Buzón de voz',interested:'Interesado',not_interested:'No interesado',callback:'Volver a llamar',appointment:'Cita programada',wrong_number:'Número equivocado',other:'Otro'};
    if(!names[e.event_type])return e.event_type;
    return [names[e.event_type],results[d.result],d.note,d.follow_up_at?'Próxima gestión: '+date(d.follow_up_at):''].filter(Boolean).join(' · ');
  };

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
  const loadFollowUps=React.useCallback(async()=>{
    if(isAdmin)return;
    setFollowUpsBusy(true);setFollowUpsError('');

    const [pending,completed]=await Promise.all([
      window.flcSupabase.rpc('flc_distribution_my_follow_ups',{p_limit:200}),
      window.flcSupabase.rpc('flc_distribution_my_completed_follow_ups',{p_limit:100})
    ]);
    setFollowUpsBusy(false);
    if(pending.error){setFollowUps([]);setFollowUpsError('No se pudo cargar seguimientos: '+pending.error.message);}
    else setFollowUps(pending.data||[]);
    if(completed.error){setCompletedFollowUps([]);setFollowUpsError(x=>x||'No se pudo cargar el historial completado: '+completed.error.message);}
    else setCompletedFollowUps(completed.data||[]);
  },[isAdmin,user?.id]);
  React.useEffect(()=>{loadFollowUps();},[loadFollowUps]);
  const refreshAll=async()=>{await Promise.all([load(),loadPending(),loadRoundRobin(),loadFollowUps()]);};
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
  const realPending=!!selected && isAdmin &&
    selected.lifecycle_status==='pending' &&
    !selected.assigned_agent_id &&
    !selected.external_lead_id?.startsWith('FLC-PRUEBA-') &&
    !selected.external_lead_id?.startsWith('FLC-HISTORIAL-') &&
    selected.source_campaign!=='FLC_TEST_INTEGRACION';
  React.useEffect(()=>{
    setRealAgentId('');setRealAssignResult('');setRealAgents([]);
    setAppointmentOverride(false);setAppointmentReason('');
    if(!realPending||!selected?.lead_state)return;
    let active=true;
    window.flcSupabase.rpc('flc_distribution_simulate_eligibility',{
      p_campaign_code:selected.source_campaign,p_state_code:selected.lead_state
    }).then(({data,error:err})=>{
      if(active)setRealAgents(err?[]:(data||[]).filter(a=>a.campaign_allowed&&a.state_allowed));
    });
    return()=>{active=false;};
  },[selected?.lead_id,selected?.lifecycle_status,realPending]);
  const assignRealManually=async()=>{
    if(!realPending||!realAgentId||realAssignBusy)return;
    const agent=realAgents.find(a=>a.agent_id===realAgentId);
    if(!agent||!agent.campaign_allowed||!agent.state_allowed)return;
    if(appointmentOverride && appointmentReason.trim().length<10){
      setRealAssignResult('Indica el motivo de la cita previa (mínimo 10 caracteres).');return;
    }
    const confirmation=appointmentOverride
      ? '¿Confirmas que ya existe una cita previa en AuraFlow y verificaste que el agente tiene licencia vigente para el estado? Se asignará SOLO este lead, sin activar su disponibilidad automática. No modifica AuraFlow.'
      : '¿Confirmas que este agente está presente, disponible y autorizado para contactar al cliente REAL? Esta acción asigna el lead en FLC Academy, pero NO en AuraFlow.';
    if(!window.confirm(confirmation))return;
    setRealAssignBusy(true);setRealAssignResult('');
    const args=appointmentOverride
      ? {p_lead_id:selected.lead_id,p_agent_id:realAgentId,p_reason:appointmentReason.trim()}
      : {p_lead_id:selected.lead_id,p_agent_id:realAgentId};
    const {data,error:err}=await window.flcSupabase.rpc(
      appointmentOverride?'flc_distribution_assign_prebooked_appointment':'flc_distribution_assign_real_lead_manual',args);
    setRealAssignBusy(false);
    if(err){setRealAssignResult('No se asignó: '+err.message);return;}
    setRealAssignResult('Contacto asignado en FLC Academy a '+(data?.agent_name||'agente'));
    setSelected(null);await refreshAll();
  };
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
  const followUpNow=Date.now();
  const overdueFollowUps=followUps.filter(f=>new Date(f.due_at).getTime()<followUpNow).length;
  const completeFollowUp=async f=>{
    if(completeBusyId||isAdmin)return;
    if(!window.confirm('¿Ya realizaste este seguimiento o cita? Se conservará el historial original.'))return;
    const note=window.prompt('Nota de cierre (opcional):','');
    if(note===null)return;
    setCompletionFeedback('');setCompleteBusyId(f.event_id);
    const {error:err}=await window.flcSupabase.rpc('flc_distribution_complete_follow_up',{
      p_lead_id:f.lead_id,p_event_id:f.event_id,p_note:note.trim()||null
    });
    setCompleteBusyId(null);
    if(err){setCompletionFeedback('No se pudo completar: '+err.message);return;}
    setCompletionFeedback('Seguimiento completado y guardado en el historial.');
    await loadFollowUps();
    if(selected?.lead_id===f.lead_id){
      const {data}=await window.flcSupabase.rpc('flc_distribution_lead_timeline',{
        p_lead_id:f.lead_id,p_limit:100
      });
      if(data)setEvents(data);
    }
  };
  const openFollowUp=f=>{
    const lead=leads.find(l=>l.lead_id===f.lead_id);
    if(lead)setSelected(lead);
  };
  const waitingCount=pendingQueue.filter(l=>l.decision==='hold_no_available_agent').length;
  const readyCount=pendingQueue.filter(l=>l.decision==='ready_for_manual_review').length;
  return <div className="flc-leads-center">
    <div className="breadcrumb">FLC Academy / <span>Lead Distribution Center</span></div>
    <h1 className="page-title">Lead <em>Distribution Center</em></h1>
    <p className="page-sub">Vista de recepción de campañas. Las asignaciones automáticas dependen de la configuración del servidor, los agentes autorizados y sus reglas de campaña y estado.</p>
    <div className="flc-leads-summary">
      <div className="card"><span>Leads visibles</span><strong>{leads.length}</strong></div>
      <div className="card"><span>Asignados</span><strong>{leads.filter(l=>l.assigned_agent_id).length}</strong></div>
      <div className="card"><span>Pendientes de asignar</span><strong>{leads.filter(l=>!l.assigned_agent_id).length}</strong></div>
    </div>
    {!isAdmin&&<div className="card" style={{marginBottom:20}}>
      <h2 style={{fontSize:22,marginBottom:8}}>Mis seguimientos y citas pendientes</h2>
      <p style={{color:'#677466',marginBottom:12}}>Agenda registrada manualmente. No genera llamadas ni recordatorios externos.</p>
      {followUpsBusy?<p role="status">Cargando seguimientos…</p>:
        followUpsError?<p role="alert">{followUpsError}</p>:<>
          <p><strong>{followUps.length}</strong> seguimientos y citas registrados · <strong>{overdueFollowUps}</strong> vencidos</p>
          <div style={{overflowX:'auto'}}><table className="flc-leads-table">
            <thead><tr><th>Cliente</th><th>Gestión</th><th>Fecha programada (ET)</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>{followUps.map(f=>{
              const overdue=new Date(f.due_at).getTime()<followUpNow;
              return <tr key={f.event_id}>
                <td><strong>{f.contact_name||'Sin nombre'}</strong><small>{f.note||''}</small></td>
                <td>{f.activity_type==='agent_appointment_logged'?'Cita':'Seguimiento'}</td>
                <td>{date(f.due_at)}</td>
                <td>{overdue?'Vencido':'Próximo'}</td>
                <td>
                  <button type="button" className="btn-secondary" onClick={()=>openFollowUp(f)}>Abrir lead</button>
                  {' '}
                  <button type="button" className="btn-green" disabled={!!completeBusyId}
                    onClick={()=>completeFollowUp(f)}>
                    {completeBusyId===f.event_id?'Guardando…':'Marcar completado'}
                  </button>
                </td>
              </tr>;
            })}</tbody>
          </table></div>
          {followUps.length===0&&<p>No hay seguimientos pendientes en tus leads asignados.</p>}
          {completionFeedback&&<p role="status">{completionFeedback}</p>}
          <button type="button" className="btn-secondary" style={{marginTop:12}}
            onClick={()=>setShowCompletedFollowUps(v=>!v)}>
            {showCompletedFollowUps?'Ocultar historial':'Ver historial de completados'} ({completedFollowUps.length})
          </button>
          {showCompletedFollowUps&&<div style={{overflowX:'auto',marginTop:12}}>
            <table className="flc-leads-table">
              <thead><tr><th>Cliente</th><th>Fecha prevista (ET)</th><th>Completado (ET)</th><th>Nota</th></tr></thead>
              <tbody>{completedFollowUps.map(f=><tr key={f.event_id}>
                <td>{f.contact_name||'Sin nombre'}</td>
                <td>{date(f.due_at)}</td>
                <td>{date(f.completed_at)}</td>
                <td>{f.completion_note||'—'}</td>
              </tr>)}</tbody>
            </table>
            {!completedFollowUps.length&&<p>Todavía no hay seguimientos completados.</p>}
          </div>}
        </>}
    </div>}
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
        {realPending&&<div style={{padding:'14px 0',borderTop:'1px solid #dce8d7'}}>
          <h3>Asignar lead real manualmente</h3>
          <p style={{color:'#92550c'}}>Solo Administración. Se exige autorización de campaña y estado. La asignación ordinaria también requiere disponibilidad activa. No modifica AuraFlow.</p>
          <label style={{display:'flex',alignItems:'center',gap:9,margin:'12px 0'}}>
            <input type="checkbox" checked={appointmentOverride} onChange={e=>{setAppointmentOverride(e.target.checked);setRealAgentId('');setRealAssignResult('');}} />
            <strong>Cita previamente agendada en AuraFlow (permitir agente inactivo)</strong>
          </label>
          <select aria-label="Agente para lead real" value={realAgentId}
            onChange={e=>setRealAgentId(e.target.value)}>
            <option value="">Seleccionar agente autorizado</option>
            {realAgents.filter(a=>appointmentOverride||a.verified_on_zoom).map(a=><option value={a.agent_id} key={a.agent_id}>{a.agent_name}{a.verified_on_zoom?' · Activo':' · Inactivo'}</option>)}
          </select>
          {appointmentOverride&&<div style={{margin:'12px 0'}}>
            <p style={{fontSize:12,color:'#92550c'}}>Solo asigna este contacto; no activa al agente ni omite los permisos de campaña o estado. Confirma la licencia vigente y la cita registrada en AuraFlow.</p>
            <label htmlFor="flc-appointment-reason" style={{display:'block',fontWeight:600,marginBottom:5}}>Referencia o motivo de la cita (obligatorio)</label>
            <input id="flc-appointment-reason" type="text" value={appointmentReason}
              placeholder="Ej. Cita agendada en AuraFlow, fecha y referencia"
              onChange={e=>setAppointmentReason(e.target.value)} maxLength={500}
              style={{width:'100%',padding:10,border:'1px solid #dce8d7',borderRadius:7}} />
          </div>}
          <button type="button" className="btn-green"
            disabled={!realAgentId||realAssignBusy||(appointmentOverride&&appointmentReason.trim().length<10)}
            onClick={assignRealManually}>{realAssignBusy?'Asignando…':appointmentOverride?'Confirmar asignación de cita':'Confirmar asignación real'}</button>
          {realAgents.filter(a=>appointmentOverride||a.verified_on_zoom).length===0&&
            <p role="status">Sin agentes que cumplan los requisitos seleccionados. Este contacto permanece en cola.</p>}
          {realAssignResult&&<p role="status">{realAssignResult}</p>}
        </div>}
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

        {canLogActivity&&<div style={{borderTop:'1px solid #dce8d7',marginTop:16,paddingTop:16}}>
          <h3>Venta del cliente</h3>
          <p style={{fontSize:13,color:'#677466'}}>Registra compañía, producto, AP, estatus y split en FLC Production Center. No creará la venta hasta que confirmes el formulario.</p>
          <button type="button" className="btn-green" onClick={openSaleForm}>Reportar venta</button>
          {selected.external_lead_id?.startsWith('FLC-PRUEBA-')&&
            <p style={{fontSize:12,color:'#92550c'}}>Este contacto es ficticio: no envíes una venta de prueba a la producción oficial.</p>}
        </div>}
        {canLogActivity&&<div style={{borderTop:'1px solid #dce8d7',marginTop:16,paddingTop:16}}>
          <h3>Registrar gestión</h3>
          <p style={{fontSize:13,color:'#677466'}}>Registra la gestión manualmente después de llamar con Aloware o tu teléfono. Por ahora, solo queda guardada en FLC Academy.</p>
          <div style={{display:'grid',gap:10,margin:'12px 0'}}>
            <label>Tipo de gestión
              <select value={activityKind} onChange={e=>{setActivityKind(e.target.value);setRecentlySubmitted(false);}} style={{display:'block',width:'100%'}}>
                <option value="call">Llamada</option>
                <option value="note">Nota</option>
                <option value="follow_up">Seguimiento</option>
                <option value="appointment">Cita</option>
              </select>
            </label>
            {activityKind==='call'&&<label>Resultado de llamada
              <select value={activityResult} onChange={e=>{setActivityResult(e.target.value);setRecentlySubmitted(false);}} style={{display:'block',width:'100%'}}>
                <option value="no_answer">No contestó</option>
                <option value="voicemail">Buzón de voz</option>
                <option value="interested">Interesado</option>
                <option value="not_interested">No interesado</option>
                <option value="callback">Volver a llamar</option>
                <option value="appointment">Cita programada</option>
                <option value="wrong_number">Número equivocado</option>
                <option value="other">Otro</option>
              </select>
            </label>}
            {(activityKind==='follow_up'||activityKind==='appointment')&&<label>Fecha y hora de próxima gestión
              <input type="datetime-local" value={activityFollowUp} onChange={e=>{setActivityFollowUp(e.target.value);setRecentlySubmitted(false);}} style={{display:'block',width:'100%'}}/>
            </label>}
            <label>Notas de la gestión
              <textarea value={activityNote} maxLength={2000} rows={3} onChange={e=>{setActivityNote(e.target.value);setRecentlySubmitted(false);}}
                placeholder="Información del contacto y próximos pasos" style={{display:'block',width:'100%'}}/>
            </label>
          </div>
          <button type="button" className="btn-green" disabled={activityBusy||recentlySubmitted} onClick={saveActivity}>
            {activityBusy?'Guardando…':'Guardar gestión'}
          </button>
          {activityFeedback&&<p role="status" style={{marginTop:10}}>{activityFeedback}</p>}
        </div>}
        <h3>Historial</h3>
        {eventsLoading?<p>Cargando…</p>:events.length===0?<p>No hay eventos registrados todavía.</p>:
          events.map(e=>{
            const voided=events.some(v=>v.event_type==='agent_activity_voided'&&v.details?.voided_event_id===e.event_id);
            const manual=['agent_call_logged','agent_note_logged','agent_follow_up_logged','agent_appointment_logged'].includes(e.event_type);
            const mine=manual&&canLogActivity&&!voided&&e.actor_name===user.name;
            return <p key={e.event_id}>
              <strong>{e.event_type==='agent_activity_voided'?'Anulación registrada · '+(e.details?.reason||''):
                describeEvent(e)}</strong>
              {voided&&<span> · ANULADA</span>} · {date(e.event_at)} · {e.actor_name}
              {mine&&<button type="button" className="btn-secondary" style={{marginLeft:8}}
                disabled={voidBusy} onClick={()=>voidManualActivity(e)}>Anular</button>}
            </p>;
          })}
      </section>
    </div>}
  </div>;
}
window.LeadDistributionCenter=LeadDistributionCenter;
