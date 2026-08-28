function Matcher({ t, lang, setPage, setSelectedCompany }) {
  const emptyClient = {
    product: '',           // 'iul' | 'term' | 'final'
    immigration: '',       // 'citizen' | 'resident' | 'itin' | 'passport' | 'consular' | 'homecountry'
    dob: '',               // ISO date string YYYY-MM-DD (for IUL/Term)
    age: '',               // manual (for Final Expense fallback)
    gender: '', state: '',
    weightLb: '', heightFt: '', heightIn: '',
    smoker: '', yearsQuit: '',
    diabetes: '', hbp: '', chol: false,
    infarct: false, infarctYears: '', preInfarct: false,
    hiv: false, thyroid: false,
    cancer: false, cancerType: '', cancerYears: '',
    kidney: false, liver: false,
    dui: false, felony: false, license: false,
    other: '',
  };

  const [c, setC] = React.useState(() => {
    try {
      const saved = localStorage.getItem('flc_matcher');
      return saved ? { ...emptyClient, ...JSON.parse(saved) } : emptyClient;
    } catch { return emptyClient; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('flc_matcher', JSON.stringify(c)); } catch {}
  }, [c]);

  const set = (k, v) => setC(prev => ({ ...prev, [k]: v }));
  const toggle = (k) => setC(prev => ({ ...prev, [k]: !prev[k] }));

  const heightIn = (Number(c.heightFt) || 0) * 12 + (Number(c.heightIn) || 0);
  const bmi = window.MATCHER.calcBMI(Number(c.weightLb), heightIn);
  const clientForEngine = { ...c, heightIn };
  const hasProduct = !!c.product;
  const resolvedAge = window.MATCHER.resolveAge(clientForEngine);
  const hasData = window.MATCHER.hasEnoughData(clientForEngine);
  const results = hasData ? window.MATCHER.runAll(clientForEngine) : [];

  const declines = results.filter(r => r.declined);
  const qualifies = results.filter(r => !r.declined);

  const openCompany = (id) => {
    setSelectedCompany(id);
    setPage('companies');
  };

  return (
    <div data-screen-label="02 Matcher">
      <div className="breadcrumb">{t('nav_tools')} · <span>{t('nav_matcher')}</span></div>
      <h1 className="page-title">
        {t('m_title_a')} <em>{t('m_title_b')}</em>
      </h1>
      <p className="page-sub">{t('m_sub')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT — FORM */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="serif" style={{ fontSize: 24 }}>{t('m_client_data')}</div>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setC(emptyClient)}>
              <I name="x" size={12} /> {t('m_reset')}
            </button>
          </div>

          {/* Product picker — required first */}
          <MField label={t('m_product')}>
            <ProductPicker value={c.product} onChange={v => set('product', v)} t={t} />
          </MField>

          {/* Immigration */}
          <MField label={t('m_immigration')}>
            <ImmigrationPicker value={c.immigration} onChange={v => set('immigration', v)} t={t} />
          </MField>

          {/* DOB (for IUL/Term) or manual age (for Final Expense) */}
          {(c.product === 'iul' || c.product === 'term') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 12 }}>
              <MField label={t('m_dob')}>
                <input type="date" value={c.dob} onChange={e => set('dob', e.target.value)}
                       max={new Date().toISOString().slice(0, 10)} />
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>
                  {t('m_dob_hint')}
                </div>
              </MField>
              <MField label={t('m_age_yr')}>
                <div style={{
                  padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 6,
                  background: 'var(--cream)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 500,
                  color: resolvedAge != null ? 'var(--green-deep)' : 'var(--ink-mute)',
                  textAlign: 'center',
                }}>
                  {resolvedAge != null && !isNaN(resolvedAge) ? resolvedAge : '—'}
                </div>
              </MField>
            </div>
          )}

          {c.product === 'final' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <MField label={t('m_dob')}>
                <input type="date" value={c.dob} onChange={e => set('dob', e.target.value)}
                       max={new Date().toISOString().slice(0, 10)} />
              </MField>
              <MField label={t('m_age_current')}>
                <div style={{
                  padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 6,
                  background: 'var(--cream)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 500,
                  color: resolvedAge != null ? 'var(--green-deep)' : 'var(--ink-mute)',
                  textAlign: 'center',
                }}>
                  {resolvedAge != null && !isNaN(resolvedAge) ? resolvedAge : '—'}
                </div>
              </MField>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <MField label={t('m_gender')}>
              <MSegment options={[
                { v: 'M', l: t('m_male') },
                { v: 'F', l: t('m_female') },
              ]} value={c.gender} onChange={v => set('gender', v)} />
            </MField>
            <MField label={t('m_weight')}>
              <input type="number" value={c.weightLb} onChange={e => set('weightLb', e.target.value)} placeholder="180" />
            </MField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <MField label={t('m_height')}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" value={c.heightFt} onChange={e => set('heightFt', e.target.value)} placeholder="5" style={{ width: '50%' }} />
                <input type="number" value={c.heightIn} onChange={e => set('heightIn', e.target.value)} placeholder="10" style={{ width: '50%' }} />
              </div>
            </MField>
            <MField label={t('m_bmi')}>
              <div style={{
                padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 6,
                background: 'var(--cream)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500,
                color: bmi ? (bmi > 35 ? 'var(--danger)' : bmi > 30 ? 'var(--warn)' : 'var(--success)') : 'var(--ink-mute)',
              }}>
                {bmi ? bmi.toFixed(1) : '—'}
              </div>
            </MField>
          </div>

          <SectionHead label={t('m_health')} icon="shield" />

          <MField label={t('m_smoker')}>
            <MSegment options={[
              { v: 'never', l: t('m_never') },
              { v: 'former', l: t('m_former') },
              { v: 'current', l: t('m_current') },
            ]} value={c.smoker} onChange={v => set('smoker', v)} />
            {c.smoker === 'former' && (
              <input type="number" placeholder={t('m_years_since')} value={c.yearsQuit}
                     onChange={e => set('yearsQuit', e.target.value)}
                     style={{ marginTop: 8 }} />
            )}
          </MField>

          <MField label={t('m_diabetes')}>
            <MSegment vertical options={[
              { v: '', l: t('m_none') },
              { v: 'type1', l: t('m_type1') },
              { v: 'type2c', l: t('m_type2c') },
              { v: 'type2u', l: t('m_type2u') },
            ]} value={c.diabetes} onChange={v => set('diabetes', v)} />
          </MField>

          <MField label={t('m_hbp')}>
            <MSegment options={[
              { v: '', l: t('m_no') },
              { v: 'controlled', l: t('m_controlled') },
              { v: 'uncontrolled', l: t('m_uncontrolled') },
            ]} value={c.hbp} onChange={v => set('hbp', v)} />
          </MField>

          <MCheckbox label={t('m_chol')} checked={c.chol} onChange={() => toggle('chol')} />

          <MCheckbox label={t('m_infarct')} checked={c.infarct} onChange={() => toggle('infarct')} />
          {c.infarct && (
            <input type="number" placeholder={t('m_years_ago')} value={c.infarctYears}
                   onChange={e => set('infarctYears', e.target.value)}
                   style={{ marginBottom: 12, marginLeft: 28, width: 'calc(100% - 28px)' }} />
          )}

          <MCheckbox label={t('m_pre_infarct')} checked={c.preInfarct} onChange={() => toggle('preInfarct')} />
          <MCheckbox label={t('m_hiv')} checked={c.hiv} onChange={() => toggle('hiv')} />
          <MCheckbox label={t('m_thyroid')} checked={c.thyroid} onChange={() => toggle('thyroid')} />

          <MCheckbox label={t('m_cancer')} checked={c.cancer} onChange={() => toggle('cancer')} />
          {c.cancer && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, marginLeft: 28 }}>
              <input type="text" placeholder={t('m_cancer_type')} value={c.cancerType}
                     onChange={e => set('cancerType', e.target.value)} />
              <input type="number" placeholder={t('m_years_free')} value={c.cancerYears}
                     onChange={e => set('cancerYears', e.target.value)} />
            </div>
          )}

          <MCheckbox label={t('m_kidney')} checked={c.kidney} onChange={() => toggle('kidney')} />
          <MCheckbox label={t('m_liver')} checked={c.liver} onChange={() => toggle('liver')} />

          <SectionHead label={t('m_legal')} icon="warning" />

          <MCheckbox label={t('m_dui')} checked={c.dui} onChange={() => toggle('dui')} />
          <MCheckbox label={t('m_felony')} checked={c.felony} onChange={() => toggle('felony')} />
          <MCheckbox label={t('m_license')} checked={c.license} onChange={() => toggle('license')} />

          <SectionHead label={t('m_other')} icon="info" />

          <MField label={t('m_other_cond')}>
            <textarea rows={3} value={c.other} onChange={e => set('other', e.target.value)}
                      placeholder={t('m_other_placeholder')} />
          </MField>
        </div>

        {/* RIGHT — RESULTS */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '20px 24px', background: 'var(--green-deep)',
              color: 'var(--cream)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(201,162,74,.15)',
                display: 'grid', placeItems: 'center', color: 'var(--gold)',
              }}>
                <I name="sparkle" size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 20, color: 'var(--cream)' }}>{t('m_results_title')}</div>
                <div style={{ fontSize: 12, color: 'rgba(246,242,233,.6)' }}>{t('m_results_sub')}</div>
              </div>
              {hasData && (
                <div style={{
                  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--gold-soft)', fontWeight: 600,
                  padding: '4px 10px', border: '1px solid rgba(201,162,74,.3)',
                  borderRadius: 4,
                }}>
                  {qualifies.length} / {results.length}
                </div>
              )}
            </div>

            {!hasData && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 30,
                  background: 'var(--cream)', margin: '0 auto 16px',
                  display: 'grid', placeItems: 'center', color: 'var(--ink-mute)',
                }}>
                  <I name="compass" size={26} />
                </div>
                <div className="serif" style={{ fontSize: 20, marginBottom: 6 }}>
                  {!hasProduct ? t('m_pick_product') : t('m_empty_title')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-mute)', maxWidth: 320, margin: '0 auto' }}>
                  {t('m_empty_sub')}
                </div>
              </div>
            )}

            {hasData && qualifies.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 26,
                  background: 'rgba(176,74,60,.12)', margin: '0 auto 12px',
                  display: 'grid', placeItems: 'center', color: 'var(--danger)',
                }}>
                  <I name="ban" size={24} />
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', maxWidth: 320, margin: '0 auto' }}>
                  {t('m_no_matches')}
                </div>
              </div>
            )}

            {hasData && qualifies.map((r, idx) => (
              <ResultCard key={r.carrier.id} r={r} lang={lang} t={t} openCompany={openCompany} rank={idx + 1} />
            ))}

            {hasData && declines.length > 0 && (
              <div>
                <div style={{
                  padding: '12px 24px', fontSize: 11,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--ink-mute)', fontWeight: 600,
                  background: 'var(--cream)',
                  borderTop: '1px solid var(--line)',
                }}>
                  {t('m_declined')} · {declines.length}
                </div>
                {declines.map(r => (
                  <div key={r.carrier.id} style={{
                    padding: '14px 24px', borderTop: '1px solid var(--line-soft)',
                    display: 'flex', alignItems: 'center', gap: 12, opacity: .65,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: r.carrier.color, color: 'white',
                      display: 'grid', placeItems: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>{r.carrier.logoText}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.carrier.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                        {r.declineReason && (lang === 'es' ? r.declineReason.es : r.declineReason.en)}
                      </div>
                    </div>
                    <span className="chip red"><I name="ban" size={10} /> {lang === 'es' ? 'Decline' : 'Decline'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MField({ label, children }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function MSegment({ options, value, onChange, vertical }) {
  return (
    <div style={{
      display: vertical ? 'grid' : 'flex',
      gridTemplateColumns: vertical ? 'repeat(2, 1fr)' : undefined,
      gap: 6,
    }}>
      {options.map(o => (
        <button key={o.v} type="button"
                onClick={() => onChange(o.v)}
                style={{
                  padding: '10px 12px',
                  border: '1px solid ' + (value === o.v ? 'var(--green)' : 'var(--line)'),
                  background: value === o.v ? 'var(--green)' : 'var(--white)',
                  color: value === o.v ? 'var(--cream)' : 'var(--ink)',
                  borderRadius: 6,
                  fontSize: 13, fontWeight: 500,
                  flex: vertical ? undefined : 1,
                  transition: 'all .12s',
                }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function MCheckbox({ label, checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', cursor: 'pointer', marginBottom: 4,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 4,
        border: '1.5px solid ' + (checked ? 'var(--green)' : 'var(--line)'),
        background: checked ? 'var(--green)' : 'var(--white)',
        display: 'grid', placeItems: 'center',
        color: 'var(--cream)',
        transition: 'all .12s',
        flexShrink: 0,
      }}>
        {checked && <I name="check" size={12} stroke={3} />}
      </div>
      <div style={{ fontSize: 14 }}>{label}</div>
    </div>
  );
}

function SectionHead({ label, icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginTop: 24, marginBottom: 12,
      paddingBottom: 8, borderBottom: '1px solid var(--line-soft)',
      color: 'var(--green)',
    }}>
      <I name={icon} size={16} />
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

function ResultCard({ r, lang, t, openCompany, rank }) {
  const [open, setOpen] = React.useState(rank <= 2);
  const ratingLabel = window.MATCHER.RATING_LABELS[r.rating];
  const okNotes = r.notes.filter(n => n.type === 'ok');
  const warnNotes = r.notes.filter(n => n.type === 'warn');

  const scoreColor = r.score >= 80 ? 'var(--success)' :
                     r.score >= 60 ? 'var(--gold-deep)' :
                     r.score >= 40 ? 'var(--warn)' : 'var(--danger)';

  return (
    <div style={{ borderTop: '1px solid var(--line-soft)' }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: '16px 24px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          background: rank === 1 ? 'var(--gold)' : 'var(--cream-warm)',
          color: rank === 1 ? 'var(--green-deep)' : 'var(--ink)',
          display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 700,
          flexShrink: 0,
        }}>{rank}</div>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: r.carrier.color, color: 'white',
          display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          flexShrink: 0,
        }}>{r.carrier.logoText}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{r.carrier.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{ratingLabel[lang]}</span>
            <span>·</span>
            <span>{r.carrier.tag_es && (lang === 'es' ? r.carrier.tag_es : r.carrier.tag_en)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 26, lineHeight: 1, color: scoreColor,
          }}>{r.score}<span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>%</span></div>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
            {t('m_match')}
          </div>
        </div>
      </div>

      {open && (
        <div style={{ padding: '4px 24px 20px 24px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, padding: '4px 10px',
              background: 'var(--cream)', borderRadius: 4,
              border: '1px solid var(--line)',
            }}>
              <span style={{ color: 'var(--ink-mute)' }}>{t('m_rating')}:</span>
              <strong>{ratingLabel[lang]}</strong>
            </div>
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 8 }}>
            {t('m_notes')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {okNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }}>
                  <I name="check" size={14} stroke={2.2} />
                </span>
                <span>{n[lang]}</span>
              </div>
            ))}
            {warnNotes.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }}>
                  <I name="warning" size={14} />
                </span>
                <span>{n[lang]}</span>
              </div>
            ))}
          </div>

          <button className="btn-secondary" style={{ marginTop: 14, padding: '8px 14px', fontSize: 12 }}
                  onClick={() => openCompany(r.carrier.id)}>
            {t('m_view_company')} <I name="arrow" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ProductPicker({ value, onChange, t }) {
  const options = [
    { v: 'iul',   l: t('m_product_iul'),   sub: t('m_product_sub_iul'),   icon: 'sparkle' },
    { v: 'term',  l: t('m_product_term'),  sub: t('m_product_sub_term'),  icon: 'shield' },
    { v: 'final', l: t('m_product_final'), sub: t('m_product_sub_final'), icon: 'star' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {options.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
                  style={{
                    padding: '14px 12px',
                    border: '1.5px solid ' + (active ? 'var(--gold)' : 'var(--line)'),
                    background: active ? 'var(--green-deep)' : 'var(--white)',
                    color: active ? 'var(--cream)' : 'var(--ink)',
                    borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'all .12s',
                    position: 'relative',
                  }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: active ? 'rgba(201,162,74,.18)' : 'var(--cream-warm)',
              color: active ? 'var(--gold-soft)' : 'var(--green)',
              display: 'grid', placeItems: 'center',
            }}>
              <I name={o.icon} size={14} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{o.l}</div>
            <div style={{ fontSize: 11, opacity: .75, lineHeight: 1.3 }}>{o.sub}</div>
            {active && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 16, height: 16, borderRadius: 8,
                background: 'var(--gold)', color: 'var(--green-deep)',
                display: 'grid', placeItems: 'center',
              }}>
                <I name="check" size={10} stroke={3} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ImmigrationPicker({ value, onChange, t }) {
  const options = [
    { v: 'citizen',     l: t('m_imm_citizen') },
    { v: 'resident',    l: t('m_imm_resident') },
    { v: 'itin',        l: t('m_imm_itin') },
    { v: 'passport',    l: t('m_imm_passport') },
    { v: 'consular',    l: t('m_imm_consular') },
    { v: 'homecountry', l: t('m_imm_homecountry') },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {options.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(active ? '' : o.v)}
                  style={{
                    padding: '10px 8px',
                    border: '1px solid ' + (active ? 'var(--green)' : 'var(--line)'),
                    background: active ? 'var(--green)' : 'var(--white)',
                    color: active ? 'var(--cream)' : 'var(--ink)',
                    borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all .12s',
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

window.Matcher = Matcher;
