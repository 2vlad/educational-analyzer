# Deployment Guide - Programs Feature

## Environment Variables

Add the following environment variables to your Vercel project:

### Required for Programs Feature

```env
# App Secret Key for encryption (generate with: openssl rand -base64 32)
APP_SECRET_KEY=your_32_byte_base64_key_here

# Feature Flags
USE_YONOTE_ADAPTER=true
ENABLE_PROGRAMS=true
```

### Existing Variables (already configured)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- AI Provider keys (at least one required)

## Generating APP_SECRET_KEY

Run this command to generate a secure key:

```bash
openssl rand -base64 32
```

## Vercel Configuration

1. **Cron Job**: The `vercel.json` file is already configured with a cron job that runs every minute:
   ```json
   {
     "crons": [
       {
         "path": "/api/worker/tick",
         "schedule": "*/1 * * * *"
       }
     ]
   }
   ```

2. **Function Timeouts**: Worker endpoints are configured with 60-second timeout limits.

3. **Monitoring**: 
   - Check cron execution in Vercel Dashboard → Functions → Crons
   - Monitor logs in Vercel Dashboard → Functions → Logs
   - Track job processing metrics in the database

## Database Migration

Before deploying, ensure the database migration has been run:

```sql
-- Run the migration from:
-- migrations/20250122_programs_batch_analyzer.sql
```

## Post-Deployment Checklist

1. ✅ Verify APP_SECRET_KEY is set in Vercel environment variables
2. ✅ Check that cron job appears in Vercel Dashboard
3. ✅ Test credential encryption by adding a Yonote credential
4. ✅ Create a test program and verify enumeration works
5. ✅ Start a test run and monitor progress
6. ✅ Check cron logs to ensure jobs are being processed

## Troubleshooting

### Cron not running
- Check Vercel Dashboard → Functions → Crons for execution history
- Verify the cron schedule syntax in `vercel.json`
- Check function logs for errors

### Jobs not processing
- Verify APP_SECRET_KEY is correctly set
- Check that there are active runs with status 'running'
- Look for authentication errors in logs
- Verify database connections are working

### Authentication errors
- Ensure Yonote cookies are fresh (not expired)
- Check credential decryption is working
- Verify APP_SECRET_KEY matches between encryptions

## Performance Tuning

- Default max concurrency is 3 jobs per run
- Cron processes up to 10 jobs total per tick
- Adjust `max_concurrency` when creating runs based on:
  - Number of simultaneous runs
  - API rate limits
  - Vercel function limits

## Security Notes

- APP_SECRET_KEY should never be committed to git
- Rotate APP_SECRET_KEY periodically (requires re-encrypting all credentials)
- Monitor for suspicious activity in logs
- Credentials are encrypted at rest in the database