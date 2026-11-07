import { ArrowRight } from 'lucide-react';
import { Link } from '../router';
import Icono from '../componentes/Icono';
import { EncabezadoSeccion } from '../componentes/ui';

export default function Servicios({ servicios }) {
  return (
    <section id="servicios" className="seccion border-b border-line">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="02 · Servicios" titulo="Qué puedo hacer por tu proyecto">
          Desde una idea hasta una aplicación publicada. Si no ves lo que necesitás, escribime igual.
        </EncabezadoSeccion>
        {servicios.length === 0 ? (
          <p className="text-ink-2">Pronto vas a ver acá los servicios disponibles.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal-grupo>
            {servicios.map((s) => (
              <article key={s.id} data-item className="group rounded-lg border border-line bg-surface-2 p-6 transition-all hover:-translate-y-1 hover:border-primary/60">
                <span className="mb-5 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <Icono nombre={s.icono} />
                </span>
                <h3 className="text-xl font-semibold">{s.titulo}</h3>
                <p className="mt-2 text-ink-2">{s.descripcion}</p>
              </article>
            ))}
          </div>
        )}
        <div className="mt-10" data-reveal>
          <Link to="/#contacto" className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary-hover">
            Pedir una cotización o asesoría <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
