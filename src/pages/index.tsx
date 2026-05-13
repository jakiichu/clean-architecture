import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import HomepageFeatures from "@/modules/home/feature-list";
import HomepageHeader from "@/modules/home/header";
import HomepageQuickNav from "@/modules/home/quick-nav";

const Home = (): ReactNode => (
    <Layout
        title="Clean Architecture Frontend"
        description="Принципы, паттерны и практика для масштабируемых фронтенд-приложений">
        <HomepageHeader/>
        <main>
            <HomepageFeatures/>
            <HomepageQuickNav/>
        </main>
    </Layout>
);

export default Home;
