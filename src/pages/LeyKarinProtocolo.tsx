import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  UserCog,
  Inbox,
  FileSignature,
  CheckCircle2,
  Download,
  Copy,
} from "lucide-react";

type Canal =
  | "presencial"
  | "escrito_fisico"
  | "formulario_web"
  | "correo_electronico"
  | "linea_telefonica"
  | "buzon_anonimo";

const CANAL_OPCIONES: { value: Canal; label: string }[] = [
  { value: "presencial", label: "Atención presencial" },
  { value: "escrito_fisico", label: "Carta o formulario físico" },
  { value: "formulario_web", label: "Formulario web" },
  { value: "correo_electronico", label: "Correo electrónico dedicado" },
  { value: "linea_telefonica", label: "Línea telefónica" },
  { value: "buzon_anonimo", label: "Buzón anónimo" },
];

interface FormState {
  razonSocial: string;
  rut: string;
  rubro: string;
  domicilioPrincipal: string;
  dotacionTotal: string;
  sucursales: string;

  encargadoNombre: string;
  encargadoCargo: string;
  encargadoEmail: string;
  encargadoTelefono: string;
  encargadoSuplenteNombre: string;
  encargadoSuplenteCargo: string;

  canalesDenuncia: Canal[];
  emailDenuncias: string;
  telefonoDenuncias: string;
  urlFormulario: string;

  representanteLegalNombre: string;
  representanteLegalRut: string;
  fechaVigencia: string;
}

const initialState: FormState = {
  razonSocial: "",
  rut: "",
  rubro: "",
  domicilioPrincipal: "",
  dotacionTotal: "",
  sucursales: "",
  encargadoNombre: "",
  encargadoCargo: "",
  encargadoEmail: "",
  encargadoTelefono: "",
  encargadoSuplenteNombre: "",
  encargadoSuplenteCargo: "",
  canalesDenuncia: ["presencial", "correo_electronico"],
  emailDenuncias: "",
  telefonoDenuncias: "",
  urlFormulario: "",
  representanteLegalNombre: "",
  representanteLegalRut: "",
  fechaVigencia: new Date().toISOString().slice(0, 10),
};

const STEPS = [
  { id: 1, title: "Empresa", icon: Building2 },
  { id: 2, title: "Encargado/a", icon: UserCog },
  { id: 3, title: "Canales", icon: Inbox },
  { id: 4, title: "Firma", icon: FileSignature },
  { id: 5, title: "Resultado", icon: CheckCircle2 },
];

export default function LeyKarinProtocolo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [output, setOutput] = useState<{
    protocolo: string;
    checklist: string;
  } | null>(null);

  const generar = trpc.leykarin.generarProtocolo.useMutation({
    onSuccess: (data) => {
      setOutput({ protocolo: data.protocolo, checklist: data.checklist });
      setStep(5);
      toast.success("Protocolo generado");
    },
    onError: (err) => {
      toast.error("No se pudo generar: " + err.message);
    },
  });

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleCanal = (c: Canal) => {
    setForm((f) => ({
      ...f,
      canalesDenuncia: f.canalesDenuncia.includes(c)
        ? f.canalesDenuncia.filter((x) => x !== c)
        : [...f.canalesDenuncia, c],
    }));
  };

  const canNext = (): boolean => {
    if (step === 1)
      return !!(
        form.razonSocial &&
        form.rut &&
        form.rubro &&
        form.domicilioPrincipal &&
        form.dotacionTotal
      );
    if (step === 2)
      return !!(
        form.encargadoNombre &&
        form.encargadoCargo &&
        form.encargadoEmail
      );
    if (step === 3) return form.canalesDenuncia.length > 0;
    if (step === 4)
      return !!(
        form.representanteLegalNombre &&
        form.representanteLegalRut &&
        form.fechaVigencia
      );
    return true;
  };

  const submit = () => {
    const sucursalesArr = form.sucursales
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    generar.mutate({
      razonSocial: form.razonSocial.trim(),
      rut: form.rut.trim(),
      rubro: form.rubro.trim(),
      domicilioPrincipal: form.domicilioPrincipal.trim(),
      dotacionTotal: parseInt(form.dotacionTotal, 10) || 0,
      sucursales: sucursalesArr,
      encargadoNombre: form.encargadoNombre.trim(),
      encargadoCargo: form.encargadoCargo.trim(),
      encargadoEmail: form.encargadoEmail.trim(),
      encargadoTelefono: form.encargadoTelefono.trim() || undefined,
      encargadoSuplenteNombre: form.encargadoSuplenteNombre.trim() || undefined,
      encargadoSuplenteCargo: form.encargadoSuplenteCargo.trim() || undefined,
      canalesDenuncia: form.canalesDenuncia,
      emailDenuncias: form.emailDenuncias.trim() || undefined,
      telefonoDenuncias: form.telefonoDenuncias.trim() || undefined,
      urlFormulario: form.urlFormulario.trim() || undefined,
      representanteLegalNombre: form.representanteLegalNombre.trim(),
      representanteLegalRut: form.representanteLegalRut.trim(),
      fechaVigencia: form.fechaVigencia,
    });
  };

  const descargar = (contenido: string, nombre: string) => {
    const blob = new Blob([contenido], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success("Copiado al portapapeles");
  };

  const progreso = (step / STEPS.length) * 100;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ley-karin")}
            className="-ml-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Generador de Protocolo Ley Karin
          </h1>
          <p className="text-gray-500 text-sm">
            Ley 21.643 — Protocolo de prevención, investigación y sanción del
            acoso laboral, sexual y violencia en el trabajo
          </p>
        </div>
        <Badge variant="secondary">Paso {step} de {STEPS.length}</Badge>
      </div>

      <Progress value={progreso} className="h-2" />

      <div className="flex justify-between text-xs text-gray-500">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-1 ${
                active
                  ? "text-purple-700 font-semibold"
                  : done
                  ? "text-green-600"
                  : ""
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Empresa */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Datos de la empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Razón social *</Label>
                <Input
                  value={form.razonSocial}
                  onChange={(e) => update("razonSocial", e.target.value)}
                  placeholder="Ej. Comercializadora ABC SpA"
                />
              </div>
              <div>
                <Label>RUT *</Label>
                <Input
                  value={form.rut}
                  onChange={(e) => update("rut", e.target.value)}
                  placeholder="76.123.456-7"
                />
              </div>
              <div>
                <Label>Rubro *</Label>
                <Input
                  value={form.rubro}
                  onChange={(e) => update("rubro", e.target.value)}
                  placeholder="Ej. Retail, construcción, servicios"
                />
              </div>
              <div>
                <Label>Dotación total *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.dotacionTotal}
                  onChange={(e) => update("dotacionTotal", e.target.value)}
                  placeholder="Ej. 42"
                />
              </div>
            </div>
            <div>
              <Label>Domicilio principal *</Label>
              <Input
                value={form.domicilioPrincipal}
                onChange={(e) => update("domicilioPrincipal", e.target.value)}
                placeholder="Av. Apoquindo 1234, Las Condes"
              />
            </div>
            <div>
              <Label>
                Sucursales{" "}
                <span className="text-gray-400 font-normal">
                  (una por línea, opcional)
                </span>
              </Label>
              <Textarea
                value={form.sucursales}
                onChange={(e) => update("sucursales", e.target.value)}
                placeholder={"Sucursal Centro - Bandera 100\nSucursal Maipú - Av. Pajaritos 500"}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Encargado */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" /> Persona encargada de denuncias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre titular *</Label>
                <Input
                  value={form.encargadoNombre}
                  onChange={(e) => update("encargadoNombre", e.target.value)}
                />
              </div>
              <div>
                <Label>Cargo *</Label>
                <Input
                  value={form.encargadoCargo}
                  onChange={(e) => update("encargadoCargo", e.target.value)}
                  placeholder="Ej. Jefe de RRHH"
                />
              </div>
              <div>
                <Label>Correo *</Label>
                <Input
                  type="email"
                  value={form.encargadoEmail}
                  onChange={(e) => update("encargadoEmail", e.target.value)}
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.encargadoTelefono}
                  onChange={(e) => update("encargadoTelefono", e.target.value)}
                />
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-3">
                Suplente (recomendado, para conflicto de interés o ausencia)
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre suplente</Label>
                  <Input
                    value={form.encargadoSuplenteNombre}
                    onChange={(e) =>
                      update("encargadoSuplenteNombre", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Cargo suplente</Label>
                  <Input
                    value={form.encargadoSuplenteCargo}
                    onChange={(e) =>
                      update("encargadoSuplenteCargo", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Canales */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" /> Canales de denuncia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Marca todos los canales que la empresa habilitará. Mínimo uno.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CANAL_OPCIONES.map((c) => (
                <label
                  key={c.value}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Checkbox
                    checked={form.canalesDenuncia.includes(c.value)}
                    onCheckedChange={() => toggleCanal(c.value)}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <Label>Correo de denuncias</Label>
                <Input
                  type="email"
                  value={form.emailDenuncias}
                  onChange={(e) => update("emailDenuncias", e.target.value)}
                  placeholder="denuncias@empresa.cl"
                />
              </div>
              <div>
                <Label>Teléfono de denuncias</Label>
                <Input
                  value={form.telefonoDenuncias}
                  onChange={(e) => update("telefonoDenuncias", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>URL del formulario web</Label>
                <Input
                  value={form.urlFormulario}
                  onChange={(e) => update("urlFormulario", e.target.value)}
                  placeholder="https://empresa.cl/denuncias"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Firma */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5" /> Firma y vigencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Representante legal *</Label>
                <Input
                  value={form.representanteLegalNombre}
                  onChange={(e) =>
                    update("representanteLegalNombre", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>RUT representante *</Label>
                <Input
                  value={form.representanteLegalRut}
                  onChange={(e) =>
                    update("representanteLegalRut", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>Fecha de vigencia *</Label>
                <Input
                  type="date"
                  value={form.fechaVigencia}
                  onChange={(e) => update("fechaVigencia", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Resultado */}
      {step === 5 && output && (
        <div className="space-y-4">
          <Card className="bg-green-50 border-green-200 dark:bg-green-900/10">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">
                  Protocolo y checklist listos
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Revísalos, edítalos si corresponde y entrégalos al cliente.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Protocolo (Markdown)</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copiar(output.protocolo)}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    descargar(
                      output.protocolo,
                      `protocolo-karin-${form.rut || "empresa"}.md`
                    )
                  }
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Descargar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={output.protocolo}
                onChange={(e) =>
                  setOutput({ ...output, protocolo: e.target.value })
                }
                rows={18}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Checklist de cumplimiento</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copiar(output.checklist)}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    descargar(
                      output.checklist,
                      `checklist-karin-${form.rut || "empresa"}.md`
                    )
                  }
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Descargar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={output.checklist}
                onChange={(e) =>
                  setOutput({ ...output, checklist: e.target.value })
                }
                rows={10}
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer nav */}
      {step < 5 && (
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
            >
              Continuar <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={!canNext() || generar.isPending}
            >
              {generar.isPending ? "Generando..." : "Generar protocolo"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
