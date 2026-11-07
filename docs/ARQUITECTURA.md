# Arquitectura y plan de trabajo

## 1. Vista general

```
 Navegador (React 19 + Tailwind v4 + GSAP + Chart.js + supabase-js con clave PÚBLICA)
   │  ① /api/*  JSON + "Authorization: Bearer <access token de Supabase>"
   │  ② Supabase Auth directo: renovar sesión, cerrar sesión, login con Google (PKCE)
   ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ Servidor Node.js (router propio, sin Express)                          │
 │  http.js        router, CSP, límites de tamaño, sitio compilado        │
 │  permisos.js    valida el token con Supabase Auth, lee rol y estado    │
 │  supabase.js    3 clientes: público · del usuario (RLS) · service_role │
 │  rutas/         publico · auth · proyectos · admin-*                   │
 │  validar.js     validación estricta de TODO lo que entra               │
 │  consultas.js · metricas.js · imagenes.js · correo.js · externas.js    │
 └──────┬───────────────────────┬─────────────────┬──────────────┬───────┘
        │ HTTPS (supabase-js)   │ SMTP            │ HTTPS        │ HTTPS
        ▼                       ▼                 ▼              ▼
 ┌─────────────── Supabase ───────────────┐  Gmail/Brevo…   GitHub REST · Open-Meteo
 │ Auth (usuarios, contraseñas, Google)   │                 (cacheadas 15–30 min)
 │ PostgreSQL 17 + Row Level Security     │
 │   11 tablas · triggers · funciones RPC │
 │ Storage (bucket "portfolio", imágenes) │
 └────────────────────────────────────────┘
```

- **Supabase es el backend de datos**: base PostgreSQL administrada, autenticación y almacenamiento de archivos. Ya no hay PostgreSQL propio, ni `pg`, ni contraseñas/tokens hechos a mano (lo viejo quedó archivado en `_legado-postgres/`).
- **El servidor Node se mantiene** porque aporta lo que Supabase no hace solo: validación con mensajes claros, límites de envío anti-abuso, el envío de correos SMTP, las APIs externas cacheadas y la lógica de negocio (estados de consultas, notas fechadas, protecciones de administradores).
- **Doble control de permisos.** El servidor verifica el rol en cada ruta (`soloStaff`, `soloAdmin`) **y** casi todas las consultas se hacen con el token del propio usuario, así la base vuelve a verificar con **RLS**. Aunque alguien se salteara el servidor y usara la clave pública directo contra Supabase, la base no le entrega ni le deja modificar nada que no corresponda (probado, ver `docs/PRUEBAS.md`).
- **La clave `service_role` nunca sale del servidor.** Se usa sólo para: guardar consultas del formulario (para que nadie las inserte salteando el límite de envíos), contar visitas y administrar cuentas de Auth (crear, bloquear, borrar, cambiar contraseña) *después* de comprobar que quien lo pide es admin.

## 2. Estructura de carpetas

```
proyecto final/
├── client/                       React + Vite + Tailwind
│   ├── .env.example              VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (sólo datos públicos)
│   └── src/
│       ├── index.css             TOKENS del manual de marca (@theme de Tailwind)
│       ├── supabase.js           cliente de Supabase del navegador (sesión y Google)
│       ├── api.js                todas las llamadas a /api (adjunta el token)
│       ├── contexto.jsx          sesión (Supabase Auth), datos del sitio y avisos
│       ├── animaciones.js        GSAP: reveal, contadores, respeta reduced-motion
│       ├── componentes/ · secciones/ · paginas/ (Inicio, ProyectoDetalle, Ingresar, AuthCallback…)
│       └── panel/                Consultas · Metricas · Grafico · GestionProyectos · GestionServicios · Usuarios
├── server/
│   ├── .env.example              todas las variables explicadas
│   ├── scripts/                  seed.js · crear-admin.js · probar-correo.js · generar-seed-sql.js
│   ├── src/                      ver sección 1
│   └── test/                     unit · db (migraciones + RLS en PostgreSQL local) · integracion (Supabase real)
├── supabase/
│   ├── migrations/               6 migraciones SQL reproducibles (aplicar EN ORDEN)
│   └── seed.sql                  contenido de ejemplo para el SQL Editor
├── deploy/                       Caddyfile · portfolio.service (VPS)
├── docs/                         esta carpeta
└── _legado-postgres/             código viejo de PostgreSQL propio (se puede borrar)
```

## 3. Modelo de datos (Supabase / PostgreSQL)

```
auth.users ──1:1── perfiles ──< accesos           perfil_sitio (1 fila)
                      │  ├────< visitas            tecnologias   experiencia
                      │  ├────< consultas ──< respuestas
                      │  └────< respuestas (autor)
servicios                                          proyectos ──< demos
storage.objects (bucket "portfolio": portadas de proyectos)
```

| Tabla | Para qué | Restricciones importantes |
|---|---|---|
| `perfiles` | Rol (`admin`/`operador`/`visitante`), nombre, activo, proveedor (email/google) de cada cuenta de Auth | FK a `auth.users` con cascada; email único; el trigger `al_crear_usuario` lo crea **siempre como visitante** (ignora un rol mandado por el navegador); `proteger_perfiles` impide quedarse sin admins y cambiarse el propio rol |
| `perfil_sitio`, `tecnologias`, `experiencia` | Contenido de la portada | `CHECK` de largos, URLs `https`, categorías cerradas |
| `servicios` | Servicios ofrecidos (CRUD) | ícono de una lista cerrada, orden 0–9999 |
| `proyectos`, `demos` | Portfolio (CRUD) | slug con formato, URLs sólo `https`, máx. 12 tecnologías, demos se borran en cascada |
| `consultas` | Formulario de contacto | tipo y estado en listas cerradas, email con formato, columnas generadas `busqueda` (sin acentos) y `prioridad` (orden de la bandeja) |
| `respuestas` | Correos enviados por el operador | `simulado` si no había SMTP; sólo staff puede firmar a su nombre |
| `visitas` | Contador de tráfico | hash diario de 16 hex (sin IP), `usuario_id` si había sesión |
| `accesos` | Contador de accesos autenticados | **única (usuario, sesión)**: la misma sesión no cuenta dos veces |

### Definiciones de las métricas (para no contar de más)

- **Visita** = una sesión de navegación. El sitio la informa una vez por pestaña (`sessionStorage`) y la función `registrar_visita` ignora otra del mismo visitante en los 30 minutos siguientes. Se descartan bots por User-Agent.
- **Visitante único** = hash diario de IP + navegador + secreto (no se guarda la IP).
- **Visita autenticada** = visita de alguien con la sesión iniciada (si inicia sesión durante la visita, esa visita pasa a autenticada sin sumar otra).
- **Acceso autenticado** = una sesión nueva de Supabase Auth (login, registro, Google, confirmación). Recargar o renovar el token no suma.
- **Usuario registrado** = perfil con rol `visitante`. La "evolución" es el total acumulado por período.

## 4. Roles y permisos (dónde se controla cada cosa)

| Acción | Visitante anónimo | Visitante registrado | Operador | Admin | Dónde se verifica |
|---|---|---|---|---|---|
| Ver portada, servicios, tarjetas de proyectos | ✔ | ✔ | ✔ | ✔ | RLS `*_ver` + función `proyectos_publicos()` |
| Ver detalle de proyecto y demos | ✖ (401) | ✔ | ✔ | ✔ | `requiereUsuario` + RLS (anon no tiene política SELECT) |
| Enviar consulta | ✔ (con límite) | ✔ | ✔ | ✔ | servidor (validación + límite) → service_role |
| Bandeja, estados, notas, responder | ✖ | ✖ | ✔ | ✔ | `soloStaff` + RLS `es_staff()` |
| CRUD proyectos, demos, servicios, imágenes | ✖ | ✖ | ✖ | ✔ | `soloAdmin` + RLS `es_admin()` + RLS de Storage |
| Usuarios y métricas | ✖ | ✖ | ✖ | ✔ | `soloAdmin` + RLS + `exigir_admin()` dentro de cada función |

## 5. Flujos principales

**Registro / ingreso con email.** `Ingresar.jsx` → `POST /api/auth/registro|login` (el servidor valida, limita intentos por IP y email) → Supabase Auth crea/valida la cuenta (bcrypt) → el trigger crea el perfil → el servidor registra el acceso con el token del usuario → devuelve `{ sesion, usuario }` → el navegador guarda la sesión con `supabase.auth.setSession` (se renueva sola). Si el proyecto tiene "Confirm email", devuelve `{ confirmar: true }` y la pantalla lo explica.

**Google.** `supabase.auth.signInWithOAuth` (PKCE) → Google → `/auth/callback?code=…` → `AuthCallback.jsx` canjea el código → `POST /api/auth/acceso` cuenta el acceso → redirige.

**Cerrar sesión.** `supabase.auth.signOut()` revoca el refresh token en Supabase; el access token deja de servir al vencer (≤1 h) y además el servidor rechaza cuentas desactivadas al instante.

**Consulta → respuesta.** Formulario → `POST /api/contacto` (validación + campo trampa + 5 envíos/15 min) → insert con service_role → correo al dueño y confirmación al visitante (en segundo plano) → el operador la ve en la bandeja → responde → **si el SMTP falla no se guarda nada ni cambia el estado** (502) → si sale, se guarda la respuesta y pasa a *Respondida* con nota fechada.

**Imagen de un proyecto.** El navegador valida tipo y peso y la achica a 1280 px → `POST /api/admin/imagenes` → el servidor verifica los primeros bytes (no la extensión), máx. 4 MB → sube a Storage con el token del admin (RLS) → URL pública. Al cambiar o borrar el proyecto, la imagen huérfana se elimina del bucket.

**Métricas.** `Metricas.jsx` (rango, agrupación, tipo de consulta) → `/api/admin/metricas/*` → RPC `metricas_resumen`, `metricas_series`, `metricas_consultas` con parámetros tipados → la función valida rango y rol en la base.

## 6. Decisiones de diseño

| Decisión | Motivo |
|---|---|
| Supabase (DB + Auth + Storage) en vez de PostgreSQL propio | Base administrada, Auth seguro y probado (bcrypt, refresh tokens, OAuth), Storage con CDN, RLS para defensa en profundidad |
| Mantener la API Node delante de Supabase | Validación con mensajes en español, límites anti-abuso, correos SMTP y reglas de negocio en un solo lugar; el frontend existente no hubo que reescribirlo |
| Cliente "del usuario" (token en el header) en vez de service_role | Mínimo privilegio: la base aplica RLS con la identidad real |
| Funciones SQL para métricas | Consultas parametrizadas tipadas, validación y control de rol dentro de la base |
| `accesos` única por sesión de Auth | Contar accesos reales sin duplicar por recargas o renovaciones de token |
| Columnas generadas (`busqueda`, `prioridad`) | Buscar sin acentos y ordenar la bandeja con la API de Supabase, sin SQL armado a mano |
| Correo "simulado" sin SMTP | Desarrollar sin cuenta de correo; el panel lo avisa en cada respuesta |
| Tailwind v4 con tokens en CSS (`@theme`) | El manual de marca y el código comparten los mismos nombres |
| Panel cargado bajo demanda (`React.lazy`) | Chart.js sólo se descarga al entrar a `/panel` |
| Perfil, tecnologías y experiencia sin ABM en el panel | El enunciado pide ABM de proyectos, demos y servicios; el resto se edita en el Table Editor de Supabase (RLS: sólo admin) |

## 7. Límites conocidos (para decirlos antes de que pregunten)

- Las demos incrustadas (`iframe`) dependen de que el sitio de destino permita mostrarse dentro de otra página; por eso cada demo tiene también "Abrir en otra pestaña".
- Los límites de uso (intentos de ingreso, envíos) del servidor están en memoria: se reinician al reiniciar y no se comparten entre varias copias. Supabase Auth tiene además sus propios límites.
- Si alguien sube una imagen y cancela sin guardar, queda en el bucket hasta borrarla desde Storage.
- Recuperación de contraseña por correo: la provee Supabase Auth, pero no hay pantalla propia; el admin puede cambiar la contraseña desde Usuarios.
- El CDN de Storage puede seguir sirviendo una imagen borrada unos minutos (caché).

---

# Plan de trabajo para 5 integrantes

**Integrantes:** Sanchez Fadell, Francisco · Cadima, Francisco · Arraya, Joaquín · Almada, Alejo · Juárez, Agustín. El reparto es una sugerencia: que cada área tenga dueño que la pueda explicar.

| # | Área | Integrante (sugerido) | Responsable de | Archivos principales |
|---|---|---|---|---|
| 1 | **Diseño y UI** | Juárez, Agustín | Manual de marca, tema, responsive, accesibilidad, capturas | `docs/manual-de-marca/`, `client/src/index.css`, `componentes/` |
| 2 | **Frontend interactivo** | Almada, Alejo | Secciones, páginas, sesión con Supabase Auth, animaciones GSAP | `secciones/`, `paginas/`, `contexto.jsx`, `supabase.js`, `animaciones.js` |
| 3 | **Backend y seguridad** | Cadima, Francisco | Rutas, roles, validación, imágenes en Storage | `server/src/http.js`, `permisos.js`, `supabase.js`, `validar.js`, `rutas/`, `imagenes.js` |
| 4 | **Datos, RLS y métricas** | Arraya, Joaquín | Migraciones, políticas RLS, funciones de métricas, gráficos | `supabase/migrations/`, `metricas.js`, `consultas.js`, `panel/Metricas.jsx` |
| 5 | **Integraciones, calidad y despliegue** | Sanchez Fadell, Francisco | Supabase (proyecto, Auth, Google, SMTP), correo, APIs externas, pruebas, publicación | `docs/SUPABASE.md`, `correo.js`, `externas.js`, `server/test/`, `docs/PUBLICAR.md` |

## Guion de demostración (10–12 minutos)

1. **Sitio público (2 min)** — secciones en PC y celular; animaciones; widget de clima y GitHub.
2. **Registro (2 min)** — abrir un proyecto sin cuenta (puerta de registro) → registrarse → ver descripción y demos. Mostrar en Supabase → Authentication que la cuenta existe.
3. **Contacto (1 min)** — enviar una consulta de cotización; mostrar el correo de confirmación.
4. **Operador (2 min)** — bandeja → abrir la consulta → cambiar estado → responder → mostrar el correo recibido.
5. **Administrador (3 min)** — métricas (rango, agrupación, tipo); crear un proyecto con imagen y una demo; panel de usuarios (buscar, cambiar rol, desactivar).
6. **Seguridad (2 min)** — una política RLS en `supabase/migrations/…_seguridad.sql`; mostrar que con la clave pública la tabla `proyectos` devuelve `[]`; una función de métricas parametrizada.

## Checklist antes de entregar

- [ ] `npm test` pasa (30 pruebas, no necesita internet).
- [ ] `npm run test:integracion` pasa contra el Supabase del grupo (ver `docs/PRUEBAS.md`).
- [ ] Los `.env` **no** están en el repositorio ni en el zip (están en `.gitignore`).
- [ ] La `service_role` sólo está en `server/.env`.
- [ ] SMTP real configurado (en el servidor y en Supabase Auth) y probado con `npm run correo:probar --prefix server -- tu@mail.com`.
- [ ] Contenido real cargado y cuentas QA de prueba borradas (ver `docs/SUPABASE.md` §9).
