---
title: Пример реализации фичи (Мутация)
sidebar_position: 5
---

# Пример реализации фичи: мутация (POST/изменение данных)

В данном разделе описан подход к созданию функциональных единиц, изменяющих состояние системы (отправка форм, авторизация, обновление данных). В отличие от GET-запросов, мутации требуют явного управления побочными эффектами: инвалидацией кэша, навигацией, отображением уведомлений об ошибках и блокировкой интерфейса во время выполнения.

Архитектура гарантирует, что бизнес-правила валидации и логика сохранения данных изолированы в `Domain`, а управление состоянием загрузки и пользовательским опытом (UX) остаётся в `App`.

## Специфика мутаций в Clean Architecture

При реализации сценариев типа «записать/изменить» важно соблюдать следующие правила:

1. **Use-case — это действие:** В отличие от Query, мутационный use-case не кэшируется. Он выполняется по требованию и возвращает актуальный результат операции.
2. **Атомарность:** Одна мутация — одно изменение. Не следует объединять создание пользователя и отправку письма в один use-case; используйте цепочку вызовов или транзакции в слое Data.
3. **Изоляция побочных эффектов:** Доменный слой возвращает результат (например, «сессия создана»). Он не должен знать, что после этого нужно перенаправить пользователя на главный экран или показать тост «Успех». Это делает слой App.

## Пошаговая реализация

### Шаг 1. Описание контрактов в Domain

Для примера возьмём сценарий проверки SMS-кода (как описано в ТЗ Спринта 6).

```typescript
// domain/auth/interface/dto.ts
interface IAuthSessionDto {
  sessionToken: string;
  userGuid: string;
  deviceFingerprint: string;
}
```

```typescript
// domain/auth/interface/port.ts
interface IVerifySmsCodePort {
  phoneNumber: string;
  smsCode: string;
  deviceFingerprint: string;
}
```

```typescript
// domain/auth/interface/repository.ts
interface IAuthRepository {
  verifySmsCode(port: IVerifySmsCodePort): Promise<IAuthSessionDto>;
}
```

```typescript
// domain/auth/interface/use-case.ts
interface IVerifySmsCodeUseCase {
  execute(port: IVerifySmsCodePort): Promise<IAuthSessionDto>;
}
```

### Шаг 2. Реализация бизнес-сценария (Use-case)

Use-case проверяет корректность входных данных перед отправкой в инфраструктуру.

```typescript
// domain/auth/use-case/verify-sms-code.ts
import type { IVerifySmsCodeUseCase } from '../interface/use-case';
import type { IVerifySmsCodePort } from '../interface/port';
import type { IAuthSessionDto } from '../interface/dto';
import type { IAuthRepository } from '../interface/repository';

class VerifySmsCodeUseCase implements IVerifySmsCodeUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(port: IVerifySmsCodePort): Promise<IAuthSessionDto> {
    // 1. Доменная валидация (например, проверка формата кода)
    if (!/^\d{6}$/.test(port.smsCode)) {
      throw new Error('Invalid SMS code format');
    }

    // 2. Делегирование в репозиторий
    const result = await this.authRepository.verifySmsCode(port);

    // 3. Дополнительная обработка (если требуется по бизнес-логике)
    if (!result.sessionToken) {
      throw new Error('Session token missing');
    }

    return result;
  }
}

export { VerifySmsCodeUseCase };
```

### Шаг 3. Инфраструктурная реализация (Data)

Слой Data выполняет HTTP-запрос и обрабатывает ответы сервера.

```typescript
// data/repositories/auth/auth-repository.ts
import type { IAuthRepository } from '../../../domain/auth/interface/repository';
import type { IVerifySmsCodePort } from '../../../domain/auth/interface/port';
import type { IAuthSessionDto } from '../../../domain/auth/interface/dto';

class AuthRepository implements IAuthRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async verifySmsCode(port: IVerifySmsCodePort): Promise<IAuthSessionDto> {
    try {
      const response = await this.httpClient.post('/api/v1/auth/verify', {
        phone: port.phoneNumber,
        code: port.smsCode,
        fingerprint: port.deviceFingerprint,
      });

      // Маппинг ответа API в доменный DTO
      return {
        sessionToken: response.data.access_token,
        userGuid: response.data.user_guid,
        deviceFingerprint: port.deviceFingerprint,
      };
    } catch (error) {
      // Трансформация сетевых ошибок в доменные или инфраструктурные
      if (error.response?.status === 401) {
        throw new Error('Invalid SMS code');
      }
      throw new Error('Network error');
    }
  }
}

export { AuthRepository };
```

### Шаг 4. Интеграция в App-слой (Мутация)

В слое App мы используем `useMutation` (например, из TanStack Query) для управления жизненным циклом запроса. Здесь же происходят все **побочные эффекты**: навигация, сохранение токенов в SecureStore, показ алертов.

```typescript
// app/modules/auth/hooks/use-verify-sms-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VerifySmsCodeUseCase } from '../../../domain/auth/use-case/verify-sms-code';
import { authRepositoryInstance } from '../../../data/repositories/auth/auth-repository';
import { secureStorageAdapter } from '../../../data/storage/secure-storage';
import { router } from 'expo-router';

// Инициализация use-case (в реальном проекте через DI или фабрику)
const verifySmsCodeUseCase = new VerifySmsCodeUseCase(authRepositoryInstance);

export function useVerifySmsMutation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (port: IVerifySmsCodePort) => verifySmsCodeUseCase.execute(port),
    
    onSuccess: async (data: IAuthSessionDto) => {
      // 1. Сохранение данных в нативное хранилище (Side Effect)
      await secureStorageAdapter.setSessionToken(data.sessionToken);
      
      // 2. Инвалидация связанных запросов
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      
      // 3. Навигация (Side Effect)
      router.replace('/home');
    },
    
    onError: (error: Error) => {
      // Обработка ошибок UI (показ уведомления)
      console.error('Verification failed:', error.message);
      // showAlert('Ошибка входа', error.message);
    }
  });

  return mutation;
}
```

### Шаг 5. UI Компонент

Компонент подписывается на статус мутации (`isLoading`, `isError`) для управления состоянием формы.

```tsx
// app/modules/auth/components/sms-verification-screen.tsx

export function SmsVerificationScreen() {
  const [code, setCode] = useState('');
  const mutation = useVerifySmsMutation();

  const handleConfirm = () => {
    mutation.mutate({
      phoneNumber: '+79990000000',
      smsCode: code,
      deviceFingerprint: 'device-id-123',
    });
  };

  return (
    <View>
      <TextInput 
        value={code} 
        onChangeText={setCode} 
        editable={!mutation.isPending} 
      />
      
      <Button 
        title="Подтвердить" 
        onPress={handleConfirm} 
        disabled={mutation.isPending} 
      />
      
      {mutation.isPending && <Text>Проверка кода...</Text>}
      {mutation.isError && <Text style={color.red}>{mutation.error.message}</Text>}
    </View>
  );
}

```
![case post запроса](/img/case.png)

## Отличия Query и Mutation в архитектуре

| Характеристика | Query (GET) | Mutation (POST/PUT/DELETE) |
| :--- | :--- | :--- |
| **React Query Hook** | `useQuery` | `useMutation` |
| **Когда выполняется** | Автоматически при монтировании | Вручную через `.mutate()` |
| **Кэширование** | Да (с настройками staleTime) | Нет (всегда свежий вызов) |
| **Побочные эффекты** | Обычно нет (чистые данные) | Много (навигация, сторадж, тосты) |
| **Место эффектов** | В `useEffect` от `data` или `onSuccess` | В `onSuccess` / `onError` коллбэках |
| **Пример из ТЗ** | Получение профиля, списка пропусков | Вход по SMS, генерация QR, выход |

## Чек-лист для мутаций

- [ ] Use-case находится в `domain/use-case` и не зависит от UI?
- [ ] Репозиторий реализует интерфейс из `domain/interface`?
- [ ] `onSuccess` в хуке не содержит бизнес-логику, только координацию (навигация, кэш)?
- [ ] Ошибки сети корректно маппятся в понятные сообщения для пользователя?
- [ ] Интерфейс блокируется (`disabled`) на время выполнения мутации?

## Дальнейшее чтение

- [Управление состоянием](../cross-cutting/state-management) — как правильно хранить сессию после успешного входа
- [Безопасность и нативные модули](../cross-cutting/native-integration.md) — работа с SecureStore и биометрией
- [Стандарты кода](../coding-standards.md)