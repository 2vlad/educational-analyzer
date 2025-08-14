# API Key Loading Issue - FIXED

## Problem

The application was failing with "Authentication failed" errors because it was loading a placeholder API key (`your-claude-api-key-here`) instead of the actual API keys from `.env.local`.

## Root Cause

There was a system-level environment variable `ANTHROPIC_API_KEY` set to `"your-claude-api-key-here"` that was overriding the values in the `.env` files.

In Next.js, the environment variable precedence is:

1. System environment variables (highest priority)
2. `.env.production` (in production mode)
3. `.env.local`
4. `.env`

Since there was a system-level `ANTHROPIC_API_KEY` variable, it was taking precedence over the correct value in `.env.local`.

## Solution

### Quick Fix (Temporary)

Run the development server without the system environment variable:

```bash
env -u ANTHROPIC_API_KEY npm run dev
```

Or for building:

```bash
env -u ANTHROPIC_API_KEY npm run build
```

### Permanent Fix

1. **Use the provided scripts** that automatically clear interfering environment variables:

   ```bash
   npm run dev:clean    # For development
   npm run build:clean  # For building
   ```

2. **Or use the shell scripts directly**:

   ```bash
   ./start.sh  # Starts dev server with clean environment
   ./build.sh  # Builds with clean environment
   ```

3. **To permanently remove the system environment variable**, add this to your shell profile (`~/.zshrc` or `~/.bash_profile`):
   ```bash
   unset ANTHROPIC_API_KEY
   ```

## Verification

After applying the fix, you can verify it's working by:

1. Check the API health endpoint:

   ```bash
   curl http://localhost:3000/api/health | jq .
   ```

   Should show `"hasAnthropicKey": true`

2. Check the build output - it should show the actual API key prefix:

   ```
   🔑 Claude Provider: Initializing with API key: sk-ant-api03-bJb4LRL...
   ```

   NOT:

   ```
   🔑 Claude Provider: Initializing with API key: your-claude-api-key-...
   ```

## Prevention

- Always use `npm run dev:clean` or `npm run build:clean` instead of the regular commands
- Be cautious about setting API keys as system environment variables
- Check for conflicting environment variables with: `env | grep ANTHROPIC`
  EOF < /dev/null
