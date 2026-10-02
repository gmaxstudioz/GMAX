import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'Terms of Service for GMAX Studioz.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
