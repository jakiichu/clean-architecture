---
title: Пример — Получение данных (GET)
sidebar_position: 2
---

# Пример: Получение данных (GET)

В данном разделе разобран пошаговый подход к созданию функциональной единицы, отвечающей за получение данных с сервера. Пример демонстрирует, как архитектурные принципы Clean Architecture применяются на практике: от описания контрактов в `Domain` до интеграции с UI-слоем в `App`.

Приведены два варианта: **универсальный** (список пользователей) и **мобильный** (лента уведомлений с пагинацией и FlatList).

## Почему разработка начинается с Domain

Слой `Domain` является архитектурным ядром. Именно здесь фиксируется «язык» системы: сущности, сценарии и правила взаимодействия. Начало разработки с `Domain` гарантирует:

- Бизнес-логика не подстраивается под возможности UI или особенности HTTP-клиента
- Контракты становятся точкой согласования между фронтенд, бэкенд и мобильными командами
- Инфраструктурные детали (кэширование, ретраи, маппинг ответов) изолируются и заменяются без влияния на ядро
- Use-case покрываются unit-тестами в изоляции от сети и устройства

## Контракты важнее реализации

Перед написанием кода фиксируются интерфейсы, которые будут связывать слои:

1. **DTO** — формат данных, возвращаемый бизнес-сценарием
2. **Port** — входные параметры use-case
3. **Repository Interface** — абстракция доступа к источнику данных
4. **Use-case Interface** — контракт бизнес-сценария

---

## Вариант 1: Универсальный пример (список пользователей)

### Шаг 1. Описание контрактов в Domain

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

```typescript
// domain/users/use-case/get-users.ts
class GetUsersUseCase implements IGetUsersUseCase {
  constructor(private readonly usersRepository: IUsersRepository) {}

  async execute(port: IGetUsersPort): Promise<IUsersListDto> {
    if (port.page < 0 || port.limit <= 0) {
      throw new InvalidPaginationError();
    }
    return this.usersRepository.getUsersList(port);
  }
}

export { GetUsersUseCase };
```

### Шаг 3. Инфраструктурная реализация (Data)

```typescript
// data/repositories/users/users-repository.ts
class UsersRepository implements IUsersRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getUsersList(port: IGetUsersPort): Promise<IUsersListDto> {
    const response = await this.httpClient.get('/api/v1/users', {
      params: { page: port.page, limit: port.limit, q: port.searchQuery },
    });

    return {
      items: response.data.items.map((item: unknown) => ({
        id: (item as any).id,
        fullName: `${(item as any).first_name} ${(item as any).last_name}`,
        email: (item as any).email,
        avatarUrl: (item as any).avatar_url ?? null,
      })),
      total: response.data.total_count,
      page: response.data.current_page,
      limit: response.data.per_page,
    };
  }
}

export { UsersRepository };
```

### Шаг 4. Хук в App

```typescript
// app/modules/users/hooks/use-users-query.ts
import { useQuery } from '@tanstack/react-query';
import { useApplicationDependencies } from '../../../app/providers/ApplicationProvider';

export function useUsersQuery(port: IGetUsersPort) {
  const { users } = useApplicationDependencies();

  return useQuery({
    queryKey: ['users', port.page, port.limit, port.searchQuery],
    queryFn: () => users.getUsers.execute(port),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
```

---

## Вариант 2: Мобильный пример — Лента уведомлений

Этот пример ближе к реальному мобильному приложению: лента уведомлений с FlatList, pull-to-refresh и индикатором непрочитанных.

### Шаг 1. Контракты в Domain

```typescript
// domain/notifications/entities/INotification.ts
type TNotificationPriority = 'low' | 'normal' | 'high';

interface INotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  priority: TNotificationPriority;
  createdAtTimestamp: number;
}

interface INotificationsListDto {
  items: INotification[];
  total: number;
  unreadCount: number;
}

export type { INotification, INotificationsListDto, TNotificationPriority };
```

```typescript
// domain/notifications/interfaces/INotificationsRepository.ts
interface IGetNotificationsPort {
  page: number;
  limit: number;
  onlyUnread?: boolean;
}

interface INotificationsRepository {
  getNotifications: (port: IGetNotificationsPort) => Promise<INotificationsListDto>;
}

export type { INotificationsRepository, IGetNotificationsPort };
```

```typescript
// domain/notifications/use-cases/GetNotificationsUseCase.ts
import type { INotificationsRepository, IGetNotificationsPort } from '../interfaces/INotificationsRepository';
import type { INotificationsListDto } from '../entities/INotification';

const createGetNotificationsUseCase = (repository: INotificationsRepository) => {
  const execute = async (port: IGetNotificationsPort): Promise<INotificationsListDto> => {
    if (port.limit <= 0 || port.limit > 100) {
      throw new InvalidPaginationError();
    }
    return repository.getNotifications(port);
  };

  return { execute };
};

export { createGetNotificationsUseCase };
```

### Шаг 2. Репозиторий в Data

```typescript
// data/repositories/NotificationsRepository.ts
import type { INotificationsRepository, IGetNotificationsPort } from '@domain/notifications/interfaces/INotificationsRepository';
import type { INotificationsListDto, TNotificationPriority } from '@domain/notifications/entities/INotification';
import { axiosInstance } from '@data/instance/AxiosInstance';

// Внутренний тип ответа API — не экспортируется
interface INotificationsApiResponse {
  data: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    priority: string;
    created_at: string;
  }>;
  meta: {
    total: number;
    unread_count: number;
  };
}

class NotificationsRepository implements INotificationsRepository {
  async getNotifications(port: IGetNotificationsPort): Promise<INotificationsListDto> {
    const responseValue = await axiosInstance.get<INotificationsApiResponse>('/notifications', {
      params: {
        page: port.page,
        per_page: port.limit,
        unread_only: port.onlyUnread ?? false,
      },
    });

    return {
      items: responseValue.data.data.map((apiItem) => ({
        id: apiItem.id,
        title: apiItem.title,
        body: apiItem.message,
        isRead: apiItem.read,
        priority: apiItem.priority as TNotificationPriority,
        createdAtTimestamp: new Date(apiItem.created_at).getTime(),
      })),
      total: responseValue.data.meta.total,
      unreadCount: responseValue.data.meta.unread_count,
    };
  }
}

export { NotificationsRepository };
```

### Шаг 3. Хук в App с pull-to-refresh

```typescript
// src/common/hooks/useNotificationsQuery.ts
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/common/const/queryKeys';
import { useApplicationDependencies } from '@/app/providers/ApplicationProvider';

const useNotificationsQuery = (onlyUnread = false) => {
  const { notifications } = useApplicationDependencies();

  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS.LIST(onlyUnread),
    queryFn: () => notifications.getNotifications.execute({ page: 0, limit: 50, onlyUnread }),
    staleTime: 1000 * 60 * 2, // 2 минуты — уведомления меняются чаще
    gcTime: 1000 * 60 * 30,
  });
};

export { useNotificationsQuery };
```

### Шаг 4. Презентер с логикой фильтрации

```typescript
// app/modules/notifications/useNotificationsPresenter.ts
import { useState, useCallback } from 'react';
import { useNotificationsQuery } from '@/common/hooks/useNotificationsQuery';

const useNotificationsPresenter = () => {
  const [showOnlyUnread, setShowOnlyUnread] = useState<boolean>(false);
  const { data, isLoading, isError, refetch, isFetching } = useNotificationsQuery(showOnlyUnread);

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const handleToggleFilter = useCallback(() => {
    setShowOnlyUnread((prev) => !prev);
  }, []);

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    total: data?.total ?? 0,
    isLoading,
    isRefreshing: isFetching && !isLoading,
    isError,
    showOnlyUnread,
    onRefresh: handleRefresh,
    onToggleFilter: handleToggleFilter,
  };
};

export { useNotificationsPresenter };
```

### Шаг 5. Компонент — FlatList с pull-to-refresh

```tsx
// app/modules/notifications/NotificationsScreen.tsx
import React from 'react';
import { View, FlatList, RefreshControl, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotificationsPresenter } from './useNotificationsPresenter';

export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    isError,
    showOnlyUnread,
    onRefresh,
    onToggleFilter,
  } = useNotificationsPresenter();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        {/* Skeleton-плейсхолдеры для структурированного списка */}
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Не удалось загрузить уведомления</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Фильтр непрочитанных */}
      <View style={styles.filterRow}>
        <TouchableOpacity onPress={onToggleFilter} style={styles.filterButton}>
          <Text style={styles.filterLabel}>
            {showOnlyUnread ? 'Показать все' : `Непрочитанные (${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.isRead && styles.cardUnread]}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {showOnlyUnread ? 'Все уведомления прочитаны' : 'Нет уведомлений'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  filterRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  filterButton: { alignSelf: 'flex-start' },
  filterLabel: { color: '#007AFF', fontSize: 14 },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cardUnread: { backgroundColor: '#f0f6ff' },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardBody: { fontSize: 14, color: '#555' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 48, fontSize: 15 },
  skeleton: { height: 72, backgroundColor: '#f0f0f0', borderRadius: 8, marginHorizontal: 16, marginVertical: 6 },
  errorText: { fontSize: 15, color: '#333', marginBottom: 12, textAlign: 'center' },
  retryText: { color: '#007AFF', fontSize: 15 },
});
```

## Структура файлов фичи (мобильный вариант)

```
domain/notifications/
├── entities/
│   └── INotification.ts
├── interfaces/
│   └── INotificationsRepository.ts
└── use-cases/
    └── GetNotificationsUseCase.ts

data/repositories/
└── NotificationsRepository.ts

src/common/hooks/
└── useNotificationsQuery.ts

app/modules/notifications/
├── useNotificationsPresenter.ts
└── NotificationsScreen.tsx
```

## Рекомендации по масштабированию

- **Сквозные концепции** (пагинация, базовые DTO) выносятся в `domain/common` и переиспользуются между фичами
- **Бесконечная прокрутка** реализуется через `useInfiniteQuery` при необходимости; use-case и репозиторий не меняются, только хук в App
- **Разделение хука запроса и презентера** упрощает тестирование: хук проверяется на корректность ключей кэша, презентер — на логику фильтрации и агрегации
- **Skeleton вместо Spinner** — для структурированных списков предпочтительнее показывать заглушки нужного размера, а не центральный спиннер

## Дальнейшее чтение

- [Слои архитектуры](../layers.md) — зоны ответственности
- [Управление состоянием](../cross-cutting/state-management.md) — Server State vs. UI State
- [Пример мутации (POST)](./feature-post.md) — операции изменения данных
- [Оффлайн-режим](./offline-mode.md) — кэш при отсутствии сети
