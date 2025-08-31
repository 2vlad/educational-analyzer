# Apply Session Tracking Migration

To enable the History page for guest users, you need to apply the migration that adds session tracking to the database.

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `migrations/20250128_add_session_tracking.sql`
4. Click "Run" to execute the migration

## Option 2: Via Supabase CLI

If you have the Supabase CLI configured:

```bash
# Link your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
npx supabase db push
```

## What This Migration Does

- Adds a `session_id` column to the `analyses` table
- Creates an index on `session_id` for faster queries
- Updates RLS policies to allow guest users to view their own analyses
- Enables session-based tracking for users who haven't signed up

## After Migration

Once the migration is applied, the History page will automatically work for both:
- Authenticated users (using their user_id)
- Guest users (using session cookies)