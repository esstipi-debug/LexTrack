import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Copy, Check, Calendar, Wallet, FileText, Briefcase } from "lucide-react";
import {
  feriadoProporcional,
  avisoPrevio,
  vacacionesPendientes,
  indemnizacionAnosServicio,
  calcularFiniquito,
  formatCLP,
  type MotivoFiniquito,
  type FiniquitoResult,
} from "@/lib/calculos-laborales";

const CTA = "bg-[#1e3a5f] hover:bg-[#16304d] text-white";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
      {copied ? "Copiado" : "Copiar resultado"}
    </Button>
  );
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 space-y-3">
      {children}
    </div>
  );
}

function dateOrNull(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/* ---------------------------- Tab: Feriado ---------------------------- */
function FeriadoTab() {
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [sueldo, setSueldo] = useState(900_000);
  const [resultado, setResultado] =
    useState<{ dias: number; monto: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    const fi = dateOrNull(inicio);
    const ft = dateOrNull(termino);
    if (!fi || !ft) {
      setError("Debes indicar fecha de inicio y término.");
      return;
    }
    if (ft.getTime() < fi.getTime()) {
      setError("La fecha de término debe ser posterior a la de inicio.");
      return;
    }
    setResultado(feriadoProporcional({ fechaInicio: fi, fechaTermino: ft, sueldoMensual: sueldo }));
  };

  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#1e3a5f]" /> Feriado proporcional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Fecha de inicio</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Fecha de término</Label>
            <Input type="date" value={termino} onChange={(e) => setTermino(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Sueldo mensual (CLP)</Label>
            <Input
              type="number"
              min={0}
              step={10_000}
              value={sueldo}
              onChange={(e) => setSueldo(Number(e.target.value))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button onClick={calcular} className={`w-full h-11 ${CTA}`}>
          Calcular feriado proporcional
        </Button>

        {resultado && (
          <ResultBox>
            <p className="text-3xl font-extrabold text-[#1e3a5f] dark:text-blue-300 tabular-nums">
              {formatCLP(resultado.monto)}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{resultado.dias}</strong> día(s) proporcional(es) de feriado.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fundamento: Art. 73 CT. Cálculo: (días trabajados ÷ 365) × 15.
            </p>
            <CopyButton
              text={`Feriado proporcional: ${resultado.dias} día(s) — ${formatCLP(resultado.monto)}`}
            />
          </ResultBox>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Tab: Aviso previo ---------------------------- */
function AvisoTab() {
  const [sueldo, setSueldo] = useState(900_000);
  const [resultado, setResultado] = useState<number | null>(null);

  const calcular = () => setResultado(avisoPrevio(sueldo));

  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#1e3a5f]" /> Indemnización aviso previo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="mb-2 block">Sueldo mensual (CLP)</Label>
          <Input
            type="number"
            min={0}
            step={10_000}
            value={sueldo}
            onChange={(e) => setSueldo(Number(e.target.value))}
          />
        </div>

        <Button onClick={calcular} className={`w-full h-11 ${CTA}`}>
          Calcular aviso previo
        </Button>

        {resultado !== null && (
          <ResultBox>
            <p className="text-3xl font-extrabold text-[#1e3a5f] dark:text-blue-300 tabular-nums">
              {formatCLP(resultado)}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Equivale a un mes de remuneración (sustitutiva del aviso previo).
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fundamento: Art. 162 CT — procede cuando no se da el mes de aviso al trabajador.
            </p>
            <CopyButton text={`Indemnización aviso previo: ${formatCLP(resultado)}`} />
          </ResultBox>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Tab: Vacaciones pendientes ---------------------------- */
function VacacionesTab() {
  const [dias, setDias] = useState(10);
  const [sueldo, setSueldo] = useState(900_000);
  const [resultado, setResultado] = useState<number | null>(null);

  const calcular = () =>
    setResultado(vacacionesPendientes({ diasPendientes: dias, sueldoMensual: sueldo }));

  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#1e3a5f]" /> Vacaciones pendientes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Días acumulados</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="mb-2 block">Sueldo mensual (CLP)</Label>
            <Input
              type="number"
              min={0}
              step={10_000}
              value={sueldo}
              onChange={(e) => setSueldo(Number(e.target.value))}
            />
          </div>
        </div>

        <Button onClick={calcular} className={`w-full h-11 ${CTA}`}>
          Calcular vacaciones pendientes
        </Button>

        {resultado !== null && (
          <ResultBox>
            <p className="text-3xl font-extrabold text-[#1e3a5f] dark:text-blue-300 tabular-nums">
              {formatCLP(resultado)}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {dias} día(s) × (sueldo / 30).
            </p>
            <CopyButton
              text={`Vacaciones pendientes (${dias} días): ${formatCLP(resultado)}`}
            />
          </ResultBox>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Tab: Indemnización años de servicio ---------------------------- */
function IndemnizacionTab() {
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [sueldo, setSueldo] = useState(900_000);
  const [resultado, setResultado] =
    useState<{ anos: number; monto: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    const fi = dateOrNull(inicio);
    const ft = dateOrNull(termino);
    if (!fi || !ft) {
      setError("Debes indicar fecha de inicio y término.");
      return;
    }
    if (ft.getTime() < fi.getTime()) {
      setError("La fecha de término debe ser posterior a la de inicio.");
      return;
    }
    setResultado(
      indemnizacionAnosServicio({
        fechaInicio: fi,
        fechaTermino: ft,
        sueldoMensual: sueldo,
      })
    );
  };

  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#1e3a5f]" /> Indemnización años de servicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Fecha de inicio</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Fecha de término</Label>
            <Input type="date" value={termino} onChange={(e) => setTermino(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Última remuneración mensual (CLP)</Label>
            <Input
              type="number"
              min={0}
              step={10_000}
              value={sueldo}
              onChange={(e) => setSueldo(Number(e.target.value))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button onClick={calcular} className={`w-full h-11 ${CTA}`}>
          Calcular indemnización
        </Button>

        {resultado && (
          <ResultBox>
            <p className="text-3xl font-extrabold text-[#1e3a5f] dark:text-blue-300 tabular-nums">
              {formatCLP(resultado.monto)}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{resultado.anos}</strong> año(s) reconocidos (tope legal: 11).
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fundamento: Art. 163 CT — 1 mes por año, tope 11 años. Estimación orientativa.
            </p>
            <CopyButton
              text={`Indemnización años de servicio (${resultado.anos} años): ${formatCLP(resultado.monto)}`}
            />
          </ResultBox>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Tab: Finiquito ---------------------------- */
function FiniquitoTab() {
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [sueldo, setSueldo] = useState(900_000);
  const [diasVac, setDiasVac] = useState(0);
  const [motivo, setMotivo] = useState<MotivoFiniquito>("despido_injustificado");
  const [resultado, setResultado] = useState<FiniquitoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcular = () => {
    setError(null);
    const fi = dateOrNull(inicio);
    const ft = dateOrNull(termino);
    if (!fi || !ft) {
      setError("Debes indicar fecha de inicio y término.");
      return;
    }
    if (ft.getTime() < fi.getTime()) {
      setError("La fecha de término debe ser posterior a la de inicio.");
      return;
    }
    setResultado(
      calcularFiniquito({
        fechaInicio: fi,
        fechaTermino: ft,
        sueldoMensual: sueldo,
        diasVacacionesPendientes: diasVac,
        motivo,
      })
    );
  };

  const copyText = resultado
    ? [
        `Finiquito (${motivo.replace(/_/g, " ")}):`,
        ...resultado.conceptos.map(
          (c) => `- ${c.nombre}${c.detalle ? ` (${c.detalle})` : ""}: ${formatCLP(c.monto)}`
        ),
        `Total: ${formatCLP(resultado.total)}`,
      ].join("\n")
    : "";

  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#1e3a5f]" /> Finiquito completo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Fecha de inicio</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Fecha de término</Label>
            <Input type="date" value={termino} onChange={(e) => setTermino(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Sueldo mensual (CLP)</Label>
            <Input
              type="number"
              min={0}
              step={10_000}
              value={sueldo}
              onChange={(e) => setSueldo(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="mb-2 block">Días de vacaciones pendientes</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={diasVac}
              onChange={(e) => setDiasVac(Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Motivo de término</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoFiniquito)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="renuncia">Renuncia voluntaria</SelectItem>
                <SelectItem value="mutuo_acuerdo">Mutuo acuerdo</SelectItem>
                <SelectItem value="despido_injustificado">Despido injustificado</SelectItem>
                <SelectItem value="necesidades_empresa">Necesidades de la empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button onClick={calcular} className={`w-full h-11 ${CTA}`}>
          Calcular finiquito
        </Button>

        {resultado && (
          <ResultBox>
            <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
              Total estimado
            </p>
            <p className="text-4xl font-extrabold text-[#1e3a5f] dark:text-blue-300 tabular-nums">
              {formatCLP(resultado.total)}
            </p>

            {resultado.conceptos.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay conceptos aplicables con los datos ingresados.
              </p>
            ) : (
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-neutral-800">
                {resultado.conceptos.map((c) => (
                  <div
                    key={c.nombre}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {c.nombre}
                      </p>
                      {c.detalle && (
                        <p className="text-xs text-gray-500">{c.detalle}</p>
                      )}
                    </div>
                    <p className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      {formatCLP(c.monto)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 leading-relaxed">
              Estimación orientativa. Conceptos aplicados según motivo de término (Arts. 73, 162 y
              163 CT).
            </p>
            <CopyButton text={copyText} />
          </ResultBox>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Página ---------------------------- */
export default function Calculadoras() {
  return (
    <div className="space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Calculadoras laborales
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Cálculos instantáneos basados en el Código del Trabajo de Chile.
        </p>
      </div>

      <Tabs defaultValue="finiquito" className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-neutral-800 flex flex-wrap h-auto">
          <TabsTrigger value="finiquito">
            <Calculator className="w-4 h-4 mr-2" /> Finiquito
          </TabsTrigger>
          <TabsTrigger value="indemnizacion">
            <Briefcase className="w-4 h-4 mr-2" /> Años servicio
          </TabsTrigger>
          <TabsTrigger value="feriado">
            <Calendar className="w-4 h-4 mr-2" /> Feriado proporcional
          </TabsTrigger>
          <TabsTrigger value="aviso">
            <FileText className="w-4 h-4 mr-2" /> Aviso previo
          </TabsTrigger>
          <TabsTrigger value="vacaciones">
            <Wallet className="w-4 h-4 mr-2" /> Vacaciones pendientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="finiquito">
          <FiniquitoTab />
        </TabsContent>
        <TabsContent value="indemnizacion">
          <IndemnizacionTab />
        </TabsContent>
        <TabsContent value="feriado">
          <FeriadoTab />
        </TabsContent>
        <TabsContent value="aviso">
          <AvisoTab />
        </TabsContent>
        <TabsContent value="vacaciones">
          <VacacionesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
