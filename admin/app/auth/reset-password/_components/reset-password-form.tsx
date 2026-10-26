"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/schemas/auth"
import z from "zod"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, Suspense, useEffect } from "react"
import { CheckCircle2Icon, AlertTriangleIcon, MailIcon, ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

function ResetPasswordFormContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [hasError, setHasError] = useState(Boolean(error));
  const [mode, setMode] = useState<"request" | "reset">(token && !error ? "reset" : "request");

  useEffect(() => {
    if (error) {
      setHasError(true);
      setMode("reset");
    } else if (token) {
      setHasError(false);
      setMode("reset");
    } else {
      setHasError(false);
      setMode("request");
    }
  }, [token, error]);

  // Form for requesting reset link
  const requestForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Form for setting new password
  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onRequestSubmit(data: z.infer<typeof forgotPasswordSchema>) {
    setServerError(null);
    startTransition(async () => {
      await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/auth/reset-password",
        fetchOptions: {
          onSuccess: () => {
            setRequestSubmitted(true);
            toast.success("Check your email for the reset link.");
          },
          onError: (err) => {
            setServerError(err.error.message);
          },
        },
      });
    });
  }

  async function onResetSubmit(data: z.infer<typeof resetPasswordSchema>) {
    if (!token) return;
    setServerError(null);
    startTransition(async () => {
      await authClient.resetPassword({
        newPassword: data.password,
        token,
        fetchOptions: {
          onSuccess: () => {
            setIsSuccess(true);
            toast.success("Password reset successfully!");
          },
          onError: (err) => {
            setServerError(err.error.message);
          },
        },
      });
    });
  }

  function handleSwitchToRequest() {
    setHasError(false);
    setServerError(null);
    setRequestSubmitted(false);
    setMode("request");
    requestForm.reset();
    router.replace("/auth/reset-password");
  }

  // 1. Error state — invalid or expired token
  if (hasError) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangleIcon className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <Button className="w-full" onClick={handleSwitchToRequest}>
                  Request new reset link
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/auth/login" className="inline-flex items-center gap-1">
                    <ArrowLeftIcon className="size-3" />
                    Back to login
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Success state — password was reset successfully
  if (isSuccess) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2Icon className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Password reset!</CardTitle>
            <CardDescription>
              Your password has been reset successfully. You can now log in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <Button className="w-full" onClick={() => router.push("/auth/login")}>
                  Go to login
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Request mode — email submitted confirmation
  if (mode === "request" && requestSubmitted) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2Icon className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              If an account exists with that email, we&apos;ve sent a password reset link. Please check your inbox and spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRequestSubmitted(false);
                    requestForm.reset();
                  }}
                >
                  <MailIcon className="mr-2 size-4" />
                  Try a different email
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/auth/login" className="inline-flex items-center gap-1">
                    <ArrowLeftIcon className="size-3" />
                    Back to login
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Request mode — enter email to request link
  if (mode === "request") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={requestForm.handleSubmit(onRequestSubmit)}>
              <FieldGroup>
                <Controller
                  name="email"
                  control={requestForm.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="email"
                        placeholder="m@example.com"
                        aria-invalid={fieldState.invalid}
                        required
                      />
                    </Field>
                  )}
                />

                <Field>
                  {serverError && <FieldError>{serverError}</FieldError>}
                  {Object.keys(requestForm.formState.errors).length > 0 && (
                    <FieldError errors={Object.values(requestForm.formState.errors)} />
                  )}
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Sending reset link..." : "Send reset link"}
                  </Button>
                  <FieldDescription className="text-center">
                    <Link href="/auth/login" className="inline-flex items-center gap-1">
                      <ArrowLeftIcon className="size-3" />
                      Back to login
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 5. Reset mode — enter new password
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetForm.handleSubmit(onResetSubmit)}>
            <FieldGroup>
              <Controller
                name="password"
                control={resetForm.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="password">New Password</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="password"
                      placeholder="Enter new password"
                      aria-invalid={fieldState.invalid}
                      required
                    />
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={resetForm.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="password"
                      placeholder="Confirm new password"
                      aria-invalid={fieldState.invalid}
                      required
                    />
                  </Field>
                )}
              />

              <Field>
                {serverError && <FieldError>{serverError}</FieldError>}
                {Object.keys(resetForm.formState.errors).length > 0 && (
                  <FieldError errors={Object.values(resetForm.formState.errors)} />
                )}
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Resetting password..." : "Reset password"}
                </Button>
                <FieldDescription className="flex flex-col gap-1 text-center">
                  <button
                    type="button"
                    onClick={handleSwitchToRequest}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Need a new reset link? Request one here
                  </button>
                  <Link href="/auth/login" className="inline-flex items-center justify-center gap-1">
                    <ArrowLeftIcon className="size-3" />
                    Back to login
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ResetPasswordForm(props: React.ComponentProps<"div">) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordFormContent {...props} />
    </Suspense>
  );
}
