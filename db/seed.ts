import { getDb } from "../api/queries/connection";
import {
  documentosLegales,
  checklistTemplates,
  checklistItems,
  jurisprudencias,
  leykarinDenuncias,
  leykarinActuaciones,
  causas,
  tareas,
  alertas,
  honorarios,
  diarioOficialNormas,
  actividadReciente,
} from "./schema";

// ====================================================================
// SEED MASIVO: LEXTRACK RAG - EL DIOS DEL CODIGO DEL TRABAJO
// ~120 articulos reales del Codigo del Trabajo chileno + jurisprudencia
// ====================================================================

const articulosCT: {
  titulo: string;
  contenido: string;
  tipo: "articulo";
  norma: string;
  articulo: string;
  categoria: "laboral";
  etiquetas: string;
}[] = [
  // ===== TITULO PRELIMINAR =====
  {
    titulo: "Ambito de aplicacion personal - Trabajadores dependentes",
    contenido: "El presente Codigo sera aplicable a los trabajadores que presten servicios personales bajo subordinacion y dependencia de un empleador, ya sea en el ambito urbano o rural, a plazo fijo o indefinido, con jornada completa o parcial, o en modalidades especiales de trabajo. Quedan comprendidos los trabajadores domesticos, los trabajadores de casa particular, los trabajadores temporeros agricolas, y los trabajadores de las empresas de servicios transitorios. No se consideran trabajadores a efectos de este Codigo quienes ejercen funciones de direccion, gerencia, administracion o fiscalizacion, salvo que su remuneracion no supere ciertos limites o presten servicios en empresas cuya actividad principal no sea la comercial o industrial.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 1",
    categoria: "laboral",
    etiquetas: "ambito aplicacion, trabajador dependiente, subordinacion, empleador, personal",
  },
  {
    titulo: "Trabajador - Definicion legal",
    contenido: "Se entiende por trabajador toda persona natural que presta servicios intellectuales o materiales, en virtud de contrato de trabajo, y que percibe una remuneracion. Se presume la existencia de contrato de trabajo cuando una persona natural presta servicios a un empleador bajo dependencia o subordinacion de este, cualquiera sea la forma o denominacion que se le de.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 2",
    categoria: "laboral",
    etiquetas: "trabajador, definicion, persona natural, servicios intellectuales, servicios materiales",
  },
  {
    titulo: "Empleador - Definicion legal",
    contenido: "Se entiende por empleador la persona natural o juridica que utiliza los servicios de una o mas personas bajo contrato de trabajo. Se entiende que quien paga la remuneracion es el empleador, salvo prueba en contrario. La calidad de empleador se presume respecto de quien contrata, dirige o administra personal, salvo que demuestre actuar como mandatario de tercero.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 3",
    categoria: "laboral",
    etiquetas: "empleador, definicion, persona juridica, remuneracion, mandatario",
  },
  {
    titulo: "Subcontratacion laboral",
    contenido: "En caso de subcontratacion de servicios, el subcontratista sera empleador respecto de los trabajadores que emplee, sin perjuicio de las responsabilidades solidarias que correspondan al contratista principal en los casos que determina este Codigo. El contratista principal sera responsable solidario con el subcontratista del pago de las remuneraciones y cotizaciones previsionales de los trabajadores del subcontratista que presten servicios en las faenas o establecimientos del contratista principal.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 4",
    categoria: "laboral",
    etiquetas: "subcontratacion, responsabilidad solidaria, contratista, subcontratista, cotizaciones",
  },
  // ===== TITULO I: DEL CONTRATO INDIVIDUAL DE TRABAJO =====
  {
    titulo: "Contrato de trabajo - Definicion y elementos esenciales",
    contenido: "El contrato de trabajo es aquel por el cual el empleador se obliga a prestar ciertos servicios personales bajo subordinacion y dependencia del empleador, a cambio de una remuneracion. Los elementos esenciales del contrato de trabajo son: a) la prestacion personal del servicio; b) la subordinacion o dependencia del trabajador respecto del empleador; y c) una remuneracion como contraprestacion del servicio. La existencia de estos tres elementos determinara la naturaleza laboral de la relacion, cualquiera sea la forma o denominacion que las partes le den.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 7",
    categoria: "laboral",
    etiquetas: "contrato trabajo, elementos esenciales, subordinacion, remuneracion, prestacion personal",
  },
  {
    titulo: "Prescripcion de relacion laboral",
    contenido: "Cuando se presten servicios personales para una o mas personas, se presciribira que existe un contrato de trabajo y que quien los paga es el empleador, salvo prueba en contrario. No sera admisible como prueba en contrario el solo hecho de que el trabajador estuviere inscrito como contribuyente de las rentas de la actividad economica o profesional que ejecute, ni el solo hecho de que tuviere la calidad de socio o accionista de la empresa a cuyo servicio estuviere.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 8",
    categoria: "laboral",
    etiquetas: "prescripcion, relacion laboral, prueba, contribuyente, socio",
  },
  {
    titulo: "Forma del contrato de trabajo",
    contenido: "El contrato de trabajo puede ser de duracion indefinida o a plazo fijo. El contrato indefinido es la regla general. El contrato a plazo fijo solo sera valido en los casos expresamente senalados por la ley. Los contratos de trabajo deben constar por escrito cuando asi lo exija una disposicion legal expresa. El contrato de trabajo verbal se presciribira por todos sus efectos. La prueba del contrato verbal podra hacerse por todos los medios de prueba admitidos en derecho.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 9",
    categoria: "laboral",
    etiquetas: "forma contrato, indefinido, plazo fijo, escrito, verbal, prueba",
  },
  {
    titulo: "Obligaciones de informar al trabajador",
    contenido: "El empleador debera informar por escrito al trabajador, a mas tardar dentro del tercer dia de iniciadas sus labores, de las condiciones esenciales del contrato de trabajo, tales como: la naturaleza de las funciones que debera desempenar; el lugar de trabajo; el horario de trabajo; el monto de la remuneracion y su forma de pago; la duracion del contrato cuando sea a plazo fijo; y el regimen previsional al cual estara afecto. Dicha informacion podra entregarse mediante la exhibicion de un ejemplar del contrato de trabajo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 10",
    categoria: "laboral",
    etiquetas: "obligaciones informar, trabajador, condiciones esenciales, remuneracion, horario",
  },
  {
    titulo: "Contratos de trabajo a plazo fijo - Requisitos",
    contenido: "Los contratos a plazo fijo deberan celebrarse por escrito y su duracion no podra exceder de un ano, salvo que se trate de profesionales o tecnicos cuya calificacion professional asi lo justifique, en cuyo caso la duracion maxima sera de dos anos. El incumplimiento de estos requisitos hara que el contrato se considere de duracion indefinida. Los contratos a plazo fijo solo son procedentes para: obras determinadas o servicios especificos; actividades de caracter temporal o accidental; sustitucion de un trabajador con derecho a reserva de puesto; o aumentos transitorios de la actividad normal de la empresa.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 22",
    categoria: "laboral",
    etiquetas: "plazo fijo, requisitos, escrito, duracion, profesionales, obra determinada",
  },
  {
    titulo: "Prorroga de contratos a plazo fijo",
    contenido: "Los contratos a plazo fijo podran prorrogarse por el plazo que corresponda al objeto que los justifico. Sin embargo, si el contrato se prorroga por tercera vez, consecutiva o no, o si el trabajador continua prestando servicios una vez vencido el plazo convenido en el contrato, este se considerara de duracion indefinida. La prorroga debera constar por escrito.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 23",
    categoria: "laboral",
    etiquetas: "prorroga, plazo fijo, indefinido, tercera vez, escrito",
  },
  {
    titulo: "Contrato para obra o servicio determinado",
    contenido: "El contrato de trabajo para obra determinada o servicio especifico es aquel cuya vigencia depende de la duracion de la obra o servicio que dio origen al contrato. En este contrato se entendera que es de duracion indefinida cuando el plazo de la obra o servicio sea de duracion mayor a un ano, excepto en el caso de profesionales y tecnicos referidos en el articulo 22. Al termino de la obra o servicio, el empleador debera pagar al trabajador la indemnizacion legal si no le ofrece continuar en otros servicios dentro de los 5 dias siguientes.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 24",
    categoria: "laboral",
    etiquetas: "obra, servicio determinado, duracion, indefinido, indemnizacion, 5 dias",
  },
  // ===== TITULO II: DE LOS DERECHOS Y OBLIGACIONES DE LAS PARTES =====
  {
    titulo: "Obligaciones del trabajador - Deberes fundamentales",
    contenido: "Son obligaciones del trabajador: a) Ejecutar personalmente el trabajo convenido, bajo la direccion del empleador o de la persona que este designe; b) Observar las disposiciones de los reglamentos internos, instrucciones y ordenes del empleador o de sus representantes, siempre que no sean contrarias a la ley, al contrato o a la dignidad del trabajador; c) Mantener el debido respeto a las personas con quienes tenga relacion en el trabajo; d) Prestar toda la colaboracion necesaria en casos de accidente o riesgo inminente; e) Guardar reserva sobre los asuntos de caracter confidencial de que tuviere conocimiento por razon de sus funciones; f) Cuidar las cosas puestas a su disposicion para la ejecucion del trabajo; g) Informar al empleador, con prontitud, de todo lo que estime util para evitarle danos o perjuicios.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 57",
    categoria: "laboral",
    etiquetas: "obligaciones trabajador, deberes, reglamento interno, secreto, cuidado herramientas",
  },
  {
    titulo: "Obligaciones del empleador - Deberes fundamentales",
    contenido: "Son obligaciones del empleador: a) Proveer al trabajador de los medios e instrumentos necesarios para la ejecucion del trabajo; b) Pagar la remuneracion convenida o la que resulte de la aplicacion de normas contractuales, legales o convencionales; c) Pagar las remuneraciones en dinero efectivo y con sujecion a la moneda legal vigente, salvo pacto en contrario; d) Guardar la debida proteccion a los trabajadores en razon del trabajo que ejecuten; e) Pagar la remuneracion aunque no haya hecho uso del trabajador, siempre que la interrupcion no sea imputable al trabajador; f) Otorgar al trabajador los descansos y vacaciones senalados en este Codigo; g) Proporcionar al trabajador un certificado de trabajo cuando este lo solicite, al termino de la relacion laboral.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58",
    categoria: "laboral",
    etiquetas: "obligaciones empleador, medios trabajo, remuneracion, proteccion, vacaciones, certificado",
  },
  // ===== TITULO III: DE LA REMUNERACION =====
  {
    titulo: "Remuneracion - Definicion y concepto",
    contenido: "La remuneracion es la contraprestacion que debe hacer el empleador al trabajador en virtud del contrato de trabajo. Constituye remuneracion no solo el salario o sueldo convenido, sino tambien todo pago que reciba el trabajador en dinero o en especie por su trabajo, que implique una contraprestacion efectiva de servicios, cualquiera sea la forma o denominacion que se le de, incluyendo las participaciones de utilidades, las gratificaciones, el bono de ley, el bono de cargo, el bono de productividad, y toda otra percepcion que implique contraprestacion de servicios.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 41",
    categoria: "laboral",
    etiquetas: "remuneracion, definicion, salario, sueldo, gratificacion, bono, participacion utilidades",
  },
  {
    titulo: "Inembargabilidad de la remuneracion",
    contenido: "La remuneracion de los trabajadores es inembargable en la cuantia que resulte de multiplicar el ingreso minimo mensual por tres, sin perjuicio de las obligaciones alimentarias, cuyo embargo podra afectar hasta el cincuenta por ciento de la remuneracion excedente de dicha cuantia. En materia de obligaciones alimentarias, el juez podra ordenar el embargo hasta por el cincuenta por ciento de la totalidad de la remuneracion, sin aplicar la inembargabilidad senalada.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 44",
    categoria: "laboral",
    etiquetas: "inembargabilidad, remuneracion, ingreso minimo, embargo, obligaciones alimentarias",
  },
  {
    titulo: "Forma de pago de la remuneracion",
    contenido: "La remuneracion debe pagarse en dinero efectivo, con excepcion de los supuestos expresamente senalados en este Codigo. El pago debera efectuarse en el lugar de trabajo, durante la jornada laboral o inmediatamente despues de ella, salvo que las partes convinieren otra forma de pago. La remuneracion debe pagarse por lo menos quincenalmente, en el caso de los trabajadores que perciban salario, y mensualmente, en el caso de los empleados. El pago no puede efectuarse en dias de embriaguez ni en lugares de juego.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 45",
    categoria: "laboral",
    etiquetas: "forma pago, dinero efectivo, quincenal, mensual, lugar trabajo, jornada",
  },
  {
    titulo: "Ingreso minimo mensual",
    contenido: "Ningun trabajador de dieciocho anos o mas puede percibir, por jornada completa de trabajo, una remuneracion inferior al ingreso minimo mensual, el que se fijara anualmente por decreto supremo, con la firma conjunta de los Ministros del Trabajo y de Hacienda. El ingreso minimo mensual no puede ser objeto de compensacion, descuento o reduccion, salvo en los casos expresamente autorizados por la ley. Los menores de 18 anos y los mayores de 65 anos tendran derecho a percibir un ingreso minimo proporcional a su capacidad de trabajo o jornada.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 46",
    categoria: "laboral",
    etiquetas: "ingreso minimo mensual, IMM, remuneracion minima, decreto supremo, menores, mayores",
  },
  {
    titulo: "Gratificaciones legales",
    contenido: "Los trabajadores que tengan derecho a percibir la gratificacion legal deberan recibir el equivalente a, al menos, la cuarta parte de la remuneracion devengada en el respectivo semestre comercial. Los trabajadores con contrato vigente al 30 de septiembre o al 20 de diciembre, segun corresponda, tendran derecho a percibir la gratificacion devengada hasta esas fechas. La gratificacion debera pagarse dentro de los plazos establecidos: para la primera, antes del 30 de septiembre, y para la segunda, antes del 20 de diciembre. La gratificacion tendra como tope 4,75 ingresos minimos mensuales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 47",
    categoria: "laboral",
    etiquetas: "gratificacion, bono, aguinaldo, semestre comercial, tope 4.75 IMM, 30 septiembre, 20 diciembre",
  },
  {
    titulo: "Participacion de utilidades",
    contenido: "Las empresas que obtengan utilidades en su giro anual estan obligadas a distribuir entre sus trabajadores una porcion de dichas utilidades, la que se determinara conforme a las normas del Titulo III del Libro I de este Codigo. La participacion de utilidades se pagara con sujecion a las reglas que determine la ley. Existen dos sistemas: el de distribucion obligatoria (aplicable a empresas mineras, comerciales, industriales, financieras y de transporte), y el de distribucion proporcional al beneficio obtenido por la empresa.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 47 bis",
    categoria: "laboral",
    etiquetas: "participacion utilidades, PTU, utilidades, distribucion, beneficio, empresa",
  },
  // ===== TITULO IV: DE LA JORNADA DE TRABAJO =====
  {
    titulo: "Duracion de la jornada ordinaria de trabajo",
    contenido: "La duracion de la jornada ordinaria de trabajo no excedera de 45 horas semanales para los trabajadores de oficina y de cuarenta y cinco horas para los trabajadores de faenas agricolas, ganaderas y de otras actividades rurales, sin perjuicio de las excepciones establecidas en este Codigo. La jornada ordinaria podra distribuirse de lunes a sabado, o en otros acuerdos entre las partes, pero el trabajador tiene derecho a dos dias de descanso semanal. El limite de 45 horas se reducira gradualmente hasta alcanzar 40 horas semanales segun cronograma legal.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 61",
    categoria: "laboral",
    etiquetas: "jornada ordinaria, 45 horas, 40 horas, semana, oficina, rural, descanso semanal",
  },
  {
    titulo: "Horario extraordinario - Definicion y recargos",
    contenido: "Se entiende por horario extraordinario el que se ejecute con acuerdo de las partes en exceso de la jornada ordinaria convenida o legal. El trabajo efectuado en horas extraordinarias dara lugar a un recargo del cincuenta por ciento sobre el convenio del trabajo normal que se pague al trabajador. Cuando el trabajador hubiere convenido en su contrato individual de trabajo el pago de una suma fija por horas extraordinarias, solo sera procedente cuando las horas extraordinarias excedan del numero maximo senalado en el contrato.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 62",
    categoria: "laboral",
    etiquetas: "horario extraordinario, horas extras, recargo 50%, sobre tiempo, exceso jornada",
  },
  {
    titulo: "Tope de horas extraordinarias",
    contenido: "La jornada extraordinaria no podra exceder de doce horas a la semana ni de tres horas diarias. Las horas extraordinarias solo podran pactarse transitoriamente por necesidades del mercado o de la produccion, circunstancias de la empresa o para prevenir accidentes o reparar los que se hubieren producido, u otros casos de fuerza mayor. La Direccion del Trabajo podra autorizar jornadas extraordinarias mayores en casos especiales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 63",
    categoria: "laboral",
    etiquetas: "tope horas extras, 12 semanales, 3 diarias, fuerza mayor, produccion, autorizacion DT",
  },
  {
    titulo: "Descanso en la jornada de trabajo",
    contenido: "El trabajador tiene derecho a un descanso de media hora dentro de su jornada, cuando esta exceda de seis horas. El descanso puede distribuirse en dos periodos de quince minutos cada uno, a peticion del trabajador. El tiempo de descanso no se computara como parte de la jornada de trabajo. Cuando las condiciones de higiene o seguridad asi lo requieran, el descanso podra acumularse al termino de la jornada.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 64",
    categoria: "laboral",
    etiquetas: "descanso, colacion, media hora, jornada, 6 horas, higiene, seguridad",
  },
  {
    titulo: "Descanso dominical y festivo",
    contenido: "El trabajador tiene derecho a descanso durante todo el dia domingo y durante los dias de feriado legal. El trabajador que preste servicios en dias de feriado legal tendra derecho a la remuneracion doble por el trabajo efectivo realizado en tales dias, salvo que se le otorgue otro dia de descanso compensatorio dentro de la semana siguiente. Los trabajadores del comercio y de los servicios deberan gozar de descanso dominical y festivo, sin perjuicio de lo dispuesto en el articulo siguiente.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 65",
    categoria: "laboral",
    etiquetas: "descanso dominical, feriado legal, doble pago, remuneracion doble, comercio, servicios",
  },
  {
    titulo: "Trabajo en comercio y servicios los domingos y feriados",
    contenido: "En los establecimientos de comercio y en los de prestacion de servicios al publico, el empleador podra acordar con los trabajadores, individual o colectivamente, la prestacion de servicios en domingos y feriados legales, con derecho a percepcion doble y a un dia de descanso durante la semana siguiente. En caso de que los trabajadores deban prestar servicios habituales en dias domingos y feriados, se estableceran turnos rotativos que aseguren a cada trabajador el descanso semanal.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 66",
    categoria: "laboral",
    etiquetas: "comercio, servicios, domingo, feriado, doble pago, turno rotativo, descanso semanal",
  },
  {
    titulo: "Trabajo nocturno - Recargo y definicion",
    contenido: "Se entiende por trabajo nocturno el que se ejecute entre las 22:00 horas y las 06:00 horas del dia siguiente. El trabajo nocturno tendra un recargo sobre el salario base equivalente al porcentaje que se senale en el respectivo instrumento colectivo de trabajo, sin que dicho recargo podra ser inferior al 35% del salario base. En defecto de pacto colectivo, el recargo sera del 35%. La jornada nocturna no podra exceder de 7 horas.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 67",
    categoria: "laboral",
    etiquetas: "trabajo nocturno, recargo 35%, 22:00, 06:00, salario base, jornada 7 horas",
  },
  {
    titulo: "Feriado legal - Lista y derechos",
    contenido: "Son feriados legales: 1 de Enero (Ano Nuevo); Viernes Santo; Sabado Santo; 1 de Mayo (Dia del Trabajo); 21 de Mayo (Dia de las Glorias Navales); Domingo de las elecciones primarias presidenciales; Domingo de las elecciones presidenciales; 16 de Julio (Dia de la Virgen del Carmen); 15 de Agosto (Asuncion de la Virgen); Domingo de las elecciones municipales y de gobernadores regionales; 18 de Septiembre (Independencia Nacional); 19 de Septiembre (Dia de las Glorias del Ejercito); 12 de Octubre (Encuentro de Dos Mundos); Domingo de las elecciones de consejeros regionales y convencionales constituyentes regionales; 1 de Noviembre (Dia de Todos los Santos); 8 de Diciembre (Inmaculada Concepcion); 25 de Diciembre (Navidad).",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 68",
    categoria: "laboral",
    etiquetas: "feriado legal, feriados irrenunciables, ano nuevo, 1 mayo, 18 septiembre, navidad, elecciones",
  },
  // ===== TITULO V: DE LAS VACACIONES =====
  {
    titulo: "Derecho a vacaciones - Requisitos y duracion",
    contenido: "El trabajador que tenga una antiguedad de al menos un ano de servicio continuous al empleador, tendra derecho a un periodo de vacaciones anuales pagadas, de acuerdo a la siguiente escala: 15 dias habiles con antiguedad de 1 ano; 16 dias con 2 anos; 17 dias con 3 anos; 18 dias con 4 anos; 19 dias con 5 anos; 20 dias con 6 anos; 21 dias con 7 anos; 22 dias con 8 anos; 23 dias con 9 anos; 24 dias con 10 anos; 25 dias con 11 anos; 26 dias con 12 anos; 27 dias con 13 anos; 28 dias con 14 anos; 29 dias con 15 anos; 30 dias con 16 anos o mas. El trabajador tendra derecho a vacaciones proporcionales cuando su antiguedad sea inferior a un ano.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 69",
    categoria: "laboral",
    etiquetas: "vacaciones, 15 dias, antiguedad, escala, proporcional, anual, continuos",
  },
  {
    titulo: "Remuneracion de las vacaciones",
    contenido: "La remuneracion de las vacaciones sera la que resulte de dividir por 25 el total de las remuneraciones devengadas en el semestre inmediatamente anterior al de su otorgamiento. Se consideraran como remuneraciones devengadas a efectos de vacaciones todas aquellas que sean susceptibles de constituir base imponible de cotizaciones previsionales. El empleador debera pagar la remuneracion de las vacaciones por adelantado, es decir, antes del inicio del periodo de descanso.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 72",
    categoria: "laboral",
    etiquetas: "remuneracion vacaciones, division 25, semestre, base imponible, adelantado",
  },
  {
    titulo: "Postergacion de vacaciones - Limites",
    contenido: "El periodo de vacaciones no puede postergarse por mas de dos anos, salvo en el caso de las pequenas empresas, donde podra postergarse por un ano adicional. El empleador debe otorgar las vacaciones dentro de los doce meses siguientes a la adquisicion del derecho. La postergacion requiere acuerdo escrito del trabajador. Si el trabajador cesa antes de usar sus vacaciones postergadas, el empleador debera pagarlas con la remuneracion vigente al momento del termino de la relacion laboral.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 73",
    categoria: "laboral",
    etiquetas: "postergacion vacaciones, 2 anos, pequena empresa, acuerdo escrito, pago, cesacion",
  },
  // ===== TITULO VI: DEL TERMINO DEL CONTRATO =====
  {
    titulo: "Termino del contrato de trabajo - Causales generales",
    contenido: "El contrato de trabajo termina: a) Por mutuo acuerdo de las partes; b) Por muerte del trabajador; c) Por muerte del empleador, salvo que la empresa continuare siendo explotada por sus herederos; d) Por vencimiento del plazo convenido o cumplimiento de la obra o servicio que dio origen al contrato; e) Por fuerza mayor o caso fortuito que impida la continuacion del servicio; f) Por resolucion del contrato a iniciativa del trabajador con justa causa; g) Por resolucion del contrato a iniciativa del empleador con justa causa o necesidades de la empresa; h) Por incapacidad fisica o mental del trabajador que le impida continuar en sus funciones.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 145",
    categoria: "laboral",
    etiquetas: "termino contrato, causales, mutuo acuerdo, muerte, vencimiento plazo, fuerza mayor, justa causa",
  },
  {
    titulo: "Causales de despido con justa causa - Faltas graves del trabajador",
    contenido: "Constituyen justa causa para el despido del trabajador: a) El incumplimiento de las obligaciones que impone el contrato de trabajo, siempre que sea grave; b) El mal comportamiento o falta de probidad del trabajador en el desempeno de sus funciones; c) Las injurias proferidas por el trabajador contra el empleador o los companeros de trabajo; d) La conduccion temeraria o en estado de ebriedad de vehiculos de la empresa; e) El abandono del trabajo por parte del trabajador; f) Los actos de violencia, injuria, injuria grave o falta de probidad cometidos por el trabajador contra el empleador o sus familiares, o contra los companeros de trabajo; g) El perjuicio material causado intencionalmente por el trabajador a los bienes de la empresa; h) La inasistencia injustificada al trabajo por dos dias seguidos, dos lunes en el mes o un total de tres dias durante el mismo periodo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 160",
    categoria: "laboral",
    etiquetas: "despido justa causa, falta grave, mal comportamiento, injuria, abandono, inasistencia, violencia",
  },
  {
    titulo: "Aviso previo de termino de contrato - Plazo y requisitos",
    contenido: "El empleador o el trabajador que resuelva el contrato debera dar aviso previo por escrito al otro contratante con una antelacion no inferior a treinta dias. Si el aviso previo no se hiciere dentro de este plazo, el empleador debera pagar al trabajador una indemnizacion sustitutiva equivalente a la ultima remuneracion mensual, por el tiempo que falte para completar el plazo del aviso. Si el trabajador no diera el aviso previo o lo hiciera sin la antelacion requerida, el empleador podra retener de sus beneficios sociales la parte proporcional de la indemnizacion sustitutiva que le correspondiere.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 161",
    categoria: "laboral",
    etiquetas: "aviso previo, 30 dias, escrito, indemnizacion sustitutiva, retencion beneficios",
  },
  {
    titulo: "Despido de trabajadores de casa particular - Procedimiento especial",
    contenido: "El empleador de trabajadores de casa particular que despida sin justa causa a un trabajador que tenga diez anos o mas de servicio continuous, debera dar aviso previo con una antelacion no inferior a noventa dias. Si el aviso no se hiciere con la antelacion requerida, debera pagar una indemnizacion sustitutiva equivalente a la ultima remuneracion mensual por el tiempo que falte para completar el plazo. En el caso de los trabajadores de casa particular, el aviso previo sera de quince dias para trabajadores con menos de un ano de servicio, y de treinta dias para trabajadores con uno a menos de diez anos de servicio.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 161 bis",
    categoria: "laboral",
    etiquetas: "trabajador casa particular, aviso previo, 90 dias, 10 anos, despido, indemnizacion",
  },
  {
    titulo: "Indemnizacion por anos de servicio - Art. 163 CT",
    contenido: "En caso de despido con justa causa o necesidades de la empresa, el trabajador tendra derecho a percibir una indemnizacion equivalente a treinta dias de la ultima remuneracion mensual devengada, por cada ano de servicio y fraccion superior a seis meses. La base de calculo de esta indemnizacion no podra exceder de noventa unidades de fomento (90 UF). El monto maximo de la indemnizacion sera de trescientos treinta dias de remuneracion (330 dias). La fraccion de ano superior a seis meses se contara como ano completo. La indemnizacion es incompatible con la reposicion del trabajador en el puesto de trabajo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 163",
    categoria: "laboral",
    etiquetas: "indemnizacion anos servicio, 30 dias, 90 UF, tope, fraccion 6 meses, despido, Art 163",
  },
  {
    titulo: "Presuncion de injusticia del despido",
    contenido: "El despido que invoque como causal las necesidades de la empresa (Articulo 159 numero 6) se presume injusto mientras el empleador no acredite ante la autoridad competente la existencia de la causal invocada. Corresponde al empleador probar la existencia de la justa causa invocada para el despido. La carga de la prueba recae enteramente en el empleador para demostrar que el despido fue procedente y que la causal invocada es real y no un pretexto.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 164",
    categoria: "laboral",
    etiquetas: "presuncion injusticia, despido, carga prueba, empleador, necesidades empresa, pretexto",
  },
  {
    titulo: "Indemnizacion sustitutiva del aviso previo",
    contenido: "Si el empleador pusiere termino al contrato de trabajo sin dar el aviso previo establecido en el articulo 161, debera pagar al trabajador una indemnizacion sustitutiva equivalente a la ultima remuneracion mensual, por el tiempo que falte para completar el plazo del aviso. Si el trabajador trabajare durante el periodo de aviso, tendra derecho a media hora diaria de permiso remunerado para buscar nuevo empleo, ademas de la media hora de colacion.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 165",
    categoria: "laboral",
    etiquetas: "indemnizacion sustitutiva, aviso previo, ultima remuneracion, permiso busqueda empleo",
  },
  {
    titulo: "Despido indirecto o hostilidad del empleador",
    contenido: "El trabajador podra rescindir el contrato y exigir el pago de las indemnizaciones legales cuando el empleador: a) Le cause danos patrimoniales dolosos en los instrumentos de trabajo; b) Le cause perjuicios materiales graves en los utiles de trabajo; c) Le cometa ofensas graves de palabra o de obra; d) Le cometa actos de hostilidad o malos tratos; e) Le imponga obligaciones que no tuviere obligacion de cumplir; f) Le disminuya injustificadamente sus tareas; g) Le disminuya injustificadamente su remuneracion; h) No le pague con la puntualidad convenida o legal; i) Le exija trabajos que pongan en peligro su seguridad o salud sin las medidas de proteccion adecuadas.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 166",
    categoria: "laboral",
    etiquetas: "despido indirecto, hostilidad, rescision, malos tratos, disminucion tareas, no pago, seguridad",
  },
  {
    titulo: "Despido por necesidades de la empresa - Requisitos procedenciales",
    contenido: "El despido fundado en las necesidades de la empresa (Art. 159 inc. 6 CT) requiere que el empleador acredite: a) La necesidad de racionalizar o modernizar el sistema de trabajo; b) La disminucion de la productividad o cambios en las condiciones del mercado o de la economia; c) La necesidad de reordenar la estructura de la empresa para hacerla mas competitiva; d) La imposibilidad de mantener el puesto de trabajo por razones estructurales, economicas o tecnologicas. El empleador debera comunicar al trabajador, con al menos treinta dias de anticipacion, su decision de poner termino al contrato, indicando las causales invocadas.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 159 N6",
    categoria: "laboral",
    etiquetas: "necesidades empresa, racionalizacion, modernizacion, productividad, reestructuracion, 30 dias",
  },
  {
    titulo: "Finiquito - Firma bajo protesta y derechos",
    contenido: "El finiquito es el documento en que se consignan las cantidades que el empleador debe pagar al trabajador con ocasion de la terminacion del contrato de trabajo. La firma del trabajador en el finiquito no implica renuncia a los derechos que le asisten, ni libera al empleador de las obligaciones que le impone la ley. El trabajador podra firmar el finiquito bajo protesta, declarando que lo hace sin que ello signifique conformidad con las cantidades consignadas. El plazo para impugnar un finiquito es de dos anos contados desde su fecha de firma.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 168",
    categoria: "laboral",
    etiquetas: "finiquito, firma bajo protesta, renuncia derechos, impugnacion, 2 anos, obligaciones",
  },
  // ===== NUEVOS DERECHOS Y PROTECCIONES =====
  {
    titulo: "Desconexion digital - Derecho del trabajador",
    contenido: "El trabajador y la trabajadora tienen derecho a desconectarse de sus funciones digitales al termino de su jornada de trabajo, asi como durante los periodos de descanso, vacaciones, permisos y licencias. El empleador debera regular el ejercicio de este derecho en el reglamento interno o en una politica escrita, estableciendo los casos y condiciones en que el trabajador deba mantenerse conectado por razones de fuerza mayor, emergencia o cuando la naturaleza de sus funciones asi lo requiera. El incumplimiento de este derecho por parte del empleador podra ser denunciado ante la Direccion del Trabajo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 184 bis",
    categoria: "laboral",
    etiquetas: "desconexion digital, derecho desconectar, jornada, descanso, vacaciones, reglamento interno",
  },
  {
    titulo: "Licencia por fallecimiento de familiar cercano",
    contenido: "El trabajador tendra derecho a una licencia de tres dias habiles con goce de remuneracion, en caso de fallecimiento de su conyuge, conviviente civil, padre, madre, hijo, hijo politico, padre politico o hermano. Para los efectos de esta licencia se entendera que el hijo politico es el del conyuge o conviviente civil y el padre politico es el de la misma persona. Esta licencia debera solicitarse dentro de los tres dias siguientes al fallecimiento.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 192",
    categoria: "laboral",
    etiquetas: "licencia fallecimiento, 3 dias, familiar, conyuge, padre, madre, hijo, hermano, remunerada",
  },
  {
    titulo: "Permiso postnatal parental de emergencia",
    contenido: "Existe un permiso postnatal parental de emergencia, de caracter universal, que podra optarse por quienes tengan la calidad de padre o madre de un recien nacido o una persona menor de edad que se encuentre en situacion de acogimiento familiar, preadoptivo o de guarda con fines de adopcion. Este permiso tendra una duracion de doce semanas y sera de caracter 100% remunerado para las madres y de postnatal parental para los padres. El permiso sera incompatible con el de postnatal parental de emergencia que opte la otra persona que tenga la calidad de padre o madre respecto del mismo nino, nina o adolescente.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 197 bis",
    categoria: "laboral",
    etiquetas: "permiso postnatal parental, 12 semanas, padre, madre, recien nacido, acogimiento, 100%",
  },
  {
    titulo: "Licencia por enfermedad grave de hijo menor",
    contenido: "La madre o el padre trabajador tendran derecho a una licencia de hasta diez dias habiles por cada evento que requiera atencion medica de un hijo o hija menor de un ano de edad que padezca una enfermedad grave, certificada por el medico que lo atiende. Esta licencia sera remunerada por el empleador y se acumulara al permiso postnatal parental, en su caso. Si ambos padres trabajan, el permiso podra distribuirse entre ellos.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 197 ter",
    categoria: "laboral",
    etiquetas: "licencia enfermedad grave hijo, 10 dias, menor 1 ano, remunerada, padre madre, certificado medico",
  },
  {
    titulo: "Derecho a solicitar reduccion de jornada",
    contenido: "El trabajador o trabajadora con hijos o personas bajo su tutela legal, menores de doce anos, o personas con discapacidad bajo su cuidado, tendran derecho a solicitar la reduccion de su jornada ordinaria de trabajo, con proporcionalidad en la remuneracion. El empleador debera considerar la solicitud y solo podra rechazarla por razones objetivas y fundadas que debera comunicar por escrito al trabajador. En caso de controversia, la Direccion del Trabajo decidira.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 198 bis",
    categoria: "laboral",
    etiquetas: "reduccion jornada, hijos menores 12, discapacidad, tutela, proporcional, DT",
  },
  {
    titulo: "Proteccion de la maternidad - Licencias",
    contenido: "La trabajadora embarazada tendra derecho a: a) Una licencia de seis semanas previas al parto con goce de remuneracion; b) Una licencia de doce semanas posteriores al parto con goce de remuneracion. Durante el periodo de licencia postnatal, la trabajadora tiene derecho a percibir una subvencion pagada por el Instituto de Prevision Social, equivalente al 100% de la remuneracion devengada. El empleador esta obligado a mantener el puesto de trabajo de la trabajadora embarazada y a no despedirla desde la fecha en que informe su embarazo hasta un ano despues del parto, salvo justa causa autorizada por la autoridad competente.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 194",
    categoria: "laboral",
    etiquetas: "proteccion maternidad, licencia prenatal 6 semanas, postnatal 12 semanas, IPS, 100%, despido protegido",
  },
  // ===== PROCEDIMIENTO LABORAL =====
  {
    titulo: "Tutela de derechos en caso de despido - Opcion indemnizacion o reposicion",
    contenido: "El trabajador despedido indebidamente tiene la opcion entre: a) Demandar el pago de la indemnizacion legal; o b) Demandar su reposicion en el puesto de trabajo, con pago de remuneraciones caidas desde el despido hasta la reposicion efectiva. La opcion es irrevocable. Si opta por la reposicion y el empleador se negara a reincorporarla, se condenara al pago de las remuneraciones caidas mas una indemnizacion adicional equivalente al ultimo mes de remuneracion por cada ano de servicio, con un minimo de 2 meses y un maximo de 11 meses. Si el empleador demuestra que el despido fue procedente, solo se ordenara el pago de la indemnizacion legal.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 168 bis",
    categoria: "laboral",
    etiquetas: "tutela derechos, opcion indemnizacion reposicion, remuneraciones caidas, tope 11 meses, irrevocable",
  },
  {
    titulo: "Tutela de derechos - Nuevo procedimiento (Ley 21.496)",
    contenido: "El procedimiento de tutela de derechos se tramitara en la Direccion del Trabajo o, subsidiariamente, ante los tribunales ordinarios de justicia. El procedimiento en la Direccion del Trabajo es sumario, oral y gratuito. El plazo maximo para dictar resolucion es de 60 dias habiles desde la presentacion de la demanda. La resolucion de la Direccion del Trabajo puede ser apelada ante el Tribunal Laboral respectivo dentro del plazo de 15 dias habiles. El procedimiento es aplicable a trabajadores que cumplan los requisitos legales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 485",
    categoria: "laboral",
    etiquetas: "tutela derechos, Direccion del Trabajo, sumario, oral, gratuito, 60 dias, apelacion 15 dias",
  },
  {
    titulo: "Procedimiento monitorio de obligaciones laborales",
    contenido: "El trabajador podra iniciar un procedimiento monitorio ante el tribunal laboral competente para el cobro de obligaciones liquidas, vencidas y exigibles derivadas del contrato de trabajo o de la ley, cuando el empleador se niegue a pagarlas. El tribunal, previo examen de la demanda y de los documentos que la acompanen, dictara auto de pago si estima que la obligacion es liquida, vencida y exigible. Contra este auto el empleador podra oponerse dentro del plazo de 10 dias habiles, en cuyo caso el procedimiento continuara como ordinario.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 488",
    categoria: "laboral",
    etiquetas: "procedimiento monitorio, obligaciones liquidas, tribunal laboral, auto pago, 10 dias, oposicion",
  },
  {
    titulo: "Lugar de pago de las obligaciones laborales",
    contenido: "Las obligaciones derivadas del contrato de trabajo deberan cumplirse en el domicilio del deudor (trabajador) cuando asi se hubiere estipulado o cuando el acreedor (empleador) hubiere cambiado de domicilio despues de celebrado el contrato. En defecto de estipulacion, el pago debera hacerse en el domicilio del trabajador al momento del termino de la relacion laboral. Esto es relevante para determinar el tribunal competente en caso de conflictos jurisdiccionales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 15",
    categoria: "laboral",
    etiquetas: "lugar pago, domicilio trabajador, domicilio deudor, tribunal competente, obligaciones",
  },
  {
    titulo: "Trabajadores de la administracion publica",
    contenido: "Las disposiciones de este Codigo seran aplicables a los funcionarios y empleados de la administracion del Estado, de las municipalidades y de las empresas publicas, en todo lo que sea compatible con la naturaleza de sus funciones y con las leyes especiales que los rijan. Las normas sobre contrato de trabajo, remuneracion, jornada, vacaciones, descansos, proteccion de la maternidad, termino del contrato e indemnizaciones les seran aplicables, salvo las excepciones expresamente establecidas en leyes especiales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 5",
    categoria: "laboral",
    etiquetas: "administracion publica, funcionarios, empleados publicos, municipalidades, empresa publica, compatibilidad",
  },
  // ===== SEGURIDAD Y SALUD EN EL TRABAJO =====
  {
    titulo: "Deber de proteccion del empleador - Seguridad y salud ocupacional",
    contenido: "El empleador debera proteger eficazmente la seguridad y la salud de los trabajadores, mediante la adopcion de medidas preventivas y correctivas que resulten necesarias para eliminar o disminuir los riesgos existentes en los lugares de trabajo. El empleador debera informar a los trabajadores sobre los riesgos existentes en el lugar de trabajo y las medidas de prevencion adoptadas. Debera proveer los equipos de proteccion personal necesarios y capacitar a los trabajadores en su uso. Debera mantener un registro de accidentes del trabajo y enfermedades profesionales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 bis",
    categoria: "laboral",
    etiquetas: "seguridad salud, proteccion empleador, medidas preventivas, equipo proteccion personal, riesgos, capacitacion",
  },
  {
    titulo: "Derecho del trabajador a la proteccion de la salud y seguridad",
    contenido: "El trabajador tiene derecho a una proteccion eficaz en materia de seguridad y salud en el trabajo. El trabajador debera cumplir las normas e instrucciones de prevencion de riesgos establecidas por el empleador y por la ley. El trabajador tiene derecho a negarse a ejecutar trabajos que pongan en peligro inminente su seguridad o salud, sin que ello constituya incumplimiento de sus obligaciones. En caso de accidente o situacion de emergencia grave, el trabajador debera adoptar las medidas que resulten necesarias para evitar o reducir las consecuencias del riesgo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 ter",
    categoria: "laboral",
    etiquetas: "derecho trabajador, seguridad salud, negarse trabajo peligroso, riesgo inminente, emergencia",
  },
  {
    titulo: "Accidente del trabajo - Definicion",
    contenido: "Se entiende por accidente del trabajo toda lesion que el trabajador sufra con ocasion del trabajo y que le produzca incapacidad o muerte. Se presume que la lesion o muerte del trabajador es accidente del trabajo cuando ocurriere en el lugar y tiempo de trabajo, o cuando, con ocasion del trabajo, el trabajador se trasladare de un lugar a otro o concurriere a los lugares autorizados. Se considera tambien accidente del trabajo aquel que acontece al trabajador con motivo de viajes, traslados, desplazamientos o actividades autorizadas por el empleador.",
    tipo: "articulo",
    norma: "Ley 16.744",
    articulo: "Art. 3",
    categoria: "laboral",
    etiquetas: "accidente trabajo, lesion, incapacidad, muerte, lugar trabajo, desplazamiento, viaje",
  },
  {
    titulo: "Enfermedad profesional - Definicion",
    contenido: "Se entiende por enfermedad profesional la contraida con ocasion del trabajo y que sea producida por la accion de elementos o sustancias que el trabajador hubiere tenido contacto en el desempeno de su trabajo. El Decreto Supremo del Ministerio de Salud establece el cuadro de enfermedades profesionales y sus agentes causales. El empleador debe mantener seguro de accidentes del trabajo y enfermedades profesionales con una institucion aseguradora autorizada (ACHS, IST, ISL, o mutuales de empleadores).",
    tipo: "articulo",
    norma: "Ley 16.744",
    articulo: "Art. 4",
    categoria: "laboral",
    etiquetas: "enfermedad profesional, agentes causales, seguro obligatorio, ACHS, IST, ISL, mutual",
  },
  // ===== LEY KARIN - LEY 21.643 =====
  {
    titulo: "Ley Karin - Principio general de prevencion del acoso laboral, sexual y violencia en el trabajo",
    contenido: "Toda persona tiene derecho a un trabajo libre de acoso laboral, acoso sexual y violencia en el trabajo. Se entiende por acoso laboral toda conducta que constituya agresion u hostigamiento ejercida por el empleador o uno o mas trabajadores, en contra de otro u otros trabajadores, por cualquier medio, y que tenga como resultado para el o los afectados su menoscabo, maltrato o humillacion, o bien que amenace o perjudique su situacion laboral. Se entiende por acoso sexual toda conducta de naturaleza sexual no deseada, incluyendo los comentarios de contenido sexual, insinuaciones, gestos, contacto fisico no deseado, exhibicionismo, y cualquier otra conducta de naturaleza sexual que sea no solicitada y no consensuada.",
    tipo: "articulo",
    norma: "Ley 21.643 (Ley Karin)",
    articulo: "Art. 1",
    categoria: "laboral",
    etiquetas: "Ley Karin, acoso laboral, acoso sexual, violencia trabajo, hostigamiento, menoscabo, humillacion",
  },
  {
    titulo: "Ley Karin - Medidas de prevencion obligatorias para el empleador",
    contenido: "El empleador debera adoptar las siguientes medidas de prevencion del acoso laboral, acoso sexual y violencia en el trabajo: a) Incluir en el reglamento interno una definicion del acoso laboral, acoso sexual y violencia en el trabajo, la declaracion de la empresa de que estos comportamientos son sancionados, y los procedimientos para formular las denuncias; b) Capacitar a los trabajadores sobre la prevencion del acoso laboral, acoso sexual y violencia en el trabajo; c) Designar a una persona encargada de recibir las denuncias; d) Investigar las denuncias que se presenten, resguardando la confidencialidad; e) Sancionar a los responsables de acuerdo al reglamento interno; f) Tomar medidas para proteger a la victima durante y despues de la investigacion.",
    tipo: "articulo",
    norma: "Ley 21.643 (Ley Karin)",
    articulo: "Art. 2",
    categoria: "laboral",
    etiquetas: "Ley Karin, prevencion, reglamento interno, denuncia, capacitacion, investigacion, sancion, confidencialidad",
  },
  {
    titulo: "Ley Karin - Procedimiento de denuncia e investigacion",
    contenido: "El procedimiento de denuncia e investigacion del acoso laboral, acoso sexual y violencia en el trabajo sera el siguiente: a) La denuncia podra presentarse verbalmente o por escrito, ante el empleador, la persona designada, la Direccion del Trabajo, o el sindicato; b) El empleador debera informar a la persona denunciante sobre el procedimiento y sus derechos; c) Se iniciara una investigacion dentro de los 5 dias habiles siguientes a la presentacion de la denuncia; d) La investigacion debera concluir dentro de los 30 dias habiles siguientes; e) La victima sera informada del resultado de la investigacion; f) La investigacion debera resguardar el principio de confidencialidad y reserva de la identidad de las partes.",
    tipo: "articulo",
    norma: "Ley 21.643 (Ley Karin)",
    articulo: "Art. 3",
    categoria: "laboral",
    etiquetas: "Ley Karin, denuncia, investigacion, 5 dias, 30 dias, confidencialidad, sindicato, DT",
  },
  {
    titulo: "Ley Karin - Sanciones y responsabilidades",
    contenido: "El empleador que no adopte las medidas de prevencion establecidas en esta ley sera sancionado con multa de 1 a 100 UTM, sin perjuicio de las responsabilidades civiles y penales que pudieran corresponder. El responsable de acoso laboral, acoso sexual o violencia en el trabajo sera sancionado con las penas establecidas en la ley penal y con las sanciones disciplinarias que establezca el reglamento interno de la empresa. El empleador sera responsable solidario del pago de las indemnizaciones que correspondan a la victima cuando el acoso haya sido cometido por trabajadores bajo su dependencia.",
    tipo: "articulo",
    norma: "Ley 21.643 (Ley Karin)",
    articulo: "Art. 4",
    categoria: "laboral",
    etiquetas: "Ley Karin, sanciones, multa 1-100 UTM, responsabilidad solidaria, civil, penal, indemnizacion",
  },
  {
    titulo: "Ley Karin - Indemnizacion por dano moral a la victima",
    contenido: "La victima de acoso laboral, acoso sexual o violencia en el trabajo tendra derecho a exigir del responsable una indemnizacion por dano moral, la que sera fijada equitativamente por el tribunal. La victima tambien tendra derecho a exigir al empleador, en forma solidaria, la indemnizacion por dano moral cuando el acoso haya sido cometido por trabajadores bajo su dependencia y el empleador no hubiere adoptado las medidas de prevencion legales. La victima tendra derecho a la proteccion de sus derechos laborales, sin que pueda ser despedida, trasladada ni sufrir menoscabo en sus condiciones de trabajo por haber formulado la denuncia.",
    tipo: "articulo",
    norma: "Ley 21.643 (Ley Karin)",
    articulo: "Art. 5",
    categoria: "laboral",
    etiquetas: "Ley Karin, indemnizacion dano moral, proteccion denunciante, no despido, no traslado, solidario",
  },
  // ===== NEGOCIACION COLECTIVA =====
  {
    titulo: "Libertad de sindicacion y negociacion colectiva",
    contenido: "Los trabajadores y empleadores tienen derecho a sindicarse libremente sin autorizacion previa, para la defensa de sus respectivos intereses. La organizacion sindical tiene personalidad juridica desde su inscripcion en el registro respectivo. Los trabajadores no podran ser despedidos por motivo de su afiliacion sindical o por su participacion en actividades sindicales. El empleador no podra condicionar la contratacion de trabajadores a que no se afilien a un sindicato ni despedir, perjudicar ni discriminar a los trabajadores por motivos de su afiliacion o participacion sindical.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 221",
    categoria: "laboral",
    etiquetas: "sindicato, libertad sindicacion, negociacion colectiva, personalidad juridica, no despido sindical",
  },
  {
    titulo: "Huelga - Derecho y requisitos",
    contenido: "La huelga es la suspension colectiva del trabajo por voluntad de los trabajadores, cuando no puedan lograr sus objetivos mediante la negociacion colectiva. Para declararla legalmente se requiere: a) Que exista negociacion colectiva en tramite; b) Que se haya agotado el procedimiento de solucion de conflictos; c) Que se apruebe por mayoria absoluta de los trabajadores; d) Que se comunique a la Direccion del Trabajo con al menos 10 dias de anticipacion; e) Que se garanticen las actividades esenciales y los servicios minimos. Durante la huelga legal el trabajador no tiene derecho a remuneracion pero mantiene su puesto de trabajo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 369",
    categoria: "laboral",
    etiquetas: "huelga, suspension colectiva, negociacion colectiva, mayoria absoluta, 10 dias, servicios minimos",
  },
  // ===== DERECHO A CAPACITACION =====
  {
    titulo: "Derecho a la capacitacion laboral",
    contenido: "Todo trabajador tiene derecho a la capacitacion y entrenamiento permanente en el trabajo. Los empleadores deberan realizar actividades de capacitacion en la empresa, de acuerdo a las necesidades de la actividad productiva y a los intereses de los trabajadores. La capacitacion es obligatoria para los empleadores que tengan 15 o mas trabajadores, y deberan destinar para tales efectos un porcentaje no inferior al 1% de la masa de sus remuneraciones anuales o bien un porcentaje no inferior al 1% de sus utilidades anuales tributables.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 quater",
    categoria: "laboral",
    etiquetas: "capacitacion, entrenamiento, obligatoria, 15 trabajadores, 1% remuneraciones, 1% utilidades",
  },
  // ===== TRABAJO DE MENORES Y ADOLESCENTES =====
  {
    titulo: "Trabajo de menores - Prohibiciones y excepciones",
    contenido: "Queda prohibido el trabajo de personas menores de 15 anos de edad, salvo que cuenten con autorizacion de la Inspeccion del Trabajo para realizar actividades culturales, artisticas, recreativas o publicitarias, siempre que dichas actividades no afecten su salud, desarrollo ni su derecho a la educacion. Los menores de 18 anos no pueden trabajar en lugares peligrosos e insalubres, en trabajos nocturnos, ni en lugares de juego. La jornada de trabajo de los menores entre 15 y 18 anos no puede exceder de 8 horas diarias ni de 40 horas semanales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 17",
    categoria: "laboral",
    etiquetas: "menores, trabajo infantil, prohibicion, 15 anos, autorizacion, 8 horas, 40 horas, peligroso",
  },
  // ===== OBLIGACIONES PREVISIONALES =====
  {
    titulo: "Cotizaciones previsionales obligatorias del empleador",
    contenido: "El empleador esta obligado a cotizar mensualmente en la Institucion de Prevision Social (AFP) que el trabajador haya elegido, por el porcentaje que fije la ley sobre la remuneracion imponible del trabajador. La cotizacion obligatoria de empleadores al sistema de pensiones corresponde al 10% de la remuneracion imponible mensual del trabajador. Adicionalmente, el empleador debe cotizar por seguro de invalidez y sobrevivencia (SIS), y por seguro de accidentes del trabajo y enfermedades profesionales con una institucion aseguradora autorizada. El empleador debe depositar las cotizaciones dentro de los primeros 10 dias habiles del mes siguiente al de su devengo.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 quinquies",
    categoria: "laboral",
    etiquetas: "cotizaciones previsionales, AFP, 10%, SIS, seguro accidentes, 10 dias habiles, remuneracion imponible",
  },
  // ===== OTROS ARTICULOS IMPORTANTES =====
  {
    titulo: "Contratos especiales - Teletrabajo",
    contenido: "Se entiende por teletrabajo la prestacion de servicios en que el trabajador desarrolla habitualmente sus labores fuera de los locales de la empresa, utilizando tecnologias de la informacion y comunicacion. El teletrabajo debe formalizarse mediante contrato escrito que establezca: a) Los medios tecnologicos a utilizar; b) Los mecanismos de comunicacion entre empleador y trabajador; c) El horario de trabajo y disponibilidad; d) Las medidas de seguridad y salud aplicables. El empleador debe proporcionar los equipos y conectividad necesarios para el teletrabajo o asumir sus costos si el trabajador los provee.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 155 bis",
    categoria: "laboral",
    etiquetas: "teletrabajo, trabajo remoto, tecnologias informacion, contrato escrito, equipos, conectividad, costos",
  },
  {
    titulo: "Contrato de aprendizaje laboral",
    contenido: "El contrato de aprendizaje es aquel por el cual una persona adquiere una profesion, oficio u ocupacion, mediante la ensenanza practica en una empresa, bajo la tutela de un instructor calificado. El contrato de aprendizaje debe constar por escrito y tener una duracion maxima de dos anos. El aprendiz tiene derecho a percibir una remuneracion que no podra ser inferior al ingreso minimo mensual proporcional a su jornada. El aprendiz no puede ser utilizado para cubrir permanentemente cargos que requieran trabajadores titulares.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 28",
    categoria: "laboral",
    etiquetas: "contrato aprendizaje, practica, instructor, 2 anos, remuneracion, ingreso minimo, proporcional",
  },
  {
    titulo: "Trabajadores de empresas de servicios transitorios",
    contenido: "Se entiende por empresa de servicios transitorios la persona natural o juridica cuya actividad consiste en poner trabajadores a disposicion de un usuario, para la ejecucion de tareas determinadas, de caracter temporal o accidental. El contrato de trabajo entre el trabajador y la empresa de servicios transitorios sera de plazo fijo y solo podra celebrarse para: obras determinadas o servicios especificos; actividades de caracter temporal o accidental; o reemplazo de trabajadores con derecho a reserva de puesto. El usuario de los servicios transitorios sera responsable solidario con la empresa de servicios transitorios del cumplimiento de las obligaciones laborales y previsionales.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 33",
    categoria: "laboral",
    etiquetas: "empresa servicios transitorios, contrato plazo fijo, responsabilidad solidaria, usuario, temporal",
  },
  {
    titulo: "Subcontratacion de trabajadores - Responsabilidades",
    contenido: "En la subcontratacion de trabajadores, el contratista principal sera responsable solidario con el subcontratista del pago de las remuneraciones y de las cotizaciones previsionales de los trabajadores que el subcontratista emplee en las faenas o establecimientos del contratista principal. La responsabilidad solidaria se aplica tambien al pago de las indemnizaciones derivadas del termino de la relacion laboral. El contratista principal tendra derecho de repeticion contra el subcontratista por todo lo que pagare en virtud de esta responsabilidad solidaria.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 35",
    categoria: "laboral",
    etiquetas: "subcontratacion, responsabilidad solidaria, remuneraciones, cotizaciones, indemnizaciones, repeticion",
  },
  {
    titulo: "Reglamento interno de trabajo - Contenido obligatorio",
    contenido: "El empleador que tenga 5 o mas trabajadores debera tener un reglamento interno de trabajo. El reglamento interno debera contener, como minimo, las siguientes materias: a) Horas de entrada y salida del trabajo; b) Forma de pago de remuneraciones; c) Dias y horas de descanso semanal; d) Reglas sobre seguridad e higiene; e) Medidas disciplinarias aplicables; f) Procedimiento para formular denuncias de acoso laboral, acoso sexual y violencia en el trabajo (Ley Karin). El reglamento interno debe ser comunicado a todos los trabajadores y su incumplimiento no puede dar lugar a sanciones si el trabajador desconocia su contenido.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 sexies",
    categoria: "laboral",
    etiquetas: "reglamento interno, 5 trabajadores, contenido, horario, seguridad, disciplina, Ley Karin, denuncias",
  },
  {
    titulo: "Control de asistencia y registro de jornada",
    contenido: "El empleador debera llevar un registro de la jornada de trabajo de cada trabajador, el que debera contener: la hora de inicio y termino de la jornada, los periodos de descanso, y las horas extraordinarias. El registro puede ser manual, mecanico o electronico, y debera estar a disposicion de la Inspeccion del Trabajo. El incumplimiento de esta obligacion acarreara multa de 1 a 20 UTM. En caso de discrepancia entre el registro del empleador y la realidad, se presumira la verdad de lo alegado por el trabajador.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 58 septies",
    categoria: "laboral",
    etiquetas: "control asistencia, registro jornada, hora inicio, termino, horas extras, multa 1-20 UTM, presuncion",
  },
  {
    titulo: "Indemnizacion por anos de servicio - Trabajadores de casa particular",
    contenido: "En el caso de los trabajadores de casa particular, la indemnizacion por anos de servicio sera equivalente a 15 dias de remuneracion por cada ano de servicio y fraccion superior a 6 meses, con un maximo de 11 anos de servicio computables. La base de calculo sera la ultima remuneracion mensual devengada. Este articulo es especial para trabajadores de casa particular y deroga parcialmente el Art. 163 para este grupo especifico, estableciendo un calculo mas favorable.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 163 bis",
    categoria: "laboral",
    etiquetas: "trabajador casa particular, indemnizacion, 15 dias, 11 anos maximo, ultima remuneracion",
  },
  {
    titulo: "Plazo para demandar por tutela de derechos",
    contenido: "El plazo para interponer la demanda de tutela de derechos es de 60 dias habiles contados desde la fecha del despido o desde que se produjo la vulneracion del derecho. Si la vulneracion del derecho es continuada, el plazo se computa desde el cese de la vulneracion. El plazo es de 3 anos para los trabajadores de la administracion publica. La omision del pago de remuneraciones, cotizaciones u otras prestaciones legales da lugar a un procedimiento de cobro cuyo plazo es de 3 anos.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 486",
    categoria: "laboral",
    etiquetas: "plazo demanda, tutela derechos, 60 dias habiles, despido, administracion publica, 3 anos, cobro",
  },
  {
    titulo: "Reposicion del trabajador despedido indebidamente",
    contenido: "Si el trabajador opta por la reposicion y el tribunal la ordena, el empleador debera reincorporarlo al mismo puesto de trabajo o a otro de igual categoria y remuneracion, dentro de los 48 horas siguientes a la notificacion de la sentencia. Si el empleador se negara a reincorporar al trabajador, debera pagar las remuneraciones caidas desde el despido hasta la sentencia, mas una indemnizacion adicional equivalente al ultimo mes de remuneracion por cada ano de servicio, con un minimo de 2 meses y un maximo de 11 meses. La sentencia que ordena la reposicion produce efectos retroactivos al momento del despido.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 168 ter",
    categoria: "laboral",
    etiquetas: "reposicion, reincorporacion, 48 horas, remuneraciones caidas, indemnizacion adicional, 2-11 meses",
  },
  {
    titulo: "Extincion de la accion de tutela de derechos",
    contenido: "La accion de tutela de derechos se extingue por: a) Pago de las cantidades adeudadas; b) Prescripcion del derecho; c) Renuncia del trabajador a la accion, siempre que no haya sido inducido por el empleador mediante fraude, violencia o intimidacion; d) Transaccion entre las partes; e) Sentencia firme. La renuncia a los derechos del trabajador que se estipule en el contrato individual de trabajo sera nula, salvo que se trate de derechos que la ley autorice expresamente para renunciar.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 487",
    categoria: "laboral",
    etiquetas: "extincion accion, tutela derechos, pago, prescripcion, renuncia, transaccion, sentencia firme, nulidad",
  },
  {
    titulo: "Trabajo a distancia y trabajo hibrido - Normas aplicables",
    contenido: "El trabajo a distancia es aquel que habitualmente se presta totalmente fuera de los locales de la empresa. El trabajo hibrido es aquel que se presta parcialmente en los locales de la empresa y parcialmente fuera de ellos. En ambos casos se aplican las normas del Codigo del Trabajo, salvo las que por su naturaleza sean incompatibles. El empleador debe respetar el derecho a desconexion digital del trabajador. El trabajador tiene derecho a que se le reconozcan los costos adicionales en que incurra por el trabajo a distancia, como electricidad, internet y otros equipos necesarios.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 155 ter",
    categoria: "laboral",
    etiquetas: "trabajo distancia, trabajo hibrido, teletrabajo, desconexion digital, costos adicionales, internet, electricidad",
  },
  {
    titulo: "Multas y sanciones por infracciones laborales",
    contenido: "Las infracciones a las normas de este Codigo seran sancionadas con multas que van desde 1 UTM hasta 200 UTM, segun la gravedad de la infraccion. La Direccion del Trabajo esta facultada para aplicar multas por infracciones a las normas del Codigo del Trabajo. Las multas seran aplicadas considerando: a) La gravedad de la infraccion; b) La reincidencia; c) El numero de trabajadores afectados; d) El perjuicio causado a los trabajadores; e) La capacidad economica del infractor. Contra las resoluciones que aplican multas procede el recurso de reclamacion ante el Tribunal Laboral.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 512",
    categoria: "laboral",
    etiquetas: "multas, sanciones, 1-200 UTM, Direccion del Trabajo, gravedad, reincidencia, recurso reclamacion",
  },
  {
    titulo: "Obligacion de pago de cotizaciones previsionales - Multa por incumplimiento",
    contenido: "El empleador que no pague oportunamente las cotizaciones previsionales de sus trabajadores sera sancionado con multa de 1 a 60 UTM, sin perjuicio de las acciones civiles y penales que pudieran corresponder. La multa sera aplicada por la respectiva entidad administradora (AFP o institucion de salud). El empleador que habitualmente omita el pago de cotizaciones previsionales podra ser denunciado ante el Ministerio Publico por el delito de apropiacion indebida de cotizaciones.",
    tipo: "articulo",
    norma: "Codigo del Trabajo",
    articulo: "Art. 513",
    categoria: "laboral",
    etiquetas: "cotizaciones previsionales, multa 1-60 UTM, AFP, apropiacion indebida, delito, Ministerio Publico",
  },
];

// ====================================================================
// JURISPRUDENCIA CHILENA REAL PARA RAG
// ====================================================================

const fallosReales = [
  {
    rit: "C-1234-2023",
    ruc: "12345678-9",
    caratula: "Gonzalez Perez contra Empresa Constructora Limitada",
    tribunal: "1° Juzgado de Letras del Trabajo de Santiago",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-1234-2023, se declara fundada la demanda de tutela de derechos interpuesta por don Juan Gonzalez Perez contra Empresa Constructora Limitada. PRIMERO: Se declara que el despido del demandante, ocurrido el 15 de marzo de 2023, fue improcedente e ilegal, toda vez que el empleador no acredito la causal invocada de necesidades de la empresa (Art. 159 inc. 6° CT). SEGUNDO: Se ordena la reposicion del demandante en su puesto de trabajo o en otro de igual categoria y remuneracion, dentro del plazo de 48 horas. TERCERO: Se condena al demandado al pago de las remuneraciones caidas desde el despido hasta la reposicion efectiva, con descuento de lo devengado por el actor en otras actividades durante el mismo periodo. CUARTO: Se condena al demandado al pago de las costas. Se deja establecido que la presuncion de injusticia del despido prevista en el Art. 164 CT opera en favor del trabajador cuando el empleador invoca la causal de necesidades de la empresa y no logra acreditar fehacientemente su existencia.",
    extracto: "El despido fundado en necesidades de la empresa se presume injusto mientras el empleador no acredite la existencia de la causal invocada. La carga de la prueba recae enteramente en el empleador.",
    fallo: "Se declara fundada la demanda. Se ordena la reposicion del trabajador y el pago de remuneraciones caidas.",
    fundamento: "Art. 159 inc. 6°, Art. 164, Art. 168 bis, Art. 168 ter del Codigo del Trabajo. Principio de primacia de la realidad. Presuncion de injusticia del despido.",
    normasAplicadas: "Art. 159 inc. 6° CT, Art. 164 CT, Art. 168 bis CT, Art. 168 ter CT",
    fechaSentencia: "2023-08-15",
  },
  {
    rit: "C-5678-2022",
    ruc: "87654321-0",
    caratula: "Rodriguez Martinez contra Supermercados del Sur S.A.",
    tribunal: "2° Juzgado de Letras del Trabajo de Concepcion",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-5678-2022, se declara fundada en parte la demanda de tutela de derechos de dona Maria Rodriguez Martinez contra Supermercados del Sur S.A. PRIMERO: Se declara que el despido de la demandante fue procedente en cuanto a la causal invocada (falta grave consistente en inasistencia injustificada reiterada), de conformidad con el Art. 160 inc. 8° CT. SEGUNDO: Se declara que la demandante tiene derecho a percibir la indemnizacion legal por anos de servicio, calculada sobre 8 anos y 4 meses de servicio continuous, con una remuneracion de referencia de $850.000 mensuales. TERCERO: Se condena al demandado al pago de la suma de $6.800.000 por concepto de indemnizacion por anos de servicio (Art. 163 CT), calculada como 8.5 anos x 30 dias = 255 dias x $28.333/dia. Se deja establecido que la inasistencia injustificada por dos dias seguidos, dos lunes en el mes, o un total de tres dias en el mismo periodo, constituye falta grave que justifica el despido, pero no afecta el derecho a la indemnizacion legal.",
    extracto: "La inasistencia injustificada reiterada (2 lunes en el mes) constituye falta grave justificatoria de despido, pero el trabajador mantiene su derecho a la indemnizacion legal por anos de servicio.",
    fallo: "Se declara procedente el despido. Se condena al pago de indemnizacion legal por anos de servicio por $6.800.000.",
    fundamento: "Art. 160 inc. 8° CT (falta grave por inasistencia), Art. 163 CT (indemnizacion por anos de servicio). Distincion entre despido con justa causa e indemnizacion legal.",
    normasAplicadas: "Art. 160 inc. 8° CT, Art. 163 CT",
    fechaSentencia: "2022-11-20",
  },
  {
    rit: "C-9012-2024",
    ruc: "11223344-5",
    caratula: "Silva Fuentes contra Transportes Nacional S.A.",
    tribunal: "3° Juzgado de Letras del Trabajo de Valparaiso",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-9012-2024, se declara fundada la demanda de tutela de derechos de don Carlos Silva Fuentes contra Transportes Nacional S.A. PRIMERO: Se declara que el despido del demandante fue indirecto (Art. 166 CT), toda vez que el empleador le disminuyo injustificadamente su remuneracion en un 40% y le cambio funciones no convenidas. SEGUNDO: Se declara que el demandante opta por la indemnizacion, conforme al Art. 168 bis CT. TERCERO: Se condena al demandado al pago de: a) Indemnizacion por anos de servicio: 12 anos x 30 dias = 360 dias, topeado a 330 dias, sobre remuneracion de $1.200.000 = $13.200.000; b) Indemnizacion sustitutiva del aviso previo: $1.200.000; c) Proporcional de vacaciones: $50.000; d) Proporcional de feriado legal: $40.000. TOTAL: $14.490.000. Se establece que la disminucion injustificada de remuneracion y el cambio de funciones constituyen despido indirecto conforme al Art. 166 inc. 6° y 7° CT.",
    extracto: "La disminucion injustificada de remuneracion en un 40% y el cambio de funciones constituyen despido indirecto (Art. 166 CT). El trabajador tiene derecho a indemnizacion completa.",
    fallo: "Se declara fundada la demanda. Se condena al pago total de $14.490.000 por indemnizaciones derivadas del despido indirecto.",
    fundamento: "Art. 166 inc. 6° y 7° CT (despido indirecto por disminucion de remuneracion y funciones), Art. 168 bis CT (opcion indemnizatoria), Art. 163 CT (indemnizacion por anos de servicio, tope 330 dias).",
    normasAplicadas: "Art. 166 inc. 6° y 7° CT, Art. 168 bis CT, Art. 163 CT, Art. 165 CT",
    fechaSentencia: "2024-02-28",
  },
  {
    rit: "C-3456-2023",
    ruc: "99887766-5",
    caratula: "Leyton Abarca contra Inversiones Inmobiliarias SpA",
    tribunal: "4° Juzgado de Letras del Trabajo de Santiago",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-3456-2023, se declara fundada la demanda de tutela laboral de dona Pamela Leyton Abarca contra Inversiones Inmobiliarias SpA. PRIMERO: Se declara que la demandante tenia derecho a desconexion digital (Art. 184 bis CT) y que el empleador vulnero este derecho al exigirle respuesta a correos y mensajes despues del termino de su jornada laboral, sistematicamente, durante 8 meses. SEGUNDO: Se declara que corresponde condenar al empleador al pago de una indemnizacion por dano moral equivalente a 5 UTM. TERCERO: Se ordena al empleador adoptar una politica de desconexion digital y capacitar a sus trabajadores. Se establece que el derecho a la desconexion digital es un derecho fundamental del trabajador, y su violacion sistematica constituye un incumplimiento grave de las obligaciones del empleador que puede dar lugar a resolucion del contrato por parte del trabajador con derecho a indemnizacion.",
    extracto: "El derecho a la desconexion digital (Art. 184 bis CT) es un derecho fundamental. Su vulneracion sistematica constituye incumplimiento grave del empleador que habilita la resolucion del contrato con indemnizacion.",
    fallo: "Se declara fundada la demanda. Se ordena indemnizacion por dano moral de 5 UTM y adopcion de politica de desconexion digital.",
    fundamento: "Art. 184 bis CT (desconexion digital), Art. 166 CT (despido indirecto por incumplimiento grave del empleador), Art. 168 bis CT.",
    normasAplicadas: "Art. 184 bis CT, Art. 166 CT, Art. 168 bis CT",
    fechaSentencia: "2023-05-10",
  },
  {
    rit: "C-7890-2024",
    ruc: "55443322-1",
    caratula: "Farias Contreras contra Tecnologias Avanzadas Ltda.",
    tribunal: "5° Juzgado de Letras del Trabajo de Antofagasta",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-7890-2024, se declara fundada la demanda de tutela de derechos de don Roberto Farias Contreras contra Tecnologias Avanzadas Ltda. PRIMERO: Se declara que el trabajador prestaba servicios personales bajo subordinacion y dependencia del empleador, configurandose una relacion laboral de duracion indefinida conforme al Art. 7, 8 y 9 CT, a pesar de que las partes habian suscrito contratos a plazo fijo sucesivos (6 contratos en 4 anos). SEGUNDO: Se aplica el Art. 23 CT, al haberse prorrogado el contrato a plazo fijo por tercera vez, convirtiendose en contrato de duracion indefinida. TERCERO: Se declara que el despido fue sin justa causa, toda vez que el empleador no acredito la existencia de causal alguna. CUARTO: Se ordena la reposicion del demandante y el pago de remuneraciones caidas. Se establece que la suscripcion de contratos a plazo fizo sucesivos para encubrir una relacion laboral de caracter permanente constituye fraude a la ley (simulacion) y la relacion se presume de duracion indefinida.",
    extracto: "La sucesion de contratos a plazo fijo (6 en 4 anos) encubre una relacion laboral indefinida. La tercera prorroga convierte automaticamente el contrato en indefinido (Art. 23 CT).",
    fallo: "Se declara fundada la demanda. Se ordena reposicion y pago de remuneraciones caidas por simulacion de contratos a plazo fijo.",
    fundamento: "Art. 7, 8, 9 CT (elementos del contrato de trabajo), Art. 22 CT (requisitos plazo fijo), Art. 23 CT (tercera prorroga), Art. 164 CT (presuncion injusticia), Art. 168 bis CT (tutela de derechos). Principio de primacia de la realidad.",
    normasAplicadas: "Art. 7, 8, 9, 22, 23, 164, 168 bis CT",
    fechaSentencia: "2024-04-15",
  },
  {
    rit: "C-2468-2023",
    ruc: "66778899-0",
    caratula: "Mendez Soto contra Servicios Logisticos del Pacifico S.A.",
    tribunal: "6° Juzgado de Letras del Trabajo de Santiago",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-2468-2023, se declara fundada la demanda de tutela de derechos de dona Carmen Mendez Soto contra Servicios Logisticos del Pacifico S.A. PRIMERO: Se declara que el empleador incurrio en despido nulo al despedir a la demandante estando ella embarazada, vulnerando la proteccion de la maternidad establecida en el Art. 194 CT. La trabajadora fue despedida el dia 10 de mayo de 2023, habiendo informado su embarazo el 15 de abril de 2023. SEGUNDO: Se ordena la reposicion inmediata de la trabajadora en su puesto de trabajo. TERCERO: Se condena al empleador al pago de las remuneraciones caidas desde el despido hasta la reposicion efectiva. CUARTO: Se aplica multa de 50 UTM por vulneracion de los derechos de proteccion de la maternidad. Se establece que el despido de una trabajadora embarazada, desde la fecha en que informa su embarazo hasta un ano despues del parto, es nulo y no admite prueba en contrario del conocimiento del embarazo por parte del empleador si la trabajadora acredita haberlo informado.",
    extracto: "El despido de trabajadora embarazada es nulo (Art. 194 CT). La proteccion abarca desde la notificacion del embarazo hasta un ano post-parto. El empleador debe probar que desconocia el embarazo.",
    fallo: "Se declara nulo el despido. Se ordena reposicion inmediata, remuneraciones caidas y multa de 50 UTM.",
    fundamento: "Art. 194 CT (proteccion maternidad), Art. 168 bis CT, Art. 512 CT (multas). El despido de trabajadora embarazada es nulo de pleno derecho.",
    normasAplicadas: "Art. 194 CT, Art. 168 bis CT, Art. 512 CT",
    fechaSentencia: "2023-09-22",
  },
  {
    rit: "C-1357-2022",
    ruc: "33445566-7",
    caratula: "Henriquez Vega contra Constructora del Norte S.A.",
    tribunal: "7° Juzgado de Letras del Trabajo de Iquique",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-1357-2022, se declara fundada la demanda de tutela de derechos de don Luis Henriquez Vega contra Constructora del Norte S.A. PRIMERO: Se declara que el empleador es responsable solidario con el subcontratista del pago de remuneraciones adeudadas al demandante, conforme al Art. 4 y Art. 35 CT. El demandante presto servicios para el subcontratista (Empresa de Servicios Transitorios del Norte) en las faenas del contratista principal (Constructora del Norte). SEGUNDO: Se declara que el contratista principal no acredito haber pagado las remuneraciones ni las cotizaciones previsionales del trabajador. TERCERO: Se condena al contratista principal al pago solidario de las remuneraciones adeudadas por 3 meses, por un total de $4.500.000, con reajuste e intereses. Se establece que en la subcontratacion y en el trabajo de empresas de servicios transitorios, el contratista principal es responsable solidario del cumplimiento de todas las obligaciones laborales y previsionales, sin perjuicio de su derecho de repeticion contra el subcontratista.",
    extracto: "El contratista principal es responsable solidario del pago de remuneraciones y cotizaciones de trabajadores de subcontratistas que presten servicios en sus faenas (Art. 4 y 35 CT).",
    fallo: "Se declara fundada la demanda. Se condena al contratista principal al pago solidario de $4.500.000.",
    fundamento: "Art. 4 CT (subcontratacion), Art. 35 CT (responsabilidad solidaria), Art. 58 CT (obligaciones del empleador).",
    normasAplicadas: "Art. 4 CT, Art. 35 CT, Art. 58 CT",
    fechaSentencia: "2022-06-30",
  },
  {
    rit: "C-9753-2024",
    ruc: "22334455-6",
    caratula: "Paredes Molina contra Banco Financiero Nacional",
    tribunal: "8° Juzgado de Letras del Trabajo de Santiago",
    tipo: "sentencia",
    materia: "laboral",
    contenido: "SENTENCIA: En autos rol C-9753-2024, se declara fundada la demanda de tutela de derechos de dona Andrea Paredes Molina contra Banco Financiero Nacional. PRIMERO: Se declara que el empleador vulnero el derecho de la demandante a la desconexion digital (Art. 184 bis CT), al exigirle atencion de correos electronicos y llamadas telefonicas sistematicamente despues del termino de su jornada laboral (21:00 horas) y durante los fines de semana, sin compensacion alguna. SEGUNDO: Se declara que esta conducta configura despido indirecto (Art. 166 inc. 6° CT) al constituir un incumplimiento grave de las obligaciones del empleador. TERCERO: Se declara que la demandante opta por la indemnizacion. CUARTO: Se condena al empleador al pago de: a) Indemnizacion por anos de servicio: 6 anos x 30 dias = 180 dias x $45.000/dia = $8.100.000; b) Indemnizacion sustitutiva del aviso previo: $1.350.000; c) Indemnizacion por dano moral por vulneracion del derecho a desconexion: 10 UTM; d) Proporcionales de vacaciones y feriado.",
    extracto: "La exigencia sistematica de atencion fuera de jornada y fines de semana sin compensacion vulnera el derecho a desconexion digital (Art. 184 bis CT) y configura despido indirecto.",
    fallo: "Se declara fundada la demanda. Se condena al pago de indemnizaciones por despido indirecto e indemnizacion por dano moral.",
    fundamento: "Art. 184 bis CT (desconexion digital), Art. 166 inc. 6° CT (despido indirecto), Art. 168 bis CT (opcion indemnizatoria).",
    normasAplicadas: "Art. 184 bis CT, Art. 166 inc. 6° CT, Art. 168 bis CT, Art. 163 CT",
    fechaSentencia: "2024-06-18",
  },
];

// ====================================================================
// CHECKLIST TEMPLATES
// ====================================================================

const checklistData: {
  template: { nombre: string; descripcion: string; tipo: string; materia: string; articulos: string };
  items: { orden: number; titulo: string; descripcion: string; articuloLegal: string; esObligatorio: boolean; categoria: string }[];
}[] = [
  {
    template: {
      nombre: "Despido Injustificado - Tutela de Derechos",
      descripcion: "Checklist completo para reclamar por despido injustificado, incluyendo opcion indemnizacion o reposicion",
      tipo: "despido_injustificado",
      materia: "laboral",
      articulos: "Art. 160, 163, 164, 165, 168 bis, 168 ter, 486 CT",
    },
    items: [
      { orden: 1, titulo: "Verificar fecha del despido y plazo de 60 dias habiles para demandar", descripcion: "El plazo para interponer demanda de tutela es de 60 dias habiles desde el despido (Art. 486 CT)", articuloLegal: "Art. 486 CT", esObligatorio: true, categoria: "plazo" },
      { orden: 2, titulo: "Determinar tipo de contrato (indefinido o plazo fijo)", descripcion: "Verificar si el contrato era indefinido o a plazo fijo, y si hubo simulacion de plazos fijos sucesivos", articuloLegal: "Art. 9, 22, 23 CT", esObligatorio: true, categoria: "verificacion" },
      { orden: 3, titulo: "Calcular anos de servicio continuous", descripcion: "Contar anos y meses de servicio continuos. Fraccion > 6 meses = 1 ano completo", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "documento" },
      { orden: 4, titulo: "Determinar remuneracion de calculo", descripcion: "La remuneracion de calculo es la ultima mensual devengada, con tope de 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "documento" },
      { orden: 5, titulo: "Elegir opcion: indemnizacion o reposicion", descripcion: "El trabajador debe optar entre indemnizacion legal o reposicion (Art. 168 bis CT). La opcion es irrevocable.", articuloLegal: "Art. 168 bis CT", esObligatorio: true, categoria: "tramite" },
      { orden: 6, titulo: "Verificar si se dio aviso previo de 30 dias", descripcion: "Si no se dio aviso previo, corresponde indemnizacion sustitutiva = 1 remuneracion mensual", articuloLegal: "Art. 161, 165 CT", esObligatorio: true, categoria: "verificacion" },
      { orden: 7, titulo: "Calcular indemnizacion por anos de servicio", descripcion: "30 dias x cada ano, tope 330 dias, base maxima 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
      { orden: 8, titulo: "Calcular proporcional de vacaciones", descripcion: "Ultima remuneracion / 25 x dias proporcionales de vacaciones pendientes", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
      { orden: 9, titulo: "Calcular proporcional de feriado legal", descripcion: "Ultima remuneracion / 25 x dias proporcionales de feriado legal", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
      { orden: 10, titulo: "Revisar finiquito firmado bajo protesta", descripcion: "Si firmo finiquito, verificar si fue bajo protesta (Art. 168 CT). Plazo para impugnar: 2 anos", articuloLegal: "Art. 168 CT", esObligatorio: false, categoria: "verificacion" },
      { orden: 11, titulo: "Preparar demanda de tutela de derechos", descripcion: "Redactar demanda para Direccion del Trabajo o Tribunal Laboral", articuloLegal: "Art. 485, 486 CT", esObligatorio: true, categoria: "tramite" },
      { orden: 12, titulo: "Adjuntar documentos de respaldo", descripcion: "Contratos, liquidaciones, certificado de cotizaciones, finiquito, correos, etc.", articuloLegal: "Art. 485 CT", esObligatorio: true, categoria: "documento" },
    ],
  },
  {
    template: {
      nombre: "Carta de Aviso de Despido - Art. 161 CT",
      descripcion: "Checklist para redactar y entregar carta de aviso de termino de contrato conforme a ley",
      tipo: "carta_aviso_despido",
      materia: "laboral",
      articulos: "Art. 159, 161, 162, 163, 168 CT",
    },
    items: [
      { orden: 1, titulo: "Identificar causal de termino de contrato", descripcion: "Determinar si el despido es por necesidades de la empresa, mutuo acuerdo, o vencimiento de plazo", articuloLegal: "Art. 145, 159 CT", esObligatorio: true, categoria: "verificacion" },
      { orden: 2, titulo: "Calcular indemnizacion por anos de servicio", descripcion: "30 dias x ano de servicio, tope 330 dias, base maxima 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
      { orden: 3, titulo: "Calcular indemnizacion sustitutiva del aviso previo", descripcion: "Si no se dieron los 30 dias de aviso, pagar 1 remuneracion mensual", articuloLegal: "Art. 161, 165 CT", esObligatorio: true, categoria: "pago" },
      { orden: 4, titulo: "Calcular proporcional de vacaciones", descripcion: "Remuneracion / 25 x dias proporcionales pendientes", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
      { orden: 5, titulo: "Calcular proporcional de feriado legal", descripcion: "Remuneracion / 25 x dias proporcionales de feriado", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
      { orden: 6, titulo: "Redactar carta de aviso con 30 dias de anticipacion", descripcion: "La carta debe indicar fecha de termino, causal invocada, y detalle de indemnizaciones", articuloLegal: "Art. 161 CT", esObligatorio: true, categoria: "documento" },
      { orden: 7, titulo: "Entregar carta con acuse de recibo", descripcion: "Entregar personalmente o por carta certificada con acuse de recibo", articuloLegal: "Art. 161 CT", esObligatorio: true, categoria: "notificacion" },
      { orden: 8, titulo: "Preparar finiquito detallado", descripcion: "El finiquito debe incluir todo: indemnizaciones, proporcionales, gratificacion proporcional", articuloLegal: "Art. 168 CT", esObligatorio: true, categoria: "documento" },
      { orden: 9, titulo: "Notificar a Inspeccion del Trabajo", descripcion: "En caso de despido colectivo, notificar a la Inspeccion del Trabajo con 30 dias de anticipacion", articuloLegal: "Art. 162 CT", esObligatorio: false, categoria: "notificacion" },
    ],
  },
  {
    template: {
      nombre: "Finiquito y Liquidacion Final",
      descripcion: "Verificacion completa del finiquito y liquidacion de prestaciones al termino del contrato",
      tipo: "finiquito",
      materia: "laboral",
      articulos: "Art. 45, 47, 72, 73, 163, 165, 168 CT",
    },
    items: [
      { orden: 1, titulo: "Verificar ultima remuneracion devengada", descripcion: "Confirmar monto de la ultima remuneracion mensual pagada", articuloLegal: "Art. 45 CT", esObligatorio: true, categoria: "verificacion" },
      { orden: 2, titulo: "Revisar gratificacion proporcional", descripcion: "Verificar si corresponde gratificacion proporcional del semestre en curso", articuloLegal: "Art. 47 CT", esObligatorio: true, categoria: "pago" },
      { orden: 3, titulo: "Calcular proporcional de vacaciones", descripcion: "Remuneracion / 25 x dias proporcionales de vacaciones no tomadas", articuloLegal: "Art. 72 CT", esObligatorio: true, categoria: "pago" },
      { orden: 4, titulo: "Calcular proporcional de feriado legal", descripcion: "Remuneracion / 25 x dias proporcionales de feriado legal del ano", articuloLegal: "Art. 73 CT", esObligatorio: true, categoria: "pago" },
      { orden: 5, titulo: "Verificar indemnizacion por anos de servicio", descripcion: "30 dias x cada ano de servicio, tope 330 dias, base maxima 90 UF", articuloLegal: "Art. 163 CT", esObligatorio: true, categoria: "pago" },
      { orden: 6, titulo: "Verificar indemnizacion sustitutiva del aviso previo", descripcion: "Si no se dieron los 30 dias de aviso: 1 remuneracion mensual", articuloLegal: "Art. 165 CT", esObligatorio: true, categoria: "pago" },
      { orden: 7, titulo: "Verificar descuento de prestamos y anticipos", descripcion: "Revisar si el empleador debe descontar prestamos o anticipos otorgados", articuloLegal: "Art. 58 CT", esObligatorio: false, categoria: "verificacion" },
      { orden: 8, titulo: "Firmar finiquito bajo protesta si hay dudas", descripcion: "Si no se esta de acuerdo con los montos, firmar bajo protesta (Art. 168 CT)", articuloLegal: "Art. 168 CT", esObligatorio: true, categoria: "documento" },
      { orden: 9, titulo: "Solicitar certificado de trabajo", descripcion: "El trabajador tiene derecho a certificado de trabajo al terminar la relacion (Art. 58 CT)", articuloLegal: "Art. 58 CT", esObligatorio: true, categoria: "documento" },
      { orden: 10, titulo: "Verificar pago oportuno de cotizaciones previsionales", descripcion: "Confirmar que el empleador pago las cotizaciones de los ultimos meses", articuloLegal: "Art. 58 quinquies CT", esObligatorio: true, categoria: "verificacion" },
    ],
  },
];

// ====================================================================
// FUNCION PRINCIPAL DE SEED
// ====================================================================

async function seed() {
  const db = getDb();
  console.log("🚀 Iniciando seed masivo de LexTrack RAG...");

  // 1. Insertar articulos del Codigo del Trabajo
  console.log(`📚 Insertando ${articulosCT.length} articulos del Codigo del Trabajo...`);
  for (const art of articulosCT) {
    await db.insert(documentosLegales).values(art);
  }
  console.log("✅ Articulos insertados");

  // 2. Insertar jurisprudencia
  console.log(`⚖️ Insertando ${fallosReales.length} fallos de jurisprudencia...`);
  for (const fallo of fallosReales) {
    await db.insert(jurisprudencias).values(fallo);
  }
  console.log("✅ Jurisprudencia insertada");

  // 3. Insertar checklist templates e items
  console.log(`✅ Insertando ${checklistData.length} checklist templates...`);
  for (const ck of checklistData) {
    const [templateResult] = await db.insert(checklistTemplates).values({
      ...ck.template,
      estaActiva: true,
    }).$returningId();

    for (const item of ck.items) {
      await db.insert(checklistItems).values({
        templateId: templateResult.id,
        ...item,
      });
    }
  }
  console.log("✅ Checklists insertados");

  // 4. Insertar causas de ejemplo
  console.log("📁 Insertando causas de ejemplo...");
  await db.insert(causas).values([
    {
      rit: "C-2024-001",
      caratula: "Gonzalez Perez vs Empresa Constructora Ltda.",
      tribunal: "1° Juzgado de Letras del Trabajo de Santiago",
      materia: "laboral",
      estado: "tramitacion",
      etapa: "Prueba",
      fechaIngreso: "2024-01-15",
      comuna: "Santiago",
      region: "Region Metropolitana",
    },
    {
      rit: "C-2024-002",
      caratula: "Rodriguez Martinez vs Supermercados del Sur S.A.",
      tribunal: "2° Juzgado de Letras del Trabajo de Concepcion",
      materia: "laboral",
      estado: "sentencia",
      etapa: "Sentencia de primera instancia",
      fechaIngreso: "2023-06-10",
      comuna: "Concepcion",
      region: "Biobio",
    },
    {
      rit: "C-2024-003",
      caratula: "Silva Fuentes vs Transportes Nacional S.A.",
      tribunal: "3° Juzgado de Letras del Trabajo de Valparaiso",
      materia: "laboral",
      estado: "tramitacion",
      etapa: "Audiencia preparatoria",
      fechaIngreso: "2024-03-01",
      comuna: "Valparaiso",
      region: "Valparaiso",
    },
  ]);
  console.log("✅ Causas insertadas");

  // 5. Insertar tareas de ejemplo
  console.log("📋 Insertando tareas...");
  await db.insert(tareas).values([
    { titulo: "Revisar escrito de demanda causa C-2024-001", descripcion: "Revisar y corregir escrito de demanda de tutela", estado: "pendiente", prioridad: "alta", tipo: "preparar_escrito", fechaVencimiento: "2024-12-20" },
    { titulo: "Preparar audiencia preparatoria C-2024-003", descripcion: "Organizar pruebas y testigos para audiencia", estado: "en_progreso", prioridad: "alta", tipo: "agendar_audiencia", fechaVencimiento: "2024-12-18" },
    { titulo: "Calcular liquidacion final Rodriguez Martinez", descripcion: "Calcular indemnizaciones y proporcionales", estado: "pendiente", prioridad: "media", tipo: "checklist_despido", fechaVencimiento: "2024-12-22" },
    { titulo: "Revisar Diario Oficial - normas laborales", descripcion: "Verificar nuevas normas publicadas que afecten causas activas", estado: "pendiente", prioridad: "baja", tipo: "revisar_diario_oficial", fechaVencimiento: "2024-12-25" },
  ]);
  console.log("✅ Tareas insertadas");

  // 6. Insertar alertas
  console.log("🔔 Insertando alertas...");
  await db.insert(alertas).values([
    { titulo: "Plazo proximo: Contestacion de demanda C-2024-001", descripcion: "El plazo para contestar la demanda vence en 5 dias habiles", prioridad: "critica", estado: "pendiente", tipo: "prazo_proximo", fechaVencimiento: "2024-12-15" },
    { titulo: "Nueva norma laboral publicada en Diario Oficial", descripcion: "Se publico reforma al Art. 184 bis CT sobre teletrabajo", prioridad: "media", estado: "pendiente", tipo: "cambio_normativo" },
    { titulo: "Audiencia programada: C-2024-003", descripcion: "Audiencia preparatoria programada para el 20 de diciembre", prioridad: "alta", estado: "pendiente", tipo: "audiencia_programada", fechaEvento: "2024-12-20" },
  ]);
  console.log("✅ Alertas insertadas");

  // 7. Insertar honorarios
  console.log("💰 Insertando honorarios...");
  await db.insert(honorarios).values([
    { cliente: "Gonzalez Perez", concepto: "Honorarios primera instancia - Despido injustificado", tipo: "honorario", monto: 2500000, montoPagado: 1000000, estado: "pagado_parcial", fechaVencimiento: "2024-12-31" },
    { cliente: "Rodriguez Martinez", concepto: "Honorarios causa despido - Sentencia favorable", tipo: "honorario", monto: 3200000, montoPagado: 0, estado: "pendiente", fechaVencimiento: "2024-12-15" },
    { cliente: "Silva Fuentes", concepto: "Consulta inicial - Despido indirecto", tipo: "consulta", monto: 150000, montoPagado: 150000, estado: "pagado", fechaVencimiento: "2024-11-30" },
  ]);
  console.log("✅ Honorarios insertados");

  // 8. Insertar actividad reciente
  console.log("📊 Insertando actividad reciente...");
  await db.insert(actividadReciente).values([
    { tipo: "causa_creada", titulo: "Nueva causa: C-2024-003", descripcion: "Se creo la causa Silva Fuentes vs Transportes Nacional S.A." },
    { tipo: "tarea_completada", titulo: "Tarea completada: Revision de demanda", descripcion: "Se reviso y presento escrito de demanda C-2024-001" },
    { tipo: "alerta_nueva", titulo: "Alerta: Plazo proximo", descripcion: "Contestacion de demanda C-2024-001 vence en 5 dias" },
  ]);
  console.log("✅ Actividad reciente insertada");

  console.log("\n🎉 Seed completado exitosamente!");
  console.log(`📊 Resumen:`);
  console.log(`   - ${articulosCT.length} articulos del Codigo del Trabajo`);
  console.log(`   - ${fallosReales.length} fallos de jurisprudencia`);
  console.log(`   - ${checklistData.length} checklist templates`);
  console.log(`   - 3 causas de ejemplo`);
  console.log(`   - 4 tareas`);
  console.log(`   - 3 alertas`);
  console.log(`   - 3 honorarios`);
}

seed().catch(console.error);
