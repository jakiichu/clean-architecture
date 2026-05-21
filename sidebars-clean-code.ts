import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    cleanCodeSidebar: [
        'intro',
        {
            type: 'category',
            label: 'Основы',
            collapsed: false,
            items: [
                'naming',
                'functions',
                'comments',
                'formatting',
                'error-handling',
                'smr',
                'classes',
                'testing',
            ],
        },
        {
            type: 'category',
            label: 'Создание',
            collapsed: false,
            items: [
                'creation/index',
                'creation/starting-fresh',
                'creation/writing-functions',
                'creation/building-classes',
                'creation/api-design',
            ],
        },
        {
            type: 'category',
            label: 'Анализ',
            collapsed: false,
            items: [
                'analysis/index',
                'analysis/code-smells',
                'analysis/complexity',
                'analysis/coupling-cohesion',
                'analysis/duplication',
            ],
        },
        {
            type: 'category',
            label: 'Рефакторинг',
            collapsed: false,
            items: [
                'refactoring/index',
                'refactoring/techniques',
                'refactoring/extract-method',
                'refactoring/rename',
                'refactoring/replace-conditional',
                'refactoring/safe-refactoring',
            ],
        },
    ],
};

export default sidebars;
