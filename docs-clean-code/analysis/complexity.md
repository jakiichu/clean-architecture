---
sidebar_position: 3
---

# Сложность

## Два вида сложности

**Существенная (essential) сложность** — это сложность самой задачи. Бухгалтерия, юридические правила, физика игрового движка — их нельзя выбросить.

**Случайная (accidental) сложность** — это сложность, которую мы внесли сами: лишние слои, кривые имена, преждевременные абстракции. Её можно и нужно сокращать.

> Чистый код борется с **случайной** сложностью, оставляя только существенную.

## Цикломатическая сложность

Цикломатическая сложность — количество независимых путей через функцию. Простыми словами: сколько ветвлений (`if`, `else`, `case`, `&&`, `||`, `?:`, `catch`).

| Сложность | Оценка | Что делать |
|-----------|--------|------------|
| 1–4 | Простая | Ничего |
| 5–7 | Средняя | Присмотреться |
| 8–10 | Высокая | Скорее всего, нужен рефакторинг |
| 11+ | Очень высокая | Разбить обязательно |

```typescript
// Цикломатическая сложность = 6 (5 if + 1 базовый путь)
function categorize(user: User): string {
  if (user.age < 13) return 'child';
  if (user.age < 18) return 'teen';
  if (user.age < 65) {
    if (user.isStudent)   return 'student-adult';
    if (user.isRetired)   return 'early-retired';
    return 'adult';
  }
  return 'senior';
}
```

## Когнитивная сложность

Цикломатическая измеряет «пути», но не «как трудно понять». Когнитивная сложность учитывает **вложенность**: ветвление внутри ветвления тяжелее, чем плоский if.

```typescript
// Цикломатическая = 3, но читать тяжело: каждый уровень добавляет нагрузку
function process(items: Item[]): void {
  for (const item of items) {        // +1
    if (item.isValid) {              // +2 (вложенность)
      for (const tag of item.tags) { // +3 (вложенность)
        if (tag.startsWith('!')) {   // +4 (вложенность)
          markUrgent(item);
        }
      }
    }
  }
}

// ✅ Плоский код через ранние возвраты и выделение
function process(items: Item[]): void {
  for (const item of items) {
    if (!item.isValid) continue;
    if (hasUrgentTag(item)) markUrgent(item);
  }
}

function hasUrgentTag(item: Item): boolean {
  return item.tags.some(tag => tag.startsWith('!'));
}
```

## Снижение цикломатической сложности

### Приём 1: ранний возврат

```typescript
// ❌ Глубокая вложенность
function getDiscount(user: User): number {
  let discount = 0;
  if (user) {
    if (user.isActive) {
      if (user.subscription) {
        discount = user.subscription.discount;
      }
    }
  }
  return discount;
}

// ✅ Ранние возвраты
function getDiscount(user: User): number {
  if (!user) return 0;
  if (!user.isActive) return 0;
  if (!user.subscription) return 0;
  return user.subscription.discount;
}
```

### Приём 2: «таблица решений»

Длинная цепочка `if/else` или `switch` часто заменяется отображением:

```typescript
// ❌ Цепочка ветвлений
function getRate(currency: string): number {
  if (currency === 'USD') return 1.0;
  if (currency === 'EUR') return 0.92;
  if (currency === 'GBP') return 0.79;
  if (currency === 'JPY') return 149.0;
  throw new Error('Unknown currency');
}

// ✅ Таблица
const RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.0,
};

function getRate(currency: string): number {
  const rate = RATES[currency];
  if (rate === undefined) throw new Error(`Unknown currency: ${currency}`);
  return rate;
}
```

### Приём 3: полиморфизм вместо switch

```typescript
// ❌ Switch по типу — типичный «запах»
function calculateArea(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':    return Math.PI * shape.radius ** 2;
    case 'square':    return shape.side ** 2;
    case 'rectangle': return shape.width * shape.height;
  }
}

// ✅ Поведение в самих типах
interface Shape { area(): number; }

class Circle implements Shape {
  constructor(private radius: number) {}
  area() { return Math.PI * this.radius ** 2; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area() { return this.side ** 2; }
}

class Rectangle implements Shape {
  constructor(private w: number, private h: number) {}
  area() { return this.w * this.h; }
}
```

### Приём 4: выделение булевых выражений

```typescript
// ❌ Не вижу логику за условиями
if (user.age >= 18 && user.country === 'US' && user.creditScore > 700 && !user.hasActiveDispute) {
  approveLoan(user);
}

// ✅ Условие — самостоятельная функция с именем
function isEligibleForLoan(user: User): boolean {
  return user.age >= 18
      && user.country === 'US'
      && user.creditScore > 700
      && !user.hasActiveDispute;
}

if (isEligibleForLoan(user)) {
  approveLoan(user);
}
```

## Структурные источники сложности

### Слишком много обязанностей

Чем больше дел делает функция/класс, тем больше путей внутри. Снижается сложность простым разделением.

### Скрытое состояние

Глобальные переменные, синглтоны, статические поля, неявно изменяемые сервисом — все они увеличивают сложность тем, что от чтения кода нельзя понять, **что произойдёт**.

```typescript
// ❌ Скрытое глобальное состояние
let currentUser: User | null = null;

function login(user: User) { currentUser = user; }
function canEdit(): boolean {
  // Поведение зависит от того, что было до этого вызова
  return currentUser?.role === 'admin';
}

// ✅ Состояние явно передаётся
function canEdit(user: User): boolean {
  return user.role === 'admin';
}
```

### Избыточная абстракция

Иногда сложность создают **слои**, которые ничего не дают.

```typescript
// ❌ Бесполезная обёртка
interface UserRepositoryFactoryFactory {
  create(): UserRepositoryFactory;
}
interface UserRepositoryFactory {
  create(): UserRepository;
}
interface UserRepository {
  findById(id: number): User;
}

// Чтобы получить пользователя, нужно три раза вызвать create().
```

Удалите слои, которые не добавляют поведения.

## Как измерять сложность на практике

- **ESLint**: правила `complexity`, `max-depth`, `max-nested-callbacks`, `max-params`, `max-lines-per-function`.
- **SonarQube** / **Code Climate** — показывают цикломатическую и когнитивную сложность по файлам.
- **Простой ручной приём**: посчитайте, сколько уровней отступов внутри функции. Больше 3 — повод присмотреться.

## Чек-лист анализа сложности

- [ ] Функции с цикломатической сложностью > 10
- [ ] Вложенность глубже 3 уровней
- [ ] Switch / if-else цепочки длиной > 5 веток
- [ ] Длинные булевы выражения (> 3 операций)
- [ ] Параметров > 4
- [ ] Скрытое состояние, к которому функция обращается
- [ ] Абстракции, через которые проходишь, но ничего не делаешь

---

> Сложность нельзя «убить», только перераспределить. Хороший инженер знает, где её разместить, чтобы она меньше мешала.
