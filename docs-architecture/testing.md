---
title: Стратегия тестирования
sidebar_position: 8
---

# Стратегия тестирования

Чистая архитектура создаёт естественные границы для тестирования: каждый слой тестируется отдельно, с минимальным количеством заглушек (моков). Бизнес-логика в `Domain` полностью изолирована от сети и ОС, поэтому покрывается простыми unit-тестами. Инфраструктурный код в `Data` проверяется на корректность маппинга и поведение в граничных случаях. Слой `App` тестируется на уровне взаимодействия компонентов с пользователем.

## Пирамида тестирования

```
           [E2E тесты]
          Detox / Maestro
          Полные сценарии

       [Интеграционные тесты]
      React Testing Library
    Компоненты + хуки + запросы

  [Unit-тесты] ← 80% покрытия здесь
Domain: use-case, validators, mappers
```

Большинство тестов должны быть на уровне `Domain`. Они быстрые, не требуют устройства и не зависят от сетевых условий.

## Тестирование слоя Domain

Domain-слой тестируется в полной изоляции. Зависимости (репозитории, провайдеры) заменяются простыми заглушками.

### Пример: тест use-case получения одноразового кода

```typescript
// domain/otp/use-cases/__tests__/GetOtpCodeUseCase.test.ts
import { createGetOtpCodeUseCase } from '../GetOtpCodeUseCase';
import type { IOtpRepository } from '../../interfaces/IOtpRepository';

const createMockOtpRepository = (overrides?: Partial<IOtpRepository>): IOtpRepository => ({
  fetchCurrentCode: async () => ({
    code: '482910',
    expiresAtTimestamp: Date.now() + 30_000,
    isValid: true,
  }),
  fetchConfig: async () => ({ lifetimeSeconds: 30, length: 6 }),
  ...overrides,
});

describe('GetOtpCodeUseCase', () => {
  it('возвращает валидный код с временем жизни в будущем', async () => {
    const useCaseInstance = createGetOtpCodeUseCase(createMockOtpRepository());

    const resultValue = await useCaseInstance.execute();

    expect(resultValue.code).toBe('482910');
    expect(resultValue.isValid).toBe(true);
    expect(resultValue.expiresAtTimestamp).toBeGreaterThan(Date.now());
  });

  it('выбрасывает ошибку, если сервер вернул уже истёкший код', async () => {
    const useCaseInstance = createGetOtpCodeUseCase(
      createMockOtpRepository({
        fetchCurrentCode: async () => ({
          code: '000000',
          expiresAtTimestamp: Date.now() - 1_000,
          isValid: false,
        }),
      })
    );

    await expect(useCaseInstance.execute()).rejects.toThrow('Received an already expired code');
  });
});
```

### Пример: тест use-case валидации SMS-кода

```typescript
// domain/auth/use-cases/__tests__/VerifySmsCodeUseCase.test.ts
import { createVerifySmsCodeUseCase } from '../verifySmsCodeUseCase';
import type { IAuthRepository } from '../../interfaces/IAuthRepository';

const createMockAuthRepository = (overrides?: Partial<IAuthRepository>): IAuthRepository => ({
  sendActivationSmsCode: jest.fn().mockResolvedValue(undefined),
  verifyActivationSmsCode: jest.fn().mockResolvedValue({
    sessionToken: 'token-xyz',
    userGuid: 'user-001',
  }),
  invalidateUserSession: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('VerifySmsCodeUseCase', () => {
  it('возвращает сессию при корректном коде', async () => {
    const mockRepoInstance = createMockAuthRepository();
    const useCaseInstance = createVerifySmsCodeUseCase({ authRepository: mockRepoInstance });

    const sessionResult = await useCaseInstance.execute({
      phoneNumber: '+79001234567',
      smsCode: '123456',
    });

    expect(sessionResult.sessionToken).toBe('token-xyz');
    expect(mockRepoInstance.verifyActivationSmsCode).toHaveBeenCalledTimes(1);
  });

  it('пробрасывает ошибку репозитория при неверном коде', async () => {
    const mockRepoInstance = createMockAuthRepository({
      verifyActivationSmsCode: jest.fn().mockRejectedValue(new Error('Invalid SMS code')),
    });
    const useCaseInstance = createVerifySmsCodeUseCase({ authRepository: mockRepoInstance });

    await expect(
      useCaseInstance.execute({ phoneNumber: '+79001234567', smsCode: '000000' })
    ).rejects.toThrow('Invalid SMS code');
  });
});
```

## Тестирование слоя Data

Слой `Data` тестируется на корректность маппинга и обработку ошибочных ответов сервера. HTTP-клиент мокируется через `jest.mock` или `axios-mock-adapter`.

### Пример: тест репозитория (маппинг ответа)

```typescript
// data/repositories/__tests__/AuthRepository.test.ts
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AuthRepository } from '../AuthRepository';

describe('AuthRepository.verifyActivationSmsCode', () => {
  let axiosMockInstance: MockAdapter;

  beforeEach(() => {
    axiosMockInstance = new MockAdapter(axios);
  });

  afterEach(() => {
    axiosMockInstance.restore();
  });

  it('маппит серверный ответ в IAuthSessionResult', async () => {
    axiosMockInstance.onPost('/auth/verify').reply(200, {
      session_token: 'srv-token',
      user_guid: 'srv-user-001',
    });

    const repositoryInstance = new AuthRepository();
    const resultValue = await repositoryInstance.verifyActivationSmsCode(
      '+79001234567',
      '123456'
    );

    expect(resultValue.sessionToken).toBe('srv-token');
    expect(resultValue.userGuid).toBe('srv-user-001');
  });

  it('выбрасывает ошибку при 401 (неверный код)', async () => {
    axiosMockInstance.onPost('/auth/verify').reply(401);

    const repositoryInstance = new AuthRepository();
    await expect(
      repositoryInstance.verifyActivationSmsCode('+79001234567', '000000', 'fp')
    ).rejects.toThrow();
  });
});
```

### Пример: тест адаптера хранилища

```typescript
// data/storage/__tests__/SecureSessionStorage.test.ts
import { SecureSessionStorage } from '../SecureSessionStorage';

// Мок expo-secure-store
jest.mock('expo-secure-store', () => {
  const storeMap = new Map<string, string>();
  return {
    setItemAsync: jest.fn((key, value) => { storeMap.set(key, value); return Promise.resolve(); }),
    getItemAsync: jest.fn((key) => Promise.resolve(storeMap.get(key) ?? null)),
    deleteItemAsync: jest.fn((key) => { storeMap.delete(key); return Promise.resolve(); }),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
  };
});

describe('SecureSessionStorage', () => {
  it('сохраняет и загружает сессионные данные', async () => {
    const storageInstance = new SecureSessionStorage();
    const payloadValue = {
      sessionToken: 'tok-123',
      userGuid: 'usr-456',
    };

    await storageInstance.saveSessionData(payloadValue);
    const loadedPayload = await storageInstance.loadSessionData();

    expect(loadedPayload?.sessionToken).toBe('tok-123');
    expect(loadedPayload?.userGuid).toBe('usr-456');
  });

  it('возвращает null, если токен не сохранён', async () => {
    const storageInstance = new SecureSessionStorage();
    const resultValue = await storageInstance.loadSessionData();
    expect(resultValue).toBeNull();
  });
});
```

## Тестирование слоя App (хуки)

Хуки тестируются через `renderHook` из `@testing-library/react-native` с обёрткой в тестовые провайдеры.

### Пример: тест хука мутации

```typescript
// src/common/hooks/__tests__/useAuthMutations.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { createWrapper } from '../../test-utils/createWrapper';
import { useAuthMutations } from '../useAuthMutations';

// Мокируем зависимости данного хука
jest.mock('@data/repositories', () => ({
  createAuthRepository: () => ({
    sendActivationSmsCode: jest.fn().mockResolvedValue(undefined),
    verifyActivationSmsCode: jest.fn().mockResolvedValue({ sessionToken: 'tok', userGuid: 'u1' }),
    invalidateUserSession: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

describe('useAuthMutations', () => {
  it('вызывает навигацию на экран SMS после отправки кода', async () => {
    const { router } = require('expo-router');
    const { result } = renderHook(() => useAuthMutations(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.sendActivationSmsCodeMutation.mutate({ phoneNumber: '+79001234567' });
    });

    expect(router.push).toHaveBeenCalled();
  });
});
```

### Вспомогательный createWrapper

```typescript
// src/common/test-utils/createWrapper.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const testQueryClientInstance = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClientInstance}>
      {children}
    </QueryClientProvider>
  );
};

export { createWrapper };
```

## Mock-адаптеры (Demo Mode)

Для работы в оффлайн-режиме или демонстрации без реального сервера в проекте используются `.mock.ts` файлы с заглушками реализации:

```typescript
// data/repositories/AuthRepository.mock.ts
import type { IAuthRepository } from '@domain/auth/interfaces/IAuthRepository';

const createMockAuthRepository = (): IAuthRepository => ({
  sendActivationSmsCode: async (phone) => {
    console.log('[MOCK] SMS sent to', phone);
  },
  verifyActivationSmsCode: async (_phone, _code) => ({
    sessionToken: 'mock-session-token',
    userGuid: 'mock-user-guid',
  }),
  invalidateUserSession: async () => {},
});

export { createMockAuthRepository };
```

Переключение на мок-реализацию через конфигурацию:

```typescript
// data/repositories/index.ts
import { IS_DEMO_MODE } from '@/common/config/demoMode';
import { AuthRepository } from './AuthRepository';
import { createMockAuthRepository } from './AuthRepository.mock';

const createAuthRepository = () =>
  IS_DEMO_MODE ? createMockAuthRepository() : new AuthRepository();

export { createAuthRepository };
```

## Правила и ограничения

| Слой | Что тестировать | Что мокировать |
|------|----------------|----------------|
| `Domain` | Бизнес-правила, валидацию, алгоритмы | Репозитории, провайдеры (через интерфейсы) |
| `Data` | Маппинг ответов, обработку ошибок HTTP, логику адаптеров | HTTP-клиент (axios-mock-adapter), нативные модули |
| `App` (хуки) | Инициализацию, lifecycle запросов, побочные эффекты | Репозитории через mock-файлы, router |
| `App` (компоненты) | Отрисовку при разных состояниях, взаимодействие | Хуки через jest.mock |

## Чек-лист тестирования

- [ ] Каждый use-case покрыт тестами: happy path, invalid input, ошибка репозитория
- [ ] Маппинг данных в репозиториях проверен на граничных случаях (null, пустые строки, отсутствующие поля)
- [ ] Хуки-мутации проверены на навигацию и инвалидацию кэша в `onSuccess`
- [ ] Mock-адаптеры переключаются через конфигурацию, не через условия в коде слоёв
- [ ] Тесты не зависят друг от друга (независимый beforeEach для каждого теста)
- [ ] `any` в тестах запрещён так же, как и в продакшн-коде

## Дальнейшее чтение

- [Слои архитектуры](./layers.md) — границы ответственности, которые тестирование отражает
- [Интеграция нативных модулей](./examples/native-integration.md) — паттерны мокирования SecureStore и биометрии
- [Стандарты кода](./coding-standards.md) — правила типизации, применяемые и в тестах
