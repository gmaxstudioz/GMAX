import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In",
  description:
    `Sign in to your ${APP_NAME} account to manage your studios, bookings, and clients.`,
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
