"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2Icon, Loader2 } from "lucide-react";
import { UpdateClient } from "@/lib/actions/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tryCatch } from "@/hooks/try-catch";
import { Client, ClientSchema, ClientTypeEnum } from "@/lib/schemas/client";
import { Field, FieldLabel } from "@/components/ui/field";

interface EditClientDialogProps {
    clientId: string;
    initialData: Client;
    triggerItem?: React.ReactNode;
}

export function EditClientDialog({ clientId, initialData, triggerItem }: EditClientDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm<Client>({
        resolver: zodResolver(ClientSchema),
        defaultValues: {
            name: initialData.name,
            email: initialData.email,
            phone: initialData.phone || "",
            address: initialData.address,
            notes: initialData.notes,
            type: initialData.type,
        }
    });

    const handleSubmit = (data: Client) => {
        startTransition(async () => {
            const cleanedData = {
                ...data,
                phone: data.phone.trim(),
            };

            const parsedData = ClientSchema.safeParse(cleanedData);
            if (!parsedData.success) {
                toast.error(parsedData.error.issues[0]?.message || "Invalid input data");
                return;
            }

            const { data: result, error } = await tryCatch(UpdateClient(parsedData.data, clientId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Client profile updated successfully");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result?.message || "Failed to update profile");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerItem ? triggerItem : (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Edit2Icon className="h-4 w-4" />
                        Edit Profile
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Client Profile</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
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
                    
                    <Controller
                        name="type"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Client Type</FieldLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {ClientTypeEnum.options.map((clientType) => (
                                                <SelectItem key={clientType} value={clientType}>
                                                    {clientType}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                    
                    <Controller
                        name="email"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Email <span className="text-muted-foreground font-normal">(Optional)</span></FieldLabel>
                                <Input type="email" {...field} value={field.value || ""} />
                            </Field>
                        )}
                    />
                    
                    <Controller
                        name="phone"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Phone Number</FieldLabel>
                                <Input {...field} placeholder="Phone number" required />
                            </Field>
                        )}
                    />

                    <Controller
                        name="address"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Address <span className="text-muted-foreground font-normal">(Optional)</span></FieldLabel>
                                <Input {...field} value={field.value || ""} />
                            </Field>
                        )}
                    />

                    <Controller
                        name="notes"
                        control={form.control}
                        render={({ field }) => (
                            <Field>
                                <FieldLabel>Notes <span className="text-muted-foreground font-normal">(Optional)</span></FieldLabel>
                                <Textarea {...field} value={field.value || ""} className="resize-none" rows={3} />
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
