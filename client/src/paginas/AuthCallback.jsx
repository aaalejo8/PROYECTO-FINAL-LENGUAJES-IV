import { useEffect, useRef } from 'react';
import { api } from '../api';
import { supabase } from '../supabase';
import { esStaff, useAvisos, useSesion } from '../contexto';
import { destinoSeguro, navegar } from '../router';
import { Cargando } from '../componentes/ui';

/**
 * Vuelta desde Supabase Auth: login con Google o link de confirmación de email.
 * Con el flujo PKCE la URL trae un ?code= de un solo uso; el cliente de Supabase lo cambia
 * por la sesión al iniciar (detectSessionInUrl). Acá se avisa al servidor para contar el acceso
 * y se confirma el rol del usuario.
 */
export default function AuthCallback() {
  const { entrar } = useSesion();
  const { mostrar } = useAvisos();
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    const parametros = new URLSearchParams(window.location.search);
    const conError = parametros.get('error') || parametros.get('error_description');
    const esConfirmacion = parametros.get('type') === 'signup' || parametros.get('type') === 'email';

    (async () => {
      if (conError) throw new Error(conError);
      // Si el cliente todavía no canjeó el código, se hace explícito
      let { data } = await supabase.auth.getSession();
      const codigo = parametros.get('code');
      if (!data.session && codigo) {
        const r = await supabase.auth.exchangeCodeForSession(codigo);
        if (r.error) throw r.error;
        data = r.data;
      }
      if (!data.session) throw new Error('sin sesión');
      window.history.replaceState({}, '', '/auth/callback');

      const proveedor = data.session.user?.app_metadata?.provider;
      const usuario = await api.acceso(proveedor === 'google' ? 'google' : esConfirmacion ? 'registro' : 'otro', data.session.access_token);
      await entrar(null, usuario);
      let volver = '';
      try {
        volver = destinoSeguro(sessionStorage.getItem('portfolio_volver'), '');
        sessionStorage.removeItem('portfolio_volver');
      } catch (_) {
        /* nada */
      }
      mostrar(`Hola, ${usuario.nombre.split(' ')[0]}.`);
      navegar(volver || (esStaff(usuario) ? '/panel' : '/'), { reemplazar: true });
    })().catch(async () => {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      navegar(`/ingresar?error=${esConfirmacion ? 'enlace' : 'google'}`, { reemplazar: true });
    });
  }, [entrar, mostrar]);

  return <Cargando texto="Terminando el ingreso…" className="min-h-[60vh]" />;
}
