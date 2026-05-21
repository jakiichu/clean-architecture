---
sidebar_position: 3
---

# Написание функций

## Функция — главная единица абстракции

Когда вы пишете функцию, вы создаёте маленький фрагмент языка. Имя функции становится новым «словом», которым вы будете пользоваться в других местах. Если слово выбрано хорошо — код становится выразительнее. Если плохо — добавляется шум.

## Пошаговый процесс написания новой функции

### Шаг 1: Напишите вызов до тела

Перед тем как писать реализацию, напишите, как вы хотите вызывать функцию. Часто этого достаточно, чтобы найти проблемы в дизайне.

```typescript
// Хочу так:
const discount = calculateDiscount(user, order);

// А не так:
const discount = calculateDiscount(user.id, order.items, order.totalPrice, user.subscriptionLevel, new Date());
```

Если в идеальном вызове получается семь параметров — это сигнал пересмотреть проектирование.

### Шаг 2: Напишите тип сигнатуры

Сигнатура — контракт функции. Если её сложно описать типами, реализация тоже будет сложной.

```typescript
// ✅ Чёткая сигнатура: вход — пользователь и заказ, выход — число (множитель скидки)
function calculateDiscount(user: User, order: Order): number;

// ❌ Размытая сигнатура: что значит `any`? Какие поля используются?
function calculateDiscount(data: any): any;
```

### Шаг 3: Напишите минимальное тело

Сначала пишите самый прямолинейный код, который решает задачу. Не оптимизируйте, не обобщайте.

```typescript
function calculateDiscount(user: User, order: Order): number {
  if (user.subscriptionLevel === 'gold') {
    return 0.15;
  }
  if (user.subscriptionLevel === 'silver') {
    return 0.10;
  }
  return 0;
}
```

### Шаг 4: Проверьте имя

После написания тела посмотрите на функцию ещё раз. Соответствует ли имя тому, что она реально делает?

```typescript
// Имя обещает «расчёт скидки», тело возвращает множитель.
// Лучше переименовать:
function getDiscountMultiplier(user: User, order: Order): number {
  // ...
}
```

### Шаг 5: Найдите крайние случаи

- Что если `user` — `null`?
- Что если у заказа нет позиций?
- Что если уровень подписки — неизвестная строка?

Ответьте на эти вопросы явно в коде или в тестах.

## Семь правил хороших функций

### 1. Делай одно

Если в описании функции есть «и» — это два дела, и значит, нужны две функции.

```typescript
// ❌ Делает два дела
function validateAndSaveUser(user: User): void {
  if (!user.email) throw new Error('Email required');
  database.save(user);
}

// ✅ Каждая функция отвечает за одно
function validateUser(user: User): void {
  if (!user.email) throw new Error('Email required');
}

function saveUser(user: User): void {
  database.save(user);
}
```

### 2. Будь короткой

Хорошая функция помещается на один экран без прокрутки. Лучше — 5–15 строк. Если функция длиннее — почти наверняка внутри прячется ещё одна функция.

```typescript
// ❌ Функция-простыня
function processCheckout(cart: Cart, user: User, payment: Payment): Receipt {
  // 40 строк валидации
  // 30 строк расчёта итога
  // 20 строк применения скидок
  // 25 строк работы с платежом
  // 15 строк отправки уведомлений
  // 10 строк формирования чека
  // ...
}

// ✅ Функция-оглавление
function processCheckout(cart: Cart, user: User, payment: Payment): Receipt {
  validateCheckout(cart, user, payment);
  const total = calculateTotalWithDiscounts(cart, user);
  const transaction = chargePayment(payment, total);
  notifyUserAboutPurchase(user, transaction);
  return buildReceipt(transaction, cart);
}
```

### 3. Один уровень абстракции

Все строки функции должны быть на одном «слое» рассуждений. Не смешивайте «высокую» бизнес-логику с «низкими» техническими деталями.

```typescript
// ❌ Смешаны уровни
function publishArticle(article: Article): void {
  if (!article.title) throw new Error('Title required'); // низкий уровень
  article.publishedAt = new Date();                       // средний
  database.execute(`UPDATE articles SET published = true WHERE id = ${article.id}`); // низкий
  notifySubscribers(article);                             // высокий
}

// ✅ Один уровень
function publishArticle(article: Article): void {
  validateForPublishing(article);
  markAsPublished(article);
  notifySubscribers(article);
}
```

### 4. Минимум аргументов

- 0 аргументов — идеально
- 1 аргумент — хорошо
- 2 аргумента — допустимо
- 3 аргумента — старайтесь избегать
- 4+ — почти всегда означает, что нужен объект-параметр или функцию надо разбить

```typescript
// ❌ Семь аргументов
function createInvoice(
  customerId: number,
  items: Item[],
  taxRate: number,
  discount: number,
  currency: string,
  paymentMethod: string,
  dueDate: Date,
): Invoice { /* ... */ }

// ✅ Один параметр-объект
interface InvoiceData {
  customerId: number;
  items: Item[];
  taxRate: number;
  discount: number;
  currency: string;
  paymentMethod: string;
  dueDate: Date;
}

function createInvoice(data: InvoiceData): Invoice { /* ... */ }
```

### 5. Никаких булевых флагов

Булев параметр почти всегда означает, что функция делает две разные вещи. Разделите её.

```typescript
// ❌ Флаг скрывает два разных поведения
function render(template: string, asHtml: boolean): string {
  if (asHtml) return renderToHtml(template);
  return renderToText(template);
}

// ✅ Две явные функции
function renderToHtml(template: string): string { /* ... */ }
function renderToText(template: string): string { /* ... */ }
```

### 6. Никаких побочных эффектов в «чистых» функциях

Если функция называется `calculateTotal`, она не должна логировать в Sentry, обновлять базу и отправлять email. Имя обещает расчёт — пусть только считает.

```typescript
// ❌ Скрытые побочные эффекты
function calculateTotal(cart: Cart): number {
  const total = cart.items.reduce((s, i) => s + i.price, 0);
  analytics.track('total_calculated', { total }); // !!!
  database.cacheTotal(cart.id, total);            // !!!
  return total;
}

// ✅ Чистая функция
function calculateTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price, 0);
}

// Побочные эффекты — отдельно и явно
function trackAndCacheTotal(cart: Cart, total: number): void {
  analytics.track('total_calculated', { total });
  database.cacheTotal(cart.id, total);
}
```

### 7. Разделяй команды и запросы

**Command-Query Separation** (CQS): функция либо что-то делает, либо что-то возвращает, но не обе сразу.

```typescript
// ❌ Команда+запрос: добавляет элемент И возвращает результат
function addItem(cart: Cart, item: Item): boolean {
  if (cart.isFull) return false;
  cart.items.push(item);
  return true;
}

// ✅ Запрос отделён от команды
function canAddItem(cart: Cart): boolean {
  return !cart.isFull;
}

function addItem(cart: Cart, item: Item): void {
  cart.items.push(item);
}

// Использование:
if (canAddItem(cart)) {
  addItem(cart, item);
}
```

## Возврат значений и обработка ошибок

### Не возвращайте `null`

`null` — это специальная семантика, которую вызывающий код может забыть проверить. Лучше:

1. Выбросить исключение, если ситуация исключительная
2. Вернуть «пустой» объект, если ситуация нормальная
3. Использовать `Optional`-подобные типы

```typescript
// ❌ Возврат null
function findUserById(id: number): User | null {
  return database.findById(id);
}

// ✅ Вариант 1: исключение
function getUserById(id: number): User {
  const user = database.findById(id);
  if (!user) throw new NotFoundError(`User ${id} not found`);
  return user;
}

// ✅ Вариант 2: явный Optional-тип
type Maybe<T> = { ok: true; value: T } | { ok: false };

function findUserById(id: number): Maybe<User> {
  const user = database.findById(id);
  return user ? { ok: true, value: user } : { ok: false };
}
```

### Не принимайте `null`

Если в аргументах есть `null`, вызывающий код может его «по ошибке» передать. Лучше требовать явные данные или иметь перегрузки.

```typescript
// ❌ null в аргументах
function sendEmail(to: string, cc: string | null): void { /* ... */ }

// ✅ Если cc может отсутствовать — используйте опциональный параметр или массив
function sendEmail(to: string, cc?: string[]): void { /* ... */ }
```

## Чек-лист новой функции

- [ ] Имя глагольное, описывает действие
- [ ] Функция помещается на одном экране
- [ ] Делает одно
- [ ] Один уровень абстракции
- [ ] Не более 3 аргументов
- [ ] Нет булевых флагов
- [ ] Нет скрытых побочных эффектов
- [ ] Команда либо запрос — но не оба
- [ ] Не возвращает `null` без необходимости
- [ ] Покрыта тестом

---

> Хорошая функция читается как абзац хорошо написанной книги: каждое предложение на своём месте, ничего лишнего.
