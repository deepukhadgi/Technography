/**
 * Telegram notifications for site events (signups, newsletter subscriptions).
 *
 * Fire-and-forget by design: never throws, never blocks, never fails the
 * request that triggered it. If the bot token/chat id are unset or the
 * Telegram API is unreachable, we log quietly and move on.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

const MAX_RETRIES = 2;

function escapeMarkdown(text: string): string {
  // Telegram MarkdownV2 reserves: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function telegramNotify(
  kind: "signup" | "newsletter",
  fields: { name?: string; email: string; extra?: string }
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("telegramNotify: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured");
    return;
  }

  const icon = kind === "signup" ? "🆕" : "📬";
  const title = kind === "signup" ? "New signup" : "New newsletter subscriber";
  const name = fields.name?.trim() ? fields.name.trim() : "(no name)";

  const lines = [
    `${icon} *${title}*`,
    `• Name: ${name}`,
    `• Email: ${fields.email}`,
  ];
  if (fields.extra) lines.push(`• ${fields.extra}`);
  lines.push(`• Time: ${new Date().toISOString()}`);

  const text = lines.map(escapeMarkdown).join("\n");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) return;
      console.warn(`telegramNotify: Telegram API ${res.status} (attempt ${attempt})`);
    } catch (err) {
      console.warn(`telegramNotify: fetch failed (attempt ${attempt})`, err);
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}
