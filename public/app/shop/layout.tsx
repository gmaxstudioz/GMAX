import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Store',
    description: 'Browse exclusive digital products, presets, and courses from GMAX Studioz.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
