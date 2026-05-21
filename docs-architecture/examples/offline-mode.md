---
title: Пример — Оффлайн-режим
sidebar_position: 8
---

# Пример: Оффлайн-режим и деградация функциональности

Мобильные приложения должны работать предсказуемо при потере сети. Полная поддержка оффлайна (синхронизация очереди запросов, локальная БД) — сложная задача. Данный пример описывает **управляемую деградацию**: приложение показывает кэшированные данные, блокирует сетевые операции с понятными сообщениями и восстанавливается автоматически при появлении сети.

## Архитектурные решения

| Задача | Решение | Слой |
|--------|---------|------|
| Определение состояния сети | `NetInfo` + Zustand | App |
| Кэш данных при оффлайне | TanStack Query `gcTime` | App |
| Блокировка мутаций при оффлайне | Проверка в `mutationFn` | App |
| Persistентный кэш между запусками | `AsyncStorage` адаптер | Data |
| Определение, что операция требует сети | Флаг в Domain-интерфейсе | Domain |

## Шаг 1. Хук отслеживания состояния сети

```typescript
// src/common/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface INetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

const useNetworkStatus = (): INetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<INetworkStatus>({
    isOnline: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribeCallback = NetInfo.addEventListener((stateValue: NetInfoState) => {
      setNetworkStatus({
        isOnline: stateValue.isConnected ?? false,
        isInternetReachable: stateValue.isInternetReachable,
      });
    });

    return unsubscribeCallback;
  }, []);

  return networkStatus;
};

export { useNetworkStatus };
```

## Шаг 2. Показ кэшированных данных при оффлайне

TanStack Query хранит данные в памяти пока `gcTime` не истёк. При оффлайне старые данные помечаются как `isStale`, но всё равно отображаются. Компонент получает флаг и показывает баннер.

```typescript
// src/common/hooks/useNotificationsQuery.ts
import { useQuery } from '@tanstack/react-query';
import { createNotificationsRepository } from '@data/repositories';
import { createGetNotificationsUseCase } from '@domain/notifications/use-cases';
import { QUERY_KEYS } from '@/common/const/queryKeys';

const repositoryInstance = createNotificationsRepository();
const useCaseInstance = createGetNotificationsUseCase(repositoryInstance);

const useNotificationsQuery = () => {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS.LIST,
    queryFn: () => useCaseInstance.execute({ page: 0, limit: 50 }),
    staleTime: 1000 * 60 * 5,     // 5 минут — данные свежие
    gcTime: 1000 * 60 * 60 * 24,  // 24 часа — кэш живёт в памяти
    retry: (failureCount, error) => {
      // Не повторяем при отсутствии сети — бессмысленно
      if (error.message === 'Network Error') return false;
      return failureCount < 2;
    },
  });
};

export { useNotificationsQuery };
```

```tsx
// app/modules/notifications/components/NotificationsScreen.tsx
import { useNotificationsQuery } from '@/common/hooks/useNotificationsQuery';
import { useNetworkStatus } from '@/common/hooks/useNetworkStatus';

export default function NotificationsScreen() {
  const { data, isLoading, isStale } = useNotificationsQuery();
  const { isOnline } = useNetworkStatus();

  return (
    <View>
      {/* Баннер оффлайн-режима */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Нет подключения — показаны сохранённые данные
          </Text>
        </View>
      )}

      {/* Пометка об устаревших данных при наличии сети */}
      {isOnline && isStale && (
        <Text style={styles.staleHint}>Данные обновляются...</Text>
      )}

      {isLoading && !data && <ActivityIndicator />}

      <FlatList
        data={data?.items}
        renderItem={({ item }) => <NotificationCard notification={item} />}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
```

## Шаг 3. Блокировка мутаций при оффлайне

Действия, которые требуют сети, должны быть заблокированы с понятным сообщением. Проверка происходит в `mutationFn` перед вызовом use-case.

```typescript
// src/common/hooks/useCheckinMutation.ts
import { useMutation } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { createCheckinUseCase } from '@domain/events/use-cases';
import { createEventsRepository } from '@data/repositories';

const repositoryInstance = createEventsRepository();
const useCaseInstance = createCheckinUseCase(repositoryInstance);

const useCheckinMutation = () => {
  return useMutation({
    mutationFn: async (params: { eventId: string; userId: string }) => {
      // Явная проверка перед мутацией
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        throw new Error('NO_NETWORK');
      }

      return useCaseInstance.execute(params);
    },
    retry: 0, // Мутации не повторяем при ошибке сети — пользователь должен повторить вручную
  });
};

export { useCheckinMutation };
```

```tsx
// Компонент с блокировкой кнопки
const { isOnline } = useNetworkStatus();
const checkinMutation = useCheckinMutation();

<UIButton
  title="Зарегистрировать посещение"
  onPress={() => checkinMutation.mutate({ eventId, userId })}
  disabled={!isOnline || checkinMutation.isPending}
/>
{!isOnline && (
  <Text>Регистрация недоступна в оффлайн-режиме</Text>
)}
{checkinMutation.error?.message === 'NO_NETWORK' && (
  <Text>Подключитесь к интернету и повторите</Text>
)}
```

## Шаг 4. Persistентный кэш через AsyncStorage

Чтобы кэш переживал перезапуск приложения, используют `persister` для TanStack Query. Данные сериализуются в `AsyncStorage`.

```typescript
// data/storage/QueryCachePersister.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const CACHE_KEY = 'app-query-cache-v1';

const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  throttleTime: 1000, // Не чаще раза в секунду
});

export { queryPersister };
```

```typescript
// app/_layout.tsx (подключение persister)
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister } from '@data/storage/QueryCachePersister';

const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 часа — кэш живёт после закрытия
    },
  },
});

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClientInstance}
      persistOptions={{ persister: queryPersister }}
    >
      {/* ... */}
    </PersistQueryClientProvider>
  );
}
```

**Важно:** не все данные следует кэшировать между перезапусками. Критичные для безопасности данные (токены, ключи) хранятся только в SecureStore, никогда в AsyncStorage.

## Шаг 5. Конфигурация TanStack Query для оффлайн-сценариев

```typescript
// Глобальная конфигурация с учётом оффлайна
const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 минут свежести
      gcTime: 1000 * 60 * 60 * 24,  // 24 часа хранения кэша
      retry: (failureCount, error) => {
        if ((error as Error).message === 'Network Error') return false;
        return failureCount < 2;
      },
      networkMode: 'offlineFirst', // Сначала кэш, потом сеть
    },
    mutations: {
      networkMode: 'online', // Мутации только при сети
      retry: 0,
    },
  },
});
```

## Что не следует кэшировать оффлайн

| Данные | Почему не кэшировать |
|--------|---------------------|
| Токены сессии, PIN, биометрический токен | Хранятся в SecureStore, не в кэше запросов |
| Результаты use-case (валиден ли токен, разрешено ли действие) | Зависят от времени и контекста, кэш даст неверный ответ |
| Персональные данные с ограниченным сроком | Требуют шифрования, AsyncStorage — открытый текст |
| Статусы, требующие real-time актуальности | Будут вводить пользователя в заблуждение |

## Деградация vs. Оффлайн-first

**Управляемая деградация** (описана в этом документе):
- Показывает кэшированные данные с пометкой
- Блокирует мутации с объяснением
- Не требует специального синхронизатора

**Оффлайн-first** (для более сложных сценариев):
- Очередь мутаций, отложенная синхронизация
- Конфликты при параллельных изменениях
- Требует WatermelonDB / SQLite + background sync
- Оправдан для полевых задач (инспекции, акты, заявки без сети)

## Чек-лист оффлайн-режима

- [ ] `gcTime` настроен на достаточно долгий период для оффлайн-использования
- [ ] Компоненты показывают баннер при `!isOnline`
- [ ] Мутации проверяют наличие сети перед вызовом use-case
- [ ] Ошибка `NO_NETWORK` отображается явным сообщением, а не техническим текстом
- [ ] Persistентный кэш не хранит чувствительные данные (токены, ключи)
- [ ] `networkMode: 'offlineFirst'` для чтения, `'online'` для записи

## Дальнейшее чтение

- [Управление состоянием](../cross-cutting/state-management.md) — Server State и его жизненный цикл
- [Обработка ошибок](../error-handling.md) — стратегии retry и fallback
- [Пример polling](./polling.md) — `refetchIntervalInBackground: false` для экономии в оффлайне
