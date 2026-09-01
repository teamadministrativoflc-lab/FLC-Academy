function Sidebar({ page, setPage, user, onLogout, t, lang }) {
  // Order requested by user: inicio, tutoriales, mi progreso, recursos, compañías, el matcher
  const items = [
    { id: 'dashboard', icon: 'home',     label: t('nav_dashboard') },
    { id: 'tutorials', icon: 'play',     label: t('nav_tutorials') },
    { id: 'progress',  icon: 'progress', label: t('nav_progress') },
    { id: 'resources', icon: 'book',     label: t('nav_resources') },
    { id: 'companies', icon: 'building', label: t('nav_companies') },
    { id: 'matcher',   icon: 'compass',  label: t('nav_matcher'), badge: 'AI' },
  ];

  const initials = (user.name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-brand-mark">
          <img src="assets/logo.png" alt="Future Legacy Creators" />
        </div>
        <div className="sb-brand-name">
          Future Legacy
          <span>Creators · Academy</span>
        </div>
      </div>

      <div className="sb-section-label">{lang === 'es' ? 'Menú' : 'Menu'}</div>
      {items.map(it => (
        <div key={it.id} className={`sb-item ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
          <span className="sb-icon"><I name={it.icon} /></span>
          {it.label}
          {it.badge && <span className="sb-badge">{it.badge}</span>}
        </div>
      ))}

      <div className="sb-footer">
        <div className="sb-user" onClick={onLogout} title={t('nav_logout')}>
          <div className="sb-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div className="sb-user-role">{t('role_agent')}</div>
          </div>
          <span className="sb-icon" style={{ opacity: .5 }}><I name="logout" size={16} /></span>
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid rgba(124,179,66,.08)',
          fontSize: 10, letterSpacing: '0.06em',
          color: 'rgba(246,247,242,.35)', textAlign: 'center',
        }}>
          {lang === 'es' ? 'Creado por ' : 'Crafted by '}
          <a href="https://isanestudiocreativo.com" target="_blank" rel="noopener noreferrer"
             style={{
               color: 'rgba(165,214,112,.7)', fontWeight: 500,
               textDecoration: 'none', letterSpacing: '0.04em',
               transition: 'color .15s',
             }}
             onMouseEnter={e => e.currentTarget.style.color = 'var(--green-soft)'}
             onMouseLeave={e => e.currentTarget.style.color = 'rgba(165,214,112,.7)'}>
            Isan Estudio Creativo
          </a>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
