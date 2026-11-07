import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Github, Lock, MonitorPlay } from 'lucide-react';
import { api } from '../api';
import { useSesion } from '../contexto';
import { Link } from '../router';
import { BloqueError, Cargando, estiloBoton, Insignia } from '../componentes/ui';
import { gsap, sinMovimiento } from '../animaciones';

function Demo({ demo }) {
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface-2" data-reveal>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <MonitorPlay size={18} className="text-secondary" aria-hidden="true" /> {demo.titulo}
          </h3>
          {demo.descripcion && <p className="mt-1 text-sm text-ink-2">{demo.descripcion}</p>}
        </div>
        <a href={demo.url} target="_blank" rel="noopener noreferrer" className={estiloBoton('secundario', 'sm')}>
          Abrir en otra pestaña <ExternalLink size={15} aria-hidden="true" />
        </a>
      </header>
      {demo.tipo === 'iframe' && (
        <div className="bg-surface-0">
          <iframe
            title={`Demo: ${demo.titulo}`}
            src={demo.url}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="h-[28rem] w-full border-0 sm:h-[34rem]"
          />
          <p className="border-t border-line px-5 py-2 text-xs text-ink-3">Si no se ve, es porque ese sitio no permite mostrarse dentro de otras páginas: usá el botón de arriba.</p>
        </div>
      )}
    </article>
  );
}

export default function ProyectoDetalle({ slug }) {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const [proyecto, setProyecto] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cargandoSesion || !usuario) return;
    let vigente = true;
    setProyecto(null);
    setError(null);
    api
      .proyecto(slug)
      .then((p) => vigente && setProyecto(p))
      .catch((e) => vigente && setError(e));
    return () => {
      vigente = false;
    };
  }, [slug, usuario?.id, cargandoSesion]);

  useEffect(() => {
    if (!proyecto || sinMovimiento()) return;
    gsap.from('[data-entrada]', { opacity: 0, y: 20, duration: 0.6, ease: 'power3.out', stagger: 0.1 });
  }, [proyecto]);

  if (cargandoSesion) return <Cargando className="min-h-[60vh]" />;

  // Sin cuenta: el servidor no entrega el detalle, así que ni se pide
  if (!usuario) {
    return (
      <section className="contenedor grid min-h-[70vh] place-items-center py-16">
        <div className="max-w-md rounded-lg border border-line bg-surface-2 p-8 text-center">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock size={26} aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold">Este proyecto es para personas registradas</h1>
          <p className="mt-3 text-ink-2">Creá una cuenta gratis (o ingresá con Google) para ver la descripción completa y probar las demos.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to={`/ingresar?modo=registro&volver=${encodeURIComponent(`/proyectos/${slug}`)}`} className={estiloBoton('primario', 'md')}>
              Crear cuenta
            </Link>
            <Link to={`/ingresar?volver=${encodeURIComponent(`/proyectos/${slug}`)}`} className={estiloBoton('secundario', 'md')}>
              Ya tengo cuenta
            </Link>
          </div>
          <Link to="/#proyectos" className="mt-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-primary">
            <ArrowLeft size={15} aria-hidden="true" /> Volver a los proyectos
          </Link>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div className="contenedor py-24">
        <BloqueError mensaje={error.estado === 404 ? 'Ese proyecto no existe o ya no está disponible.' : error.message} />
        <p className="mt-6 text-center">
          <Link to="/#proyectos" className="text-primary hover:text-primary-hover">
            Volver a los proyectos
          </Link>
        </p>
      </div>
    );
  }
  if (!proyecto) return <Cargando className="min-h-[60vh]" />;

  return (
    <article className="contenedor py-10 lg:py-16">
      <Link to="/#proyectos" data-entrada className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-primary">
        <ArrowLeft size={16} aria-hidden="true" /> Todos los proyectos
      </Link>

      <header className="max-w-3xl">
        <p data-entrada className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Proyecto
        </p>
        <h1 data-entrada className="text-4xl font-bold sm:text-5xl">
          {proyecto.titulo}
        </h1>
        <p data-entrada className="mt-4 text-lg text-ink-2">
          {proyecto.resumen}
        </p>
        <div data-entrada className="mt-5 flex flex-wrap gap-2">
          {proyecto.tecnologias.map((t) => (
            <Insignia key={t} mono tono="secundario">
              {t}
            </Insignia>
          ))}
        </div>
        {proyecto.repo_url && (
          <a data-entrada href={proyecto.repo_url} target="_blank" rel="noopener noreferrer" className={estiloBoton('secundario', 'md', 'mt-6')}>
            <Github size={18} aria-hidden="true" /> Ver el código
          </a>
        )}
      </header>

      {proyecto.imagen_url && (
        <img data-entrada src={proyecto.imagen_url} alt={`Captura de ${proyecto.titulo}`} className="mt-10 max-h-[32rem] w-full rounded-md border border-line object-cover" />
      )}

      <div className="mt-10 max-w-3xl space-y-4 text-lg leading-relaxed text-ink-2" data-entrada>
        {proyecto.descripcion.split(/\n{2,}/).map((parrafo, i) => (
          <p key={i}>{parrafo}</p>
        ))}
      </div>

      <section className="mt-14" aria-labelledby="titulo-demos">
        <h2 id="titulo-demos" className="mb-6 text-2xl font-semibold">
          Demos
        </h2>
        {proyecto.demos.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface-2 p-6 text-ink-2">Este proyecto todavía no tiene demos publicadas.</p>
        ) : (
          <div className="space-y-6">
            {proyecto.demos.map((d) => (
              <Demo key={d.id} demo={d} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
