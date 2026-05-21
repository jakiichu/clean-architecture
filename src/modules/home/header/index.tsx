import type {ReactNode} from 'react';
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";
import {ArchBackground} from "@/modules/home/arch-background";

const ArchDiagram = (): ReactNode => (
    <div className={styles.diagram}>
        <div className={styles.diagramWindow}>
            <div className={styles.diagramBar}>
                <span className={styles.dot}/>
                <span className={styles.dot}/>
                <span className={styles.dot}/>
                <span className={styles.diagramTitle}>clean-architecture</span>
            </div>
            <div className={styles.diagramBody}>
                <div className={`${styles.layer} ${styles.layerApp}`}>
                    <div className={styles.layerHeader}>
                        <span className={styles.layerLabel}>App</span>
                        <span className={styles.layerBadge}>Presentation</span>
                    </div>
                    <span className={styles.layerDesc}>UI · Presenters · Hooks · Guards</span>
                </div>

                <div className={styles.layerArrow}>
                    <div className={styles.arrowLine}>
                        <span className={styles.arrowIcon}>↕</span>
                        <span className={styles.arrowLabel}>Dependency Rule</span>
                    </div>
                </div>

                <div className={`${styles.layer} ${styles.layerDomain}`}>
                    <div className={styles.layerHeader}>
                        <span className={styles.layerLabel}>Domain</span>
                        <span className={styles.layerBadge}>Core ★</span>
                    </div>
                    <span className={styles.layerDesc}>Use Cases · Entities · Ports</span>
                </div>

                <div className={styles.layerArrow}>
                    <span className={styles.arrowIcon}>↕</span>
                </div>

                <div className={`${styles.layer} ${styles.layerData}`}>
                    <div className={styles.layerHeader}>
                        <span className={styles.layerLabel}>Data</span>
                        <span className={styles.layerBadge}>Infrastructure</span>
                    </div>
                    <span className={styles.layerDesc}>Repositories · Adapters · HTTP</span>
                </div>
            </div>
            <div className={styles.diagramFooter}>
                <span className={styles.diagramRule}>App → Domain ← Data</span>
            </div>
        </div>
    </div>
);

const HomepageHeader = (): ReactNode => (
    <header className={styles.hero}>
        <ArchBackground/>
        <div className={styles.heroContent}>
            <div className={styles.heroLeft}>
                <div className={styles.badge}>Архитектурная методология</div>

                <h1 className={styles.title}>
                    Clean Architecture<br/>
                    <span className={styles.titleGradient}>Frontend</span>
                </h1>

                <p className={styles.subtitle}>
                    Принципы, паттерны и практические примеры для масштабируемых
                    фронтенд-приложений. От Domain-контрактов до UI-компонентов —
                    с чёткими границами между слоями.
                </p>

                <div className={styles.buttons}>
                    <Link className={styles.buttonPrimary} to="/architecture/intro">
                        Начать читать →
                    </Link>
                    <Link className={styles.buttonGhost} to="/architecture/examples">
                        Примеры реализации
                    </Link>
                </div>

                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>3</span>
                        <span className={styles.statLabel}>архитектурных слоя</span>
                    </div>
                    <div className={styles.statDivider}/>
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>5</span>
                        <span className={styles.statLabel}>ключевых принципов</span>
                    </div>
                    <div className={styles.statDivider}/>
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>6</span>
                        <span className={styles.statLabel}>практических примеров</span>
                    </div>
                </div>
            </div>

            <div className={styles.heroRight}>
                <ArchDiagram/>
            </div>
        </div>
    </header>
);

export default HomepageHeader;
