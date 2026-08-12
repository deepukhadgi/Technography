export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> whoami
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Privacy <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 text-sm text-dim">Last updated: August 2026</p>

      <div className="mt-8 prose prose-invert prose-base max-w-none text-dim">
        <h2 className="text-fg">Who We Are</h2>
        <p>
          This website is owned and operated by <strong className="text-fg">Deepu Khadgi</strong>. It is a personal
          technology blog focused on self-hosting, DevOps, networking, and homelab infrastructure.
        </p>

        <h2 className="text-fg">What Data We Collect</h2>
        <ul>
          <li><strong className="text-fg">Newsletter emails</strong> — collected via the subscription form and stored in Listmonk</li>
          <li><strong className="text-fg">Comments</strong> — name, email, and comment text (stored in PostgreSQL)</li>
          <li><strong className="text-fg">Analytics</strong> — anonymized browsing data via Umami (no IP logging)</li>
          <li><strong className="text-fg">Cookies</strong> — theme preference (dark/light mode) stored in localStorage</li>
        </ul>

        <h2 className="text-fg">What We Do With Your Data</h2>
        <ul>
          <li>Send you weekly blog digest emails (only if you subscribe)</li>
          <li>Display your comments on blog posts (moderated first)</li>
          <li>Improve the website based on anonymized usage patterns</li>
          <li>Never sell, share, or rent your data to third parties</li>
        </ul>

        <h2 className="text-fg">Third-Party Services</h2>
        <ul>
          <li><strong className="text-fg">Cloudflare</strong> — DNS, CDN, and DDoS protection</li>
          <li><strong className="text-fg">Umami</strong> — privacy-friendly analytics (self-hosted)</li>
          <li><strong className="text-fg">Listmonk</strong> — newsletter management (self-hosted)</li>
          <li><strong className="text-fg">Google Fonts</strong> — typography (optional, can be disabled)</li>
        </ul>

        <h2 className="text-fg">Your Rights</h2>
        <p>
          You can request deletion of your data at any time by contacting{" "}
          <a href="mailto:deepu.khadgi@gmail.com" className="text-accent hover:underline">deepu.khadgi@gmail.com</a>.
        </p>

        <h2 className="text-fg">Questions</h2>
        <p>
          Email: <a href="mailto:deepu.khadgi@gmail.com" className="text-accent hover:underline">deepu.khadgi@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
