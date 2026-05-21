---
sidebar_position: 5
---

# Дублирование

## DRY — Don't Repeat Yourself

Принцип DRY часто понимают слишком буквально: «если вижу два похожих куска — выношу в функцию». На самом деле смысл другой:

> Каждая единица знания должна иметь **одно** недвусмысленное представление в системе.

Дублирование — это не про **одинаковые строки**, а про **одинаковые решения**. Бывает, что два куска кода выглядят одинаково, но решают разные задачи — и их **нельзя** объединять. Бывает наоборот: код выглядит по-разному, но описывает одно и то же понятие — и объединять его **нужно**.

## Виды дублирования

### Текстовое дублирование

Самое очевидное: два одинаковых блока кода.

```typescript
// ❌ Прямое копирование
function createUser(data: UserData): User {
  if (!data.email) throw new Error('Email required');
  if (!data.email.includes('@')) throw new Error('Invalid email');
  if (data.email.length > 254) throw new Error('Email too long');
  // ... создание пользователя
}

function updateUser(id: number, data: UserData): User {
  if (!data.email) throw new Error('Email required');
  if (!data.email.includes('@')) throw new Error('Invalid email');
  if (data.email.length > 254) throw new Error('Email too long');
  // ... обновление пользователя
}

// ✅ Выделено в функцию
function validateEmail(email: string | undefined): void {
  if (!email) throw new Error('Email required');
  if (!email.includes('@')) throw new Error('Invalid email');
  if (email.length > 254) throw new Error('Email too long');
}

function createUser(data: UserData): User {
  validateEmail(data.email);
  // ...
}

function updateUser(id: number, data: UserData): User {
  validateEmail(data.email);
  // ...
}
```

### Структурное дублирование

Код разный, но имеет одну форму.

```typescript
// ❌ Одинаковая форма с разными значениями
function getUserDiscount(level: string): number {
  if (level === 'gold')   return 0.15;
  if (level === 'silver') return 0.10;
  if (level === 'bronze') return 0.05;
  return 0;
}

function getUserMaxOrders(level: string): number {
  if (level === 'gold')   return 100;
  if (level === 'silver') return 50;
  if (level === 'bronze') return 20;
  return 10;
}

// ✅ Одна структура — одна таблица
const LEVEL_BENEFITS = {
  gold:   { discount: 0.15, maxOrders: 100 },
  silver: { discount: 0.10, maxOrders:  50 },
  bronze: { discount: 0.05, maxOrders:  20 },
  none:   { discount: 0,    maxOrders:  10 },
} as const;

function getBenefits(level: string) {
  return LEVEL_BENEFITS[level as keyof typeof LEVEL_BENEFITS] ?? LEVEL_BENEFITS.none;
}
```

### Логическое дублирование

Один и тот же бизнес-факт «зашит» в нескольких местах.

```typescript
// ❌ «Скидка для гостей — 5%» — записано в трёх местах
function calculateOrderTotal(order: Order, user: User): number {
  let total = sum(order.items);
  if (!user) total *= 0.95; // здесь
  return total;
}

function renderCheckoutPreview(order: Order, user: User): string {
  const discount = user ? 0 : 0.05; // и здесь
  // ...
}

function describeBenefits(user: User): string {
  if (!user) return 'Гости получают 5% скидку'; // и тут
}
```

Если завтра скидка изменится с 5% на 7%, нужно вспомнить все три места.

```typescript
// ✅ Бизнес-факт — в одном месте
const GUEST_DISCOUNT = 0.05;

function getDiscountFor(user: User | null): number {
  return user ? 0 : GUEST_DISCOUNT;
}
```

### Знаниевое дублирование (Single Source of Truth)

Один факт о мире — одно представление. Если правило компании «возраст совершеннолетия — 18 лет» появляется в коде в виде `> 18`, `>= 18`, `MIN_AGE = 18`, `AGE_LIMIT = 17` (с разной логикой), скоро возникнут противоречия.

```typescript
// ✅ Одна константа на одно правило
export const ADULT_AGE = 18;

function isAdult(age: number): boolean {
  return age >= ADULT_AGE;
}
```

## Когда дублирование — НЕ зло

### Случайное сходство

Две функции **сейчас** выглядят одинаково, но решают разные задачи. Если их объединить, любое изменение одной потащит за собой другую.

```typescript
// Сейчас обе функции одинаковые
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

function formatCustomerName(customer: Customer): string {
  return `${customer.firstName} ${customer.lastName}`;
}

// Если объединить в formatName({ firstName, lastName }),
// завтра не сможем независимо изменить формат для клиентов
// (например, добавить компанию: "John Smith (Acme Inc)")
```

> Правило: **дублирование дешевле неверной абстракции**.

### Преждевременная абстракция

Объединять два места в одну функцию после **первого** появления похожего кода — почти всегда ошибка. Лучше подождать третьего повторения.

«Правило трёх»:
1. Первое появление — пишем как есть.
2. Второе — замечаем сходство, **пока ничего не делаем**.
3. Третье — выносим в общую абстракцию, когда видно, что **именно** общее.

## Дублирование в тестах

Тесты — отдельный мир. Лёгкое дублирование там часто полезнее, чем сложные абстракции.

```typescript
// ✅ Простое и читаемое
it('rejects negative amount', () => {
  expect(() => Money.create(-1, 'USD')).toThrow('Amount cannot be negative');
});

it('rejects zero amount', () => {
  expect(() => Money.create(0, 'USD')).not.toThrow();
});

it('rejects missing currency', () => {
  expect(() => Money.create(10, '')).toThrow('Currency must be a 3-letter code');
});

// ❌ Параметризация ради «отсутствия дубликата» делает тест мутным
test.each([
  { amount: -1,  currency: 'USD', error: 'Amount cannot be negative' },
  { amount:  0,  currency: 'USD', error: null },
  { amount: 10,  currency: '',    error: 'Currency must be a 3-letter code' },
])(/* ... */);
```

Параметризация хороша, когда **много** случаев и они **по-настоящему** одинаковой формы. Для трёх случаев — нет.

## Дублирование в типах

```typescript
// ❌ Те же поля описаны дважды
interface UserResponse {
  id: number;
  name: string;
  email: string;
}

interface UserDto {
  id: number;
  name: string;
  email: string;
}

// ✅ Один источник, переиспользование
interface UserDto {
  id: number;
  name: string;
  email: string;
}

type UserResponse = UserDto;
// или
type UserResponse = Pick<UserDto, 'id' | 'name' | 'email'>;
```

## Что искать при анализе

- **Скопированные блоки** длиной 5+ строк
- **Похожие функции** с разными значениями констант
- **Длинные switch/if-цепочки**, повторяющиеся в нескольких местах
- **Одно правило**, записанное в нескольких местах
- **Цифры/строки**, встречающиеся в коде больше одного раза

Инструменты:
- ESLint правило `no-dupe-keys`, `no-duplicate-imports`
- `jscpd` — детектор копипасты
- `tsc --noEmit` + строгие типы

## Чек-лист

- [ ] Бизнес-правила определены в одном месте
- [ ] Константы вынесены и названы
- [ ] Похожие функции рассмотрены на предмет общей абстракции
- [ ] Абстракции введены только после третьего повторения
- [ ] Случайное сходство не превращено в ложную общность
- [ ] Типы не повторяют друг друга без необходимости

---

> Дублирование — это не вопрос «есть оно или нет». Это вопрос **какое именно знание дублируется**.
