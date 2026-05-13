import {FeatureItem} from "@/modules/home/feature-list/interface";

const FeatureList: FeatureItem[] = [
    {
        title: 'Независимость от фреймворков',
        icon: '🧩',
        accentColor: '#2563eb',
        bgColor: 'rgba(37, 99, 235, 0.08)',
        description: (
            <>
                Бизнес-логика работает с чистыми TypeScript-интерфейсами.
                Замена React на Vue или переход с веба на мобильную платформу
                не затрагивает ядро системы.
            </>
        ),
    },
    {
        title: 'Тестируемость',
        icon: '🧪',
        accentColor: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.08)',
        description: (
            <>
                Use-cases покрываются unit-тестами без моков браузера, эмуляторов
                или реального API. Domain изолирован — тесты быстрые и надёжные.
            </>
        ),
    },
    {
        title: 'Dependency Rule',
        icon: '⬇️',
        accentColor: '#6366f1',
        bgColor: 'rgba(99, 102, 241, 0.08)',
        description: (
            <>
                Зависимости направлены строго внутрь домена: <code>App → Domain ← Data</code>.
                Никаких обратных ссылок. Это исключает циклические связи и скрытые утечки
                ответственности.
            </>
        ),
    },
    {
        title: 'Независимость от UI',
        icon: '🎨',
        accentColor: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.08)',
        description: (
            <>
                Слой представления можно полностью заменить или адаптировать под новую
                платформу — бизнес-правила остаются нетронутыми.
            </>
        ),
    },
    {
        title: 'Независимость от Data',
        icon: '🗄️',
        accentColor: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.08)',
        description: (
            <>
                REST → GraphQL, SQLite → внешний API. Смена источника данных требует
                изменений только в слое Data. Domain и App не меняются.
            </>
        ),
    },
    {
        title: 'Масштабируемость',
        icon: '🚀',
        accentColor: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.08)',
        description: (
            <>
                Команда работает параллельно над независимыми слоями.
                Новые фичи не затрагивают несвязанные модули и не создают
                случайных регрессий.
            </>
        ),
    },
];

export {FeatureList};
