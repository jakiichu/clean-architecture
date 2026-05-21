---
sidebar_position: 5
---

# Форматирование (Глава 5)

## Вертикальное форматирование

### Размер файла

Большинство файлов должны быть заметно короче 200 строк, а предпочтительный размер — около 100 строк. Хотя нет жёсткого правила, модульность служит лучшему пониманию кода.

```typescript
// ❌ Плохо - один файл со множеством классов и функций
// utils.ts (400+ строк)
export class UserService { }
export class ProductService { }
export class OrderService { }
export function formatDate() { }
export function calculatePrice() { }
// ... еще 50 функций

// ✅ Хорошо - разделено на отдельные файлы
// services/UserService.ts
// services/ProductService.ts
// services/OrderService.ts
// utils/dateFormatter.ts
// utils/priceCalculator.ts
```

### Концепция — разделение строк

Переменные должны быть объявлены как можно ближе к использованию. Локальные переменные должны появляться в начале каждой функции:

```typescript
// ❌ Плохо - переменные объявлены далеко от использования
function getUserPermissions(userId: number) {
  const userRepository = new UserRepository();
  const permissionService = new PermissionService();
  const roleService = new RoleService();
  
  // 50 строк кода...
  
  const user = userRepository.findById(userId);
  const permissions = permissionService.getByUserId(userId);
  return permissions;
}

// ✅ Хорошо - зависимости инъектированы, переменные близко к использованию
function getUserPermissions(
  userId: number,
  userRepository: UserRepository,
  permissionService: PermissionService
) {
  const user = userRepository.findById(userId);
  const permissions = permissionService.getByUserId(userId);
  return permissions;
}
```

### Видимость из-за сходства

Если два понятия связаны, они должны быть видны рядом. Это усиливает рассказываемую историю, которую рассказывает код.

```typescript
// ✅ Хорошо - связанный код расположен вместе
class Rectangle {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getArea(): number {
    return this.width * this.height;
  }

  getPerimeter(): number {
    return 2 * (this.width + this.height);
  }
}
```

### Расстояние между объявлением и использованием

Переменные должны использоваться в относительной близости к месту объявления. Если между объявлением и первым использованием слишком большое расстояние, это признак того, что нужно разбить функцию:

```typescript
// ❌ Плохо
function processOrder(orderId: number) {
  const order = fetchOrder(orderId);  // объявлена здесь
  
  // 100 строк другого кода...
  
  console.log(order.id);  // используется здесь
}

// ✅ Хорошо
function processOrder(orderId: number) {
  const order = fetchOrder(orderId);
  validateOrder(order);
  
  const items = order.items;
  const total = calculateTotal(items);  // объявлена и используется близко
  
  return total;
}
```

## Горизонтальное форматирование

### Длина строки

Мы должны избегать строк длиной более 120 символов. Очень длинные строки трудно читать.

```typescript
// ❌ Плохо - очень длинная строка
const formattedUserData = `${user.firstName} ${user.lastName} (${user.email}) - Registered on ${new Date(user.registeredAt).toLocaleDateString()} with status ${user.status === 'active' ? 'Active' : 'Inactive'}`;

// ✅ Хорошо - разбита на несколько строк
const userData = {
  name: `${user.firstName} ${user.lastName}`,
  email: user.email,
  registeredOn: new Date(user.registeredAt).toLocaleDateString(),
  status: user.status === 'active' ? 'Active' : 'Inactive',
};

const formattedUserData = `${userData.name} (${userData.email}) - 
  Registered on ${userData.registeredOn} with status ${userData.status}`;
```

### Групповирование и соответствие

Используйте пробелы для получения логического разделения:

```typescript
// ✅ Хорошо - визуальное разделение
class Player {
  public name: string;
  public health: number;
  public mana: number;

  public takeDamage(amount: number): void { }
  public heal(amount: number): void { }

  private calculateStats(): void { }
  private loadFromDatabase(): void { }
}
```

## Выступ (Indentation)

Выступ отражает иерархию области видимости:

```typescript
// ✅ Хорошо - правильное выступление
class Employee {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  public work() {
    if (this.isAvailable()) {
      for (let i = 0; i < this.getTasks().length; i++) {
        const task = this.getTasks()[i];
        task.execute();
      }
    }
  }
}
```

## Правила открытия-закрытия скобок

Правило согласованности:

```typescript
// Вариант 1 - скобка на той же строке (популярнее в TypeScript)
function getUser(id: number) {
  return users.find(u => u.id === id);
}

// Вариант 2 - скобка на новой строке
function getUser(id: number)
{
  return users.find(u => u.id === id);
}

// Главное - ПОСЛЕДОВАТЕЛЬНОСТЬ!
```

## Расстояние между функциями

Функции должны быть отделены одной пустой строкой. Это облегчает визуальное сканирование файла:

```typescript
// ✅ Хорошо - функции отделены пустой строкой
function getUserById(id: number): User {
  return users.find(u => u.id === id);
}

function createUser(userData: UserData): User {
  return new User(userData);
}

function deleteUser(id: number): void {
  users = users.filter(u => u.id !== id);
}
```

## Выводы

- **Файлы должны быть короткими (100-200 строк)**
- **Функции должны быть еще короче**
- **Переменные объявляйте ближе к использованию**
- **Связанный код должен быть видим рядом**
- **Длина строки не более 120 символов**
- **Будьте последовательны в форматировании**

> "Вы отвечаете за то, чтобы ваш код был легко читаемым. Форматирование — это часть этой ответственности."
