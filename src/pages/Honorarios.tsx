import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  FileText,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";

export default function Honorarios() {
  const { data: honorarios, isLoading } = trpc.honorario.listar.useQuery();
  const { data: stats } = trpc.honorario.estadisticas.useQuery();
  const { data: agingData } = trpc.honorario.aging.useQuery();
  const { data: resumenMensual } = trpc.honorario.resumenMensual.useQuery();

  const [interesDialogOpen, setInteresDialogOpen] = useState(false);
  const [selectedHonorarioId, setSelectedHonorarioId] = useState<number | null>(null);
  const [cartaDialogOpen, setCartaDialogOpen] = useState(false);
  const [cartaHonorarioId, setCartaHonorarioId] = useState<number | null>(null);
  const [cartaNumero, setCartaNumero] = useState<number>(1);
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false);
  const [cuentaCliente, setCuentaCliente] = useState<string>("");

  const { data: interesData } = trpc.honorario.calcularIntereses.useQuery(
    { id: selectedHonorarioId! },
    { enabled: !!selectedHonorarioId },
  );

  const { data: cartaData } = trpc.honorario.generarCartaCobranza.useQuery(
    { id: cartaHonorarioId!, numero: cartaNumero },
    { enabled: !!cartaHonorarioId && cartaNumero > 0 },
  );

  const { data: cuentaData } = trpc.honorario.estadoCuenta.useQuery(
    { cliente: cuentaCliente },
    { enabled: !!cuentaCliente && cuentaDialogOpen },
  );

  const estadoColor: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-700",
    pagado_parcial: "bg-blue-100 text-blue-700",
    pagado: "bg-green-100 text-green-700",
    vencido: "bg-red-100 text-red-700",
    cobranza: "bg-orange-100 text-orange-700",
    moroso: "bg-red-200 text-red-800",
  };

  // Unique clients list
  const clientes = Array.from(
    new Set((honorarios || []).map((h) => h.cliente)),
  );

  // Check if item is overdue
  function esVencido(h: { estado: string; fechaVencimiento: string | null }) {
    if (h.estado === "pagado") return false;
    if (h.estado === "vencido" || h.estado === "moroso" || h.estado === "cobranza")
      return true;
    if (!h.fechaVencimiento) return false;
    return new Date(h.fechaVencimiento) < new Date();
  }

  function esMoroso(h: { estado: string }) {
    return (
      h.estado === "moroso" ||
      h.estado === "cobranza" ||
      h.estado === "vencido"
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Honorarios y Cobranza
        </h1>
        <p className="text-gray-500">
          Gestion de honorarios, intereses y estado de cobranza
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-500">Facturado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${stats.totalFacturado.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-500">Pagado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${stats.totalPagado.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-gray-500">Por cobrar</span>
              </div>
              <p className="text-xl font-bold text-amber-600">
                ${stats.porCobrar.toLocaleString("es-CL")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-500">Documentos</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.totalDocumentos}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="honorarios">
        <TabsList>
          <TabsTrigger value="honorarios">Honorarios</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="mensual">Comparacion Mensual</TabsTrigger>
        </TabsList>

        {/* ─── Honorarios Tab ─────────────────────────────────────── */}
        <TabsContent value="honorarios">
          {isLoading ? (
            <p className="text-gray-400">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {(honorarios || []).map((h) => (
                <Card key={h.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {h.concepto}
                          </span>
                          <Badge
                            className={estadoColor[h.estado] || "bg-gray-100"}
                          >
                            {h.estado}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          Cliente: {h.cliente}
                          {h.fechaVencimiento && (
                            <span className="ml-2">
                              | Vence: {h.fechaVencimiento}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900 dark:text-white">
                          ${h.monto.toLocaleString("es-CL")}
                        </p>
                        {h.montoPagado > 0 && (
                          <p className="text-xs text-gray-400">
                            Pagado: ${h.montoPagado.toLocaleString("es-CL")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Calcular Intereses button - shown on overdue items */}
                        {esVencido(h) && (
                          <Dialog
                            open={
                              interesDialogOpen &&
                              selectedHonorarioId === h.id
                            }
                            onOpenChange={(open) => {
                              setInteresDialogOpen(open);
                              if (open) setSelectedHonorarioId(h.id);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Calcular Intereses"
                              >
                                <Calculator className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Calculo de Intereses por Mora
                                </DialogTitle>
                                <DialogDescription>
                                  {h.concepto} - {h.cliente}
                                </DialogDescription>
                              </DialogHeader>
                              {interesData?.interes ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-500">
                                      Monto pendiente:
                                    </div>
                                    <div className="font-medium">
                                      $
                                      {interesData.interes.montoPendiente.toLocaleString(
                                        "es-CL",
                                      )}
                                    </div>
                                    <div className="text-gray-500">
                                      Dias en mora:
                                    </div>
                                    <div className="font-medium">
                                      {interesData.interes.diasMora}
                                    </div>
                                    <div className="text-gray-500">
                                      Tasa mensual:
                                    </div>
                                    <div className="font-medium">
                                      {interesData.interes.tasaMensual}%
                                    </div>
                                    <div className="text-gray-500">
                                      Interes calculado:
                                    </div>
                                    <div className="font-medium text-red-600">
                                      $
                                      {interesData.interes.interesCalculado.toLocaleString(
                                        "es-CL",
                                      )}
                                    </div>
                                    <div className="text-gray-500 font-semibold">
                                      Total con interes:
                                    </div>
                                    <div className="font-bold text-lg">
                                      $
                                      {interesData.interes.totalConInteres.toLocaleString(
                                        "es-CL",
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">
                                    {interesData.interes.baseNormativa}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-gray-400 text-sm">
                                  {interesData?.mensaje ||
                                    "Cargando..."}
                                </p>
                              )}
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Generar Carta dropdown - shown on moroso items */}
                        {esMoroso(h) && (
                          <Dialog
                            open={
                              cartaDialogOpen && cartaHonorarioId === h.id
                            }
                            onOpenChange={(open) => {
                              setCartaDialogOpen(open);
                              if (open) {
                                setCartaHonorarioId(h.id);
                                setCartaNumero(1);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Generar Carta de Cobranza"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Carta de Cobranza
                                </DialogTitle>
                                <DialogDescription>
                                  {h.concepto} - {h.cliente}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="mb-4">
                                <label className="text-sm text-gray-500 mb-1 block">
                                  Numero de carta:
                                </label>
                                <Select
                                  value={String(cartaNumero)}
                                  onValueChange={(v) =>
                                    setCartaNumero(parseInt(v))
                                  }
                                >
                                  <SelectTrigger className="w-60">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">
                                      1ra Carta - Recordatorio
                                    </SelectItem>
                                    <SelectItem value="2">
                                      2da Carta - Aviso Urgente
                                    </SelectItem>
                                    <SelectItem value="3">
                                      3ra Carta - Aviso Judicial
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {cartaData?.markdown ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 rounded p-4">
                                  {cartaData.markdown}
                                </div>
                              ) : (
                                <p className="text-gray-400 text-sm">
                                  Generando carta...
                                </p>
                              )}
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Estado de Cuenta button per client */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Estado de Cuenta"
                          onClick={() => {
                            setCuentaCliente(h.cliente);
                            setCuentaDialogOpen(true);
                          }}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!honorarios || honorarios.length === 0) && (
                <p className="text-gray-400 text-center py-8">
                  No hay honorarios registrados
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Aging Tab ──────────────────────────────────────────── */}
        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Antiguedad de Deuda (Aging Report)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agingData ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Total pendientes: {agingData.totalPendientes} documentos
                  </p>
                  {agingData.buckets.map((bucket) => {
                    const totalMonto = agingData.buckets.reduce(
                      (a, b) => a + b.monto,
                      0,
                    );
                    const pct =
                      totalMonto > 0
                        ? Math.round((bucket.monto / totalMonto) * 100)
                        : 0;
                    return (
                      <div key={bucket.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{bucket.label}</span>
                          <span className="text-gray-500">
                            {bucket.count} docs | $
                            {bucket.monto.toLocaleString("es-CL")} ({pct}%)
                          </span>
                        </div>
                        <Progress value={pct} className="h-3" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Cargando...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Monthly Comparison Tab ─────────────────────────────── */}
        <TabsContent value="mensual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Comparacion Mensual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resumenMensual ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current month */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm text-gray-500 mb-3">
                        Mes Actual ({resumenMensual.mesActual.label})
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Documentos:</span>
                          <span className="font-medium">
                            {resumenMensual.mesActual.total}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Facturado:</span>
                          <span className="font-medium">
                            $
                            {resumenMensual.mesActual.facturado.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cobrado:</span>
                          <span className="font-medium text-green-600">
                            $
                            {resumenMensual.mesActual.cobrado.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pendiente:</span>
                          <span className="font-medium text-amber-600">
                            $
                            {resumenMensual.mesActual.pendiente.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Previous month */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm text-gray-500 mb-3">
                        Mes Anterior ({resumenMensual.mesAnterior.label})
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Documentos:</span>
                          <span className="font-medium">
                            {resumenMensual.mesAnterior.total}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Facturado:</span>
                          <span className="font-medium">
                            $
                            {resumenMensual.mesAnterior.facturado.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cobrado:</span>
                          <span className="font-medium text-green-600">
                            $
                            {resumenMensual.mesAnterior.cobrado.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pendiente:</span>
                          <span className="font-medium text-amber-600">
                            $
                            {resumenMensual.mesAnterior.pendiente.toLocaleString(
                              "es-CL",
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Variation */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm text-gray-500 mb-3">
                      Variacion
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-gray-500">Facturado</p>
                        <p
                          className={`font-bold flex items-center justify-center gap-1 ${
                            resumenMensual.variacion.facturado >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {resumenMensual.variacion.facturado >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          $
                          {Math.abs(
                            resumenMensual.variacion.facturado,
                          ).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Cobrado</p>
                        <p
                          className={`font-bold flex items-center justify-center gap-1 ${
                            resumenMensual.variacion.cobrado >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {resumenMensual.variacion.cobrado >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          $
                          {Math.abs(
                            resumenMensual.variacion.cobrado,
                          ).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Pendiente</p>
                        <p
                          className={`font-bold flex items-center justify-center gap-1 ${
                            resumenMensual.variacion.pendiente <= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {resumenMensual.variacion.pendiente <= 0 ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                          $
                          {Math.abs(
                            resumenMensual.variacion.pendiente,
                          ).toLocaleString("es-CL")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Cargando...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Estado de Cuenta Dialog */}
      <Dialog open={cuentaDialogOpen} onOpenChange={setCuentaDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estado de Cuenta</DialogTitle>
            <DialogDescription>Cliente: {cuentaCliente}</DialogDescription>
          </DialogHeader>
          {cuentaData?.markdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 rounded p-4">
              {cuentaData.markdown}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Generando estado de cuenta...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
