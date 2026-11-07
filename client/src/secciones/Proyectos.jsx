import { ArrowUpRight, Layers, Lock } from 'lucide-react';
import { Link } from '../router';
import { EncabezadoSeccion, Insignia } from '../componentes/ui';
import { useSesion } from '../contexto';

function Portada({ proyecto }) {
  if (proyecto.imagen_url) {
    return <img src={proyecto.imagen_url} alt="" loading="lazy" className="h-full w-full object-cover" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1">
      <span className="font-mono text-4xl font-medium text-primary/80">{'</>'}</span>
    </div>
  );
}

export default function Proyectos({ proyectos }) {
  const { usuario } = useSesion();
  return (
    <section id="proyectos" className="seccion border-b border-line">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="04 · Proyectos" titulo="Trabajos seleccionados">
          {usuario
            ? 'Entrá a cada proyecto para ver la descripción completa y probar las demos.'
            : 'Podés ver la lista completa. Para abrir el detalle y las demos, creá una cuenta gratis o ingresá con Google.'}
        </EncabezadoSeccion>
        {proyectos.length === 0 ? (
          <p className="text-ink-2">Pronto vas a ver acá los proyectos.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2" data-reveal-grupo>
            {proyectos.map((p) => (
              <Link
                key={p.id}
                data-item
                to={`/proyectos/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-2 transition-all hover:-translate-y-1 hover:border-primary/60"
              >
                <div className="relative aspect-[16/9] overflow-hidden border-b border-line">
                  <Portada proyecto={p} />
                  {p.destacado && (
                    <Insignia tono="primario" className="absolute left-3 top-3 bg-surface-1/90">
                      Destacado
                    </Insignia>
                  )}
                  {!usuario && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-1/90 px-2.5 py-1 text-xs text-ink-2">
                      <Lock size={12} aria-hidden="true" /> Sólo registrados
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="flex items-start justify-between gap-3 text-xl font-semibold">
                    {p.titulo}
                    <ArrowUpRight size={20} className="mt-0.5 shrink-0 text-ink-3 transition-colors group-hover:text-primary" aria-hidden="true" />
                  </h3>
                  <p className="mt-2 text-ink-2">{p.resumen}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tecnologias.map((t) => (
                      <Insignia key={t} mono>
                        {t}
                      </Insignia>
                    ))}
                  </div>
                  <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm text-ink-3">
                    <Layers size={15} aria-hidden="true" />
                    {p.cantidad_demos === 0 ? 'Sin demos todavía' : p.cantidad_demos === 1 ? '1 demo disponible' : `${p.cantidad_demos} demos disponibles`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
