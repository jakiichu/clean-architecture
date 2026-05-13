# Clean Architecture Frontend — Документация

Сайт-документация по архитектурной методологии для фронтенд и мобильных проектов (React, React Native / Expo). Построен на [Docusaurus](https://docusaurus.io/).

## О проекте

Документация фиксирует единый подход к проектированию на основе чистой архитектуры:

- **Трёхслойная модель** `App → Domain ← Data` с инверсией зависимостей
- **Управление состоянием** — классификация UI / Server / Business / Persistent State и правила их размещения
- **Обработка ошибок** — типизированные интерфейсы ошибок по слоям, retry-политики, Error Boundary
- **Нативные модули** — паттерн Адаптер для SecureStore, Keychain, биометрии, камеры
- **Стандарты кода** — правила именования, типизации DTO, организации экспортов
- **Практические примеры** — пошаговая реализация GET-запроса и мутации (POST)

## Структура документации

```
docs/
├── intro.md                        # Введение и мотивация
├── architecture-overview.md        # Обзор архитектуры
├── layers.md                       # Слои: App, Domain, Data
├── coding-standards.md             # Стандарты написания кода
├── error-handling.md               # Обработка ошибок и загрузки
├── glossary.md                     # Глоссарий терминов
├── cross-cutting/
│   ├── state-management.md         # Управление состоянием и границы слоёв
│   └── index.md
└── examples/
    ├── feature-get.md              # Пример: GET-запрос (Query)
    ├── feature-post.md             # Пример: мутация (POST)
    ├── native-integration.md       # Пример: нативные модули
    └── index.md
```

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
