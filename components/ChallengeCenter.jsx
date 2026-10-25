function ChallengeCenter({user,setPage,isLeader}) {
 const isAdmin=user.role==='admin';
 const canManage=isAdmin||isLeader;
 const owns=c=>isAdmin||(c.created_by===user.id&&c.owner_agent_id===user.id);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const blank=()=>({id:null,title:'',description:'',participant_scope:'individual',audience_mode:'all',selected_ids:[],metric:'verified_ap',target:'10000',starts_on:today,ends_on:today,status:'draft'});
 const [form,setForm]=React.useState(blank);
 const [editing,setEditing]=React.useState(false);
 const [rows,setRows]=React.useState([]);
 const [candidates,setCandidates]=React.useState([]);
 const [candidateSearch,setCandidateSearch]=React.useState('');
 const [candidateError,setCandidateError]=React.useState('');
 const [selected,setSelected]=React.useState(null);
 const [leaderboard,setLeaderboard]=React.useState([]);
 const [rewards,setRewards]=React.useState([]);
 const [rewardNotice,setRewardNotice]=React.useState('');
 const [hall,setHall]=React.useState([]);
 const [hallError,setHallError]=React.useState('');
 const [closing,setClosing]=React.useState(null);
 const [hallDemo,setHallDemo]=React.useState(false);
 const [loading,setLoading]=React.useState(true);
 const [scoreLoading,setScoreLoading]=React.useState(false);
 const [saving,setSaving]=React.useState(false);
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const metrics={submitted_ap:'AP sometida',verified_ap:'AP Issue Paid verificada',submitted_policies:'Pólizas sometidas'};
 const scopes={individual:'Agentes',team:'Equipos de managers directos'};
 const money=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
 const fmt=(n,m)=>m==='submitted_policies'?Number(n||0).toLocaleString('es-US',{maximumFractionDigits:0}):money(n);
 const load=React.useCallback(async()=>{
  const {data,error}=await window.flcSupabase.from('flc_production_challenges')
   .select('id,title,description,participant_scope,audience_mode,metric,target,starts_on,ends_on,status,created_by,owner_agent_id,created_at,updated_at')
   .order('starts_on',{ascending:false}).limit(100);
  if(error){setRows([]);setError('Retos aún no activados. Administración debe ejecutar SQL 028: '+error.message);}
  else{setRows(data||[]);setError('');setSelected(prev=>prev&&(data||[]).some(x=>x.id===prev)?prev:(data||[])[0]?.id||null);}
  setLoading(false);
 },[]);
 React.useEffect(()=>{load();},[load]);
 React.useEffect(()=>{
  if(!canManage)return;
  let alive=true;
  window.flcSupabase.rpc('flc_challenge_candidates').then(({data,error})=>{
   if(!alive)return;
   if(error){setCandidateError('La selección de participantes requiere SQL 037.');setCandidates([]);}
   else{setCandidates(data||[]);setCandidateError('');}
  });
  return()=>{alive=false;};
 },[canManage]);
 const loadHall=React.useCallback(async()=>{
  const {data,error}=await window.flcSupabase.rpc('flc_challenge_hall_of_fame');
  if(error){setHall([]);setHallError('El historial estará disponible después de ejecutar SQL 032.');}
  else{setHall(data||[]);setHallError('');}
 },[]);
 React.useEffect(()=>{loadHall();},[loadHall]);
 const loadScores=React.useCallback(async()=>{
  if(!selected){setLeaderboard([]);setRewards([]);return;}
  setScoreLoading(true);
  // La base de datos calcula y registra cada meta una sola vez.
  // Si SQL 030 aún no está ejecutado, el marcador normal sigue disponible.
  const reconciliation=await window.flcSupabase.rpc('flc_reconcile_challenge_rewards',{p_challenge_id:selected});
  const {data,error}=await window.flcSupabase.rpc('flc_challenge_leaderboard',{p_challenge_id:selected});
  if(error){setError('No se pudo cargar el marcador: '+error.message);setLeaderboard([]);}
  else{setLeaderboard(data||[]);setError('');}
  if(reconciliation.error){setRewards([]);setRewardNotice('Las recompensas estarán disponibles al ejecutar SQL 030.');}
  else{
   const results=await window.flcSupabase.rpc('flc_challenge_rewards_for',{p_challenge_id:selected});
   if(results.error){setRewards([]);setRewardNotice('No se pudieron cargar las recompensas.');}
   else{setRewards(results.data||[]);setRewardNotice('');}
  }
  setScoreLoading(false);
 },[selected]);
 React.useEffect(()=>{loadScores();const timer=setInterval(loadScores,30000);return()=>clearInterval(timer);},[loadScores]);
 const current=rows.find(x=>x.id===selected);
 const state=c=>c.status==='archived'?'Archivado':c.status==='draft'?'Borrador':today<c.starts_on?'Próximo':today>c.ends_on?'Finalizado':'En curso';
 const begin=()=>{
  setForm(blank());setEditing(true);setError('');setNotice('');
 };
 const edit=async c=>{
  setError('');setNotice('');
  let ids=[];
  if(c.audience_mode==='selected'){
   const {data,error}=await window.flcSupabase.rpc('flc_challenge_selected_for',{p_challenge_id:c.id});
   if(error){setError('No se pudo cargar la selección original: '+error.message);return;}
   ids=(data||[]).map(x=>x.agent_id);
  }
  setForm({id:c.id,title:c.title,description:c.description||'',participant_scope:c.participant_scope,
    audience_mode:c.audience_mode||'all',selected_ids:ids,metric:c.metric,target:String(c.target),starts_on:c.starts_on,ends_on:c.ends_on,status:c.status});
  setCandidateSearch('');setEditing(true);
 };
 const save=async e=>{
  e.preventDefault();setError('');setNotice('');
  const target=Number(form.target);
  if(form.title.trim().length<5||target<=0||!Number.isFinite(target)||form.ends_on<form.starts_on||
    (form.metric==='submitted_policies'&&!Number.isInteger(target))){
   setError('Completa un nombre (mínimo 5 caracteres), meta válida y fechas correctas.');return;
  }
  if(form.audience_mode==='selected'&&form.selected_ids.length===0){setError('Elige al menos un agente participante.');return;}
  if(form.audience_mode==='selected'&&candidateError){setError(candidateError);return;}
  if(form.id&&!window.confirm('Vas a modificar un reto existente. El cambio quedará registrado y puede afectar el marcador. ¿Continuar?'))return;
  if(!form.id&&form.status==='active'&&!window.confirm('¿Activar este reto ahora? Los agentes podrán verlo inmediatamente.'))return;
  setSaving(true);
  const {data,error}=await window.flcSupabase.rpc('flc_save_targeted_challenge',{ 
   p_id:form.id,p_title:form.title.trim(),p_description:form.description.trim(),
   p_scope:form.participant_scope,p_metric:form.metric,p_target:target,
   p_starts_on:form.starts_on,p_ends_on:form.ends_on,p_status:form.status,
   p_audience_mode:form.audience_mode,p_agent_ids:form.audience_mode==='selected'?form.selected_ids:[]
  });
  setSaving(false);
  if(error){setError('No se pudo guardar: '+error.message);return;}
  setEditing(false);setNotice(form.id?'✅ Reto actualizado y auditado.':'✅ Reto creado. Puedes activarlo cuando esté listo.');
  await load();setSelected(data);await loadScores();
 };
 const archive=async c=>{
  if(!window.confirm('¿Archivar «'+c.title+'»? Se conservará el reto en el historial administrativo, pero dejará de ser visible a los agentes.'))return;
  setSaving(true);
  const {error}=await window.flcSupabase.rpc(isAdmin?'flc_admin_save_challenge':'flc_leader_save_challenge',{
   p_id:c.id,p_title:c.title,p_description:c.description,p_scope:c.participant_scope,
   p_metric:c.metric,p_target:c.target,p_starts_on:c.starts_on,p_ends_on:c.ends_on,p_status:'archived'
  });
  setSaving(false);
  if(error)setError('No se pudo archivar: '+error.message);
  else{setNotice('✅ Reto archivado. No se eliminó el historial.');await load();}
 };
 const finalize=async c=>{
  if(!window.confirm('¿Cerrar definitivamente el podio de «'+c.title+'»? Los resultados quedarán guardados como historial y no cambiarán después. Confirma que administración ya verificó la producción.'))return;
  setClosing(c.id);setHallError('');
  const {data,error}=await window.flcSupabase.rpc('flc_finalize_challenge_podium',{p_challenge_id:c.id});
  setClosing(null);
  if(error){setHallError('No se pudo cerrar el podio: '+error.message);return;}
  setNotice(data>0?'✅ Podio histórico guardado sin alterar pólizas.':'El podio ya estaba guardado. No se duplicó.');
  await loadHall();
 };
 const finalIds=new Set(hall.map(x=>x.challenge_id));
 const demoEntries=hallDemo?[
  {challenge_id:'ejemplo',challenge_title:'Reto de ejemplo',starts_on:today,ends_on:today,participant_scope:'individual',metric:'verified_ap',place:1,participant_name:'Agente de ejemplo A',metric_value:12500,target_value:10000,isDemo:true},
  {challenge_id:'ejemplo',challenge_title:'Reto de ejemplo',starts_on:today,ends_on:today,participant_scope:'individual',metric:'verified_ap',place:2,participant_name:'Agente de ejemplo B',metric_value:11200,target_value:10000,isDemo:true},
  {challenge_id:'ejemplo',challenge_title:'Reto de ejemplo',starts_on:today,ends_on:today,participant_scope:'individual',metric:'verified_ap',place:3,participant_name:'Agente de ejemplo C',metric_value:10400,target_value:10000,isDemo:true},
  ...hall
 ]:hall;
 const hallGroups=Object.values(demoEntries.reduce((acc,item)=>{
  const key=item.challenge_id;
  if(!acc[key])acc[key]={challenge_id:key,title:item.challenge_title,ends_on:item.ends_on,metric:item.metric,isDemo:!!item.isDemo,winners:[]};
  acc[key].winners.push(item);
  return acc;
 },{}));
 const podiumColors={
  1:{accent:'#d4a43c',background:'linear-gradient(155deg,#fff8dc,#ffffff 72%)',medal:'🥇',label:'CAMPEÓN',order:2,height:245},
  2:{accent:'#a6b0bd',background:'linear-gradient(155deg,#f0f4f7,#ffffff 72%)',medal:'🥈',label:'SEGUNDO LUGAR',order:1,height:205},
  3:{accent:'#b97d4c',background:'linear-gradient(155deg,#fff1e5,#ffffff 72%)',medal:'🥉',label:'TERCER LUGAR',order:3,height:185}
 };
 const summaryStyle={fontSize:13,color:'#667666'};
 return <section data-screen-label="FLC Gamification Center Retos" style={{maxWidth:1200}}>
  <button type="button" onClick={()=>setPage('dashboard')} style={{color:'#38602a',marginBottom:12}}>← Volver al inicio</button>
  <h1 className="page-title">🚀 Retos de <em>producción</em></h1>
  <p className="page-sub">Compite con datos reales. Las metas de AP respetan los porcentajes de split; la AP Issue Paid solo cuenta después de la verificación administrativa.</p>
  {canManage&&<button type="button" onClick={begin} style={{padding:'11px 18px',borderRadius:8,background:'#173c27',color:'#fff',marginBottom:18}}>＋ Crear nuevo reto</button>}
  {error&&<p role="alert" style={{padding:12,color:'#8c362c',background:'#fff0ee',borderRadius:8}}>{error}</p>}
  {notice&&<p role="status" style={{padding:12,color:'#255c30',background:'#eef9e8',borderRadius:8}}>{notice}</p>}
  {canManage&&editing&&<form className="card" onSubmit={save} style={{marginBottom:24,background:'#fffdf5'}}>
   <h3 style={{marginTop:0}}>{form.id?'Editar reto':'Nuevo reto'}</h3>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:15}}>
    <label>Nombre del reto <input required maxLength={100} minLength={5} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}} placeholder="Ej.: Semana de Campeones"/></label>
    <label>Participantes <select value={form.participant_scope} onChange={e=>setForm(f=>({...f,participant_scope:e.target.value,audience_mode:e.target.value==='team'?'all':f.audience_mode,selected_ids:e.target.value==='team'?[]:f.selected_ids}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}}>
     <option value="individual">Agentes individuales</option><option value="team">Managers directos y sus equipos</option>
    </select></label>
    <label>Categoría <select value={form.metric} onChange={e=>setForm(f=>({...f,metric:e.target.value,target:e.target.value==='submitted_policies'?'3':'10000'}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}}>
     <option value="verified_ap">AP Issue Paid verificada</option><option value="submitted_ap">AP sometida</option><option value="submitted_policies">Número de pólizas sometidas</option>
    </select></label>
    <label>Meta {form.metric==='submitted_policies'?'(pólizas)':'(USD)'} <input type="number" min="1" step={form.metric==='submitted_policies'?'1':'0.01'} required value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}} /></label>
    <label>Desde <input type="date" required value={form.starts_on} onChange={e=>setForm(f=>({...f,starts_on:e.target.value}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}} /></label>
    <label>Hasta <input type="date" required value={form.ends_on} onChange={e=>setForm(f=>({...f,ends_on:e.target.value}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}} /></label>
    <label>Publicación <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}}>
     <option value="draft">Borrador (no visible a participantes)</option><option value="active">Activo (visible a agentes)</option><option value="archived">Archivado</option>
    </select></label>
   </div>
   {form.participant_scope==='individual'&&<div style={{marginTop:14,padding:14,border:'1px solid #cddcc9',borderRadius:10,background:'#f7faf5'}}>
    <label>Dirigido a <select value={form.audience_mode} onChange={e=>setForm(f=>({...f,audience_mode:e.target.value,selected_ids:e.target.value==='all'?[]:f.selected_ids}))} style={{display:'block',width:'100%',maxWidth:440,padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}}>
     <option value="all">{isAdmin?'Toda la agencia':'Toda mi estructura'}</option>
     <option value="selected">Agentes seleccionados</option>
    </select></label>
    {form.audience_mode==='selected'&&<div style={{marginTop:12}}>
     <p style={{fontSize:13,margin:'0 0 8px'}}>Solo podrán competir los agentes elegidos. {isAdmin?'Administración puede seleccionar agentes de toda FLC.':'Solo puedes seleccionar integrantes de tu estructura.'}</p>
     {candidateError&&<p role="alert" style={{color:'#963f28'}}>{candidateError}</p>}
     <input type="search" placeholder="Buscar agente por nombre" value={candidateSearch} onChange={e=>setCandidateSearch(e.target.value)} style={{width:'100%',maxWidth:420,padding:10,border:'1px solid #ced8c8',borderRadius:8}} />
     <p style={{fontSize:12,color:'#566e57'}}>{form.selected_ids.length} participante(s) seleccionado(s). Los no seleccionados no verán el reto privado.</p>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:6,maxHeight:220,overflowY:'auto'}}>
      {candidates.filter(a=>a.full_name.toLowerCase().includes(candidateSearch.toLowerCase())).slice(0,100).map(a=><label key={a.id} style={{padding:7,border:'1px solid #e0e9d9',borderRadius:7,background:'#fff',display:'flex',gap:8,alignItems:'center'}}>
       <input type="checkbox" checked={form.selected_ids.includes(a.id)} onChange={e=>setForm(f=>({...f,selected_ids:e.target.checked?[...f.selected_ids,a.id]:f.selected_ids.filter(x=>x!==a.id)}))}/>{a.full_name}
      </label>)}
     </div>
     {form.selected_ids.length>0&&<p style={{fontSize:12,color:'#456543'}}>Elegidos: {form.selected_ids.map(id=>candidates.find(x=>x.id===id)?.full_name||'Agente no disponible').join(', ')}</p>}
    </div>}
   </div>}
   <label style={{display:'block',marginTop:12}}>Descripción <textarea value={form.description} maxLength={500} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{display:'block',width:'100%',padding:10,marginTop:4,border:'1px solid #ced8c8',borderRadius:8}} placeholder="Condiciones o premios que quieras anunciar"/></label>
   <p style={summaryStyle}>Puedes hacer retos diarios, semanales o mensuales con sus fechas. Los cambios a retos existentes se registran en auditoría. Los líderes solo gestionan retos de sus propias estructuras.</p>
   <div style={{display:'flex',gap:10}}>
    <button type="submit" disabled={saving} style={{padding:'10px 18px',color:'#fff',background:'#19683b',borderRadius:8}}>{saving?'Guardando…':'Guardar reto'}</button>
    <button type="button" onClick={()=>setEditing(false)} style={{padding:'10px 18px',background:'#eee',borderRadius:8}}>Cancelar</button>
   </div>
  </form>}
  <h3>{canManage?'Retos configurados y disponibles':'Retos disponibles'}</h3>
  {loading?<p>Cargando retos…</p>:rows.length===0?<p className="card">Todavía no hay retos activos. {canManage?'Presiona «Crear nuevo reto» para comenzar.':''}</p>:
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:12,marginBottom:22}}>
   {rows.map(c=><div className="card" key={c.id} style={{padding:16,border:selected===c.id?'2px solid #77b141':'1px solid #e1e8da'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><strong style={{fontSize:17}}>{c.title}</strong><span style={{fontSize:12,color:c.status==='active'?'#188044':'#755820'}}>{state(c)}</span></div>
    <p style={summaryStyle}>{c.starts_on} al {c.ends_on} · {scopes[c.participant_scope]}</p>
    <div style={{fontSize:14,color:'#2e5535',fontWeight:700}}>{metrics[c.metric]} · Meta {fmt(c.target,c.metric)}</div>
    <div style={{fontSize:12,color:'#697963',marginTop:5}}>{c.owner_agent_id?'Reto de estructura':'Reto de toda la agencia'} · {c.audience_mode==='selected'?'Participantes seleccionados':'Todos los elegibles'}</div>
    <p style={{fontSize:13,color:'#647365'}}>{c.description}</p>
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
     <button onClick={()=>setSelected(c.id)} style={{padding:'7px 12px',background:'#e4f0d7',borderRadius:7}}>🏆 Ver marcador</button>
     {owns(c)&&<button onClick={()=>edit(c)} style={{padding:'7px 12px',background:'#f3e8c8',borderRadius:7}}>Editar</button>}
     {owns(c)&&c.status!=='archived'&&<button onClick={()=>archive(c)} disabled={saving} style={{padding:'7px 12px',background:'#f6eded',borderRadius:7}}>Archivar</button>}
     {owns(c)&&c.status==='active'&&today>c.ends_on&&!finalIds.has(c.id)&&<button onClick={()=>finalize(c)} disabled={closing===c.id} style={{padding:'7px 12px',background:'#faedce',borderRadius:7}}>{closing===c.id?'Cerrando…':'🏆 Cerrar podio histórico'}</button>}
     {finalIds.has(c.id)&&<span style={{fontSize:12,color:'#55763d',alignSelf:'center'}}>✅ Podio guardado</span>}
    </div>
   </div>)}
  </div>}
  {current&&<section className="card" style={{padding:20}}>
   <h2 style={{margin:'0 0 4px'}}>🏆 Marcador · {current.title}</h2>
   <p style={summaryStyle}>{scopes[current.participant_scope]} · {metrics[current.metric]} · Meta {fmt(current.target,current.metric)}</p>
   <p style={summaryStyle}>Actualización automática cada 30 segundos. Los empates muestran primero el registro más temprano.</p>
   <p style={{...summaryStyle,color:'#376b38'}}>🏅 Alcanzar el 100 % de la meta de un reto activo registra una recompensa única por participante, sin duplicados. Los retos en borrador no entregan recompensas.</p>
   {rewardNotice&&<p style={{fontSize:12,color:'#876318'}}>{rewardNotice}</p>}
   {scoreLoading?<p>Calculando resultados…</p>:leaderboard.length===0?<p>Aún no hay producción en este reto.</p>:
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
    <thead><tr style={{textAlign:'left',borderBottom:'1px solid #c9d6c8'}}><th style={{padding:8}}>Lugar</th><th style={{padding:8}}>{current.participant_scope==='team'?'Equipo':'Agente'}</th><th style={{padding:8}}>Progreso</th><th style={{padding:8}}>Meta</th><th style={{padding:8}}>Completado</th></tr></thead>
    <tbody>{leaderboard.map((a,i)=><tr key={a.participant_id} style={{borderBottom:'1px solid #e8eee3',background:i<3?'#fffdf2':'transparent'}}>
     <td style={{padding:9,fontWeight:700}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':a.place}</td>
     <td style={{padding:9}}>{a.participant_name}{rewards.some(r=>r.participant_id===a.participant_id)&&<span style={{display:'inline-block',marginLeft:8,color:'#855e14',fontWeight:700,fontSize:12}}>🏅 Meta lograda</span>}</td>
     <td style={{padding:9,fontWeight:700}}>{fmt(a.metric_value,current.metric)}</td>
     <td style={{padding:9}}>{fmt(a.target_value,current.metric)}</td>
     <td style={{padding:9,minWidth:120}}><div style={{height:8,borderRadius:6,background:'#e9efe3',overflow:'hidden'}}><div style={{height:'100%',width:Math.min(100,Number(a.progress_pct))+'%',background:'#75ab35'}} /></div><span style={{fontSize:12}}>{Number(a.progress_pct).toFixed(1)}%</span></td>
    </tr>)}</tbody>
   </table></div>}
   {rewards.length>0&&<p style={{fontSize:13,color:'#496a32',marginTop:12}}>🏅 {rewards.length} recompensa{rewards.length===1?'':'s'} de meta registrada{rewards.length===1?'':'s'} en este reto.</p>}
   <p style={{...summaryStyle,marginTop:18}}>Solo se muestran métricas de producción; no se exponen datos de clientes ni pólizas individuales.</p>
  </section>}
  <section className="card" style={{marginTop:24,padding:24,background:'linear-gradient(140deg,#f7faf3,#fffdf7)',border:'1px solid #d9e5d2'}} aria-label="Salón de Campeones FLC">
   <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',justifyContent:'space-between'}}>
    <div>
     <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:'#9f7a24'}}>FUTURE LEGACY CREATORS · GAMIFICATION CENTER</div>
     <h2 style={{margin:'7px 0',color:'#153e2b',fontSize:'clamp(25px,4vw,37px)'}}>👑 Salón de Campeones</h2>
     <p style={{...summaryStyle,margin:'5px 0 13px'}}>El legado de quienes conquistaron sus retos. Podios oficiales cerrados; resultados históricos permanentes.</p>
    </div>
    {isAdmin&&<button type="button" onClick={()=>setHallDemo(v=>!v)} aria-pressed={hallDemo} style={{padding:'10px 15px',background:hallDemo?'#f3dfac':'#fff5db',border:'1px solid #d7bf7e',borderRadius:10,color:'#604d1b',fontWeight:700}}>{hallDemo?'Ocultar ejemplo':'Ver ejemplo sin publicar'}</button>}
   </div>
   {hallError&&<p role="status" style={{fontSize:13,color:'#926224'}}>{hallError}</p>}
   {!hallGroups.length&&!hallError&&<div style={{padding:'24px 18px',border:'1px dashed #bacfba',borderRadius:14,textAlign:'center',background:'#fff'}}>
    <div style={{fontSize:36}}>🏆</div>
    <strong style={{color:'#235037'}}>El próximo campeón aún está por escribirse</strong>
    <p style={{...summaryStyle,marginBottom:0}}>Los podios aparecerán aquí al finalizar y cerrar oficialmente los retos.</p>
   </div>}
   {hallGroups.map(group=><div key={group.challenge_id} style={{marginTop:18,padding:'22px 16px',borderRadius:18,background:group.isDemo?'#fffdf4':'#fff',border:group.isDemo?'2px dashed #c99a35':'1px solid #dce7d8',boxShadow:'0 10px 26px rgba(19,58,33,.06)'}}>
    {group.isDemo&&<div style={{display:'inline-block',padding:'6px 12px',borderRadius:30,background:'#fff0c5',color:'#8a5312',fontSize:12,fontWeight:900,letterSpacing:1,marginBottom:12}}>VISTA DE EJEMPLO · NO PUBLICADA · DATOS FICTICIOS</div>}
    <div style={{textAlign:'center',marginBottom:20}}>
     <div style={{fontSize:12,letterSpacing:2,fontWeight:800,color:'#ac8429'}}>PODIO {group.isDemo?'DEMOSTRATIVO':'OFICIAL'}</div>
     <h3 style={{fontSize:'clamp(19px,3vw,27px)',margin:'7px 0',color:'#163d29'}}>{group.title}</h3>
     <div style={{fontSize:13,color:'#73816e'}}>{metrics[group.metric]||'Producción'} · Finalizó {group.ends_on}</div>
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'end',justifyContent:'center'}}>
     {group.winners.slice().sort((a,b)=>a.place-b.place).map(w=>{
      const medal=podiumColors[w.place]||podiumColors[3];
      return <article key={w.place} style={{order:medal.order,flex:'1 1 185px',maxWidth:330,minWidth:0,minHeight:medal.height,padding:'22px 16px 16px',textAlign:'center',border:'2px solid '+medal.accent,borderRadius:16,background:medal.background,boxShadow:w.place===1?'0 14px 28px rgba(155,114,30,.15)':'0 7px 16px rgba(24,53,33,.06)',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
       <div>
        <div style={{fontSize:w.place===1?54:44,lineHeight:1.2}} aria-hidden="true">{medal.medal}</div>
        <div style={{fontSize:11,letterSpacing:1.4,fontWeight:900,color:'#8c6622',marginTop:7}}>{medal.label}</div>
        <strong style={{display:'block',fontSize:w.place===1?21:18,color:'#153f2b',margin:'9px 0',overflowWrap:'anywhere'}}>{w.participant_name}</strong>
       </div>
       <div>
        <div style={{fontSize:w.place===1?23:20,fontWeight:900,color:'#163d29'}}>{fmt(w.metric_value,group.metric)}</div>
        <div style={{fontSize:12,color:'#657363',marginTop:5}}>{w.place}º lugar · Meta {fmt(w.target_value,group.metric)}</div>
       </div>
      </article>;
     })}
    </div>
    <p style={{fontSize:12,textAlign:'center',color:'#687665',margin:'18px 0 0'}}>{group.isDemo?'Este ejemplo solo se muestra en tu pantalla. No crea resultados ni premios.':'Reconocimiento histórico definitivo; no cambia con futuras correcciones de producción.'}</p>
   </div>)}
  </section>
 </section>;
}
