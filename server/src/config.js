'use strict';
/**
 * Configuración central. Todo sale del archivo server/.env (ver .env.example).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.join(__dirname, '..');
const archivoEnv = path.join(raiz, '.env');
if (fs.existsSync(archivoEnv) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(archivoEnv);
}

const env = process.env;
const entero = (valor, porDefecto) => {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
};
const decimal = (valor, porDefecto) => {
  const n = parseFloat(valor);
  return Number.isFinite(n) ? n : porDefecto;
};
const booleano = (valor, porDefecto = false) => {
  if (valor === undefined || valor === '') return porDefecto;
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(String(valor).trim().toLowerCase());
};
const limpio = (valor) => String(valor ?? '').trim();

const produccion = env.NODE_ENV === 'production';
const puerto = entero(env.PORT, 3000);
const urlPublica = (env.PUBLIC_URL || (produccion ? '' : 'http://localhost:5173')).replace(/\/+$/, '');

const supabaseUrl = limpio(env.SUPABASE_URL).replace(/\/+$/, '');
const anonKey = limpio(env.SUPABASE_ANON_KEY);
const serviceKey = limpio(env.SUPABASE_SERVICE_ROLE_KEY);
const smtpHost = limpio(env.SMTP_HOST);

// Secreto para el hash diario de visitantes. Si no se define se deriva de la service key
// (así es estable entre reinicios y no hay que configurar otra cosa).
const secretoVisitas =
  limpio(env.VISITAS_SECRET) || crypto.createHash('sha256').update(`visitas|${serviceKey || 'sin-clave'}`).digest('hex');

const config = {
  produccion,
  puerto,
  urlPublica,
  confiarProxy: booleano(env.TRUST_PROXY),
  clientDist: path.resolve(env.CLIENT_DIST || path.join(raiz, '..', 'client', 'dist')),
  zona: limpio(env.ZONA_HORARIA) || 'America/Argentina/Salta',
  secretoVisitas,
  sitio: {
    nombre: limpio(env.SITIO_NOMBRE) || 'Alejo Almada',
  },
  supabase: {
    url: supabaseUrl || 'http://localhost:54321',
    anonKey: anonKey || 'falta-SUPABASE_ANON_KEY',
    serviceKey: serviceKey || 'falta-SUPABASE_SERVICE_ROLE_KEY',
    configurado: supabaseUrl !== '' && anonKey !== '' && serviceKey !== '',
    bucket: limpio(env.SUPABASE_BUCKET) || 'portfolio',
  },
  // El proveedor Google se activa en el panel de Supabase (Authentication → Providers).
  // Esta bandera sólo decide si el sitio muestra el botón "Continuar con Google".
  google: booleano(env.GOOGLE_HABILITADO),
  correo: {
    host: smtpHost,
    puerto: entero(env.SMTP_PORT, 465),
    seguro: booleano(env.SMTP_SECURE, true),
    usuario: limpio(env.SMTP_USER),
    clave: limpio(env.SMTP_PASS),
    remitente: limpio(env.CORREO_REMITENTE) || 'Alejo Almada <no-reply@example.com>',
    destino: limpio(env.CORREO_DESTINO),
    responderA: limpio(env.CORREO_RESPONDER_A),
    // Sin servidor SMTP los correos no salen: se guardan y se muestran como "simulados"
    simulado: smtpHost === '',
  },
  github: {
    usuario: limpio(env.GITHUB_USUARIO),
    token: limpio(env.GITHUB_TOKEN),
  },
  clima: {
    ciudad: limpio(env.CLIMA_CIUDAD) || 'Salta, Argentina',
    latitud: decimal(env.CLIMA_LATITUD, -24.7821),
    longitud: decimal(env.CLIMA_LONGITUD, -65.4232),
  },

  /** Chequeos al arrancar el servidor. */
  validar() {
    if (!this.supabase.configurado) {
      console.error('✖ Faltan SUPABASE_URL, SUPABASE_ANON_KEY y/o SUPABASE_SERVICE_ROLE_KEY en server/.env (ver docs/SUPABASE.md).');
      process.exit(1);
    }
    if (produccion && !this.urlPublica.startsWith('https://')) {
      console.warn('⚠ PUBLIC_URL no es https://. Los links de los correos y el login con Google pueden fallar.');
    }
    if (this.correo.simulado) {
      console.warn('ℹ SMTP no está configurado (falta SMTP_HOST): los correos se simulan y no salen de este servidor.');
    } else if (!this.correo.destino) {
      console.warn('ℹ Falta CORREO_DESTINO: no se avisará por correo cuando llegue una consulta nueva.');
    }
  },
};

module.exports = config;
