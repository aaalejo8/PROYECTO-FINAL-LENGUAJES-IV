import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { supabase } from './supabase';

// ───────────────────────────── Datos generales del sitio ─────────────────────────────

const ContextoSitio = createContext({ nombre: 'Alejo Almada', google: false, correo_simulado: true });
export const useSitio = () => useContext(ContextoSitio);

// ───────────────────────────── Sesión ─────────────────────────────

const ContextoSesion = createContext(null);
export const useSesion = () => useContext(ContextoSesion);

export const esStaff = (usuario) => usuario?.rol === 'admin' || usuario?.rol === 'operador';

// ───────────────────────────── Avisos (mensajes que desaparecen solos) ─────────────────────────────

const ContextoAvisos = createContext({ mostrar: () => {} });
export const useAvisos = () => useContext(ContextoAvisos);

export function Proveedores({ children }) {
  const [sitio, setSitio] = useState({ nombre: 'Alejo Almada', google: false, correo_simulado: true });
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [avisos, setAvisos] = useState([]);
  const siguiente = useRef(1);

  useEffect(() => {
    api.sitio().then(setSitio).catch(() => {});
  }, []);

  // Al abrir el sitio con una sesión guardada de Supabase, se confirma con el servidor quién es y su rol
  useEffect(() => {
    let vigente = true;
    // En /auth/callback la sesión la termina de armar esa página (Google o confirmación de email)
    if (window.location.pathname === '/auth/callback') {
      setCargandoSesion(false);
      return undefined;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => (data.session ? api.yo() : null))
      .then((u) => vigente && setUsuario(u))
      .catch(() => {})
      .finally(() => vigente && setCargandoSesion(false));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const vencida = () => setUsuario(null);
    window.addEventListener('portfolio:sesion-vencida', vencida);
    // Si la sesión se cierra en otra pestaña o Supabase no la puede renovar, se refleja acá
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') setUsuario(null);
    });
    return () => {
      window.removeEventListener('portfolio:sesion-vencida', vencida);
      data.subscription.unsubscribe();
    };
  }, []);

  /** Guarda la sesión que devolvió el servidor (registro o login con email) en Supabase Auth. */
  const entrar = useCallback(async (sesionNueva, datosUsuario) => {
    if (sesionNueva) {
      const { error } = await supabase.auth.setSession({ access_token: sesionNueva.access_token, refresh_token: sesionNueva.refresh_token });
      if (error) throw new Error('No pudimos guardar la sesión en este navegador. Probá de nuevo.');
    }
    setUsuario(datosUsuario);
    setCargandoSesion(false);
  }, []);

  /** Cierra la sesión: Supabase revoca el refresh token, así no se puede volver a usar. */
  const salir = useCallback(async () => {
    setUsuario(null);
    await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: 'local' }));
  }, []);

  const mostrar = useCallback((texto, tipo = 'ok') => {
    const id = siguiente.current++;
    setAvisos((a) => [...a.slice(-3), { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);

  const valorSesion = useMemo(() => ({ usuario, cargando: cargandoSesion, entrar, salir }), [usuario, cargandoSesion, entrar, salir]);
  const valorAvisos = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ContextoSitio.Provider value={sitio}>
      <ContextoSesion.Provider value={valorSesion}>
        <ContextoAvisos.Provider value={valorAvisos}>
          {children}
          <ListaAvisos avisos={avisos} cerrar={(id) => setAvisos((a) => a.filter((x) => x.id !== id))} />
        </ContextoAvisos.Provider>
      </ContextoSesion.Provider>
    </ContextoSitio.Provider>
  );
}

function ListaAvisos({ avisos, cerrar }) {
  const colores = {
    ok: 'border-success/50 text-success',
    error: 'border-danger/50 text-danger',
    info: 'border-info/50 text-info',
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4" aria-live="polite" role="status">
      {avisos.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => cerrar(a.id)}
          className={`pointer-events-auto max-w-md animate-pop rounded-md border bg-surface-2 px-4 py-3 text-left text-sm ${colores[a.tipo] || colores.ok}`}
        >
          <span className="text-ink">{a.texto}</span>
        </button>
      ))}
    </div>
  );
}
