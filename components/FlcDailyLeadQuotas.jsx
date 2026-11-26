// Administrative daily quota configuration. This is NOT the live enforcement engine.
function FlcDailyLeadQuotas({agents,campaigns}){
  const [agentId,setAgentId]=React.useState('');
  const [campaign,setCampaign]=React.useState('');
  const [limit,setLimit]=React.useState('10');
  const [rules,setRules]=React.useState([]);
  const [usage,setUsage]=React.useState([]);
  const [date,setDate]=React.useState('');
  const [error,setError]=React.useState('');
  const [info,setInfo]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const reload=React.useCallback(async()=>{
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_get_daily_quotas');
    if(err){setError('La configuración de cupos aún no está instalada: '+err.message);return;}
    setRules(data?.quotas||[]);setUsage(data?.used_today||[]);setDate(data?.quota_day||'');setError('');
  },[]);
  React.useEffect(()=>{reload();},[reload]);
  React.useEffect(()=>{
    const q=rules.find(x=>x.agent_id===agentId&&x.campaign_code===campaign);
    setLimit(String(q?.daily_limit??10));setInfo('');
  },[agentId,campaign,rules]);
  const save=async()=>{
    if(!agentId||!campaign||busy)return;
    const n=Number(limit);
    if(!Number.isInteger(n)||n<0||n>1000){setError('El cupo debe ser un entero de 0 a 1000.');return;}
    const a=agents.find(x=>x.id===agentId);
    if(!window.confirm('¿Guardar un máximo de '+n+' leads automáticos diarios para '+(a?.full_name||'el agente')+' en la campaña '+campaign+'?'))return;
    setBusy(true);setError('');setInfo('');
    const {error:err}=await window.flcSupabase.rpc('flc_distribution_set_daily_quota',
      {p_agent_id:agentId,p_campaign_code:campaign,p_daily_limit:n});
    if(err)setError('No se guardó el cupo: '+err.message);
    else{setInfo('Cupo guardado. La aplicación automática de límites queda pendiente de validación del motor.');await reload();}
    setBusy(false);
  };
  const used=usage.find(x=>x.agent_id===agentId&&x.campaign_code===campaign)?.count||0;
  return <section className="card" style={{marginBottom:20}}>
    <h2 style={{fontSize:23}}>Cupos diarios de leads automáticos</h2>
    <p style={{color:'#69776b'}}>Cupo predeterminado: <strong>10 por agente y por campaña</strong>. Día calendario de Nueva York. Las citas asignadas manualmente no consumen cupo automático.</p>
    <p style={{color:'#92550c'}}>Configuración preparada. Hasta instalar y validar el motor de cupos, estos valores NO limitan las asignaciones automáticas reales.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
      <label style={{display:'grid',gap:5}}>Agente
        <select value={agentId} onChange={e=>setAgentId(e.target.value)} style={{padding:10,borderRadius:7,maxWidth:270}}>
          <option value="">Seleccionar agente</option>
          {agents.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </label>
      <label style={{display:'grid',gap:5}}>Campaña
        <select value={campaign} onChange={e=>setCampaign(e.target.value)} style={{padding:10,borderRadius:7,maxWidth:270}}>
          <option value="">Seleccionar campaña</option>
          {campaigns.filter(x=>x.enabled).map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </label>
      <label style={{display:'grid',gap:5}}>Cupo diario
        <input type="number" min="0" max="1000" step="1" value={limit}
          onChange={e=>setLimit(e.target.value)} style={{padding:10,width:110,border:'1px solid #bdccbc',borderRadius:7}}/>
      </label>
      <button className="btn-green" disabled={!agentId||!campaign||busy} onClick={save}>
        {busy?'Guardando…':'Guardar cupo'}
      </button>
    </div>
    {agentId&&campaign&&<p style={{marginTop:12}}>Uso registrado hoy ({date||'—'}): <strong>{used}</strong> automáticos. Este contador no es fiable hasta activar el registro del motor.</p>}
    {info&&<p role="status" style={{color:'#24713a'}}>{info}</p>}
    {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}
  </section>;
}
window.FlcDailyLeadQuotas=FlcDailyLeadQuotas;
