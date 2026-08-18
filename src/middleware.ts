import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Security headers
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL ?? "http://localhost:3000";
  res.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.goentri.com ${umamiUrl}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${umamiUrl} blob:; frame-ancestors 'none'`
  );
  // HSTS only over HTTPS (Cloudflare handles TLS termination)
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // Remove X-Powered-By
  res.headers.delete("X-Powered-By");

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
