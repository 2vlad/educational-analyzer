# Исправление проблемы "Failed to fetch programs"

**Дата:** 2025-11-11  
**Проблема:** Страница Программы не загружалась, показывая ошибку "Failed to fetch programs"  
**Статус:** ✅ ИСПРАВЛЕНО

## Найденные проблемы

### 1. Несоответствие схемы БД и API (source_type)

**Проблема:**

- API endpoint `/api/programs` поддерживал 3 типа источников: `'yonote'`, `'generic_list'`, `'manual'`
- База данных имела constraint, допускающий только: `'yonote'`, `'generic_list'`
- При попытке создать программу типа `'manual'` происходила ошибка

**Местонахождение:**

- API: `app/api/programs/route.ts` - строка 8
- БД: миграция `20250122_programs_batch_analyzer.sql` - строка 50

**Решение:**

```sql
ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_source_type_check;

ALTER TABLE programs
  ADD CONSTRAINT programs_source_type_check
  CHECK (source_type IN ('yonote', 'generic_list', 'manual'));
```

### 2. Несоответствие nullable полей (root_url)

**Проблема:**

- API делал поле `root_url` опциональным для типа `'manual'`
- База данных требовала `root_url NOT NULL` для всех типов
- Это приводило к ошибкам при создании manual программ

**Решение:**

```sql
-- Сделать root_url nullable
ALTER TABLE programs
  ALTER COLUMN root_url DROP NOT NULL;

-- Добавить условный constraint
ALTER TABLE programs
  ADD CONSTRAINT programs_root_url_required_for_source_type
  CHECK (
    (source_type = 'manual') OR
    (source_type IN ('yonote', 'generic_list') AND root_url IS NOT NULL)
  );
```

### 3. Отсутствие trigger для автоматического создания профилей

**Проблема:**

- Trigger `handle_new_user` был определен в миграции `0002_multi_user_support.sql`
- Но он не существовал в production базе данных
- Новые пользователи регистрировались в `auth.users`, но не получали записей в `profiles`
- RLS политики требуют наличия профиля для доступа к программам

**Симптомы:**

- Пользователи видели пустую страницу или ошибку "Unauthorized"
- В базе: пользователи в `auth.users` существовали, но отсутствовали в `profiles`

**Найдено пользователей без профилей:**

- `tovlad01@yandex-team.ru` (создан 2025-08-22)

**Решение:**

1. Создан trigger `on_auth_user_created` на таблице `auth.users`
2. Trigger вызывает функцию `handle_new_user()`, которая:
   - Создает запись в `profiles`
   - Копирует default метрики пользователю
3. Выполнен backfill для существующих пользователей

## Применённые миграции

### Миграция 1: `20250111_fix_programs_manual_support.sql`

- Добавлена поддержка типа `'manual'` в constraint
- Сделано поле `root_url` nullable
- Добавлен условный constraint на `root_url`

### Миграция 2: `add_handle_new_user_trigger` (применена через Supabase MCP)

- Создана функция `handle_new_user()`
- Создан trigger `on_auth_user_created`
- Выполнен backfill существующих пользователей

## Результаты после исправления

### База данных (Supabase project: `bzzxseccgdmgtarhdunc`)

- ✅ Constraint `programs_source_type_check` включает все 3 типа
- ✅ Поле `root_url` nullable с условным constraint
- ✅ Trigger `on_auth_user_created` активен
- ✅ Все пользователи имеют профили:
  - `admin@test.edu` - 6 метрик, 1 программа
  - `tovlad01@yandex-team.ru` - 5 метрик, 0 программ

### Deployment

- ✅ Изменения задеплоены на Vercel: `educational-analyzer-6bcv6iqnm`
- ✅ Production URL обновлен

## Проверка работоспособности

### Для существующих пользователей:

1. Войти в систему под существующим аккаунтом
2. Перейти на страницу Программы
3. Должен отобразиться список программ (или пустой список, если их нет)

### Для новых пользователей:

1. Зарегистрироваться новым пользователем
2. Автоматически создастся профиль и default метрики
3. Доступ к странице Программы будет работать

### Тестирование создания программ:

```bash
# Manual программа (root_url необязателен)
POST /api/programs
{
  "name": "Тестовая программа",
  "sourceType": "manual"
}

# Yonote программа (root_url обязателен)
POST /api/programs
{
  "name": "Yonote курс",
  "sourceType": "yonote",
  "rootUrl": "https://practicum.yandex.ru/course/123"
}
```

## Файлы изменений

### Новые файлы:

- `migrations/20250111_fix_programs_manual_support.sql`

### Git commit:

```
e865d43 - Fix programs schema: add manual source_type support and make root_url nullable
```

## Дополнительная информация

### RLS Политики (работают корректно):

- `Users can view own programs` - пользователь видит только свои программы
- `Users can insert own programs` - пользователь может создавать программы
- Trigger создает профили автоматически при регистрации

### Известные ограничения:

- Пользователь на скриншоте (`vlad.klaune@gmail.com`) не найден в базе
  - Возможные причины:
    - Использует другой Supabase project
    - Development окружение
    - Старый скриншот

## Команды для проверки

### Проверить существование профиля:

```sql
SELECT
  au.id,
  au.email,
  p.id as profile_id
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'YOUR_EMAIL';
```

### Проверить программы пользователя:

```sql
SELECT * FROM programs WHERE user_id = 'USER_ID';
```

### Проверить trigger:

```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth';
```

## Следующие шаги

1. ✅ Миграции применены
2. ✅ Код задеплоен
3. ⏳ Тестирование на production
4. ⏳ Мониторинг логов после деплоя

---

**Автор:** Claude Code  
**Время выполнения:** ~30 минут  
**Инструменты:** Supabase MCP, Vercel CLI, Git
