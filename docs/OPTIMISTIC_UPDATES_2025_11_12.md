# Оптимистичные обновления без перезагрузки страницы

## Проблема
При удалении уроков в `/programs` вызывались `loadLessons()` и `loadPrograms()`, что приводило к полной перезагрузке данных и "мерцанию" UI.

## Решение
Реализовано **оптимистичное обновление** (Optimistic UI Update) - паттерн когда UI обновляется мгновенно, до получения ответа от сервера.

## Что изменилось

### До (медленно):
```typescript
const handleDeleteLesson = async (lessonId: string) => {
  await apiService.deleteLesson(selectedProgram.id, lessonId)
  // Полная перезагрузка данных с сервера
  await loadLessons(selectedProgram.id)      // ← API запрос
  await loadPrograms()                       // ← API запрос
}
```

**Проблемы:**
- ❌ Две дополнительных загрузки с сервера
- ❌ Задержка перед обновлением UI
- ❌ "Мерцание" интерфейса
- ❌ Плохой UX при медленном интернете

### После (мгновенно):
```typescript
const handleDeleteLesson = async (lessonId: string) => {
  await apiService.deleteLesson(selectedProgram.id, lessonId)
  
  // Мгновенное обновление локального state
  setLessons((prev) => prev.filter((l) => l.id !== lessonId))
  
  // Обновление счетчика уроков
  setPrograms((prev) =>
    prev.map((p) =>
      p.id === selectedProgram.id
        ? { ...p, lesson_count: Math.max(0, (p.lesson_count || 0) - 1) }
        : p,
    ),
  )
}
```

**Преимущества:**
- ✅ Мгновенное обновление UI (0ms задержки)
- ✅ Нет дополнительных API запросов
- ✅ Нет "мерцания"
- ✅ Отличный UX даже на медленном интернете
- ✅ При ошибке - rollback и reload

## Обработка ошибок

При ошибке удаления происходит **rollback** - восстановление правильного состояния:

```typescript
try {
  await apiService.deleteLesson(...)
  // Оптимистичное обновление
  setLessons(...)
  setPrograms(...)
} catch (err) {
  // При ошибке - перезагрузить данные с сервера
  await loadLessons(selectedProgram.id)
  await loadPrograms()
  alert('Ошибка удаления')
}
```

## Где используется оптимистичное обновление

### ✅ Уже было:
1. **`/custom` - Удаление метрик**
   ```typescript
   const previousMetrics = [...metrics]
   setMetrics(metrics.filter((m) => m.id !== id))
   try {
     await fetch('/api/configuration?id=...', { method: 'DELETE' })
   } catch {
     setMetrics(previousMetrics) // Rollback
   }
   ```

2. **`/programs` - Удаление программ**
   ```typescript
   await apiService.deleteProgram(programId)
   setPrograms(programs.filter((p) => p.id !== programId))
   ```

### ✅ Добавлено сегодня:
3. **`/programs` - Удаление одного урока**
   - Мгновенное удаление из списка
   - Обновление счетчика уроков
   - Rollback при ошибке

4. **`/programs` - Удаление нескольких уроков**
   - Мгновенное удаление всех выбранных
   - Обновление счетчика уроков
   - Rollback при ошибке

## Лучшие практики для оптимистичных обновлений

### 1. Когда использовать:
- ✅ Удаление элементов
- ✅ Изменение простых свойств (toggle, rename)
- ✅ Операции с высокой вероятностью успеха
- ✅ Когда важна скорость отклика

### 2. Когда НЕ использовать:
- ❌ Сложные вычисления на сервере
- ❌ Когда нужны данные от сервера для UI
- ❌ Операции с низкой вероятностью успеха
- ❌ Финансовые транзакции (деньги, платежи)

### 3. Правила реализации:
1. **Всегда** обрабатывайте ошибки
2. **Всегда** делайте rollback при ошибке
3. **Показывайте** пользователю когда происходит ошибка
4. **Сохраняйте** предыдущее состояние для rollback
5. **Тестируйте** сценарии с ошибками

## Пример паттерна

```typescript
const handleOptimisticUpdate = async (id: string) => {
  // 1. Сохранить предыдущее состояние для rollback
  const previousState = [...items]
  
  // 2. Оптимистично обновить UI
  setItems(items.filter(item => item.id !== id))
  
  try {
    // 3. Выполнить запрос к серверу
    await api.delete(id)
    
    // 4. Успех - ничего не делаем (UI уже обновлен)
    toast.success('Удалено')
    
  } catch (error) {
    // 5. Ошибка - вернуть предыдущее состояние
    setItems(previousState)
    
    // 6. Показать ошибку пользователю
    toast.error('Не удалось удалить')
    
    // 7. Опционально: перезагрузить с сервера
    await reloadFromServer()
  }
}
```

## Результат

**До:**
- Удаление урока: ~500-1000ms (2 API запроса + рендер)
- Видимое "мерцание" при перезагрузке

**После:**
- Удаление урока: ~0ms задержки UI + фоновый API запрос
- Моментальная обратная связь

## Коммиты

```
f3e07d3 Optimize lesson deletion with instant UI update
```

## См. также

- [React Optimistic Updates](https://react.dev/reference/react/useOptimistic)
- [SWR Optimistic UI](https://swr.vercel.app/docs/mutation#optimistic-updates)
- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
