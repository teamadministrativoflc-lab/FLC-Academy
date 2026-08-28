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
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
