import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
    title: "Pay — GMAX Studioz",
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
