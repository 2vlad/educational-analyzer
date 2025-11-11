# Test User Setup Guide

## 🎯 Purpose

This guide explains how to create and manage test users for development and testing across all environments.

## 📋 Prerequisites

- Node.js installed
- `.env.local` file configured with Supabase credentials
- Access to Supabase Dashboard

## 🔧 Creating Test User

We've created a script to automatically create a test admin user.

### Option 1: Using Script (Recommended)

```bash
cd /Users/admin/Dev/educational-analyzer
node scripts/create-test-user.mjs
```

**What it does:**

- Creates user `admin@test.edu` with predefined password
- Auto-confirms email (no verification needed)
- Updates password if user already exists
- Shows credentials after creation

**Output:**

```
✅ Test user created successfully!
User ID: xxx-xxx-xxx
Email: admin@test.edu
Email confirmed: ✅

═══════════════════════════════════════
📋 TEST ADMIN CREDENTIALS:
═══════════════════════════════════════
Email:     admin@test.edu
Password:  <shown in terminal>
═══════════════════════════════════════
```

### Option 2: Manual Creation via Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/project/bzzxseccgdmgtarhdunc)
2. Navigate to **Authentication** → **Users**
3. Click **"Add user"** → **"Create new user"**
4. Enter:
   - **Email:** `admin@test.edu`
   - **Password:** Your choice (min 6 chars)
   - ✅ Check **"Auto Confirm User"**
5. Click **"Create user"**

## ✅ Verifying Setup

### Check Configuration

```bash
node scripts/check-supabase-config.mjs
```

This will:

- Test Supabase connection
- Check environment variables
- Show common login issues
- Provide Supabase Dashboard URL

### Test Login

1. **Local:** http://localhost:3001/login
2. **Production:** https://educational-analyzer.vercel.app/login
3. **Preview:** Your preview URL

Enter test credentials and verify login works.

## 🔍 Troubleshooting

### Issue: "Invalid login credentials"

**Possible causes:**

1. **User doesn't exist**

   ```bash
   # Create user:
   node scripts/create-test-user.mjs
   ```

2. **Email not confirmed**
   - Go to Supabase Dashboard → Users
   - Find user, check "Email Confirmed" column
   - If ❌, re-run script (it auto-confirms)

3. **Wrong password**
   ```bash
   # Reset password:
   node scripts/create-test-user.mjs
   # (Detects existing user and updates password)
   ```

### Issue: Login works but redirects fail

**Solution:** Configure Redirect URLs in Supabase:

1. Go to Dashboard → Authentication → URL Configuration
2. Add to **"Redirect URLs"**:
   ```
   http://localhost:3000/**
   http://localhost:3001/**
   https://educational-analyzer.vercel.app/**
   https://*.vercel.app/**
   ```

### Issue: Preview deployment login fails

**Solutions:**

1. Add preview URL to Redirect URLs (see above)
2. Or use wildcard: `https://*.vercel.app/**`

### Issue: "Too many requests"

**Cause:** Rate limiting after multiple failed attempts

**Solution:** Wait 60 seconds or check Supabase Dashboard → Logs

## 📖 Additional Resources

### Supabase Dashboard URLs

- **Project:** https://app.supabase.com/project/bzzxseccgdmgtarhdunc
- **Users:** https://app.supabase.com/project/bzzxseccgdmgtarhdunc/auth/users
- **Auth Settings:** https://app.supabase.com/project/bzzxseccgdmgtarhdunc/auth/url-configuration

### Scripts

- `scripts/create-test-user.mjs` - Create/update test user
- `scripts/check-supabase-config.mjs` - Verify configuration

### Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://bzzxseccgdmgtarhdunc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>
```

## 🔒 Security Notes

- Test user is for **development only**
- Credentials are documented in `TEST_CREDENTIALS.md` (git ignored)
- Don't use test credentials in production with real data
- Change password if leaked publicly

## 🎓 Testing Features

Once logged in as test admin, you can test:

### Authentication

- ✅ Login/Logout
- ✅ Password reset flow
- ✅ Session persistence

### Custom Metrics

- ✅ Create/Edit/Delete metrics
- ✅ Save to database (vs LocalStorage for guests)
- ✅ Metrics persist across sessions

### Batch Upload

- ✅ Create programs
- ✅ Enumerate lessons
- ✅ Start batch analysis
- ✅ Real-time progress tracking
- ✅ Pause/Resume/Stop runs

### Analysis

- ✅ Run analysis with custom metrics
- ✅ View results
- ✅ Access analysis history

## 🔄 Recreating User

If you need to start fresh:

```bash
# Option 1: Delete and recreate
# 1. Delete from Supabase Dashboard
# 2. Run script:
node scripts/create-test-user.mjs

# Option 2: Just update password
node scripts/create-test-user.mjs
# (Script detects existing user and updates password)
```

## 📝 Notes

- Test user email: `admin@test.edu` (not a real domain)
- Email confirmation: Auto-confirmed by script
- Password: Generated and shown by script
- User metadata: `role: 'test_admin'`
- Works across: Local, Preview, Production
