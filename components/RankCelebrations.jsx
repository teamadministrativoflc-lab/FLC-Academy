function RankCelebrations({user}) {
 const [open,setOpen]=React.useState(false);
 const [rows,setRows]=React.useState([]);
 const [error,setError]=React.useState('');
 const [unread,setUnread]=React.useState(0);
 const [toast,setToast]=React.useState(null);
 const [demo,setDemo]=React.useState(false);
 const known=React.useRef(new Set());
 const initialized=React.useRef(false);
 const openRef=React.useRef(false);
 React.useEffect(()=>{openRef.current=open;if(open)setUnread(0);},[open]);
 const levels={SM:'Sales Manager',SSM:'Senior Sales Manager',VP:'Vice President',SVP:'Senior Vice President',EVP:'Executive Vice President',BM:'Board Member',SBM:'Senior Board Member',EBM:'Executive Board Member',CM:'Council Member',SCM:'Senior Council Member',ECM:'Executive Council Member',CCM:'Chairman Council Member',SP:'Senior Partner',EP:'Executive Partner',MP:'Managing Partner'};
 const money=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const rank=code=>levels[code]?code+' · '+levels[code]:code||'Sin título';
 const load=React.useCallback(async()=>{
  const {data,error}=await window.flcSupabase.from('flc_rank_announcements')
   .select('history_id,agent_id,agent_name,old_rank,new_rank,team_verified_ap,personal_verified_ap,evaluation_month,announced_at')
   .order('announced_at',{ascending:false}).limit(25);
  if(error){setError('Celebraciones todavía no disponibles. Comprueba que SQL 026 esté activado.');return;}
  const incoming=data||[];
  if(initialized.current){
   const fresh=incoming.filter(x=>!known.current.has(x.history_id));
   if(fresh.length){if(!openRef.current)setUnread(n=>n+fresh.length);setToast(fresh[0]);}
  }
  incoming.forEach(x=>known.current.add(x.history_id));
  initialized.current=true;setRows(incoming);setError('');
 },[]);
 React.useEffect(()=>{
  if(!user?.id)return;
  initialized.current=false;known.current=new Set();setRows([]);load();
  const channel=window.flcSupabase.channel('flc-rank-celebrations-'+user.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'flc_rank_announcements'},()=>load())
   .subscribe();
  const timer=setInterval(load,20000);
  const close=()=>setOpen(false);
  window.addEventListener('flc:sales-panel-open',close);
  return()=>{clearInterval(timer);window.flcSupabase.removeChannel(channel);window.removeEventListener('flc:sales-panel-open',close);};
 },[user?.id,load]);
 React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),6500);return()=>clearTimeout(t);},[toast]);
 const plain=r=>[
  '*NUEVO ASCENSO - FUTURE LEGACY CREATORS*','',
  '*Agente:* '+r.agent_name,
  '*Nuevo título:* '+rank(r.new_rank),
  ...(r.old_rank?['*Título anterior:* '+rank(r.old_rank)]:[]),
  '*AP Issue Paid verificada del equipo:* '+money(r.team_verified_ap),
  '*Mes del logro:* '+r.evaluation_month.slice(0,7),'',
  '*¡Felicidades por este logro de liderazgo!*',
  '¡Seguimos construyendo legados!'
 ].join('\n');
 const emoji=r=>[
  '🎉🏆 *¡NUEVO ASCENSO EN FUTURE LEGACY CREATORS!*','',
  '⭐ *Agente:* '+r.agent_name,
  '🏅 *Nuevo título:* '+rank(r.new_rank),
  ...(r.old_rank?['📈 *Título anterior:* '+rank(r.old_rank)]:[]),
  '💰 *AP Issue Paid verificada del equipo:* '+money(r.team_verified_ap),
  '📅 *Mes del logro:* '+r.evaluation_month.slice(0,7),'',
  '🔥💚 *¡Felicidades por este gran logro!*',
  '¡Seguimos construyendo legados!'
 ].join('\n');
 const copy=async r=>{try{await navigator.clipboard.writeText(emoji(r));setError('✓ Mensaje con emojis copiado. Pégalo en WhatsApp.');}catch(e){setError('No fue posible copiar al portapapeles.');}};
 const whatsApp=r=>window.open('https://wa.me/?text='+encodeURIComponent(plain(r)),'_blank','noopener,noreferrer');
 const sample={history_id:'demo',agent_name:'Agente de ejemplo',old_rank:null,new_rank:'SM',team_verified_ap:50000,personal_verified_ap:10000,evaluation_month:'2026-10-01',announced_at:new Date().toISOString(),isDemo:true};
 const display=demo?[sample,...rows]:rows;
 const toggle=()=>{setOpen(v=>!v);window.dispatchEvent(new Event('flc:rank-panel-open'));};
 const frame={position:'fixed',right:20,bottom:155,zIndex:1000,width:'min(400px,calc(100vw - 32px))',height:'min(565px,calc(100vh - 215px))',background:'#fff',border:'1px solid #e4d5aa',borderRadius:16,boxShadow:'0 16px 48px rgba(0,0,0,.2)',display:'flex',flexDirection:'column',overflow:'hidden'};
 return <React.Fragment>
  {toast&&!open&&<button type="button" onClick={toggle} style={{position:'fixed',right:88,bottom:90,zIndex:1001,background:'#fff4d1',border:'1px solid #ccad50',padding:12,borderRadius:10,maxWidth:290,fontWeight:700,color:'#654b0b'}}>🏆 ¡Nuevo ascenso de {toast.agent_name}! Abrir</button>}
  {open&&<aside aria-label="Celebraciones de ascensos FLC" style={frame}>
   <div style={{background:'#75551b',color:'#fff',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
    <strong>🏆 Ascensos FLC en Vivo</strong>
    <button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar" style={{color:'#fff',fontSize:23}}>×</button>
   </div>
   <div style={{flex:1,overflowY:'auto',padding:12,background:'#fffbf2',display:'flex',flexDirection:'column',gap:10}}>
    {user.role==='admin'&&<button type="button" onClick={()=>setDemo(v=>!v)} style={{padding:9,background:'#fff',border:'1px solid #d4bd86',borderRadius:8}}>{demo?'Ocultar ejemplo':'Ver ejemplo sin publicar'}</button>}
    {error&&<p role="status" style={{color:'#8a5e18',fontSize:12}}>{error}</p>}
    {!display.length&&!error&&<p style={{fontSize:13,color:'#75633c'}}>Cuando un líder gane un nuevo título verificado, su celebración aparecerá aquí.</p>}
    {display.map(r=><article key={r.history_id} style={{padding:14,background:'#fff',border:'1px solid #e0c98f',borderLeft:'4px solid #b98e29',borderRadius:10}}>
     {r.isDemo&&<p style={{color:'#a45b14',fontWeight:700,margin:'0 0 8px'}}>EJEMPLO · NO PUBLICADO</p>}
     <div style={{fontSize:18,fontWeight:700,color:'#805f17'}}>🎉🏆 ¡NUEVO ASCENSO!</div>
     <p><strong>{r.agent_name}</strong><br/>⭐ {rank(r.new_rank)}</p>
     {r.old_rank&&<p style={{fontSize:12}}>Título anterior: {rank(r.old_rank)}</p>}
     <p style={{fontSize:13}}>💰 AP Issue Paid verificada del equipo: <strong>{money(r.team_verified_ap)}</strong><br/>📅 Mes: {r.evaluation_month.slice(0,7)}</p>
     <p style={{fontWeight:700,color:'#15582e'}}>💚 ¡Seguimos construyendo legados!</p>
     {!r.isDemo&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button type="button" onClick={()=>copy(r)} style={{padding:'8px 10px',border:'1px solid #c6af77',borderRadius:8,background:'#fff'}}>📋 Copiar con emojis</button>
      <button type="button" onClick={()=>whatsApp(r)} style={{padding:'8px 10px',border:0,borderRadius:8,background:'#177846',color:'#fff'}}>📲 WhatsApp</button>
     </div>}
     <p style={{margin:0,fontSize:11,color:'#867b5d',textAlign:'right'}}>{new Date(r.announced_at).toLocaleString('es-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p>
    </article>)}
   </div>
   <p style={{padding:'8px 13px',margin:0,fontSize:11,color:'#685a33'}}>Solo ascensos confirmados por producción verificada. Compartir a WhatsApp requiere elegir el grupo y enviar.</p>
  </aside>}
  <button className="flc-float-ranks" type="button" onClick={toggle} aria-label="Abrir celebraciones de rango" style={{position:'fixed',right:22,bottom:91,zIndex:1000,borderRadius:'50%',height:58,width:58,border:'3px solid #e8ca67',background:'#7b5916',color:'#fff',fontSize:25,boxShadow:'0 5px 20px #0004'}}>🏆{unread>0&&!open&&<span style={{position:'absolute',right:-5,top:-7,borderRadius:20,background:'#db4747',fontSize:12,padding:'2px 6px'}}>{unread}</span>}</button>
 </React.Fragment>;
}
window.RankCelebrations=RankCelebrations;
