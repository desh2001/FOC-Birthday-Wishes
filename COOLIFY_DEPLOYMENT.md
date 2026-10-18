# Production Coolify VPS Deployment Guide: FOC-Birthday-Wishes

This comprehensive guide details how to deploy the **FOC-Birthday-Wishes** system (React/Vite Frontend + WhatsApp Bot + Node.js API) to a VPS running **Coolify**, accessed directly via your VPS IP address (`http://YOUR_VPS_IP:8080`), without requiring an external domain or Firebase.

---

## 1. System Architecture

```text
                       [ Public Internet / User Browser ]
                                       │
                                       │ Port 8080 (Configurable: HOST_PORT)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Docker Bridge Network: internal_net                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ service: web (Container: birthday-web, Port 80 internal)             │  │
│  │                                                                       │  │
│  │  • Nginx Alpine                                                       │  │
│  │  • Serves static React/Vite production build                          │  │
│  │  • Reverse-proxies /api/ requests ──────────────┐                     │  │
│  │  • Reverse-proxies /qr, /img/, /scheduled-cards-images/              │  │
│  │  • SPA fallback: try_files $uri $uri/ /index.html                    │  │
│  └─────────────────────────────────────────────────┼─────────────────────┘  │
│                                                    │                        │
│                                                    ▼                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ service: bot (Container: birthday-bot, Port 3001 internal ONLY)       │  │
│  │                                                                       │  │
│  │  • Node 22 + Express API + Puppeteer / Chromium (Headless)            │  │
│  │  • WhatsApp Web Client (whatsapp-web.js)                              │  │
│  │  • Admin Key Protection & Path Traversal Guards                       │  │
│  │  • Persistent Local Storage mounted at /data:                         │  │
│  │      ├── /data/.wwebjs_auth/       (WhatsApp Session - No re-login)   │  │
│  │      ├── /data/students.json       (Student Birthday Records)         │  │
│  │      ├── /data/scheduled-cards/    (Generated Birthday Card Images)   │  │
│  │      ├── /data/scheduled-cards.json(Pending Scheduled Jobs)           │  │
│  │      └── /data/img/                (Uploaded Student Photos)          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                      [ Docker Named Volume: bot_data ]
```

### Key Architectural Highlights:
1. **Zero Firebase Dependencies**: All student records, uploaded photos, and scheduled jobs are managed locally and persist in the Docker named volume `birthday_bot_data`.
2. **Private Bot Network**: Port `3001` is never published to the public internet or VPS host. Only the `web` container communicates with `bot:3001` across the internal Docker network.
3. **Single Host Port Access**: All browser requests (frontend UI, API calls, profile pictures, WhatsApp actions, and QR login) go through port `8080` (or your configured `HOST_PORT`).
4. **Permanent WhatsApp Session**: The session credentials reside in `/data/.wwebjs_auth` inside the persistent volume. Container rebuilds, redeploys, or VPS reboots will **never** log you out of WhatsApp.

---

## 2. Prerequisites

- A Linux VPS (Ubuntu 22.04 / 24.04 or Debian 12 recommended) with at least **2 GB RAM** and **1 vCPU** (Chromium requires ~600MB-1GB RAM during initialization).
- [Coolify](https://coolify.io/) installed and running on the VPS.
- Your public or private GitHub repository containing this code.

---

## 3. Repository Changes Summary

| File | Change Type | Purpose |
| :--- | :--- | :--- |
| `whatsapp-bot.js` | **Updated** | Added local JSON persistence (`/data/students.json`), relative card image URLs, path traversal protection, Admin API Key authorization on sensitive endpoints, and graceful shutdown handlers. |
| `src/App.jsx` | **Updated** | Removed Firestore listeners and `ImageSync` banner; now fetches birthday records dynamically from `/api/students` with fallback to bundled data. |
| `src/components/Modals/AddBirthdayModal.jsx` | **Updated** | Replaced Firestore and Firebase Storage calls with `/api/save-image` and `POST /api/students`. |
| `src/components/Modals/UpdatePhotoModal.jsx` | **Updated** | Replaced Firestore and Firebase Storage calls with `/api/save-image` and `PUT /api/students/:id`. |
| `src/components/Modals/GenerateCardModal.jsx` | **Updated** | Added Admin Key header passing and interactive prompt fallback for WhatsApp actions. |
| `src/components/Modals/ScheduledMessagesModal.jsx` | **Updated** | Added Admin Key protection for cancelling scheduled jobs; fixed variable hoisting. |
| `src/utils.js` | **Updated** | Configured `BOT_API_URL` to default to relative `/api`, added `getAdminKey` / `setAdminKey` helpers. |
| `src/firebase.js` | **Cleaned** | Replaced hardcoded credentials with deprecated null stubs. |
| `package.json` | **Updated** | Removed `firebase` dependency (bundle size reduced from 573 kB to 272 kB). |
| `Dockerfile.whatsapp` | **Updated** | Added `dumb-init` (process reaping for Chromium), `curl` (health checks), and headless flags. |
| `Dockerfile.web` | **Created** | Multi-stage build producing production Vite assets and serving via Nginx. |
| `nginx.conf` | **Created** | Configured SPA routing fallback, `/api/` upstream proxying, image streaming, and `/qr` caching bypass. |
| `docker-compose.yml` | **Created** | Orchestrates `web` and `bot` services with internal network, persistent volume, and host port `8080`. |
| `.env.example` | **Created** | Safe template for production environment variables. |
| `.dockerignore` / `.gitignore` | **Updated** | Prevent session leaking, allow bundled student photos in Docker builds. |

---

## 4. Environment Variables

Create your environment configuration in Coolify (or `.env` file):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `TZ` | `Asia/Colombo` | Timezone for accurate birthday scheduling and daily execution. |
| `HOST_PORT` | `8080` | The public port on your VPS host to access the website (`http://YOUR_VPS_IP:8080`). |
| `ADMIN_API_KEY` | *(Set a random string)* | Secret password required to access `/qr` and execute WhatsApp actions. |
| `VITE_BOT_URL` | `/api` | Base path for frontend API calls (routed through Nginx). |

> [!TIP]
> Generate a strong Admin API Key using:
> ```bash
> openssl rand -hex 16
> ```

---

## 5. Step-by-Step Deployment on Coolify

### Step 1: Push Changes to GitHub
Push your committed changes to your repository:
```bash
git add .
git commit -m "Configure production-ready Docker Compose for Coolify"
git push origin main
```

### Step 2: Create a New Resource in Coolify
1. Open your **Coolify Dashboard** (`http://YOUR_VPS_IP:8000`).
2. Go to **Projects** -> Choose your Project -> Select an **Environment** (e.g. `production`).
3. Click **+ New Resource** -> Select **Docker Compose**.
4. Select **GitHub App** or **Public Repository**, and enter:
   - Repository: `desh2001/FOC-Birthday-Wishes` (or your repo URL)
   - Branch: `main`
   - Build Pack: **Docker Compose**
   - Compose File Location: `/docker-compose.yml`

### Step 3: Configure Environment Variables in Coolify
In the application's **Environment Variables** tab, add:
```env
HOST_PORT=8080
TZ=Asia/Colombo
ADMIN_API_KEY=your_super_secret_admin_key_here
VITE_BOT_URL=/api
```

### Step 4: Configure Storage (Volumes)
Coolify reads `volumes: [ bot_data:/data ]` from `docker-compose.yml` automatically.
Verify in Coolify under **Storages** that named volume `birthday_bot_data` is mounted to destination path `/data`.

### Step 5: Deploy
Click **Deploy**.
Coolify will:
1. Build `Dockerfile.whatsapp` (installing Chromium and dependencies).
2. Build `Dockerfile.web` (compiling the React Vite app and setting up Nginx).
3. Start both containers on the private bridge network.
4. Run health checks against `http://localhost:3001/health`.

---

## 6. VPS Firewall & Network Security

### Ports to Open:
On your VPS firewall (e.g. UFW or cloud security group like AWS/Hetzner/DigitalOcean):
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Coolify Dashboard (default 8000)
sudo ufw allow 8000/tcp

# Allow Birthday Website
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

### Why Port 3001 Must NOT Be Exposed:
- Port `3001` hosts the internal Node/Express API with direct access to WhatsApp messaging and file uploads.
- By binding port `3001` exclusively to the internal Docker network `internal_net`, external web scrapers and unauthorized users cannot bypass Nginx or flood the WhatsApp bot.

---

## 7. Connecting WhatsApp via QR Code

Once deployed:
1. Open your browser and navigate to:
   ```text
   http://YOUR_VPS_IP:8080/qr
   ```
2. If `ADMIN_API_KEY` is set, you will be greeted by the **Admin Verification** screen. Enter your secret key.
   *(Alternatively, visit directly: `http://YOUR_VPS_IP:8080/qr?key=YOUR_ADMIN_KEY`)*.
3. The page will render the WhatsApp QR code and refresh every 15 seconds.
4. Open WhatsApp on your phone:
   - Go to **Settings** -> **Linked Devices** -> **Link a Device**.
   - Scan the QR code on your screen.
5. The screen will transition to: `✅ WhatsApp is Connected!`.
6. Your session is now saved in the persistent `/data` volume.

---

## 8. Backup & Restore WhatsApp Session & Data

All runtime data is stored in the Docker named volume `birthday_bot_data`.

### Backup:
Run this command on your VPS terminal to export a compressed archive:
```bash
docker run --rm -v birthday_bot_data:/data -v $(pwd):/backup alpine tar czvf /backup/birthday_system_backup_$(date +%F).tar.gz -C /data .
```
This backup contains:
- `.wwebjs_auth/` (WhatsApp authenticated session tokens)
- `students.json` (All registered student records)
- `scheduled-cards.json` (Pending scheduled cards)
- `img/` (Uploaded student profile pictures)

### Restore:
To restore data into a fresh volume:
```bash
docker run --rm -v birthday_bot_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzvf /backup/birthday_system_backup_YYYY-MM-DD.tar.gz"
```

---

## 9. Verification & Testing Checklist

After deployment, perform these tests:

- [ ] **Frontend Loading**: Visit `http://YOUR_VPS_IP:8080` in a browser. The student directory, spotlight, stats, and search filters must load instantly.
- [ ] **Health Endpoint**: Visit `http://YOUR_VPS_IP:8080/health`. Should return `{"status":"ok","whatsappReady":true,...}`.
- [ ] **Student Registration**: Click **Add Birthday**, upload a photo, and submit. The record should immediately appear in the grid and persist across page refreshes.
- [ ] **Photo Update**: Open a student profile, click **Update Photo**, and save a new picture. Verify the thumbnail updates immediately.
- [ ] **Card Generation**: Select a student, click **Generate Card**, and click **Send to WhatsApp Group** or **Schedule Card**.
- [ ] **Scheduled Cards**: Open the **Scheduled Cards** modal. The scheduled message preview must load properly with no broken image icons.
- [ ] **Container Restart Test**: Restart the bot container (`docker restart birthday-bot`). Refresh `/health` — WhatsApp must re-authenticate automatically without asking for a new QR code.

---

## 10. Troubleshooting Guide

### Issue 1: WhatsApp Bot Fails to Launch Chromium
**Symptoms**: Container logs show `Failed to launch the browser process!` or `Chromium revision is not downloaded`.
**Fix**: Verify `Dockerfile.whatsapp` contains:
```dockerfile
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```
And puppeteer launch arguments in `whatsapp-bot.js` include `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage`.

### Issue 2: Port 8080 Already in Use
**Symptoms**: Docker error `Bind for 0.0.0.0:8080 failed: port is already allocated`.
**Fix**: Change `HOST_PORT` in your Coolify Environment Variables (e.g. `HOST_PORT=8888`) and redeploy. Access via `http://YOUR_VPS_IP:8888`.

### Issue 3: WhatsApp Action Returns 401 Unauthorized
**Symptoms**: Alert showing unauthorized or invalid key.
**Fix**: Ensure your `ADMIN_API_KEY` in Coolify matches the key you enter in the browser prompt or `/qr?key=...`.

### Issue 4: Profile Pictures Show 404
**Symptoms**: Images at `/img/...` fail to load.
**Fix**: Nginx configuration includes `try_files $uri @proxy_bot_img;`. If the photo is not bundled statically, Nginx proxies to the bot service which reads from `/data/img/`. Verify the `birthday_bot_data` volume is mounted.

---

## 11. Upgrading to a Domain & HTTPS Later

When you purchase a domain (e.g. `birthday.yourdomain.com`):
1. In your DNS provider (Cloudflare, Namecheap, etc.), add an **A Record**:
   ```text
   birthday.yourdomain.com -> YOUR_VPS_IP
   ```
2. In Coolify, open your application resource:
   - Under **Domains**, add: `https://birthday.yourdomain.com`.
3. Coolify's built-in Traefik reverse proxy will automatically generate a free **Let's Encrypt SSL certificate** and route HTTPS traffic to your `web` container.
