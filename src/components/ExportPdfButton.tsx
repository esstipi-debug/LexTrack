import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Tipo =
  | "generico"
  | "karin-acta"
  | "karin-informe"
  | "karin-medidas"
  | "karin-protocolo"
  | "cobranza-carta"
  | "generador";

interface InlineContent {
  title: string;
  body: string;
  author?: string;
}

interface ExportPdfButtonProps {
  tipo?: Tipo;
  /** When provided, the server loads the row from `documentos` (ownership checked). */
  documentoId?: number;
  /** Inline content path — title + markdown-ish body. */
  contenido?: InlineContent;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Decodes a base64 string into a Blob without leaking large strings to atob limits. */
function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function ExportPdfButton({
  tipo = "generico",
  documentoId,
  contenido,
  size = "sm",
  variant = "outline",
  label = "Exportar PDF",
  className,
  disabled,
}: ExportPdfButtonProps) {
  const exportar = trpc.pdf.exportDocumento.useMutation({
    onSuccess: (data) => {
      const blob = base64ToBlob(data.base64, data.mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado");
    },
    onError: (err) => {
      toast.error("No se pudo generar el PDF: " + err.message);
    },
  });

  const onClick = () => {
    if (!documentoId && !contenido) {
      toast.error("Falta el contenido para exportar");
      return;
    }
    exportar.mutate({ tipo, documentoId, contenido });
  };

  const isLoading = exportar.isPending;
  const isDisabled = disabled || isLoading || (!documentoId && !contenido);

  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={isDisabled}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
      ) : (
        <FileDown className="w-3.5 h-3.5 mr-1" />
      )}
      {isLoading ? "Generando..." : label}
    </Button>
  );
}

export default ExportPdfButton;
