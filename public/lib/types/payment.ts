export type PublicPaymentDetailsOutput = {
    amount: string;
    status: string;
    isAlreadyPaid: boolean;
    booking: {
        sessionCount: number;
        bookingDate: string;
        client: { name: string; email: string | null } | null;
        service: { name: string; duration: number } | null;
        studio: { name: string; logo: string | null } | null;
        addons: { id: string; name: string }[];
    } | null;
    productAccess: {
        product: { title: string };
        buyer: { name: string; email: string };
    } | null;
};