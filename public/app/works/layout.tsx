import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Portfolio',
    description: 'Explore our portfolio of cinematic visual stories and stunning imagery.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
