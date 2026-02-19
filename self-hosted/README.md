# Supabase Self-Hosted on Mac Mini

Deploy Supabase self-hosted via Docker on Mac Mini with Cloudflare Tunnel for HTTPS.

## Prerequisites

- Mac Mini (Apple Silicon)
- Docker Desktop for Mac
- Domain managed via Cloudflare DNS
- `cloudflared` CLI (`brew install cloudflare/cloudflare/cloudflared`)

## Quick Start

### 1. Install Docker Desktop

Download from https://www.docker.com/products/docker-desktop/ (Apple Silicon version).
Allocate 4-8 GB RAM in Docker Desktop Settings > Resources.

### 2. Clone & Configure Supabase Docker

```bash
cd /opt  # or ~/supabase-docker
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

### 3. Generate Secrets

Run the key generation script from this directory:

```bash
cd /path/to/educational-analyzer/self-hosted
node scripts/generate-keys.mjs
```

This outputs all secrets you need. Copy them into `supabase/docker/.env`.

### 4. Configure `.env`

Edit `supabase/docker/.env` with the generated secrets plus:

```env
# === Generated secrets (from step 3) ===
JWT_SECRET=<generated>
POSTGRES_PASSWORD=<generated>
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generated>

# === External URLs ===
API_EXTERNAL_URL=https://supabase-api.yourdomain.com
SITE_URL=https://your-app.vercel.app

# === Auth: Allowed redirects ===
GOTRUE_URI_ALLOW_LIST=https://your-app.vercel.app/auth/callback

# === Auth: Email (Resend SMTP - free tier) ===
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=re_YOUR_RESEND_API_KEY
GOTRUE_SMTP_SENDER_NAME=Educational Analyzer
GOTRUE_SMTP_ADMIN_EMAIL=noreply@yourdomain.com
GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# === Auth: Google OAuth ===
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id
GOTRUE_EXTERNAL_GOOGLE_SECRET=your-google-client-secret
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://supabase-api.yourdomain.com/auth/v1/callback

# === Auth: GitHub OAuth ===
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
GOTRUE_EXTERNAL_GITHUB_SECRET=your-github-client-secret
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://supabase-api.yourdomain.com/auth/v1/callback
```

### 5. Security: Bind PostgreSQL to localhost only

Edit `supabase/docker/docker-compose.yml` — in the `db` service, change ports from:
```yaml
ports:
  - ${POSTGRES_PORT}:${POSTGRES_PORT}
```
to:
```yaml
ports:
  - 127.0.0.1:${POSTGRES_PORT}:${POSTGRES_PORT}
```

### 6. Disable Unused Services (optional, saves ~1GB RAM)

Copy the override file:
```bash
cp /path/to/educational-analyzer/self-hosted/docker-compose.override.yml supabase/docker/
```

### 7. Start Supabase

```bash
cd supabase/docker
docker compose pull
docker compose up -d
```

### 8. Apply Database Migrations

```bash
cd /path/to/educational-analyzer
./self-hosted/scripts/apply-migrations.sh
```

Default connection: `localhost:5432`, user `postgres`. Set `PGPASSWORD` env var or use `-W` flag.

### 9. Set Up Cloudflare Tunnel

```bash
cloudflared tunnel login  # authenticate with Cloudflare
cloudflared tunnel create supabase-macmini
cloudflared tunnel route dns supabase-macmini supabase-api.yourdomain.com
cloudflared tunnel route dns supabase-macmini supabase-studio.yourdomain.com
```

Copy the config template:
```bash
cp /path/to/educational-analyzer/self-hosted/cloudflared-config.yml ~/.cloudflared/config.yml
```

Edit `~/.cloudflared/config.yml` — replace `TUNNEL_ID` and domain names.

Install as system service:
```bash
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared
```

### 10. Update Vercel Environment Variables

In Vercel project settings, update:

| Variable | New Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://supabase-api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your generated ANON_KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | Your generated SERVICE_ROLE_KEY |

Redeploy the Vercel app after updating env vars.

### 11. Update OAuth Redirect URIs

In Google Cloud Console and GitHub OAuth Apps, update the redirect URI to:
```
https://supabase-api.yourdomain.com/auth/v1/callback
```

### 12. Set Up Backups

```bash
# Install the backup script
cp /path/to/educational-analyzer/self-hosted/scripts/backup-postgres.sh ~/supabase-backup.sh
chmod +x ~/supabase-backup.sh

# Install the launchd plist for daily 3:00 AM backups
cp /path/to/educational-analyzer/self-hosted/com.supabase.backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.supabase.backup.plist
```

### 13. Enable macOS Firewall

System Settings > Network > Firewall > Turn On

## Verification Checklist

Run the health check script:
```bash
./self-hosted/scripts/health-check.sh https://supabase-api.yourdomain.com
```

Manual checks:
1. GoTrue health: `curl https://supabase-api.yourdomain.com/auth/v1/health`
2. REST API: `curl -H "apikey: YOUR_ANON_KEY" https://supabase-api.yourdomain.com/rest/v1/`
3. Email registration + confirmation flow
4. Google OAuth login
5. GitHub OAuth login
6. Guest mode analysis
7. Authenticated user analysis (RLS)
8. Manual backup: `~/supabase-backup.sh` and verify the dump file

## Troubleshooting

### Containers won't start
```bash
cd supabase/docker
docker compose logs -f  # check all logs
docker compose logs auth  # check GoTrue specifically
```

### Auth emails not arriving
- Verify SMTP settings in `.env`
- Check GoTrue logs: `docker compose logs auth`
- Test SMTP separately: `swaks --to test@example.com --server smtp.resend.com --port 465 --tls`

### OAuth callback fails
- Verify `API_EXTERNAL_URL` matches your tunnel domain
- Verify redirect URI in Google/GitHub matches exactly
- Check `GOTRUE_URI_ALLOW_LIST` includes your app URL

### Database connection refused
- Ensure Docker is running
- Check port binding: `docker compose ps`
- Verify `POSTGRES_PASSWORD` matches between `.env` and your connection string

## Cost

| Component | Cost |
|---|---|
| Mac Mini | already owned |
| Docker Desktop | free (personal) |
| Cloudflare Tunnel | free |
| Resend SMTP | free (<3000 emails/month) |
| **Total** | **~$0/month** |
