# Database Migrations

## How to apply migrations

### Option 1: Using Supabase SQL Editor (Recommended for MVP)

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the contents of `0001_init.sql`
4. Paste and run in the SQL editor
5. Verify tables were created in the Table Editor

### Option 2: Using Supabase CLI (For automation)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Migration files

- `0001_init.sql` - Initial schema with all required tables:
  - `analyses` - Stores analysis requests and results
  - `llm_requests` - Stores individual LLM API calls for each metric
  - `system_logs` - Application logs accessible via API
  - `rate_limits` - IP-based rate limiting

## Rollback

To rollback, you can create a corresponding `0001_rollback.sql` file with DROP statements.
