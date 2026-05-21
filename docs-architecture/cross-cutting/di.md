---
title: Внедрение зависимостей
sidebar_position: 9
---

# Внедрение зависимостей (Dependency Injection)

Внедрение зависимостей (DI) — один из ключевых механизмов, обеспечивающих соблюдение Dependency Rule в чистой архитектуре. Вместо того чтобы создавать зависимости внутри компонентов, они передаются извне. Это делает код тестируемым, заменяемым и слабосвязанным.

## Зачем DI в мобильном приложении

В мобильных приложениях без DI код быстро деградирует:
- Use-case напрямую создаёт экземпляры репозиториев → невозможно подменить на mock при тестировании
- Компоненты знают о конкретных классах из `data` слоя → нарушение Dependency Rule
- Переключение между prod/demo-режимами требует изменений в бизнес-логике

DI решает все три проблемы.

## Фабричный паттерн (Factory)

В проекте используется фабричный паттерн без IoC-контейнера. Фабрики создают зависимости и передают их в use-case или репозитории.

### Создание use-case через фабрику

```typescript
// domain/auth/use-cases/verifySmsCodeUseCase.ts

interface IVerifySmsCodeDependencies {
  authRepository: IAuthRepository;
}

const createVerifySmsCodeUseCase = (deps: IVerifySmsCodeDependencies) => {
  const execute = async (params: IVerifySmsCodeExecutionParams) => {
    return deps.authRepository.verifyActivationSmsCode(
      params.phoneNumber,
      params.smsCode
    );
  };
  return { execute };
};

export { createVerifySmsCodeUseCase };
```

Слой `Data` создаёт конкретную реализацию и передаёт её:

```typescript
// src/common/hooks/useAuthMutations.ts (слой App)
const authRepositoryInstance = createAuthRepository(); // → prod или mock
const useCaseInstance = createVerifySmsCodeUseCase({ authRepository: authRepositoryInstance });
```

### Создание репозитория с переключением prod/demo

```typescript
// data/repositories/index.ts
import { IS_DEMO_MODE } from '@/common/config/demoMode';
import { AuthRepository } from './AuthRepository';
import { createMockAuthRepository } from './AuthRepository.mock';
import { NotificationsRepository } from './NotificationsRepository';
import { createMockNotificationsRepository } from './NotificationsRepository.mock';

const createAuthRepository = (): IAuthRepository =>
  IS_DEMO_MODE ? createMockAuthRepository() : new AuthRepository();

const createNotificationsRepository = (): INotificationsRepository =>
  IS_DEMO_MODE ? createMockNotificationsRepository() : new NotificationsRepository();

export { createAuthRepository, createNotificationsRepository };
```

## Внедрение через хук-адаптер

Для React-совместимого DI используется паттерн «хук-адаптер», который создаёт use-case внутри хука и передаёт зависимости. Это подходит, когда зависимости зависят от контекста React (локализация, тема).

```typescript
// src/common/hooks/useOtpQuery.ts

const useOtpQuery = () => {
  // Создание зависимостей внутри хука
  const repositoryInstance = createOtpRepository();                       // Data
  const useCaseInstance = createGetOtpCodeUseCase(repositoryInstance);    // Domain

  return useQuery({
    queryKey: QUERY_KEYS.OTP.CURRENT,
    queryFn: () => useCaseInstance.execute(),
    refetchInterval: 30_000,
  });
};
```

**Важно:** Для хуков с тяжёлыми объектами используйте `useRef` или создавайте экземпляры вне хука (на уровне модуля), чтобы избежать пересоздания при каждом рендере.

```typescript
// Если зависимости не нужны React-контекст — создаём вне хука
const authRepositoryInstance = createAuthRepository();
const useCaseInstance = createVerifySmsCodeUseCase({ authRepository: authRepositoryInstance });

const useVerifySmsMutation = () => {
  return useMutation({ mutationFn: (params) => useCaseInstance.execute(params) });
};
```

## Внедрение нативных адаптеров

Нативные модули (SecureStore, биометрия, DeviceInfo) внедряются через интерфейсы. Это позволяет подменять их в тестах без запуска реального устройства.

```typescript
// domain/auth/interfaces/IBiometricProvider.ts
interface IBiometricProvider {
  checkBiometricHardwareAvailability: () => Promise<boolean>;
  performBiometricAuthentication: (promptMessage: string) => Promise<boolean>;
}

// data/native/BiometricAdapter.ts — prod реализация
class BiometricAdapter implements IBiometricProvider {
  async checkBiometricHardwareAvailability() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }
  async performBiometricAuthentication(prompt: string) {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt });
    return result.success;
  }
}

// data/native/BiometricAdapter.mock.ts — тестовая заглушка
class MockBiometricAdapter implements IBiometricProvider {
  async checkBiometricHardwareAvailability() { return true; }
  async performBiometricAuthentication(_prompt: string) { return true; }
}
```

## Анти-паттерн: синглтон с прямым импортом

Прямой импорт конкретной реализации из `data` в `domain` или `app` нарушает Dependency Rule:

```typescript
// ❌ Запрещено: domain знает о конкретной реализации
import { AuthRepository } from '../../../data/repositories/AuthRepository';

class VerifySmsCodeUseCase {
  private repo = new AuthRepository(); // Жёсткая связь с инфраструктурой
}
```

```typescript
// ✅ Правильно: зависимость передаётся извне
const createVerifySmsCodeUseCase = (deps: { authRepository: IAuthRepository }) => {
  // Domain работает только с интерфейсом
};
```

## Таблица паттернов DI по слоям

| Ситуация | Паттерн | Пример |
|----------|---------|--------|
| Use-case принимает репозиторий | Фабрика с параметрами | `createVerifySmsCodeUseCase({ authRepository })` |
| Репозиторий prod/demo | Фабрика с конфигом | `createAuthRepository()` читает `IS_DEMO_MODE` |
| Нативный адаптер в хуке | Создание в хуке или на уровне модуля | `createBiometricAdapter()` возвращает `IBiometricProvider` |

| Зависимость нужна React-контексту | Хук-адаптер + `useRef` | `const adapterRef = useRef(createAdapter())` |

## Чек-лист DI

- [ ] Use-case принимает зависимости только через параметры фабрики или конструктора
- [ ] Domain не импортирует конкретные классы из Data
- [ ] Фабрики в `data/*/index.ts` централизованно управляют переключением prod/demo
- [ ] Нативные модули реализуют интерфейс из Domain
- [ ] Тяжёлые объекты создаются вне хука (на уровне модуля) для предотвращения утечек памяти

## Дальнейшее чтение

- [Слои архитектуры](../layers.md) — Dependency Rule и направление зависимостей
- [Тестирование](../testing.md) — как DI упрощает подстановку mock-зависимостей
- [Интеграция нативных модулей](../examples/native-integration.md) — адаптеры как DI-точки
