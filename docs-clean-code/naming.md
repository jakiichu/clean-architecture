---
sidebar_position: 2
---

# Содержательные имена

Правильный выбор имён — это один из самых важных аспектов чистого кода. Имена есть везде: в переменных, функциях, параметрах, классах, пакетах, файлах исходного кода и каталогах. Так как мы пишем столько имен, то хорошо бы писать их правильно.

## Принципы хорошего именования

### Используйте понятные имена

```typescript
// ❌ Плохо
const d = new Date();
const lis = [1, 2, 3];

// ✅ Хорошо
const currentDate = new Date();
const userIds = [1, 2, 3];
```

### Избегайте дезинформации

```typescript
// ❌ Плохо
const userList = {}; // это объект, а не список!
const accountData = null; // может быть null

// ✅ Хорошо
const userMap = {};
const accountData: Account | null = null;
```

### Используйте произносимые имена

```typescript
// ❌ Плохо
const genmdhms = new Date();

// ✅ Хорошо
const generatedDateTime = new Date();
```

### Функции — действия, переменные — существительные

```typescript
// ❌ Плохо
const validate = user; // существительное как функция
const isUserValidated = () => {}; // функция как существительное

// ✅ Хорошо
const validateUser = () => {};
const isUserValid = true;
```

## Специфичные правила для разных типов

### Переменные
- Используйте существительные
- Будьте конкретны
- Указывайте тип, если не ясно

```typescript
const firstName = "John";
const userIds = [1, 2, 3];
const isActive = true;
const maxRetries = 3;
```

### Функции
- Начинайте с глагола
- Используйте camelCase
- Описывайте, что функция делает

```typescript
function calculateTotal() {}
function getUserById(id: number) {}
function isValidEmail(email: string) {}
```

### Модули и директории

Имя модуля описывает устойчивую предметную возможность, а не технический контейнер:

```text
❌ helpers/
❌ managers/
❌ order-module/
❌ common-services/

✅ orders/
✅ hotkeys/
✅ vehicle-models/
✅ access-control/
```

Если содержимое нельзя описать одной короткой фразой, модуль, вероятно, имеет низкую связность и требует разделения. Суффиксы `Module`, `Manager`, `Service` и `Helper` добавляются только тогда, когда обозначают конкретную роль, а не маскируют отсутствие ответственности.

Внутри предметного модуля операции называются глаголом и объектом:

```text
orders/
├── create-order/
├── cancel-order/
└── get-order-history/
```

Для одного уровня выбирается единая грамматическая форма. Не следует смешивать `creation`, `create-order`, `order-create` и `new-order`, если они обозначают одинаковый вид операции.

### Константы
- Используйте UPPER_SNAKE_CASE для магических чисел
- Описывайте, что это значит

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const API_BASE_URL = "https://api.example.com";
```

## Контекст имени

Имя должно быть понятно в контексте файла и проекта.

```typescript
// ❌ Плохо - имя слишком общее
class Data {
  get() {}
  set() {}
}

// ✅ Хорошо - имя говорит о том, что это
class UserRepository {
  getById(id: number) {}
  save(user: User) {}
}
```
