import { useEffect, useRef } from 'react';
import { EncabezadoSeccion } from '../componentes/ui';
import { gsap, sinMovimiento } from '../animaciones';

export default function Experiencia({ experiencia }) {
  const lista = useRef(null);

  // La línea vertical se "dibuja" a medida que se baja por la página
  useEffect(() => {
    if (sinMovimiento() || !lista.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-linea]',
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', transformOrigin: 'top', scrollTrigger: { trigger: lista.current, start: 'top 75%', end: 'bottom 70%', scrub: true } }
      );
    }, lista);
    return () => ctx.revert();
  }, [experiencia.length]);

  return (
    <section id="experiencia" className="seccion border-b border-line bg-surface-1">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="03 · Experiencia" titulo="Trayectoria" />
        {experiencia.length === 0 ? (
          <p className="text-ink-2">Pronto vas a ver acá la trayectoria.</p>
        ) : (
          <ol ref={lista} className="relative ml-3 space-y-10 pl-8 sm:ml-0 sm:pl-10" data-reveal-grupo>
            <span className="absolute left-0 top-1 bottom-1 w-px bg-line" aria-hidden="true" />
            <span data-linea className="absolute left-0 top-1 bottom-1 w-px bg-primary" aria-hidden="true" />
            {experiencia.map((e) => (
              <li key={e.id} data-item className="relative">
                <span className="absolute -left-[2.4rem] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-surface-1 sm:-left-[2.65rem]" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-wider text-secondary">
                  {e.desde} — {e.hasta || 'Actualidad'}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{e.puesto}</h3>
                <p className="text-ink-2">{e.organizacion}</p>
                {e.descripcion && <p className="mt-2 max-w-2xl text-ink-2">{e.descripcion}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
