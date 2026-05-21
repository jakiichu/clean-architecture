---
sidebar_position: 5
---

# Replace Conditional (Замена условных конструкций)

## Проблема

Условные конструкции (`if`, `switch`) — мощный инструмент, но в больших количествах они превращают код в неуправляемое дерево решений. Особенно когда:

- Одна и та же цепочка `switch` повторяется в нескольких местах
- В функции 5+ ветвей с длинной логикой
- Условия проверяют тип объекта, а не его состояние
- Глубокая вложенность скрывает основную ветку

## Техника 1: Guard Clauses (стражи)

**Когда применять**: глубокая вложенность из-за проверок «если не так — выходим».

```typescript
// ❌ ДО
function processPayment(order: Order, user: User): Receipt | null {
  if (order) {
    if (!order.isPaid) {
      if (user) {
        if (user.hasValidCard) {
          if (user.balance >= order.total) {
            const charge = chargeCard(user, order.total);
            return generateReceipt(charge);
          } else {
            return null;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// ✅ ПОСЛЕ
function processPayment(order: Order, user: User): Receipt | null {
  if (!order) return null;
  if (order.isPaid) return null;
  if (!user) return null;
  if (!user.hasValidCard) return null;
  if (user.balance < order.total) return null;

  const charge = chargeCard(user, order.total);
  return generateReceipt(charge);
}
```

Лучше — выбрасывать исключения вместо `null`, чтобы причина отказа была явной:

```typescript
function processPayment(order: Order, user: User): Receipt {
  if (!order) throw new Error('Order is required');
  if (order.isPaid) throw new AlreadyPaidError(order.id);
  if (!user) throw new Error('User is required');
  if (!user.hasValidCard) throw new InvalidCardError(user.id);
  if (user.balance < order.total) throw new InsufficientFundsError();

  const charge = chargeCard(user, order.total);
  return generateReceipt(charge);
}
```

## Техника 2: Replace Conditional with Polymorphism

**Когда применять**: `switch` или `if-else` по типу объекта повторяется в нескольких местах.

```typescript
// ❌ ДО
interface Shape {
  type: 'circle' | 'square' | 'triangle';
  radius?: number;
  side?: number;
  base?: number;
  height?: number;
}

function area(shape: Shape): number {
  switch (shape.type) {
    case 'circle':
      return Math.PI * shape.radius! ** 2;
    case 'square':
      return shape.side! ** 2;
    case 'triangle':
      return (shape.base! * shape.height!) / 2;
  }
}

function perimeter(shape: Shape): number {
  switch (shape.type) {
    case 'circle':
      return 2 * Math.PI * shape.radius!;
    case 'square':
      return 4 * shape.side!;
    case 'triangle':
      // нужны все стороны треугольника...
      return 0;
  }
}

// ✅ ПОСЛЕ
interface Shape {
  area(): number;
  perimeter(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area() { return Math.PI * this.radius ** 2; }
  perimeter() { return 2 * Math.PI * this.radius; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area() { return this.side ** 2; }
  perimeter() { return 4 * this.side; }
}

class Triangle implements Shape {
  constructor(private a: number, private b: number, private c: number) {}
  area() {
    const s = (this.a + this.b + this.c) / 2;
    return Math.sqrt(s * (s - this.a) * (s - this.b) * (s - this.c));
  }
  perimeter() { return this.a + this.b + this.c; }
}
```

Каждая фигура «знает» свой расчёт. Добавление новой фигуры (например, `Hexagon`) — это новый класс, **без** правок существующего кода.

## Техника 3: Replace Type Code with State

**Когда применять**: статус объекта меняет его поведение, и проверки статуса разбросаны.

```typescript
// ❌ ДО
class Order {
  status: 'pending' | 'paid' | 'shipped' | 'cancelled' = 'pending';

  cancel(): void {
    if (this.status === 'shipped') {
      throw new Error("Can't cancel shipped order");
    }
    if (this.status === 'cancelled') {
      throw new Error('Already cancelled');
    }
    this.status = 'cancelled';
  }

  ship(): void {
    if (this.status !== 'paid') {
      throw new Error('Order must be paid before shipping');
    }
    this.status = 'shipped';
  }

  pay(): void {
    if (this.status !== 'pending') {
      throw new Error('Order is not pending');
    }
    this.status = 'paid';
  }
}

// ✅ ПОСЛЕ — состояние явно отделено
interface OrderState {
  cancel(order: Order): OrderState;
  ship(order: Order): OrderState;
  pay(order: Order): OrderState;
}

class PendingState implements OrderState {
  cancel() { return new CancelledState(); }
  ship() { throw new Error('Order must be paid before shipping'); }
  pay() { return new PaidState(); }
}

class PaidState implements OrderState {
  cancel() { return new CancelledState(); }
  ship() { return new ShippedState(); }
  pay() { throw new Error('Already paid'); }
}

class ShippedState implements OrderState {
  cancel() { throw new Error("Can't cancel shipped order"); }
  ship() { throw new Error('Already shipped'); }
  pay() { throw new Error('Already paid'); }
}

class CancelledState implements OrderState {
  cancel() { throw new Error('Already cancelled'); }
  ship() { throw new Error('Cancelled order'); }
  pay() { throw new Error('Cancelled order'); }
}

class Order {
  private state: OrderState = new PendingState();
  
  cancel() { this.state = this.state.cancel(this); }
  ship() { this.state = this.state.ship(this); }
  pay() { this.state = this.state.pay(this); }
}
```

## Техника 4: Replace Conditional with Lookup Table

**Когда применять**: длинная цепочка `if` или `switch` отображает одно значение в другое.

```typescript
// ❌ ДО
function getCountryName(code: string): string {
  if (code === 'US') return 'United States';
  if (code === 'CA') return 'Canada';
  if (code === 'UK') return 'United Kingdom';
  if (code === 'DE') return 'Germany';
  if (code === 'FR') return 'France';
  if (code === 'JP') return 'Japan';
  return 'Unknown';
}

// ✅ ПОСЛЕ
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  UK: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
};

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] ?? 'Unknown';
}
```

Расширение — добавить строчку в таблицу. Логику не трогаем.

## Техника 5: Introduce Special Case (Null Object)

**Когда применять**: проверка на `null` повторяется в десятках мест.

```typescript
// ❌ ДО — проверка на null рассыпана по коду
function getDiscountFor(user: User | null): number {
  if (user === null) return 0;
  return user.subscriptionLevel === 'gold' ? 0.15 : 0.10;
}

function displayName(user: User | null): string {
  if (user === null) return 'Guest';
  return user.fullName;
}

function maxItems(user: User | null): number {
  if (user === null) return 5;
  return user.subscriptionLevel === 'gold' ? 100 : 20;
}

// ✅ ПОСЛЕ — особый случай как обычный объект
interface User {
  getDiscount(): number;
  getDisplayName(): string;
  getMaxItems(): number;
}

class RegularUser implements User {
  constructor(
    private fullName: string,
    private subscriptionLevel: 'silver' | 'gold',
  ) {}
  
  getDiscount() { return this.subscriptionLevel === 'gold' ? 0.15 : 0.10; }
  getDisplayName() { return this.fullName; }
  getMaxItems() { return this.subscriptionLevel === 'gold' ? 100 : 20; }
}

class GuestUser implements User {
  getDiscount() { return 0; }
  getDisplayName() { return 'Guest'; }
  getMaxItems() { return 5; }
}

// Использование — больше нет проверок на null
function welcomeUser(user: User): void {
  console.log(`Welcome, ${user.getDisplayName()}!`);
}
```

## Техника 6: Consolidate Conditionals

**Когда применять**: несколько проверок ведут к одному и тому же результату.

```typescript
// ❌ ДО
function getDiscount(user: User): number {
  if (user.age < 18) return 0;
  if (!user.isVerified) return 0;
  if (user.balance < 100) return 0;
  return user.balance * 0.05;
}

// ✅ ПОСЛЕ
function getDiscount(user: User): number {
  if (!isEligibleForDiscount(user)) return 0;
  return user.balance * 0.05;
}

function isEligibleForDiscount(user: User): boolean {
  return user.age >= 18
      && user.isVerified
      && user.balance >= 100;
}
```

Условие получило имя и стало переиспользуемым.

## Техника 7: Decompose Conditional

**Когда применять**: каждая ветка `if-else` длиной в десятки строк.

```typescript
// ❌ ДО
function calculateShipping(order: Order, user: User): number {
  if (user.subscriptionLevel === 'premium' && order.total > 50) {
    // 20 строк сложной логики бесплатной доставки
    const baseRate = 0;
    const handling = order.items.length > 5 ? 2 : 0;
    // ...
    return baseRate + handling;
  } else {
    // 25 строк обычной логики
    const baseRate = order.total < 30 ? 7 : 5;
    // ...
    return /* что-то */;
  }
}

// ✅ ПОСЛЕ
function calculateShipping(order: Order, user: User): number {
  if (isEligibleForFreeShipping(order, user)) {
    return calculateFreeShippingHandling(order);
  }
  return calculateStandardShipping(order);
}

function isEligibleForFreeShipping(order: Order, user: User): boolean {
  return user.subscriptionLevel === 'premium' && order.total > 50;
}

function calculateFreeShippingHandling(order: Order): number {
  return order.items.length > 5 ? 2 : 0;
}

function calculateStandardShipping(order: Order): number {
  const baseRate = order.total < 30 ? 7 : 5;
  return baseRate;
}
```

## Когда условия — это нормально

Не каждый `if` нужно заменять полиморфизмом. Простые проверки лучше оставлять как есть:

```typescript
// ✅ Совершенно нормально
function findUser(id: number): User | null {
  if (id < 0) return null;
  return database.findById(id);
}
```

Полиморфизм оправдан, когда:
1. Условия повторяются в нескольких местах
2. Условий много (5+ веток)
3. Каждая ветка содержит существенную логику
4. Ожидается появление новых веток

## Чек-лист замены условных конструкций

- [ ] Глубокая вложенность → guard clauses
- [ ] Switch по типу повторяется → полиморфизм
- [ ] Цепочка значений → таблица отображения
- [ ] Везде проверки на null → Null Object
- [ ] Длинные ветки → выделение функций
- [ ] Несколько проверок → объединение в условие с именем

---

> Условие — это вилка в коде. Каждая лишняя вилка — лишний путь в голове читателя.
