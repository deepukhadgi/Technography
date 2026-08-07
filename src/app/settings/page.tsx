import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import TwoFactorSettings from "@/components/TwoFactorSettings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/settings");
  }

  const pool = getPool();
  const result = await pool.query<{
    first_name: string;
    last_name: string;
    totp_secret: string | null;
  }>(
    "SELECT first_name, last_name, totp_secret FROM users WHERE id = $1",
    [session.userId]
  );

  const user = result.rows[0];
  if (!user) {
    redirect("/login?next=/settings");
  }

  const twoFactorEnabled = user.totp_secret !== null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> ~/settings
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Settings <span className="text-accent">/</span>
      </h1>

      <section className="mt-8 rounded border border-line bg-panel/50 p-6">
        <h2 className="font-mono text-sm font-semibold text-fg">Account</h2>
        <dl className="mt-4 space-y-2 font-mono text-sm">
          <div className="flex flex-wrap gap-x-4">
            <dt className="w-28 shrink-0 text-dim">name</dt>
            <dd className="text-fg">
              {user.first_name} {user.last_name}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-4">
            <dt className="w-28 shrink-0 text-dim">email</dt>
            <dd className="text-fg">{session.email}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded border border-line bg-panel/50 p-6">
        <h2 className="font-mono text-sm font-semibold text-fg">Two-Factor Auth</h2>
        <TwoFactorSettings
          initiallyEnabled={twoFactorEnabled}
          email={session.email}
        />
      </section>
    </div>
  );
}
