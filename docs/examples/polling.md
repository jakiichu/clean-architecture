---
title: Пример — Polling и таймер обратного отсчёта
sidebar_position: 6
---

# Пример: Polling и таймер обратного отсчёта

Данный пример демонстрирует паттерн автоматического обновления данных через фиксированный интервал (`refetchInterval`) в сочетании с таймером обратного отсчёта в UI. Это типичный сценарий для мобильных приложений, где данные имеют ограниченный срок жизни: одноразовые коды (OTP), биржевые котировки, статусы живой очереди, временные сессионные токены.

Ключевое правило: **таймер, интервал и состояние загрузки живут в `App`**. Алгоритм генерации, правила валидности и срок жизни — в `Domain`.

## Постановка задачи

Приложение показывает пользователю одноразовый код подтверждения. Требования:
1. Код запрашивается с сервера и действителен 30 секунд
2. По истечении срока код автоматически обновляется
3. UI показывает обратный отсчёт оставшегося времени
4. Конфигурация (например, срок жизни кода) кэшируется на длительный период — не запрашивается заново при каждой ротации
5. В фоновом режиме ротация останавливается для экономии батареи

## Шаг 1. Контракты в Domain

```typescript
// domain/otp/entities/IOtpCode.ts
interface IOtpCode {
  code: string;
  expiresAtTimestamp: number;
  isValid: boolean;
}

export type { IOtpCode };
```

```typescript
// domain/otp/entities/IOtpConfig.ts
interface IOtpConfig {
  lifetimeSeconds: number;
  length: number;
}

export type { IOtpConfig };
```

```typescript
// domain/otp/interfaces/IOtpRepository.ts
interface IOtpRepository {
  fetchCurrentCode: () => Promise<IOtpCode>;
  fetchConfig: () => Promise<IOtpConfig>;
}

export type { IOtpRepository };
```

```typescript
// domain/otp/use-cases/GetOtpCodeUseCase.ts
import type { IOtpRepository } from '../interfaces/IOtpRepository';
import type { IOtpCode } from '../entities/IOtpCode';

const createGetOtpCodeUseCase = (repository: IOtpRepository) => {
  const execute = async (): Promise<IOtpCode> => {
    const otpCode = await repository.fetchCurrentCode();

    if (!otpCode.code || otpCode.expiresAtTimestamp <= Date.now()) {
      throw new Error('Received an already expired code');
    }

    return otpCode;
  };

  return { execute };
};

export { createGetOtpCodeUseCase };
```

## Шаг 2. Реализация в Data

```typescript
// data/repositories/OtpRepository.ts
import type { IOtpRepository } from '@domain/otp/interfaces/IOtpRepository';
import type { IOtpCode } from '@domain/otp/entities/IOtpCode';
import type { IOtpConfig } from '@domain/otp/entities/IOtpConfig';
import { axiosInstance } from '@data/instance/AxiosInstance';

interface IOtpApiResponse {
  code: string;
  expires_at: string;
}

interface IOtpConfigApiResponse {
  lifetime_seconds: number;
  code_length: number;
}

class OtpRepository implements IOtpRepository {
  async fetchCurrentCode(): Promise<IOtpCode> {
    const responseValue = await axiosInstance.get<IOtpApiResponse>('/otp/current');

    return {
      code: responseValue.data.code,
      expiresAtTimestamp: new Date(responseValue.data.expires_at).getTime(),
      isValid: true,
    };
  }

  async fetchConfig(): Promise<IOtpConfig> {
    const responseValue = await axiosInstance.get<IOtpConfigApiResponse>('/otp/config');

    return {
      lifetimeSeconds: responseValue.data.lifetime_seconds,
      length: responseValue.data.code_length,
    };
  }
}

export { OtpRepository };
```

## Шаг 3. Хук в App с polling и таймером

Ключевой элемент паттерна: два отдельных `useQuery` с разными `staleTime`. Первый кэширует конфигурацию на 24 часа. Второй обновляет код каждые 30 секунд, но только когда есть конфигурация (`enabled: !!configQuery.data`).

```typescript
// src/common/hooks/useOtpQuery.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { OtpRepository } from '@data/repositories/OtpRepository';
import { createGetOtpCodeUseCase } from '@domain/otp/use-cases/GetOtpCodeUseCase';
import { QUERY_KEYS } from '@/common/const/queryKeys';

const CODE_ROTATION_INTERVAL_MS = 30_000;
const CONFIG_CACHE_MS = 24 * 60 * 60 * 1_000;

// Создаём экземпляры вне хука — они не зависят от React-контекста
const repositoryInstance = new OtpRepository();
const useCaseInstance = createGetOtpCodeUseCase(repositoryInstance);

const useOtpQuery = () => {
  const queryClientInstance = useQueryClient();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    CODE_ROTATION_INTERVAL_MS / 1_000
  );
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Запрос конфигурации (кэшируется на 24 часа)
  const configQuery = useQuery({
    queryKey: QUERY_KEYS.OTP.CONFIG,
    queryFn: () => repositoryInstance.fetchConfig(),
    staleTime: CONFIG_CACHE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Запрос кода (обновляется каждые 30 сек)
  const otpQuery = useQuery({
    queryKey: QUERY_KEYS.OTP.CURRENT,
    queryFn: () => useCaseInstance.execute(),
    enabled: !!configQuery.data,
    refetchInterval: CODE_ROTATION_INTERVAL_MS,
    refetchIntervalInBackground: false, // Экономия заряда батареи
  });

  // Таймер обратного отсчёта — только UI, не бизнес-логика
  useEffect(() => {
    if (!otpQuery.data) return;

    const updateCountdown = () => {
      const nowMs: number = Date.now();
      const expiresAt: number = otpQuery.data?.expiresAtTimestamp ?? nowMs;
      const remainingSeconds: number = Math.max(0, Math.ceil((expiresAt - nowMs) / 1_000));

      setSecondsRemaining(remainingSeconds);

      if (remainingSeconds <= 0) {
        queryClientInstance.invalidateQueries({ queryKey: QUERY_KEYS.OTP.CURRENT });
      }
    };

    countdownIntervalRef.current = setInterval(updateCountdown, 1_000);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [otpQuery.data, queryClientInstance]);

  return {
    otpCode: otpQuery.data,
    secondsRemaining,
    isLoading: otpQuery.isLoading || configQuery.isLoading,
    isError: otpQuery.isError || configQuery.isError,
    error: otpQuery.error ?? configQuery.error,
  };
};

export { useOtpQuery };
```

## Шаг 4. UI-компонент

```tsx
// app/modules/otp/OtpScreen.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useOtpQuery } from '@/common/hooks/useOtpQuery';

export default function OtpScreen() {
  const { otpCode, secondsRemaining, isLoading, isError } = useOtpQuery();

  if (isLoading) {
    return <ActivityIndicator size="large" />;
  }

  if (isError) {
    return <Text style={styles.errorText}>Не удалось получить код. Проверьте подключение.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.codeLabel}>Ваш код подтверждения</Text>

      <Text style={styles.codeValue}>{otpCode?.code}</Text>

      {/* Таймер обратного отсчёта */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>Обновится через {secondsRemaining} с.</Text>
        <View style={[styles.timerBar, { width: `${(secondsRemaining / 30) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  codeLabel: { fontSize: 16, color: '#666', marginBottom: 8 },
  codeValue: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, marginBottom: 24 },
  timerContainer: { width: '100%', alignItems: 'center' },
  timerText: { fontSize: 14, color: '#999', marginBottom: 4 },
  timerBar: { height: 4, backgroundColor: '#007AFF', borderRadius: 2 },
  errorText: { color: '#FF3B30', textAlign: 'center', padding: 24 },
});
```

## Разбор ключевых решений

### Два запроса с разным staleTime

| Запрос | staleTime | Причина |
|--------|-----------|---------|
| Конфигурация | 24 часа | Параметры стабильны, лишние запросы нагружают сервер |
| Код | 0 (всегда stale) | Код уникален при каждом получении, кэш бессмысленен |

### Зависимость между запросами через `enabled`

Второй запрос активируется только при наличии данных из первого: `enabled: !!configQuery.data`. Это предотвращает гонку состояний и ненужные запросы с неполными параметрами.

### Таймер vs. refetchInterval

`refetchInterval` — серверная сторона ротации. `setInterval` в `useEffect` — UI-сторона обратного отсчёта. Это разные ответственности:
- Если `refetchInterval` обновляет данные → таймер сбрасывается через пересоздание `useEffect` (т.к. меняется `otpQuery.data`)
- `refetchIntervalInBackground: false` гарантирует, что в фоне ротация не происходит

### Инвалидация при исчерпании таймера

При достижении нуля таймер вручную инвалидирует ключ кэша. Это страховка на случай, если `refetchInterval` сработал с задержкой или пропустил цикл.

## Чек-лист паттерна

- [ ] Бизнес-логика (валидность кода, срок жизни) изолирована в Domain use-case
- [ ] Конфигурация кэшируется отдельным запросом с большим staleTime
- [ ] Ротация управляется через `refetchInterval`, не через ручной `setInterval` для запросов
- [ ] `refetchIntervalInBackground: false` для экономии батареи
- [ ] Таймер обратного отсчёта — UI State, управляется через `setInterval` в `useEffect`
- [ ] При `secondsRemaining === 0` — ручная инвалидация кэша как страховка

## Адаптация паттерна

Тот же паттерн применяется для других типов данных с TTL:

| Сценарий | Медленный запрос (долгий кэш) | Быстрый запрос (polling) |
|----------|-------------------------------|--------------------------|
| OTP-коды | Конфигурация срока жизни | Текущий код (30 сек) |
| Котировки | Список торговых пар | Цены (5–15 сек) |
| Статус очереди | Параметры очереди | Позиция (10–30 сек) |
| Активная сессия | Метаданные пользователя | Статус сессии (60 сек) |

## Дальнейшее чтение

- [Управление состоянием](../cross-cutting/state-management.md) — Server State vs. UI State
- [Интеграция нативных модулей](./native-integration.md) — адаптеры для нативных зависимостей
- [Обработка ошибок](../error-handling.md) — поведение при недоступности сервера
