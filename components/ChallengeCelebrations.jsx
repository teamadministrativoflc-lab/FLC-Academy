function ChallengeCelebrations({user}) {
 const [open,setOpen]=React.useState(false);
 const [rows,setRows]=React.useState([]);
 const [error,setError]=React.useState('');
 const [toast,setToast]=React.useState(null);
 const [unread,setUnread]=React.useState(0);
 const [demo,setDemo]=React.useState(false);
 const known=React.useRef(new Set());
 const initialized=React.useRef(false);
 const openRef=React.useRef(false);
 React.useEffect(()=>{openRef.current=open;if(open)setUnread(0);},[open]);
 const load=React.useCallback(async()=>{
  const {data,error}=await window.flcSupabase.rpc('flc_visible_challenge_celebrations');
  if(error){setError('Celebraciones disponibles después de ejecutar SQL 031.');return;}
  const next=data||[];
  if(initialized.current){
   const fresh=next.filter(x=>!known.current.has(x.reward_id));
   if(fresh.length){if(!openRef.current)setUnread(n=>n+fresh.length);setToast(fresh[0]);}
  }
  next.forEach(x=>known.current.add(x.reward_id));
  initialized.current=true;setRows(next);setError('');
 },[]);
 React.useEffect(()=>{
  if(!user?.id)return;
  initialized.current=false;known.current=new Set();setRows([]);load();
  const interval=setInterval(load,30000);
  const channel=window.flcSupabase.channel('flc-challenge-celebrations-'+user.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'flc_challenge_rewards'},()=>load()).subscribe();
  return()=>{clearInterval(interval);window.flcSupabase.removeChannel(channel);};
 },[user?.id,load]);
 React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),6500);return()=>clearTimeout(t);},[toast]);
 const unit=r=>r.metric==='submitted_policies'?Number(r.goal_value).toLocaleString('es-US')+' pólizas':
  Number(r.goal_value).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const metric=r=>({verified_ap:'AP Issue Paid verificada',submitted_ap:'AP sometida',submitted_policies:'Pólizas sometidas'})[r.metric]||'Producción';
 const copyText=r=>['🏆🎉 *¡NUEVO CAMPEÓN FLC!*','',
  '⭐ *'+r.participant_name+'*',
  '🏅 *Reto:* '+r.challenge_title,
  '🎯 *Meta lograda:* '+unit(r)+' · '+metric(r),'',
  '💚 ¡Seguimos construyendo legados!'].join('\n');
 const plainText=r=>['*NUEVO CAMPEON FLC*','',
  '*Participante:* '+r.participant_name,
  '*Reto:* '+r.challenge_title,
  '*Meta lograda:* '+unit(r)+' - '+metric(r),'',
  'Felicidades! Seguimos construyendo legados!'].join('\n');
 const copy=async r=>{try{await navigator.clipboard.writeText(copyText(r));setError('Mensaje con emojis copiado.');}
  catch(e){setError('No fue posible copiar el mensaje.');}};
 const share=r=>window.open('https://wa.me/?text='+encodeURIComponent(plainText(r)),'_blank','noopener,noreferrer');
 const sample={reward_id:'demo',participant_name:'Agente de ejemplo',challenge_title:'Reto de ejemplo',metric:'verified_ap',goal_value:10000,earned_at:new Date().toISOString(),isDemo:true};
 const shown=demo?[sample,...rows]:rows;
 const toggle=()=>setOpen(v=>!v);
 return <React.Fragment>
  {toast&&!open&&<button type="button" onClick={toggle} style={{position:'fixed',right:90,bottom:225,zIndex:1002,background:'#fff6d9',border:'1px solid #d3a744',borderRadius:10,padding:12,fontWeight:700,maxWidth:260}}>🏅 ¡Meta lograda por {toast.participant_name}! Ver</button>}
  {open&&<aside aria-label="Celebraciones de retos FLC" style={{position:'fixed',right:20,bottom:270,zIndex:1005,width:'min(410px,calc(100vw - 32px))',height:'min(515px,calc(100vh - 300px))',background:'#fff',border:'1px solid #dfca8c',boxShadow:'0 12px 40px #0003',borderRadius:13,display:'flex',flexDirection:'column',overflow:'hidden'}}>
   <div style={{background:'#775716',color:'#fff',padding:13,display:'flex',justifyContent:'space-between'}}>
    <strong>🏅 Campeones de Retos FLC</strong><button onClick={()=>setOpen(false)} style={{color:'#fff',fontSize:22}} aria-label="Cerrar">×</button>
   </div>
   <div style={{padding:12,overflowY:'auto',flex:1,background:'#fffdf7'}}>
    {user.role==='admin'&&<button onClick={()=>setDemo(v=>!v)} style={{padding:9,border:'1px solid #cfad6d',borderRadius:7,marginBottom:10}}>{demo?'Ocultar ejemplo':'Ver ejemplo sin publicar'}</button>}
    {error&&<p role="status" style={{fontSize:12,color:'#8b5f22'}}>{error}</p>}
    {!shown.length&&!error&&<p>Las celebraciones aparecerán cuando se registren metas alcanzadas.</p>}
    {shown.map(r=><article key={r.reward_id} style={{padding:14,marginBottom:10,background:'#fff',border:'1px solid #ddce9c',borderRadius:10}}>
     {r.isDemo&&<p style={{color:'#a05a18',fontWeight:700}}>EJEMPLO · NO PUBLICADO</p>}
     <div style={{fontSize:17,fontWeight:700,color:'#775313'}}>🏆 ¡NUEVO CAMPEÓN FLC!</div>
     <p style={{margin:'8px 0'}}><strong>{r.participant_name}</strong><br/>🏅 {r.challenge_title}</p>
     <p style={{fontSize:13}}>Meta: <strong>{unit(r)} · {metric(r)}</strong></p>
     <p style={{fontSize:13,color:'#206539'}}>¡Seguimos construyendo legados!</p>
     {!r.isDemo&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button type="button" onClick={()=>copy(r)} style={{background:'#ecf4e4',padding:'8px 10px',borderRadius:7}}>📋 Copiar con emojis</button>
      <button type="button" onClick={()=>share(r)} style={{background:'#176d3a',color:'#fff',padding:'8px 10px',borderRadius:7}}>📲 WhatsApp</button>
     </div>}
    </article>)}
   </div>
   <p style={{fontSize:11,color:'#706545',padding:10,margin:0}}>Reconocimientos de metas registradas; WhatsApp requiere elegir el grupo y enviar.</p>
  </aside>}
  <button type="button" onClick={toggle} aria-label="Abrir celebraciones de retos" style={{position:'fixed',right:22,bottom:225,zIndex:1000,width:55,height:55,borderRadius:'50%',background:'#c7a447',border:'3px solid #f4de8a',boxShadow:'0 5px 18px #0003',fontSize:23}}>🏅{unread>0&&!open&&<span style={{position:'absolute',right:-6,top:-6,background:'#c33',color:'#fff',borderRadius:18,padding:'2px 6px',fontSize:12}}>{unread}</span>}</button>
 </React.Fragment>;
}
