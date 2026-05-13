import type {ReactNode} from "react";

interface FeatureItem {
    title: string;
    icon: string;
    accentColor: string;
    bgColor: string;
    description: ReactNode;
}

export type {FeatureItem};
