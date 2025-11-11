# Password Reset Feature

## Overview

Functionality for users to reset their forgotten passwords using Supabase Auth.

## Flow

1. **User clicks "Forgot password?" on login page** → `/forgot-password`
2. **User enters email** → Supabase sends reset email
3. **User clicks link in email** → Redirected to `/reset-password` with token
4. **User enters new password** → Password updated
5. **Redirect to login** → User can log in with new password

## Pages

### `/forgot-password`
- Email input form
- Sends password reset email via `supabase.auth.resetPasswordForEmail()`
- Success message after sending

### `/reset-password`
- Password input form (new password + confirmation)
- Validates token from email link
- Updates password via `supabase.auth.updateUser()`
- Redirects to `/login` on success

### `/login`
- Added "Forgot password?" link next to password field

## Supabase Configuration

The redirect URL is set to: `{APP_URL}/reset-password`

Where `APP_URL` is:
- Production: `https://your-app.vercel.app`
- Preview: `https://preview-deployment.vercel.app`
- Development: `http://localhost:3000`

This is handled automatically by `getAuthCallbackUrl()` helper.

## Supabase Dashboard Settings

Make sure these URLs are added to **Redirect URLs** in Supabase Dashboard:

```
https://your-app.vercel.app/reset-password
http://localhost:3000/reset-password
```

## Security

- Reset links expire after 1 hour (Supabase default)
- Password must be minimum 6 characters
- Password confirmation required
- Token validation on reset page

## Email Template

Supabase sends email with:
- Subject: "Reset Your Password"
- Link: `https://your-app.vercel.app/reset-password?token=...`

You can customize the email template in Supabase Dashboard → Authentication → Email Templates.

## Testing

### Local Testing

1. Start dev server: `npm run dev`
2. Go to http://localhost:3000/login
3. Click "Forgot password?"
4. Enter email
5. Check email for reset link (Supabase sends to real email)
6. Click link → should open `/reset-password`
7. Enter new password
8. Should redirect to `/login`
9. Log in with new password

### Production Testing

Same flow but use production URL.

## Error Handling

- Invalid/expired token → Shows error message
- Email not found → Email still sent (security: don't reveal if email exists)
- Weak password → Shows validation error
- Password mismatch → Shows validation error

## UI/UX

- Clear success messages
- Loading states on buttons
- Password visibility toggle (eye icon)
- Back navigation to login
- Auto-redirect after success

## Dependencies

- Supabase Auth (built-in)
- UI components: Button, Input, Label, Alert
- Icons: lucide-react (Eye, EyeOff, ArrowLeft)

## Future Enhancements

- Email deliverability check
- Password strength indicator
- Rate limiting on reset requests
- Custom email templates
- Magic link login as alternative
