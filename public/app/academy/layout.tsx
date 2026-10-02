import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Academy',
    description: 'Join the GMAX Studioz Academy to master photography, videography, and creative direction.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
