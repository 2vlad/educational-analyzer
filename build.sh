#\!/bin/bash

# Build script for Educational Analyzer
# This script ensures that system-level environment variables don't override .env files

echo "🚀 Building Educational Analyzer..."
echo "📝 Clearing any system-level API keys to use .env files instead"

# Unset any system-level API keys that might interfere
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
unset GOOGLE_API_KEY

# Run the build
echo "✅ Starting Next.js build..."
npm run build
