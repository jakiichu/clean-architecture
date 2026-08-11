---
title: Пример реализации фичи (Мутация)
sidebar_position: 3
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

Для примера возьмём сценарий проверки SMS-кода при авторизации.

```typescript
// domain/auth/interface/dto.ts
interface IAuthSessionDto {
  sessionToken: string;
  userGuid: string;
}
```

```typescript
// domain/auth/interface/port.ts
interface IVerifySmsCodePort {
  phoneNumber: string;
  smsCode: string;
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
      throw new InvalidSmsCodeFormatError();
    }

    // 2. Делегирование в репозиторий
    const result = await this.authRepository.verifySmsCode(port);

    // 3. Дополнительная обработка (если требуется по бизнес-логике)
    if (!result.sessionToken) {
      throw new InvalidSessionResponseError();
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
      });

      // Маппинг ответа API в доменный DTO
      return {
        sessionToken: response.data.access_token,
        userGuid: response.data.user_guid,
      };
    } catch (error) {
      // Трансформация сетевых ошибок в доменные или инфраструктурные
      if (isHttpError(error) && error.response?.status === 401) {
        throw new InvalidSmsCodeError();
      }
      if (isNetworkError(error)) throw new NetworkUnavailableError();
      throw new UnexpectedInfrastructureError({ cause: error });
    }
  }
}

export { AuthRepository };
```

### Шаг 4. Интеграция в App-слой (Мутация)

В слое App `useMutation` управляет presentation-жизненным циклом запроса. Навигация, инвалидация query-cache и показ сообщения остаются в App. Сохранение сессии является частью сценария успешного входа и выполняется use case через порт защищённого хранилища.

```typescript
// app/modules/auth/hooks/use-verify-sms-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApplicationDependencies } from '../../../app/providers/ApplicationProvider';
import { InvalidSmsCodeError, NetworkUnavailableError } from '../../../domain/auth/errors';
import { router } from 'expo-router';

export function useVerifySmsMutation() {
  const { auth } = useApplicationDependencies();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (port: IVerifySmsCodePort) => auth.verifySmsCode.execute(port),
    
    onSuccess: async () => {
      // Сессия уже атомарно сохранена use case через Domain-порт.
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      router.replace('/home');
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
      {mutation.error instanceof InvalidSmsCodeError && (
        <Text style={color.red}>Код не подошёл. Проверьте его и повторите.</Text>
      )}
      {mutation.error instanceof NetworkUnavailableError && (
        <Text style={color.red}>Нет соединения с сервером.</Text>
      )}
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
| **Пример** | Получение профиля, ленты уведомлений | Вход по SMS, отправка формы, выход |

## Чек-лист для мутаций

- [ ] Use-case находится в `domain/use-case` и не зависит от UI?
- [ ] Репозиторий реализует интерфейс из `domain/interface`?
- [ ] `onSuccess` в хуке не содержит бизнес-логику, только координацию (навигация, кэш)?
- [ ] Ошибки сети корректно маппятся в понятные сообщения для пользователя?
- [ ] Интерфейс блокируется (`disabled`) на время выполнения мутации?

## Дальнейшее чтение

- [Управление состоянием](../cross-cutting/state-management.md) — как правильно хранить сессию после успешного входа
- [Безопасность и нативные модули](./native-integration.md) — работа с SecureStore и биометрией
- [Стандарты кода](../coding-standards.md)
