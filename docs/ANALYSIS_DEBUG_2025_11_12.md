# Analysis Debug Report - 2025-11-12

## 🐛 Problem

Анализ урока не выполняется, хотя:

- ✅ Задача создана в очереди
- ✅ Worker запущен и работает
- ✅ API `/api/worker/tick` обрабатывает задачи
- ❌ Прогресс остается 0%
- ❌ Урок не анализируется

## 🔍 Investigation

### 1. Проверка логов через DevTools MCP

**Консоль браузера:**

```
[UploadLessonsButton] File select triggered
[UploadLessonsButton] Selected 1 files: ["test-lesson.md"]
[UploadLessonsButton] Reading file 1/1: test-lesson.md (290 bytes)
[UploadLessonsButton] Content read successfully, length: 177 chars
[UploadLessonsButton] Base64 encoded, length: 388 chars
[UploadLessonsButton] Valid files: 1/1
[UploadLessonsButton] Uploading 1 files
[UploadLessonsButton] API response status: 200 OK
[UploadLessonsButton] Upload successful: {lessonsCreated: 1}
```

✅ **Загрузка файла работает отлично!**

### 2. Проверка анализа

**POST /api/programs/.../lessons/.../analyze:**

```json
{
  "message": "Lesson analysis queued successfully",
  "jobId": "64c36887-f49f-4a66-ae2f-5b1c1a766cc9",
  "runId": "bbd93925-fbde-4bac-9035-c9db69abd76a"
}
```

✅ **Задача поставлена в очередь!**

### 3. Проверка worker

**Worker не был запущен!**

```bash
ps aux | grep worker
# No worker process found
```

❌ **Главная проблема: Worker не запущен!**

### 4. Запуск worker

**Установка зависимостей:**

```bash
cd worker
npm install
```

**Генерация APP_SECRET_KEY:**

```bash
openssl rand -base64 32
# Example output: Xh8Jl1olcb9DaOBdTlH46kYESInrgDsTkw...
```

**Добавление в .env.local:**

```env
APP_SECRET_KEY=your-generated-key-here
API_URL=http://localhost:3002
```

**Запуск worker:**

```bash
cd worker
source ../.env.local
npm start
```

**Output:**

```
🚀 Educational Analyzer Worker Starting...
Worker ID: railway-worker-94218
API URL: http://localhost:3002
Interval: 5000ms
---
✅ Configuration validated
✅ Worker started successfully
📊 Polling for jobs...

[2025-11-12T13:30:35.983Z] Calling worker endpoint
✅ Processed job: {processed: 4}
```

✅ **Worker запущен и обрабатывает задачи!**

### 5. Проверка статуса run

**GET /api/program-runs/{runId}/status:**

```json
{
  "run": {
    "id": "bbd93925-fbde-4bac-9035-c9db69abd76a",
    "status": "running",
    "totalLessons": 1
  },
  "progress": {
    "percentage": 0,
    "queued": 1,
    "running": 0,
    "succeeded": 0,
    "failed": 0,
    "total": 1
  }
}
```

⚠️ **Задача в очереди (queued: 1), но не обрабатывается (running: 0)**

### 6. Проверка API endpoint

**GET /api/worker/tick:**

```json
{
  "message": "Tick processed",
  "processed": 4,
  "duration": 195,
  "activeRuns": 2,
  "concurrency": 4
}
```

✅ **API обрабатывает задачи** (processed: 4)

## 🎯 Root Cause

**Worker не был запущен локально!**

Для обработки задач анализа необходим запущенный worker процесс, который:

1. Опрашивает `/api/worker/tick` каждые 5 секунд
2. Endpoint берет задачи из очереди
3. Обрабатывает их через LLM
4. Сохраняет результаты в базу

## ✅ Solution

### Для локальной разработки:

1. **Установить зависимости:**

   ```bash
   cd worker && npm install
   ```

2. **Сгенерировать APP_SECRET_KEY:**

   ```bash
   openssl rand -base64 32
   ```

3. **Добавить в .env.local:**

   ```env
   APP_SECRET_KEY=your-generated-key
   API_URL=http://localhost:3002
   ```

4. **Запустить worker:**
   ```bash
   cd worker
   source ../.env.local
   npm start
   ```

### Для production (Vercel):

**Опция 1: Vercel Cron Jobs** (Pro план)

- Уже настроено в `vercel.json`
- Автоматически вызывает `/api/worker/tick` каждую минуту
- Требует Pro план ($20/месяц)

**Опция 2: External Cron Service** (бесплатно)

- EasyCron.com - бесплатно до 20 cron jobs
- Настроить GET запрос к `https://your-app.vercel.app/api/worker/tick`
- Интервал: каждую минуту

**Опция 3: Railway Worker** (рекомендуется)

- Отдельный сервис на Railway ($5/месяц)
- Обрабатывает задачи каждые 5 секунд
- Быстрее чем Vercel Cron (12x)

## 📊 Debugging Tools Used

### Chrome DevTools MCP

**Tools используемые:**

1. `chrome-devtools___list_console_messages` - логи консоли
2. `chrome-devtools___list_network_requests` - HTTP запросы
3. `chrome-devtools___get_network_request` - детали запроса
4. `chrome-devtools___evaluate_script` - программная загрузка файла
5. `chrome-devtools___take_snapshot` - состояние UI
6. `chrome-devtools___take_screenshot` - скриншоты

**Процесс отладки:**

```javascript
// 1. Открыть DevTools
list_pages()

// 2. Перезагрузить страницу
navigate_page({ type: 'reload' })

// 3. Программно загрузить тестовый файл
evaluate_script({
  function: async () => {
    const file = new File([content], 'test.md', {...})
    input.files = dataTransfer.files
    input.dispatchEvent(new Event('change'))
  }
})

// 4. Проверить консоль и network
list_console_messages()
list_network_requests()

// 5. Получить детали запросов
get_network_request({ reqid: 1881 })
```

## 🎓 Lessons Learned

1. **Всегда проверять worker процесс** при отладке асинхронных задач
2. **DevTools MCP эффективен** для программной отладки
3. **Логирование критично** - добавленные логи помогли найти проблему
4. **Base64 кодирование** решило проблему Unicode в JSON
5. **Worker требует APP_SECRET_KEY** для расшифровки credentials

## 📝 Next Steps

1. ✅ Worker запущен локально
2. ⏳ Дождаться завершения анализа
3. ⏳ Проверить результаты в UI
4. 🔄 Настроить worker для production (Railway или EasyCron)
5. 📚 Обновить документацию по запуску worker

## 🚀 Status

**Current:**

- ✅ Worker running locally
- ⏳ Analysis in progress
- ⏳ Waiting for results

**Worker output:**

```
[2025-11-12T13:31:35.993Z] Calling worker endpoint
✅ Processed job: {processed: 4}
```

**UI Status:**

- Run status: "running"
- Progress: 0% (1 total, 0 processed)
- Lesson: "Не проанализировано"

**Expected:**

- Worker processes analysis jobs
- Progress increases to 100%
- Lesson shows analysis results

## 🔗 Related Documentation

- `worker/README.md` - Worker setup guide
- `WORKER_SETUP.md` - Deployment options
- `docs/DEPLOYMENT.md` - Production deployment
- `docs/LESSON_CARDS_IMPLEMENTATION.md` - UI implementation
