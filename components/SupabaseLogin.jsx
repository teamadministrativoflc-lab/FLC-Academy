function SupabaseLogin({ onLogin, lang, setLang }) {
 const [email,setEmail]=React.useState('');
 const [password,setPassword]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const [error,setError]=React.useState('');
 async function submit(e){
  e.preventDefault(); setError('');setBusy(true);
  try{
   const {data,error:authError}=await window.flcSupabase.auth.signInWithPassword({email:email.trim(),password});
   setPassword('');
   if(authError) throw authError;
   const {data:profile,error:profileError}=await window.flcSupabase.from('agent_profiles').select('full_name,role').eq('id',data.user.id).single();
   if(profileError||!profile){await window.flcSupabase.auth.signOut();throw new Error('profile_missing');}
   onLogin({id:data.user.id,email:data.user.email,name:profile.full_name,role:profile.role});
  }catch(e){setError(lang==='es'?'No fue posible iniciar sesión. Comprueba tus credenciales o solicita ayuda a tu agencia.':'Unable to sign in. Check your credentials or contact the agency.');}
  finally{setBusy(false);}
 }
 return <main style={{maxWidth:460,margin:'8vh auto',background:'white',border:'1px solid #e2e7dc',borderRadius:14,padding:32}}>
  <h1 style={{fontSize:28}}>FLC Academy</h1>
  <p>{lang==='es'?'Acceso individual para agentes autorizados':'Individual sign-in for authorized agents'}</p>
  <div style={{display:'flex',gap:10,marginBottom:16}}><button type="button" onClick={()=>setLang('es')}>ES</button><button type="button" onClick={()=>setLang('en')}>EN</button></div>
  <form onSubmit={submit}>
   <label htmlFor="email">{lang==='es'?'Correo electrónico':'Email'}</label>
   <input id="email" type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'6px 0 18px',border:'1px solid #c4ccc0',borderRadius:6}}/>
   <label htmlFor="password">{lang==='es'?'Contraseña':'Password'}</label>
   <input id="password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'6px 0 18px',border:'1px solid #c4ccc0',borderRadius:6}}/>
   {error&&<p role="alert" style={{color:'#b04a3c'}}>{error}</p>}
   <button type="submit" disabled={busy} style={{background:'#143a1e',color:'white',width:'100%',padding:13,borderRadius:7}}>{busy?'…':lang==='es'?'Entrar a la academia':'Sign in'}</button>
  </form>
  <p style={{fontSize:12,marginTop:20}}>{lang==='es'?'Las cuentas son creadas por la agencia.':'Accounts are created by the agency.'}</p>
 </main>;
}
window.SupabaseLogin=SupabaseLogin;
