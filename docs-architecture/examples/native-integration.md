---
title: Интеграция с нативными модулями
sidebar_position: 4
---

# Интеграция с нативными модулями и аппаратным обеспечением

В мобильных приложениях (React Native / Expo) критически важно взаимодействовать с возможностями устройства: защищённое хранилище (Keychain/Keystore), биометрия, камера, геолокация. С точки зрения чистой архитектуры эти возможности относятся к инфраструктуре.

Слой `Domain` не должен знать о существовании `expo-secure-store`, `react-native-camera` или `expo-local-authentication`. Для соблюдения правила зависимостей (`app → domain ← data`) мы используем паттерн **Адаптер (Adapter)** или **Мост (Bridge)** внутри слоя `Data`.

## Принципы интеграции

1. **Абстракция в Domain:** Слой `Domain` объявляет интерфейс (контракт), описывающий, *что* нужно сделать.
2. **Реализация в Data:** Слой `Data` реализует этот интерфейс, используя конкретную React Native библиотеку.
3. **Обработка ошибок:** Нативные ошибки перехватываются в `Data` и преобразуются в стабильный failure или явно типизированный capability result. DTO и типы SDK границу `Data` не покидают.
4. **Изоляция платформ:** Если логика на iOS и Android отличается, `Data`-слой скрывает эти различия за единым интерфейсом.

## Пример: Защищённое хранилище (Secure Storage)

### 1. Контракт в Domain

Интерфейс, который не зависит от платформы.

```typescript
// domain/auth/interface/repository/ISecureStorage.ts

interface ISecureStorage {
  saveSessionToken: (tokenValue: string) => Promise<void>;
  loadSessionToken: () => Promise<string | null>;
  clearSessionData: () => Promise<void>;
}

export type { ISecureStorage };
```

### 2. Адаптер в Data

Реализация через `expo-secure-store`. Здесь мы также соблюдаем кодстайл: стрелочные функции, полные имена переменных.

```typescript
// data/storage/SecureSessionStorageAdapter.ts
import * as SecureStore from 'expo-secure-store';
import type { ISecureStorage } from '../../domain/auth/interface/repository/ISecureStorage';

const SECURE_STORAGE_KEY_TOKEN = 'session_access_token';

const createSecureSessionStorageAdapter = (): ISecureStorage => {
  const saveSessionToken = async (tokenValue: string): Promise<void> => {
    await SecureStore.setItemAsync(SECURE_STORAGE_KEY_TOKEN, tokenValue);
  };

  const loadSessionToken = async (): Promise<string | null> => {
    const storedTokenValue: string | null = await SecureStore.getItemAsync(SECURE_STORAGE_KEY_TOKEN);
    return storedTokenValue;
  };

  const clearSessionData = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_TOKEN);
  };

  return {
    saveSessionToken,
    loadSessionToken,
    clearSessionData,
  };
};

export { createSecureSessionStorageAdapter };
```

### 3. Использование в UseCase

Бизнес-сценарий использует интерфейс, не зная о `SecureStore`.

```typescript
// domain/auth/use-case/VerifyLoginUseCase.ts

// ... импорты

const createVerifyLoginUseCase = (secureStorage: ISecureStorage) => {
  const execute = async (payload: ILoginPayload): Promise<ILoginResult> => {
    // ... логика проверки пароля ...
    
    // Сохраняем токен через абстракцию
    await secureStorage.saveSessionToken(result.token);
    
    return result;
  };

  return { execute };
};
```

## Пример: Биометрия (Biometrics)

### 1. Контракт в Domain

```typescript
// domain/auth/interface/IBiometricProvider.ts

type TBiometricAuthenticationResult =
  | { type: 'authenticated' }
  | { type: 'cancelled' }
  | { type: 'not-enrolled' }
  | { type: 'unsupported' };

interface IBiometricProvider {
  authenticateWithBiometrics: () => Promise<TBiometricAuthenticationResult>;
}

export type { IBiometricProvider, TBiometricAuthenticationResult };
```

### 2. Реализация в Data

```typescript
// data/native/BiometricAdapter.ts
import * as LocalAuthentication from 'expo-local-authentication';
import type { IBiometricProvider, TBiometricAuthenticationResult } from '../../domain/auth/interface/IBiometricProvider';

const createBiometricAdapter = (): IBiometricProvider => {
  const authenticateWithBiometrics = async (): Promise<TBiometricAuthenticationResult> => {
    const isHardwareAvailableValue: boolean = await LocalAuthentication.hasHardwareAsync();
    const isEnrolledValue: boolean = await LocalAuthentication.isEnrolledAsync();

    if (!isHardwareAvailableValue || !isEnrolledValue) {
      return isHardwareAvailableValue ? { type: 'not-enrolled' } : { type: 'unsupported' };
    }

    const authenticationResultValue: LocalAuthentication.AuthenticationResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Подтвердите личность для входа',
    });

    if (authenticationResultValue.success) return { type: 'authenticated' };
    return { type: 'cancelled' };
  };

  return { authenticateWithBiometrics };
};

export { createBiometricAdapter };
```

## Обработка разрешений (Permissions)

Вызов системного API разрешений является инфраструктурной задачей, но момент запроса — продуктовым и presentation-решением:

- Domain-порт описывает необходимую возможность и устойчивые результаты `granted`, `denied`, `blocked`, `unsupported`;
- Data-адаптер вызывает конкретный SDK и переводит его статусы;
- App решает, когда показать предварительное объяснение, запустить запрос и предложить открыть настройки;
- `boolean` недостаточен, если UI должен различать отказ, системную блокировку и отсутствие API.

## Чек-лист для нативных модулей

- [ ] Интерфейс (`I...Provider`) объявлен в `domain/interface`?
- [ ] Реализация в `data` использует только нативные библиотеки?
- [ ] Отсутствуют прямые вызовы нативных API в `app` (компонентах)?
- [ ] Ошибки SDK преобразуются в стабильные failure/capability-типы, а локализованный текст формируется в App?
- [ ] Используются полные имена переменных и стрелочные функции в адаптерах?

## Дальнейшее чтение

- [Пример реализации фичи (POST)](./feature-post.md) — как вызывать адаптеры через мутации
- [Стандарты кода](../coding-standards.md) — правила оформления адаптеров
