function AdminTracking({setPage}) {
 const [rows,setRows]=React.useState([]),[loading,setLoading]=React.useState(true),[error,setError]=React.useState('');
 const [search,setSearch]=React.useState('');
 const [inviteName,setInviteName]=React.useState('');
 const [inviteEmail,setInviteEmail]=React.useState('');
 const [inviting,setInviting]=React.useState(false);
 const [inviteFeedback,setInviteFeedback]=React.useState('');
 const [inviteSuccess,setInviteSuccess]=React.useState(false);
 const [accessEmail,setAccessEmail]=React.useState('');
 const [accessBusy,setAccessBusy]=React.useState(false);
 const [accessMessage,setAccessMessage]=React.useState('');
 const invite=async(e)=>{
  e.preventDefault();
  if(inviting)return;
  setInviteFeedback('');setInviteSuccess(false);setInviting(true);
  try{
   const {data,error}=await window.flcSupabase.functions.invoke('flc-invite-agent',{
    body:{full_name:inviteName.trim(),email:inviteEmail.trim().toLowerCase()}
   });
   if(error||!data?.success)throw new Error(data?.error||'invite_failed');
   setInviteSuccess(true);
   setInviteFeedback('Invitación enviada. El agente recibirá un correo para activar su cuenta.');
   setInviteName('');setInviteEmail('');
   await load();
  }catch(err){
   setInviteSuccess(false);
   setInviteFeedback('No se pudo enviar la invitación. Comprueba que el correo sea nuevo y revisa los registros de la función en Supabase.');
   console.error('FLC invitation failed:',err);
  }finally{setInviting(false);}
 };
 const resendAccess=async(e)=>{
  e.preventDefault();
  if(accessBusy)return;
  setAccessBusy(true);setAccessMessage('');
  try{
   const target=accessEmail.trim().toLowerCase();
   const redirectTo=new URL('./auth-setup.html',window.location.href).href;
   const {error}=await window.flcSupabase.auth.resetPasswordForEmail(target,{redirectTo});
   if(error)throw error;
   setAccessMessage('Solicitud enviada. Si el correo corresponde a una cuenta existente, recibirá un enlace nuevo para establecer su contraseña. Revisa Spam.');
  }catch(err){
   setAccessMessage('No se pudo enviar el enlace. Comprueba la configuración de correo de Supabase o los límites de envío.');
   console.error('FLC access recovery failed',err);
  }finally{setAccessBusy(false);}
 };
 const moduleIds=['m1','m2','m3'];
 const tutorialCategories=window.TUTORIAL_CATEGORIES||[];
 const videoCatalog=tutorialCategories.flatMap(cat=>(cat.groups||[]).flatMap(group=>(group.videos||[]).map(v=>({
   id:v.id,title:v.title_es||v.title_en||v.id,company:group.company||'Otros'
 }))));
 const videoLookup=Object.fromEntries(videoCatalog.map(v=>[v.id,v]));
 const companyCatalog=Object.values(videoCatalog.reduce((map,v)=>{
   if(!map[v.company])map[v.company]={name:v.company,ids:[]};
   map[v.company].ids.push(v.id);
   return map;
 },{}));
 const tutorialTotal=videoCatalog.length;
 const tutorialSummary=agent=>{
   const ids=new Set((agent.tutorials||[]).map(v=>v.tutorial_id));
   return companyCatalog.map(group=>({
     name:group.name,done:group.ids.filter(id=>ids.has(id)).length,total:group.ids.length
   }));
 };
 const progressOf=a=>Math.round(moduleIds.reduce((sum,id)=>sum+Number(a.modules[id]??0),0)/moduleIds.length);
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const [p,l,m,q,c,tc]=await Promise.all([
    window.flcSupabase.from('agent_profiles').select('id,full_name,role'),
    window.flcSupabase.from('login_activity').select('agent_id,logged_in_at').order('logged_in_at',{ascending:false}),
    window.flcSupabase.from('module_progress').select('agent_id,module_id,progress_percent'),
    window.flcSupabase.from('quiz_attempts').select('agent_id,score_percent,passed,attempted_at'),
    window.flcSupabase.from('certificates').select('agent_id,certificate_code,issued_at'),
    window.flcSupabase.from('tutorial_completions').select('agent_id,tutorial_id,completed_at')
   ]);
   if(p.error||l.error||m.error||q.error||c.error||tc.error)throw new Error('read failed');
   const last={};for(const a of l.data||[]){if(!last[a.agent_id])last[a.agent_id]=a.logged_in_at;}
   const prog={};for(const a of m.data||[]){(prog[a.agent_id]??={})[a.module_id]=a.progress_percent;}
   const quizzes={};for(const a of q.data||[]){const v=quizzes[a.agent_id]??={attempts:0,best:0,passed:false};v.attempts++;v.best=Math.max(v.best,Number(a.score_percent));v.passed=v.passed||a.passed;}
   const tutorialRecords={};for(const x of tc.data||[]){(tutorialRecords[x.agent_id]??=[]).push(x);}
   const certs={};for(const a of c.data||[]){if(!certs[a.agent_id])certs[a.agent_id]=a;}
   setRows((p.data||[]).map(a=>({...a,last:last[a.id],modules:prog[a.id]||{},quiz:quizzes[a.id],certificate:certs[a.id],tutorials:tutorialRecords[a.id]||[]})).sort((a,b)=>(a.full_name||'').localeCompare(b.full_name||'')));
  }catch(e){setError('No se pudieron cargar los registros. Verifica los permisos RLS.');}
  finally{setLoading(false);}
 };
 React.useEffect(()=>{load();},[]);
 const date=v=>v?new Date(v).toLocaleString('es-US',{dateStyle:'short',timeStyle:'short'}):'Sin acceso registrado';
 const agents=rows.filter(a=>a.role==='agent');
 const total=agents.length;
 const completed=agents.filter(a=>progressOf(a)===100).length;
 const inProgress=agents.filter(a=>progressOf(a)>0&&progressOf(a)<100).length;
 const noProgress=agents.filter(a=>progressOf(a)===0).length;
 const average=total?Math.round(agents.reduce((sum,a)=>sum+progressOf(a),0)/total):0;
 const filtered=rows.filter(a=>(a.full_name||'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const cell={padding:'10px',borderBottom:'1px solid #e5e8e3'};
 const summaryStyle={border:'1px solid #dce5d8',borderRadius:10,padding:16,background:'#fff',flex:'1 1 145px'};
 return <div style={{padding:28}}>
  <button onClick={()=>setPage('dashboard')} style={{marginBottom:14}}>← Volver a Inicio</button>
  <h1>Seguimiento de agentes</h1>
  <p>Datos registrados en Supabase. Los módulos reflejan avance declarado. Los tutoriales se registran cuando el agente confirma que los completó; no se comprueba automáticamente la reproducción íntegra.</p>
  <button onClick={load} disabled={loading}>Actualizar registros</button>
  {loading&&<p>Cargando datos…</p>}{error&&<p role="alert" style={{color:'#a33'}}>{error}</p>}
  {!loading&&!error&&<React.Fragment>
   <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:20,marginBottom:20}}>
    {[
     ['Agentes registrados',total],
     ['Avance promedio',average+'%'],
     ['En formación',inProgress],
     ['Formación completada',completed],
     ['Sin progreso',noProgress]
    ].map(([label,value])=><div key={label} style={summaryStyle}>
     <div style={{fontSize:13,color:'#536454'}}>{label}</div>
     <div style={{fontSize:26,fontWeight:700,marginTop:6}}>{value}</div>
    </div>)}
   </div>
   <section style={{margin:'4px 0 24px',padding:18,border:'1px solid #dce5d8',borderRadius:10,background:'#fff',maxWidth:700}}>
    <h2 style={{fontSize:19,margin:'0 0 8px'}}>Invitar nuevo agente</h2>
    <p style={{fontSize:13,color:'#536454',margin:'0 0 16px'}}>Envía un correo de activación a FLC Academy. Solo Administración puede enviar invitaciones.</p>
    <form onSubmit={invite}>
     <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
      <label style={{flex:'1 1 220px'}}>Nombre completo
       <input type="text" required minLength={2} maxLength={120} value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Nombre del agente" style={{display:'block',width:'100%',padding:10,marginTop:6,border:'1px solid #ccd5c8',borderRadius:6}}/>
      </label>
      <label style={{flex:'1 1 220px'}}>Correo electrónico
       <input type="email" required maxLength={254} autoComplete="off" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="agente@correo.com" style={{display:'block',width:'100%',padding:10,marginTop:6,border:'1px solid #ccd5c8',borderRadius:6}}/>
      </label>
     </div>
     <button type="submit" disabled={inviting} style={{background:'#143a1e',color:'#fff',borderRadius:7,padding:'12px 18px',marginTop:14,opacity:inviting?.65:1}}>{inviting?'Enviando…':'Enviar invitación'}</button>
     {inviteFeedback&&<p role="status" style={{color:inviteSuccess?'#2d6534':'#a33',marginBottom:0}}>{inviteFeedback}</p>}
    </form>
   </section>
   <section style={{margin:'4px 0 24px',padding:18,border:'1px solid #dce5d8',borderRadius:10,background:'#fff',maxWidth:700}}>
    <h2 style={{fontSize:19,margin:'0 0 8px'}}>Reenviar enlace de acceso</h2>
    <p style={{fontSize:13,color:'#536454'}}>Para agentes que ya aparecen en Supabase pero tienen la invitación expirada o necesitan configurar su contraseña. No crea cuentas nuevas.</p>
    <form onSubmit={resendAccess}>
     <label>Correo de la cuenta existente
      <input type="email" required maxLength={254} autoComplete="off" value={accessEmail} onChange={e=>setAccessEmail(e.target.value)} placeholder="agente@correo.com" style={{display:'block',width:'100%',padding:10,marginTop:6,border:'1px solid #ccd5c8',borderRadius:6}}/>
     </label>
     <button type="submit" disabled={accessBusy} style={{background:'#143a1e',color:'#fff',border:0,borderRadius:7,padding:'12px 18px',marginTop:12}}>{accessBusy?'Enviando…':'Enviar nuevo enlace de acceso'}</button>
     {accessMessage&&<p role="status" style={{fontSize:13,marginTop:12}}>{accessMessage}</p>}
    </form>
   </section>
   <TeamAssignmentsAdmin />
   <label htmlFor="flc-agent-search" style={{display:'block',marginBottom:6}}>Buscar agente</label>
   <input id="flc-agent-search" type="search" placeholder="Nombre del agente" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:10,border:'1px solid #ccd5c8',borderRadius:6,width:'100%',maxWidth:340}}/>
   <div style={{overflowX:'auto',marginTop:16}}><table style={{borderCollapse:'collapse',width:'100%',background:'white'}}>
    <thead><tr>{['Agente','Rol','Último ingreso','Progreso total','Módulo 1','Módulo 2','Módulo 3','Tutoriales completados','Detalle tutoriales','Intentos','Mejor nota','Examen','Certificado'].map(x=><th key={x} style={{textAlign:'left',padding:10,borderBottom:'1px solid #ddd',whiteSpace:'nowrap'}}>{x}</th>)}</tr></thead>
    <tbody>{filtered.map(a=><tr key={a.id}><td style={cell}>{a.full_name}</td><td style={cell}>{a.role}</td><td style={cell}>{date(a.last)}</td><td style={{...cell,fontWeight:700}}>{progressOf(a)}%</td>{moduleIds.map(id=><td key={id} style={cell}>{a.modules[id]??0}%</td>)}<td style={cell}>{a.tutorials.length} / {tutorialTotal} {tutorialTotal>0&&<div style={{fontSize:11,color:'#536454'}}>{Math.round(a.tutorials.length/tutorialTotal*100)}% declarado</div>}</td><td style={cell}><details><summary>Ver detalle</summary><div style={{minWidth:260,padding:'10px 0'}}><strong>Avance por compañía</strong>{tutorialSummary(a).map(group=><div key={group.name} style={{fontSize:12,marginTop:5}}>{group.name}: {group.done}/{group.total}</div>)}<div style={{borderTop:'1px solid #dce5d8',marginTop:10,paddingTop:8}}><strong>Videos confirmados</strong>{a.tutorials.length?a.tutorials.map(v=>{const video=videoLookup[v.tutorial_id];return <div key={v.tutorial_id} style={{fontSize:12,marginTop:6}}><strong>{video?.title||v.tutorial_id}</strong>{video?.company?' — '+video.company:''}<div style={{color:'#536454'}}>Completado: {date(v.completed_at)}</div></div>}):<div style={{fontSize:12,marginTop:5}}>Ninguno registrado</div>}</div></div></details></td><td style={cell}>{a.quiz?.attempts??0}/3</td><td style={cell}>{a.quiz?.attempts?a.quiz.best+'%':'—'}</td><td style={cell}>{a.quiz?.passed?'Aprobado':a.quiz?.attempts?'Pendiente':'Sin presentar'}</td><td style={cell}>{a.certificate?.certificate_code||'—'}</td></tr>)}</tbody>
   </table>{filtered.length===0&&<p>{rows.length===0?'Todavía no hay agentes registrados.':'No hay agentes que coincidan con la búsqueda.'}</p>}</div>
  </React.Fragment>}
  <p style={{fontSize:12,color:'#59655b',marginTop:20}}>El progreso total es el promedio de los tres módulos. Las métricas generales excluyen cuentas administrativas. Los registros anteriores al nuevo sistema no se recuperan automáticamente.</p>
 </div>;
}
window.AdminTracking=AdminTracking;