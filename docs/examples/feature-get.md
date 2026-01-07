---
title: Пример реализации фичи(get запрос)
sidebar_position: 1
---

# Теоретическая часть

Перед тем как перейти к реализации, важно зафиксировать архитектурные принципы, на которых построен данный пример.

---

### Почему разработка начинается с `domain`

Слой `domain` является центральным элементом архитектуры.  
Именно здесь описываются:

- бизнес-сущности;
- бизнес-сценарии (use-case);
- контракты взаимодействия между слоями.

Разработка всегда начинается с `domain`, потому что:

- UI не должен диктовать бизнес-логику;
- инфраструктура (`data`) — это деталь реализации;
- типы и контракты формируют «язык» системы.

---

### Контракты важнее реализации

В примере сначала создаются:

- **DTO** — формат данных, возвращаемых бизнес-сценарием;
- **Port** — входные параметры use-case;
- **Repository interface** — абстракция доступа к данным;
- **Use-case interface** — контракт бизнес-сценария.

Только после этого появляются:

- конкретные use-case;
- репозитории;
- React-код.

Это позволяет:

- легко менять источник данных;
- тестировать use-case изолированно;
- не связывать бизнес-логику с UI или HTTP.

---

### Почему используется пагинация через `common`

Пагинация — это **сквозная концепция**, которая может использоваться в разных модулях (users, products, orders и т.д.).

Поэтому:

- `IBasePaginationPort`
- `IBaseGetPaginationDto`

Вынесены в `domain/common`.

Такой подход:

- предотвращает дублирование;
- формирует единый стандарт API;
- упрощает масштабирование проекта.

---

### Роль use-case

Use-case — это **чёрный ящик бизнес-логики**:

- принимает входные данные через порт;
- работает только через интерфейсы;
- возвращает DTO;
- не знает ничего о React, HTTP или TanStack Query.

В данном примере `GetAllUsersUseCase`:

- не содержит логики пагинации UI;
- не знает, откуда приходят данные;
- просто координирует бизнес-сценарий.

---

### Почему `BaseUsersUseCase`

`BaseUsersUseCase` — это технический базовый класс, который:

- инкапсулирует работу с репозиторием;
- уменьшает дублирование кода;
- упрощает добавление новых use-case.

При появлении новых сценариев:

- `GetUserById`
- `CreateUser`
- `DeleteUser`

Они смогут использовать тот же базовый класс.

---

### Разделение `request` и `presenter` в App-слое

В слое `app` логика разделена на два уровня:

#### `request`

- отвечает за асинхронные операции;
- использует **TanStack Query**;
- знает про кэш, статусы, рефетчи;
- вызывает use-case.

#### `presenter`

- агрегирует данные;
- управляет формами и состоянием UI;
- подготавливает данные для компонентов;
- не содержит JSX.

Такое разделение:

- упрощает тестирование;
- делает код предсказуемым;
- снижает связанность компонентов.

---

### Почему TanStack Query используется только в `app`

TanStack Query — это UI-инструмент.

Он:

- управляет состоянием загрузки;
- кеширует данные;
- синхронизирует UI с сервером.

---

# Практическая часть

## 1. Типизация данных

В базе данных у пользователя есть поля: `id`, `name`, `email`, `avatar_url`, `password`.  
Пароль не должен приходить с API, поэтому типизируем только первые 4 поля.

**Файл:** `src/domain/user/interface/dto/index.ts`

```ts
interface IBaseUserDto {
    id: string
    name: string
    email: string
    avatar_url: string
}

type IUserArrayDto = Array<IBaseUserDto>

type IGetAllUserDto = IBaseGetPaginationDto<IUserArrayDto>

export type {IBaseUserDto, IGetAllUserDto}

```

---

## 2. Контракт порта для пагинации

Простая пагинация, вынесенная в common для переиспользования в других модулях.

Файл: `src/domain/user/interface/port/index.ts`

```ts
import type {IBasePaginationPort} from '@/domain/common/interface'

type IGetAllUserPort = IBasePaginationPort

export type {IGetAllUserPort}
```

Файл: `src/domain/common/interface/index.ts`

```ts
interface IBaseGetPaginationDto<T> {
    count: number
    data: T
    page: number
}

interface IBasePaginationPort {
    page: number
    limit: number
}

export type {IBaseGetPaginationDto, IBasePaginationPort}
```

Контракты вынесены в common, чтобы их можно было использовать повторно.

---

## 3. Контракт репозитория

Файл: `src/domain/user/interface/repository/index.ts`

``` 
import type { IGetAllUserDto } from '../dto'
import type { IGetAllUserPort } from '../port'

interface IUserRepository {
    getAll: (port: IGetAllUserPort) => Promise<IGetAllUserDto>
}

export type { IUserRepository }
```

---

## 4. Контракт use-case

Файл: `src/domain/user/interface/use-case/index.ts`

```
import type { IUseCase } from '@/domain/common/http/use-case'
import type { IGetAllUserDto } from '../dto'
import type { IGetAllUserPort } from '../port'

type IGetAllUsersUseCase = IUseCase<IGetAllUserPort, IGetAllUserDto>

export type { IGetAllUsersUseCase }

```

Файл: `src/domain/common/http/use-case/index.ts`

```
interface IUseCase<TPort, TResponse> {
    execute: (port: TPort) => Promise<TResponse>
}

export type { IUseCase }
```

Для абстракции используем дженерики.

---

## 5. Реализация use-case

Файл: `src/domain/user/use-case/get-all/index.ts`

```
import type { IGetAllUserDto } from '@/domain/user/interface/dto'

import type { IGetAllUsersUseCase } from '@/domain/user/interface/use-case'

import type { IGetAllUserPort } from '@/domain/user/interface/port'

import { BaseUsersUseCase } from '@/domain/user/common/use-case'

class GetAllUsersUseCase extends BaseUsersUseCase implements IGetAllUsersUseCase {
    public async execute(port: IGetAllUserPort): Promise<IGetAllUserDto> {
        return this._repository.getAll(port)
    }
}

export { GetAllUsersUseCase }

```

Файл: `src/domain/user/common/use-case/index.ts`

```
import type { IUserRepository } from '@/domain/user/interface/repository'

class BaseUsersUseCase {
    protected readonly _repository: IUserRepository

    constructor(UsersRepository: IUserRepository) {
        this._repository = UsersRepository
    }
}

export { BaseUsersUseCase }
```

BaseUsersUseCase уменьшает дублирование кода и позволяет переиспользовать репозиторий для других use-case.

---

## 6. Слой Data (FAKE API)

Файл: `src/data/repository/user/index.ts`

``` 
import type { IBaseHttpService } from '@/data/repository/common'

import type { IGetAllUserDto } from '@/domain/user/interface/dto'
import type { IUserRepository } from '@/domain/user/interface/repository'
import type { IGetAllUserPort } from '@/domain/user/interface/port'

import { BaseRepository } from '@/data/repository/common'

class UserRepository extends BaseRepository implements IUserRepository {
    constructor(httpService: IBaseHttpService) {
        super(httpService)
    }

    async getAll({ page, limit }: IGetAllUserPort): Promise<IGetAllUserDto> {
        const createArray = times(random(TEN, HUNDRED))

        return new Promise((resolve) => {
            resolve({
                count: createArray.length,
                data: createArray
                    .map((_, index) => ({
                        id: index.toString(),
                        name: `User ${index}`,
                        email: `text@mail.com${index}`,
                        avatar_url: '',
                    }))
                    .slice(limit * page, limit * page + limit),
                page,
            })
        })
    }
}

export { UserRepository }
```

Файл: `src/data/singleton/index.ts`

``` 
import { HTTP_APP_SERVICE } from '@/data/repository/common'
import { UserRepository } from '@/data/repository/user'

const USER_REPOSITORY = new UserRepository(HTTP_APP_SERVICE)

export { USER_REPOSITORY }
```

---

## 7. Слой App (TanStack Query)

Файл: `src/app/modules/user/case/table/case/request/index.ts`

``` 
import { useQuery } from '@tanstack/react-query'

import { EQueryKey } from '@/domain/common/query/enum/query'

import type { IGetAllUserDto } from '@/domain/user/interface/dto'

import type { IGetAllUserOptions } from '../interface'

import type { IGetAllUserPort } from '@/domain/user/interface/port'

import { GetAllUsersUseCase } from '@/domain/user/use-case/get-all'
import { USER_REPOSITORY } from '@/data/singleton'

const useCase = new GetAllUsersUseCase(USER_REPOSITORY)

const useGetAllUserRequest = (port: IGetAllUserPort, options?: IGetAllUserOptions) => {
    const callback = async (): Promise<IGetAllUserDto> => {
        return useCase.execute(port)
    }
    return useQuery({ queryFn: callback, queryKey: [EQueryKey.GET_ALL_USER, port], ...options })
}

export { useGetAllUserRequest }

```

---

## 8. Presenter

Файл: `src/app/modules/user/case/table/case/presenter/index.ts`

```
import { useStore } from '@tanstack/react-form'

import { useAppForm } from '@/app/tools/provider/tanstack-form'

import { useGetAllUserRequest } from '../request'

import type { IGetAllUserOptions } from '../interface'
import type { IGetAllUserDto } from '@/domain/user/interface/dto'

const initialDataValue: IGetAllUserDto = { page: 0, data: [], count: 0 }

const useGetAllUserPresenter = (options?: IGetAllUserOptions) => {
    const form = useAppForm({
        defaultValues: {
            pagination: {
                page: 0,
                limit: 10,
            },
        },
    })

    const { pagination } = useStore(form.store, (state) => state.values)

    const { data = initialDataValue, ...props } = useGetAllUserRequest(pagination, options)
    return {
        data,
        form,
        ...props,
    }
}
export { useGetAllUserPresenter }

```
