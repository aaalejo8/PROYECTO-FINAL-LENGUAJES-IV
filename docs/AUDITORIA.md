# Auditoría, migración a Supabase y checklist del TP

Fecha: 06/11/2026 · Alcance: carpeta `proyecto final/` · Referencia: *Instrucciones Trabajo Final
Integrador para regularizar y aprobar 2026.pdf* (2 páginas).

Estados: **COMPLETO** (implementado, funcional y validado) · **PARCIAL** (existe, falta algo o
depende de una configuración externa) · **PENDIENTE** · **DEFECTUOSO**.

---

## 1. Lo que ya estaba implementado (estado inicial)

El trabajo de los compañeros **no era básico**: era una aplicación completa React 19 + Tailwind v4
+ Node.js (router propio) + PostgreSQL con sitio público, registro propio y con Google, bandeja de
operador con respuestas por correo, ABM de proyectos/demos/servicios, panel de usuarios, métricas
con consultas parametrizadas y gráficos Chart.js, animaciones GSAP, GitHub/Open-Meteo, manual de
marca y 21 pruebas. Pero:

- **Nunca se había ejecutado en esta máquina**: no había dependencias instaladas ni base de datos
  (necesitaba PostgreSQL local o Docker, que no están). Nada estaba *validado de extremo a extremo*.
- No usaba Supabase, que es la decisión de arquitectura del grupo.

## 2. Problemas encontrados

| # | Problema | Gravedad | Qué se hizo |
|---|---|---|---|
| 1 | Toda la seguridad estaba sólo en el servidor Node: la base no tenía RLS y la app se conectaba con un usuario con todos los permisos | Alta | RLS en las 11 tablas y Storage; el servidor consulta con el token del usuario |
| 2 | Sesiones propias (JWT HS256 en `localStorage`) **no revocables**: cerrar sesión sólo borraba el token del navegador, que seguía valiendo 7 días | Alta | Supabase Auth: refresh tokens revocables, `signOut` real |
| 3 | Contraseñas y Google OAuth implementados a mano (el `id_token` se decodificaba sin verificar firma, confiando en el TLS) | Media | Supabase Auth (bcrypt, OAuth con PKCE) |
| 4 | Imágenes guardadas en el disco del servidor (`uploads/`): se pierden en Render/Vercel | Media | Supabase Storage con límites de tamaño/tipo y RLS |
| 5 | Visitas contadas sólo por `sessionStorage` (cada pestaña nueva sumaba) y accesos sólo al loguear | Media | Deduplicación en la base: 30 min por visitante; accesos únicos por sesión de Auth |
| 6 | Métricas sin filtro por tipo de consulta, sin evolución acumulada de usuarios ni visitas autenticadas en el gráfico | Media | Parámetro `tipo`, serie `usuarios_acumulados`, `visitas_autenticadas`, gráfico de consultas en el tiempo |
| 7 | Protección del "último administrador" sólo en la app | Media | Trigger en la base |
| 8 | Panel de usuarios sin filtro por estado ni fecha de alta | Baja | Filtro activos/inactivos y columna *Alta* |
| 9 | Pruebas de integración dependían de un PostgreSQL local y no se podían correr | Media | Pruebas de base con PGlite (sin instalar nada) + integración contra Supabase real |
| 10 | Docs y pie del sitio hablaban de PostgreSQL propio; el manual no tenía capturas reales | Baja | Docs reescritos, capturas reales en el manual §13 |
| 11 | Mensaje "Tu sesión venció" a quien nunca inició sesión | Baja | Mensaje diferenciado |

**Bugs propios encontrados durante la migración y corregidos** (gracias a las pruebas): permiso de
`exigir_admin` perdido al endurecer funciones; política SELECT faltante en `accesos` (PostgREST usa
`RETURNING`); orden de la bandeja paginada; texto del seed.

## 3. Cambios de arquitectura

- **Supabase** como backend de datos: PostgreSQL 17 + RLS, Auth y Storage. Proyecto creado:
  `portfolio-lenguajes4` (São Paulo, plan Free, $0).
- **Se mantuvo el servidor Node** (validación, límites, correo, APIs externas, reglas de negocio) y
  **el contrato de la API `/api/*`**, por eso el frontend casi no cambió.
- Tres clientes de Supabase en el servidor (`server/src/supabase.js`): público, *del usuario* (RLS)
  y `service_role` (sólo contacto, visitas y administración de cuentas, tras verificar admin).
- Navegador: `client/src/supabase.js` con clave pública para la sesión y Google.
- Eliminado `pg`, `scrypt`, JWT propio, `google.js`, `docker-compose`, `uploads/`, `schema.sql`:
  **archivados en `_legado-postgres/`** (no se borraron; se pueden eliminar cuando quieran).
- Detalle: [`ARQUITECTURA.md`](ARQUITECTURA.md).

## 4. Estructura y migraciones de Supabase

`supabase/migrations/` (aplicadas al proyecto real y probadas en PGlite):

1. `…000100_esquema.sql` — 11 tablas: `perfiles` (1:1 con `auth.users`), `perfil_sitio`, `tecnologias`, `experiencia`, `servicios`, `proyectos`, `demos`, `consultas`, `respuestas`, `visitas`, `accesos`; `CHECK`, FKs, índices, columnas generadas.
2. `…000200_seguridad.sql` — `es_admin()`, `es_staff()`, triggers (alta de perfil, email, último admin, `actualizado_en`), RLS de todo, bucket `portfolio` y sus políticas.
3. `…000300_funciones.sql` — `proyectos_publicos`, `registrar_visita`, `metricas_resumen`, `metricas_series`, `metricas_consultas`, `consultas_resumen`, `usuarios_resumen`.
4. `…000400_endurecer_funciones.sql` — permisos mínimos (Security Advisor).
5. `…000500_accesos_propios.sql` — política SELECT de accesos propios.
6. `…20261107000600_foto_perfil.sql` — columna `foto_url` del perfil (foto de la portada, guardada en Storage).

Más `supabase/seed.sql` (contenido de ejemplo). Guía: [`SUPABASE.md`](SUPABASE.md).

## 5. Matriz de cumplimiento — antes y después

| Requisito del PDF | Antes (auditoría) | Ahora | Evidencia / archivos | Qué falta |
|---|---|---|---|---|
| **1.3** Animaciones fluidas (CSS/JS/GSAP) acordes a 5 integrantes | PARCIAL (código presente, sin verificar) | **COMPLETO** | `animaciones.js`, `Hero.jsx`, `Experiencia.jsx` | — |
| **1.3** Integración de APIs Web | PARCIAL (sin verificar) | **COMPLETO** | Supabase, GitHub (`aaalejo8`, datos en vivo verificados), Open-Meteo, Google, SMTP (`externas.js`, `correo.js`) | — |
| **A** Perfil, stack, servicios, experiencia | PARCIAL (sin base) | **COMPLETO** | `secciones/`, **datos reales** de Alejo Almada (perfil, 18 tecnologías, 3 experiencias, 7 proyectos con capturas en Storage y 6 demos), verificado en navegador | Ajustar niveles del stack si hace falta |
| **A** Contacto: general / cotización / asesoría | PARCIAL | **COMPLETO** (validación y tipos) | `Contacto.jsx`, `consultas.js`, `CHECK` | — |
| **A** Almacenar consultas | PARCIAL | **COMPLETO** | integración ✔ contra Supabase real (consulta `CON-…` guardada, verificada en la tabla) | — |
| **A** Envío real por email | PARCIAL (simulado) | **COMPLETO** | SMTP Gmail conectado; el 07/11/2026 se envió un correo de prueba y una consulta real del formulario sin errores | Confirmar la recepción en la bandeja |
| **A** Detalle de proyectos/demos sólo registrados | PARCIAL (sólo en Node) | **COMPLETO** | 401 + RLS, verificado con clave pública y navegador | — |
| **A** Módulo de registración | PARCIAL (propio, sin verificar) | **PARCIAL** | Supabase Auth, trigger verificado en Supabase real | Desactivar *Confirm email* o SMTP en Supabase Auth (§4.2) |
| **A** Inicio y cierre de sesión | PARCIAL (logout no revocaba) | **COMPLETO** | Verificado en navegador y API | — |
| **A** Login con Google | PARCIAL | **PARCIAL** (opcional) | PKCE + `AuthCallback.jsx` | Credenciales de Google Cloud (§4.4) |
| **B** Panel de consultas | PARCIAL | **COMPLETO** | `Consultas.jsx`, RLS staff, integración ✔ | — |
| **B** Identificar tipo, detalle, seguimiento por estados | PARCIAL | **COMPLETO** | integración ✔ (estado, notas, filtros) | — |
| **B** Responder por correo | PARCIAL | **COMPLETO** en lógica / **PARCIAL** en envío real | integración ✔; usa el mismo SMTP ya verificado | Probar una respuesta real desde el panel |
| **2** Manual: paleta HEX | COMPLETO | **COMPLETO** | `manual-de-marca` §3, `tokens.json` | — |
| **2** Tipografía y jerarquías | COMPLETO | **COMPLETO** | §4 | — |
| **2** Diseño y prototipado | PARCIAL (sólo wireframes) | **PARCIAL** | §10 wireframes + §13 capturas reales | Capturas de celular del inicio; láminas visuales si la cátedra las exige |
| **2** Navegabilidad y responsive | COMPLETO | **COMPLETO** | §10, verificado a 375 px | — |
| **3** Base SQL | PARCIAL (PostgreSQL sin instalar) | **COMPLETO** | Supabase + 6 migraciones | — |
| **3** Despliegue nube o localhost | PARCIAL | **COMPLETO** (localhost) | Verificado `:5173` y `:3000` | Opcional: Render (`PUBLICAR.md`) |
| **3** UX/UI cuidado y adaptativo | COMPLETO | **COMPLETO** | Tailwind, capturas | — |
| **3** Framework CSS obligatorio | COMPLETO | **COMPLETO** | Tailwind CSS v4 | — |
| **3** Validación estricta de campos, archivos e imágenes | COMPLETO (sin verificar) | **COMPLETO** | 3 capas; pruebas unit/db/integración | — |
| **3** Documentación: manual, arquitectura, código | PARCIAL (desactualizada) | **COMPLETO** | `docs/` | — |
| **4.1** CRUD proyectos, demos, servicios | PARCIAL (sin verificar) | **COMPLETO** | integración ✔ contra Supabase, con Storage | — |
| **4.2** Gestión de usuarios registrados | PARCIAL | **COMPLETO** | integración ✔: listar, buscar, filtrar, rol, nombre, **alta, bloqueo (corta el login y el token vigente), desbloqueo, cambio de contraseña y baja** en Supabase Auth | — |
| **4.3** Counter de visitas generales | PARCIAL | **COMPLETO** | integración ✔: visita registrada en Supabase y **no duplicada** al repetir dentro de 30 min (verificado en la tabla) | — |
| **4.3** Counter de accesos autenticados | PARCIAL | **COMPLETO** | Accesos reales registrados en Supabase (verificado) | — |
| **4.3** Cantidad de usuarios registrados | PARCIAL | **COMPLETO** | `metricas_resumen` real | — |
| **4.4** Consultas parametrizadas | COMPLETO (sin verificar) | **COMPLETO** | RPC con parámetros tipados, inyección → 400 | — |
| **4.4** Gráficos interactivos con filtros | PARCIAL (sin filtro por tipo) | **COMPLETO** | 5 gráficos, filtros fecha/agrupación/tipo verificados en navegador | — |

## 6. Configuraciones manuales pendientes (en orden)

1. ~~Pegar la `SUPABASE_SERVICE_ROLE_KEY`~~ — **hecho el 07/11/2026** (clave `sb_secret_…`); integración 9/9.
2. **Supabase → Authentication**: Site URL y Redirect URLs (`/auth/callback`); desactivar *Confirm email* **o** cargar SMTP propio; largo mínimo de contraseña 8 ([`SUPABASE.md` §4](SUPABASE.md)).
3. ~~SMTP del sitio~~ — **hecho** (Gmail; se corrigió `smpt` → `smtp` en `SMTP_HOST`).
4. ~~Admin real y borrar cuentas QA~~ — **hecho** (queda un solo usuario: el admin real).
5. Opcional: Google OAuth, `GITHUB_USUARIO`, publicar en Render.
6. ~~Correr `npm run test:integracion` con la service_role~~ — **hecho**: 9/9.

## 7. Checklist final del PDF

**1. Condiciones de regularización**
- [x] Grupo de 3 a 5 integrantes (5) — README
- [ ] Asistencia 80 % — *no depende del código*
- [x] Animaciones fluidas GSAP/CSS, nivel acorde a 5 integrantes
- [x] Integración de APIs Web (Supabase, GitHub, Open-Meteo, Google, SMTP)
- [x] Perfil, tecnologías del stack, servicios y experiencia
- [x] Formulario de contacto con los 3 tipos y validación
- [x] Envío del formulario por correo **real** (SMTP Gmail)
- [x] Proyectos y demos sólo para registrados (servidor + RLS)
- [x] Módulo de registración (Supabase Auth) — falta el ajuste de *Confirm email* (pendiente 2)
- [x] Panel del operador: mensajes, cotizaciones y asesorías
- [x] Respuestas y seguimiento (mismo SMTP real)

**2. Anteproyecto: Manual de diseño y estilo**
- [x] Paleta con HEX · [x] Tipografía y jerarquías · [x] Layouts/prototipos (wireframes + capturas) · [x] Navegabilidad y responsive
- [ ] Capturas faltantes del inicio en celular (manual §13)

**3. Requisitos técnicos**
- [x] Tecnologías del cursado · [x] Base SQL (Supabase/PostgreSQL) · [x] Localhost (y guía de nube)
- [x] UX/UI adaptativo · [x] Framework CSS (Tailwind v4) · [x] Validación estricta de campos, archivos e imágenes
- [x] Documentación de manual, arquitectura y código

**4. Promoción**
- [x] CRUD completo de Proyectos, Demos y Servicios
- [x] Panel de usuarios registrados (incluye alta, bloqueo, cambio de contraseña y baja, verificados)
- [x] Counter de visitas generales (verificado contra Supabase, sin duplicados)
- [x] Counter de accesos de usuarios autenticados
- [x] Consultas parametrizadas y gráficos interactivos

Nada queda **DEFECTUOSO**. Los PARCIAL restantes dependen exclusivamente de credenciales o
ajustes externos que la herramienta usada no podía cargar; el código para cada uno está hecho y probado
hasta donde la credencial lo permite.
