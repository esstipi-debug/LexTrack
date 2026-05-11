import { describe, it, expect } from "vitest";
import {
  generarProtocoloKarin,
  generarChecklistKarin,
  type EmpresaInput,
} from "./protocolo";

const empresaBase: EmpresaInput = {
  razonSocial: "Comercializadora ABC SpA",
  rut: "76.123.456-7",
  rubro: "Retail",
  domicilioPrincipal: "Av. Apoquindo 1234, Las Condes",
  dotacionTotal: 42,
  sucursales: ["Sucursal Centro - Bandera 100", "Sucursal Maipú"],
  encargadoNombre: "María Pérez",
  encargadoCargo: "Jefa de RRHH",
  encargadoEmail: "maria.perez@abc.cl",
  encargadoTelefono: "+56 9 1234 5678",
  encargadoSuplenteNombre: "Pedro Soto",
  encargadoSuplenteCargo: "Subgerente de Personas",
  canalesDenuncia: ["presencial", "correo_electronico", "formulario_web"],
  emailDenuncias: "denuncias@abc.cl",
  urlFormulario: "https://abc.cl/denuncias",
  representanteLegalNombre: "Juan González",
  representanteLegalRut: "12.345.678-9",
  fechaVigencia: "2026-06-01",
};

describe("generarProtocoloKarin", () => {
  it("incluye razón social, RUT y dotación", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("Comercializadora ABC SpA");
    expect(out).toContain("76.123.456-7");
    expect(out).toContain("42 trabajadores");
  });

  it("cita la Ley 21.643 y los artículos del CT relevantes", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("Ley N° 21.643");
    expect(out).toContain("211-A");
    expect(out).toContain("211-E");
    expect(out).toContain("184");
  });

  it("lista todas las sucursales", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("Sucursal Centro - Bandera 100");
    expect(out).toContain("Sucursal Maipú");
  });

  it("incluye el plazo legal de 30 días corridos para investigación", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("30 días corridos");
  });

  it("incluye el plazo de 3 días corridos para medidas de resguardo", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("3 días corridos");
  });

  it("incluye datos del encargado titular y suplente cuando se proveen", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("María Pérez");
    expect(out).toContain("Jefa de RRHH");
    expect(out).toContain("maria.perez@abc.cl");
    expect(out).toContain("Pedro Soto");
    expect(out).toContain("Subgerente de Personas");
  });

  it("muestra mensaje cuando no hay suplente", () => {
    const sinSuplente: EmpresaInput = {
      ...empresaBase,
      encargadoSuplenteNombre: undefined,
      encargadoSuplenteCargo: undefined,
    };
    const out = generarProtocoloKarin(sinSuplente);
    expect(out).toContain("No se ha designado encargado/a suplente");
  });

  it("lista todos los canales de denuncia configurados", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("Atención presencial");
    expect(out).toContain("Correo electrónico");
    expect(out).toContain("denuncias@abc.cl");
    expect(out).toContain("https://abc.cl/denuncias");
  });

  it("incluye prohibición expresa de represalias", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toMatch(/prohib[ií]da.*represalia/i);
  });

  it("incluye firma del representante legal", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("Juan González");
    expect(out).toContain("12.345.678-9");
  });

  it("usa el dominio violencia de terceros (clientes/proveedores)", () => {
    const out = generarProtocoloKarin(empresaBase);
    expect(out).toContain("terceras personas ajenas a la relación laboral");
  });
});

describe("generarChecklistKarin", () => {
  it("genera checklist con hitos de plazo y acciones", () => {
    const out = generarChecklistKarin(empresaBase);
    expect(out).toContain("CHECKLIST DE CUMPLIMIENTO LEY KARIN");
    expect(out).toContain("María Pérez");
    expect(out).toContain("30 días corridos");
    expect(out).toContain("3 días corridos");
    expect(out).toContain("3 días hábiles");
  });

  it("marca suplente como PENDIENTE si no se proveyó", () => {
    const sinSuplente: EmpresaInput = {
      ...empresaBase,
      encargadoSuplenteNombre: undefined,
    };
    const out = generarChecklistKarin(sinSuplente);
    expect(out).toContain("PENDIENTE");
  });
});
