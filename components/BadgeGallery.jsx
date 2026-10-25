function BadgeGallery({user,setPage}) {
 const specs={
  first_sale:{emoji:'🥇',name:'Primera venta',detail:'Primera póliza sometida acreditada (incluye splits).',once:true},
  four_weeks:{emoji:'🔥',name:'Productor constante',detail:'Negocio sometido en 4 semanas consecutivas.',once:true},
  club_10k:{emoji:'💎',name:'Club $10K',detail:'$10,000 de AP Issue Paid verificada en un mes.',once:false},
  club_25k:{emoji:'🚀',name:'Club $25K',detail:'$25,000 de AP Issue Paid verificada en un mes.',once:false},
  club_50k:{emoji:'👑',name:'Club $50K',detail:'$50,000 de AP Issue Paid verificada en un mes.',once:false},
  team_leader:{emoji:'🏆',name:'Líder de equipo',detail:'Ascenso a Sales Manager o título superior.',once:true}
 };
 const [target,setTarget]=React.useState(user.id);
 const [agents,setAgents]=React.useState([]);
 const [rows,setRows]=React.useState([]);
 const [loading,setLoading]=React.useState(true);
 const [message,setMessage]=React.useState('');
 const [reconciling,setReconciling]=React.useState(false);
 React.useEffect(()=>{
  if(user.role!=='admin')return;
  window.flcSupabase.rpc('flc_admin_team_roster').then(({data})=>{
   if(data)setAgents(data||[]);
  });
 },[user.id,user.role]);
 const load=React.useCallback(async()=>{
  setLoading(true);
  const {data,error}=await window.flcSupabase.rpc('flc_badge_gallery',{p_agent_id:target});
  if(error){setRows([]);setMessage('Las insignias todavía no están activadas. Ejecuta SQL 027 antes de probar este panel.');}
  else{setRows(data||[]);setMessage('');}
  setLoading(false);
 },[target]);
 React.useEffect(()=>{load();},[load]);
 const month=v=>v?String(v).slice(0,7):'';
 const sender=rows[0]?.full_name||agents.find(a=>a.id===target)?.full_name||(target===user.id?user.name:'Agente');
 const textFor=r=>{
  const item=specs[r.badge_code];
  return '🏅✨ *LOGRO FLC ACADEMY*\n\n'+item.emoji+' *'+item.name+'*\n⭐ Agente: '+(r.full_name||sender)+'\n📅 Mes del logro: '+month(r.period_month)+'\n🏆 ¡Seguimos construyendo legados! 💚';
 };
 const copy=async r=>{
  try{await navigator.clipboard.writeText(textFor(r));setMessage('✅ Mensaje con emojis copiado para WhatsApp.');}
  catch(e){setMessage('No se pudo copiar. Intenta desde un navegador con permisos de portapapeles.');}
 };
 const share=async r=>{
  // The WhatsApp URL strips some emoji sequences on certain desktop clients.
  // Prefer the OS share sheet on supported phones; otherwise copy the exact
  // Unicode text first and open WhatsApp for the user to paste into the group.
  const content=textFor(r);
  if(navigator.share){
   try{
    await navigator.share({text:content});
    setMessage('✅ Compartido mediante el menú del dispositivo. Tú eliges el grupo y confirmas el envío.');
    return;
   }catch(e){
    if(e.name==='AbortError')return;
   }
  }
  try{
   const clipboardWrite=navigator.clipboard.writeText(content);
   const opened=window.open('https://web.whatsapp.com/','_blank','noopener,noreferrer');
   await clipboardWrite;
   setMessage(opened===null
    ?'✅ Copiado con emojis. Abre WhatsApp y pega el mensaje en el grupo.'
    :'✅ Copiado con emojis. En WhatsApp, elige el grupo y pega el mensaje (⌘V o Ctrl+V).');
  }catch(e){
   setMessage('No se pudo copiar automáticamente. Usa «Copiar con emojis» antes de abrir WhatsApp.');
  }
 };
 const reconcile=async()=>{
  if(user.role!=='admin')return;
  setReconciling(true);setMessage('');
  const {data,error}=await window.flcSupabase.rpc('flc_admin_reconcile_badges',{p_agent_id:target});
  setReconciling(false);
  if(error){setMessage('No se pudo recuperar el historial: '+error.message);return;}
  await load();setMessage('✅ Revisado. Nuevas insignias históricas: '+data+'. Sin alterar pólizas.');
 };
 const earnedByCode=Object.fromEntries(Object.keys(specs).map(k=>[k,rows.filter(r=>r.badge_code===k)]));
 return <section data-screen-label="FLC Academy Mis Insignias" style={{maxWidth:1100}}>
  <button onClick={()=>setPage('dashboard')} style={{color:'#345d27',marginBottom:12}}>← Volver al inicio</button>
  <h1 className="page-title">🏅 Mis <em>insignias</em></h1>
  <p className="page-sub">Tus logros quedan guardados en tu historial. Los clubes mensuales se ganan con AP Issue Paid verificada acreditada según el split.</p>
  {user.role==='admin'&&<div className="card" style={{marginBottom:20,display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
   <label htmlFor="badge-target">Ver agente:</label>
   <select id="badge-target" value={target} onChange={e=>setTarget(e.target.value)} style={{minWidth:210,padding:10,border:'1px solid #dae3d1',borderRadius:8}}>
    <option value={user.id}>{user.name} (administración)</option>
    {agents.filter(a=>a.id!==user.id).map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}
   </select>
   <button type="button" disabled={reconciling} onClick={reconcile} style={{padding:'10px 14px',background:'#e9f3df',border:'1px solid #7fa968',borderRadius:8}}>
    {reconciling?'Revisando…':'🔄 Recuperar logros reales de este agente'}
   </button>
   <span style={{fontSize:12,color:'#667467'}}>Recuperación manual y segura, sin modificar pólizas.</span>
  </div>}
  {message&&<p role="status" style={{padding:12,background:'#fff8dc',borderRadius:8}}>{message}</p>}
  {loading?<p>Cargando insignias…</p>:<React.Fragment>
   <div style={{marginBottom:16,color:'#51614e',fontSize:14}}>🎖️ {rows.length} reconocimiento{rows.length===1?'':'s'} registrado{rows.length===1?'':'s'} {user.role==='admin'?'· '+sender:''}</div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>
    {Object.entries(specs).map(([code,s])=>{
     const earned=earnedByCode[code]||[];
     return <article key={code} className="card" style={{border:earned.length?'1px solid #d0ab4f':'1px solid #dfe5db',background:earned.length?'linear-gradient(150deg,#fffdf4,#f5f9ec)':'#f7f8f6',opacity:earned.length?1:.75}}>
      <div style={{fontSize:40,marginBottom:8}}>{s.emoji}</div>
      <h3 style={{margin:'0 0 8px',color:'#1b3f29'}}>{s.name}</h3>
      <p style={{fontSize:13,color:'#607060',minHeight:54}}>{s.detail}</p>
      <div style={{fontSize:13,fontWeight:700,color:earned.length?'#93680e':'#777'}}>{earned.length?'✅ '+(s.once?'Conseguida':earned.length+' mes(es) conseguido(s)'):'🔒 Aún no conseguida'}</div>
      {earned.length>0&&<React.Fragment>
       <div style={{marginTop:10,fontSize:12,color:'#5d684d'}}>Mes{earned.length>1?'es':''}: {earned.map(x=>month(x.period_month)).join(', ')}</div>
       <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>
        <button onClick={()=>copy(earned[0])} style={{padding:'8px 10px',background:'#dcedca',borderRadius:7,fontSize:12}}>📋 Copiar con emojis</button>
        <button onClick={()=>share(earned[0])} style={{padding:'8px 10px',background:'#1c6a40',color:'#fff',borderRadius:7,fontSize:12}}>📲 WhatsApp con emojis</button>
       </div>
      </React.Fragment>}
     </article>;
    })}
   </div>
   <p style={{fontSize:12,color:'#677366',marginTop:18}}>Los títulos de liderazgo se revisan por separado conforme a las reglas mensuales de FLC Academy. Las insignias representan logros históricos, no títulos vigentes.</p>
  </React.Fragment>}
 </section>;
}
