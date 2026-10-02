import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    `Create your ${APP_NAME} account to start managing studios, booking sessions, and growing your creative business.`,
};

export default async function SignupLayout({
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
