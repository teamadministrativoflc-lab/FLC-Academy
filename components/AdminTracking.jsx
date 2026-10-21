function AdminTracking({setPage}) {
 const [rows,setRows]=React.useState([]),[loading,setLoading]=React.useState(true),[error,setError]=React.useState('');
 const load=async()=>{
  setLoading(true);setError('');
  const [p,l,m]=await Promise.all([
   window.flcSupabase.from('agent_profiles').select('id,full_name,role'),
   window.flcSupabase.from('login_activity').select('agent_id,logged_in_at').order('logged_in_at',{ascending:false}),
   window.flcSupabase.from('module_progress').select('agent_id,module_id,progress_percent')
  ]);
  if(p.error||l.error||m.error){setError('No se pudieron cargar los registros. Verifica los permisos RLS.');setLoading(false);return;}
  const last={};for(const a of l.data){if(!last[a.agent_id])last[a.agent_id]=a.logged_in_at;}
  const prog={};for(const a of m.data){(prog[a.agent_id]??={})[a.module_id]=a.progress_percent;}
  setRows(p.data.map(a=>({...a,last:last[a.id],modules:prog[a.id]||{}})).sort((a,b)=>a.full_name.localeCompare(b.full_name)));
  setLoading(false);
 };
 React.useEffect(()=>{load();},[]);
 const date=v=>v?new Date(v).toLocaleString('es-US',{dateStyle:'short',timeStyle:'short'}):'Sin acceso registrado';
 return <div style={{padding:28}}>
  <button onClick={()=>setPage('dashboard')} style={{marginBottom:14}}>← Volver a Inicio</button>
  <h1>Seguimiento de agentes</h1>
  <p>Datos registrados en Supabase. Los porcentajes representan avance declarado, no visualización verificada de todas las páginas o videos.</p>
  <button onClick={load} disabled={loading}>Actualizar registros</button>
  {loading&&<p>Cargando datos…</p>}{error&&<p role="alert" style={{color:'#a33'}}>{error}</p>}
  {!loading&&!error&&<div style={{overflowX:'auto',marginTop:20}}><table style={{borderCollapse:'collapse',width:'100%',background:'white'}}>
   <thead><tr>{['Agente','Rol','Último ingreso','Módulo 1','Módulo 2','Módulo 3'].map(x=><th key={x} style={{textAlign:'left',padding:10,borderBottom:'1px solid #ddd'}}>{x}</th>)}</tr></thead>
   <tbody>{rows.map(a=><tr key={a.id}><td style={{padding:10,borderBottom:'1px solid #eee'}}>{a.full_name}</td><td>{a.role}</td><td>{date(a.last)}</td>{['m1','m2','m3'].map(id=><td key={id}>{a.modules[id]??0}%</td>)}</tr>)}</tbody>
  </table>{rows.length===0&&<p>Todavía no hay agentes registrados.</p>}</div>}
  <p style={{fontSize:12,color:'#59655b',marginTop:20}}>Los registros anteriores al nuevo sistema no se recuperan automáticamente.</p>
 </div>;
}
window.AdminTracking=AdminTracking;