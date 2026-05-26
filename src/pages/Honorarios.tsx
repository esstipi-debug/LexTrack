import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

type FilterTab = "todos" | "pendientes" | "morosos" | "pagados";

function formatCLP(amount: number): string {
  return "$" + amount.toLocaleString("es-CL");
}

const estadoConfig: Record<string, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  pagado_parcial: {
    label: "Parcial",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  pagado: {
    label: "Pagado",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  vencido: {
    label: "Vencido",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  cobranza: {
    label: "Cobranza",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  moroso: {
    label: "Moroso",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendientes", label: "Pendientes" },
  { key: "morosos", label: "Morosos" },
  { key: "pagados", label: "Pagados" },
];

export default function Honorarios() {
  const { data: honorarios, isLoading } = trpc.honorario.listar.useQuery();
  const { data: stats } = trpc.honorario.dashboard.useQuery();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<FilterTab>("todos");
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [pagoTarget, setPagoTarget] = useState<{
    id: number;
    concepto: string;
    monto: number;
    montoPagado: number;
  } | null>(null);
  const [pagoMonto, setPagoMonto] = useState("");

  const registrarPagoMut = trpc.honorario.registrarPago.useMutation({
    onSuccess: () => {
      utils.honorario.listar.invalidate();
      utils.honorario.dashboard.invalidate();
      utils.honorario.estadisticas.invalidate();
      setPagoDialogOpen(false);
      setPagoTarget(null);
      setPagoMonto("");
    },
  });

  const filteredAndSorted = useMemo(() => {
    if (!honorarios) return [];

    let filtered = [...honorarios];

    // Apply filter tab
    switch (activeTab) {
      case "pendientes":
        filtered = filtered.filter(
          (h) =>
            h.estado === "pendiente" ||
            h.estado === "pagado_parcial" ||
            h.estado === "vencido" ||
            h.estado === "cobranza"
        );
        break;
      case "morosos":
        filtered = filtered.filter(
          (h) => h.estado === "moroso" || h.estado === "vencido"
        );
        break;
      case "pagados":
        filtered = filtered.filter((h) => h.estado === "pagado");
        break;
    }

    // Sort: overdue first, then by fechaVencimiento ascending
    const now = new Date();
    filtered.sort((a, b) => {
      const aOverdue =
        a.estado !== "pagado" &&
        a.fechaVencimiento &&
        new Date(a.fechaVencimiento) < now;
      const bOverdue =
        b.estado !== "pagado" &&
        b.fechaVencimiento &&
        new Date(b.fechaVencimiento) < now;

      // Overdue items first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Then by fechaVencimiento ascending (soonest first)
      const aDate = a.fechaVencimiento
        ? new Date(a.fechaVencimiento).getTime()
        : Infinity;
      const bDate = b.fechaVencimiento
        ? new Date(b.fechaVencimiento).getTime()
        : Infinity;
      return aDate - bDate;
    });

    return filtered;
  }, [honorarios, activeTab]);

  function openPagoDialog(h: {
    id: number;
    concepto: string;
    monto: number;
    montoPagado: number;
  }) {
    setPagoTarget(h);
    setPagoMonto("");
    setPagoDialogOpen(true);
  }

  function handleRegistrarPago() {
    if (!pagoTarget) return;
    const monto = parseInt(pagoMonto, 10);
    if (isNaN(monto) || monto <= 0) return;
    registrarPagoMut.mutate({ id: pagoTarget.id, monto });
  }

  const isOverdue = (h: { estado: string; fechaVencimiento: string | Date | null }) =>
    h.estado !== "pagado" &&
    h.fechaVencimiento &&
    new Date(h.fechaVencimiento) < new Date();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Honorarios y Cobranza
        </h1>
        <p className="text-gray-500">
          Gestion de honorarios y estado de cobranza
        </p>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-500">Total Facturado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCLP(stats.totalFacturado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-500">Total Cobrado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCLP(stats.totalPagado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-gray-500">
                  Pendiente de Cobro
                </span>
              </div>
              <p className="text-xl font-bold text-amber-600">
                {formatCLP(stats.totalPendiente)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-gray-500">Morosos</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                {formatCLP(stats.totalMoroso)}
              </p>
              {stats.morosos.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {stats.morosos.length} cliente
                  {stats.morosos.length !== 1 ? "s" : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {filteredAndSorted.map((h) => {
            const progress =
              h.monto > 0
                ? Math.min(
                    Math.round(((h.montoPagado || 0) / h.monto) * 100),
                    100
                  )
                : 0;
            const overdue = isOverdue(h);
            const config = estadoConfig[h.estado] || {
              label: h.estado,
              className: "bg-gray-100 text-gray-700",
            };

            return (
              <Card
                key={h.id}
                className={overdue ? "border-red-300 dark:border-red-700" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {h.concepto}
                        </span>
                        <Badge className={config.className}>
                          {config.label}
                        </Badge>
                        {overdue && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Vencido
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Cliente: {h.cliente}
                      </p>
                      {h.fechaVencimiento && (
                        <p
                          className={`text-xs mt-0.5 ${
                            overdue ? "text-red-500 font-medium" : "text-gray-400"
                          }`}
                        >
                          Vence:{" "}
                          {new Date(h.fechaVencimiento).toLocaleDateString(
                            "es-CL"
                          )}
                        </p>
                      )}
                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={progress} className="flex-1 h-2" />
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {progress}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCLP(h.montoPagado || 0)} de{" "}
                        {formatCLP(h.monto)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {formatCLP(h.monto)}
                      </p>
                      {h.estado !== "pagado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openPagoDialog({
                              id: h.id,
                              concepto: h.concepto,
                              monto: h.monto,
                              montoPagado: h.montoPagado || 0,
                            })
                          }
                          className="text-xs"
                        >
                          <CreditCard className="w-3 h-3 mr-1" />
                          Registrar Pago
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredAndSorted.length === 0 && (
            <p className="text-gray-400 text-center py-8">
              {activeTab === "todos"
                ? "No hay honorarios registrados"
                : `No hay honorarios en la categoria "${activeTab}"`}
            </p>
          )}
        </div>
      )}

      {/* Registrar Pago Dialog */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {pagoTarget && (
                <>
                  {pagoTarget.concepto} - Pendiente:{" "}
                  {formatCLP(pagoTarget.monto - pagoTarget.montoPagado)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pago-monto">Monto del pago (CLP)</Label>
              <Input
                id="pago-monto"
                type="number"
                min={1}
                max={
                  pagoTarget
                    ? pagoTarget.monto - pagoTarget.montoPagado
                    : undefined
                }
                placeholder="Ej: 500000"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
              />
            </div>
            {pagoTarget && pagoMonto && (
              <div className="text-sm text-gray-500 space-y-1">
                <p>
                  Total facturado: {formatCLP(pagoTarget.monto)}
                </p>
                <p>
                  Ya pagado: {formatCLP(pagoTarget.montoPagado)}
                </p>
                <p>
                  Este pago: {formatCLP(parseInt(pagoMonto, 10) || 0)}
                </p>
                <p className="font-medium">
                  Restante despues del pago:{" "}
                  {formatCLP(
                    Math.max(
                      0,
                      pagoTarget.monto -
                        pagoTarget.montoPagado -
                        (parseInt(pagoMonto, 10) || 0)
                    )
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPagoDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarPago}
              disabled={
                registrarPagoMut.isPending ||
                !pagoMonto ||
                parseInt(pagoMonto, 10) <= 0
              }
            >
              {registrarPagoMut.isPending
                ? "Registrando..."
                : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
