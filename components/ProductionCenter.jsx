function ProductionCenter({user,setPage}) {
 const sources=['AuraFlow','LifeButton','LeadzTech AI','Ecomfy','Leads for Life','Propia campaña','Referido','Familiar / Amistad','Otro'];
 const carriers=['National Life Group','F&G','Foresters','American Amicable','Transamerica','Mutual of Omaha','Aetna','Americo','Lincoln Heritage','Occidental','Corebridge','Athene','Otro'];
 const products=['IUL','Term','Whole Life','Final Expense','Annuity','Mortgage Protection','Key Man','Executive Bonus','Otro'];
 const blank=()=>({client:'',number:'',carrier:'National Life Group',product:'IUL',source:'AuraFlow',other:'',ap:'',split:'',pct:'50',date:new Date().toISOString().slice(0,10),primary:''});
 const [period,setPeriod]=React.useState('2026-10');
 const [carrierFilter,setCarrierFilter]=React.useState('');
 const [teamIds,setTeamIds]=React.useState([]);
 const [canViewTeam,setCanViewTeam]=React.useState(user.role==='admin');
 const [editing,setEditing]=React.useState(null),[statusSaving,setStatusSaving]=React.useState(false);
 const [form,setForm]=React.useState(blank),[agents,setAgents]=React.useState([]),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(true),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[tab,setTab]=React.useState('list');
 const load=async()=>{setBusy(true);setError('');const {data,error}=await window.flcSupabase.from('flc_policy_sales').select('id,agent_id,client_name,carrier,product_type,policy_number,lead_source,status,annual_premium,split_agent_id,split_primary_pct,submitted_on,approved_on,issue_paid_on,created_at').order('created_at',{ascending:false}).limit(250);if(error){setError('El registro aún no está habilitado en Supabase o no tienes acceso.');}else setRows(data||[]);setBusy(false);};
 React.useEffect(()=>{load();const fetchTeam=async()=>{
  if(user.role==='admin'){
   const {data}=await window.flcSupabase.rpc('flc_admin_team_roster');
   if(data){setAgents(data);setTeamIds(data.map(a=>a.id));}
   setCanViewTeam(true);
  }else{
   const {data:isLeader}=await window.flcSupabase.rpc('flc_is_team_leader');
   if(isLeader){
    const {data,error}=await window.flcSupabase.rpc('flc_my_team_report');
    if(!error){setTeamIds((data||[]).map(a=>a.agent_id));setAgents(data||[]);setCanViewTeam(true);}
   }else{setCanViewTeam(false);setTeamIds([]);}
  }
 };fetchTeam();},[user.id]);
 const filteredRows=rows.filter(x=>!carrierFilter||x.carrier===carrierFilter);
 const monthRows=filteredRows.filter(x=>x.submitted_on&&x.submitted_on.slice(0,7)===period);
 const monthAP=monthRows.reduce((n,x)=>n+Number(x.annual_premium),0);
 const paidRows=filteredRows.filter(x=>x.status==='Issue Paid'&&x.issue_paid_on&&x.issue_paid_on.slice(0,7)===period);
 const paidAP=paidRows.reduce((n,x)=>n+Number(x.annual_premium),0);
 const myCredit=x=>Number(x.annual_premium)*(x.agent_id===user.id?Number(x.split_primary_pct)/100:x.split_agent_id===user.id?(100-Number(x.split_primary_pct))/100:0);
 const myAP=monthRows.reduce((n,x)=>n+myCredit(x),0);
 const myPaid=paidRows.reduce((n,x)=>n+myCredit(x),0);
 const mySubmitted=monthRows.filter(x=>x.agent_id===user.id||x.split_agent_id===user.id);
 const myIssued=paidRows.filter(x=>x.agent_id===user.id||x.split_agent_id===user.id);
 const memberSet=new Set([user.id,...teamIds]);
 const teamCredit=x=>Number(x.annual_premium)*((memberSet.has(x.agent_id)?Number(x.split_primary_pct)/100:0)+(x.split_agent_id&&memberSet.has(x.split_agent_id)?(100-Number(x.split_primary_pct))/100:0));
 const teamSubmitted=monthRows.filter(x=>memberSet.has(x.agent_id)||memberSet.has(x.split_agent_id));
 const teamIssued=paidRows.filter(x=>memberSet.has(x.agent_id)||memberSet.has(x.split_agent_id));
 const teamAP=teamSubmitted.reduce((n,x)=>n+teamCredit(x),0);
 const teamPaid=teamIssued.reduce((n,x)=>n+teamCredit(x),0);
 const agentBreakdown=[user.id,...teamIds].filter((id,i,a)=>a.indexOf(id)===i).map(id=>{
  const share=x=>Number(x.annual_premium)*(x.agent_id===id?Number(x.split_primary_pct)/100:x.split_agent_id===id?(100-Number(x.split_primary_pct))/100:0);
  const submitted=monthRows.filter(x=>x.agent_id===id||x.split_agent_id===id);
  const issued=paidRows.filter(x=>x.agent_id===id||x.split_agent_id===id);
  return {id,name:id===user.id?user.name:(agents.find(a=>a.id===id)?.full_name||''),submitted:submitted.length,ap:submitted.reduce((n,x)=>n+share(x),0),issued:issued.length,paid:issued.reduce((n,x)=>n+share(x),0)};
 }).filter(a=>a.submitted||a.issued).sort((a,b)=>b.ap-a.ap);
 const fmt=x=>Number(x).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const metric=(label,value)=><div style={{background:'#f5f8f3',border:'1px solid #dfebdc',padding:16,borderRadius:10}}><div style={{color:'#516552',fontSize:13}}>{label}</div><div style={{fontSize:23,fontWeight:700,marginTop:7}}>{value}</div></div>;
 const field=(label,child)=><label style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,fontWeight:600}}>{label}{child}</label>;
 const inp={padding:10,border:'1px solid #ccd8cd',borderRadius:7,width:'100%',fontSize:14,background:'#fff'};
 const change=(k,v)=>setForm(x=>({...x,[k]:v}));
 const statuses=['Sometida','En revisión','Pendiente requisito','Aprobada','Issue Paid','Declinada','Cancelada','Chargeback'];
 const editStatus=row=>{setEditing({id:row.id,status:row.status,approved_on:row.approved_on||'',issue_paid_on:row.issue_paid_on||''});setError('');setNotice('');};
 const saveStatus=async()=>{if(!editing||statusSaving)return;setStatusSaving(true);setError('');setNotice('');
  const {error}=await window.flcSupabase.rpc(user.role==='admin'?'flc_admin_update_policy_status':'flc_agent_update_policy_status',{
   p_sale_id:editing.id,p_status:editing.status,p_approved_on:editing.approved_on||null,p_issue_paid_on:editing.issue_paid_on||null
  });
  setStatusSaving(false);if(error){setError('No se pudo actualizar el estado: '+error.message);return;}
  setEditing(null);setNotice('Estado actualizado correctamente.');await load();
 };
 const submit=async e=>{e.preventDefault();setError('');setNotice('');if(form.split && (Number(form.pct)<=0||Number(form.pct)>=100)){setError('El porcentaje principal debe ser mayor de 0 y menor de 100.');return;}
 setSaving(true);const {error}=await window.flcSupabase.rpc(user.role==='admin'?'flc_admin_create_policy':'flc_create_policy',{p_client_name:form.client,p_policy_number:form.number||null,p_carrier:form.carrier,p_product_type:form.product,p_lead_source:form.source,p_lead_source_other:form.source==='Otro'?form.other:null,p_annual_premium:Number(form.ap),p_split_agent_id:form.split||null,p_split_primary_pct:form.split?Number(form.pct):100,p_submitted_on:form.date,...(user.role==='admin'?{p_agent_id:form.primary||user.id}:{})});setSaving(false);
 if(error){setError(error.code==='23505'?'Ya hay una póliza registrada con ese número y compañía.':error.message||'No se pudo guardar.');return;}
 setNotice('Póliza registrada. Queda en estado Sometida hasta la validación administrativa.');setForm(blank());setTab('list');await load();};
 return <div style={{padding:28,maxWidth:1250,margin:'auto'}}>
 <button onClick={()=>setPage('dashboard')}>← Inicio</button><h1>FLC Production Center</h1><p>Registra pólizas, consulta su estado y lleva control de splits. El agente principal puede actualizar estados de sus pólizas; Administración puede revisar todas.</p>
 <section style={{padding:18,margin:'14px 0',border:'1px solid #dce5d8',borderRadius:12,background:'#fff'}}>
 <h2 style={{margin:'0 0 14px'}}>Resumen de producción</h2>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
  <label>Mes: <input type="month" value={period} onChange={e=>setPeriod(e.target.value)} style={{padding:8}}/></label>
  <label>Compañía: <select value={carrierFilter} onChange={e=>setCarrierFilter(e.target.value)} style={{padding:8}}><option value="">Todas las compañías</option>{[...new Set(rows.map(x=>x.carrier))].sort().map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 </div>
 <h3>👤 Producción personal</h3>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:12}}>
 {metric('Mis pólizas sometidas',mySubmitted.length)}
 {metric('Mi AP sometida',fmt(myAP))}
 {metric('Mis pólizas Issue Paid',myIssued.length)}
 {metric('Mi AP Issue Paid reportada',fmt(myPaid))}
 </div>
 {canViewTeam&&<React.Fragment>
 <h3 style={{marginTop:22}}>👥 Producción de equipo</h3>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:12}}>
 {metric('Pólizas del equipo (incluye líder)',teamSubmitted.length)}
 {metric('AP del equipo · sometida (incluye líder)',fmt(teamAP))}
 {metric('Pólizas Issue Paid del equipo',teamIssued.length)}
 {metric('AP del equipo · Issue Paid (incluye líder)',fmt(teamPaid))}
 </div>
 <h4 style={{margin:'20px 0 10px'}}>Detalle por agente (AP acreditada)</h4>
 <div style={{overflowX:'auto'}}>
 <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
 <thead><tr>{['Agente','Pólizas sometidas','AP sometida','Pólizas Issue Paid','AP Issue Paid'].map(t=><th key={t} style={{textAlign:'left',padding:10,borderBottom:'1px solid #ddd'}}>{t}</th>)}</tr></thead>
 <tbody>{agentBreakdown.map(a=><tr key={a.id}><td style={{padding:10,borderBottom:'1px solid #eee'}}>{a.name||'Agente del equipo'}</td><td>{a.submitted}</td><td>{fmt(a.ap)}</td><td>{a.issued}</td><td>{fmt(a.paid)}</td></tr>)}</tbody>
 </table>{!agentBreakdown.length&&<p>Sin producción registrada para la estructura en este período.</p>}</div>
 {user.role==='admin'&&<p style={{fontSize:13,marginTop:12}}>Agencia · {monthRows.length} pólizas sometidas · {fmt(monthAP)} AP total · {fmt(paidAP)} Issue Paid reportada (sin duplicar splits).</p>}
 </React.Fragment>}
 {canViewTeam&&<p style={{fontSize:12,color:'#536454'}}>Diagnóstico de estructura: {teamIds.length} integrantes asignados; {rows.length} pólizas accesibles; {teamSubmitted.length} pólizas con participación del equipo en este mes.</p>}
 <p style={{fontSize:12,color:'#536454',marginTop:14}}>Datos preliminares de pólizas visibles según permisos. Issue Paid es reportada, no confirmada por aseguradora. Los splits no duplican la AP total visible; la AP de equipo incluye la participación del líder y su estructura autorizada. No sumes personal y equipo.</p>
 </section>
 <div style={{display:'flex',gap:10,margin:'14px 0 22px'}}><button style={inp} onClick={()=>setTab('list')}>Mis ventas / Producción</button><button style={inp} onClick={()=>setTab('new')}>＋ Nueva póliza</button></div>
 {editing&&<section style={{padding:18,background:'#fff',border:'1px solid #bad1be',borderRadius:10,marginBottom:16}}>
  <h2 style={{fontSize:18}}>Actualizar estado de póliza</h2>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   {field('Estado *',<select style={inp} value={editing.status} onChange={e=>setEditing(v=>({...v,status:e.target.value}))}>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select>)}
   {field('Fecha de aprobación',<input type="date" style={inp} value={editing.approved_on} onChange={e=>setEditing(v=>({...v,approved_on:e.target.value}))}/>)}
   {field('Fecha Issue Paid',<input type="date" style={inp} value={editing.issue_paid_on} onChange={e=>setEditing(v=>({...v,issue_paid_on:e.target.value}))}/>)}
  </div>
  <div style={{display:'flex',gap:10,marginTop:12}}>
   <button disabled={statusSaving} onClick={saveStatus} style={{background:'#14713d',color:'#fff',padding:10,border:0,borderRadius:7}}>{statusSaving?'Guardando…':'Guardar estado'}</button>
   <button onClick={()=>setEditing(null)} type="button">Cancelar</button>
  </div>
 </section>}
 {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}{notice&&<p role="status" style={{color:'#24773f'}}>{notice}</p>}
 {tab==='new'?<form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,background:'#fff',padding:22,border:'1px solid #dae5d9',borderRadius:12}}>
 {field('Nombre del cliente *',<input required maxLength={150} style={inp} value={form.client} onChange={e=>change('client',e.target.value)}/>)}
 {field('Número de póliza (cuando esté asignado)',<input maxLength={80} style={inp} value={form.number} onChange={e=>change('number',e.target.value)}/>)}
 {field('Aseguradora *',<select style={inp} value={form.carrier} onChange={e=>change('carrier',e.target.value)}>{carriers.map(c=><option key={c}>{c}</option>)}</select>)}
 {field('Tipo de póliza *',<select style={inp} value={form.product} onChange={e=>change('product',e.target.value)}>{products.map(c=><option key={c}>{c}</option>)}</select>)}
 {field('Origen del lead *',<select style={inp} value={form.source} onChange={e=>change('source',e.target.value)}>{sources.map(c=><option key={c}>{c}</option>)}</select>)}
 {form.source==='Otro'&&field('Especifica el origen *',<input required style={inp} value={form.other} onChange={e=>change('other',e.target.value)}/>)}
 {field('Prima anualizada (AP) USD *',<input style={inp} required type="number" step="0.01" min="0.01" value={form.ap} onChange={e=>change('ap',e.target.value)}/>)}
 {field('Fecha de sometida *',<input style={inp} required type="date" value={form.date} onChange={e=>change('date',e.target.value)}/>)}
 {user.role==='admin'&&field('Agente principal *',<select style={inp} value={form.primary} onChange={e=>change('primary',e.target.value)}><option value="">Administración (mi cuenta)</option>{agents.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select>)}
 {user.role==='admin'&&field('Split con otro agente (opcional)',<select style={inp} value={form.split} onChange={e=>change('split',e.target.value)}><option value="">Sin split</option>{agents.filter(a=>a.id!==(form.primary||user.id)).map(a=><option value={a.id} key={a.id}>{a.full_name}</option>)}</select>)}
 {form.split&&field('Porcentaje del agente principal *',<input style={inp} type="number" min="1" max="99" step=".01" value={form.pct} onChange={e=>change('pct',e.target.value)}/>)}
 <div style={{gridColumn:'1/-1',fontSize:13,color:'#536454'}}>Estado inicial: <strong>Sometida</strong>. En un split, el porcentaje del segundo agente es {100-Number(form.pct||0)}%. En esta primera versión, las asignaciones de split se realizan desde Administración.</div>
 <button disabled={saving} style={{padding:12,background:'#1a7440',color:'#fff',border:0,borderRadius:8,fontWeight:700,gridColumn:'1/-1'}}>{saving?'Guardando…':'Guardar póliza'}</button>
 </form>:<div style={{overflowX:'auto',background:'#fff',borderRadius:10,padding:12}}>{busy?<p>Cargando pólizas…</p>:<React.Fragment><p><strong>{rows.length}</strong> pólizas visibles según tus permisos <button type="button" onClick={load} disabled={busy} style={{marginLeft:12,background:'#176b3b',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,cursor:'pointer'}}>↻ Actualizar pólizas</button></p><table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}><thead><tr>{['Fecha','Cliente','Núm. póliza','Compañía','Producto','Lead','Estado','AP','Split','Acción'].map(k=><th key={k} style={{padding:10,textAlign:'left',borderBottom:'1px solid #ddd'}}>{k}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{[r.submitted_on,r.client_name,r.policy_number||'Pendiente',r.carrier,r.product_type,r.lead_source,r.status,'$'+Number(r.annual_premium).toLocaleString('en-US'),r.split_agent_id?(r.agent_id===user.id?user.name:(agents.find(a=>a.id===r.agent_id)?.full_name||'Agente principal'))+': '+r.split_primary_pct+'% ('+((r.annual_premium*r.split_primary_pct/100).toFixed(2))+' USD) / '+(agents.find(a=>a.id===r.split_agent_id)?.full_name||'Agente compartido')+': '+(100-r.split_primary_pct)+'% ('+((r.annual_premium*(100-r.split_primary_pct)/100).toFixed(2))+' USD)':'—'].map((v,i)=><td key={i} style={{padding:10,borderBottom:'1px solid #eee'}}>{v}</td>)}<td style={{padding:10,borderBottom:'1px solid #eee'}}>{(user.role==='admin'||r.agent_id===user.id)&&<button onClick={()=>editStatus(r)} type="button">Cambiar estado</button>}</td></tr>)}</tbody></table>{!rows.length&&<p>Aún no hay pólizas registradas.</p>}</React.Fragment>}</div>}
 </div>;
}
window.ProductionCenter=ProductionCenter;