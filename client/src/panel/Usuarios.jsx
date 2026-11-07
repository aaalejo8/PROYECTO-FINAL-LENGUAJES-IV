import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import { useAvisos, useSesion } from '../contexto';
import Superposicion from '../componentes/Superposicion';
import { BloqueError, Boton, Campo, Cargando, Entrada, Insignia, Interruptor, Paginacion, Seleccion, Tarjeta, Vacio } from '../componentes/ui';
import { cx, fecha, hayErrores, validar } from '../utils';
import { Confirmar, Tabla } from './compartido';

const ROLES = { admin: 'Administrador', operador: 'Operador', visitante: 'Visitante' };
const TONO_ROL = { admin: 'primario', operador: 'secundario', visitante: 'neutro' };

function FormularioUsuario({ usuario, onCerrar, onGuardado }) {
  const { mostrar } = useAvisos();
  const editar = Boolean(usuario?.id);
  const [d, setD] = useState({ nombre: usuario?.nombre || '', email: usuario?.email || '', rol: usuario?.rol || 'operador', activo: usuario?.activo ?? true, password: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const revisar = (x) => ({
    nombre: validar.texto(x.nombre, 'El nombre', { min: 2, max: 100 }),
    email: editar ? '' : validar.email(x.email),
    password: editar && !x.password ? '' : validar.password(x.password),
  });

  const guardar = async (e) => {
    e.preventDefault();
    const e2 = revisar(d);
    setErrores(e2);
    if (hayErrores(e2)) return;
    setGuardando(true);
    try {
      if (editar) {
        const cuerpo = { nombre: d.nombre.trim(), rol: d.rol, activo: d.activo };
        if (d.password) cuerpo.password = d.password;
        await api.usuarios.editar(usuario.id, cuerpo);
        mostrar('Usuario actualizado.');
      } else {
        await api.usuarios.crear({ nombre: d.nombre.trim(), email: d.email.trim(), rol: d.rol, password: d.password });
        mostrar('Usuario creado.');
      }
      onGuardado();
    } catch (error) {
      mostrar(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Superposicion abierto onCerrar={onCerrar} titulo={editar ? 'Editar usuario' : 'Nuevo usuario'} ancho="max-w-lg">
      <form onSubmit={guardar} noValidate className="space-y-4 p-5">
        <Campo etiqueta="Nombre" error={errores.nombre}>
          {(p) => <Entrada {...p} value={d.nombre} maxLength={100} error={errores.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} data-autofocus />}
        </Campo>
        <Campo etiqueta="Email" error={errores.email} ayuda={editar ? 'El email no se puede cambiar.' : undefined}>
          {(p) => <Entrada {...p} type="email" value={d.email} disabled={editar} maxLength={150} error={errores.email} onChange={(e) => setD({ ...d, email: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Rol" ayuda="Operador: atiende consultas. Administrador: puede todo. Visitante: sólo ve proyectos y demos.">
          {(p) => (
            <Seleccion {...p} value={d.rol} onChange={(e) => setD({ ...d, rol: e.target.value })}>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Seleccion>
          )}
        </Campo>
        <Campo etiqueta={editar ? 'Contraseña nueva' : 'Contraseña'} opcional={editar} error={errores.password} ayuda={editar ? 'Dejala vacía para no cambiarla.' : 'Mínimo 8 caracteres.'}>
          {(p) => <Entrada {...p} type="password" autoComplete="new-password" value={d.password} maxLength={200} error={errores.password} onChange={(e) => setD({ ...d, password: e.target.value })} />}
        </Campo>
        {editar && <Interruptor etiqueta="Cuenta activa" ayuda="Si la desactivás, la persona no puede ingresar." activo={d.activo} onChange={(activo) => setD({ ...d, activo })} />}
        <div className="flex justify-end gap-3 pt-2">
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardando}>
            Guardar
          </Boton>
        </div>
      </form>
    </Superposicion>
  );
}

export default function Usuarios() {
  const { mostrar } = useAvisos();
  const { usuario: yo } = useSesion();
  const [filtros, setFiltros] = useState({ rol: '', estado: '', q: '', pagina: 1 });
  const [busqueda, setBusqueda] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(undefined);
  const [borrando, setBorrando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++pedido.current;
    try {
      const r = await api.usuarios.listar({ ...filtros, limite: 15 });
      if (n !== pedido.current) return;
      setDatos(r);
      setError('');
    } catch (e) {
      if (n === pedido.current) setError(e.message);
    }
  }, [filtros]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda, pagina: 1 })), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const borrar = async () => {
    setTrabajando(true);
    try {
      await api.usuarios.borrar(borrando.id);
      mostrar('Usuario eliminado.', 'info');
      setBorrando(null);
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
      setBorrando(null);
    } finally {
      setTrabajando(false);
    }
  };

  const total = datos ? datos.resumen.admin + datos.resumen.operador + datos.resumen.visitante : null;
  const PLURAL = { admin: 'Administradores', operador: 'Operadores', visitante: 'Visitantes' };
  const pestanas = [['', 'Todos', total], ...Object.keys(ROLES).map((k) => [k, PLURAL[k], datos?.resumen[k]])];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por rol">
          {pestanas.map(([clave, texto, cantidad]) => (
            <button
              key={texto}
              type="button"
              aria-pressed={filtros.rol === clave}
              onClick={() => setFiltros({ ...filtros, rol: clave, pagina: 1 })}
              className={cx('rounded-full border px-3.5 py-1.5 text-sm transition-colors', filtros.rol === clave ? 'border-primary/60 bg-primary/10 text-primary' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}
            >
              {texto}
              {cantidad != null && <span className="ml-1.5 font-mono text-xs opacity-80">{cantidad}</span>}
            </button>
          ))}
        </div>
        <Boton icono={Plus} onClick={() => setEditando(null)}>
          Nuevo usuario
        </Boton>
      </div>

      <Tarjeta>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o email" aria-label="Buscar usuarios" className="pl-9" />
          </div>
          <Seleccion value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value, pagina: 1 })} aria-label="Filtrar por estado" className="sm:w-48">
            <option value="">Activos e inactivos</option>
            <option value="activos">Sólo activos</option>
            <option value="inactivos">Sólo inactivos{datos ? ` (${datos.resumen.inactivos})` : ''}</option>
          </Seleccion>
        </div>
        {error ? (
          <div className="p-6">
            <BloqueError mensaje={error} onReintentar={cargar} />
          </div>
        ) : !datos ? (
          <Cargando />
        ) : (
          <>
            <Tabla
              columnas={['Usuario', 'Rol', 'Ingreso', 'Alta', 'Accesos', 'Último acceso', '']}
              vacia={datos.items.length === 0 && <Vacio icono={Users} titulo="No hay usuarios con estos filtros" />}
            >
              {datos.items.map((u) => (
                <tr key={u.id} className={cx(!u.activo && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">
                      {u.nombre} {u.id === yo?.id && <span className="text-xs text-ink-3">(vos)</span>}
                    </span>
                    <span className="block text-xs text-ink-3">{u.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Insignia tono={TONO_ROL[u.rol]}>{ROLES[u.rol]}</Insignia>
                    {!u.activo && <Insignia tono="aviso" className="ml-1.5">Inactivo</Insignia>}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{u.con_google ? 'Google' : 'Email'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{fecha(u.creado_en)}</td>
                  <td className="px-4 py-3 font-mono text-ink-2">{u.accesos}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{u.ultimo_acceso ? fecha(u.ultimo_acceso, { hora: true }) : 'Nunca'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" aria-label={`Editar a ${u.nombre}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-primary" onClick={() => setEditando(u)}>
                      <Pencil size={17} />
                    </button>
                    {u.id !== yo?.id && (
                      <button type="button" aria-label={`Eliminar a ${u.nombre}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-danger" onClick={() => setBorrando(u)}>
                        <Trash2 size={17} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
            <Paginacion pagina={filtros.pagina} paginas={datos.paginas} onCambiar={(pagina) => setFiltros({ ...filtros, pagina })} />
          </>
        )}
      </Tarjeta>

      {editando !== undefined && (
        <FormularioUsuario
          usuario={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            cargar();
          }}
        />
      )}
      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar usuario"
        texto={`¿Seguro que querés eliminar a ${borrando?.nombre}? Se borra su cuenta de Supabase Auth y sus accesos registrados (sus consultas se conservan). No se puede deshacer.`}
        textoBoton="Eliminar"
        cargando={trabajando}
        onConfirmar={borrar}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  );
}
