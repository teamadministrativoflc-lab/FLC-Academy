function Companies({ t, lang, setPage, selectedCompany, setSelectedCompany }) {
  const carriers = window.COMPANIES;
  const [openId, setOpenId] = React.useState(selectedCompany || carriers[0].id);

  React.useEffect(() => {
    if (selectedCompany) {
      setOpenId(selectedCompany);
      setSelectedCompany(null);
    }
  }, [selectedCompany]);

  const active = carriers.find(c => c.id === openId) || carriers[0];

  return (
    <div data-screen-label="03 Companies">
      <div className="breadcrumb">{t('nav_tools')} · <span>{t('nav_companies')}</span></div>
      <h1 className="page-title">{t('c_title_a')} <em>{t('c_title_b')}</em></h1>
      <p className="page-sub">{t('c_sub')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {carriers.map(c => (
          <div key={c.id}
               onClick={() => setOpenId(c.id)}
               style={{
                 padding: 16,
                 background: openId === c.id ? c.color : 'var(--white)',
                 color: openId === c.id ? 'white' : 'var(--ink)',
                 border: '1px solid ' + (openId === c.id ? c.color : 'var(--line)'),
                 borderRadius: 10,
                 cursor: 'pointer',
                 transition: 'all .15s',
                 display: 'flex', alignItems: 'center', gap: 10,
               }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: openId === c.id ? 'rgba(255,255,255,.16)' : c.color,
              color: 'white',
              display: 'grid', placeItems: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{c.logoText}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              <div style={{ fontSize: 11, opacity: .8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lang === 'es' ? c.tag_es : c.tag_en}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '32px 40px',
          background: `linear-gradient(135deg, ${active.color} 0%, ${active.color}dd 100%)`,
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 12,
              background: 'rgba(255,255,255,.15)',
              display: 'grid', placeItems: 'center',
              fontSize: 22, fontWeight: 700, letterSpacing: '0.02em',
            }}>{active.logoText}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: .7, marginBottom: 4 }}>
                {t('nav_companies')}
              </div>
              <div className="serif" style={{ fontSize: 36, color: 'white', lineHeight: 1.1 }}>{active.name}</div>
              <div style={{ fontSize: 15, opacity: .85, marginTop: 4 }}>
                {lang === 'es' ? active.tag_es : active.tag_en}
              </div>
            </div>
            <button className="btn-gold" onClick={() => setPage('matcher')}>
              <I name="compass" size={14} /> {t('c_open_matcher')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 24, fontSize: 13, opacity: .9 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: .7 }}>
                {lang === 'es' ? 'Rango de edad' : 'Age range'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                {active.ageRange[0]} – {active.ageRange[1]}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: .7 }}>
                {t('c_products')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                {(lang === 'es' ? active.products_es : active.products_en).join(' · ')}
              </div>
            </div>
          </div>
        </div>

        {active.highlight_es && (
          <div style={{
            padding: '18px 40px',
            background: 'linear-gradient(90deg, rgba(124,179,66,.10), rgba(124,179,66,.02))',
            borderBottom: '1px solid var(--line-soft)',
            fontSize: 14, fontWeight: 500, color: 'var(--green-dark)',
          }}>
            {lang === 'es' ? active.highlight_es : active.highlight_en}
          </div>
        )}

        <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              color: 'var(--success)',
            }}>
              <I name="check" size={16} stroke={2.2} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {t('c_strengths')}
              </div>
            </div>
            {(lang === 'es' ? active.strengths_es : active.strengths_en).map((s, i) => (
              <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none', fontSize: 14 }}>
                {s}
              </div>
            ))}
          </div>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              color: 'var(--warn)',
            }}>
              <I name="warning" size={16} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {t('c_watchouts')}
              </div>
            </div>
            {(lang === 'es' ? active.watchouts_es : active.watchouts_en).map((s, i) => (
              <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none', fontSize: 14 }}>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 40px 32px', borderTop: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'var(--ink-mute)', marginBottom: 8 }}>
            {t('c_underwriting')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)' }}>
            {lang === 'es' ? active.underwriting_es : active.underwriting_en}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Companies = Companies;
