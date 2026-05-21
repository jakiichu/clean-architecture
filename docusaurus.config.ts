import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import path from 'path';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: 'Clean Architecture Frontend',
    tagline: 'Архитектурная методология для фронтенд и мобильных проектов',
    favicon: 'img/logo.png',

    future: {
        v4: true,
    },

    plugins: [
        function webpackAliasPlugin() {
            return {
                name: 'webpack-alias-plugin',
                configureWebpack() {
                    return {
                        resolve: {
                            alias: {
                                '@': path.resolve(__dirname, 'src'),
                                '@domain': path.resolve(__dirname, 'src/domain'),
                                '@data': path.resolve(__dirname, 'src/data'),
                                '@app': path.resolve(__dirname, 'src/app'),
                            },
                        },
                    };
                },
            };
        },
        [
            require.resolve('@easyops-cn/docusaurus-search-local'),
            {
                hashed: true,
                language: ['en', 'ru'],
                indexBlog: false,
                docsRouteBasePath: '/docs',
            },
        ],
    ],

    url: 'https://your-domain.com',
    baseUrl: '/',

    organizationName: 'Dirty architecture',
    projectName: 'clean-architecture-docs',

    onBrokenLinks: 'throw',

    i18n: {
        defaultLocale: 'ru',
        locales: ['ru'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    routeBasePath: '/docs',
                    editUrl: 'https://github.com/your-org/clean-architecture-docs/edit/main/',
                    showLastUpdateTime: true,
                    showLastUpdateAuthor: true,
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        image: 'img/social-card.jpg',
        colorMode: {
            defaultMode: 'light',
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        docs: {
            sidebar: {
                hideable: true,
                autoCollapseCategories: true,
            },
        },
        navbar: {
            title: 'Clean Architecture',
            logo: {
                alt: 'Logo',
                src: 'img/logo.png',
                href: '/docs/intro',
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'tutorialSidebar',
                    position: 'left',
                    label: 'Документация',
                    path: '/docs/intro'
                }
            ],
        },
        footer: {
            style: 'light',
            links: [
                {
                    title: 'Основы',
                    items: [
                        {label: 'Введение', to: '/docs/intro'},
                        {label: 'Обзор архитектуры', to: '/docs/architecture-overview'},
                        {label: 'Слои архитектуры', to: '/docs/layers'},
                        {label: 'Стандарты кода', to: '/docs/coding-standards'},
                        {label: 'Обработка ошибок', to: '/docs/error-handling'},
                    ],
                },
                {
                    title: 'Примеры',
                    items: [
                        {label: 'GET-запрос', to: '/docs/examples/feature-get'},
                        {label: 'Мутация (POST)', to: '/docs/examples/feature-post'},
                        {label: 'Polling + таймер', to: '/docs/examples/polling'},
                        {label: 'Многошаговая форма', to: '/docs/examples/form-validation'},
                        {label: 'Оффлайн-режим', to: '/docs/examples/offline-mode'},
                    ],
                },
                {
                    title: 'Сквозные механизмы',
                    items: [
                        {label: 'Управление состоянием', to: '/docs/cross-cutting/state-management'},
                        {label: 'Внедрение зависимостей', to: '/docs/cross-cutting/di'},
                        {label: 'Навигация', to: '/docs/navigation'},
                        {label: 'Тестирование', to: '/docs/testing'},
                        {label: 'Глоссарий', to: '/docs/glossary'},
                    ],
                },
            ],
            copyright: `© ${new Date().getFullYear()} Clean Architecture Frontend`,
        },
        prism: {
            theme: prismThemes.vsLight,
            darkTheme: prismThemes.nightOwl,
            additionalLanguages: ['typescript', 'javascript', 'bash', 'json', 'markdown'],
        },
        tableOfContents: {
            minHeadingLevel: 2,
            maxHeadingLevel: 4,
        },
    } satisfies Preset.ThemeConfig,

    markdown: {
        mermaid: true,
        hooks: {
            onBrokenMarkdownLinks: 'warn',
        },
    },
};

export default config;