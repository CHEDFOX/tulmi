# Deploying the Flow backend to a Hostinger VPS

Plain, copy-paste steps. You only need your two API keys (Groq + OpenRouter).
Supabase is optional for the first run (`DEV_SKIP_AUTH=true`).

> Replace `YOUR_VPS_IP` with your VPS IP from Hostinger's hPanel, and
> `flow.yourdomain.com` with your domain (only needed for HTTPS).

---

## 1. Connect to the VPS

From your Windows PowerShell / terminal:

```bash
ssh root@YOUR_VPS_IP
```

Enter the root password you set in Hostinger's hPanel.

## 2. Install Docker (one time)

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Get the code onto the VPS

```bash
# If the GitHub repo is private, create a token at
# https://github.com/settings/tokens (scope: repo) and use it in the URL:
git clone https://YOUR_TOKEN@github.com/chedfox/tulmi.git
# If it's public, just:
# git clone https://github.com/chedfox/tulmi.git

cd tulmi
```

## 4. Add your keys

```bash
cp .env.example backend/.env
nano backend/.env
```

Fill in `GROQ_API_KEY` and `OPENROUTER_API_KEY`. Leave `DEV_SKIP_AUTH=true`
for now. Save in nano with `Ctrl+O`, `Enter`, then `Ctrl+X`.

## 5a. Start it — HTTP (quick test)

```bash
docker compose up -d --build
```

Check it's alive:

```bash
curl http://localhost:8080/healthz
# -> {"status":"ok","service":"flow-backend","version":"0.1.0"}
```

Open port 8080 so your phone can reach it (Hostinger firewall in hPanel, and):

```bash
ufw allow 8080 2>/dev/null || true
```

Now `http://YOUR_VPS_IP:8080/healthz` should work from anywhere.

## 5b. Start it — HTTPS (recommended for real use)

HTTPS needs a domain. In your domain's DNS, add an **A record**:
`flow.yourdomain.com → YOUR_VPS_IP`. Then:

```bash
nano deploy/Caddyfile        # replace flow.example.com with your domain
ufw allow 80 && ufw allow 443
docker compose --profile https up -d --build
```

Your backend is now live at `https://flow.yourdomain.com` (and the Android
app will use `wss://flow.yourdomain.com/v1/stream`). Caddy handles the
certificate automatically.

---

## Everyday commands

```bash
docker compose logs -f backend      # watch logs
docker compose restart backend      # restart
docker compose down                 # stop
git pull && docker compose up -d --build   # deploy a new version
```

## Notes

- **Secrets** live only in `backend/.env` on the VPS — never committed.
- Switch the cleanup model anytime by editing `CLEANUP_MODEL` in
  `backend/.env` and running `docker compose up -d --build`.
- When you're ready for real users, turn off `DEV_SKIP_AUTH`, set the
  `SUPABASE_*` keys, and run the migration in
  `backend/supabase/migrations/`.
