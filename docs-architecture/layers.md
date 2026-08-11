---
title: Слои архитектуры
sidebar_position: 3
---

# Слои архитектуры

Этот раздел помогает определить владельца конкретного кода. В проекте используются три слоя:

```text
App ───────→ Domain ←────── Data
```

- `App` адаптирует систему к пользователю;
- `Domain` описывает правила и сценарии;
- `Data` адаптирует внешние технологии к потребностям Domain.

Слой определяется не названием файла, а его ответственностью. Класс с именем `UserService` может принадлежать любому слою — важно, почему он изменяется и от чего зависит.

## Краткая карта

| Вопрос | Владелец |
|---|---|
| Что пользователь видит и какое действие отправляет? | `App` |
| Что означает действие и допустимо ли оно? | `Domain` |
| Как получить или сохранить необходимые данные? | `Data` |
| Как конкретные реализации связываются с интерфейсами? | Composition Root в `App` |

## Слой App

`App` — presentation-слой. Он переводит пользовательские действия во входы сценариев и преобразует результаты Domain в форму, удобную для отображения.

### Содержит

- страницы, экраны и React-компоненты;
- ViewModel;
- Compound Components;
- UI State и UI Effects;
- UI Model и UI Mapper;
- состояние и валидацию формы;
- навигацию и route guards;
- presentation-интеграцию с TanStack Query;
- Composition Root и корневые providers.

### Не содержит

- бизнес-инварианты;
- HTTP-запросы и разбор ответов API;
- прямую работу с IndexedDB, localStorage или файловой системой;
- выбор между Remote и Local Data Source;
- модели таблиц и внешние DTO;
- технические правила синхронизации.

### View

View отображает состояние и сообщает о действиях пользователя:

```tsx
function TripDetailsPage({ tripId }: { tripId: string }) {
  const { state, actions } = useTripDetailsViewModel(tripId);

  if (state.status === 'loading') {
    return <TripDetailsSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <ErrorView
        message={state.message}
        onRetry={actions.retry}
      />
    );
  }

  return <TripDetailsView trip={state.trip} />;
}
```

View не должна самостоятельно собирать доменную команду из скрытого состояния, вызывать Repository или интерпретировать инфраструктурную ошибку.

### ViewModel

ViewModel:

- принимает события View;
- вызывает use case;
- управляет состояниями загрузки, успеха и ошибки;
- преобразует Domain Result в UI Model;
- возвращает небольшой набор UI Actions;
- инициирует или описывает UI Effects.

```ts
type TTripDetailsViewModel = {
  state: TTripDetailsUiState;
  actions: {
    retry(): void;
    addPlace(placeId: string): void;
  };
};
```

ViewModel не становится владельцем бизнес-правил только потому, что реализована в виде хука.

### Compound Components

Compound Components организуют внутреннюю композицию сложного View. Их контекст может содержать `UI State + Actions`, но не Repository, Data Source или HTTP-клиент.

```tsx
<TripPlanner state={state} actions={actions}>
  <TripPlanner.Header />
  <TripPlanner.Days />
  <TripPlanner.PlaceSuggestions />
</TripPlanner>
```

Подробнее: [Compound Components и MVVM](./compound-components.md).

### Валидация в App

App может проверять правила ввода и удобства интерфейса:

- обязательность поля перед включением кнопки;
- допустимые символы;
- максимальную длину ввода;
- совпадение двух визуальных полей;
- наличие локальной ошибки формы.

Domain повторно защищает бизнес-инварианты. Нельзя полагаться только на заблокированную кнопку: use case должен оставаться корректным при вызове из теста, фонового процесса или другого интерфейса.

### Типовая структура App

```text
app/
├── composition/
│   ├── createRepositories.ts
│   ├── createUseCases.ts
│   └── dependencies.ts
├── providers/
│   ├── AppProviders.tsx
│   └── QueryProvider.tsx
├── router/
│   ├── routes.tsx
│   └── guards/
├── features/
│   └── trip-planner/
│       ├── components/
│       ├── pages/
│       ├── view-model/
│       ├── ui-model/
│       └── mappers/
└── shared/
    ├── ui/
    └── hooks/
```

Это ориентир, а не обязательный шаблон. Маленькой feature не нужны пустые директории для будущего кода.

## Слой Domain

`Domain` — ядро системы. Он описывает предметную область без знания о React, сети, базе и способе отображения.

### Содержит

- Entity;
- Value Object;
- Aggregate;
- use case;
- Command и Result;
- domain-сервисы;
- контракты Repository;
- контракты внешних Provider и Gateway;
- доменные ошибки;
- чистые политики и спецификации.

### Не содержит

- React hooks и UI-компоненты;
- Axios, fetch и TanStack Query;
- API DTO;
- persistence-модели и ORM-аннотации;
- localStorage, IndexedDB и системные API;
- локализованные сообщения;
- навигацию, toast и аналитику;
- создание конкретных реализаций зависимостей.

### Entity

Entity имеет идентичность и защищает корректность своего состояния:

```ts
class Trip {
  private constructor(
    readonly id: TripId,
    readonly destination: Destination,
    readonly period: DateRange,
    readonly days: readonly TripDay[],
  ) {}

  addPlace(date: LocalDate, place: Place): Trip {
    const day = this.findDay(date);
    const updatedDay = day.addPlace(place);

    return this.replaceDay(updatedDay);
  }
}
```

Entity не обязана быть классом. Функциональная модель допустима, если инварианты невозможно случайно обойти.

### Value Object

Value Object выражает значение и валидируется при создании:

```ts
class DateRange {
  private constructor(
    readonly start: LocalDate,
    readonly end: LocalDate,
  ) {}

  static create(start: LocalDate, end: LocalDate): DateRange {
    if (end.isBefore(start)) {
      throw new InvalidDateRange();
    }

    return new DateRange(start, end);
  }
}
```

Это предотвращает распространение пар связанных примитивов и повторение одной проверки в разных сценариях.

### Use case

Use case выражает законченное намерение:

```ts
class CreateTrip {
  constructor(
    private readonly destinations: DestinationRepository,
    private readonly trips: ITripRepository,
    private readonly clock: IClock,
  ) {}

  async execute(command: CreateTripCommand): Promise<TripId> {
    const destination = await this.destinations.resolve(
      command.destinationQuery,
    );

    const trip = Trip.create({
      destination,
      period: DateRange.create(command.start, command.end),
      createdAt: this.clock.now(),
    });

    await this.trips.save(trip);

    return trip.id;
  }
}
```

Use case координирует бизнес-шаги и порты, но не знает, как Repository реализован и какой экран вызвал сценарий.

### Domain Service

Domain Service нужен для бизнес-алгоритма, который не принадлежит одной Entity:

```ts
class TripPlanGenerator {
  generate(
    trip: Trip,
    places: readonly Place[],
    weather: WeatherForecast,
  ): TripPlan {
    // Группировка мест, ограничения дней, учёт погоды.
  }
}
```

Он работает с готовыми доменными моделями, не загружает данные и не сохраняет результат. I/O координирует use case.

### Контракты внешних возможностей

Domain объявляет интерфейсы того, что ему необходимо:

```ts
interface ITripRepository {
  getById(id: TripId): Promise<Trip | null>;
  save(trip: Trip): Promise<void>;
}

interface IClock {
  now(): Instant;
}

interface ILocationProvider {
  getCurrentLocation(): Promise<Coordinates>;
}
```

Не каждый внешний порт является Repository. Repository представляет доступ к предметно значимой коллекции или данным. Часы, геолокация и генератор идентификаторов имеют собственные точные имена.

### Типовая структура Domain

```text
domain/
├── trips/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   ├── use-cases/
│   ├── services/
│   ├── commands/
│   ├── results/
│   └── errors/
├── places/
├── weather/
└── shared/
    ├── clock/
    └── errors/
```

Контракты группируются рядом с предметной областью, которая ими владеет. Общий каталог используется только для действительно общих понятий.

## Слой Data

`Data` реализует технические способы получения, хранения и синхронизации данных. Его задача — предоставить Domain ожидаемые возможности и не выпустить наружу детали инфраструктуры.

### Содержит

- реализации Repository, Provider и Gateway;
- Remote, Local и System Data Source;
- API-клиенты и SDK-адаптеры;
- внешние DTO;
- persistence-модели;
- Mapper, Serializer и Parser;
- технические Cache, Refresh и Retry Policy;
- offline-first и синхронизацию;
- преобразование инфраструктурных ошибок.

### Не содержит

- React и UI-компоненты;
- UI State и навигацию;
- пользовательские бизнес-сценарии;
- правила допустимости доменного действия;
- локализованные сообщения для пользователя;
- прямые вызовы use case.

### Data Source

Data Source инкапсулирует один конкретный источник:

```ts
interface IWeatherRemoteDataSource {
  getForecast(
    latitude: number,
    longitude: number,
    from: string,
    to: string,
  ): Promise<WeatherForecastResponseDto>;
}

interface IWeatherLocalDataSource {
  find(key: WeatherCacheKey): Promise<CachedWeatherRecord | null>;
  save(record: CachedWeatherRecord): Promise<void>;
}
```

Data Source говорит на языке технологии и её форматов. Он не обязан возвращать Domain Model.

### Repository Implementation

Реализация Repository координирует источники и возвращает модель Domain:

```ts
class DefaultWeatherRepository implements WeatherRepository {
  constructor(
    private readonly remote: IWeatherRemoteDataSource,
    private readonly local: IWeatherLocalDataSource,
    private readonly mapper: WeatherMapper,
    private readonly clock: IClock,
  ) {}

  async getForecast(
    coordinates: Coordinates,
    period: DateRange,
    policy: RefreshPolicy,
  ): Promise<WeatherForecast> {
    const cached = await this.local.find(
      WeatherCacheKey.from(coordinates, period),
    );

    if (cached && policy.canUse(cached.savedAt, this.clock.now())) {
      return this.mapper.fromPersistence(cached);
    }

    const dto = await this.remote.getForecast(
      coordinates.latitude,
      coordinates.longitude,
      period.start.toString(),
      period.end.toString(),
    );

    const record = this.mapper.remoteToPersistence(dto);
    await this.local.save(record);

    return this.mapper.fromPersistence(record);
  }
}
```

Проверка свежести кэша — техническое решение Data. Ограничение «поездку нельзя планировать более чем на 30 дней» — бизнес-правило Domain.

### Mapper

Mapper преобразует форматы на границе:

```ts
class WeatherMapper {
  fromRemote(dto: WeatherForecastResponseDto): WeatherForecast {
    // Проверка структуры внешних данных и преобразование типов.
  }

  fromPersistence(record: CachedWeatherRecord): WeatherForecast {
    // Восстановление доменной модели из формата хранения.
  }
}
```

Mapper может проверять корректность внешнего формата, но не должен принимать новое бизнес-решение.

### Ошибки Data

Низкоуровневые ошибки не покидают Data:

```text
AxiosError          → NetworkUnavailable
AbortError          → RequestTimeout
DOMException        → StorageUnavailable
JSON parsing error  → InvalidExternalData
```

Data не формирует локализованный текст. ViewModel преобразует стабильную ошибку приложения в подходящее UI-состояние или сообщение.

### Типовая структура Data

```text
data/
├── remote/
│   ├── http/
│   ├── weather/
│   │   ├── WeatherApi.ts
│   │   ├── WeatherRemoteDataSource.ts
│   │   └── dto/
│   └── places/
├── local/
│   ├── database/
│   ├── weather/
│   │   ├── WeatherLocalDataSource.ts
│   │   └── models/
│   └── migrations/
├── repositories/
│   ├── DefaultTripRepository.ts
│   └── DefaultWeatherRepository.ts
├── mappers/
├── policies/
├── serializers/
└── system/
    ├── SystemClock.ts
    └── BrowserLocationProvider.ts
```

## Composition Root

Composition Root — исключительная точка, где App знает о конкретных реализациях Data:

```ts
const weatherRepository = new DefaultWeatherRepository(
  weatherRemoteDataSource,
  weatherLocalDataSource,
  weatherMapper,
  systemClock,
);

const getTripOverview = new GetTripOverview(
  tripRepository,
  weatherRepository,
  placeRepository,
);
```

Это не нарушение Dependency Rule: зависимость остаётся во внешнем слое. Domain по-прежнему видит только собственные интерфейсы.

Composition Root не должен:

- выполнять запросы;
- преобразовывать DTO;
- содержать бизнес-условия;
- управлять UI State;
- использоваться как глобальный Service Locator.

Подробнее: [Внедрение зависимостей](./cross-cutting/di.md).

## Пограничные случаи

### Форматирование даты

- дата как бизнес-период и сравнение дат — Domain;
- преобразование строки API в дату — Data;
- локализованная подпись `10 августа` — App.

### Валидация email

- допустимые символы и подсказка формы — App;
- правило, что корпоративный адрес обязателен для операции — Domain;
- проверка схемы поля во внешнем ответе — Data.

### Авторизация

- показывать экран входа или закрытый маршрут — App;
- имеет ли субъект право выполнить бизнес-операцию — Domain;
- сохранить токен в защищённом хранилище — Data.

### Кэширование

- состояние загрузки и refetch экрана — App;
- требование сценария получить принудительно свежие данные — Domain может выразить через контракт;
- срок хранения, fallback и выбор источника — Data.

### Аналитика

- решение отправить presentation-событие после клика — App;
- технический клиент аналитики — Data или внешний adapter;
- Domain не импортирует SDK аналитики. Если бизнес-событие важно предметной области, Domain может вернуть или опубликовать доменное событие через контракт.

## Матрица размещения

| Код | Слой | Причина |
|---|---|---|
| `TripPlanner.tsx` | App | Композиция View |
| `useTripPlannerViewModel.ts` | App | UI State и запуск сценариев |
| `mapTripOverviewToUi.ts` | App | Формат результата для View |
| `CreateTrip.ts` | Domain | Законченный бизнес-сценарий |
| `DateRange.ts` | Domain | Инвариант периода |
| `TripRepository.ts` | Domain | Контракт необходимой возможности |
| `WeatherForecastResponseDto.ts` | Data | Формат внешнего API |
| `DefaultWeatherRepository.ts` | Data | Выбор источника и реализация контракта |
| `weatherMapper.ts` | Data | Преобразование внешней модели |
| `IndexedDbWeatherDataSource.ts` | Data | Конкретное локальное хранилище |

## Чек-лист определения слоя

- [ ] Код изменится из-за нового бизнес-правила? → `Domain`.
- [ ] Код изменится из-за замены API, базы, SDK или формата? → `Data`.
- [ ] Код изменится из-за нового отображения или взаимодействия? → `App`.
- [ ] Domain импортирует React или инфраструктуру? → Граница нарушена.
- [ ] Внешний DTO используется за пределами Data? → Нужен маппинг.
- [ ] UI Model используется в Domain? → Модель принадлежит не тому слою.
- [ ] Repository принимает бизнес-решение? → Логику нужно вернуть в Domain.
- [ ] Компонент вызывает Repository напрямую? → Нужна граница ViewModel/use case.
- [ ] Use case создаёт конкретную реализацию? → Создание нужно перенести в Composition Root.
- [ ] Абстракция существует только ради структуры? → Возможно, её ещё рано вводить.

## Главное правило

Если остаются сомнения, задайте вопрос:

> Какая причина изменения является главной для этого кода?

Размещайте код рядом с владельцем этой причины. Тогда замена UI, изменение бизнес-политики и смена инфраструктуры останутся независимыми видами работы.

## Дальнейшее чтение

- [Обзор архитектуры](./architecture-overview.md) — направление зависимостей и поток выполнения.
- [Compound Components и MVVM](./compound-components.md) — композиция presentation-слоя.
- [Управление состоянием](./cross-cutting/state-management.md) — владельцы разных видов состояния.
- [Обработка ошибок](./error-handling.md) — преобразование ошибок между границами.
- [Глоссарий](./glossary.md) — определения архитектурных терминов.
