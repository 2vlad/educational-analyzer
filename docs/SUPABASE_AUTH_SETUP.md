# Настройка Supabase Authentication для Production

Эта инструкция объясняет, как правильно настроить redirect URLs для Supabase Auth, чтобы письма подтверждения вели на production URL, а не на localhost.

## Проблема

При регистрации пользователи получают письма со ссылками вида `http://localhost:3000`, которые не работают в production.

## Решение

### 1. Настройте Environment Variables

В Vercel (или другом хостинге) добавьте переменную окружения:

```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Где найти:**
- Vercel: Settings → Environment Variables
- Railway: Variables tab
- Netlify: Site settings → Build & deploy → Environment

**Важно:** Замените `https://your-app.vercel.app` на ваш реальный production URL.

### 2. Настройте Supabase Dashboard

#### 2.1 Site URL

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в **Authentication** → **URL Configuration**
4. В поле **Site URL** укажите ваш production URL:
   ```
   https://your-app.vercel.app
   ```

#### 2.2 Redirect URLs

В разделе **Redirect URLs** добавьте следующие URL:

```
https://your-app.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

**Почему два URL:**
- Production URL: для работы в продакшене
- Localhost URL: для разработки и тестирования

### 3. Для разработки

Создайте файл `.env.local` в корне проекта:

```bash
# .env.local (не коммитить!)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# App URL - для localhost
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ... остальные переменные
```

## Проверка настроек

### 1. Проверьте код

Убедитесь, что код использует `getAuthCallbackUrl()` вместо `window.location.origin`:

```typescript
// ✅ Правильно
import { getAuthCallbackUrl } from '@/src/utils/url'

const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: getAuthCallbackUrl(),
  },
})

// ❌ Неправильно
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})
```

### 2. Тестирование

#### Локально:
1. Запустите `npm run dev`
2. Зарегистрируйте тестового пользователя
3. Проверьте письмо - ссылка должна вести на `http://localhost:3000`

#### Production:
1. Деплой на Vercel/Railway/etc
2. Зарегистрируйте пользователя через production URL
3. Проверьте письмо - ссылка должна вести на ваш production URL

## Troubleshooting

### Проблема: Письма все еще ведут на localhost

**Решение:**
1. Проверьте, что `NEXT_PUBLIC_APP_URL` установлена в Vercel
2. Перезапустите деплой после добавления переменной
3. Очистите кэш браузера

### Проблема: "Invalid redirect URL" error

**Решение:**
1. Убедитесь, что URL добавлен в Supabase Dashboard → Redirect URLs
2. URL должен точно совпадать (включая https/http и trailing slash)
3. Подождите 1-2 минуты после изменения настроек в Supabase

### Проблема: OAuth (Google/GitHub) не работает

**Решение:**
1. Добавьте ваш production URL в OAuth provider настройки:
   - Google: [Google Cloud Console](https://console.cloud.google.com)
   - GitHub: Settings → Developer settings → OAuth Apps
2. Добавьте callback URL: `https://your-project.supabase.co/auth/v1/callback`

## Дополнительная информация

### Как работает редирект

1. Пользователь регистрируется через форму
2. Код вызывает `getAuthCallbackUrl()` который:
   - В production возвращает `NEXT_PUBLIC_APP_URL`
   - В development возвращает `window.location.origin`
3. Supabase отправляет письмо со ссылкой на этот URL
4. Пользователь кликает ссылку → редирект на `/auth/callback`
5. Callback route обрабатывает токен и авторизует пользователя

### Security Notes

- **NEXT_PUBLIC_** переменные видны в браузере
- Не храните секреты в NEXT_PUBLIC_ переменных
- Используйте HTTPS в production
- Регулярно обновляйте список Redirect URLs

## Полезные ссылки

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
