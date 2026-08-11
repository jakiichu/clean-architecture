---
title: Навигация в мобильном приложении
sidebar_position: 7
---

# Навигация в мобильном приложении

В мобильных приложениях на базе Expo Router навигация строится на файловой системе: имя файла определяет маршрут. Это накладывает особые требования к архитектуре: guards, сессионные проверки и редиректы должны быть изолированы в слое `App`, не затрагивая бизнес-логику.

## Структура маршрутов (Expo Router)

Expo Router использует файловую структуру директории `app/` для автоматического построения навигационного дерева. Группы в скобках (`(auth)`, `(app)`) позволяют объединять экраны со схожим layout без влияния на URL-путь.

```
app/
├── _layout.tsx          # Корневой layout: провайдеры, глобальные настройки
├── index.tsx            # Роут «/»: точка входа, инициализация сессии
├── (auth)/
│   ├── _layout.tsx      # Layout для неавторизованных экранов
│   ├── phone.tsx        # /phone — ввод номера телефона
│   ├── sms.tsx          # /sms — верификация SMS-кода
│   ├── pinSetup.tsx     # /pinSetup — создание PIN-кода
│   ├── biometricSetup.tsx # /biometricSetup — настройка биометрии
│   ├── pinLogin.tsx     # /pinLogin — вход по PIN
│   └── quickLogin.tsx   # /quickLogin — быстрый вход (биометрия/PIN)
└── (app)/
    ├── _layout.tsx      # Layout для авторизованных экранов (Tab Bar)
    └── index.tsx        # /app — главный экран приложения
```

## Типизированные ключи маршрутов

Хардкод строк маршрутов в компонентах запрещён. Все пути объявляются в одном месте:

```typescript
// src/common/const/routerPath.ts
const ROUTER_PATH = {
  INDEX: '/',
  AUTH_PHONE: '/(auth)/phone',
  AUTH_SMS: '/(auth)/sms',
  AUTH_PIN_SETUP: '/(auth)/pinSetup',
  AUTH_PIN_LOGIN: '/(auth)/pinLogin',
  AUTH_BIOMETRIC_SETUP: '/(auth)/biometricSetup',
  AUTH_QUICK_LOGIN: '/(auth)/quickLogin',
  APP_HOME: '/(app)',
} as const;

type TRouterPath = (typeof ROUTER_PATH)[keyof typeof ROUTER_PATH];

export { ROUTER_PATH };
export type { TRouterPath };
```

Использование:
```typescript
import { router } from 'expo-router';
import { ROUTER_PATH } from '@/common/const/routerPath';

// Переход с заменой истории (замена текущего экрана)
router.replace(ROUTER_PATH.APP_HOME);

// Добавление экрана в стек
router.push(ROUTER_PATH.AUTH_SMS);

// Возврат назад
router.back();
```

## Guards и защита маршрутов

Guard — это компонент или хук, который проверяет условие доступа к маршруту и перенаправляет пользователя при несоответствии. В Expo Router guards реализуются на уровне корневого `index.tsx` или layout-файлов.

### Паттерн: инициализация сессии в точке входа

```typescript
// app/index.tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSessionInitializationQuery } from '@/common/hooks/useSessionInitializationQuery';
import { ROUTER_PATH } from '@/common/const/routerPath';
import { FullScreenLoader } from '@/common/ui/FullScreenLoader';

export default function IndexScreen() {
  const { sessionStatus, isLoading } = useSessionInitializationQuery();

  useEffect(() => {
    if (isLoading) return;

    if (sessionStatus.isFullyConfigured) {
      router.replace(ROUTER_PATH.AUTH_QUICK_LOGIN);
    } else {
      router.replace(ROUTER_PATH.AUTH_PHONE);
    }
  }, [isLoading, sessionStatus]);

  return <FullScreenLoader isVisible loadingMessage="Инициализация..." />;
}
```

### Паттерн: layout-guard для группы (auth)

```typescript
// app/(app)/_layout.tsx
import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { useSessionStore } from '@/common/store/useSessionStore';
import { ROUTER_PATH } from '@/common/const/routerPath';

export default function AppLayout() {
  const { isAuthenticated } = useSessionStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(ROUTER_PATH.AUTH_PHONE);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
```

## Передача параметров между экранами

Для перехода между независимо открываемыми экранами маршрут обычно передаёт устойчивый идентификатор. Целевой экран восстанавливает актуальные данные через query/use case. Прямую сериализацию бизнес-объекта в параметры следует избегать.

```typescript
// Допустимо: передача устойчивого идентификатора
router.push({ pathname: ROUTER_PATH.TRIP_DETAILS, params: { tripId } });

// Получение параметров
import { useLocalSearchParams } from 'expo-router';

const { tripId } = useLocalSearchParams<{ tripId: string }>();
```

Feature-scoped store подходит для временного черновика одного многошагового flow, если промежуточное состояние ещё не имеет устойчивого ID. Это частный случай, а не общий способ передачи данных между экранами. Для store необходимо определить владельца, ключ экземпляра flow, восстановление и момент очистки.

```typescript
// Начало конкретного onboarding flow:
const flowId = createOnboardingDraft();
router.push({ pathname: ROUTER_PATH.ONBOARDING_PROFILE, params: { flowId } });

// Экран читает только свой черновик, а после завершения flow он удаляется:
const draft = useOnboardingDraft(flowId);
completeOnboarding(flowId).finally(() => removeOnboardingDraft(flowId));
```

Такой экран не должен зависеть только от случайно оставшегося глобального Zustand-состояния: иначе deep link, восстановление процесса и второй параллельный flow станут непредсказуемыми.

## Анимации переходов

Анимации настраиваются централизованно в layout-файлах:

```typescript
// app/(auth)/_layout.tsx
<Stack screenOptions={{
  headerShown: false,
  animation: 'slide_from_right', // iOS-стиль: вправо/влево
  // animation: 'fade',           // Плавное появление (для инициализации)
  // animation: 'none',           // Без анимации (для guard-редиректов)
}}>
```

## Глубокие ссылки (Deep Links)

Deep Links позволяют открывать конкретные экраны приложения по внешней ссылке (e-mail, пуш-уведомление, браузер). Конфигурируются в `app.config.ts`:

```typescript
// app.config.ts
export default {
  scheme: 'myapp',
  // Пример: myapp://invite/abc123 откроет экран /invite с params.code = 'abc123'
};
```

Обработка deep link параметров:
```typescript
// app/invite/[code].tsx
import { useLocalSearchParams } from 'expo-router';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  // Передать code в соответствующий use-case
}
```

## Навигация из хуков и use-case (антипаттерн)

Вызов `router.push()` или `router.replace()` из `Domain` или `Data` слоёв **запрещён**. Навигация — это побочный эффект, который принадлежит слою `App`.

```typescript
// ❌ Нельзя: навигация внутри use-case
const createLoginUseCase = () => {
  const execute = async (params) => {
    const result = await authRepository.login(params);
    router.replace('/home'); // Нарушение Dependency Rule
    return result;
  };
};

// ✅ Правильно: навигация в onSuccess хука
useMutation({
  mutationFn: (params) => loginUseCase.execute(params),
  onSuccess: () => router.replace(ROUTER_PATH.APP_HOME),
});
```

## Управление кнопкой «Назад» (Back Handler)

В React Native кнопка аппаратного «Назад» (Android) должна обрабатываться явно для сценариев с модальными экранами или многошаговыми формами:

```typescript
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

const usePreventBack = (shouldPrevent: boolean) => {
  useEffect(() => {
    if (!shouldPrevent) return;

    const backHandlerSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true // true = событие обработано, системное поведение отменяется
    );

    return () => backHandlerSubscription.remove();
  }, [shouldPrevent]);
};
```

## Чек-лист навигации

- [ ] Все пути объявлены в `ROUTER_PATH` как `as const`
- [ ] Хардкод строк маршрутов в компонентах отсутствует
- [ ] Guards реализованы в `_layout.tsx` или на точке входа `index.tsx`
- [ ] Навигация вызывается только в слое `App` (хуки, callbacks)
- [ ] Между независимо открываемыми экранами передаётся устойчивый ID, а данные восстанавливаются целевым экраном
- [ ] Feature store используется только для явно ограниченного flow и имеет правила очистки
- [ ] Анимации настроены централизованно в layout-файлах

## Дальнейшее чтение

- [Слои архитектуры](./layers.md) — зоны ответственности слоя App
- [Управление состоянием](./cross-cutting/state-management.md) — UI State и сессионные флаги
- [Пример реализации (мутация)](./examples/feature-post.md) — навигация как побочный эффект в onSuccess
