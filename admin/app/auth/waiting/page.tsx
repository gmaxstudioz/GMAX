import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HourglassIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function WaitingForInvitePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const membership = await prisma.member.findFirst({
        where: { userId: session.user.id }
    });

    if (membership) {
        redirect("/"); // They have a membership, send them to dashboard
    }

    return (
        <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="max-w-md w-full text-center">
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <HourglassIcon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Waiting for Invitation</CardTitle>
                    <CardDescription className="text-base mt-2">
                        You have successfully signed in, but you do not have access to any studio yet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        Please wait for an invite from the manager or CEO of Gmax Studioz to access your dashboard. Once invited, you will be able to access the pages permitted by your role.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                        <Button asChild variant="outline">
                            <Link href="/">Check Status</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
