import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import type { Plan } from "../../api/lib/billing/types";

type Provider = "mercadopago" | "stripe";

const CLP_FORMAT = new Intl.NumberFormat("es-CL", {
  style: "decimal",
  minimumFractionDigits: 0,
});

function formatCLP(amount: number): string {
  if (amount === 0) return "Gratis";
  return `$${CLP_FORMAT.format(amount)}/mes`;
}

const TRIAL_TOTAL_DAYS = 14;

function TrialStatusCard({
  status,
  trialEndsAt,
  onScrollToPlans,
}: {
  status: string | undefined;
  trialEndsAt: Date | string | null | undefined;
  onScrollToPlans: () => void;
}) {
  if (status !== "trialing") return null;

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  if (!trialEnd) return null;

  const now = Date.now();
  const daysLeft = Math.ceil((trialEnd.getTime() - now) / 86400000);
  const expired = daysLeft <= 0;

  const trialStart = new Date(trialEnd.getTime() - TRIAL_TOTAL_DAYS * 86400000);
  const elapsed = Math.max(0, Math.ceil((now - trialStart.getTime()) / 86400000));
  const progress = Math.min(100, Math.round((elapsed / TRIAL_TOTAL_DAYS) * 100));

  const formattedEnd = trialEnd.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (expired) {
    return (
      <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-red-800 dark:text-red-300 text-base mb-1">
              Tu prueba expiró
            </h2>
            <p className="text-sm text-red-700 dark:text-red-400 mb-3">
              Tu período de prueba gratuita terminó el {formattedEnd}. Para seguir usando todas las funciones, activa un plan.
            </p>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={onScrollToPlans}
            >
              Activar plan ahora
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="font-semibold text-amber-800 dark:text-amber-300 text-base mb-1">
            Estás en tu período de prueba gratuita
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
            Vence el <strong>{formattedEnd}</strong> — quedan{" "}
            <strong>{daysLeft === 1 ? "1 día" : `${daysLeft} días`}</strong>.
          </p>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400 mb-1">
              <span>Día {Math.min(elapsed, TRIAL_TOTAL_DAYS)} de {TRIAL_TOTAL_DAYS}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-amber-200 dark:bg-amber-900">
              <div
                className="h-2 rounded-full bg-amber-500 dark:bg-amber-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onScrollToPlans}
          >
            Activar plan ahora
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Billing() {
  const [provider, setProvider] = useState<Provider>("mercadopago");
  const plansRef = useRef<HTMLDivElement>(null);

  const { data: plans } = trpc.billing.plans.useQuery();
  const { data: currentPlanData, isLoading: loadingPlan } =
    trpc.billing.currentPlan.useQuery();

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess(data) {
      window.location.href = data.url;
    },
    onError(err) {
      toast.error(`Error al procesar pago: ${err.message}`);
    },
  });

  const currentPlan: Plan = currentPlanData?.plan ?? "free";
  const subscription = currentPlanData?.subscription;

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!plans) return null;

  const planKeys = ["free", "starter", "pro"] as const;

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Planes y Precios</h1>
        <p className="text-muted-foreground text-lg">
          Elige el plan que mejor se adapta a tu firma
        </p>
      </div>

      {loadingPlan && (
        <div className="flex justify-center mb-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <TrialStatusCard
        status={subscription?.status}
        trialEndsAt={subscription?.trialEndsAt}
        onScrollToPlans={scrollToPlans}
      />

      {/* Provider selector */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              provider === "mercadopago"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setProvider("mercadopago")}
          >
            MercadoPago — Tarjetas, débito, transferencia
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              provider === "stripe"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setProvider("stripe")}
          >
            Stripe — Tarjeta internacional
          </button>
        </div>
      </div>

      <div ref={plansRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planKeys.map((key) => {
          const plan = plans[key];
          const isCurrentPlan = currentPlan === key;
          const isFree = key === "free";

          return (
            <Card
              key={key}
              className={`flex flex-col relative ${
                isCurrentPlan
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : ""
              } ${key === "starter" ? "shadow-lg" : ""}`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs">
                    Plan actual
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-foreground mt-1">
                  {formatCLP(plan.price)}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {isFree ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled
                  >
                    {isCurrentPlan ? "Plan actual" : "Gratuito"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan || createCheckout.isPending}
                    onClick={() => {
                      if (isCurrentPlan) return;
                      createCheckout.mutate({
                        plan: key as "starter" | "pro",
                        provider,
                      });
                    }}
                  >
                    {createCheckout.isPending &&
                    createCheckout.variables?.plan === key ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : isCurrentPlan ? (
                      "Plan actual"
                    ) : (
                      "Contratar"
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Pagos procesados de forma segura. Cancela cuando quieras.
      </p>
    </div>
  );
}
