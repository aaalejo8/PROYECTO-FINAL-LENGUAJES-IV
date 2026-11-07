import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Si la persona pidió menos movimiento en su sistema, no se anima nada. */
export const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/*
 * Las animaciones "al entrar en pantalla" usan IntersectionObserver (el navegador avisa cuando el
 * elemento se ve), NO posiciones precalculadas: si la página cambia de alto después (llegan datos,
 * imágenes o la sección de GitHub, o se entra directo a /#proyectos), igual se disparan bien.
 * Antes, con posiciones calculadas al montar, el contenido podía quedar invisible para siempre.
 */
const hayObservador = () => typeof window !== 'undefined' && 'IntersectionObserver' in window;

/** Llama a `alEntrar(el)` una sola vez, cuando cada elemento entra en pantalla. Devuelve cómo dejar de observar. */
function alEntrarEnPantalla(elementos, alEntrar, margen = '0px 0px -8% 0px') {
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        observador.unobserve(e.target);
        alEntrar(e.target);
      });
    },
    { rootMargin: margen, threshold: 0 }
  );
  elementos.forEach((el) => observador.observe(el));
  return () => observador.disconnect();
}

/**
 * Aparición al hacer scroll. En el contenedor:
 *   [data-reveal]            → el elemento sube y aparece
 *   [data-reveal-grupo]      → sus hijos [data-item] aparecen uno tras otro
 * `dependencias` permite volver a calcular cuando llega contenido nuevo (por ejemplo, datos del servidor).
 */
export function useReveal(dependencias = []) {
  const raiz = useRef(null);
  useEffect(() => {
    if (sinMovimiento() || !hayObservador() || !raiz.current) return undefined;
    let dejar = () => {};
    const ctx = gsap.context(() => {
      const sueltos = gsap.utils.toArray('[data-reveal]');
      const grupos = gsap.utils.toArray('[data-reveal-grupo]').filter((g) => g.querySelector('[data-item]'));
      gsap.set(sueltos, { opacity: 0, y: 28 });
      grupos.forEach((g) => gsap.set(g.querySelectorAll('[data-item]'), { opacity: 0, y: 24 }));
      const dejarSueltos = alEntrarEnPantalla(sueltos, (el) => {
        ctx.add(() => gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }));
      });
      const dejarGrupos = alEntrarEnPantalla(grupos, (g) => {
        ctx.add(() => gsap.to(g.querySelectorAll('[data-item]'), { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }));
      });
      dejar = () => {
        dejarSueltos();
        dejarGrupos();
      };
    }, raiz);
    return () => {
      dejar();
      ctx.revert(); // deja los elementos visibles y sin estilos de la animación
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
  return raiz;
}

/** Número que "cuenta" desde 0 hasta `valor` cuando entra en pantalla. */
export function useContador(valor, { duracion = 1.2 } = {}) {
  const destino = Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const [actual, setActual] = useState(sinMovimiento() ? destino : 0);
  const ref = useRef(null);
  useEffect(() => {
    if (sinMovimiento() || !hayObservador() || !ref.current) {
      setActual(destino);
      return undefined;
    }
    let tween;
    const dejar = alEntrarEnPantalla([ref.current], () => {
      const obj = { v: 0 };
      tween = gsap.to(obj, { v: destino, duration: duracion, ease: 'power2.out', onUpdate: () => setActual(Math.round(obj.v)) });
    }, '0px');
    return () => {
      dejar();
      tween?.kill();
    };
  }, [destino, duracion]);
  return [actual, ref];
}

// Las animaciones ligadas al scroll (parallax, línea de la experiencia, barras de GitHub) sí usan
// posiciones: se recalculan solas cada vez que la página cambia de alto.
if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
  let pendiente;
  new ResizeObserver(() => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(document.documentElement);
}
