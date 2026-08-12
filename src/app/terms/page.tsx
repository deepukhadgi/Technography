export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> whoami
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Terms <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 text-sm text-dim">Last updated: August 2026</p>

      <div className="mt-8 prose prose-invert prose-base max-w-none text-dim">
        <h2 className="text-fg">Acceptance of Terms</h2>
        <p>
          By accessing deepukhadgi.com.np, you accept these terms.
        </p>

        <h2 className="text-fg">Content</h2>
        <p>
          All content on this site is for informational purposes only. The author makes no warranties about accuracy or completeness.
        </p>

        <h2 className="text-fg">Comments</h2>
        <ul>
          <li>You are responsible for your comments</li>
          <li>Comments are moderated and may be deleted</li>
          <li>Do not post spam, abusive content, or private information</li>
        </ul>

        <h2 className="text-fg">Links</h2>
        <p>
          This site may link to external websites. We are not responsible for their content.
        </p>

        <h2 className="text-fg">Limitation of Liability</h2>
        <p>
          The author is not liable for any damages arising from use of this website.
        </p>

        <h2 className="text-fg">Changes</h2>
        <p>
          Terms may be updated periodically. Continued use constitutes acceptance.
        </p>

        <h2 className="text-fg">Contact</h2>
        <p>
          <a href="mailto:deepu.khadgi@gmail.com" className="text-accent hover:underline">deepu.khadgi@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
