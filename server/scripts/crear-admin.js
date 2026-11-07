'use strict';
/**
 * Crea (o actualiza la contraseña y el rol de) un usuario del equipo en Supabase Auth.
 * Hace falta para el PRIMER administrador: después se gestionan todos desde el panel.
 *
 *   npm run admin:crear
 *   npm run admin:crear -- admin@mail.com "Nombre Apellido"
 *   npm run admin:crear -- operador@mail.com "Nombre Apellido" "contraseña-larga" operador
 *
 * Si no pasás la contraseña como tercer argumento, la pide por pantalla. El cuarto argumento es el rol:
 * "admin" (por defecto) u "operador". Usa SUPABASE_SERVICE_ROLE_KEY de server/.env.
 * Con CREAR_SIN_PISAR=1 un usuario que ya existe se deja como está.
 */
const readline = require('readline');
const { admin } = require('../src/supabase');

function preguntar(texto, { oculto = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (cadena) => {
        if (cadena.includes(texto)) rl.output.write(cadena);
        else if (cadena.includes('\n') || cadena.includes('\r')) rl.output.write('\n');
      };
    }
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

async function main() {
  const [, , emailArg, nombreArg, passwordArg, rolArg] = process.argv;
  const email = (emailArg || (await preguntar('Email: '))).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('El email no es válido.');
  const nombre = nombreArg || (await preguntar('Nombre: ')) || 'Administrador';
  const password = passwordArg || (await preguntar('Contraseña (mínimo 8 caracteres): ', { oculto: true }));
  if (password.length < 8) throw new Error('La contraseña tiene que tener al menos 8 caracteres.');
  const rol = rolArg || 'admin';
  if (!['admin', 'operador'].includes(rol)) throw new Error('El rol tiene que ser "admin" u "operador".');

  const { data: existente, error: errorBusqueda } = await admin.from('perfiles').select('id').ilike('email', email).maybeSingle();
  if (errorBusqueda) throw new Error(`${errorBusqueda.message} (¿aplicaste las migraciones de supabase/migrations?)`);

  let id;
  if (existente) {
    if (process.env.CREAR_SIN_PISAR === '1') {
      console.log(`✔ Ya existía ${email}: lo dejé como estaba.`);
      return;
    }
    id = existente.id;
    const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true, ban_duration: 'none' });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
    if (error) throw new Error(error.message);
    id = data.user.id;
  }

  // service_role: puede asignar el rol aunque todavía no exista ningún admin
  const { error } = await admin.from('perfiles').update({ rol, nombre, activo: true }).eq('id', id);
  if (error) throw new Error(error.message);
  console.log(existente ? `✔ Ya existía: se actualizó la contraseña y el rol (${rol}) de ${email}` : `✔ Usuario creado (${rol}): ${email}`);
}

main().catch((error) => {
  console.error('✖ Error:', error.message);
  process.exitCode = 1;
});
