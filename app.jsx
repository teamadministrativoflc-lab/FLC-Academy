function App() {
  const [lang, setLang] = React.useState(() => localStorage.getItem('flc_lang') || 'es');
  const [user, setUser] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('flc_user') || 'null'); } catch { return null; }
  });
  const [page, setPage] = React.useState(() => localStorage.getItem('flc_page') || 'dashboard');
  const [progress, setProgress] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('flc_progress') || '{}'); } catch { return {}; }
  });
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
  React.useEffect(() => {
    if (user) localStorage.setItem('flc_user', JSON.stringify(user));
    else localStorage.removeItem('flc_user');
  }, [user]);
  React.useEffect(() => { localStorage.setItem('flc_page', page); }, [page]);
  React.useEffect(() => { localStorage.setItem('flc_progress', JSON.stringify(progress)); }, [progress]);

  if (!user) {
    return <Login onLogin={setUser} t={t} lang={lang} setLang={setLang} />;
  }

  const pages = {
    dashboard: <Dashboard user={user} setPage={setPage} progress={progress} t={t} lang={lang} />,
    matcher: <Matcher t={t} lang={lang} setPage={setPage} setSelectedCompany={setSelectedCompany} />,
    companies: <Companies t={t} lang={lang} setPage={setPage} selectedCompany={selectedCompany} setSelectedCompany={setSelectedCompany} />,
    resources: <Resources t={t} lang={lang} />,
    tutorials: <Tutorials t={t} lang={lang} />,
    progress: <Progress t={t} lang={lang} progress={progress} setProgress={setProgress} user={user} />,
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} user={user} onLogout={() => setUser(null)} t={t} lang={lang} />
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
        {pages[page] || pages.dashboard}
      </div>

      {showWelcome && (
        <WelcomeVideo user={user} lang={lang} onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
