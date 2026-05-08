"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState, useTransition, useEffect } from "react"
import { Loader2Icon, AlertTriangleIcon } from "lucide-react"

export function AcceptInvitationCard({
  invitationId,
  className,
  ...props
}: { invitationId: string } & React.ComponentProps<"div">) {
  const [isPending, startTransition] = useTransition();
  const [invitationState, setInvitationState] = useState<{
    isLoading: boolean;
    data: any | null;
    error: string | null;
  }>({
    isLoading: true,
    data: null,
    error: null,
  });
  
  const router = useRouter();

  useEffect(() => {
    async function loadInvitation() {
      try {
        const response = await authClient.organization.getInvitation({
            query: {
                id: invitationId
            }
        });
        if (response.error) {
            setInvitationState({ isLoading: false, data: null, error: response.error.message || "Invitation not found or expired" });
        } else {
            setInvitationState({ isLoading: false, data: response.data, error: null });
        }
      } catch (e: any) {
        setInvitationState({ isLoading: false, data: null, error: e.message || "An error occurred" });
      }
    }
    loadInvitation();
  }, [invitationId]);

  async function handleAccept() {
    startTransition(async () => {
      const response = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (response.error) {
        if (response.error.status === 401) {
            toast.error("Please sign in or create an account to accept the invitation");
            router.push(`/auth/login?redirect=/auth/accept-invitation/${invitationId}`);
        } else {
            toast.error(response.error.message || "Failed to accept invitation");
        }
      } else {
        toast.success("Successfully joined the studio!");
        router.push("/dashboard");
      }
    });
  }

  async function handleReject() {
    startTransition(async () => {
      const response = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (response.error) {
        toast.error(response.error.message || "Failed to reject invitation");
      } else {
        toast.success("Invitation rejected.");
        router.push("/");
      }
    });
  }

  if (invitationState.isLoading) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
             <CardTitle className="text-xl">Loading Invitation</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
             <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitationState.error) {
     return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
             <div className="flex justify-center mb-4">
                 <AlertTriangleIcon className="size-10 text-destructive" />
             </div>
             <CardTitle className="text-xl">Invalid Invitation</CardTitle>
             <CardDescription>
                 {invitationState.error}
             </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
             <Button variant="outline" onClick={() => router.push("/")}>Return Home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const { data } = invitationState;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Studio Invitation</CardTitle>
          <CardDescription>
            You have been invited to join a studio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Invited to join</p>
                <p className="font-semibold text-lg">{data?.organizationName}</p>
                {data?.inviterEmail && (
                   <p className="text-sm text-muted-foreground mt-2">
                       by <span className="font-medium text-foreground">{data.inviterEmail}</span>
                   </p>
                )}
                {data?.role && (
                   <p className="text-sm mt-2">
                       Role: <span className="capitalize font-medium">{data.role}</span>
                   </p>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
             <Button className="w-full" onClick={handleAccept} disabled={isPending}>
                {isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
                Accept Invitation
             </Button>
             <Button variant="outline" className="w-full" onClick={handleReject} disabled={isPending}>
                Refuse
             </Button>
             <div className="mt-4 text-center text-xs text-muted-foreground">
                 Make sure you are logged in using the email address the invitation was sent to.
             </div>
        </CardFooter>
      </Card>
    </div>
  )
}
