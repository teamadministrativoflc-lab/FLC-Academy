function ProductionCenter({user,setPage}) {
 const sources=['AuraFlow','LifeButton','LeadzTech AI','Ecomfy','Leads for Life','Propia campaña','Referido','Familiar / Amistad','Otro'];
 const carriers=['National Life Group','F&G','Foresters','American Amicable','Transamerica','Mutual of Omaha','Aetna','Americo','Lincoln Heritage','Occidental','Corebridge','Athene','Otro'];
 const products=['IUL','Term','Whole Life','Final Expense','Annuity','Mortgage Protection','Key Man','Executive Bonus','Otro'];
 const blank=()=>({client:'',number:'',carrier:'National Life Group',product:'IUL',source:'AuraFlow',other:'',ap:'',partners:[],primaryPct:'100',date:new Date().toISOString().slice(0,10),primary:'',initialDisposition:'Sometida'});
 const [activeSection,setActiveSection]=React.useState('policies');
 const [uplineGoal,setUplineGoal]=React.useState('');
 const [savedUplineGoal,setSavedUplineGoal]=React.useState(null);
 const [goalBusy,setGoalBusy]=React.useState(false);
 const [goalError,setGoalError]=React.useState('');
 const [agencyStandings,setAgencyStandings]=React.useState([]);
 const [agencyStandingsError,setAgencyStandingsError]=React.useState('');
 const [positionMode,setPositionMode]=React.useState('policy_count');
 const [agencyStandingsLoading,setAgencyStandingsLoading]=React.useState(true);
 const [standingsRefresh,setStandingsRefresh]=React.useState(0);
 const [periodType,setPeriodType]=React.useState('month');
 const [periodDate,setPeriodDate]=React.useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const anchor=new Date(periodDate+'T12:00:00Z');
 const start=new Date(anchor);
 if(periodType==='week')start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
 if(periodType==='month')start.setUTCDate(1);
 if(periodType==='year'){start.setUTCMonth(0);start.setUTCDate(1);}
 const end=new Date(start);
 if(periodType==='week')end.setUTCDate(end.getUTCDate()+6);
 if(periodType==='month'){end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);}
 if(periodType==='year'){end.setUTCFullYear(end.getUTCFullYear()+1);end.setUTCDate(0);}
 const iso=d=>d.toISOString().slice(0,10);
 const rangeStart=iso(start),rangeEnd=iso(end),period=rangeStart.slice(0,7);
 const rangeLabel=rangeStart===rangeEnd?rangeStart:rangeStart+' al '+rangeEnd;
 const movePeriod=n=>{const d=new Date(periodDate+'T12:00:00Z');if(periodType==='day')d.setUTCDate(d.getUTCDate()+n);if(periodType==='week')d.setUTCDate(d.getUTCDate()+n*7);if(periodType==='month')d.setUTCMonth(d.getUTCMonth()+n);if(periodType==='year')d.setUTCFullYear(d.getUTCFullYear()+n);setPeriodDate(iso(d));};
 const [carrierFilter,setCarrierFilter]=React.useState('');
 const [rankMode,setRankMode]=React.useState('verified_ap');
 const [structureFilter,setStructureFilter]=React.useState('');
 const [structureIds,setStructureIds]=React.useState([]);
 const [structureLoading,setStructureLoading]=React.useState(false);
 const [structureError,setStructureError]=React.useState('');
 const [teamIds,setTeamIds]=React.useState([]);
 const [splitPartners,setSplitPartners]=React.useState([]);
 const [splitPartnerError,setSplitPartnerError]=React.useState('');
 const [policyCredits,setPolicyCredits]=React.useState({});
 const [creditsError,setCreditsError]=React.useState('');
 const [periodTeams,setPeriodTeams]=React.useState([]);
 const [periodTeamError,setPeriodTeamError]=React.useState('');
 const [leadInvestments,setLeadInvestments]=React.useState([]);
 const [leadError,setLeadError]=React.useState('');
 const [leadSaving,setLeadSaving]=React.useState(false);
 const [leadForm,setLeadForm]=React.useState({spent_on:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),provider:'',amount:'',lead_count:''});
 const [leaderRows,setLeaderRows]=React.useState([]);
 const [verifiedLeaderRows,setVerifiedLeaderRows]=React.useState([]);
 const [verifiedLeaderError,setVerifiedLeaderError]=React.useState('');
 const [rankTimes,setRankTimes]=React.useState({});
 const [rankTimesError,setRankTimesError]=React.useState('');
 const [leaderError,setLeaderError]=React.useState('');
 const [canViewTeam,setCanViewTeam]=React.useState(user.role==='admin');
 const [verificationBusy,setVerificationBusy]=React.useState(false);
 const [apEditing,setApEditing]=React.useState(null);
 const [apCorrections,setApCorrections]=React.useState([]);
 const [apSaving,setApSaving]=React.useState(false);
 const [historyPolicy,setHistoryPolicy]=React.useState(null);
 const [historyRows,setHistoryRows]=React.useState([]);
 const [editing,setEditing]=React.useState(null),[statusSaving,setStatusSaving]=React.useState(false);
 const [form,setForm]=React.useState(blank),[agents,setAgents]=React.useState([]),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(true),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[tab,setTab]=React.useState('list');
 const load=async()=>{setBusy(true);setError('');let all=[];
  for(let offset=0;offset<20000;offset+=1000){
   const {data,error}=await window.flcSupabase.from('flc_policy_sales').select('id,agent_id,client_name,carrier,product_type,policy_number,lead_source,status,annual_premium,split_agent_id,split_primary_pct,submitted_on,approved_on,issue_paid_on,issue_paid_verified_at,issue_paid_verified_by,created_at').order('created_at',{ascending:false}).range(offset,offset+999);
   if(error){setError('No se pudo cargar la producción completa. Reintenta.');break;}
   all=all.concat(data||[]);if(!data||data.length<1000)break;
  }
  setRows(all);
  const corrections=await window.flcSupabase.from('flc_policy_ap_corrections')
   .select('id,policy_id,requested_by,previous_ap,requested_ap,reason,state,reviewed_by,reviewed_at,created_at')
   .order('created_at',{ascending:false}).limit(500);
  if(!corrections.error)setApCorrections(corrections.data||[]);
  setBusy(false);};
 React.useEffect(()=>{let active=true;setAgencyStandingsLoading(true);setAgencyStandingsError('');
  window.flcSupabase.rpc('flc_agency_submitted_standings',{p_start:rangeStart,p_end:rangeEnd}).then(({data,error})=>{
   if(!active)return;setAgencyStandingsLoading(false);
   if(error){setAgencyStandings([]);setAgencyStandingsError('Falta activar SQL 035 para mostrar las posiciones de la agencia.');}
   else{setAgencyStandings(data||[]);setAgencyStandingsError('');}
  });return()=>{active=false;};
 },[rangeStart,rangeEnd,user.id,standingsRefresh]);
 const loadLeads=async()=>{let all=[];for(let offset=0;offset<20000;offset+=1000){
  const {data,error}=await window.flcSupabase.from('flc_lead_investments').select('id,agent_id,spent_on,provider,amount,lead_count,created_at').order('spent_on',{ascending:false}).range(offset,offset+999);
  if(error){setLeadError('Para inversión en leads falta ejecutar SQL 020 o no hay permiso.');setLeadInvestments([]);return;}
  all=all.concat(data||[]);if(!data||data.length<1000)break;
 }setLeadInvestments(all);setLeadError('');};
 React.useEffect(()=>{loadLeads();},[user.id]);
 const saveLead=async e=>{e.preventDefault();const amount=Number(leadForm.amount),count=leadForm.lead_count?Number(leadForm.lead_count):null;
  if(!leadForm.provider.trim()||amount<=0||!leadForm.spent_on||count!==null&&(!Number.isInteger(count)||count<1)){setLeadError('Completa fecha, proveedor e inversión válida.');return;}
  setLeadSaving(true);
  const {error}=await window.flcSupabase.from('flc_lead_investments').insert({agent_id:user.id,spent_on:leadForm.spent_on,provider:leadForm.provider.trim(),amount,lead_count:count});
  setLeadSaving(false);if(error){setLeadError('No se pudo guardar la inversión: '+error.message);return;}
  setLeadForm(x=>({...x,provider:'',amount:'',lead_count:''}));await loadLeads();setNotice('Inversión en leads registrada (declarada por el agente, sin validación administrativa).');
 };
 React.useEffect(()=>{let active=true;if(!canViewTeam)return;setPeriodTeamError('');
  window.flcSupabase.rpc('flc_period_team_metrics',{p_start:rangeStart,p_end:rangeEnd,p_carrier:carrierFilter||null}).then(({data,error})=>{
   if(!active)return;if(error){setPeriodTeams([]);setPeriodTeamError('Falta activar SQL 020 para los promedios y períodos de equipos.');}else{setPeriodTeams(data||[]);setPeriodTeamError('');}
  });return()=>{active=false;};
 },[canViewTeam,rangeStart,rangeEnd,carrierFilter,user.id]);
 React.useEffect(()=>{let active=true;window.flcSupabase.rpc('flc_policy_participant_credits').then(({data,error})=>{
  if(!active)return;
  if(error){setCreditsError('Falta activar SQL 019 para splits múltiples.');setPolicyCredits({});return;}
  const grouped={};(data||[]).forEach(r=>{(grouped[r.policy_id]||(grouped[r.policy_id]=[])).push(r);});
  setPolicyCredits(grouped);setCreditsError('');
 });return()=>{active=false;};},[user.id,rows]);
 React.useEffect(()=>{let active=true;window.flcSupabase.rpc('flc_split_partner_roster').then(({data,error})=>{if(!active)return;if(error){setSplitPartnerError('Falta habilitar la selección de agentes. Ejecuta SQL 018 en Supabase.');setSplitPartners([]);}else{setSplitPartnerError('');setSplitPartners(data||[]);}});return()=>{active=false;};},[user.id]);
 React.useEffect(()=>{load();const fetchTeam=async()=>{
  if(user.role==='admin'){
   const {data}=await window.flcSupabase.rpc('flc_admin_team_roster');
   if(data){setAgents(data);setTeamIds(data.map(a=>a.id));}
   setCanViewTeam(true);
  }else{
   const {data:isLeader}=await window.flcSupabase.rpc('flc_is_team_leader');
   if(isLeader){
    const {data,error}=await window.flcSupabase.rpc('flc_my_team_report');
    if(!error){setTeamIds((data||[]).map(a=>a.agent_id));setAgents(data||[]);setCanViewTeam(true);}
   }else{setCanViewTeam(false);setTeamIds([]);}
  }
 };fetchTeam();},[user.id]);
 React.useEffect(()=>{let active=true;if(!canViewTeam)return;
 window.flcSupabase.rpc('flc_leader_production_report',{p_month:period,p_carrier:carrierFilter||null}).then(({data,error})=>{
 if(!active)return;if(error){setLeaderError('Falta habilitar el reporte de líderes en Supabase.');setLeaderRows([]);}else{setLeaderError('');setLeaderRows(data||[]);}
 });return()=>{active=false;};},[canViewTeam,period,carrierFilter,user.id]);
 React.useEffect(()=>{let active=true;setStructureError('');if(user.role!=='admin'||!structureFilter){setStructureIds([]);setStructureLoading(false);return;}setStructureLoading(true);window.flcSupabase.rpc('flc_admin_structure_member_ids',{p_leader_id:structureFilter}).then(({data,error})=>{if(!active)return;setStructureLoading(false);if(error){setStructureIds([]);setStructureError('No se pudo cargar la estructura. Ejecuta el archivo SQL 012 en Supabase.');}else setStructureIds((data||[]).map(x=>x.agent_id));});return()=>{active=false;};},[structureFilter,user.id]);
 React.useEffect(()=>{let active=true;if(!canViewTeam)return;window.flcSupabase.rpc('flc_leader_verified_production_report',{p_month:period,p_carrier:carrierFilter||null}).then(({data,error})=>{if(!active)return;setVerifiedLeaderError(error?'No se pudo cargar la AP verificada de líderes. Reintenta antes de consultar el ranking.':'');setVerifiedLeaderRows(error?[]:data||[]);});return()=>{active=false;};},[canViewTeam,period,carrierFilter,user.id]);
 React.useEffect(()=>{let active=true;if(!canViewTeam)return;
  setRankTimes({});setRankTimesError('');
  window.flcSupabase.rpc('flc_leader_verified_rank_times',{p_month:period,p_carrier:carrierFilter||null}).then(({data,error})=>{
   if(!active)return;
   if(error){setRankTimesError('No se pudo consultar el desempate (SQL 017).'+(user.role==='admin'?' Código: '+(error.code||'desconocido')+' · '+(error.message||'sin detalle'):' Contacta a Administración.'));return;}
   setRankTimes(Object.fromEntries((data||[]).map(x=>[x.leader_id,x.reached_at])));
  });return()=>{active=false;};
 },[canViewTeam,period,carrierFilter,user.id]);
 const filteredRows=rows.filter(x=>!carrierFilter||x.carrier===carrierFilter);
 const monthRows=filteredRows.filter(x=>x.submitted_on&&x.submitted_on>=rangeStart&&x.submitted_on<=rangeEnd);
 const monthAP=monthRows.reduce((n,x)=>n+Number(x.annual_premium),0);
 const paidRows=filteredRows.filter(x=>x.status==='Issue Paid'&&x.issue_paid_on&&x.issue_paid_on>=rangeStart&&x.issue_paid_on<=rangeEnd);
 const paidAP=paidRows.reduce((n,x)=>n+Number(x.annual_premium),0);
 const verifiedRows=paidRows.filter(x=>x.issue_paid_verified_at);
 const verifiedAP=verifiedRows.reduce((n,x)=>n+Number(x.annual_premium),0);
 const allocations=x=>policyCredits[x.id]||[
  {agent_id:x.agent_id,pct:Number(x.split_primary_pct),is_primary:true},
  ...(x.split_agent_id?[{agent_id:x.split_agent_id,pct:100-Number(x.split_primary_pct),is_primary:false}]:[])
 ];
 const participates=(x,id)=>allocations(x).some(a=>a.agent_id===id);
 const creditFor=(x,id)=>Number(x.annual_premium)*allocations(x).filter(a=>a.agent_id===id).reduce((n,a)=>n+Number(a.pct),0)/100;
 const myCredit=x=>creditFor(x,user.id);
 const myAP=monthRows.reduce((n,x)=>n+myCredit(x),0);
 const myPaid=paidRows.reduce((n,x)=>n+myCredit(x),0);
 const myVerified=verifiedRows.reduce((n,x)=>n+myCredit(x),0);
 const mySubmitted=monthRows.filter(x=>participates(x,user.id));
 const myIssued=paidRows.filter(x=>participates(x,user.id));
 const memberSet=new Set(user.role==='admin'&&structureFilter?structureIds:[user.id,...teamIds]);
 const teamCredit=x=>Number(x.annual_premium)*allocations(x).filter(a=>memberSet.has(a.agent_id)).reduce((n,a)=>n+Number(a.pct),0)/100;
 const teamSubmitted=monthRows.filter(x=>allocations(x).some(a=>memberSet.has(a.agent_id)));
 const teamIssued=paidRows.filter(x=>allocations(x).some(a=>memberSet.has(a.agent_id)));
 const teamAP=teamSubmitted.reduce((n,x)=>n+teamCredit(x),0);
 const teamPaid=teamIssued.reduce((n,x)=>n+teamCredit(x),0);
 const teamVerified=verifiedRows.reduce((n,x)=>n+teamCredit(x),0);
 const creditedNames={};
 Object.values(policyCredits).forEach(shares=>shares.forEach(a=>{if(a.full_name)creditedNames[a.agent_id]=a.full_name;}));
 const agentBreakdown=(user.role==='admin'&&structureFilter?structureIds:[user.id,...teamIds]).filter((id,i,a)=>a.indexOf(id)===i).map(id=>{
  const share=x=>creditFor(x,id);
  const submitted=monthRows.filter(x=>participates(x,id));
  const issued=paidRows.filter(x=>participates(x,id));
  const verified=verifiedRows.filter(x=>participates(x,id));
  return {id,name:id===user.id?user.name:(agents.find(a=>a.id===id)?.full_name||creditedNames[id]||''),submitted:submitted.length,ap:submitted.reduce((n,x)=>n+share(x),0),issued:issued.length,paid:issued.reduce((n,x)=>n+share(x),0),verified:verified.reduce((n,x)=>n+share(x),0)};
 }).filter(a=>a.submitted||a.issued).sort((a,b)=>b.ap-a.ap);
 // First compare credited verified AP, then earliest server-created policy.
 // For two agents tied on the same verified policy, its principal wins.
 const firstVerifiedRecord=id=>verifiedRows.filter(p=>participates(p,id)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))[0];
 const rankAgents=(a,b)=>{
  const apDiff=Math.round((b.verified-a.verified)*100);
  if(apDiff)return apDiff;
  const ap=firstVerifiedRecord(a.id),bp=firstVerifiedRecord(b.id);
  if(ap&&bp&&ap.id===bp.id){
   if(ap.agent_id===a.id&&ap.agent_id!==b.id)return -1;
   if(ap.agent_id===b.id&&ap.agent_id!==a.id)return 1;
  }
  const timeA=ap?new Date(ap.created_at).getTime():Infinity;
  const timeB=bp?new Date(bp.created_at).getTime():Infinity;
  if(timeA!==timeB)return timeA-timeB;
  return (a.name||'').localeCompare(b.name||'','es');
 };
 const podium=agentBreakdown.filter(a=>a.verified>0).sort(rankAgents).slice(0,10);
 const rankingTypes=[
  {value:'verified_ap',label:'🏆 AP Issue Paid verificada',short:'AP Issue Paid verificada'},
  {value:'policy_count',label:'📋 Pólizas sometidas',short:'Pólizas sometidas'},
  {value:'submitted_ap',label:'💰 AP sometida',short:'AP sometida acreditada'},
  {value:'effectiveness',label:'🎯 Efectividad de sometidas',short:'Efectividad verificada'},
  {value:'lead_investment',label:'📈 Inversión en leads',short:'Inversión declarada'},
  {value:'team_average',label:'👥 Promedio por agente productor (equipos)',short:'Promedio de equipo'}
 ];
 // Cohorte: pólizas sometidas en el mes seleccionado. Solo cuenta como
 // conversión una póliza que finalmente obtuvo Issue Paid verificada.
 const scopedLeads=leadInvestments.filter(l=>l.spent_on>=rangeStart&&l.spent_on<=rangeEnd);
 const spendByAgent={};const providersByAgent={};
 scopedLeads.forEach(l=>{spendByAgent[l.agent_id]=(spendByAgent[l.agent_id]||0)+Number(l.amount);(providersByAgent[l.agent_id]||(providersByAgent[l.agent_id]=new Set())).add(l.provider);});
 const rankingRows=agentBreakdown.map(a=>{
  const cohort=monthRows.filter(p=>participates(p,a.id));
  const converted=cohort.filter(p=>p.status==='Issue Paid'&&!!p.issue_paid_verified_at);
  return {...a,investment:spendByAgent[a.id]||0,providers:[...(providersByAgent[a.id]||[])],cohortCount:cohort.length,convertedCount:converted.length,
   effectiveness:cohort.length?100*converted.length/cohort.length:0};
 });
 const knownAgentIds=new Set(rankingRows.map(a=>a.id));
 Object.keys(spendByAgent).forEach(id=>{if(knownAgentIds.has(id))return;
  const allowed=user.role==='admin'&&structureFilter?structureIds:[user.id,...teamIds];
  if(!allowed.includes(id))return;
  rankingRows.push({id,name:id===user.id?user.name:(agents.find(a=>a.id===id)?.full_name||splitPartners.find(a=>a.id===id)?.full_name||creditedNames[id]||'Agente'),investment:spendByAgent[id],providers:[...providersByAgent[id]],verified:0,ap:0,cohortCount:0,convertedCount:0,effectiveness:0});
 });
 const eligibleTeams=periodTeams.filter(t=>t.scope==='team'&&Number(t.depth)===1);
 const teamAverageRows=eligibleTeams.map(t=>({...t,id:t.leader_id,name:t.leader_name,
  submittedAverage:Number(t.submitting_agents)>0?Number(t.submitted_ap)/Number(t.submitting_agents):0,
  verifiedAverage:Number(t.verified_agents)>0?Number(t.verified_ap)/Number(t.verified_agents):0}));
 const agencyTotals=periodTeams.find(t=>t.scope==='agency');
 const selectedRanking=rankingTypes.find(t=>t.value===rankMode)||rankingTypes[0];
 const rankingValue=a=>rankMode==='team_average'?a.verifiedAverage:rankMode==='policy_count'?a.cohortCount:
  rankMode==='submitted_ap'?a.ap:rankMode==='effectiveness'?a.effectiveness:rankMode==='lead_investment'?a.investment:a.verified;
 const rankingValueText=a=>rankMode==='team_average'?fmt(a.verifiedAverage):rankMode==='policy_count'?a.cohortCount.toLocaleString('en-US'):
  rankMode==='effectiveness'?a.effectiveness.toFixed(1)+'%':fmt(rankingValue(a));
 const rankingContext=a=>rankMode==='team_average'?'Sometida: '+fmt(a.submittedAverage)+' · '+a.submitting_agents+' agentes que sometieron · '+a.verified_agents+' con IP verificada':rankMode==='effectiveness'
  ?a.convertedCount+' de '+a.cohortCount+' pólizas verificadas'
  :rankMode==='verified_ap'?'⭐ '+legacyPoints(a.verified)+' Legacy Points'
  :rankMode==='policy_count'?fmt(a.ap)+' de AP sometida acreditada'
  :rankMode==='lead_investment'?'Proveedores: '+(a.providers||[]).join(', ')
  :a.cohortCount+' pólizas sometidas';
 const firstRecord=id=>{
  if(rankMode==='lead_investment')return scopedLeads.filter(l=>l.agent_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))[0];
  const eligible=rankMode==='verified_ap'||rankMode==='team_average'?verifiedRows:monthRows;
  return eligible.filter(p=>participates(p,id))
   .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))[0];
 };
 const rankedAgentRows=(rankMode==='team_average'?teamAverageRows:rankingRows).filter(a=>rankMode==='team_average'?(Number(a.submitting_agents)>0||Number(a.verified_agents)>0):rankMode==='effectiveness'?a.cohortCount>0:rankingValue(a)>0)
 .sort((a,b)=>{
  const diff=rankingValue(b)-rankingValue(a);
  if(Math.abs(diff)>0.000001)return diff>0?1:-1;
  if(rankMode==='team_average'){
   if(b.submittedAverage!==a.submittedAverage)return b.submittedAverage-a.submittedAverage;
   const tA=a.verified_reached_at?new Date(a.verified_reached_at).getTime():Infinity;
   const tB=b.verified_reached_at?new Date(b.verified_reached_at).getTime():Infinity;
   return tA!==tB?tA-tB:(a.name||'').localeCompare(b.name||'','es');
  }
  if(rankMode==='effectiveness'){
   if(b.convertedCount!==a.convertedCount)return b.convertedCount-a.convertedCount;
   if(b.cohortCount!==a.cohortCount)return b.cohortCount-a.cohortCount;
  }else if(rankMode==='policy_count'){
   if(Math.abs(b.ap-a.ap)>0.001)return b.ap-a.ap;
  }else if(rankMode==='submitted_ap'){
   if(b.cohortCount!==a.cohortCount)return b.cohortCount-a.cohortCount;
  }
  const pa=firstRecord(a.id),pb=firstRecord(b.id);
  if(pa&&pb&&pa.id===pb.id){
   if(pa.agent_id===a.id&&pa.agent_id!==b.id)return -1;
   if(pa.agent_id===b.id&&pa.agent_id!==a.id)return 1;
  }
  const ta=pa?new Date(pa.created_at).getTime():Infinity;
  const tb=pb?new Date(pb.created_at).getTime():Infinity;
  return ta!==tb?ta-tb:(a.name||'').localeCompare(b.name||'','es');
 }).slice(0,10);
 // Each leader report row represents that leader and every descendant.
 // Team ranking compares managers directly below the agency owner (depth 1).
 // Each manager's verified AP includes their own production and descendants.
 const visibleLeaders=leaderRows.filter(l=>user.role!=='admin'||!structureFilter||structureIds.includes(l.leader_id));
 const rankedLeaders=(periodTeamError?[]:periodTeams.filter(t=>t.scope==='team')).filter(l=>user.role!=='admin'||!structureFilter||structureIds.includes(l.leader_id)).map(l=>({...l,verified:Number(l.verified_ap||0)}))
  .filter(l=>l.verified>0).sort((a,b)=>{
   const apDiff=Math.round((b.verified-a.verified)*100);
   if(apDiff)return apDiff;
   const timeA=a.verified_reached_at?new Date(a.verified_reached_at).getTime():Infinity;
   const timeB=b.verified_reached_at?new Date(b.verified_reached_at).getTime():Infinity;
   if(timeA!==timeB)return timeA-timeB;
   return (a.leader_name||'').localeCompare(b.leader_name||'','es');
  });
 const rankedTeams=rankedLeaders.filter(l=>Number(l.depth)===1);
 // Legacy Points are computed only from split-credited verified AP.
 // Work in cents to avoid floating-point awards at the $100 boundary.
 const legacyPoints=ap=>Math.floor(Math.max(0,Math.round(Number(ap||0)*100))/10000);
 const fmt=x=>Number(x).toLocaleString('en-US',{style:'currency',currency:'USD'});
 React.useEffect(()=>{let active=true;if(user.role!=='admin')return;
  setGoalError('');setSavedUplineGoal(null);setUplineGoal('');
  window.flcSupabase.from('flc_agency_ap_goals').select('target_ap').eq('period_type',periodType).eq('period_start',rangeStart).maybeSingle().then(({data,error})=>{
   if(!active)return;
   if(error){setGoalError('Falta ejecutar SQL 034 o no hay acceso a las metas de la agencia.');return;}
   const target=data?Number(data.target_ap):null;setSavedUplineGoal(target);setUplineGoal(target===null?'':String(target));
  });
  return()=>{active=false;};
 },[user.id,user.role,periodType,rangeStart]);
 const saveUplineGoal=async()=>{
  const goal=Number(uplineGoal);
  if(!Number.isFinite(goal)||goal<=0){setGoalError('Introduce una meta válida de AP sometida.');return;}
  setGoalBusy(true);setGoalError('');
  const {error}=await window.flcSupabase.from('flc_agency_ap_goals').upsert({
   period_type:periodType,period_start:rangeStart,target_ap:goal,updated_at:new Date().toISOString(),updated_by:user.id
  },{onConflict:'period_type,period_start'});
  setGoalBusy(false);
  if(error){setGoalError('No se pudo guardar la meta: '+error.message);return;}
  setSavedUplineGoal(goal);setNotice('Meta de AP sometida guardada para el período '+rangeLabel+'.');
 };
 const printUplineReport=()=>{
  if(user.role!=='admin'||structureFilter||!agencyTotals||periodTeamError)return;
  const goal=Number(savedUplineGoal);
  if(!Number.isFinite(goal)||goal<=0){setError('Guarda primero la meta de AP sometida de este período.');return;}
  const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const reportAP=Number(agencyTotals.submitted_ap||0);
  const percent=reportAP/goal*100;
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte FLC - ${safe(rangeLabel)}</title>
  <style>body{font:16px Arial,sans-serif;color:#14251a;max-width:840px;margin:35px auto;padding:0 24px}h1{font-size:30px;margin-bottom:6px}header{border-bottom:5px solid #0c873e;padding-bottom:18px}.muted{color:#617367}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin:26px 0}.card{border:1px solid #dde6dd;border-radius:16px;padding:24px;box-shadow:0 2px 7px #d5ded5}.card strong{font-size:33px;display:block;margin-top:14px}.goal{border:1px solid #8be9b0;border-radius:17px;padding:28px;background:#ecfbf2}.goal strong{font-size:30px}.progress{height:24px;background:#d4e8db;border-radius:20px;overflow:hidden;margin:20px 0}.progress span{display:block;height:100%;background:#0ecc61}.success{color:#086a30}.note{font-size:12px;color:#647169;margin-top:32px}.print{background:#126c3a;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer;margin-bottom:20px}@media print{body{margin:12mm auto}.print{display:none}@page{size:letter;margin:12mm}}</style>
  </head><body><button class="print" onclick="window.print()">Imprimir o guardar como PDF</button><header><div class="muted">FUTURE LEGACY CREATORS</div><h1>Ranking · Resumen de agencia</h1><div class="muted">AP sometida · ${safe(rangeLabel)} · ${safe(carrierFilter||'Todas las compañías')}</div></header>
  <div class="grid"><div class="card">Pólizas sometidas<strong>${Number(agencyTotals.submitted_policies)}</strong></div><div class="card">AP total sometida<strong>${safe(fmt(reportAP))}</strong></div></div>
  <section class="goal"><h2>◎ Meta de la agencia · ${safe(periodType==='day'?'Día':periodType==='week'?'Semana':periodType==='month'?'Mes':'Año')}</h2><p><strong>${safe(fmt(reportAP))}</strong> de ${safe(fmt(goal))} · <strong class="success">${percent.toFixed(1)}%</strong></p><div class="progress"><span style="width:${Math.min(100,Math.max(0,percent))}%"></span></div><p class="success">${reportAP>=goal?'¡Meta cumplida! La agencia alcanzó su meta de AP sometida en este período.':'Faltan '+safe(fmt(goal-reportAP))+' para alcanzar la meta de AP sometida.'}</p></section>
  <div class="grid"><div class="card">Agentes que sometieron<strong>${Number(agencyTotals.submitting_agents)}</strong></div><div class="card">Promedio por agente productor<strong>${safe(fmt(Number(agencyTotals.submitting_agents)?reportAP/Number(agencyTotals.submitting_agents):0))}</strong></div></div>
  <p class="note">Solo AP sometida, no Issue Paid. Una póliza se cuenta una sola vez; en splits los agentes se cuentan individualmente y sus montos se acreditan proporcionalmente. Reporte de agencia sin nombres ni datos personales de agentes o clientes. Generado desde FLC Academy.</p></body></html>`;
  const w=window.open('','_blank');
  if(!w){setError('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para FLC Academy.');return;}
  w.document.open();w.document.write(html);w.document.close();w.focus();
 };
 const standingsOrdered=[...agencyStandings].sort((a,b)=>positionMode==='submitted_ap'?Number(a.rank_ap)-Number(b.rank_ap):Number(a.rank_policies)-Number(b.rank_policies));
 const myStanding=agencyStandings.find(a=>a.agent_id===user.id);
 const myPosition=myStanding?Number(positionMode==='submitted_ap'?myStanding.rank_ap:myStanding.rank_policies):null;
 const podiumStandings=standingsOrdered.slice(0,3);
 const policyLeader=[...agencyStandings].sort((a,b)=>Number(b.submitted_policies)-Number(a.submitted_policies)||Number(a.rank_policies)-Number(b.rank_policies))[0];
 const apLeader=[...agencyStandings].sort((a,b)=>Number(b.submitted_ap)-Number(a.submitted_ap)||Number(a.rank_ap)-Number(b.rank_ap))[0];
 const missingPolicies=myStanding&&policyLeader?Math.max(0,Number(policyLeader.submitted_policies)-Number(myStanding.submitted_policies)):null;
 const missingAp=myStanding&&apLeader?Math.max(0,Math.round((Number(apLeader.submitted_ap)-Number(myStanding.submitted_ap))*100)/100):null;
 const positionAmount=a=>positionMode==='submitted_ap'?fmt(a.submitted_ap):Number(a.submitted_policies).toLocaleString('en-US')+' póliza'+(Number(a.submitted_policies)===1?'':'s');
 const metric=(label,value)=><div style={{background:'#f5f8f3',border:'1px solid #dfebdc',padding:16,borderRadius:10}}><div style={{color:'#516552',fontSize:13}}>{label}</div><div style={{fontSize:23,fontWeight:700,marginTop:7}}>{value}</div></div>;
 const field=(label,child)=><label style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,fontWeight:600}}>{label}{child}</label>;
 const inp={padding:10,border:'1px solid #ccd8cd',borderRadius:7,width:'100%',fontSize:14,background:'#fff'};
 const change=(k,v)=>setForm(x=>({...x,[k]:v}));
 const addPartner=()=>setForm(f=>{
  if(f.partners.length>=4)return f;
  const n=f.partners.length+2,each=Math.floor(100/n);
  return {...f,primaryPct:String(100-each*(n-1)),partners:[...f.partners.map(p=>({...p,pct:String(each)})),{agentId:'',pct:String(each)}]};
 });
 const removePartner=i=>setForm(f=>{
  const removed=Number(f.partners[i]?.pct||0);
  return {...f,primaryPct:String(Number(f.primaryPct||0)+removed),partners:f.partners.filter((_,j)=>j!==i)};
 });
 const updatePartner=(i,k,v)=>setForm(f=>({...f,partners:f.partners.map((p,j)=>j===i?{...p,[k]:v}:p)}));
 const splitTotal=Number(form.primaryPct||0)+form.partners.reduce((n,p)=>n+Number(p.pct||0),0);
 const primaryAgent=user.role==='admin'?(form.primary||user.id):user.id;
 const statuses=['Sometida','En revisión','Pendiente requisito','Aprobada','Issue Paid','Declinada','Cancelada','Chargeback'];
 const openHistory=async row=>{setHistoryPolicy(row);const {data,error}=await window.flcSupabase.from('flc_policy_status_history').select('id,changed_at,changed_by,previous_status,new_status,previous_approved_on,new_approved_on,previous_issue_paid_on,new_issue_paid_on').eq('policy_id',row.id).order('changed_at',{ascending:false});setHistoryRows(error?[]:data||[]);};
 const editAP=row=>{setApEditing({id:row.id,client_name:row.client_name,oldAp:row.annual_premium,newAp:String(row.annual_premium),reason:'',verified:!!row.issue_paid_verified_at});setError('');setNotice('');};
 const saveAP=async()=>{if(!apEditing||apSaving)return;
  const amount=Number(apEditing.newAp),reason=apEditing.reason.trim();
  if(!Number.isFinite(amount)||amount<=0||!/^\d+(\.\d{1,2})?$/.test(apEditing.newAp.trim())){setError('Introduce una AP positiva con máximo 2 decimales.');return;}
  if(reason.length<5){setError('Escribe el motivo de la corrección (mínimo 5 caracteres).');return;}
  setApSaving(true);setError('');setNotice('');
  const {data,error}=await window.flcSupabase.rpc('flc_request_policy_ap_correction',{p_sale_id:apEditing.id,p_new_ap:amount,p_reason:reason});
  setApSaving(false);
  if(error){setError('No se pudo procesar la corrección: '+error.message);return;}
  setApEditing(null);
  setNotice(data==='pending'?'Solicitud enviada a Administración. La AP actual permanece sin cambios hasta aprobar.':'AP corregida. Se registró el cambio; los reportes y rankings reflejarán el nuevo importe al actualizar.');
  await load();setStandingsRefresh(x=>x+1);window.dispatchEvent(new Event('flc:new-sale'));
 };
 const reviewAP=async(row,approve)=>{if(apSaving)return;
  if(!window.confirm((approve?'¿Aprobar':'¿Rechazar')+' corrección de '+fmt(row.previous_ap)+' a '+fmt(row.requested_ap)+'? Si apruebas, se retirará la verificación anterior hasta verificar el nuevo monto.'))return;
  setApSaving(true);setError('');setNotice('');
  const {error}=await window.flcSupabase.rpc('flc_admin_review_policy_ap_correction',{p_request_id:row.id,p_approve:approve});
  setApSaving(false);if(error){setError('No se pudo revisar la solicitud: '+error.message);return;}
  setNotice(approve?'Corrección aprobada. La póliza debe verificarse nuevamente como Issue Paid.':'Corrección rechazada.');
  await load();setStandingsRefresh(x=>x+1);window.dispatchEvent(new Event('flc:new-sale'));
 };
 const verifyPaid=async(row,verified)=>{if(verificationBusy)return;setVerificationBusy(true);setError('');setNotice('');const {error}=await window.flcSupabase.rpc('flc_admin_verify_issue_paid',{p_sale_id:row.id,p_verified:verified});setVerificationBusy(false);if(error)setError('No se pudo guardar la verificación: '+error.message);else{setNotice(verified?'Issue Paid verificada por Administración.':'Verificación retirada.');await load();}};
 const editStatus=row=>{setEditing({id:row.id,status:row.status,approved_on:row.approved_on||'',issue_paid_on:row.issue_paid_on||''});setError('');setNotice('');};
 const saveStatus=async()=>{if(!editing||statusSaving)return;setStatusSaving(true);setError('');setNotice('');
  const {error}=await window.flcSupabase.rpc(user.role==='admin'?'flc_admin_update_policy_status':'flc_agent_update_policy_status',{
   p_sale_id:editing.id,p_status:editing.status,p_approved_on:editing.approved_on||null,p_issue_paid_on:editing.issue_paid_on||null
  });
  setStatusSaving(false);if(error){setError('No se pudo actualizar el estado: '+error.message);return;}
  setEditing(null);setNotice('Estado actualizado correctamente.');await load();
 };
 const submit=async e=>{e.preventDefault();setError('');setNotice('');
 const all=[{agentId:primaryAgent,pct:form.primaryPct},...form.partners];
 if(form.partners.length>4||all.some(p=>!p.agentId||!Number.isFinite(Number(p.pct))||Number(p.pct)<=0||Number(p.pct)>100)||new Set(all.map(p=>p.agentId)).size!==all.length||Math.abs(splitTotal-100)>0.001){
  setError('Selecciona agentes distintos y porcentajes positivos que sumen exactamente 100%.');return;
 }
 if(form.partners.length>=2&&creditsError){setError('Para registrar 3 a 5 participantes, Administración debe ejecutar primero SQL 019 en Supabase.');return;}
 const params={p_client_name:form.client,p_policy_number:form.number||null,p_carrier:form.carrier,p_product_type:form.product,p_lead_source:form.source,p_lead_source_other:form.source==='Otro'?form.other:null,p_annual_premium:Number(form.ap),p_submitted_on:form.date};
 setSaving(true);
 const {data:createdPolicyId,error}=form.partners.length>=2
 ?await window.flcSupabase.rpc('flc_create_policy_multi',{...params,p_allocations:all.map(p=>({agent_id:p.agentId,pct:Number(p.pct)})),p_primary_agent_id:user.role==='admin'?primaryAgent:null})
 :await window.flcSupabase.rpc(user.role==='admin'?'flc_admin_create_policy':'flc_create_policy',{...params,p_split_agent_id:form.partners[0]?.agentId||null,p_split_primary_pct:Number(form.primaryPct),...(user.role==='admin'?{p_agent_id:primaryAgent}:{})});
 if(error){setSaving(false);setError(error.code==='23505'?'Ya hay una póliza registrada con ese número y compañía.':error.message||'No se pudo guardar.');return;}
 // Creation succeeded: never retry INSERT after a follow-up status error.
 let dispositionError=null;
 if(form.initialDisposition!=='Sometida'){
  const result=await window.flcSupabase.rpc('flc_set_initial_policy_disposition',{
   p_policy_id:createdPolicyId,p_disposition:form.initialDisposition
  });
  dispositionError=result.error;
 }
 setSaving(false);
 setForm(blank());setTab('list');await load();window.dispatchEvent(new Event('flc:new-sale'));
 if(dispositionError){
  setError('La póliza SÍ quedó registrada, pero no se pudo guardar el estado inicial. NO la registres otra vez. Abre Mis ventas → Cambiar estado. Detalle: '+dispositionError.message);
 }else{
  setNotice('Póliza registrada correctamente. Estado inicial: '+form.initialDisposition+'. La AP solo contará como Issue Paid verificada después de la revisión administrativa.');
 }
};
 const splitDisplay=r=>{const shares=allocations(r);if(shares.length<=1)return '—';
  return shares.map(s=>{const name=s.full_name||(s.agent_id===user.id?user.name:(agents.find(a=>a.id===s.agent_id)||splitPartners.find(a=>a.id===s.agent_id))?.full_name)||'Agente';
   return name+': '+Number(s.pct).toLocaleString('en-US')+'% ('+fmt(Number(r.annual_premium)*Number(s.pct)/100)+')';
  }).join(' / ');
 };
 return <div className="production-center" style={{padding:28,maxWidth:1250,margin:'auto'}}>
 <button onClick={()=>setPage('dashboard')}>← Inicio</button><h1>FLC Production Center</h1>
 <p>Elige una categoría para consultar producción, rankings, pólizas o inversión en leads.</p>
 <nav aria-label="Secciones del Production Center" style={{display:'flex',flexWrap:'wrap',gap:9,margin:'16px 0 22px',padding:12,background:'#f1f6f0',border:'1px solid #cfdfcf',borderRadius:12}}>
  {[
   {id:'policies',label:'📋 Mis pólizas / Nueva póliza'},
   {id:'summary',label:'📊 Resumen personal'},
   {id:'ranking',label:'🏆 Ranking de agentes'},
   ...(canViewTeam?[{id:'teams',label:'👥 Equipos y podios'}]:[]),
   {id:'leads',label:'📈 Inversión en leads'},
   ...(user.role==='admin'?[{id:'goals',label:'🎯 Metas y reporte upline'}]:[])
  ].map(item=><button key={item.id} type="button" onClick={()=>setActiveSection(item.id)} aria-current={activeSection===item.id?'page':undefined} style={{padding:'11px 14px',borderRadius:9,fontWeight:700,cursor:'pointer',border:activeSection===item.id?'2px solid #154e30':'1px solid #bfd0bf',color:activeSection===item.id?'white':'#1d432d',background:activeSection===item.id?'#176b3b':'white'}}>{item.label}</button>)}
 </nav>
 <section style={{padding:18,margin:'14px 0',border:'1px solid #dce5d8',borderRadius:12,background:'#fff'}}>
 <h2 style={{margin:'0 0 14px'}}>Período y filtros</h2>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
  <label>Período: <select value={periodType} onChange={e=>setPeriodType(e.target.value)} style={{padding:8}}><option value="day">Día</option><option value="week">Semana (lunes a domingo)</option><option value="month">Mes</option><option value="year">Año</option></select></label>
  <button type="button" onClick={()=>movePeriod(-1)}>← Anterior</button>
  <label>Fecha: <input type="date" value={periodDate} onChange={e=>setPeriodDate(e.target.value)} style={{padding:8}}/></label>
  <button type="button" onClick={()=>movePeriod(1)}>Siguiente →</button>
  <strong style={{alignSelf:'center'}}>{rangeLabel}</strong>
  <label>Compañía: <select value={carrierFilter} onChange={e=>setCarrierFilter(e.target.value)} style={{padding:8}}><option value="">Todas las compañías</option>{[...new Set(rows.map(x=>x.carrier))].sort().map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 </div>
 {user.role==='admin'&&<label style={{marginLeft:12}}>Estructura: <select value={structureFilter} onChange={e=>setStructureFilter(e.target.value)}><option value="">Toda la agencia</option>{leaderRows.map(l=><option key={l.leader_id} value={l.leader_id}>{l.leader_name}</option>)}</select></label>}
 {structureLoading&&<p>Cargando estructura seleccionada…</p>}{structureError&&<p role="alert" style={{color:'#a33'}}>{structureError}</p>}
 <div style={{display:activeSection==='summary'?'block':'none'}}>
 {user.role==='admin'&&!structureFilter&&<section style={{margin:'16px 0 22px',padding:18,background:'#eef7ee',border:'1px solid #a6c9aa',borderRadius:12}}>
  <h3 style={{margin:'0 0 6px'}}>📊 Panel ejecutivo · Toda Future Legacy Creators</h3>
  <p style={{fontSize:13,color:'#46604b'}}>Resumen de {rangeLabel}. Los splits se acreditan por porcentaje y cada agente productor cuenta una vez. Inversión en leads declarada, sin validación administrativa.</p>
  {periodTeamError?<p role="alert">{periodTeamError}</p>:agencyTotals?<React.Fragment>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
    {metric('AP sometida · agencia',fmt(agencyTotals.submitted_ap))}
    {metric('AP Issue Paid verificada',fmt(agencyTotals.verified_ap))}
    {metric('Agentes que sometieron',Number(agencyTotals.submitting_agents).toLocaleString('en-US'))}
    {metric('Agentes con IP verificada',Number(agencyTotals.verified_agents).toLocaleString('en-US'))}
    {metric('Promedio AP sometida / agente',fmt(Number(agencyTotals.submitting_agents)?Number(agencyTotals.submitted_ap)/Number(agencyTotals.submitting_agents):0))}
    {metric('Promedio AP verificada / agente',fmt(Number(agencyTotals.verified_agents)?Number(agencyTotals.verified_ap)/Number(agencyTotals.verified_agents):0))}
    {metric('Pólizas sometidas',Number(agencyTotals.submitted_policies).toLocaleString('en-US'))}
    {metric('Pólizas IP verificadas',Number(agencyTotals.verified_policies).toLocaleString('en-US'))}
    {metric('Inversión total en leads',fmt(scopedLeads.reduce((total,l)=>total+Number(l.amount),0)))}
   </div>
   <p style={{fontSize:12,color:'#516552'}}>La AP sometida usa fecha de sometimiento y la AP verificada usa fecha de Issue Paid; pueden ser pólizas distintas en este período. La efectividad real de conversión por cohorte se consulta en su ranking, no dividiendo estos dos montos.</p>
   <p style={{fontSize:13}}><strong>Inversión por proveedor:</strong> {[...new Set(scopedLeads.map(l=>l.provider))].sort().map(provider=>provider+' ('+fmt(scopedLeads.filter(l=>l.provider===provider).reduce((n,l)=>n+Number(l.amount),0))+')').join(' · ')||'Sin registros para este período'}</p>
  </React.Fragment>:<p>Cargando totales de agencia…</p>}
 </section>}
 </div>
 <div style={{display:activeSection==='goals'?'block':'none'}}>
 {user.role==='admin'&&!structureFilter&&<section style={{margin:'18px 0',padding:18,background:'#fff',border:'1px solid #b7cdb8',borderRadius:12}}>
  <h3 style={{marginTop:0}}>🎯 Metas de AP sometida de la agencia</h3>
  <p style={{fontSize:13,color:'#506a56'}}>Configura aquí la meta del período seleccionado: {rangeLabel}. Las metas de día, semana, mes y año se guardan por separado y no requieren editar código. Solo Administración puede cambiarlas.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
   <label style={{display:'flex',flexDirection:'column',gap:6,fontWeight:600}}>Meta de AP sometida (USD)
    <input type="number" min="1" step="0.01" value={uplineGoal} onChange={e=>setUplineGoal(e.target.value)} placeholder="Ej. 1000000" style={{padding:10,border:'1px solid #bfd2c0',borderRadius:7,width:220}}/>
   </label>
   <button type="button" disabled={goalBusy} onClick={saveUplineGoal} style={{padding:'11px 18px',border:0,borderRadius:8,background:'#126b3b',color:'#fff',fontWeight:700,cursor:'pointer'}}>{goalBusy?'Guardando…':'Guardar meta'}</button>
  </div>
  {goalError&&<p role="alert" style={{color:'#aa382d'}}>{goalError}</p>}
  <h3>📤 Reporte para tu upline</h3>
  <p style={{fontSize:13}}>Resumen visual de pólizas, AP sometida y progreso de la meta, como tu ejemplo. Sin nombres de agentes y sin información de clientes.</p>
  <button type="button" onClick={printUplineReport} disabled={!agencyTotals||!!periodTeamError||!savedUplineGoal} style={{padding:'11px 18px',border:0,borderRadius:8,background:'#126b3b',color:'#fff',fontWeight:700,cursor:'pointer'}}>Vista previa / Guardar PDF</button>
  <p style={{fontSize:12,color:'#657665'}}>Meta guardada: {savedUplineGoal?fmt(savedUplineGoal):'Sin configurar para este período'}. No se comparte automáticamente.</p>
 </section>}
 </div>
 <div style={{display:activeSection==='ranking'?'block':'none'}}>
 <section style={{margin:'18px 0 24px',padding:18,background:'linear-gradient(135deg,#16201a,#283f2a)',color:'#fff',borderRadius:14}}>
  <h3 style={{margin:'0 0 6px'}}>🏆 Mi posición en la agencia · {rangeLabel}</h3>
  <p style={{fontSize:13,color:'#d6e9d7'}}>Todos los agentes pueden consultar su lugar en Future Legacy Creators. El ranking utiliza únicamente pólizas sometidas reales; si hay split, cada participante cuenta una póliza y la AP se divide según su porcentaje.</p>
  <label style={{display:'flex',flexDirection:'column',gap:5,maxWidth:350,margin:'12px 0',fontSize:13}}>Clasificar por
   <select value={positionMode} onChange={e=>setPositionMode(e.target.value)} style={{padding:10,borderRadius:8,background:'#fff',color:'#18251c'}}>
    <option value="policy_count">Cantidad de pólizas sometidas</option>
    <option value="submitted_ap">AP sometida acreditada</option>
   </select>
  </label>
  {agencyStandingsError?<p role="alert" style={{color:'#ffcbba'}}>{agencyStandingsError}</p>:agencyStandingsLoading?<p>Cargando clasificación…</p>:<React.Fragment>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,margin:'16px 0'}}>
    <div style={{background:'#263b36',padding:15,border:'1px solid #587866',borderRadius:12}}>
     <small style={{color:'#b0d2bb'}}>TU POSICIÓN EN FLC</small>
     <div style={{fontSize:36,fontWeight:800,marginTop:7}}>{myPosition?'#'+myPosition:'—'}</div>
     <strong>{user.name}</strong><div style={{color:'#cef3d5',marginTop:5}}>{myStanding?positionAmount(myStanding):'Sin pólizas sometidas en este período'}</div>
     {myStanding&&<div style={{marginTop:12,fontSize:13,lineHeight:1.65,color:'#fff'}}>
      <div><strong>{missingPolicies===0?'✓ Eres el #1 por cantidad':'A '+missingPolicies+' póliza(s) del agente #1 por cantidad'}</strong></div>
      <div><strong>{missingAp===0?'✓ Eres el #1 por AP sometida':'A '+fmt(missingAp)+' del agente #1 por AP sometida'}</strong></div>
      <small style={{color:'#b0d2bb'}}>Se compara la producción individual de todos los agentes, sin importar su título. AP según split.</small>
     </div>}
    </div>
    <div style={{background:'#263b36',padding:15,border:'1px solid #587866',borderRadius:12}}>
     <small style={{color:'#b0d2bb'}}>AGENTES CON PRODUCCIÓN</small>
     <div style={{fontSize:36,fontWeight:800,marginTop:7}}>{agencyStandings.length}</div>
     <div style={{color:'#cef3d5'}}>Tu posición se compara con los agentes que sometieron negocio en este período.</div>
    </div>
   </div>
   <h4 style={{margin:'20px 0 10px'}}>Podio de la agencia</h4>
   {podiumStandings.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
    {podiumStandings.map((a,i)=><div key={a.agent_id} style={{background:i===0?'#fff2c7':'#f0f5ef',color:'#13261a',borderRadius:12,padding:17,textAlign:'center',minHeight:135}}>
     <div style={{fontSize:30}}>{['🥇','🥈','🥉'][i]}</div><strong style={{display:'block',overflowWrap:'anywhere'}}>{a.full_name}</strong>
     <div style={{fontSize:23,fontWeight:800,marginTop:7}}>{positionAmount(a)}</div>
     <small>{i+1}º lugar</small>
    </div>)}
   </div>:<p>Sin agentes con producción sometida en el período seleccionado.</p>}
   {standingsOrdered.length>0&&<div style={{marginTop:20}}>
    <h4 style={{margin:'0 0 8px'}}>Tabla completa de agentes · {standingsOrdered.length} con producción</h4>
    <p style={{fontSize:12,color:'#d6e9d7'}}>Producción personal sometida. Todos los agentes con producción aparecen en esta tabla, sin importar su título o equipo. El orden depende de «Clasificar por».</p>
    <div style={{overflowX:'auto',maxHeight:520,overflowY:'auto',border:'1px solid #496551',borderRadius:9}}>
     <table style={{width:'100%',fontSize:13,borderCollapse:'collapse',minWidth:700}}>
      <thead style={{position:'sticky',top:0,background:'#263b36',zIndex:1}}><tr><th style={{textAlign:'left',padding:10}}>Lugar</th><th style={{textAlign:'left'}}>Agente</th><th style={{textAlign:'right'}}>Pólizas sometidas</th><th style={{textAlign:'right'}}>AP personal acreditada</th><th style={{textAlign:'right'}}>Faltan para igualar #1 por AP</th></tr></thead>
      <tbody>{standingsOrdered.map((a,i)=><tr key={a.agent_id} style={{background:a.agent_id===user.id?'#365b42':i%2?'#1e3028':'transparent',fontWeight:a.agent_id===user.id?800:400}}>
       <td style={{padding:10,borderTop:'1px solid #496551'}}>#{positionMode==='submitted_ap'?a.rank_ap:a.rank_policies}</td>
       <td>{a.full_name}{a.agent_id===user.id?' · Tú':''}</td>
       <td style={{textAlign:'right'}}>{Number(a.submitted_policies)}</td>
       <td style={{textAlign:'right'}}>{fmt(a.submitted_ap)}</td>
       <td style={{textAlign:'right'}}>{fmt(Math.max(0,Math.round((Number(apLeader.submitted_ap)-Number(a.submitted_ap))*100)/100))}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </div>}
  </React.Fragment>}
 </section>
 </div>
 <div style={{display:activeSection==='summary'?'block':'none'}}>
 <h3>👤 Producción personal</h3>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:12}}>
 {metric('Mis pólizas sometidas',mySubmitted.length)}
 {metric('Mi AP sometida',fmt(myAP))}
 {metric('Mis pólizas Issue Paid',myIssued.length)}
 {metric('Mi AP Issue Paid reportada',fmt(myPaid))}
 {metric('Mi AP Issue Paid verificada',fmt(myVerified))}
 {metric('⭐ Mis Legacy Points',legacyPoints(myVerified).toLocaleString('en-US'))}
 </div>
 </div>
 {canViewTeam&&<React.Fragment>
 <div style={{display:activeSection==='teams'?'block':'none'}}>
 <h3 style={{marginTop:22}}>👥 Producción de equipo</h3>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:12}}>
 {metric('Pólizas del equipo (incluye líder)',teamSubmitted.length)}
 {metric('AP del equipo · sometida (incluye líder)',fmt(teamAP))}
 {metric('Pólizas Issue Paid del equipo',teamIssued.length)}
 {metric('AP del equipo · Issue Paid (incluye líder)',fmt(teamPaid))}
 {metric('AP del equipo · Issue Paid verificada',fmt(teamVerified))}
 {metric('⭐ Legacy Points del equipo',legacyPoints(teamVerified).toLocaleString('en-US'))}
 </div>
 {canViewTeam&&<section style={{marginTop:24,padding:18,border:'1px solid #c5d7c6',borderRadius:14,background:'#f9fbf8'}}>
  <h3 style={{margin:'0 0 6px'}}>🏆 Podio · {periodType==='day'?'diario':periodType==='week'?'semanal':periodType==='month'?'mensual':'anual'}</h3>
  <label style={{display:'flex',flexDirection:'column',gap:6,maxWidth:430,fontWeight:600,fontSize:13,marginBottom:12}}>Categoría del podio
   <select value={rankMode} onChange={e=>setRankMode(e.target.value)} style={{padding:10,border:'1px solid #bed3bf',borderRadius:8,background:'#fff'}}>
    {rankingTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
   </select>
  </label>
  <p style={{fontSize:13,color:'#4a624f',margin:'0 0 16px'}}>
   {rankMode==='verified_ap'?'Solo AP Issue Paid verificada por Administración. 1 Legacy Point por cada $100 de AP acreditada.':
    rankMode==='policy_count'?'Cuenta cada póliza sometida en el período por agente participante. En un split, cada participante cuenta una póliza, sin duplicar la AP.':
    rankMode==='submitted_ap'?'Suma la AP sometida del período, acreditada según los porcentajes de split.':
    rankMode==='lead_investment'?'Inversión en leads declarada por el agente, con proveedor obligatorio. No requiere aprobación de Administración; no representa AP de pólizas.':
    rankMode==='team_average'?'Equipos de managers directos. Primer valor: AP Issue Paid verificada / agentes con IP verificada. Segundo: AP sometida / agentes que sometieron. Cada equipo incluye a su manager y descendientes.':
    'Efectividad por cohorte: pólizas sometidas en el período que llegaron a Issue Paid y fueron verificadas por Administración, divididas entre todas las sometidas de esa cohorte. Incluye verificaciones posteriores.'}
   {' · '+rangeLabel+' · '+(rankMode==='lead_investment'?'Todos los proveedores':(carrierFilter||'Todas las compañías'))}{user.role==='admin'&&structureFilter?' · Estructura seleccionada':''}.
   {rankMode==='lead_investment'?'Desempate de inversión: registro de compra más antiguo.':rankMode==='team_average'?'Desempate de equipos: mayor promedio sometido y primera verificación.':'Desempate de agentes: primer registro; si es la misma póliza, agente principal.'}
  </p>
  {rankedAgentRows.length?<React.Fragment>
   <div style={{display:'grid',gridTemplateColumns:rankedAgentRows.length===1?'minmax(0,1fr)':rankedAgentRows.length===2?'repeat(2,minmax(0,1fr))':'repeat(3,minmax(0,1fr))',gap:10,alignItems:'end'}}>
    {(rankedAgentRows.length===1?[0]:rankedAgentRows.length===2?[1,0]:[1,0,2]).filter(rank=>rank<rankedAgentRows.length).map(rank=>{const a=rankedAgentRows[rank];return <div key={rank} style={{minHeight:rank===0?155:126,background:rank===0?'#fff8e5':'#f0f4ef',border:'1px solid #d1dacd',borderRadius:12,padding:12,textAlign:'center',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
     <div style={{fontSize:26}}>{['🥇','🥈','🥉'][rank]}</div><strong style={{overflowWrap:'anywhere'}}>{a.name||'Agente del equipo'}</strong><div style={{fontWeight:800,fontSize:20,marginTop:7}}>{rankingValueText(a)}</div><div style={{color:'#226b3a',fontWeight:700,fontSize:13,marginTop:5}}>{rankingContext(a)}</div>
    </div>;})}
   </div>
   <h4 style={{margin:'18px 0 8px'}}>Clasificación · Top 10</h4>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr>{['Posición','Agente',selectedRanking.short,'Referencia'].map(v=><th key={v} style={{padding:9,textAlign:'left',borderBottom:'1px solid #d8e2d6'}}>{v}</th>)}</tr></thead>
    <tbody>{rankedAgentRows.map((a,i)=><tr key={a.id}><td style={{padding:9,borderBottom:'1px solid #e1e8dd'}}>{i+1}</td><td>{a.name||'Agente del equipo'}</td><td style={{fontWeight:700}}>{rankingValueText(a)}</td><td style={{color:'#226b3a'}}>{rankingContext(a)}</td></tr>)}</tbody>
   </table></div>
  </React.Fragment>:<p>Sin producción que cumpla los criterios de esta categoría y período.</p>}
  <p style={{fontSize:12,color:'#536454',marginTop:12}}>Solo participantes o equipos autorizados en esta vista. El ranking de equipos de managers directos se muestra por separado más abajo; sus estructuras incluyen producción personal y descendientes. Los Legacy Points oficiales siempre proceden de AP Issue Paid verificada.</p>
 </section>}
 <h4 style={{margin:'20px 0 10px'}}>Detalle por agente (AP acreditada)</h4>
 <div style={{overflowX:'auto'}}>
 <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
 <thead><tr>{['Agente','Pólizas sometidas','AP sometida','Pólizas Issue Paid','AP Issue Paid','AP verificada','Legacy Points'].map(t=><th key={t} style={{textAlign:'left',padding:10,borderBottom:'1px solid #ddd'}}>{t}</th>)}</tr></thead>
 <tbody>{agentBreakdown.map(a=><tr key={a.id}><td style={{padding:10,borderBottom:'1px solid #eee'}}>{a.name||'Agente del equipo'}</td><td>{a.submitted}</td><td>{fmt(a.ap)}</td><td>{a.issued}</td><td>{fmt(a.paid)}</td><td>{fmt(a.verified)}</td><td style={{fontWeight:700,color:'#226b3a'}}>⭐ {legacyPoints(a.verified)}</td></tr>)}</tbody>
 </table>{!agentBreakdown.length&&<p>Sin producción registrada para la estructura en este período.</p>}</div>
 <section style={{marginTop:24,padding:18,border:'1px solid #c5d7c6',borderRadius:14,background:'#f9fbf8'}}>
  <h3 style={{margin:'0 0 6px'}}>🏆 Ranking de líderes y equipos · {rangeLabel}</h3>
  <p style={{fontSize:13,color:'#4a624f'}}>⭐ 1 Legacy Point por cada $100 de AP verificada · {rangeLabel} · {carrierFilter||'Todas las compañías'}{user.role==='admin'&&structureFilter?' · Estructura seleccionada':''}. Cada cifra incluye al líder y sus descendientes; los splits respetan la participación acreditada.</p>
  {rankTimesError&&<p role="alert" style={{color:'#9a3c28'}}>{rankTimesError}</p>}
  {periodTeamError?<p role="alert" style={{color:'#9a3c28'}}>{periodTeamError}</p>:structureLoading?<p>Cargando clasificación de la estructura…</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>
  {[{title:'👑 Líderes y sublíderes · Top 10',items:rankedLeaders},{title:'👥 Equipos de managers directos · Top 10',items:rankedTeams}].map(group=><div key={group.title} style={{background:'#fff',border:'1px solid #d9e7d7',borderRadius:10,padding:14}}>
   <h4 style={{margin:'0 0 12px'}}>{group.title}</h4>
   {group.items.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
    <thead><tr><th style={{textAlign:'left',padding:8}}>Puesto</th><th style={{textAlign:'left',padding:8}}>Líder / equipo</th><th style={{textAlign:'right',padding:8}}>AP verificada</th><th style={{textAlign:'right',padding:8}}>Puntos</th></tr></thead>
    <tbody>{group.items.slice(0,10).map((l,i)=><tr key={l.leader_id}><td style={{padding:8,borderTop:'1px solid #edf1ea'}}>{['🥇','🥈','🥉'][i]||i+1}</td><td style={{padding:8,borderTop:'1px solid #edf1ea'}}>{l.leader_name}</td><td style={{padding:8,borderTop:'1px solid #edf1ea',textAlign:'right',fontWeight:700}}>{fmt(l.verified)}</td><td style={{padding:8,borderTop:'1px solid #edf1ea',textAlign:'right',fontWeight:700,color:'#226b3a'}}>⭐ {legacyPoints(l.verified)}</td></tr>)}</tbody>
   </table></div>:<p style={{fontSize:13,color:'#536454'}}>Sin estructuras con AP Issue Paid verificada en este período.</p>}
  </div>)}</div>}
  <p style={{fontSize:12,color:'#536454',margin:'12px 0 0'}}>Legacy Points se calculan sobre la AP verificada de cada vista; los puntos de equipos no deben sumarse con los personales ni con estructuras anidadas. Ranking de líderes: incluye estructuras anidadas que pueden superponerse. Ranking de equipos: managers de nivel 1 con todos sus descendientes, sin incluir la estructura general de la agencia (nivel 0). No sumes las filas del ranking de líderes para calcular la AP total de la agencia. Ante igual AP, gana la estructura que completó primero su AP verificada (última verificación del total). Si ambos momentos son idénticos, se aplica orden alfabético técnico. El desempate por tiempo requiere SQL 017 activo.</p>
 </section>
 <section style={{marginTop:24,padding:18,background:'#f4f9f4',border:'1px solid #b9d2bd',borderRadius:12}}>
  <h3>📊 Promedios por agente que produjo · {rangeLabel}</h3>
  <p style={{fontSize:13}}>Dos denominadores independientes. Los splits se acreditan por porcentaje y cada agente se cuenta una sola vez dentro de su equipo. Los equipos incluyen la producción personal de sus managers. No se suman estructuras anidadas.</p>
  {periodTeamError?<p role="alert">{periodTeamError}</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
   <thead><tr>{['Equipo / agencia','Agentes que sometieron','AP sometida','Promedio sometida / agente','Agentes con IP verificada','AP IP verificada','Promedio verificada / agente'].map(x=><th key={x} style={{padding:8,borderBottom:'1px solid #b9d2bd',textAlign:'left'}}>{x}</th>)}</tr></thead>
   <tbody>{[...periodTeams.filter(t=>t.scope==='agency'),...periodTeams.filter(t=>t.scope==='team'&&Number(t.depth)===1)].map(t=><tr key={t.leader_id||'agency'}>
    <td style={{padding:8,borderBottom:'1px solid #dde8dc'}}><strong>{t.leader_name}</strong></td>
    <td>{t.submitting_agents}</td><td>{fmt(t.submitted_ap)}</td><td><strong>{fmt(Number(t.submitting_agents)?Number(t.submitted_ap)/Number(t.submitting_agents):0)}</strong></td>
    <td>{t.verified_agents}</td><td>{fmt(t.verified_ap)}</td><td><strong>{fmt(Number(t.verified_agents)?Number(t.verified_ap)/Number(t.verified_agents):0)}</strong></td>
   </tr>)}</tbody>
  </table></div>}
 </section>
 <h4 style={{margin:'20px 0 10px'}}>Producción por líder y sublíder</h4>
 {periodTeamError?<p style={{color:'#9a3c28'}}>{periodTeamError}</p>:<div style={{overflowX:'auto'}}>
 <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
 <thead><tr>{['Líder / estructura','Pólizas sometidas','AP sometida','Pólizas IP verificadas','AP IP verificada','Agentes que sometieron','Agentes IP verificada'].map(x=><th key={x} style={{textAlign:'left',padding:10,borderBottom:'1px solid #ddd'}}>{x}</th>)}</tr></thead>
 <tbody>{periodTeams.filter(a=>a.scope==='team').map(a=><tr key={a.leader_id}><td style={{padding:10,borderBottom:'1px solid #eee'}}><span style={{display:'inline-block',paddingLeft:Math.max(0,Number(a.depth)||0)*20}}>{Number(a.depth)===0?'👥 ': '↳ '}{a.leader_name} <small style={{color:'#647568'}}>{Number(a.depth)===0?'(líder principal)':'(nivel '+a.depth+')'}</small></span></td><td>{a.submitted_policies||0}</td><td>{fmt(a.submitted_ap||0)}</td><td>{a.verified_policies||0}</td><td>{fmt(a.verified_ap||0)}</td><td>{a.submitting_agents||0}</td><td>{a.verified_agents||0}</td></tr>)}</tbody></table>
 {!periodTeams.filter(a=>a.scope==='team').length&&<p>No hay estructuras de líderes para mostrar.</p>}</div>}
 <p style={{fontSize:12,color:'#536454'}}>Las estructuras de un líder y sus sublíderes se superponen. No sumes las filas entre sí. Cada fila incluye al líder y todos sus descendientes.</p>
 {user.role==='admin'&&<div style={{marginTop:12,padding:14,border:'1px solid #9cbd9e',borderRadius:9,background:'#f4f9f4'}}><strong>✓ AP Issue Paid verificada (agencia)</strong><div style={{fontSize:23,fontWeight:700}}>{fmt(agencyTotals?agencyTotals.verified_ap:verifiedAP)}</div><small>Solo pólizas confirmadas por Administración. No se mezclan con Issue Paid reportada.</small></div>}
 {user.role==='admin'&&<p style={{fontSize:13,marginTop:12}}>Agencia · {agencyTotals?agencyTotals.submitted_policies:monthRows.length} pólizas sometidas · {fmt(agencyTotals?agencyTotals.submitted_ap:monthAP)} AP total · {fmt(paidAP)} Issue Paid reportada (sin duplicar splits).</p>}
 </div>
 </React.Fragment>}
 {canViewTeam&&<p style={{display:activeSection==='teams'?'block':'none',fontSize:12,color:'#536454'}}>Diagnóstico de estructura: {teamIds.length} integrantes asignados; {rows.length} pólizas accesibles; {teamSubmitted.length} pólizas con participación del equipo en este mes.</p>}
 <p style={{display:activeSection==='summary'?'block':'none',fontSize:12,color:'#536454',marginTop:14}}>Datos preliminares de pólizas visibles según permisos. Issue Paid es reportada, no confirmada por aseguradora. Los splits no duplican la AP total visible; la AP de equipo incluye la participación del líder y su estructura autorizada. No sumes personal y equipo.</p>
 </section>
 <div style={{display:activeSection==='leads'?'block':'none'}}>
 <section style={{margin:'20px 0',background:'#fff',border:'1px solid #b9d2bd',padding:18,borderRadius:12}}>
  <h3>📈 Registrar inversión en leads</h3>
  <p style={{fontSize:13}}>Dato declarado por el agente. Administración no tiene que validarlo. Debes indicar en qué proveedor invertiste; esta inversión no se suma a la AP sometida.</p>
  {leadError&&<p role="alert" style={{color:'#a33'}}>{leadError}</p>}
  <form onSubmit={saveLead} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
   {field('Fecha *',<input required type="date" style={inp} value={leadForm.spent_on} onChange={e=>setLeadForm(x=>({...x,spent_on:e.target.value}))}/>)}
   {field('Proveedor de leads *',<input required maxLength={120} placeholder="Ej.: AuraFlow" style={inp} value={leadForm.provider} onChange={e=>setLeadForm(x=>({...x,provider:e.target.value}))}/>)}
   {field('Inversión USD *',<input required type="number" min="0.01" step="0.01" style={inp} value={leadForm.amount} onChange={e=>setLeadForm(x=>({...x,amount:e.target.value}))}/>)}
   {field('Cantidad de leads (opcional)',<input type="number" min="1" step="1" style={inp} value={leadForm.lead_count} onChange={e=>setLeadForm(x=>({...x,lead_count:e.target.value}))}/>)}
   <button disabled={leadSaving} style={{padding:12,border:0,borderRadius:8,background:'#176b3b',color:'#fff',fontWeight:700}}>{leadSaving?'Guardando…':'Guardar inversión'}</button>
  </form>
  <p style={{fontSize:12,color:'#5c6b5d'}}>Mis inversiones en el período: {fmt(scopedLeads.filter(l=>l.agent_id===user.id).reduce((n,l)=>n+Number(l.amount),0))} · {scopedLeads.filter(l=>l.agent_id===user.id).length} registros.</p>
 </section>
 </div>
 <div style={{display:activeSection==='policies'?'block':'none'}}>
 <div style={{display:'flex',gap:10,margin:'14px 0 22px'}}><button style={inp} onClick={()=>setTab('list')}>Mis ventas / Producción</button><button style={inp} onClick={()=>setTab('new')}>＋ Nueva póliza</button></div>
 {editing&&<section style={{padding:18,background:'#fff',border:'1px solid #bad1be',borderRadius:10,marginBottom:16}}>
  <h2 style={{fontSize:18}}>Actualizar estado de póliza</h2>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
   {field('Estado *',<select style={inp} value={editing.status} onChange={e=>setEditing(v=>({...v,status:e.target.value}))}>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select>)}
   {field('Fecha de aprobación',<input type="date" style={inp} value={editing.approved_on} onChange={e=>setEditing(v=>({...v,approved_on:e.target.value}))}/>)}
   {field('Fecha Issue Paid',<input type="date" style={inp} value={editing.issue_paid_on} onChange={e=>setEditing(v=>({...v,issue_paid_on:e.target.value}))}/>)}
  </div>
  <div style={{display:'flex',gap:10,marginTop:12}}>
   <button disabled={statusSaving} onClick={saveStatus} style={{background:'#14713d',color:'#fff',padding:10,border:0,borderRadius:7}}>{statusSaving?'Guardando…':'Guardar estado'}</button>
   <button onClick={()=>setEditing(null)} type="button">Cancelar</button>
  </div>
 </section>}
 {error&&<p role="alert" style={{color:'#a22'}}>{error}</p>}{notice&&<p role="status" style={{color:'#24773f'}}>{notice}</p>}
 {tab==='new'?<form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,background:'#fff',padding:22,border:'1px solid #dae5d9',borderRadius:12}}>
 {field('Nombre del cliente *',<input required maxLength={150} style={inp} value={form.client} onChange={e=>change('client',e.target.value)}/>)}
 {field('Número de póliza (cuando esté asignado)',<input maxLength={80} style={inp} value={form.number} onChange={e=>change('number',e.target.value)}/>)}
 {field('Aseguradora *',<select style={inp} value={form.carrier} onChange={e=>change('carrier',e.target.value)}>{carriers.map(c=><option key={c}>{c}</option>)}</select>)}
 {field('Tipo de póliza *',<select style={inp} value={form.product} onChange={e=>change('product',e.target.value)}>{products.map(c=><option key={c}>{c}</option>)}</select>)}
 {field('Origen del lead *',<select style={inp} value={form.source} onChange={e=>change('source',e.target.value)}>{sources.map(c=><option key={c}>{c}</option>)}</select>)}
 {form.source==='Otro'&&field('Especifica el origen *',<input required style={inp} value={form.other} onChange={e=>change('other',e.target.value)}/>)}
 {field('Prima anualizada (AP) USD *',<input style={inp} required type="number" step="0.01" min="0.01" value={form.ap} onChange={e=>change('ap',e.target.value)}/>)}
 {field('Fecha de sometida *',<input style={inp} required type="date" value={form.date} onChange={e=>change('date',e.target.value)}/>)}
 {field('Estado al registrar *',<select required style={inp} value={form.initialDisposition} onChange={e=>change('initialDisposition',e.target.value)}>
  <option value="Sometida">Sometida</option>
  <option value="Aprobada en pantalla">Aprobada en pantalla</option>
 </select>)}
 {user.role==='admin'&&field('Agente principal *',<select style={inp} value={form.primary} onChange={e=>change('primary',e.target.value)}><option value="">Administración (mi cuenta)</option>{agents.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select>)}
 {splitPartnerError&&<p role="alert" style={{gridColumn:'1/-1',color:'#a33',margin:0}}>{splitPartnerError}</p>}
 {form.partners.length>0&&field('Porcentaje del agente principal *',<input style={inp} required type="number" min="0.01" max="99.99" step="0.01" value={form.primaryPct} onChange={e=>change('primaryPct',e.target.value)}/>)}
 {form.partners.map((p,i)=><React.Fragment key={i}>
  {field('Agente participante '+(i+2)+' *',<select required style={inp} value={p.agentId} onChange={e=>updatePartner(i,'agentId',e.target.value)} disabled={!!splitPartnerError}><option value="">Seleccionar agente</option>{splitPartners.filter(a=>a.id!==primaryAgent&&!form.partners.some((s,j)=>i!==j&&s.agentId===a.id)).map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select>)}
  {field('Porcentaje participante '+(i+2)+' *',<input required style={inp} type="number" min="0.01" max="99.99" step="0.01" value={p.pct} onChange={e=>updatePartner(i,'pct',e.target.value)}/>)}
  <button type="button" onClick={()=>removePartner(i)} style={{alignSelf:'end',padding:10}}>Quitar agente {i+2}</button>
 </React.Fragment>)}
 <div style={{gridColumn:'1/-1'}}><button type="button" disabled={form.partners.length>=4||!!splitPartnerError} onClick={addPartner} style={{padding:10,borderRadius:7,border:'1px solid #1a7440',background:'#eff8f1',color:'#145b32'}}>+ Agregar agente al split ({form.partners.length+1}/5)</button></div>
 {form.partners.length>=2&&creditsError&&<p role="alert" style={{gridColumn:'1/-1',color:'#a33'}}>{creditsError}</p>}
 <div style={{gridColumn:'1/-1',fontSize:13,color:Math.abs(splitTotal-100)>0.001?'#a33':'#536454'}}>
  Estado inicial: <strong>{form.initialDisposition}</strong>. Participantes: {form.partners.length+1}/5 · Total del split: <strong>{Number(splitTotal.toFixed(2))}%</strong> (debe ser 100%). Cada agente recibe su porcentaje de la AP. Los splits admiten agentes de otros equipos. La AP solo se reconoce oficialmente cuando Administración verifica Issue Paid.
 </div>
 <button disabled={saving} style={{padding:12,background:'#1a7440',color:'#fff',border:0,borderRadius:8,fontWeight:700,gridColumn:'1/-1'}}>{saving?'Guardando…':'Guardar póliza'}</button>
 </form>:<div style={{overflowX:'auto',background:'#fff',borderRadius:10,padding:12}}>{busy?<p>Cargando pólizas…</p>:<React.Fragment><p><strong>{rows.length}</strong> pólizas visibles según tus permisos <button type="button" onClick={load} disabled={busy} style={{marginLeft:12,background:'#176b3b',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,cursor:'pointer'}}>↻ Actualizar pólizas</button></p><table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}><thead><tr>{['Fecha','Cliente','Núm. póliza','Compañía','Producto','Lead','Estado','AP','Split','Acción'].map(k=><th key={k} style={{padding:10,textAlign:'left',borderBottom:'1px solid #ddd'}}>{k}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{[r.submitted_on,r.client_name,r.policy_number||'Pendiente',r.carrier,r.product_type,r.lead_source,r.status,'$'+Number(r.annual_premium).toLocaleString('en-US'),splitDisplay(r)].map((v,i)=><td key={i} style={{padding:10,borderBottom:'1px solid #eee'}}>{v}</td>)}<td style={{padding:10,borderBottom:'1px solid #eee'}}>{(user.role==='admin'||r.agent_id===user.id)&&<button type="button" onClick={()=>editAP(r)} style={{background:'#e9f4e7',color:'#145732',padding:9,border:'1px solid #a7bca7',borderRadius:8,fontWeight:700,marginRight:5}}>✎ Corregir AP</button>} {(user.role==='admin'||r.agent_id===user.id)&&<button onClick={()=>editStatus(r)} type="button" style={{background:"#176b3b",color:"#fff",padding:"9px",borderRadius:8,fontWeight:700}}>✎ Cambiar estado</button>} <button type="button" onClick={()=>openHistory(r)} style={{background:"#edf4ef",color:"#145732",padding:"9px",border:"1px solid #a7bca7",borderRadius:8,fontWeight:700}}>◷ Historial</button> {user.role==='admin'&&r.status==='Issue Paid'&&<button type="button" disabled={verificationBusy} onClick={()=>verifyPaid(r,!r.issue_paid_verified_at)} style={{display:'block',marginTop:6,padding:9,background:r.issue_paid_verified_at?'#f6ecec':'#154d2b',color:r.issue_paid_verified_at?'#8c3c3c':'white',border:'1px solid #8fae97',borderRadius:8,fontWeight:700,cursor:'pointer'}}>{r.issue_paid_verified_at?'✓ Verificada · Retirar':'✓ Verificar Issue Paid'}</button>}</td></tr>)}</tbody></table>{!rows.length&&<p>Aún no hay pólizas registradas.</p>}</React.Fragment>}</div>}
 {apEditing&&<section style={{padding:16,background:'#fff',border:'2px solid #9abc99',borderRadius:10,marginTop:16}}>
  <h3 style={{marginTop:0}}>Corregir AP · {apEditing.client_name}</h3>
  <p>AP actual: <strong>{fmt(apEditing.oldAp)}</strong>. La fecha de sometimiento y los splits permanecerán intactos.</p>
  {apEditing.verified&&<p style={{color:'#92550c',fontWeight:700}}>Esta póliza ya está verificada: se enviará una solicitud a Administración. Su producción no cambiará hasta que se apruebe.</p>}
  <label>AP corregida <input type="number" min="0.01" step="0.01" value={apEditing.newAp} onChange={e=>setApEditing(v=>({...v,newAp:e.target.value}))} style={{padding:10,margin:'0 12px',border:'1px solid #aac4aa',borderRadius:7}}/></label>
  <label style={{display:'block',marginTop:12}}>Motivo del cambio <textarea maxLength={500} value={apEditing.reason} onChange={e=>setApEditing(v=>({...v,reason:e.target.value}))} rows={2} placeholder="Ej.: el cliente redujo la prima mensual" style={{display:'block',width:'min(100%,620px)',padding:10,border:'1px solid #aac4aa',borderRadius:7}}/></label>
  {error&&<p role="alert" style={{color:'#a12d28',fontWeight:700,marginTop:12}}>{error}</p>}
  <p style={{fontSize:12,color:'#536454',marginTop:10}}>Al guardar, confirmas el importe y el motivo. La corrección quedará registrada en el historial.</p>
  <div style={{display:'flex',gap:10,marginTop:12}}>
   <button type="button" disabled={apSaving} onClick={saveAP} style={{background:'#176b3b',color:'white',border:0,borderRadius:8,padding:11,fontWeight:700}}>{apSaving?'Guardando…':apEditing.verified?'Solicitar aprobación':'Guardar corrección'}</button>
   <button type="button" disabled={apSaving} onClick={()=>setApEditing(null)}>Cancelar</button>
  </div>
 </section>}
 {user.role==='admin'&&apCorrections.some(x=>x.state==='pending')&&<section style={{padding:16,background:'#fff',border:'1px solid #cfbd8d',borderRadius:10,marginTop:16}}>
  <h3>Correcciones de AP pendientes de Administración</h3>
  {apCorrections.filter(x=>x.state==='pending').map(x=><div key={x.id} style={{borderBottom:'1px solid #eee',padding:'10px 0'}}>
   <strong>{rows.find(p=>p.id===x.policy_id)?.client_name||'Póliza'}</strong> · {fmt(x.previous_ap)} → {fmt(x.requested_ap)} · {x.reason}
   <div style={{display:'flex',gap:8,marginTop:6}}><button type="button" disabled={apSaving} onClick={()=>reviewAP(x,true)}>Aprobar</button><button type="button" disabled={apSaving} onClick={()=>reviewAP(x,false)}>Rechazar</button></div>
  </div>)}
 </section>}
 {historyPolicy&&<section style={{padding:16,background:'#fff',border:'1px solid #dce5d8',borderRadius:10,marginTop:16}}><h3>Historial de la póliza · {historyPolicy.policy_number||historyPolicy.client_name}</h3>
  <h4>Correcciones de AP</h4>
  {apCorrections.filter(x=>x.policy_id===historyPolicy.id).length?apCorrections.filter(x=>x.policy_id===historyPolicy.id).map(x=><p key={x.id}>{new Date(x.created_at).toLocaleString('es-US',{timeZone:'America/New_York'})} · {fmt(x.previous_ap)} → {fmt(x.requested_ap)} · {x.state==='applied'?'Aplicada':x.state==='pending'?'Pendiente':x.state==='approved'?'Aprobada':'Rechazada'} · Motivo: {x.reason}</p>):<p>Sin correcciones de AP registradas.</p>}
  <h4>Cambios de estado</h4><button type="button" onClick={()=>setHistoryPolicy(null)}>Cerrar</button>{historyRows.length?historyRows.map(h=><p key={h.id}>{new Date(h.changed_at).toLocaleString('es-US')} · <strong>{h.changed_by===user.id?user.name:(agents.find(a=>a.id===h.changed_by)?.full_name||'Usuario '+(h.changed_by?h.changed_by.slice(0,8):'no identificado'))}</strong> · {h.previous_status||'—'} → {h.new_status}</p>):<p>Sin cambios registrados desde que se activó el historial.</p>}</section>}
 </div>
 </div>;
}
window.ProductionCenter=ProductionCenter;