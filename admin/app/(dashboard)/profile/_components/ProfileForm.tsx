"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, UserRoundIcon } from "lucide-react";
import Uploader from "@/components/web/file-uploader/Uploader";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateUserProfile } from "@/lib/actions/user";
import { authClient } from "@/lib/auth-client";

const UpdateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    image: z.string().optional(),
    phoneNumber: z.string().optional(),
});

type FormValues = z.infer<typeof UpdateProfileSchema>;

export function ProfileForm({ user }: { user: any }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(UpdateProfileSchema),
        defaultValues: {
            name: user.name || "",
            image: user.image || "",
            phoneNumber: user.phoneNumber || "",
        },
    });

    function onSubmit(values: FormValues) {
        startTransition(async () => {
            // First update via server action to ensure prisma gets phoneNumber
            const { error: serverError } = await tryCatch(updateUserProfile(values));
            
            if (serverError) {
                toast.error("Failed to update profile details.");
                return;
            }

            // Also update via auth client so the session context and navs re-render
            const { error: authError } = await authClient.updateUser({
                name: values.name,
                image: values.image || undefined,
            });

            if (authError) {
                toast.error("Failed to update session details.");
                return;
            }

            toast.success("Profile updated successfully!");
            router.refresh();
        });
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your avatar and personal details here.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Controller
                        name="image"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field>
                                <FieldLabel htmlFor="image">Profile Picture</FieldLabel>
                                <Uploader
                                    onUploadComplete={(key) => {
                                        field.onChange(key);
                                    }}
                                    onDelete={() => {
                                        field.onChange("");
                                    }}
                                    initialPreview={field.value}
                                    directory="studio/member/profile"
                                />
                                {fieldState.error && (
                                    <p className="text-xs text-destructive mt-1">
                                        {fieldState.error.message}
                                    </p>
                                )}
                            </Field>
                        )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field>
                                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                                    <Input
                                        {...field}
                                        id={field.name}
                                        type="text"
                                        placeholder="e.g. Jane Doe"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && (
                                        <p className="text-xs text-destructive mt-1">
                                            {fieldState.error.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />

                        <Controller
                            name="phoneNumber"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field>
                                    <FieldLabel htmlFor="phoneNumber">Phone Number</FieldLabel>
                                    <Input
                                        {...field}
                                        id={field.name}
                                        type="tel"
                                        placeholder="e.g. +1 234 567 890"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && (
                                        <p className="text-xs text-destructive mt-1">
                                            {fieldState.error.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2Icon className="animate-spin mr-2 h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <UserRoundIcon className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
