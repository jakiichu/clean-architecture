---
sidebar_position: 5
---

# Проектирование API

## Что такое «API» в широком смысле

Когда говорят «API», обычно представляют HTTP-эндпоинты. Но **любая** публичная функция, метод или класс — это API. Это контракт, по которому ваш код используют другие.

Чем удобнее API, тем меньше времени тратит каждый, кто им пользуется.

## Главное правило: проектируйте «снаружи внутрь»

Сначала придумайте, **как вы хотите, чтобы ваш код вызывали**, и только потом — как его реализовать.

```typescript
// 1. Идеальный сценарий вызова
const result = await orders
  .filter({ status: 'pending', userId: 42 })
  .sortBy('createdAt', 'desc')
  .limit(10)
  .fetch();

// 2. Теперь становится ясно, какие методы нужны:
interface OrderQuery {
  filter(criteria: FilterCriteria): OrderQuery;
  sortBy(field: string, direction: 'asc' | 'desc'): OrderQuery;
  limit(count: number): OrderQuery;
  fetch(): Promise<Order[]>;
}
```

## Принципы хорошего API

### 1. «Pit of success» — делайте правильное использование лёгким

Хороший API подталкивает к правильному использованию. Неправильное — должно быть **сложно сделать случайно**.

```typescript
// ❌ Легко вызвать неправильно: какой порядок аргументов?
transfer(100, 'USD', '4242', '5555');

// ✅ Невозможно перепутать
transfer({
  amount: Money.create(100, 'USD'),
  from: accountFrom,
  to: accountTo,
});
```

### 2. Невозможные состояния — невозможны

Если состояние нельзя выразить, его нельзя получить.

```typescript
// ❌ Возможны бессмысленные состояния
interface RequestState {
  isLoading: boolean;
  data: User | null;
  error: Error | null;
}
// Может быть { isLoading: true, data: someUser, error: someError } — это что значит?

// ✅ Через размеченное объединение состояния несовместимы
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };

// Теперь TypeScript не даст одновременно loading + data + error
```

### 3. Симметрия

Парные операции должны быть похожи по форме. Если есть `subscribe`, то `unsubscribe`, а не `removeListener`.

```typescript
// ❌ Несимметричные имена
emitter.on('event', handler);
emitter.detach('event', handler);

// ✅ Симметрия очевидна
emitter.on('event', handler);
emitter.off('event', handler);

// Или функциональный стиль:
const unsubscribe = emitter.subscribe('event', handler);
unsubscribe();
```

### 4. Один способ делать одну вещь

Если у вас есть три способа создать пользователя — пользователи API будут спорить о том, какой правильный, и использовать все три.

```typescript
// ❌ Три способа — пользователи запутаются
class UserService {
  createUser(data: UserData): User;
  newUser(name: string, email: string): User;
  static of(name: string, email: string): User;
}

// ✅ Один очевидный способ
class UserService {
  create(data: UserData): User;
}
```

### 5. Безопасные значения по умолчанию

Опасное поведение должно требовать явного включения.

```typescript
// ❌ По умолчанию выполняет небезопасный код
function executeQuery(sql: string, params?: any, options = { rawMode: true }) {}

// ✅ По умолчанию безопасно
function executeQuery(sql: string, params: any[], options = { rawMode: false }) {}
// Опасный режим — только явно: { rawMode: true }
```

## Уровни абстракции в публичном интерфейсе

Один API не должен смешивать высокий и низкий уровень. Либо «бизнес-операции», либо «низкоуровневые примитивы», но не вперемешку.

```typescript
// ❌ Смешано
class UserApi {
  registerNewUser(data: UserData): User;     // высокий уровень
  insertRow(table: string, row: object): void; // низкий
  sendEmail(to: string, body: string): void;   // средний
}

// ✅ Слой бизнес-операций
class UserApi {
  register(data: UserData): User;
  resetPassword(email: string): void;
  changeEmail(userId: number, newEmail: string): void;
}

// Низкоуровневые операции — в отдельных слоях, не на публичной поверхности
```

## Версионирование и обратная совместимость

Любое изменение публичного API — это **поломка** для кого-то.

### Безопасные изменения

- Добавление новой функции/метода
- Добавление **необязательного** поля в объект параметров
- Расширение возвращаемого объекта новым полем

### Опасные изменения

- Удаление функции, метода, поля
- Переименование
- Изменение типа параметра
- Изменение обязательности параметра
- Изменение поведения при тех же входных данных

```typescript
// ✅ Безопасное расширение
interface CreateUserParams {
  name: string;
  email: string;
  // Добавили необязательный параметр — старые вызовы продолжают работать
  preferredLanguage?: string;
}

// ❌ Ломающее изменение
interface CreateUserParams {
  name: string;
  email: string;
  // Сделали обязательным — старые вызовы упадут
  preferredLanguage: string;
}
```

## Документация публичного API

Каждая публичная функция должна отвечать на три вопроса:

1. **Что она делает?** (одно предложение)
2. **Что принимает?** (типы + ограничения)
3. **Что возвращает / какие ошибки бросает?**

```typescript
/**
 * Переводит деньги между двумя счетами в одной валюте.
 *
 * @param amount  Положительная сумма для перевода
 * @param from    Счёт-отправитель
 * @param to      Счёт-получатель
 * @returns       Идентификатор созданной транзакции
 *
 * @throws {InsufficientFundsError} Если на счёте-отправителе недостаточно средств
 * @throws {CurrencyMismatchError}  Если валюты счетов не совпадают
 */
function transfer(amount: Money, from: Account, to: Account): TransactionId {
  // ...
}
```

Если функция самодокументируемая (хорошие имена + типы) — текстовое описание можно опустить, но **ошибки** и **ограничения** всё равно стоит явно перечислять.

## Идиоматичность

API должен соответствовать привычкам языка/платформы.

- В JavaScript/TypeScript — `Promise`/`async`, а не колбэки
- В Java — `Optional<T>` вместо `null`
- В Python — итераторы, а не списки, если возможно

```typescript
// ❌ Колбэки в современном TypeScript — анахронизм
function fetchUser(id: number, callback: (err: Error | null, user: User | null) => void) {}

// ✅ Async/await — идиоматично
async function fetchUser(id: number): Promise<User> { /* ... */ }
```

## Чек-лист публичного API

- [ ] Сначала придуман способ использования, потом реализация
- [ ] Невозможные состояния невозможны через типы
- [ ] Парные операции симметричны
- [ ] Один способ делать одну вещь
- [ ] Безопасные значения по умолчанию
- [ ] Один уровень абстракции
- [ ] Документированы ошибки и ограничения
- [ ] Идиоматично для языка/платформы
- [ ] Изменения совместимы или версионированы

---

> Хороший API — тот, которым легко пользоваться правильно и трудно неправильно.
