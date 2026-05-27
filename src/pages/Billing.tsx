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
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Plan } from "../../api/lib/billing/types";

const CLP_FORMAT = new Intl.NumberFormat("es-CL", {
  style: "decimal",
  minimumFractionDigits: 0,
});

function formatCLP(amount: number): string {
  if (amount === 0) return "Gratis";
  return `$${CLP_FORMAT.format(amount)}/mes`;
}

export default function Billing() {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        provider: "stripe",
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
