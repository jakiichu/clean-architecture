---
sidebar_position: 8
---

# Классы (Глава 6)

## Организация классов

Класс должна быть разбита на логические секции:

```typescript
// ✅ Хорошо - стандартный порядок членов класса
class User {
  // Статические переменные
  static readonly DEFAULT_ROLE = 'user';
  
  // Переменные экземпляра - публичные
  public id: number;
  
  // Переменные экземпляра - защищенные
  protected createdAt: Date;
  
  // Переменные экземпляра - приватные
  private lastLogin: Date;
  
  // Конструктор
  constructor(id: number) {
    this.id = id;
    this.createdAt = new Date();
  }
  
  // Статические методы
  static create(name: string): User {
    return new User(generateId());
  }
  
  // Публичные методы
  login(): void {
    this.lastLogin = new Date();
  }
  
  // Защищенные методы
  protected getTimeSinceCreation(): number {
    return Date.now() - this.createdAt.getTime();
  }
  
  // Приватные методы
  private validateLogin(): boolean {
    return this.lastLogin != null;
  }
}
```

## Инкапсуляция

Переменные и утилита-методы должны быть приватными. Выставляйте только необходимый интерфейс:

```typescript
// ❌ Плохо - все публично
class BankAccount {
  public balance: number = 0;
  public accountNumber: string;
  public pin: string;
  
  public withdraw(amount: number): void {
    this.balance -= amount;  // никакой проверки!
  }
}

const account = new BankAccount();
account.balance = -1000;  // можно просто присвоить!
account.pin = '1111';      // PIN в открытом виде!

// ✅ Хорошо - инкапсуляция
class BankAccount {
  private balance: number = 0;
  private accountNumber: string;
  private pin: string;
  
  getBalance(): number {
    return this.balance;
  }
  
  withdraw(amount: number): void {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }
    if (amount > this.balance) {
      throw new InsufficientFundsError('Insufficient funds');
    }
    this.balance -= amount;
  }
  
  deposit(amount: number): void {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }
    this.balance += amount;
  }
}

const account = new BankAccount();
account.deposit(1000);
account.withdraw(500);
console.log(account.getBalance());  // только через метод!
```

## Классы должны быть маленькими

Первое правило классов: класс должен быть маленьким. Второе правило: класс должен быть еще меньше.

```typescript
// ❌ Плохо - класс делает слишком много (200+ строк)
class User {
  // Управление профилем
  updateProfile() { }
  getProfile() { }
  
  // Управление паролем
  changePassword() { }
  resetPassword() { }
  
  // Управление сессией
  login() { }
  logout() { }
  
  // Отправка уведомлений
  sendEmail() { }
  sendSMS() { }
  
  // Работа с базой данных
  save() { }
  delete() { }
  
  // Проверка прав доступа
  hasPermission() { }
  
  // ... еще 50 методов
}

// ✅ Хорошо - разделено на классы с одной ответственностью
class User {
  constructor(
    public id: number,
    public email: string,
    public name: string,
  ) {}
}

class UserProfile {
  constructor(private user: User) {}
  update(data: ProfileData): void { }
  get(): UserData { return {}; }
}

class UserPasswordManager {
  constructor(private user: User) {}
  change(oldPassword: string, newPassword: string): void { }
  reset(email: string): void { }
}

class UserSession {
  constructor(private user: User) {}
  login(credentials: Credentials): void { }
  logout(): void { }
}

class UserNotification {
  constructor(private user: User) {}
  sendEmail(message: string): void { }
  sendSMS(message: string): void { }
}

class UserRepository {
  save(user: User): void { }
  delete(id: number): void { }
}

class PermissionChecker {
  hasPermission(user: User, action: string): boolean { }
}
```

## Когда класс велик - это всегда один признак проблемы

Считайте строки кода в классе:

```typescript
// Если класс содержит 200+ строк - это красный флаг
// Если класс имеет 20+ методов - это красный флаг
// Если класс меняется по разным причинам - это красный флаг

// ✅ Хорошо - класс должен быть ~50-100 строк
class UserRepository {
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  async findById(id: number): Promise<User | null> {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
  
  async findByEmail(email: string): Promise<User | null> {
    return this.db.query('SELECT * FROM users WHERE email = ?', [email]);
  }
  
  async save(user: User): Promise<User> {
    return this.db.insert('users', user);
  }
  
  async delete(id: number): Promise<void> {
    return this.db.delete('users', { id });
  }
}
```

## Когеренция

Когда переменные и методы класса высоко связаны, это означает высокую когерентность. Высокая когерентность - это хорошо.

```typescript
// ❌ Плохо - низкая когерентность
class Stack {
  private items: any[] = [];
  
  push(item: any): void { this.items.push(item); }
  pop(): any { return this.items.pop(); }
  peek(): any { return this.items[this.items.length - 1]; }
  
  // Не связано со стеком!
  sendEmail(to: string): void { }
  formatDate(date: Date): string { }
  calculateTax(amount: number): number { }
}

// ✅ Хорошо - высокая когерентность
class Stack<T> {
  private items: T[] = [];
  
  push(item: T): void { this.items.push(item); }
  pop(): T { return this.items.pop()!; }
  peek(): T { return this.items[this.items.length - 1]; }
  isEmpty(): boolean { return this.items.length === 0; }
  size(): number { return this.items.length; }
}

class EmailService {
  send(to: string, message: string): void { }
}

class DateFormatter {
  format(date: Date, pattern: string): string { }
}

class TaxCalculator {
  calculate(amount: number): number { }
}
```

## Выводы

- **Классы должны быть маленькими (50-100 строк)**
- **Один класс - одна ответственность**
- **Используйте инкапсуляцию - делайте переменные приватными**
- **Высокая когерентность - методы используют переменные класса**
- **Разбивайте большие классы на маленькие классы**

> "Красивый класс выглядит так, будто автор тратил больше времени на структурирование класса, чем на написание его логики."
