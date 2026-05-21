---
sidebar_position: 3
---

# Функции

Функция должна делать одно, но делать это хорошо.

## Правило единственной ответственности (Single Responsibility)

```typescript
// ❌ Плохо - функция делает слишком много
function processUser(userData) {
  // Проверка валидности
  if (!userData.email || !userData.name) {
    throw new Error("Invalid data");
  }
  
  // Преобразование данных
  const normalizedData = {
    email: userData.email.toLowerCase(),
    name: userData.name.trim(),
  };
  
  // Сохранение в БД
  database.save(normalizedData);
  
  // Отправка письма
  sendEmail(normalizedData.email);
  
  // Логирование
  console.log("User processed");
}

// ✅ Хорошо - каждая функция делает одно
function validateUserData(userData) {
  if (!userData.email || !userData.name) {
    throw new Error("Invalid data");
  }
}

function normalizeUserData(userData) {
  return {
    email: userData.email.toLowerCase(),
    name: userData.name.trim(),
  };
}

function saveUser(userData) {
  database.save(userData);
}

function notifyNewUser(email) {
  sendEmail(email);
}

function processUser(userData) {
  validateUserData(userData);
  const normalized = normalizeUserData(userData);
  saveUser(normalized);
  notifyNewUser(normalized.email);
}
```

## Параметры функции

### Минимизируйте количество параметров

```typescript
// ❌ Плохо - слишком много параметров
function createUser(firstName, lastName, email, phone, address, city, zip) {
  // ...
}

// ✅ Хорошо - используйте объект
function createUser(userData: UserCreateRequest) {
  // ...
}
```

### Избегайте булевых флагов

```typescript
// ❌ Плохо - флаг указывает на то, что функция делает два разных дела
function renderReport(isDetailed: boolean) {
  if (isDetailed) {
    // Один вывод
  } else {
    // Другой вывод
  }
}

// ✅ Хорошо - две отдельные функции
function renderDetailedReport() { }
function renderBriefReport() { }
```

## Длина функции

Функция должна быть достаточно короткой, чтобы её можно было понять с первого взгляда.

```typescript
// ❌ Плохо - функция на 50+ строк
function complexLogic() {
  // ... 50 строк кода
}

// ✅ Хорошо - функция разбита на логические части
function executeComplexWorkflow() {
  prepareData();
  validateData();
  transformData();
  persistData();
  notifySubscribers();
}
```

## Обработка ошибок

```typescript
// ❌ Плохо - функция не обрабатывает ошибки
function fetchUser(id: number) {
  return api.get(`/users/${id}`);
}

// ✅ Хорошо - явная обработка ошибок
function fetchUser(id: number): Promise<User> {
  try {
    const user = await api.get(`/users/${id}`);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  } catch (error) {
    logger.error("Failed to fetch user", { id, error });
    throw error;
  }
}
```

## Побочные эффекты

Минимизируйте побочные эффекты. Если функция имеет побочные эффекты, это должно быть ясно из её названия.

```typescript
// ❌ Плохо - скрытые побочные эффекты
function getUser(id: number) {
  const user = database.find(id);
  user.lastAccessed = new Date(); // побочный эффект!
  database.update(user);
  return user;
}

// ✅ Хорошо - явные побочные эффекты
function getUserById(id: number) {
  return database.find(id);
}

function updateUserAccessTime(id: number) {
  const user = database.find(id);
  user.lastAccessed = new Date();
  database.update(user);
}
```
