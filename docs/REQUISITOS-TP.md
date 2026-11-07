# Mapa de requisitos del TP → dónde está en el proyecto

Versión **Promoción** (incluye las funciones del rol Administrador) y extras para grupos de **5 integrantes**.
Cada fila: qué pide el enunciado, dónde está implementado y cómo mostrarlo en vivo. El estado de
verificación de cada uno está en [`AUDITORIA.md`](AUDITORIA.md) §4.

## A. Lado del visitante

| Requisito | Dónde está | Cómo demostrarlo |
|---|---|---|
| Perfil, stack, servicios y experiencia | `client/src/secciones/` (`Hero`, `Stack`, `Servicios`, `Experiencia`) · tablas `perfil_sitio`, `tecnologias`, `servicios`, `experiencia` en Supabase | Abrir `/` y recorrer las secciones |
| Formulario de contacto que llega por email | `secciones/Contacto.jsx` → `POST /api/contacto` → `server/src/consultas.js` (validación, campo trampa, 5 envíos/15 min) → tabla `consultas` → `correo.js` (aviso al dueño + confirmación al visitante, SMTP) | Enviar una consulta y mostrar los dos correos |
| Tipos: general, cotización, asesoría | Campo `tipo` (lista cerrada en el formulario, el servidor y un `CHECK` en la base) | Elegir cada tipo y verlo en la bandeja |
| Proyectos y demos **sólo para registrados** | `/api/portfolio` usa `proyectos_publicos()` (sin descripción ni demos) · `GET /api/proyectos/:slug` exige sesión (401) · **RLS**: la clave pública no lee `proyectos` ni `demos` · `paginas/ProyectoDetalle.jsx` | Abrir un proyecto sin cuenta (puerta de registro) y con cuenta. Mostrar en el SQL de la migración 200 que `anon` no tiene política SELECT |
| Registración | **Supabase Auth**: email + contraseña (`POST /api/auth/registro` valida y limita) y Google (OAuth PKCE) · el trigger `al_crear_usuario` crea el perfil como `visitante` | Crear una cuenta en `/ingresar`; verla en Supabase → Authentication |
| Responsive PC y celular | Tailwind mobile-first · manual de marca §10 y §13 (capturas) | Achicar la ventana o abrir desde el celular |

## B. Lado del operador

| Requisito | Dónde está | Cómo demostrarlo |
|---|---|---|
| Bandeja con mensajes, cotizaciones y asesorías | `panel/Consultas.jsx` · `GET /api/admin/consultas` (filtros por estado, tipo y búsqueda sin acentos) · RLS `es_staff()` | Ingresar como operador → Consultas |
| Responder por email | `POST /api/admin/consultas/:id/responder` → SMTP → tabla `respuestas` (historial) | Responder y mostrar el correo recibido |
| Seguimiento | Estados *Nueva → En seguimiento → Respondida → Archivada* + notas internas fechadas automáticas | Cambiar estado y agregar una nota |
| Si el correo falla no se pierde el control | Si el SMTP rechaza, responde 502 y **no** guarda la respuesta ni cambia el estado | Poner una clave SMTP errónea y responder |

## C. Anteproyecto / Manual de marca

| Requisito | Dónde está |
|---|---|
| Paleta de colores con HEX | `docs/manual-de-marca/README.md` §3 y `tokens.json` |
| Tipografía (fuentes, pesos, jerarquías) | §4 |
| Prototipado y layouts (PC y celular) | §10 (wireframes) y §13 (capturas reales) |
| Navegabilidad y responsive | §10 y §12 |

## D. Requisitos técnicos

| Requisito | Dónde está |
|---|---|
| **Framework CSS obligatorio** | **Tailwind CSS v4** (`client/package.json`, tokens en `client/src/index.css`) |
| Validación estricta de campos | Navegador: `client/src/utils.js` · Servidor: `server/src/validar.js` · Base: restricciones `CHECK` en `supabase/migrations/…_esquema.sql` (tres capas) |
| Validación de archivos e imágenes | Navegador: tipo, peso y redimensionado (`panel/SubirImagen.jsx`) · Servidor: **primeros bytes** del archivo, máx. 4 MB, nombre generado (`server/src/imagenes.js`) · Supabase Storage: límite de 4 MB y tipos MIME del bucket · RLS: sólo admin sube |
| Base de datos SQL | **Supabase (PostgreSQL 17)** — 6 migraciones reproducibles en `supabase/migrations/` |
| Despliegue | Localhost (README) y guía para Render/VPS (`docs/PUBLICAR.md`) |
| Documentación | `docs/` (auditoría, Supabase, arquitectura, pruebas, manual) + comentarios en el código |

## E. Promoción (rol Administrador)

| Requisito | Dónde está | Cómo demostrarlo |
|---|---|---|
| CRUD de Proyectos | `panel/GestionProyectos.jsx` · `/api/admin/proyectos` (listar, ver, crear, editar, borrar con confirmación) · imagen en Supabase Storage | Crear un proyecto con imagen y verlo en `/#proyectos` |
| CRUD de Demos | Dentro del proyecto · `/api/admin/proyectos/:id/demos`, `/api/admin/demos/:id` · tipo iframe o enlace, sólo `https` | Agregar una demo incrustada |
| CRUD de Servicios | `panel/GestionServicios.jsx` · `/api/admin/servicios` (incluye activar/ocultar) | Crear un servicio y verlo en `/#servicios` |
| Panel de usuarios registrados | `panel/Usuarios.jsx` · `/api/admin/usuarios` (búsqueda, filtro por rol y por estado, alta, edición de nombre/rol/contraseña, activar/desactivar = bloquea el login en Supabase Auth, baja) · protege al último administrador (trigger) | Panel → Usuarios |
| Contador de visitas generales | Tabla `visitas` + función `registrar_visita` (una por sesión de navegación, sin duplicar en 30 min, sin bots, visitante = hash diario sin IP) | Abrir el sitio en otro navegador y ver subir "Visitas totales" |
| Contador de accesos de usuarios autenticados | Tabla `accesos` (única por sesión de Supabase Auth) + `visitas.usuario_id` + cantidad de usuarios registrados | Ingresar y ver "Accesos autenticados" |
| **Consultas parametrizadas** | Funciones `metricas_resumen`, `metricas_series(p_desde, p_hasta, p_agrupar, p_zona, p_tipo)`, `metricas_consultas(...)` en `…_funciones.sql`, llamadas por RPC con parámetros tipados; validan rango y rol **en la base** | Cambiar fechas, agrupación y tipo en Métricas; mostrar que `desde='; DROP TABLE` devuelve 400 |
| **Gráficos interactivos** | `panel/Metricas.jsx` + `Grafico.jsx` (Chart.js): visitas/visitantes/visitas con sesión/accesos (líneas), evolución de usuarios registrados (barras + acumulado), consultas por tipo (torta), consultas en el tiempo (barras, filtrable por tipo), consultas por estado. Tooltips, leyenda que oculta series, rangos rápidos | Panel → Métricas |

## F. Extras para grupos de 5

| Extra | Dónde está |
|---|---|
| Animaciones fluidas (GSAP / CSS) | `client/src/animaciones.js` + `Hero.jsx` (línea de tiempo, parallax con ScrollTrigger), `Experiencia.jsx` (línea que se dibuja con scroll), contadores, aparición escalonada. Respeta `prefers-reduced-motion` |
| Integración con APIs web | **Supabase** (Auth, REST, Storage) · **GitHub REST API** (repositorios y lenguajes) · **Open-Meteo** (clima) · **Google OAuth** · **SMTP** · APIs del navegador (History, sessionStorage, Canvas para achicar imágenes) |

## G. Seguridad (suma puntos en la defensa)

- **Row Level Security en las 11 tablas** y en Storage, verificado con pruebas automáticas como cada rol.
- Doble control: rol verificado en el servidor **y** en la base (el servidor consulta con el token del usuario).
- La `service_role` sólo vive en `server/.env`; el navegador sólo tiene la clave pública.
- Contraseñas y sesiones de **Supabase Auth** (bcrypt, refresh tokens revocables, PKCE para Google).
- El rol nunca lo decide el navegador: el trigger crea todo usuario nuevo como `visitante`.
- Límite de intentos por IP y por email en el ingreso; límite de envíos en el formulario y campo trampa.
- Content-Security-Policy (`script-src 'self'`, `connect-src` sólo propio + Supabase); links de demos y repos sólo `https`; iframes con `sandbox`.
- Siempre queda al menos un administrador activo (trigger en la base).

## H. Pruebas

`npm test` → 30 pruebas locales. `npm run test:integracion` → 9 pruebas contra Supabase real. Ver [`PRUEBAS.md`](PRUEBAS.md).
