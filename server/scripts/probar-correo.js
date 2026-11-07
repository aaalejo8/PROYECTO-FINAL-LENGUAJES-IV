'use strict';
/**
 * Verifica la configuración SMTP y manda un correo de prueba.
 *   npm run correo:probar                      → sólo verifica la conexión
 *   npm run correo:probar -- destino@mail.com  → además envía un correo de prueba
 */
const config = require('../src/config');
const correo = require('../src/correo');

(async () => {
  if (config.correo.simulado) {
    console.log('ℹ SMTP_HOST está vacío: los correos se simulan. Completá SMTP_* en server/.env para enviarlos de verdad.');
    return;
  }
  await correo.verificar();
  console.log(`✔ Conexión SMTP correcta con ${config.correo.host}:${config.correo.puerto}`);
  const destino = process.argv[2];
  if (destino) {
    const r = await correo.enviar({ para: destino, asunto: `Prueba de correo · ${config.sitio.nombre}`, texto: 'Si leés esto, el envío de correos del portfolio funciona.' });
    console.log(`✔ Correo enviado a ${destino} (id ${r.id || 'sin id'})`);
  }
})().catch((error) => {
  console.error('✖ Falló el correo:', error.message);
  process.exitCode = 1;
});
