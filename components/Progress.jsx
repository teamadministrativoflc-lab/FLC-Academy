function Progress({ t, lang, progress, setProgress, setPage, user }) {
  const modules = window.PROGRESS_MODULES;
  const [tutorialStats,setTutorialStats]=React.useState({completed:0,loaded:false,error:false});
  const totalTutorials=(window.TUTORIAL_CATEGORIES||[]).reduce((total,c)=>total+(c.groups||[]).reduce((n,g)=>n+(g.videos||[]).length,0),0);
  const loadTutorialStats=React.useCallback(async()=>{
    const {data,error}=await window.flcSupabase.from('tutorial_completions').select('tutorial_id').eq('agent_id',user.id);
    setTutorialStats({completed:error?0:new Set((data||[]).map(x=>x.tutorial_id)).size,loaded:!error,error:!!error});
  },[user.id]);
  React.useEffect(()=>{loadTutorialStats();},[loadTutorialStats]);
  const [openView, setOpenView] = React.useState(null);
  const [showCert, setShowCert] = React.useState(false);
  const [showQuiz, setShowQuiz] = React.useState(false);
  // Force re-render when quiz state changes (localStorage)
  const [quizVersion, setQuizVersion] = React.useState(0);

  const totalPct = Math.round(
    modules.reduce((sum, m) => sum + (progress[m.id] || 0), 0) / modules.length
  );

  const modulesComplete = totalPct === 100;

  // The server is the source of truth across devices.
  const [quizState, setQuizState] = React.useState({ attempts: 0, best: 0, passed: false, loaded: false });
  const refreshQuizState = React.useCallback(async () => {
    const { data, error } = await window.flcSupabase.from('quiz_attempts')
      .select('score_percent,passed').eq('agent_id', user.id);
    if (error) { console.error('Quiz state load failed', error); return; }
    setQuizState({
      attempts: data.length,
      best: Math.max(0, ...data.map(item => Number(item.score_percent))),
      passed: data.some(item => item.passed),
      loaded: true
    });
  }, [user.id]);
  React.useEffect(() => { refreshQuizState(); }, [refreshQuizState]);
  const quizPassed = quizState.passed;
  const quizAttempts = quizState.attempts;
  const quizBestScore = quizState.best;
  const quizAttemptsLeft = Math.max(0, (window.QUIZ_MAX_ATTEMPTS || 3) - quizAttempts);
  const quizExhausted = quizAttemptsLeft === 0 && !quizPassed;

  const certUnlocked = modulesComplete && quizPassed;

  // Auto-open quiz when user completes modules for the first time
  React.useEffect(() => {
    if (quizState.loaded && modulesComplete && !quizPassed && !quizExhausted && user && user.email) {
      const key = `flc_quiz_prompted_${user.email}`;
      if (!localStorage.getItem(key)) {
        setShowQuiz(true);
        localStorage.setItem(key, '1');
      }
    }
  }, [modulesComplete, quizState.loaded, quizPassed, quizExhausted]);

  // Auto-open certificate when quiz is passed for the first time
  React.useEffect(() => {
    if (certUnlocked && user && user.email) {
      const key = `flc_cert_shown_${user.email}`;
      if (!localStorage.getItem(key)) {
        setShowCert(true);
        localStorage.setItem(key, '1');
      }
    }
  }, [certUnlocked]);

  const openModule = (m) => {
    if (!progress[m.id] || progress[m.id] < 50) {
      setProgress({ ...progress, [m.id]: 50 });
    }
    setOpenView(m.resource);
  };
  const markComplete = (id) => { setProgress({ ...progress, [id]: 100 }); };
  const reset = (id) => { setProgress({ ...progress, [id]: 0 }); };

  const handleQuizPass = () => {
    // Force re-render so certUnlocked recomputes
    refreshQuizState();
    setQuizVersion(v => v + 1);
  };
  const handleQuizClose = () => {
    setShowQuiz(false);
    refreshQuizState();
    setQuizVersion(v => v + 1);
  };

  return (
    <div data-screen-label="06 Progress">
      <div className="breadcrumb">{t('nav_learn')} · <span>{t('nav_progress')}</span></div>
      <h1 className="page-title">{t('p_title_a')} <em>{t('p_title_b')}</em></h1>
      <p className="page-sub">{t('p_sub')}</p>

      <section aria-label="Mi resumen de formación" style={{background:'#fff',border:'1px solid #dce5d8',borderRadius:14,padding:18,margin:'20px 0 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><h2 style={{fontSize:20,margin:0}}>Mi avance de formación</h2><button type="button" onClick={()=>{refreshQuizState();loadTutorialStats();}} style={{padding:'8px 12px',border:'1px solid #aac4aa',borderRadius:8,background:'#f5faf4'}}>↻ Actualizar avance</button></div>
        <p style={{fontSize:13,color:'#536454',margin:'8px 0 14px'}}>Tu propio avance, calculado con los registros guardados de la academia.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:10}}>
        {[
          ['Módulos',totalPct+'%'],
          ['Tutoriales',tutorialStats.loaded?tutorialStats.completed+'/'+totalTutorials:'—'],
          ['Intentos de examen',quizState.loaded?quizAttempts+'/'+(window.QUIZ_MAX_ATTEMPTS||3):'—'],
          ['Mejor nota',quizState.loaded&&quizAttempts?quizBestScore+'%':'—'],
          ['Examen',quizState.loaded?(quizPassed?'Aprobado':'Pendiente'):'Cargando…'],
          ['Certificado',certUnlocked?'Disponible':'Pendiente']
        ].map(([label,value])=><div key={label} style={{padding:13,border:'1px solid #e3ebe0',borderRadius:10,background:'#f9fcf8'}}><div style={{fontSize:12,color:'#526753'}}>{label}</div><div style={{fontSize:19,fontWeight:700,marginTop:7,color:'#154f31'}}>{value}</div></div>)}
        </div>
        {tutorialStats.error&&<p role="alert" style={{color:'#9a3737',fontSize:12}}>No se pudieron consultar los tutoriales completados. Intenta actualizar.</p>}
        <div style={{marginTop:14}}><button type="button" onClick={()=>setPage('tutorials')} style={{padding:'8px 12px',background:'#e8f4e8',border:'1px solid #c0d9c3',borderRadius:8}}>Ver tutoriales y videos</button></div>
      </section>

      {/* Certificate + Quiz gate */}
      <CertificateGate
        totalPct={totalPct}
        modulesComplete={modulesComplete}
        quizPassed={quizPassed}
        quizAttempts={quizAttempts}
        quizAttemptsLeft={quizAttemptsLeft}
        quizExhausted={quizExhausted}
        quizBestScore={quizBestScore}
        certUnlocked={certUnlocked}
        lang={lang}
        t={t}
        onOpenQuiz={() => setShowQuiz(true)}
        onOpenCert={() => setShowCert(true)}
      />

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

      {/* Resource viewers */}
      {openView && renderViewer(openView, { lang, t, onClose: () => setOpenView(null) })}

      {/* Quiz modal */}
      {showQuiz && window.Quiz && React.createElement(window.Quiz, {
        user, lang, t,
        onClose: handleQuizClose,
        onPass: handleQuizPass,
      })}

      {/* Certificate */}
      {showCert && window.Certificate && React.createElement(window.Certificate, {
        user, modules, progress, lang,
        onClose: () => setShowCert(false),
      })}
    </div>
  );
}

// ============ CERTIFICATE GATE ============
function CertificateGate({
  totalPct, modulesComplete, quizPassed, quizAttempts, quizAttemptsLeft,
  quizExhausted, quizBestScore, certUnlocked, lang, t, onOpenQuiz, onOpenCert
}) {
  // State: LOCKED (modules incomplete) → QUIZ_PENDING → QUIZ_EXHAUSTED or UNLOCKED
  let state = 'locked';
  if (certUnlocked) state = 'unlocked';
  else if (quizExhausted) state = 'exhausted';
  else if (modulesComplete) state = 'quiz-pending';

  // Icon + colors per state
  const config = {
    locked: {
      icon: 'lock',
      bgIcon: 'rgba(124,179,66,.15)',
      colorIcon: 'var(--green-soft)',
      border: 'var(--green)',
    },
    'quiz-pending': {
      icon: 'sparkle',
      bgIcon: 'rgba(201,162,74,.2)',
      colorIcon: 'var(--gold-soft)',
      border: 'var(--gold)',
    },
    exhausted: {
      icon: 'warning',
      bgIcon: 'rgba(176,74,60,.2)',
      colorIcon: '#ff9a8a',
      border: 'var(--danger)',
    },
    unlocked: {
      icon: 'star',
      bgIcon: 'var(--gold)',
      colorIcon: '#0a0f0a',
      border: 'var(--gold)',
    },
  }[state];

  return (
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
        background: config.bgIcon,
        color: config.colorIcon,
        display: 'grid', placeItems: 'center',
        border: '1.5px solid ' + config.border,
        flexShrink: 0, zIndex: 1,
      }}>
        <I name={config.icon} size={36} stroke={1.4} />
      </div>
      <div style={{ flex: 1, zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: 'var(--green-soft)', fontWeight: 700, marginBottom: 4 }}>
          {t('p_certificate')}
        </div>

        {state === 'locked' && (
          <>
            <div className="serif" style={{ fontSize: 30, color: 'var(--cream)', marginBottom: 4, lineHeight: 1.1 }}>
              {lang === 'es' ? `${totalPct}% de tu formación completada` : `${totalPct}% of your training done`}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(246,247,242,.7)' }}>
              {lang === 'es'
                ? 'Completa los 3 módulos primero. Luego harás un mini quiz para desbloquear tu certificado.'
                : 'Complete the 3 modules first. Then a mini quiz unlocks your certificate.'}
            </div>
          </>
        )}

        {state === 'quiz-pending' && (
          <>
            <div className="serif" style={{ fontSize: 30, color: 'var(--cream)', marginBottom: 4, lineHeight: 1.1 }}>
              🎯 {lang === 'es' ? 'Ya casi… falta el quiz final' : 'Almost there… final quiz pending'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(246,247,242,.75)', marginBottom: 4 }}>
              {lang === 'es'
                ? 'Completaste los 3 módulos. Aprueba el quiz final (15 preguntas, 70% para pasar) y tu certificado quedará listo.'
                : 'You completed all 3 modules. Pass the final quiz (15 questions, 70% to pass) and your certificate is ready.'}
            </div>
            {quizAttempts > 0 && (
              <div style={{ fontSize: 12, color: 'var(--gold-soft)', marginTop: 4 }}>
                {lang === 'es' ? `Intento ${quizAttempts}/3 · mejor puntaje: ${quizBestScore}% · ${quizAttemptsLeft} intentos restantes` :
                                 `Attempt ${quizAttempts}/3 · best: ${quizBestScore}% · ${quizAttemptsLeft} attempts left`}
              </div>
            )}
          </>
        )}

        {state === 'exhausted' && (
          <>
            <div className="serif" style={{ fontSize: 30, color: 'var(--cream)', marginBottom: 4, lineHeight: 1.1 }}>
              {lang === 'es' ? 'Habla con tu manager' : 'Talk to your manager'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,180,170,.85)' }}>
              {lang === 'es'
                ? `Usaste tus 3 intentos del quiz. Mejor puntaje: ${quizBestScore}%. Contacta a tu manager para próximos pasos.`
                : `You've used your 3 quiz attempts. Best score: ${quizBestScore}%. Contact your manager for next steps.`}
            </div>
          </>
        )}

        {state === 'unlocked' && (
          <>
            <div className="serif" style={{ fontSize: 30, color: 'var(--cream)', marginBottom: 4, lineHeight: 1.1 }}>
              ⭐ {t('p_certificate_ready')}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(246,247,242,.75)' }}>
              {lang === 'es'
                ? `Aprobaste el quiz con ${quizBestScore}%. Ya puedes descargar tu certificado interno.`
                : `You passed with ${quizBestScore}%. You can now download your internal certificate.`}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {state === 'quiz-pending' && (
          <button className="btn-gold" onClick={onOpenQuiz}>
            <I name="sparkle" size={14} />
            {quizAttempts === 0
              ? (lang === 'es' ? 'Empezar quiz' : 'Start quiz')
              : (lang === 'es' ? 'Reintentar quiz' : 'Retry quiz')}
          </button>
        )}
        {state === 'unlocked' && (
          <>
            <button className="btn-gold" onClick={onOpenCert}>
              <I name="star" size={14} /> {lang === 'es' ? 'Ver certificado' : 'View certificate'}
            </button>
            <button onClick={onOpenQuiz} style={{
              padding: '8px 12px', fontSize: 11, fontWeight: 500,
              background: 'transparent', color: 'rgba(246,247,242,.5)',
              border: '1px solid rgba(246,247,242,.15)',
              borderRadius: 6, cursor: 'pointer',
            }}>
              {lang === 'es' ? 'Reintentar quiz' : 'Retry quiz'}
            </button>
          </>
        )}
      </div>
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
