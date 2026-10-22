// Final quiz — shown when all 3 modules are at 100%.
// Randomly picks 5 questions from each of the 3 topics.
// User needs 70% (11/15) to pass. 3 attempts max.
//
// State persisted per user in localStorage:
//   flc_quiz_attempts_<email>       → number of attempts used
//   flc_quiz_passed_<email>         → '1' if passed
//   flc_quiz_best_score_<email>     → highest score so far

const QUIZ_TOTAL = 15;
const QUIZ_PER_TOPIC = 5;
const QUIZ_PASS_PCT = 70;
const QUIZ_MAX_ATTEMPTS = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuizQuestions(bank) {
  const fund = shuffle(bank.fundamentos).slice(0, QUIZ_PER_TOPIC).map(q => ({ ...q, topic: 'fundamentos' }));
  const guion = shuffle(bank.guion).slice(0, QUIZ_PER_TOPIC).map(q => ({ ...q, topic: 'guion' }));
  const obj = shuffle(bank.objeciones).slice(0, QUIZ_PER_TOPIC).map(q => ({ ...q, topic: 'objeciones' }));
  // Interleave topics for variety
  const result = [];
  for (let i = 0; i < QUIZ_PER_TOPIC; i++) {
    result.push(fund[i], guion[i], obj[i]);
  }
  return result;
}

function Quiz({ user, lang, t, onClose, onPass }) {
  const bank = window.QUIZ_BANK;
  const [phase, setPhase] = React.useState('intro');   // 'intro' | 'quiz' | 'result'
  const [questions, setQuestions] = React.useState([]);
  const [answers, setAnswers] = React.useState({});    // { [qIdx]: optionIdx }
  const [current, setCurrent] = React.useState(0);
  const [attemptsUsed, setAttemptsUsed] = React.useState(0);
  const [passed, setPassed] = React.useState(false);
  const [bestScore, setBestScore] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [lastScore, setLastScore] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    window.flcSupabase.from('quiz_attempts')
      .select('score_percent,passed')
      .eq('agent_id', user.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setSaveError(lang === 'es' ? 'No se pudo cargar el historial de evaluaciones.' : 'Could not load quiz history.'); }
        else {
          setAttemptsUsed(data.length);
          setPassed(data.some(a => a.passed));
          setBestScore(Math.max(0, ...data.map(a => Number(a.score_percent))));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [user.id]);

  const attemptsLeft = Math.max(0, QUIZ_MAX_ATTEMPTS - attemptsUsed);
  const canRetry = attemptsLeft > 0 && !passed;

  const startQuiz = () => {
    setQuestions(pickQuizQuestions(bank));
    setAnswers({});
    setCurrent(0);
    setPhase('quiz');
  };

  const answerQuestion = (optionIdx) => {
    setAnswers(prev => ({ ...prev, [current]: optionIdx }));
  };

  const finish = async () => {
    if (saving || loading) return;
    setSaving(true);
    setSaveError('');
    let correct = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const pct = Math.round((correct / questions.length) * 100);
    try {
      const { data, error } = await window.flcSupabase.rpc('flc_record_quiz_attempt', { p_score: pct });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      setAttemptsUsed(Number(result.attempts_used));
      setBestScore(Number(result.best_score));
      setPassed(Boolean(result.quiz_passed));
      const didPass = Boolean(result.quiz_passed);
      setLastScore({ correct, total: questions.length, pct, didPass });
      setPhase('result');
      if (didPass && onPass) onPass();
    } catch (e) {
      console.error('Quiz save failed', e);
      setSaveError(lang === 'es'
        ? 'No se guardó el intento. Verifica tu conexión y vuelve a presionar Finalizar. No cierres el examen.'
        : 'Attempt not saved. Check your connection and press Finish again. Do not close the quiz.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(5,8,5,.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 150, padding: 24, overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper)', borderRadius: 16,
        width: 'min(760px, 100%)', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,.5)',
        overflow: 'hidden',
      }}>
        {loading && <p style={{padding:24}}>{lang === 'es' ? 'Cargando historial…' : 'Loading history…'}</p>}
        {saveError && <p role="alert" style={{padding:'12px 24px',color:'#b04a3c'}}>{saveError}</p>}
        {!loading && phase === 'intro' && (
          <QuizIntro user={user} lang={lang} t={t} onClose={onClose}
                     onStart={startQuiz}
                     attemptsUsed={attemptsUsed}
                     attemptsLeft={attemptsLeft}
                     canRetry={canRetry}
                     passed={passed}
                     bestScore={bestScore} />
        )}

        {!loading && phase === 'quiz' && (
          <QuizPlayer questions={questions} answers={answers} current={current}
                      lang={lang} t={t}
                      onAnswer={answerQuestion}
                      onNext={() => setCurrent(c => c + 1)}
                      onPrev={() => setCurrent(c => c - 1)}
                      onFinish={finish}
                      onClose={onClose} />
        )}

        {phase === 'result' && lastScore && (
          <QuizResult result={lastScore} questions={questions} answers={answers}
                      lang={lang} t={t}
                      attemptsLeft={attemptsLeft}
                      canRetry={canRetry}
                      onRetry={startQuiz}
                      onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ============ INTRO SCREEN ============
function QuizIntro({ user, lang, t, onClose, onStart, attemptsUsed, attemptsLeft, canRetry, passed, bestScore }) {
  return (
    <>
      <div style={{
        padding: '32px 40px 24px',
        background: 'linear-gradient(135deg, #0f1a0f 0%, #1c2e18 100%)',
        color: 'var(--cream)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -50,
          width: 240, height: 240, borderRadius: 120,
          background: 'radial-gradient(circle, rgba(124,179,66,.25), transparent 65%)',
        }} />
        <div style={{
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--green-soft)', fontWeight: 700, marginBottom: 8,
          position: 'relative', zIndex: 1,
        }}>
          🎯 {t('q_start_title')}
        </div>
        <div className="serif" style={{
          fontSize: 38, lineHeight: 1.05, color: 'var(--cream)',
          position: 'relative', zIndex: 1, marginBottom: 8,
        }}>
          {passed ? '¡Ya aprobaste!' : t('q_start_title')}
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(246,247,242,.75)', maxWidth: 500,
          position: 'relative', zIndex: 1, lineHeight: 1.5,
        }}>
          {passed
            ? (lang === 'es'
                ? `Ya aprobaste con ${bestScore}%. Puedes reintentar para mejorar tu puntaje si quieres.`
                : `You already passed with ${bestScore}%. You can retry to improve your score.`)
            : t('q_start_sub')}
        </div>
      </div>

      <div style={{ padding: '28px 40px', flex: 1, overflowY: 'auto' }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--ink-mute)', fontWeight: 700, marginBottom: 14,
        }}>
          {t('q_intro_bullets_title')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IntroBullet icon="clipboard" text={t('q_bullet_questions')} />
          <IntroBullet icon="sparkle" text={t('q_bullet_random')} />
          <IntroBullet icon="check" text={t('q_bullet_time')} />
          <IntroBullet icon="star" text={t('q_bullet_pass')} highlight />
          <IntroBullet icon="warning" text={t('q_bullet_attempts')} />
        </div>

        {/* Attempts status */}
        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: attemptsLeft === 0 && !passed ? 'rgba(176,74,60,.08)' :
                      attemptsUsed > 0 ? 'rgba(201,135,31,.1)' : 'rgba(124,179,66,.08)',
          border: '1px solid ' + (attemptsLeft === 0 && !passed ? 'rgba(176,74,60,.3)' :
                                   attemptsUsed > 0 ? 'rgba(201,135,31,.3)' : 'rgba(124,179,66,.25)'),
          borderRadius: 8,
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <I name={attemptsLeft === 0 && !passed ? 'warning' : passed ? 'check' : 'info'}
             size={16} />
          <div>
            {attemptsUsed > 0 && (
              <div style={{ marginBottom: attemptsLeft > 0 && !passed ? 4 : 0 }}>
                {t('q_attempt')} <strong>{attemptsUsed}</strong> {lang === 'es' ? 'de' : 'of'} {QUIZ_MAX_ATTEMPTS}
                {bestScore > 0 && <> · {lang === 'es' ? 'mejor puntaje:' : 'best score:'} <strong>{bestScore}%</strong></>}
              </div>
            )}
            {attemptsLeft > 0 ? (
              <div style={{ color: 'var(--ink-mute)' }}>
                {attemptsLeft} {t('q_attempts_left')}
              </div>
            ) : !passed ? (
              <div style={{ color: 'var(--danger)', fontWeight: 500 }}>
                {t('q_attempts_exhausted_msg')}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{
        padding: '20px 40px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, justifyContent: 'space-between',
        background: 'var(--white)',
      }}>
        <button className="btn-secondary" onClick={onClose}>
          {t('q_close')}
        </button>
        {canRetry || passed ? (
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 28px' }}
                  onClick={onStart}>
            {passed && attemptsUsed > 0 ? t('q_retry') : t('q_start_button')}
            <I name="arrow" size={14} />
          </button>
        ) : (
          <button className="btn-secondary" disabled
                  style={{ opacity: .5, cursor: 'not-allowed' }}>
            {t('q_attempts_exhausted')}
          </button>
        )}
      </div>
    </>
  );
}

function IntroBullet({ icon, text, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: highlight ? 'rgba(124,179,66,.1)' : 'var(--white)',
      border: '1px solid ' + (highlight ? 'rgba(124,179,66,.3)' : 'var(--line)'),
      borderRadius: 8,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 16,
        background: highlight ? 'var(--green)' : 'var(--cream-warm)',
        color: highlight ? 'white' : 'var(--green-dark)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <I name={icon} size={16} stroke={2} />
      </div>
      <div style={{ fontSize: 14, fontWeight: highlight ? 600 : 500 }}>{text}</div>
    </div>
  );
}

// ============ QUIZ PLAYER ============
function QuizPlayer({ questions, answers, current, lang, t, onAnswer, onNext, onPrev, onFinish, onClose }) {
  const q = questions[current];
  const selected = answers[current];
  const isLast = current === questions.length - 1;
  const answered = selected != null;

  // Count how many are answered total
  const answeredCount = Object.keys(answers).length;

  const topicLabel = t('q_module_' + q.topic);
  const topicColor = q.topic === 'fundamentos' ? '#4a7a2a'
                    : q.topic === 'guion' ? '#8b1e3f'
                    : '#c9a24a';

  return (
    <>
      {/* Progress bar */}
      <div style={{
        padding: '18px 32px 12px',
        background: 'var(--white)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500 }}>
            {t('q_question')} <strong style={{ color: 'var(--ink)' }}>{current + 1}</strong>
            {' '}{t('q_of')} {questions.length}
          </div>
          <div style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 700, color: topicColor,
            padding: '3px 10px', borderRadius: 4,
            background: `${topicColor}18`,
          }}>
            {topicLabel}
          </div>
        </div>
        <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${((current + 1) / questions.length) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--green-dark), var(--green))',
            transition: 'width .3s',
          }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ padding: '32px 32px 20px', flex: 1, overflowY: 'auto' }}>
        {q.type === 'scenario' && (
          <div style={{
            display: 'inline-block',
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: '#8b1e3f', fontWeight: 700, marginBottom: 12,
            padding: '3px 10px', background: 'rgba(139,30,63,.1)', borderRadius: 4,
          }}>
            📋 {lang === 'es' ? 'Escenario' : 'Scenario'}
          </div>
        )}
        {q.type === 'truefalse' && (
          <div style={{
            display: 'inline-block',
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: '#4a7a2a', fontWeight: 700, marginBottom: 12,
            padding: '3px 10px', background: 'rgba(74,122,42,.1)', borderRadius: 4,
          }}>
            {lang === 'es' ? 'Verdadero o falso' : 'True or false'}
          </div>
        )}
        <div className="serif" style={{
          fontSize: 24, lineHeight: 1.3, marginBottom: 24, color: 'var(--ink)',
        }}>
          {q.q}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt, idx) => {
            const isSelected = selected === idx;
            return (
              <button key={idx} onClick={() => onAnswer(idx)}
                      style={{
                        padding: '14px 18px',
                        textAlign: 'left',
                        background: isSelected ? 'rgba(124,179,66,.12)' : 'var(--white)',
                        border: '1.5px solid ' + (isSelected ? 'var(--green)' : 'var(--line)'),
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 15, lineHeight: 1.4,
                        color: 'var(--ink)',
                        transition: 'all .12s',
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--green-soft)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--line)'; }}>
                <div style={{
                  minWidth: 24, height: 24, borderRadius: 12,
                  background: isSelected ? 'var(--green)' : 'transparent',
                  border: '1.5px solid ' + (isSelected ? 'var(--green)' : 'var(--line)'),
                  color: 'white',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  marginTop: 2, transition: 'all .12s',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {isSelected ? <I name="check" size={12} stroke={3} /> : String.fromCharCode(65 + idx)}
                </div>
                <div>{opt}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer navigation */}
      <div style={{
        padding: '16px 32px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, alignItems: 'center',
        background: 'var(--white)',
      }}>
        <button className="btn-secondary" onClick={onPrev} disabled={current === 0}
                style={{ opacity: current === 0 ? .4 : 1 }}>
          ← {t('q_prev')}
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--ink-mute)' }}>
          <strong>{answeredCount}</strong> / {questions.length} {t('q_correct')}
        </div>

        {isLast ? (
          <button className="btn-primary"
                  style={{ width: 'auto', padding: '12px 22px', opacity: answeredCount === questions.length ? 1 : .5 }}
                  disabled={answeredCount < questions.length}
                  onClick={onFinish}>
            {t('q_finish')} <I name="check" size={14} stroke={3} />
          </button>
        ) : (
          <button className="btn-primary"
                  style={{ width: 'auto', padding: '12px 22px', opacity: answered ? 1 : .5 }}
                  disabled={!answered}
                  onClick={onNext}>
            {t('q_next')} <I name="arrow" size={14} />
          </button>
        )}
      </div>
    </>
  );
}

// ============ RESULT SCREEN ============
function QuizResult({ result, questions, answers, lang, t, attemptsLeft, canRetry, onRetry, onClose }) {
  const { correct, total, pct, didPass } = result;
  const wrongQuestions = questions
    .map((q, i) => ({ q, i, userAnswer: answers[i] }))
    .filter(x => x.userAnswer !== x.q.correct);

  const scoreColor = didPass ? 'var(--success)' : 'var(--danger)';

  return (
    <>
      {/* Result header */}
      <div style={{
        padding: '36px 40px 28px',
        background: didPass
          ? 'linear-gradient(135deg, #1c2e18 0%, #2d4a1e 100%)'
          : 'linear-gradient(135deg, #2a1a18 0%, #3a1e1c 100%)',
        color: 'var(--cream)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -60,
          width: 280, height: 280, borderRadius: 140,
          background: didPass
            ? 'radial-gradient(circle, rgba(124,179,66,.3), transparent 65%)'
            : 'radial-gradient(circle, rgba(201,135,31,.2), transparent 65%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 60, marginBottom: 8, lineHeight: 1,
          }}>
            {didPass ? '🎉' : '📚'}
          </div>
          <div className="serif" style={{
            fontSize: 38, lineHeight: 1.05, color: 'var(--cream)', marginBottom: 8,
          }}>
            {didPass ? t('q_pass_title') : t('q_fail_title')}
          </div>
          <div style={{
            fontSize: 14, color: 'rgba(246,247,242,.75)', maxWidth: 500, lineHeight: 1.5,
          }}>
            {didPass ? t('q_pass_sub') : t('q_fail_sub')}
          </div>
        </div>
      </div>

      {/* Score stats */}
      <div style={{
        padding: '24px 40px',
        display: 'flex', gap: 32, alignItems: 'center',
        background: 'var(--white)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--ink-mute)', fontWeight: 700, marginBottom: 4,
          }}>
            {t('q_score')}
          </div>
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 56, lineHeight: 1, color: scoreColor,
          }}>
            {pct}<span style={{ fontSize: 22, color: 'var(--ink-mute)' }}>%</span>
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 32 }}>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 4 }}>
            <strong style={{ color: 'var(--ink)', fontSize: 20 }}>{correct}</strong>
            {' '}/ {total} {t('q_correct')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {t('q_needed')} {Math.ceil((QUIZ_PASS_PCT / 100) * total)} / {total} ({QUIZ_PASS_PCT}%)
          </div>
        </div>
        {!didPass && attemptsLeft > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>
            {attemptsLeft} {t('q_attempts_left')}
          </div>
        )}
      </div>

      {/* Wrong answers review */}
      {wrongQuestions.length > 0 && (
        <div style={{ padding: '24px 40px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--ink-mute)', fontWeight: 700, marginBottom: 16,
          }}>
            {t('q_review_title')} ({wrongQuestions.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {wrongQuestions.map(({ q, i, userAnswer }) => {
              const topicColor = q.topic === 'fundamentos' ? '#4a7a2a'
                                : q.topic === 'guion' ? '#8b1e3f'
                                : '#c9a24a';
              return (
                <div key={i} style={{
                  padding: 18,
                  background: 'var(--white)',
                  border: '1px solid var(--line)',
                  borderLeft: `4px solid ${topicColor}`,
                  borderRadius: 8,
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: topicColor, fontWeight: 700, marginBottom: 6,
                  }}>
                    {t('q_module_' + q.topic)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, lineHeight: 1.35 }}>
                    {q.q}
                  </div>

                  {userAnswer != null && (
                    <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--ink-soft)' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗ {t('q_your_answer')}</span>{' '}
                      {q.options[userAnswer]}
                    </div>
                  )}
                  <div style={{ fontSize: 13, marginBottom: 10, color: 'var(--ink-soft)' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {t('q_correct_answer')}</span>{' '}
                    <strong>{q.options[q.correct]}</strong>
                  </div>
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--cream)',
                    borderRadius: 6,
                    fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)',
                  }}>
                    💡 {q.explain}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '20px 40px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, justifyContent: 'space-between',
        background: 'var(--white)',
      }}>
        <button className="btn-secondary" onClick={onClose}>
          {t('q_close')}
        </button>

        {didPass ? (
          <button className="btn-gold" onClick={onClose}>
            <I name="star" size={14} /> {t('q_view_cert')}
          </button>
        ) : canRetry ? (
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 24px' }}
                  onClick={onRetry}>
            <I name="sparkle" size={14} /> {t('q_retry')} ({attemptsLeft} {lang === 'es' ? 'restantes' : 'left'})
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
            {t('q_attempts_exhausted_msg')}
          </div>
        )}
      </div>
    </>
  );
}

window.Quiz = Quiz;
window.QUIZ_MAX_ATTEMPTS = QUIZ_MAX_ATTEMPTS;
window.QUIZ_PASS_PCT = QUIZ_PASS_PCT;
