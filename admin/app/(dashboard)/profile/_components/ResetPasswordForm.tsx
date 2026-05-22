"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const ResetPasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type FormValues = z.infer<typeof ResetPasswordSchema>;

export function ResetPasswordForm() {
    const [isPending, setIsPending] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(ResetPasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(values: FormValues) {
        setIsPending(true);

        try {
            const { error } = await authClient.changePassword({
                newPassword: values.newPassword,
                currentPassword: values.currentPassword,
                revokeOtherSessions: true,
            });

            if (error) {
                toast.error(error.message || "Failed to reset password.");
                return;
            }

            toast.success("Password successfully reset!");
            form.reset();
        } catch (e) {
            const err = e as Error;
            toast.error(err?.message || "Failed to reset password.");
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <Controller
                        name="currentPassword"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field>
                                <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    type="password"
                                    placeholder="Enter current password"
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
                        name="newPassword"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field>
                                <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    type="password"
                                    placeholder="Enter new password"
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
                        name="confirmPassword"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field>
                                <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
                                <Input
                                    {...field}
                                    id={field.name}
                                    type="password"
                                    placeholder="Confirm new password"
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

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2Icon className="animate-spin mr-2 h-4 w-4" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <KeyRoundIcon className="mr-2 h-4 w-4" />
                                    Change Password
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
