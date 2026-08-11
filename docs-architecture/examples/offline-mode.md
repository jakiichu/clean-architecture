---
title: Пример — Оффлайн-режим
sidebar_position: 7
---

# Пример: Оффлайн-режим и деградация функциональности

Мобильное приложение должно предсказуемо работать при потере сети. Этот пример описывает **управляемую деградацию**: App показывает доступные кэшированные данные, предупреждает об их свежести, временно блокирует явно сетевые действия и корректно обрабатывает фактический отказ запроса.

Предварительный network status улучшает UX, но не гарантирует успех операции: соединение может исчезнуть после проверки. Источником истины остаётся результат Repository.

## Архитектурные решения

| Задача | Решение | Владелец |
|---|---|---|
| Показать состояние подключения | input adapter `NetInfo` → `INetworkStatus` | App |
| Преобразовать сетевой отказ запроса | HTTP/Data adapter → стабильный failure | Data |
| Загрузить уведомления | use case через `INotificationsRepository` | Domain |
| Хранить server-state в текущей сессии | TanStack Query | App |
| Восстановить query-cache после запуска | persister, подключённый в Composition Root | App + инфраструктурный адаптер |
| Решить, можно ли поставить mutation в очередь | отдельная продуктовая политика | Domain/Application |

## Шаг 1. Адаптер состояния сети для Presentation

Событие сети приходит от платформы к App, поэтому его можно нормализовать на presentation-границе. Сырой `NetInfoState` не распространяется дальше адаптера.

```typescript
// app/common/network/useNetworkStatus.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

interface INetworkStatus {
  readonly isOnline: boolean | null;
}

const useNetworkStatus = (): INetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((stateValue) => {
      const hasConnection = stateValue.isConnected === true;
      const hasInternet = stateValue.isInternetReachable !== false;
      setIsOnline(hasConnection && hasInternet);
    });
  }, []);

  return { isOnline };
};

export { useNetworkStatus };
export type { INetworkStatus };
```

Начальное значение `null` означает «ещё не определено». Нельзя оптимистично считать устройство online до первого события платформы.

## Шаг 2. Типизированный сетевой failure

Domain определяет устойчивый результат, который нужен его потребителю. Data преобразует ошибку конкретного HTTP-клиента на своей границе.

```typescript
// domain/common/errors/NetworkUnavailableError.ts
class NetworkUnavailableError extends Error {
  readonly code = 'network_unavailable';
}

export { NetworkUnavailableError };
```

```typescript
// data/http/mapHttpError.ts
const mapHttpError = (errorValue: unknown): Error => {
  if (isNetworkError(errorValue)) {
    return new NetworkUnavailableError();
  }

  return new UnexpectedInfrastructureError({ cause: errorValue });
};
```

`error.message` не используется как discriminant: текст зависит от библиотеки и версии SDK.

## Шаг 3. Composition Root

Repository и use cases создаются один раз в точке сборки. Feature-хуки получают готовые зависимости из application graph.

```typescript
// app/bootstrap/createApplication.ts
const notificationsRepository = createNotificationsRepository(httpClient, localDatabase);
const eventsRepository = createEventsRepository(httpClient);

const application = {
  notifications: {
    getNotifications: createGetNotificationsUseCase(notificationsRepository),
  },
  events: {
    checkIn: createCheckinUseCase(eventsRepository),
  },
};
```

## Шаг 4. Query с кэшированным fallback

```typescript
// app/modules/notifications/useNotificationsQuery.ts
const useNotificationsQuery = () => {
  const { notifications } = useApplicationDependencies();

  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS.LIST,
    queryFn: () => notifications.getNotifications.execute({ page: 0, limit: 50 }),
    staleTime: 5 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    networkMode: 'offlineFirst',
    retry: (failureCount, errorValue) => {
      if (errorValue instanceof NetworkUnavailableError) return false;
      return failureCount < 2;
    },
  });
};
```

`gcTime` удерживает неактивный query-cache только в памяти текущего процесса. Он не обеспечивает восстановление после перезапуска; для этого отдельно подключается persister.

View различает данные, ошибку и свежесть:

```tsx
const notificationsQuery = useNotificationsQuery();
const { isOnline } = useNetworkStatus();

{isOnline === false && notificationsQuery.data && (
  <OfflineBanner text="Нет подключения — показана доступная сохранённая версия" />
)}

{notificationsQuery.isError && !notificationsQuery.data && (
  <NotificationsErrorState failure={notificationsQuery.error} />
)}

<NotificationsList items={notificationsQuery.data?.items ?? []} />
```

Наличие `data` проверяется отдельно: отсутствие сети не означает, что кэш действительно существует.

## Шаг 5. Mutation

UI может временно отключить кнопку по network status, но use case всё равно запускается без прямого `NetInfo.fetch()` в `mutationFn`. Data обработает реальный сетевой отказ.

```typescript
const useCheckinMutation = () => {
  const { events } = useApplicationDependencies();

  return useMutation({
    mutationFn: (command: ICheckinCommand) => events.checkIn.execute(command),
    retry: 0,
  });
};
```

```tsx
const { isOnline } = useNetworkStatus();
const checkinMutation = useCheckinMutation();

<UIButton
  title="Зарегистрировать посещение"
  onPress={() => checkinMutation.mutate({ eventId, userId })}
  disabled={isOnline !== true || checkinMutation.isPending}
/>

{checkinMutation.error instanceof NetworkUnavailableError && (
  <Text>Подключитесь к интернету и повторите действие</Text>
)}
```

Если продукт требует принять действие без сети, это уже offline-first mutation: необходимы очередь, идемпотентный идентификатор, синхронизация и политика конфликтов. Простая проверка `isOnline` такую систему не заменяет.

## Шаг 6. Persisted query-cache

Инфраструктурный persister скрывает `AsyncStorage`, а Composition Root подключает его к presentation query-cache:

```typescript
// data/storage/createQueryCachePersister.ts
const createQueryCachePersister = () => createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'app-query-cache-v1',
  throttleTime: 1_000,
});
```

```tsx
// app/bootstrap/RootProviders.tsx
const queryPersister = createQueryCachePersister();

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister: queryPersister }}
>
  <ApplicationProvider value={application}>{children}</ApplicationProvider>
</PersistQueryClientProvider>
```

Импорт Data здесь допустим: `RootProviders` является частью Composition Root. Feature-компоненты и хуки конкретные реализации Data не импортируют.

Persisted query-cache должен иметь `maxAge`, версию/buster и правила фильтрации. Токены, PIN, биометрические данные и другая чувствительная информация в него не помещаются.

## Управляемая деградация и offline-first

| Управляемая деградация | Offline-first |
|---|---|
| показывает ранее полученные данные | локальная база является рабочим источником |
| mutation может быть недоступна | mutation записывается локально |
| очереди синхронизации нет | есть очередь, retry/backoff и idempotency |
| конфликты не разрешаются | определена стратегия конфликтов |

## Чек-лист

- [ ] Platform state нормализуется в App-адаптере и не выдаёт сырой SDK-тип.
- [ ] Начальное состояние сети выражено как unknown, а не как ложный online.
- [ ] Data преобразует сетевую ошибку в стабильный failure.
- [ ] Retry не сравнивает `error.message`.
- [ ] Repository и use cases создаются в Composition Root.
- [ ] `gcTime` не описывается как persistence между запусками.
- [ ] UI проверяет наличие cached data отдельно от network status.
- [ ] Предварительная блокировка кнопки не считается гарантией результата.
- [ ] Persisted cache имеет срок, версию и фильтрацию чувствительных данных.
- [ ] Offline mutation не заявляется без очереди, idempotency и conflict policy.

## Дальнейшее чтение

- [Платформенные адаптеры](../cross-cutting/platform-adapters.md) — направление событий и lifecycle подписок.
- [Управление состоянием](../cross-cutting/state-management.md) — Server State и persistent state.
- [Обработка ошибок](../error-handling.md) — retry, fallback и типизированные failures.
- [Внедрение зависимостей](../cross-cutting/di.md) — Composition Root и application graph.
