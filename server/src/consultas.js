'use strict';
/**
 * Consultas del formulario de contacto: el visitante las envía, el operador las atiende
 * (cambia el estado, anota, responde por correo) y el administrador también.
 *
 *   · El alta la hace el servidor con la clave service_role (después de validar, limitar
 *     envíos y descartar robots): ningún navegador puede insertar consultas directo en la base.
 *   · La bandeja usa el cliente del usuario (ctx.db): la base verifica con RLS que sea staff.
 */
const crypto = require('crypto');
const config = require('./config');
const correo = require('./correo');
const supabase = require('./supabase');
const { ErrorHttp } = require('./errores');
const { texto, email: validarEmail, opcion, telefonoOpcional, sinAcentos } = require('./validar');

const TIPOS = ['general', 'cotizacion', 'asesoria'];
const ETIQUETA_TIPO = { general: 'Consulta general', cotizacion: 'Cotización de proyecto', asesoria: 'Asesoría técnica' };
const ESTADOS = ['nueva', 'en_seguimiento', 'respondida', 'archivada'];
const ETIQUETA_ESTADO = { nueva: 'Nueva', en_seguimiento: 'En seguimiento', respondida: 'Respondida', archivada: 'Archivada' };

// Sin caracteres que se confunden (0/O, 1/I)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generarCodigo = () =>
  'CON-' +
  [...crypto.randomBytes(6)]
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

/** Agrega una línea fechada a las notas internas. */
function agregarNota(previas, linea) {
  const marca = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: config.zona,
  }).format(new Date());
  return `${previas ? `${previas}\n` : ''}[${marca}] ${linea}`.slice(-3000);
}

const COLUMNAS = 'id, codigo, tipo, nombre, email, telefono, asunto, mensaje, estado, notas_internas, usuario_id, creado_en, actualizado_en, respuestas (count)';

const aplanar = (c) => {
  if (!c) return c;
  const { respuestas, ...resto } = c;
  return { ...resto, cantidad_respuestas: Array.isArray(respuestas) ? (respuestas[0]?.count ?? 0) : 0 };
};

// ───────────────────────────── Lo que hace el visitante ─────────────────────────────

async function crear(datos, usuario) {
  const d = datos && typeof datos === 'object' ? datos : {};

  // Campo trampa: está oculto, las personas no lo ven. Si viene lleno es un robot: se descarta sin avisarle.
  if (typeof d.sitio_web === 'string' && d.sitio_web.trim() !== '') {
    return { codigo: generarCodigo(), creado_en: new Date().toISOString() };
  }

  const fila = {
    tipo: opcion(d.tipo, 'El tipo de consulta', TIPOS),
    nombre: texto(d.nombre, 'El nombre', { obligatorio: true, min: 2, max: 100 }),
    email: validarEmail(d.email, 'El email', { obligatorio: true }),
    telefono: telefonoOpcional(d.telefono, 'El teléfono') || null,
    asunto: texto(d.asunto, 'El asunto', { obligatorio: true, min: 3, max: 150 }),
    mensaje: texto(d.mensaje, 'El mensaje', { obligatorio: true, min: 10, max: 2000, multilinea: true }),
    usuario_id: usuario?.id ?? null,
  };

  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await supabase.admin
      .from('consultas')
      .insert({ ...fila, codigo: generarCodigo() })
      .select('id, codigo, tipo, nombre, email, telefono, asunto, mensaje, creado_en')
      .single();
    if (!error) {
      const envio = avisarPorCorreo(data);
      // En Vercel la función se congela al responder: ahí se espera a que salgan los correos.
      if (process.env.VERCEL) await envio;
      return { codigo: data.codigo, creado_en: data.creado_en };
    }
    if (error.code !== '23505') throw supabase.traducir(error); // 23505 = código repetido: se prueba con otro
  }
  throw new ErrorHttp(500, 'No pudimos registrar la consulta. Probá de nuevo en un momento.');
}

/**
 * Los correos de aviso salen "en segundo plano": si el servidor SMTP tarda o falla, la consulta ya quedó guardada.
 * Devuelve una promesa que nunca falla (sirve para esperarla cuando el servidor es una función serverless).
 */
function avisarPorCorreo(consulta) {
  const tareas = [];
  if (config.correo.destino) {
    const aviso = correo.avisoDeConsulta(consulta, ETIQUETA_TIPO[consulta.tipo]);
    tareas.push(correo.enviar({ para: config.correo.destino, asunto: aviso.asunto, texto: aviso.texto, html: aviso.html, responderA: consulta.email }));
  }
  const confirmacion = correo.confirmacionAlVisitante(consulta, ETIQUETA_TIPO[consulta.tipo]);
  tareas.push(correo.enviar({ para: consulta.email, asunto: confirmacion.asunto, texto: confirmacion.texto, html: confirmacion.html, responderA: config.correo.responderA }));
  return Promise.allSettled(tareas).then((resultados) => {
    for (const r of resultados) if (r.status === 'rejected') console.error(`[Correo] No pude enviar el aviso de ${consulta.codigo}:`, r.reason?.message);
  });
}

// ───────────────────────────── Bandeja (operador y administrador) ─────────────────────────────

async function listar(db, { estado, tipo, q, desde, limite }) {
  let consulta = db.from('consultas').select(COLUMNAS, { count: 'exact' });
  if (estado === 'abiertas') consulta = consulta.in('estado', ['nueva', 'en_seguimiento']);
  else if (ESTADOS.includes(estado)) consulta = consulta.eq('estado', estado);
  if (TIPOS.includes(tipo)) consulta = consulta.eq('tipo', tipo);
  // Búsqueda sin acentos ni mayúsculas sobre la columna generada "busqueda" (código, nombre, email, asunto)
  for (const palabra of String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 4)) {
    consulta = consulta.ilike('busqueda', `%${sinAcentos(palabra.slice(0, 60)).replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { items, total } = await supabase.conTotal(
    consulta
      .order('prioridad') // primero las abiertas, después respondidas y al final archivadas
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + limite - 1)
  );
  return { items: items.map(aplanar), total };
}

async function resumen(db) {
  return supabase.datos(db.rpc('consultas_resumen'));
}

/** Una consulta con todas sus respuestas. */
async function obtener(db, id) {
  const c = await supabase.datos(db.from('consultas').select(COLUMNAS).eq('id', id).maybeSingle(), { noEncontrado: 'Consulta no encontrada.' });
  const respuestas = await supabase.datos(
    db.from('respuestas').select('id, asunto, cuerpo, simulado, creado_en, autor:autor_nombre').eq('consulta_id', id).order('creado_en').order('id')
  );
  return { ...aplanar(c), respuestas };
}

async function cambiarEstado(db, id, nuevoEstado, usuario) {
  opcion(nuevoEstado, 'El estado', ESTADOS);
  const actual = await supabase.datos(db.from('consultas').select('estado, notas_internas').eq('id', id).maybeSingle(), { noEncontrado: 'Consulta no encontrada.' });
  if (actual.estado !== nuevoEstado) {
    await supabase.datos(
      db
        .from('consultas')
        .update({
          estado: nuevoEstado,
          notas_internas: agregarNota(actual.notas_internas, `${usuario.nombre}: ${ETIQUETA_ESTADO[actual.estado]} → ${ETIQUETA_ESTADO[nuevoEstado]}`),
        })
        .eq('id', id)
    );
  }
  return obtener(db, id);
}

async function guardarNotas(db, id, notas) {
  const filas = await supabase.datos(db.from('consultas').update({ notas_internas: notas || null }).eq('id', id).select('id'));
  if (!filas.length) throw new ErrorHttp(404, 'Consulta no encontrada.');
  return obtener(db, id);
}

/**
 * Responde por correo. Si el servidor SMTP rechaza el envío no se guarda nada ni cambia el estado:
 * así nunca queda marcada como "respondida" una consulta que el visitante no recibió.
 */
async function responder(db, id, datos, usuario) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const asunto = texto(d.asunto, 'El asunto', { obligatorio: true, min: 3, max: 200 });
  const cuerpo = texto(d.cuerpo, 'La respuesta', { obligatorio: true, min: 5, max: 5000, multilinea: true });

  const consulta = await supabase.datos(db.from('consultas').select('codigo, email, nombre, asunto, notas_internas').eq('id', id).maybeSingle(), {
    noEncontrado: 'Consulta no encontrada.',
  });

  let envio;
  try {
    const plantilla = correo.respuestaAConsulta({ consulta, cuerpo, autor: usuario.nombre });
    envio = await correo.enviar({ para: consulta.email, asunto, texto: plantilla.texto, html: plantilla.html, responderA: config.correo.responderA });
  } catch (error) {
    console.error(`[Correo] Falló la respuesta a la consulta ${id}:`, error.message);
    throw new ErrorHttp(502, 'No pude enviar el correo. Revisá la configuración SMTP del servidor e intentá de nuevo.');
  }

  await supabase.datos(
    db.from('respuestas').insert({ consulta_id: id, autor_id: usuario.id, autor_nombre: usuario.nombre, asunto, cuerpo, simulado: envio.simulado })
  );
  await supabase.datos(
    db
      .from('consultas')
      .update({
        estado: 'respondida',
        notas_internas: agregarNota(consulta.notas_internas, `${usuario.nombre} respondió por correo${envio.simulado ? ' (simulado)' : ''}.`),
      })
      .eq('id', id)
  );
  return obtener(db, id);
}

module.exports = {
  TIPOS,
  ESTADOS,
  ETIQUETA_TIPO,
  generarCodigo,
  crear,
  listar,
  resumen,
  obtener,
  cambiarEstado,
  guardarNotas,
  responder,
};
