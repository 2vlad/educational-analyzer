# Coherence Analysis Fix - 2025-11-12

## Проблема

Анализ связности уроков не работает на production (`https://edu-ai-student-4.vercel.app`).

### Симптомы

- Frontend показывает ошибку: `Failed to analyze coherence: Error: Coherence analysis failed`
- API возвращает: `"Не удалось получить структурированный анализ связности уроков"`

## Диагностика

### 1. OPENROUTER_API_KEY не доступен на production

**Проблема:** Переменная окружения `OPENROUTER_API_KEY` установлена в Vercel, но не доступна в runtime.

**Проверка:**

```bash
curl https://edu-ai-student-4.vercel.app/api/debug-env
```

**Результат:**

```json
{
  "envVars": {
    "OPENROUTER_API_KEY": "NOT SET",
    "ANTHROPIC_API_KEY": "SET (length: 108)",
    "OPENAI_API_KEY": "SET (length: 164)",
    "YANDEX_API_KEY": "SET (length: 41)"
  }
}
```

**Почему это проблема:**

- OpenRouter является основным провайдером для Claude, GPT, Gemini
- Без OpenRouter coherence analysis падает на fallback - Yandex
- Yandex не всегда возвращает JSON в правильном формате

### 2. Fallback на Yandex не работает корректно

**Проблема:** Yandex возвращает текст, который не парсится как JSON.

**Текущий код:**

```typescript
// src/services/LLMService.ts
if (!env.server?.OPENROUTER_API_KEY) {
  console.log('[Coherence Analysis] OpenRouter not available, will use Yandex as fallback')
  forcedModelId = 'yandex-gpt-pro'
  useYandexFallback = true
}
```

## Решение

### Вариант 1: Исправить OPENROUTER_API_KEY в Vercel (РЕКОМЕНДУЕТСЯ)

1. **Проверить переменную в Vercel dashboard:**

   ```bash
   vercel env ls | grep OPENROUTER
   ```

   Результат: `OPENROUTER_API_KEY    Encrypted    Production, Preview, Development`

2. **Пересоздать переменную:**

   ```bash
   # Удалить (требует подтверждения в интерактивном режиме)
   vercel env rm OPENROUTER_API_KEY production

   # Добавить заново
   echo "sk-or-v1-..." | vercel env add OPENROUTER_API_KEY production
   ```

3. **Триггернуть redeploy:**
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

### Вариант 2: Улучшить Yandex fallback

**Уже сделано в commit a141e7b:**

- Упрощен промпт для coherence analysis
- Добавлено подробное логирование ответа Yandex
- Уменьшена температура и maxTokens

**Промпт изменен с:**

```
Ты — эксперт по учебным программам. Проанализируй связность...
КРИТИЧЕСКИ ВАЖНО:
1. Твой ответ должен быть ТОЛЬКО валидным JSON объектом
2. Никакого текста до или после JSON
...
```

**На:**

```
Проанализируй связность и последовательность N уроков.

ВАЖНО: Верни ТОЛЬКО JSON объект без дополнительного текста.

Формат:
{
  "score": число от -2 до 2,
  "summary": "краткое описание",
  ...
}
```

### Вариант 3: Использовать прямой Anthropic API

**Проблема:** Direct Anthropic API также не работает на production:

```
"Authentication failed"
```

Хотя `ANTHROPIC_API_KEY` показан как `SET (length: 108)`.

## Текущий статус

**Изменения задеплоены:**

- ✅ Упрощен промпт для Yandex
- ✅ Добавлено детальное логирование
- ✅ Debug endpoint показывает все env переменные

**Ожидает тестирования:**

- Проверить, работает ли Yandex fallback с новым промптом
- Получить логи Vercel для анализа ответа Yandex

**TODO:**

- Исправить OPENROUTER_API_KEY на production
- Если Yandex не работает, рассмотреть использование OpenAI напрямую

## Коммиты

```
a141e7b Improve coherence analysis prompt and logging for Yandex
9321cc7 Force deploy with updated debug endpoint
ed369f6 Debug: show more env variable details
dcb858c Trigger redeploy to refresh environment variables
cac377b Use Yandex as fallback for coherence analysis when OpenRouter unavailable
1c5f864 Add detailed error logging to coherence analysis
05ecf3c Fix coherence analysis: fallback to direct Anthropic API when OpenRouter unavailable
37ba50b Add debug endpoint for environment variables
```

## Тестирование

```bash
# Test coherence analysis
curl -X POST "https://edu-ai-student-4.vercel.app/api/analyze-coherence" \
  -H "Content-Type: application/json" \
  -d '{
    "lessons": [
      {"title": "Урок 1", "content": "Текст первого урока"},
      {"title": "Урок 2", "content": "Текст второго урока"}
    ]
  }'

# Check environment variables
curl https://edu-ai-student-4.vercel.app/api/debug-env | jq .

# Check provider health
curl https://edu-ai-student-4.vercel.app/api/health | jq .
```

## Рекомендации

1. **Приоритет 1:** Исправить OPENROUTER_API_KEY в Vercel
2. **Приоритет 2:** Протестировать Yandex fallback с новым промптом
3. **Приоритет 3:** Если оба не работают, использовать OpenAI напрямую (ключ доступен)
