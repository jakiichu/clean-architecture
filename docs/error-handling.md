---
title: Обработка ошибок и управление состоянием загрузки
sidebar_position: 11
---

# Обработка ошибок и управление состоянием загрузки

Надёжное приложение отличается не только корректной работой в идеальных условиях, но и предсказуемым поведением при сбоях сети, невалидных данных, ограничениях ОС или временной недоступности бэкенда. В чистой архитектуре обработка ошибок строго регламентирована: каждый слой отвечает за свой тип сбоев, преобразует их в понятный формат и передаёт ответственность дальше по цепочке.

Данный раздел описывает классификацию ошибок, правила их распространения между слоями, стандартизацию интерфейсов, стратегии повторных попыток и управление индикаторами загрузки.

## Классификация ошибок по слоям

| Тип ошибки | Источник | Где перехватывается | Примеры                                                                           |
|------------|----------|---------------------|-----------------------------------------------------------------------------------|
| **Инфраструктурная (Infrastructure)** | Сетевой стек, таймауты, отсутствие интернета, ошибки парсинга JSON, ограничения ОС (Keychain заблокирован) | `Data` (репозитории, адаптеры, HTTP-клиент) | `ERR_NETWORK`, `TIMEOUT`, `SECURE_STORE_LOCKED`, `CAMERA_PERMISSION_DENIED`       |
| **Доменная (Domain)** | Нарушение бизнес-инвариантов, невалидные входные данные, истёкший срок действия QR, превышение лимита попыток PIN | `Domain` (use-case, валидаторы, сущности) | `INVALID_SMS_CODE`, `QR_CODE_EXPIRED`, `PIN_ATTEMPTS_EXCEEDED`, `SESSION_REVOKED` |
| **Презентационная (UI/Presentation)** | Ошибки валидации формы, конфликты состояний интерфейса, невозможность отобразить данные | `App` (презентеры, компоненты, guards) | `FORM_REQUIRED_FIELD`, `NAVIGATION_STACK_OVERFLOW`, `RENDER_QR_FAILED`            |

## Поток обработки ошибок

Ошибки движутся снизу вверх, но преобразуются на каждом уровне:

1. **Data → Domain**: Инфраструктурный слой перехватывает низкоуровневые сбои (сеть, диск, нативные модули). Он не пробрасывает сырые исключения фреймворков. Вместо этого ошибки маппятся в стандартизированные `IInfrastructureError` или трансформируются в доменные ошибки, если сбой влияет на бизнес-правила (например, `401 Unauthorized` → `SESSION_EXPIRED`).
2. **Domain → App**: Доменный слой валидирует данные и применяет инварианты. При нарушении правил выбрасывается `IDomainError`. Use-case не ловит ошибки сети или UI — он только гарантирует, что возвращаемый результат или исключение соответствуют контракту.
3. **App → UI**: Слой презентации перехватывает ошибки из `useQuery`/`useMutation`, маппит их в пользовательские сообщения, управляет состоянием `isError`/`isLoading`, показывает тосты, алерты или fallback-экраны. Навигация и побочные эффекты выполняются только после успешного результата или в блоке `onError`.

## Стандартизация интерфейсов ошибок

Для единообразия и типобезопасности в проекте используется иерархия интерфейсов ошибок. Все ошибки наследуют базовую структуру, но содержат специфичные поля для отладки и локализации.

```typescript
// domain/common/interface/errors/IAppError.ts
interface IAppError extends Error {
  readonly code: string;
  readonly layer: 'data' | 'domain' | 'app';
  readonly isRetryable: boolean;
  readonly userMessage?: string;
  readonly technicalDetails?: Record<string, unknown>;
}

interface IDomainError extends IAppError {
  readonly layer: 'domain';
  readonly violationRule: string;
}

interface IInfrastructureError extends IAppError {
  readonly layer: 'data';
  readonly statusCode?: number;
  readonly originalError?: unknown;
}
```

Пример генерации ошибки в Domain:
```typescript
// domain/qr/use-case/ValidateQRCodeUseCase.ts
const execute = (port: IValidateQRPort): IValidationResult => {
  const currentTimeValue: number = Date.now();
  const isExpiredValue: boolean = currentTimeValue > port.expiresAt;

  if (isExpiredValue) {
    const expirationErrorValue: IDomainError = {
      name: 'QRCodeExpiredError',
      message: 'QR-код утратил актуальность',
      code: 'QR_EXPIRED',
      layer: 'domain',
      isRetryable: false,
      userMessage: 'Код устарел. Запросите новый у посетителя.',
      violationRule: 'timestamp_validation',
    };
    throw expirationErrorValue;
  }

  return { isValid: true, visitorStatus: port.visitorStatus };
};
```

## Управление состоянием загрузки

Состояние загрузки не является бизнес-данными. Оно относится к UI State и управляется исключительно в слое `App`.

| Сценарий | Инструмент | Где определяется |
|----------|------------|------------------|
| Запрос данных (GET) | `useQuery.isLoading` / `isFetching` | Хук запроса → презентер → компонент |
| Отправка данных (POST/PUT) | `useMutation.isPending` | Хук мутации → обработчик кнопки → лоадер |
| Инициализация приложения | Zustand `isLoading` / Guard `isReady` | `SessionInitializer` → Root Layout |
| Фоновая синхронизация | `isRefetching` / `status === 'success'` | Клиент кэширования → индикатор в шапке |

### Рекомендации по UX состояний
- **Skeleton vs Spinner:** Skeleton используется для структурных данных (списки, профили), Spinner — для атомарных действий (кнопка подтверждения, модальное окно).
- **Блокировка интерфейса:** При `isPending === true` все интерактивные элементы сценария должны получать `disabled`. Это предотвращает двойные отправки и гонки состояний.
- **Оптимистичные обновления:** Применяются только для некритичных действий (лайки, черновики). Для авторизации, платежей и валидации пропусков используется только пессимистичный подход (ожидание ответа сервера).

## Глобальная обработка и восстановление

### Error Boundary
Для предотвращения падения всего приложения при ошибках рендеринга используется компонент высшего порядка `ErrorBoundary`. Он перехватывает ошибки в дереве React, логирует их в аналитику и отображает fallback-UI с возможностью перезагрузки экрана.

```tsx
// app/common/ui/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(errorValue: Error): IErrorBoundaryState {
    return { hasError: true, error: errorValue };

  }

  render() {
    if (this.state.hasError) {
      return <FallbackScreen onRetry={this.handleRetry} errorMessage={this.state.error?.message} />;
    }
    return this.props.children;
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRecovery?.();
  };
}
```

### Стратегии повторных попыток (Retry)
Повторные запросы настраиваются на уровне клиента кэширования, а не в use-case. Это позволяет централизованно управлять политикой повторов.

| Тип запроса | Retry Policy | Обоснование |
|-------------|--------------|-------------|
| GET (списки, профиль) | `retry: 2`, `retryDelay: exponential` | Временные сбои сети, безопасно повторять |
| POST (авторизация, генерация QR) | `retry: 0` или `retry: 1` (только 5xx) | Идемпотентность не гарантирована, риск дублей |
| WebSocket / Polling | Встроенный reconnect с backoff | Долгосрочное соединение, требует восстановления |

### Fallback и деградация
При недоступности критичных сервисов приложение должно переходить в режим ограниченной функциональности:
- Кэшированные данные отображаются с пометкой «Оффлайн-режим»
- Действия, требующие сети, блокируются с понятным сообщением
- Ошибки аутентификации сбрасывают локальную сессию и перенаправляют на экран входа

## Антипаттерны обработки ошибок

1. **Поглощение ошибок в Domain**
   Use-case не должен ловить исключения и возвращать `null` или пустые объекты. Это скрывает причину сбоя от слоя App и ломает типизацию.
2. **Проброс сырых HTTP-ошибок в UI**
   Сообщения вроде `Request failed with status code 500` не должны доходить до пользователя. `Data` маппит их в `INetworkError`, `App` показывает локализованное сообщение.
3. **Управление загрузкой в Domain**
   Флаги `isLoading` не передаются через порты и не хранятся в DTO. Это исключительно задача презентера.
4. **Отсутствие `isRetryable` флага**
   Не все ошибки можно повторить. Таймауты и 5xx — можно. 4xx, валидация, истёкшие токены — нет. Флаг должен присутствовать в интерфейсе ошибки.
5. **Логирование чувствительных данных**
   В `technicalDetails` никогда не попадают токены, пароли, PIN-коды или полные payload с персональными данными. Логируются только коды ошибок, статусы и обезличенные метрики.

## Чек-лист внедрения обработки ошибок

- [ ] Все ошибки наследуют `IAppError` и содержат `code`, `layer`, `isRetryable`
- [ ] `Data` перехватывает инфраструктурные сбои и маппит их в стандартизированный формат
- [ ] `Domain` выбрасывает только `IDomainError` при нарушении инвариантов
- [ ] `App` отображает `userMessage` или fallback, не показывая технические детали
- [ ] Состояние `isLoading`/`isPending` блокирует повторные действия
- [ ] Retry-политика настроена централизованно в клиенте запросов
- [ ] Критичные экраны обёрнуты в `ErrorBoundary`
- [ ] Ошибки аутентификации очищают SecureStore и сбрасывают навигацию
- [ ] Логи ошибок не содержат чувствительных данных

## Дальнейшее чтение
- [Управление состоянием](./cross-cutting/state-management) — разделение UI State и Server State при обработке сбоев
- [Пример реализации фичи (Mutation)](./examples/feature-post.md) — паттерны `onError` и `onSuccess` в хуках
- [Стандарты кода](./coding-standards.md) — правила типизации ошибок и запрета на `any` в catch-блоках