function Resources({ t, lang }) {
  const [openView, setOpenView] = React.useState(null);
  // 'guion' | 'elegibilidad' | 'objeciones' | 'seguros_de_vida'

  const items = [
    {
      id: 'guion', icon: 'chat',
      color: '#8b1e3f',
      title_es: 'Guion de venta completo',
      title_en: 'Complete sales script',
      sub_es: '9 pasos verbatim: saludo, prueba social, dolor, calificación, explicación del IUL, diseño, cierre y referidos.',
      sub_en: '9 verbatim steps: greeting, social proof, pain, qualifying, IUL explanation, design, close and referrals.',
      pdfPath: 'assets/resources/guion.pdf',
      pages: 12,
      badge_es: 'Guion',
      badge_en: 'Script',
    },
    {
      id: 'elegibilidad', icon: 'clipboard',
      color: '#1a5490',
      title_es: 'Formato de elegibilidad',
      title_en: 'Eligibility form',
      sub_es: 'Formulario digital para levantar TODOS los datos del cliente en una sola llamada. Guarda tu progreso automáticamente.',
      sub_en: 'Digital form to capture ALL client info in one call. Auto-saves your progress.',
      pdfPath: 'assets/resources/elegibilidad.pdf',
      pages: 2,
      badge_es: 'Formulario',
      badge_en: 'Form',
    },
    {
      id: 'objeciones', icon: 'shield',
      color: '#c9a24a',
      title_es: '50 Objeciones',
      title_en: '50 Objections',
      sub_es: 'Respuestas probadas para las objeciones más comunes. Con buscador en vivo y botón de copiar.',
      sub_en: 'Proven responses to the most common objections. With live search and copy button.',
      pdfPath: 'assets/resources/objeciones.pdf',
      pages: 8,
      count: '50',
      badge_es: 'Objeciones',
      badge_en: 'Objections',
    },
    {
      id: 'seguros_de_vida', icon: 'book',
      color: '#4a7a2a',
      title_es: 'Seguros de Vida — Introducción',
      title_en: 'Life Insurance — Introduction',
      sub_es: 'Presentación completa: qué es, cómo funciona, IUL vs Term vs Final Expense, glosario de términos clave.',
      sub_en: 'Complete deck: what it is, how it works, IUL vs Term vs Final Expense, key terms glossary.',
      pdfPath: 'assets/resources/seguros_de_vida.pdf',
      pages: 19,
      badge_es: 'Glosario',
      badge_en: 'Glossary',
    },
  ];

  return (
    <div data-screen-label="04 Resources">
      <div className="breadcrumb">{t('nav_tools')} · <span>{t('nav_resources')}</span></div>
      <h1 className="page-title">{t('r_title_a')} <em>{t('r_title_b')}</em></h1>
      <p className="page-sub">{t('r_sub')}</p>

      {/* 4 essential resources — 2x2 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
      }}>
        {items.map(it => (
          <ResourceCard key={it.id} item={it} lang={lang} t={t}
                        onOpen={() => setOpenView(it.id)} />
        ))}
      </div>

      {openView === 'guion' && <GuionViewer lang={lang} t={t} onClose={() => setOpenView(null)} />}
      {openView === 'elegibilidad' && <ElegibilidadViewer lang={lang} t={t} onClose={() => setOpenView(null)} />}
      {openView === 'objeciones' && <ObjeccionesViewer lang={lang} t={t} onClose={() => setOpenView(null)} />}
      {openView === 'seguros_de_vida' && <SegurosVidaViewer lang={lang} t={t} onClose={() => setOpenView(null)} />}
    </div>
  );
}

// ============ RESOURCE CARD (uniform, no decorative image) ============
function ResourceCard({ item, lang, t, onOpen }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      cursor: 'pointer',
      transition: 'transform .18s, box-shadow .18s, border-color .18s',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 16,
      minHeight: 220,
    }}
    onClick={onOpen}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      e.currentTarget.style.borderColor = item.color;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      e.currentTarget.style.borderColor = 'var(--line)';
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: `${item.color}18`, color: item.color,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <I name={item.icon} size={24} stroke={1.8} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontWeight: 700, color: item.color,
            background: `${item.color}18`,
            padding: '4px 10px', borderRadius: 4,
          }}>
            {lang === 'es' ? item.badge_es : item.badge_en}
          </span>
          <span style={{
            fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500,
            letterSpacing: '0.04em',
          }}>
            PDF · {item.pages} {lang === 'es' ? 'páginas' : 'pages'}
          </span>
        </div>
        {item.count && (
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 42, lineHeight: 1,
            color: item.color, opacity: .45,
          }}>{item.count}</div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div className="serif" style={{ fontSize: 26, lineHeight: 1.15, marginBottom: 8 }}>
          {lang === 'es' ? item.title_es : item.title_en}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-mute)', lineHeight: 1.55 }}>
          {lang === 'es' ? item.sub_es : item.sub_en}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ flex: 1, padding: '12px 16px', fontSize: 14 }}
                onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <I name="eye" size={14} /> {lang === 'es' ? 'Ver contenido' : 'Open'}
        </button>
        <a href={item.pdfPath} download
           onClick={e => e.stopPropagation()}
           className="btn-secondary" style={{
             display: 'inline-flex', textDecoration: 'none',
             alignItems: 'center', gap: 6, padding: '12px 16px',
           }}>
          <I name="download" size={14} /> PDF
        </a>
      </div>
    </div>
  );
}

// ============ FEATURED CARD ============
function FeaturedCard({ item, lang, t, onOpen }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      cursor: 'pointer',
      transition: 'transform .15s, box-shadow .15s, border-color .15s',
      boxShadow: 'var(--shadow-sm)',
    }}
    onClick={onOpen}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = item.color; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
      <div style={{
        height: 120, position: 'relative',
        background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`,
        display: 'flex', alignItems: 'center', padding: 24,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(255,255,255,.18)',
          color: 'white',
          display: 'grid', placeItems: 'center',
        }}>
          <I name={item.icon} size={28} stroke={1.8} />
        </div>
        {item.count && (
          <div style={{
            marginLeft: 'auto',
            fontFamily: 'Instrument Serif, serif',
            fontSize: 68, lineHeight: 1,
            color: 'rgba(255,255,255,.3)',
          }}>{item.count}</div>
        )}
      </div>
      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 6 }}>
          {lang === 'es' ? 'Recurso interactivo' : 'Interactive resource'}
        </div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 6 }}>
          {item.title_es}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', flex: 1, marginBottom: 14 }}>
          {item.sub_es}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
                  onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            <I name="eye" size={14} /> {t('r_open_view')}
          </button>
          <a href={item.pdfPath} download
             onClick={e => e.stopPropagation()}
             className="btn-secondary" style={{
               display: 'inline-flex', textDecoration: 'none',
               alignItems: 'center', padding: '10px 12px',
             }}>
            <I name="download" size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ============ SALES SCRIPT VIEWER (guion) ============
function GuionViewer({ lang, t, onClose }) {
  const steps = window.SALES_SCRIPT;
  const [current, setCurrent] = React.useState(() => {
    try { return Number(localStorage.getItem('flc_guion_step')) || 0; } catch { return 0; }
  });
  React.useEffect(() => { localStorage.setItem('flc_guion_step', current); }, [current]);
  const [copied, setCopied] = React.useState(false);

  const step = steps[current];
  const copy = () => {
    navigator.clipboard.writeText(step.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <ResourceModal onClose={onClose} title={t('r_guion_title')} color="#8b1e3f" icon="chat">
      {/* Stepper */}
      <div style={{ padding: '0 32px 20px', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setCurrent(i)}
                  style={{
                    padding: '6px 10px', fontSize: 12, fontWeight: 600,
                    background: i === current ? '#8b1e3f' : (i < current ? 'rgba(139,30,63,.12)' : 'var(--cream)'),
                    color: i === current ? 'white' : (i < current ? '#8b1e3f' : 'var(--ink-mute)'),
                    border: '1px solid ' + (i === current ? '#8b1e3f' : 'var(--line)'),
                    borderRadius: 6, cursor: 'pointer',
                    minWidth: 30, transition: 'all .12s',
                  }}>
            {s.step}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 20px', overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 6 }}>
          {t('r_step')} {step.step} {t('r_of')} {steps.length - 1} · {step.tag}
        </div>
        <div className="serif" style={{ fontSize: 34, marginBottom: 20, lineHeight: 1.1 }}>
          {step.title}
        </div>
        <div style={{
          padding: '20px 24px',
          background: 'var(--cream)',
          borderLeft: '3px solid #8b1e3f',
          borderRadius: 8,
          fontSize: 15, lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: 'var(--ink)',
        }}>
          {step.body}
        </div>
      </div>

      {/* Footer nav */}
      <div style={{
        padding: '16px 32px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, alignItems: 'center', background: 'var(--white)',
        borderRadius: '0 0 16px 16px',
      }}>
        <button className="btn-secondary" onClick={copy}>
          <I name={copied ? "check" : "download"} size={14} /> {copied ? t('r_copied') : t('r_copy')}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" disabled={current === 0}
                style={{ opacity: current === 0 ? .4 : 1 }}
                onClick={() => setCurrent(c => Math.max(0, c - 1))}>
          ← {t('r_prev')}
        </button>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }}
                disabled={current === steps.length - 1}
                onClick={() => setCurrent(c => Math.min(steps.length - 1, c + 1))}>
          {t('r_next')} <I name="arrow" size={14} />
        </button>
      </div>
    </ResourceModal>
  );
}

// ============ ELIGIBILITY FORM VIEWER ============
function ElegibilidadViewer({ lang, t, onClose }) {
  const F = window.ELIGIBILITY_FIELDS;
  const [values, setValues] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('flc_eligibility') || '{}'); } catch { return {}; }
  });
  React.useEffect(() => { localStorage.setItem('flc_eligibility', JSON.stringify(values)); }, [values]);

  const set = (k, v) => setValues(prev => ({ ...prev, [k]: v }));
  const toggleCond = (val) => {
    const cur = values.conditions || [];
    if (cur.includes(val)) set('conditions', cur.filter(x => x !== val));
    else set('conditions', [...cur, val]);
  };

  const renderField = (f) => {
    const value = values[f.key] || '';
    if (f.type === 'checklist') {
      const options = lang === 'es' ? f.options_es : f.options_en;
      const checked = values.conditions || [];
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {options.map(o => (
            <label key={o} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', border: '1px solid var(--line)',
              borderRadius: 6, cursor: 'pointer', fontSize: 13,
              background: checked.includes(o) ? 'rgba(124,179,66,.12)' : 'var(--white)',
              borderColor: checked.includes(o) ? 'var(--green)' : 'var(--line)',
            }}>
              <input type="checkbox" checked={checked.includes(o)} onChange={() => toggleCond(o)}
                     style={{ margin: 0 }} />
              {o}
            </label>
          ))}
        </div>
      );
    }
    if (f.type === 'select') {
      const options = f.options_es
        ? (lang === 'es' ? f.options_es : f.options_en)
        : f.options;
      return (
        <select value={value} onChange={e => set(f.key, e.target.value)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') {
      return <textarea rows={2} value={value} onChange={e => set(f.key, e.target.value)} />;
    }
    return <input type={f.type || 'text'} value={value} onChange={e => set(f.key, e.target.value)} />;
  };

  return (
    <ResourceModal onClose={onClose} title={t('r_elig_title')} color="#1a5490" icon="clipboard" wide>
      <div style={{ padding: '0 32px 20px', overflowY: 'auto', flex: 1 }}>
        {Object.entries(F).map(([sectionKey, section], idx) => (
          <div key={sectionKey} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: '#1a5490', color: 'white',
                display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
              }}>{idx + 1}</div>
              <div className="serif" style={{ fontSize: 22 }}>
                {lang === 'es' ? section.title_es : section.title_en}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {section.fields.map(f => (
                <div key={f.key} className="field" style={{ marginBottom: 4, gridColumn: (f.type === 'checklist' || f.type === 'textarea' || f.full) ? '1 / -1' : 'auto' }}>
                  <label>{lang === 'es' ? f.label_es : f.label_en}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '16px 32px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, alignItems: 'center', background: 'var(--white)',
        borderRadius: '0 0 16px 16px',
      }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <I name="check" size={12} /> {t('cl_saved')}
        </div>
        <button className="btn-secondary" onClick={() => window.print()}>
          <I name="download" size={14} /> {t('r_print')}
        </button>
        <button className="btn-secondary" onClick={() => setValues({})}>
          {t('r_clear_form')}
        </button>
      </div>
    </ResourceModal>
  );
}

// ============ 50 OBJECTIONS VIEWER ============
function ObjeccionesViewer({ lang, t, onClose }) {
  const [query, setQuery] = React.useState('');
  const [openIdx, setOpenIdx] = React.useState(0);
  const all = window.OBJECTIONS_50;

  const filtered = query.trim()
    ? all.filter(o => {
        const q = query.toLowerCase();
        return o.obj.toLowerCase().includes(q) || o.resp.toLowerCase().includes(q) || String(o.n).includes(q);
      })
    : all;

  return (
    <ResourceModal onClose={onClose} title={t('r_obj_title')} color="#c9a24a" icon="shield" wide>
      {/* Search */}
      <div style={{ padding: '0 32px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input type="text" placeholder={t('r_obj_search')}
                 value={query} onChange={e => setQuery(e.target.value)}
                 style={{
                   width: '100%', padding: '12px 14px 12px 40px',
                   border: '1px solid var(--line)', borderRadius: 8,
                   fontSize: 14, background: 'var(--white)',
                 }} />
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--ink-mute)' }}>
            <I name="eye" size={16} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
          {t('r_obj_showing')} <strong style={{ color: 'var(--ink)' }}>{filtered.length}</strong> {t('r_obj_of')} 50
        </div>
      </div>

      <div style={{ padding: '0 32px 20px', overflowY: 'auto', flex: 1 }}>
        {filtered.map((o) => {
          const isOpen = openIdx === o.n;
          return (
            <div key={o.n} style={{
              border: '1px solid var(--line)', borderRadius: 8,
              marginBottom: 8, overflow: 'hidden',
              background: 'var(--white)',
              borderColor: isOpen ? '#c9a24a' : 'var(--line)',
            }}>
              <div onClick={() => setOpenIdx(isOpen ? null : o.n)}
                   style={{
                     padding: '14px 18px', cursor: 'pointer',
                     display: 'flex', alignItems: 'center', gap: 12,
                     background: isOpen ? 'rgba(201,162,74,.06)' : 'transparent',
                   }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: isOpen ? '#c9a24a' : 'var(--cream-warm)',
                  color: isOpen ? 'white' : 'var(--gold-deep)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>{o.n}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                  «{o.obj}»
                </div>
                <div style={{ color: 'var(--ink-mute)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  <I name="arrow" size={14} />
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: '4px 18px 18px 62px' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                                color: 'var(--gold-deep)', fontWeight: 600, marginBottom: 6 }}>
                    Respuesta
                  </div>
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--cream)',
                    borderLeft: '3px solid #c9a24a',
                    borderRadius: 6,
                    fontSize: 14, lineHeight: 1.6,
                  }}>
                    {o.resp}
                  </div>
                  <button className="btn-secondary" style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }}
                          onClick={() => navigator.clipboard.writeText(o.resp)}>
                    <I name="download" size={12} /> {t('r_copy')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)' }}>
            {lang === 'es' ? 'Sin resultados para tu búsqueda.' : 'No results for your search.'}
          </div>
        )}
      </div>
    </ResourceModal>
  );
}

// ============ SEGUROS DE VIDA — PRESENTATION VIEWER ============
function SegurosVidaViewer({ lang, t, onClose }) {
  const slides = window.SEGUROS_VIDA_SLIDES;
  const [i, setI] = React.useState(() => {
    try { return Number(localStorage.getItem('flc_seguros_slide')) || 0; } catch { return 0; }
  });
  React.useEffect(() => { localStorage.setItem('flc_seguros_slide', i); }, [i]);
  const slide = slides[i];

  return (
    <ResourceModal onClose={onClose}
                   title={lang === 'es' ? 'Seguros de Vida — Glosario' : 'Life Insurance — Glossary'}
                   color="#4a7a2a" icon="book" wide>
      {/* Slide progress dots */}
      <div style={{ padding: '0 32px 16px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {slides.map((_, idx) => (
          <button key={idx} onClick={() => setI(idx)}
                  title={`Slide ${idx + 1}`}
                  style={{
                    width: idx === i ? 28 : 10, height: 6,
                    borderRadius: 3, cursor: 'pointer',
                    background: idx === i ? '#4a7a2a' : (idx < i ? 'rgba(74,122,42,.35)' : 'var(--line)'),
                    transition: 'all .18s',
                    padding: 0, border: 'none',
                  }} />
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-mute)', fontWeight: 500 }}>
          {i + 1} / {slides.length}
        </div>
      </div>

      {/* Slide content */}
      <div style={{ padding: '0 32px 20px', overflowY: 'auto', flex: 1 }}>
        <div style={{
          background: slide.hero
            ? 'linear-gradient(135deg, #0f1a0f 0%, #1c2e18 100%)'
            : 'var(--white)',
          color: slide.hero ? 'var(--cream)' : 'var(--ink)',
          border: slide.hero ? 'none' : '1px solid var(--line-soft)',
          borderRadius: 12,
          padding: slide.hero ? '48px 40px' : '32px',
          minHeight: 300,
        }}>
          {slide.kicker && (
            <div style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
              color: slide.hero ? 'var(--green-soft)' : 'var(--green-dark)',
              marginBottom: 12,
            }}>
              {slide.kicker}
            </div>
          )}
          <div className="serif" style={{
            fontSize: slide.hero ? 42 : 30,
            lineHeight: 1.15,
            marginBottom: 20,
            color: slide.hero ? 'var(--cream)' : 'var(--ink)',
          }}>
            {slide.title}
          </div>
          {slide.body && (
            <div style={{
              fontSize: 15, lineHeight: 1.7,
              color: slide.hero ? 'rgba(246,247,242,.85)' : 'var(--ink-soft)',
              whiteSpace: 'pre-wrap',
            }}>
              {slide.body}
            </div>
          )}
          {slide.bullets && (
            <ul style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'grid', gap: 14,
              marginTop: 8,
            }}>
              {slide.bullets.map((b, idx) => (
                <li key={idx} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <div style={{
                    minWidth: 32, height: 32, borderRadius: 16,
                    background: slide.hero ? 'rgba(124,179,66,.2)' : 'rgba(74,122,42,.12)',
                    color: slide.hero ? 'var(--green-soft)' : 'var(--green-dark)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{String(idx + 1).padStart(2, '0')}</div>
                  <div>
                    {b.term && (
                      <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 15 }}>
                        {b.term}
                      </div>
                    )}
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                      {b.text || b}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{
        padding: '16px 32px', borderTop: '1px solid var(--line)',
        display: 'flex', gap: 10, alignItems: 'center', background: 'var(--white)',
        borderRadius: '0 0 16px 16px',
      }}>
        <a href="assets/resources/seguros_de_vida.pdf" download className="btn-secondary"
           style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <I name="download" size={14} /> {t('r_download_pdf') || 'PDF'}
        </a>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" disabled={i === 0}
                style={{ opacity: i === 0 ? .4 : 1 }}
                onClick={() => setI(Math.max(0, i - 1))}>
          ← {t('r_prev')}
        </button>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }}
                disabled={i === slides.length - 1}
                onClick={() => setI(Math.min(slides.length - 1, i + 1))}>
          {t('r_next')} <I name="arrow" size={14} />
        </button>
      </div>
    </ResourceModal>
  );
}

// ============ RESOURCE MODAL SHELL ============
function ResourceModal({ children, onClose, title, color, icon, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10,15,10,.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           style={{
             background: 'var(--paper)', borderRadius: 16,
             width: wide ? 'min(920px, 100%)' : 'min(720px, 100%)',
             maxHeight: '92vh',
             display: 'flex', flexDirection: 'column',
             boxShadow: '0 40px 80px rgba(0,0,0,.35)',
           }}>
        <div style={{
          padding: '24px 32px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: color, color: 'white',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <I name={icon} size={20} />
          </div>
          <div className="serif" style={{ fontSize: 26, flex: 1, lineHeight: 1.1 }}>
            {title}
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: 8 }}>
            <I name="x" size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionRow({ label, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6,
        background: 'var(--cream-warm)', color: 'var(--green)',
        display: 'grid', placeItems: 'center',
      }}>
        <I name={icon} size={16} />
      </div>
      <div className="serif" style={{ fontSize: 22 }}>{label}</div>
    </div>
  );
}

function PDFCard({ item, lang, t, onView }) {
  const hasViewer = !!item.viewer;
  const pdfPath = item.pdfPath || null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header — icon + meta, no big decorative number */}
      <div style={{
        padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--line-soft)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: `${item.color}18`, color: item.color,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <I name={item.featured ? 'star' : 'book'} size={18} stroke={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--ink-mute)', fontWeight: 600,
          }}>
            PDF · {item.pages} {t('r_pages')}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
          {lang === 'es' ? item.title_es : item.title_en}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', flex: 1, marginBottom: 12 }}>
          {lang === 'es' ? item.desc_es : item.desc_en}
        </div>

        {/* Actions */}
        {hasViewer ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                    onClick={() => onView && onView(item)}>
              <I name="eye" size={14} /> {t('r_open_view')}
            </button>
            {pdfPath && (
              <a href={pdfPath} download className="btn-secondary"
                 style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '10px 12px' }}>
                <I name="download" size={14} />
              </a>
            )}
          </div>
        ) : pdfPath ? (
          <a href={pdfPath} download className="btn-secondary"
             style={{
               display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
               gap: 6, textDecoration: 'none',
             }}>
            <I name="download" size={14} /> {t('r_download')}
          </a>
        ) : (
          <button className="btn-secondary" style={{ justifyContent: 'center' }}
                  onClick={() => alert(lang === 'es' ? 'Descarga simulada en el prototipo.' : 'Download simulated in the prototype.')}>
            <I name="download" size={14} /> {t('r_download')}
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistCard({ item, lang, t, onOpen }) {
  const items = lang === 'es' ? item.items_es : item.items_en;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: 'var(--cream-warm)', color: 'var(--green)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <I name="clipboard" size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 20, marginBottom: 2 }}>
            {lang === 'es' ? item.title_es : item.title_en}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
            {items.length} {t('r_items')}
          </div>
        </div>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', fontSize: 13, color: 'var(--ink-soft)', flex: 1 }}>
        {items.slice(0, 4).map((it, i) => (
          <li key={i} style={{ padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ color: 'var(--gold-deep)', marginTop: 3 }}>·</span>
            {it}
          </li>
        ))}
        {items.length > 4 && (
          <li style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '3px 0 3px 12px', fontStyle: 'italic' }}>
            +{items.length - 4} {lang === 'es' ? 'más…' : 'more…'}
          </li>
        )}
      </ul>
      <button className="btn-secondary" style={{ marginTop: 14, justifyContent: 'center' }} onClick={onOpen}>
        <I name="check" size={14} /> {t('r_open')}
      </button>
    </div>
  );
}

function ChecklistModal({ item, lang, t, onClose }) {
  const items = lang === 'es' ? item.items_es : item.items_en;
  const storageKey = `flc_cl_${item.id}`;
  const [checked, setChecked] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });

  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked]);

  const toggle = (i) => {
    setChecked(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const done = checked.length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20,38,30,.55)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           style={{
             background: 'var(--paper)', borderRadius: 16,
             width: 'min(600px, 100%)', maxHeight: '90vh',
             display: 'flex', flexDirection: 'column',
             boxShadow: '0 40px 80px rgba(0,0,0,.3)',
           }}>
        <div style={{
          padding: '24px 28px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'var(--green)', color: 'var(--cream)',
            display: 'grid', placeItems: 'center',
          }}>
            <I name="clipboard" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 22 }}>
              {lang === 'es' ? item.title_es : item.title_en}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              {done} / {total} · {pct}%
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: 8 }}>
            <I name="x" size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 28px', background: 'var(--white)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: 'linear-gradient(90deg, var(--gold-deep), var(--gold))',
              transition: 'width .25s',
            }} />
          </div>
        </div>

        <div style={{ padding: '16px 28px', overflowY: 'auto', flex: 1 }}>
          {items.map((it, i) => {
            const isChecked = checked.includes(i);
            return (
              <div key={i} onClick={() => toggle(i)}
                   style={{
                     display: 'flex', gap: 12, padding: '12px 0',
                     borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none',
                     cursor: 'pointer',
                     opacity: isChecked ? .55 : 1,
                   }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 4,
                  border: '1.5px solid ' + (isChecked ? 'var(--success)' : 'var(--line)'),
                  background: isChecked ? 'var(--success)' : 'var(--white)',
                  color: 'white',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  transition: 'all .12s',
                }}>
                  {isChecked && <I name="check" size={12} stroke={3} />}
                </div>
                <div style={{ fontSize: 14, textDecoration: isChecked ? 'line-through' : 'none', flex: 1 }}>
                  {it}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--line)',
          display: 'flex', gap: 8, alignItems: 'center', background: 'var(--white)',
          borderRadius: '0 0 16px 16px',
        }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <I name="check" size={12} /> {t('cl_saved')}
          </div>
          <button className="btn-secondary" onClick={() => setChecked([])}>{t('cl_reset')}</button>
          <button className="btn-secondary" onClick={() => setChecked(items.map((_, i) => i))}>{t('cl_mark_all')}</button>
        </div>
      </div>
    </div>
  );
}

window.Resources = Resources;
// Expose viewers globally so Progress.jsx can open them too
window.GuionViewer = GuionViewer;
window.ObjeccionesViewer = ObjeccionesViewer;
window.SegurosVidaViewer = SegurosVidaViewer;
window.ElegibilidadViewer = ElegibilidadViewer;
