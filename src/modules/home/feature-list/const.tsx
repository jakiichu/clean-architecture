import {FeatureItem} from "@/modules/home/feature-list/interface";

const FeatureList: FeatureItem[] = [
    {
        title: 'Независимость от фреймворков',
        src: '/img/ts.png',
        description: (
            <>
                Бизнес-логика не зависит от конкретных библиотек и технологий.
            </>
        ),
    },
    {
        title: 'Удобство тестирования',
        src: '/img/test.png',
        description: (
            <>
                Код легко покрывать тестами, так как основные правила системы не связаны с UI.
            </>
        ),
    },
    {
        title: 'Простота поддержки и расширения',
        src: '/img/extension.png',
        description: (
            <>
                Чёткое разделение ответственности делает проект понятнее и позволяет безопасно добавлять новые функции
                без риска сломать существующие.
            </>
        ),
    },
];

export {FeatureList}
