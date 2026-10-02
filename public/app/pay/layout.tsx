import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
    title: `Pay — ${APP_NAME}`,
    description: "Complete your payment securely",
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster richColors position="top-right" />
        </>
    );
}
