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

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const from = process.env.MAIL_FROM ?? "no-reply@deepukhadgi.com.np";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await getTransporter().sendMail({
    from,
    to,
    subject: "Verify your email — Technography",
    text: [
      "Hi there,",
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
      "<p>Hi there,</p>",
      "<p>Someone (hopefully you) signed up for an account on Technography with this email address.</p>",
      `<p>To verify your email address, <a href="${verifyUrl}">click here</a> or open this link:</p>`,
      `<p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      "<p>This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.</p>",
      "<p>— Deepu</p>",
    ].join("\n"),
  });
}
