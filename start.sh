#\!/bin/bash

# Start script for Educational Analyzer
# This script ensures that system-level environment variables don't override .env files

echo "🚀 Starting Educational Analyzer..."
echo "📝 Clearing any system-level ANTHROPIC_API_KEY to use .env files instead"

# Unset any system-level API keys that might interfere
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
unset GOOGLE_API_KEY
unset YANDEX_API_KEY
unset YANDEX_FOLDER_ID

# Run the development server
echo "✅ Starting Next.js development server..."
npm run dev
