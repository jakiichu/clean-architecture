---
title: Пример реализации фичи(post запрос)
sidebar_position: 2
---

## 1. Типизация данных

**Файл:** `src/domain/user/interface/entities/index.ts`

```ts
interface IUserEntities {
    name: string
    email: string
    avatar_url: string
}

export type {IUserEntities}
```

Вынесли в сущность, чтоб избавиться от дублирования кода в port и в dto

**Файл:** `src/domain/specialities/interface/dto/index.ts`

```ts
import type {IBaseGetPaginationDto} from '@/domain/common/interface'
import type {IUserEntities} from '../entities'

interface IBaseUserDto extends IUserEntities {
    id: string
}

type IUserArrayDto = Array<IBaseUserDto>

type IGetAllUserDto = IBaseGetPaginationDto<IUserArrayDto>
type ICreateUserDto = IBaseUserDto

export type {IBaseUserDto, IGetAllUserDto, ICreateUserDto}
```

---

## 2. Контракт порта

Файл: `src/domain/user/interface/port/index.ts`

```ts
import type {IBasePaginationPort} from '@/domain/common/interface'
import type {IUserEntities} from '@/domain/user/interface/entities'

type IGetAllUserPort = IBasePaginationPort
type ICreateUserPort = IUserEntities

export type {IGetAllUserPort, ICreateUserPort}

```

---

## 3. Контракт репозитория

Файл: `src/domain/user/interface/repository/index.ts`

```ts
import type {ICreateUserDto, IGetAllUserDto} from '../dto'
import type {ICreateUserPort, IGetAllUserPort} from '../port'

interface IUserRepository {
    getAll: (port: IGetAllUserPort) => Promise<IGetAllUserDto>
    create: (port: ICreateUserPort) => Promise<ICreateUserDto>
}

export type {IUserRepository}
```

---

## 4. Контракт use-case

Файл: `src/domain/user/interface/use-case/index.ts`

```ts
import type {IUseCase} from '@/domain/common/http/use-case'
import type {ICreateUserDto, IGetAllUserDto} from '../dto'
import type {ICreateUserPort, IGetAllUserPort} from '../port'

type IGetAllUsersUseCase = IUseCase<IGetAllUserPort, IGetAllUserDto>
type ICreateUsersUseCase = IUseCase<ICreateUserPort, ICreateUserDto>

export type {IGetAllUsersUseCase, ICreateUsersUseCase}
```

---

## 5. Реализация use-case

Файл: `src/domain/user/use-case/get-all/index.ts`

```ts
import type {ICreateUserDto} from '@/domain/user/interface/dto'

import type {ICreateUsersUseCase} from '@/domain/user/interface/use-case'

import type {ICreateUserPort} from '@/domain/user/interface/port'

import {BaseUsersUseCase} from '@/domain/user/common/use-case'

class CreateUsersUseCase extends BaseUsersUseCase implements ICreateUsersUseCase {
    public async execute(port: ICreateUserPort): Promise<ICreateUserDto> {
        return this._repository.create(port)
    }
}

export {CreateUsersUseCase}
```

Файл: `src/domain/user/common/use-case/index.ts`

```ts
import type {IUserRepository} from '@/domain/user/interface/repository'

class BaseUsersUseCase {
    protected readonly _repository: IUserRepository

    constructor(UsersRepository: IUserRepository) {
        this._repository = UsersRepository
    }
}

export {BaseUsersUseCase}
```

BaseUsersUseCase уменьшает дублирование кода и позволяет переиспользовать репозиторий для других use-case.

---

## 6. Слой Data (FAKE API)

Файл: `src/data/repository/user/index.ts`

```ts
import {times} from 'es-toolkit/compat'

import {random} from 'es-toolkit'

import {HUNDRED, TEN} from '@/app/common/const'

import type {IBaseHttpService} from '@/data/repository/common'


import type {ICreateUserDto, IGetAllUserDto} from '@/domain/user/interface/dto'
import type {IUserRepository} from '@/domain/user/interface/repository'
import type {ICreateUserPort, IGetAllUserPort} from '@/domain/user/interface/port'

import {BaseRepository} from '@/data/repository/common'

class UserRepository extends BaseRepository implements IUserRepository {
    constructor(httpService: IBaseHttpService) {
        super(httpService)
    }

    //...

    async create(port: ICreateUserPort): Promise<ICreateUserDto> {
        return new Promise<ICreateUserDto>((resolve) => {
            resolve({
                id: crypto.randomUUID(),
                ...port,
            })
        })
    }
}

export {UserRepository}

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

Файл: `src/app/modules/user/case/registration/case/request/index.ts`

```ts
import {useMutation} from '@tanstack/react-query'

import type {ICreateUserDto} from '@/domain/user/interface/dto'

import type {ICreateUserPort} from '@/domain/user/interface/port'

import {USER_REPOSITORY} from '@/data/singleton'
import {CreateUsersUseCase} from '@/domain/user/use-case/create'

const useCase = new CreateUsersUseCase(USER_REPOSITORY)

const useCreateUserRequest = () => {
    const callback = async (port: ICreateUserPort): Promise<ICreateUserDto> => {
        return useCase.execute(port)
    }
    return useMutation({mutationFn: callback})
}

export {useCreateUserRequest}
```

---

## 8. Presenter

Файл: `src/app/modules/user/case/table/case/presenter/index.ts`

```ts
import {useAppForm} from '@/app/tools/provider/tanstack-form'

import {useCreateUserRequest} from '../request'

import type {ICreateUserPort} from '@/domain/user/interface/port'

const useCreateUserPresenter = () => {
    const {mutateAsync, ...props} = useCreateUserRequest()

    const handleOnSuccess = () => {
        form.reset()
    }

    const mutateWithReset = async (port: ICreateUserPort) => {
        return mutateAsync(port, {
            onSuccess: handleOnSuccess,
        })
    }

    const form = useAppForm({
        defaultValues: {
            name: '',
            email: '',
            avatar_url: '',
        },
        validators: {onSubmit: async ({value}) => mutateWithReset(value)},
    })

    return {
        form,
        ...props,
    }
}
export {useCreateUserPresenter}
```
