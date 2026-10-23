function TeamAssignmentsAdmin() {
 const [members,setMembers]=React.useState([]),[busy,setBusy]=React.useState(true),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[working,setWorking]=React.useState('');
 const load=async()=>{setBusy(true);setError('');const {data,error}=await window.flcSupabase.rpc('flc_admin_team_roster');if(error)setError('No se pudieron cargar las asignaciones.');else setMembers(data||[]);setBusy(false);};
 React.useEffect(()=>{load();},[]);
 const changeLeader=async(m)=>{setWorking(m.id);setError('');setNotice('');const {error}=await window.flcSupabase.rpc('flc_admin_set_team_leader',{p_agent_id:m.id,p_enabled:!m.is_leader});if(error)setError(error.message||'No se pudo actualizar el líder.');else{setNotice('Permiso de líder actualizado.');await load();}setWorking('');};
 const assign=async(m,value)=>{setWorking(m.id);setError('');setNotice('');const {error}=await window.flcSupabase.rpc('flc_admin_assign_team_member',{p_agent_id:m.id,p_leader_id:value||null});if(error)setError(error.message||'No se pudo asignar.');else{setNotice('Estructura actualizada.');await load();}setWorking('');};
 return <section style={{margin:'24px 0',padding:18,border:'1px solid #dce5d8',borderRadius:10,background:'#fff'}}>
 <h2 style={{marginTop:0}}>Estructura de líderes</h2>
 <p style={{fontSize:13,color:'#526252'}}>Solo Administración puede nombrar líderes y asignar agentes. Cada agente tiene un líder directo; los sublíderes forman la estructura jerárquica.</p>
 <button onClick={load}>Actualizar estructura</button>
 {busy&&<p>Cargando…</p>}{error&&<p role="alert" style={{color:'#a33'}}>{error}</p>}{notice&&<p role="status" style={{color:'#26733a'}}>{notice}</p>}
 {!busy&&<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
 <thead><tr><th style={{textAlign:'left',padding:8}}>Agente</th><th style={{textAlign:'left',padding:8}}>Permisos</th><th style={{textAlign:'left',padding:8}}>Líder directo</th></tr></thead>
 <tbody>{members.map(m=><tr key={m.id}><td style={{padding:8,borderTop:'1px solid #e8ede6'}}>{m.full_name}</td>
 <td style={{padding:8,borderTop:'1px solid #e8ede6'}}><button disabled={working===m.id} onClick={()=>changeLeader(m)} style={{padding:'6px 10px'}}>{m.is_leader?'Quitar rol de líder':'Convertir en líder'}</button></td>
 <td style={{padding:8,borderTop:'1px solid #e8ede6'}}><select value={m.leader_id||''} disabled={working===m.id} onChange={e=>assign(m,e.target.value)} style={{padding:8,maxWidth:280}}>
 <option value="">Sin líder asignado</option>{members.filter(x=>x.is_leader&&x.id!==m.id).map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}
 </select></td></tr>)}</tbody>
 </table></div>}
 </section>;
}
window.TeamAssignmentsAdmin=TeamAssignmentsAdmin;