import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { type ReactNode, useEffect } from "react";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";
import { identifyUser } from "@/lib/analytics";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (user) {
      identifyUser(user.id, { role: user.role });
    }
  }, [user]);

  if (isLoading) {
    return <AuthLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Iniciar sesión para continuar
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Para acceder a este panel debes autenticarte. Continúa para iniciar sesión.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = LOGIN_PATH;
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
