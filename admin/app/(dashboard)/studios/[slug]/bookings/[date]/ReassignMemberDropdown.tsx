"use client";

import { useTransition } from "react";
import { tryCatch } from "@/hooks/try-catch";
import { reassignBooking } from "@/lib/actions/booking";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading01Icon } from "@hugeicons/core-free-icons";
import { MembersOutput } from "@/lib/schemas/studio";

export function ReassignMemberDropdown({ bookingId, currentMemberId, members }: { bookingId: string, currentMemberId?: string | null, members: MembersOutput[] }) {
    const [isPending, startTransition] = useTransition();

    const handleReassign = (newMemberId: string) => {
        startTransition(async () => {
            const { error } = await tryCatch(reassignBooking(bookingId, newMemberId));
            if (error) {
                toast.error("Failed to reassign member");
            } else {
                toast.success("Task reassigned successfully!");
            }
        });
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">Assigned To:</span>
            <Select value={currentMemberId || ""} onValueChange={handleReassign} disabled={isPending}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                    {isPending ? <HugeiconsIcon icon={Loading01Icon} className="animate-spin size-3 mr-2" /> : null}
                    <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                    {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
