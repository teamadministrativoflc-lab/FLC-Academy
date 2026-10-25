function LiveSalesFeed({user}) {
 const [open,setOpen]=React.useState(false);
 const [rows,setRows]=React.useState([]);
 const [error,setError]=React.useState('');
 const [unread,setUnread]=React.useState(0);
 const [recentToast,setRecentToast]=React.useState(null);
 const known=React.useRef(new Set());
 const initialized=React.useRef(false);
 const openRef=React.useRef(false);
 React.useEffect(()=>{openRef.current=open;if(open)setUnread(0);},[open]);
 const load=React.useCallback(async()=>{
  const {data,error}=await window.flcSupabase.from('flc_sale_announcements')
   .select('policy_id,principal_name,client_name,carrier,product_type,total_ap,status,participants,announced_at')
   .order('announced_at',{ascending:false}).limit(30);
  if(error){setError('No se pudo cargar Ventas en Vivo. Revisa SQL 021.');return;}
  setError('');const incoming=data||[];
  if(initialized.current){
   const fresh=incoming.filter(x=>!known.current.has(x.policy_id));
   if(fresh.length){
    if(!openRef.current)setUnread(n=>n+fresh.length);
    setRecentToast(fresh[0]);
   }
  }
  incoming.forEach(x=>known.current.add(x.policy_id));
  initialized.current=true;
  setRows(incoming);
 },[]);
 React.useEffect(()=>{
  if(!user?.id)return;
  initialized.current=false;known.current=new Set();setRows([]);setUnread(0);
  load();
  let timer=null;
  const delayed=()=>{if(timer)clearTimeout(timer);timer=setTimeout(load,550);};
  const channel=window.flcSupabase.channel('flc-sales-live-'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'flc_sale_announcements'},delayed)
   .subscribe();
  window.addEventListener('flc:new-sale',delayed);
  const backup=setInterval(load,20000);
  return()=>{if(timer)clearTimeout(timer);clearInterval(backup);window.removeEventListener('flc:new-sale',delayed);window.flcSupabase.removeChannel(channel);};
 },[user?.id,load]);
 React.useEffect(()=>{if(!recentToast)return;const t=setTimeout(()=>setRecentToast(null),6500);return()=>clearTimeout(t);},[recentToast]);
 const money=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const people=r=>Array.isArray(r.participants)?r.participants:[];
 const message=r=>{
  const ps=people(r);
  return ['🎉 ¡NUEVA VENTA!','',
   '👤 Agente principal: '+r.principal_name,
   '🤝 Cliente: '+r.client_name,
   ...(ps.length>1?['🤝 Venta en equipo (split):',...ps.map(p=>'• '+p.name+' — '+Number(p.percent)+'% ('+money(p.credited_ap)+')')]:[]),
   '🏢 Compañía: '+r.carrier,
   '📄 Producto: '+r.product_type,
   '💰 AP total: '+money(r.total_ap),
   '📋 Estado: '+(r.status||'Sometida'),
   '',
   '💪🔥 ¡Felicidades '+(ps.length>1?ps.map(p=>p.name.split(' ')[0]).join(' y '):r.principal_name.split(' ')[0])+'! ¡Seguimos construyendo legados!'].join('\n');
 };
 const copy=async r=>{try{await navigator.clipboard.writeText(message(r));setError('✓ Mensaje copiado para compartir.');}catch(e){setError('No se pudo copiar. Usa Compartir por WhatsApp.');}};
 const whatsApp=r=>window.open('https://wa.me/?text='+encodeURIComponent(message(r)),'_blank','noopener,noreferrer');
 const frame={position:'fixed',right:20,bottom:84,zIndex:1000,width:'min(390px,calc(100vw - 32px))',height:'min(570px,calc(100vh - 130px))',background:'#fff',border:'1px solid #d6e3d4',borderRadius:16,boxShadow:'0 16px 48px rgba(0,0,0,.2)',display:'flex',flexDirection:'column',overflow:'hidden'};
 return <React.Fragment>
  {recentToast&&!open&&<button type="button" onClick={()=>{setOpen(true);setRecentToast(null);}} style={{position:'fixed',right:20,bottom:156,zIndex:1001,background:'#e9f6e8',border:'1px solid #98c69c',borderRadius:12,padding:14,maxWidth:320,boxShadow:'0 8px 25px #0002',textAlign:'left',fontWeight:600,color:'#15572e'}}>🎉 ¡Nueva venta de {recentToast.principal_name}!<div style={{fontSize:13}}>{money(recentToast.total_ap)} AP · Abrir anuncio</div></button>}
  {open&&<aside aria-label="FLC Ventas en Vivo" style={frame}>
   <div style={{background:'#184c30',color:'#fff',padding:'15px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><strong>🎉 FLC Ventas en Vivo</strong><div style={{fontSize:12,opacity:.8}}>Celebramos cada nueva póliza</div></div><button type="button" aria-label="Cerrar" onClick={()=>setOpen(false)} style={{color:'#fff',fontSize:25}}>×</button></div>
   <div style={{padding:12,overflowY:'auto',flex:1,background:'#f8faf6',display:'flex',flexDirection:'column',gap:12}}>
    {error&&<p role="status" style={{fontSize:12,color:'#92521b'}}>{error}</p>}
    {!rows.length&&!error&&<p style={{fontSize:13,color:'#617565'}}>Las próximas ventas aparecerán aquí automáticamente.</p>}
    {rows.map(r=><article key={r.policy_id} style={{borderLeft:'4px solid #22a06b',background:'#e8f3e9',borderRadius:12,padding:14,color:'#185335'}}>
     <strong style={{fontSize:17}}>🎉 ¡NUEVA VENTA!</strong>
     <div style={{marginTop:9,fontSize:13,lineHeight:1.7}}>
      <div>👤 Principal: <b>{r.principal_name}</b></div>
      <div>🤝 Cliente: <b>{r.client_name}</b></div>
      {people(r).length>1&&<div><b>🤝 Split:</b>{people(r).map((p,i)=><div key={i} style={{paddingLeft:16}}>{p.name} · {Number(p.percent)}% · {money(p.credited_ap)}</div>)}</div>}
      <div>🏢 Compañía: <b>{r.carrier}</b></div>
      <div>📄 Producto: <b>{r.product_type}</b></div>
      <div>💰 AP total: <b>{money(r.total_ap)}</b></div>
      <div>📋 Estado al reportar: <b>{r.status||'Sometida'}</b></div>
     </div>
     <p style={{fontWeight:700,margin:'10px 0'}}>💪🔥 ¡Felicidades por esta venta!</p>
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>copy(r)} style={{background:'#fff',border:'1px solid #a6cbb0',borderRadius:7,padding:'7px 9px',fontSize:12}}>📋 Copiar mensaje</button><button type="button" onClick={()=>whatsApp(r)} style={{background:'#1b834c',color:'#fff',borderRadius:7,padding:'7px 9px',fontSize:12}}>📲 Compartir por WhatsApp</button></div>
     <div style={{fontSize:11,color:'#64806e',textAlign:'right',marginTop:8}}>{new Date(r.announced_at).toLocaleString('es-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
    </article>)}
   </div>
   <div style={{padding:'9px 14px',fontSize:11,color:'#657869',borderTop:'1px solid #dae6dc'}}>Solo lectura · El usuario selecciona el grupo y confirma el envío. Incluye nombre del cliente: comparte solo en el grupo autorizado.</div>
  </aside>}
  <button type="button" aria-label="Abrir FLC Ventas en Vivo" onClick={()=>setOpen(x=>!x)} style={{position:'fixed',right:22,bottom:22,zIndex:1000,background:'#184c30',color:'white',borderRadius:'50%',width:58,height:58,fontSize:25,boxShadow:'0 6px 22px #0004',border:'3px solid #a5d670'}}>💬{unread>0&&!open&&<span style={{position:'absolute',right:-5,top:-7,borderRadius:20,background:'#db4747',color:'white',fontSize:12,padding:'2px 6px'}}>{unread}</span>}</button>
 </React.Fragment>;
}
