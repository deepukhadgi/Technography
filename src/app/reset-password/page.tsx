import { Metadata } from "next";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — Technography",
  description: "Set a new password for your Technography account.",
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-mono font-bold tracking-tight">reset password</h1>
          <p className="mt-2 text-sm text-dim">
            Enter your new password below.
          </p>
        </header>

        <div className="rounded border border-line bg-bg/50 p-6">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}