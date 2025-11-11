# 🔧 Worker Setup Guide

## 📋 Проблема

Для обработки пачных анализов нужен **worker**, который:
1. Берет задачи из очереди (`analysis_jobs`)
2. Обрабатывает их через LLM
3. Сохраняет результаты в `analyses`

**Без worker:** задачи создаются, но не обрабатываются.

---

## ✅ **Решения для Vercel:**

### **Вариант 1: Vercel Cron Jobs** ⭐ (РЕКОМЕНДУЕТСЯ)

#### **Что это:**
Vercel может автоматически вызывать API endpoint по расписанию.

#### **Конфигурация:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/worker/tick",
      "schedule": "* * * * *"  // Каждую минуту
    }
  ]
}
```

✅ **Уже добавлено в проект!**

#### **Как работает:**
1. Каждую минуту Vercel вызывает `GET /api/worker/tick`
2. Endpoint обрабатывает **одну задачу** из очереди
3. Если задач много, следующий tick обработает еще одну
4. Постепенно вся очередь обрабатывается

#### **Ограничения:**

⚠️ **Доступно только на Pro/Enterprise планах!**

| План | Cron Jobs | Стоимость |
|------|-----------|-----------|
| **Hobby** | ❌ Нет | Бесплатно |
| **Pro** | ✅ Да | $20/месяц |
| **Enterprise** | ✅ Да | Индивидуально |

**Проверить план:**
```bash
vercel teams list
```

#### **Активация:**

1. **Обновите план на Pro** (если Hobby)
2. **Деплой с cron configuration:**
   ```bash
   git push origin feature/batch-upload-ui
   # Vercel автоматически настроит cron
   ```

3. **Проверить в Vercel Dashboard:**
   - Settings → Cron Jobs
   - Должен появиться `/api/worker/tick` (every 1 minute)

#### **Плюсы:**
- ✅ Автоматический запуск
- ✅ Нет дополнительной инфраструктуры
- ✅ Встроен в Vercel

#### **Минусы:**
- ❌ Требует Pro план
- ⚠️ Обрабатывает только 1 задачу за раз (медленно для больших очередей)
- ⚠️ Timeout 60 секунд (Pro) / 10 секунд (Hobby)

---

### **Вариант 2: External Cron Service** 💰 (Бесплатная альтернатива)

Используйте внешний сервис для вызова endpoint каждую минуту.

#### **Сервисы:**

**2.1. EasyCron** (бесплатно до 20 cron jobs)
- Сайт: https://www.easycron.com
- План: Free (20 jobs, 1-minute interval)
- Настройка:
  1. Зарегистрироваться
  2. Create Cron Job:
     - URL: `https://your-app.vercel.app/api/worker/tick`
     - Schedule: Every 1 minute
     - Method: GET

**2.2. Cron-Job.org** (бесплатно)
- Сайт: https://cron-job.org
- План: Free (unlimited jobs, 1-minute interval)
- Настройка: аналогично EasyCron

**2.3. UptimeRobot** (бесплатно, 50 monitors)
- Сайт: https://uptimerobot.com
- Настройка:
  1. Add Monitor → HTTP(s)
  2. URL: `https://your-app.vercel.app/api/worker/tick`
  3. Interval: 1 minute

#### **Плюсы:**
- ✅ Бесплатно
- ✅ Работает на Hobby плане Vercel
- ✅ Легко настроить

#### **Минусы:**
- ⚠️ Зависимость от внешнего сервиса
- ⚠️ Может быть ненадежно

---

### **Вариант 3: GitHub Actions** 🔄 (Для GitHub)

Запускайте worker через GitHub Actions cron.

#### **Создайте файл:**
```yaml
# .github/workflows/worker.yml
name: Worker Tick

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:  # Manual trigger

jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Call worker endpoint
        run: |
          curl -X GET https://your-app.vercel.app/api/worker/tick
```

#### **Плюсы:**
- ✅ Бесплатно
- ✅ Встроено в GitHub
- ✅ Контроль версий

#### **Минусы:**
- ⚠️ Минимальный интервал: **5 минут** (не 1 минута!)
- ⚠️ Может запускаться с задержкой

---

### **Вариант 4: Dedicated Server** 🖥️ (Надежный)

Запустите worker на отдельном сервере.

#### **Подходящие платформы:**

**4.1. Railway** (рекомендуется)
- План: $5/месяц
- Настройка:
  ```bash
  # Создайте worker service
  railway up
  # Установите переменные окружения
  railway variables set APP_SECRET_KEY=...
  # Deploy
  railway deploy
  ```

**4.2. Render** (бесплатный tier)
- План: Free (ограничения на CPU)
- Background Worker поддерживается

**4.3. Fly.io** (бесплатный tier)
- План: Free (limited resources)

#### **Код worker (Node.js):**
```javascript
// worker.js
import { createClient } from '@supabase/supabase-js'
import { JobRunner } from './src/services/JobRunner.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const runner = new JobRunner(supabase, process.env.APP_SECRET_KEY)

// Run every 5 seconds
setInterval(async () => {
  try {
    await runner.processNextJob()
  } catch (error) {
    console.error('Worker error:', error)
  }
}, 5000)
```

#### **Плюсы:**
- ✅ Полный контроль
- ✅ Быстрая обработка (каждые 5 секунд)
- ✅ Параллельная обработка возможна
- ✅ Нет timeout ограничений

#### **Минусы:**
- ❌ Дополнительная стоимость
- ⚠️ Требует настройки инфраструктуры

---

### **Вариант 5: Локальный Worker** 💻 (Для разработки)

Запустите worker на своем компьютере.

#### **Шаги:**

1. **Клонируйте проект**
2. **Настройте `.env.local`:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   APP_SECRET_KEY=...
   ANTHROPIC_API_KEY=...  # или другие LLM ключи
   ```

3. **Запустите worker:**
   ```bash
   # Вариант A: Через Node.js
   node scripts/run-worker.js

   # Вариант B: Через npm script
   npm run worker

   # Вариант C: Curl в бесконечном цикле
   while true; do
     curl http://localhost:3000/api/worker/tick
     sleep 5
   done
   ```

#### **Плюсы:**
- ✅ Бесплатно
- ✅ Быстро для тестов
- ✅ Полный контроль

#### **Минусы:**
- ❌ Только для разработки
- ❌ Компьютер должен быть включен

---

## 🎯 **Рекомендации:**

### **Для Production:**

| Ситуация | Решение |
|----------|---------|
| **Есть Vercel Pro** | ✅ Vercel Cron Jobs |
| **Hobby план** | ✅ EasyCron / Cron-Job.org |
| **Критичная нагрузка** | ✅ Railway / Render |
| **GitHub проект** | ✅ GitHub Actions (5 min) |

### **Для Development:**

| Ситуация | Решение |
|----------|---------|
| **Локальное тестирование** | ✅ `npm run worker` |
| **Preview deployments** | ✅ EasyCron / UptimeRobot |

---

## 📊 **Производительность:**

| Решение | Интервал | Задач/час | Латентность |
|---------|----------|-----------|-------------|
| Vercel Cron (1 min) | 1 мин | 60 | Средняя |
| External Cron | 1 мин | 60 | Средняя |
| GitHub Actions | 5 мин | 12 | Высокая |
| Dedicated Worker (5 sec) | 5 сек | 720 | Низкая |
| Локальный (1 sec) | 1 сек | 3600 | Минимальная |

---

## 🔐 **Безопасность:**

### **Vercel Cron Jobs:**
```typescript
// app/api/worker/tick/route.ts
export async function GET(request: NextRequest) {
  // Vercel автоматически добавляет заголовок
  const authHeader = request.headers.get('authorization')
  
  if (process.env.NODE_ENV === 'production' && !authHeader?.includes('Bearer')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ... обработка
}
```

### **External Cron:**
Добавьте защиту:

```typescript
// app/api/worker/tick/route.ts
const WORKER_SECRET = process.env.WORKER_SECRET

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-worker-secret')
  
  if (secret !== WORKER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ... обработка
}
```

Настройте в EasyCron:
- Custom Headers: `x-worker-secret: your-secret-here`

---

## ✅ **Быстрый старт (EasyCron):**

1. **Зарегистрируйтесь:** https://www.easycron.com/user/register
2. **Create Cron Job:**
   - Cron Expression: `* * * * *` (every minute)
   - URL: `https://educational-analyzer-xxx.vercel.app/api/worker/tick`
   - HTTP Method: GET
3. **Save & Enable**
4. **Готово!** Worker обрабатывает задачи каждую минуту

---

## 🧪 **Тестирование:**

### **Проверить что worker работает:**

1. **Запустите анализ** через UI
2. **Проверьте логи:**
   ```bash
   vercel logs --follow
   # Должны видеть "Processing job..." каждую минуту
   ```

3. **Проверьте базу:**
   ```sql
   SELECT status, COUNT(*) 
   FROM analysis_jobs 
   GROUP BY status;
   ```

4. **Проверьте ProgressTracker** - прогресс должен увеличиваться

---

## 🆘 **Troubleshooting:**

### **Worker не обрабатывает задачи:**

1. **Проверьте cron вызывается:**
   - Vercel Dashboard → Logs
   - Должны видеть GET requests к `/api/worker/tick`

2. **Проверьте ошибки:**
   ```bash
   vercel logs | grep error
   ```

3. **Проверьте переменные окружения:**
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_SECRET_KEY`
   - API ключи (ANTHROPIC_API_KEY и т.д.)

4. **Проверьте timeout:**
   - Если задача занимает >60 сек на Pro → увеличьте timeout
   - Или разбейте на более мелкие задачи

### **"No jobs available":**

- ✅ Это нормально, если очередь пуста
- Создайте run через UI

### **Все задачи fail:**

- Проверьте API ключи LLM провайдеров
- Проверьте логи: `vercel logs | grep "LLM error"`

---

## 📈 **Мониторинг:**

### **Vercel Dashboard:**
- Functions → See logs
- Analytics → Function invocations

### **Database:**
```sql
-- Активные runs
SELECT * FROM program_runs WHERE status IN ('running', 'queued');

-- Статистика задач
SELECT status, COUNT(*) FROM analysis_jobs GROUP BY status;

-- Последние ошибки
SELECT * FROM analysis_jobs WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10;
```

---

**Готово! Выберите подходящее решение и запускайте worker** 🚀
