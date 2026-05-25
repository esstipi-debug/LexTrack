import { useState } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEdit, Calculator, Copy, Check, Lock } from "lucide-react";

const proximasCalc = ["Feriado proporcional", "Horas extra", "Gratificación legal"];

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
          <div className="grid gap-4 sm:grid-cols-2">
            {(templates || []).map((t) => (
              <Card
                key={t.id}
                className="border-gray-200 dark:border-neutral-800 hover:shadow-md transition-shadow cursor-pointer"
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
                  <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                    Comenzar — próximamente
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
