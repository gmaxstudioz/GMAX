import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    `Create your ${APP_NAME} account to start managing studios, booking sessions, and growing your creative business.`,
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
