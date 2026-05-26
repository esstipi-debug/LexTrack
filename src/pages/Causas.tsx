import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Causas() {
  const { data: causas, isLoading } = trpc.causa.listar.useQuery();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [rit, setRit] = useState("");
  const [caratula, setCaratula] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [materia, setMateria] = useState("laboral");
  const [estado, setEstado] = useState("tramitacion");
  const [fechaIngreso, setFechaIngreso] = useState("");

  const crear = trpc.causa.crear.useMutation({
    onSuccess: () => {
      utils.causa.listar.invalidate();
      setOpen(false);
      resetForm();
      toast.success("Causa creada exitosamente");
    },
    onError: (err) => {
      toast.error("Error al crear causa: " + err.message);
    },
  });

  function resetForm() {
    setRit("");
    setCaratula("");
    setTribunal("");
    setMateria("laboral");
    setEstado("tramitacion");
    setFechaIngreso("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    crear.mutate({
      rit,
      caratula,
      tribunal,
      materia,
      estado,
      fechaIngreso: fechaIngreso || undefined,
    });
  }

  const filtered = causas?.filter(c =>
    !search || c.caratula?.toLowerCase().includes(search.toLowerCase()) || c.rit?.toLowerCase().includes(search.toLowerCase())
  );

  const estadoColor: Record<string, string> = {
    tramitacion: "bg-blue-100 text-blue-700",
    sentencia: "bg-green-100 text-green-700",
    ejecucion: "bg-amber-100 text-amber-700",
    concluida: "bg-gray-100 text-gray-700",
    archivada: "bg-gray-100 text-gray-500",
    notificacion: "bg-purple-100 text-purple-700",
    prueba: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Causas</h1>
          <p className="text-gray-500">Gestión de causas judiciales laborales</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Causa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Causa</DialogTitle>
              <DialogDescription>Ingrese los datos de la nueva causa judicial.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rit">RIT *</Label>
                <Input id="rit" value={rit} onChange={(e) => setRit(e.target.value)} placeholder="T-123-2025" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caratula">Carátula *</Label>
                <Input id="caratula" value={caratula} onChange={(e) => setCaratula(e.target.value)} placeholder="González con Empresa S.A." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tribunal">Tribunal *</Label>
                <Input id="tribunal" value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="Juzgado de Letras del Trabajo de Santiago" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Materia</Label>
                  <Select value={materia} onValueChange={setMateria}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laboral">Laboral</SelectItem>
                      <SelectItem value="civil">Civil</SelectItem>
                      <SelectItem value="penal">Penal</SelectItem>
                      <SelectItem value="cobranza">Cobranza</SelectItem>
                      <SelectItem value="familia">Familia</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="administrativa">Administrativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tramitacion">Tramitación</SelectItem>
                      <SelectItem value="notificacion">Notificación</SelectItem>
                      <SelectItem value="prueba">Prueba</SelectItem>
                      <SelectItem value="sentencia">Sentencia</SelectItem>
                      <SelectItem value="ejecucion">Ejecución</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
                <Input id="fechaIngreso" type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={crear.isPending}>
                  {crear.isPending ? "Creando..." : "Crear Causa"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por carátula o RIT..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando causas...</p>
      ) : (
        <div className="grid gap-3">
          {(filtered || []).map((c) => (
            <Link key={c.id} to={`/causas/${c.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Gavel className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-mono text-gray-500">{c.rit}</span>
                        <Badge className={estadoColor[c.estado] || "bg-gray-100"}>{c.estado}</Badge>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{c.caratula}</h3>
                      <p className="text-sm text-gray-500">{c.tribunal} {c.comuna && `- ${c.comuna}`}</p>
                      <p className="text-xs text-gray-400 mt-1">Materia: {c.materia} | Ingreso: {c.fechaIngreso}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!filtered || filtered.length === 0) && (
            <p className="text-gray-400 text-center py-8">No se encontraron causas</p>
          )}
        </div>
      )}
    </div>
  );
}
