import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Github, Star } from 'lucide-react';
import { api } from '../api';
import { EncabezadoSeccion, Insignia } from '../componentes/ui';
import { gsap, sinMovimiento } from '../animaciones';
import { fecha } from '../utils';

/**
 * Actividad pública de GitHub (API REST de GitHub, consultada por el servidor y guardada 15 minutos).
 * Si no hay usuario configurado o GitHub no responde, la sección no se muestra.
 */
export default function ActividadGithub() {
  const [datos, setDatos] = useState(null);
  const barras = useRef(null);

  useEffect(() => {
    let vigente = true;
    api
      .github()
      .then((d) => vigente && setDatos(d))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!datos?.disponible || sinMovimiento() || !barras.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('[data-barra]', { scaleX: 0, transformOrigin: 'left', duration: 1, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: barras.current, start: 'top 85%', once: true } });
    }, barras);
    return () => ctx.revert();
  }, [datos]);

  if (!datos?.disponible) return null;

  return (
    <section id="github" className="seccion border-b border-line bg-surface-1">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="05 · Actividad" titulo="En GitHub">
          Datos en vivo de mi cuenta pública: repositorios, lenguajes y últimos movimientos.
        </EncabezadoSeccion>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div ref={barras} className="rounded-lg border border-line bg-surface-2 p-6" data-reveal>
            <div className="mb-6 flex items-center gap-4">
              <Github size={32} aria-hidden="true" />
              <div>
                <a href={datos.perfil_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-ink hover:text-primary">
                  @{datos.usuario} <ExternalLink size={14} aria-hidden="true" />
                </a>
                <p className="text-sm text-ink-2">
                  {datos.totales.repos} repositorios · {datos.totales.estrellas} <Star size={12} className="inline -translate-y-px" aria-hidden="true" />
                </p>
              </div>
            </div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-3">Lenguajes más usados</h3>
            <ul className="space-y-3">
              {datos.lenguajes.map((l) => (
                <li key={l.nombre}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-mono text-ink">{l.nombre}</span>
                    <span className="text-ink-2">{l.porcentaje}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div data-barra className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max(l.porcentaje, 2)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2" data-reveal-grupo>
            {datos.repos.map((r) => (
              <li key={r.nombre} data-item>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col rounded-lg border border-line bg-surface-2 p-5 transition-colors hover:border-primary/60"
                >
                  <span className="flex items-center justify-between gap-2 font-mono text-sm text-ink">
                    <span className="truncate">{r.nombre}</span>
                    <span className="flex shrink-0 items-center gap-1 text-ink-3">
                      <Star size={13} aria-hidden="true" /> {r.estrellas}
                    </span>
                  </span>
                  <span className="mt-2 flex-1 text-sm text-ink-2">{r.descripcion || 'Sin descripción.'}</span>
                  <span className="mt-4 flex items-center justify-between text-xs text-ink-3">
                    {r.lenguaje ? <Insignia mono>{r.lenguaje}</Insignia> : <span />}
                    <span>Actualizado {fecha(r.actualizado)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
