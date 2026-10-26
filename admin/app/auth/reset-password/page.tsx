import type { Metadata } from "next";
import { ResetPasswordForm } from "@/app/auth/reset-password/_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset or request a link to set a new password for your account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
