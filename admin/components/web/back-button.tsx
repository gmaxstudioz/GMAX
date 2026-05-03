"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface BackButtonProps {
    href?: string;
    label?: string;
    className?: string;
}

export function BackButton({ href, label = "Back", className }: BackButtonProps) {
    const router = useRouter();

    if (href) {
        return (
            <Link href={href} className={buttonVariants({ variant: "secondary", className })}>
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                {label}
            </Link>
        );
    }

    return (
        <Button 
            type="button"
            onClick={() => router.back()} 
            className={buttonVariants({ variant: "secondary", className })}
        >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            {label}
        </Button>
    );
}
