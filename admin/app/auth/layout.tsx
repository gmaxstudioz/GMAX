import { APP_NAME } from "@/lib/constants";
import { GalleryVerticalEndIcon } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: `Authentication | ${APP_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_NAME} authentication portal.`,
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  const reqHeaders = await headers();
  const currentPath =
    reqHeaders.get("x-pathname") ||
    reqHeaders.get("x-matched-path") ||
    reqHeaders.get("x-invoke-path") ||
    reqHeaders.get("next-url") ||
    "";

  const isExemptFromAuthRedirect =
    currentPath.includes("reset-password") ||
    currentPath.includes("accept-invitation");

  if (!isExemptFromAuthRedirect && session?.user) {
    const user = await db.query.user.findFirst({
      where: eq(schema.user.id, session.user.id),
      columns: { role: true },
    });
    const isAdmin = user?.role === "admin";
    if (isAdmin) {
      redirect("/");
    }
    const membership = await db.query.member.findFirst({
      where: eq(schema.member.userId, session.user.id),
    });
    if (membership) {
      redirect("/");
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 sm:p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEndIcon className="size-4" />
          </div>
          {APP_NAME}
        </Link>
        {children}
      </div>
    </div>
  );
}
