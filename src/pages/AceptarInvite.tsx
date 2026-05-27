import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Gavel, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AcceptState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; orgNombre: string }
  | { type: "conflict" }
  | { type: "invalid" }
  | { type: "error"; message: string };

export default function AceptarInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [acceptState, setAcceptState] = useState<AcceptState>({ type: "idle" });

  const aceptarInviteMutation = trpc.org.aceptarInvite.useMutation({
    onSuccess: (data) => {
      setAcceptState({ type: "success", orgNombre: data.orgNombre });
    },
    onError: (error) => {
      const code = error.data?.code;
      if (code === "CONFLICT") {
        setAcceptState({ type: "conflict" });
      } else if (code === "NOT_FOUND" || code === "BAD_REQUEST") {
        setAcceptState({ type: "invalid" });
      } else {
        setAcceptState({ type: "error", message: error.message });
      }
    },
  });

  const handleAceptar = () => {
    if (!token) return;
    setAcceptState({ type: "loading" });
    aceptarInviteMutation.mutate({ token });
  };

  // While auth state is loading, show a neutral skeleton
  if (authLoading) {
    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // Success state
  if (acceptState.type === "success") {
    return (
      <PageShell>
        <Card className="w-full max-w-md border-green-200">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <CardTitle className="text-xl text-gray-900">
              ¡Bienvenido a la organización!
            </CardTitle>
            {acceptState.orgNombre && (
              <CardDescription className="text-base">
                Ahora eres miembro de{" "}
                <span className="font-medium text-gray-700">
                  {acceptState.orgNombre}
                </span>
                .
              </CardDescription>
            )}
          </CardHeader>
          <CardFooter className="justify-center pt-4">
            <Button
              className="w-full bg-[#1e3a5f] hover:bg-[#16304f] text-white"
              size="lg"
              onClick={() => navigate("/app")}
            >
              Ir al panel
            </Button>
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  // Error states for authenticated users
  if (acceptState.type === "conflict") {
    return (
      <PageShell>
        <ErrorCard
          title="Ya perteneces a una organización"
          description="No puedes unirte a más de una organización. Si crees que esto es un error, contacta al soporte."
          showAppLink
        />
      </PageShell>
    );
  }

  if (acceptState.type === "invalid") {
    return (
      <PageShell>
        <ErrorCard
          title="La invitación no es válida o expiró"
          description="El enlace que usaste ya no es válido. Puede que haya sido utilizado anteriormente o que haya expirado. Pide al administrador que te envíe una nueva invitación."
        />
      </PageShell>
    );
  }

  if (acceptState.type === "error") {
    return (
      <PageShell>
        <ErrorCard
          title="Ocurrió un error"
          description={acceptState.message || "No fue posible procesar la invitación. Intenta de nuevo más tarde."}
          showRetry
          onRetry={handleAceptar}
        />
      </PageShell>
    );
  }

  // Unauthenticated user — generic invite card
  if (!user) {
    const loginUrl = token
      ? `/login?redirect=${encodeURIComponent(`/invitar/${token}`)}`
      : "/login";

    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-gray-900">
              Fuiste invitado a unirte a una organización en LexTrack
            </CardTitle>
            <CardDescription className="mt-2">
              Para aceptar la invitación debes iniciar sesión o crear una cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4 text-center text-sm text-muted-foreground">
            Tu progreso se conservará y podrás aceptar la invitación de inmediato.
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              asChild
              className="w-full bg-[#1e3a5f] hover:bg-[#16304f] text-white"
              size="lg"
            >
              <Link to={loginUrl}>Iniciar sesión para aceptar</Link>
            </Button>
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  // Authenticated user — ready to accept
  return (
    <PageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl text-gray-900">
            Invitación a una organización
          </CardTitle>
          <CardDescription className="mt-2">
            Haz clic en el botón para unirte a la organización y colaborar con tu equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4 text-center text-sm text-muted-foreground">
          Al aceptar, pasarás a ser miembro de la organización que te invitó.
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button
            className="w-full bg-[#1e3a5f] hover:bg-[#16304f] text-white"
            size="lg"
            disabled={acceptState.type === "loading"}
            onClick={handleAceptar}
          >
            {acceptState.type === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando…
              </>
            ) : (
              "Aceptar invitación"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => navigate("/app")}
          >
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </PageShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col items-center justify-center py-12 px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Gavel className="w-7 h-7 text-[#1e3a5f] dark:text-blue-400" />
        <span className="text-xl font-extrabold tracking-tight text-[#1e3a5f] dark:text-white">
          LexTrack
        </span>
      </div>
      {children}
    </div>
  );
}

function ErrorCard({
  title,
  description,
  showAppLink,
  showRetry,
  onRetry,
}: {
  title: string;
  description: string;
  showAppLink?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Card className="w-full max-w-md border-red-200">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-3">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <CardTitle className="text-lg text-gray-900">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
      {(showAppLink || showRetry) && (
        <CardFooter className="justify-center gap-3 flex-col pt-2">
          {showRetry && onRetry && (
            <Button
              className="w-full bg-[#1e3a5f] hover:bg-[#16304f] text-white"
              onClick={onRetry}
            >
              Intentar de nuevo
            </Button>
          )}
          {showAppLink && (
            <Button asChild variant="outline" className="w-full">
              <Link to="/app">Ir al panel</Link>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
