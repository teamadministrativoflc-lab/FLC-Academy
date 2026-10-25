function RankCenter({setPage}) {
 const [month,setMonth]=React.useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).format(new Date()));
 const [rows,setRows]=React.useState([]);
 const [loading,setLoading]=React.useState(false);
 const [error,setError]=React.useState('');
 const names={SM:'Sales Manager',SSM:'Senior Sales Manager',VP:'Vice President',SVP:'Senior Vice President',EVP:'Executive Vice President',BM:'Board Member',SBM:'Senior Board Member',EBM:'Executive Board Member',CM:'Council Member',SCM:'Senior Council Member',ECM:'Executive Council Member',CCM:'Chairman Council Member',SP:'Senior Partner',EP:'Executive Partner',MP:'Managing Partner'};
 const sequence=['SM','SSM','VP','SVP','EVP','BM','SBM','EBM','CM','SCM','ECM','CCM','SP','EP','MP'];
 const fmt=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
 const rank=code=>code?code+' · '+(names[code]||code):'Sin título';
 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await window.flcSupabase.rpc('flc_rank_preview',{p_month:month+'-01'});
  if(error){setRows([]);setError('No se pudo calcular. Comprueba que SQL 023 esté activado en Supabase. Detalle: '+error.message);}
  else setRows(data||[]);
  setLoading(false);
 };
 React.useEffect(()=>{load();},[month]);
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
  <p>Vista de cálculo en Preview. Esta pantalla <strong>no asigna ascensos ni aplica descensos</strong>. Solo compara la producción Issue Paid verificada del período con las reglas de títulos.</p>
  <section style={{background:'#fff',border:'1px solid #dce5d8',borderRadius:12,padding:16,margin:'16px 0'}}>
   <label>Mes a evaluar <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{padding:10,marginLeft:12,borderRadius:8,border:'1px solid #b5c7b9'}}/></label>
   <button type="button" onClick={load} disabled={loading} style={{marginLeft:12,padding:10,borderRadius:8,background:'#176b3b',color:'#fff',border:0}}>{loading?'Calculando…':'↻ Recalcular vista'}</button>
   <p style={{fontSize:13,color:'#58685d'}}>1 familia = $1,000 AP. Se incluye la producción personal y se descuenta solamente la estructura directa más grande para calcular el volumen fuera de la top leg.</p>
  </section>
  {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}
  <div style={{overflowX:'auto',background:'#fff',border:'1px solid #dce5d8',borderRadius:12,padding:12}}>
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr>{['Líder','Título vigente','Califica en el mes','AP verificada de equipo','AP personal','Top leg','Fuera de top leg','Evaluación'].map(x=><th key={x} style={{padding:12,textAlign:'left',borderBottom:'2px solid #dce5d8'}}>{x}</th>)}</tr></thead>
    <tbody>{rows.map(r=><tr key={r.agent_id}>
     <td style={{padding:12,borderBottom:'1px solid #eee',fontWeight:700}}>{r.full_name}</td>
     <td style={{padding:12,borderBottom:'1px solid #eee'}}>{rank(r.current_rank)}</td>
     <td style={{padding:12,borderBottom:'1px solid #eee'}}>{rank(r.candidate_rank)}</td>
     {[r.team_verified_ap,r.personal_verified_ap,r.top_leg_verified_ap,r.outside_top_leg_ap].map((n,i)=><td key={i} style={{padding:12,borderBottom:'1px solid #eee',whiteSpace:'nowrap'}}>{fmt(n)}</td>)}
     <td style={{padding:12,borderBottom:'1px solid #eee',color:effect(r).color,fontWeight:700}}>{effect(r).label}</td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&!loading&&!error&&<p>No hay líderes para mostrar.</p>}
  </div>
  <p style={{fontSize:12,color:'#58685d',marginTop:14}}>Los ascensos automáticos, la aprobación de descensos y el historial de cambios se habilitarán después de verificar este cálculo. No se alteran rangos al presionar «Recalcular vista».</p>
 </main>;
}
window.RankCenter=RankCenter;
