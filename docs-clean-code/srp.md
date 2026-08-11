---
sidebar_position: 7
---

# Единственная ответственность

## Правило единственной ответственности (SRP)

Функция должна делать одно, но делать это хорошо. Если функция делает несколько вещей, это проблема:

```typescript
// ❌ Плохо - функция делает слишком много
function processOrder(orderId: number) {
  // 1. Получение заказа из БД
  const order = database.query(`SELECT * FROM orders WHERE id = ${orderId}`);
  
  // 2. Валидация
  if (!order) throw new Error('Order not found');
  if (order.items.length === 0) throw new Error('Empty order');
  
  // 3. Расчет итога
  let total = 0;
  for (let item of order.items) {
    total += item.price * item.quantity;
  }
  
  // 4. Применение скидки
  if (order.customer.loyaltyLevel === 'gold') {
    total = total * 0.9;
  }
  
  // 5. Обновление БД
  database.execute(`UPDATE orders SET total = ${total} WHERE id = ${orderId}`);
  
  // 6. Отправка email
  sendEmail(order.customer.email, `Order #${orderId} processed`);
  
  // 7. Логирование
  logger.info(`Order ${orderId} processed successfully`);
  
  return total;
}

// ✅ Хорошо - каждая функция делает одно
function processOrder(orderId: number): number {
  const order = getOrder(orderId);
  validateOrder(order);
  
  const total = calculateOrderTotal(order);
  applyLoyaltyDiscount(order, total);
  
  updateOrderTotal(orderId, total);
  notifyCustomer(order);
  logOrderProcessing(orderId);
  
  return total;
}

// Каждая функция имеет одну ответственность
function getOrder(orderId: number): Order {
  const order = database.query(`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) throw new NotFoundError(`Order ${orderId} not found`);
  return order;
}

function validateOrder(order: Order): void {
  if (order.items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }
}

function calculateOrderTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function applyLoyaltyDiscount(order: Order, total: number): number {
  if (order.customer.loyaltyLevel === 'gold') {
    return total * 0.9;
  }
  return total;
}

function updateOrderTotal(orderId: number, total: number): void {
  database.execute(`UPDATE orders SET total = ${total} WHERE id = ${orderId}`);
}

function notifyCustomer(order: Order): void {
  emailService.send(order.customer.email, `Order #${order.id} processed`);
}

function logOrderProcessing(orderId: number): void {
  logger.info(`Order ${orderId} processed successfully`);
}
```

## Как узнать, что функция нарушает SRP?

- **Описание содержит слово "и"** — "функция получает и обновляет заказ"
- **Функция использует множество переменных** — много локальных переменных часто сигнализирует о множественности обязанностей
- **Сложно назвать функцию** — если вы не можете придумать хорошее имя, вероятно, функция делает слишком много
- **Функция часто меняется** — если причины для изменения часто разные (БД изменилась, логика изменилась, уведомления изменились), это признак множественной ответственности

## Компактность функций

Маленькие функции более легко понять, тестировать и повторно использовать:

```typescript
// ❌ Плохо - функция на 50+ строк
function handleUserRegistration(userData: UserData): void {
  // Валидация
  if (!userData.email) throw new Error('Email required');
  if (!userData.password) throw new Error('Password required');
  if (userData.password.length < 8) throw new Error('Password too short');
  // ... еще 10 проверок
  
  // Проверка дубликатов
  const existing = database.query(`SELECT * FROM users WHERE email = '${userData.email}'`);
  if (existing) throw new Error('Email already registered');
  
  // Создание пользователя
  const user = new User(userData);
  
  // Сохранение
  database.insert(user);
  
  // Отправка письма
  emailService.sendConfirmation(userData.email);
  
  // Логирование
  logger.info(`User registered: ${userData.email}`);
  
  // Отправка аналитики
  analytics.track('user_registration', { email: userData.email });
}

// ✅ Хорошо - маленькие функции с четкими задачами
function registerUser(userData: UserData): User {
  validateUserData(userData);
  checkEmailNotInUse(userData.email);
  
  const user = createAndSaveUser(userData);
  
  sendRegistrationEmail(user.email);
  trackUserRegistration(user);
  
  return user;
}

function validateUserData(data: UserData): void {
  if (!data.email?.trim()) throw new ValidationError('Email is required');
  if (!data.password?.trim()) throw new ValidationError('Password is required');
  if (data.password.length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (!data.email.includes('@')) throw new ValidationError('Invalid email format');
}

function checkEmailNotInUse(email: string): void {
  const existing = userRepository.findByEmail(email);
  if (existing) throw new DuplicateEmailError(`Email ${email} is already registered`);
}

function createAndSaveUser(userData: UserData): User {
  const user = new User(userData);
  return userRepository.save(user);
}

function sendRegistrationEmail(email: string): void {
  emailService.sendConfirmation(email);
}

function trackUserRegistration(user: User): void {
  analytics.track('user_registration', { userId: user.id, email: user.email });
}
```

## Один уровень абстракции на функцию

Все операции в функции должны быть на одном уровне абстракции:

```typescript
// ❌ Плохо - смешаны разные уровни абстракции
function getUserDashboard(userId: number) {
  // Высокий уровень - бизнес логика
  const user = getUserWithStats(userId);
  
  // Низкий уровень - детали реализации
  let html = '<div class="dashboard">';
  html += '<h1>' + user.name + '</h1>';
  html += '<p>Total spent: $' + user.totalSpent + '</p>';
  html += '<p>Orders: ' + user.orderCount + '</p>';
  html += '</div>';
  
  // Еще более низкий уровень
  return Buffer.from(html).toString('base64');
}

// ✅ Хорошо - один уровень абстракции
function getUserDashboard(userId: number): DashboardData {
  return getUserDashboardData(userId);
}

function getUserDashboardData(userId: number): DashboardData {
  const user = getUserWithStats(userId);
  
  return {
    name: user.name,
    totalSpent: user.totalSpent,
    orderCount: user.orderCount,
  };
}

// Отрисовка - отдельная ответственность
function renderDashboard(data: DashboardData): string {
  return `
    <div class="dashboard">
      <h1>${data.name}</h1>
      <p>Total spent: $${data.totalSpent}</p>
      <p>Orders: ${data.orderCount}</p>
    </div>
  `;
}
```

## Выводы

- **Функция должна делать одно и делать это хорошо**
- **Разбивайте сложные функции на маленькие**
- **Каждая функция должна иметь одну причину для изменения**
- **Поддерживайте один уровень абстракции внутри функции**
- **Хорошее имя - признак хорошей функции**

> "Функция, которая делает одно, легко понять, легко модифицировать, легко тестировать и легко повторно использовать."
