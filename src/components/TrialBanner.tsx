import { useState } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: planData } = trpc.billing.currentPlan.useQuery();

  if (dismissed) return null;

  const subscription = planData?.subscription;
  const isTrialing = subscription?.status === "trialing";

  if (!isTrialing) return null;

  const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  if (!trialEndsAt) return null;

  const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  const trialExpired = daysLeft <= 0;
  const showBanner = trialExpired || daysLeft <= 7;

  if (!showBanner) return null;

  if (trialExpired) {
    return (
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 bg-red-50 border-b border-red-200 text-red-800 text-sm dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
        <span>
          Tu período de prueba terminó.{" "}
          <Link to="/app/billing" className="font-bold underline underline-offset-2 hover:opacity-80">
            Activar plan para continuar
          </Link>
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
          aria-label="Descartar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
      <span>
        Tu prueba gratis vence en{" "}
        <strong>
          {daysLeft === 1 ? "1 día" : `${daysLeft} días`}
        </strong>{" "}
        —{" "}
        <Link to="/app/billing" className="font-bold underline underline-offset-2 hover:opacity-80">
          Activar plan
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50"
        aria-label="Descartar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
