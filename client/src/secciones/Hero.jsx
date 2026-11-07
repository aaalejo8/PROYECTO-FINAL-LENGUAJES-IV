import { useEffect, useRef } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from '../router';
import { estiloBoton, Insignia } from '../componentes/ui';
import { gsap, sinMovimiento, useContador } from '../animaciones';

function Numero({ valor, etiqueta, sufijo = '' }) {
  const [n, ref] = useContador(valor);
  return (
    <div ref={ref}>
      <p className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        {n}
        {sufijo}
      </p>
      <p className="mt-1 text-sm text-ink-2">{etiqueta}</p>
    </div>
  );
}

export default function Hero({ perfil, tecnologias, proyectos }) {
  const raiz = useRef(null);
  const nombre = perfil?.nombre || 'Alejo Almada';
  const titular = perfil?.titular || 'Desarrollador Fullstack';
  const principales = tecnologias.slice(0, 5).map((t) => t.nombre);

  useEffect(() => {
    if (sinMovimiento() || !raiz.current) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-hero="etiqueta"]', { opacity: 0, y: 16, duration: 0.5 })
        .from('[data-hero="linea"]', { yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.12 }, '-=0.2')
        .from('[data-hero="texto"]', { opacity: 0, y: 20, duration: 0.6 }, '-=0.4')
        .from('[data-hero="cta"]', { opacity: 0, y: 16, duration: 0.5, stagger: 0.1 }, '-=0.3')
        .from('[data-hero="foto"]', { opacity: 0, scale: 0.94, duration: 0.8 }, '-=0.7')
        .from('[data-hero="terminal"]', { opacity: 0, x: 40, duration: 0.8 }, '-=0.5')
        .from('[data-hero="codigo"]', { opacity: 0, x: -10, duration: 0.3, stagger: 0.12 }, '-=0.3');
      // Manchas de luz que flotan despacio
      gsap.to('[data-blob]', { y: 'random(-26, 26)', x: 'random(-26, 26)', duration: 'random(4, 7)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.6 });
      // Parallax: al bajar, el fondo sube más lento que el contenido
      gsap.to('[data-parallax]', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: raiz.current, start: 'top top', end: 'bottom top', scrub: true } });
    }, raiz);
    return () => ctx.revert();
  }, []);

  return (
    <section id="inicio" ref={raiz} className="relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-0 fondo-puntos opacity-40" aria-hidden="true" data-parallax />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" data-blob />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" data-blob />
      <div className="pointer-events-none absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" data-blob />

      <div className="contenedor relative grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-28">
        <div className="min-w-0">
          <p data-hero="etiqueta" className="mb-6 flex flex-wrap items-center gap-3">
            {perfil?.disponible !== false && (
              <Insignia tono="ok">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" /> Disponible para proyectos
              </Insignia>
            )}
            {perfil?.ubicacion && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                <MapPin size={15} aria-hidden="true" /> {perfil.ubicacion}
              </span>
            )}
          </p>
          <h1 className="text-[2.6rem] font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
            <span className="block overflow-hidden pb-1">
              <span data-hero="linea" className="block">
                Hola, soy
              </span>
            </span>
            <span className="block overflow-hidden pb-2">
              <span data-hero="linea" className="texto-degradado block">
                {nombre}
              </span>
            </span>
          </h1>
          <p data-hero="texto" className="mt-5 font-mono text-base text-secondary sm:text-lg">
            {titular}
          </p>
          <p data-hero="texto" className="mt-5 max-w-xl text-lg text-ink-2">
            {perfil?.bio || 'Diseño, programo y publico aplicaciones web completas.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link data-hero="cta" to="/#proyectos" className={estiloBoton('primario', 'lg')}>
              Ver proyectos <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link data-hero="cta" to="/#contacto" className={estiloBoton('secundario', 'lg')}>
              Contactarme
            </Link>
          </div>
        </div>

        <div className="relative min-w-0">
          {perfil?.foto_url && (
            <figure data-hero="foto" className="relative mx-auto w-full max-w-sm lg:ml-auto lg:mr-0">
              <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-primary/40 via-accent/25 to-secondary/30 blur-xl" aria-hidden="true" />
              <img
                src={perfil.foto_url}
                alt={`Foto de ${nombre}`}
                width="1106"
                height="1002"
                fetchpriority="high"
                className="relative aspect-[1106/1002] w-full rounded-[1.5rem] border border-line object-cover shadow-2xl"
              />
            </figure>
          )}
        <div
          data-hero="terminal"
          className={`relative rounded-lg border border-line bg-surface-1/90 backdrop-blur ${perfil?.foto_url ? '-mt-14 mx-3 shadow-xl sm:mx-auto sm:max-w-sm lg:-ml-10 lg:mr-auto' : ''}`}
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-danger/80" />
            <span className="h-3 w-3 rounded-full bg-warning/80" />
            <span className="h-3 w-3 rounded-full bg-success/80" />
            <span className="ml-3 font-mono text-xs text-ink-3">perfil.js</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[0.8rem] leading-7 text-ink-2 sm:text-sm">
            <code>
              <span data-hero="codigo" className="block">
                <span className="text-accent">const</span> <span className="text-secondary">dev</span> = {'{'}
              </span>
              <span data-hero="codigo" className="block pl-5">
                nombre: <span className="text-primary">"{nombre}"</span>,
              </span>
              <span data-hero="codigo" className="block pl-5">
                rol: <span className="text-primary">"{titular}"</span>,
              </span>
              <span data-hero="codigo" className="block pl-5">
                stack: [{principales.map((t, i) => (
                  <span key={t}>
                    <span className="text-primary">"{t}"</span>
                    {i < principales.length - 1 ? ', ' : ''}
                  </span>
                ))}],
              </span>
              <span data-hero="codigo" className="block pl-5">
                disponible: <span className="text-warning">{String(perfil?.disponible !== false)}</span>,
              </span>
              <span data-hero="codigo" className="block">
                {'}'};<span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-primary" />
              </span>
            </code>
          </pre>
        </div>
        </div>
      </div>

      <div className="contenedor relative border-t border-line/60 py-8">
        <div className="grid grid-cols-3 gap-6 sm:max-w-xl">
          <Numero valor={perfil?.anios_experiencia ?? 0} etiqueta="años de experiencia" sufijo="+" />
          <Numero valor={proyectos.length} etiqueta="proyectos publicados" />
          <Numero valor={tecnologias.length} etiqueta="tecnologías" />
        </div>
      </div>
    </section>
  );
}
