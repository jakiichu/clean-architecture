---
sidebar_position: 4
---

# Построение классов

## Класс — это не «контейнер для методов»

Распространённая ошибка — воспринимать класс как папку, в которую складываются связанные функции. Класс — это **связка состояния и поведения**, которое над этим состоянием работает. Если поведение не использует состояние, оно, возможно, должно быть отдельной функцией, а не методом класса.

## Шаг 1: Найдите состояние

Прежде чем создавать класс, спросите: **какое состояние** он будет хранить?

```typescript
// ❌ Класс без состояния — это просто пространство имён
class StringUtils {
  static capitalize(s: string): string { /* ... */ }
  static reverse(s: string): string { /* ... */ }
  static count(s: string, char: string): number { /* ... */ }
}

// ✅ Функции в модуле — проще и понятнее
export function capitalize(s: string): string { /* ... */ }
export function reverse(s: string): string { /* ... */ }
export function count(s: string, char: string): number { /* ... */ }
```

Если все методы класса статические — почти наверняка вам нужны функции, а не класс.

## Шаг 2: Опишите инвариант класса

**Инвариант** — это утверждение, которое всегда истинно для объекта данного класса. Хороший класс защищает свои инварианты.

```typescript
// Инварианты класса Money:
// 1. Сумма не может быть отрицательной
// 2. Валюта обязательно указана
// 3. Сумма и валюта неизменны после создания

class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter code');
    }
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

Конструктор сделан приватным — нельзя создать `Money` в обход проверок. Поля помечены `readonly` — нельзя случайно изменить их извне.

## Шаг 3: Начните с публичного API

Прежде чем писать поля и приватные методы, опишите, **как класс будут использовать**.

```typescript
// Хочу, чтобы код-клиент выглядел так:
const cart = new ShoppingCart(userId);
cart.add(product, quantity);
cart.remove(productId);
const total = cart.getTotal();
const order = cart.checkout();

// Из этого следует публичный API:
class ShoppingCart {
  constructor(userId: number);
  add(product: Product, quantity: number): void;
  remove(productId: number): void;
  getTotal(): Money;
  checkout(): Order;
}
```

Когда вы сначала придумали удобный интерфейс, реализация подстраивается под него. Если же начать с реализации, интерфейс часто получается неудобным.

## Шаг 4: Минимальные публичные методы

Чем меньше публичных методов — тем сложнее использовать класс неправильно. Каждый публичный метод — это обещание поддерживать его навсегда.

```typescript
// ❌ Слишком многословный публичный API
class User {
  public name: string;
  public email: string;
  
  setName(name: string): void { this.name = name; }
  getName(): string { return this.name; }
  setEmail(email: string): void { this.email = email; }
  getEmail(): string { return this.email; }
  validateName(): boolean { /* ... */ }
  formatNameForDisplay(): string { /* ... */ }
  normalizeEmail(): string { /* ... */ }
  // ... ещё 15 методов
}

// ✅ Минимум на поверхности
class User {
  constructor(
    private name: string,
    private email: string,
  ) {}

  changeEmail(newEmail: string): void {
    if (!isValidEmail(newEmail)) {
      throw new Error('Invalid email');
    }
    this.email = newEmail;
  }

  toDisplay(): string {
    return `${this.name} <${this.email}>`;
  }
}
```

## Шаг 5: Инкапсулируйте всё, что можно

Поле, метод, тип — всё, что не должно быть видно снаружи, делайте `private`. Расширить видимость потом просто, сузить — невозможно без боли.

```typescript
class OrderProcessor {
  // Зависимости — private
  private readonly db: Database;
  private readonly emailer: EmailService;
  
  // Внутреннее состояние — private
  private processedCount = 0;
  
  constructor(db: Database, emailer: EmailService) {
    this.db = db;
    this.emailer = emailer;
  }

  // Публичный API — минимум
  async process(order: Order): Promise<void> {
    this.validate(order);
    await this.save(order);
    await this.notify(order);
    this.processedCount++;
  }

  // Все вспомогательные методы — private
  private validate(order: Order): void { /* ... */ }
  private async save(order: Order): Promise<void> { /* ... */ }
  private async notify(order: Order): Promise<void> { /* ... */ }
}
```

## Шаг 6: Зависимости — в конструктор

Класс не должен сам создавать свои зависимости — это превращает их в скрытые связи, которые мешают тестировать и подменять.

```typescript
// ❌ Скрытые зависимости — класс «знает», как создать БД
class UserService {
  private db = new PostgresDatabase(config.databaseUrl);
  private emailer = new SmtpEmailer(config.smtpHost);
  
  // Этот класс невозможно протестировать без реальной БД и SMTP
}

// ✅ Зависимости явно переданы — легко подменить mock
class UserService {
  constructor(
    private readonly db: Database,
    private readonly emailer: EmailService,
  ) {}
}

// В тесте:
const service = new UserService(mockDb, mockEmailer);

// В проде:
const service = new UserService(realDb, realEmailer);
```

## Шаг 7: Зависьте от абстракций, а не от конкретных классов

Если ваш класс принимает `PostgresDatabase`, он навсегда привязан к Postgres. Если принимает `Database` (интерфейс) — можно подменить любым другим хранилищем.

```typescript
// ✅ Интерфейс описывает то, что нужно
interface UserStore {
  findById(id: number): Promise<User | null>;
  save(user: User): Promise<void>;
}

// Сервис зависит от интерфейса
class UserService {
  constructor(private readonly store: UserStore) {}
}

// Реализаций может быть много
class PostgresUserStore implements UserStore { /* ... */ }
class InMemoryUserStore implements UserStore { /* ... */ }
class RedisUserStore implements UserStore { /* ... */ }
```

## Состав vs наследование

Когда возникает соблазн отнаследоваться — почти всегда лучше использовать **композицию**.

```typescript
// ❌ Наследование жёстко связывает классы
class Animal {
  move() { /* ... */ }
}

class Bird extends Animal {
  fly() { /* ... */ }
}

class Penguin extends Bird {
  // Проблема: пингвины не летают!
  fly() { throw new Error("Can't fly"); }
}

// ✅ Композиция через интерфейсы
interface CanMove { move(): void; }
interface CanFly  { fly(): void; }
interface CanSwim { swim(): void; }

class Penguin implements CanMove, CanSwim {
  move(): void { /* walking */ }
  swim(): void { /* swimming */ }
  // Никакого fly() — потому что не умеет
}

class Sparrow implements CanMove, CanFly {
  move(): void { /* hopping */ }
  fly(): void { /* flying */ }
}
```

Правило: **наследуйте только тогда, когда «B — это A» истинно во всех ситуациях**. Иначе — композиция.

## Принцип «один класс — одна причина для изменения»

Класс должен меняться по **одной причине**. Если в одном классе живут «расчёт цены», «сохранение в БД» и «отрисовка чека» — у него три причины для изменения, и любая из них тянет за собой остальные.

```typescript
// ❌ Три ответственности в одном классе
class Order {
  calculateTotal(): number { /* бизнес-логика */ }
  saveToDatabase(): void   { /* инфраструктура */ }
  renderReceipt(): string  { /* представление */ }
}

// ✅ Каждая ответственность — отдельный класс
class Order {
  // только данные и инвариант
  constructor(public items: Item[]) {}
}

class OrderCalculator {
  calculate(order: Order): Money { /* ... */ }
}

class OrderRepository {
  save(order: Order): Promise<void> { /* ... */ }
}

class ReceiptRenderer {
  render(order: Order): string { /* ... */ }
}
```

## Чек-лист нового класса

- [ ] У класса есть состояние, а не только методы
- [ ] Определён инвариант
- [ ] Сначала продуман публичный API
- [ ] Минимум публичных методов
- [ ] Поля — `private` или `readonly`
- [ ] Зависимости приходят через конструктор
- [ ] Зависимости — интерфейсы, не классы
- [ ] Композиция предпочтительнее наследования
- [ ] Одна причина для изменения
- [ ] Покрыт тестами без моков «всего подряд»

---

> Хороший класс похож на хорошего сотрудника: у него есть зона ответственности, инструменты для её выполнения и чёткие границы, за которые он не лезет.
