# Publicar el portfolio en internet

Con Supabase la base, las cuentas y las imágenes ya están en la nube: para publicar sólo hay que
subir **el servidor Node** (que además entrega el sitio compilado). No hace falta disco persistente.

- **A. Localhost** (alcanza para la exposición): `README.md` → *Puesta en marcha*.
- **B. Render (recomendado, gratis)**: esta guía, sección 1.
- **C. VPS propio con Ubuntu**: sección 2.

> El enunciado acepta "en la nube (GitHub Pages, Vercel, Render u otros) o localhost". GitHub Pages
> y Vercel estático **no** sirven solos porque el servidor Node tiene que estar corriendo (correo,
> validación, claves privadas). Render sí.

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
