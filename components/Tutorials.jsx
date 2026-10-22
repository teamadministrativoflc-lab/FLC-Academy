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

function Tutorials({ t, lang, user }) {
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
  const [completed, setCompleted] = React.useState({});
  const [trackingError, setTrackingError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    setCompleted({});setTrackingError('');
    if (!user?.id || !window.flcSupabase) return;
    window.flcSupabase.from('tutorial_completions').select('tutorial_id,completed_at')
      .eq('agent_id',user.id).then(({data,error}) => {
        if(!active) return;
        if(error){setTrackingError('El registro de tutoriales aún no está disponible.');return;}
        setCompleted(Object.fromEntries((data||[]).map(r=>[r.tutorial_id,r.completed_at])));
      });
    return () => {active=false;};
  },[user?.id]);
  const markComplete = async (v) => {
    if(!user?.id || saving || completed[v.id])return;
    setSaving(true);setTrackingError('');
    try {
      const {data:{user:sessionUser},error:authError}=await window.flcSupabase.auth.getUser();
      if(authError||sessionUser?.id!==user.id) throw Error('Acceso no válido');
      const {data,error}=await window.flcSupabase.rpc('flc_complete_watched_tutorial',{p_tutorial_id:v.id});
      if(error)throw error;
      setCompleted(old=>({...old,[v.id]:data}));
    } catch(e){setTrackingError('No se pudo guardar el tutorial. Contacta a Administración.');}
    finally{setSaving(false);}
  };

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
      <p style={{marginBottom:20,fontWeight:600}}>✓ {Object.keys(completed).length} {lang==='es'?'tutoriales completados (reproducción registrada)':'tutorials completed (playback tracked)'}</p>
      {trackingError&&<p role="alert" style={{color:'#aa3322'}}>{trackingError}</p>}

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
              <VideoCard key={v.id} v={v} lang={lang} color={group.color} completed={!!completed[v.id]}
                         onPlay={() => setPlaying({ ...v, company: group.company, color: group.color })} />
            ))}
          </div>
        </div>
      ))}

      {playing && <VideoModal key={playing.id} v={playing} lang={lang} user={user} completed={!!completed[playing.id]} saving={saving} onComplete={() => markComplete(playing)} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function VideoCard({ v, lang, color, onPlay, completed }) {
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
        {completed && <div style={{color:'#23783a',fontSize:12,marginTop:8,fontWeight:700}}>✓ {lang==='es'?'Completado':'Completed'}</div>}
      </div>
    </div>
  );
}

// The YouTube iframe API exposes current time, duration and seeking events.
// Segment coverage is stored in Supabase, rather than counting jumps to the end.
let flcYouTubeAPI;
function flcLoadYouTubeAPI() {
  if(window.YT?.Player)return Promise.resolve();
  if(!flcYouTubeAPI)flcYouTubeAPI=new Promise((resolve,reject)=>{
    const old=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{if(typeof old==='function')old();resolve();};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>reject(Error('YouTube API unavailable'));document.head.appendChild(script);
  });
  return flcYouTubeAPI;
}
function WatchedYouTube({v,user,lang,completed,onComplete}) {
  const mount=React.useRef(null),player=React.useRef(null),segments=React.useRef(new Set());
  const durationRef=React.useRef(0),lastRef=React.useRef(null),savingRef=React.useRef(false);
  const [coverage,setCoverage]=React.useState(0),[status,setStatus]=React.useState('');
  const [ready,setReady]=React.useState(false);
  React.useEffect(()=>{
    let active=true,interval=null,dirty=false;
    const total=()=>Math.ceil(durationRef.current/5);
    const percent=()=>total()?Math.min(100,Math.round(100*segments.current.size/total())):0;
    const persist=async()=>{
      if(!dirty||savingRef.current||!user?.id||!durationRef.current)return;
      savingRef.current=true;dirty=false;
      const ids=[...segments.current].sort((a,b)=>a-b);
      try {
        const {error}=await window.flcSupabase.from('tutorial_watch_progress').upsert({
          agent_id:user.id,tutorial_id:v.id,watched_segments:ids,duration_seconds:Math.ceil(durationRef.current),
          updated_at:new Date().toISOString()
        },{onConflict:'agent_id,tutorial_id'});
        if(error)throw error;
        if(ids.length/Math.max(1,total())>=0.95&&!completed) await onComplete();
      }catch(e){dirty=true;if(active)setStatus(lang==='es'?'No se pudo guardar el progreso.':'Unable to save progress.');}
      finally{savingRef.current=false;}
    };
    const begin=async()=>{
      try {
        const {data,error}=await window.flcSupabase.from('tutorial_watch_progress')
         .select('watched_segments,duration_seconds').eq('agent_id',user.id).eq('tutorial_id',v.id).maybeSingle();
        if(error)throw error;
        if(!active)return;
        segments.current=new Set(data?.watched_segments||[]);
        durationRef.current=Number(data?.duration_seconds)||0;
        setCoverage(percent());
        await flcLoadYouTubeAPI();
        if(!active||!mount.current)return;
        const match=v.url.match(/(?:youtu.be\/|youtube.com\/watch\?v=)([A-Za-z0-9_-]+)/);
        if(!match)throw Error('Invalid video URL');
        player.current=new window.YT.Player(mount.current,{
          videoId:match[1],
          playerVars:{rel:0,playsinline:1,origin:window.location.origin},
          events:{onReady:e=>{
            const d=e.target.getDuration();
            if(d>0)durationRef.current=d;
            if(active)setReady(true);
          }}
        });
        interval=setInterval(()=>{
          const p=player.current;if(!p||!active)return;
          const duration=Number(p.getDuration?.()),time=Number(p.getCurrentTime?.());
          if(duration>0)durationRef.current=duration;
          if(!Number.isFinite(time)||!durationRef.current)return;
          const playing=p.getPlayerState?.()===window.YT.PlayerState.PLAYING;
          const now=Date.now(),prior=lastRef.current;
          if(playing&&prior&&prior.playing){
            const elapsed=(now-prior.now)/1000,delta=time-prior.time;
            // Count only ordinary playback (not forward seeking).
            if(delta>=0&&delta<=Math.max(2.5,elapsed*2.2)&&elapsed<4) {
              const start=Math.floor(prior.time/5),end=Math.floor(time/5);
              for(let n=start;n<=end;n++)if(n>=0&&n<total()&&!segments.current.has(n)){segments.current.add(n);dirty=true;}
              setCoverage(percent());
            }
          }
          lastRef.current={time,now,playing};
        },1000);
      }catch(e){if(active)setStatus(lang==='es'?'No se puede registrar este video.':'Cannot track this video.');}
    };
    begin();
    const saveInterval=setInterval(()=>{persist();},5000);
    return ()=>{active=false;if(interval)clearInterval(interval);clearInterval(saveInterval);persist();try{player.current?.destroy?.();}catch(e){}};
  },[v.id,user?.id]);
  return <React.Fragment>
    <div style={{aspectRatio:'16 / 9',background:'#000'}}><div ref={mount} style={{width:'100%',height:'100%'}} /></div>
    <div style={{padding:'12px 28px',background:'white'}}>
      <strong>{completed?'✓ '+(lang==='es'?'Completado':'Completed'):(lang==='es'?'Reproducción registrada: ':'Tracked playback: ')+coverage+'%'}</strong>
      <div style={{height:7,background:'#e8ece4',borderRadius:5,marginTop:8,overflow:'hidden'}}><div style={{width:coverage+'%',height:'100%',background:'#347542'}} /></div>
      <div style={{fontSize:12,marginTop:8,color:'#536454'}}>{lang==='es'?'El tutorial se completará automáticamente al registrar el 95 % reproducido. Adelantar no suma progreso.':'Automatically completed at 95% tracked playback. Seeking does not count.'}</div>
      {status&&<div role="alert" style={{fontSize:12,color:'#a33'}}>{status}</div>}
    </div>
  </React.Fragment>;
}
function VideoModal({v,lang,user,onClose,completed,saving,onComplete}) {
  const youtube=isYouTube(v.url);
  return <div style={{position:'fixed',inset:0,background:'rgba(5,8,5,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:24}} onClick={onClose}>
   <div style={{background:'var(--paper)',borderRadius:16,width:'min(1000px,100%)',maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
    <div style={{position:'relative'}}>
     {youtube?<WatchedYouTube v={v} user={user} lang={lang} completed={completed} onComplete={onComplete} />:
      <React.Fragment><div style={{aspectRatio:'16 / 9',background:'#000'}}><iframe src={toEmbedUrl(v.url)} allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={{width:'100%',height:'100%',border:0}} /></div>
       <p style={{padding:16,color:'#835b18'}}>{lang==='es'?'Pendiente: este video de Google Drive todavía no admite verificación de reproducción.':'Pending: this Google Drive video cannot yet be tracked.'}</p></React.Fragment>}
     <button onClick={onClose} aria-label="Cerrar video" style={{position:'absolute',top:10,right:10,background:'#222',color:'white',border:0,borderRadius:24,padding:'8px 13px',cursor:'pointer'}}>✕</button>
    </div>
    <div style={{padding:'16px 28px',background:'white'}}><strong>{lang==='es'?v.title_es:v.title_en}</strong> — {v.company}</div>
   </div>
  </div>;
}
window.Tutorials = Tutorials;
