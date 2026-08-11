import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    cleanCodeSidebar: [
        'intro',
        'conventions',
        {
            type: 'category',
            label: 'Основы читаемого кода',
            collapsed: true,
            items: [
                'naming',
                'comments',
                'formatting',
                'error-handling',
                'srp',
                'testing',
            ],
        },
        {
            type: 'category',
            label: 'Проектирование нового кода',
            collapsed: true,
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
            label: 'Диагностика качества',
            collapsed: true,
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
            label: 'Безопасный рефакторинг',
            collapsed: true,
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
