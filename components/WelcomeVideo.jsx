// Welcome video modal — shown once, on first login.
// Uses localStorage key `flc_welcome_shown_<email>` to remember per user.
//
// TO CONNECT YOUR VIDEO:
// Replace WELCOME_VIDEO_URL below with your Google Drive share link.
// Google Drive format:
//   Original: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   Embed:    https://drive.google.com/file/d/FILE_ID/preview
// The component auto-converts "view" → "preview" so you can paste either one.

const WELCOME_VIDEO_URL = 'https://youtu.be/gfOgrRO_Ibw';

function toEmbedUrl(url) {
  if (!url) return '';
  // Google Drive: /view → /preview
  if (url.includes('drive.google.com/file/d/')) {
    return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  // YouTube: watch?v=X or youtu.be/X → embed/X
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  // Vimeo: vimeo.com/X → player.vimeo.com/video/X
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}?autoplay=1`;
  return url;
}

function WelcomeVideo({ user, lang, onClose }) {
  const embedUrl = toEmbedUrl(WELCOME_VIDEO_URL);
  const firstName = (user.name || '').split(' ')[0] || (lang === 'es' ? 'agente' : 'agent');

  const done = () => {
    try {
      localStorage.setItem(`flc_welcome_shown_${user.email}`, '1');
    } catch {}
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,8,5,.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24,
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #050805 0%, #0f1a0f 55%, #1c2e18 100%)',
        borderRadius: 20,
        width: 'min(880px, 100%)',
        maxHeight: '92vh',
        overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,.6)',
        border: '1px solid rgba(124,179,66,.2)',
        position: 'relative',
      }}>
        {/* decorative glows */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320, borderRadius: 160,
          background: 'radial-gradient(circle, rgba(124,179,66,.28), transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 260, height: 260, borderRadius: 130,
          background: 'radial-gradient(circle, rgba(201,162,74,.15), transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          padding: '32px 40px 20px',
          position: 'relative', zIndex: 1,
          color: 'var(--cream)',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--green-soft)', fontWeight: 700, marginBottom: 12,
          }}>
            <span style={{ width: 24, height: 1, background: 'var(--green)' }} />
            {lang === 'es' ? 'Video de bienvenida' : 'Welcome video'}
          </div>

          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 42, lineHeight: 1.05,
            color: 'var(--cream)',
            marginBottom: 8,
          }}>
            {lang === 'es' ? '¡Bienvenido,' : 'Welcome,'}{' '}
            <em style={{ color: 'var(--green-soft)', fontStyle: 'italic' }}>{firstName}!</em>
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(246,247,242,.7)',
            maxWidth: 560, lineHeight: 1.5,
          }}>
            {lang === 'es'
              ? 'Antes de empezar, mira este video corto de bienvenida a Future Legacy Creators.'
              : 'Before you start, watch this short welcome video from Future Legacy Creators.'}
          </div>
        </div>

        {/* Video area */}
        <div style={{
          padding: '0 40px 24px',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{
            aspectRatio: '16 / 9',
            background: '#000',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(124,179,66,.2)',
            display: 'grid', placeItems: 'center',
            position: 'relative',
          }}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div style={{
                textAlign: 'center', padding: 32,
                color: 'rgba(246,247,242,.5)',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 36,
                  background: 'rgba(124,179,66,.15)',
                  color: 'var(--green-soft)',
                  display: 'grid', placeItems: 'center',
                  margin: '0 auto 16px',
                }}>
                  <I name="play" size={32} stroke={0} style={{ fill: 'currentColor', marginLeft: 4 }} />
                </div>
                <div style={{ fontSize: 15, marginBottom: 8, color: 'var(--cream)' }}>
                  {lang === 'es' ? 'Video placeholder' : 'Video placeholder'}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
                  {lang === 'es'
                    ? 'Cuando tengas el link de Google Drive del video de bienvenida, abre components/WelcomeVideo.jsx y pégalo en la variable WELCOME_VIDEO_URL.'
                    : 'When you have the Google Drive link, open components/WelcomeVideo.jsx and paste it in WELCOME_VIDEO_URL.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 40px 32px',
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            flex: 1, fontSize: 12,
            color: 'rgba(246,247,242,.5)',
          }}>
            {lang === 'es'
              ? 'Este video solo se muestra la primera vez que inicias sesión.'
              : 'This video only shows the first time you sign in.'}
          </div>
          <button className="btn-gold" onClick={done}>
            {lang === 'es' ? 'Entrar a la academia' : 'Enter the academy'} <I name="arrow" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

window.WelcomeVideo = WelcomeVideo;
