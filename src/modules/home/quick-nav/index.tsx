import type {ReactNode} from 'react';
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

interface NavCard {
    icon: string;
    title: string;
    description: string;
    to: string;
    accentColor: string;
}

const navCards: NavCard[] = [
    {
        icon: '🏗️',
        title: 'Обзор архитектуры',
        description: 'Dependency Rule, поток данных, модульность и правила взаимодействия слоёв',
        to: '/docs/architecture-overview',
        accentColor: '#2563eb',
    },
    {
        icon: '📐',
        title: 'Слои архитектуры',
        description: 'App, Domain, Data — зоны ответственности, структура директорий, что где лежит',
        to: '/docs/layers',
        accentColor: '#6366f1',
    },
    {
        icon: '💡',
        title: 'Примеры реализации',
        description: 'GET, Mutation, Polling, Форма, Offline, Нативные модули — с кодом по шагам',
        to: '/docs/examples',
        accentColor: '#f59e0b',
    },
    {
        icon: '🎯',
        title: 'Стандарты кода',
        description: 'Правила именования, типизации, организации экспортов и Git-flow',
        to: '/docs/coding-standards',
        accentColor: '#10b981',
    },
    {
        icon: '🧪',
        title: 'Тестирование',
        description: 'Unit-тесты Domain, моки Data, тесты хуков App — пирамида и паттерны',
        to: '/docs/testing',
        accentColor: '#06b6d4',
    },
    {
        icon: '📖',
        title: 'Глоссарий',
        description: 'Все термины документации: DTO, Port, Use-case, Adapter и другие',
        to: '/docs/glossary',
        accentColor: '#8b5cf6',
    },
];

const QuickNavCard = ({icon, title, description, to, accentColor}: NavCard): ReactNode => (
    <Link
        className={styles.card}
        to={to}
        style={{'--card-accent': accentColor} as React.CSSProperties}
    >
        <div className={styles.cardTop}>
            <span className={styles.cardIcon}>{icon}</span>
            <span className={styles.cardArrow}>→</span>
        </div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
    </Link>
);

const HomepageQuickNav = (): ReactNode => (
    <section className={styles.section}>
        <div className="container">
            <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>Навигация</span>
                <h2 className={styles.sectionTitle}>Разделы документации</h2>
            </div>
            <div className={styles.grid}>
                {navCards.map((card, idx) => (
                    <QuickNavCard key={idx} {...card} />
                ))}
            </div>
        </div>
    </section>
);

export default HomepageQuickNav;
