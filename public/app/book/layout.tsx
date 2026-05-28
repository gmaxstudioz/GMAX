import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Book a Session',
    description: 'Book your cinematic photography or videography session with GMAX Studioz today.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
