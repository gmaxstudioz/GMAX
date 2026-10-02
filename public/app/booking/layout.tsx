import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'My Booking',
    description: 'Manage your booking, view your deliverables, and submit revision requests.'
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
