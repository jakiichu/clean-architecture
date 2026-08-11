---
title: Пример — Многошаговая форма (Onboarding)
sidebar_position: 6
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

Незавершённый черновик принадлежит конкретному onboarding flow и хранится в feature-scoped Zustand-store. Маршрут передаёт `flowId`, поэтому второй flow, deep link и очистка состояния остаются управляемыми.

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
      throw new InvalidPinFormatError();
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

interface IOnboardingDraft {
  readonly phoneNumber: string | null;
}

interface IOnboardingState {
  drafts: Record<string, IOnboardingDraft>;
  createDraft: (flowId: string) => void;
  setPhoneNumber: (flowId: string, phone: string) => void;
  removeDraft: (flowId: string) => void;
}

const useOnboardingStore = create<IOnboardingState>((set) => ({
  drafts: {},
  createDraft: (flowId) => set((state) => ({
    drafts: { ...state.drafts, [flowId]: { phoneNumber: null } },
  })),
  setPhoneNumber: (flowId, phoneNumber) => set((state) => ({
    drafts: { ...state.drafts, [flowId]: { ...state.drafts[flowId], phoneNumber } },
  })),
  removeDraft: (flowId) => set((state) => {
    const { [flowId]: removedDraft, ...remainingDrafts } = state.drafts;
    return { drafts: remainingDrafts };
  }),
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
import { useApplicationDependencies } from '@/app/providers/ApplicationProvider';
import { useOnboardingStore } from '@/common/store/useOnboardingStore';
import { ROUTER_PATH } from '@/common/const/routerPath';

const useSendSmsMutation = (flowId: string) => {
  const { auth } = useApplicationDependencies();
  const { setPhoneNumber } = useOnboardingStore();

  return useMutation<void, Error, { phoneNumber: string }>({
    mutationFn: async ({ phoneNumber }) => {
      await auth.sendActivationSmsCode.execute({ phoneNumber });
    },
    onSuccess: (_, { phoneNumber }) => {
      setPhoneNumber(flowId, phoneNumber);
      router.push({ pathname: ROUTER_PATH.AUTH_SMS, params: { flowId } });
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
import { useApplicationDependencies } from '@/app/providers/ApplicationProvider';
import { useOnboardingStore } from '@/common/store/useOnboardingStore';
import { ROUTER_PATH } from '@/common/const/routerPath';
import { QUERY_KEYS } from '@/common/const/queryKeys';

const useVerifySmsMutation = (flowId: string) => {
  const { auth } = useApplicationDependencies();
  const queryClientInstance = useQueryClient();
  const phoneNumber = useOnboardingStore((state) => state.drafts[flowId]?.phoneNumber);

  return useMutation<void, Error, { smsCode: string }>({
    mutationFn: async ({ smsCode }) => {
      if (!phoneNumber) throw new MissingOnboardingContextError();

      await auth.verifySmsCode.execute({
        phoneNumber,
        smsCode,
      });
    },
    onSuccess: async () => {
      await queryClientInstance.invalidateQueries({ queryKey: QUERY_KEYS.SESSION.ACTIVE });
      router.push({ pathname: ROUTER_PATH.AUTH_PIN_SETUP, params: { flowId } });
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
import { useApplicationDependencies } from '@/app/providers/ApplicationProvider';
import { ROUTER_PATH } from '@/common/const/routerPath';

const usePinSetupMutation = (flowId: string) => {
  const { auth } = useApplicationDependencies();

  return useMutation<void, Error, { pin: string }>({
    mutationFn: ({ pin }) => auth.setupPinCode.execute({ pin }),
    onSuccess: () => {
      router.push({ pathname: ROUTER_PATH.AUTH_BIOMETRIC_SETUP, params: { flowId } });
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

const usePhonePresenter = (flowId: string) => {
  const [phoneInputValue, setPhoneInputValue] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const sendSmsMutation = useSendSmsMutation(flowId);

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

const useSmsPresenter = (flowId: string) => {
  const [codeValue, setCodeValue] = useState<string>('');
  const verifyMutation = useVerifySmsMutation(flowId);

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
  const flowId = useStableOnboardingFlowId();
  const { phoneValue, errorMessage, isPending, onPhoneChange, onSubmit } = usePhonePresenter(flowId);

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
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { codeValue, isPending, errorMessage, onCodeChange } = useSmsPresenter(flowId);

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

### Черновик flow в Zustand и `flowId` в маршруте

```typescript
// ❌ Антипаттерн: бизнес-данные в URL-параметрах
router.push({ pathname: '/sms', params: { phone: '+79001234567', token: 'abc...' } });

// ✅ Правильно: маршрут содержит только ID конкретного черновика
const flowId = createOnboardingDraft({ phoneNumber: '+79001234567' });
router.push({ pathname: ROUTER_PATH.AUTH_SMS, params: { flowId } });
```

URL-параметры видны в логах навигации, могут быть перехвачены или изменены. Feature-store хранит сам черновик, а `flowId` позволяет выбрать правильный экземпляр и явно очистить его после завершения или отмены.

### Синтаксическая валидация в презентере, доменная — в use-case

```typescript
// App/Presenter: синтаксическая проверка (формат)
if (digitsOnly.length !== 11) {
  setInputError('Введите корректный номер телефона');
  return;
}

// Domain/UseCase: бизнес-проверка (правила)
if (!/^\d{6}$/.test(params.pin)) {
  throw new InvalidPinFormatError();
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
- [ ] В маршруте передаётся только `flowId`, а сам черновик хранится в feature-scoped store
- [ ] Синтаксическая валидация — в презентере, бизнес-правила — в use-case
- [ ] `isPending` блокирует ввод и кнопки во время запроса
- [ ] Ошибки мутации отображаются пользователю (не только console.error)
- [ ] `onSuccess` содержит только координацию (навигация, кэш), не бизнес-логику
- [ ] Zustand-стор сбрасывается при выходе из онбординга или ошибке

## Дальнейшее чтение

- [Пример мутации (POST)](./feature-post.md) — базовый паттерн onSuccess/onError
- [Навигация](../navigation.md) — guards и передача данных между экранами
- [Интеграция нативных модулей](./native-integration.md) — SecureStore для PIN и биометрии
