# Publicar el portfolio en internet

Con Supabase la base, las cuentas y las imágenes ya están en la nube: para publicar sólo hay que
subir **el servidor Node** (que además entrega el sitio compilado). No hace falta disco persistente.

- **A. Localhost** (alcanza para la exposición): `README.md` → *Puesta en marcha*.
- **B. Vercel (publicado)**: sección 0. Es el despliegue actual.
- **C. Render**: sección 1.
- **D. VPS propio con Ubuntu**: sección 2.

## 0. Vercel — despliegue actual

- **Sitio:** <https://proyecto-final-lenguajes-iv.vercel.app>
- **Proyecto de Vercel:** `aaalejo8s-projects/proyecto-final-lenguajes-iv`
- **Repositorio (privado):** <https://github.com/aaalejo8/PROYECTO-FINAL-LENGUAJES-IV>

**Cómo funciona.** La CDN de Vercel sirve el sitio compilado (`client/dist`). La API corre como
**una función serverless** (`api/index.js`), que usa exactamente el mismo código que el servidor
local (`server/src/app.js` + `server/src/http.js`). `vercel.json` define la instalación, la
compilación, el reenvío de `/api/*` a la función, la vuelta a `index.html` para las rutas del
sitio y los encabezados de seguridad (CSP incluida). En Vercel el formulario de contacto
**espera** a que salgan los correos antes de responder, porque la función se congela al terminar.

**Actualizar.** Alcanza con `git push` a `main`: Vercel compila y publica solo. No uses
`vercel deploy` desde la carpeta, porque subiría también los `.env` locales.

**Variables de entorno.** Están cargadas en Vercel → *Settings → Environment Variables*
(Production). Son las mismas de `server/.env`, más `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`NODE_ENV=production`, `TRUST_PROXY=true` y `PUBLIC_URL=https://proyecto-final-lenguajes-iv.vercel.app`.
Si cambiás una, redesplegá para que tome efecto.

**En Supabase** → *Authentication → URL Configuration*:
- **Site URL:** `https://proyecto-final-lenguajes-iv.vercel.app`
- **Redirect URLs:** agregar `https://proyecto-final-lenguajes-iv.vercel.app/auth/callback`
  (y dejar las de `localhost` para desarrollar).

**Verificado el 07/11/2026.** `npm run test:integracion` contra el sitio publicado pasó las 9
pruebas (login, roles, CRUD con subida a Storage, bandeja y respuesta por correo, métricas,
alta/bloqueo/baja de cuentas, contacto y visitas).

**Límites a tener en cuenta.** Los límites de intentos de login y de envíos del formulario se
guardan en memoria, así que en Vercel valen por cada instancia de la función y no para todo el
sitio. Siguen frenando abusos simples; un bloqueo global necesitaría guardar los intentos en la base.

> El enunciado acepta "en la nube (GitHub Pages, Vercel, Render u otros) o localhost". GitHub Pages
> no sirve porque no puede correr la API. Vercel sí, porque la API corre como función serverless.

## 1. Render

1. Subí el repositorio a GitHub (los `.env` **no** se suben: están en `.gitignore`).
2. <https://render.com> → **New → Web Service** → conectá el repo.
   - **Root Directory:** `proyecto final` (o la carpeta donde esté este proyecto).
   - **Runtime:** Node · **Build Command:** `npm run instalar && npm run construir`
   - **Start Command:** `npm run iniciar` · **Instance type:** Free.
3. **Environment** → cargá las variables de `server/.env.example` con los valores reales, más:
   - `NODE_ENV=production`, `TRUST_PROXY=true`, `PUBLIC_URL=https://TU-APP.onrender.com`
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (se usan al compilar el cliente).
4. **Create Web Service** y esperá el primer deploy.
5. En Supabase → **Authentication → URL Configuration**: `Site URL = https://TU-APP.onrender.com` y
   agregá `https://TU-APP.onrender.com/auth/callback` en *Redirect URLs*.
6. Si usan Google: no hay que tocar Google Cloud (el callback es el de Supabase).

El plan gratis de Render "duerme" el servicio tras 15 min sin uso: el primer pedido tarda ~30 s.
Ábranlo un minuto antes de exponer. El plan Free de Supabase pausa el proyecto tras 7 días sin
actividad: entren al panel de Supabase antes de la exposición y, si dice *Paused*, tocar *Restore*.

## 2. VPS (Ubuntu 24.04)

```bash
sudo apt update && sudo apt install -y git ufw curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

Instalá Caddy (https automático): <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>.

```bash
sudo adduser --disabled-password --gecos "" portfolio
sudo -iu portfolio
git clone https://github.com/TU_USUARIO/TU_REPO.git app
cd app && cp server/.env.example server/.env && nano server/.env
```

Completá las variables (como en Render) y después:

```bash
npm run preparar -- --sin-instalar || npm run preparar
npm run construir
```

Servicio y proxy:

```bash
sudo cp deploy/portfolio.service /etc/systemd/system/ && sudo systemctl enable --now portfolio
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo nano /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Actualizar: `cd ~/app && git pull && npm run instalar && npm run construir && sudo systemctl restart portfolio`.

## 3. Copias de seguridad

Supabase Free no guarda backups descargables automáticos. Antes de la exposición: panel →
**Database → Backups** (si está disponible) o `npx supabase db dump -f respaldo.sql` con la CLI.
Las migraciones de `supabase/migrations/` + `seed.sql` permiten recrear la estructura en minutos.

## Lista antes de mostrarlo

- [ ] El sitio abre por https y el login funciona (email y, si está, Google).
- [ ] Un visitante registrado ve el detalle de un proyecto; uno sin cuenta, la puerta de registro.
- [ ] Llega el correo de una consulta y el de una respuesta (SMTP real).
- [ ] Las métricas muestran visitas reales (abrir el sitio desde un celular y ver el contador).
- [ ] Las cuentas QA y las claves de ejemplo fueron borradas o cambiadas.
