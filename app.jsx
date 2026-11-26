function ZoomIdentityLinkButton({lang}) {
  const [busy,setBusy]=React.useState(false);
  const [message,setMessage]=React.useState('');
  const start=async()=>{
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      const {data:session,error:sessionError}=await window.flcSupabase.auth.getSession();
      if(sessionError||!session?.session?.access_token)throw new Error('Inicia sesión nuevamente en FLC Academy.');
      const {data,error}=await window.flcSupabase.functions.invoke('zoom-identity-start',{body:{}});
      if(error) {
        let detail='';
        try {detail=(await error.context?.json?.())?.error||'';} catch {}
        throw new Error(detail||error.message||'No se pudo iniciar la autorización.');
      }
      if(!data?.authorization_url||!data.authorization_url.startsWith('https://zoom.us/oauth/authorize?'))
        throw new Error('La autorización no devolvió una dirección válida.');
      // Navigation occurs only on the user's explicit click.
      window.location.assign(data.authorization_url);
    }catch(e){setMessage(e?.message||'Error al conectar Zoom.');setBusy(false);}
  };
  return <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',padding:'4px 0'}}>
    <span style={{fontSize:12,fontWeight:800,background:'#c2f58e',color:'#183a20',padding:'8px 11px',borderRadius:30,boxShadow:'0 2px 7px rgba(46,86,28,.14)',whiteSpace:'nowrap'}}>{lang==='en'?'Step 1':'Paso 1'}</span>
    <button type="button" onClick={start} disabled={busy} title={lang==='en'?'Connect your Zoom account securely':'Conecta tu cuenta de Zoom de forma segura'} style={{display:'inline-flex',alignItems:'center',gap:11,padding:'12px 22px',border:'2px solid #74ae38',borderRadius:28,background:'linear-gradient(110deg,#245b22,#4e911e)',color:'#fff',fontSize:17,fontWeight:800,letterSpacing:'.1px',boxShadow:'0 5px 14px rgba(60,120,30,.28)',cursor:busy?'wait':'pointer',opacity:busy?.7:1,whiteSpace:'nowrap'}}>
      <span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',height:27,width:30,borderRadius:7,background:'#3f8cef',fontSize:18}}>📹</span>
      {busy?'Conectando…':lang==='en'?'Connect your Zoom':'Conecta tu Zoom'}
    </button>
    {message&&<span role="alert" style={{fontSize:12,color:'#a32626',maxWidth:270}}>{message}</span>}
  </div>;
}

function App() {
  const [mobileOpen,setMobileOpen]=React.useState(false);
  const [mobileDockOpen,setMobileDockOpen]=React.useState(false);
  const [lang, setLang] = React.useState(() => localStorage.getItem('flc_lang') || 'es');
  const [user, setUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [isLeader,setIsLeader]=React.useState(false);
  const [rankLabel,setRankLabel]=React.useState('Cargando título…');
  React.useEffect(()=>{
    if(!user?.id){setRankLabel('');return;}
    if(user.role==='admin'){setRankLabel('Administración');return;}
    let active=true;
    setRankLabel('Cargando título…');
    window.flcSupabase.from('flc_rank_profiles').select('current_rank').eq('agent_id',user.id).maybeSingle().then(({data,error})=>{
      if(!active)return;
      if(error){setRankLabel('Título no disponible');return;}
      const labels={SM:'Sales Manager',SSM:'Senior Sales Manager',VP:'Vice President (VP)',SVP:'Senior Vice President',EVP:'Executive Vice President',BM:'Board Member',SBM:'Senior Board Member',EBM:'Executive Board Member',CM:'Council Member',SCM:'Senior Council Member',ECM:'Executive Council Member',CCM:'Chairman Council Member',SP:'Senior Partner',EP:'Executive Partner',MP:'Managing Partner'};
      setRankLabel(data?.current_rank?(labels[data.current_rank]||data.current_rank):'Sin título');
    });
    return()=>{active=false;};
  },[user?.id,user?.role]);
  React.useEffect(() => {
    let mounted = true;
    async function load(session) {
      if (!session) { if (mounted) { setUser(null); setAuthReady(true); } return; }
      const {data:profile,error} = await window.flcSupabase.from('agent_profiles').select('full_name,role').eq('id',session.user.id).single();
      const {data:leader}=!error&&profile&&profile.role!=='admin' ? await window.flcSupabase.rpc('flc_is_team_leader') : {data:false};
      if (mounted) { setUser(!error && profile ? {id:session.user.id,email:session.user.email,name:profile.full_name,role:profile.role}:null);setIsLeader(!!leader);setAuthReady(true); }
    }
    window.flcSupabase.auth.getSession().then(({data})=>load(data.session));
    const {data:{subscription}}=window.flcSupabase.auth.onAuthStateChange((_event,session)=>{
      // Deferred read to avoid calling Supabase methods inside auth callback synchronization.
      Promise.resolve().then(()=>load(session));
    });
    return ()=>{mounted=false;subscription.unsubscribe();};
  }, []);
  const [page, setPage] = React.useState(() => localStorage.getItem('flc_page') || 'dashboard');
  const [progress, setProgress] = React.useState({});
  const [progressLoaded, setProgressLoaded] = React.useState(false);
  const [selectedCompany, setSelectedCompany] = React.useState(null);
  const [showWelcome, setShowWelcome] = React.useState(false);

  const t = window.getT(lang);

  // Show welcome video once per user (per email)
  React.useEffect(() => {
    if (user && user.email) {
      const key = `flc_welcome_shown_${user.email}`;
      const shown = localStorage.getItem(key);
      if (!shown) setShowWelcome(true);
    }
  }, [user]);

  React.useEffect(() => { localStorage.setItem('flc_lang', lang); }, [lang]);
  // Supabase Auth session replaces localStorage flc_user credentials.
  React.useEffect(() => { localStorage.setItem('flc_page', page); }, [page]);
  React.useEffect(() => {
    let current=true;
    setProgressLoaded(false);
    previousProgress.current={};
    setProgress({});
    if (!user?.id) return;
    (async ()=>{
      const {data,error}=await window.flcSupabase.from('module_progress').select('module_id,progress_percent').eq('agent_id',user.id);
      if (!current) return;
      if(error){console.error('Unable to load module progress',error);setProgressLoaded(false);return;}
      const loaded=Object.fromEntries(data.map(x=>[x.module_id,x.progress_percent]));
      previousProgress.current=loaded;
      setProgress(loaded);
      setProgressLoaded(true);
    })();
    return ()=>{current=false;};
  },[user?.id]);

  const previousProgress=React.useRef({});
  React.useEffect(()=>{
    if(!user?.id||!progressLoaded) return;
    const previous=previousProgress.current;
    for(const [id,value] of Object.entries(progress)) {
      if(previous[id]!==value && ['m1','m2','m3'].includes(id)) {
        window.flcSupabase.rpc('flc_set_module_progress',{p_module_id:id,p_progress:value}).then(({error})=>{
          if(error)console.error('Unable to persist module progress',error);
        });
      }
    }
    previousProgress.current={...progress};
  },[progress,user?.id,progressLoaded]);

  React.useEffect(()=>{
    if(!user?.id) return;
    const marker='flc_login_logged_'+user.id;
    // Once per browser tab session; server timestamps are authoritative.
    if(sessionStorage.getItem(marker)) return;
    window.flcSupabase.rpc('flc_log_login').then(({error})=>{
      if(error) console.error('Unable to log sign-in',error);
      else sessionStorage.setItem(marker,'1');
    });
  },[user?.id]);

  if (!authReady) return <p style={{padding:32}}>Verificando sesión…</p>;
  if (!user) return <SupabaseLogin onLogin={setUser} lang={lang} setLang={setLang} />;
  if (!progressLoaded) return <p style={{padding:32}}>Cargando progreso de formación…</p>;

  const pages = {
    production: <ProductionCenter user={user} setPage={setPage} />,
    leads: <LeadDistributionCenter user={user} setPage={setPage} />,
    'lead-activation': user.role === 'admin' ? <FlcLeadActivation user={user} /> : null,
    ranks: user.role === 'admin' ? <RankCenter setPage={setPage} /> : null,
    badges: <BadgeGallery user={user} setPage={setPage} />,
    challenges: <ChallengeCenter user={user} setPage={setPage} isLeader={isLeader} />,
    admin: user.role === 'admin' ? <AdminTracking setPage={setPage} /> : null,
    ceo: user.role === 'admin' ? <CeoDashboard user={user} setPage={setPage} /> : null,
    team: isLeader ? <TeamPanel setPage={setPage} user={user} /> : null,
    dashboard: <Dashboard user={user} rankLabel={rankLabel} setPage={setPage} progress={progress} t={t} lang={lang} />,
    matcher: <Matcher t={t} lang={lang} setPage={setPage} setSelectedCompany={setSelectedCompany} />,
    companies: <Companies t={t} lang={lang} setPage={setPage} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany} />,
    resources: <Resources t={t} lang={lang} />,
    tutorials: <Tutorials t={t} lang={lang} user={user} />,
    progress: <Progress t={t} lang={lang} progress={progress} setProgress={setProgress} user={user} />,
  };

  const navigate=next=>{setPage(next);setMobileOpen(false);};
  return (
    <div className="app">
      <Sidebar page={page} setPage={navigate} user={user} rankLabel={rankLabel} isLeader={isLeader} mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)} onLogout={async () => {sessionStorage.removeItem('flc_login_logged_'+user.id);await window.flcSupabase.auth.signOut();setUser(null);}} t={t} lang={lang} />
      {mobileOpen&&<button type="button" className="mobile-menu-backdrop" aria-label="Cerrar menú" onClick={()=>setMobileOpen(false)}/>}
      <div className="main">
        <div className="topbar">
          <button type="button" className="mobile-menu-button" aria-label="Abrir menú principal" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}>☰ <span>Menú</span></button>
          <div className="topbar-actions">
            <ZoomIdentityLinkButton lang={lang} />
            <div className="lang-toggle">
              <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
        </div>
        {pages[page] || pages.dashboard}
      </div>

      <div className={'flc-mobile-dock'+(mobileDockOpen?' dock-expanded':'')}>
        <LiveSalesFeed user={user} />
        <RankCelebrations user={user} />
        <ChallengeCelebrations user={user} />
        <AgentPositionFloater user={user} setPage={setPage} />
        <button type="button" className="flc-mobile-dock-toggle" aria-label={mobileDockOpen?'Ocultar accesos flotantes':'Mostrar posición y reconocimientos'} aria-expanded={mobileDockOpen} onClick={()=>setMobileDockOpen(v=>!v)}>{mobileDockOpen?'×':'🏆'}<span>{mobileDockOpen?'Cerrar':'Logros'}</span></button>
      </div>
      {showWelcome && (
        <WelcomeVideo user={user} lang={lang} onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
