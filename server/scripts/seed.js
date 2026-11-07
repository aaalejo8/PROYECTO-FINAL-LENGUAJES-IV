'use strict';
/**
 * Carga contenido de ejemplo para un desarrollador ficticio (Nicolás Herrera), así el portfolio no arranca vacío.
 * Sólo carga lo que falta: se puede correr varias veces sin duplicar nada ni pisar lo que editaste desde el panel.
 *
 *   npm run db:seed   (usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de server/.env)
 *
 * Para usar tus datos: editá este archivo antes de correrlo, o cargá todo desde el panel de administración.
 */
// El cliente se carga recién al ejecutar (así otros scripts pueden leer los datos sin claves)
const admin = () => require('../src/supabase').admin;

const PERFIL = {
  nombre: 'Nicolás Herrera',
  titular: 'Desarrollador Fullstack',
  bio: 'Diseño, programo y publico aplicaciones web completas: desde la interfaz que ve el usuario hasta la base de datos que la sostiene. Me gusta el código claro, las interfaces rápidas y entregar cosas que funcionen de verdad.',
  ubicacion: 'Salta, Argentina',
  email_publico: 'nicolas.herrera@example.com',
  github_usuario: null, // si es null se usa GITHUB_USUARIO del .env
  linkedin_url: null,
  disponible: true,
  anios_experiencia: 3,
};

const TECNOLOGIAS = [
  ['HTML', 'frontend', 5],
  ['CSS', 'frontend', 5],
  ['JavaScript', 'frontend', 4],
  ['React', 'frontend', 4],
  ['Tailwind CSS', 'frontend', 4],
  ['GSAP', 'frontend', 3],
  ['Node.js', 'backend', 4],
  ['Express', 'backend', 4],
  ['Python', 'backend', 3],
  ['PostgreSQL', 'datos', 4],
  ['Supabase', 'datos', 4],
  ['MySQL', 'datos', 3],
  ['SQL', 'datos', 4],
  ['Git y GitHub', 'herramientas', 4],
  ['Vite', 'herramientas', 4],
  ['Linux', 'herramientas', 3],
];

const EXPERIENCIA = [
  ['Desarrollador fullstack freelance', 'Clientes independientes', '2024', 'Actualidad', 'Sitios y sistemas a medida para comercios y pymes: catálogo online, paneles de administración, reportes y despliegue en la nube.'],
  ['Desarrollador junior', 'Estudio de software', '2023', '2024', 'Mantenimiento de APIs en Node.js y pantallas en React. Revisión de código en equipo y trabajo con PostgreSQL.'],
  ['Ingeniería en Informática', 'Universidad (en curso)', '2021', 'Actualidad', 'Base sólida en algoritmos, bases de datos, redes y desarrollo web.'],
];

const SERVICIOS = [
  ['Desarrollo web a medida', 'Sitios y aplicaciones web rápidas, accesibles y adaptadas a celulares, pensadas para tu negocio y no para una plantilla.', 'layout'],
  ['APIs y backend', 'Servicios en Node.js con autenticación, validación de datos y documentación, listos para conectar con tu app o tu tienda.', 'server'],
  ['Bases de datos y reportes', 'Diseño de bases PostgreSQL o MySQL, migraciones y paneles con métricas para que veas qué pasa en tu sistema.', 'database'],
  ['Asesoría técnica y code review', 'Revisamos tu proyecto, ordenamos las decisiones de arquitectura y te dejo un plan claro de mejoras.', 'message-square'],
  ['Despliegue y mantenimiento', 'Publicación en la nube con https, copias de seguridad y actualizaciones, para que el sitio no se caiga.', 'cloud'],
];

const PROYECTOS = [
  {
    slug: 'gestor-de-turnos',
    titulo: 'Gestor de turnos',
    resumen: 'Sistema de reservas online para consultorios y peluquerías, con recordatorios por correo.',
    descripcion:
      'Aplicación web donde los clientes reservan turnos eligiendo servicio, profesional y horario disponible. El comercio ve su agenda del día, bloquea horarios y recibe un aviso por cada reserva nueva.\n\nSe resolvió la superposición de turnos con transacciones en PostgreSQL y se agregó un panel con métricas de ocupación por semana.',
    tecnologias: ['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
    destacado: true,
    demos: [
      ['Recorrido del flujo de reserva', 'Demo de ejemplo: reemplazala por el link de tu demo desde el panel.', 'enlace', 'https://example.com/'],
    ],
  },
  {
    slug: 'panel-de-metricas',
    titulo: 'Panel de métricas en tiempo real',
    resumen: 'Dashboard con gráficos interactivos que se actualizan solos, para seguir ventas y visitas.',
    descripcion:
      'Panel para dueños de comercios que reúne ventas, visitas y consultas en gráficos filtrables por fecha. Los datos se consultan con SQL parametrizado y se agrupan por día, semana o mes.\n\nIncluye exportación de reportes y un modo oscuro pensado para uso prolongado.',
    tecnologias: ['React', 'Chart.js', 'Express', 'PostgreSQL'],
    destacado: true,
    demos: [['Dashboard con datos de ejemplo', 'Demo de ejemplo: reemplazala por el link de tu demo desde el panel.', 'enlace', 'https://example.com/']],
  },
  {
    slug: 'api-de-reservas',
    titulo: 'API de reservas',
    resumen: 'API REST con autenticación por tokens, roles y límites de uso, documentada de punta a punta.',
    descripcion:
      'Servicio backend que expone reservas, usuarios y disponibilidad. Usa contraseñas con hash, sesiones firmadas, límite de intentos y validación estricta de cada campo recibido.\n\nPensada para conectarse con apps móviles y sitios de terceros.',
    tecnologias: ['Node.js', 'Express', 'PostgreSQL', 'Python'],
    destacado: false,
    demos: [],
  },
  {
    slug: 'finanzas-personales',
    titulo: 'App de finanzas personales',
    resumen: 'Registro de gastos con categorías, presupuestos mensuales y gráficos de evolución.',
    descripcion:
      'Aplicación para cargar ingresos y gastos desde el celular, con categorías propias, presupuestos por mes y alertas al acercarse al límite.\n\nLos gráficos muestran la evolución mensual y comparan contra el período anterior.',
    tecnologias: ['React', 'Tailwind CSS', 'Node.js', 'MySQL'],
    destacado: false,
    demos: [],
  },
];

async function vacia(tabla) {
  const { count, error } = await admin().from(tabla).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${tabla}: ${error.message} (¿aplicaste las migraciones de supabase/migrations?)`);
  return count === 0;
}

async function insertar(tabla, filas, columnas = '*') {
  const { data, error } = await admin().from(tabla).insert(filas).select(columnas);
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return data;
}

async function main() {
  const hecho = [];

  if (await vacia('perfil_sitio')) {
    await insertar('perfil_sitio', [{ id: 1, ...PERFIL }]);
    hecho.push('perfil');
  }

  if (await vacia('tecnologias')) {
    await insertar('tecnologias', TECNOLOGIAS.map(([nombre, categoria, nivel], orden) => ({ nombre, categoria, nivel, orden })));
    hecho.push(`${TECNOLOGIAS.length} tecnologías`);
  }

  if (await vacia('experiencia')) {
    await insertar('experiencia', EXPERIENCIA.map(([puesto, organizacion, desde, hasta, descripcion], orden) => ({ puesto, organizacion, desde, hasta, descripcion, orden })));
    hecho.push(`${EXPERIENCIA.length} experiencias`);
  }

  if (await vacia('servicios')) {
    await insertar('servicios', SERVICIOS.map(([titulo, descripcion, icono], orden) => ({ titulo, descripcion, icono, orden })));
    hecho.push(`${SERVICIOS.length} servicios`);
  }

  if (await vacia('proyectos')) {
    for (const [orden, { demos, ...p }] of PROYECTOS.entries()) {
      const [fila] = await insertar('proyectos', [{ ...p, orden }], 'id');
      if (demos.length) {
        await insertar('demos', demos.map(([titulo, descripcion, tipo, url], j) => ({ proyecto_id: fila.id, titulo, descripcion, tipo, url, orden: j })));
      }
    }
    hecho.push(`${PROYECTOS.length} proyectos con sus demos`);
  }

  console.log(hecho.length ? `✔ Contenido de ejemplo cargado: ${hecho.join(', ')}.` : '✔ No había nada que cargar: las tablas ya tienen contenido.');
}

module.exports = { PERFIL, TECNOLOGIAS, EXPERIENCIA, SERVICIOS, PROYECTOS };

if (require.main === module) {
  main().catch((error) => {
    console.error('✖ Error:', error.message);
    process.exitCode = 1;
  });
}
