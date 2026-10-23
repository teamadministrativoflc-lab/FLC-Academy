function ProductionCenter({user,setPage}) {
 const sources=['AuraFlow','LifeButton','LeadzTech AI','Ecomfy','Leads for Life','Propia campaña','Referido','Familiar / Amistad','Otro'];
 const carriers=['National Life Group','F&G','Foresters','American Amicable','Transamerica','Mutual of Omaha','Aetna','Americo','Lincoln Heritage','Occidental','Corebridge','Athene','Otro'];
 const products=['IUL','Term','Whole Life','Final Expense','Annuity','Mortgage Protection','Key Man','Executive Bonus','Otro'];
 const blank=()=>({client:'',number:'',carrier:'National Life Group',product:'IUL',source:'AuraFlow',other:'',ap:'',split:'',pct:'50',date:new Date().toISOString().slice(0,10)});
 const [form,setForm]=React.useState(blank),[agents,setAgents]=React.useState([]),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(true),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[tab,setTab]=React.useState('list');
 const load=async()=>{setBusy(true);setError('');const {data,error}=await window.flcSupabase.from('flc_policy_sales').select('id,agent_id,client_name,carrier,product_type,policy_number,lead_source,status,annual_premium,split_agent_id,split_primary_pct,submitted_on,created_at').order('created_at',{ascending:false}).limit(250);if(error){setError('El registro aún no está habilitado en Supabase o no tienes acceso.');}else setRows(data||[]);setBusy(false);};
 React.useEffect(()=>{load();const fetchAgents=async()=>{const {data}=await window.flcSupabase.rpc('flc_admin_team_roster');if(user.role==='admin'&&data)setAgents(data);};fetchAgents();},[user.id]);
 const field=(label,child)=><label style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,fontWeight:600}}>{label}{child}</label>;
 const inp={padding:10,border:'1px solid #ccd8cd',borderRadius:7,width:'100%',fontSize:14,background:'#fff'};
 const change=(k,v)=>setForm(x=>({...x,[k]:v}));
 const submit=async e=>{e.preventDefault();setError('');setNotice('');if(form.split && (Number(form.pct)<=0||Number(form.pct)>=100)){setError('El porcentaje principal debe ser mayor de 0 y menor de 100.');return;}
 setSaving(true);const {error}=await window.flcSupabase.rpc('flc_create_policy',{p_client_name:form.client,p_policy_number:form.number||null,p_carrier:form.carrier,p_product_type:form.product,p_lead_source:form.source,p_lead_source_other:form.source==='Otro'?form.other:null,p_annual_premium:Number(form.ap),p_split_agent_id:form.split||null,p_split_primary_pct:form.split?Number(form.pct):100,p_submitted_on:form.date});setSaving(false);
 if(error){setError(error.code==='23505'?'Ya hay una póliza registrada con ese número y compañía.':error.message||'No se pudo guardar.');return;}
 setNotice('Póliza registrada. Queda en estado Sometida hasta la validación administrativa.');setForm(blank());setTab('list');await load();};
 return <div style={{padding:28,maxWidth:1250,margin:'auto'}}>
 <button onClick={()=>setPage('dashboard')}>← Inicio</button><h1>FLC Production Center</h1><p>Registra pólizas, consulta su estado y lleva control de splits. Solo Administración puede validar cambios de estado.</p>
 <div style={{display:'flex',gap:10,margin:'14px 0 22px'}}><button style={inp} onClick={()=>setTab('list')}>Mis ventas / Producción</button><button style={inp} onClick={()=>setTab('new')}>＋ Nueva póliza</button></div>
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
 {user.role==='admin'&&field('Split con otro agente (opcional)',<select style={inp} value={form.split} onChange={e=>change('split',e.target.value)}><option value="">Sin split</option>{agents.filter(a=>a.id!==user.id).map(a=><option value={a.id} key={a.id}>{a.full_name}</option>)}</select>)}
 {form.split&&field('Porcentaje del agente principal *',<input style={inp} type="number" min="1" max="99" step=".01" value={form.pct} onChange={e=>change('pct',e.target.value)}/>)}
 <div style={{gridColumn:'1/-1',fontSize:13,color:'#536454'}}>Estado inicial: <strong>Sometida</strong>. En un split, el porcentaje del segundo agente es {100-Number(form.pct||0)}%. En esta primera versión, las asignaciones de split se realizan desde Administración.</div>
 <button disabled={saving} style={{padding:12,background:'#1a7440',color:'#fff',border:0,borderRadius:8,fontWeight:700,gridColumn:'1/-1'}}>{saving?'Guardando…':'Guardar póliza'}</button>
 </form>:<div style={{overflowX:'auto',background:'#fff',borderRadius:10,padding:12}}>{busy?<p>Cargando pólizas…</p>:<React.Fragment><p><strong>{rows.length}</strong> pólizas visibles según tus permisos <button onClick={load}>Actualizar</button></p><table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}><thead><tr>{['Fecha','Cliente','Núm. póliza','Compañía','Producto','Lead','Estado','AP','Split'].map(k=><th key={k} style={{padding:10,textAlign:'left',borderBottom:'1px solid #ddd'}}>{k}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{[r.submitted_on,r.client_name,r.policy_number||'Pendiente',r.carrier,r.product_type,r.lead_source,r.status,'$'+Number(r.annual_premium).toLocaleString('en-US'),r.split_agent_id?r.split_primary_pct+'% / '+(100-r.split_primary_pct)+'%':'—'].map((v,i)=><td key={i} style={{padding:10,borderBottom:'1px solid #eee'}}>{v}</td>)}</tr>)}</tbody></table>{!rows.length&&<p>Aún no hay pólizas registradas.</p>}</React.Fragment>}</div>}
 </div>;
}
window.ProductionCenter=ProductionCenter;