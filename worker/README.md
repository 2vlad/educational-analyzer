# Educational Analyzer Worker

Background worker for processing educational content analysis jobs.

## How it works

1. Polls `/api/worker/tick` endpoint every 5 seconds
2. Endpoint processes one job from the queue
3. Results are saved to the database
4. Continues until queue is empty

## Deployment

### Railway (Recommended)

```bash
# 1. Create project and link
railway link

# 2. Set environment variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
railway variables set APP_SECRET_KEY=...
railway variables set API_URL=https://your-app.vercel.app

# 3. Deploy
railway up
```

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Configure .env with your values

# 4. Run worker
npm start

# Or with auto-reload
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | ✅ |
| `APP_SECRET_KEY` | 32-char secret for credential decryption | ✅ |
| `API_URL` | Your Vercel app URL | ✅ |
| `WORKER_INTERVAL` | Poll interval in ms (default: 5000) | ❌ |

## Monitoring

### Logs

```bash
# Railway
railway logs

# Local
npm start
```

### Output

```
✅ Processed job: { jobId: '...', lessonTitle: 'Урок 1', status: 'succeeded' }
. (dot for "no jobs available")
❌ Worker error: ... (on errors)
```

## Performance

- **Interval:** 5 seconds (configurable)
- **Throughput:** ~720 jobs/hour
- **Latency:** 5-10 seconds per job

Compare to Vercel Cron (1 minute interval):
- Vercel: 60 jobs/hour
- Railway: **720 jobs/hour** (12x faster!)

## Troubleshooting

### No jobs being processed

1. Check worker is running: `railway logs`
2. Check API URL is correct
3. Check environment variables
4. Check Vercel deployment is up

### Jobs failing

1. Check API keys (ANTHROPIC_API_KEY, etc.) are set in Vercel
2. Check Supabase credentials
3. Check worker logs for specific errors

### High memory usage

Adjust `WORKER_INTERVAL` to reduce load:
```bash
railway variables set WORKER_INTERVAL=10000  # 10 seconds
```

## Architecture

```
┌─────────────────┐
│  Railway Worker │
│                 │
│  Every 5 sec:   │
│  GET /api/      │
│    worker/tick  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel API     │
│  /api/worker/   │
│    tick         │
│                 │
│  1. Pick job    │
│  2. Process     │
│  3. Save result │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│                 │
│  - analysis_jobs│
│  - analyses     │
└─────────────────┘
```
