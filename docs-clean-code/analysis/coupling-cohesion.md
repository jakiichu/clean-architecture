---
sidebar_position: 4
---

# Связанность и связность

## Две силы, которые тянут код в разные стороны

- **Coupling (связанность)** — насколько сильно один модуль зависит от других.
- **Cohesion (связность)** — насколько сильно внутри одного модуля всё связано между собой.

Правило: **низкая связанность, высокая связность**. Модуль внутри должен быть «про одно», а с другими модулями — общаться через узкие интерфейсы.

## Связанность (coupling)

### Уровни связанности — от худшей к лучшей

#### 1. Связанность по содержимому (content)

Модуль `A` лезет во внутренности модуля `B`: использует приватные поля, читает буфер, опирается на конкретный порядок инструкций.

```typescript
// ❌ A знает про приватное поле B
class Cache {
  private storage = new Map();
}

class Service {
  invalidate(cache: Cache) {
    (cache as any).storage.clear(); // лезем внутрь!
  }
}
```

#### 2. Связанность по глобальным данным (common)

Несколько модулей читают и пишут одну глобальную переменную.

```typescript
// ❌ Все модули знают про globalConfig
let globalConfig: any = {};

function moduleA() { globalConfig.feature = true; }
function moduleB() { if (globalConfig.feature) /* ... */ }
```

#### 3. Связанность по управлению (control)

Один модуль управляет логикой другого через флаги.

```typescript
// ❌ A говорит B, какой режим включить
b.run({ verboseMode: true, slowMode: true, retryMode: false });
```

#### 4. Связанность по данным (data)

Модули общаются через явные параметры и возвращаемые значения. **Это норма.**

```typescript
// ✅ A передаёт B только то, что нужно
const result = b.calculate(price, quantity);
```

#### 5. Отсутствие связи

Модули не знают друг о друге вообще. Иногда возможно через посредника (event bus, очередь).

### Как уменьшать связанность

#### Скрывайте детали

Если поле может быть `private` — оно должно быть `private`.

#### Зависимость от интерфейсов

```typescript
// ❌ Жёсткая связь с конкретной реализацией
class OrderService {
  private repo = new PostgresOrderRepository();
}

// ✅ Связь только с интерфейсом
interface OrderRepository {
  findById(id: number): Promise<Order>;
}

class OrderService {
  constructor(private repo: OrderRepository) {}
}
```

#### Закон Деметры («не разговаривайте с незнакомцами»)

Метод объекта должен вызывать только методы:
1. Самого объекта
2. Своих аргументов
3. Объектов, которые он сам создал
4. Своих прямых полей

```typescript
// ❌ Лезем через несколько уровней
order.getCustomer().getAddress().getCity().getZipCode();

// ✅ Спрашиваем у объекта то, что нужно
order.getShippingZipCode();
```

#### Контракты, а не реализации

API между модулями должен быть **узким**: минимум методов, минимум возвращаемых данных.

```typescript
// ❌ Возвращаем «весь объект»
function getUser(id: number): User { /* со всеми полями, включая password_hash */ }

// ✅ Возвращаем только то, что нужно контексту
function getUserPublicProfile(id: number): { id: number; name: string; avatar: string } {
  // ...
}
```

## Связность (cohesion)

### Уровни связности — от худшей к лучшей

#### 1. Случайная (coincidental)

Элементы модуля не связаны между собой. Знак: имя модуля — `utils`, `helpers`, `misc`.

```typescript
// ❌ Случайная связность
export function formatDate(d: Date): string { /* ... */ }
export function calculateTax(amount: number): number { /* ... */ }
export function validateEmail(s: string): boolean { /* ... */ }
export function sleep(ms: number): Promise<void> { /* ... */ }
```

#### 2. Логическая

Элементы делают «похожие» вещи, но не зависят друг от друга. Часто оформляется через флаги.

```typescript
// ❌ Логическая связность через флаги
function output(data: any, target: 'console' | 'file' | 'network') {
  if (target === 'console') console.log(data);
  if (target === 'file')    fs.writeFileSync('out.txt', data);
  if (target === 'network') fetch('/log', { method: 'POST', body: data });
}
```

#### 3. Временная

Элементы выполняются в одно время, но логически не связаны.

```typescript
// ❌ Только потому что «вместе при старте»
function startup() {
  loadConfig();
  connectToDatabase();
  initLogger();
  warmCaches();
  sendStartupEmail();
}
```

Лучше разделить и явно описать порядок зависимостей.

#### 4. Процедурная

Элементы выполняются в определённом порядке, потому что один зависит от другого.

```typescript
// Допустимо, но можно ещё улучшить
function processFile(path: string) {
  const raw = readFile(path);
  const parsed = parse(raw);
  const result = transform(parsed);
  return result;
}
```

#### 5. Коммуникационная

Элементы работают с одними и теми же данными.

```typescript
class OrderProcessor {
  validate(order: Order) { /* ... */ }
  enrich(order: Order)   { /* ... */ }
  save(order: Order)     { /* ... */ }
}
```

#### 6. Функциональная — лучшая

Элементы работают над **одной задачей**, дополняют друг друга, нельзя выбросить ни одного без потери смысла.

```typescript
// ✅ Всё в Money — про деньги
class Money {
  constructor(private amount: number, private currency: string) {}
  
  add(other: Money): Money { /* ... */ }
  subtract(other: Money): Money { /* ... */ }
  multiply(factor: number): Money { /* ... */ }
  equals(other: Money): boolean { /* ... */ }
  format(): string { /* ... */ }
}
```

### Признаки низкой связности класса

- Поля не используются большинством методов
- Методы можно сгруппировать в «островки», которые не пересекаются
- Класс называется `XxxManager`, `XxxHelper`, `XxxUtils`
- Описать класс одним предложением сложно

### Как повышать связность

#### Разделение по островкам

Если поля `a`, `b`, `c` используются методами `m1`, `m2`, а поля `d`, `e` — методами `m3`, `m4` — это два класса в одном.

#### Перенос поведения к данным

Если функция всё время работает с одним и тем же объектом — она должна стать методом этого объекта.

```typescript
// ❌ Логика дискаунта живёт снаружи
function applyDiscount(order: Order, percent: number): void {
  order.total = order.total * (1 - percent / 100);
}

// ✅ Это поведение самого заказа
class Order {
  applyDiscount(percent: number): void {
    this.total = this.total * (1 - percent / 100);
  }
}
```

## Связь между coupling и cohesion

Они «перетекают» одна в другую. Если в классе низкая связность — почти всегда есть высокая связанность с тем, кто его использует (потому что вызывающий код «знает», какие методы для какой задачи звать).

```typescript
// ❌ Низкая связность + высокая связанность
class UserUtils {
  formatName(u: User): string { /* ... */ }
  validateEmail(s: string): boolean { /* ... */ }
  hashPassword(p: string): string { /* ... */ }
}

// Все, кто пользуется UserUtils, должны знать, какие методы для чего

// ✅ Разделение увеличивает связность и снижает связанность
class UserNameFormatter {
  format(u: User): string { /* ... */ }
}

class EmailValidator {
  isValid(s: string): boolean { /* ... */ }
}

class PasswordHasher {
  hash(p: string): string { /* ... */ }
}
```

## Карта связностей в проекте

Чтобы оценить состояние проекта, можно построить **граф зависимостей** модулей:

- Узлы — модули
- Стрелки — кто кого импортирует

Признаки беды:
- Несколько модулей с десятками входящих стрелок (хабы)
- Циклы
- «Шар грязи» — все знают всех

В TypeScript можно использовать `madge`:

```bash
npx madge --circular src/
```

## Чек-лист

### Связанность
- [ ] Модули общаются через явные интерфейсы
- [ ] Нет лазов в приватные поля чужих объектов
- [ ] Глобальное состояние сведено к минимуму
- [ ] Импорты не образуют циклов
- [ ] Внешние зависимости подключаются через DI

### Связность
- [ ] Имя модуля описывает его задачу одной фразой
- [ ] Все поля используются большинством методов
- [ ] Нет «островков» внутри класса
- [ ] Методы дополняют друг друга, а не конкурируют

---

> Низкая связанность даёт **гибкость**, высокая связность — **понятность**. Нужно и то, и другое.
