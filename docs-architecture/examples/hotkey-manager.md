---
title: Пример — Менеджер горячих клавиш
sidebar_position: 8
---

# Пример: менеджер переназначаемых горячих клавиш

Менеджер горячих клавиш кажется UI-задачей, пока приложение не начинает поддерживать несколько команд, пользовательское переназначение, отключение сочетаний, разные области действия и проверку конфликтов. После этого у функциональности появляется собственная предметная модель.

В примере рассматриваются команды:

- открытие глобального поиска;
- сворачивание бокового меню;
- переход к предыдущему и следующему документу;
- увеличение и уменьшение масштаба документа.

Пользователь может переназначать разрешённые команды. Новое сочетание нельзя сохранить, если оно конфликтует с другой активной командой в пересекающейся области.

## Почему недостаточно хранить строки рядом с компонентами

Наивная реализация обычно выглядит так:

```typescript
useHotkey('Alt+/', openSearch);
useHotkey('Mod+B', toggleSidebar);
```

Такой вариант работает, пока сочетания статичны и независимы. При появлении настроек возникают вопросы:

- где находится единый каталог команд;
- кто определяет стандартные сочетания;
- кто проверяет конфликт глобальной и локальной команды;
- как отличить отключённую команду от команды без пользовательской настройки;
- где хранить пользовательские изменения;
- кто преобразует Domain-модель в формат конкретной hotkey-библиотеки;
- как учитывать раскладку и физическое положение клавиш.

Если отвечать на эти вопросы внутри React-компонентов, бизнес-правила быстро дублируются между экраном настроек, глобальным поиском и просмотрщиком документов.

## Распределение ответственности

| Задача | Слой |
|---|---|
| Идентификаторы действий | Domain |
| Стандартные сочетания и области | Domain |
| Правила переназначения и отключения | Domain |
| Определение конфликта | Domain |
| Контракт хранилища пользовательских настроек | Domain |
| Сериализация настроек в `localStorage` | Data |
| Проверка сохранённых данных на границе | Data |
| Загрузка настроек и orchestration операций | App |
| React Context и состояние загрузки | App |
| Адаптер к hotkey-библиотеке | App |
| Запись `KeyboardEvent.code` | App |
| Отображение списка и ошибок | App |

Основная граница выглядит так:

```text
View
  ↓ UI action
Application service / Provider
  ↓
Domain policy ──→ Repository contract
                       ↑
                 Data implementation
```

Domain не знает о `localStorage`, React, `KeyboardEvent` и библиотеке регистрации сочетаний.

## Шаг 1. Стабильный Action ID

Команда должна иметь идентификатор, не зависящий от текста кнопки, маршрута или имени React-компонента.

```typescript
const HOTKEY_ACTION = {
  GLOBAL_SEARCH_OPEN: 'global-search.open',
  SIDEBAR_TOGGLE: 'sidebar.toggle',
  DOCUMENT_VIEWER_PREVIOUS: 'document-viewer.previous',
  DOCUMENT_VIEWER_NEXT: 'document-viewer.next',
  DOCUMENT_VIEWER_ZOOM_IN: 'document-viewer.zoom-in',
  DOCUMENT_VIEWER_ZOOM_OUT: 'document-viewer.zoom-out',
} as const;

type THotkeyActionId =
  (typeof HOTKEY_ACTION)[keyof typeof HOTKEY_ACTION];
```

`Action ID` является Domain-идентичностью команды. Локализованная подпись «Следующий документ» принадлежит App и может меняться независимо.

## Шаг 2. Комбинация как объект-значение

Строка `Control+Shift+K` удобна библиотеке, но недостаточно выразительна для Domain. В ядре сочетание представляется структурой:

```typescript
const HOTKEY_MODIFIER = {
  ALT: 'alt',
  CONTROL: 'control',
  META: 'meta',
  PRIMARY: 'primary',
  SHIFT: 'shift',
} as const;

type THotkeyModifier =
  (typeof HOTKEY_MODIFIER)[keyof typeof HOTKEY_MODIFIER];

interface IHotkeyCombination {
  readonly key: string;
  readonly modifiers: readonly THotkeyModifier[];
}
```

`primary` означает основной платформенный модификатор:

- `Control` в Windows и Linux;
- `Meta` в macOS.

Domain сохраняет переносимую семантику, а App раскрывает её с учётом текущей платформы.

## Шаг 3. Definition, Override и Effective Hotkey

Важно не смешивать три разных состояния.

### Definition

Неизменяемое описание команды:

```typescript
interface IHotkeyDefinition {
  readonly actionId: THotkeyActionId;
  readonly defaultCombination: IHotkeyCombination;
  readonly scope: HotkeyScope;
  readonly repeatPolicy: HotkeyRepeatPolicy;
  readonly isReassignable: boolean;
}
```

### Override

Только пользовательское отклонение от definition:

```typescript
type THotkeyOverride =
  | {
      readonly type: 'assigned';
      readonly actionId: THotkeyActionId;
      readonly combination: IHotkeyCombination;
    }
  | {
      readonly type: 'disabled';
      readonly actionId: THotkeyActionId;
    };
```

Отсутствие override означает «использовать стандартное значение». Удаление override является сбросом к стандартному сочетанию.

### Effective Hotkey

Результат применения definition и override:

```typescript
type TEffectiveHotkey =
  | {
      readonly status: 'enabled';
      readonly actionId: THotkeyActionId;
      readonly combination: IHotkeyCombination;
      readonly scope: HotkeyScope;
      readonly isReassignable: boolean;
      readonly repeatPolicy: HotkeyRepeatPolicy;
    }
  | {
      readonly status: 'disabled';
      readonly actionId: THotkeyActionId;
      readonly scope: HotkeyScope;
      readonly isReassignable: boolean;
      readonly repeatPolicy: HotkeyRepeatPolicy;
    };
```

Discriminated union не позволяет случайно обратиться к `combination` отключённой команды.

## Шаг 4. Канонизация сочетаний

Конфликт нельзя определять простым сравнением объектов. Эти записи логически эквивалентны:

```text
Control + Shift + K
Shift + Control + k
```

Domain строит стабильный технический ключ:

```text
control+shift::k
```

Алгоритм канонизации:

1. раскрыть `primary` в `control` или `meta`;
2. удалить модификаторы-дубликаты;
3. отсортировать модификаторы;
4. очистить и нормализовать регистр клавиши;
5. объединить части стабильным разделителем.

Канонический ключ не предназначен для UI. Отображаемая строка форматируется отдельно в App.

## Шаг 5. Области и конфликты

Команды принадлежат области действия:

```typescript
const HOTKEY_SCOPE = {
  GLOBAL: 'global',
  DOCUMENT_VIEWER: 'document-viewer',
} as const;
```

Правила конфликта:

| Первая команда | Вторая команда | Результат |
|---|---|---|
| global | global | конфликт |
| global | document-viewer | конфликт |
| document-viewer | document-viewer | конфликт |
| document-viewer | editor | нет конфликта |

Отключённые команды не участвуют в проверке. Изменяемая команда не сравнивается сама с собой.

Сервис поиска конфликта остаётся чистой функцией:

```text
new combination
    ↓ canonical key
effective hotkeys
    ↓ exclude self and disabled
scope policy
    ↓
conflicting hotkey | undefined
```

## Шаг 6. Создание допустимого Override

Domain не должен позволять App самостоятельно собирать произвольный override. Сценарий назначения выполняет проверки в фиксированном порядке:

```text
найти действие
  ↓
проверить isReassignable
  ↓
проверить структуру комбинации
  ↓
найти конфликт
  ↓
создать assigned override
```

Сценарий отключения проще:

```text
найти действие
  ↓
проверить isReassignable
  ↓
создать disabled override
```

Оба сервиса только создают корректный результат. Они не обращаются к хранилищу.

## Шаг 7. Контракт репозитория в Domain

```typescript
interface IHotkeySettingsRepository {
  load(): Promise<readonly THotkeyOverride[]>;
  save(override: THotkeyOverride): Promise<void>;
  remove(actionId: THotkeyActionId): Promise<void>;
  clear(): Promise<void>;
}
```

Контракт описывает намерения:

- `save` сохраняет изменение команды;
- `remove` сбрасывает одну команду к definition;
- `clear` сбрасывает все настройки.

В интерфейсе нет `localStorage.getItem`, JSON и ключа хранения. Эти детали принадлежат Data.

## Шаг 8. Реализация в Data

Data-репозиторий:

1. читает сериализованное значение;
2. безопасно разбирает JSON;
3. проверяет неизвестные данные на runtime-границе;
4. отбрасывает повреждённые записи;
5. заменяет override с тем же `actionId`;
6. сериализует новый список.

TypeScript-тип не защищает данные, прочитанные из внешнего хранилища. Результат `JSON.parse` сначала должен рассматриваться как `unknown`.

```typescript
const parsed: unknown = JSON.parse(serialized);

if (!Array.isArray(parsed)) {
  return [];
}

return parsed.filter(isHotkeyOverride);
```

Решение «можно ли назначить сочетание» не переносится в Data. Репозиторий отвечает за надёжное хранение, а не за бизнес-допустимость.

## Шаг 9. Orchestration в App

Application Provider хранит загруженные override и вычисляет effective hotkeys:

```text
definitions + overrides → effective hotkeys
```

Операция назначения выглядит так:

```text
UI передаёт actionId и combination
  ↓
Domain создаёт проверенный override
  ↓
Repository сохраняет override
  ↓
App обновляет состояние
  ↓
подписанные View получают effective hotkeys
```

Provider не повторяет проверку конфликтов. Он координирует Domain и Data, управляет состоянием и преобразует ошибку в пользовательскую реакцию.

## Шаг 10. Адаптер hotkey-библиотеки

Конкретная библиотека может ожидать строку:

```text
Mod+Shift+K
```

Domain хранит:

```typescript
{
  key: 'K',
  modifiers: ['primary', 'shift'],
}
```

Преобразование выполняется в App adapter. Благодаря этому замена библиотеки не меняет Domain и сохранённую бизнес-модель.

Адаптер также может переводить логические Domain-клавиши в технические обозначения библиотеки:

```text
Plus  → =
Minus → -
```

## Физическая клавиша и раскладка

`KeyboardEvent.key` описывает получившийся символ, а `KeyboardEvent.code` — физическое положение клавиши.

```text
Английская раскладка: key = "b", code = "KeyB"
Русская раскладка:    key = "и", code = "KeyB"
```

Если пользователь назначает расположение клавиши, recorder должен опираться на `code`:

```text
KeyB  → B
Slash → /
Digit7 → 7
```

Служебные клавиши можно оставлять логическими:

```text
ArrowLeft
Escape
Enter
Tab
```

Важно применять одну политику и при записи, и при исполнении. Если recorder сохраняет физическую клавишу, а runtime сравнивает только `event.key`, сочетание перестанет работать после смены раскладки.

Эта логика принадлежит App adapter, потому что связана с браузерным событием и способом ввода, а не с правилами конфликтов.

## Подключение действий к View

Компонент не должен знать стандартное сочетание:

```typescript
useHotkeyAction(HOTKEY_ACTION.SIDEBAR_TOGGLE, toggleSidebar);
```

Хук:

1. получает effective hotkey по `actionId`;
2. учитывает статус и repeat policy;
3. преобразует браузерное событие в комбинацию;
4. сравнивает канонические ключи;
5. вызывает UI action.

Открытие поиска, переключение sidebar и изменение масштаба остаются UI-действиями. Domain определяет допустимое сочетание, но не вызывает `setOpen`, `navigate` или изменение React State.

## Экран настроек

ViewModel подготавливает UI Model:

```typescript
interface IHotkeySettingsItem {
  readonly actionId: THotkeyActionId;
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly isReassignable: boolean;
}
```

Локализованные `title`, `description` и `label` принадлежат App. View отображает список и вызывает готовые действия:

- изменить;
- отключить;
- сбросить к стандартному.

Domain Error преобразуется в toast или inline-сообщение на presentation-границе.

## Рекомендуемая структура

```text
src/
├── domain/modules/hotkeys/
│   ├── model/
│   │   ├── action-id.ts
│   │   ├── hotkey-combination.ts
│   │   ├── hotkey-definition.ts
│   │   ├── hotkey-override.ts
│   │   └── effective-hotkey.ts
│   ├── services/
│   │   ├── resolve-effective-hotkeys.ts
│   │   ├── create-hotkey-combination-key.ts
│   │   ├── find-hotkey-conflict.ts
│   │   ├── create-assigned-hotkey-override.ts
│   │   └── create-disabled-hotkey-override.ts
│   └── repository.ts
├── data/repository/
│   └── hotkey-settings-repository.ts
└── app/common/hotkeys/
    ├── hotkey-settings-provider.tsx
    ├── hotkey-adapter.ts
    └── use-hotkey-action.ts
```

Структура отражает причины изменения:

- новое правило конфликта меняет Domain;
- переход с `localStorage` на IndexedDB меняет Data;
- замена hotkey-библиотеки или способа записи клавиш меняет App.

## Что тестировать

### Domain

- применение default combination;
- assigned и disabled override;
- канонизацию порядка и регистра;
- раскрытие `primary`;
- конфликт global и local scope;
- отсутствие конфликта разных local scope;
- запрет изменения непереназначаемой команды;
- создание assigned и disabled override.

### Data

- пустое хранилище;
- сохранение и замена override;
- удаление одной настройки;
- полный сброс;
- повреждённый JSON;
- неизвестные action и modifier.

### App

- преобразование Domain combination в формат библиотеки;
- преобразование `KeyB` при разных раскладках;
- преобразование `Slash`, когда `event.key` содержит другой символ;
- отображение effective settings;
- вывод ошибки конфликта;
- вызов правильного UI action.

## Типичные ошибки

### Хранить готовую строку библиотеки в Domain

Domain начинает зависеть от синтаксиса заменяемого инструмента.

### Проверять конфликт только на экране настроек

Другой вызывающий код сможет сохранить недопустимый override. Инвариант должен защищаться Domain-сервисом.

### Сохранять полный effective catalog

После изменения defaults старые сохранённые значения продолжат перекрывать новый каталог. Хранить следует только пользовательские отклонения.

### Считать отсутствие override отключением

Отсутствие override означает стандартное состояние. Отключение должно быть явным вариантом модели.

### Использовать `event.key` для физического назначения

Сочетания начинают зависеть от активной раскладки.

### Вызывать UI из Domain

Domain не открывает поиск и не изменяет масштаб. Он определяет правила назначения команды, а App связывает команду с UI action.

## Итог

Менеджер горячих клавиш показывает, что не каждая клиентская функциональность является только UI-деталью. Как только появляются устойчивые правила — идентичность команды, области, конфликты, возможность переназначения и явное отключение — формируется Domain-модель.

При корректном разделении:

- Domain гарантирует допустимость настроек;
- Data надёжно хранит пользовательские изменения;
- App адаптирует клавиатуру, платформу и библиотеку;
- View остаётся декларативным и работает с готовой UI Model.

## Дальнейшее чтение

- [Слои архитектуры](../layers.md)
- [Управление состоянием](../cross-cutting/state-management.md)
- [Внедрение зависимостей](../cross-cutting/di.md)
- [Обработка ошибок](../error-handling.md)
- [Тестирование](../testing.md)
