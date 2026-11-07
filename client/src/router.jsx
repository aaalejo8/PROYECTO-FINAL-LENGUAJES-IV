import { useEffect, useState } from 'react';

/**
 * Navegación mínima (sin librerías): cambia la dirección con el historial del navegador,
 * así funcionan los botones "atrás/adelante" y los links se pueden compartir.
 */
const EVENTO = 'portfolio:navegar';

const actualCompleto = () => window.location.pathname + window.location.search + window.location.hash;

export function navegar(destino, { reemplazar = false } = {}) {
  if (destino === actualCompleto()) return;
  window.history[reemplazar ? 'replaceState' : 'pushState']({}, '', destino);
  window.dispatchEvent(new Event(EVENTO));
}

const leerUbicacion = () => ({ path: window.location.pathname, search: window.location.search, hash: window.location.hash });

export function useUbicacion() {
  const [ubicacion, setUbicacion] = useState(leerUbicacion);
  useEffect(() => {
    const actualizar = () => setUbicacion(leerUbicacion());
    window.addEventListener('popstate', actualizar);
    window.addEventListener(EVENTO, actualizar);
    return () => {
      window.removeEventListener('popstate', actualizar);
      window.removeEventListener(EVENTO, actualizar);
    };
  }, []);
  return ubicacion;
}

export function Link({ to, replace = false, onClick, children, ...resto }) {
  const manejarClick = (e) => {
    onClick?.(e);
    const conModificador = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (e.defaultPrevented || e.button !== 0 || conModificador || resto.target === '_blank') return;
    e.preventDefault();
    navegar(to, { reemplazar: replace });
  };
  return (
    <a href={to} onClick={manejarClick} {...resto}>
      {children}
    </a>
  );
}

/** Sólo se acepta volver a una dirección interna del sitio (evita redirecciones a otros sitios). */
export function destinoSeguro(valor, porDefecto = '/') {
  return typeof valor === 'string' && valor.startsWith('/') && !valor.startsWith('//') && !valor.includes('\\') ? valor : porDefecto;
}
