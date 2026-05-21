---
sidebar_position: 3
---

# Extract Function (Выделение функции)

## Суть

Выделение функции — самая частая и самая мощная техника рефакторинга. Берёте кусок кода → даёте ему имя → выносите в отдельную функцию.

```typescript
// ДО
function printReport(orders: Order[]): void {
  console.log('======= REPORT =======');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Orders: ${orders.length}`);
  console.log('======================');

  let total = 0;
  for (const order of orders) {
    total += order.amount;
  }
  console.log(`Total: $${total}`);
}

// ПОСЛЕ
function printReport(orders: Order[]): void {
  printHeader(orders);
  printTotal(orders);
}

function printHeader(orders: Order[]): void {
  console.log('======= REPORT =======');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Orders: ${orders.length}`);
  console.log('======================');
}

function printTotal(orders: Order[]): void {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  console.log(`Total: $${total}`);
}
```

## Когда применять

- Кусок кода требует комментария «что он делает»
- Один и тот же блок встречается в двух+ местах
- Функция делает несколько вещей и хочется дать им имена
- Внутри функции — резкая смена уровня абстракции

> Эвристика: если хочется написать комментарий **что** делает блок — выделите функцию с этим именем вместо комментария.

## Алгоритм

### Шаг 1: Определите границы

Найдите начало и конец фрагмента, который должен стать функцией. Граница — это **логически цельное действие**, а не «удобный кусок строк».

```typescript
// ❌ Произвольная граница
function process(data: Data) {
  const a = data.x * 2;
  const b = a + data.y;   // ← начали выделение тут?
  const c = b * data.z;   // ← закончили тут?
  return c + 10;
}

// ✅ Граница совпадает с понятием
function process(data: Data) {
  return calculateWeightedSum(data) + 10;
}

function calculateWeightedSum(data: Data): number {
  return ((data.x * 2) + data.y) * data.z;
}
```

### Шаг 2: Найдите имя

Имя — главная часть. Если хорошее имя не приходит — выделение преждевременно. Дайте имя действию: `validateEmail`, `formatTimestamp`, `loadUserPermissions`.

Если имя получается типа `processData` — это плохое имя. Слишком общее, ничего не говорит.

### Шаг 3: Определите входы и выходы

Что фрагмент **читает** из внешнего контекста — войдёт в параметры.
Что фрагмент **пишет** наружу — войдёт в возвращаемое значение.

```typescript
// Фрагмент, который выделяем:
//   const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
//   const tax   = total * 0.2;
//   const final = total + tax;
// Использует: items (вход)
// Возвращает: final (выход)

function calculateOrderTotal(items: Item[]): number {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * 0.2;
  return subtotal + tax;
}
```

### Шаг 4: Создайте функцию

В IDE: выделите кусок → правый клик → Refactor → Extract Function (или горячая клавиша). IDE сама расставит параметры.

### Шаг 5: Прогоните тесты

После каждого выделения. Если что-то сломалось — откат, разбор, повтор.

### Шаг 6: Проверьте, не появилось ли ещё одно выделение

Часто после выделения одной функции внутри неё проявляется ещё одна. Это нормально — выделяйте итеративно.

## Тонкости

### Параметры — только то, что действительно используется

Не «передам весь объект, на всякий случай» — это связывает функцию с лишними данными.

```typescript
// ❌ Передаём весь объект, хотя нужно одно поле
function isAdult(user: User): boolean {
  return user.age >= 18;
}

// ✅ Параметр — только то, что нужно
function isAdult(age: number): boolean {
  return age >= 18;
}
```

### Если возвращаемых значений несколько

Используйте объект или явный кортеж — но подумайте, не стоит ли разделить функцию.

```typescript
// Сначала так:
function splitName(fullName: string): { first: string; last: string } {
  const [first, ...rest] = fullName.split(' ');
  return { first, last: rest.join(' ') };
}

// Если потом окажется, что вызывающим нужно только first или только last —
// разделите на две функции.
```

### Что делать с побочными эффектами

Если выделяемый код меняет переменные снаружи — это сигнал, что нужна не просто функция, а команда (метод объекта) или возврат нового значения.

```typescript
// ❌ Скрытое изменение через параметр
function applyDiscount(order: Order): void {
  order.total = order.total * 0.9; // мутация
}

// ✅ Чистая функция: возвращает новое значение
function withDiscount(order: Order): Order {
  return { ...order, total: order.total * 0.9 };
}
```

### Не выделяйте на один шаг слишком много

Иногда хочется одним движением «причесать» 50 строк. Не надо: малыми шагами безопаснее. Выделили — тесты — коммит. Выделили — тесты — коммит.

## Антипатерны выделения

### Псевдо-выделение

Просто разрезали функцию пополам и назвали половинки `step1` и `step2`. Никакого смысла не добавили.

```typescript
// ❌ Имена не несут информации
function processOrder(o: Order) {
  step1(o);
  step2(o);
  step3(o);
}
```

### Слишком мелкое

Выделение однострочника, который и так понятен.

```typescript
// ❌ Лишняя обёртка
function addOne(x: number): number {
  return x + 1;
}

// Зачем? Просто пишите x + 1 на месте.
```

### Выделение «магических» функций

Функция с непонятным именем, в которую втиснута сложная логика.

```typescript
// ❌ Что делает doStuff?
function process(data: Data) {
  return doStuff(data);
}
```

## Чек-лист

- [ ] Нашли логическую границу, а не «удобный кусок строк»
- [ ] Придумали глагольное имя, описывающее действие
- [ ] В параметрах — только то, что реально используется
- [ ] Один результат либо явный объект-результат
- [ ] Нет скрытых мутаций внешнего состояния
- [ ] Тесты зелёные после каждого шага
- [ ] Имя помещается на экран — не `processAndValidateThenSaveUserDataAfterCheckingPermissions`

---

> Если код просит комментария «что я делаю?», выделите функцию с этим вопросом в имени.
