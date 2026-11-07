import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Mail, MapPin, Send, Thermometer } from 'lucide-react';
import { api } from '../api';
import { useAvisos, useSesion } from '../contexto';
import { AreaTexto, Boton, Campo, EncabezadoSeccion, Entrada } from '../componentes/ui';
import { cx, hayErrores, validar } from '../utils';

const TIPOS = [
  ['general', 'Consulta general', 'Preguntas, ideas o simplemente saludar'],
  ['cotizacion', 'Cotización', 'Presupuesto para un proyecto'],
  ['asesoria', 'Asesoría técnica', 'Revisar o planificar algo que ya tenés'],
];

const VACIO = { tipo: 'general', nombre: '', email: '', telefono: '', asunto: '', mensaje: '', sitio_web: '' };

function revisar(d) {
  return {
    nombre: validar.texto(d.nombre, 'El nombre', { min: 2, max: 100 }),
    email: validar.email(d.email),
    telefono: validar.telefono(d.telefono),
    asunto: validar.texto(d.asunto, 'El asunto', { min: 3, max: 150 }),
    mensaje: validar.texto(d.mensaje, 'El mensaje', { min: 10, max: 2000 }),
  };
}

/** Hora local y clima de quien recibe las consultas (API Open-Meteo, consultada por el servidor). */
function RelojClima() {
  const [clima, setClima] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    let vigente = true;
    api
      .clima()
      .then((d) => vigente && setClima(d))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const zona = clima?.zona || 'America/Argentina/Salta';
  const hora = useMemo(() => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(ahora), [ahora, zona]);
  const horaNumero = Number(hora.slice(0, 2));
  const enHorario = horaNumero >= 9 && horaNumero < 20;

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-5" data-reveal>
      <div className="flex items-center gap-3">
        <Clock size={20} className="text-secondary" aria-hidden="true" />
        <div>
          <p className="font-display text-3xl font-semibold leading-none">{hora}</p>
          <p className="mt-1 text-sm text-ink-2">{clima?.ciudad || 'Salta, Argentina'}</p>
        </div>
        {clima?.disponible && (
          <div className="ml-auto text-right">
            <p className="flex items-center justify-end gap-1.5 font-display text-2xl font-semibold">
              <Thermometer size={18} className="text-warning" aria-hidden="true" />
              {clima.temperatura}°C
            </p>
            <p className="text-sm text-ink-2">{clima.descripcion}</p>
          </div>
        )}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
        <span className={cx('mr-2 inline-block h-2 w-2 rounded-full', enHorario ? 'bg-success' : 'bg-warning')} aria-hidden="true" />
        {enHorario ? 'Es horario de atención: suelo responder en el día.' : 'Fuera de horario: te respondo apenas vuelva a conectarme.'}
      </p>
    </div>
  );
}

export default function Contacto({ perfil }) {
  const { usuario } = useSesion();
  const { mostrar } = useAvisos();
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [tocados, setTocados] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);

  // Si la persona ya tiene cuenta, se completan sus datos
  useEffect(() => {
    if (!usuario) return;
    setDatos((d) => ({ ...d, nombre: d.nombre || usuario.nombre, email: d.email || usuario.email }));
  }, [usuario]);

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;
    setDatos((d) => {
      const nuevo = { ...d, [campo]: valor };
      if (tocados[campo]) setErrores(revisar(nuevo));
      return nuevo;
    });
  };
  const alSalir = (campo) => () => {
    setTocados((t) => ({ ...t, [campo]: true }));
    setErrores(revisar(datos));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const e2 = revisar(datos);
    setErrores(e2);
    setTocados({ nombre: true, email: true, telefono: true, asunto: true, mensaje: true });
    if (hayErrores(e2)) {
      mostrar('Revisá los campos marcados en rojo.', 'error');
      return;
    }
    setEnviando(true);
    try {
      const r = await api.contacto({ ...datos, nombre: datos.nombre.trim(), email: datos.email.trim(), telefono: datos.telefono.trim() });
      setEnviado(r.codigo);
      setDatos(VACIO);
      setTocados({});
      setErrores({});
    } catch (error) {
      mostrar(error.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const emailPublico = perfil?.email_publico;

  return (
    <section id="contacto" className="seccion">
      <div className="contenedor">
        <EncabezadoSeccion etiqueta="06 · Contacto" titulo="Hablemos de tu proyecto">
          Contame qué necesitás. Recibís una confirmación por correo y te respondo personalmente.
        </EncabezadoSeccion>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-lg border border-line bg-surface-2 p-5 sm:p-8" data-reveal>
            {enviado ? (
              <div className="py-8 text-center" role="status">
                <CheckCircle2 size={48} className="mx-auto text-success" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-semibold">Mensaje enviado</h3>
                <p className="mx-auto mt-2 max-w-md text-ink-2">
                  Te mandé una confirmación por correo. Tu código de seguimiento es <span className="font-mono text-primary">{enviado}</span>.
                </p>
                <Boton variante="secundario" className="mt-6" onClick={() => setEnviado(null)}>
                  Enviar otra consulta
                </Boton>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">¿Qué tipo de consulta es?</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TIPOS.map(([valor, etiqueta, ayuda]) => (
                      <label
                        key={valor}
                        className={cx(
                          'cursor-pointer rounded-md border p-3 transition-colors has-[:focus-visible]:shadow-focus',
                          datos.tipo === valor ? 'border-primary bg-primary/10' : 'border-line hover:border-line-strong'
                        )}
                      >
                        <input type="radio" name="tipo" value={valor} checked={datos.tipo === valor} onChange={cambiar('tipo')} className="sr-only" />
                        <span className="block text-sm font-semibold">{etiqueta}</span>
                        <span className="mt-0.5 block text-xs text-ink-2">{ayuda}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Campo etiqueta="Nombre" error={errores.nombre}>
                    {(p) => <Entrada {...p} value={datos.nombre} onChange={cambiar('nombre')} onBlur={alSalir('nombre')} autoComplete="name" maxLength={100} error={errores.nombre} />}
                  </Campo>
                  <Campo etiqueta="Email" error={errores.email}>
                    {(p) => <Entrada {...p} type="email" value={datos.email} onChange={cambiar('email')} onBlur={alSalir('email')} autoComplete="email" maxLength={150} error={errores.email} />}
                  </Campo>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Campo etiqueta="Teléfono" opcional error={errores.telefono}>
                    {(p) => <Entrada {...p} type="tel" value={datos.telefono} onChange={cambiar('telefono')} onBlur={alSalir('telefono')} autoComplete="tel" maxLength={25} error={errores.telefono} />}
                  </Campo>
                  <Campo etiqueta="Asunto" error={errores.asunto}>
                    {(p) => <Entrada {...p} value={datos.asunto} onChange={cambiar('asunto')} onBlur={alSalir('asunto')} maxLength={150} error={errores.asunto} />}
                  </Campo>
                </div>
                <Campo etiqueta="Mensaje" error={errores.mensaje} ayuda={`${datos.mensaje.length}/2000`}>
                  {(p) => <AreaTexto {...p} value={datos.mensaje} onChange={cambiar('mensaje')} onBlur={alSalir('mensaje')} maxLength={2000} rows={6} error={errores.mensaje} />}
                </Campo>

                {/* Campo trampa para robots: las personas no lo ven ni lo completan */}
                <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label>
                    No completes este campo
                    <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" value={datos.sitio_web} onChange={cambiar('sitio_web')} />
                  </label>
                </div>

                <Boton type="submit" tamano="lg" cargando={enviando} icono={Send} className="w-full sm:w-auto">
                  Enviar consulta
                </Boton>
              </form>
            )}
          </div>

          <aside className="space-y-5">
            <RelojClima />
            <div className="rounded-lg border border-line bg-surface-2 p-5" data-reveal>
              <h3 className="mb-3 text-lg font-semibold">Otras vías</h3>
              <ul className="space-y-3 text-ink-2">
                {emailPublico && (
                  <li className="flex items-center gap-3">
                    <Mail size={18} className="text-primary" aria-hidden="true" />
                    <a href={`mailto:${emailPublico}`} className="hover:text-primary">
                      {emailPublico}
                    </a>
                  </li>
                )}
                {perfil?.ubicacion && (
                  <li className="flex items-center gap-3">
                    <MapPin size={18} className="text-primary" aria-hidden="true" /> {perfil.ubicacion}
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
