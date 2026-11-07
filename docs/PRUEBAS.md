# Pruebas y validación

Ejecutadas el **06/11/2026**; integración completa re-ejecutada el **07/11/2026** con la `service_role`. Todo lo marcado ✔ se ejecutó de verdad; lo marcado ⏳ quedó
pendiente y se explica qué lo bloquea.

## 1. Pruebas automáticas locales — `npm test` (30/30 ✔)

No necesitan internet ni credenciales.

| Archivo | Qué prueba | Resultado |
|---|---|---|
| `server/test/unit.test.js` (14) | Validaciones (texto, email, URL, slug, listas, fechas, contraseñas), límites de uso y bloqueo por fallos, lectura del `session_id` del token, traducción de errores de Supabase a HTTP, reconocimiento de URLs del bucket, **escape HTML en las plantillas de correo**, firma de imágenes por primeros bytes, parámetros de métricas | ✔ 14/14 |
| `server/test/db.test.js` (16) | Ejecuta **las migraciones reales** de `supabase/migrations/` en PostgreSQL local (PGlite) con una imitación mínima de Supabase (roles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`, Storage) y verifica, actuando como cada rol: trigger de alta (ignora un rol inyectado), RLS de perfiles, contenido, proyectos/demos (anónimo ve sólo tarjetas), CRUD sólo admin, restricciones `CHECK`, consultas sólo staff, respuestas firmadas por su autor, búsqueda sin acentos, visitas sin duplicar en 30 min, accesos únicos por sesión, métricas sólo admin con validación de parámetros e inyección SQL, Storage sólo admin, migraciones re-ejecutables y `seed.sql` | ✔ 16/16 |

**Bug encontrado y corregido gracias a estas pruebas:** al endurecer permisos (migración 400) los
usuarios autenticados perdían el permiso de ejecutar `exigir_admin()`, y las métricas fallaban.

## 2. Pruebas contra Supabase real (proyecto `portfolio-lenguajes4`)

### 2.1 RLS con la clave pública, directo contra la API de Supabase (✔ 8/8)

Simula a alguien que se saltea nuestro servidor y usa la clave pública que está en el navegador:

| Intento | Resultado |
|---|---|
| Leer `proyectos` / `demos` | `[]` ✔ |
| Llamar `proyectos_publicos()` | 4 tarjetas **sin** `descripcion` ✔ |
| Leer `servicios` | sólo los activos ✔ |
| Insertar una consulta | `violates row-level security policy` ✔ |
| Llamar `registrar_visita` / `metricas_resumen` | `permission denied` ✔ |
| Leer `perfiles` | `[]` ✔ |

### 2.2 API HTTP de extremo a extremo — `npm run test:integracion` (✔ 9/9)

Servidor encendido contra Supabase real, con cuentas QA de los 3 roles:

| Prueba | Resultado |
|---|---|
| Portada sin detalle; `/api/proyectos/:slug` 401 sin sesión y con token falso; 200 con sesión | ✔ |
| Login inválido 401, validaciones 400, `/yo`, aviso de acceso idempotente | ✔ |
| Visitante: 403 en bandeja, métricas, usuarios y contenido. Operador: bandeja sí, métricas/usuarios/proyectos 403 | ✔ |
| CRUD completo de servicios (incl. ocultar), proyectos (slug repetido 409) y demos (URL `javascript:` 400); **subida real a Supabase Storage** (PNG válido 201, archivo disfrazado 400, visitante 403); imagen huérfana borrada del bucket (verificado en `storage.objects`) | ✔ |
| Bandeja: filtrar por tipo y código, cambiar estado (nota fechada), estado inválido 400, notas, **responder** (correo simulado, estado *Respondida*, historial) | ✔ |
| Métricas: contadores reales, series por semana filtradas por tipo con acumulado, consultas por tipo filtradas, inyección SQL en fecha 400, rango invertido 400 | ✔ |
| Usuarios: búsqueda + filtro por rol, no puede degradarse ni borrarse a sí mismo (409), id inválido 400, detalle con últimos accesos | ✔ |
| Usuarios: **alta** (operador 403, email repetido 409), login de la cuenta nueva, **bloqueo** (no puede ingresar y su token vigente pasa a 401), **desbloqueo + cambio de contraseña** (la vieja falla, la nueva entra), **baja** (no puede ingresar, detalle 404). La cuenta se borra siempre al final | ✔ |
| Contacto (tipo inválido 400, consulta guardada con código `CON-…`) y visitas (204). Verificado en la base: la consulta existe y una segunda corrida a los 54 s **no** sumó otra visita (deduplicación de 30 min) | ✔ |

**Bug encontrado y corregido:** PostgREST inserta con `RETURNING`, que exige una política SELECT;
registrar el propio acceso fallaba en Supabase (no en PGlite). Se agregó la migración 500.

### 2.3 Navegador (✔)

Con Vite + servidor contra Supabase real:

- Portada carga perfil, stack, servicios, experiencia y tarjetas desde Supabase ✔
- `/proyectos/gestor-de-turnos` sin sesión → puerta de registro ✔
- Login del admin desde `/ingresar?volver=/panel` → redirige al panel ✔
- Métricas: contadores reales; al cambiar *Tipo de consulta* se re-ejecutan las dos consultas parametrizadas con `tipo=cotizacion` y se actualizan los gráficos ✔
- Panel de usuarios en **375 px**: pestañas desplazables, tabla con scroll horizontal ✔
- Cerrar sesión: vuelve al inicio, borra la sesión guardada y muestra "Ingresar" ✔
- Modo producción (un puerto): sitio y API en `:3000`, CSP con `connect-src` limitado a Supabase ✔
- No hay ninguna clave privada en `client/dist` ✔

## 3. Lo que NO se pudo verificar y por qué

| Pendiente | Qué lo bloquea | Cómo cerrarlo |
|---|---|---|
| Envío **real** de correos | No hay SMTP configurado (se probó el modo simulado) | Completar `SMTP_*` → `npm run correo:probar --prefix server -- tu@mail.com` |
| Registro desde el sitio | Supabase rechaza emails ajenos al equipo con su SMTP por defecto (`email_address_invalid`) | `docs/SUPABASE.md` §4.2 (desactivar *Confirm email* o SMTP propio) |
| Login con Google | Faltan credenciales de Google Cloud | `docs/SUPABASE.md` §4.4 |
| Capturas del hero en celular | El panel del navegador usado estaba oculto y no dibuja animaciones | Sacarlas a mano (manual de marca §13) |

## 4. Cómo correr la integración

Con el servidor encendido (`npm run dev:servidor`) y cuentas de prueba de cada rol:

```bash
TEST_API=http://localhost:3000 TEST_ADMIN=qa-admin@portfolio-qa.dev TEST_OPERADOR=qa-operador@portfolio-qa.dev TEST_VISITANTE=qa-visitante@portfolio-qa.dev TEST_PASSWORD='(ver comentario en server/.env)' npm run test:integracion
```

En PowerShell: `$env:TEST_API="http://localhost:3000"; $env:TEST_ADMIN="..."; ...; npm run test:integracion`.
