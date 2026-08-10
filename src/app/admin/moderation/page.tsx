import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminCommentList from "@/components/AdminCommentList";

export const metadata: Metadata = { title: "Moderation" };

export default async function ModerationPage() {
  const session = await getSession();
  if (!session || session.email !== process.env.OWNER_EMAIL) {
    redirect("/login?next=/admin/moderation");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> ~/admin/moderation
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Moderation <span className="text-accent">/</span>
      </h1>
      <p className="mt-2 font-mono text-sm text-dim">
        Comments below are awaiting approval before they appear on posts.
      </p>

      <AdminCommentList />
    </div>
  );
}
