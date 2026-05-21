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
            require.resolve('@docusaurus/plugin-content-docs'),
            {
                id: 'clean-code',
                path: 'docs-clean-code',
                routeBasePath: 'clean-code',
                sidebarPath: require.resolve('./sidebars-clean-code.ts'),
                editUrl: 'https://github.com/your-org/clean-architecture-docs/edit/main/',
                showLastUpdateTime: true,
                showLastUpdateAuthor: true,
            },
        ],
        [
            require.resolve('@easyops-cn/docusaurus-search-local'),
            {
                hashed: true,
                language: ['en', 'ru'],
                indexBlog: false,
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
                    path: 'docs-architecture',
                    sidebarPath: './sidebars.ts',
                    routeBasePath: 'architecture',
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
                href: '/architecture/intro',
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'tutorialSidebar',
                    position: 'left',
                    label: 'Архитектура',
                    docsPluginId: 'default',
                },
                {
                    type: 'docSidebar',
                    sidebarId: 'cleanCodeSidebar',
                    position: 'left',
                    label: 'Чистый код',
                    docsPluginId: 'clean-code',
                },
            ],
        },
        footer: {
            style: 'light',
            links: [
                {
                    title: 'Основы',
                    items: [
                        {label: 'Введение', to: '/architecture/intro'},
                        {label: 'Обзор архитектуры', to: '/architecture/architecture-overview'},
                        {label: 'Слои архитектуры', to: '/architecture/layers'},
                        {label: 'Стандарты кода', to: '/architecture/coding-standards'},
                        {label: 'Обработка ошибок', to: '/architecture/error-handling'},
                    ],
                },
                {
                    title: 'Примеры',
                    items: [
                        {label: 'GET-запрос', to: '/architecture/examples/feature-get'},
                        {label: 'Мутация (POST)', to: '/architecture/examples/feature-post'},
                        {label: 'Polling + таймер', to: '/architecture/examples/polling'},
                        {label: 'Многошаговая форма', to: '/architecture/examples/form-validation'},
                        {label: 'Оффлайн-режим', to: '/architecture/examples/offline-mode'},
                    ],
                },
                {
                    title: 'Сквозные механизмы',
                    items: [
                        {label: 'Управление состоянием', to: '/architecture/cross-cutting/state-management'},
                        {label: 'Внедрение зависимостей', to: '/architecture/cross-cutting/di'},
                        {label: 'Навигация', to: '/architecture/navigation'},
                        {label: 'Тестирование', to: '/architecture/testing'},
                        {label: 'Глоссарий', to: '/architecture/glossary'},
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