# FOC-Birthday-Wishes 🎂

A modern birthday celebration and automated greeting portal for the Faculty of Computing (FOC).

Features:
- Dynamic Birthday Directory with upcoming spotlights, countdowns, filtering, and search.
- Interactive Birthday Card Generator (Canvas-based customizable cards with filters and avatars).
- Automated and scheduled WhatsApp group messaging via WhatsApp Web bot.
- 100% self-hosted with persistent local storage — **Zero Firebase dependencies**.
- Production-ready Docker Compose orchestration tailored for **Coolify VPS deployment**.

---

## 🚀 Coolify VPS Deployment Guide

For full deployment instructions, firewall setup, persistent storage, and QR code pairing on your VPS using Coolify, read:
👉 **[COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md)**

### Quick Start with Docker Compose:
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Build and start containers
docker compose up -d --build

# 3. Access in browser
# Frontend: http://YOUR_VPS_IP:8080
# WhatsApp QR Link: http://YOUR_VPS_IP:8080/qr
```
