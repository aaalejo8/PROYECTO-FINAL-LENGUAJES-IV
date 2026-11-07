import { lazy, Suspense, useEffect } from 'react';
import { Proveedores } from './contexto';
import { Cabecera, Pie } from './componentes/Layout';
import { Cargando } from './componentes/ui';
import { api } from './api';
import { useUbicacion } from './router';
import { sinMovimiento } from './animaciones';
import Inicio from './paginas/Inicio';
import ProyectoDetalle from './paginas/ProyectoDetalle';
import Ingresar from './paginas/Ingresar';
import AuthCallback from './paginas/AuthCallback';
import NoEncontrada from './paginas/NoEncontrada';

// El panel (con los gráficos) se descarga sólo cuando alguien entra a /panel
const Panel = lazy(() => import('./panel/Panel'));

/** Cuenta la visita una sola vez por sesión de navegación. */
function useContarVisita() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('portfolio_visita')) return;
      sessionStorage.setItem('portfolio_visita', '1');
    } catch (_) {
      /* sin sessionStorage: se cuenta igual */
    }
    api.visita(window.location.pathname).catch(() => {});
  }, []);
}

/** Lleva al principio de la página o a la sección del #ancla al cambiar de dirección. */
function useScrollAlNavegar({ path, hash }) {
  useEffect(() => {
    const comportamiento = sinMovimiento() ? 'auto' : 'smooth';
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const intentar = (n) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: comportamiento, block: 'start' });
        else if (n > 0) setTimeout(() => intentar(n - 1), 120);
      };
      intentar(8);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [path, hash]);
}

function Rutas() {
  const ubicacion = useUbicacion();
  useScrollAlNavegar(ubicacion);
  const { path } = ubicacion;

  let pagina;
  if (path === '/') pagina = <Inicio />;
  else if (path.startsWith('/proyectos/')) pagina = <ProyectoDetalle slug={decodeURIComponent(path.split('/')[2] || '')} />;
  else if (path === '/ingresar') pagina = <Ingresar />;
  else if (path === '/auth/callback') pagina = <AuthCallback />;
  else if (path === '/panel') {
    pagina = (
      <Suspense fallback={<Cargando texto="Abriendo el panel…" className="min-h-[60vh]" />}>
        <Panel ubicacion={ubicacion} />
      </Suspense>
    );
  } else pagina = <NoEncontrada />;

  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido">{pagina}</main>
      {path !== '/panel' && <Pie />}
    </>
  );
}

export default function App() {
  useContarVisita();
  return (
    <Proveedores>
      <Rutas />
    </Proveedores>
  );
}
