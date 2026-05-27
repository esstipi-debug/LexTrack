import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Loader2, Download, Trash2, ExternalLink } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu perfil, notificaciones y privacidad.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
          <TabsTrigger value="privacidad">Datos y privacidad</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <PerfilTab user={user} />
        </TabsContent>

        <TabsContent value="notificaciones">
          <NotificacionesTab />
        </TabsContent>

        <TabsContent value="privacidad">
          <PrivacidadTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PerfilTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil actualizado correctamente.");
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(`Error al guardar: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: { name?: string; avatar?: string } = {};
    if (name.trim()) input.name = name.trim();
    if (avatar.trim()) input.avatar = avatar.trim();
    updateProfile.mutate(input);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de perfil</CardTitle>
        <CardDescription>
          Actualiza tu nombre y avatar. El correo electrónico es gestionado por tu
          proveedor de autenticación y no puede modificarse aquí.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={user?.email ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Administrado por tu proveedor OAuth. Solo lectura.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">URL de avatar</Label>
            <Input
              id="avatar"
              type="url"
              placeholder="https://ejemplo.com/avatar.jpg"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificacionesTab() {
  // TODO: wire to user preferences API
  const [prefs, setPrefs] = useState({
    movimientosPJUD: true,
    normasLaborales: true,
    resumenSemanal: true,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success("Preferencias guardadas.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
        <CardDescription>
          Elige qué alertas deseas recibir de LexTrack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="movimientos"
              checked={prefs.movimientosPJUD}
              onCheckedChange={() => toggle("movimientosPJUD")}
            />
            <div>
              <Label htmlFor="movimientos" className="cursor-pointer font-medium">
                Nuevos movimientos PJUD
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recibe alertas cuando haya nuevas resoluciones o movimientos en tus causas.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Checkbox
              id="normas"
              checked={prefs.normasLaborales}
              onCheckedChange={() => toggle("normasLaborales")}
            />
            <div>
              <Label htmlFor="normas" className="cursor-pointer font-medium">
                Normas laborales Diario Oficial
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notificaciones cuando se publiquen nuevas normas laborales relevantes.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Checkbox
              id="resumen"
              checked={prefs.resumenSemanal}
              onCheckedChange={() => toggle("resumenSemanal")}
            />
            <div>
              <Label htmlFor="resumen" className="cursor-pointer font-medium">
                Resumen semanal
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Un resumen cada lunes con las novedades de tus causas y vencimientos próximos.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave}>Guardar</Button>
      </CardContent>
    </Card>
  );
}

function PrivacidadTab() {
  const exportQuery = trpc.auth.dataExport.useQuery(undefined, {
    enabled: false,
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lextrack-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datos exportados correctamente.");
    } else {
      toast.error("No se pudo exportar los datos.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos y privacidad</CardTitle>
        <CardDescription>
          Gestiona tus datos personales conforme a la Ley N° 19.628.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Exportar mis datos
          </h3>
          <p className="text-sm text-muted-foreground">
            Descarga un resumen en formato JSON con tu perfil y el recuento de toda
            tu información almacenada en LexTrack (causas, tareas, alertas, honorarios).
          </p>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
          >
            {exportQuery.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar mis datos
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Política de privacidad
          </h3>
          <p className="text-sm text-muted-foreground">
            Lee cómo LexTrack trata tus datos personales.
          </p>
          <Link
            to="/privacidad"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Ver política de privacidad
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Solicitar eliminación de cuenta
          </h3>
          <p className="text-sm text-muted-foreground">
            Para eliminar tu cuenta y todos tus datos, envíanos una solicitud por correo.
            Procesaremos tu solicitud en un plazo máximo de 30 días hábiles.
          </p>
          <Button variant="destructive" asChild>
            <a href="mailto:privacidad@lextrack.cl?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta&body=Hola%2C%20solicito%20la%20eliminaci%C3%B3n%20de%20mi%20cuenta%20y%20datos%20asociados.">
              <Trash2 className="w-4 h-4 mr-2" />
              Solicitar eliminación de cuenta
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
