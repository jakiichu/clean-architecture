---
sidebar_position: 2
---

# Запахи кода

## Что такое «запах»

Запах кода — это поверхностный признак, по которому можно заподозрить более глубокую проблему. Сам по себе запах не делает код плохим автоматически — но если он есть, стоит присмотреться.

Запахи — это **подсказки**, а не правила.

## Запахи в функциях

### Длинная функция

Функция на 50, 100, 300 строк — почти всегда содержит несколько ответственностей.

**Лекарство**: выделение функций (Extract Function), пока каждая не делает одно.

### Слишком много параметров

5 и более параметров — функцию сложно вызвать, легко перепутать порядок.

**Лекарство**: параметр-объект, либо разделение функции.

### Длинный список булевых аргументов

```typescript
// ❌ Что это значит при вызове?
exportData(true, false, true, false);

// ✅ Объект делает смысл явным
exportData({ compress: true, includeMetadata: false, encrypted: true, async: false });
```

### Магические числа и строки

```typescript
// ❌ Что значит 86400000?
if (Date.now() - lastVisit > 86400000) {
  // ...
}

// ✅ Имя раскрывает смысл
const DAY_IN_MS = 24 * 60 * 60 * 1000;
if (Date.now() - lastVisit > DAY_IN_MS) {
  // ...
}
```

### Флаги, меняющие поведение

Если параметр-флаг полностью меняет логику функции — это две функции под одним именем.

```typescript
// ❌
function generate(asPdf: boolean) {
  if (asPdf) { /* совсем другая ветка */ }
  else      { /* совсем другая ветка */ }
}

// ✅
function generatePdf() { /* ... */ }
function generateHtml() { /* ... */ }
```

### Команда + запрос в одной функции

Функция меняет состояние **и** что-то возвращает — её сложнее тестировать и предсказуемо использовать.

## Запахи в классах

### Большой класс

100+ строк — присмотритесь. 500+ — почти точно много ответственностей.

### Завистливая функция (Feature Envy)

Метод одного класса больше работает с полями другого класса, чем со своими.

```typescript
// ❌ OrderPrinter лезет во всё OrderItem
class OrderPrinter {
  print(item: OrderItem) {
    const total = item.price * item.quantity * (1 - item.discount);
    const formatted = `${item.name}: $${total.toFixed(2)}`;
    console.log(formatted);
  }
}

// ✅ Расчёт перенесён туда, где данные
class OrderItem {
  getTotal(): number {
    return this.price * this.quantity * (1 - this.discount);
  }
}

class OrderPrinter {
  print(item: OrderItem) {
    console.log(`${item.name}: $${item.getTotal().toFixed(2)}`);
  }
}
```

### Цепочка вызовов (Train Wreck)

```typescript
// ❌ Закон Деметры нарушен — лезем через несколько уровней
order.getCustomer().getAddress().getCity().getName();

// ✅ Спрашивайте у объекта то, что нужно
order.getCustomerCity();
```

### Группа данных, путешествующая вместе

Если одни и те же 3–4 поля передаются вместе из функции в функцию — они должны стать объектом.

```typescript
// ❌ Тройка постоянно ходит вместе
function createUser(firstName: string, lastName: string, middleName: string) {}
function formatUser(firstName: string, lastName: string, middleName: string) {}
function searchByName(firstName: string, lastName: string, middleName: string) {}

// ✅ Объект-имя
interface FullName {
  first: string;
  middle?: string;
  last: string;
}
function createUser(name: FullName) {}
```

### «Data class» / Анемичная модель

Класс — это только набор полей с геттерами и сеттерами, всё поведение раскидано по другим классам.

```typescript
// ❌ Только данные — поведение «утекло» наружу
class Order {
  items: Item[] = [];
  status: string = '';
}

// Логика — везде, где работают с Order
function addItemToOrder(order: Order, item: Item) { /* ... */ }
function changeOrderStatus(order: Order, status: string) { /* ... */ }

// ✅ Поведение там же, где данные
class Order {
  private items: Item[] = [];
  private status: OrderStatus = 'pending';

  addItem(item: Item): void { /* ... */ }
  cancel(): void { /* ... */ }
}
```

## Запахи между классами

### Циклическая зависимость

`A` импортирует `B`, `B` импортирует `A`. Часто означает, что нужна третья сущность, которая объединит общее, или что граница между классами проведена неверно.

### Неуместная близость

Два класса знают слишком много друг о друге: лезут в приватные методы, используют внутренние имена.

### Параллельные иерархии

Каждый раз, когда добавляется новый подкласс в иерархии `A`, нужно добавлять подкласс и в иерархию `B`. Знак того, что обе иерархии — об одном и том же.

### Класс, который только делегирует

```typescript
// ❌ UserController — просто пересылка
class UserController {
  constructor(private service: UserService) {}
  getById(id: number) { return this.service.getById(id); }
  create(data: UserData) { return this.service.create(data); }
  delete(id: number) { return this.service.delete(id); }
}
```

Если в классе нет своей логики — он, скорее всего, лишний.

## Запахи на уровне системы

### Дробовик-изменение (Shotgun Surgery)

Одно небольшое изменение требует правок в десятках файлов. Знак, что одно понятие размазано по всему коду.

### Расходящееся изменение (Divergent Change)

Один и тот же класс меняется по совершенно разным причинам — то «когда меняется БД», то «когда меняются правила», то «когда меняется UI». Класс делает слишком много.

### Замок из условий

```typescript
// ❌ Длинный switch повторяется в разных местах кода
function getDiscount(role: string): number {
  switch (role) {
    case 'admin': return 0.20;
    case 'editor': return 0.15;
    case 'viewer': return 0.05;
    default: return 0;
  }
}

function getMaxFileSize(role: string): number {
  switch (role) {
    case 'admin': return 1024 * 1024 * 100;
    case 'editor': return 1024 * 1024 * 50;
    case 'viewer': return 1024 * 1024 * 10;
    default: return 1024 * 1024;
  }
}

// ✅ Поведение перенесено в полиморфные объекты
interface Role {
  getDiscount(): number;
  getMaxFileSize(): number;
}

const ROLES: Record<string, Role> = {
  admin:  { getDiscount: () => 0.20, getMaxFileSize: () => 100 * MB },
  editor: { getDiscount: () => 0.15, getMaxFileSize: () =>  50 * MB },
  viewer: { getDiscount: () => 0.05, getMaxFileSize: () =>  10 * MB },
};
```

## Запахи в тестах

### Тест, который проверяет реализацию, а не поведение

```typescript
// ❌ Тест ломается при любом рефакторинге
it('calls private helper three times', () => {
  const spy = jest.spyOn(service as any, '_internalHelper');
  service.process();
  expect(spy).toHaveBeenCalledTimes(3);
});

// ✅ Тест проверяет наблюдаемое поведение
it('processes all items', () => {
  const result = service.process([a, b, c]);
  expect(result.processed).toBe(3);
});
```

### Огромный setUp / beforeEach

Если для теста нужна сложная подготовка — значит, тестируемый код имеет много зависимостей. Это запах **кода**, а не теста.

### Тест на тест

Тесты, которые проверяют другие тесты, mock-моки и т.п. Обычно знак того, что границы абстракций проведены неверно.

## Запахи в комментариях

### Комментарий, который оправдывает плохой код

```typescript
// HACK: разбираемся с тем, что иногда юзер бывает null,
// хотя в типах он не null. Не спрашивайте почему.
function process(user: User) {
  if (!user) return;
  // ...
}
```

Лучше — исправить тип и убрать комментарий.

### Закомментированный код

Закомментированный код — это шум. Если он нужен — храните его в git, не в файле.

### Журнал изменений в коде

```typescript
// 2023-01-15: Added by John (bug #4242)
// 2023-03-22: Modified by Sara (request from product)
// 2023-05-01: Refactored by Mike
function calculatePrice() { /* ... */ }
```

Это уже есть в `git log`. Удаляйте.

## Карточка анализа

Когда читаете чужой (или свой старый) код, прогоняйте чек-лист:

- [ ] Длинные функции (>30 строк)
- [ ] Глубокая вложенность (>3 уровней)
- [ ] Много параметров (>3)
- [ ] Магические числа/строки
- [ ] Дублирование (≥3 повторений)
- [ ] Большие классы (>200 строк)
- [ ] Анемичные модели
- [ ] Feature envy
- [ ] Цепочки вызовов через геттеры
- [ ] Циклические зависимости
- [ ] Длинные switch/if-elseif-цепочки
- [ ] Закомментированный код
- [ ] Комментарии-оправдания
- [ ] Тесты, прибитые к реализации

Каждая отметка — точка для следующего шага: **рефакторинга**.

---

> Запах — это не приговор, а указатель. Куда смотреть — решаете вы.
