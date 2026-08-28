function Progress({ t, lang, progress, setProgress, setPage, user }) {
  const modules = window.PROGRESS_MODULES;
  const [openView, setOpenView] = React.useState(null);
  const [showCert, setShowCert] = React.useState(false);



  const totalPct = Math.round(
    modules.reduce((sum, m) => sum + (progress[m.id] || 0), 0) / modules.length
  );

  // Auto-open certificate once, when user hits 100% for the first time
  React.useEffect(() => {
    if (totalPct === 100 && user && user.email) {
      const key = `flc_cert_shown_${user.email}`;
      if (!localStorage.getItem(key)) {
        setShowCert(true);
        localStorage.setItem(key, '1');
      }
    }
  }, [totalPct]);

  const openModule = (m) => {
    // Mark as at least 50% when opened
    if (!progress[m.id] || progress[m.id] < 50) {
      setProgress({ ...progress, [m.id]: 50 });
    }
    setOpenView(m.resource);
  };
  const markComplete = (id) => {
    setProgress({ ...progress, [id]: 100 });
  };
  const reset = (id) => {
    setProgress({ ...progress, [id]: 0 });
  };

  return (
    <div data-screen-label="06 Progress">
      <div className="breadcrumb">{t('nav_learn')} · <span>{t('nav_progress')}</span></div>
      <h1 className="page-title">{t('p_title_a')} <em>{t('p_title_b')}</em></h1>
      <p className="page-sub">{t('p_sub')}</p>

      {/* Certificate card */}
      <div style={{
        background: 'linear-gradient(135deg, #050805 0%, #0f1a0f 55%, #1c2e18 100%)',
        color: 'var(--cream)',
        padding: '32px 36px',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -60,
          width: 280, height: 280, borderRadius: 140,
          background: 'radial-gradient(circle, rgba(124,179,66,.25), transparent 65%)',
        }} />
        <div style={{
          width: 90, height: 90, borderRadius: 45,
          background: totalPct === 100 ? 'var(--gold)' : 'rgba(124,179,66,.15)',
          color: totalPct === 100 ? '#0a0f0a' : 'var(--green-soft)',
          display: 'grid', placeItems: 'center',
          border: '1.5px solid ' + (totalPct === 100 ? 'var(--gold)' : 'var(--green)'),
          flexShrink: 0, zIndex: 1,
        }}>
          <I name={totalPct === 100 ? 'star' : 'lock'} size={36} stroke={1.4} />
        </div>
        <div style={{ flex: 1, zIndex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: 'var(--green-soft)', fontWeight: 700, marginBottom: 4 }}>
            {t('p_certificate')}
          </div>
          <div className="serif" style={{ fontSize: 30, color: 'var(--cream)', marginBottom: 4, lineHeight: 1.1 }}>
            {totalPct === 100 ? t('p_certificate_ready') :
             (lang === 'es' ? `${totalPct}% de tu formación completada` : `${totalPct}% of your training done`)}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(246,247,242,.7)' }}>
            {totalPct < 100 ? t('p_certificate_locked') :
              (lang === 'es' ? 'Ya puedes descargar tu certificado interno.' : 'You can now download your internal certificate.')}
          </div>
        </div>
        {totalPct === 100 && (
          <button className="btn-gold" style={{ zIndex: 1 }} onClick={() => setShowCert(true)}>
            <I name="star" size={14} /> {lang === 'es' ? 'Ver certificado' : 'View certificate'}
          </button>
        )}
      </div>

      {/* Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        {modules.map((m, idx) => {
          const pct = progress[m.id] || 0;
          const isDone = pct === 100;
          const isStarted = pct > 0 && pct < 100;
          return (
            <div key={m.id} className="card" style={{
              padding: 24,
              display: 'flex', alignItems: 'center', gap: 20,
              borderLeft: `4px solid ${isDone ? 'var(--success)' : m.color}`,
            }}>
              {/* Icon + number */}
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                background: isDone ? 'var(--success)' : `${m.color}18`,
                color: isDone ? 'white' : m.color,
                display: 'grid', placeItems: 'center', flexShrink: 0,
                position: 'relative',
              }}>
                <I name={isDone ? 'check' : m.icon} size={26} stroke={isDone ? 2.4 : 1.7} />
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: 11,
                  background: '#0f1a0f', color: 'var(--cream)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>{idx + 1}</div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                                color: 'var(--ink-mute)', fontWeight: 700 }}>
                    {lang === 'es' ? `Módulo ${idx + 1}` : `Module ${idx + 1}`}
                  </div>
                  {isDone && (
                    <span className="chip green" style={{ fontSize: 10 }}>
                      <I name="check" size={10} stroke={3} /> {t('p_done')}
                    </span>
                  )}
                  {isStarted && (
                    <span className="chip gold" style={{ fontSize: 10 }}>
                      {lang === 'es' ? 'En curso' : 'In progress'}
                    </span>
                  )}
                </div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 4 }}>
                  {lang === 'es' ? m.title_es : m.title_en}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 10, maxWidth: 620 }}>
                  {lang === 'es' ? m.desc_es : m.desc_en}
                </div>

                {/* Linked resource pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px', background: 'var(--cream-warm)',
                  borderRadius: 6, fontSize: 12,
                  color: 'var(--ink-soft)', fontWeight: 500,
                }}>
                  <I name="book" size={12} />
                  {lang === 'es' ? 'Material:' : 'Material:'}{' '}
                  <strong style={{ color: m.color }}>
                    {lang === 'es' ? m.resource_label_es : m.resource_label_en}
                  </strong>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, height: 6, background: 'var(--line-soft)',
                    borderRadius: 3, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: isDone ? 'var(--success)' :
                                  `linear-gradient(90deg, ${m.color}aa, ${m.color})`,
                      transition: 'width .3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', minWidth: 42, textAlign: 'right', fontWeight: 600 }}>
                    {pct}%
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 160 }}>
                <button
                  onClick={() => openModule(m)}
                  style={{
                    padding: '10px 16px', fontSize: 13, fontWeight: 600,
                    background: isDone ? 'transparent' : m.color,
                    color: isDone ? m.color : 'white',
                    border: '1px solid ' + m.color,
                    borderRadius: 6, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <I name="eye" size={14} />
                  {isDone ? (lang === 'es' ? 'Repasar' : 'Review') :
                   isStarted ? (lang === 'es' ? 'Continuar' : 'Continue') :
                   (lang === 'es' ? 'Empezar' : 'Start')}
                </button>
                {isStarted && (
                  <button className="btn-secondary" onClick={() => markComplete(m.id)}
                          style={{ padding: '8px 12px', fontSize: 12, justifyContent: 'center' }}>
                    <I name="check" size={12} stroke={2.4} /> {lang === 'es' ? 'Completar' : 'Complete'}
                  </button>
                )}
                {isDone && (
                  <button className="btn-secondary" onClick={() => reset(m.id)}
                          style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-mute)', justifyContent: 'center' }}>
                    {lang === 'es' ? 'Reiniciar' : 'Reset'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resource viewers — reuse from Resources.jsx (globally exposed) */}
      {openView && renderViewer(openView, { lang, t, onClose: () => setOpenView(null) })}

      {/* Certificate */}
      {showCert && window.Certificate && React.createElement(window.Certificate, {
        user, modules, progress, lang,
        onClose: () => setShowCert(false),
      })}
    </div>
  );
}

function renderViewer(kind, props) {
  const map = {
    guion: window.GuionViewer,
    objeciones: window.ObjeccionesViewer,
    seguros_de_vida: window.SegurosVidaViewer,
  };
  const V = map[kind];
  return V ? React.createElement(V, props) : null;
}

window.Progress = Progress;
