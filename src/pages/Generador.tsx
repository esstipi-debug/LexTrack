import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileEdit,
  Calculator,
  Copy,
  Check,
  Lock,
  ArrowLeft,
  Loader2,
  Download,
} from "lucide-react";
import { RichEditor, plainTextToHtml } from "@/components/RichEditor";

const proximasCalc = ["Feriado proporcional", "Horas extra", "Gratificación legal"];

type TemplateField = { key: string; label: string; type?: "text" | "number" | "date" };

const TEMPLATE_FIELDS: Record<string, TemplateField[]> = {
  carta_aviso_despido: [
    { key: "trabajador", label: "Nombre del trabajador" },
    { key: "rut_trabajador", label: "RUT del trabajador" },
    { key: "empresa", label: "Nombre de la empresa" },
    { key: "rut_empresa", label: "RUT empresa" },
    { key: "fecha", label: "Fecha de la carta", type: "date" },
    { key: "fecha_termino", label: "Fecha de término", type: "date" },
    { key: "causal", label: "Causal invocada" },
    { key: "indemnizacion", label: "Indemnización (CLP)", type: "number" },
    { key: "aviso_previo", label: "Aviso previo (CLP)", type: "number" },
    { key: "vacaciones", label: "Vacaciones (CLP)", type: "number" },
    { key: "feriado", label: "Feriado (CLP)", type: "number" },
    { key: "representante", label: "Representante legal" },
  ],
  demanda_indemnizacion: [
    { key: "rit", label: "RIT" },
    { key: "demandante", label: "Demandante" },
    { key: "rut_demandante", label: "RUT demandante" },
    { key: "abogado", label: "Abogado patrocinante" },
    { key: "empresa", label: "Empresa demandada" },
    { key: "rut_empresa", label: "RUT empresa" },
    { key: "fecha_ingreso", label: "Fecha de ingreso", type: "date" },
    { key: "fecha_despido", label: "Fecha de despido", type: "date" },
    { key: "remuneracion", label: "Remuneración (CLP)", type: "number" },
    { key: "anios", label: "Años de servicio", type: "number" },
  ],
};

export default function Generador() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "documentos" ? "documentos" : "calculadora";

  const { data: templates } = trpc.generador.templates.useQuery();
  const [anios, setAnios] = useState(5);
  const [meses, setMeses] = useState(0);
  const [sueldo, setSueldo] = useState(800000);
  const [aviso, setAviso] = useState(false);
  const [copied, setCopied] = useState(false);

  const calcMut = trpc.generador.calcularIndemnizacion.useMutation();

  // Documentos / editor state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [contenidoEditable, setContenidoEditable] = useState("");
  const [tituloGenerado, setTituloGenerado] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  const generarMut = trpc.generador.generar.useMutation();

  const setTab = (value: string) => {
    setSearchParams({ tab: value });
  };

  const handleCalcular = async () => {
    await calcMut.mutateAsync({ anios, meses, sueldo, avisoPrevio: aviso });
  };

  const resultado = calcMut.data;

  const headerTitle = tab === "calculadora" ? "Calcular" : "Escribir";
  const headerSub =
    tab === "calculadora"
      ? "Matemática laboral con fundamento legal"
      : "Formularios guiados — no chat libre";

  const selectedTemplate = useMemo(
    () => (templates || []).find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const fields = selectedTemplateId ? TEMPLATE_FIELDS[selectedTemplateId] ?? [] : [];

  const handleSelectTemplate = (id: string) => {
    if (!TEMPLATE_FIELDS[id]) {
      // Template not yet wired with a form schema.
      return;
    }
    setSelectedTemplateId(id);
    setDatos({});
    setContenidoEditable("");
    setTituloGenerado("");
  };

  const handleBackToTemplates = () => {
    setSelectedTemplateId(null);
    setDatos({});
    setContenidoEditable("");
    setTituloGenerado("");
    generarMut.reset();
  };

  const handleGenerar = async () => {
    if (!selectedTemplateId) return;
    const res = await generarMut.mutateAsync({
      templateId: selectedTemplateId,
      datos,
    });
    setTituloGenerado(res.titulo);
    setContenidoEditable(plainTextToHtml(res.contenido));
  };

  // Reset editor when switching away from documents tab? Keep state so user
  // can come back. But sync selectedTemplate display.
  useEffect(() => {
    if (tab !== "documentos") return;
  }, [tab]);

  const handleExportPdf = async () => {
    if (!contenidoEditable) return;
    setExportingPdf(true);
    try {
      // Print to PDF via the browser print dialog. This avoids needing a new
      // backend endpoint while still letting the abogado save as PDF.
      const win = window.open("", "_blank", "width=900,height=1100");
      if (!win) return;
      const safeTitulo = tituloGenerado || "Documento";
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${safeTitulo}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; margin: 2.5cm; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 12pt; }
  h2 { font-size: 14pt; margin: 14pt 0 8pt; }
  h3 { font-size: 12pt; margin: 12pt 0 6pt; }
  p { margin: 6pt 0; }
  ul, ol { margin: 6pt 0 6pt 24pt; }
  blockquote { border-left: 3px solid #888; margin: 6pt 0; padding-left: 12pt; color: #444; font-style: italic; }
  @media print { @page { margin: 2.5cm; } }
</style></head><body>${contenidoEditable}</body></html>`);
      win.document.close();
      win.focus();
      // Give the new window a tick to render before printing.
      setTimeout(() => {
        win.print();
      }, 250);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopyContenido = async () => {
    if (!contenidoEditable) return;
    // Copy as plain text (strip tags) for clipboard friendliness.
    const tmp = document.createElement("div");
    tmp.innerHTML = contenidoEditable;
    const text = tmp.innerText;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {headerTitle}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{headerSub}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-neutral-800">
          <TabsTrigger value="calculadora">
            <Calculator className="w-4 h-4 mr-2" /> Calculadora
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileEdit className="w-4 h-4 mr-2" /> Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculadora">
          <Card className="border-gray-200 dark:border-neutral-800">
            <CardHeader>
              <CardTitle>Indemnización por años de servicio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Años de servicio
                  </label>
                  <Input
                    type="number"
                    value={anios}
                    onChange={(e) => setAnios(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Meses adicionales
                  </label>
                  <Input
                    type="number"
                    value={meses}
                    onChange={(e) => setMeses(Number(e.target.value))}
                    min={0}
                    max={11}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                    Última remuneración mensual (CLP)
                  </label>
                  <Input
                    type="number"
                    value={sueldo}
                    onChange={(e) => setSueldo(Number(e.target.value))}
                    min={0}
                    step={10000}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aviso}
                      onChange={(e) => setAviso(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Se dio aviso previo (Art. 162 CT)
                    </span>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleCalcular}
                disabled={calcMut.isPending}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700"
              >
                {calcMut.isPending ? "Calculando…" : "Calcular indemnización"}
              </Button>

              {resultado && (
                <div className="p-6 rounded-xl border-2 border-green-500 bg-green-50/50 dark:bg-green-950/20">
                  <p className="text-4xl font-extrabold text-green-700 dark:text-green-400 tabular-nums">
                    ${resultado.total.toLocaleString("es-CL")}
                  </p>
                  <div className="mt-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      <strong>Indemnización ({resultado.diasIndemnizacion} días):</strong> $
                      {resultado.montoIndemnizacion.toLocaleString("es-CL")}
                    </p>
                    <p>
                      <strong>Aviso previo:</strong> $
                      {resultado.montoAvisoPrevio.toLocaleString("es-CL")}
                    </p>
                    <p>
                      <strong>Vacaciones / feriado:</strong> $
                      {(resultado.proporcionalVacaciones + resultado.proporcionalFeriado).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                    Fundamento: Art. 163 CT (tope 11 años), Art. 162 CT (aviso previo). Estimación
                    orientativa.
                    {resultado.topeAplicado && " Tope 90 UF aplicado."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const text = `Total: $${resultado.total.toLocaleString("es-CL")}`;
                      navigator.clipboard.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copiar resultado
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg">Otras calculadoras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proximasCalc.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-400"
                >
                  <span>{item}</span>
                  <span className="text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Próximamente
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          {!selectedTemplateId && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(templates || []).map((t) => {
                const wired = !!TEMPLATE_FIELDS[t.id];
                return (
                  <Card
                    key={t.id}
                    className={
                      "border-gray-200 dark:border-neutral-800 transition-shadow " +
                      (wired ? "hover:shadow-md cursor-pointer" : "opacity-70")
                    }
                    onClick={() => wired && handleSelectTemplate(t.id)}
                  >
                    <CardContent className="p-5">
                      <FileEdit className="w-8 h-8 text-amber-600 mb-3" />
                      <h3 className="font-bold text-gray-900 dark:text-white">{t.nombre}</h3>
                      <p className="text-sm text-gray-500 mt-1">{t.descripcion}</p>
                      {t.articulos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {t.articulos.map((a, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs rounded"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                      <Button
                        variant={wired ? "default" : "outline"}
                        size="sm"
                        className="mt-4 w-full"
                        disabled={!wired}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (wired) handleSelectTemplate(t.id);
                        }}
                      >
                        {wired ? "Comenzar" : "Comenzar — próximamente"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedTemplateId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleBackToTemplates}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a plantillas
                </Button>
                <div className="text-sm text-gray-500">{selectedTemplate?.nombre}</div>
              </div>

              <Card className="border-gray-200 dark:border-neutral-800">
                <CardHeader>
                  <CardTitle>Datos del documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map((f) => (
                      <div
                        key={f.key}
                        className={f.key === "causal" ? "md:col-span-2" : undefined}
                      >
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                          {f.label}
                        </label>
                        <Input
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          value={datos[f.key] ?? ""}
                          onChange={(e) =>
                            setDatos((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleGenerar}
                    disabled={generarMut.isPending}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                  >
                    {generarMut.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…
                      </>
                    ) : (
                      "Generar documento"
                    )}
                  </Button>

                  {generarMut.isError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Error al generar: {generarMut.error?.message ?? "intenta de nuevo."}
                    </p>
                  )}
                </CardContent>
              </Card>

              {contenidoEditable && (
                <Card className="border-gray-200 dark:border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="text-lg">
                      {tituloGenerado || "Documento generado"}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyContenido}
                        type="button"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        Copiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={exportingPdf}
                        className="bg-amber-600 hover:bg-amber-700"
                        type="button"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {exportingPdf ? "Preparando…" : "Exportar a PDF"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-500 mb-3">
                      Edita el documento antes de exportar. Bold, listas, títulos y más están
                      disponibles en la barra superior.
                    </p>
                    <RichEditor
                      value={contenidoEditable}
                      onChange={setContenidoEditable}
                      placeholder="Edita el escrito generado…"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
