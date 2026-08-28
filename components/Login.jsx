function Login({ onLogin, t, lang, setLang }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const expected = (window.AGENCY_CONFIG && window.AGENCY_CONFIG.agencyPassword) || 'FLC2026';
    if (password.trim() !== expected) {
      setError(lang === 'es'
        ? 'Contraseña incorrecta. Contacta a tu agencia si no la tienes.'
        : 'Wrong password. Contact your agency if you don\'t have it.');
      return;
    }
    if (!name.trim()) {
      setError(lang === 'es'
        ? 'Por favor escribe tu nombre.'
        : 'Please enter your name.');
      return;
    }
    const cleanName = name.trim();
    const displayName = cleanName.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    onLogin({ email, name: displayName });
  };

  return (
    <div className="login-wrap" data-screen-label="00 Login">
      <div className="login-hero">
        <div className="login-brand">
          <div className="login-brand-mark">
            <img src="assets/logo.png" alt="Future Legacy Creators" />
          </div>
          <div>
            <div className="login-brand-name">Future Legacy</div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(165,214,112,.75)' }}>CREATORS · ACADEMY</div>
          </div>
        </div>

        <div className="login-hero-body">
          <div className="login-tag">{t('login_tag')}</div>
          <h1>
            {t('login_h1_a')}<br/>
            <em>{t('login_h1_b')}</em>
          </h1>
          <p>{t('login_intro')}</p>
        </div>

        <div className="login-hero-footer">
          <div><strong>8</strong>{t('login_stat1_l')}</div>
          <div><strong>40+</strong>{t('login_stat2_l')}</div>
          <div><strong>6</strong>{t('login_stat3_l')}</div>
        </div>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div className="lang-toggle">
            <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>

        <h2>{t('login_welcome_back')}</h2>
        <p className="login-form-sub">
          {lang === 'es'
            ? 'Ingresa tu nombre y la contraseña que te dio tu agencia.'
            : 'Enter your name and the password provided by your agency.'}
        </p>

        <div className="field">
          <label>{lang === 'es' ? 'Tu nombre completo' : 'Your full name'} *</label>
          <input type="text" required placeholder={lang === 'es' ? 'Carlos Rivera' : 'Carlos Rivera'}
                 value={name} onChange={e => setName(e.target.value)} />
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 6 }}>
            {lang === 'es'
              ? 'Aparecerá en tu certificado al terminar la formación.'
              : 'Will appear on your certificate when you complete training.'}
          </div>
        </div>

        <div className="field">
          <label>{t('login_email')}</label>
          <input type="email" required placeholder="carlos@futurelegacy.com"
                 value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label>{lang === 'es' ? 'Contraseña de la agencia' : 'Agency password'} *</label>
          <input type="password" required placeholder="••••••••"
                 value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 6 }}>
            {lang === 'es'
              ? 'Tu manager te la comparte.'
              : 'Your manager shares it with you.'}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginTop: 4, marginBottom: 4,
            background: 'rgba(176,74,60,.1)',
            border: '1px solid rgba(176,74,60,.3)',
            borderRadius: 6,
            color: 'var(--danger)',
            fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <I name="warning" size={14} /> {error}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ marginTop: 12 }}>
          {t('login_submit')} <I name="arrow" size={16} />
        </button>

        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--ink-mute)', textAlign: 'center' }}>
          {lang === 'es'
            ? '¿Nuevo en la agencia? Pídele la contraseña a tu manager.'
            : 'New to the agency? Ask your manager for the password.'}
        </div>
      </form>
    </div>
  );
}

window.Login = Login;
