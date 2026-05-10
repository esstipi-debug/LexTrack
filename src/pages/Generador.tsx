import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEdit, Calculator, Copy, Check } from "lucide-react";

export default function Generador() {
  const { data: templates } = trpc.generador.templates.useQuery();
  const [anios, setAnios] = useState(5);
  const [meses, setMeses] = useState(0);
  const [sueldo, setSueldo] = useState(800000);
  const [aviso, setAviso] = useState(false);
  const [copied, setCopied] = useState(false);

  const calcMut = trpc.generador.calcularIndemnizacion.useMutation();

  const handleCalcular = async () => {
    await calcMut.mutateAsync({ anios, meses, sueldo, avisoPrevio: aviso });
  };

  const resultado = calcMut.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generador y Calculadora</h1>
        <p className="text-gray-500">Documentos legales y cálculos laborales</p>
      </div>

      <Tabs defaultValue="calculadora" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calculadora">
            <Calculator className="w-4 h-4 mr-2" /> Calculadora Art. 163
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileEdit className="w-4 h-4 mr-2" /> Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculadora">
          <Card>
            <CardHeader>
              <CardTitle>Calculadora de Indemnización - Art. 163 CT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Años de servicio</label>
                  <Input type="number" value={anios} onChange={(e) => setAnios(Number(e.target.value))} min={0} />
                </div>
                <div>
                  <label className="text-sm font-medium">Meses adicionales</label>
                  <Input type="number" value={meses} onChange={(e) => setMeses(Number(e.target.value))} min={0} max={11} />
                </div>
                <div>
                  <label className="text-sm font-medium">Remuneración mensual ($)</label>
                  <Input type="number" value={sueldo} onChange={(e) => setSueldo(Number(e.target.value))} min={0} step={10000} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="aviso" checked={aviso} onChange={(e) => setAviso(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="aviso" className="text-sm">Aviso previo fue dado</label>
                </div>
              </div>

              <Button onClick={handleCalcular} disabled={calcMut.isPending}>
                {calcMut.isPending ? "Calculando..." : "Calcular"}
              </Button>

              {resultado && (
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">Resultado</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const text = `Indemnización Art. 163 CT:\nDías: ${resultado.diasIndemnizacion}\nMonto: $${resultado.montoIndemnizacion.toLocaleString("es-CL")}\nAviso previo: $${resultado.montoAvisoPrevio.toLocaleString("es-CL")}\nVacaciones: $${resultado.proporcionalVacaciones.toLocaleString("es-CL")}\nFeriado: $${resultado.proporcionalFeriado.toLocaleString("es-CL")}\nTOTAL: $${resultado.total.toLocaleString("es-CL")}`;
                          navigator.clipboard.writeText(text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Días indemnización:</span> <strong>{resultado.diasIndemnizacion}</strong></div>
                      <div><span className="text-gray-500">Indemnización:</span> <strong>${resultado.montoIndemnizacion.toLocaleString("es-CL")}</strong></div>
                      <div><span className="text-gray-500">Aviso previo:</span> <strong>${resultado.montoAvisoPrevio.toLocaleString("es-CL")}</strong></div>
                      <div><span className="text-gray-500">Vacaciones:</span> <strong>${resultado.proporcionalVacaciones.toLocaleString("es-CL")}</strong></div>
                      <div><span className="text-gray-500">Feriado:</span> <strong>${resultado.proporcionalFeriado.toLocaleString("es-CL")}</strong></div>
                      <div className="col-span-2 pt-2 border-t">
                        <span className="text-gray-500">TOTAL:</span> <strong className="text-lg text-green-600">${resultado.total.toLocaleString("es-CL")}</strong>
                        {resultado.topeAplicado && <span className="text-xs text-amber-600 ml-2">(Tope 90 UF aplicado)</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <div className="grid gap-4">
            {(templates || []).map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <h3 className="font-medium">{t.nombre}</h3>
                  <p className="text-sm text-gray-500">{t.descripcion}</p>
                  {t.articulos.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.articulos.map((a, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{a}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
