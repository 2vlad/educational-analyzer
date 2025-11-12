# Programs Cards Design - 2025-11-12

## Overview

Новый дизайн страницы программ с карточками вместо бокового списка. Основан на дизайне из Figma (скриншоты прикреплены к задаче).

## Новые компоненты

### 1. ProgramCard (`components/programs/ProgramCard.tsx`)

Карточка программы с двумя состояниями:

**Collapsed (свернутая):**

- Название программы
- Метрики в одну строку (Интерес +1, Логика +1, Забота 0, Понятность +2)
- Круговой индикатор прогресса (X/Y уроков)
- Иконка раскрытия (ChevronRight)

**Expanded (развернутая):**

- Название программы
- Круговой индикатор прогресса
- Иконка скрытия (ChevronDown)
- Детальные метрики:
  - Название метрики
  - Скор (+2, +1, 0, -1)
  - Комментарий/рекомендация

**Props:**

```typescript
interface ProgramCardProps {
  title: string // Название программы
  metrics: ProgramMetric[] // Массив метрик с оценками и комментариями
  completedLessons: number // Количество завершенных уроков
  totalLessons: number // Всего уроков
  color?: 'green' | 'beige' // Цвет карточки (по умолчанию green)
}

interface ProgramMetric {
  name: string // Название метрики (Интерес, Логика, и т.д.)
  score: number // Оценка: -1, 0, +1, +2
  comment?: string // Комментарий с рекомендациями
}
```

**Дизайн:**

- Округлённые углы: `rounded-3xl`
- Цвета: `bg-green-100` или `bg-amber-50`
- Hover эффект: `opacity-80`
- Анимация раскрытия: `transition-all`

### 2. ProgramsCardsView (`components/programs/ProgramsCardsView.tsx`)

Список карточок программ.

**Features:**

- Заголовок "ПРОГРАММЫ" в uppercase
- Вертикальный список карточек с отступами (`space-y-4`)
- Максимальная ширина `max-w-5xl`
- Mock-данные для метрик (временно)

**Props:**

```typescript
interface ProgramsCardsViewProps {
  programs: Program[] // Массив программ из типа programs.ts
}
```

**Mock данные:**

```typescript
const getMockMetrics = (programTitle: string = '') => {
  return {
    metrics: [
      { name: 'Интерес', score: 1, comment: '...' },
      { name: 'Логика', score: 1, comment: '...' },
      { name: 'Забота', score: 0, comment: '...' },
      { name: 'Понятность', score: 2, comment: '...' },
    ],
    color: // Чередование зеленого и бежевого
  }
}
```

### 3. Programs Cards Page (`app/programs-cards/page.tsx`)

Новая страница с карточным дизайном.

**Функциональность:**

- Загрузка программ из API
- Маппинг данных из API формата в тип Program
- UnifiedHeader
- Пустое состояние с кнопкой "Создать первую программу"
- Floating кнопка "Добавить программу" (bottom-right)
- Модальное окно создания программы

**Маппинг данных:**

```typescript
const mappedPrograms: Program[] = loadedPrograms.map((p) => ({
  id: p.id,
  title: p.name,
  lessonsCount: p.lastRun?.totalLessons || 0,
  completedCount: p.lastRun?.succeeded || 0,
  status:
    p.lastRun?.status === 'completed'
      ? 'completed'
      : p.lastRun?.status === 'running'
        ? 'active'
        : 'draft',
  sourceType: p.source_type,
}))
```

## URL

**Доступ:** `http://localhost:3002/programs-cards`

_(Пока доступно параллельно с `/programs`, в будущем может заменить основную страницу)_

## Скриншоты

### Collapsed State (свернутая)

![Collapsed cards](../screenshots/programs-cards-collapsed.png)

Видно:

- Название "реакт"
- Метрики: Интерес +1, Логика +1, Забота 0, Понятность +2
- Прогресс: 0/6
- Стрелка вправо

### Expanded State (развернутая)

![Expanded cards](../screenshots/programs-cards-expanded.png)

Видно:

- Название "реакт"
- Прогресс: 0/6
- Стрелка вниз
- Детальные метрики с комментариями:
  - **Интерес +1:** "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения..."
  - **Логика +1:** "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения..."
  - **Забота 0:** "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения..."
  - **Понятность +2:** "Обычный текст, без души, как инструкция Что поправить: → Добавить обращения..."

## Design Decisions

### 1. Круговой прогресс

Вместо обычного progress bar используется круговой индикатор:

```typescript
<svg className="w-16 h-16 transform -rotate-90">
  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none"
    className="text-gray-200" />
  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none"
    strokeDasharray={`${2 * Math.PI * 28}`}
    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercentage / 100)}`}
    className="text-gray-800 transition-all duration-300"
    strokeLinecap="round" />
</svg>
```

**Почему:**

- Компактнее текстового "X из Y"
- Визуально понятен прогресс
- Соответствует дизайну Figma

### 2. Чередование цветов

```typescript
const colors: ('green' | 'beige')[] = ['green', 'beige', 'green']
const colorIndex = programTitle.length % colors.length
```

**Почему:**

- Визуальное разнообразие
- Помогает различать программы
- Соответствует дизайну Figma

### 3. Expandable cards

Клик на карточку раскрывает детали вместо перехода на отдельную страницу.

**Почему:**

- Быстрый доступ к деталям
- Не нужно переключаться между страницами
- Пользователь видит общую картину всех программ

## TODO: Интеграция реальных данных

Сейчас используются mock-данные. Нужно:

### 1. Создать API endpoint для агрегированных метрик

```typescript
GET /api/programs/:id/metrics-summary

Response:
{
  programId: string
  metrics: [
    {
      name: "Интерес",
      avgScore: 1.2,      // Средняя оценка по всем урокам
      comment: "..."       // Общий комментарий/рекомендация
    },
    ...
  ]
}
```

### 2. Обновить ProgramsCardsView

Заменить `getMockMetrics()` на реальный запрос:

```typescript
const loadProgramMetrics = async (programId: string) => {
  const { metrics } = await apiService.getProgramMetricsSummary(programId)
  return metrics
}
```

### 3. Добавить загрузку метрик

```typescript
useEffect(() => {
  Promise.all(programs.map((p) => loadProgramMetrics(p.id))).then((allMetrics) => {
    // Merge metrics with programs
  })
}, [programs])
```

## TODO: Добавить функциональность

Сейчас карточки read-only. Нужно добавить:

### 1. Действия с программой

**Варианты:**

- Кнопки действий в collapsed state (справа от прогресса)
- Dropdown menu при клике на иконку (3 точки)
- Действия в expanded state (внизу карточки)

**Действия:**

- 📤 **Загрузить уроки** (для yonote/generic_list)
- 📁 **Загрузить файлы** (для manual)
- ▶️ **Запустить анализ** (если есть уроки)
- 🗑️ **Удалить программу**

### 2. Просмотр отдельных уроков

**Вариант 1:** Ссылка в expanded state → `/programs/:id/lessons`

**Вариант 2:** Новая секция в expanded state с мини-списком уроков

**Вариант 3:** Отдельная кнопка "Показать уроки" открывающая modal

### 3. Progress Tracker

Если анализ запущен, показывать ProgressTracker:

- Либо над карточкой программы
- Либо вместо круга прогресса (анимация загрузки)
- Либо в expanded state

## Migration Plan

Если решим заменить `/programs` на новый дизайн:

### Option 1: Постепенная миграция

1. Оставить `/programs` как есть
2. Развивать `/programs-cards` параллельно
3. Добавить toggle переключения дизайна
4. Собрать feedback
5. Переключить всех на cards
6. Удалить старую версию

### Option 2: Быстрая замена

1. Перенести функциональность из `/programs` в `/programs-cards`
2. Заменить роут `/programs` → cards version
3. Удалить `ProgramsList` и `ProgramLessons` компоненты
4. Обновить все ссылки

## Performance Considerations

### 1. Lazy loading метрик

Не загружать метрики для всех программ сразу:

```typescript
// Load metrics only for visible/expanded cards
const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set())

useEffect(() => {
  expandedPrograms.forEach((programId) => {
    loadProgramMetrics(programId)
  })
}, [expandedPrograms])
```

### 2. Virtual scrolling

Если программ много (>50), использовать `react-window`:

```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={programs.length}
  itemSize={100}  // collapsed height
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ProgramCard {...programs[index]} />
    </div>
  )}
</FixedSizeList>
```

### 3. Memoization

```typescript
const MemoizedProgramCard = React.memo(ProgramCard)
```

## Accessibility

Улучшения для a11y:

### 1. Keyboard navigation

```typescript
<button
  onClick={() => setIsExpanded(!isExpanded)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsExpanded(!isExpanded)
    }
  }}
  aria-expanded={isExpanded}
  aria-label={`${title}, ${completedLessons} из ${totalLessons} уроков завершено`}
>
```

### 2. Screen reader support

```typescript
<div role="region" aria-label="Программы обучения">
  {programs.map(program => (
    <article key={program.id} aria-label={`Программа ${program.title}`}>
      <ProgramCard {...program} />
    </article>
  ))}
</div>
```

### 3. Focus management

При раскрытии карточки фокус должен оставаться на кнопке раскрытия.

## Testing

### Unit tests

```typescript
describe('ProgramCard', () => {
  it('renders collapsed by default', () => {
    render(<ProgramCard title="Test" metrics={mockMetrics} ... />)
    expect(screen.queryByText('comment text')).not.toBeInTheDocument()
  })

  it('expands on click', () => {
    render(<ProgramCard title="Test" metrics={mockMetrics} ... />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('comment text')).toBeInTheDocument()
  })

  it('shows correct progress', () => {
    render(<ProgramCard completedLessons={5} totalLessons={10} ... />)
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })
})
```

### E2E tests

```typescript
test('user can expand program card to see details', async ({ page }) => {
  await page.goto('/programs-cards')

  // Card is collapsed
  await expect(page.getByText('Интерес +1')).toBeVisible()
  await expect(page.getByText('Обычный текст')).not.toBeVisible()

  // Click to expand
  await page.getByRole('button', { name: /реакт/ }).click()

  // Details are visible
  await expect(page.getByText('Обычный текст')).toBeVisible()
})
```

## Summary

✅ **Создано:**

- ProgramCard компонент с collapsed/expanded states
- ProgramsCardsView для отображения списка
- /programs-cards страница с новым дизайном

✅ **Работает:**

- Отображение программ
- Раскрытие/скрытие карточек
- Круговой прогресс индикатор
- Чередование цветов

⚠️ **TODO:**

- Интеграция реальных метрик из анализа
- Добавить действия (загрузка, анализ, удаление)
- Просмотр отдельных уроков
- ProgressTracker для активных runs

📝 **Коммит:** `20f4c08` - "Add new card-based design for programs page"
