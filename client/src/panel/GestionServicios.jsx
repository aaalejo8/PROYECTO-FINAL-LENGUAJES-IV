import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../api';
import { useAvisos } from '../contexto';
import Icono, { NOMBRES_ICONOS } from '../componentes/Icono';
import Superposicion from '../componentes/Superposicion';
import { AreaTexto, BloqueError, Boton, Campo, Cargando, Entrada, Insignia, Interruptor, Seleccion, Vacio, Tarjeta } from '../componentes/ui';
import { hayErrores, validar } from '../utils';
import { Confirmar } from './compartido';

const VACIO = { titulo: '', descripcion: '', icono: 'code', orden: 0, activo: true };

function FormularioServicio({ servicio, onCerrar, onGuardado }) {
  const { mostrar } = useAvisos();
  const [d, setD] = useState(servicio ? { ...VACIO, ...servicio } : VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const revisar = (x) => ({
    titulo: validar.texto(x.titulo, 'El título', { min: 3, max: 80 }),
    descripcion: validar.texto(x.descripcion, 'La descripción', { min: 10, max: 600 }),
  });

  const guardar = async (e) => {
    e.preventDefault();
    const e2 = revisar(d);
    setErrores(e2);
    if (hayErrores(e2)) return;
    setGuardando(true);
    try {
      const cuerpo = { titulo: d.titulo.trim(), descripcion: d.descripcion.trim(), icono: d.icono, orden: Number(d.orden) || 0, activo: d.activo };
      if (servicio?.id) await api.servicios.editar(servicio.id, cuerpo);
      else await api.servicios.crear(cuerpo);
      mostrar(servicio?.id ? 'Servicio actualizado.' : 'Servicio creado.');
      onGuardado();
    } catch (error) {
      mostrar(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Superposicion abierto onCerrar={onCerrar} titulo={servicio?.id ? 'Editar servicio' : 'Nuevo servicio'} ancho="max-w-xl">
      <form onSubmit={guardar} noValidate className="space-y-4 p-5">
        <Campo etiqueta="Título" error={errores.titulo}>
          {(p) => <Entrada {...p} value={d.titulo} maxLength={80} error={errores.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} data-autofocus />}
        </Campo>
        <Campo etiqueta="Descripción" error={errores.descripcion} ayuda={`${d.descripcion.length}/600`}>
          {(p) => <AreaTexto {...p} rows={4} value={d.descripcion} maxLength={600} error={errores.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Campo etiqueta="Ícono">
            {(p) => (
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icono nombre={d.icono} />
                </span>
                <Seleccion {...p} value={d.icono} onChange={(e) => setD({ ...d, icono: e.target.value })}>
                  {NOMBRES_ICONOS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Seleccion>
              </div>
            )}
          </Campo>
          <Campo etiqueta="Orden" ayuda="Menor = primero">
            {(p) => <Entrada {...p} type="number" min={0} max={9999} value={d.orden} onChange={(e) => setD({ ...d, orden: e.target.value })} />}
          </Campo>
        </div>
        <Interruptor etiqueta="Visible en el sitio" activo={d.activo} onChange={(activo) => setD({ ...d, activo })} />
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

export default function GestionServicios() {
  const { mostrar } = useAvisos();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(undefined); // undefined = cerrado, null = nuevo, objeto = editar
  const [borrando, setBorrando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setItems((await api.servicios.listar()).items);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const borrar = async () => {
    setTrabajando(true);
    try {
      await api.servicios.borrar(borrando.id);
      mostrar('Servicio eliminado.', 'info');
      setBorrando(null);
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setTrabajando(false);
    }
  };

  if (error) return <BloqueError mensaje={error} onReintentar={cargar} />;
  if (!items) return <Cargando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Los servicios activos aparecen en la sección “Servicios” del sitio.</p>
        <Boton icono={Plus} onClick={() => setEditando(null)}>
          Nuevo servicio
        </Boton>
      </div>

      {items.length === 0 ? (
        <Tarjeta>
          <Vacio icono={Wrench} titulo="Todavía no hay servicios">Creá el primero con el botón “Nuevo servicio”.</Vacio>
        </Tarjeta>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((s) => (
            <li key={s.id}>
              <Tarjeta className="flex h-full gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icono nombre={s.icono} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{s.titulo}</h3>
                    {!s.activo && <Insignia tono="aviso">Oculto</Insignia>}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-ink-2">{s.descripcion}</p>
                  <div className="mt-3 flex gap-2">
                    <Boton variante="secundario" tamano="sm" icono={Pencil} onClick={() => setEditando(s)}>
                      Editar
                    </Boton>
                    <Boton variante="fantasma" tamano="sm" icono={Trash2} onClick={() => setBorrando(s)}>
                      Eliminar
                    </Boton>
                  </div>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      {editando !== undefined && (
        <FormularioServicio
          servicio={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            cargar();
          }}
        />
      )}
      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar servicio"
        texto={`¿Seguro que querés eliminar “${borrando?.titulo}”? No se puede deshacer.`}
        textoBoton="Eliminar"
        cargando={trabajando}
        onConfirmar={borrar}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  );
}
