// Converts YouTube / Vimeo / Google Drive share URLs → embed URLs
function toEmbedUrl(url) {
  if (!url) return '';
  // YouTube (youtu.be/X or youtube.com/watch?v=X)
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  // Vimeo
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}?autoplay=1`;
  // Google Drive
  if (url.includes('drive.google.com/file/d/')) {
    return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  return url;
}

function isYouTube(url) {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

function ytThumbnail(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function Tutorials({ t, lang }) {
  const categories = window.TUTORIAL_CATEGORIES || [];
  if (!categories.length) return <div style={{ padding: 40 }}>No tutorials loaded.</div>;

  const [activeCatId, setActiveCatId] = React.useState(() => {
    try {
      const saved = localStorage.getItem('flc_tutorial_cat');
      if (saved && categories.some(c => c.id === saved)) return saved;
    } catch {}
    return categories[0].id;
  });
  const [playing, setPlaying] = React.useState(null);

  React.useEffect(() => {
    localStorage.setItem('flc_tutorial_cat', activeCatId);
  }, [activeCatId]);

  const activeCat = categories.find(c => c.id === activeCatId) || categories[0];
  const totalVideos = (activeCat.groups || []).reduce(
    (sum, g) => sum + (g.videos || []).length, 0
  );

  return (
    <div data-screen-label="05 Tutorials">
      <div className="breadcrumb">{t('nav_learn')} · <span>{t('nav_tutorials')}</span></div>
      <h1 className="page-title">{t('t_title_a')} <em>{t('t_title_b')}</em></h1>
      <p className="page-sub">{t('t_sub')}</p>

      {/* Category tabs — big and prominent */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${categories.length}, 1fr)`,
        gap: 12,
        marginBottom: 32,
      }}>
        {categories.map(cat => {
          const isActive = cat.id === activeCatId;
          const count = (cat.groups || []).reduce((s, g) => s + (g.videos || []).length, 0);
          return (
            <button key={cat.id}
                    onClick={() => setActiveCatId(cat.id)}
                    style={{
                      padding: '18px 20px',
                      border: '1.5px solid ' + (isActive ? cat.color : 'var(--line)'),
                      background: isActive ? cat.color : 'var(--white)',
                      color: isActive ? 'white' : 'var(--ink)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all .15s',
                      display: 'flex', alignItems: 'center', gap: 14,
                      textAlign: 'left',
                      boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = cat.color; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--line)'; }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: isActive ? 'rgba(255,255,255,.18)' : `${cat.color}18`,
                color: isActive ? 'white' : cat.color,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <I name={cat.icon} size={22} stroke={1.7} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{
                  fontSize: 18, lineHeight: 1.15, marginBottom: 2,
                  color: isActive ? 'white' : 'var(--ink)',
                }}>
                  {lang === 'es' ? cat.title_es : cat.title_en}
                </div>
                <div style={{
                  fontSize: 11, letterSpacing: '0.06em',
                  color: isActive ? 'rgba(255,255,255,.75)' : 'var(--ink-mute)',
                }}>
                  {count} {count === 1
                    ? (lang === 'es' ? 'video' : 'video')
                    : (lang === 'es' ? 'videos' : 'videos')}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active category header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: activeCat.color, fontWeight: 700, marginBottom: 6,
        }}>
          {lang === 'es' ? activeCat.title_es : activeCat.title_en}
          {' · '}
          <span style={{ color: 'var(--ink-mute)', letterSpacing: '0.06em', fontWeight: 500 }}>
            {totalVideos} {totalVideos === 1
              ? (lang === 'es' ? 'video' : 'video')
              : (lang === 'es' ? 'videos' : 'videos')}
          </span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-mute)', maxWidth: 640 }}>
          {lang === 'es' ? activeCat.desc_es : activeCat.desc_en}
        </div>
      </div>

      {/* Groups (companies) with their videos */}
      {(activeCat.groups || []).map((group, gIdx) => (
        <div key={group.companyId + gIdx} style={{ marginBottom: 32 }}>
          {!group.hideCompanyLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: group.color }} />
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--ink)',
              }}>
                {group.company}
              </div>
              <div style={{
                fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500,
                padding: '2px 8px', background: 'var(--cream-warm)', borderRadius: 4,
              }}>
                {group.videos.length}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {group.videos.map(v => (
              <VideoCard key={v.id} v={v} lang={lang} color={group.color}
                         onPlay={() => setPlaying({ ...v, company: group.company, color: group.color })} />
            ))}
          </div>
        </div>
      ))}

      {playing && <VideoModal v={playing} lang={lang} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function VideoCard({ v, lang, color, onPlay }) {
  const thumb = ytThumbnail(v.url);
  const isYT = isYouTube(v.url);

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
      {/* Thumbnail — real YouTube thumbnail if available */}
      <div style={{
        aspectRatio: '16 / 9',
        background: thumb ? `#000 url(${thumb}) center/cover` : `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
        position: 'relative', display: 'grid', placeItems: 'center',
        overflow: 'hidden',
      }}>
        {!thumb && (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .13 }}>
            <defs>
              <pattern id={`p-${v.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <line x1="0" y1="24" x2="24" y2="0" stroke="white" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#p-${v.id})`} />
          </svg>
        )}
        {/* dark overlay so play button pops on YT thumbnails */}
        {thumb && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.45))',
          }} />
        )}

        <div style={{
          width: 56, height: 56, borderRadius: 28,
          background: 'rgba(255,255,255,.95)', color: color,
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,.35)',
          zIndex: 1,
        }}>
          <I name="play" size={22} stroke={0} style={{ fill: 'currentColor', marginLeft: 3 }} />
        </div>

        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,.55)', color: 'white',
          padding: '3px 8px', borderRadius: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          zIndex: 1,
        }}>
          {isYT ? 'YouTube' : 'Video'}
        </div>
      </div>

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
