import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Si hay una ventana encima de otra (por ejemplo una confirmación), sólo la de arriba responde al teclado.
const pila = [];

/**
 * Ventana que aparece encima de la página: en el centro (en el celular sube desde abajo),
 * o como panel lateral. Se cierra con Escape o tocando afuera, atrapa el foco del teclado
 * y bloquea el scroll de la página de atrás.
 */
export default function Superposicion({ abierto, onCerrar, titulo, lado = 'centro', ancho = 'max-w-lg', sinCabecera = false, children }) {
  const panel = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const anterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    const marca = {};
    pila.push(marca);
    document.body.style.overflow = 'hidden';
    (panel.current?.querySelector('[data-autofocus]') || panel.current)?.focus({ preventScroll: true });

    const teclas = (e) => {
      if (pila[pila.length - 1] !== marca) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const focos = [...panel.current.querySelectorAll(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === panel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('keydown', teclas);
      pila.splice(pila.indexOf(marca), 1);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus?.({ preventScroll: true });
    };
  }, [abierto]);

  if (!abierto) return null;

  const fondo = 'border border-line bg-surface-2 text-ink';
  const posicion = { centro: 'items-end justify-center sm:items-center sm:p-4', derecha: 'justify-end', izquierda: 'justify-start' }[lado];
  const forma = {
    centro: `w-full ${ancho} max-h-[92dvh] overflow-y-auto rounded-t-lg sm:rounded-lg animate-pop`,
    derecha: 'h-full w-full max-w-md flex flex-col animate-slide-in',
    izquierda: 'h-full w-72 max-w-[85vw] flex flex-col animate-slide-in-left',
  }[lado];

  return (
    <div className={`fixed inset-0 z-50 flex ${posicion}`}>
      <div className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm animate-fade" onClick={onCerrar} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} className={`relative shadow-float outline-none ${fondo} ${forma}`}>
        {!sinCabecera && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3">
            <h2 className="font-display text-xl font-semibold leading-tight">{titulo}</h2>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-ink">
              <X size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
