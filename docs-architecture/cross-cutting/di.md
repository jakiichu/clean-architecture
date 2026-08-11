---
title: Внедрение зависимостей
sidebar_position: 3
---

# Внедрение зависимостей

Dependency Injection — передача необходимой зависимости снаружи вместо её создания или поиска внутри потребителя.

```ts
class GetTripOverview {
  constructor(
    private readonly trips: ITripRepository,
    private readonly weather: WeatherRepository,
    private readonly places: PlaceRepository,
  ) {}
}
```

Use case знает, какие возможности ему нужны, но не знает, какими классами, API и хранилищами они реализованы.

DI не является целью сам по себе. Он служит трём архитектурным задачам:

- сохраняет направление зависимостей `App → Domain ← Data`;
- делает конкретные реализации заменяемыми;
- позволяет проверять поведение с управляемыми зависимостями.

## Dependency Inversion и Dependency Injection

Эти понятия связаны, но не равны.

**Dependency Inversion Principle** определяет направление:

> Domain владеет абстракцией нужной ему внешней возможности, а Data зависит от этой абстракции и реализует её.

**Dependency Injection** определяет способ сборки:

> Конкретная реализация передаётся объекту извне.

```text
Domain:
  interface ITripRepository
  class CreateTrip(repository: ITripRepository)

Data:
  class IndexedDbTripRepository implements ITripRepository

App Composition Root:
  new CreateTrip(new IndexedDbTripRepository(...))
```

Можно использовать DI и всё равно нарушить архитектуру, если Domain-интерфейс описан терминами Axios или таблицы базы. Абстракция должна принадлежать потребителю не только физически, но и семантически.

## Composition Root

Composition Root — место, где создаётся граф конкретных объектов.

Только здесь одновременно допустимо знать:

- интерфейсы и use case Domain;
- реализации Repository и Data Source;
- runtime-конфигурацию;
- выбранный режим приложения;
- жизненные циклы зависимостей.

```ts
function createApplication(config: TAppConfig) {
  const clock = new SystemClock();
  const httpClient = new FetchHttpClient(config.apiBaseUrl);
  const database = new IndexedDbDatabase(config.databaseName);

  const tripRemote = new HttpTripDataSource(httpClient);
  const tripLocal = new IndexedDbTripDataSource(database);

  const tripRepository = new DefaultTripRepository(
    tripRemote,
    tripLocal,
    new TripMapper(),
    clock,
  );

  const createTrip = new CreateTrip(
    destinationRepository,
    tripRepository,
    clock,
  );

  const getTripOverview = new GetTripOverview(
    tripRepository,
    weatherRepository,
    placeRepository,
  );

  return {
    useCases: {
      createTrip,
      getTripOverview,
    },
  };
}
```

Composition Root создаёт и связывает объекты, но не выполняет сценарии и не содержит бизнес-условий.

### Где он находится

В React-приложении Composition Root обычно находится рядом с точкой запуска:

```text
src/app/composition/
├── createApplication.ts
├── createDataSources.ts
├── createRepositories.ts
├── createUseCases.ts
└── types.ts
```

Разбиение на несколько файлов допустимо, если они вместе образуют одну концептуальную точку сборки. Фабрики Data не должны самостоятельно читать presentation-флаги и выбирать demo/prod режим: это решение принадлежит Composition Root.

## Constructor Injection

Для классов предпочтителен constructor injection:

```ts
class AddPlaceToTripDay {
  constructor(
    private readonly trips: ITripRepository,
    private readonly routes: RouteRepository,
  ) {}

  async execute(command: AddPlaceToTripDayCommand): Promise<void> {
    // ...
  }
}
```

Преимущества:

- зависимости видны в сигнатуре;
- объект нельзя создать в частично настроенном состоянии;
- тест получает полный контроль;
- отсутствует привязка к глобальному контейнеру.

Если зависимость необязательна, сначала проверьте, действительно ли у класса одна ответственность. Большое количество optional-зависимостей часто означает смешение нескольких сценариев.

## Функциональный DI

Классы не обязательны. Зависимости можно замкнуть фабрикой:

```ts
type TCreateTripDependencies = {
  destinations: DestinationRepository;
  trips: ITripRepository;
  clock: IClock;
};

function createCreateTrip(deps: TCreateTripDependencies) {
  return async function createTrip(
    command: CreateTripCommand,
  ): Promise<TripId> {
    const destination = await deps.destinations.resolve(
      command.destinationQuery,
    );

    const trip = Trip.create({
      destination,
      period: DateRange.create(command.start, command.end),
      createdAt: deps.clock.now(),
    });

    await deps.trips.save(trip);

    return trip.id;
  };
}
```

Constructor injection и функциональная фабрика архитектурно эквивалентны. Выбор зависит от стиля проекта, а не от Clean Architecture.

## Жизненные циклы зависимостей

Не все объекты должны создаваться одинаково.

| Жизненный цикл | Примеры |
|---|---|
| **Application singleton** | HTTP client, database connection, query client |
| **Application-scoped** | Repository, системные адаптеры, большинство use case |
| **Session-scoped** | Клиент с данными текущей сессии, зашифрованный контекст пользователя |
| **Feature-scoped** | Координатор сложного workflow, временный editor session |
| **Operation-scoped** | Transaction, request context, единица работы |

Singleton означает один экземпляр в пределах конкретного application graph, а не обязательно глобальную переменную модуля.

### Почему глобальный singleton опасен

```ts
export const tripRepository = new DefaultTripRepository(...);
```

Такой объект:

- создаётся во время импорта;
- плохо изолируется между тестами;
- не учитывает смену пользователя;
- скрывает порядок инициализации;
- усложняет несколько конфигураций приложения в одном процессе.

Предпочтительнее создать экземпляр внутри `createApplication()` и явно передать потребителям.

## React и доступ к application graph

React Context можно использовать как delivery mechanism для уже собранных зависимостей:

```tsx
type TApplication = ReturnType<typeof createApplication>;

const ApplicationContext = createContext<TApplication | null>(null);

export function ApplicationProvider({
  application,
  children,
}: PropsWithChildren<{ application: TApplication }>) {
  return (
    <ApplicationContext.Provider value={application}>
      {children}
    </ApplicationContext.Provider>
  );
}
```

```ts
function useApplication(): TApplication {
  const application = useContext(ApplicationContext);

  if (application === null) {
    throw new Error('ApplicationProvider is missing');
  }

  return application;
}
```

Корень приложения создаёт graph один раз:

```tsx
const application = createApplication(readAppConfig());

root.render(
  <ApplicationProvider application={application}>
    <App />
  </ApplicationProvider>,
);
```

Этот Context принадлежит composition-механизму App. Его не следует путать с Context Compound Component:

| Application Context | Compound Component Context |
|---|---|
| Доставляет use case к ViewModel | Доставляет UI State и Actions частям View |
| Живёт на уровне приложения или feature | Живёт внутри одного UI-компонента |
| Может содержать application services | Не содержит Repository и Data Source |
| Используется адаптерами/ViewModel | Используется составными частями View |

## ViewModel как адаптер к DI

ViewModel получает use case из application graph и скрывает их от View:

```ts
function useTripDetailsViewModel(tripId: string) {
  const { getTripOverview, addPlaceToTripDay } =
    useApplication().useCases;

  // Управление запросом и построение UI State.
}
```

View получает только presentation API:

```ts
{
  state,
  actions: {
    retry,
    addPlace,
  },
}
```

Дочерним компонентам не требуется знать, какой use case стоит за `actions.addPlace`.

### Не создавать graph в каждом хуке

```ts
// Плохо: новые Repository и use case при каждом использовании хука.
function useTripDetailsViewModel(tripId: string) {
  const repository = createTripRepository();
  const useCase = new GetTripOverview(repository);
}
```

Проблема не только в производительности. Разные ViewModel могут получить разные in-memory cache, очереди и session state. Граф приложения должен иметь явный жизненный цикл.

## Конфигурация окружения

Runtime-конфигурация читается на внешней границе и передаётся фабрикам:

```ts
type TAppConfig = {
  apiBaseUrl: string;
  mode: 'production' | 'demo';
  databaseName: string;
};
```

```ts
function createTripRepository(config: TAppConfig): ITripRepository {
  if (config.mode === 'demo') {
    return new InMemoryTripRepository(demoTrips);
  }

  return new DefaultTripRepository(/* ... */);
}
```

Domain не читает `process.env`, `import.meta.env` или глобальный config. Если значение имеет бизнес-смысл, оно передаётся как явный параметр или тип Domain после валидации на внешней границе.

## Prod, Demo и Test

Разные режимы — это разные сборки одного графа:

```ts
function createApplication(config: TAppConfig): TApplication {
  const adapters =
    config.mode === 'demo'
      ? createDemoAdapters(config)
      : createProductionAdapters(config);

  return createUseCases(adapters);
}
```

Не следует размещать условие `if (IS_DEMO_MODE)` внутри каждого Repository. Централизованный выбор:

- делает используемый режим видимым;
- не смешивает production- и demo-поведение;
- упрощает удаление режима;
- предотвращает случайное сочетание несовместимых адаптеров.

## Внедрение системных возможностей

Время, идентификаторы и случайность также являются зависимостями, если влияют на проверяемое поведение:

```ts
interface IClock {
  now(): Instant;
}

interface IIdGenerator {
  nextTripId(): TripId;
}
```

Production-реализации находятся на внешней стороне:

```ts
class SystemClock implements IClock {
  now(): Instant {
    return Instant.fromDate(new Date());
  }
}
```

Тестовые реализации управляемы:

```ts
class FixedClock implements IClock {
  constructor(private readonly value: Instant) {}

  now(): Instant {
    return this.value;
  }
}
```

Не нужно абстрагировать каждую чистую функцию. Порт оправдан, когда код обращается к изменяемому внешнему миру или нужна управляемая недетерминированность.

## Нативные и браузерные адаптеры

Domain описывает необходимую возможность:

```ts
interface ILocationProvider {
  getCurrentLocation(): Promise<Coordinates>;
}
```

Data реализует её через платформу:

```ts
class BrowserLocationProvider implements ILocationProvider {
  async getCurrentLocation(): Promise<Coordinates> {
    const position = await getBrowserPosition();

    return Coordinates.create(
      position.coords.latitude,
      position.coords.longitude,
    );
  }
}
```

Разрешения, отмена и технические ошибки преобразуются адаптером в стабильный контракт. UI-текст и решение открыть экран настроек остаются в App.

## Транзакции и Unit of Work

Если use case должен атомарно изменить несколько записей, транзакционная возможность выражается контрактом:

```ts
interface IUnitOfWork {
  run<T>(operation: () => Promise<T>): Promise<T>;
}
```

Конкретный механизм транзакции реализует Data. Не следует передавать в Domain объект транзакции конкретной ORM.

Для простых приложений отдельный Unit of Work может быть избыточен. Его вводят при реальной необходимости общей атомарности.

## Очистка ресурсов

Зависимости с ресурсами должны иметь явное завершение:

```ts
type TApplication = {
  useCases: UseCases;
  dispose(): Promise<void>;
};
```

Закрытия могут требовать:

- WebSocket;
- worker;
- database connection;
- подписка на системные события;
- interval или background sync coordinator.

В development React Strict Mode нельзя полагаться на случайное создание ресурса во время рендера. Создание и освобождение должны соответствовать выбранному жизненному циклу.

## Service Locator

Service Locator позволяет запросить зависимость из глобального реестра:

```ts
const repository = container.resolve<ITripRepository>('TripRepository');
```

Если такой вызов расположен внутри Domain или произвольного компонента, зависимости становятся скрытыми. По сигнатуре уже невозможно понять, что требуется коду.

DI-container допустим внутри Composition Root как инструмент сборки. За его пределами предпочтительнее передавать готовые зависимости явно.

## Когда нужен DI-container

Ручные фабрики подходят большинству клиентских приложений. Контейнер может быть полезен, если:

- граф содержит много однотипных регистраций;
- нужны scoped lifetimes;
- есть плагины или динамические модули;
- ручная сборка стала главным источником ошибок;
- команда понимает стоимость декораторов и runtime metadata.

Контейнер не исправляет плохие границы. Если класс имеет пятнадцать зависимостей, автоматическая регистрация скрывает проблему, но не решает её.

## Тестирование с DI

Use case тестируется с небольшой подменной реализацией:

```ts
const trips = new InMemoryTripRepository();
const clock = new FixedClock(Instant.parse('2026-08-06T10:00:00Z'));

const createTrip = new CreateTrip(
  destinations,
  trips,
  clock,
);
```

Предпочтительнее подмена, сохраняющая поведение контракта, а не универсальный mock с большим количеством ожиданий. In-memory Repository можно повторно использовать в тестах разных use case.

Для интеграционного теста собирается отдельный application graph:

```ts
const application = createTestApplication({
  clock,
  database: testDatabase,
  server: mockServer,
});
```

Так тест проверяет ту же сборку слоёв, не изменяя production-код.

## Антипаттерны

### Создание зависимости внутри use case

```ts
class CreateTrip {
  private readonly repository = new DefaultTripRepository();
}
```

Domain начинает зависеть от Data, а тест не контролирует I/O.

### Конкретный класс в сигнатуре Domain

```ts
constructor(private readonly repository: IndexedDbTripRepository) {}
```

Use case знает технологию. Ему нужен контракт `TripRepository`.

### Фабрика Data читает App config

```ts
const repository = IS_DEMO_MODE
  ? new MockRepository()
  : new HttpRepository();
```

Если выбор размазан по Data, Composition Root исчезает. Конфигурация должна приниматься снаружи.

### React Context со всем подряд

Один контекст с Repository, UI State, роутером, темой и формой смешивает application graph с presentation-state. Разделяйте Context по роли.

### Передача контейнера вместо зависимости

```ts
new CreateTrip(container)
```

Use case может получить произвольный сервис, а реальные зависимости скрыты. Передавайте необходимые порты явно.

### Абстракция без границы

Обёртка вокруг детерминированной функции только ради возможности mock не всегда полезна. DI применяется к зависимости, а не к каждой строке кода.

## Чек-лист

- [ ] Domain владеет интерфейсами необходимых внешних возможностей.
- [ ] Use case получает зависимости через конструктор или фабрику.
- [ ] Конкретные реализации создаются в Composition Root.
- [ ] Выбор prod/demo/test централизован.
- [ ] Runtime config не читается внутри Domain.
- [ ] Жизненный цикл каждого stateful-объекта определён.
- [ ] Application graph не пересоздаётся при каждом React render.
- [ ] Compound Component Context не используется для DI.
- [ ] DI-container не просачивается за пределы точки сборки.
- [ ] Ресурсы имеют явное освобождение.
- [ ] Тест может собрать graph с управляемыми адаптерами.
- [ ] Новая абстракция защищает реальную внешнюю границу.

## Дальнейшее чтение

- [Обзор архитектуры](../architecture-overview.md) — направление выполнения и импортов.
- [Слои архитектуры](../layers.md) — владельцы контрактов и реализаций.
- [Compound Components и MVVM](../compound-components.md) — отличие UI Context от application graph.
- [Управление состоянием](./state-management.md) — жизненные циклы stateful-зависимостей.
- [Тестирование](../testing.md) — сборка тестового graph.
