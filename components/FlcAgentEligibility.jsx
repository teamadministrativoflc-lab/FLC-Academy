// Admin-only campaign/state eligibility editor. Changes eligibility only,
// and never automatically distributes a lead or modifies existing CRM contacts.
function FlcAgentEligibility({agents}) {
  const [selectedId,setSelectedId]=React.useState('');
  const [campaigns,setCampaigns]=React.useState([]);
  const [campaignLinks,setCampaignLinks]=React.useState([]);
  const [statesLinks,setStatesLinks]=React.useState([]);
  const [checkedCampaigns,setCheckedCampaigns]=React.useState([]);
  const [checkedStates,setCheckedStates]=React.useState([]);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [simCampaign,setSimCampaign]=React.useState('IUL_TIKTOK_ESPANOL');
  const [simState,setSimState]=React.useState('NY');
  const [simLoading,setSimLoading]=React.useState(false);
  const [simResults,setSimResults]=React.useState(null);
  const [simError,setSimError]=React.useState('');
  const allStates='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  const reload=React.useCallback(async()=>{
    setLoading(true);setError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_get_agent_rules');
    if(err)setError('No se pudieron cargar las reglas de campañas y estados: '+err.message);
    else{
      setCampaigns(data?.campaigns||[]);
      setCampaignLinks(data?.agent_campaigns||[]);
      setStatesLinks(data?.agent_states||[]);
    }
    setLoading(false);
  },[]);
  React.useEffect(()=>{reload();},[reload]);
  React.useEffect(()=>{
    setCheckedCampaigns(campaignLinks.filter(x=>x.agent_id===selectedId).map(x=>x.campaign_code));
    setCheckedStates(statesLinks.filter(x=>x.agent_id===selectedId).map(x=>x.state_code));
    setNotice('');
  },[selectedId,campaignLinks,statesLinks]);
  const toggle=(value,current,update)=>{
    update(current.includes(value)?current.filter(x=>x!==value):[...current,value]);
    setNotice('');
  };
  const save=async()=>{
    if(!selectedId||saving)return;
    if(!window.confirm('¿Guardar campañas y estados autorizados para este agente? Confirma sus licencias vigentes antes de habilitar estados.'))return;
    setSaving(true);setError('');setNotice('');
    const {error:err}=await window.flcSupabase.rpc('flc_distribution_set_agent_rules',{
      p_agent_id:selectedId,p_campaigns:checkedCampaigns,p_states:checkedStates
    });
    if(err)setError('No se pudieron guardar las reglas: '+err.message);
    else{setNotice('Reglas guardadas. La distribución automática continúa desactivada.');await reload();}
    setSaving(false);
  };
  const simulate=async()=>{
    setSimLoading(true);setSimError('');setSimResults(null);
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_simulate_eligibility',{
      p_campaign_code:simCampaign,p_state_code:simState
    });
    if(err)setSimError('No se pudo ejecutar la simulación: '+err.message);
    else setSimResults(data||[]);
    setSimLoading(false);
  };
  return <div style={{marginTop:20}}><FlcDailyLeadQuotas agents={agents} campaigns={campaigns}/><div className="card">
    <h2 style={{fontSize:23,marginBottom:8}}>Campañas y estados por agente</h2>
    <p style={{color:'#69776b',marginBottom:15}}>Selecciona campañas y estados donde el agente está autorizado. Estas selecciones NO activan la distribución.</p>
    {loading?<p>Cargando configuración…</p>:<>
      <label htmlFor="flc-rule-agent" style={{fontWeight:700}}>Seleccionar agente</label>
      <select id="flc-rule-agent" value={selectedId} onChange={e=>setSelectedId(e.target.value)}
        style={{display:'block',padding:12,maxWidth:520,width:'100%',margin:'8px 0 18px',borderRadius:8,border:'1px solid #becfbe'}}>
        <option value="">Selecciona un agente</option>
        {agents.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}
      </select>
      {selectedId&&<>
        <h3 style={{fontSize:18,marginBottom:8}}>Campañas</h3>
        <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:22}}>
          {campaigns.filter(c=>c.enabled).map(c=><label key={c.code} style={{display:'flex',gap:8,alignItems:'center',padding:11,border:'1px solid #dce8d7',borderRadius:8,cursor:'pointer'}}>
            <input type="checkbox" checked={checkedCampaigns.includes(c.code)}
              onChange={()=>toggle(c.code,checkedCampaigns,setCheckedCampaigns)}/>
            {c.label}
          </label>)}
        </div>
        <h3 style={{fontSize:18,marginBottom:8}}>Estados autorizados</h3>
        <p style={{fontSize:13,color:'#747d74'}}>Solo marca estados donde hayas verificado que el agente puede vender legalmente el producto.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(73px,1fr))',gap:8,margin:'14px 0 22px'}}>
          {allStates.map(code=><label key={code} style={{display:'flex',gap:8,alignItems:'center',border:'1px solid #dce8d7',borderRadius:6,padding:8}}>
            <input type="checkbox" checked={checkedStates.includes(code)}
              onChange={()=>toggle(code,checkedStates,setCheckedStates)}/>{code}
          </label>)}
        </div>
        <button className="btn-green" type="button" onClick={save} disabled={saving}>
          {saving?'Guardando…':'Guardar campañas y estados'}
        </button>
      </>}
      {notice&&<p role="status" style={{color:'#246d34',marginTop:12}}>{notice}</p>}
    </>}
    {error&&<p role="alert" style={{color:'#ab3030',marginTop:12}}>{error}</p>}
    <section style={{marginTop:26,paddingTop:20,borderTop:'1px solid #dce8d7'}}>
      <h2 style={{fontSize:23,marginBottom:8}}>Simulador de elegibilidad (solo lectura)</h2>
      <p style={{color:'#69776b'}}>Comprueba qué agentes cumplen campaña, estado y verificación manual. No crea asignaciones ni modifica disponibilidad.</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',margin:'18px 0'}}>
        <label style={{display:'grid',gap:6}}>Campaña
          <select value={simCampaign} onChange={e=>{setSimCampaign(e.target.value);setSimResults(null);}}
            style={{padding:10,borderRadius:8,border:'1px solid #c8d5c4'}}>
            {campaigns.filter(c=>c.enabled).map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
        <label style={{display:'grid',gap:6}}>Estado
          <select value={simState} onChange={e=>{setSimState(e.target.value);setSimResults(null);}}
            style={{padding:10,borderRadius:8,border:'1px solid #c8d5c4'}}>
            {allStates.map(code=><option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <button type="button" className="btn-green" onClick={simulate} disabled={simLoading||!simCampaign}>
          {simLoading?'Simulando…':'Simular distribución'}
        </button>
      </div>
      {simError&&<p role="alert" style={{color:'#b33'}}>{simError}</p>}
      {simResults&&<div style={{overflowX:'auto'}}>
        <p><strong>{simResults.filter(x=>x.eligible).length}</strong> agentes elegibles de {simResults.length} evaluados.</p>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>
          <th style={{textAlign:'left',padding:9}}>Agente</th><th>Campaña</th><th>Estado</th><th>Zoom</th><th>Elegible</th>
        </tr></thead><tbody>{simResults.map(x=><tr key={x.agent_id} style={{borderTop:'1px solid #dce8d7'}}>
          <td style={{padding:9}}>{x.agent_name}</td>
          <td style={{textAlign:'center'}}>{x.campaign_allowed?'✅':'—'}</td>
          <td style={{textAlign:'center'}}>{x.state_allowed?'✅':'—'}</td>
          <td style={{textAlign:'center'}}>{x.verified_on_zoom?'✅':'—'}</td>
          <td style={{textAlign:'center'}}>{x.eligible?'✅':'No'}</td>
        </tr>)}</tbody></table>
      </div>}
    </section>
  </div></div>;
}
window.FlcAgentEligibility=FlcAgentEligibility;
