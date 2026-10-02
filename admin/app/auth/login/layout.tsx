import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Log In",
  description:
    `Sign in to your ${APP_NAME} account to manage your studios, bookings, and clients.`,
};

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect("/");
  }

  return children;
}
