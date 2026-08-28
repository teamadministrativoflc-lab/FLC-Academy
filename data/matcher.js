// MATCHER ENGINE
// Rules derived from real underwriting guides (NLG, Transamerica, MoO, Corebridge, F&G).
// Given client conditions + product + immigration status, return a ranked list of carriers.

const RATING_ORDER = ['preferred_plus', 'preferred', 'standard_plus', 'standard', 'table2', 'table4', 'table6', 'table8', 'gi', 'decline'];
const RATING_LABELS = {
  preferred_plus: { es: 'Preferred Plus', en: 'Preferred Plus' },
  preferred: { es: 'Preferred', en: 'Preferred' },
  standard_plus: { es: 'Standard Plus', en: 'Standard Plus' },
  standard: { es: 'Standard', en: 'Standard' },
  table2: { es: 'Table 2', en: 'Table 2' },
  table4: { es: 'Table 4', en: 'Table 4' },
  table6: { es: 'Table 6', en: 'Table 6' },
  table8: { es: 'Table 8', en: 'Table 8' },
  gi: { es: 'Guaranteed Issue', en: 'Guaranteed Issue' },
  decline: { es: 'No califica', en: 'Declined' },
};

function worseRating(a, b) {
  return RATING_ORDER.indexOf(a) > RATING_ORDER.indexOf(b) ? a : b;
}

function calcBMI(weightLb, heightIn) {
  if (!weightLb || !heightIn) return null;
  return (weightLb / (heightIn * heightIn)) * 703;
}

function ageAtYearEnd(dobStr) {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return null;
  return new Date().getFullYear() - d.getFullYear();
}

function currentAge(dobStr) {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function resolveAge(c) {
  if ((c.product === 'iul' || c.product === 'term') && c.dob) return ageAtYearEnd(c.dob);
  if (c.product === 'final') {
    if (c.dob) return currentAge(c.dob);
    if (c.age !== '' && c.age != null) return Number(c.age);
  }
  if (c.age !== '' && c.age != null) return Number(c.age);
  if (c.dob) return currentAge(c.dob);
  return null;
}

// ---- Evaluate one carrier vs client ----
function evalCarrier(carrier, c) {
  const notes = [];
  let score = 100;
  let rating = 'preferred';
  let declined = false;
  let declineReason = null;

  const addNote = (type, es, en) => notes.push({ type, es, en });
  const decline = (es, en) => {
    declined = true;
    declineReason = { es, en };
    rating = 'decline';
    score = 0;
  };
  const done = () => ({ carrier, score: 0, rating, notes, declined, declineReason });

  // Special: Corebridge has a "Guaranteed" plan for Final Expense that accepts
  // clients with terminal / uncontrolled conditions. Instead of declining,
  // route them to GI with a note. Only when the product IS final expense.
  const canUseCorebridgeGuaranteed = carrier.id === 'corebridge' && c.product === 'final';
  const routeToGuaranteed = (esReason, enReason) => {
    rating = worseRating(rating, 'gi');
    score = Math.max(score - 25, 30);   // keep it visible in results
    addNote('warn',
      `Aplicaría por el plan GARANTIZADO de Corebridge (${esReason}). Período graded 2 años.`,
      `Would apply through Corebridge's GUARANTEED plan (${enReason}). 2-year graded period.`);
  };

  // ---- HARD FILTERS ----
  if (c.product) {
    const productCarriers = window.CARRIERS_BY_PRODUCT[c.product] || [];
    if (!productCarriers.includes(carrier.id)) {
      decline('Este carrier no ofrece este tipo de producto.', "This carrier doesn't offer this product type.");
      return done();
    }
  }

  if (c.immigration) {
    const docCarriers = window.CARRIERS_BY_DOCUMENT[c.immigration] || [];
    if (!docCarriers.includes(carrier.id)) {
      decline('Este carrier no acepta este tipo de documento migratorio.', "This carrier doesn't accept this immigration document.");
      return done();
    }
    if (c.immigration === 'itin') {
      addNote('ok', 'Carrier acepta clientes con ITIN.', 'Carrier accepts ITIN clients.');
    } else if (['passport', 'consular', 'homecountry'].includes(c.immigration)) {
      addNote('ok', 'Carrier acepta documentos internacionales.', 'Carrier accepts international documents.');
    }
  }

  // ---- AGE ----
  const age = resolveAge(c);
  if (age != null && !isNaN(age)) {
    const [minA, maxA] = carrier.ageRange;
    if (age < minA || age > maxA) {
      decline(`Edad fuera del rango del carrier (${minA}-${maxA} años).`,
              `Age outside carrier range (${minA}-${maxA}).`);
      return done();
    }
    if ((carrier.id === 'aa' || carrier.id === 'aetna') && age < 50) {
      score -= 8;
      addNote('warn', 'Este carrier es más fuerte para clientes 50+.', 'This carrier is stronger for clients 50+.');
    }
  }

  // ---- BMI (per carrier build charts) ----
  const bmi = calcBMI(c.weightLb, c.heightIn);
  if (bmi) {
    if (bmi > 46.5) {
      decline('IMC excede la tabla de construcción máxima (>46.5).',
              'BMI exceeds max build chart (>46.5).');
      return done();
    }
    if (bmi > 40) {
      if (['nlg', 'transamerica', 'corebridge', 'fg'].includes(carrier.id)) {
        decline('IMC >40 excede la tabla de este carrier.',
                'BMI >40 exceeds this carrier\'s build chart.');
        return done();
      }
      rating = worseRating(rating, 'table4');
      score -= 20;
      addNote('warn', 'IMC alto (>40): tabla 4 o superior.', 'High BMI (>40): table 4 or worse.');
    } else if (bmi > 37.5) {
      rating = worseRating(rating, 'table2');
      score -= 14;
      addNote('warn', 'IMC alto (37.5-40): Express Standard 1.', 'High BMI (37.5-40): Express Standard 1.');
    } else if (bmi > 32.7) {
      rating = worseRating(rating, 'standard');
      score -= 8;
      addNote('warn', 'IMC 32.7-37.5: rango Standard.', 'BMI 32.7-37.5: Standard range.');
    } else if (bmi > 29.9) {
      // Corebridge stricter above 29.5
      if (carrier.id === 'corebridge' && bmi > 29.5) {
        rating = worseRating(rating, 'standard');
        score -= 4;
        addNote('warn', 'Corebridge: IMC >29.5 sale de Preferred Plus.', 'Corebridge: BMI >29.5 exits Preferred Plus.');
      } else {
        addNote('ok', 'IMC en rango Select.', 'BMI in Select range.');
      }
    } else if (bmi >= 18.5) {
      addNote('ok', 'IMC dentro de rango Preferred/Elite.', 'BMI in Preferred/Elite range.');
    } else {
      score -= 5;
      addNote('warn', 'IMC bajo (<18.5): revisión adicional.', 'Low BMI (<18.5): additional review.');
    }
  }

  // ---- SMOKING ----
  if (c.smoker === 'current') {
    rating = worseRating(rating, 'standard');
    score -= 18;
    addNote('warn', 'Fumador actual: rating tabaco.', 'Current smoker: tobacco rating.');
    if (carrier.id === 'moo') {
      score -= 5;
      addNote('warn', 'MoO menos flexible con tabaco actual.', 'MoO less flexible with current tobacco.');
    }
  } else if (c.smoker === 'former') {
    const years = Number(c.yearsQuit) || 0;
    if (years < 1) {
      rating = worseRating(rating, 'standard');
      score -= 12;
      addNote('warn', '<1 año sin fumar: aún cuenta como tabaco.', '<1 yr quit: still counted as tobacco.');
    } else if (years < 2) {
      score -= 5;
      addNote('warn', 'Ex-fumador reciente (<2 años).', 'Recent former smoker (<2 yrs).');
    } else if (years < 3 && carrier.id === 'transamerica') {
      score -= 3;
      addNote('warn', 'Transamerica: Preferred requiere 2+ años, Preferred Plus 5+.', 'Transamerica: Preferred needs 2+ yrs, Preferred Plus 5+.');
    } else if (years >= 5) {
      addNote('ok', `Ex-fumador ${years}+ años: elegible Preferred Plus.`, `Former smoker ${years}+ yrs: eligible Preferred Plus.`);
    } else {
      addNote('ok', `Ex-fumador ${years} años: elegible non-tobacco.`, `Former smoker ${years} yrs: eligible non-tobacco.`);
    }
    // NLG Elite requires 60 months (5 years)
    if (carrier.id === 'nlg' && years < 5) {
      score -= 4;
      addNote('warn', 'NLG Elite requiere 60 meses sin nicotina.', 'NLG Elite requires 60 months nicotine-free.');
    }
  } else if (c.smoker === 'never') {
    addNote('ok', 'Nunca fumador: preferred non-tobacco.', 'Never smoker: preferred non-tobacco.');
  }

  // ---- DIABETES ----
  if (c.diabetes === 'type1') {
    // Corebridge in Final Expense mode → route to Guaranteed plan
    if (canUseCorebridgeGuaranteed) {
      routeToGuaranteed('diabetes tipo 1', 'type 1 diabetes');
    } else if (['nlg', 'fg'].includes(carrier.id)) {
      decline('Diabetes juvenil (dx <20 años) → decline en este carrier.',
              'Juvenile-onset diabetes → decline for this carrier.');
      return done();
    } else if (carrier.id === 'corebridge') {
      // Corebridge outside FE → decline (their Term/IUL don't accept T1)
      decline('Diabetes tipo 1 → decline en Corebridge para este producto.',
              'Type 1 diabetes → decline for this Corebridge product.');
      return done();
    } else if (carrier.id === 'transamerica') {
      if (age && age < 20) {
        decline('Transamerica: diabetes tipo 1 <20 años → decline.', 'Transamerica: type 1 diabetes <20 → decline.');
        return done();
      }
      if (age && age < 30) {
        rating = worseRating(rating, 'table8');
        score -= 30;
        addNote('warn', 'Transamerica: T1 20-29 → T8 a decline.', 'Transamerica: T1 20-29 → T8 to decline.');
      } else {
        rating = worseRating(rating, 'table6');
        score -= 22;
        addNote('warn', 'Transamerica: T1 30+ → T6 a T8.', 'Transamerica: T1 30+ → T6 to T8.');
      }
    } else {
      rating = worseRating(rating, 'table4');
      score -= 20;
      addNote('warn', 'Diabetes tipo 1: rating alto tabla 4+.', 'Type 1 diabetes: high rating table 4+.');
    }
  } else if (c.diabetes === 'type2c') {
    // Type 2 controlled
    if (carrier.id === 'fg' && age && age >= 50) {
      addNote('ok', 'F&G: diabetes tipo 2 controlada 50+ → Standard.', 'F&G: controlled type 2 diabetes 50+ → Standard.');
      score -= 2;
    } else if (carrier.id === 'fg' && age && age >= 30) {
      rating = worseRating(rating, 'table4');
      score -= 8;
      addNote('warn', 'F&G: T2 controlada 30-49 → T3 a T6.', 'F&G: controlled T2 30-49 → T3 to T6.');
    } else if (carrier.id === 'moo') {
      rating = worseRating(rating, 'standard');
      score -= 4;
      addNote('ok', 'MoO: T2 controlada → Standard a T8.', 'MoO: controlled T2 → Standard to T8.');
    } else if (['americo', 'aa', 'aetna'].includes(carrier.id)) {
      addNote('ok', 'Diabetes tipo 2 controlada: aceptada.', 'Controlled type 2 diabetes: accepted.');
      score -= 3;
    } else {
      score -= 8;
      rating = worseRating(rating, 'standard');
      addNote('warn', 'Diabetes tipo 2 controlada: standard.', 'Controlled type 2 diabetes: standard.');
    }
  } else if (c.diabetes === 'type2u') {
    if (canUseCorebridgeGuaranteed) {
      routeToGuaranteed('diabetes tipo 2 no controlada', 'uncontrolled type 2 diabetes');
    } else if (['fg', 'corebridge', 'transamerica'].includes(carrier.id)) {
      decline('Diabetes tipo 2 no controlada (A1C ≥10) no califica.',
              'Uncontrolled type 2 diabetes (A1C ≥10) doesn\'t qualify.');
      return done();
    }
    if (carrier.id === 'nlg') {
      decline('NLG: A1C ≥10 o con complicaciones → decline.',
              'NLG: A1C ≥10 or complications → decline.');
      return done();
    }
    rating = worseRating(rating, 'table6');
    score -= 22;
    addNote('warn', 'Diabetes no controlada: rating tabla 6+.', 'Uncontrolled diabetes: table 6+.');
  }

  // ---- HBP ----
  if (c.hbp === 'uncontrolled') {
    rating = worseRating(rating, 'table2');
    score -= 10;
    addNote('warn', 'Presión no controlada.', 'Uncontrolled blood pressure.');
  } else if (c.hbp === 'controlled') {
    score -= 3;
    addNote('ok', 'Presión controlada con medicamento: aceptada.', 'Controlled BP w/ medication: accepted.');
  }

  // ---- Cholesterol ----
  if (c.chol) {
    if (carrier.id === 'moo') {
      score -= 2;
      addNote('ok', 'MoO permite colesterol tratado en Preferred.', 'MoO allows treated cholesterol in Preferred.');
    } else {
      score -= 4;
      addNote('warn', 'Colesterol alto: aceptado con medicamento.', 'High cholesterol: accepted with medication.');
    }
  }

  // ---- Heart attack ----
  if (c.infarct) {
    const yrs = Number(c.infarctYears) || 0;
    // Corebridge Guaranteed FE accepts recent heart attacks
    if (canUseCorebridgeGuaranteed && yrs < 2) {
      routeToGuaranteed(
        yrs < 1 ? 'infarto en últimos 6 meses' : 'infarto reciente',
        yrs < 1 ? 'heart attack in last 6 months' : 'recent heart attack');
      // skip the rest of heart-attack logic for Corebridge
      // (jump to end of infarct block via early continuation)
    } else if (yrs < 1) {
      decline('Infarto en últimos 6 meses: decline automático.',
              'Heart attack in last 6 months: automatic decline.');
      return done();
    } else if (yrs < 2) {
      decline('Infarto reciente (<2 años): no califica.',
              'Recent heart attack (<2 yrs): does not qualify.');
      return done();
    } else {
      // Transamerica: age <40 decline, 40-45 T6-decline, 60+ T2-decline
      if (carrier.id === 'transamerica' && age && age < 40) {
        decline('Transamerica: infarto <40 años → decline.',
                'Transamerica: heart attack <40 → decline.');
        return done();
      }
      if (yrs < 5) {
        if (['nlg', 'fg'].includes(carrier.id)) {
          decline('Este carrier requiere 5+ años post-infarto.',
                  'This carrier requires 5+ years post heart attack.');
          return done();
        }
        // MoO: MI over 40 → T4 to decline
        if (carrier.id === 'moo') {
          rating = worseRating(rating, 'table4');
          score -= 22;
          addNote('warn', 'MoO: infarto 40+ → T4 a decline.', 'MoO: MI age 40+ → T4 to decline.');
        } else {
          rating = worseRating(rating, 'table4');
          score -= 22;
          addNote('warn', 'Infarto 2-5 años: rating tabla 4.', 'Heart attack 2-5 yrs: table 4 rating.');
        }
      } else {
        rating = worseRating(rating, 'table2');
        score -= 10;
        addNote('warn', `Infarto hace ${yrs} años: tabla 2.`, `Heart attack ${yrs} yrs ago: table 2.`);
      }
    }
  }

  if (c.preInfarct) {
    rating = worseRating(rating, 'table2');
    score -= 10;
    addNote('warn', 'Evento pre-infarto: rating tabla 2.', 'Pre-cardiac event: table 2 rating.');
  }

  // ---- HIV ----
  if (c.hiv) {
    // NLG, Transamerica, Corebridge, Americo → automatic decline
    if (['nlg', 'transamerica', 'corebridge', 'americo'].includes(carrier.id)) {
      decline('Este carrier declina VIH/SIDA automáticamente.',
              'This carrier auto-declines HIV/AIDS.');
      return done();
    }
    // MoO: individual consideration
    if (carrier.id === 'moo') {
      rating = worseRating(rating, 'table6');
      score -= 30;
      addNote('warn', 'MoO: VIH → consideración individual.', 'MoO: HIV → individual consideration.');
    } else if (carrier.id === 'fg') {
      rating = worseRating(rating, 'table8');
      score -= 35;
      addNote('warn', 'F&G: VIH con RNA indetectable → T8 a decline.', 'F&G: HIV with undetectable RNA → T8 to decline.');
    } else if (carrier.id === 'aetna') {
      rating = worseRating(rating, 'gi');
      score -= 30;
      addNote('warn', 'Aetna: VIH → solo Guaranteed Issue.', 'Aetna: HIV → Guaranteed Issue only.');
    } else {
      rating = worseRating(rating, 'table4');
      score -= 25;
      addNote('warn', 'VIH: rating alto o graded.', 'HIV: high rating or graded.');
    }
  }

  // ---- Thyroid ----
  if (c.thyroid) {
    score -= 2;
    addNote('ok', 'Tiroides medicada y estable: aceptada.', 'Medicated stable thyroid: accepted.');
  }

  // ---- Cancer ----
  if (c.cancer) {
    const yrs = Number(c.cancerYears) || 0;
    if (yrs < 2) {
      // Corebridge Guaranteed FE accepts recent / terminal cancer
      if (canUseCorebridgeGuaranteed) {
        routeToGuaranteed('cáncer con <2 años libre / activo',
                          'cancer <2 yrs free / active');
      } else {
        decline('Cáncer con <2 años libre: postpone.',
                'Cancer with <2 yrs free: postpone.');
        return done();
      }
    } else {
    if (carrier.id === 'transamerica') {
      addNote('warn', 'Transamerica: cáncer órgano interno requiere home office call.',
              'Transamerica: internal organ cancer → home office call.');
    }
    if (yrs < 5) {
      if (canUseCorebridgeGuaranteed) {
        routeToGuaranteed('cáncer 2-5 años libre', 'cancer 2-5 yrs free');
      } else if (['fg', 'nlg', 'corebridge'].includes(carrier.id)) {
        decline('Este carrier requiere 5+ años libre de cáncer.',
                'This carrier requires 5+ years cancer-free.');
        return done();
      }
      rating = worseRating(rating, 'table4');
      score -= 22;
      addNote('warn', 'Cáncer 2-5 años libre: rating alto.', 'Cancer 2-5 yrs free: high rating.');
    } else if (yrs < 10) {
      rating = worseRating(rating, 'table2');
      score -= 10;
      addNote('warn', `Cáncer ${yrs} años libre: tabla 2.`, `Cancer ${yrs} yrs free: table 2.`);
    } else {
      score -= 3;
      addNote('ok', `Cáncer ${yrs}+ años libre: standard.`, `Cancer ${yrs}+ yrs free: standard.`);
    }
    } // close outer else for cancer yrs >= 2
  }

  // ---- Kidney ----
  if (c.kidney) {
    if (canUseCorebridgeGuaranteed) {
      routeToGuaranteed('enfermedad renal', 'kidney disease');
    } else if (['fg', 'nlg', 'corebridge', 'transamerica'].includes(carrier.id)) {
      decline('Enfermedad renal significativa: no califica.',
              'Significant kidney disease: does not qualify.');
      return done();
    } else {
      rating = worseRating(rating, 'table6');
      score -= 20;
      addNote('warn', 'Enfermedad renal: rating alto o GI.', 'Kidney disease: high rating or GI.');
    }
  }

  // ---- Liver ----
  if (c.liver) {
    if (canUseCorebridgeGuaranteed) {
      routeToGuaranteed('enfermedad hepática', 'liver disease');
    } else if (['fg', 'transamerica'].includes(carrier.id)) {
      decline('Enfermedad hepática (cirrosis/hepatitis activa): no califica.',
              'Liver disease (cirrhosis/active hepatitis): does not qualify.');
      return done();
    } else {
      rating = worseRating(rating, 'table4');
      score -= 14;
      addNote('warn', 'Enfermedad hepática: rating tabla 4+.', 'Liver disease: table 4+.');
    }
  }

  // ---- DUI ----
  if (c.dui) {
    // Transamerica: DUI <1 yr → decline
    if (carrier.id === 'transamerica') {
      decline('Transamerica: DUI <1 año o múltiples <4 años → decline.',
              'Transamerica: DUI <1 yr or multiple <4 yrs → decline.');
      return done();
    }
    // NLG: single DUI <1 yr or multiple <5 yrs → non-qualifying
    if (carrier.id === 'nlg') {
      decline('NLG: DUI reciente → no califica.',
              'NLG: recent DUI → non-qualifying.');
      return done();
    }
    if (canUseCorebridgeGuaranteed) {
      routeToGuaranteed('DUI reciente', 'recent DUI');
    } else if (carrier.id === 'corebridge') {
      decline('Corebridge Simplified estricta con DUI <3 años.',
              'Corebridge Simplified strict on DUI <3 yrs.');
      return done();
    } else if (carrier.id === 'moo') {
      rating = worseRating(rating, 'standard');
      score -= 12;
      addNote('warn', 'MoO: DUI en 5 años excluye Preferred.', 'MoO: DUI in 5 yrs excludes Preferred.');
    } else {
      rating = worseRating(rating, 'standard');
      score -= 8;
      addNote('warn', 'DUI reciente: rating standard.', 'Recent DUI: standard rating.');
    }
  }

  // ---- Felony ----
  if (c.felony) {
    // NLG, Americo, Transamerica → decline
    if (['americo', 'nlg', 'transamerica'].includes(carrier.id)) {
      decline('Felonías recientes: no califica en este carrier.',
              'Recent felonies: doesn\'t qualify with this carrier.');
      return done();
    }
    rating = worseRating(rating, 'table2');
    score -= 12;
    addNote('warn', 'Historial de felonía: revisar caso.', 'Felony record: review case.');
  }

  // ---- License suspended ----
  if (c.license) {
    score -= 5;
    addNote('warn', 'Licencia suspendida activa: revisar.', 'Active suspended license: review.');
  }

  // ---- Other ----
  if (c.other && c.other.trim().length > 0) {
    score -= 3;
    addNote('warn', 'Condición adicional descrita: revisa manualmente.', 'Additional condition: review manually.');
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { carrier, score, rating, notes, declined, declineReason };
}

function hasEnoughData(c) {
  if (!c.product) return false;
  const age = resolveAge(c);
  return age != null && !isNaN(age) && age > 0;
}

window.MATCHER = {
  evalCarrier,
  hasEnoughData,
  calcBMI,
  ageAtYearEnd,
  currentAge,
  resolveAge,
  RATING_LABELS,
  runAll(client) {
    const carriers = window.COMPANIES.map(c => evalCarrier(c, client));
    carriers.sort((a, b) => {
      if (a.declined && !b.declined) return 1;
      if (!a.declined && b.declined) return -1;
      return b.score - a.score;
    });
    return carriers;
  },
};
