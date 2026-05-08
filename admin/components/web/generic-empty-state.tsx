import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export interface GenericEmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLink?: string;
    actionText?: string;
    actionIcon?: React.ReactNode;
    className?: string;
}

export function GenericEmptyState({
    icon,
    title,
    description,
    actionLink,
    actionText,
    actionIcon,
    className = "border-2 border-dashed"
}: GenericEmptyStateProps) {
    return (
        <Empty className={className}>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    {icon}
                </EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>
                    {description}
                </EmptyDescription>
            </EmptyHeader>
            {actionLink && actionText && (
                <EmptyContent className="flex-row justify-center gap-2">
                    <Link className={buttonVariants()} href={actionLink}>
                        {actionIcon}
                        {actionText}
                    </Link>
                </EmptyContent>
            )}
        </Empty>
    );
}
