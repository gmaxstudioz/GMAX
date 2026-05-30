"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { tryCatch } from "@/hooks/try-catch";
import { CreateClient } from "@/lib/actions/client";
import { Client, ClientSchema, ClientTypeEnum } from "@/lib/schemas/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, CirclePlusIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AddClientProps {
    studioId: string;
    onSuccess?: (clientId: string) => void;
}

export default function AddClient({ studioId, onSuccess }: AddClientProps) {
    const router = useRouter();
    const [ isPending, startTransition ] = useTransition();
    const [optionalOpen, setOptionalOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const form = useForm<Client>({
        resolver: zodResolver(ClientSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            address: "",
            notes: "",
            type: "regular",
        }
    });

    const handleSubmit = (data: Client) => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(CreateClient(data, studioId));

            if (error) {
                toast.error("An unexpected error occurred. Please try again.");
                return;
            }

            if (result?.status === "success") {
                toast.success("Client added successfully");
                form.reset();
                setIsOpen(false);
                router.refresh();
                const data = result.data as { id: string } | undefined;
                if (onSuccess && data?.id) {
                    onSuccess(data.id);
                }
            } else if (result?.status === "error") {
                toast.error(result?.message);
            }
        });
    }



    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PlusIcon />
                    Add Client
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Add Client</DialogTitle>
                    <DialogDescription>
                        Add a new client to this studio
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <FieldGroup className="flex flex-col gap-3">
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel>Full Name</FieldLabel>
                                    <Input
                                        {...field}
                                        required
                                        placeholder="e.g Greatness Okpata"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            name="phone"
                            control={form.control}
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel>Phone Number</FieldLabel>
                                    <Input
                                        {...field}
                                        required
                                        placeholder="e.g 08000000000"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel>Email Address</FieldLabel>
                                    <Input
                                        {...field}
                                        value={field.value || ""}
                                        placeholder="e.g example@gmail.com"
                                    />
                                </Field>
                            )}
                        />
                        <Controller
                            name="type"
                            control={form.control}
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel>Client Type</FieldLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Client Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {ClientTypeEnum.options.map((clientType) => (
                                                    <SelectItem key={clientType} value={clientType}>
                                                        {clientType.toUpperCase()}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        />
                        <div className="space-y-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="border-dashed border-border flex w-full items-center justify-between text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => setOptionalOpen(!optionalOpen)}
                            >
                                <span className="flex items-center gap-2">
                                    Optional Information
                                    <span className="text-xs font-normal opacity-60">
                                        (optional)
                                    </span>
                                </span>
                                {optionalOpen ? <ChevronUp /> : <ChevronDown />}
                            </Button>
                            {optionalOpen && (
                                <div className="mt-2 flex flex-col gap-3">
                                    <Controller
                                        name="address"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Field>
                                                <Input
                                                    {...field}
                                                    value={field.value || ""}
                                                    placeholder="Address"
                                                />
                                            </Field>
                                        )}
                                    />
                                    <Controller
                                        name="notes"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Field>
                                                <Textarea
                                                    {...field}
                                                    value={field.value || ""}
                                                    placeholder="What should be noted about this client?"
                                                />
                                            </Field>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </FieldGroup>
                    <Button type="submit" className="w-full mt-3" disabled={isPending}>
                        {isPending
                            ? (
                                <>
                                    <Loader2Icon className="animate-spin" />
                                    Adding...
                                </>
                            )
                            : (
                                <>
                                    <CirclePlusIcon />
                                    Add Client
                                </>
                            )
                        }
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}