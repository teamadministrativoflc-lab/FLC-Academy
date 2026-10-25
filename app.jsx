function App() {
  const [lang, setLang] = React.useState(() => localStorage.getItem('flc_lang') || 'es');
  const [user, setUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [isLeader,setIsLeader]=React.useState(false);
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
    ranks: user.role === 'admin' ? <RankCenter setPage={setPage} /> : null,
    admin: user.role === 'admin' ? <AdminTracking setPage={setPage} /> : null,
    team: isLeader ? <TeamPanel setPage={setPage} user={user} /> : null,
    dashboard: <Dashboard user={user} setPage={setPage} progress={progress} t={t} lang={lang} />,
    matcher: <Matcher t={t} lang={lang} setPage={setPage} setSelectedCompany={setSelectedCompany} />,
    companies: <Companies t={t} lang={lang} setPage={setPage} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany} />,
    resources: <Resources t={t} lang={lang} />,
    tutorials: <Tutorials t={t} lang={lang} user={user} />,
    progress: <Progress t={t} lang={lang} progress={progress} setProgress={setProgress} user={user} />,
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} user={user} onLogout={async () => {sessionStorage.removeItem('flc_login_logged_'+user.id);await window.flcSupabase.auth.signOut();setUser(null);}} t={t} lang={lang} />
      <div className="main">
        <div className="topbar">
          <div />
          <div className="topbar-actions">
            <div className="lang-toggle">
              <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
        </div>
        <div style={{padding:'4px 28px'}}><button onClick={()=>setPage('production')} style={{padding:'9px 16px',border:'1px solid #8da588',borderRadius:7,background:'#eef4ea',cursor:'pointer'}}>📋 Mis ventas / Nueva póliza</button></div>
        {isLeader && user.role !== 'admin' && <div style={{padding:'4px 28px'}}><button onClick={()=>setPage('team')} style={{padding:'9px 16px',border:'1px solid #8da588',borderRadius:7,background:'#eef4ea',cursor:'pointer'}}>👥 Mi equipo</button></div>}
        {user.role === "admin" && <div style={{padding:"4px 28px"}}><button onClick={() => setPage("admin")} style={{padding:"9px 16px",border:"1px solid #8da588",borderRadius:7,background:"#eef4ea",cursor:"pointer"}}>📊 Seguimiento de agentes</button></div>}
        {user.role === "admin" && <div style={{padding:"4px 28px"}}><button onClick={()=>setPage("ranks")} style={{padding:"9px 16px",border:"1px solid #8da588",borderRadius:7,background:"#eef4ea",cursor:"pointer"}}>🏆 Administración de Rangos</button></div>}
        {pages[page] || pages.dashboard}
      </div>

      <LiveSalesFeed user={user} />
      <RankCelebrations user={user} />
      {showWelcome && (
        <WelcomeVideo user={user} lang={lang} onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
