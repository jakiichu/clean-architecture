---
title: Пример реализации фичи (GET-запрос)
sidebar_position: 4
---

# Пример реализации фичи: получение данных (GET)

В данном разделе разобран пошаговый подход к созданию функциональной единицы, отвечающей за получение данных с сервера. Пример демонстрирует, как архитектурные принципы Clean Architecture применяются на практике: от описания контрактов в `Domain` до интеграции с UI-слоем в `App`.

Материал носит рекомендательный характер и не привязан к конкретному фреймворку. В примерах используются общие паттерны, которые легко адаптировать под React, Vue, Angular или мобильные платформы.

## Почему разработка начинается с Domain

Слой `Domain` является архитектурным ядром. Именно здесь фиксируется «язык» системы: сущности, сценарии и правила взаимодействия. Начало разработки с `Domain` гарантирует:

- Бизнес-логика не подстраивается под возможности UI или особенности HTTP-клиента
- Контракты становятся точкой согласования между фронтенд, бэкенд и мобильными командами
- Инфраструктурные детали (кэширование, ретраи, маппинг ответов) изолируются и заменяются без влияния на ядро
- Use-case покрываются unit-тестами в изоляции от сети и браузера

## Контракты важнее реализации

Перед написанием кода фиксируются интерфейсы, которые будут связывать слои:

1. **DTO** — формат данных, возвращаемый бизнес-сценарием
2. **Port** — входные параметры use-case
3. **Repository Interface** — абстракция доступа к источнику данных
4. **Use-case Interface** — контракт бизнес-сценария

Только после утверждения контрактов переходят к реализации. Это позволяет параллелизовать работу: бэкенд адаптирует ответы под DTO, фронтенд верстает интерфейсы под Port, а тестировщики готовят сценарии под Use-case.

## Пошаговая реализация

### Шаг 1. Описание контрактов в Domain

Контракты размещаются в `domain/{feature}/interface/`. Они не содержат логики, только типы и сигнатуры.

```typescript
// domain/users/interface/dto.ts
interface IUserDto {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

interface IUsersListDto {
  items: IUserDto[];
  total: number;
  page: number;
  limit: number;
}
```

```typescript
// domain/users/interface/port.ts
interface IGetUsersPort {
  page: number;
  limit: number;
  searchQuery?: string;
}
```

```typescript
// domain/users/interface/repository.ts
interface IUsersRepository {
  getUsersList(port: IGetUsersPort): Promise<IUsersListDto>;
}
```

```typescript
// domain/users/interface/use-case.ts
interface IGetUsersUseCase {
  execute(port: IGetUsersPort): Promise<IUsersListDto>;
}
```

### Шаг 2. Реализация бизнес-сценария (Use-case)

Use-case координирует вызов репозитория, применяет доменные правила и возвращает результат. Не знает о HTTP, кэше или UI.

```typescript
// domain/users/use-case/get-users.ts
import type { IGetUsersUseCase } from '../interface/use-case';
import type { IGetUsersPort } from '../interface/port';
import type { IUsersListDto } from '../interface/dto';
import type { IUsersRepository } from '../interface/repository';

class GetUsersUseCase implements IGetUsersUseCase {
  constructor(private readonly usersRepository: IUsersRepository) {}

  async execute(port: IGetUsersPort): Promise<IUsersListDto> {
    // Доменная валидация входных параметров
    if (port.page < 0 || port.limit <= 0) {
      throw new Error('Invalid pagination parameters');
    }

    // Делегирование инфраструктуре
    return this.usersRepository.getUsersList(port);
  }
}

export { GetUsersUseCase };
```

### Шаг 3. Инфраструктурная реализация (Data)

Слой `Data` реализует контракты `Domain`. Здесь происходит работа с сетью, маппинг ответов, обработка ошибок и ретраи.

```typescript
// data/repositories/users/users-repository.ts
import type { IUsersRepository } from '../../../domain/users/interface/repository';
import type { IGetUsersPort } from '../../../domain/users/interface/port';
import type { IUsersListDto } from '../../../domain/users/interface/dto';

class UsersRepository implements IUsersRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getUsersList(port: IGetUsersPort): Promise<IUsersListDto> {
    const response = await this.httpClient.get('/api/v1/users', {
      params: { page: port.page, limit: port.limit, q: port.searchQuery },
    });

    // Маппинг внешнего ответа в доменный DTO
    return {
      items: response.data.items.map((item: any) => ({
        id: item.id,
        fullName: `${item.first_name} ${item.last_name}`,
        email: item.email,
        avatarUrl: item.avatar_url || null,
      })),
      total: response.data.total_count,
      page: response.data.current_page,
      limit: response.data.per_page,
    };
  }
}

export { UsersRepository };
```

### Шаг 4. Интеграция в App-слой

В `App` use-case вызывается через адаптер запросов. Здесь управляется жизненный цикл данных: кэширование, статусы загрузки, пагинация UI, обработка ошибок сети.

```typescript
// app/modules/users/hooks/use-users-query.ts
import { useQuery } from '@tanstack/react-query';
import { GetUsersUseCase } from '../../../domain/users/use-case/get-users';
import { usersRepositoryInstance } from '../../../data/repositories/users/users-repository';

const useCase = new GetUsersUseCase(usersRepositoryInstance);

export function useUsersQuery(port: IGetUsersPort) {
  return useQuery({
    queryKey: ['users', port.page, port.limit, port.searchQuery],
    queryFn: () => useCase.execute(port),
    staleTime: 1000 * 60 * 5, // 5 минут
    retry: 1,
  });
}
```

### Шаг 5. Презентер и UI

Презентер агрегирует данные из запроса, управляет формой поиска/пагинации и подготавливает структуру для компонентов. UI остаётся «глупым» и отвечает только за отрисовку.

```typescript
// app/modules/users/presenters/users-presenter.ts
import { useState, useCallback } from 'react';
import { useUsersQuery } from '../hooks/use-users-query';

export function useUsersPresenter() {
  const [filters, setFilters] = useState<IGetUsersPort>({ page: 0, limit: 20 });
  const { data, isLoading, isError, refetch } = useUsersQuery(filters);

  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, page: 0, searchQuery: query }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  return {
    users: data?.items || [],
    total: data?.total || 0,
    isLoading,
    isError,
    filters,
    onSearch: handleSearch,
    onPageChange: handlePageChange,
    onRefresh: refetch,
  };
}
```

## Структура файлов фичи

```
src/
├── domain/
│   └── users/
│       ├── interface/
│       │   ├── dto.ts
│       │   ├── port.ts
│       │   ├── repository.ts
│       │   └── use-case.ts
│       └── use-case/
│           └── get-users.ts
├── data/
│   ── repositories/
│       └── users/
│           └── users-repository.ts
└── app/
    └── modules/
        └── users/
            ├── hooks/
            │   └── use-users-query.ts
            ├── presenters/
            │   └── users-presenter.ts
            ── components/
                ├── users-list.tsx
                └── users-filters.tsx
```

## Рекомендации по масштабированию

- **Сквозные концепции** (пагинация, сортировка, базовые DTO) выносятся в `domain/common` и переиспользуются между фичами
- **Базовые классы** для use-case и репозиториев уменьшают дублирование при добавлении новых сценариев (Create, Update, Delete)
- **Разделение Request и Presenter** упрощает тестирование: хук запроса проверяется на корректность ключей кэша и параметры, презентер — на логику агрегации и управление состоянием UI
- **Обработка ошибок** происходит на границе слоёв: инфраструктурные ошибки маппятся в пользовательские сообщения в `App`, доменные ошибки выбрасываются из `Domain` и перехватываются презентером

## Дальнейшее чтение

- [Слои архитектуры](../layers.md) — детальное описание зон ответственности
- [Управление состоянием](../cross-cutting/state-management) — границы клиентского и серверного состояния
- [Стандарты кода](../coding-standards.md) — правила нейминга, типизации и организации экспортов