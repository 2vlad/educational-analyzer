# Database Migration Instructions

## 🎯 Problem

The batch upload feature requires new database tables that don't exist yet:

- ❌ `programs`
- ❌ `program_lessons`
- ❌ `program_runs`
- ❌ `analysis_jobs`
- ❌ `external_credentials`

## 📋 Solution: Run Migrations Manually

### Step 1: Open Supabase Dashboard

**SQL Editor:**
https://app.supabase.com/project/bzzxseccgdmgtarhdunc/sql/new

### Step 2: Execute Migrations (in order)

Copy and execute each SQL file in the Supabase SQL Editor:

#### 2.1 Programs Batch Analyzer Schema

**File:** `migrations/20250122_programs_batch_analyzer.sql`

**What it creates:**

- `external_credentials` - Encrypted Yonote cookies
- `programs` - Educational programs
- `program_lessons` - Lessons in programs
- `program_runs` - Batch analysis runs
- `analysis_jobs` - Job queue for worker

**To execute:**

1. Open the SQL file: `migrations/20250122_programs_batch_analyzer.sql`
2. Copy ALL content (488 lines)
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or press Cmd+Enter)
5. Verify: Should show "Success. No rows returned"

#### 2.2 Atomic Job Locking

**File:** `migrations/20250127_atomic_job_locking.sql`

**What it does:**

- Adds atomic job locking mechanism
- Prevents duplicate job processing
- Adds worker heartbeat tracking

**To execute:**

1. Open the SQL file
2. Copy all content
3. Paste into SQL Editor
4. Run

#### 2.3 Session Tracking

**File:** `migrations/20250128_add_session_tracking.sql`

**What it does:**

- Adds session ID tracking for analyses
- Links analyses to program runs

**To execute:**

1. Open the SQL file
2. Copy all content
3. Paste into SQL Editor
4. Run

### Step 3: Verify Tables Created

After running all migrations, verify in Supabase Dashboard:

**Table Editor:**
https://app.supabase.com/project/bzzxseccgdmgtarhdunc/editor

You should see:

- ✅ `programs`
- ✅ `program_lessons`
- ✅ `program_runs`
- ✅ `analysis_jobs`
- ✅ `external_credentials`

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C in terminal)
# Or kill process:
pkill -f "next dev"

# Start again:
cd /Users/admin/Dev/educational-analyzer
npm run dev
```

### Step 5: Test

1. Open http://localhost:3001/programs
2. Error should be gone! ✅
3. You can now create programs and batch analyze

## 🔍 Alternative: Quick Check Script

To check if migrations are needed:

```bash
cd /Users/admin/Dev/educational-analyzer
node scripts/run-migrations.mjs
```

This will show which tables exist vs. don't exist.

## 🐛 Troubleshooting

### Issue: "relation already exists"

**Cause:** Migration already partially run

**Solution:** Either:

1. Drop existing tables and re-run
2. Skip the erroring CREATE TABLE statements
3. Comment out lines that error

### Issue: "profiles table doesn't exist"

**Cause:** Base migrations not run

**Solution:** First run:

```sql
-- From migrations/0001_init.sql
-- Then migrations/0002_multi_user_support.sql
```

### Issue: RLS errors after migration

**Cause:** Row Level Security policies not created

**Solution:** The migration includes RLS policies. If errors persist:

1. Check Supabase Dashboard → Authentication → Policies
2. Verify policies exist for `programs`, `program_runs`, etc.
3. Re-run the migration SQL

## 📖 Migration Files Content

All migrations are in: `migrations/`

```
migrations/
├── 0001_init.sql                            # Base schema
├── 0002_multi_user_support.sql             # Multi-user support
├── 20250122_programs_batch_analyzer.sql    # ⭐ MAIN MIGRATION
├── 20250127_atomic_job_locking.sql         # Job locking
└── 20250128_add_session_tracking.sql       # Session tracking
```

## ✅ Success Checklist

- [ ] Opened Supabase SQL Editor
- [ ] Ran `20250122_programs_batch_analyzer.sql`
- [ ] Ran `20250127_atomic_job_locking.sql`
- [ ] Ran `20250128_add_session_tracking.sql`
- [ ] Verified tables in Table Editor
- [ ] Restarted dev server
- [ ] Tested `/programs` page (no errors!)

## 🚀 After Migration

Once migrations are complete:

1. **Create Program:**
   - Go to http://localhost:3001/programs
   - Click "Создать программу"
   - Enter details

2. **Enumerate Lessons:**
   - Click "Загрузить уроки"
   - See lessons list

3. **Start Batch Analysis:**
   - Click "Запустить анализ"
   - Watch ProgressTracker in real-time! ✨

4. **Railway Worker:**
   - Worker will process jobs every 5 seconds
   - Check Railway logs to see processing
