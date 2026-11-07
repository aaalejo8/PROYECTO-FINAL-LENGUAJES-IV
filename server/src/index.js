'use strict';
const config = require('./config');
config.validar();

const supabase = require('./supabase');
const { crearServidor } = require('./http');
const crearRutas = require('./app');

const servidor = crearServidor(crearRutas());

async function iniciar() {
  // Comprueba que Supabase responda, que las migraciones estén aplicadas y que las dos claves sirvan
  const { error } = await supabase.publico.rpc('proyectos_publicos');
  if (error) {
    console.error('✖ No pude usar la base de Supabase:', error.message);
    console.error('  Revisá SUPABASE_URL y SUPABASE_ANON_KEY en server/.env, y aplicá las migraciones de supabase/migrations (ver docs/SUPABASE.md).');
    process.exit(1);
  }
  const privada = await supabase.admin.from('consultas').select('id', { head: true, count: 'exact' });
  if (privada.error) {
    console.error('✖ La SUPABASE_SERVICE_ROLE_KEY no es válida:', privada.error.message);
    console.error('  Sin ella no funcionan el formulario de contacto, el contador de visitas ni la gestión de cuentas.');
    if (config.produccion) process.exit(1);
  }

  servidor.listen(config.puerto, () => {
    console.log(`✔ ${config.sitio.nombre} funcionando en http://localhost:${config.puerto}`);
    console.log(
      `  Supabase: ${config.supabase.url} · Correo: ${config.correo.simulado ? 'simulado (sin SMTP)' : `SMTP ${config.correo.host}`} · Google: ${config.google ? 'botón visible' : 'oculto'}`
    );
  });
}

function apagar(senal) {
  console.log(`\n${senal} recibido: cerrando el servidor...`);
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
process.on('unhandledRejection', (error) => console.error('Promesa sin atender:', error));

iniciar();
