---
title: Пример — Многошаговая форма (Onboarding)
sidebar_position: 7
---

# Пример: Многошаговая форма и онбординг

Данный пример описывает паттерн многошагового потока регистрации/онбординга в мобильном приложении. Типичный сценарий: ввод телефона → верификация SMS → создание PIN-кода → опциональная настройка биометрии.

Архитектурный принцип: каждый шаг — отдельная мутация в `App`. Валидация формата (длина, символы) происходит в `App` (презентер/форма). Бизнес-валидация (корректность кода, привязка устройства) — в `Domain`.

## Постановка задачи

**Шаги онбординга:**
1. Ввод номера телефона → отправка SMS с кодом
2. Ввод SMS-кода → получение сессии
3. Создание PIN-кода (6 цифр) → сохранение в SecureStore
4. Предложение настройки биометрии → опционально

Данные передаются между шагами через Zustand-стор (не через навигационные параметры), так как между шагами могут быть переходы вперёд и назад.

## Шаг 1. Контракты в Domain

```typescript
// domain/auth/interfaces/IAuthRepository.ts
interface IAuthRepository {
  sendActivationSmsCode: (phoneNumber: string) => Promise<void>;
  verifyActivationSmsCode: (
    phoneNumber: string,
    smsCode: string
  ) => Promise<IAuthSessionResult>;
}
```

```typescript
// domain/auth/interfaces/IPinProvider.ts
interface IPinProvider {
  savePin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => Promise<void>;
}
```

```typescript
// domain/auth/use-cases/setupPinCodeUseCase.ts

interface ISetupPinCodeParams {
  pin: string;
}

const createSetupPinCodeUseCase = (pinProvider: IPinProvider) => {
  const execute = async (params: ISetupPinCodeParams): Promise<void> => {
    if (params.pin.length !== 6 || !/^\d{6}$/.test(params.pin)) {
      throw new Error('PIN must be exactly 6 digits');
    }
    await pinProvider.savePin(params.pin);
  };

  return { execute };
};

export { createSetupPinCodeUseCase };
```

## Шаг 2. Zustand-стор для состояния онбординга

UI-состояние между шагами хранится в Zustand. Это UI State, а не бизнес-данные.

```typescript
// src/common/store/useOnboardingStore.ts
import { create } from 'zustand';

interface IOnboardingState {
  phoneNumber: string | null;
  pinCandidate: string | null;
  setPhoneNumber: (phone: string) => void;
  setPinCandidate: (pin: string) => void;
  resetOnboarding: () => void;
}

const useOnboardingStore = create<IOnboardingState>((set) => ({
  phoneNumber: null,
  pinCandidate: null,
  setPhoneNumber: (phone) => set({ phoneNumber: phone }),
  setPinCandidate: (pin) => set({ pinCandidate: pin }),
  resetOnboarding: () => set({ phoneNumber: null, pinCandidate: null }),
}));

export { useOnboardingStore };
```

## Шаг 3. Хуки мутаций для каждого шага

Каждый шаг — отдельный хук. Это упрощает изоляцию ошибок и тестирование.

### Шаг 1: Отправка SMS

```typescript
// src/common/hooks/useSendSmsMutation.ts
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createAuthRepository } from '@data/repositories';
import { useOnboardingStore } from '@/common/store/useOnboardingStore';
import { ROUTER_PATH } from '@/common/const/routerPath';

const authRepositoryInstance = createAuthRepository();

const useSendSmsMutation = () => {
  const { setPhoneNumber } = useOnboardingStore();

  return useMutation<void, Error, { phoneNumber: string }>({
    mutationFn: async ({ phoneNumber }) => {
      await authRepositoryInstance.sendActivationSmsCode(phoneNumber);
    },
    onSuccess: (_, { phoneNumber }) => {
      setPhoneNumber(phoneNumber);        // Сохраняем для следующего шага
      router.push(ROUTER_PATH.AUTH_SMS);  // Переход вперёд
    },
  });
};

export { useSendSmsMutation };
```

### Шаг 2: Верификация SMS-кода

```typescript
// src/common/hooks/useVerifySmsMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createVerifySmsCodeUseCase } from '@domain/auth/use-cases/verifySmsCodeUseCase';
import { createAuthRepository } from '@data/repositories';
import { SecureSessionStorage } from '@data/storage/SecureSessionStorage';
import { useOnboardingStore } from '@/common/store/useOnboardingStore';
import { ROUTER_PATH } from '@/common/const/routerPath';
import { QUERY_KEYS } from '@/common/const/queryKeys';

const authRepositoryInstance = createAuthRepository();
const secureStorageInstance = new SecureSessionStorage();
const useCaseInstance = createVerifySmsCodeUseCase({ authRepository: authRepositoryInstance });

const useVerifySmsMutation = () => {
  const queryClientInstance = useQueryClient();
  const { phoneNumber } = useOnboardingStore();

  return useMutation<void, Error, { smsCode: string }>({
    mutationFn: async ({ smsCode }) => {
      if (!phoneNumber) throw new Error('Phone number is missing');

      const sessionResult = await useCaseInstance.execute({
        phoneNumber,
        smsCode,
      });

      await secureStorageInstance.saveSessionData(sessionResult);
    },
    onSuccess: async () => {
      await queryClientInstance.invalidateQueries({ queryKey: QUERY_KEYS.SESSION.ACTIVE });
      router.push(ROUTER_PATH.AUTH_PIN_SETUP);
    },
  });
};

export { useVerifySmsMutation };
```

### Шаг 3: Создание PIN-кода

```typescript
// src/common/hooks/usePinSetupMutation.ts
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createSetupPinCodeUseCase } from '@domain/auth/use-cases/setupPinCodeUseCase';
import { PinSecureStorageAdapter } from '@data/storage/PinSecureStorageAdapter';
import { ROUTER_PATH } from '@/common/const/routerPath';

const pinProviderInstance = new PinSecureStorageAdapter();
const useCaseInstance = createSetupPinCodeUseCase(pinProviderInstance);

const usePinSetupMutation = () => {
  return useMutation<void, Error, { pin: string }>({
    mutationFn: ({ pin }) => useCaseInstance.execute({ pin }),
    onSuccess: () => {
      router.push(ROUTER_PATH.AUTH_BIOMETRIC_SETUP);
    },
  });
};

export { usePinSetupMutation };
```

## Шаг 4. Презентеры для каждого экрана

Презентер управляет локальным UI-состоянием формы (значения полей, ошибки синтаксиса) и вызывает мутацию при отправке.

### Презентер экрана ввода телефона

```typescript
// app/modules/auth/phone/usePhonePresenter.ts
import { useState, useCallback } from 'react';
import { useSendSmsMutation } from '@/common/hooks/useSendSmsMutation';
import { formatPhoneNumber } from '@/utils/phoneFormat';

const PHONE_DIGITS_COUNT = 11;

const usePhonePresenter = () => {
  const [phoneInputValue, setPhoneInputValue] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const sendSmsMutation = useSendSmsMutation();

  const handlePhoneChange = useCallback((rawInput: string) => {
    const formattedPhone: string = formatPhoneNumber(rawInput);
    setPhoneInputValue(formattedPhone);
    if (inputError) setInputError(null);
  }, [inputError]);

  const handleSubmit = useCallback(() => {
    const digitsOnly: string = phoneInputValue.replace(/\D/g, '');

    if (digitsOnly.length !== PHONE_DIGITS_COUNT) {
      setInputError('Введите корректный номер телефона');
      return;
    }

    sendSmsMutation.mutate({ phoneNumber: phoneInputValue });
  }, [phoneInputValue, sendSmsMutation]);

  return {
    phoneValue: phoneInputValue,
    errorMessage: inputError ?? (sendSmsMutation.isError ? 'Ошибка отправки кода' : null),
    isPending: sendSmsMutation.isPending,
    onPhoneChange: handlePhoneChange,
    onSubmit: handleSubmit,
  };
};

export { usePhonePresenter };
```

### Презентер экрана ввода SMS-кода

```typescript
// app/modules/auth/sms/useSmsPresenter.ts
import { useState, useCallback } from 'react';
import { useVerifySmsMutation } from '@/common/hooks/useVerifySmsMutation';

const SMS_CODE_LENGTH = 6;

const useSmsPresenter = () => {
  const [codeValue, setCodeValue] = useState<string>('');
  const verifyMutation = useVerifySmsMutation();

  const handleCodeChange = useCallback((input: string) => {
    const digitsOnly: string = input.replace(/\D/g, '').slice(0, SMS_CODE_LENGTH);
    setCodeValue(digitsOnly);

    if (digitsOnly.length === SMS_CODE_LENGTH) {
      verifyMutation.mutate({ smsCode: digitsOnly });
    }
  }, [verifyMutation]);

  return {
    codeValue,
    isPending: verifyMutation.isPending,
    isError: verifyMutation.isError,
    errorMessage: verifyMutation.isError ? 'Неверный код. Попробуйте ещё раз.' : null,
    onCodeChange: handleCodeChange,
  };
};

export { useSmsPresenter };
```

## Шаг 5. Компоненты экранов

```tsx
// app/(auth)/phone.tsx
import { View, Text } from 'react-native';
import { UIInput } from '@/ui-kit/UIInput';
import { UIButton } from '@/ui-kit/UIButton';
import { usePhonePresenter } from './phone/usePhonePresenter';

export default function PhoneScreen() {
  const { phoneValue, errorMessage, isPending, onPhoneChange, onSubmit } = usePhonePresenter();

  return (
    <View>
      <Text>Введите номер телефона</Text>

      <UIInput
        value={phoneValue}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        placeholder="+7 (000) 000-00-00"
        editable={!isPending}
        errorMessage={errorMessage}
      />

      <UIButton
        title="Получить код"
        onPress={onSubmit}
        isLoading={isPending}
        disabled={isPending}
      />
    </View>
  );
}
```

```tsx
// app/(auth)/sms.tsx
import { View, Text } from 'react-native';
import { UIPinInput } from '@/ui-kit/UIPinInput';
import { useSmsPresenter } from './sms/useSmsPresenter';

export default function SmsScreen() {
  const { codeValue, isPending, errorMessage, onCodeChange } = useSmsPresenter();

  return (
    <View>
      <Text>Введите код из SMS</Text>

      <UIPinInput
        value={codeValue}
        onChangeText={onCodeChange}
        length={6}
        disabled={isPending}
      />

      {errorMessage && <Text>{errorMessage}</Text>}
      {isPending && <Text>Проверяем код...</Text>}
    </View>
  );
}
```

## Разбор архитектурных решений

### Передача данных между шагами через Zustand, не через params

```typescript
// ❌ Антипаттерн: бизнес-данные в URL-параметрах
router.push({ pathname: '/sms', params: { phone: '+79001234567', token: 'abc...' } });

// ✅ Правильно: параметры в Zustand, переход без данных
setPhoneNumber('+79001234567');
router.push(ROUTER_PATH.AUTH_SMS);
```

URL-параметры видны в логах навигации, могут быть перехвачены или изменены. Zustand хранит данные в памяти и сбрасывается при выходе.

### Синтаксическая валидация в презентере, доменная — в use-case

```typescript
// App/Presenter: синтаксическая проверка (формат)
if (digitsOnly.length !== 11) {
  setInputError('Введите корректный номер телефона');
  return;
}

// Domain/UseCase: бизнес-проверка (правила)
if (!/^\d{6}$/.test(params.pin)) {
  throw new Error('PIN must be exactly 6 digits');
}
```

### Автоматическая отправка при заполнении SMS-кода

Хороший UX-паттерн для PIN/SMS-ввода: при вводе последней цифры автоматически вызвать мутацию без нажатия кнопки:

```typescript
if (digitsOnly.length === SMS_CODE_LENGTH) {
  verifyMutation.mutate({ smsCode: digitsOnly });
}
```

## Структура файлов

```
app/(auth)/
├── phone.tsx                      ← Экран ввода телефона
├── sms.tsx                        ← Экран SMS-кода
├── pinSetup.tsx                   ← Экран создания PIN
├── biometricSetup.tsx             ← Экран биометрии
├── phone/
│   └── usePhonePresenter.ts
├── sms/
│   └── useSmsPresenter.ts
├── pinSetup/
│   └── usePinSetupPresenter.ts
└── biometricSetup/
    └── useBiometricSetupPresenter.ts

src/common/hooks/
├── useSendSmsMutation.ts
├── useVerifySmsMutation.ts
├── usePinSetupMutation.ts
└── useBiometricSetupMutation.ts

src/common/store/
└── useOnboardingStore.ts
```

## Чек-лист многошаговой формы

- [ ] Каждый шаг — отдельный хук мутации
- [ ] Данные между шагами хранятся в Zustand, не в URL-параметрах
- [ ] Синтаксическая валидация — в презентере, бизнес-правила — в use-case
- [ ] `isPending` блокирует ввод и кнопки во время запроса
- [ ] Ошибки мутации отображаются пользователю (не только console.error)
- [ ] `onSuccess` содержит только координацию (навигация, кэш), не бизнес-логику
- [ ] Zustand-стор сбрасывается при выходе из онбординга или ошибке

## Дальнейшее чтение

- [Пример мутации (POST)](./feature-post.md) — базовый паттерн onSuccess/onError
- [Навигация](../navigation.md) — guards и передача данных между экранами
- [Интеграция нативных модулей](./native-integration.md) — SecureStore для PIN и биометрии
