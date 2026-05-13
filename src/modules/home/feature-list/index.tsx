import type {ReactNode} from 'react';
import styles from './styles.module.css';
import {FeatureItem} from "./interface";
import {FeatureList} from "./const";

interface FeatureCardProps extends FeatureItem {}

const FeatureCard = ({title, icon, accentColor, bgColor, description}: FeatureCardProps): ReactNode => (
    <div className={styles.card}>
        <div
            className={styles.iconWrap}
            style={{background: bgColor, border: `1px solid ${accentColor}22`}}
        >
            {icon}
        </div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
    </div>
);

const HomepageFeatures = (): ReactNode => (
    <section className={styles.section}>
        <div className="container">
            <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>Принципы</span>
                <h2 className={styles.sectionTitle}>Почему чистая архитектура</h2>
                <p className={styles.sectionSubtitle}>
                    Шесть фундаментальных свойств, которые делают систему предсказуемой,
                    тестируемой и устойчивой к изменениям.
                </p>
            </div>
            <div className={styles.grid}>
                {FeatureList.map((item, idx) => (
                    <FeatureCard key={idx} {...item} />
                ))}
            </div>
        </div>
    </section>
);

export default HomepageFeatures;
