import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> useradd --interactive
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Sign up <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Create an account to comment on posts and join the conversation.
        We&apos;ll email you a verification link.
      </p>

      <SignupForm />
    </div>
  );
}
