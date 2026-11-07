import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Eye, Inbox, Mail, Search, Send } from 'lucide-react';
import { api } from '../api';
import { useAvisos } from '../contexto';
import { AreaTexto, Boton, BloqueError, Campo, Cargando, Entrada, Insignia, Paginacion, Seleccion, Tarjeta, Vacio } from '../componentes/ui';
import Superposicion from '../componentes/Superposicion';
import { cx, fecha, fechaLarga, validar } from '../utils';
import { Tabla } from './compartido';

export const TIPOS = { general: 'Consulta general', cotizacion: 'Cotización', asesoria: 'Asesoría' };
export const ESTADOS = { nueva: 'Nueva', en_seguimiento: 'En seguimiento', respondida: 'Respondida', archivada: 'Archivada' };
const TONO_ESTADO = { nueva: 'primario', en_seguimiento: 'aviso', respondida: 'ok', archivada: 'neutro' };
const TONO_TIPO = { general: 'neutro', cotizacion: 'secundario', asesoria: 'acento' };

function DetalleConsulta({ id, onCerrar, onCambio }) {
  const { mostrar } = useAvisos();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [notas, setNotas] = useState('');
  const [respuesta, setRespuesta] = useState({ asunto: '', cuerpo: '' });
  const [errores, setErrores] = useState({});
  const [trabajando, setTrabajando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const datos = await api.consultas.obtener(id);
      setC(datos);
      setNotas(datos.notas_internas || '');
      setRespuesta((r) => ({ asunto: r.asunto || `Re: ${datos.asunto}`.slice(0, 200), cuerpo: r.cuerpo }));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarEstado = async (estado) => {
    setTrabajando('estado');
    try {
      await api.consultas.estado(id, estado);
      await cargar();
      onCambio();
      mostrar(`Estado: ${ESTADOS[estado]}.`, 'info');
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setTrabajando('');
    }
  };

  const guardarNotas = async () => {
    setTrabajando('notas');
    try {
      await api.consultas.notas(id, notas);
      await cargar();
      mostrar('Notas guardadas.');
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setTrabajando('');
    }
  };

  const responder = async (e) => {
    e.preventDefault();
    const e2 = { asunto: validar.texto(respuesta.asunto, 'El asunto', { min: 3, max: 200 }), cuerpo: validar.texto(respuesta.cuerpo, 'La respuesta', { min: 5, max: 5000 }) };
    setErrores(e2);
    if (e2.asunto || e2.cuerpo) return;
    setTrabajando('responder');
    try {
      const r = await api.consultas.responder(id, { asunto: respuesta.asunto.trim(), cuerpo: respuesta.cuerpo.trim() });
      setC(r);
      setNotas(r.notas_internas || '');
      setRespuesta({ asunto: `Re: ${r.asunto}`.slice(0, 200), cuerpo: '' });
      onCambio();
      mostrar(r.respuestas.at(-1)?.simulado ? 'Respuesta guardada (el correo se simuló: no hay SMTP configurado).' : 'Respuesta enviada por correo.');
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setTrabajando('');
    }
  };

  return (
    <Superposicion abierto onCerrar={onCerrar} titulo={c ? c.codigo : 'Consulta'} lado="derecha">
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-5">
            <BloqueError mensaje={error} />
          </div>
        ) : !c ? (
          <Cargando />
        ) : (
          <div className="space-y-6 p-5">
            <div>
              <div className="flex flex-wrap gap-2">
                <Insignia tono={TONO_ESTADO[c.estado]}>{ESTADOS[c.estado]}</Insignia>
                <Insignia tono={TONO_TIPO[c.tipo]}>{TIPOS[c.tipo]}</Insignia>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{c.asunto}</h3>
              <p className="mt-1 text-sm text-ink-2">
                {c.nombre} · <a href={`mailto:${c.email}`} className="text-secondary hover:underline">{c.email}</a>
                {c.telefono && <> · {c.telefono}</>}
              </p>
              <p className="text-xs text-ink-3">Recibida {fechaLarga(c.creado_en)}</p>
              <p className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-surface-1 p-4 text-ink">{c.mensaje}</p>
            </div>

            <Campo etiqueta="Estado de seguimiento">
              {(p) => (
                <Seleccion {...p} value={c.estado} disabled={trabajando === 'estado'} onChange={(e) => cambiarEstado(e.target.value)}>
                  {Object.entries(ESTADOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Seleccion>
              )}
            </Campo>

            <div>
              <h4 className="mb-2 font-semibold">Respuestas enviadas</h4>
              {c.respuestas.length === 0 ? (
                <p className="text-sm text-ink-3">Todavía no respondiste esta consulta.</p>
              ) : (
                <ul className="space-y-3">
                  {c.respuestas.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line bg-surface-1 p-4 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
                        <span>
                          {r.autor || 'Equipo'} · {fecha(r.creado_en, { hora: true })}
                        </span>
                        {r.simulado && <Insignia tono="aviso">Correo simulado</Insignia>}
                      </p>
                      <p className="mt-1 font-medium">{r.asunto}</p>
                      <p className="mt-1 whitespace-pre-wrap text-ink-2">{r.cuerpo}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={responder} noValidate className="space-y-4 rounded-md border border-line p-4">
              <h4 className="flex items-center gap-2 font-semibold">
                <Mail size={18} className="text-primary" aria-hidden="true" /> Responder por correo
              </h4>
              <Campo etiqueta="Asunto" error={errores.asunto}>
                {(p) => <Entrada {...p} value={respuesta.asunto} maxLength={200} error={errores.asunto} onChange={(e) => setRespuesta({ ...respuesta, asunto: e.target.value })} />}
              </Campo>
              <Campo etiqueta="Mensaje" error={errores.cuerpo} ayuda={`Se envía a ${c.email}.`}>
                {(p) => <AreaTexto {...p} rows={6} value={respuesta.cuerpo} maxLength={5000} error={errores.cuerpo} onChange={(e) => setRespuesta({ ...respuesta, cuerpo: e.target.value })} />}
              </Campo>
              <Boton type="submit" icono={Send} cargando={trabajando === 'responder'}>
                Enviar respuesta
              </Boton>
            </form>

            <div>
              <Campo etiqueta="Notas internas (sólo las ve el equipo)" ayuda="Se agregan solas las respuestas y los cambios de estado.">
                {(p) => <AreaTexto {...p} rows={5} value={notas} maxLength={3000} onChange={(e) => setNotas(e.target.value)} className="font-mono text-xs" />}
              </Campo>
              <Boton variante="secundario" tamano="sm" className="mt-3" cargando={trabajando === 'notas'} onClick={guardarNotas} disabled={notas === (c.notas_internas || '')}>
                Guardar notas
              </Boton>
            </div>

            {c.estado !== 'archivada' && (
              <Boton variante="fantasma" tamano="sm" icono={Archive} onClick={() => cambiarEstado('archivada')}>
                Archivar
              </Boton>
            )}
          </div>
        )}
      </div>
    </Superposicion>
  );
}

export default function Consultas() {
  const [filtros, setFiltros] = useState({ estado: 'abiertas', tipo: '', q: '', pagina: 1 });
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++pedido.current;
    try {
      const [l, r] = await Promise.all([api.consultas.listar({ ...filtros, limite: 15 }), api.consultas.resumen()]);
      if (n !== pedido.current) return;
      setLista(l);
      setResumen(r);
      setError('');
    } catch (e) {
      if (n === pedido.current) setError(e.message);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Espera un momento después de escribir para no pedir en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda, pagina: 1 })), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const filtroEstado = [
    ['abiertas', 'Abiertas', resumen ? resumen.nueva + resumen.en_seguimiento : null],
    ['nueva', 'Nuevas', resumen?.nueva],
    ['en_seguimiento', 'En seguimiento', resumen?.en_seguimiento],
    ['respondida', 'Respondidas', resumen?.respondida],
    ['archivada', 'Archivadas', resumen?.archivada],
    ['', 'Todas', resumen ? Object.values(resumen).reduce((a, b) => a + b, 0) : null],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {filtroEstado.map(([clave, texto, cantidad]) => (
          <button
            key={texto}
            type="button"
            aria-pressed={filtros.estado === clave}
            onClick={() => setFiltros({ ...filtros, estado: clave, pagina: 1 })}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
              filtros.estado === clave ? 'border-primary/60 bg-primary/10 text-primary' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'
            )}
          >
            {texto}
            {cantidad != null && <span className="ml-1.5 font-mono text-xs opacity-80">{cantidad}</span>}
          </button>
        ))}
      </div>

      <Tarjeta>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_12rem]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código, nombre, email o asunto" aria-label="Buscar consultas" className="pl-9" />
          </div>
          <Seleccion aria-label="Filtrar por tipo" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value, pagina: 1 })}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Seleccion>
        </div>

        {error ? (
          <div className="p-6">
            <BloqueError mensaje={error} onReintentar={cargar} />
          </div>
        ) : !lista ? (
          <Cargando />
        ) : (
          <>
            <Tabla
              columnas={['Código', 'Quién', 'Asunto', 'Tipo', 'Estado', 'Recibida', '']}
              vacia={lista.items.length === 0 && <Vacio icono={Inbox} titulo="No hay consultas con estos filtros">Cuando alguien escriba desde el formulario de contacto va a aparecer acá.</Vacio>}
            >
              {lista.items.map((c) => (
                <tr key={c.id} className="cursor-pointer transition-colors hover:bg-surface-3/60" onClick={() => setAbierta(c.id)}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-primary">{c.codigo}</td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{c.nombre}</span>
                    <span className="block text-xs text-ink-3">{c.email}</span>
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-ink-2">{c.asunto}</td>
                  <td className="px-4 py-3">
                    <Insignia tono={TONO_TIPO[c.tipo]}>{TIPOS[c.tipo]}</Insignia>
                  </td>
                  <td className="px-4 py-3">
                    <Insignia tono={TONO_ESTADO[c.estado]}>{ESTADOS[c.estado]}</Insignia>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{fecha(c.creado_en, { hora: true })}</td>
                  <td className="px-4 py-3">
                    <button type="button" aria-label={`Abrir la consulta ${c.codigo}`} className="rounded-sm p-1.5 text-ink-2 hover:bg-surface-3 hover:text-primary" onClick={(e) => { e.stopPropagation(); setAbierta(c.id); }}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </Tabla>
            <Paginacion pagina={lista ? filtros.pagina : 1} paginas={lista.paginas} onCambiar={(pagina) => setFiltros({ ...filtros, pagina })} />
          </>
        )}
      </Tarjeta>

      {abierta && <DetalleConsulta id={abierta} onCerrar={() => setAbierta(null)} onCambio={cargar} />}
    </div>
  );
}
