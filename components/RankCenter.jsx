function RankCenter({setPage}) {
 const [month,setMonth]=React.useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(new Date()));
 const [rows,setRows]=React.useState([]);
 const [loading,setLoading]=React.useState(false);
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const [actionBusy,setActionBusy]=React.useState(false);
 const [history,setHistory]=React.useState([]);
 const currentMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(new Date());
 const isClosed=month<currentMonth;
 const names={SM:'Sales Manager',SSM:'Senior Sales Manager',VP:'Vice President',SVP:'Senior Vice President',EVP:'Executive Vice President',BM:'Board Member',SBM:'Senior Board Member',EBM:'Executive Board Member',CM:'Council Member',SCM:'Senior Council Member',ECM:'Executive Council Member',CCM:'Chairman Council Member',SP:'Senior Partner',EP:'Executive Partner',MP:'Managing Partner'};
 const sequence=['SM','SSM','VP','SVP','EVP','BM','SBM','EBM','CM','SCM','ECM','CCM','SP','EP','MP'];
 const fmt=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
 const rank=code=>code?code+' · '+(names[code]||code):'Sin título';
 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await window.flcSupabase.rpc('flc_rank_preview',{p_month:month+'-01'});
  if(error){setRows([]);setError('No se pudo calcular. Comprueba que SQL 023 esté activado en Supabase. Detalle: '+error.message);}
  else setRows(data||[]);
  const hist=await window.flcSupabase.from('flc_rank_history')
   .select('id,agent_id,previous_rank,new_rank,change_type,evaluation_month,occurred_at,changed_by')
   .order('occurred_at',{ascending:false}).limit(80);
  if(!hist.error)setHistory(hist.data||[]);
  setLoading(false);
 };
 React.useEffect(()=>{load();},[month]);
 const syncPromotions=async()=>{
  if(actionBusy)return;
  if(!window.confirm('¿Sincronizar ascensos elegibles en '+month+'? Solo permite SUBIR rangos; nunca descender.'))return;
  setActionBusy(true);setError('');setNotice('');
  const {data,error}=await window.flcSupabase.rpc('flc_apply_rank_promotions',{p_month:month+'-01'});
  if(error)setError('No se pudieron sincronizar los ascensos: '+error.message);
  else{setNotice((data||0)+' ascenso(s) aplicados.');await load();}
  setActionBusy(false);
 };
 const review=async(agentId)=>{
  if(actionBusy||!isClosed)return;
  const chosen=rows.filter(r=>(!agentId||r.agent_id===agentId)&&r.current_rank);
  const downgrades=chosen.filter(r=>sequence.indexOf(r.candidate_rank)<sequence.indexOf(r.current_rank));
  const detail=downgrades.map(r=>r.full_name+': '+rank(r.current_rank)+' → '+rank(r.candidate_rank)).join('\n');
  const label=agentId?'este líder':'toda la agencia';
  if(!window.confirm('REVISIÓN DE MES CERRADO '+month+' para '+label+'.\n'+
    'Posibles descensos: '+downgrades.length+'\n'+detail+
    '\n\nEsta acción modifica rangos vigentes y deja historial. ¿CONFIRMAR?'))return;
  setActionBusy(true);setError('');setNotice('');
  const {data,error}=await window.flcSupabase.rpc('flc_rank_review_closed_month',{
   p_month:month+'-01',p_agent_id:agentId||null
  });
  if(error)setError('No se pudo confirmar la revisión: '+error.message);
  else{const result=Array.isArray(data)?data[0]:data;setNotice('Revisión completada: '+(result?.reviewed_count||0)+' revisado(s), '+(result?.descended_count||0)+' descenso(s).');await load();}
  setActionBusy(false);
 };
 const effect=r=>{
  const before=sequence.indexOf(r.current_rank),after=sequence.indexOf(r.candidate_rank);
  if(after>before)return {label:'Elegible para ascenso',color:'#0f7844'};
  if(before>=0&&after<before)return {label:'Revisar permanencia al cierre',color:'#a16718'};
  if(before>=0)return {label:'Cumple el rango actual',color:'#0f7844'};
  return {label:'Aún sin título',color:'#64736a'};
 };
 return <main style={{padding:28,maxWidth:1400,margin:'auto'}}>
  <button type="button" onClick={()=>setPage('dashboard')}>← Inicio</button>
  <h1>🏆 Administración de Rangos</h1>
  <p>Preview: los ascensos se asignan cuando Administración verifica Issue Paid. La revisión de descensos exige un mes cerrado y confirmación explícita; todos los cambios quedan auditados.</p>
  <section style={{background:'#fff',border:'1px solid #dce5d8',borderRadius:12,padding:16,margin:'16px 0'}}>
   <label>Mes a evaluar <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{padding:10,marginLeft:12,borderRadius:8,border:'1px solid #b5c7b9'}}/></label>
   <button type="button" onClick={load} disabled={loading} style={{marginLeft:12,padding:10,borderRadius:8,background:'#176b3b',color:'#fff',border:0}}>{loading?'Calculando…':'↻ Recalcular vista'}</button>
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
    <button type="button" onClick={syncPromotions} disabled={actionBusy||loading} style={{padding:10,borderRadius:8,background:'#1b784c',color:'#fff',border:0}}>🏆 Sincronizar ascensos</button>
    <button type="button" onClick={()=>review(null)} disabled={!isClosed||actionBusy||loading} style={{padding:10,borderRadius:8,background:isClosed?'#8a5b17':'#e0e4df',color:isClosed?'#fff':'#778078',border:0}}>Confirmar revisión de toda la agencia</button>
   </div>
   {!isClosed&&<p style={{fontSize:12,color:'#9b661c'}}>El mes seleccionado sigue abierto: no se permiten descensos.</p>}
   <p style={{fontSize:13,color:'#58685d'}}>1 familia = $1,000 AP. Se incluye la producción personal y se descuenta solamente la estructura directa más grande para calcular el volumen fuera de la top leg.</p>
  </section>
  {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}
  {notice&&<p role="status" style={{color:'#176b3b'}}>{notice}</p>}
  <div style={{overflowX:'auto',background:'#fff',border:'1px solid #dce5d8',borderRadius:12,padding:12}}>
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr>{['Líder','Título vigente','Califica en el mes','AP verificada de equipo','AP personal','Top leg','Fuera de top leg','Evaluación','Revisión individual'].map(x=><th key={x} style={{padding:12,textAlign:'left',borderBottom:'2px solid #dce5d8'}}>{x}</th>)}</tr></thead>
    <tbody>{rows.map(r=><tr key={r.agent_id}>
     <td style={{padding:12,borderBottom:'1px solid #eee',fontWeight:700}}>{r.full_name}</td>
     <td style={{padding:12,borderBottom:'1px solid #eee'}}>{rank(r.current_rank)}</td>
     <td style={{padding:12,borderBottom:'1px solid #eee'}}>{rank(r.candidate_rank)}</td>
     {[r.team_verified_ap,r.personal_verified_ap,r.top_leg_verified_ap,r.outside_top_leg_ap].map((n,i)=><td key={i} style={{padding:12,borderBottom:'1px solid #eee',whiteSpace:'nowrap'}}>{fmt(n)}</td>)}
     <td style={{padding:12,borderBottom:'1px solid #eee',color:effect(r).color,fontWeight:700}}>{effect(r).label}</td>
     <td style={{padding:12,borderBottom:'1px solid #eee'}}><button type="button" disabled={!isClosed||actionBusy||!r.current_rank} onClick={()=>review(r.agent_id)}>Revisar</button></td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&!loading&&!error&&<p>No hay líderes para mostrar.</p>}
  </div>
  <h2 style={{marginTop:28}}>Historial de cambios de rango</h2>
  <div style={{background:'#fff',padding:16,borderRadius:10,border:'1px solid #dce5d8'}}>{history.length?history.map(h=><p key={h.id} style={{borderBottom:'1px solid #eee',paddingBottom:8}}>{new Date(h.occurred_at).toLocaleString('es-US',{timeZone:'America/New_York'})} · <strong>{rows.find(r=>r.agent_id===h.agent_id)?.full_name||'Agente'}</strong> · {rank(h.previous_rank)} → {rank(h.new_rank)} · {h.change_type} · mes {h.evaluation_month}</p>):<p>Aún no hay ascensos ni descensos registrados.</p>}</div>
  <p style={{fontSize:12,color:'#58685d'}}>«Recalcular vista» solo consulta datos. Las acciones de sincronización o confirmación sí modifican títulos: úsalas después de verificar la producción.</p>
 </main>;
}
window.RankCenter=RankCenter;
