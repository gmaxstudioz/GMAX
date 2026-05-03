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
import { authClient } from "@/lib/auth-client"
import { registerSchema } from "@/lib/schemas/auth"
import z from "zod"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, Suspense } from "react"
import { Loader2Icon } from "lucide-react"



function SignupFormContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  function getSafeRedirectUrl(raw: string | null): string {
    if (!raw) return "/";
    // Reject protocol-relative URLs and external schemes
    if (raw.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      try {
        const parsed = new URL(raw, window.location.origin);
        if (parsed.origin !== window.location.origin) return "/";
        return parsed.pathname + parsed.search + parsed.hash;
      } catch {
        return "/";
      }
    }
    // Allow relative paths starting with /
    if (raw.startsWith("/")) return raw;
    return "/";
  }

  const redirectUrl = getSafeRedirectUrl(searchParams.get("redirect"));

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    }
  })

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    setServerError(null);
    startTransition(async () => {
      await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        
        fetchOptions: {
          onSuccess: () => {
              toast.success("Account created successfully. You can now log in.");
              router.push(redirectUrl);
          },
          onError: (error) => {
              setServerError(error.error.message);
          }
        }
      });
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter your full name"
                      autoComplete="off"
                    />
                  </Field>
                )}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="email"
                      placeholder="example@gmail.com"
                      aria-invalid={fieldState.invalid}
                      required
                    />
                  </Field>
                )}
              />

              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="password"
                          placeholder="Enter your password"
                          aria-invalid={fieldState.invalid}
                          required
                        />
                      </Field>
                    )}
                  />

                  <Controller 
                    name="confirmPassword"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel htmlFor="confirmPassword">
                          Confirm Password
                        </FieldLabel>
                        <Input 
                          {...field}
                          id={field.name}
                          type="password" 
                          placeholder="Confirm your password"
                          aria-invalid={fieldState.invalid}
                          required 
                        />
                      </Field>
                    )}
                  />
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                {serverError && <FieldError>{serverError}</FieldError>}
                {Object.keys(form.formState.errors).length > 0 && (
                  <FieldError errors={Object.values(form.formState.errors)} />
                )}
                <Button className="mt-5" disabled={isPending}>{isPending ? (
                        <>
                            <Loader2Icon className="size-4 animate-spin" />
                            <span>Loading...</span>
                        </>
                    ) : (
                        <span>Sign up</span>
                    )}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <a href="/auth/login">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

export function SignupForm(props: React.ComponentProps<"div">) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupFormContent {...props} />
    </Suspense>
  )
}
