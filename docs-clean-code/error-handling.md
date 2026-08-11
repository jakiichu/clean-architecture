---
sidebar_position: 6
---

# Обработка ошибок

## Не возвращайте технические коды ошибок

Числа вроде `-1`, `400` или `500` не выражают смысл отказа и заставляют вызывающий код знать детали реализации. На границе функции используйте типизированное исключение или `Result` с предметным failure. Выбор фиксируется в проектных соглашениях и применяется последовательно.

```typescript
// ❌ Плохо - возврат кодов ошибок
interface Result {
  status: 'success' | 'error';
  errorCode?: number;
  data?: any;
}

function deleteUser(userId: number): Result {
  if (!userId) {
    return { status: 'error', errorCode: 400 };
  }
  
  if (!userExists(userId)) {
    return { status: 'error', errorCode: 404 };
  }
  
  // Вызывающий код обязан проверять status
  const result = deleteUser(123);
  if (result.status !== 'success') {
    // обработка ошибки
  }
}

// ✅ Хорошо - используйте исключения
function deleteUser(userId: number): void {
  if (!userId) {
    throw new ValidationError('User ID must be provided');
  }
  
  if (!userExists(userId)) {
    throw new NotFoundError(`User with ID ${userId} not found`);
  }
  
  // ... удаление пользователя
  
  // Вызывающий код:
  try {
    deleteUser(123);
  } catch (error) {
    if (error instanceof ValidationError) {
      // обработка ошибки валидации
    } else if (error instanceof NotFoundError) {
      // обработка ошибки "не найдено"
    } else {
      throw error;
    }
  }
}
```

## Напишите Try-Catch-Finally в начале

Если вы используете исключения в коде, убедитесь, что вы оборачиваете вызовы try-catch блоками с самого начала. Не пишите код, который может выкидывать исключения, а потом пытаться добавить try-catch позже.

```typescript
// ❌ Плохо - try-catch добавлен после написания кода
function processFile(filePath: string) {
  const file = readFile(filePath);
  const data = JSON.parse(file);
  const result = transformData(data);
  
  // потом обнаружили ошибки и добавили try-catch
  try {
    // ... но это не помогает
  } catch (error) {
    // ...
  }
}

// ✅ Хорошо - try-catch с самого начала
function processFile(filePath: string): ProcessedData {
  try {
    const file = readFile(filePath);
    const data = JSON.parse(file);
    const result = transformData(data);
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InvalidJSONError(`Failed to parse JSON from ${filePath}`);
    }
    if (error instanceof FileNotFoundError) {
      throw new FileNotFoundError(`File not found: ${filePath}`);
    }
    throw error;
  }
}
```

## Создавайте исключения, ориентированные на вызываемый

Чаще всего нам необходимо выделять класс исключения, который базируется на нуждах вызывающей программы. Выстраивайте иерархию исключений, исходя из этого:

```typescript
// ❌ Плохо - неясные исключения из библиотеки
try {
  const data = externalLibrary.fetchData();
} catch (error: any) {
  if (error.code === 404) {
    // ...
  } else if (error.status === 500) {
    // ...
  }
}

// ✅ Хорошо - создайте свои исключения
class DataFetchError extends Error {
  constructor(message: string, public readonly originalError: Error) {
    super(message);
  }
}

class DataNotFoundError extends DataFetchError {}
class DataServerError extends DataFetchError {}
class DataValidationError extends DataFetchError {}

function fetchData(): Data {
  try {
    return externalLibrary.fetchData();
  } catch (error) {
    if (error.code === 404) {
      throw new DataNotFoundError('Data not found', error);
    }
    if (error.status === 500) {
      throw new DataServerError('Server error', error);
    }
    throw new DataFetchError('Failed to fetch data', error);
  }
}
```

## Не возвращайте null

Возврат null — это источник проблем. Вместо этого выбросьте исключение или верните объект-граница (special case):

```typescript
// ❌ Плохо - возврат null
function findUser(id: number): User | null {
  const user = users.find(u => u.id === id);
  return user || null;
}

// Вызывающий код должен проверять null
const user = findUser(123);
if (user) {
  user.sendEmail();
}

// ✅ Хорошо - вариант 1: бросьте исключение
function findUserOrThrow(id: number): User {
  const user = users.find(u => u.id === id);
  if (!user) {
    throw new NotFoundError(`User with ID ${id} not found`);
  }
  return user;
}

// ✅ Хорошо - вариант 2: верните объект-граница
class NullUser extends User {
  constructor() {
    super({ id: -1, name: 'Unknown', email: '' });
  }
  
  override sendEmail(): void {
    // ничего не делать для null-объекта
  }
}

function findUser(id: number): User {
  const user = users.find(u => u.id === id);
  return user || new NullUser();
}
```

## Не передавайте null

Передача null в качестве аргумента в функцию еще хуже, чем возврат null:

```typescript
// ❌ Плохо - передача null вызывает проблемы
function registerUser(name: string, email: string | null) {
  if (!email) {
    throw new Error('Email is required');  // или неявное поведение
  }
}

// Вызывающий код может передать null и не знать об ошибке
registerUser('John', null);  // неожиданное исключение!

// ✅ Хорошо - требуйте валидные данные
interface UserRegistration {
  name: string;
  email: string;  // никогда не null
}

function registerUser(data: UserRegistration): User {
  if (!data.name || !data.email) {
    throw new ValidationError('Name and email are required');
  }
  // ...
}

// Вызывающий код
const registration: UserRegistration = {
  name: 'John',
  email: 'john@example.com',
};
registerUser(registration);
```

## Изолируйте блоки Try-Catch

Try-catch блоки изменяют структуру кода и нарушают обработку исключений. Лучше всего выделить блоки try-catch в отдельные функции:

```typescript
// ❌ Плохо - try-catch смешан с бизнес-логикой
function processUserData(userData: any): ProcessedUser {
  try {
    const user = validateUser(userData);
    const processed = transformUser(user);
    const saved = saveUser(processed);
    const notified = notifyUser(saved);
    return notified;
  } catch (error) {
    logger.error('Error processing user', error);
    throw error;
  }
}

// ✅ Хорошо - бизнес-логика отделена от обработки ошибок
function saveUser(user: User): User {
  try {
    return database.save(user);
  } catch (error) {
    throw new UserSaveError('Failed to save user', error);
  }
}

function processUserData(userData: any): ProcessedUser {
  const user = validateUser(userData);
  const processed = transformUser(user);
  const saved = saveUser(processed);  // ошибки обработаны здесь
  const notified = notifyUser(saved);
  return notified;
}
```

## Специальные случаи

Создавайте классы, которые имеют специальное поведение для "граничных" случаев:

```typescript
// ✅ Хорошо - специальный случай для гостя
class User {
  constructor(private name: string) {}
  
  getName(): string {
    return this.name;
  }
}

class GuestUser extends User {
  constructor() {
    super('Guest');
  }
}

function getCurrentUser(userId: string | null): User {
  if (!userId) {
    return new GuestUser();  // специальный случай
  }
  
  return userRepository.findById(userId) || new GuestUser();
}

// Использование
const user = getCurrentUser(null);
console.log(user.getName());  // "Guest" - логично и безопасно
```

## Выводы

- **Используйте исключения вместо кодов ошибок**
- **Создавайте иерархии исключений для вашего уровня абстракции**
- **Не возвращайте null и не передавайте null**
- **Выделяйте обработку ошибок в отдельные функции**
- **Используйте специальные объекты для граничных случаев**

> "Обработка ошибок важна, но код, который этим занимается, не должен затемнять логику того, что мы пытаемся достичь."
