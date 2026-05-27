import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Loader2, Gavel, CheckCircle2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router";

const TOTAL_STEPS = 3;

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Gavel className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            LexTrack
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paso {step} de {TOTAL_STEPS}</span>
            <span>{Math.round(progress)}% completado</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {step === 1 && (
          <Step1Bienvenida
            termsAccepted={termsAccepted}
            setTermsAccepted={setTermsAccepted}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2PrimeraCausa
            onNext={() => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3InvitaEquipo
            onComplete={() => navigate("/app")}
          />
        )}
      </div>
    </div>
  );
}

function Step1Bienvenida({
  termsAccepted,
  setTermsAccepted,
  onNext,
}: {
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  onNext: () => void;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState(user?.name ?? "");

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      onNext();
    },
    onError: (err) => {
      toast.error(`Error al guardar el nombre: ${err.message}`);
    },
  });

  const handleNext = () => {
    if (!termsAccepted) {
      toast.error("Debes aceptar los términos y la política de privacidad para continuar.");
      return;
    }
    if (!name.trim()) {
      toast.error("Por favor ingresa tu nombre.");
      return;
    }
    updateProfile.mutate({ name: name.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Bienvenido a LexTrack</CardTitle>
        <CardDescription>
          La plataforma de gestión legal para abogados chilenos. Confirmemos tu nombre
          para empezar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nombre-onboarding">Tu nombre</Label>
          <Input
            id="nombre-onboarding"
            type="text"
            placeholder="Ej: María González"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <Checkbox
            id="terminos-onboarding"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
          />
          <Label htmlFor="terminos-onboarding" className="cursor-pointer text-sm leading-relaxed">
            Acepto los{" "}
            <Link
              to="/terminos"
              target="_blank"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link
              to="/privacidad"
              target="_blank"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              política de privacidad
            </Link>{" "}
            de LexTrack (Ley N° 19.628).
          </Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleNext}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step2PrimeraCausa({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [materia, setMateria] = useState("laboral");

  const crearCausa = trpc.causa.crear.useMutation({
    onSuccess: () => {
      toast.success("Primera causa creada exitosamente.");
      onNext();
    },
    onError: (err) => {
      toast.error(`Error al crear causa: ${err.message}`);
    },
  });

  const handleCreate = () => {
    if (!nombre.trim()) {
      toast.error("El nombre (carátula) de la causa es requerido.");
      return;
    }
    crearCausa.mutate({
      rit: `RIT-${Date.now()}`,
      caratula: nombre.trim(),
      tribunal: "Por definir",
      materia: materia as any,
      litigantes: cliente.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tu primera causa</CardTitle>
        <CardDescription>
          Registra una causa para comenzar a gestionar tu trabajo en LexTrack.
          Puedes completar los detalles más adelante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="causa-nombre">Carátula / Nombre de la causa</Label>
          <Input
            id="causa-nombre"
            type="text"
            placeholder="Ej: González con Empresa ABC"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="causa-cliente">Cliente representado</Label>
          <Input
            id="causa-cliente"
            type="text"
            placeholder="Ej: María González"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="causa-materia">Materia</Label>
          <select
            id="causa-materia"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="laboral">Laboral</option>
            <option value="civil">Civil</option>
            <option value="penal">Penal</option>
            <option value="cobranza">Cobranza</option>
            <option value="familia">Familia</option>
            <option value="comercial">Comercial</option>
            <option value="administrativa">Administrativa</option>
          </select>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onSkip}
          disabled={crearCausa.isPending}
        >
          Omitir por ahora
        </Button>
        <Button
          className="flex-1"
          onClick={handleCreate}
          disabled={crearCausa.isPending}
        >
          {crearCausa.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Crear causa
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step3InvitaEquipo({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const giveConsent = trpc.auth.giveConsent.useMutation();
  const updateProfile = trpc.auth.updateProfile.useMutation();

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${appUrl}/invitar/[token]`;

  const handleFinish = async () => {
    try {
      await giveConsent.mutateAsync();
      await updateProfile.mutateAsync({});
      // Mark onboarding as completed via a side-effect — the server
      // will set hasCompletedOnboarding=true after consent is given.
      await utils.auth.me.invalidate();
    } catch {
      // Non-blocking — proceed anyway
    }
    onComplete();
  };

  const isPending = giveConsent.isPending || updateProfile.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Invita a tu equipo</CardTitle>
        <CardDescription>
          Comparte LexTrack con los abogados de tu estudio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            ¡Tu cuenta está configurada! Ya puedes empezar a gestionar tus causas.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Envía el siguiente enlace a los miembros de tu equipo para que se unan
            a tu organización en LexTrack:
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={inviteUrl}
              readOnly
              className="bg-muted font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                toast.success("Enlace copiado al portapapeles.");
              }}
            >
              Copiar
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          asChild
        >
          <a
            href={`mailto:?subject=Te%20invito%20a%20LexTrack&body=Hola%2C%20te%20invito%20a%20unirte%20a%20mi%20equipo%20en%20LexTrack%3A%20${encodeURIComponent(inviteUrl)}`}
          >
            Invitar por email
          </a>
        </Button>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleFinish}
          disabled={isPending}
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Ir al dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
