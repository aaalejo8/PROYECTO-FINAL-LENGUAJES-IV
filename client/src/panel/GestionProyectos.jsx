import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAvisos } from '../contexto';
import Superposicion from '../componentes/Superposicion';
import { AreaTexto, BloqueError, Boton, Campo, Cargando, Entrada, Insignia, Interruptor, Seleccion, Tarjeta, Vacio } from '../componentes/ui';
import { hayErrores, slugDe, validar } from '../utils';
import { Confirmar, Tabla } from './compartido';
import SubirImagen from './SubirImagen';

// ───────────────────────────── Demos de un proyecto ─────────────────────────────

const DEMO_VACIA = { titulo: '', descripcion: '', tipo: 'enlace', url: '', orden: 0, activo: true };

function FormularioDemo({ proyectoId, demo, onCerrar, onGuardada }) {
  const { mostrar } = useAvisos();
  const [d, setD] = useState(demo ? { ...DEMO_VACIA, ...demo, descripcion: demo.descripcion || '' } : DEMO_VACIA);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const revisar = (x) => ({
    titulo: validar.texto(x.titulo, 'El título', { min: 3, max: 100 }),
    descripcion: validar.texto(x.descripcion, 'La descripción', { min: 0, max: 300 }),
    url: validar.urlHttps(x.url, 'El link', { obligatorio: true }),
  });

  const guardar = async (e) => {
    e.preventDefault();
    const e2 = revisar(d);
    setErrores(e2);
    if (hayErrores(e2)) return;
    setGuardando(true);
    try {
      const cuerpo = { titulo: d.titulo.trim(), descripcion: d.descripcion.trim(), tipo: d.tipo, url: d.url.trim(), orden: Number(d.orden) || 0, activo: d.activo };
      if (demo?.id) await api.proyectos.editarDemo(demo.id, cuerpo);
      else await api.proyectos.crearDemo(proyectoId, cuerpo);
      mostrar(demo?.id ? 'Demo actualizada.' : 'Demo agregada.');
      onGuardada();
    } catch (error) {
      mostrar(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} noValidate className="space-y-4 rounded-md border border-primary/30 bg-surface-1 p-4">
      <h4 className="font-semibold">{demo?.id ? 'Editar demo' : 'Nueva demo'}</h4>
      <Campo etiqueta="Título" error={errores.titulo}>
        {(p) => <Entrada {...p} value={d.titulo} maxLength={100} error={errores.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Descripción" opcional error={errores.descripcion}>
        {(p) => <Entrada {...p} value={d.descripcion} maxLength={300} error={errores.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />}
      </Campo>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Campo etiqueta="Link (https)" error={errores.url}>
          {(p) => <Entrada {...p} type="url" placeholder="https://" value={d.url} maxLength={300} error={errores.url} onChange={(e) => setD({ ...d, url: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Orden">{(p) => <Entrada {...p} type="number" min={0} max={9999} value={d.orden} onChange={(e) => setD({ ...d, orden: e.target.value })} />}</Campo>
      </div>
      <Campo etiqueta="Cómo se muestra" ayuda="“Incrustada” abre la demo dentro de la página (algunos sitios no lo permiten). “Enlace” sólo muestra un botón.">
        {(p) => (
          <Seleccion {...p} value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
            <option value="enlace">Enlace a otra pestaña</option>
            <option value="iframe">Incrustada en la página</option>
          </Seleccion>
        )}
      </Campo>
      <Interruptor etiqueta="Visible para los usuarios registrados" activo={d.activo} onChange={(activo) => setD({ ...d, activo })} />
      <div className="flex justify-end gap-3">
        <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" tamano="sm" cargando={guardando}>
          Guardar demo
        </Boton>
      </div>
    </form>
  );
}

function Demos({ proyectoId, demos, recargar }) {
  const { mostrar } = useAvisos();
  const [formulario, setFormulario] = useState(undefined); // undefined = cerrado, null = nueva, objeto = editar
  const [borrando, setBorrando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const borrar = async () => {
    setTrabajando(true);
    try {
      await api.proyectos.borrarDemo(borrando.id);
      mostrar('Demo eliminada.', 'info');
      setBorrando(null);
      recargar();
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-line pt-5" aria-labelledby="demos-titulo">
      <div className="flex items-center justify-between gap-3">
        <h3 id="demos-titulo" className="text-lg font-semibold">
          Demos
        </h3>
        {formulario === undefined && (
          <Boton variante="secundario" tamano="sm" icono={Plus} onClick={() => setFormulario(null)}>
            Agregar demo
          </Boton>
        )}
      </div>
      {demos.length === 0 && formulario === undefined && <p className="text-sm text-ink-3">Este proyecto todavía no tiene demos.</p>}
      <ul className="space-y-2">
        {demos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-1 px-4 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {d.titulo}
                <Insignia tono={d.tipo === 'iframe' ? 'secundario' : 'neutro'}>{d.tipo === 'iframe' ? 'Incrustada' : 'Enlace'}</Insignia>
                {!d.activo && <Insignia tono="aviso">Oculta</Insignia>}
              </p>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-ink-3 hover:text-primary">
                <span className="truncate">{d.url}</span> <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
            <div className="flex gap-1">
              <button type="button" aria-label={`Editar la demo ${d.titulo}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-primary" onClick={() => setFormulario(d)}>
                <Pencil size={17} />
              </button>
              <button type="button" aria-label={`Eliminar la demo ${d.titulo}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-danger" onClick={() => setBorrando(d)}>
                <Trash2 size={17} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {formulario !== undefined && (
        <FormularioDemo
          proyectoId={proyectoId}
          demo={formulario}
          onCerrar={() => setFormulario(undefined)}
          onGuardada={() => {
            setFormulario(undefined);
            recargar();
          }}
        />
      )}
      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar demo"
        texto={`¿Eliminar la demo “${borrando?.titulo}”?`}
        textoBoton="Eliminar"
        cargando={trabajando}
        onConfirmar={borrar}
        onCerrar={() => setBorrando(null)}
      />
    </section>
  );
}

// ───────────────────────────── Formulario del proyecto ─────────────────────────────

const VACIO = { titulo: '', slug: '', resumen: '', descripcion: '', tecnologias: '', imagen_url: '', repo_url: '', destacado: false, activo: true, orden: 0 };

function FormularioProyecto({ proyectoId, onCerrar, onCambio }) {
  const { mostrar } = useAvisos();
  const [id, setId] = useState(proyectoId); // al crear un proyecto nuevo, queda abierto para agregarle demos
  const [d, setD] = useState(VACIO);
  const [demos, setDemos] = useState([]);
  const [cargando, setCargando] = useState(Boolean(proyectoId));
  const [errorCarga, setErrorCarga] = useState('');
  const [slugEditado, setSlugEditado] = useState(Boolean(proyectoId));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const aFormulario = (p) => ({
    titulo: p.titulo,
    slug: p.slug,
    resumen: p.resumen,
    descripcion: p.descripcion,
    tecnologias: (p.tecnologias || []).join(', '),
    imagen_url: p.imagen_url || '',
    repo_url: p.repo_url || '',
    destacado: p.destacado,
    activo: p.activo,
    orden: p.orden,
  });

  const cargar = useCallback(async (quien, { conFormulario = true } = {}) => {
    try {
      const p = await api.proyectos.obtener(quien);
      if (conFormulario) setD(aFormulario(p));
      setDemos(p.demos);
    } catch (e) {
      setErrorCarga(e.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    if (proyectoId) cargar(proyectoId);
  }, [proyectoId, cargar]);

  const cambiarTitulo = (titulo) => setD((x) => ({ ...x, titulo, slug: slugEditado ? x.slug : slugDe(titulo) }));

  const revisar = (x) => ({
    titulo: validar.texto(x.titulo, 'El título', { min: 3, max: 100 }),
    slug: x.slug.trim().length < 3 ? 'El link tiene que tener al menos 3 letras o números.' : /^[a-z0-9-]+$/.test(x.slug) ? '' : 'Sólo minúsculas, números y guiones.',
    resumen: validar.texto(x.resumen, 'El resumen', { min: 10, max: 300 }),
    descripcion: validar.texto(x.descripcion, 'La descripción', { min: 20, max: 5000 }),
    repo_url: validar.urlHttps(x.repo_url, 'El link del repositorio'),
  });

  const guardar = async (e) => {
    e.preventDefault();
    const e2 = revisar(d);
    setErrores(e2);
    if (hayErrores(e2)) {
      mostrar('Revisá los campos marcados en rojo.', 'error');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        titulo: d.titulo.trim(),
        slug: d.slug.trim(),
        resumen: d.resumen.trim(),
        descripcion: d.descripcion.trim(),
        tecnologias: d.tecnologias.split(',').map((t) => t.trim()).filter(Boolean),
        imagen_url: d.imagen_url,
        repo_url: d.repo_url.trim(),
        destacado: d.destacado,
        activo: d.activo,
        orden: Number(d.orden) || 0,
      };
      if (id) {
        await api.proyectos.editar(id, cuerpo);
        mostrar('Proyecto actualizado.');
      } else {
        const nuevo = await api.proyectos.crear(cuerpo);
        setId(nuevo.id);
        mostrar('Proyecto creado. Ahora podés agregarle demos.');
      }
      onCambio();
    } catch (error) {
      mostrar(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Cargando />;
  if (errorCarga) return <div className="p-5"><BloqueError mensaje={errorCarga} /></div>;

  return (
    <div className="space-y-6 p-5">
      <form onSubmit={guardar} noValidate className="space-y-4">
        <Campo etiqueta="Título" error={errores.titulo}>
          {(p) => <Entrada {...p} value={d.titulo} maxLength={100} error={errores.titulo} onChange={(e) => cambiarTitulo(e.target.value)} data-autofocus />}
        </Campo>
        <Campo etiqueta="Link del proyecto" error={errores.slug} ayuda={`Dirección: /proyectos/${d.slug || '…'}`}>
          {(p) => (
            <Entrada
              {...p}
              value={d.slug}
              maxLength={80}
              error={errores.slug}
              onChange={(e) => {
                setSlugEditado(true);
                setD({ ...d, slug: slugDe(e.target.value) });
              }}
              className="font-mono"
            />
          )}
        </Campo>
        <Campo etiqueta="Resumen" error={errores.resumen} ayuda="Aparece en la tarjeta de la página de inicio.">
          {(p) => <Entrada {...p} value={d.resumen} maxLength={300} error={errores.resumen} onChange={(e) => setD({ ...d, resumen: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Descripción completa" error={errores.descripcion} ayuda="Sólo la ven los usuarios registrados. Un renglón vacío separa párrafos.">
          {(p) => <AreaTexto {...p} rows={7} value={d.descripcion} maxLength={5000} error={errores.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Tecnologías" ayuda="Separadas por coma. Máximo 12.">
          {(p) => <Entrada {...p} value={d.tecnologias} placeholder="React, Node.js, PostgreSQL" onChange={(e) => setD({ ...d, tecnologias: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Repositorio" opcional error={errores.repo_url}>
          {(p) => <Entrada {...p} type="url" placeholder="https://github.com/…" value={d.repo_url} maxLength={300} error={errores.repo_url} onChange={(e) => setD({ ...d, repo_url: e.target.value })} />}
        </Campo>
        <SubirImagen valor={d.imagen_url} onChange={(imagen_url) => setD({ ...d, imagen_url })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Orden" ayuda="Menor = primero">
            {(p) => <Entrada {...p} type="number" min={0} max={9999} value={d.orden} onChange={(e) => setD({ ...d, orden: e.target.value })} />}
          </Campo>
          <div className="sm:col-span-2 space-y-3 pt-6">
            <Interruptor etiqueta="Destacado" activo={d.destacado} onChange={(destacado) => setD({ ...d, destacado })} />
            <Interruptor etiqueta="Visible en el sitio" activo={d.activo} onChange={(activo) => setD({ ...d, activo })} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Boton variante="fantasma" onClick={onCerrar}>
            {id ? 'Cerrar' : 'Cancelar'}
          </Boton>
          <Boton type="submit" cargando={guardando}>
            {id ? 'Guardar cambios' : 'Crear proyecto'}
          </Boton>
        </div>
      </form>

      {id && <Demos proyectoId={id} demos={demos} recargar={() => { cargar(id, { conFormulario: false }); onCambio(); }} />}
    </div>
  );
}

// ───────────────────────────── Lista ─────────────────────────────

export default function GestionProyectos() {
  const { mostrar } = useAvisos();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(undefined); // undefined = cerrado, null = nuevo, número = id
  const [borrando, setBorrando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setItems((await api.proyectos.listar()).items);
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
      await api.proyectos.borrar(borrando.id);
      mostrar('Proyecto eliminado junto con sus demos.', 'info');
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
        <p className="text-sm text-ink-2">La lista es pública; el detalle y las demos sólo los ven las personas registradas.</p>
        <Boton icono={Plus} onClick={() => setEditando(null)}>
          Nuevo proyecto
        </Boton>
      </div>

      <Tarjeta>
        <Tabla columnas={['Proyecto', 'Tecnologías', 'Demos', 'Estado', '']} vacia={items.length === 0 && <Vacio icono={FolderKanban} titulo="Todavía no hay proyectos">Creá el primero con el botón “Nuevo proyecto”.</Vacio>}>
          {items.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3">
                <span className="block font-medium">{p.titulo}</span>
                <span className="block font-mono text-xs text-ink-3">/proyectos/{p.slug}</span>
              </td>
              <td className="max-w-[14rem] px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.tecnologias.slice(0, 3).map((t) => (
                    <Insignia key={t} mono>
                      {t}
                    </Insignia>
                  ))}
                  {p.tecnologias.length > 3 && <span className="text-xs text-ink-3">+{p.tecnologias.length - 3}</span>}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-ink-2">{p.cantidad_demos}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Insignia tono={p.activo ? 'ok' : 'aviso'}>{p.activo ? 'Visible' : 'Oculto'}</Insignia>
                  {p.destacado && <Insignia tono="primario">Destacado</Insignia>}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button type="button" aria-label={`Editar ${p.titulo}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-primary" onClick={() => setEditando(p.id)}>
                  <Pencil size={17} />
                </button>
                <button type="button" aria-label={`Eliminar ${p.titulo}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-danger" onClick={() => setBorrando(p)}>
                  <Trash2 size={17} />
                </button>
              </td>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>

      <Superposicion abierto={editando !== undefined} onCerrar={() => setEditando(undefined)} titulo={editando ? 'Editar proyecto' : 'Nuevo proyecto'} ancho="max-w-3xl">
        {editando !== undefined && <FormularioProyecto key={editando ?? 'nuevo'} proyectoId={editando} onCerrar={() => setEditando(undefined)} onCambio={cargar} />}
      </Superposicion>

      <Confirmar
        abierto={Boolean(borrando)}
        titulo="Eliminar proyecto"
        texto={`¿Seguro que querés eliminar “${borrando?.titulo}”? También se borran sus demos. No se puede deshacer.`}
        textoBoton="Eliminar"
        cargando={trabajando}
        onConfirmar={borrar}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  );
}
