// Agent-controlled readiness request. Administrative Zoom verification remains separate.
// The real distribution engine is NOT connected to this preference yet.
function FlcMyAvailability({user}){
  const [state,setState]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState('');
  const load=React.useCallback(async()=>{
    setLoading(true);setError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_my_self_presence');
    if(err)setError('Disponibilidad personal aún no instalada: '+err.message);
    else setState(data);
    setLoading(false);
  },[]);
  React.useEffect(()=>{if(user?.id&&user?.role!=='admin')load();},[load,user?.id,user?.role]);
  const change=async(next)=>{
    if(saving)return;
    if(next&&!window.confirm('¿Estás disponible para trabajar leads? Esta solicitud no reemplaza la verificación de Administración ni de Zoom.'))return;
    setSaving(true);setError('');
    const {data,error:err}=await window.flcSupabase.rpc('flc_distribution_set_my_self_presence',{p_wants_leads:next});
    if(err)setError('No se pudo guardar: '+err.message);
    else setState(data);
    setSaving(false);
  };
  if(!user?.id||user.role==='admin')return null;
  return <section className="card flc-leads-presence" aria-label="Mi disponibilidad para recibir leads">
    <div>
      <h2 style={{fontSize:22,margin:0}}>Mi disponibilidad para recibir leads</h2>
      {loading?<p>Consultando disponibilidad…</p>:<>
        <p><strong>{state?.wants_leads?'🟢 Disponible (solicitud registrada)':'⚪ No disponible'}</strong></p>
        <p>Verificación administrativa de Zoom: {state?.admin_verified?'Confirmada':'Pendiente'}</p>
        <p style={{color:'#99600c'}}>La solicitud se guarda, pero todavía no controla la distribución automática. La activación requiere integrar esta preferencia con el motor y validar Zoom.</p>
      </>}
    </div>
    <button type="button" className={state?.wants_leads?'btn-secondary':'btn-green'}
      disabled={loading||saving||!!error&&!state}
      onClick={()=>change(!state?.wants_leads)}>
      {saving?'Guardando…':state?.wants_leads?'Pausar':'Estoy disponible'}
    </button>
    {error&&<p role="alert" className="flc-leads-error">{error}</p>}
  </section>;
}
window.FlcMyAvailability=FlcMyAvailability;
