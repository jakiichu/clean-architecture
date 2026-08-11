---
title: Стратегия тестирования
sidebar_position: 9
---

# Стратегия тестирования

Тесты должны подтверждать поведение на архитектурных границах, а не повторять внутреннюю реализацию. Clean Architecture помогает выбрать подходящий уровень проверки:

- Domain проверяется без React и реального I/O;
- Data проверяется на соответствие контрактам и работу с технологиями;
- App проверяется через наблюдаемое поведение ViewModel и View;
- несколько критичных сценариев проходят через всю систему.

Хорошая стратегия не максимизирует количество unit-тестов. Она минимизирует вероятность, что важное поведение останется непроверенным или тесты начнут мешать безопасному рефакторингу.

## Уровни тестирования

```text
                 E2E
          критичные пути пользователя

          Integration / Component
       границы модулей и реальный UI

       Unit / Contract / Property
  Domain, мапперы, политики, реализации портов
```

Процентное правило вроде «80% тестов должны быть unit» не является архитектурной целью. Пропорция зависит от риска:

- сложный алгоритм планирования требует много Domain-тестов;
- интеграция с нестабильным API требует contract/integration-тестов;
- сложный accessible widget требует component-тестов;
- критичный платёжный поток требует E2E независимо от unit-покрытия.

## Что именно является объектом теста

| Объект | Основной вопрос |
|---|---|
| Value Object | Невалидное значение невозможно создать? |
| Entity/Aggregate | Инварианты сохраняются после перехода? |
| Domain Service | Алгоритм выдаёт корректный результат? |
| Use Case | Сценарий правильно координирует зависимости? |
| Repository contract | Любая реализация соблюдает одинаковое поведение? |
| Data Source | Корректно ли используется конкретная технология? |
| Mapper | Внешний формат безопасно преобразуется? |
| Repository implementation | Правильно ли выбираются источники и fallback? |
| ViewModel | Результаты сценария превращаются в UI State/Effects? |
| Compound Component | Композиция доступна и вызывает UI Actions? |
| Page/Feature | Части App работают совместно? |
| E2E | Пользователь действительно завершает критичный путь? |

## Терминология тестовых замен

Слово «mock» часто используется для любых подмен, но различия полезны:

| Замена | Назначение |
|---|---|
| **Stub** | Возвращает заранее подготовленный ответ |
| **Spy** | Запоминает вызовы для проверки взаимодействия |
| **Fake** | Рабочая упрощённая реализация, например in-memory Repository |
| **Mock** | Проверяет заранее заданный протокол взаимодействия |

Для Domain обычно удобнее Fake и небольшие Stub. Они меньше связывают тест с последовательностью внутренних вызовов.

## Тестирование Value Object

Value Object проверяется через публичное создание и поведение:

```ts
describe('DateRange', () => {
  it('создаёт период, если конец не раньше начала', () => {
    const range = DateRange.create(
      LocalDate.parse('2026-08-10'),
      LocalDate.parse('2026-08-14'),
    );

    expect(range.durationInDays()).toBe(5);
  });

  it('запрещает период с концом раньше начала', () => {
    expect(() =>
      DateRange.create(
        LocalDate.parse('2026-08-14'),
        LocalDate.parse('2026-08-10'),
      ),
    ).toThrow(InvalidDateRange);
  });
});
```

Не нужно проверять private-поля или конкретный порядок внутренних функций. Тест защищает правило: любой созданный `DateRange` корректен.

## Тестирование Entity и Aggregate

Aggregate проверяется как последовательность допустимых переходов:

```ts
describe('Trip.addPlace', () => {
  it('добавляет место в существующий день поездки', () => {
    const trip = tripBuilder()
      .withPeriod('2026-08-10', '2026-08-14')
      .build();

    const updated = trip.addPlace(
      LocalDate.parse('2026-08-11'),
      placeBuilder().withId('museum').build(),
    );

    expect(updated.day(LocalDate.parse('2026-08-11')).places)
      .toHaveLength(1);
  });

  it('запрещает дату вне периода поездки', () => {
    const trip = tripBuilder()
      .withPeriod('2026-08-10', '2026-08-14')
      .build();

    expect(() =>
      trip.addPlace(
        LocalDate.parse('2026-08-20'),
        placeBuilder().build(),
      ),
    ).toThrow(TripDayOutsidePeriod);
  });
});
```

Builder создаёт валидную модель с полезными defaults. Он не должен позволять случайно обходить production-фабрики и конструировать невозможное состояние.

## Тестирование Domain Service

Чистый алгоритм проверяется табличными примерами и свойствами:

```ts
describe.each([
  ['rain', 'museum'],
  ['clear', 'park'],
])(
  'TripPlanGenerator for %s weather',
  (condition, expectedCategory) => {
    it(`предпочитает ${expectedCategory}`, () => {
      const plan = generator.generate(
        trip,
        availablePlaces,
        forecastWith(condition),
      );

      expect(plan.firstActivity.category).toBe(expectedCategory);
    });
  },
);
```

Для алгоритмов с большим пространством входов полезны property-based tests. Пример свойства: генератор никогда не помещает одно место в два дня и никогда не создаёт активность вне периода поездки.

## Тестирование Use Case

Use case получает управляемые зависимости через DI:

```ts
class InMemoryTripRepository implements TripRepository {
  private readonly trips = new Map<string, Trip>();

  async getById(id: TripId): Promise<Trip | null> {
    return this.trips.get(id.value) ?? null;
  }

  async save(trip: Trip): Promise<void> {
    this.trips.set(trip.id.value, trip);
  }
}
```

```ts
describe('CreateTrip', () => {
  it('разрешает направление и сохраняет новую поездку', async () => {
    const trips = new InMemoryTripRepository();
    const destinations = new StubDestinationRepository(berlin);
    const clock = new FixedClock(
      Instant.parse('2026-08-06T10:00:00Z'),
    );

    const createTrip = new CreateTrip(
      destinations,
      trips,
      clock,
    );

    const id = await createTrip.execute({
      destinationQuery: 'Berlin',
      start: LocalDate.parse('2026-08-10'),
      end: LocalDate.parse('2026-08-14'),
    });

    const saved = await trips.getById(id);

    expect(saved?.destination).toEqual(berlin);
    expect(saved?.createdAt).toEqual(clock.now());
  });
});
```

Проверяется результат сценария и наблюдаемое состояние Repository. Spy нужен, если сам факт или параметры внешнего вызова являются частью поведения:

```ts
expect(routeRepository.buildRoute).toHaveBeenCalledWith(
  expectedPoints,
  TransportMode.Walking,
);
```

Не следует проверять каждый внутренний вызов только ради покрытия. Такой тест ломается после безопасного рефакторинга без изменения поведения.

### Ошибки и отрицательные ветки

Для use case проверяются:

- нарушение входного бизнес-правила;
- отсутствие обязательной Entity;
- отказ зависимости;
- частично доступные данные, если предусмотрен fallback;
- отсутствие сохранения при неуспешной проверке;
- идемпотентный повтор, если он обещан контрактом.

Если сценарий возвращает `Result`, проверяется конкретный вариант union. Если выбрасывает стабильную ошибку — конкретный класс/code, а не текст сообщения.

## Contract Tests для Repository

Несколько реализаций одного Repository должны вести себя одинаково в рамках доменного контракта.

```ts
type TTripRepositoryFactory = {
  name: string;
  create(): Promise<TripRepositoryTestContext>;
};

function tripRepositoryContract(factory: TTripRepositoryFactory) {
  describe(`${factory.name} implements TripRepository`, () => {
    it('возвращает сохранённую поездку', async () => {
      const context = await factory.create();
      const trip = tripBuilder().build();

      await context.repository.save(trip);

      expect(await context.repository.getById(trip.id))
        .toEqual(trip);

      await context.dispose();
    });

    it('возвращает null для неизвестного id', async () => {
      const context = await factory.create();

      expect(await context.repository.getById(TripId.create('missing')))
        .toBeNull();

      await context.dispose();
    });
  });
}
```

Один suite запускается для:

- `InMemoryTripRepository`;
- `IndexedDbTripRepository`;
- другой production-реализации.

Contract test не проверяет внутреннюю схему IndexedDB. Он подтверждает обещание интерфейса Domain.

## Тестирование Mapper

Mapper проверяется на реальных формах внешних данных:

```ts
describe('WeatherMapper.fromRemote', () => {
  it('преобразует температуру и дату в Domain Model', () => {
    const dto = weatherResponseFixture({
      date: '2026-08-10',
      temperature_celsius: 21.5,
    });

    const forecast = mapper.fromRemote(dto);

    expect(forecast.date).toEqual(
      LocalDate.parse('2026-08-10'),
    );
    expect(forecast.temperature.celsius).toBe(21.5);
  });

  it('отклоняет ответ без обязательной даты', () => {
    const dto: unknown = { temperature_celsius: 21.5 };

    expect(() => mapper.fromUnknownRemote(dto))
      .toThrow(InvalidExternalData);
  });
});
```

Внешняя fixture должна повторять API-формат, а ожидаемый результат — Domain Model. Это защищает границу от случайного протекания DTO.

Стоит проверить:

- обязательные и отсутствующие поля;
- `null` и неожиданные типы;
- даты, timezone и единицы измерения;
- неизвестные enum-значения;
- совместимость со старой версией ответа, если она поддерживается.

## Тестирование Data Source

Data Source проверяется вместе с ближайшей реальной технологической границей.

### Remote Data Source

Предпочтительно перехватывать HTTP на сетевой границе, а не мокировать внутренние методы клиента:

```ts
server.use(
  http.get('/forecast', () =>
    HttpResponse.json(weatherResponseFixture()),
  ),
);

const dto = await dataSource.getForecast(request);

expect(dto.days).toHaveLength(5);
```

Такой тест проверяет URL, метод, параметры, заголовки и parsing ответа. Если библиотека HTTP заменится, тест поведения может остаться тем же.

Отдельно проверяются timeout, malformed response, rate limit и отмена.

### Local Data Source

Для IndexedDB/SQLite полезнее временная настоящая база или официальный in-memory режим, чем hand-written mock всей библиотеки:

```ts
const database = await createTestDatabase();
const dataSource = new IndexedDbTripDataSource(database);

await dataSource.save(tripRecordFixture());

expect(await dataSource.findById('trip-1'))
  .toEqual(tripRecordFixture());
```

Проверяются:

- round trip записи и чтения;
- уникальные ограничения;
- транзакционный rollback;
- миграции;
- corrupted/unsupported data;
- удаление и очистка конкретной области.

## Тестирование Repository Implementation

Repository координирует Data Source, поэтому тесты сосредоточены на политиках:

```ts
describe('DefaultWeatherRepository', () => {
  it('возвращает свежий локальный прогноз без сети', async () => {
    const local = new InMemoryWeatherDataSource([
      freshWeatherRecord(),
    ]);
    const remote = new SpyWeatherRemoteDataSource();

    const repository = createRepository({ local, remote, clock });

    const result = await repository.getForecast(
      coordinates,
      period,
      RefreshPolicy.IfExpired,
    );

    expect(result).toEqual(expectedForecast);
    expect(remote.calls).toHaveLength(0);
  });

  it('возвращает stale cache при временном сетевом сбое', async () => {
    const local = new InMemoryWeatherDataSource([
      staleWeatherRecord(),
    ]);
    const remote = new FailingWeatherRemoteDataSource(
      new NetworkUnavailable(),
    );

    const result = await createRepository({ local, remote, clock })
      .getForecast(coordinates, period, RefreshPolicy.IfExpired);

    expect(result.freshness).toBe('stale');
  });
});
```

Полезная матрица:

| Cache | Network | Policy | Ожидание |
|---|---|---|---|
| fresh | available | IfExpired | cache, без remote call |
| stale | available | IfExpired | remote + сохранение |
| stale | unavailable | IfExpired | stale fallback |
| empty | unavailable | любое | DataUnavailable |
| любое | available | ForceRefresh | remote |

## Тестирование ViewModel

ViewModel проверяется отдельно от DOM, если содержит значимую orchestration:

```ts
it('переводит NetworkUnavailable в retryable UI state', async () => {
  const getTripOverview = new StubGetTripOverview({
    error: new NetworkUnavailable(),
  });

  const { result } = renderHook(
    () => useTripDetailsViewModel('trip-1'),
    {
      wrapper: createApplicationWrapper({
        useCases: { getTripOverview },
      }),
    },
  );

  await waitFor(() => {
    expect(result.current.state).toEqual({
      status: 'error',
      message: 'Нет подключения к сети',
      canRetry: true,
    });
  });
});
```

Проверяются:

- начальное состояние;
- переходы loading/success/error;
- маппинг Domain Result в UI Model;
- UI Actions и построение Command;
- инвалидация presentation-кэша;
- UI Effects;
- защита от устаревшего async-результата.

Вместо `jest.mock('@data/repositories')` ViewModel получает тестовый application graph. Это сохраняет ту же DI-границу, что production.

## Тестирование Compound Components

Compound Component проверяется через публичную композицию:

```tsx
it('вызывает addPlace выбранного места', async () => {
  const user = userEvent.setup();
  const addPlace = vi.fn();

  render(
    <TripPlanner
      state={successfulPlannerState}
      actions={{ ...defaultActions, addPlace }}
    >
      <TripPlanner.PlaceSuggestions />
    </TripPlanner>,
  );

  await user.click(
    screen.getByRole('button', { name: 'Добавить музей' }),
  );

  expect(addPlace).toHaveBeenCalledWith('museum');
});
```

Проверяется:

- отображение вариантов UI State;
- вызов публичных Actions;
- допустимая перестановка частей;
- ошибка использования вне Root, если это контракт;
- keyboard navigation и focus management;
- ARIA-роли и accessible names.

Repository и Data Source здесь не нужны. View получает готовое presentation API.

## Component и Feature Integration Tests

Интеграционный тест App соединяет реальный View, ViewModel и use case с управляемыми внешними адаптерами:

```text
Page
  ↓
ViewModel
  ↓
Real Use Case
  ↓
In-memory Repository
```

Он полезен для проверки, что:

- пользовательское действие создаёт корректную Command;
- успешный сценарий меняет экран;
- доменная ошибка показывается в нужном месте;
- навигация происходит после завершения операции;
- query invalidation обновляет нужное представление.

Такой тест даёт больше уверенности, чем одновременный mock ViewModel, router, Repository и query client.

## Test Application Graph

Тесты собирают зависимости тем же способом, что production:

```ts
function createTestApplication(
  overrides: Partial<TestAdapters> = {},
): TestApplication {
  const adapters = {
    clock: new FixedClock(DEFAULT_NOW),
    trips: new InMemoryTripRepository(),
    weather: new StubWeatherRepository(defaultForecast),
    places: new InMemoryPlaceRepository(defaultPlaces),
    ...overrides,
  };

  return {
    application: createUseCases(adapters),
    adapters,
  };
}
```

Тест получает и готовое приложение, и ссылки на адаптеры для подготовки состояния и проверки результата.

Каждый тест создаёт новый graph. Общие изменяемые singleton между тестами запрещены.

## Demo adapters не равны test doubles

Demo-реализация предназначена для интерактивной демонстрации и может содержать задержки, подготовленные данные и сценарии ошибок. Test double предназначен для точного, быстрого и детерминированного теста.

Можно переиспользовать качественный in-memory Repository, но не следует автоматически использовать весь demo mode в тестах.

Выбор режима происходит в Composition Root:

```text
createProductionApplication(config)
createDemoApplication(config)
createTestApplication(overrides)
```

Data не читает глобальный `IS_DEMO_MODE` внутри каждой фабрики.

## Contract Tests внешнего API

Mock HTTP не гарантирует, что настоящий сервер соответствует fixture. Для критичных интеграций полезны:

- проверка OpenAPI/JSON Schema;
- consumer-driven contracts;
- тест против sandbox-среды;
- периодическая проверка реальных безопасных endpoints;
- fixture, полученная из версионируемого контракта.

Contract test должен обнаружить изменение поля или enum раньше, чем оно сломает production-маппер.

Тесты против внешней среды не заменяют локальные: они медленнее и могут быть нестабильны.

## E2E

E2E покрывает небольшой набор критичных пользовательских путей:

- запуск и восстановление сессии;
- создание основной Entity;
- ключевая mutation;
- offline/reconnect сценарий;
- deep link;
- критичная нативная интеграция.

E2E проверяет систему снаружи и не должен повторять все комбинации Domain. Граничные бизнес-случаи дешевле и точнее проверяются на нижних уровнях.

Тестовые данные должны создаваться через стабильный API/fixture mechanism, а не через длинную цепочку UI-шагов перед каждым тестом, если сами шаги не являются предметом проверки.

## Тестирование ошибок

Ошибка проверяется на уровне её владельца:

| Ошибка | Тест |
|---|---|
| Нарушение `DateRange` | unit Value Object |
| `TripNotFound` | use case |
| malformed API response | Mapper/Data Source |
| network → stale fallback | Repository implementation |
| error → локализованный UI State | ViewModel |
| render crash → fallback | Error Boundary |
| sync conflict | integration Data + use case/App |

Не проверяйте локализованную строку в Domain-тесте и AxiosError в View-тесте.

## Время, случайность и таймеры

Бизнес-время внедряется через `Clock`:

```ts
const clock = new FixedClock(
  Instant.parse('2026-08-06T10:00:00Z'),
);
```

UI-таймер проверяется fake timers:

```ts
vi.useFakeTimers();

await vi.advanceTimersByTimeAsync(30_000);

expect(screen.getByText('Код обновлён')).toBeVisible();
```

Не смешивайте `Date.now()` из production и fake timers без единой стратегии. Тест должен контролировать источник времени, влияющий на поведение.

Случайные идентификаторы и shuffle-алгоритмы также получают управляемый generator, если результат важен тесту.

## Параллельность и гонки

Асинхронные тесты должны проверять:

- более старый ответ не перезаписывает новый;
- повторный click не создаёт две команды;
- отменённый запрос не показывает ошибку;
- transaction откатывается полностью;
- sync worker не обрабатывает одну операцию параллельно;
- optimistic update восстанавливается после failure.

Не используйте произвольные задержки `sleep(100)`. Ожидайте наблюдаемое состояние, управляйте promise вручную или используйте fake timers.

## Snapshot tests

Большие snapshots JSX редко объясняют, какое поведение сломалось. Предпочтительнее assertions через роль, имя и видимый результат.

Snapshots полезны для:

- небольших стабильных сериализованных форматов;
- миграционных fixture;
- сгенерированного публичного schema;
- ограниченного визуального результата при осознанном review.

Snapshot не заменяет проверку доступности и пользовательского действия.

## Coverage

Coverage показывает непосещённые строки, но не качество сценариев. Высокое покрытие может сосуществовать с отсутствием проверки главного инварианта.

Полезнее определить обязательные риски:

- каждый Domain invariant имеет тест;
- каждый use case имеет success и значимые failure paths;
- каждый Mapper проверяет несовместимые внешние данные;
- каждая cache/sync policy имеет матрицу;
- каждый критичный пользовательский путь имеет integration/E2E проверку.

Порог coverage можно использовать как сигнал резкого падения, но не как единственную цель.

## Тестирование конфигурируемого поведения

Функциональность с пользовательскими настройками удобно тестировать не как один большой feature, а по цепочке:

```text
Definition
  + Override
      ↓
Effective Configuration
      ↓
Platform Adapter
      ↓
UI Action
```

Каждый переход имеет отдельный контракт и собственные риски.

### Матрица Definition и Override

Базовый resolver должен проверяться таблицей:

| Definition | Override | Ожидаемый результат |
|---|---|---|
| enabled default | отсутствует | enabled с default value |
| enabled default | assigned | enabled с пользовательским value |
| enabled default | disabled | disabled без value |
| обновлённый default | отсутствует | новое default value |
| обновлённый default | старый assigned | сохранённое пользовательское value |

Последние две строки защищают важное правило обновления приложения: изменение default применяется только к пользователям без override.

Тест должен сравнивать наблюдаемый Domain Result, а не количество вызовов внутреннего resolver.

```typescript
it('использует новый default при отсутствии override', () => {
  const result = resolveEffectiveConfiguration({
    definition: definition({ defaultValue: 'Primary+K' }),
    override: undefined,
  });

  expect(result).toEqual({
    status: 'enabled',
    value: 'Primary+K',
  });
});
```

### Канонизация как отдельный Domain Service

Если конфликт зависит от нормализованного представления, канонизация тестируется отдельно. Минимальная матрица:

- разный порядок частей даёт одинаковый ключ;
- регистр и незначащие пробелы не влияют на результат;
- платформенный placeholder раскрывается детерминированно;
- дубликаты после раскрытия удаляются;
- входной readonly-массив не мутируется.

После этого тест конфликта может считать канонизацию доверенной зависимостью и фокусироваться на scope policy.

### Матрица конфликтов

Полезно разделять совпадение значения и пересечение областей:

| Значение совпало | Scope пересекается | Команда активна | Конфликт |
|---|---|---|---|
| нет | да | да | нет |
| да | нет | да | нет |
| да | да | нет | нет |
| да | да | да | да |

Дополнительно проверяются:

- команда не конфликтует сама с собой;
- global scope пересекается с любой локальной областью;
- одинаковые local scope пересекаются;
- разные local scope могут использовать одинаковое назначение;
- возвращается конфликтующая модель, а не только `true`.

Последний пункт позволяет App показать пользователю, какое действие уже использует выбранное назначение.

### Contract suite для хранилища Override

Contract test запускается для production repository и in-memory fake:

```typescript
const hotkeySettingsRepositoryContract = (
  createRepository: () => HotkeySettingsRepository,
) => {
  it('заменяет override с тем же actionId', async () => {
    const repository = createRepository();

    await repository.save(assignedOverride('search', 'Alt+/'));
    await repository.save(disabledOverride('search'));

    await expect(repository.load()).resolves.toEqual([
      disabledOverride('search'),
    ]);
  });
};
```

Обязательные сценарии:

- пустое хранилище возвращает пустую коллекцию;
- `save` добавляет новую запись;
- повторный `save` заменяет запись того же действия;
- `remove` не затрагивает остальные действия;
- `clear` удаляет все override;
- порядок записей не используется как бизнес-гарантия, если он не объявлен контрактом.

### Повреждённые persistent data

Данные после `JSON.parse` проверяются как `unknown`. Data-тесты должны включать:

```text
невалидный JSON
не-массив вместо коллекции
неизвестный actionId
неизвестный discriminator
assigned без value
неизвестный modifier
лишние поля старой версии
```

Ожидаемое поведение выбирается явно: проигнорировать отдельную запись, вернуть пустое состояние, выполнить миграцию или сообщить инфраструктурную ошибку. Тест фиксирует выбранную degradation policy.

Type assertion в fixture не является runtime-проверкой:

```typescript
// Не проверяет фактическую структуру.
const overrides = JSON.parse(raw) as HotkeyOverride[];
```

### Тестирование платформенного Input Adapter

При поддержке физических клавиш нельзя ограничиваться одной раскладкой. Adapter получает минимальную структуру события, поэтому тесту не нужен настоящий браузер:

```typescript
expect(fromKeyboardEvent({
  code: 'KeyB',
  key: 'и',
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  metaKey: false,
})).toEqual({
  key: 'B',
  modifiers: ['primary'],
});
```

Полезная матрица:

| `code` | `key` | Ожидаемое значение |
|---|---|---|
| `KeyB` | `b` | `B` |
| `KeyB` | `и` | `B` |
| `Slash` | `/` | `/` |
| `Slash` | `.` | `/` |
| `ArrowLeft` | `ArrowLeft` | `ArrowLeft` |

Отдельно тестируется раскрытие основного модификатора для macOS и Windows/Linux. Платформу лучше передавать параметром адаптера, а не изменять глобальный `navigator` внутри теста.

### Feature integration

Integration-тест не должен повторять всю Domain-матрицу. Достаточно доказать основной сквозной путь:

1. Provider загружает override из fake repository;
2. View показывает effective label;
3. пользователь выбирает новое назначение;
4. Domain принимает или отклоняет изменение;
5. успешный override сохраняется;
6. конфликт преобразуется в доступное UI-сообщение;
7. событие ввода запускает правильный UI action.

Для проверки binding важнее наблюдаемый эффект — открылся поиск или переключилась панель, — а не факт вызова внутреннего hook.

### Что не следует объединять в одном тесте

Один тест не должен одновременно доказывать:

- алгоритм канонизации;
- политику scope;
- JSON-сериализацию;
- работу React Context;
- поведение браузерного события.

Такой тест медленный, хрупкий и не объясняет источник ошибки. Сквозная проверка нужна поверх устойчивых тестов отдельных границ, а не вместо них.

Подробнее: [пример менеджера горячих клавиш](./examples/hotkey-manager.md).

## Структура тестов

Тесты можно размещать рядом с кодом или в зеркальной структуре. Важнее единообразие и понятные fixture:

```text
domain/trips/
├── entities/
│   ├── Trip.ts
│   └── Trip.test.ts
├── use-cases/
│   ├── CreateTrip.ts
│   └── CreateTrip.test.ts
└── testing/
    ├── tripBuilder.ts
    └── InMemoryTripRepository.ts

data/weather/
├── DefaultWeatherRepository.ts
├── DefaultWeatherRepository.test.ts
└── testing/
    └── weatherFixtures.ts
```

Тестовый helper не должен превращаться в скрытый framework с собственной логикой. Fixture остаются маленькими и позволяют явно переопределять значимые поля.

## Антипаттерны

### Mock всего модуля Data из ViewModel-теста

Скрывает реальную DI-границу и делает тест зависимым от путей импортов. Передавайте test application graph.

### Проверка private-методов

Связывает тест с реализацией. Если private-алгоритм заслуживает отдельного теста, возможно, это самостоятельный Domain Service.

### Ожидание точного количества внутренних вызовов

Если количество не является контрактом, оптимизация кэша или batch изменит тест без изменения поведения.

### Реальные часы и случайность

Создают flaky tests. Внедряйте контролируемые источники.

### Один общий mutable fake на suite

Состояние протекает между тестами. Создавайте graph заново.

### Тест только happy path

Архитектурная ценность чаще проявляется в failure, fallback, retry и conflict paths.

### Assertions по техническому тексту ошибки

Проверяйте стабильный type/code или пользовательское отображение на соответствующем уровне.

## Минимальная матрица feature

Для законченной feature обычно достаточно следующего набора:

| Уровень | Минимальная проверка |
|---|---|
| Entity/Value Object | инварианты и переходы |
| Use Case | success, business failure, dependency failure |
| Mapper | valid и malformed external data |
| Repository | source policy и fallback |
| ViewModel | UI states и actions |
| View | пользователь видит состояние и может действовать |
| Feature integration | основной путь App + Domain |
| E2E | только если путь критичен |

## Чек-лист

- [ ] Тест проверяет наблюдаемое поведение, а не структуру реализации.
- [ ] Domain-тест не запускает React или реальный I/O.
- [ ] Время и случайность контролируются.
- [ ] Use case создаётся через явные зависимости.
- [ ] Fake Repository соблюдает тот же contract suite.
- [ ] Mapper проверяется на несовместимые внешние данные.
- [ ] Repository policy покрыта матрицей cache/network.
- [ ] ViewModel получает test application graph.
- [ ] Compound Components проверяются через публичный UI API.
- [ ] Ошибка тестируется на уровне её владельца.
- [ ] Асинхронные тесты не используют произвольный sleep.
- [ ] Изменяемое состояние не разделяется между тестами.
- [ ] Критичные пути покрыты integration или E2E.
- [ ] Definition, override и effective configuration проверяются независимой матрицей.
- [ ] Persistent data тестируются как `unknown`, включая повреждённые записи.
- [ ] Платформенный input adapter проверяется на разных раскладках.
- [ ] Coverage используется как сигнал, а не замена анализа рисков.

## Дальнейшее чтение

- [Слои архитектуры](./layers.md) — границы объектов тестирования.
- [Внедрение зависимостей](./cross-cutting/di.md) — test application graph.
- [Обработка ошибок](./error-handling.md) — матрица failure paths.
- [Compound Components и MVVM](./compound-components.md) — публичный API View.
- [Оффлайн-режим](./examples/offline-mode.md) — cache и sync scenarios.
- [Менеджер горячих клавиш](./examples/hotkey-manager.md) — пример тестирования конфигурации и input adapter.
