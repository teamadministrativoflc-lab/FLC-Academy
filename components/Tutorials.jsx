// Converts Google Drive share URL → embed URL (also supports YouTube / Vimeo)
function toEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}?autoplay=1`;
  return url;
}

function Tutorials({ t, lang }) {
  const groups = window.TUTORIAL_GROUPS || [];
  if (!groups.length) {
    return <div style={{ padding: 40 }}>No tutorials loaded.</div>;
  }
  // Default to first company with videos, or persisted choice
  const firstWithVideos = groups.find(g => !g.pending)?.companyId || groups[0].companyId;
  const [activeId, setActiveId] = React.useState(() => {
    try {
      const saved = localStorage.getItem('flc_tutorial_company');
      // Only honor saved value if it still exists in current groups
      if (saved && groups.some(g => g.companyId === saved)) return saved;
      return firstWithVideos;
    } catch { return firstWithVideos; }
  });
  const [playing, setPlaying] = React.useState(null);

  React.useEffect(() => { localStorage.setItem('flc_tutorial_company', activeId); }, [activeId]);

  const active = groups.find(g => g.companyId === activeId) || groups[0];
  const sections = active.sections || [];
  const totalVideos = sections.reduce((sum, s) => sum + (s.videos || []).length, 0);

  return (
    <div data-screen-label="05 Tutorials">
      <div className="breadcrumb">{t('nav_learn')} · <span>{t('nav_tutorials')}</span></div>
      <h1 className="page-title">{t('t_title_a')} <em>{t('t_title_b')}</em></h1>
      <p className="page-sub">{t('t_sub')}</p>

      {/* Company selector chips */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32,
        padding: 6,
        background: 'var(--white)',
        borderRadius: 10,
        border: '1px solid var(--line)',
      }}>
        {groups.map(g => {
          const isActive = g.companyId === activeId;
          const count = g.sections.reduce((s, sec) => s + sec.videos.length, 0);
          return (
            <button key={g.companyId}
                    onClick={() => setActiveId(g.companyId)}
                    style={{
                      padding: '10px 14px', fontSize: 13, fontWeight: 600,
                      border: 'none',
                      background: isActive ? g.color : 'transparent',
                      color: isActive ? 'white' : (g.pending ? 'var(--ink-mute)' : 'var(--ink)'),
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all .12s',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}>
              {g.isTraining && !isActive && <I name="star" size={12} />}
              {lang === 'en' && g.company_en ? g.company_en : g.company}
              {count > 0 ? (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 3,
                  background: isActive ? 'rgba(255,255,255,.22)' : 'var(--cream-warm)',
                  color: isActive ? 'white' : g.color,
                  letterSpacing: '0.04em',
                }}>{count}</span>
              ) : (
                <span style={{
                  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: isActive ? 'rgba(255,255,255,.7)' : 'var(--ink-mute)',
                }}>
                  {lang === 'es' ? 'próximamente' : 'coming soon'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active company header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: active.color, color: 'white',
          display: 'grid', placeItems: 'center',
        }}>
          <I name="play" size={22} stroke={0} style={{ fill: 'currentColor', marginLeft: 3 }} />
        </div>
        <div>
          <div className="serif" style={{ fontSize: 30, lineHeight: 1.1 }}>
            {lang === 'en' && active.company_en ? active.company_en : active.company}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 2 }}>
            {totalVideos > 0
              ? (lang === 'es'
                  ? `${totalVideos} ${totalVideos === 1 ? 'video disponible' : 'videos disponibles'}`
                  : `${totalVideos} ${totalVideos === 1 ? 'video available' : 'videos available'}`)
              : (lang === 'es' ? 'Tutoriales próximamente' : 'Tutorials coming soon')}
          </div>
        </div>
      </div>

      {/* Sections + videos */}
      {sections.length === 0 && (
        <PendingState lang={lang} carrier={active.company} />
      )}

      {sections.map((section, idx) => (
        <div key={idx} style={{ marginBottom: 32 }}>
          <SectionHeading label={lang === 'es' ? section.title_es : section.title_en}
                          color={active.color} count={section.videos.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {section.videos.map(v => (
              <VideoCard key={v.id} v={v} lang={lang} color={active.color}
                         onPlay={() => setPlaying({ ...v, company: active.company, color: active.color })} />
            ))}
          </div>
        </div>
      ))}

      {playing && <VideoModal v={playing} lang={lang} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function SectionHeading({ label, color, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 14,
    }}>
      <div style={{
        width: 4, height: 20, borderRadius: 2, background: color,
      }} />
      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--ink)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500,
        padding: '2px 8px', background: 'var(--cream-warm)', borderRadius: 4,
      }}>
        {count}
      </div>
    </div>
  );
}

function PendingState({ lang, carrier }) {
  return (
    <div style={{
      padding: '60px 40px', textAlign: 'center',
      background: 'var(--white)',
      border: '1px dashed var(--line)',
      borderRadius: 16,
      color: 'var(--ink-mute)',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 30,
        background: 'var(--cream-warm)', color: 'var(--green-dark)',
        margin: '0 auto 16px', display: 'grid', placeItems: 'center',
      }}>
        <I name="play" size={24} />
      </div>
      <div className="serif" style={{ fontSize: 22, marginBottom: 6, color: 'var(--ink)' }}>
        {lang === 'es' ? 'Tutoriales de ' + carrier + ' próximamente' : carrier + ' tutorials coming soon'}
      </div>
      <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
        {lang === 'es'
          ? 'Estamos grabando los videos. Mientras tanto, revisa la ficha de la compañía y usa el Matcher.'
          : "We're recording the videos. Meanwhile, check the carrier profile and use the Matcher."}
      </div>
    </div>
  );
}

function VideoCard({ v, lang, color, onPlay }) {
  return (
    <div onClick={onPlay}
         style={{
           background: 'var(--white)',
           border: '1px solid var(--line)',
           borderRadius: 12,
           overflow: 'hidden',
           cursor: 'pointer',
           transition: 'transform .15s, box-shadow .15s, border-color .15s',
           boxShadow: 'var(--shadow-sm)',
         }}
         onMouseEnter={e => {
           e.currentTarget.style.transform = 'translateY(-2px)';
           e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
           e.currentTarget.style.borderColor = color;
         }}
         onMouseLeave={e => {
           e.currentTarget.style.transform = 'translateY(0)';
           e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
           e.currentTarget.style.borderColor = 'var(--line)';
         }}>
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '16 / 9',
        background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
        position: 'relative', display: 'grid', placeItems: 'center',
        overflow: 'hidden',
      }}>
        {/* subtle diagonal pattern */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .13 }}>
          <defs>
            <pattern id={`p-${v.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <line x1="0" y1="24" x2="24" y2="0" stroke="white" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#p-${v.id})`} />
        </svg>

        <div style={{
          width: 56, height: 56, borderRadius: 28,
          background: 'rgba(255,255,255,.95)', color: color,
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          zIndex: 1,
        }}>
          <I name="play" size={22} stroke={0} style={{ fill: 'currentColor', marginLeft: 3 }} />
        </div>

        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,.35)', color: 'white',
          padding: '3px 8px', borderRadius: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          HD
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
          {lang === 'es' ? v.title_es : v.title_en}
        </div>
      </div>
    </div>
  );
}

function VideoModal({ v, lang, onClose }) {
  const embedUrl = toEmbedUrl(v.url);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,8,5,.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper)', borderRadius: 16,
        width: 'min(1000px, 100%)', maxHeight: '92vh',
        boxShadow: '0 40px 100px rgba(0,0,0,.5)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Video */}
        <div style={{
          aspectRatio: '16 / 9', background: '#000',
          position: 'relative',
        }}>
          <iframe
            src={embedUrl}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 'none' }}
          />

          {/* Close button on top-right */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(0,0,0,.6)', color: 'white',
            border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            transition: 'background .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.8)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,.6)'}>
            <I name="x" size={16} />
          </button>
        </div>

        {/* Info bar */}
        <div style={{
          padding: '20px 28px',
          display: 'flex', alignItems: 'center', gap: 16,
          background: 'var(--white)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: v.color, color: 'white',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <I name="play" size={16} stroke={0} style={{ fill: 'currentColor', marginLeft: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ink-mute)', fontWeight: 700, marginBottom: 2,
            }}>
              {v.company}
            </div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>
              {lang === 'es' ? v.title_es : v.title_en}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Tutorials = Tutorials;
