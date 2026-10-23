function TeamPanel({setPage,user}) {
 const [rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(true),[error,setError]=React.useState('');
 const load=async()=>{setBusy(true);setError('');const {data,error}=await window.flcSupabase.rpc('flc_my_team_report');if(error)setError('No se pudo cargar el equipo. Revisa la configuración de permisos.');else setRows(data||[]);setBusy(false);};
 React.useEffect(()=>{load();},[user.id]);
 const cell={padding:'10px',borderBottom:'1px solid #e4e8e1',textAlign:'left'};
 const date=v=>v?new Date(v).toLocaleDateString('es-US'):'—';
 return <div style={{padding:28}}><button onClick={()=>setPage('dashboard')}>← Inicio</button>
 <h1>Mi equipo</h1><p>Solo aparecen tus agentes directos y los agentes de tus sublíderes. No tienes acceso a invitaciones.</p>
 <button onClick={load}>Actualizar</button>
 {busy?<p>Cargando…</p>:error?<p role="alert" style={{color:'#a33'}}>{error}</p>:
 <React.Fragment><p><strong>{rows.length}</strong> integrantes de tu estructura</p>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',background:'white'}}>
 <thead><tr>{['Agente','Nivel','Módulos','Tutoriales','Intentos','Mejor nota','Examen','Certificado','Último acceso'].map(k=><th key={k} style={cell}>{k}</th>)}</tr></thead>
 <tbody>{rows.map(r=><tr key={r.agent_id}><td style={cell}>{r.full_name}</td><td style={cell}>{r.depth===1?'Directo':'Nivel '+r.depth}</td><td style={cell}>{r.module_percent}%</td><td style={cell}>{r.tutorial_count}/27</td><td style={cell}>{r.quiz_attempts}/3</td><td style={cell}>{r.best_score==null?'—':r.best_score+'%'}</td><td style={cell}>{r.passed?'Aprobado':'Pendiente'}</td><td style={cell}>{r.certificate_code||'—'}</td><td style={cell}>{date(r.last_login)}</td></tr>)}</tbody>
 </table></div>{!rows.length&&<p>Aún no hay agentes asignados a tu estructura.</p>}</React.Fragment>}
 </div>;
}
window.TeamPanel=TeamPanel;