---
title: Обработка ошибок и восстановление
sidebar_position: 8
---

# Обработка ошибок и восстановление

Ошибка — часть контракта сценария, а не только исключительная ветка исполнения. Архитектура должна отвечать на четыре вопроса:

1. где возникла проблема;
2. кто понимает её смысл;
3. можно ли восстановиться;
4. что должен увидеть пользователь.

Каждый слой преобразует только те ошибки, контекст которых он понимает:

```text
Library error
    ↓ Data переводит техническую деталь
Stable application error
    ↓ Domain добавляет смысл сценария при необходимости
Use Case failure
    ↓ App переводит в presentation
UI State / UI Effect
```

Сырая ошибка библиотеки не должна проходить через всю систему, но и Data не должен придумывать бизнес-смысл или пользовательское сообщение.

## Категории ошибок

### Infrastructure Error

Возникает при взаимодействии с внешним миром:

- сеть недоступна;
- запрос завершился по таймауту;
- сервер вернул непредусмотренный ответ;
- запись в базу не удалась;
- файл повреждён;
- разрешение ОС отклонено;
- внешний DTO не соответствует ожидаемой схеме.

Data перехватывает конкретную ошибку технологии и преобразует её в стабильный тип приложения:

```text
AxiosError / TypeError → NetworkUnavailable
AbortError             → RequestTimeout
HTTP 429               → RateLimited
DOMException           → StorageUnavailable
Schema parse error     → InvalidExternalData
```

### Domain Error

Возникает при нарушении бизнес-правила:

- дата окончания раньше даты начала;
- поездка не содержит указанного дня;
- место уже добавлено;
- дневной план превышает допустимую продолжительность;
- переход между статусами запрещён.

Domain Error формулируется на языке предметной области и не содержит HTTP status, имя таблицы или локализованный UI-текст.

### Application/Use Case Error

Некоторые ошибки относятся к конкретному сценарию, но не являются инвариантом одной Entity:

- требуемая поездка не найдена;
- данные для построения обзора недоступны;
- операция конфликтует с более свежей версией;
- сценарий не может завершиться без обязательного внешнего результата.

Такие ошибки обычно объявляются рядом с use case или в общем Domain-модуле ошибок, если их смысл разделяют несколько сценариев.

### Presentation Error

Относится только к взаимодействию и отображению:

- обязательное поле формы не заполнено;
- невозможно восстановить фокус;
- маршрут содержит некорректный параметр;
- компонент не может отобразить поддерживаемый вариант данных;
- rendering error перехвачен Error Boundary.

Presentation Error не должна возвращаться из Repository.

### Programmer Error

Это нарушение внутреннего контракта программы:

- обязательный Provider отсутствует;
- exhaustive switch получил невозможный вариант;
- функция вызвана с состоянием, которое типы должны были запретить;
- нарушена внутренняя структура Compound Component.

Такую ошибку обычно не следует преобразовывать в «не удалось загрузить данные» и продолжать работу. Её нужно обнаружить, залогировать и исправить. В production Error Boundary может показать безопасный fallback.

## Ошибка или ожидаемый результат

Не каждое отрицательное состояние является исключением.

```text
Поиск не дал результатов     → обычный Result
Поездка отсутствует          → Result или NotFoundError, зависит от сценария
Пользователь отменил dialog  → обычный Result
Неверный PIN                 → ожидаемый Failure
База повреждена              → Infrastructure Error
Нарушен невозможный invariant → Programmer/Domain Error
```

Главный критерий:

> Должен ли вызывающий код регулярно принимать решение на основе этого исхода?

Если да, исход полезно выразить в типе результата. Если это неожиданный сбой выполнения, исключение может быть уместнее.

## Два допустимых стиля Domain API

Проект может использовать исключения, `Result` или их осознанную комбинацию. Внутри одной категории сценариев стиль должен быть последовательным.

### Исключения

```ts
class TripNotFound extends Error {
  readonly code = 'trip_not_found';

  constructor(readonly tripId: TripId) {
    super('Trip was not found');
  }
}
```

```ts
async execute(command: AddPlaceCommand): Promise<void> {
  const trip = await this.trips.getById(command.tripId);

  if (trip === null) {
    throw new TripNotFound(command.tripId);
  }
}
```

Подходит, когда failure прерывает сценарий и вызывающей стороне не нужно комбинировать много вариантов.

### Result type

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

```ts
type TAddPlaceFailure =
  | { type: 'trip-not-found'; tripId: TripId }
  | { type: 'day-not-found'; date: LocalDate }
  | { type: 'place-already-added'; placeId: PlaceId };
```

```ts
execute(
  command: AddPlaceCommand,
): Promise<Result<void, TAddPlaceFailure>>;
```

Подходит, когда варианты отказа ожидаемы, должны exhaustively обрабатываться и являются частью публичного сценария.

### Не смешивать результат и скрытые исключения

```ts
Promise<Result<Trip, TripNotFound>>
```

не обещает полной типобезопасности, если реализация всё равно неожиданно выбрасывает `NetworkUnavailable`. Нужно явно определить политику:

- Result описывает только ожидаемые business failures, а infrastructure failures выбрасываются;
- либо Result содержит объединение всех известных failures;
- неизвестные programmer errors всё равно могут быть выброшены.

Эта договорённость фиксируется для проекта, а не угадывается в каждом use case.

## Типы ошибок без лишней связанности

Необязательно создавать один универсальный `AppError` с полями для всех слоёв. Поля вроде `layer`, `userMessage`, `statusCode` и `originalError` имеют разных владельцев.

Предпочтительнее небольшие типы:

```ts
abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly retry: TRetryDisposition;
}

type TRetryDisposition =
  | { type: 'never' }
  | { type: 'immediate' }
  | { type: 'after'; delayMs: number };
```

```ts
class NetworkUnavailable extends ApplicationError {
  readonly code = 'network_unavailable';
  readonly retry = { type: 'after', delayMs: 1_000 } as const;
}
```

```ts
class InvalidDateRange extends Error {
  readonly code = 'invalid_date_range';

  constructor(
    readonly start: LocalDate,
    readonly end: LocalDate,
  ) {
    super('End date must not be before start date');
  }
}
```

`userMessage` не хранится в Domain Error: локализация и формулировка принадлежат App.

## Ошибки на границе Data

Data должен сохранить полезную причину для диагностики, не раскрывая её наружу как часть стабильного контракта:

```ts
class HttpWeatherDataSource implements IWeatherRemoteDataSource {
  async getForecast(request: WeatherRequestDto) {
    try {
      const response = await this.client.get('/forecast', request);
      return weatherResponseSchema.parse(response.data);
    } catch (error: unknown) {
      throw mapWeatherTransportError(error);
    }
  }
}
```

```ts
function mapWeatherTransportError(error: unknown): ApplicationError {
  if (isAbortError(error)) {
    return new RequestTimeout({ cause: error });
  }

  if (isRateLimitResponse(error)) {
    return new RateLimited(readRetryAfter(error), { cause: error });
  }

  if (isSchemaError(error)) {
    return new InvalidExternalData({ cause: error });
  }

  return new ExternalServiceUnavailable({ cause: error });
}
```

В TypeScript значение в `catch` считается `unknown`. Маппер сначала распознаёт ошибку, а не обращается к произвольным полям через `any`.

### Где выполнять преобразование

- HTTP/Data Source преобразует ошибки транспорта и протокола;
- Local Data Source преобразует ошибки базы и файлов;
- Repository добавляет контекст выбора источника и fallback;
- use case при необходимости преобразует технический отказ в ошибку конкретного сценария;
- ViewModel формирует UI State и локализованный текст.

Не нужно повторно заворачивать ошибку на каждом уровне, если новый уровень не добавляет смысла.

## HTTP status не равен бизнес-ошибке

Один статус может иметь разный смысл в разных endpoint:

```text
404 /trips/:id          → TripNotFound
404 /weather/forecast   → ForecastUnavailable или пустой период
409 /trips/:id          → VersionConflict
401                     → credential rejected или session expired
```

HTTP adapter знает протокол, Repository — назначение запроса, use case — смысл сценария. Преобразование выполняется на первом уровне, где смысл становится однозначным.

Нельзя глобально считать каждый `401` командой немедленно очистить сессию: ошибка может относиться к стороннему API, а refresh token может восстановить запрос. Session coordinator должен принимать решение по стабильному auth-событию, а не по любому статусу транспорта.

## Поток ошибки через слои

Пример недоступного прогноза:

```text
fetch throws TypeError
        ↓
Remote Data Source → NetworkUnavailable
        ↓
WeatherRepository проверяет локальный cache
        ↓
cache найден → возвращает stale WeatherForecast + metadata
        ↓
Use Case собирает TripOverview
        ↓
ViewModel показывает данные и offline indicator
```

Если fallback отсутствует:

```text
NetworkUnavailable
        ↓
Use Case → TripOverviewUnavailable
        ↓
ViewModel → { status: 'error', canRetry: true }
        ↓
View → ErrorView
```

Graceful degradation не является поглощением ошибки. Repository возвращает явно описанный результат с метаданными или стабильный failure, а UI понимает, что данные устарели.

## UI State ошибок

Состояние экрана лучше выражать взаимоисключающими вариантами:

```ts
type TTripOverviewUiState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'success';
      data: TripOverviewUiModel;
      freshness: 'fresh' | 'stale';
    }
  | {
      status: 'error';
      message: string;
      canRetry: boolean;
    };
```

ViewModel переводит стабильную ошибку в presentation:

```ts
function mapErrorToTripOverviewState(
  error: unknown,
): TTripOverviewUiState {
  if (error instanceof TripNotFound) {
    return { status: 'empty' };
  }

  if (error instanceof NetworkUnavailable) {
    return {
      status: 'error',
      message: translate('errors.networkUnavailable'),
      canRetry: true,
    };
  }

  reportUnexpectedError(error);

  return {
    status: 'error',
    message: translate('errors.unexpected'),
    canRetry: true,
  };
}
```

Неизвестный failure логируется и получает безопасный fallback. Пользователю не показывается `error.message` от библиотеки.

## Loading, empty, stale и error — разные состояния

Отсутствие свежего ответа не всегда означает ошибку экрана:

| Состояние | Поведение |
|---|---|
| Initial loading | Skeleton или основной loader |
| Background refresh | Старые данные остаются, показывается небольшой progress |
| Empty | Специализированный empty state с допустимым действием |
| Stale/offline | Данные показываются с индикатором актуальности |
| Recoverable error | Retry рядом с контекстом ошибки |
| Fatal screen error | Полноэкранный fallback |
| Mutation pending | Блокируется только конфликтующее действие |

Глобальная блокировка всего экрана во время любой mutation обычно ухудшает UX и маскирует независимые операции.

## Retry

Retry допустим только если повтор безопасен и имеет шанс изменить результат.

Нужно учитывать:

- временный ли сбой;
- идемпотентна ли операция;
- был ли запрос принят сервером;
- существует ли idempotency key;
- не исчерпан ли лимит;
- не попросил ли сервер подождать через `Retry-After`;
- не отменил ли операцию пользователь.

### Где находится retry

| Retry | Владелец |
|---|---|
| Повтор отдельного HTTP-вызова | Data policy |
| Reconnect WebSocket | Data adapter |
| Повтор синхронизации очереди | Data sync subsystem |
| Кнопка «Повторить» на экране | App |
| Повтор всего бизнес-сценария | Явное решение App/use case contract |

TanStack Query может повторять query function, но нужно помнить: она запускает use case целиком. Для читающего идемпотентного сценария это обычно безопасно. Автоматический повтор команды может создать дубликаты.

### Idempotency

Команда может повторяться безопасно, если:

- использует стабильный idempotency key;
- Repository или сервер гарантирует дедупликацию;
- повторный результат эквивалентен первому;
- side effects также дедуплицируются.

HTTP-метод сам по себе не является достаточной гарантией поведения конкретной системы.

## Отмена и устаревший результат

Отмена пользователем или размонтирование экрана не всегда являются ошибкой:

```ts
type LoadOutcome<T> =
  | { type: 'completed'; value: T }
  | { type: 'cancelled' };
```

AbortSignal следует передавать только через контракт, которому действительно нужна отмена. Domain не должен импортировать детали конкретного клиента, но может принимать нейтральный cancellation token, если отмена является частью сценария.

ViewModel также должна защищаться от гонки: более старый запрос не должен перезаписать результат нового выбора. Query client, request id или явная state machine могут обеспечить это на уровне App.

## Error Boundary

React Error Boundary перехватывает ошибки рендера и lifecycle дочернего дерева. Он не заменяет обработку отказов use case.

```tsx
<RouteErrorBoundary fallback={<UnexpectedScreen />}>
  <TripPlannerPage />
</RouteErrorBoundary>
```

Error Boundary нужен для:

- programmer errors в View;
- неожиданного исключения рендера;
- локализации падения одной feature;
- безопасного восстановления UI.

Обычный `NetworkUnavailable` должен стать UI State, а не падением в Error Boundary.

Границы полезно располагать на уровне маршрута или автономного виджета. Один глобальный boundary предотвращает белый экран, но даёт слишком грубое восстановление.

## Наблюдаемость и логирование

Лог должен отвечать диагностике, не становясь частью пользовательского контракта.

Полезные данные:

- стабильный error code;
- operation/use case name;
- correlation/request id;
- источник (`remote`, `local`, `sync`);
- retry attempt;
- безопасные временные метки;
- версия приложения.

Не логируются:

- access и refresh token;
- PIN и пароль;
- платёжные реквизиты;
- полные персональные payload;
- содержимое защищённого хранилища;
- секреты URL и заголовков.

`cause` может сохраняться для технической диагностики, но перед отправкой во внешний сервис проходит redaction.

Domain не импортирует SDK мониторинга. Логирование выполняется внешним декоратором, adapter или App boundary.

## Ошибки фоновых процессов

У background sync нет активного экрана, поэтому toast не является подходящей реакцией.

Data сохраняет состояние операции:

```ts
type TSyncStatus =
  | { type: 'pending' }
  | { type: 'in-progress'; attempt: number }
  | { type: 'failed'; reason: SyncFailure; nextRetryAt?: Instant }
  | { type: 'synced'; syncedAt: Instant };
```

App наблюдает агрегированный статус и решает, показать ли badge, баннер или экран конфликтов. Не каждую временную ошибку следует немедленно показывать пользователю.

## Ошибки конфигурируемого поведения

Когда пользователь может переназначать действия, отключать их или сохранять настройки локально, ошибки нужно разделять по смыслу. Иначе конфликт клавиш, повреждённая запись в хранилище и ошибка программиста превращаются в один неинформативный `Error`.

| Ситуация | Владелец | Реакция App |
|---|---|---|
| неизвестный `ActionId` | programmer error или несовместимая версия данных | не применять запись, отправить диагностику |
| действие запрещено переназначать | Domain | показать объяснение рядом с настройкой |
| сочетание некорректно после canonicalization | Domain | оставить редактор открытым и подсветить ввод |
| сочетание конфликтует с другим действием | Domain | показать оба действия и предложить выбрать другое сочетание |
| сохранённая запись не проходит runtime validation | Data | пропустить только повреждённую запись, использовать default и залогировать причину |
| хранилище временно недоступно | Data/Application | продолжить с defaults, явно сообщить, что изменения не сохранятся |
| запись override не сохранилась | Data/Application | не подтверждать изменение либо откатить optimistic update |

Domain возвращает стабильный код и безопасный контекст, например `actionId` и `conflictingActionId`. Локализованный текст, название клавиши для текущей ОС и способ показа ошибки принадлежат App/Presentation.

Конфликт конфигурации не является временной инфраструктурной ошибкой, поэтому автоматический retry ему не помогает. Ошибку записи, напротив, можно повторить, если операция идемпотентна и UI не создаёт ложного впечатления, что настройка уже сохранена.

### Согласованность памяти и хранилища

Базовый безопасный порядок для изменения настройки:

1. проверить команду и конфликт в Domain;
2. сохранить override через порт;
3. только после успеха опубликовать новое effective-состояние.

Optimistic update допустим, но тогда App обязан хранить предыдущее значение и выполнить rollback при отказе записи. Нельзя молча оставить новое сочетание активным только в памяти: после перезапуска пользователь получит другое поведение.

При частично повреждённом документе Data восстанавливает данные максимально узко: отбрасывает некорректный override, а не очищает весь каталог настроек. Полная очистка допустима лишь после подтверждённой несовместимости контейнера и при наличии определённой политики миграции.

## Безопасное восстановление

Стратегия зависит от класса failure:

- временная сеть → retry/backoff или cached fallback;
- повреждённый cache → удалить конкретную запись и загрузить заново;
- schema mismatch → остановить использование ответа и отправить диагностику;
- conflict → запросить свежую версию или показать разрешение конфликта;
- session expired → выполнить централизованный refresh/logout flow;
- permission denied → объяснить функцию и предложить открыть настройки;
- programmer error → Error Boundary и отчёт разработчикам.

Нельзя автоматически очищать всю базу при любой ошибке чтения. Деструктивное восстановление требует точного подтверждения повреждения и максимально узкой области удаления.

## Антипаттерны

### `catch` и возврат пустого значения

```ts
try {
  return await repository.getTrips();
} catch {
  return [];
}
```

Пустой список становится неотличим от корректного результата. Fallback допустим только как явно смоделированная политика.

### Универсальный `AppError` со всем

`statusCode`, `userMessage`, `layer`, `violationRule` и `originalError` в каждом типе создают связанность слоёв и ложную универсальность.

### Локализованный текст в Domain

Domain возвращает стабильный code и контекст, App выбирает формулировку и язык.

### Автоматический retry любой mutation

Если сервер выполнил операцию, но ответ потерялся, повтор может создать дубликат.

### Показ `error.message`

Текст технической ошибки может быть непонятным, нестабильным и содержать лишние детали.

### Любой `401` вызывает logout

Глобальная реакция игнорирует endpoint, refresh flow и сторонние сервисы.

### Error Boundary для сетевого отказа

Ожидаемый failure должен быть частью UI State, а не аварией дерева React.

## Чек-лист

- [ ] Ошибка преобразуется на первом уровне, который понимает её смысл.
- [ ] Data не выпускает наружу ошибки конкретной библиотеки.
- [ ] Domain Error не содержит UI-текст и HTTP-детали.
- [ ] Ожидаемые отрицательные исходы выражены явно.
- [ ] Для сценария выбран последовательный стиль `throw`/`Result`.
- [ ] ViewModel exhaustive-обрабатывает известные failures.
- [ ] Неизвестные ошибки получают безопасный fallback и диагностику.
- [ ] Loading, empty, stale и error не смешаны.
- [ ] Retry учитывает идемпотентность.
- [ ] Background failures не превращаются автоматически в toast.
- [ ] Error Boundary используется для ошибок View, а не обычного I/O.
- [ ] Логи проходят redaction и не содержат секретов.
- [ ] Деструктивное восстановление ограничено точной областью.
- [ ] Конфликты конфигурации отличаются от ошибок чтения и записи.
- [ ] Неуспешное сохранение не оставляет ложное effective-состояние только в памяти.
- [ ] Повреждённый override изолируется, а остальные настройки продолжают работать.

## Дальнейшее чтение

- [Слои архитектуры](./layers.md) — владельцы ошибок и преобразований.
- [Управление состоянием](./cross-cutting/state-management.md) — UI State, stale data и background sync.
- [Внедрение зависимостей](./cross-cutting/di.md) — подключение логирования и технических политик.
- [Оффлайн-режим](./examples/offline-mode.md) — fallback и синхронизация.
- [Тестирование](./testing.md) — проверка error paths каждого слоя.
- [Менеджер горячих клавиш](./examples/hotkey-manager.md) — ошибки переназначения, конфликтов и persistent overrides.
