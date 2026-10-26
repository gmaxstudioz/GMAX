import type { Metadata } from "next";
import { LoginForm } from "@/app/auth/login/_components/login-form";

export const metadata: Metadata = {
  title: "Log In",
  description: "Sign in to your account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
