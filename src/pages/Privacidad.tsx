import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router";
import { Gavel } from "lucide-react";

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Gavel className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            LexTrack
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Política de Privacidad</CardTitle>
            <p className="text-sm text-muted-foreground">
              Última actualización: 1 de enero de 2025 — Conforme a la Ley N° 19.628
            </p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                1. Responsable del Tratamiento
              </h2>
              <p>
                <strong>LexTrack SpA</strong>, RUT por confirmar, con domicilio en Santiago,
                Chile, es el responsable del tratamiento de sus datos personales conforme a
                lo dispuesto en la Ley N° 19.628 sobre Protección de la Vida Privada.
              </p>
              <p>
                Contacto del responsable:{" "}
                <a
                  href="mailto:privacidad@lextrack.cl"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacidad@lextrack.cl
                </a>
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                2. Datos Personales que Recopilamos
              </h2>
              <p>
                Al utilizar LexTrack, recopilamos y tratamos los siguientes datos personales:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Datos de identificación:</strong> nombre completo y dirección de
                  correo electrónico, proporcionados a través de su proveedor de autenticación
                  (Google u otros servicios OAuth).
                </li>
                <li>
                  <strong>Foto de perfil (avatar):</strong> imagen proporcionada opcionalmente
                  por el usuario.
                </li>
                <li>
                  <strong>Datos de causas y actividad jurídica:</strong> causas, tareas,
                  alertas, honorarios, denuncias Ley Karin y demás contenido que el usuario
                  ingrese a la plataforma.
                </li>
                <li>
                  <strong>Datos de actividad:</strong> registros de inicio de sesión,
                  historial de navegación dentro de la plataforma, y metadatos de uso.
                </li>
                <li>
                  <strong>Datos de facturación:</strong> información de suscripción y pago,
                  procesada por proveedores de pago externos (Stripe / MercadoPago).
                </li>
              </ul>
              <p>
                LexTrack <strong>no recopila</strong> datos sensibles en el sentido del
                artículo 2 letra g) de la Ley N° 19.628, salvo aquellos que el propio
                usuario ingrese voluntariamente en el contexto de la gestión de sus causas.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                3. Finalidad del Tratamiento
              </h2>
              <p>Sus datos personales son tratados exclusivamente para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Prestar el servicio de gestión legal contratado.</li>
                <li>Autenticar y gestionar su cuenta de usuario.</li>
                <li>Enviar notificaciones relacionadas con el uso del servicio.</li>
                <li>Mejorar la plataforma mediante análisis de uso agregado y anonimizado.</li>
                <li>Cumplir obligaciones legales aplicables.</li>
                <li>Procesar el pago de la suscripción contratada.</li>
              </ul>
              <p>
                No comercializamos, vendemos ni cedemos sus datos personales a terceros
                para fines de marketing.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                4. Base Legal del Tratamiento
              </h2>
              <p>El tratamiento de sus datos se basa en:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Consentimiento explícito:</strong> otorgado al aceptar estos términos
                  durante el proceso de incorporación (<em>onboarding</em>), conforme al
                  artículo 4 de la Ley N° 19.628.
                </li>
                <li>
                  <strong>Ejecución del contrato:</strong> el tratamiento es necesario para
                  prestar el servicio contratado.
                </li>
                <li>
                  <strong>Cumplimiento de obligaciones legales:</strong> cuando la ley
                  chilena así lo requiera.
                </li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                5. Derechos del Titular (ARCO)
              </h2>
              <p>
                Conforme a los artículos 12 y siguientes de la Ley N° 19.628, usted tiene
                derecho a:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Acceso:</strong> solicitar información sobre los datos personales
                  que LexTrack trata sobre usted.
                </li>
                <li>
                  <strong>Rectificación:</strong> solicitar la corrección de datos inexactos
                  o incompletos.
                </li>
                <li>
                  <strong>Cancelación:</strong> solicitar la eliminación de sus datos cuando
                  no sean necesarios para la finalidad para la que fueron recopilados.
                </li>
                <li>
                  <strong>Oposición:</strong> oponerse al tratamiento de sus datos en los
                  casos previstos por la ley.
                </li>
              </ul>
              <p>
                Puede exportar sus datos directamente desde la sección{" "}
                <strong>Configuración → Datos y privacidad</strong> de la plataforma.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                6. Cómo Ejercer sus Derechos
              </h2>
              <p>
                Para ejercer cualquiera de sus derechos ARCO, envíe una solicitud a:
              </p>
              <p className="font-medium">
                <a
                  href="mailto:privacidad@lextrack.cl"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacidad@lextrack.cl
                </a>
              </p>
              <p>
                Su solicitud debe incluir: nombre completo, dirección de correo electrónico
                asociada a su cuenta y descripción detallada del derecho que desea ejercer.
                Responderemos dentro de los plazos establecidos por la Ley N° 19.628.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                7. Transferencias Internacionales de Datos
              </h2>
              <p>
                Para la prestación del servicio, sus datos pueden ser transferidos a los
                siguientes proveedores externos ubicados fuera de Chile:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Anthropic AI (EE.UU.):</strong> proveedor del modelo de inteligencia
                  artificial utilizado por el Asistente Legal de LexTrack. Los datos enviados
                  a Anthropic se limitan al contenido de las consultas realizadas al asistente.
                  Anthropic opera bajo las leyes de privacidad de los Estados Unidos y cuenta
                  con medidas de seguridad alineadas con estándares internacionales.
                </li>
                <li>
                  <strong>Proveedor de infraestructura cloud:</strong> los servidores de
                  LexTrack pueden estar alojados en proveedores de nube internacionales con
                  certificaciones de seguridad (ISO 27001 / SOC 2).
                </li>
                <li>
                  <strong>Stripe / MercadoPago:</strong> procesadores de pago que tratan datos
                  de facturación conforme a PCI DSS y sus propias políticas de privacidad.
                </li>
              </ul>
              <p>
                LexTrack adopta las medidas contractuales y técnicas necesarias para garantizar
                un nivel adecuado de protección en estas transferencias.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                8. Cookies y Tecnologías de Seguimiento
              </h2>
              <p>
                LexTrack utiliza exclusivamente <strong>cookies de sesión</strong> estrictamente
                necesarias para mantener su autenticación mientras navega en la plataforma.
                Estas cookies se eliminan al cerrar el navegador y no se utilizan para rastrear
                su actividad en otros sitios web.
              </p>
              <p>
                No utilizamos cookies de publicidad, marketing ni seguimiento de terceros.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                9. Retención de Datos
              </h2>
              <p>
                Sus datos personales se conservan mientras mantenga una cuenta activa en
                LexTrack. Una vez eliminada su cuenta, los datos se suprimirán dentro de un
                plazo máximo de 30 días hábiles, salvo que la ley exija su conservación por
                un período mayor.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                10. Modificaciones a esta Política
              </h2>
              <p>
                LexTrack podrá actualizar esta política de privacidad. Ante cambios
                sustanciales, le notificaremos por correo electrónico o mediante un aviso
                destacado en la plataforma. Le recomendamos revisar periódicamente esta
                página.
              </p>
            </section>

            <div className="pt-4 text-xs text-muted-foreground">
              <p>
                Consulta también nuestros{" "}
                <Link to="/terminos" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Términos y Condiciones
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
