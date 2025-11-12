#!/bin/bash

# Start worker with environment variables from .env.local

set -e

# Load .env.local
if [ -f .env.local ]; then
    echo "📦 Loading environment from .env.local..."
    export $(grep -v '^#' .env.local | grep -E '^[A-Z_]+=.' | xargs)
else
    echo "❌ .env.local not found!"
    exit 1
fi

# Validate required variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not set!"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY not set!"
    exit 1
fi

if [ -z "$APP_SECRET_KEY" ]; then
    echo "❌ APP_SECRET_KEY not set!"
    exit 1
fi

# Set API_URL if not set
if [ -z "$API_URL" ]; then
    export API_URL="http://localhost:3002"
fi

echo "✅ Environment variables loaded"
echo "   SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "   API_URL: $API_URL"
echo ""

# Start worker
cd worker
npm start
