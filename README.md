# Clean Architecture Frontend — Документация

Сайт-документация по архитектурной методологии для фронтенд и мобильных проектов (React, React Native / Expo). Построен на [Docusaurus](https://docusaurus.io/).

## О проекте

Документация фиксирует единый подход к проектированию на основе чистой архитектуры:

- **Трёхслойная модель** `App → Domain ← Data` с инверсией зависимостей
- **Управление состоянием** — классификация UI / Server / Business / Persistent State и правила их размещения
- **Обработка ошибок** — типизированные интерфейсы ошибок по слоям, retry-политики, Error Boundary
- **Платформенные адаптеры** — браузерный ввод, permissions, SecureStore, биометрия и lifecycle подписок
- **Dependency Injection** — Composition Root, жизненные циклы и тестовые реализации
- **Compound Components + MVVM** — композиция сложного UI без утечки бизнес-логики во View
- **Стандарты кода** — правила именования, типизации DTO, организации экспортов
- **Тестирование** — стратегия unit, contract, integration и архитектурных проверок
- **Практические примеры** — от GET/POST до offline-mode и переназначаемых горячих клавиш

## Структура документации

```
docs-architecture/
├── intro.md                        # Введение и мотивация
├── architecture-overview.md        # Обзор архитектуры
├── layers.md                       # Слои: App, Domain, Data
├── compound-components.md          # Compound Components и MVVM
├── coding-standards.md             # Стандарты написания кода
├── navigation.md                   # Навигация и guards
├── testing.md                      # Стратегия тестирования
├── error-handling.md               # Обработка ошибок и восстановление
├── glossary.md                     # Глоссарий терминов
├── cross-cutting/
│   ├── state-management.md         # Управление состоянием и границы слоёв
│   ├── di.md                       # Dependency Injection и Composition Root
│   ├── platform-adapters.md        # Браузерные и нативные границы
│   └── index.md
└── examples/
    ├── feature-get.md              # Пример: GET-запрос (Query)
    ├── feature-post.md             # Пример: мутация (POST)
    ├── native-integration.md       # Пример: нативные модули
    ├── polling.md                  # Пример: polling и countdown
    ├── form-validation.md          # Пример: многошаговая форма
    ├── offline-mode.md             # Пример: управляемая деградация
    ├── hotkey-manager.md           # Пример: горячие клавиши и overrides
    └── index.md
```

Начальная точка чтения — [введение](./docs-architecture/intro.md), а для конкретной задачи можно сразу открыть [каталог примеров](./docs-architecture/examples/index.md).

## Быстрый старт

### Требования

- Node.js >= 20

### Установка

```bash
npm install
```

### Локальная разработка

```bash
npm start
```

Открывает браузер на `http://localhost:3000`. Изменения в `.md`-файлах применяются мгновенно.

### Сборка

```bash
npm run build
```

Генерирует статический сайт в папку `build/`.

### Предпросмотр сборки

```bash
npm run serve
```

### Очистка кэша

```bash
npm run clear
```

## Деплой

#### GitHub Pages (SSH)

```bash
USE_SSH=true npm run deploy
```

#### GitHub Pages (HTTPS)

```bash
GIT_USER=<GitHub username> npm run deploy
```

## Технологии

| Инструмент | Версия |
|---|---|
| Docusaurus | 3.9.2 |
| React | 19 |
| TypeScript | ~5.6 |
| Node.js | >= 20 |
