export default function NewsletterCTA() {
  return (
    <div className="mt-12 rounded border border-line bg-panel p-6">
      <h3 className="font-mono text-lg font-bold text-fg">
        Enjoyed this post?
      </h3>
      <p className="mt-2 text-sm text-dim">
        Join the newsletter for weekly DevOps tips and self-hosted guides.
      </p>
      <form
        action="/api/newsletter"
        method="POST"
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        {/* Honeypot — hidden from users, traps bots */}
        <input
          type="text"
          name="hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <input
          type="email"
          name="email"
          required
          maxLength={200}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-w-0 flex-1 rounded border border-line bg-bg px-3 py-2 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="rounded border border-accent/60 bg-accent/10 px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
        >
          Subscribe
        </button>
      </form>
    </div>
  );
}
