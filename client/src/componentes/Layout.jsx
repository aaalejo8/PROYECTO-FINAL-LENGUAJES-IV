import { useState } from 'react';
import { LayoutDashboard, LogOut, Menu, User } from 'lucide-react';
import { Link, navegar } from '../router';
import { esStaff, useAvisos, useSesion, useSitio } from '../contexto';
import { estiloBoton } from './ui';
import Superposicion from './Superposicion';
import { iniciales } from '../utils';

const ENLACES = [
  ['Sobre mí', '/#inicio'],
  ['Stack', '/#stack'],
  ['Servicios', '/#servicios'],
  ['Experiencia', '/#experiencia'],
  ['Proyectos', '/#proyectos'],
  ['Contacto', '/#contacto'],
];

// Créditos del trabajo práctico. Se muestran en el pie del sitio; editá la lista o borrala cuando uses un perfil real.
const INTEGRANTES = ['Francisco Sanchez Fadell', 'Francisco Cadima', 'Joaquín Arraya', 'Alejo Almada', 'Agustín Juárez'];

export function Logo({ className = '' }) {
  const { nombre } = useSitio();
  const [primero, ...resto] = nombre.split(' ');
  return (
    <span className={`font-display text-xl font-bold tracking-tight ${className}`}>
      {primero}
      {resto.length > 0 && <span className="text-primary"> {resto.join(' ')}</span>}
    </span>
  );
}

export function Cabecera() {
  const { nombre } = useSitio();
  const { usuario, salir } = useSesion();
  const { mostrar } = useAvisos();
  const [menu, setMenu] = useState(false);

  const cerrarSesion = () => {
    salir();
    setMenu(false);
    mostrar('Cerraste la sesión.', 'info');
    navegar('/');
  };

  const zonaUsuario = (movil = false) =>
    usuario ? (
      <div className={movil ? 'flex flex-col gap-3' : 'flex items-center gap-2'}>
        {esStaff(usuario) && (
          <Link to="/panel" onClick={() => setMenu(false)} className={estiloBoton('secundario', 'sm')}>
            <LayoutDashboard size={16} aria-hidden="true" /> Panel
          </Link>
        )}
        <span className="flex items-center gap-2 text-sm text-ink-2" title={usuario.email}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 font-mono text-xs text-ink">{iniciales(usuario.nombre)}</span>
          <span className={movil ? '' : 'hidden xl:inline'}>{usuario.nombre.split(' ')[0]}</span>
        </span>
        <button type="button" onClick={cerrarSesion} className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-3 hover:text-ink">
          <LogOut size={16} aria-hidden="true" /> Salir
        </button>
      </div>
    ) : (
      <Link to="/ingresar" onClick={() => setMenu(false)} className={estiloBoton('primario', 'sm')}>
        <User size={16} aria-hidden="true" /> Ingresar
      </Link>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface-1/85 backdrop-blur-md">
      <div className="contenedor flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label={`${nombre}, ir al inicio`}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {ENLACES.map(([texto, destino]) => (
            <Link key={destino} to={destino} className="rounded-sm px-3 py-2 text-sm text-ink-2 transition-colors hover:text-primary">
              {texto}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block">{zonaUsuario()}</div>
        <button type="button" className="rounded-sm p-2 text-ink hover:bg-surface-3 lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir el menú">
          <Menu size={24} />
        </button>
      </div>

      <Superposicion abierto={menu} onCerrar={() => setMenu(false)} titulo="Menú" lado="derecha">
        <nav className="flex flex-col gap-1 p-4" aria-label="Principal (celular)">
          {ENLACES.map(([texto, destino]) => (
            <Link key={destino} to={destino} onClick={() => setMenu(false)} className="rounded-md px-3 py-3 text-lg text-ink hover:bg-surface-3">
              {texto}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-4">{zonaUsuario(true)}</div>
      </Superposicion>
    </header>
  );
}

export function Pie() {
  const { nombre } = useSitio();
  return (
    <footer className="border-t border-line bg-surface-1">
      <div className="contenedor flex flex-col items-start justify-between gap-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-center">
        <div>
          <Logo className="text-ink" />
          <p className="mt-1 text-ink-3">Diseño, código y despliegue de aplicaciones web.</p>
        </div>
        <div className="font-mono text-xs text-ink-3 sm:text-right">
          <p>
            © {new Date().getFullYear()} {nombre} · Hecho con React, Node.js y Supabase
          </p>
          {INTEGRANTES.length > 0 && (
            <p className="mt-1">TP Integrador · Lenguajes 4 · {INTEGRANTES.join(' · ')}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
