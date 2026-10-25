function Dashboard({ user, rankLabel, setPage, progress, t, lang }) {
  const firstName = (user.name || '').split(' ')[0] || (lang === 'es' ? 'agente' : 'agent');

  const menu = [
    {
      id: 'tutorials', icon: 'play',
      title_es: 'Tutoriales', title_en: 'Tutorials',
      desc_es: 'Aprende a ilustrar y cotizar en cada plataforma',
      desc_en: 'Learn to run illustrations and quotes',
      accent: '#8b1e3f',
    },
    {
      id: 'resources', icon: 'book',
      title_es: 'Recursos', title_en: 'Resources',
      desc_es: 'Guiones, PDFs y checklists interactivos',
      desc_en: 'Scripts, PDFs and interactive checklists',
      accent: '#c9a24a',
    },
    {
      id: 'companies', icon: 'building',
      title_es: 'Compañías', title_en: 'Carriers',
      desc_es: 'Las 8 compañías: fortalezas y detalles',
      desc_en: 'The 8 carriers: strengths and details',
      accent: '#1a5490',
    },
    {
      id: 'matcher', icon: 'compass',
      title_es: 'El Matcher', title_en: 'The Matcher',
      desc_es: 'Encuentra la compañía ideal para tu cliente',
      desc_en: 'Find the ideal carrier for your client',
      accent: 'var(--green)',
      featured: true,
    },
  ];

  return (
    <div data-screen-label="01 Dashboard" className="flc-dashboard">
      {/* HERO — greeting */}
      <div style={{
        background: 'linear-gradient(135deg, #050805 0%, #0f1a0f 55%, #1c2e18 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '56px 48px',
        color: 'var(--cream)',
        marginBottom: 32,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative background glows */}
        <div style={{
          position: 'absolute', top: -100, right: -80,
          width: 400, height: 400, borderRadius: 200,
          background: 'radial-gradient(circle, rgba(124,179,66,.28), transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -60,
          width: 300, height: 300, borderRadius: 150,
          background: 'radial-gradient(circle, rgba(201,162,74,.15), transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--green-soft)', fontWeight: 600, marginBottom: 20,
          }}>
            <span style={{ width: 24, height: 1, background: 'var(--green)' }} />
            {lang === 'es' ? 'Menú principal' : 'Main menu'}
          </div>

          <h1 style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 68, lineHeight: 1.02, margin: 0, fontWeight: 400,
            letterSpacing: '-0.02em', color: 'var(--cream)',
          }}>
            {lang === 'es' ? '¡Hola,' : 'Hi,'}{' '}
            <em style={{ color: 'var(--green-soft)', fontStyle: 'italic' }}>{firstName}!</em>
          </h1>
          <div style={{display:'inline-block',marginTop:14,padding:'6px 13px',border:'1px solid rgba(165,214,112,.5)',borderRadius:999,color:'var(--green-soft)',fontWeight:700,fontSize:13}} aria-label="Título vigente">
            {user.role==='admin'?'Administración':(rankLabel==='Sin título'?'Sin título':rankLabel)}
          </div>
          <p style={{
            fontSize: 18, color: 'rgba(246,247,242,.78)',
            marginTop: 16, marginBottom: 0, maxWidth: 560, lineHeight: 1.5,
          }}>
            {lang === 'es'
              ? '¿A dónde quieres ir hoy? Elige una herramienta para empezar.'
              : 'Where do you want to go today? Pick a tool to get started.'}
          </p>
        </div>
      </div>

      {/* MAIN MENU — 4 big buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
      }}>
        {menu.map(item => (
          <div key={item.id}
               onClick={() => setPage(item.id)}
               style={{
                 background: item.featured
                   ? 'linear-gradient(135deg, #0f1a0f 0%, #1c2e18 100%)'
                   : 'var(--white)',
                 border: item.featured ? 'none' : '1px solid var(--line)',
                 borderRadius: 'var(--radius-lg)',
                 padding: 32,
                 cursor: 'pointer',
                 transition: 'transform .18s, box-shadow .18s, border-color .18s',
                 color: item.featured ? 'var(--cream)' : 'var(--ink)',
                 display: 'flex',
                 alignItems: 'center',
                 gap: 24,
                 boxShadow: 'var(--shadow-sm)',
                 position: 'relative',
                 overflow: 'hidden',
                 minHeight: 140,
               }}
               onMouseEnter={e => {
                 e.currentTarget.style.transform = 'translateY(-3px)';
                 e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                 if (!item.featured) e.currentTarget.style.borderColor = 'var(--green)';
               }}
               onMouseLeave={e => {
                 e.currentTarget.style.transform = 'translateY(0)';
                 e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                 if (!item.featured) e.currentTarget.style.borderColor = 'var(--line)';
               }}>
            {/* decorative accent for featured */}
            {item.featured && (
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 200, height: 200, borderRadius: 100,
                background: 'radial-gradient(circle, rgba(124,179,66,.25), transparent 65%)',
                pointerEvents: 'none',
              }} />
            )}

            {/* icon */}
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: item.featured
                ? 'rgba(124,179,66,.18)'
                : `${item.accent}15`,
              color: item.featured ? 'var(--green-soft)' : item.accent,
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
              position: 'relative', zIndex: 1,
            }}>
              <I name={item.icon} size={32} stroke={1.6} />
            </div>

            {/* text */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontSize: 32, lineHeight: 1.1,
                  color: item.featured ? 'var(--cream)' : 'var(--ink)',
                }}>
                  {lang === 'es' ? item.title_es : item.title_en}
                </div>
                {item.featured && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    background: 'var(--green)', color: '#0a0f0a',
                    padding: '3px 8px', borderRadius: 4,
                  }}>AI</span>
                )}
              </div>
              <div style={{
                fontSize: 14,
                color: item.featured ? 'rgba(246,247,242,.72)' : 'var(--ink-mute)',
                lineHeight: 1.4,
              }}>
                {lang === 'es' ? item.desc_es : item.desc_en}
              </div>
            </div>

            {/* arrow */}
            <div style={{
              color: item.featured ? 'var(--green-soft)' : item.accent,
              flexShrink: 0, position: 'relative', zIndex: 1,
              opacity: .7,
            }}>
              <I name="arrow" size={20} stroke={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
