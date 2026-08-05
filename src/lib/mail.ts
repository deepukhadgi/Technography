import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 2525),
      secure: false, // LAN Postfix on 2525 — no TLS, no auth
      ignoreTLS: true,
    });
  }
  return transporter;
}

export async function sendVerificationEmail(to: string, token: string, firstName: string = "there"): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const from = process.env.MAIL_FROM ?? "no-reply@deepukhadgi.com.np";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Verify your email — Technography",
    text: [
      `Hi ${firstName},`,
      "",
      "Someone (hopefully you) signed up for an account on Technography with this email address.",
      "",
      `To verify your email address, open this link: ${verifyUrl}`,
      "",
      "This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.",
      "",
      "— Deepu",
    ].join("\n"),
    html: [
      `<p>Hi ${firstName},</p>`,
      "<p>Someone (hopefully you) signed up for an account on Technography with this email address.</p>",
      `<p>To verify your email address, <a href="${verifyUrl}">click here</a> or open this link:</p>`,
      `<p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      "<p>This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>",
      "<p>— Deepu</p>",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const from = process.env.MAIL_FROM ?? "no-reply@deepukhadgi.com.np";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Reset your password — Technography",
    text: [
      "Hi there,",
      "",
      "Someone requested a password reset for your Technography account.",
      "",
      `To set a new password, open this link: ${resetUrl}`,
      "",
      "This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
      "",
      "— Deepu",
    ].join("\n"),
    html: [
      "<p>Hi there,</p>",
      "<p>Someone requested a password reset for your Technography account.</p>",
      `<p>To set a new password, <a href="${resetUrl}">click here</a> or open this link:</p>`,
      `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
      "<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>",
      "<p>— Deepu</p>",
    ].join("\n"),
  });
}

export async function sendReplyNotificationEmail(args: {
  to: string;
  commenterName: string;
  replyBody: string;
  postTitle: string;
  postSlug: string;
  commentUrl: string;
}): Promise<void> {
  const from = process.env.MAIL_FROM ?? "no-reply@deepukhadgi.com.np";

  await getTransporter().sendMail({
    from,
    to: args.to,
    subject: `New reply to your comment on "${args.postTitle}" — Technography`,
    text: [
      `Hi there,`,
      ``,
      `${args.commenterName} replied to your comment on "${args.postTitle}":`,
      ``,
      `"${args.replyBody.slice(0, 280)}${args.replyBody.length > 280 ? "…" : ""}"`,
      ``,
      `See the conversation: ${args.commentUrl}`,
      ``,
      `You're receiving this because you opted in to reply notifications. You can stop these by not checking "Email me when someone replies" on future comments.`,
      ``,
      `— Deepu`,
    ].join("\n"),
    html: [
      "<p>Hi there,</p>",
      `<p><strong>${escapeHtml(args.commenterName)}</strong> replied to your comment on <em>"${escapeHtml(args.postTitle)}"</em>:</p>`,
      `<blockquote style="border-left:3px solid #555;padding-left:12px;margin:12px 0;color:#bbb;">${escapeHtml(args.replyBody.slice(0, 280))}${args.replyBody.length > 280 ? "…" : ""}</blockquote>`,
      `<p><a href="${args.commentUrl}">See the conversation</a></p>`,
      `<p style="color:#888;font-size:12px;">You're receiving this because you opted in to reply notifications on Technography. You can stop these by not checking "Email me when someone replies" on future comments.</p>`,
      "<p>— Deepu</p>",
    ].join("\n"),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
