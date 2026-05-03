"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2Icon, Loader2 } from "lucide-react";
import { updateStaffInfo } from "@/lib/actions/member";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateStaffSchema, UpdateStaffInput, MemberRoleEnum } from "@/lib/schemas/studio";
import { Field, FieldLabel } from "@/components/ui/field";

interface EditStaffDialogProps {
    memberId: string;
    userId: string;
    studioId: string;
    initialData: {
        name: string;
        email: string;
        phoneNumber: string | null;
        role: string;
    };
}

const ROLES = [
    { value: "owner", label: "Owner" },
    { value: "manager", label: "Manager" },
    { value: "photographer", label: "Photographer" },
    { value: "videographer", label: "Videographer" },
    { value: "receptionist", label: "Receptionist" },
];

export function EditStaffDialog({ memberId, userId, studioId, initialData }: EditStaffDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm<UpdateStaffInput>({
        resolver: zodResolver(UpdateStaffSchema),
        defaultValues: {
            name: initialData.name,
            phoneNumber: initialData.phoneNumber || "",
            role: initialData.role as keyof typeof MemberRoleEnum.enum,
        }
    });

    const handleSubmit = (data: UpdateStaffInput) => {
        const parsed = UpdateStaffSchema.safeParse(data);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message || "Invalid staff profile data");
            return;
        }

        startTransition(async () => {
            const res = await updateStaffInfo(memberId, userId, studioId, parsed.data);
            
            if (res.status === "success") {
                toast.success("Staff profile updated successfully");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(res.message || "Failed to update profile");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Edit2Icon className="h-4 w-4" />
                    Edit Profile
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Staff Profile</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 py-4">
                    <Controller
                        name="name"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Full Name</FieldLabel>
                                <Input {...field} required />
                            </Field>
                        )}
                    />
                    
                    <Field>
                        <FieldLabel>Email</FieldLabel>
                        <Input 
                            value={initialData.email} 
                            disabled 
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Email addresses cannot be changed here.</p>
                    </Field>
                    
                    <Controller
                        name="phoneNumber"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Phone Number</FieldLabel>
                                <Input {...field} value={field.value || ""} />
                            </Field>
                        )}
                    />
                    
                    <Controller
                        name="role"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Role</FieldLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map((role) => (
                                            <SelectItem key={role.value} value={role.value}>
                                                {role.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                    
                    <div className="flex w-full justify-end mt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
