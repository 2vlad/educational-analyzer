# Лёха AI - Educational Content Analyzer

An AI-powered educational content analyzer that evaluates IT learning materials based on LX-metrics.

## Features

- 📚 Analyzes educational content for IT/programming materials
- 🎯 Evaluates 6 key metrics: Logic, Practical Value, Complexity, Interest, Care, and Cognitive Load
- 📄 Supports text input and PDF file uploads
- 🤖 Multiple LLM providers (Claude, GPT-4, Gemini, Yandex)
- 📊 Beautiful visual results with detailed analysis
- 🚀 Fast and responsive interface

## Tech Stack

- **Framework**: Next.js 15.2.4
- **Language**: TypeScript
- **Database**: Supabase
- **Styling**: Tailwind CSS
- **LLM Providers**: Anthropic Claude, OpenAI, Google Gemini, Yandex GPT
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- At least one LLM API key (Anthropic, OpenAI, Google, or Yandex)

## Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/2vlad/educational-analyzer.git
   cd educational-analyzer
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your actual values:

   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key

   # LLM API Keys (at least one required)
   ANTHROPIC_API_KEY=your_anthropic_api_key
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_API_KEY=your_google_api_key
   YANDEX_API_KEY=your_yandex_api_key
   YANDEX_FOLDER_ID=your_yandex_folder_id

   # Default model (optional)
   DEFAULT_MODEL=yandex-gpt-pro
   ```

4. **Set up Supabase database**

   Run the migration script in your Supabase SQL editor:

   ```sql
   -- See migrations/0001_init.sql
   ```

5. **Run the development server**

   ```bash
   npm run dev
   # or
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### Method 1: Deploy with Vercel CLI

1. **Install Vercel CLI**

   ```bash
   npm i -g vercel
   ```

2. **Deploy**

   ```bash
   vercel
   ```

   Follow the prompts to:
   - Link to your Vercel account
   - Create a new project or link to existing
   - Configure environment variables

### Method 2: Deploy via GitHub

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables in the Vercel dashboard

### Required Environment Variables in Vercel

Add these in your Vercel project settings under "Environment Variables":

| Variable                        | Description               | Required        |
| ------------------------------- | ------------------------- | --------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL | ✅              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key    | ✅              |
| `SUPABASE_SERVICE_KEY`          | Supabase service role key | ✅              |
| `ANTHROPIC_API_KEY`             | Anthropic Claude API key  | ⚠️ At least one |
| `OPENAI_API_KEY`                | OpenAI API key            | ⚠️ At least one |
| `GOOGLE_API_KEY`                | Google Gemini API key     | ⚠️ At least one |
| `YANDEX_API_KEY`                | Yandex GPT API key        | ⚠️ At least one |
| `YANDEX_FOLDER_ID`              | Yandex folder ID          | If using Yandex |
| `DEFAULT_MODEL`                 | Default LLM model         | Optional        |

### Vercel Configuration

The project includes a `vercel.json` file with:

- Increased function timeout (60s) for analysis endpoints
- CORS headers for API routes
- Optimized build settings

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run typecheck    # Run TypeScript checks
```

## API Endpoints

- `POST /api/analyze` - Analyze educational content
- `GET /api/analysis/[id]` - Get analysis results
- `GET /api/models` - Get available LLM models
- `POST /api/parse-pdf` - Parse PDF files
- `GET /api/health` - Health check endpoint

## Project Structure

```
educational-analyzer/
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   ├── page.tsx         # Main page component
│   └── layout.tsx       # Root layout
├── components/          # React components
├── src/                 # Source code
│   ├── services/        # Business logic
│   ├── providers/       # LLM providers
│   ├── utils/          # Utilities
│   └── types/          # TypeScript types
├── prompts/            # LLM prompts for each metric
├── public/             # Static assets
└── migrations/         # Database migrations
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary and confidential.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for better educational content
