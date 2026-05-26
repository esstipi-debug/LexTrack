import { describe, test, expect } from "vitest";
import {
  generarActaRecepcion,
  generarInformeFinal,
  generarNotificacionMedidas,
  type ActaRecepcionInput,
  type InformeFinalInput,
  type NotificacionMedidasInput,
} from "./documentos";

const actaBase: ActaRecepcionInput = {
  folio: "KRN-2026-0042",
  fecha: "2026-05-20",
  hora: "10:30",
  empresa: "Transportes del Sur SpA",
  denuncianteNombre: "Ana María López",
  denuncianteRut: "15.432.876-5",
  denuncianteCargo: "Asistente contable",
  denunciadoNombre: "Carlos Muñoz Reyes",
  denunciadoCargo: "Jefe de operaciones",
  tipo: "acoso_laboral",
  descripcionHechos:
    "El denunciado habría realizado comentarios humillantes y hostilizantes de manera reiterada durante reuniones de equipo.",
  canalDenuncia: "Correo electrónico",
  receptor: "Valentina Soto",
  receptorCargo: "Jefa de RRHH",
};

describe("generarActaRecepcion", () => {
  test("acta recepcion includes folio and fecha", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("KRN-2026-0042");
    expect(out).toContain("20 de mayo de 2026");
  });

  test("acta recepcion includes denunciante and denunciado", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("Ana María López");
    expect(out).toContain("15.432.876-5");
    expect(out).toContain("Carlos Muñoz Reyes");
    expect(out).toContain("Jefe de operaciones");
  });

  test("acta recepcion mentions Ley 21.643", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("21.643");
    expect(out).toContain("LEY KARIN");
  });

  test("acta recepcion cites Art. 211-A to 211-E and Art. 211-B inc. 3", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("211-A");
    expect(out).toContain("211-E");
    expect(out).toContain("211-B inciso 3°");
  });

  test("acta recepcion includes legal deadlines", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("3 días corridos");
    expect(out).toContain("30 días corridos");
  });

  test("acta recepcion includes receptor info", () => {
    const out = generarActaRecepcion(actaBase);
    expect(out).toContain("Valentina Soto");
    expect(out).toContain("Jefa de RRHH");
  });
});

describe("generarInformeFinal", () => {
  const informeInput: InformeFinalInput = {
    folio: "KRN-2026-0042",
    empresa: "Transportes del Sur SpA",
    fecha: "2026-06-15",
    investigador: "Valentina Soto",
    investigadorCargo: "Jefa de RRHH",
    denuncianteNombre: "Ana María López",
    denuncianteRut: "15.432.876-5",
    denuncianteCargo: "Asistente contable",
    denunciadoNombre: "Carlos Muñoz Reyes",
    denunciadoRut: "12.876.543-K",
    denunciadoCargo: "Jefe de operaciones",
    tipo: "acoso_laboral",
    fechaRecepcion: "2026-05-20",
    fechaInicioInvestigacion: "2026-05-21",
    fechaCierre: "2026-06-15",
    descripcionHechos: "Hostigamiento reiterado en reuniones de equipo.",
    actuaciones: [
      {
        fecha: "2026-05-22",
        tipo: "Entrevista",
        descripcion: "Declaración del denunciante",
        actor: "V. Soto",
      },
      {
        fecha: "2026-05-25",
        tipo: "Entrevista",
        descripcion: "Declaración de testigo",
      },
    ],
    hechosAcreditados:
      "Se acredita conducta de hostigamiento conforme al Art. 2° CT.",
    calificacionJuridica: "Acoso laboral conforme al Art. 2° CT modificado por Ley 21.643.",
    conclusion: "acreditado",
    fundamentoConclusion:
      "Los testimonios y evidencia documental acreditan la conducta denunciada.",
    medidasPropuestas: ["Amonestación escrita severa", "Capacitación obligatoria"],
    sancionesPropuestas: ["Multa equivalente al 25% de la remuneración mensual"],
  };

  test("informe final includes all required sections", () => {
    const out = generarInformeFinal(informeInput);
    expect(out).toContain("ANTECEDENTES");
    expect(out).toContain("HECHOS DENUNCIADOS");
    expect(out).toContain("DILIGENCIAS PRACTICADAS");
    expect(out).toContain("HECHOS ACREDITADOS");
    expect(out).toContain("CALIFICACIÓN JURÍDICA");
    expect(out).toContain("CONCLUSIONES");
    expect(out).toContain("MEDIDAS PROPUESTAS");
  });

  test("informe final cites Art. 211-C CT (via Art. 211-A to 211-E)", () => {
    const out = generarInformeFinal(informeInput);
    expect(out).toContain("211-A");
    expect(out).toContain("211-E");
    expect(out).toContain("Código del Trabajo");
  });

  test("informe final cites Art. 211-E for sanctions deadline", () => {
    const out = generarInformeFinal(informeInput);
    expect(out).toContain("artículo 211-E del Código del Trabajo");
    expect(out).toContain("15 días corridos");
  });

  test("informe final includes investigator name and conclusion", () => {
    const out = generarInformeFinal(informeInput);
    expect(out).toContain("Valentina Soto");
    expect(out).toContain("Jefa de RRHH");
    expect(out).toContain("ACREDITADA la conducta denunciada");
  });

  test("informe final includes denunciante and denunciado info", () => {
    const out = generarInformeFinal(informeInput);
    expect(out).toContain("Ana María López");
    expect(out).toContain("Carlos Muñoz Reyes");
    expect(out).toContain("12.876.543-K");
  });
});

describe("generarNotificacionMedidas", () => {
  const medidasInput: NotificacionMedidasInput = {
    folio: "KRN-2026-0042",
    fecha: "2026-05-22",
    empresa: "Transportes del Sur SpA",
    representanteLegal: "Roberto Díaz",
    denuncianteNombre: "Ana María López",
    denuncianteRut: "15.432.876-5",
    denuncianteCargo: "Asistente contable",
    medidas: [
      {
        tipo: "Separación física",
        descripcion: "Reasignación de oficina de la denunciante al piso 3.",
      },
      {
        tipo: "Reasignación de funciones",
        descripcion:
          "El denunciado reportará temporalmente a otra jefatura.",
      },
      {
        tipo: "Asistencia psicológica",
        descripcion: "Derivación de la denunciante a mutual para atención.",
      },
    ],
    fechaInicio: "2026-05-23",
  };

  test("notificacion medidas cites Art. 211-B inc. 3°", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toContain("211-B inciso 3°");
  });

  test("notificacion lists all measures with tipo and descripcion", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toContain("Separación física");
    expect(out).toContain("Reasignación de oficina de la denunciante al piso 3");
    expect(out).toContain("Reasignación de funciones");
    expect(out).toContain("Asistencia psicológica");
  });

  test("notificacion includes denunciante info", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toContain("Ana María López");
    expect(out).toContain("15.432.876-5");
  });

  test("notificacion mentions Ley 21.643", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toContain("21.643");
  });

  test("notificacion mentions prohibition of retaliation", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toMatch(/prohibida.*represalia/i);
  });

  test("notificacion includes representante legal", () => {
    const out = generarNotificacionMedidas(medidasInput);
    expect(out).toContain("Roberto Díaz");
  });
});
