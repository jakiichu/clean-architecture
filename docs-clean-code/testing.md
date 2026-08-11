---
sidebar_position: 9
---

# Тестирование

## Три закона TDD

Если вы практикуете Test-Driven Development (TDD), придерживайтесь этих трёх законов:

1. **Вы не можете писать код на производстве перед написанием тестового кода, который это не проходит.**
2. **Вы не можете писать больше тестового кода, чем достаточно для отказа (неудачи компиляции - это неудача).**
3. **Вы не можете писать больше кода на производстве, чем достаточно для прохождения одного теста.**

```typescript
// ❌ Плохо - писать код без тестов
function calculatePrice(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

// ✅ Хорошо - TDD подход
// Шаг 1: Напишите тест (он не пройдет)
describe('calculatePrice', () => {
  it('should return 0 for empty list', () => {
    expect(calculatePrice([])).toBe(0);
  });
  
  it('should calculate total for single item', () => {
    const items = [{ price: 10, quantity: 2 }];
    expect(calculatePrice(items)).toBe(20);
  });
});

// Шаг 2: Напишите минимальный код для прохождения теста
function calculatePrice(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

// Шаг 3: Рефакторинг
function calculatePrice(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

## Чистые тесты

Тесты должны быть чистыми так же, как и код. Они должны быть простыми, читаемыми и поддерживаемыми.

### Читаемость - главное

```typescript
// ❌ Плохо - сложный, трудно читаемый тест
describe('getUserWithOrders', () => {
  it('t1', () => {
    const db = new MockDatabase();
    const u = new User('1', 'john@example.com', 'John');
    const o1 = new Order('1', 'Laptop', 1200);
    const o2 = new Order('2', 'Mouse', 30);
    db.insert('users', u);
    db.insert('orders', o1);
    db.insert('orders', o2);
    const result = getUserWithOrders('1', db);
    expect(result.user.email).toBe('john@example.com');
    expect(result.orders.length).toBe(2);
    expect(result.orders[0].name).toBe('Laptop');
  });
});

// ✅ Хорошо - ясный, лаконичный тест
describe('getUserWithOrders', () => {
  it('should return user with all orders', () => {
    // Arrange - подготовка данных
    const user = createUser('john@example.com');
    const orders = [
      createOrder('Laptop'),
      createOrder('Mouse'),
    ];
    const database = createTestDatabase({ user, orders });
    
    // Act - выполнение
    const result = getUserWithOrders(user.id, database);
    
    // Assert - проверка результата
    expect(result.user.email).toBe('john@example.com');
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].name).toBe('Laptop');
  });
});

// Вспомогательные функции для создания тестовых данных
function createUser(email: string): User {
  return new User(generateId(), email, 'Test User');
}

function createOrder(name: string): Order {
  return new Order(generateId(), name, 100);
}

function createTestDatabase(data: any): Database {
  const db = new MockDatabase();
  if (data.user) db.insert('users', data.user);
  if (data.orders) data.orders.forEach(o => db.insert('orders', o));
  return db;
}
```

## Pattern AAA (Arrange-Act-Assert)

Структурируйте каждый тест:

```typescript
describe('UserValidator', () => {
  it('should reject email without @', () => {
    // Arrange - подготовка
    const validator = new UserValidator();
    const invalidEmail = 'notanemail';
    
    // Act - действие
    const result = validator.isValidEmail(invalidEmail);
    
    // Assert - проверка
    expect(result).toBe(false);
  });
  
  it('should accept valid email', () => {
    // Arrange
    const validator = new UserValidator();
    const validEmail = 'user@example.com';
    
    // Act
    const result = validator.isValidEmail(validEmail);
    
    // Assert
    expect(result).toBe(true);
  });
});
```

## Один концепт на тест

Каждый тест должен проверять одно поведение:

```typescript
// ❌ Плохо - много концепций в одном тесте
it('should register user, send email, and create log', () => {
  const user = new User('john@example.com');
  const emailService = jest.fn();
  const logger = jest.fn();
  
  registerUser(user, emailService, logger);
  
  expect(user.isRegistered).toBe(true);
  expect(emailService).toHaveBeenCalledWith('john@example.com');
  expect(logger).toHaveBeenCalledWith('User registered');
});

// ✅ Хорошо - один концепт на тест
it('should register user', () => {
  const user = new User('john@example.com');
  registerUser(user);
  expect(user.isRegistered).toBe(true);
});

it('should send email after registration', () => {
  const user = new User('john@example.com');
  const emailService = jest.fn();
  registerUser(user, emailService);
  expect(emailService).toHaveBeenCalledWith('john@example.com');
});

it('should log registration', () => {
  const user = new User('john@example.com');
  const logger = jest.fn();
  registerUser(user, undefined, logger);
  expect(logger).toHaveBeenCalledWith('User registered');
});
```

## F.I.R.S.T. правило для тестов

- **F**ast (Быстрые) - тесты должны выполняться быстро
- **I**ndependent (Независимые) - тесты не должны зависеть друг от друга
- **R**epeatable (Повторяемые) - результаты должны быть одинаковыми при повторном запуске
- **S**elf-Validating (Самопроверяющиеся) - пройден или не пройден, без ручной проверки
- **T**imely (Своевременные) - напишите тесты перед кодом (TDD)

```typescript
// ❌ Плохо - медленные, зависимые тесты
describe('UserService', () => {
  let service: UserService;
  
  beforeEach(() => {
    // Создаем реальную БД каждый раз - МЕДЛЕННО!
    service = new UserService(new RealDatabase());
  });
  
  it('test1', async () => {
    // Берется результат из test1
    const user = await service.getUser(1);
    // зависит от результатов предыдущего теста!
  });
  
  it('test2', () => {
    // Требует реальной БД - МЕДЛЕННО!
    // Требует интернета - может быть непредсказуемо!
  });
});

// ✅ Хорошо - быстрые, независимые тесты
describe('UserService', () => {
  let service: UserService;
  let mockDatabase: jest.Mocked<Database>;
  
  beforeEach(() => {
    // Используем mock - БЫСТРО!
    mockDatabase = createMockDatabase();
    service = new UserService(mockDatabase);
  });
  
  it('should return user by id', async () => {
    // Независимый тест
    mockDatabase.findById.mockResolvedValue(createTestUser());
    const user = await service.getUser(1);
    expect(user).toBeDefined();
  });
  
  it('should handle user not found', async () => {
    // Независимый тест, не зависит от предыдущего
    mockDatabase.findById.mockResolvedValue(null);
    const user = await service.getUser(999);
    expect(user).toBeNull();
  });
});
```

## Избегайте тестовых антипаттернов

```typescript
// ❌ Плохо - игнорирование неудачных тестов
it.skip('should handle edge case', () => {
  // Когда-то исправим...
  expect(true).toBe(true);
});

// ❌ Плохо - фиксированные значения вместо переменных
it('should multiply', () => {
  expect(2 * 3).toBe(6);
});

// ❌ Плохо - тесты которые всегда проходят
it('should work', () => {
  const result = someFunction();
  // Нет проверки!
});

// ✅ Хорошо
it('should multiply two numbers correctly', () => {
  const a = 2;
  const b = 3;
  const expected = 6;
  expect(multiply(a, b)).toBe(expected);
});
```

## Выводы

- **Тесты так же важны, как и рабочий код**
- **Тесты должны быть чистыми и читаемыми**
- **Используйте паттерн AAA: Arrange-Act-Assert**
- **Один концепт на тест**
- **Следуйте правилу F.I.R.S.T.**
- **Тесты должны контролировать специфику благодаря зависимостям**

> "Если вы хотите быстро писать код и быть уверенным в его качестве, пишите тесты. Тесты - это ваша безопасность."
