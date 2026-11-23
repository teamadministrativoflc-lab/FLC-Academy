/**
 * FLC - Normalización segura a CUATRO zonas visibles.
 * PREPARACIÓN: no instalar triggers hasta probar una COPIA del spreadsheet.
 * Zonas visibles: Eastern, Central, Mountain, Pacific.
 * Pacific = America/Los_Angeles (PST/PDT, automático).
 *
 * NO inferir zona por teléfono. Estados divididos requieren confirmación.
 * Arizona se clasifica Mountain pero usa UTC-7 todo el año salvo excepciones
 * (p.ej. territorio Navajo: requiere validación).
 * AK, HI y PR no pertenecen a estas 4 zonas: revisión, no clasificación falsa.
 */

const FLC_ZONE_TO_IANA = Object.freeze({
  Eastern: 'America/New_York',
  Central: 'America/Chicago',
  Mountain: 'America/Denver',
  Pacific: 'America/Los_Angeles'
});

const FLC_STATE_ZONE = Object.freeze({
  AL:'Central', AR:'Central', CA:'Pacific', CO:'Mountain',
  CT:'Eastern', DC:'Eastern', DE:'Eastern', GA:'Eastern',
  IA:'Central', IL:'Central', LA:'Central', MA:'Eastern',
  MD:'Eastern', ME:'Eastern', MN:'Central', MO:'Central',
  MS:'Central', MT:'Mountain', NC:'Eastern', NH:'Eastern',
  NJ:'Eastern', NM:'Mountain', NY:'Eastern', OH:'Eastern',
  OK:'Central', PA:'Eastern', RI:'Eastern', SC:'Eastern',
  UT:'Mountain', VA:'Eastern', VT:'Eastern', WA:'Pacific',
  WI:'Central', WV:'Eastern', WY:'Mountain'
});

// Varias zonas oficiales: nunca asignar automáticamente con solo State.
const FLC_SPLIT_STATES = Object.freeze({
  FL:['Eastern','Central'], IN:['Eastern','Central'],
  KY:['Eastern','Central'], MI:['Eastern','Central'],
  TN:['Eastern','Central'], KS:['Central','Mountain'],
  NE:['Central','Mountain'], ND:['Central','Mountain'],
  SD:['Central','Mountain'], TX:['Central','Mountain'],
  ID:['Mountain','Pacific'], NV:['Pacific','Mountain'],
  OR:['Pacific','Mountain']
});
const FLC_OUT_OF_SCOPE = ['AK','HI','PR'];
const FLC_LABELS = ['Eastern','Central','Mountain','Pacific'];

function flcNormalizaSigla(estado) {
  const raw = String(estado || '').trim().toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const alias = {
    'NEW YORK':'NY','NUEVA YORK':'NY','FLORIDA':'FL',
    'TEXAS':'TX','CALIFORNIA':'CA','ARIZONA':'AZ',
    'COLORADO':'CO','NEVADA':'NV','WASHINGTON':'WA',
    'PUERTO RICO':'PR'
  };
  return alias[raw] || raw;
}

function flcResolverZona(estado, zonaConfirmada) {
  const s = flcNormalizaSigla(estado);
  const override = String(zonaConfirmada || '').trim();
  const permitido = FLC_LABELS.includes(override);
  if (FLC_OUT_OF_SCOPE.includes(s))
    return {zona:'',motivo:'FUERA_DE_LAS_CUATRO_ZONAS'};
  if (s === 'AZ') {
    if (permitido && override !== 'Mountain')
      return {zona:'',motivo:'CONFIRMACION_CONFLICTIVA'};
    return {zona:'Mountain',motivo:'ARIZONA_EXCEPCION_HORARIO'};
  }
  if (FLC_SPLIT_STATES[s]) {
    if (permitido && FLC_SPLIT_STATES[s].includes(override))
      return {zona:override,motivo:'CONFIRMADO'};
    return {zona:'',motivo:'ESTADO_CON_MULTIPLES_ZONAS'};
  }
  if (!FLC_STATE_ZONE[s])
    return {zona:'',motivo:'ESTADO_NO_IDENTIFICADO'};
  if (permitido && override !== FLC_STATE_ZONE[s])
    return {zona:'',motivo:'CONFIRMACION_CONFLICTIVA'};
  return {zona:FLC_STATE_ZONE[s],motivo:'ESTADO_UNICO'};
}

/**
 * Formatea la hora local real sin mantener offsets GMT escritos a mano.
 * Las claves IANA son internas; nunca se guardan en la columna TimeZone.
 */
function flcHoraLocal(fecha, zona, estado) {
  if (!FLC_LABELS.includes(zona)) throw new Error('Zona no válida');
  const sigla = flcNormalizaSigla(estado);
  const iana = sigla === 'AZ' ? 'Etc/GMT+7' : FLC_ZONE_TO_IANA[zona];
  return Utilities.formatDate(fecha, iana, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Ejecutar primero con modoSoloLectura=true (por defecto).
 * Detecta los encabezados State, TimeZone y opcionalmente "Zona FLC Confirmada".
 * NO crea columnas ni altera fórmulas. No borra etiquetas dudosas sin validación.
 * Devuelve estadísticas, nunca imprime datos personales en logs.
 */
function flcNormalizarZonas4(modoSoloLectura = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumen = {modoSoloLectura,hojas:0,revisados:0,cambios:0,
    ambiguos:0,fuera:0,formulasOmitidas:0,detalles:[]};
  ss.getSheets().forEach(sheet => {
    const lastRow=sheet.getLastRow(), lastCol=sheet.getLastColumn();
    if(lastRow < 2 || !lastCol) return;
    const headers=sheet.getRange(1,1,1,lastCol).getValues()[0]
      .map(v=>String(v||'').toLowerCase().trim().replace(/[_ ]+/g,''));
    const stateIndex=headers.indexOf('state');
    const zoneIndex=headers.findIndex(v=>v==='timezone'||v==='timezome');
    const confirmIndex=headers.indexOf('zonaflcconfirmada');
    if(stateIndex===-1 || zoneIndex===-1) return;
    resumen.hojas++;
    const n=lastRow-1;
    const states=sheet.getRange(2,stateIndex+1,n,1).getValues();
    const zRange=sheet.getRange(2,zoneIndex+1,n,1);
    const zones=zRange.getValues(), formulas=zRange.getFormulas();
    const confirms=confirmIndex>=0
      ? sheet.getRange(2,confirmIndex+1,n,1).getValues():null;
    const pendientes=[];
    let cambiosHoja=0, ambiguosHoja=0;
    function flush() {
      if(!pendientes.length) return;
      const inicio=pendientes[0].row;
      const valores=pendientes.map(p=>[p.value]);
      if(!modoSoloLectura) sheet.getRange(inicio,zoneIndex+1,valores.length,1).setValues(valores);
      pendientes.length=0;
    }
    for(let i=0;i<n;i++) {
      const state=String(states[i][0]||'').trim();
      if(!state){flush();continue;}
      resumen.revisados++;
      if(formulas[i][0]){resumen.formulasOmitidas++;flush();continue;}
      const confirmado=confirms?confirms[i][0]:'';
      const result=flcResolverZona(state,confirmado);
      if(!result.zona){
        resumen.ambiguos++; ambiguosHoja++; flush();
        if(result.motivo==='FUERA_DE_LAS_CUATRO_ZONAS') resumen.fuera++;
        continue; // no sobrescribir valores previos: requieren revisión
      }
      const original=String(zones[i][0]||'').trim();
      if(original===result.zona){flush();continue;}
      if(pendientes.length && pendientes[pendientes.length-1].row !== i+1) flush();
      pendientes.push({row:i+2,value:result.zona});
      resumen.cambios++; cambiosHoja++;
    }
    flush();
    resumen.detalles.push({hoja:sheet.getName(),cambios:cambiosHoja,ambiguos:ambiguosHoja});
  });
  Logger.log(JSON.stringify(resumen));
  return resumen;
}
