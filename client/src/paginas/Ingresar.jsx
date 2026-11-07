import { useEffect, useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { api } from '../api';
import { supabase } from '../supabase';
import { esStaff, useAvisos, useSesion, useSitio } from '../contexto';
import { destinoSeguro, navegar, useUbicacion } from '../router';
import { Boton, Campo, Entrada, Tarjeta } from '../componentes/ui';
import { cx, hayErrores, validar } from '../utils';

function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default function Ingresar() {
  const { search } = useUbicacion();
  const parametros = new URLSearchParams(search);
  const volver = destinoSeguro(parametros.get('volver'), '');
  const errorGoogle = parametros.get('error') === 'google';
  const errorEnlace = parametros.get('error') === 'enlace';

  const { usuario, entrar } = useSesion();
  const { google } = useSitio();
  const { mostrar } = useAvisos();
  const [modo, setModo] = useState(parametros.get('modo') === 'registro' ? 'registro' : 'ingreso');
  const [datos, setDatos] = useState({ nombre: '', email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(
    errorGoogle
      ? 'No pudimos completar el ingreso con Google. Probá de nuevo o usá tu email y contraseña.'
      : errorEnlace
        ? 'El link de confirmación venció o ya se usó. Ingresá con tu email y contraseña.'
        : ''
  );
  const [info, setInfo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const destinoFinal = (u) => volver || (esStaff(u) ? '/panel' : '/');

  // Si ya hay sesión, no tiene sentido estar acá
  useEffect(() => {
    if (usuario) navegar(destinoFinal(usuario), { reemplazar: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const revisar = (d, m = modo) => ({
    nombre: m === 'registro' ? validar.texto(d.nombre, 'El nombre', { min: 2, max: 100 }) : '',
    email: validar.email(d.email),
    password: m === 'registro' ? validar.password(d.password) : d.password ? '' : 'Ingresá tu contraseña.',
  });

  const cambiar = (campo) => (e) => {
    const nuevo = { ...datos, [campo]: e.target.value };
    setDatos(nuevo);
    if (errores[campo]) setErrores(revisar(nuevo));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setAviso('');
    setInfo('');
    const e2 = revisar(datos);
    setErrores(e2);
    if (hayErrores(e2)) return;
    setEnviando(true);
    try {
      const cuerpo = modo === 'registro' ? { nombre: datos.nombre.trim(), email: datos.email.trim(), password: datos.password } : { email: datos.email.trim(), password: datos.password };
      const r = modo === 'registro' ? await api.registro(cuerpo) : await api.login(cuerpo);
      if (r.confirmar) {
        // Supabase tiene activada la confirmación por email: no hay sesión hasta abrir el link
        setInfo(r.mensaje);
        setModo('ingreso');
        setDatos((d) => ({ ...d, password: '' }));
        return;
      }
      await entrar(r.sesion, r.usuario);
      mostrar(modo === 'registro' ? `Bienvenido/a, ${r.usuario.nombre.split(' ')[0]}. Ya podés ver los proyectos.` : `Hola de nuevo, ${r.usuario.nombre.split(' ')[0]}.`);
      navegar(destinoFinal(r.usuario), { reemplazar: true });
    } catch (error) {
      setAviso(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const irAGoogle = async () => {
    try {
      if (volver) sessionStorage.setItem('portfolio_volver', volver);
      else sessionStorage.removeItem('portfolio_volver');
    } catch (_) {
      /* sin sessionStorage: se vuelve al inicio */
    }
    // OAuth con Supabase Auth (flujo PKCE): Google vuelve a /auth/callback con un código de un solo uso
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) setAviso('El ingreso con Google no está disponible en este momento.');
  };

  const cambiarModo = (m) => {
    setModo(m);
    setErrores({});
    setAviso('');
    setInfo('');
  };

  return (
    <section className="contenedor grid min-h-[75vh] place-items-center py-12">
      <Tarjeta className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl font-semibold">{modo === 'registro' ? 'Crear cuenta' : 'Ingresar'}</h1>
        <p className="mt-2 text-sm text-ink-2">
          {volver.startsWith('/proyectos/')
            ? 'Los proyectos y sus demos son para personas registradas. Es gratis y lleva un minuto.'
            : 'Con una cuenta podés ver el detalle y las demos de cada proyecto.'}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-lg border border-line bg-surface-1 p-1" role="tablist" aria-label="Elegí una opción">
          {[
            ['ingreso', 'Ya tengo cuenta', LogIn],
            ['registro', 'Soy nuevo', UserPlus],
          ].map(([clave, texto, Icono]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={modo === clave}
              onClick={() => cambiarModo(clave)}
              className={cx('flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors', modo === clave ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:text-ink')}
            >
              <Icono size={16} aria-hidden="true" /> {texto}
            </button>
          ))}
        </div>

        {google && (
          <>
            <Boton variante="suave" tamano="lg" className="mt-6 w-full" onClick={irAGoogle}>
              <IconoGoogle /> Continuar con Google
            </Boton>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-3">
              <span className="h-px flex-1 bg-line" /> o con tu email <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={enviar} noValidate className={cx('space-y-4', !google && 'mt-6')}>
          {info && (
            <p className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-info" role="status">
              {info}
            </p>
          )}
          {aviso && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {aviso}
            </p>
          )}
          {modo === 'registro' && (
            <Campo etiqueta="Nombre" error={errores.nombre}>
              {(p) => <Entrada {...p} value={datos.nombre} onChange={cambiar('nombre')} autoComplete="name" maxLength={100} error={errores.nombre} data-autofocus />}
            </Campo>
          )}
          <Campo etiqueta="Email" error={errores.email}>
            {(p) => <Entrada {...p} type="email" value={datos.email} onChange={cambiar('email')} autoComplete="email" maxLength={150} error={errores.email} />}
          </Campo>
          <Campo etiqueta="Contraseña" error={errores.password} ayuda={modo === 'registro' ? 'Mínimo 8 caracteres.' : undefined}>
            {(p) => (
              <Entrada
                {...p}
                type="password"
                value={datos.password}
                onChange={cambiar('password')}
                autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
                maxLength={200}
                error={errores.password}
              />
            )}
          </Campo>
          <Boton type="submit" tamano="lg" cargando={enviando} className="w-full">
            {modo === 'registro' ? 'Crear mi cuenta' : 'Ingresar'}
          </Boton>
        </form>
      </Tarjeta>
    </section>
  );
}
