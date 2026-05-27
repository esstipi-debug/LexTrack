import { Link } from "react-router";
import {
  Gavel,
  Bot,
  BellRing,
  Shield,
  DollarSign,
  FilePen,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const features = [
  {
    icon: Gavel,
    title: "Monitoreo automático PJUD",
    desc: "Scraper que sincroniza tus causas del Poder Judicial cada 6 horas y te alerta de cada movimiento.",
  },
  {
    icon: Bot,
    title: "Asistente IA con 22 herramientas",
    desc: "Consulta jurídica, búsqueda de jurisprudencia, redacción de escritos. Todo desde una conversación.",
  },
  {
    icon: BellRing,
    title: "Alertas Diario Oficial + DT",
    desc: "Te avisamos cuando se publica una nueva norma laboral o dictamen de la Dirección del Trabajo.",
  },
  {
    icon: Shield,
    title: "Gestión Ley Karin completa",
    desc: "Protocolo, acta de recepción, informe final, medidas cautelares. Todo el flujo cubierto.",
  },
  {
    icon: DollarSign,
    title: "Cobranza con intereses",
    desc: "Calcula intereses automáticamente y emite cobros con plantillas listas para enviar.",
  },
  {
    icon: FilePen,
    title: "Generador de escritos",
    desc: "Plantillas de demandas, contestaciones y recursos parametrizables en segundos.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mes",
    description: "Para probar la plataforma sin compromiso.",
    features: [
      "Hasta 5 causas",
      "Alertas básicas PJUD",
      "Sin asistente IA",
      "Soporte por correo",
    ],
    highlight: false,
    cta: "Empezar gratis",
  },
  {
    name: "Starter",
    price: "$19.990",
    period: "/mes",
    description: "Para abogados independientes.",
    features: [
      "Hasta 50 causas",
      "100 consultas IA / mes",
      "Todos los scrapers (PJUD, DT, DO)",
      "Gestión Ley Karin",
      "Generador de escritos",
    ],
    highlight: true,
    cta: "Empezar 14 días gratis",
  },
  {
    name: "Pro",
    price: "$49.990",
    period: "/mes",
    description: "Para estudios y firmas multi-usuario.",
    features: [
      "Causas ilimitadas",
      "IA ilimitada",
      "Multi-firma / multi-usuario",
      "Soporte prioritario",
      "Exportación avanzada",
    ],
    highlight: false,
    cta: "Empezar 14 días gratis",
  },
];

const faqs = [
  {
    q: "¿Necesito tarjeta de crédito para la prueba?",
    a: "No. Los 14 días de prueba no requieren tarjeta. Si decides continuar al final del periodo, te pediremos el medio de pago.",
  },
  {
    q: "¿Cómo sincroniza con PJUD?",
    a: "Tenemos un scraper que consulta la Oficina Judicial Virtual cada 6 horas. Los movimientos nuevos llegan a tu panel y por correo en tiempo casi real.",
  },
  {
    q: "¿Mi información está segura?",
    a: "Sí. Encriptación en tránsito (TLS) y en reposo, backups diarios y nuestra infraestructura está alineada con ISO 27001. Nunca compartimos datos con terceros.",
  },
  {
    q: "¿Puedo exportar mis datos?",
    a: "Sí. Puedes exportar tus causas, tareas y honorarios en CSV o PDF en cualquier momento desde el panel.",
  },
  {
    q: "¿Funciona en móvil?",
    a: "Sí, la web es completamente responsive. Una aplicación nativa para iOS y Android está en desarrollo.",
  },
  {
    q: "¿Qué pasa si supero el límite de causas en mi plan?",
    a: "Te avisamos antes de llegar al límite. Puedes subir de plan o archivar causas antiguas para mantenerte dentro del cupo.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Gavel className="w-7 h-7" style={{ color: "#1e3a5f" }} />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: "#1e3a5f" }}>
              LexTrack
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#features" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              Funcionalidades
            </a>
            <a href="#pricing" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              Precios
            </a>
            <a href="#faq" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              FAQ
            </a>
            <Link
              to="/login"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5"
            >
              Iniciar sesión
            </Link>
            <Button asChild style={{ backgroundColor: "#1e3a5f" }}>
              <Link to="/login">Empezar gratis</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #f4f6f8 0%, #ffffff 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Badge
            className="mb-6"
            variant="secondary"
            style={{ backgroundColor: "#e0e7ef", color: "#1e3a5f" }}
          >
            Sin tarjeta de crédito
          </Badge>
          <h1
            className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto"
            style={{ color: "#1e3a5f" }}
          >
            Gestión legal inteligente para abogados chilenos
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Monitorea causas PJUD, gestiona honorarios, recibe alertas del
            Diario Oficial y deja que la IA redacte tus escritos. Todo en una
            sola plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="text-base px-6 h-12"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <Link to="/login">Empezar gratis 14 días</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base px-6 h-12">
              <a href="#demo">Ver demo</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
              style={{ color: "#1e3a5f" }}
            >
              Todo lo que necesitas para tu práctica legal
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Una plataforma que cubre desde el seguimiento de causas hasta la
              redacción de escritos con IA.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: "#e0e7ef" }}
                  >
                    <Icon className="w-6 h-6" style={{ color: "#1e3a5f" }} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2" style={{ color: "#1e3a5f" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="py-20" style={{ backgroundColor: "#f4f6f8" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
              style={{ color: "#1e3a5f" }}
            >
              Ver LexTrack en acción
            </h2>
            <p className="text-gray-600">
              Un recorrido por las principales funcionalidades.
            </p>
          </div>
          <div
            className="aspect-video w-full rounded-xl border border-gray-200 bg-gray-200 flex items-center justify-center text-gray-500 text-sm shadow-inner"
            aria-label="Demo placeholder"
          >
            Demo en producción próximamente
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
              style={{ color: "#1e3a5f" }}
            >
              Precios simples y transparentes
            </h2>
            <p className="text-gray-600">
              Elige el plan que se adapta al tamaño de tu práctica.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-8 bg-white relative flex flex-col ${
                  plan.highlight
                    ? "shadow-xl scale-[1.02]"
                    : "border-gray-200 shadow-sm"
                }`}
                style={
                  plan.highlight
                    ? { borderColor: "#1e3a5f", borderWidth: 2 }
                    : undefined
                }
              >
                {plan.highlight && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-full text-white"
                    style={{ backgroundColor: "#1e3a5f" }}
                  >
                    Más popular
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-1" style={{ color: "#1e3a5f" }}>
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold" style={{ color: "#1e3a5f" }}>
                    {plan.price}
                  </span>
                  <span className="text-gray-500">{plan.period} CLP</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: "#1e3a5f" }}
                      />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  style={
                    plan.highlight ? { backgroundColor: "#1e3a5f" } : undefined
                  }
                >
                  <Link to="/login">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-8">
            14 días gratis, sin tarjeta de crédito. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20" style={{ backgroundColor: "#f4f6f8" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
              style={{ color: "#1e3a5f" }}
            >
              Preguntas frecuentes
            </h2>
          </div>
          <Accordion type="single" collapsible className="bg-white rounded-xl border border-gray-200 px-6">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold" style={{ color: "#1e3a5f" }}>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            style={{ color: "#1e3a5f" }}
          >
            Empieza a gestionar tu práctica como un estudio grande
          </h2>
          <p className="text-gray-600 mb-8">
            14 días gratis. Sin tarjeta. Sin compromiso.
          </p>
          <Button
            asChild
            size="lg"
            className="text-base px-8 h-12"
            style={{ backgroundColor: "#1e3a5f" }}
          >
            <Link to="/login">Empezar ahora</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5" style={{ color: "#1e3a5f" }} />
            <span className="font-bold" style={{ color: "#1e3a5f" }}>
              LexTrack
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-600">
            <Link to="/terminos" className="hover:text-gray-900">
              Términos
            </Link>
            <Link to="/privacidad" className="hover:text-gray-900">
              Privacidad
            </Link>
            <Link to="/login" className="hover:text-gray-900">
              Iniciar sesión
            </Link>
          </nav>
          <p className="text-xs text-gray-500">© 2026 LexTrack</p>
        </div>
      </footer>
    </div>
  );
}
