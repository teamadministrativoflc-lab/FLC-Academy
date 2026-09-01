// QUIZ BANK — 45 preguntas divididas en 3 temas.
// Cada intento del quiz toma 15 preguntas aleatorias del banco:
//   - 5 de "Fundamentos" (Módulo 1)
//   - 5 de "Guion" (Módulo 2)
//   - 5 de "Objeciones" (Módulo 3)
//
// Tipos de pregunta:
//   type: 'multiple'   — 4 opciones, elige 1
//   type: 'truefalse'  — verdadero/falso
//   type: 'scenario'   — escenario (mismo formato que multiple pero enmarcado como caso)
//
// Cada pregunta debe tener:
//   q: enunciado
//   options: [array de textos]
//   correct: índice de la opción correcta (0-based)
//   explain: explicación breve que se muestra al final

window.QUIZ_BANK = {

  // =========================================================
  // MÓDULO 1 · FUNDAMENTOS DEL SEGURO DE VIDA
  // =========================================================
  fundamentos: [
    {
      type: 'multiple',
      q: '¿Qué es un seguro de vida?',
      options: [
        'Una inversión que garantiza retornos altos en el mercado de valores.',
        'Un contrato en el que una compañía paga una suma a los beneficiarios tras el fallecimiento del asegurado.',
        'Un plan de ahorro que se puede retirar en cualquier momento sin restricciones.',
        'Un servicio médico prepagado.',
      ],
      correct: 1,
      explain: 'Un seguro de vida es un contrato: a cambio de una prima, la compañía paga una suma a los beneficiarios si el asegurado fallece o si ocurre una contingencia pactada.',
    },
    {
      type: 'multiple',
      q: '¿Cuáles son los 3 tipos de seguro que trabajamos en la agencia?',
      options: [
        'Auto, hogar y salud.',
        'IUL, Gastos Finales y Término.',
        'Vida, salud y anualidades.',
        'Term, Whole Life y Universal.',
      ],
      correct: 1,
      explain: 'Los 3 tipos principales que trabaja la agencia son: IUL (Indexed Universal Life), Gastos Finales (Final Expense) y Término (Term).',
    },
    {
      type: 'multiple',
      q: '¿Qué significa "IUL"?',
      options: [
        'Insurance Universal Life',
        'Indexed Universal Life',
        'Investment Universal Loan',
        'Individual Underwriting License',
      ],
      correct: 1,
      explain: 'IUL significa Indexed Universal Life — un seguro de vida permanente cuyo valor en efectivo crece siguiendo un índice bursátil como el S&P 500.',
    },
    {
      type: 'multiple',
      q: '¿Qué es el "beneficiario primario" en una póliza?',
      options: [
        'La persona que paga las primas.',
        'La compañía de seguros que emite la póliza.',
        'La persona designada para recibir la cobertura si el asegurado fallece.',
        'El agente que vendió la póliza.',
      ],
      correct: 2,
      explain: 'El beneficiario primario es quien recibe la suma asegurada al fallecer el asegurado. El beneficiario contingente la recibe si el primario también fallece.',
    },
    {
      type: 'multiple',
      q: '¿Qué son los "Living Benefits" en un IUL?',
      options: [
        'Descuentos que la compañía ofrece por buena salud.',
        'Anticipos de la cobertura EN VIDA por enfermedad crítica, crónica o terminal.',
        'Bonos por referir clientes nuevos.',
        'Dividendos anuales garantizados.',
      ],
      correct: 1,
      explain: 'Los Living Benefits permiten al asegurado anticipar hasta el 80% de su cobertura en vida si es diagnosticado con enfermedad crítica, crónica o terminal.',
    },
    {
      type: 'truefalse',
      q: 'El IUL tiene un piso de 0% que protege el capital principal cuando el mercado baja.',
      options: ['Verdadero', 'Falso'],
      correct: 0,
      explain: 'Verdadero. El IUL tiene una garantía mínima (usualmente 0%) que protege el capital principal si el índice bursátil tiene un rendimiento negativo.',
    },
    {
      type: 'truefalse',
      q: 'El seguro de vida a Término (Term) acumula valor en efectivo que el cliente puede retirar.',
      options: ['Verdadero', 'Falso'],
      correct: 1,
      explain: 'Falso. El Término es una cobertura por un plazo específico (10, 20 o 30 años) y NO acumula valor en efectivo. Solo paga si el asegurado fallece dentro del plazo.',
    },
    {
      type: 'multiple',
      q: '¿Qué es un seguro de Gastos Finales?',
      options: [
        'Un plan de retiro para personas mayores de 65 años.',
        'Un seguro diseñado para cubrir gastos funerarios, deudas y facturas médicas al fallecer.',
        'Un seguro que solo cubre accidentes.',
        'Un préstamo que se paga al morir.',
      ],
      correct: 1,
      explain: 'Los Gastos Finales cubren costos funerarios, cremación, facturas médicas pendientes y pequeñas deudas — con un proceso de aprobación simplificado.',
    },
    {
      type: 'multiple',
      q: 'En un seguro de Gastos Finales MODIFICADO, si la persona fallece antes de los 2 años, ¿qué reciben los beneficiarios?',
      options: [
        'La cobertura completa como si fuera inmediato.',
        'Solo el 50% de la cobertura.',
        'Únicamente las primas pagadas más un 10%.',
        'Nada, la póliza se pierde.',
      ],
      correct: 2,
      explain: 'En Gastos Finales Modificado (graded), si el fallecimiento ocurre antes de los 2 años, los beneficiarios reciben solo las primas pagadas MÁS un 10%. La cobertura completa aplica después de 2 años.',
    },
    {
      type: 'multiple',
      q: '¿Qué es la "Prima" en un seguro?',
      options: [
        'La ganancia de la compañía de seguros.',
        'El aporte mensual, trimestral o anual que paga el asegurado.',
        'El monto total que reciben los beneficiarios.',
        'El impuesto sobre la póliza.',
      ],
      correct: 1,
      explain: 'La Prima es el aporte periódico (mensual, trimestral o anual) que paga el asegurado para mantener su póliza activa.',
    },
    {
      type: 'multiple',
      q: '¿Qué es el "Face Amount" de una póliza?',
      options: [
        'La edad del asegurado.',
        'El costo mensual de la prima.',
        'La cobertura con la que queda asegurada la persona.',
        'La comisión del agente.',
      ],
      correct: 2,
      explain: 'El Face Amount es el monto de cobertura de la póliza — lo que reciben los beneficiarios al fallecer el asegurado.',
    },
    {
      type: 'truefalse',
      q: 'Cuando una póliza "lapsa", significa que se canceló por falta de pago.',
      options: ['Verdadero', 'Falso'],
      correct: 0,
      explain: 'Verdadero. "Lapsar" es cuando la póliza termina por incumplimiento de pago de la prima.',
    },
    {
      type: 'scenario',
      q: 'ESCENARIO: Cliente de 55 años con diabetes tipo 2 no controlada busca protección para su familia. Quiere cobertura permanente. ¿Cuál es la MEJOR opción?',
      options: [
        'IUL con las mejores compañías (NLG, F&G).',
        'Término a 30 años en cualquier compañía.',
        'Gastos Finales — probablemente en su plan Garantizado (Corebridge) donde no hacen preguntas de salud.',
        'Esperar a que controle la diabetes antes de venderle algo.',
      ],
      correct: 2,
      explain: 'Con diabetes no controlada, la mayoría de carriers de IUL declinan. La opción real es Gastos Finales — y el plan Garantizado de Corebridge acepta clientes con condiciones no controladas sin preguntas de salud.',
    },
    {
      type: 'scenario',
      q: 'ESCENARIO: Cliente hispano sin SSN, solo tiene pasaporte. Quiere un IUL. ¿Qué compañía trabajamos que lo acepta?',
      options: [
        'F&G — ellos aceptan cualquier documento.',
        'Mutual of Omaha — es la más flexible.',
        'National Life Group — es la única que acepta pasaporte, matrícula consular y documentos internacionales.',
        'Ninguna, hay que esperar a que tenga SSN.',
      ],
      correct: 2,
      explain: 'National Life Group es la ÚNICA compañía que acepta pasaporte, matrícula consular y documentos del país natal. Es tu carta ganadora con clientes sin SSN/ITIN.',
    },
    {
      type: 'multiple',
      q: '¿Qué es un "Rider" en una póliza?',
      options: [
        'La firma del agente que vendió la póliza.',
        'Una cláusula adicional que se agrega para ampliar coberturas.',
        'El pago inicial que hace el cliente.',
        'El médico que revisa la aplicación.',
      ],
      correct: 1,
      explain: 'Un Rider es una cláusula adicional (opcional) que se agrega a la póliza para ampliar coberturas — por ejemplo, un rider de enfermedad terminal o de exención de primas.',
    },
  ],

  // =========================================================
  // MÓDULO 2 · ESTRUCTURA DEL GUION
  // =========================================================
  guion: [
    {
      type: 'multiple',
      q: '¿Cuál es el ORDEN CORRECTO de los primeros pasos del guion oficial?',
      options: [
        'Cierra → Explica el IUL → Saluda',
        'Saluda → Preséntate → Prueba social → Saca el dolor → Califica',
        'Califica → Saluda → Explica → Cierra',
        'Explica el IUL → Saluda → Cierra',
      ],
      correct: 1,
      explain: 'El orden es: 1) Saluda, 2) Preséntate, 3) Prueba social, 4) Saca el dolor, 5) Califica, 6) Explica el IUL, 7) Diseño de póliza, 8) Cierra, 9) Referidos.',
    },
    {
      type: 'multiple',
      q: 'En el paso "Prueba social", ¿qué porcentaje del ingreso mensual anclamos como referencia de aporte?',
      options: ['5%', '10% o más', '25%', 'El 50%'],
      correct: 1,
      explain: 'Se ancla en 10% o más del ingreso mensual. Esa es la referencia inicial para preguntar cuánto puede aportar sin afectar su estilo de vida.',
    },
    {
      type: 'multiple',
      q: 'En "Saca el dolor", cuando el cliente elige PROTEGER A LA FAMILIA, ¿qué haces primero?',
      options: [
        'Empezar a explicar el IUL de una vez.',
        'Hacer validación emocional y luego preguntas de dolor.',
        'Preguntar sobre su salud.',
        'Cerrar la venta rápido.',
      ],
      correct: 1,
      explain: 'Primero validación emocional ("Te entiendo, XXXX..."), después preguntas de dolor específicas para abrir esa emoción antes de mostrar la solución.',
    },
    {
      type: 'multiple',
      q: '¿Cuáles son las 3 rutas de "dolor" en el guion?',
      options: [
        'Corto plazo, mediano plazo y largo plazo.',
        'Familia, salud y retiro.',
        'Auto, casa y vida.',
        'Barato, medio y premium.',
      ],
      correct: 1,
      explain: 'Las 3 rutas del guion son: 1) Proteger a la familia, 2) Protegerse a sí mismo (accidente/enfermedad), 3) Asegurar su futuro (retiro).',
    },
    {
      type: 'multiple',
      q: 'En "Explica el IUL", ¿cuáles son los 3 beneficios clave que se presentan?',
      options: [
        'Descuento, garantía y comisión.',
        'Beneficio por fallecimiento, Living Benefits (en vida), y jubilación con interés compuesto.',
        'Solo la muerte, solo el retiro, y solo la salud.',
        'Ahorro, crédito e inversión.',
      ],
      correct: 1,
      explain: 'Los 3 beneficios son: 1) Beneficio por fallecimiento, 2) Living Benefits (anticipo del 80% en vida por enfermedad), 3) Retiro con interés compuesto y piso de cero.',
    },
    {
      type: 'multiple',
      q: 'En el paso "Diseño de póliza", ¿cuáles son las 2 opciones que se presentan?',
      options: [
        'Barata y cara.',
        '10 años y 30 años.',
        '50/50 (ahorro/protección) y 70/30 (más ahorro).',
        'Individual y familiar.',
      ],
      correct: 2,
      explain: 'Se presentan dos opciones: A) 50/50 — balanceado entre ahorro y protección, B) 70/30 — enfocado en acumular cash value.',
    },
    {
      type: 'truefalse',
      q: 'En el paso "Preséntate", debes SIEMPRE terminar con una pregunta.',
      options: ['Verdadero', 'Falso'],
      correct: 0,
      explain: 'Verdadero. En el guion se enfatiza: "termina siempre con una pregunta" (por ejemplo, "¿cómo se encuentra hoy?") para mantener la conversación fluyendo.',
    },
    {
      type: 'multiple',
      q: 'En el paso "Califica", ¿qué información legal debes levantar?',
      options: [
        'Solo su número de teléfono.',
        'Solo su historial médico.',
        'Estatus migratorio, licencia de conducir, DUI, felonías y casos pendientes en corte.',
        'Solo su historial de crédito.',
      ],
      correct: 2,
      explain: 'La calificación legal incluye: ciudadanía/residencia/ITIN/SSN, licencia de conducir, DUI, felonías y casos pendientes en corte. Todo esto afecta qué compañía puede calificar al cliente.',
    },
    {
      type: 'multiple',
      q: 'En el paso "Cierra", después de levantar los datos, ¿qué advertencia IMPORTANTE le das al cliente?',
      options: [
        'Que la comisión del agente es alta.',
        'Que NO aplique con otro asesor o compañía mientras la solicitud esté en proceso, para no rechazar el sistema.',
        'Que puede cancelar en cualquier momento sin problema.',
        'Que va a recibir muchas llamadas.',
      ],
      correct: 1,
      explain: 'La advertencia clave: NO aplicar con otro asesor o compañía mientras la solicitud esté en proceso. Aplicaciones duplicadas pueden hacer que el sistema rechace ambas.',
    },
    {
      type: 'multiple',
      q: 'En "Referidos", ¿cuántos nombres pides al cierre?',
      options: ['1 referido', '3 referidos', '10 referidos', 'No se piden referidos, es incómodo.'],
      correct: 1,
      explain: 'Se piden 3 referidos: nombre + teléfono + relación. Y siempre pedir permiso: "¿está bien si les digo que tú me diste su nombre?"',
    },
    {
      type: 'truefalse',
      q: 'Antes de compartir pantalla en el paso "Explica el IUL", debes enviar tus credenciales por mensaje.',
      options: ['Verdadero', 'Falso'],
      correct: 0,
      explain: 'Verdadero. Antes de mostrar el IUL, envías tus credenciales por mensaje de texto para que el cliente tenga tranquilidad de saber quién eres.',
    },
    {
      type: 'multiple',
      q: 'Si en "Preséntate" el cliente responde "no recuerdo" cuando le preguntas qué le gustó del IUL, ¿qué haces?',
      options: [
        'Colgar, es un lead frío perdido.',
        'Enojarte y presionarlo.',
        'Recordarle las 3 opciones (interés compuesto, protección familiar, reemplazo de ingresos) y preguntarle cuál le llamó la atención.',
        'Empezar a vender directamente.',
      ],
      correct: 2,
      explain: 'Se le recuerda con calma: "parece que lo viste en nuestras redes sociales como posiblemente podemos ayudarte a hacer crecer tu dinero con interés compuesto, o cómo proteger a tu familia... ¿cuál de esas tres opciones cree que le llamó la atención?"',
    },
    {
      type: 'scenario',
      q: 'ESCENARIO: Estás en el paso "Explica el IUL" y notas que el cliente dejó de responder. ¿Qué haces?',
      options: [
        'Sigues hablando sin parar hasta terminar.',
        'Le preguntas si en algún momento deja de ver lo que le estás mostrando por favor te lo diga.',
        'Le cuelgas para no perder tiempo.',
        'Te ofendes y le pides una disculpa.',
      ],
      correct: 1,
      explain: 'Al empezar el paso "Explica el IUL" debes decirle: "si en algún momento dejas de ver lo que te estoy mostrando por favor me dejas saber". Esto mantiene la conexión activa.',
    },
    {
      type: 'multiple',
      q: 'En "Califica" preguntas sobre la salud del cliente. ¿Qué condiciones importantes MÍNIMO debes preguntar?',
      options: [
        'Solo si toma café.',
        'Diabetes, presión alta, colesterol, historial de cáncer, stroke, tiroides, y peso/altura.',
        'Solo su edad.',
        'Solo si fuma.',
      ],
      correct: 1,
      explain: 'Debes recorrer TODA la lista: diabetes, presión, colesterol, infartos, stroke, VIH, tiroides, cáncer, riñón/hígado, peso, altura, tabaco, medicamentos y cirugías recientes.',
    },
    {
      type: 'scenario',
      q: 'ESCENARIO: Cliente dice "necesito consultar con mi pareja". ¿En qué paso del guion detectaste esto y qué haces?',
      options: [
        'Lo ignoras y sigues con el cierre.',
        'Debiste preguntarlo en "Califica" ("tomas decisiones sola o necesitas que tu pareja esté contigo?"). Si aparece ahora, agendas una segunda cita con ambos.',
        'Le vendes solo la mitad del monto.',
        'Le cuelgas.',
      ],
      correct: 1,
      explain: 'Esta pregunta se hace en el paso "Califica" precisamente para saber quién toma la decisión. Si aparece al cierre, agendas una nueva llamada donde estén ambos presentes.',
    },
  ],

  // =========================================================
  // MÓDULO 3 · MANEJO DE OBJECIONES
  // =========================================================
  objeciones: [
    {
      type: 'scenario',
      q: 'CLIENTE: "No tengo dinero." ¿Cuál es la MEJOR respuesta?',
      options: [
        '"Entonces adiós, hablamos cuando tengas."',
        '"Entiendo cómo te sientes, muchas personas nos han dicho lo mismo. Esta estrategia justamente ayuda a organizar las finanzas sin grandes inversiones. ¿Puedo mostrarte cómo funciona?"',
        '"Todos tenemos dinero para lo que queremos."',
        '"Igual apliquemos, después vemos."',
      ],
      correct: 1,
      explain: 'La respuesta correcta valida su sentimiento, presenta prueba social ("muchas personas nos han dicho lo mismo"), reencuadra la solución y pide permiso para continuar.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Necesito pensarlo." ¿Cuál es la respuesta CORRECTA?',
      options: [
        '"¿Qué parte necesitas pensar exactamente: si esto funciona, si es el momento, o si puedes comprometerte?"',
        '"Ok, llamame cuando lo hayas pensado."',
        '"Piénsalo pero recuerda que sube el precio mañana."',
        '"No pienses tanto, decide ya."',
      ],
      correct: 0,
      explain: 'La técnica es aislar la objeción real. Preguntar qué específicamente necesita pensar te ayuda a dar la información correcta que necesita para decidir.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Tengo que hablar con mi pareja." ¿Qué haces?',
      options: [
        'Le vendes de todos modos porque él es el que decide.',
        'Le dices que su pareja no tiene por qué opinar.',
        'Le dices "Eso tiene sentido. Agendemos una llamada breve donde estén los dos presentes, así pueden preguntar y decidir juntos sin presión."',
        'Cuelgas y te olvidas del cliente.',
      ],
      correct: 2,
      explain: 'Se agenda una segunda cita con ambos presentes. Es más responsable, muestra respeto y aumenta la probabilidad de cierre.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "No tengo ITIN ni Seguro Social." ¿Qué le respondes?',
      options: [
        '"Entonces no hay nada que podamos hacer."',
        '"Tenemos soluciones específicamente diseñadas para personas sin estatus legal. Lo importante es proteger a tu familia sin importar los papeles. ¿Te gustaría ver cómo lo hacen muchas personas en tu misma situación?"',
        '"Consigue tu ITIN primero y volvemos a hablar."',
        '"Es imposible que califiques."',
      ],
      correct: 1,
      explain: 'Trabajamos con National Life Group que acepta pasaporte, matrícula consular y documentos internacionales. NUNCA rechaces un cliente por no tener SSN.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Esto es muy caro." ¿Cuál es la respuesta CORRECTA?',
      options: [
        '"Entonces olvídate, no es para ti."',
        '"La mayoría de las personas se sorprenden cuando ven que pueden empezar desde $1 al día. ¿Quieres que te muestre opciones reales para que decidas con base en números, no en suposiciones?"',
        '"Sí, es caro, pero vale la pena."',
        '"Te lo bajo a la mitad si aplicas hoy."',
      ],
      correct: 1,
      explain: 'Se reencuadra el precio (desde $1 al día) y se ofrece ver números reales. NUNCA prometas descuentos que no puedes cumplir.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "¿Cuánto vas a ganar tú?" ¿Cómo respondes?',
      options: [
        '"Eso no es asunto tuyo."',
        '"Gano una comisión, claro, como cualquier profesional, pero solo si te ayudo a encontrar una solución que tú apruebes. Aquí tú decides. Mi meta es educarte, no venderte."',
        '"Nada, esto es sin costo para mí."',
        '"Mucho dinero, por eso te ofrezco esto."',
      ],
      correct: 1,
      explain: 'Transparencia y honestidad. Reconoce la comisión pero enfatiza que tu meta es educar. La verdad genera confianza; ocultar la comisión la destruye.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Ya intenté antes y no me aprobaron." ¿Qué respondes?',
      options: [
        '"Entonces olvídalo."',
        '"Eso le pasa a muchas personas. Por eso ahora trabajamos con múltiples compañías, para encontrar la que sí te acepte. ¿Te parece si lo intentamos otra vez con mejor estrategia?"',
        '"Debes ser un caso muy grave."',
        '"Prueba en 2 años cuando cambien las reglas."',
      ],
      correct: 1,
      explain: 'Trabajamos con 8 compañías con criterios muy distintos. Un decline en una NO significa decline en otra. El Matcher te ayuda a encontrar la compañía correcta.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "No creo en los seguros." ¿Qué respondes?',
      options: [
        '"Yo tampoco, la verdad."',
        '"Muchos dicen eso… hasta que ven lo que pasa cuando alguien no lo tiene. Esto no es un gasto, es una estrategia financiera que puedes usar en vida. ¿Te muestro cómo lo usan familias como la tuya?"',
        '"Pues es tu problema."',
        '"Los seguros son una estafa, tienes razón, pero este no."',
      ],
      correct: 1,
      explain: 'Valida la creencia, reencuadra el seguro como "estrategia financiera" (no gasto) que puede usar EN VIDA, y pide permiso para mostrar casos reales.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Soy joven, tengo tiempo." ¿Cómo respondes?',
      options: [
        '"Sí, mejor esperemos a que tengas 40 años."',
        '"Y por eso es el mejor momento. Cuanto más joven, más barato y más tiempo para acumular beneficios. ¿Te gustaría asegurar esa ventaja ahora?"',
        '"Nadie te asegura que vas a llegar a viejo."',
        '"Los jóvenes no necesitan seguros."',
      ],
      correct: 1,
      explain: 'Reencuadra la juventud como VENTAJA — primas más bajas y mayor acumulación de valor en efectivo. Nunca uses el miedo a la muerte como táctica de venta con jóvenes.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "No sé si puedo mantener los pagos." ¿Cómo respondes?',
      options: [
        '"Entonces no lo compres."',
        '"Te entiendo. Por eso buscamos una solución que se ajuste a lo que ya manejas mes a mes. Hay opciones más accesibles de lo que imaginas."',
        '"Si dejas de pagar te embargamos."',
        '"Compra el más grande y te aguantas."',
      ],
      correct: 1,
      explain: 'Se valida y se ofrece flexibilidad. Vender algo que el cliente NO puede pagar termina en lapsos y clientes molestos. Prima adecuada > prima grande.',
    },
    {
      type: 'multiple',
      q: 'Al manejar una objeción, ¿cuál es el PRIMER paso siempre?',
      options: [
        'Contradecir al cliente inmediatamente.',
        'Validar el sentimiento del cliente ("te entiendo", "muchas personas dicen lo mismo").',
        'Ofrecer un descuento.',
        'Amenazar con perder la oportunidad.',
      ],
      correct: 1,
      explain: 'SIEMPRE validar primero. Nunca hagas sentir mal al cliente por su objeción. La validación baja las defensas y abre la puerta a la conversación real.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "¿Y si pierdo el trabajo?" ¿Qué respondes?',
      options: [
        '"Entonces te embargamos la casa."',
        '"Buena pregunta. La mayoría de las pólizas tienen opciones de flexibilidad si eso sucede. Además, mientras trabajas puedes calificar y asegurar tu tarifa baja."',
        '"Pues no compres el seguro."',
        '"Nunca vas a perder el trabajo."',
      ],
      correct: 1,
      explain: 'Se valida la preocupación real, se explica que hay flexibilidad, y se enfatiza que calificar AHORA (mientras hay trabajo) asegura tarifas más bajas para siempre.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "Ya tengo un seguro." ¿Cómo respondes?',
      options: [
        '"Entonces olvídalo, no puedo hacer nada."',
        '"¡Excelente! Significa que ya valoras la protección. ¿Puedo hacerte una pregunta? ¿Tu póliza actual acumula valor en efectivo que puedas usar en vida, libre de impuestos?"',
        '"El que tienes no sirve."',
        '"Cámbiate al mío que es mejor."',
      ],
      correct: 1,
      explain: 'Reconoce que ya valora la protección, y hace UNA pregunta clave: ¿acumula valor en efectivo libre de impuestos? Esto abre la conversación sobre IUL sin descalificar su póliza actual.',
    },
    {
      type: 'truefalse',
      q: 'Cuando un cliente objeta, hay que insistir hasta que compre.',
      options: ['Verdadero', 'Falso'],
      correct: 1,
      explain: 'Falso. Manejar objeciones NO es presionar. Es entender la objeción real, resolverla con información y dejar que el cliente decida. La presión destruye la confianza.',
    },
    {
      type: 'scenario',
      q: 'CLIENTE: "No quiero hablar con un vendedor." ¿Qué respondes?',
      options: [
        '"Entonces adiós."',
        '"Yo no soy vendedor, soy educador financiero. Mi trabajo es ayudarte a entender si esto es para ti. Tú decides."',
        '"Pero tienes que hablar conmigo."',
        '"Todos somos vendedores en la vida."',
      ],
      correct: 1,
      explain: 'Reencuadra tu rol como "educador financiero" — que es lo que realmente eres cuando das información clara. La palabra "vendedor" genera desconfianza; "educador" genera apertura.',
    },
  ],
};
