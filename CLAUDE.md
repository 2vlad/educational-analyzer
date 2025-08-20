# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Educational Analyzer - A multi-user SaaS platform for analyzing educational content quality using AI. The system allows users to:
- Create personal accounts and manage their own analysis metrics
- Customize evaluation cards and prompts
- Save and view analysis history
- Operate in Guest Mode without authentication

## Tech Stack

- **Frontend**: Next.js 15.2.4 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **AI Providers**: Anthropic Claude, OpenAI GPT, Google Gemini, Yandex
- **Testing**: Jest, Playwright
- **Deployment**: Vercel

## Key Commands

```bash
# Development
npm run dev           # Start development server
npm run dev:clean     # Clean start with ./start.sh

# Building & Production
npm run build         # Build for production
npm run build:clean   # Clean build with ./build.sh
npm run start         # Start production server

# Testing & Quality
npm run test          # Run unit tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run e2e           # Run Playwright E2E tests
npm run e2e:ui        # Run E2E tests with UI

# Code Quality
npm run lint          # Run ESLint
npm run typecheck     # TypeScript type checking
npm run format        # Format with Prettier
npm run ci            # Run all checks (lint, typecheck, test, build)

# Task Management (if Task Master is installed)
task-master next      # Get next task
task-master show <id> # View task details
task-master set-status --id=<id> --status=done # Complete task
```

## Architecture

### Directory Structure

```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints
│   │   ├── analyze/       # Analysis endpoint
│   │   └── configuration/ # User metric configurations (to be implemented)
│   └── (routes)/          # Application pages
├── src/
│   ├── services/          # Business logic
│   │   └── LLMService.ts  # AI model integration
│   ├── providers/         # AI provider implementations
│   │   ├── claude.ts
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   └── yandex.ts
│   ├── utils/
│   │   ├── prompts.ts     # Prompt management
│   │   └── logger.ts      # Logging utilities
│   └── config/
│       ├── env.ts         # Environment configuration
│       └── models.ts      # Model management
├── components/            # React components
├── lib/                   # Utilities and Supabase client
├── migrations/            # Database migrations
└── prompts/              # AI prompt templates by provider
```

### Current Metrics

The system currently uses 5 hardcoded metrics:
1. **logic** - Logical structure and argumentation
2. **practical** - Practical applicability
3. **complexity** - Content depth and complexity
4. **interest** - Engagement and interest level
5. **care** - Attention to detail and quality

These will be migrated to database-driven configurations.

## Multi-User Implementation Plan

Based on PRD-2.txt, the implementation follows these stages:

### Stage 1: Database Schema Setup (Task ID: 1)
- Create `profiles` table linked to auth.users
- Create `metric_configurations` table for storing metrics
- Modify `analyses` table to add user_id and configuration_snapshot
- Implement database triggers for user onboarding

### Stage 2: Core Refactoring (Tasks 5-6)
- Refactor LLMService to accept dynamic metric configurations
- Update /api/analyze to support authenticated users
- Implement configuration snapshot saving

### Stage 3: Authentication (Tasks 7-8)
- Integrate Supabase Auth with Next.js
- Create login/registration UI components
- Implement session management

### Stage 4: User Features (Tasks 9-11)
- Configuration management API endpoints
- Settings interface for metric customization
- Analysis history page with configuration snapshots

## Database Schema

### Key Tables

```sql
-- User profiles
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  created_at TIMESTAMPTZ
)

-- Metric configurations
metric_configurations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id), -- NULL for defaults
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT NOT NULL
)

-- Analysis history
analyses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id), -- NULL for guests
  configuration_snapshot JSONB, -- Stores metrics used
  content TEXT,
  results JSONB,
  created_at TIMESTAMPTZ
)
```

## Development Guidelines

### Working with Supabase

1. **Row Level Security (RLS)**: Always enabled on user tables
2. **Authentication**: Use @supabase/ssr for server-side auth
3. **Migrations**: Version control all schema changes
4. **Triggers**: Automated user onboarding via handle_new_user()

### API Development

1. All user-specific endpoints should verify authentication
2. Use RLS policies instead of manual authorization checks
3. Implement proper error handling with specific HTTP status codes
4. Add rate limiting per user (IP for guests)

### Frontend Patterns

1. Use React Query/SWR for data fetching with caching
2. Implement optimistic updates for better UX
3. Show loading states and handle errors gracefully
4. Maintain guest mode functionality alongside user features

### Testing Strategy

1. Unit tests for business logic (Jest)
2. Integration tests for API endpoints
3. E2E tests for critical user flows (Playwright)
4. Test both authenticated and guest modes

## Important Considerations

### Security
- Never expose API keys in client-side code
- Validate all user inputs, especially prompts
- Implement prompt injection prevention
- Use HTTPS in production

### Performance
- Cache default configurations
- Implement pagination for history
- Use database indexes on frequently queried columns
- Optimize prompt lengths for AI providers

### Backward Compatibility
- Maintain full guest mode functionality
- Existing analyses must remain accessible
- Default metrics available to all users
- Gradual migration without breaking changes

## Environment Variables

Required in `.env.local`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
```

## Task Master Integration

This project uses Task Master AI for task management. Key tasks are tracked in `.taskmaster/tasks/tasks.json`. Use the Task Master commands to navigate and complete implementation tasks systematically.

## Design References

The UI implementation follows the designs provided in:
- design-1.png, design-2.png: Analysis results interface
- design-3.png: Settings/configuration interface
- design-4.png: Authentication interface

Key UI elements:
- Metric cards with +1/0/-1 scoring
- Overall result display
- User account menu in top-right
- Settings page with editable metric list