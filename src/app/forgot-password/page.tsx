import { Metadata } from "next";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — Technography",
  description: "Request a password reset link for your Technography account.",
};

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-mono font-bold tracking-tight">forgot password</h1>
          <p className="mt-2 text-sm text-dim">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </header>

        <div className="rounded border border-line bg-bg/50 p-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}