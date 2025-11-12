# Отладка автоматического анализа после загрузки файлов

## Как собрать диагностическую информацию

### 1. Откройте консоль браузера
- Chrome/Edge: `F12` или `Cmd+Option+I` (Mac)
- Firefox: `F12` или `Cmd+Option+K` (Mac)

### 2. Перейдите на вкладку Console

### 3. Вставьте этот код в консоль:

```javascript
// Включить детальное логирование
window.DEBUG_AUTO_ANALYSIS = true;

// Собрать все логи
window.capturedLogs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
  window.capturedLogs.push({ type: 'log', time: new Date().toISOString(), args });
  originalLog.apply(console, args);
};

console.error = function(...args) {
  window.capturedLogs.push({ type: 'error', time: new Date().toISOString(), args });
  originalError.apply(console, args);
};

console.warn = function(...args) {
  window.capturedLogs.push({ type: 'warn', time: new Date().toISOString(), args });
  originalWarn.apply(console, args);
};

console.log('🔍 Debug mode enabled. Logs are being captured.');
```

### 4. Очистите консоль
- Нажмите кнопку 🚫 или `Ctrl+L` / `Cmd+K`

### 5. Загрузите файлы в программу

### 6. Соберите результаты - вставьте в консоль:

```javascript
// Показать все собранные логи
console.log('=== CAPTURED LOGS ===');
window.capturedLogs.forEach((log, i) => {
  console.log(`[${i}] ${log.time} [${log.type}]`, ...log.args);
});

// Скопировать в буфер (работает не во всех браузерах)
copy(JSON.stringify(window.capturedLogs.map(l => ({
  type: l.type,
  time: l.time,
  message: l.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
})), null, 2));

console.log('📋 Logs copied to clipboard (if supported)');
```

## Что искать в логах

### ✅ Успешный флоу должен выглядеть так:

```
[UploadLessonsButton] Upload successful: { programId: "xxx", lessonsCreated: 5, hasOnUploadComplete: true }
[UploadLessonsButton] Calling onUploadComplete...
[Auto-Analysis] Starting analysis for program xxx with 5 lessons
[handleStartAnalysis] Starting analysis for program: xxx
[handleStartAnalysis] Run created: run-xxx message
[handleStartAnalysis] Programs reloaded, ProgressTracker should appear
[Auto-Analysis] Analysis started successfully
[UploadLessonsButton] onUploadComplete finished
[UploadLessonsButton] Calling onSuccess...
[UploadLessonsButton] Upload flow complete
```

### ❌ Проблемы и их индикаторы:

#### Проблема 1: Callback не передается
```
[UploadLessonsButton] Upload successful: { hasOnUploadComplete: false }
[UploadLessonsButton] No onUploadComplete callback provided!
```
**Решение:** Проверить что `onUploadComplete` передается в `ProgramsList`

#### Проблема 2: Ошибка при создании run
```
[handleStartAnalysis] Starting analysis for program: xxx
[handleStartAnalysis] Failed: <error message>
```
**Решение:** Посмотреть на error message, проверить API endpoint

#### Проблема 3: Run создается но не появляется ProgressTracker
```
[handleStartAnalysis] Run created: run-xxx
[handleStartAnalysis] Programs reloaded, ProgressTracker should appear
```
Но ProgressTracker не появляется.

**Решение:** Проверить что `selectedProgram.lastRun.status` обновился

#### Проблема 4: onUploadComplete не вызывается
```
[UploadLessonsButton] Upload successful: { hasOnUploadComplete: true }
(Ничего больше не происходит)
```
**Решение:** Возможно async/await проблема или exception проглочен

## Быстрая проверка через DevTools

### Проверить состояние React компонента:

```javascript
// Найти React root
const root = document.querySelector('#__next');

// Получить React Fiber
const fiberKey = Object.keys(root).find(key => 
  key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
);

if (fiberKey) {
  console.log('React Fiber found:', fiberKey);
}
```

### Проверить что функция доступна:

```javascript
// Это нужно вставить ВНУТРИ компонента или в scope где есть доступ к функциям
// Только для продвинутой отладки!
```

## Альтернатива: Добавить breakpoint

1. Откройте DevTools → Sources
2. Нажмите `Cmd+P` (Mac) или `Ctrl+P` (Windows/Linux)
3. Введите: `UploadLessonsButton`
4. Найдите строку с `onUploadComplete(programId, result.lessonsCreated)`
5. Поставьте breakpoint (кликните на номер строки)
6. Загрузите файлы
7. Debugger остановится - проверьте:
   - Есть ли `onUploadComplete` в scope?
   - Что вернет вызов?

## Сбор информации для отчета

Пожалуйста соберите и пришлите:

1. **Все логи с префиксами:**
   - `[UploadLessonsButton]`
   - `[Auto-Analysis]`
   - `[handleStartAnalysis]`

2. **Toast уведомления которые появились:**
   - "Успешно загружено X уроков"
   - "Запускаем автоматический анализ..."
   - "Анализ запущен успешно!" (или ошибка)

3. **Что вы видите на экране:**
   - Появился ли ProgressTracker?
   - Показывается ли "X из Y уроков"?
   - Есть ли кнопка "Запустить анализ" после загрузки?

4. **URL страницы:**
   - `/programs` (основная)
   - Какая программа выбрана?
   - Source type программы (manual/yonote/generic_list)?

## Известные кейсы

### Кейс 1: Загрузка в non-manual программу
Если program.sourceType !== 'manual', то UploadLessonsButton не рендерится и onUploadComplete не вызовется.

**Проверка:**
```javascript
// В консоли после загрузки страницы
console.log('Selected program:', /* нужен доступ к React state */);
```

### Кейс 2: onUploadComplete undefined
Если `onUploadComplete` не передан из page.tsx в ProgramsList.

**Проверка:** Должен быть warning в консоли:
```
[UploadLessonsButton] No onUploadComplete callback provided!
```

### Кейс 3: Ошибка в handleStartAnalysis
Если createRun() фейлится.

**Проверка:** Ищите в логах:
```
[handleStartAnalysis] Failed: <message>
```
