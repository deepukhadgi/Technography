import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Login" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> ssh login
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Login <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 text-sm text-dim">
        Sign in to your Technography account.
      </p>

      <div className="mt-8">
        <LoginForm nextPath={nextPath} />
      </div>

      <p className="mt-6 text-center text-xs text-dim">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          sign up
        </Link>
      </p>
    </div>
  );
}
