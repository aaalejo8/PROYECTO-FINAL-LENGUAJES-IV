# Portfolio fullstack — Nicolás Herrera

Trabajo Práctico Integrador de **Lenguajes 4** · versión **Promoción** · grupo de 5.

**Integrantes**

- Sanchez Fadell, Francisco
- Cadima, Francisco
- Arraya, Joaquín
- Almada, Alejo
- Juárez, Agustín

Portfolio de un desarrollador fullstack (ficticio: *Nicolás Herrera*, reemplazable por datos reales) con:

- **Sitio público** oscuro y responsive: perfil, stack, servicios, experiencia, proyectos, actividad de GitHub, hora y clima, formulario de contacto (general, cotización, asesoría).
- **Proyectos y demos sólo para usuarios registrados** (Supabase Auth: email/contraseña o Google), bloqueado también en la base con RLS.
- **Panel del operador:** bandeja de consultas, filtros, seguimiento por estados con notas fechadas y respuesta real por correo.
- **Panel del administrador:** CRUD de proyectos, demos y servicios (con imágenes en Supabase Storage), gestión de usuarios (búsqueda, filtros, roles, activar/desactivar, contraseñas, baja), contadores reales de visitas y accesos autenticados, y gráficos interactivos con consultas parametrizadas (rango de fechas, agrupación y tipo de consulta).

| Capa | Tecnología |
|---|---|
| Cliente | React 19 · Vite 6 · **Tailwind CSS v4** · GSAP · Chart.js · lucide-react · `@supabase/supabase-js` |
| Servidor | Node.js ≥ 20.12 (sin Express) · `@supabase/supabase-js` · `nodemailer` |
| Backend de datos | **Supabase**: PostgreSQL 17 + Row Level Security · Auth · Storage |
| Integraciones | Google OAuth (vía Supabase) · SMTP (Gmail, Brevo…) · GitHub REST API · Open-Meteo |

> **Documentación:**
> [`docs/AUDITORIA.md`](docs/AUDITORIA.md) (auditoría, matriz de cumplimiento y checklist del PDF) ·
> [`docs/SUPABASE.md`](docs/SUPABASE.md) (**configuración paso a paso**) ·
> [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) (arquitectura, modelo de datos, RLS, plan para 5) ·
> [`docs/PRUEBAS.md`](docs/PRUEBAS.md) (qué se probó y cómo) ·
> [`docs/manual-de-marca`](docs/manual-de-marca/README.md) (colores, tipografía, layouts, capturas) ·
> [`docs/REQUISITOS-TP.md`](docs/REQUISITOS-TP.md) (cada requisito → dónde está y cómo demostrarlo) ·
> [`docs/PUBLICAR.md`](docs/PUBLICAR.md) (publicarlo en internet).

---

## Publicado

**https://proyecto-final-lenguajes-iv.vercel.app** (Vercel). Cada `git push` a `main` lo vuelve a publicar. Detalles en [`docs/PUBLICAR.md`](docs/PUBLICAR.md).

## Puesta en marcha (localhost)

Necesitás **Node.js 20.12 o más nuevo** y un proyecto de **Supabase** con las migraciones aplicadas
(ya hay uno creado: `portfolio-lenguajes4`; para configurarlo o crear otro seguí [`docs/SUPABASE.md`](docs/SUPABASE.md)).

1. En `server/.env` completá `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (si no existe, copialo de `server/.env.example`).
2. Después:

```bash
npm run preparar
```

```bash
npm run dev
```

Abrí **http://localhost:5173**. `npm run preparar` genera `client/.env` (sólo datos públicos), instala todo, comprueba la base, carga el contenido de ejemplo y crea los usuarios de prueba (`admin@example.com` / `operador@example.com`; las claves las imprime al final). **Cambiá esas claves antes de publicar** (`npm run admin:crear -- email "Nombre" "clave nueva"`). El panel está en `/panel`.

| Función | Sin configurar | Para activarla |
|---|---|---|
| Correo (contacto y respuestas) | **Se simula**: la consulta se guarda, el correo no sale, el panel marca la respuesta como simulada | `SMTP_*` y `CORREO_DESTINO` en `server/.env` → probar con `npm run correo:probar --prefix server -- tu@mail.com` |
| Registro con confirmación por email | El SMTP de Supabase sólo manda a miembros del equipo | Desactivar *Confirm email* o cargar SMTP propio en Supabase Auth ([`SUPABASE.md` §4.2](docs/SUPABASE.md)) |
| Login con Google | El botón no aparece | Proveedor Google en Supabase + `GOOGLE_HABILITADO=true` ([`SUPABASE.md` §4.4](docs/SUPABASE.md)) |
| Actividad de GitHub | La sección no aparece | `GITHUB_USUARIO` |

### Versión de producción en un solo puerto

```bash
npm run construir
```

```bash
npm run iniciar
```

El servidor entrega la API y el sitio en http://localhost:3000 (poné `PUBLIC_URL=http://localhost:3000` y agregá `http://localhost:3000/auth/callback` en las Redirect URLs de Supabase).

## Usuarios y roles

| Rol | Cómo se crea | Qué ve |
|---|---|---|
| **visitante** | Se registra solo en `/ingresar` (email o Google) | Sitio completo + detalle y demos de proyectos |
| **operador** | El admin desde *Panel → Usuarios*, o `npm run admin:crear -- email "Nombre" "clave" operador` | Lo anterior + *Panel → Consultas* |
| **admin** | `npm run admin:crear` (el primero) o desde el panel | Todo el panel |

## Cambiar el contenido

- **Proyectos, demos y servicios:** desde el panel de administración (sin tocar código).
- **Perfil, tecnologías y experiencia:** Supabase → *Table Editor* (`perfil_sitio`, `tecnologias`, `experiencia`), o editar `server/scripts/seed.js` y volver a cargar.
- **Colores y tipografías:** bloque `@theme` de `client/src/index.css` (y el manual de marca).

## Pruebas

```bash
npm test
```

30 pruebas que **no necesitan internet**: 14 unitarias (validación, límites, plantillas de correo, errores de Supabase, imágenes, parámetros de métricas) y 16 de base de datos que ejecutan **las migraciones reales** en un PostgreSQL local (PGlite) y verifican RLS por rol, triggers, restricciones, deduplicación de visitas y accesos, y las consultas de métricas. Las pruebas de integración contra Supabase real (`npm run test:integracion`) están explicadas en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Estructura

```
client/      React + Tailwind (src/secciones, src/paginas, src/panel, src/componentes, src/supabase.js)
server/      API Node.js (src/), scripts (scripts/), pruebas (test/)
supabase/    migrations/ (6 migraciones SQL, en orden) · seed.sql
scripts/     preparar.js (arma todo con un comando) · dev.js (enciende servidor y sitio)
deploy/      Caddyfile · portfolio.service
docs/        auditoría, Supabase, arquitectura, pruebas, manual de marca, requisitos, publicación
_legado-postgres/   versión anterior con PostgreSQL propio (archivada; se puede borrar)
```

## Origen del código

La infraestructura del servidor (router HTTP, validación, límites de uso, cabeceras de seguridad, scripts) y partes del cliente (navegación, ventanas, sistema de formularios y estructura de paneles) **se tomaron de otro proyecto del mismo autor del repositorio, *Yarade Repuestos***. No se incluyó nada propio de ese negocio. La migración a Supabase (Auth, RLS, Storage, funciones de métricas), el modelo de datos, roles, consultas y seguimiento, métricas, correo, APIs externas, manual de marca, secciones, animaciones y gráficos son de este trabajo. Avísenlo a la cátedra: es la forma honesta y evita malentendidos.
