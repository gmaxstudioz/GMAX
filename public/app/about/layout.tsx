import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About Us',
    description: 'Learn more about GMAX Studioz and our cinematic approach to photography and videography.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
