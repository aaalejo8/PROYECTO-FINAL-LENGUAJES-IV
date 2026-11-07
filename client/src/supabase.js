import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase del navegador. Usa SÓLO la clave pública (anon / publishable):
 * todo lo que puede hacer está limitado por Row Level Security en la base.
 * Se usa para la sesión (guardarla, renovarla, cerrarla) y el login con Google.
 * Los datos se piden a nuestra API (/api), que valida y aplica las reglas del negocio.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && clave);
if (!supabaseConfigurado) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en client/.env (ver docs/SUPABASE.md).');
}

export const supabase = createClient(url || 'http://localhost:54321', clave || 'falta-clave', {
  auth: {
    flowType: 'pkce', // el login con Google vuelve con un código de un solo uso, no con el token en la URL
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'portfolio-sesion',
  },
});

/** Token vigente (lo renueva solo si está por vencer) o '' si no hay sesión. */
export async function tokenActual() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  } catch (_) {
    return '';
  }
}
