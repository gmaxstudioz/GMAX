"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
    const router = useRouter();

    return (
        <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back
        </Button>
    );
}
