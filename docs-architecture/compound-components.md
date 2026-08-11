---
title: Compound Components и MVVM
sidebar_position: 4
---

# Compound Components и MVVM

Compound Components — один из основных паттернов композиции сложного интерфейса в `App`-слое. Он позволяет представить UI-модуль как набор связанных частей с общим состоянием и действиями:

```tsx
<TripPlanner state={state} actions={actions}>
  <TripPlanner.Header />
  <TripPlanner.Days />
  <TripPlanner.PlaceSuggestions />
  <TripPlanner.Actions />
</TripPlanner>
```

Потребитель управляет расположением частей, но не передаёт одни и те же props через каждый уровень дерева. Корневой компонент предоставляет дочерним частям ограниченный presentation-контекст.

Compound Components не заменяют Clean Architecture или MVVM. Эти подходы решают задачи на разных уровнях:

```text
Clean Architecture → границы App, Domain и Data
MVVM              → связь View со сценариями
Compound Components → композиция View
```

## Место паттерна в архитектуре

Compound Component целиком принадлежит `App`:

```text
Data
  ↑ implements
Domain contracts
  ↑ used by
Use Cases
  ↑ called by
ViewModel
  ↑ exposes UI State + Actions
Compound Component
  ↑ renders
View
```

На вход корневому компоненту передаются:

- готовое UI State;
- UI-действия;
- дочерние элементы;
- необязательные параметры presentation-поведения.

В его контекст не передаются HTTP-клиенты, Data Source, конкретные репозитории и инфраструктурные настройки.

## Базовая реализация

### Публичные типы

```tsx
type TTripPlannerUiState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      selectedDayId: string;
      days: TripDayUiModel[];
      suggestions: PlaceSuggestionUiModel[];
    };

type TTripPlannerActions = {
  selectDay(dayId: string): void;
  addPlace(placeId: string): void;
  retry(): void;
};
```

`TTripPlannerUiState` и `TTripPlannerActions` принадлежат App. Они описывают потребности View, а не модель хранения или ответ API.

### Контекст

```tsx
type TTripPlannerContextValue = {
  state: TTripPlannerUiState;
  actions: TTripPlannerActions;
};

const TripPlannerContext =
  createContext<TTripPlannerContextValue | null>(null);

function useTripPlannerContext(): TTripPlannerContextValue {
  const value = useContext(TripPlannerContext);

  if (value === null) {
    throw new Error(
      'TripPlanner components must be used inside TripPlanner',
    );
  }

  return value;
}
```

Проверка на отсутствие Provider является ошибкой использования UI API, а не доменной ошибкой.

### Корневой компонент

```tsx
type TTripPlannerRootProps = PropsWithChildren<{
  state: TTripPlannerUiState;
  actions: TTripPlannerActions;
}>;

function TripPlannerRoot({
  state,
  actions,
  children,
}: TTripPlannerRootProps) {
  const value = useMemo(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <TripPlannerContext.Provider value={value}>
      <section>{children}</section>
    </TripPlannerContext.Provider>
  );
}
```

### Составная часть

```tsx
function TripPlannerDays() {
  const { state, actions } = useTripPlannerContext();

  if (state.status !== 'success') {
    return null;
  }

  return (
    <DayTabs
      days={state.days}
      selectedDayId={state.selectedDayId}
      onSelect={actions.selectDay}
    />
  );
}
```

### Публичный API

```tsx
export const TripPlanner = Object.assign(TripPlannerRoot, {
  Header: TripPlannerHeader,
  Days: TripPlannerDays,
  PlaceSuggestions: TripPlannerPlaceSuggestions,
  Actions: TripPlannerActionsPanel,
});
```

Вариант с именованными экспортами также допустим. Важно, чтобы модуль имел небольшой и предсказуемый публичный API.

## Связь с ViewModel

ViewModel остаётся единственной presentation-точкой запуска сценариев:

```tsx
function TripPlannerPage({ tripId }: { tripId: string }) {
  const { state, actions } = useTripPlannerViewModel(tripId);

  return (
    <TripPlanner state={state} actions={actions}>
      <TripPlanner.Header />
      <TripPlanner.Days />
      <TripPlanner.PlaceSuggestions />
      <TripPlanner.Actions />
    </TripPlanner>
  );
}
```

```tsx
function useTripPlannerViewModel(tripId: string) {
  const getTripOverview = useDependency('getTripOverview');
  const addPlaceToTripDay = useDependency('addPlaceToTripDay');

  // Запуск use case, обработка результата и построение UI State.
  // Реализация сокращена, чтобы показать архитектурную границу.

  return {
    state,
    actions: {
      selectDay,
      addPlace,
      retry,
    },
  };
}
```

Дочерняя часть Compound Component вызывает `actions.addPlace()`, но не получает `AddPlaceToTripDay` напрямую. Благодаря этому:

- View не знает о сигнатуре use case;
- способ получения зависимостей скрыт во ViewModel;
- UI можно проверять с простыми функциями-заглушками;
- ViewModel можно тестировать независимо от разметки;
- Domain не зависит от структуры Compound Component.

## Что допустимо хранить в контексте

### Допустимо

```ts
type TPlannerContext = {
  state: TTripPlannerUiState;
  actions: {
    selectDay(dayId: string): void;
    addPlace(placeId: string): void;
    retry(): void;
  };
  disabled: boolean;
};
```

- UI State;
- UI Actions;
- выбранные элементы и состояние раскрытия;
- presentation-конфигурация;
- ссылки на DOM-элементы, если они нужны для доступности или фокуса.

### Недопустимо

```ts
type TPlannerContext = {
  tripRepository: ITripRepository;
  weatherRemoteDataSource: IWeatherRemoteDataSource;
  queryClient: QueryClient;
  apiBaseUrl: string;
};
```

Такой контекст становится скрытым Composition Root. Дочерние компоненты начинают самостоятельно координировать сценарии и инфраструктуру, а UI-дерево превращается в неявный граф зависимостей.

Сам объект use case тоже обычно не следует передавать в UI-контекст. View лучше предоставить действие, выраженное на языке интерфейса:

```text
Плохо:  executeAddPlaceToTripDay(command)
Хорошо: addPlace(placeId)
```

ViewModel знает выбранный день, идентификатор поездки и способ построения команды. View не обязана собирать доменный запрос.

## Контролируемое и локальное состояние

У Compound Component может быть локальное состояние, если оно не имеет значения за пределами UI:

- открыт ли popover;
- какой элемент находится в фокусе;
- активен ли drag-and-drop;
- какая секция визуально раскрыта.

Состояние следует поднять во ViewModel, если оно:

- влияет на запуск use case;
- должно переживать размонтирование части дерева;
- используется несколькими независимыми UI-блоками;
- должно восстанавливаться из URL или сохранённого состояния;
- участвует в формировании результата экрана.

Компонент может поддерживать controlled/uncontrolled API, если это действительно нужно переиспользуемому UI:

```tsx
<Tabs value={selectedTab} onValueChange={selectTab}>
  <Tabs.List />
  <Tabs.Content value="overview" />
</Tabs>
```

Но feature-компоненту обычно полезнее один контролируемый источник состояния — ViewModel.

## Производительность контекста

Изменение значения Context приводит к обновлению его потребителей. Для небольшого feature-компонента этого обычно достаточно, но крупный контекст не следует превращать в состояние всего экрана.

Если части обновляются с разной частотой, контексты можно разделить:

```text
TripPlannerStateContext
TripPlannerActionsContext
TripPlannerSelectionContext
```

Практические правила:

- сохранять стабильные ссылки на actions через `useCallback`;
- мемоизировать объект значения Provider, когда это имеет смысл;
- не помещать в контекст данные, которые нужны одному потомку;
- держать быстро меняющееся локальное состояние рядом с его потребителем;
- измерять реальные перерендеры до добавления сложной оптимизации.

Разделение Context — средство управления ответственностью и подписками, а не обязательный ритуал.

## Доступность

Свобода композиции не должна разрушать семантику интерфейса. Корневой компонент и его части отвечают за согласованный accessibility-контракт:

- правильные роли элементов;
- связь label и control;
- управление фокусом;
- клавиатурную навигацию;
- корректный порядок DOM;
- объявления состояния через `aria-*` атрибуты.

Например, `Tabs.List`, `Tabs.Trigger` и `Tabs.Content` могут быть визуально гибкими, но должны сохранять отношения `tablist`, `tab` и `tabpanel`.

## Когда применять

Compound Components хорошо подходят, когда:

- UI состоит из нескольких семантически связанных частей;
- части используют общее presentation-состояние;
- потребителю нужна свобода расположения и выбора частей;
- prop drilling затрудняет чтение публичного API;
- модуль имеет несколько вариантов компоновки;
- важен декларативный DSL интерфейса.

Типичные примеры:

- сложная форма или пошаговый мастер;
- таблица с фильтрами, пагинацией и toolbar;
- reader с панелями управления;
- planner или календарь;
- tabs, accordion, menu, select и dialog;
- карточка с заменяемыми header, body и actions.

## Когда не применять

Обычные props лучше, если:

- компонент состоит из одной небольшой части;
- связь между элементами отсутствует;
- композиция имеет единственный допустимый вариант;
- контекст скрывает простой и полезный поток данных;
- для понимания компонента приходится искать множество неявных зависимостей.

Не нужно превращать каждый `Card` или `Button` в семейство Compound Components только ради единообразия.

## Антипаттерны

### Контекст как Service Locator

```tsx
const services = useAppServices();
await services.tripRepository.save(trip);
```

Компонент сам находит инфраструктурную зависимость и обходит ViewModel. Зависимость становится неявной, а сценарий распадается между элементами View.

### Бизнес-правило внутри составной части

```tsx
const canAddPlace =
  day.activities.length < 5 && weather.condition !== 'storm';
```

Если ограничение определяет допустимость изменения поездки, оно принадлежит Domain. UI может использовать возвращённый признак доступности, но не должен быть единственным владельцем правила.

### Один глобальный Compound Component

Контекст всего приложения с десятками состояний и действий создаёт сильную связанность и широкие перерендеры. Compound Component должен соответствовать одной UI-возможности или ограниченному виджету.

### Неявная магия порядка

Если компонент работает только при случайном порядке вложенности, это условие должно быть выражено структурой API, проверкой или документацией. Лучше сделать ошибочное использование невозможным или хотя бы быстро обнаруживаемым.

### Дублирование ViewModel

Если Root одновременно загружает данные, вызывает use case, маппит ошибки, управляет навигацией и предоставляет контекст, он фактически стал второй ViewModel. Следует выбрать одного владельца orchestration и оставить Root компонентом композиции.

## Тестирование

Паттерн удобно проверять на трёх уровнях.

### Составная часть

Рендерится внутри тестового Provider с готовыми `state` и `actions`. Проверяются отображение и пользовательские события без настоящего Domain и Data.

### Публичная композиция

Проверяется, что части совместно образуют корректное доступное поведение: переключают вкладки, открывают панели и вызывают переданные actions.

### Экран с ViewModel

Проверяется интеграция presentation-слоя: результат use case преобразуется в UI State, а пользовательское действие приводит к вызову правильного сценария.

Внешний API и база не нужны в тестах Compound Component. Их поведение проверяется отдельно на уровне Data.

## Чек-лист ревью

- [ ] Компонент и его контекст находятся в `App`.
- [ ] Root получает UI State и Actions, а не инфраструктурные зависимости.
- [ ] Дочерние части не вызывают Repository или Data Source напрямую.
- [ ] Бизнес-правила делегированы Domain.
- [ ] ViewModel остаётся владельцем запуска use case.
- [ ] Контекст ограничен одной UI-возможностью.
- [ ] Простые props не были заменены контекстом без причины.
- [ ] Публичный API позволяет понять допустимую композицию.
- [ ] Семантика и клавиатурная доступность сохраняются.
- [ ] Производительность оптимизируется на основе измерений.

## Итоговая модель

Compound Components особенно хорошо работают в этой архитектуре, когда соблюдается граница:

> ViewModel предоставляет готовые UI State и Actions, а Compound Components декларативно собирают из них View.

Паттерн делает presentation-слой выразительным и гибким, но не перемещает в него ответственность Domain, Data или Composition Root.

## Дальнейшее чтение

- [Введение](./intro.md) — общая модель Clean Architecture и MVVM.
- [Обзор архитектуры](./architecture-overview.md) — направление зависимостей и поток данных.
- [Слои архитектуры](./layers.md) — ответственность App, Domain и Data.
- [Управление состоянием](./cross-cutting/state-management.md) — владельцы разных видов состояния.
- [Внедрение зависимостей](./cross-cutting/di.md) — место создания use case и репозиториев.
