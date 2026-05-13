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
    ],

    url: 'https://your-domain.com',
    baseUrl: '/',

    organizationName: 'Dirty architecture',
    projectName: 'clean-architecture-docs',

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

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
            style: 'dark',
            links: [
                {
                    title: 'Документация',
                    items: [
                        { label: 'Введение', to: '/docs/intro' },
                        { label: 'Архитектура', to: '/docs/architecture-overview' },
                        { label: 'Стандарты кода', to: '/docs/coding-standards' },
                        { label: 'Глоссарий', to: '/docs/glossary' },
                    ],
                },
            ],
            copyright: `© ${new Date().getFullYear()} Clean Architecture Frontend. Built with Docusaurus.`,
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
    },
};

export default config;