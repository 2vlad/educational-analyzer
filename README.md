# Educational Analyzer

AI-сервис для анализа образовательного контента: одиночные проверки текстов и пакетная обработка учебных программ с трекингом прогресса.

## Возможности

- Анализ текста по метрикам качества (LX + пользовательские конфигурации метрик)
- Поддержка нескольких LLM-провайдеров (Anthropic, OpenAI, Gemini, Yandex, OpenRouter)
- Работа как для авторизованных пользователей, так и для гостей (session-based)
- История анализов, статусы выполнения и прогресс
- Программы/курсы: сбор уроков, запуск batch-анализа, pause/resume/stop
- Хранение внешних credentials (например, Yonote cookie) в зашифрованном виде

## Стек

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS
- Jest + Testing Library, Playwright

## Быстрый старт

1. Клонировать репозиторий и установить зависимости:

```bash
git clone https://github.com/2vlad/educational-analyzer.git
cd educational-analyzer
npm install
```

2. Создать локальный env:

```bash
cp .env.example .env.local
```

3. Заполнить `.env.local` (минимум):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_SECRET_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...

# хотя бы один LLM ключ
ANTHROPIC_API_KEY=...
# или OPENAI_API_KEY / GOOGLE_API_KEY / YANDEX_API_KEY (+YANDEX_FOLDER_ID)

# CORS allowlist для cross-origin API вызовов (опционально)
# CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://admin.your-app.com
```

Примечания:
- В коде поддерживается и `SUPABASE_SERVICE_KEY`, но рекомендуется использовать `SUPABASE_SERVICE_ROLE_KEY`.
- Для локальной разработки предпочтительнее `npm run dev:clean`, чтобы системные ключи не перекрывали `.env.local`.

4. Применить миграции в Supabase (в порядке):

- `migrations/0001_init.sql`
- `migrations/0002_multi_user_support.sql`
- `migrations/20250122_programs_batch_analyzer.sql`
- `migrations/20250128_add_session_tracking.sql`

5. Запустить приложение:

```bash
npm run dev:clean
```

Открыть `http://localhost:3000`.

## Основные скрипты

```bash
# Development
npm run dev
npm run dev:clean
npm run build
npm run build:clean
npm run start

# Quality
npm run lint
npm run typecheck
npm run format
npm run ci

# Tests
npm run test
npm run test:watch
npm run test:coverage
npm run e2e
npm run e2e:ui
```

## Архитектура (кратко)

- `app/`: маршруты Next.js, API (`app/api/**/route.ts`) и страницы
- `src/services/`: бизнес-логика, интеграции провайдеров и job processing
- `src/lib/supabase/`: браузерный/серверный Supabase-клиенты
- `components/`: переиспользуемые UI-компоненты
- `migrations/`: SQL-миграции (с RLS/policies)
- `worker/`: отдельный воркер для фоновой обработки (опционально)

## Деплой

- Основной таргет: Vercel (`vercel.json`)
- Для batch-обработки предусмотрен cron endpoint: `/api/worker/tick`
- Документация: `docs/DEPLOYMENT.md`, `docs/SUPABASE_AUTH_SETUP.md`

## Security (MVP) — ревью от 2026-02-16

Текущая оценка: **7/10**.

Вывод: для внутреннего MVP (ограниченные пользователи) можно использовать. Для публичного запуска нужен дополнительный hardening.

Что уже исправлено:

1. Удалены публичные debug/test endpoints (`/api/debug-env`, `/api/test`).
2. Закрыт IDOR для `GET /api/analysis/[id]` и `GET /api/progress/[id]`: добавлена проверка owner/session.
3. Убран wildcard CORS из `vercel.json`, CORS в middleware переведен на allowlist.
4. Исправлены server-side вызовы Supabase клиентов без `await` в критичных местах (`analyze-v2`, `history`, `rate-limit`).
5. Для `/api/worker/tick` добавлена строгая проверка `CRON_SECRET` в production.
6. Убрано чувствительное логирование key-prefixes и сырых request headers в API.

Оставшиеся риски:

1. Риски в модели гостевого доступа на уровне RLS (`user_id IS NULL`) требуют усиления политик:
   - `migrations/20250128_add_session_tracking.sql`
2. Нет обязательного rate limit на `POST /api/analyze`, `POST /api/analyze-coherence`, `POST /api/parse-pdf`.
3. Нужно включить и поддерживать `CRON_SECRET` во всех production окружениях и cron-интеграциях.

Минимальный следующий hardening:

1. Усилить RLS для guest-данных (связка через server-validated session key, а не только `user_id IS NULL`).
2. Добавить rate limiting на все expensive публичные endpoint’ы.
3. Проверить конфигурацию cron-провайдера на передачу `Authorization: Bearer <CRON_SECRET>`.
4. Добавить security regression tests на IDOR/CORS/debug exposure.

## Лицензия

Проект распространяется как private/proprietary.
