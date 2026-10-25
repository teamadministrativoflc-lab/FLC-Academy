// Certificate modal — shown when user completes 100% of training modules.
// Full-screen preview + print/save-as-PDF.

function Certificate({ user, modules, progress, lang, onClose }) {
  const firstName = (user.name || '').split(' ')[0] || (lang === 'es' ? 'Agente' : 'Agent');
  const fullName = (user.name || (lang === 'es' ? 'Agente' : 'Agent')).trim();

  const [certData, setCertData] = React.useState(null);
  const [certError, setCertError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    window.flcSupabase.rpc('flc_issue_certificate').then(({data,error}) => {
      if (!active) return;
      if (error) {
        console.error('Certificate issuance failed', error);
        setCertError(lang === 'es' ? 'No se pudo cargar el certificado. Verifica que hayas aprobado el examen.' : 'Could not load your certificate. Check that you passed the quiz.');
        return;
      }
      const cert = Array.isArray(data) ? data[0] : data;
      if (!cert) { setCertError(lang === 'es' ? 'Certificado no disponible.' : 'Certificate unavailable.'); return; }
      setCertData({ number: cert.certificate_code, date: cert.issued_at });
    });
    return () => { active = false; };
  }, [user.id]);
  const dateFormatted = certData ? new Date(certData.date).toLocaleDateString(
    lang === 'es' ? 'es-MX' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  ) : '';

  const handlePrint = () => {
    window.print();
  };

  if (certError) return <div role="alert" style={{padding:32}}>{certError}<button onClick={onClose} style={{marginLeft:16}}>Cerrar</button></div>;
  if (!certData) return <div style={{padding:32}}>{lang === 'es' ? 'Preparando certificado…' : 'Preparing certificate…'}</div>;

  return (
    <div id="certificate-modal" style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,8,5,.9)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24, overflowY: 'auto',
    }} onClick={onClose}>

      {/* Print styles injected inline */}
      <style>{`
        @page { size: landscape; margin: 0; }
        @media print {
          html, body, #root {
            width: 100% !important; height: 100% !important;
            margin: 0 !important; padding: 0 !important;
            overflow: hidden !important;
          }
          body * { visibility: hidden !important; }
          #certificate-modal {
            position: fixed !important; inset: 0 !important;
            width: 100vw !important; height: 100vh !important;
            padding: 0 !important; margin: 0 !important;
            overflow: hidden !important; background: none !important;
            backdrop-filter: none !important; display: block !important;
          }
          #certificate-print, #certificate-print * { visibility: visible !important; }
          #certificate-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important; height: 100vh !important;
            box-sizing: border-box !important;
            aspect-ratio: auto !important;
            margin: 0 !important; padding: 5vh 5vw !important;
            overflow: hidden !important;
            box-shadow: none !important; border-radius: 0 !important;
            break-inside: avoid !important; page-break-inside: avoid !important;
          }
          .cert-no-print { display: none !important; }
        }
      `}</style>

      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 1000, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Toolbar (hidden on print) */}
        <div className="cert-no-print" style={{
          display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{
            color: 'rgba(246,247,242,.7)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: 'var(--green)',
              boxShadow: '0 0 8px rgba(124,179,66,.6)',
            }} />
            {lang === 'es' ? 'Certificado desbloqueado' : 'Certificate unlocked'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onClose}
                    style={{ background: 'rgba(255,255,255,.08)', color: 'var(--cream)', borderColor: 'rgba(255,255,255,.15)' }}>
              <I name="x" size={14} /> {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
            <button className="btn-gold" onClick={handlePrint}>
              <I name="download" size={14} />
              {lang === 'es' ? 'Descargar / Imprimir' : 'Download / Print'}
            </button>
          </div>
        </div>

        {/* Certificate document */}
        <div id="certificate-print" style={{
          background: '#fbf8f0',
          borderRadius: 12,
          padding: 64,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Instrument Serif', Georgia, serif",
          aspectRatio: '1.414 / 1',   // A4 landscape ratio
          boxShadow: '0 40px 100px rgba(0,0,0,.5)',
        }}>
          {/* Corner ornaments (gold) */}
          <CornerOrnament pos="tl" />
          <CornerOrnament pos="tr" />
          <CornerOrnament pos="bl" />
          <CornerOrnament pos="br" />

          {/* Inner border frame */}
          <div style={{
            position: 'absolute',
            inset: 24,
            border: '1.5px solid rgba(201,162,74,.4)',
            borderRadius: 6,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            inset: 30,
            border: '0.5px solid rgba(201,162,74,.25)',
            borderRadius: 4,
            pointerEvents: 'none',
          }} />

          {/* Background watermark logo */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380, height: 380,
            opacity: 0.05,
            pointerEvents: 'none',
          }}>
            <img src="assets/logo.png" alt=""
                 style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {/* Content */}
          <div style={{
            position: 'relative', zIndex: 1,
            height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center',
            padding: '32px 32px 12px',
          }}>

            {/* Logo + brand */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12,
            }}>
              <img src="assets/logo.png" alt="Future Legacy Creators"
                   style={{ width: 60, height: 60, borderRadius: 30 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11, letterSpacing: '0.24em',
                  color: '#4a7a2a', fontWeight: 700,
                }}>
                  FUTURE LEGACY CREATORS
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 9, letterSpacing: '0.14em',
                  color: '#8a8570', fontWeight: 600, marginTop: 1,
                }}>
                  ACADEMY · AGENT TRAINING PROGRAM
                </div>
              </div>
            </div>

            {/* Kicker */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 6, marginTop: 4,
            }}>
              <div style={{ width: 40, height: 1, background: '#c9a24a' }} />
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11, letterSpacing: '0.22em',
                color: '#a5822f', fontWeight: 700, textTransform: 'uppercase',
              }}>
                {lang === 'es' ? 'Certificado de finalización' : 'Certificate of completion'}
              </div>
              <div style={{ width: 40, height: 1, background: '#c9a24a' }} />
            </div>

            {/* Main title */}
            <div style={{
              fontSize: 44, lineHeight: 1.05,
              color: '#1a2a1a',
              marginTop: 4, marginBottom: 4,
              letterSpacing: '-0.01em',
            }}>
              Formación de Agente
            </div>
            <div style={{
              fontSize: 26, lineHeight: 1.1,
              fontStyle: 'italic',
              color: '#4a7a2a',
              marginBottom: 12,
            }}>
              en Seguros de Vida
            </div>

            {/* "Se otorga a" */}
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12, color: '#6b6555',
              marginTop: 4, marginBottom: 6,
              letterSpacing: '0.04em',
            }}>
              {lang === 'es' ? 'Se otorga el presente certificado a:' : 'This certificate is awarded to:'}
            </div>

            {/* Name */}
            <div style={{
              fontSize: 54, lineHeight: 1.02,
              color: '#0a0f0a',
              marginBottom: 8,
              borderBottom: '2px solid rgba(201,162,74,.35)',
              padding: '0 40px 8px',
              letterSpacing: '-0.01em',
            }}>
              {fullName}
            </div>

            {/* Body text */}
            <div style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13, color: '#3a3a2f',
              lineHeight: 1.6, maxWidth: 640,
              marginTop: 12, marginBottom: 20,
            }}>
              {lang === 'es' ? (
                <>Por completar exitosamente los módulos de formación de la <strong style={{ color: '#4a7a2a' }}>Academia Future Legacy Creators</strong>: fundamentos del seguro de vida, estructura del guion oficial de venta y manejo de las 50 objeciones más comunes.</>
              ) : (
                <>For successfully completing the training modules of the <strong style={{ color: '#4a7a2a' }}>Future Legacy Creators Academy</strong>: life insurance fundamentals, official sales script structure, and mastery of the 50 most common objections.</>
              )}
            </div>

            {/* Modules completed — visual list */}
            <div style={{
              display: 'flex', gap: 24, marginBottom: 16,
            }}>
              {modules.map((m, idx) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11,
                  color: '#3a3a2f',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: '#4a7a2a', color: 'white',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <I name="check" size={11} stroke={3} />
                  </div>
                  <span>{lang === 'es' ? `Módulo ${idx + 1}` : `Module ${idx + 1}`}</span>
                </div>
              ))}
            </div>

            {/* Bottom signature row */}
            <div style={{
              marginTop: 'auto', width: '100%',
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'flex-end', gap: 32,
              paddingTop: 12,
            }}>
              {/* Left: signature */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: '"Homemade Apple", "Brush Script MT", cursive',
                  fontSize: 24, color: '#1a2a1a',
                  marginBottom: 4, lineHeight: 1,
                }}>
                  Future Legacy Creators
                </div>
                <div style={{ borderTop: '1px solid #a5a08a', paddingTop: 4 }}>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#6b6555', fontWeight: 700,
                  }}>
                    {lang === 'es' ? 'Dirección de la agencia' : 'Agency Director'}
                  </div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 9, color: '#8a8570', marginTop: 2, letterSpacing: '0.06em',
                  }}>
                    Future Legacy Creators
                  </div>
                </div>
              </div>

              {/* Center: gold seal */}
              <GoldSeal date={dateFormatted} lang={lang} />

              {/* Right: cert number + date */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 14, color: '#1a2a1a',
                  marginBottom: 4, letterSpacing: '0.06em',
                }}>
                  {certData.number}
                </div>
                <div style={{ borderTop: '1px solid #a5a08a', paddingTop: 4 }}>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#6b6555', fontWeight: 700,
                  }}>
                    {lang === 'es' ? 'N° de certificado' : 'Certificate #'}
                  </div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 9, color: '#8a8570', marginTop: 2, letterSpacing: '0.06em',
                  }}>
                    {lang === 'es' ? 'Emitido el ' : 'Issued on '}{dateFormatted}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Corner ornamental brackets in gold
function CornerOrnament({ pos }) {
  const rot = {
    tl: 0, tr: 90, br: 180, bl: 270,
  }[pos];
  const positioning = {
    tl: { top: 16, left: 16 },
    tr: { top: 16, right: 16 },
    bl: { bottom: 16, left: 16 },
    br: { bottom: 16, right: 16 },
  }[pos];
  return (
    <svg width="80" height="80" viewBox="0 0 80 80"
         style={{ position: 'absolute', ...positioning, transform: `rotate(${rot}deg)`, pointerEvents: 'none' }}>
      {/* Outer L bracket */}
      <path d="M 8 40 L 8 8 L 40 8" fill="none" stroke="#c9a24a" strokeWidth="2" strokeLinecap="round" />
      {/* Inner accent */}
      <path d="M 16 30 L 16 16 L 30 16" fill="none" stroke="#c9a24a" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      {/* Little diamond */}
      <path d="M 12 12 L 14 10 L 16 12 L 14 14 Z" fill="#c9a24a" opacity="0.8" />
      {/* Decorative dot */}
      <circle cx="40" cy="8" r="1.5" fill="#c9a24a" opacity="0.7" />
      <circle cx="8" cy="40" r="1.5" fill="#c9a24a" opacity="0.7" />
    </svg>
  );
}

// Gold circular seal with logo
function GoldSeal({ date, lang }) {
  return (
    <div style={{
      width: 110, height: 110,
      display: 'grid', placeItems: 'center',
      position: 'relative',
    }}>
      {/* Outer ridged circle */}
      <svg width="110" height="110" viewBox="0 0 110 110"
           style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="seal-grad" cx="0.35" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#e6c883" />
            <stop offset="0.5" stopColor="#c9a24a" />
            <stop offset="1" stopColor="#8a6a1f" />
          </radialGradient>
        </defs>
        {/* Ridged outer edge */}
        {Array.from({ length: 32 }).map((_, i) => {
          const angle = (i / 32) * Math.PI * 2;
          const x1 = 55 + Math.cos(angle) * 50;
          const y1 = 55 + Math.sin(angle) * 50;
          const x2 = 55 + Math.cos(angle) * 54;
          const y2 = 55 + Math.sin(angle) * 54;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9a24a" strokeWidth="1.4" opacity="0.7" />;
        })}
        <circle cx="55" cy="55" r="50" fill="url(#seal-grad)" />
        <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="0.8" />
        <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="0.5" />
      </svg>
      {/* Inner content */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        color: '#2a1e05',
      }}>
        <div style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 32, lineHeight: 1, marginBottom: 2,
          textShadow: '0 1px 0 rgba(255,255,255,.3)',
        }}>FLC</div>
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 7, letterSpacing: '0.14em', fontWeight: 700,
        }}>ACADEMY</div>
        <div style={{
          width: 24, height: 1, background: '#5a3f0e',
          margin: '3px auto', opacity: .5,
        }} />
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 6, fontWeight: 600, letterSpacing: '0.08em',
        }}>{lang === 'es' ? 'CERTIFICADO' : 'CERTIFIED'}</div>
      </div>
    </div>
  );
}

window.Certificate = Certificate;
