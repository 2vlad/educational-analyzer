# Local Testing: Programs Page Authentication Fix

## 🧪 Testing Scenario

Test the authentication fix for the programs page to ensure:

1. Unauthenticated users are redirected to login
2. Authenticated users can access the programs page
3. API calls work correctly after authentication

## 📋 Test Steps

### 1. Test Unauthenticated Access (Should Fail)

**Expected:** Redirect to `/login`

```bash
# Check redirect
curl -I http://localhost:3003/programs
# Should return: HTTP/1.1 307 Temporary Redirect
# Location: /login

# Check API endpoint
curl http://localhost:3003/api/programs
# Should return: {"error":"Authentication required"}
```

### 2. Test Authenticated Access (Should Work)

**Manual Testing:**

1. Open browser: http://localhost:3003
2. Click "Login" or go to: http://localhost:3003/login
3. Enter test credentials:
   ```
   Email:    admin@test.edu
   Password: TestAdmin123!
   ```
4. After login, navigate to: http://localhost:3003/programs
5. **Expected Results:**
   - ✅ Page loads without redirect
   - ✅ Programs list appears (or empty state if no programs)
   - ✅ No console errors about "Failed to fetch programs"
   - ✅ Can create new program
   - ✅ Can view program details

### 3. Check Server Logs

While testing, watch the terminal where `npm run dev` is running:

**Expected logs when accessing `/programs` (authenticated):**

```
[GET /api/programs] Starting request { url: ..., headers: ... }
[GET /api/programs] Auth check: { hasUser: true, userId: '...', email: 'admin@test.edu' }
[GET /api/programs] Profile check: { hasProfile: true, profileEmail: 'admin@test.edu' }
[GET /api/programs] Programs query: { programCount: N, error: undefined }
[GET /api/programs] Success: { programCount: N }
```

**Expected logs when accessing `/programs` (unauthenticated):**

Should see middleware redirect (no API logs since redirect happens first)

### 4. Test API Endpoints Directly

After logging in via browser, test API with browser session:

**In Browser DevTools Console:**

```javascript
// Test GET programs
fetch('/api/programs')
  .then((r) => r.json())
  .then(console.log)
// Expected: { programs: [...] }

// Test GET single program (replace {id} with actual program ID)
fetch('/api/programs/{id}')
  .then((r) => r.json())
  .then(console.log)

// Test GET lessons (replace {id} with actual program ID)
fetch('/api/programs/{id}/lessons')
  .then((r) => r.json())
  .then(console.log)
```

## 🐛 Troubleshooting

### Issue: Login page shows "Invalid credentials"

**Solution:**

```bash
# Recreate test user
cd /Users/admin/Dev/educational-analyzer
node scripts/create-test-user.mjs
```

### Issue: Redirect loop after login

**Check:**

1. Supabase auth cookies are set (DevTools → Application → Cookies)
2. `middleware.ts` is not redirecting authenticated users
3. No errors in server logs

### Issue: "Failed to fetch programs" error persists

**Debug steps:**

1. Check browser Network tab for `/api/programs` request
2. Look at response status (should be 200, not 401)
3. Check server logs for authentication details
4. Verify cookies are being sent with request

### Issue: Empty programs list

**This is OK!** If you haven't created any programs yet, you'll see:

- Empty state message: "У вас пока нет программ"
- Button: "Создать первую программу"

Try creating a program:

1. Click "Создать первую программу"
2. Fill in program details
3. Click "Создать"
4. Program should appear in list

## ✅ Success Criteria

- [x] Unauthenticated access to `/programs` redirects to `/login`
- [x] Authenticated users can access `/programs`
- [x] API calls return data (or empty array)
- [x] No console errors about authentication
- [x] Server logs show proper authentication flow
- [x] Can create/view/delete programs

## 📊 Verification Results

### Before Fix

- ❌ Page loads but shows error "Failed to fetch programs"
- ❌ API returns 401 Unauthorized
- ❌ Console shows: "Failed to load programs: Error: Failed to fetch programs"

### After Fix

- ✅ Unauthenticated: Redirect to login
- ✅ Authenticated: Page loads successfully
- ✅ API returns programs data
- ✅ No authentication errors
- ✅ Comprehensive logs for debugging

## 🔄 Compare with Production

After local testing passes, compare behavior with production:

**Production (with issue):**

```bash
curl -I https://educational-analyzer.vercel.app/programs
# Before fix: May allow access without auth
# API call fails with 401
```

**Production (after deployment):**

```bash
curl -I https://educational-analyzer.vercel.app/programs
# After fix: Should redirect to login
```

## 📝 Test Report Template

Copy this when reporting test results:

```
## Test Results: Programs Authentication Fix

**Tester:** [Your Name]
**Date:** [Date]
**Environment:** Local (http://localhost:3003)

### Unauthenticated Access
- [ ] Redirect to /login: PASS/FAIL
- [ ] API returns 401: PASS/FAIL

### Authenticated Access
- [ ] Page loads: PASS/FAIL
- [ ] Programs list loads: PASS/FAIL
- [ ] No console errors: PASS/FAIL
- [ ] Can create program: PASS/FAIL

### Server Logs
- [ ] Authentication logs visible: PASS/FAIL
- [ ] No unexpected errors: PASS/FAIL

### Issues Found
[List any issues or unexpected behavior]

### Screenshots
[Attach screenshots if needed]
```
