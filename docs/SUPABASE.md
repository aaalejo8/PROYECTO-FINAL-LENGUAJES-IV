# Configuración de Supabase — paso a paso

Esta guía sirve para dos casos:

- **A. Usar el proyecto que ya está creado**: `portfolio-lenguajes4` (región São Paulo, plan Free),
  en la organización de Alejo. Ya tiene las 6 migraciones aplicadas, el bucket de imágenes y el
  contenido de ejemplo. Saltá al **paso 3**.
- **B. Crear uno nuevo desde cero** (por ejemplo, en la cuenta de otro integrante): seguí todo.

Tiempo estimado: 20–30 minutos. No hace falta instalar nada además de Node.js 20.12+.

---

## 1. Crear el proyecto (sólo caso B)

1. Entrá a <https://supabase.com> → **Sign in** (con GitHub es lo más rápido).
2. **New project** → elegí la organización → completá:
   - **Name:** `portfolio-lenguajes4`
   - **Database Password:** generá una y guardala (no la usa la app, pero la pide Supabase).
   - **Region:** *South America (São Paulo)*.
   - Plan **Free**. El plan gratis permite **2 proyectos activos por organización**; si ya tenés 2,
     pausá uno viejo o creá el proyecto en otra cuenta.
3. Esperá 1–2 minutos a que diga *Project is ready*.

## 2. Crear las tablas: aplicar las migraciones (sólo caso B)

Las migraciones están en `supabase/migrations/` y **se aplican en orden** (el número del nombre):

| Archivo | Qué hace |
|---|---|
| `20261106000100_esquema.sql` | Las 11 tablas, restricciones `CHECK`, índices y columnas generadas |
| `20261106000200_seguridad.sql` | Funciones de rol, triggers (alta de perfil, protección del último admin), **RLS** de todas las tablas, bucket `portfolio` y sus políticas |
| `20261106000300_funciones.sql` | Funciones RPC: tarjetas públicas, contador de visitas y **consultas parametrizadas de métricas** |
| `20261106000400_endurecer_funciones.sql` | Quita permisos de ejecución sobrantes (recomendación del Security Advisor) |
| `20261106000500_accesos_propios.sql` | Política para que cada usuario registre/lea sus accesos |
| `20261107000600_foto_perfil.sql` | Columna `foto_url` del perfil (la foto de la portada) |

**Opción 1 — SQL Editor (sin instalar nada):**

1. Panel de Supabase → **SQL Editor** → **New query**.
2. Abrí `20261106000100_esquema.sql` en VS Code, copiá TODO, pegalo y tocá **Run**. Tiene que decir *Success*.
3. Repetí con el 200, el 300, el 400 y el 500, **en ese orden**.
4. Para el contenido de ejemplo: pegá y ejecutá `supabase/seed.sql`
   (o, después del paso 4, corré `npm run db:seed --prefix server`).

**Opción 2 — Supabase CLI:**

```bash
npx supabase login
```

```bash
npx supabase link --project-ref TU_PROJECT_REF
```

```bash
npx supabase db push
```

Las migraciones son **idempotentes**: si se corren dos veces no rompen ni borran datos.

Comprobación: **Table Editor** muestra `perfiles, perfil_sitio, tecnologias, experiencia, servicios,
proyectos, demos, consultas, respuestas, visitas, accesos`, todas con el candado de **RLS enabled**.
En **Storage** aparece el bucket `portfolio` (público). En **Advisors → Security Advisor** sólo
quedan 3 avisos sobre `es_admin`, `es_staff` y `proyectos_publicos`: son públicas **a propósito**
(explicado al principio de la migración 400).

## 3. Copiar las claves

Panel → **Project Settings** (engranaje) → **API Keys** (o **Data API** en versiones viejas):

| Dato | Dónde va | ¿Es secreto? |
|---|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `server/.env` → `SUPABASE_URL` y `client/.env` → `VITE_SUPABASE_URL` | No |
| **Publishable key** (`sb_publishable_…`) o **anon** (legacy) | `server/.env` → `SUPABASE_ANON_KEY` y `client/.env` → `VITE_SUPABASE_ANON_KEY` | No (la protege RLS) |
| **Secret key** (`sb_secret_…`) o **service_role** (legacy) | **sólo** `server/.env` → `SUPABASE_SERVICE_ROLE_KEY` | **SÍ. Nunca en el cliente ni en Git** |

> Para el proyecto ya creado, `server/.env` y `client/.env` **ya tienen la URL y la clave pública**.
> Lo único que falta es pegar la **secret/service_role** en `SUPABASE_SERVICE_ROLE_KEY`
> (la herramienta con la que se armó el proyecto no puede leer claves secretas).
> Sin ella: el formulario de contacto, el contador de visitas y crear/bloquear/borrar cuentas
> devuelven error; todo lo demás funciona.

Si no existen los archivos: `cp server/.env.example server/.env`, completalo, y `npm run preparar`
genera `client/.env` solo.

## 4. Configurar Authentication (importante para que el registro funcione)

Panel → **Authentication**:

### 4.1 URL Configuration
- **Site URL:** `http://localhost:5173` (en producción, la URL real con `https`).
- **Redirect URLs** → agregá:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `https://TU-DOMINIO/auth/callback` (cuando publiquen)

### 4.2 Email (confirmación de cuentas) — elegí UNA opción
El servidor de correo que trae Supabase **sólo envía a direcciones del equipo de la organización**
(por eso, en las pruebas, registrarse con cualquier otro email da `email_address_invalid`).

- **Opción recomendada para la demo:** **Sign In / Providers → Email** → desactivar
  **Confirm email**. El registro entra directo (el sitio ya lo maneja).
- **Opción "producción":** **Authentication → Emails → SMTP Settings** → **Enable custom SMTP** y
  cargar los mismos datos SMTP que el servidor (Gmail con contraseña de aplicación, Brevo, etc.).
  Con eso Supabase manda el mail de confirmación y la pantalla de registro muestra
  "Te enviamos un correo…". El link vuelve a `/auth/callback` y la cuenta queda iniciada.

### 4.3 Contraseñas
**Sign In / Providers → Email → Minimum password length: 8** (igual que la validación del sitio).

### 4.4 Google (opcional, suma para la demo)
1. <https://console.cloud.google.com/apis/credentials> → **Crear credenciales → ID de cliente de OAuth → Aplicación web**.
2. **URI de redireccionamiento autorizado:** `https://TU-PROJECT-REF.supabase.co/auth/v1/callback`
   (el que muestra Supabase en Providers → Google → *Callback URL*).
3. Copiá *Client ID* y *Client secret* en Supabase → **Authentication → Sign In / Providers → Google** → **Enable**.
4. En `server/.env` poné `GOOGLE_HABILITADO=true` (muestra el botón "Continuar con Google").

## 5. Crear el primer administrador

Con la `SUPABASE_SERVICE_ROLE_KEY` ya cargada:

```bash
npm run admin:crear -- tu-email@gmail.com "Tu Nombre"
```

Pide la contraseña por pantalla (mínimo 8). Para un operador:

```bash
npm run admin:crear -- operador@gmail.com "Nombre" "contraseña-larga" operador
```

A partir de ahí, el resto de los usuarios y roles se gestionan desde **/panel → Usuarios**.
Alternativa sin consola: registrate en el sitio y en **SQL Editor** ejecutá
`update public.perfiles set rol = 'admin' where email = 'tu-email@gmail.com';`

## 6. Correo real del sitio (formulario y respuestas)

Completá en `server/.env` `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
`CORREO_REMITENTE` y `CORREO_DESTINO` (ver ejemplos en `.env.example`). Probalo:

```bash
npm run correo:probar --prefix server -- tu-email@gmail.com
```

## 7. Encender todo

```bash
npm run preparar
```

```bash
npm run dev
```

Abrí <http://localhost:5173>. El panel está en `/panel`.

## 8. Comprobar que todo funciona

```bash
npm test
```

(30 pruebas: validaciones, migraciones y RLS en un PostgreSQL local; no usan internet.)
Y contra Supabase real, con el servidor encendido, ver `docs/PRUEBAS.md` → *Integración*.

## 9. Datos de prueba que quedaron en el proyecto ya creado

Durante las pruebas se crearon, a propósito, cuentas y datos de **QA** (todos con
`@portfolio-qa.dev`): `qa-admin`, `qa-operador`, `qa-visitante`, dos consultas `CON-QATEST01/02`
y sus accesos. La contraseña de esas cuentas está anotada en un comentario de `server/.env`.
Antes de la exposición, **cuando ya tengan su propio admin**, bórrenlos para que las métricas
muestren sólo datos reales:

```sql
-- SQL Editor de Supabase
delete from public.consultas where email like '%@portfolio-qa.dev';
delete from auth.users where email like '%@portfolio-qa.dev';   -- borra perfiles y accesos en cascada
```

(Si alguno de esos usuarios es el único admin, el trigger lo impide: creen el suyo primero.)

## 10. Variables de entorno (resumen)

| Variable | Archivo | Obligatoria | Para qué |
|---|---|---|---|
| `SUPABASE_URL` | server | Sí | URL del proyecto |
| `SUPABASE_ANON_KEY` | server | Sí | Clave pública (validar tokens, leer contenido público) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Sí | Contacto, visitas y administración de cuentas |
| `SUPABASE_BUCKET` | server | No (`portfolio`) | Bucket de imágenes |
| `PUBLIC_URL` | server | Sí en producción | Links de los correos y redirección de confirmación |
| `GOOGLE_HABILITADO` | server | No | Mostrar el botón de Google |
| `SMTP_*`, `CORREO_*` | server | Para correo real | Envío de correos |
| `ZONA_HORARIA` | server | No | Agrupar métricas por día local |
| `VISITAS_SECRET` | server | No | Secreto del hash de visitantes |
| `GITHUB_USUARIO`, `GITHUB_TOKEN`, `CLIMA_*` | server | No | APIs externas |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | Sí | Sesión y login con Google en el navegador |
