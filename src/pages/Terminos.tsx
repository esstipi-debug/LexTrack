import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router";
import { Gavel } from "lucide-react";

export default function Terminos() {
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
            <CardTitle className="text-2xl">Términos y Condiciones de Uso</CardTitle>
            <p className="text-sm text-muted-foreground">
              Última actualización: 1 de enero de 2025
            </p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                1. Descripción del Servicio
              </h2>
              <p>
                LexTrack es una plataforma de gestión legal SaaS diseñada exclusivamente para
                abogados y profesionales del derecho. El servicio permite la administración de
                causas judiciales, tareas, honorarios, alertas normativas y comunicaciones
                legales, facilitando el ejercicio de la profesión jurídica en Chile.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                2. Uso Aceptable
              </h2>
              <p>
                El acceso y uso de LexTrack está restringido a profesionales del derecho
                debidamente habilitados en Chile, incluyendo abogados, procuradores y
                estudiantes en práctica supervisada. El usuario declara ser un profesional
                del área legal o actuar bajo supervisión de uno.
              </p>
              <p>
                Queda prohibido:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Utilizar la plataforma para fines no relacionados con la práctica jurídica.</li>
                <li>Compartir credenciales de acceso con terceros no autorizados.</li>
                <li>Intentar acceder a datos de otros usuarios.</li>
                <li>Usar la plataforma para actividades ilícitas o contrarias al Código de Ética del Colegio de Abogados.</li>
                <li>Realizar ingeniería inversa o extraer el código fuente de la plataforma.</li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                3. Confidencialidad y Datos de Clientes
              </h2>
              <p>
                El usuario es el único responsable de la confidencialidad de los datos de sus
                clientes ingresados en LexTrack. En virtud del secreto profesional consagrado
                en el artículo 360 del Código de Procedimiento Civil y las normas del Colegio
                de Abogados de Chile, el abogado debe garantizar que la información de sus
                clientes se gestione con el máximo estándar de privacidad.
              </p>
              <p>
                LexTrack actúa únicamente como encargado del tratamiento de datos, procesando
                la información exclusivamente según las instrucciones del usuario, en conformidad
                con la Ley N° 19.628 sobre Protección de la Vida Privada.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                4. Propiedad Intelectual
              </h2>
              <p>
                Todos los derechos de propiedad intelectual sobre LexTrack, incluyendo pero
                sin limitarse a su código fuente, diseño, marcas, logotipos, interfaz y
                contenidos propios, son de titularidad exclusiva de LexTrack SpA. Ninguna
                disposición de estos términos otorga al usuario licencia alguna sobre la
                propiedad intelectual de LexTrack, salvo el derecho limitado de uso descrito
                en estos términos.
              </p>
              <p>
                El usuario conserva todos los derechos sobre los datos que ingrese a la
                plataforma. LexTrack no reclama propiedad sobre el contenido del usuario.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                5. Limitación de Responsabilidad
              </h2>
              <p>
                LexTrack es una herramienta de apoyo para la gestión legal. El servicio se
                entrega "tal como está" y LexTrack SpA no garantiza que sea libre de errores
                o interrupciones. La plataforma no presta servicios jurídicos, no constituye
                asesoría legal y no reemplaza el criterio profesional del abogado.
              </p>
              <p>
                En ningún caso LexTrack SpA será responsable por daños directos, indirectos,
                incidentales o consecuenciales derivados del uso o imposibilidad de uso de la
                plataforma, incluyendo pérdida de datos, oportunidades o ingresos, salvo en
                casos de dolo o culpa grave imputable directamente a LexTrack SpA.
              </p>
              <p>
                La responsabilidad máxima de LexTrack SpA ante el usuario no excederá el
                monto pagado por el servicio en los últimos tres (3) meses.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                6. Suspensión y Terminación
              </h2>
              <p>
                LexTrack se reserva el derecho de suspender o terminar el acceso de cualquier
                usuario que incumpla estos términos, sin perjuicio de las acciones legales
                correspondientes. El usuario podrá solicitar la eliminación de su cuenta y
                los datos asociados en cualquier momento escribiendo a{" "}
                <a
                  href="mailto:privacidad@lextrack.cl"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  privacidad@lextrack.cl
                </a>.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                7. Ley Aplicable y Jurisdicción
              </h2>
              <p>
                Estos términos se rigen por las leyes de la República de Chile. Cualquier
                disputa que surja en relación con estos términos o el uso de la plataforma
                se someterá a la jurisdicción de los Tribunales Ordinarios de Justicia de
                la ciudad de Santiago, Chile, renunciando las partes a cualquier otro fuero
                que pudiera corresponderles.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                8. Contacto
              </h2>
              <p>
                Para consultas sobre estos términos puede escribir a{" "}
                <a
                  href="mailto:legal@lextrack.cl"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  legal@lextrack.cl
                </a>{" "}
                o a nuestra dirección: LexTrack SpA, Santiago, Chile.
              </p>
            </section>

            <div className="pt-4 text-xs text-muted-foreground">
              <p>
                Consulta también nuestra{" "}
                <Link to="/privacidad" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Política de Privacidad
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
