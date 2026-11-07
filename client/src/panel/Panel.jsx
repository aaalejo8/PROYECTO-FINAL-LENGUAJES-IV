import { useEffect } from 'react';
import { BarChart3, FolderKanban, Inbox, Users, Wrench } from 'lucide-react';
import { esStaff, useSesion } from '../contexto';
import { Link, navegar } from '../router';
import { Cargando, Insignia, estiloBoton } from '../componentes/ui';
import { cx } from '../utils';
import Consultas from './Consultas';
import Metricas from './Metricas';
import GestionProyectos from './GestionProyectos';
import GestionServicios from './GestionServicios';
import Usuarios from './Usuarios';

const SECCIONES = [
  { clave: 'consultas', titulo: 'Consultas', icono: Inbox, roles: ['admin', 'operador'], vista: Consultas },
  { clave: 'metricas', titulo: 'Métricas', icono: BarChart3, roles: ['admin'], vista: Metricas },
  { clave: 'proyectos', titulo: 'Proyectos y demos', icono: FolderKanban, roles: ['admin'], vista: GestionProyectos },
  { clave: 'servicios', titulo: 'Servicios', icono: Wrench, roles: ['admin'], vista: GestionServicios },
  { clave: 'usuarios', titulo: 'Usuarios', icono: Users, roles: ['admin'], vista: Usuarios },
];

export default function Panel({ ubicacion }) {
  const { usuario, cargando } = useSesion();

  useEffect(() => {
    if (!cargando && !usuario) navegar('/ingresar?volver=%2Fpanel', { reemplazar: true });
  }, [cargando, usuario]);

  if (cargando || !usuario) return <Cargando className="min-h-[60vh]" />;

  if (!esStaff(usuario)) {
    return (
      <section className="contenedor grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold">No tenés acceso al panel</h1>
          <p className="mt-3 text-ink-2">Esta zona es para el equipo. Tu cuenta puede ver los proyectos y sus demos desde el sitio.</p>
          <Link to="/" className={estiloBoton('primario', 'md', 'mt-6')}>
            Volver al inicio
          </Link>
        </div>
      </section>
    );
  }

  const disponibles = SECCIONES.filter((s) => s.roles.includes(usuario.rol));
  const pedida = new URLSearchParams(ubicacion.search).get('tab');
  const actual = disponibles.find((s) => s.clave === pedida) || (usuario.rol === 'admin' ? disponibles.find((s) => s.clave === 'metricas') : null) || disponibles[0];
  const Vista = actual.vista;

  return (
    <div className="contenedor min-h-[80vh] py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Panel</p>
          <h1 className="text-3xl font-semibold">{actual.titulo}</h1>
        </div>
        <Insignia tono={usuario.rol === 'admin' ? 'primario' : 'secundario'}>{usuario.rol === 'admin' ? 'Administrador' : 'Operador'}</Insignia>
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Secciones del panel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:flex-col">
            {disponibles.map((s) => {
              const Icono = s.icono;
              const activa = s.clave === actual.clave;
              return (
                <li key={s.clave} className="shrink-0">
                  <Link
                    to={`/panel?tab=${s.clave}`}
                    aria-current={activa ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-md border px-3.5 py-2.5 text-sm font-medium transition-colors',
                      activa ? 'border-primary/50 bg-primary/10 text-primary' : 'border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink'
                    )}
                  >
                    <Icono size={18} aria-hidden="true" /> {s.titulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0">
          <Vista key={actual.clave} />
        </div>
      </div>
    </div>
  );
}
