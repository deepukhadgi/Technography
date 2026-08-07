import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { buildOtpauthUri, generateTotpSecret } from "@/lib/totp";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Setup is a low-frequency admin action: 10 attempts per IP per hour.
const SETUP_IP_LIMIT = 10;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ip = clientIp(req);
  const retry = checkRateLimit(`2fa:setup:ip:${ip}`, SETUP_IP_LIMIT);
  if (retry !== null) {
    return Response.json({ error: "Too many requests. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  // Generate a fresh secret — NOT persisted yet. The user must prove they
  // scanned it (via /api/auth/2fa/verify) before we save anything.
  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpauthUri(session.email, secret);

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });
  } catch (err) {
    console.error("2fa setup QR generation failed:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  return Response.json({ secret, otpauthUrl, qrDataUrl });
}
